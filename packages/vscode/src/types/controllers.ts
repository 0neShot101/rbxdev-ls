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
