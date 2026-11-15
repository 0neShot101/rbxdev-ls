import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';

import {
  decodeCheckRecord,
  decodeLock,
  decodePointer,
  decodeSnapshotManifest,
  isGenerationName,
} from '@definitions/updates/validate';

import type {
  CachedSnapshot,
  GenerationDirectory,
  LockAcquisition,
  LockHooks,
  LockRecord,
  SnapshotBytes,
  SnapshotManifest,
} from '@typings/updates';

/** Minimum interval between update attempts. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Age after which an update lock is considered abandoned. */
export const LOCK_EXPIRY_MS = 5 * 60 * 1000;
/** Age after which an unreferenced generation is deleted. */
export const GENERATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** File names inside the cache and data directories. */
export const FILES = {
  'pointer': 'current.json',
  'check': 'check.json',
  'lock': 'update.lock',
  'recovery': 'recovery.lock',
  'manifest': 'manifest.json',
  'api': 'roblox-api.json',
  'docs': 'roblox-docs.json',
  'luauDocs': 'luau-docs.json',
  'sunc': 'sunc-api.json',
} as const;

/**
 * Hashes bytes exactly as stored.
 * @returns Lowercase hexadecimal SHA-256 digest.
 */
export const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

/**
 * Reads a file, returning `undefined` when it is missing or unreadable.
 * @param path - File to read.
 */
export const readOptional = (path: string): Buffer | undefined => {
  try {
    return readFileSync(path);
  } catch {
    return undefined;
  }
};

/**
 * Replaces a file through a sibling temporary file and rename, so readers never see a partial write.
 * @param path - Destination file.
 * @param bytes - Complete contents.
 * @param rename - Rename implementation; tests inject failures.
 */
export const writeAtomically = (
  path: string,
  bytes: Buffer | string,
  rename: (from: string, to: string) => void = renameSync,
): void => {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, bytes);
  try {
    rename(temporary, path);
  } catch (cause) {
    rmSync(temporary, { 'force': true });
    throw cause;
  }
};

/**
 * Resolves the active, complete cache generation.
 * @param cacheDirectory - Runtime definitions cache.
 * @returns The generation with its manifest, or `undefined` when the pointer or manifest is missing or invalid.
 */
export const readCurrentSnapshot = (cacheDirectory: string): CachedSnapshot | undefined => {
  const pointerBytes = readOptional(join(cacheDirectory, FILES.pointer));
  const pointer = pointerBytes === undefined ? undefined : decodePointer(pointerBytes.toString('utf-8'));
  if (pointer === undefined) return undefined;
  const directory = join(cacheDirectory, pointer.generation);
  const manifestBytes = readOptional(join(directory, FILES.manifest));
  const manifest = manifestBytes === undefined ? undefined : decodeSnapshotManifest(manifestBytes.toString('utf-8'));
  if (manifest === undefined) return undefined;
  return { 'generation': pointer.generation, directory, manifest };
};

/**
 * Reads a snapshot's datasets and checks them against the manifest digests without parsing them.
 * @returns Both datasets' exact bytes, or `undefined` when either is missing or corrupt.
 */
export const readVerifiedSnapshot = (snapshot: CachedSnapshot): SnapshotBytes | undefined => {
  const api = readOptional(join(snapshot.directory, FILES.api));
  const docs = readOptional(join(snapshot.directory, FILES.docs));
  if (api === undefined || docs === undefined) return undefined;
  if (sha256(api) !== snapshot.manifest.apiSha256 || sha256(docs) !== snapshot.manifest.docsSha256) return undefined;
  return { api, docs };
};

/**
 * Milliseconds until the next daily update attempt is due; missing, invalid or future attempt times are due now.
 * @param cacheDirectory - Runtime definitions cache.
 * @param now - Current time in milliseconds.
 */
export const millisecondsUntilDue = (cacheDirectory: string, now: number): number => {
  const bytes = readOptional(join(cacheDirectory, FILES.check));
  const record = bytes === undefined ? undefined : decodeCheckRecord(bytes.toString('utf-8'));
  if (record === undefined || record.attemptedAt > now) return 0;
  return Math.max(0, CHECK_INTERVAL_MS - (now - record.attemptedAt));
};

/**
 * Decides whether a daily update attempt is due.
 * @param cacheDirectory - Runtime definitions cache.
 * @param now - Current time in milliseconds.
 */
export const isRefreshDue = (cacheDirectory: string, now: number): boolean =>
  millisecondsUntilDue(cacheDirectory, now) === 0;

/**
 * Records the start of an update attempt.
 * @param cacheDirectory - Runtime definitions cache.
 * @param attemptedAt - Attempt start time in milliseconds.
 */
export const writeCheckRecord = (cacheDirectory: string, attemptedAt: number): void =>
  writeAtomically(join(cacheDirectory, FILES.check), JSON.stringify({ 'schema': 1, attemptedAt }));

/**
 * Creates an empty generation directory named by a fresh UUID.
 * @param cacheDirectory - Runtime definitions cache.
 */
