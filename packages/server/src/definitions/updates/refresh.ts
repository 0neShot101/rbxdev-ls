import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { convertRobloxApiToTypes } from '@definitions/roblox';
import { serializeDocs } from '@definitions/updates/docsStore';
import { createDownloader, UPSTREAM_SOURCES } from '@definitions/updates/download';
import {
  acquireLock,
  collectGarbage,
  createGeneration,
  FILES,
  isRefreshDue,
  publishPointer,
  readCurrentSnapshot,
  readOptional,
  readVerifiedSnapshot,
  sha256,
  writeAtomically,
  writeCheckRecord,
  writeGeneration,
} from '@definitions/updates/storage';
import {
  compareVersions,
  decodeApiDump,
  decodeBundledManifest,
  decodeDocs,
  decodeStudioVersion,
  encodeApiDump,
} from '@definitions/updates/validate';

import type {
  CancelMessage,
  ApiCandidate,
  BundledData,
  BundledManifest,
  CachedSnapshot,
  Dataset,
  DocsCandidate,
  RefreshEnvironment,
  RefreshOptions,
  RefreshResult,
  SnapshotBytes,
  SnapshotManifest,
  StudioVersion,
} from '@typings/updates';
import type { RobloxApiDump } from '@typings/definitions';
import type { DocsDatabase } from '@typings/docs';
import type { Mutable } from '@typings/types';

const LUAU_DOCS_TAG = '1.69.0';

const createEnvironment = (): RefreshEnvironment => ({
  'download': createDownloader(),
  'sources': UPSTREAM_SOURCES,
  'now': Date.now,
  'rename': renameSync,
});

const fetchBody = async (
  environment: RefreshEnvironment,
  signal: AbortSignal,
  dataset: Dataset,
  url: string,
): Promise<Buffer> => {
  const result = await environment.download({ url, dataset, 'etag': undefined, signal });
  if (result.status === 'not-modified') throw new Error(`${dataset} returned 304 to an unconditional request`);
  return result.body;
};

const fetchStudioVersion = async (environment: RefreshEnvironment, signal: AbortSignal): Promise<StudioVersion> => {
  const body = await fetchBody(environment, signal, 'version', environment.sources.version);
  const version = decodeStudioVersion(body.toString('utf-8'));
  if (version === undefined) throw new Error('malformed Studio version response');
  return version;
};

const requireApi = (bytes: Buffer): RobloxApiDump => {
  const dump = decodeApiDump(bytes.toString('utf-8'));
  if (dump === undefined) throw new Error('API dump failed validation');
  convertRobloxApiToTypes(dump);
  return dump;
};

const requireDocs = (bytes: Buffer, dataset: Dataset): DocsDatabase => {
  const database = decodeDocs(bytes.toString('utf-8'));
  if (database === undefined) throw new Error(`${dataset} failed validation`);
  return database;
};

const readBundled = (directory: string): BundledData => {
  const manifestBytes = readOptional(join(directory, FILES.manifest));
  return {
    'manifest': manifestBytes === undefined ? undefined : decodeBundledManifest(manifestBytes.toString('utf-8')),
    'api': readOptional(join(directory, FILES.api)),
    'docs': readOptional(join(directory, FILES.docs)),
  };
};

const isIntact = (bytes: Buffer, digest: string | undefined, validate: (bytes: Buffer) => void): boolean => {
  if (digest !== undefined) return sha256(bytes) === digest;
  try {
    validate(bytes);
    return true;
  } catch {
    return false;
  }
};

const selectApi = (
  snapshot: CachedSnapshot | undefined,
  cached: SnapshotBytes | undefined,
  bundled: BundledData,
): ApiCandidate | undefined => {
  const bundledVersion = bundled.manifest?.apiVersion;
  if (snapshot !== undefined && cached !== undefined)
    if (bundledVersion === undefined || compareVersions(snapshot.manifest.apiVersion, bundledVersion) > 0)
      return {
        'bytes': cached.api,
        'version': snapshot.manifest.apiVersion,
        'upload': snapshot.manifest.apiUpload,
        'fetchedAt': snapshot.manifest.apiFetchedAt,
        'source': 'cache',
      };
  const upload = bundled.manifest?.apiUpload;
  if (bundled.api === undefined || bundledVersion === undefined || upload === undefined) return undefined;
  if (isIntact(bundled.api, bundled.manifest?.apiSha256, requireApi) === false) return undefined;
  return {
    'bytes': bundled.api,
    'version': bundledVersion,
    upload,
    'fetchedAt': bundled.manifest?.apiFetchedAt ?? 0,
    'source': 'bundle',
  };
};

