import type {
  BlockEntry,
  FromWebviewMessage,
  RemoteSpySource,
  SetRemoteSpyEnabledResponse,
  ToWebviewMessage,
} from '@typings/remoteSpy';

/** Requests exercised by the remote spy controller test transport. */
export interface SpyRequest {
  readonly enabled?: boolean;
  readonly source?: RemoteSpySource;
  readonly blocks?: ReadonlyArray<BlockEntry>;
  readonly filter?: string;
}

/** Replies produced by the controller's test transport. */
export type SpyResponse = SetRemoteSpyEnabledResponse | { readonly isEnabled: boolean };

/** A test transport operation with a domain request and reply. */
export type RequestHandler = (request?: SpyRequest) => SpyResponse;

/** Requests supported by the controller's test transport. */
export interface SpyHandlers {
  'custom/setRemoteSpyEnabled': RequestHandler;
  'custom/setRemoteSpyBlockList': RequestHandler;
  'custom/getRemoteSpyStatus'?: RequestHandler;
  'custom/setRemoteSpyFilter'?: RequestHandler;
}

/** Request names understood by the controller's test transport. */
export type SpyRequestMethod = keyof SpyHandlers;

/** Commands invoked by the controller regressions. */
export type SpyCommand = () => void | Promise<void>;

/** Messages delivered by the real panel's test webview. */
export type MessageListener = (message: FromWebviewMessage) => void;

/** Observable state of the VS Code panel used by controller tests. */
export interface WebviewHarness {
  created: number;
  posted: ToWebviewMessage[];
  receive: MessageListener | undefined;
  disposeListeners: Array<() => void>;
}