export const createGeneration = (cacheDirectory: string): GenerationDirectory => {
  const generation = randomUUID();
  const directory = join(cacheDirectory, generation);
  mkdirSync(directory);
  return { generation, directory };
};

/**
 * Writes a generation's datasets, then its manifest last.
 * @param directory - Generation directory.
 * @param api - Exact API dump bytes.
 * @param docs - Exact Roblox docs bytes.
 * @param manifest - Manifest describing both datasets.
 */
export const writeGeneration = (directory: string, api: Buffer, docs: Buffer, manifest: SnapshotManifest): void => {
  writeAtomically(join(directory, FILES.api), api);
  writeAtomically(join(directory, FILES.docs), docs);
  writeAtomically(join(directory, FILES.manifest), JSON.stringify(manifest, null, 2));
};

/**
 * Points `current.json` at a complete generation by renaming a temporary pointer over it.
 * @param rename - Rename implementation; a failure leaves the previous pointer in place.
 */
export const publishPointer = (
  cacheDirectory: string,
  generation: string,
  rename: (from: string, to: string) => void,
): void => writeAtomically(join(cacheDirectory, FILES.pointer), JSON.stringify({ 'schema': 1, generation }), rename);

/**
 * Deletes generation directories that are not referenced and are older than the retention period.
 * Only UUID-named directories are considered; any other path is left untouched.
 * @param keep - Generations that must survive.
 */
export const collectGarbage = (cacheDirectory: string, now: number, keep: ReadonlySet<string>): void => {
  for (const entry of readdirSync(cacheDirectory, { 'withFileTypes': true })) {
    if (entry.isDirectory() === false || isGenerationName(entry.name) === false || keep.has(entry.name)) continue;
    const path = join(cacheDirectory, entry.name);
    if (now - statSync(path).mtimeMs >= GENERATION_RETENTION_MS) rmSync(path, { 'recursive': true, 'force': true });
  }
};

const isAlreadyPresent = (cause: unknown): boolean =>
  cause instanceof Error && 'code' in cause && cause.code === 'EEXIST';

const createExclusive = (path: string, contents: string): boolean => {
  try {
    const descriptor = openSync(path, 'wx');
    try {
      writeSync(descriptor, contents);
    } finally {
      closeSync(descriptor);
    }
    return true;
  } catch (cause) {
    if (isAlreadyPresent(cause)) return false;
    throw cause;
  }
};

const readLock = (path: string): LockRecord | undefined => {
  const bytes = readOptional(path);
  if (bytes === undefined) return undefined;
  const record = decodeLock(bytes.toString('utf-8'));
  if (record !== undefined) return record;
  try {
    return { 'id': '', 'startedAt': statSync(path).mtimeMs };
  } catch {
    return undefined;
  }
};

const isExpired = (lock: LockRecord, now: number): boolean =>
  lock.startedAt > now || now - lock.startedAt >= LOCK_EXPIRY_MS;

const removeQuietly = (path: string): void => rmSync(path, { 'force': true });

/**
 * Acquires the exclusive update lock, reclaiming an expired lock only through the recovery protocol:
 * contenders skip while `recovery.lock` exists, and an occupied recovery lock is never reclaimed automatically.
 * @param cacheDirectory - Runtime definitions cache.
 * @param now - Current time in milliseconds.
 * @param hooks - Test seam invoked while this process owns the recovery lock.
 */
export const acquireLock = (cacheDirectory: string, now: number, hooks?: LockHooks): LockAcquisition => {
  const lockPath = join(cacheDirectory, FILES.lock);
  const recoveryPath = join(cacheDirectory, FILES.recovery);
  const id = randomUUID();
  const contents = JSON.stringify({ id, 'startedAt': now });
  const acquired: LockAcquisition = {
    'kind': 'acquired',
    'release': () => {
      if (readLock(lockPath)?.id === id) removeQuietly(lockPath);
    },
  };

  if (existsSync(recoveryPath))
    return {
      'kind': 'skipped',
      'reason': `lock recovery is blocked by ${recoveryPath}; stop every rbxdev process and delete it`,
    };
  if (createExclusive(lockPath, contents)) return acquired;

  const holder = readLock(lockPath);
  if (holder !== undefined && isExpired(holder, now) === false)
    return { 'kind': 'skipped', 'reason': 'another update is running' };
  if (createExclusive(recoveryPath, contents) === false)
    return { 'kind': 'skipped', 'reason': 'another process is recovering the lock' };

  try {
    hooks?.afterRecoveryAcquired?.();
    const current = readLock(lockPath);
    if (current !== undefined && isExpired(current, now) === false)
      return { 'kind': 'skipped', 'reason': 'lock was renewed' };
    removeQuietly(lockPath);
    return createExclusive(lockPath, contents)
      ? acquired
      : { 'kind': 'skipped', 'reason': 'lock was taken during recovery' };
  } finally {
    removeQuietly(recoveryPath);
  }
};
