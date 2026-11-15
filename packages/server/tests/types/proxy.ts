import type { RemoteSpyPolicyMessage } from '@typings/protocol';

/** Fake executor socket that records the spy policy requests reaching it. */
export interface SpyExecutor {
  readonly received: RemoteSpyPolicyMessage[];
  /** A hot reload re-sends the handshake on the adopted socket. */
  readonly reload: () => void;
}
