/**
 * Remote spy domain types shared by the state store, webview panel, and action dispatcher.
 * Mirrors the server-side shapes in rbxdev-server's @typings/remoteSpy.ts.
 */

/** Mirrors RemoteSpyCall from the server protocol typings. */
export interface RemoteSpyCallEntry {
  readonly remoteName: string;
  readonly remotePath: ReadonlyArray<string>;
  readonly remoteType: string;
  readonly method: string;
  readonly arguments: string;
  readonly code: string;
  readonly timestamp: number;
}

/** Mirrors RemoteSpyIgnoreEntry from the server typings. */
export interface IgnoreEntry {
  readonly type: 'path' | 'name';
  readonly value: string;
}

/** Mirrors RemoteSpyBlockEntry from the server typings. */
export interface BlockEntry {
  readonly type: 'path' | 'name';
  readonly value: string;
}

/** Either kind of list entry; ignore and block entries share one shape. */
export type ListEntry = IgnoreEntry | BlockEntry;

/** Mirrors RemoteSpyState from the server typings. */
export interface RemoteSpyState {
  calls: RemoteSpyCallEntry[];
  ignoreList: IgnoreEntry[];
  blockList: BlockEntry[];
  paused: boolean;
  selectedIndex: number;
}

/** Toolbar and context-menu actions the webview can dispatch. */
export type RemoteSpyWebviewAction =
  | 'toggleSpy'
  | 'togglePause'
  | 'clearCalls'
  | 'toggleListsPanel'
  | 'copyCode'
  | 'copyPath'
  | 'copyArgs'
  | 'ignoreByPath'
  | 'ignoreByName'
  | 'blockByPath'
  | 'blockByName'
  | 'clearIgnores'
  | 'clearBlocks'
  | 'removeIgnore'
  | 'removeBlock';

/** Which list panel is currently shown in the webview. */
export type RemoteSpyListMode = 'ignores' | 'blocks' | null;

/** Messages sent from the WebView to the extension host. */
export interface RemoteSpyWebviewMessage {
  readonly type:
    | 'selectCall'
    | 'copyCode'
    | 'copyPath'
    | 'copyArgs'
    | 'ignoreByPath'
    | 'ignoreByName'
    | 'blockByPath'
    | 'blockByName'
    | 'clearIgnores'
    | 'clearBlocks'
    | 'pause'
    | 'resume'
    | 'toggleSpy'
    | 'search'
    | 'clear'
    | 'removeIgnore'
    | 'removeBlock';
  readonly index?: number;
  readonly query?: string;
  readonly enabled?: boolean;
  readonly entry?: IgnoreEntry | BlockEntry;
}

/** Snapshot of UI state the dispatcher consults when resolving an action. */
export interface RemoteSpyActionContext {
  readonly selectedIndex: number;
  readonly paused: boolean;
  readonly spyEnabled: boolean;
  readonly listsMode: RemoteSpyListMode;
}

/** A webview action plus the optional list/entry details it carries. */
export interface RemoteSpyActionPayload {
  readonly action: RemoteSpyWebviewAction;
  readonly listMode?: string | null;
  readonly entryType?: string | null;
  readonly entryValue?: string | null;
}

/** The dispatcher's resolved outcome: next panel mode and messages to send. */
export interface RemoteSpyActionResult {
  readonly nextListsMode: RemoteSpyListMode;
  readonly messages: ReadonlyArray<RemoteSpyWebviewMessage>;
}

/** Snapshot of remote spy state pushed into the webview on update. */
export interface WebviewStateSnapshot {
  readonly calls: ReadonlyArray<RemoteSpyCallEntry>;
  readonly selectedIndex: number;
  readonly paused: boolean;
  readonly ignoreCount: number;
  readonly blockCount: number;
  readonly spyEnabled: boolean;
  readonly ignoreList: ReadonlyArray<IgnoreEntry>;
  readonly blockList: ReadonlyArray<BlockEntry>;
}

/** Messages sent from the extension host to the WebView. */
export interface ToWebviewMessage {
  readonly type: 'addCall' | 'clear' | 'updateState' | 'selectResult';
  readonly call?: RemoteSpyCallEntry & { readonly index: number };
  readonly state?: WebviewStateSnapshot;
  readonly success?: boolean;
}

/** Messages sent from the WebView to the extension host. */
export type FromWebviewMessage = RemoteSpyWebviewMessage;

/** Handler invoked for every message the webview posts back to the host. */
export type RemoteSpyMessageHandler = (message: FromWebviewMessage) => void;