/** Only docs already stored in the `sorted-lines` layout are reusable; anything else is fetched and rewritten. */
const selectDocs = (
  snapshot: CachedSnapshot | undefined,
  cached: SnapshotBytes | undefined,
  bundled: BundledData,
): DocsCandidate | undefined => {
  const bundledFetchedAt = bundled.manifest?.docsFetchedAt;
  if (snapshot !== undefined && cached !== undefined && snapshot.manifest.docsLayout === 'sorted-lines')
    if (
      bundled.docs === undefined ||
      bundledFetchedAt === undefined ||
      snapshot.manifest.docsFetchedAt > bundledFetchedAt
    )
      return {
        'bytes': cached.docs,
        'fetchedAt': snapshot.manifest.docsFetchedAt,
        'etag': snapshot.manifest.docsEtag,
        'source': 'cache',
      };
  if (bundled.docs === undefined || bundledFetchedAt === undefined) return undefined;
  if (bundled.manifest?.docsLayout !== 'sorted-lines') return undefined;
  const validate = (bytes: Buffer): void => void requireDocs(bytes, 'robloxDocs');
  if (isIntact(bundled.docs, bundled.manifest.docsSha256, validate) === false) return undefined;
  return {
    'bytes': bundled.docs,
    'fetchedAt': bundledFetchedAt,
    'etag': bundled.manifest.docsEtag,
    'source': 'bundle',
  };
};

const refreshApi = async (
  environment: RefreshEnvironment,
  signal: AbortSignal,
  studio: StudioVersion,
  baseline: ApiCandidate | undefined,
): Promise<ApiCandidate> => {
  if (baseline !== undefined) {
    const order = compareVersions(studio.version, baseline.version);
    if (order < 0 || (order === 0 && studio.clientVersionUpload === baseline.upload)) return baseline;
  }
  const body = await fetchBody(environment, signal, 'api', environment.sources.api(studio.clientVersionUpload));
  const bytes = encodeApiDump(requireApi(body));
  return {
    bytes,
    'version': studio.version,
    'upload': studio.clientVersionUpload,
    'fetchedAt': environment.now(),
    'source': 'upstream',
  };
};

const refreshDocs = async (
  environment: RefreshEnvironment,
  signal: AbortSignal,
  baseline: DocsCandidate | undefined,
): Promise<DocsCandidate> => {
  const url = environment.sources.robloxDocs;
  const conditional = await environment.download({ url, 'dataset': 'robloxDocs', 'etag': baseline?.etag, signal });
  if (conditional.status === 'not-modified' && baseline !== undefined && baseline.etag !== undefined) return baseline;
  const result =
    conditional.status === 'ok'
      ? conditional
      : await environment.download({ url, 'dataset': 'robloxDocs', 'etag': undefined, signal });
  if (result.status === 'not-modified') throw new Error('robloxDocs returned 304 to an unconditional request');
  const bytes = serializeDocs(requireDocs(result.body, 'robloxDocs'));
  return { bytes, 'fetchedAt': environment.now(), 'etag': result.etag, 'source': 'upstream' };
};

const describeFailure = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

const throwIfCancelled = (signal: AbortSignal): void => {
  if (signal.aborted) throw new Error('cancelled');
};

const publish = (
  options: RefreshOptions,
  environment: RefreshEnvironment,
  api: ApiCandidate,
  docs: DocsCandidate,
): RefreshResult => {
  throwIfCancelled(options.signal);
  const staged = createGeneration(options.destination);
  try {
    const manifest: Mutable<SnapshotManifest> = {
      'schema': 1,
      'checkedAt': environment.now(),
      'apiVersion': api.version,
      'apiUpload': api.upload,
      'apiFetchedAt': api.fetchedAt,
      'docsFetchedAt': docs.fetchedAt,
      'apiSha256': sha256(api.bytes),
      'docsSha256': sha256(docs.bytes),
      'docsLayout': 'sorted-lines',
    };
    if (docs.etag !== undefined) manifest.docsEtag = docs.etag;
    writeGeneration(staged.directory, api.bytes, docs.bytes, manifest);
    throwIfCancelled(options.signal);
    publishPointer(options.destination, staged.generation, environment.rename);
  } catch (cause) {
    rmSync(staged.directory, { 'recursive': true, 'force': true });
    throw cause;
  }
  return { 'kind': 'published', 'generation': staged.generation };
};

const refreshRuntime = async (options: RefreshOptions, environment: RefreshEnvironment): Promise<RefreshResult> => {
  mkdirSync(options.destination, { 'recursive': true });
  const lock = acquireLock(options.destination, environment.now(), options.lockHooks);
  if (lock.kind === 'skipped') return lock;
  try {
    const now = environment.now();
    if (isRefreshDue(options.destination, now) === false)
      return { 'kind': 'skipped', 'reason': 'checked within the last day' };
    writeCheckRecord(options.destination, now);
    const snapshot = readCurrentSnapshot(options.destination);
    collectGarbage(options.destination, now, new Set(snapshot === undefined ? [] : [snapshot.generation]));
    const cached = snapshot === undefined ? undefined : readVerifiedSnapshot(snapshot);
    const bundled = readBundled(options.bundledDirectory);
    const studio = await fetchStudioVersion(environment, options.signal);
    const api = await refreshApi(environment, options.signal, studio, selectApi(snapshot, cached, bundled));
    const docs = await refreshDocs(environment, options.signal, selectDocs(snapshot, cached, bundled));
    if (cached !== undefined && api.source === 'cache' && docs.source === 'cache') return { 'kind': 'unchanged' };
    return publish(options, environment, api, docs);
  } catch (cause) {
    const reason = describeFailure(cause);
    options.logger(`Definitions update failed: ${reason}`);
    return { 'kind': 'failed', reason };
  } finally {
    lock.release();
  }
};

