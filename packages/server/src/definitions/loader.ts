import { existsSync, readFile } from 'node:fs';
import { dirname, join } from 'node:path';

import { FILES, readCurrentSnapshot, readOptional } from '@definitions/updates/storage';
import { docsSource, openDocsStore } from '@definitions/updates/docsStore';
import {
  compareVersions,
  decodeApiDump,
  decodeBundledManifest,
  decodeDocs,
  decodeSuncApi,
  openApiDump,
} from '@definitions/updates/validate';
import { once } from '@utils/once';

import type { LoadedDefinitions, RobloxApiDump } from '@typings/definitions';
import type { DocsSource } from '@typings/docs';
import type { DefinitionLoadOptions, DocsLayout } from '@typings/updates';

/** Locates the bundled data directory next to the working directory or the running entry script. */
export const findDataDir = (): string => {
  const possiblePaths = [
    join(process.cwd(), 'data'),
    join(dirname(process.argv[1] ?? ''), 'data'),
    join(dirname(process.argv[1] ?? ''), '..', 'data'),
  ];
  return possiblePaths.find(path => existsSync(path)) ?? join(process.cwd(), 'data');
};

const report = (message: string): void => void process.stderr.write(`[rbxdev-ls] ${message}\n`);

const decodeFile = <T>(path: string, decode: (text: string) => T | undefined): T | undefined => {
  const bytes = readOptional(path);
  if (bytes === undefined) return undefined;
  const value = decode(bytes.toString('utf-8'));
  if (value === undefined) report(`Ignoring invalid definitions file ${path}`);
  return value;
};

/** Opens an API file lazily when it is in the `class-lines` layout, and otherwise decodes and validates it whole. */
const readApi = (path: string): RobloxApiDump | undefined => {
  const bytes = readOptional(path);
  if (bytes === undefined) return undefined;
  const dump = openApiDump(bytes) ?? decodeApiDump(bytes.toString('utf-8'));
  if (dump === undefined) report(`Ignoring invalid definitions file ${path}`);
  return dump;
};

/**
 * Opens a documentation file as a keyed source. A `sorted-lines` file is searched in place without being parsed; a
 * file in any other layout, or one whose framing does not match its manifest, is parsed and validated whole.
 */
const openDocs = (path: string, layout: DocsLayout | undefined, preloaded?: Buffer): DocsSource | undefined => {
  const store = layout === 'sorted-lines' ? openDocsStore(path, preloaded) : undefined;
  if (store !== undefined) return store;
  const database = decodeFile(path, decodeDocs);
  return database === undefined ? undefined : docsSource(database);
};

/**
 * Loads Roblox API, documentation and Sunc definitions. Without options it reads only bundled data. With a cache
 * directory, the cached API is used when its version is newer than the bundled one, and cached Roblox docs when they
 * are newer than the bundled docs (ties keep the bundle). Sunc and Luau docs always come from the bundle. An invalid
 * cache never fails startup; it falls back to bundled data.
 *
 * The API header is read immediately because the global environment is built from it; class members are decoded on
 * first use. Documentation is opened on first access, since only hover and completion details use it.
 * @param options - Optional cache and bundled data directories.
 */
export const loadDefinitions = (options?: DefinitionLoadOptions): LoadedDefinitions => {
  const bundledDirectory = options?.bundledDirectory ?? findDataDir();
  const bundled = (file: string): string => join(bundledDirectory, file);
  const manifest = decodeFile(bundled(FILES.manifest), decodeBundledManifest);
  const snapshot = options?.cacheDirectory === undefined ? undefined : readCurrentSnapshot(options.cacheDirectory);

  const bundledVersion = manifest?.apiVersion;
  const isCachedApiNewer =
    snapshot !== undefined &&
    (bundledVersion === undefined || compareVersions(snapshot.manifest.apiVersion, bundledVersion) > 0);
  const cachedApi = isCachedApiNewer ? readApi(join(snapshot.directory, FILES.api)) : undefined;

  const bundledDocsAt = manifest?.docsFetchedAt;
  const cachedDocsPath =
    snapshot !== undefined &&
    (existsSync(bundled(FILES.docs)) === false ||
      bundledDocsAt === undefined ||
      snapshot.manifest.docsFetchedAt > bundledDocsAt)
      ? join(snapshot.directory, FILES.docs)
      : undefined;
  const cachedLayout = snapshot?.manifest.docsLayout;
  const robloxDocsPath = cachedDocsPath ?? bundled(FILES.docs);
  const robloxDocsLayout = cachedDocsPath === undefined ? manifest?.docsLayout : cachedLayout;
  const luauDocsPath = bundled(FILES.luauDocs);

  const prefetched = new Map<string, Buffer>();
  const prefetch = (path: string, layout: DocsLayout | undefined): void => {
    if (options?.prefetchDocs === true && layout === 'sorted-lines')
      readFile(path, (failure, bytes) => {
        if (failure === null) prefetched.set(path, bytes);
      });
  };
  prefetch(robloxDocsPath, robloxDocsLayout);
  prefetch(luauDocsPath, manifest?.docsLayout);

  const robloxDocs = once(
    () =>
      openDocs(robloxDocsPath, robloxDocsLayout, prefetched.get(robloxDocsPath)) ??
      (cachedDocsPath === undefined ? undefined : openDocs(bundled(FILES.docs), manifest?.docsLayout)),
  );
  const luauDocs = once(() => openDocs(luauDocsPath, manifest?.docsLayout, prefetched.get(luauDocsPath)));

  return {
    'roblox': cachedApi ?? readApi(bundled(FILES.api)),
    'sunc': decodeFile(bundled(FILES.sunc), decodeSuncApi),
    get 'robloxDocs'() {
      return robloxDocs();
    },
    get 'luauDocs'() {
      return luauDocs();
    },
  };
};

/** Checks if any definitions were successfully loaded. */
export const isDefinitionsLoaded = (defs: LoadedDefinitions): boolean =>
  defs.roblox !== undefined || defs.sunc !== undefined;
