/**
 * Executor Bridge Module
 * WebSocket integration for Roblox exploit executors
 *
 * This module serves as the main entry point for the executor bridge functionality,
 * re-exporting the core components needed for establishing WebSocket connections
 * with Roblox executor clients and managing the live game model.
 */

export { createExecutorBridge, type BridgeStatus, type ExecuteResult, type ExecutorBridge } from './server';
export { createLiveGameModel, type LiveGameModel } from './gameTree';
export type {
  ClientMessage,
  ConnectedMessage,
  ExecuteMessage,
  ExecuteResultMessage,
  GameTreeMessage,
  GameTreeNode,
  RequestGameTreeMessage,
  RuntimeError,
  RuntimeErrorMessage,
  ServerMessage,
} from './protocol';
