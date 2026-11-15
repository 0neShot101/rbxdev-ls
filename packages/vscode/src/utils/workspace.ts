import { window, workspace } from 'vscode';

/**
 * Returns the workspace folder of the active editor, falling back to the first workspace folder.
 * @returns The folder's file system path, or undefined when no folder is open.
 */
export const getWorkspaceFolderPath = (): string | undefined => {
  const folders = workspace.workspaceFolders;
  if (folders === undefined || folders.length === 0) return undefined;
  const activeUri = window.activeTextEditor?.document.uri;
  if (activeUri !== undefined) return workspace.getWorkspaceFolder(activeUri)?.uri.fsPath ?? folders[0]?.uri.fsPath;
  return folders[0]?.uri.fsPath;
};
