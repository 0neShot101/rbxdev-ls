import type { Disposable } from 'vscode';

/**
 * Receives `true` after the bridge connects and `false` whenever the bridge UI state resets.
 */
export type BridgeChangeListener = (isConnected: boolean) => void;

/**
 * Executes Luau code through the bridge and reports the outcome to the user.
 */
export type ExecuteCode = (
  code: string,
  successMessage: (result?: string) => string,
  failurePrefix?: string,
) => Promise<void>;

/**
 * Writes a debug message when debug logging is enabled.
 */
export type DebugLog = (message: string) => void;

/**
 * Console controller: owns the Roblox console channel and source-stack mapping.
 */
export interface ConsoleController {
  readonly log: DebugLog;
}

/**
 * Bridge controller: owns status polling, the status bar, bridge toggling and auto-refresh.
 */
export interface BridgeController {
  readonly isConnected: () => boolean;
  readonly clientType: () => string | undefined;
  readonly poll: () => Promise<void>;
  readonly onChange: (listener: BridgeChangeListener) => Disposable;
}

/**
 * Bridge controller collaborators.
 */
export interface BridgeCollaborators {
  readonly log: DebugLog;
}

/**
 * Properties controller: owns the properties view and property edits.
 */
export interface PropertiesController {
  readonly refresh: (path: ReadonlyArray<string>) => Promise<void>;
  readonly clear: () => void;
}

/**
 * Game tree controller: owns the tree view, tree commands and lazy child requests.
 */
export interface GameTreeController {
  readonly clear: () => void;
}

/**
 * Game tree controller collaborators.
 */
export interface GameTreeCollaborators {
  readonly log: DebugLog;
  readonly refreshProperties: (path: ReadonlyArray<string>) => Promise<void>;
  readonly clearProperties: () => void;
}

/**
 * Execution controller: owns code execution, the execute button and bundling.
 */
export interface ExecutionController {
  readonly execute: ExecuteCode;
}

/**
 * Remote spy controller: owns spy state, panel, channel, commands and notifications.
 */
export interface RemoteSpyController {
  readonly sync: () => Promise<void>;
}

/**
 * Remote spy controller collaborators.
 */
export interface RemoteSpyCollaborators {
  readonly isConnected: () => boolean;
}

/**
 * Scripts controller: owns fetched script files and pushing edits back to Studio.
 */
export interface ScriptsController {
  readonly clear: () => void;
}

/**
 * Scripts controller collaborators.
 */
export interface ScriptsCollaborators {
  readonly log: DebugLog;
  readonly isConnected: () => boolean;
  readonly clientType: () => string | undefined;
}

/**
 * Save command collaborators.
 */
export interface SaveCollaborators {
  readonly execute: ExecuteCode;
  readonly isConnected: () => boolean;
}
