/**
 * Executor bridge status types used by the status bar and polling loop.
 */

/** Connection lifecycle of the executor bridge as shown in the status bar. */
export type BridgeStatus = 'stopped' | 'waiting' | 'connected' | 'error';

/** Response shape of the custom/executorStatus language server request. */
export interface ExecutorStatusResponse {
  isRunning: boolean;
  isConnected: boolean;
  executorName?: string;
  clientType?: 'executor' | 'studio' | null;
}
