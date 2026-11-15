import type { ChildProcess } from 'node:child_process';
import type { request } from 'node:https';

import type {
  RobloxApiDump,
  RobloxCallback,
  RobloxClass,
  RobloxEvent,
  RobloxFunction,
  RobloxProperty,
  RobloxValueType,
} from '@typings/definitions';

/** Upstream dataset fetched by the definitions updater; selects its decoded-size limit. */
export type Dataset = 'version' | 'api' | 'robloxDocs' | 'luauDocs';

/** Node `request` function used for HTTP(S) GETs; production passes `https.request`. */
export type RequestFunction = typeof request;

/** One conditional GET issued by the downloader. */
export interface DownloadRequest {
  readonly url: string;
  readonly dataset: Dataset;
  readonly etag: string | undefined;
  readonly signal: AbortSignal;
}

/** Outcome of a successful download: decoded bytes, or confirmation that the cached bytes are current. */
export type DownloadResult =
  | { readonly status: 'ok'; readonly body: Buffer; readonly etag: string | undefined }
  | { readonly status: 'not-modified' };

/** Performs one GET under the updater's deadline, size, encoding and redirect policy. */
export type Downloader = (download: DownloadRequest) => Promise<DownloadResult>;

/** Fixed upstream locations of every dataset. */
export interface UpdateSources {
  readonly version: string;
  readonly api: (upload: string) => string;
  readonly robloxDocs: string;
  readonly luauDocs: string;
}

/** Current Roblox Studio build reported by the client settings service. */
export interface StudioVersion {
  readonly version: string;
  readonly clientVersionUpload: string;
}

/** Return type as published upstream: a single value type, or a tuple for multiple returns. */
export type WireReturnType = RobloxValueType | ReadonlyArray<RobloxValueType>;

/** API member as published upstream, before multi-value returns are reduced to the first value. */
export type WireMember =
  | RobloxProperty
  | RobloxEvent
  | (Omit<RobloxFunction, 'ReturnType'> & { readonly ReturnType: WireReturnType })
  | (Omit<RobloxCallback, 'ReturnType'> & { readonly ReturnType: WireReturnType });

/** API class as published upstream. */
export interface WireClass extends Omit<RobloxClass, 'Members'> {
  readonly Members: ReadonlyArray<WireMember>;
}

/** API dump as published upstream. */
export interface WireApiDump extends Omit<RobloxApiDump, 'Classes'> {
  readonly Classes: ReadonlyArray<WireClass>;
}

/** A class as listed in the header of a `class-lines` API file: everything except its members. */
export type ClassSummary = Pick<RobloxClass, 'Name' | 'Superclass' | 'Tags'>;

/** First line of a `class-lines` API file; one class per following line, in `Index` order. */
export interface ApiHeader {
  readonly Version: 1;
  readonly Index: ReadonlyArray<ClassSummary>;
  readonly Enums: RobloxApiDump['Enums'];
}

/** `current.json`: the active cache generation. */
export interface CachePointer {
  readonly schema: 1;
  readonly generation: string;
}

/** `check.json`: when the last update attempt started, successful or not. */
export interface CheckRecord {
  readonly schema: 1;
  readonly attemptedAt: number;
}

/** Contents of a lock file: owner identity and acquisition time. */
export interface LockRecord {
  readonly id: string;
  readonly startedAt: number;
}

/**
 * On-disk layout of a Roblox docs file. `sorted-lines` is JSON with one entry per line, sorted by key, which lets the
 * language server look up single entries without parsing the file. Files without the flag are parsed whole.
 */
export type DocsLayout = 'sorted-lines';

/** Manifest written last into a complete cache generation. */
export interface SnapshotManifest {
  readonly schema: 1;
  readonly checkedAt: number;
  readonly apiVersion: string;
  readonly apiUpload: string;
  readonly apiFetchedAt: number;
  readonly docsFetchedAt: number;
  readonly apiSha256: string;
  readonly docsSha256: string;
  readonly docsEtag?: string;
  readonly docsLayout?: DocsLayout;
}

/** Manifest shipped with bundled data; legacy bundles may omit every freshness claim. */
export interface BundledManifest {
  readonly schema: 1;
  readonly apiVersion?: string;
  readonly apiUpload?: string;
  readonly apiFetchedAt?: number;
  readonly docsFetchedAt?: number;
  readonly apiSha256?: string;
  readonly docsSha256?: string;
  readonly docsEtag?: string;
  readonly docsLayout?: DocsLayout;
  readonly luauDocsTag?: string;
}

