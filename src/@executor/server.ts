/**
 * Executor Bridge WebSocket Server
 * Manages connections with Roblox exploit executors
 */

import { WebSocketServer, type WebSocket } from 'ws';

import { createLiveGameModel, type LiveGameModel } from './gameTree';
import { parseClientMessage, type GameTreeNode, type RuntimeError, type ServerMessage } from './protocol';

/**
 * Represents the result of executing Luau code on a connected executor.
 * Contains success status and either the result value or error details.
 */
export interface ExecuteResult {
  /** Whether the code execution completed successfully */
  readonly success: boolean;
  /** The return value or output from successful execution */
  readonly result?: string;
  /** Error details if the execution failed */
  readonly error?: RuntimeError;
}

/**
 * The main interface for interacting with the executor bridge.
 * Provides methods to start/stop the server, execute code, and subscribe to events.
 */
export interface ExecutorBridge {
  /** Whether the WebSocket server is currently running */
  readonly isRunning: boolean;
  /** Whether an executor client is currently connected and ready */
  readonly isConnected: boolean;
  /** The name of the connected executor, or undefined if not connected */
  readonly executorName: string | undefined;
  /** The live game model containing the current game tree structure */
  readonly liveGameModel: LiveGameModel;
  /**
   * Starts the WebSocket server on the specified port.
   * @param port - The port number to listen on
   */
  start: (port: number) => void;
  /**
   * Stops the WebSocket server and disconnects any connected clients.
   */
  stop: () => void;
  /**
   * Executes Luau code on the connected executor.
   * @param code - The Luau code to execute
   * @returns A promise that resolves with the execution result
   */
  execute: (code: string) => Promise<ExecuteResult>;
  /**
   * Requests an updated game tree from the connected executor.
   */
  requestGameTree: () => void;
  /**
   * Registers a callback to be invoked when the bridge status changes.
   * @param callback - Function to call with the new status
   */
  onStatusChange: (callback: (status: BridgeStatus) => void) => void;
  /**
   * Registers a callback to be invoked when a runtime error occurs.
   * @param callback - Function to call with the error details
   */
  onRuntimeError: (callback: (error: RuntimeError) => void) => void;
  /**
   * Registers a callback to be invoked when the game tree is updated.
   * @param callback - Function to call with the new game tree nodes
   */
  onGameTreeUpdate: (callback: (nodes: GameTreeNode[]) => void) => void;
}

/**
 * Represents the current status of the executor bridge.
 * - 'stopped': Server is not running
 * - 'waiting': Server is running but no client is connected
 * - 'connected': An executor client is connected and ready
 * - 'error': An error occurred with the server or connection
 */
export type BridgeStatus = 'stopped' | 'waiting' | 'connected' | 'error';

/**
 * Internal interface for tracking pending code execution requests.
 * Stores the promise callbacks and timeout handle for cleanup.
 */
interface PendingExecution {
  /** Callback to resolve the execution promise with the result */
  readonly resolve: (result: ExecuteResult) => void;
  /** Callback to reject the execution promise with an error */
  readonly reject: (error: Error) => void;
  /** Handle for the timeout that will reject the promise if execution takes too long */
  readonly timeout: ReturnType<typeof setTimeout>;
}

/**
 * Creates a new executor bridge instance for managing WebSocket connections with Roblox executors.
 * The bridge handles connection lifecycle, code execution, and game tree synchronization.
 * @param log - Logging function to output status and debug messages
 * @returns A fully configured ExecutorBridge instance
 */
