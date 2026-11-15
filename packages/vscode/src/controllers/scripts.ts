import * as fs from 'fs';
import * as path from 'path';

import { commands, window, workspace } from 'vscode';

import { stripMarkers } from '#extension/utils/gamePath';

import type { ExtensionContext } from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import type { ScriptsCollaborators, ScriptsController } from '@typings/controllers';
import type { GameTreeItem } from '@typings/gameTree';

/**
 * Creates the scripts controller: fetched script files, their game paths, and pushing edits to Studio.
 * @param context - Extension context that owns the listener, commands and script storage.
 * @param client - Language client used to read and write script sources.
 * @param collaborators - Debug logger and bridge state readers.
 * @returns An operation that forgets every opened script mapping.
 */
export const createScripts = (
  context: ExtensionContext,
  client: LanguageClient,
  { log, isConnected, clientType }: ScriptsCollaborators,
): ScriptsController => {
  const scriptDocumentPaths = new Map<string, string[]>();

  context.subscriptions.push(
    workspace.onDidSaveTextDocument(async document => {
      const scriptPath = scriptDocumentPaths.get(document.uri.toString());
      if (scriptPath === undefined) return;
      if (clientType() !== 'studio') return;
      if (isConnected() === false) return;

      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/setScriptSource', {
          'path': scriptPath,
          'source': document.getText(),
        });

        if (result.success)
          window.setStatusBarMessage(`$(check) Pushed to Studio: ${scriptPath[scriptPath.length - 1]}`, 3000);
        else window.showErrorMessage(`Push to Studio failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Push to Studio failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('rbxdev-ls.viewScript', async (item: GameTreeItem) => {
      log(`[rbxdev-ls] viewScript called with: ${JSON.stringify(item)}`);

      if (item === undefined) return window.showErrorMessage('No script selected');

      const scriptTypes = ['Script', 'LocalScript', 'ModuleScript'];
      if (scriptTypes.includes(item.className) === false)
        return window.showErrorMessage(`${item.className} is not a script type`);

      try {
        await window.withProgress(
          {
            'location': { 'viewId': 'rbxdev-gameTree' },
            'title': 'Fetching script source...',
          },
          async () => {
            log(`[rbxdev-ls] Requesting script source for: ${JSON.stringify(item.path)}`);
            const result = await client.sendRequest<{
              success: boolean;
              source?: string;
              scriptType?: string;
              error?: string;
            }>('custom/getScriptSource', { 'path': item.path });

            log(`[rbxdev-ls] Script source result: ${result.success} ${result.error}`);

            if (result.success && result.source !== undefined) {
              const cleanPath = stripMarkers(item.path);
              const scriptsDir = path.join(context.globalStorageUri.fsPath, 'studio-scripts');
              const scriptDir = path.join(scriptsDir, ...cleanPath.slice(0, -1));
              const scriptName = cleanPath[cleanPath.length - 1] ?? 'script';
              const scriptFile = path.join(scriptDir, `${scriptName}.luau`);

              if (fs.existsSync(scriptDir) === false) fs.mkdirSync(scriptDir, { 'recursive': true });
              fs.writeFileSync(scriptFile, result.source, 'utf-8');

              const document = await workspace.openTextDocument(scriptFile);
              await window.showTextDocument(document);
              scriptDocumentPaths.set(document.uri.toString(), [...item.path]);
            } else window.showErrorMessage(`Failed to get script source: ${result.error ?? 'Unknown error'}`);
          },
        );
      } catch (error) {
        console.error('[rbxdev-ls] viewScript error:', error);
        window.showErrorMessage(
          `Failed to get script source: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),

    commands.registerCommand('rbxdev-ls.pushScript', async () => {
      const editor = window.activeTextEditor;
      if (editor === undefined) return window.showErrorMessage('No active editor');
      if (clientType() !== 'studio')
        return window.showErrorMessage('Push to Studio is only available when connected to Roblox Studio');

      const scriptPath = scriptDocumentPaths.get(editor.document.uri.toString());
      if (scriptPath === undefined)
        return window.showErrorMessage(
          'This document was not opened from the Game Tree. Open a script via the Game Tree first.',
        );

      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/setScriptSource', {
          'path': scriptPath,
          'source': editor.document.getText(),
        });

        if (result.success)
          window.setStatusBarMessage(`$(check) Pushed to Studio: ${scriptPath[scriptPath.length - 1]}`, 3000);
        else window.showErrorMessage(`Push failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Push failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  );

  return { 'clear': () => scriptDocumentPaths.clear() };
};