/** A validated, complete cache generation. */
export interface CachedSnapshot {
  readonly generation: string;
  readonly directory: string;
  readonly manifest: SnapshotManifest;
}

/** Whether a refresh updates the runtime cache or produces release data. */
export type RefreshMode = 'runtime' | 'release';

/** Process seams a refresh depends on; tests replace them, production uses the defaults. */
export interface RefreshEnvironment {
  readonly download: Downloader;
  readonly sources: UpdateSources;
  readonly now: () => number;
  readonly rename: (from: string, to: string) => void;
}

/** Inputs of one refresh run. */
export interface RefreshOptions {
  /** Runtime cache directory, or the release data directory. */
  readonly destination: string;
  /** Directory holding the data shipped with this build. */
  readonly bundledDirectory: string;
  readonly mode: RefreshMode;
  readonly signal: AbortSignal;
  readonly logger: (message: string) => void;
  readonly environment?: RefreshEnvironment;
  readonly lockHooks?: LockHooks;
}

/** Outcome of one refresh run. */
export type RefreshResult =
  | { readonly kind: 'published'; readonly generation: string }
  | { readonly kind: 'released' }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'skipped'; readonly reason: string }
  | { readonly kind: 'failed'; readonly reason: string };

/**
 * Where `loadDefinitions` looks for data; omitted fields keep the bundled-only behaviour. `prefetchDocs` starts
 * reading the documentation files off the main thread so the first lookup does not wait for the disk.
 */
export interface DefinitionLoadOptions {
  readonly cacheDirectory?: string;
  readonly bundledDirectory?: string;
  readonly prefetchDocs?: boolean;
}

/** Message the language server sends to a running refresh child. */
export interface CancelMessage {
  readonly type: 'cancel';
}

/** Command-line options read before the language server starts. */
export interface ServerOptions {
  readonly cacheDirectory: string | undefined;
  readonly isUpdateEnabled: boolean;
}

/** Result of trying to take the update lock. */
export type LockAcquisition =
  | { readonly kind: 'acquired'; readonly release: () => void }
  | { readonly kind: 'skipped'; readonly reason: string };

/** Test seam for interleaving lock reclaimers deterministically. */
export interface LockHooks {
  readonly afterRecoveryAcquired?: () => void;
}

/** Exact bytes of a snapshot's datasets after digest verification. */
export interface SnapshotBytes {
  readonly api: Buffer;
  readonly docs: Buffer;
}

/** A freshly created, still unpublished cache generation. */
export interface GenerationDirectory {
  readonly generation: string;
  readonly directory: string;
}

/** Where a dataset used by a refresh came from. */
export type DatasetSource = 'cache' | 'bundle' | 'upstream';

/** API dump bytes chosen for the next snapshot, with their provenance. */
export interface ApiCandidate {
  readonly bytes: Buffer;
  readonly version: string;
  readonly upload: string;
  readonly fetchedAt: number;
  readonly source: DatasetSource;
}

/** Roblox docs bytes chosen for the next snapshot, with the ETag that identifies exactly these bytes. */
export interface DocsCandidate {
  readonly bytes: Buffer;
  readonly fetchedAt: number;
  readonly etag: string | undefined;
  readonly source: DatasetSource;
}

/** Data shipped with the running build. */
export interface BundledData {
  readonly manifest: BundledManifest | undefined;
  readonly api: Buffer | undefined;
  readonly docs: Buffer | undefined;
}

/** Starts a refresh child process with the given arguments; production spawns the running runtime with IPC. */
export type ChildLauncher = (args: ReadonlyArray<string>) => ChildProcess;

/** Inputs of the language server's background update scheduler. */
export interface SchedulerOptions {
  readonly cacheDirectory: string;
  readonly bundledDirectory: string;
  /** Script that starts the server bundle; the child reuses it in refresh mode. */
  readonly entryScript: string;
  readonly log: (message: string) => void;
  readonly launch?: ChildLauncher;
  readonly now?: () => number;
  readonly initialDelayMs?: number;
}

/** Controls background definitions refreshes for one language server process. */
export interface UpdateScheduler {
  readonly setEnabled: (enabled: boolean) => void;
  readonly stop: () => Promise<void>;
}

/** Parameters of the `custom/setApiUpdates` request. */
export interface ApiUpdateSettings {
  readonly enabled: boolean;
}
