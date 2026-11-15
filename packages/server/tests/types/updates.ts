import type { IncomingMessage, ServerResponse } from 'node:http';

/** Serves one fixture route. */
export type RouteHandler = (request: IncomingMessage, response: ServerResponse) => void;

/** Local HTTP server standing in for the upstream definition sources. */
export interface FixtureServer {
  readonly origin: string;
  readonly routes: Map<string, RouteHandler>;
  /** Requests received per path, with the `if-none-match` header each carried. */
  readonly requests: Array<{ readonly path: string; readonly etag: string | undefined }>;
  readonly close: () => Promise<void>;
}

/** Temporary directories of one updater test. */
export interface UpdateDirectories {
  readonly cache: string;
  readonly bundle: string;
  readonly remove: () => void;
}