export const createExecutorBridge = (log: (message: string) => void): ExecutorBridge => {
  let server: WebSocketServer | undefined;
  let client: WebSocket | undefined;
  let executorName: string | undefined;
  let status: BridgeStatus = 'stopped';

  const pendingExecutions = new Map<string, PendingExecution>();
  const statusCallbacks: Array<(status: BridgeStatus) => void> = [];
  const errorCallbacks: Array<(error: RuntimeError) => void> = [];
  const gameTreeCallbacks: Array<(nodes: GameTreeNode[]) => void> = [];

  const { 'model': liveGameModel, 'update': updateGameModel, setConnected } = createLiveGameModel();

  /**
   * Generates a unique identifier for tracking execution requests.
   * @returns A random alphanumeric string suitable for use as a request ID
   */
  const generateId = (): string => Math.random().toString(36).slice(2, 10);

  /**
   * Updates the bridge status and notifies all registered callbacks.
   * Only triggers callbacks if the status has actually changed.
   * @param newStatus - The new status to set
   */
  const setStatus = (newStatus: BridgeStatus): void => {
    if (status === newStatus) return;
    status = newStatus;
    for (const callback of statusCallbacks) {
      callback(newStatus);
    }
  };

  /**
   * Sends a message to the connected executor client.
   * Silently does nothing if no client is connected or the connection is not open.
   * @param message - The server message to send
   */
  const send = (message: ServerMessage): void => {
    if (client === undefined || client.readyState !== client.OPEN) return;
    client.send(JSON.stringify(message));
  };

  /**
   * Processes an incoming message from the executor client.
   * Handles connection confirmations, execution results, game tree updates, and runtime errors.
   * @param data - The raw JSON string received from the client
   */
  const handleMessage = (data: string): void => {
    const message = parseClientMessage(data);
    if (message === undefined) {
      log('[bridge] Received invalid message');
      return;
    }

    switch (message.type) {
      case 'connected': {
        executorName = message.executorName;
        setConnected(true);
        setStatus('connected');
        log(`[bridge] Executor connected: ${message.executorName} v${message.version}`);
        // Request game tree on connect
        send({ 'type': 'requestGameTree' });
        break;
      }

      case 'executeResult': {
        const pending = pendingExecutions.get(message.id);
        if (pending !== undefined) {
          clearTimeout(pending.timeout);
          pendingExecutions.delete(message.id);
          const result: ExecuteResult = {
            'success': message.success,
            ...(message.result !== undefined ? { 'result': message.result } : {}),
            ...(message.error !== undefined ? { 'error': message.error } : {}),
          };
          pending.resolve(result);
        }
        break;
      }

      case 'gameTree': {
        updateGameModel(message.data);
        log(`[bridge] Game tree updated: ${message.data.length} services`);
        for (const callback of gameTreeCallbacks) {
          callback(message.data);
        }
        break;
      }

      case 'runtimeError': {
        log(`[bridge] Runtime error: ${message.error.message}`);
        for (const callback of errorCallbacks) {
          callback(message.error);
        }
        break;
      }
    }
  };

  /**
   * Starts the WebSocket server and begins listening for executor connections.
   * If the server is already running, this method does nothing.
   * @param port - The port number to listen on (binds to localhost only)
   */
  const start = (port: number): void => {
    if (server !== undefined) return;

    try {
      server = new WebSocketServer({ 'host': '127.0.0.1', port });
      setStatus('waiting');
      log(`[bridge] WebSocket server started on port ${port}`);

      server.on('connection', (ws: WebSocket) => {
        if (client !== undefined) {
          ws.close(1000, 'Another client is already connected');
          return;
        }

        client = ws;
        log('[bridge] Client connecting...');

        ws.on('message', (data: Buffer | string) => {
          const str = typeof data === 'string' ? data : data.toString('utf-8');
          handleMessage(str);
        });

        ws.on('close', () => {
          log('[bridge] Client disconnected');
          client = undefined;
          executorName = undefined;
          setConnected(false);
          setStatus('waiting');

          // Reject all pending executions
          for (const [id, pending] of pendingExecutions) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Client disconnected'));
            pendingExecutions.delete(id);
          }
        });

        ws.on('error', (err: Error) => {
          log(`[bridge] WebSocket error: ${err.message}`);
        });
      });

      server.on('error', (err: Error) => {
        log(`[bridge] Server error: ${err.message}`);
        setStatus('error');
      });
    } catch (err) {
      log(`[bridge] Failed to start server: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('error');
    }
  };

  /**
   * Stops the WebSocket server and closes all active connections.
   * Cleans up resources and resets the bridge to its initial state.
   */
  const stop = (): void => {
    if (server === undefined) return;

    // Close client connection
    if (client !== undefined) {
      client.close(1000, 'Server shutting down');
      client = undefined;
    }

    // Close server
    server.close();
    server = undefined;
    executorName = undefined;
    setConnected(false);
    setStatus('stopped');
    log('[bridge] Server stopped');
  };

  /**
   * Sends Luau code to the connected executor for execution.
   * Returns a promise that resolves with the result or rejects on timeout/disconnect.
   * @param code - The Luau source code to execute
   * @returns A promise that resolves with the execution result, including success status and any output or errors
   */
  const execute = (code: string): Promise<ExecuteResult> =>
    new Promise((resolve, reject) => {
      if (client === undefined || client.readyState !== client.OPEN) {
        reject(new Error('No executor connected'));
        return;
      }

      const id = generateId();
      const timeout = setTimeout(() => {
        pendingExecutions.delete(id);
        reject(new Error('Execution timed out'));
      }, 30000); // 30 second timeout

      pendingExecutions.set(id, { resolve, reject, timeout });
      send({ 'type': 'execute', id, code });
    });

  /**
   * Requests a fresh game tree snapshot from the connected executor.
   * The result will be delivered asynchronously via the onGameTreeUpdate callback.
   */
  const requestGameTree = (): void => {
    send({ 'type': 'requestGameTree' });
  };

  /**
   * Registers a callback function to be notified when the bridge status changes.
   * @param callback - Function to invoke with the new BridgeStatus value
   */
  const onStatusChange = (callback: (status: BridgeStatus) => void): void => {
    statusCallbacks.push(callback);
  };

  /**
   * Registers a callback function to be notified when runtime errors occur.
   * @param callback - Function to invoke with the RuntimeError details
   */
  const onRuntimeError = (callback: (error: RuntimeError) => void): void => {
    errorCallbacks.push(callback);
  };

  /**
   * Registers a callback function to be notified when the game tree is updated.
   * @param callback - Function to invoke with the array of root GameTreeNode objects
   */
  const onGameTreeUpdate = (callback: (nodes: GameTreeNode[]) => void): void => {
    gameTreeCallbacks.push(callback);
  };

  return {
    get 'isRunning'() {
      return server !== undefined;
    },
    get 'isConnected'() {
      return client !== undefined && client.readyState === client.OPEN;
    },
    get 'executorName'() {
      return executorName;
    },
    liveGameModel,
    start,
    stop,
    execute,
    requestGameTree,
    onStatusChange,
    onRuntimeError,
    onGameTreeUpdate,
  };
};
