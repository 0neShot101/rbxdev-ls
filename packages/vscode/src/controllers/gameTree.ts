import { commands, env, QuickPickItemKind, window } from 'vscode';

import { GameTreeDataProvider } from '#extension/gameTreeProvider';
import { escapeLuaString, formatGamePath } from '#extension/utils/gamePath';

import type { ExtensionContext } from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import type { GameTreeCollaborators, GameTreeController } from '@typings/controllers';
import type { ClassPickItem, GameTreeItem, GameTreeNode } from '@typings/gameTree';

/**
 * Creates the game tree controller: provider, view, tree commands and lazy child requests.
 * @param context - Extension context that owns the view and commands.
 * @param client - Language client used to reach the bridge server.
 * @param collaborators - Debug logger and the properties view operations driven by tree selection.
 * @returns An operation to clear the tree.
 */
export const createGameTree = (
  context: ExtensionContext,
  client: LanguageClient,
  { log, refreshProperties, clearProperties }: GameTreeCollaborators,
): GameTreeController => {
  log('[rbxdev-ls] Creating Game Tree view...');
  const gameTreeProvider = new GameTreeDataProvider(context.extensionPath);
  const treeView = window.createTreeView('rbxdev-gameTree', {
    'treeDataProvider': gameTreeProvider,
    'showCollapseAll': true,
    'dragAndDropController': gameTreeProvider,
    'canSelectMany': false,
  });
  context.subscriptions.push(treeView);

  gameTreeProvider.onReparent(async (sourcePath, targetPath) => {
    try {
      const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/reparentInstance', {
        'sourcePath': sourcePath,
        'targetPath': targetPath,
      });

      if (result.success) {
        window.showInformationMessage(
          `Moved ${sourcePath[sourcePath.length - 1]} to ${targetPath[targetPath.length - 1]}`,
        );
        await client.sendRequest('custom/requestGameTree');
      } else window.showErrorMessage(`Move failed: ${result.error ?? 'Unknown error'}`);
    } catch (error) {
      window.showErrorMessage(`Move failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  gameTreeProvider.onRequestChildren(async path => {
    log(`[rbxdev-ls] Requesting children for path: ${JSON.stringify(path)}`);
    try {
      const result = await client.sendRequest<{
        success: boolean;
        children?: GameTreeNode[];
        error?: string;
      }>('custom/requestChildren', { 'path': path });

      log(
        `[rbxdev-ls] Children request result: ${result.success} children: ${result.children?.length ?? 'undefined'} error: ${result.error}`,
      );
      if (result.success && result.children !== undefined) return result.children;
      return undefined;
    } catch (error) {
      log(`[rbxdev-ls] Children request error: ${String(error)}`);
      return undefined;
    }
  });

  log('[rbxdev-ls] Game Tree view created');

  treeView.onDidChangeSelection(async e => {
    if (e.selection.length === 0) return clearProperties();

    const selectedItem = e.selection[0];
    if (selectedItem === undefined) return;

    try {
      await refreshProperties(selectedItem.path);
    } catch {
      clearProperties();
    }
  });

  client.onNotification('custom/gameTreeUpdate', (nodes: GameTreeNode[]) => {
    log(`[rbxdev-ls] Game tree update received: ${nodes.length} services`);

    const firstChild = nodes[0]?.children?.[0];
    if (firstChild !== undefined)
      log(`[rbxdev-ls] First child sample: ${firstChild.name} hasChildren: ${firstChild.hasChildren}`);
    gameTreeProvider.refresh(nodes);
  });

  context.subscriptions.push(
    commands.registerCommand('rbxdev-ls.copyPath', (item: GameTreeItem) => {
      const gamePath = formatGamePath(item.path);
      env.clipboard.writeText(gamePath);
      window.showInformationMessage(`Copied: ${gamePath}`);
    }),

    commands.registerCommand('rbxdev-ls.insertPath', async (item: GameTreeItem) => {
      const editor = window.activeTextEditor;
      if (editor === undefined) return window.showErrorMessage('No active editor');
      const gamePath = formatGamePath(item.path);
      await editor.edit(editBuilder => editBuilder.insert(editor.selection.active, gamePath));
    }),

    commands.registerCommand('rbxdev-ls.insertService', async (item: GameTreeItem) => {
      const editor = window.activeTextEditor;
      if (editor === undefined) return window.showErrorMessage('No active editor');
      const serviceName = item.path[0];
      if (serviceName === undefined) return;
      const escapedServiceName = escapeLuaString(serviceName);
      let serviceIdentifier = serviceName;
      if (/^[A-Za-z_]/.test(serviceIdentifier) === false) serviceIdentifier = 'service_' + serviceIdentifier;
      serviceIdentifier = serviceIdentifier.replace(/[^A-Za-z0-9_]/g, '_');
      const code = `local ${serviceIdentifier} = game:GetService("${escapedServiceName}")\n`;
      await editor.edit(editBuilder => editBuilder.insert(editor.selection.active, code));
    }),

    commands.registerCommand('rbxdev-ls.refreshGameTree', async () => {
      try {
        await client.sendRequest('custom/requestGameTree');
      } catch (error) {
        window.showErrorMessage(`Refresh failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.teleportTo', async (item: GameTreeItem) => {
      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/teleportTo', {
          'path': item.path,
        });

        if (result.success) window.showInformationMessage(`Teleported to ${item.name}`);
        else window.showErrorMessage(`Teleport failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Teleport failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.deleteInstance', async (item: GameTreeItem) => {
      const confirm = await window.showWarningMessage(
        `Delete "${item.name}" (${item.className})? This cannot be undone.`,
        { 'modal': true },
        'Delete',
      );

      if (confirm !== 'Delete') return;

      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/deleteInstance', {
          'path': item.path,
        });

        if (result.success) {
          window.showInformationMessage(`Deleted ${item.name}`);
          await client.sendRequest('custom/requestGameTree');
        } else window.showErrorMessage(`Delete failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Delete failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.createInstance', async (item: GameTreeItem) => {
      const classCategories: ReadonlyArray<ClassPickItem> = [
        { 'label': '$(folder) Containers', 'kind': QuickPickItemKind.Separator },
        { 'label': 'Folder', 'description': 'Generic container', 'className': 'Folder' },
        { 'label': 'Model', 'description': 'Group of parts', 'className': 'Model' },
        { 'label': 'Configuration', 'description': 'Store configuration values', 'className': 'Configuration' },

        { 'label': '$(code) Scripts', 'kind': QuickPickItemKind.Separator },
        { 'label': 'Script', 'description': 'Server-side script', 'className': 'Script' },
        { 'label': 'LocalScript', 'description': 'Client-side script', 'className': 'LocalScript' },
        { 'label': 'ModuleScript', 'description': 'Reusable module', 'className': 'ModuleScript' },

        { 'label': '$(primitive-square) Parts', 'kind': QuickPickItemKind.Separator },
        { 'label': 'Part', 'description': 'Basic brick part', 'className': 'Part' },
        { 'label': 'WedgePart', 'description': 'Wedge-shaped part', 'className': 'WedgePart' },
        { 'label': 'CornerWedgePart', 'description': 'Corner wedge part', 'className': 'CornerWedgePart' },
        { 'label': 'MeshPart', 'description': 'Custom mesh part', 'className': 'MeshPart' },
        { 'label': 'SpawnLocation', 'description': 'Player spawn point', 'className': 'SpawnLocation' },

        { 'label': '$(layout) UI', 'kind': QuickPickItemKind.Separator },
        { 'label': 'ScreenGui', 'description': 'Screen overlay GUI', 'className': 'ScreenGui' },
        { 'label': 'BillboardGui', 'description': '3D world GUI', 'className': 'BillboardGui' },
        { 'label': 'SurfaceGui', 'description': 'Surface-attached GUI', 'className': 'SurfaceGui' },
        { 'label': 'Frame', 'description': 'GUI container', 'className': 'Frame' },
        { 'label': 'TextLabel', 'description': 'Display text', 'className': 'TextLabel' },
        { 'label': 'TextButton', 'description': 'Clickable text', 'className': 'TextButton' },
        { 'label': 'TextBox', 'description': 'Text input', 'className': 'TextBox' },
        { 'label': 'ImageLabel', 'description': 'Display image', 'className': 'ImageLabel' },
        { 'label': 'ImageButton', 'description': 'Clickable image', 'className': 'ImageButton' },

        { 'label': '$(symbol-value) Values', 'kind': QuickPickItemKind.Separator },
        { 'label': 'StringValue', 'description': 'Store a string', 'className': 'StringValue' },
        { 'label': 'NumberValue', 'description': 'Store a number', 'className': 'NumberValue' },
        { 'label': 'IntValue', 'description': 'Store an integer', 'className': 'IntValue' },
        { 'label': 'BoolValue', 'description': 'Store a boolean', 'className': 'BoolValue' },
        { 'label': 'ObjectValue', 'description': 'Store an instance reference', 'className': 'ObjectValue' },

        { 'label': '$(zap) Events & Communication', 'kind': QuickPickItemKind.Separator },
        { 'label': 'RemoteEvent', 'description': 'Client-server event', 'className': 'RemoteEvent' },
        { 'label': 'RemoteFunction', 'description': 'Client-server function', 'className': 'RemoteFunction' },
        { 'label': 'BindableEvent', 'description': 'Same-context event', 'className': 'BindableEvent' },
        { 'label': 'BindableFunction', 'description': 'Same-context function', 'className': 'BindableFunction' },
      ];

      const selected = await window.showQuickPick(classCategories, {
        'title': 'Create Instance',
        'placeHolder': 'Select a class to create',
      });

      if (selected === undefined || selected.className === undefined) return;

      const name = await window.showInputBox({
        'title': 'Instance Name',
        'prompt': `Name for new ${selected.className}`,
        'value': selected.className,
        'validateInput': v => {
          if (v.trim() === '') return 'Name cannot be empty';
          return undefined;
        },
      });

      if (name === undefined) return;

      try {
        const result = await client.sendRequest<{
          success: boolean;
          instanceName?: string;
          error?: string;
        }>('custom/createInstance', {
          'className': selected.className,
          'parentPath': item.path,
          'name': name.trim(),
        });

        if (result.success) {
          window.showInformationMessage(`Created ${result.instanceName} in ${item.name}`);
          await client.sendRequest('custom/requestGameTree');
        } else window.showErrorMessage(`Create failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Create failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.cloneInstance', async (item: GameTreeItem) => {
      try {
        const result = await client.sendRequest<{
          success: boolean;
          cloneName?: string;
          error?: string;
        }>('custom/cloneInstance', { 'path': item.path });

        if (result.success) {
          window.showInformationMessage(`Cloned ${item.name} as ${result.cloneName}`);
          await client.sendRequest('custom/requestGameTree');
        } else window.showErrorMessage(`Clone failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Clone failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.searchGameTree', async () => {
      const searchTypes = [
        {
          'label': '$(symbol-string) By Name',
          'description': 'Search instances by name',
          'byName': true,
          'byClass': false,
        },
        {
          'label': '$(symbol-class) By Class',
          'description': 'Search instances by class name',
          'byName': false,
          'byClass': true,
        },
        {
          'label': '$(search) By Name or Class',
          'description': 'Search by both name and class',
          'byName': true,
          'byClass': true,
        },
      ];

      const searchType = await window.showQuickPick(searchTypes, {
        'title': 'Search Game Tree',
        'placeHolder': 'Select search type',
      });

      if (searchType === undefined) return;

      const query = await window.showInputBox({
        'title': 'Search Game Tree',
        'prompt': `Enter ${searchType.byName && searchType.byClass ? 'name or class' : searchType.byName ? 'name' : 'class'} to search for`,
        'placeHolder': searchType.byClass ? 'e.g., Part, Script, Folder' : 'e.g., MyFolder, PlayerScript',
      });

      if (query === undefined || query.trim() === '') return;

      gameTreeProvider.setSearchFilter(query.trim(), {
        'byName': searchType.byName,
        'byClass': searchType.byClass,
      });

      commands.executeCommand('setContext', 'rbxdev-ls:searchActive', true);
    }),

    commands.registerCommand('rbxdev-ls.clearGameTreeSearch', () => {
      gameTreeProvider.clearSearch();
      commands.executeCommand('setContext', 'rbxdev-ls:searchActive', false);
    }),
  );

  return { 'clear': () => gameTreeProvider.clear() };
};