const refreshRelease = async (options: RefreshOptions, environment: RefreshEnvironment): Promise<RefreshResult> => {
  const { signal } = options;
  const studio = await fetchStudioVersion(environment, signal);
  const apiBody = await fetchBody(environment, signal, 'api', environment.sources.api(studio.clientVersionUpload));
  const docs = await environment.download({
    'url': environment.sources.robloxDocs,
    'dataset': 'robloxDocs',
    'etag': undefined,
    signal,
  });
  const luauDocs = await fetchBody(environment, signal, 'luauDocs', environment.sources.luauDocs);
  if (docs.status === 'not-modified') throw new Error('robloxDocs returned 304 to an unconditional request');
  const api = encodeApiDump(requireApi(apiBody));
  const robloxDocs = serializeDocs(requireDocs(docs.body, 'robloxDocs'));
  const luauBytes = serializeDocs(requireDocs(luauDocs, 'luauDocs'));
  throwIfCancelled(signal);

  const now = environment.now();
  const manifest: Mutable<BundledManifest> = {
    'schema': 1,
    'apiVersion': studio.version,
    'apiUpload': studio.clientVersionUpload,
    'apiFetchedAt': now,
    'docsFetchedAt': now,
    'apiSha256': sha256(api),
    'docsSha256': sha256(robloxDocs),
    'docsLayout': 'sorted-lines',
    'luauDocsTag': LUAU_DOCS_TAG,
  };
  if (docs.etag !== undefined) manifest.docsEtag = docs.etag;
  mkdirSync(options.destination, { 'recursive': true });
  rmSync(join(options.destination, FILES.manifest), { 'force': true });
  writeAtomically(join(options.destination, FILES.api), api, environment.rename);
  writeAtomically(join(options.destination, FILES.docs), robloxDocs, environment.rename);
  writeAtomically(join(options.destination, FILES.luauDocs), luauBytes, environment.rename);
  writeAtomically(join(options.destination, FILES.manifest), JSON.stringify(manifest, null, 2), environment.rename);
  options.logger(
    `Fetched API ${studio.version} (${api.length} bytes), docs (${robloxDocs.length} bytes), Luau docs (${luauBytes.length} bytes)`,
  );
  return { 'kind': 'released' };
};

/**
 * Refreshes Roblox API and documentation data. Runtime mode updates the cache under its lock and never throws;
 * release mode fetches every dataset, validates all of them, writes the manifest last and throws on any failure.
 * @param options - Destination, bundled data, mode, cancellation signal and logger.
 */
export const refreshDefinitions = (options: RefreshOptions): Promise<RefreshResult> => {
  const environment = options.environment ?? createEnvironment();
  return options.mode === 'release' ? refreshRelease(options, environment) : refreshRuntime(options, environment);
};

/** Hard deadline of one refresh child process. */
export const CHILD_DEADLINE_MS = 120_000;

const isCancelMessage = (value: unknown): value is CancelMessage =>
  typeof value === 'object' && value !== null && 'type' in value && value.type === 'cancel';

/**
 * Runs one runtime refresh as a child of the language server. A `{ type: 'cancel' }` IPC message, an IPC
 * disconnect or the 120 s deadline aborts the work; diagnostics go to stderr only.
 * @param destination - Runtime definitions cache.
 * @param bundledDirectory - Bundled data of the running build.
 * @param environment - Network and clock seams; tests point them at local servers.
 * @returns The process exit code.
 */
export const runRefreshChild = async (
  destination: string,
  bundledDirectory: string,
  environment?: RefreshEnvironment,
): Promise<number> => {
  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  const onMessage: NodeJS.MessageListener = message => {
    if (isCancelMessage(message)) cancel();
  };
  const logger = (message: string): void => void process.stderr.write(`[rbxdev-ls updater] ${message}\n`);
  const deadline = setTimeout(cancel, CHILD_DEADLINE_MS);
  process.on('message', onMessage);
  process.on('disconnect', cancel);
  try {
    const options: Mutable<RefreshOptions> = {
      destination,
      bundledDirectory,
      'mode': 'runtime',
      'signal': controller.signal,
      logger,
    };
    if (environment !== undefined) options.environment = environment;
    const result = await refreshDefinitions(options);
    logger(`Definitions refresh ${result.kind}${'reason' in result ? `: ${result.reason}` : ''}`);
    return result.kind === 'failed' ? 1 : 0;
  } finally {
    clearTimeout(deadline);
    process.off('message', onMessage);
    process.off('disconnect', cancel);
    if (process.connected) process.disconnect();
  }
};
