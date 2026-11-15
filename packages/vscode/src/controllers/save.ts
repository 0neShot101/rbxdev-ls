import { commands, ProgressLocation, window, workspace } from 'vscode';

import { escapeLuaString, stripMarkers, toLuaLookup } from '#extension/utils/gamePath';

import type { ExtensionContext } from 'vscode';
import type { SaveCollaborators } from '@typings/controllers';
import type { GameTreeItem } from '@typings/gameTree';

/**
 * Registers the save-game and save-instance commands, which generate and execute `saveinstance` calls.
 * @param context - Extension context that owns the commands.
 * @param collaborators - Code executor and bridge connection reader.
 */
export const registerSaveCommands = (context: ExtensionContext, { execute, isConnected }: SaveCollaborators): void =>
  void context.subscriptions.push(
    commands.registerCommand('rbxdev-ls.saveGame', async () => {
      if (isConnected() === false) return window.showErrorMessage('No executor connected');

      const fileName = await window.showInputBox({
        'title': 'Save Game',
        'prompt': 'Enter the file name for the saved game',
        'value': 'game.rbxl',
        'validateInput': v => {
          if (v.trim() === '') return 'File name cannot be empty';
          if (v.endsWith('.rbxl') === false && v.endsWith('.rbxlx') === false)
            return 'File must end with .rbxl or .rbxlx';
          return undefined;
        },
      });

      if (fileName === undefined) return;

      const config = workspace.getConfiguration('rbxdev-ls');
      const decompile = config.get<boolean>('saveInstance.decompile', true);
      const noscripts = config.get<boolean>('saveInstance.noscripts', false);
      const excludeServices = config.get<string[]>('saveInstance.excludeServices', ['Chat', 'CoreGui', 'CorePackages']);

      const optionParts: string[] = [];
      optionParts.push(`FilePath = "${escapeLuaString(fileName)}"`);
      optionParts.push(`Decompile = ${decompile}`);
      if (noscripts === true) optionParts.push('NilInstances = false');
      if (excludeServices.length > 0) {
        const classNames = excludeServices.map(c => `"${escapeLuaString(c)}"`).join(', ');
        optionParts.push(`ExcludeClassNames = {${classNames}}`);
      }

      const code = `if saveinstance == nil then return "Error: saveinstance not available" end\nlocal ok, err = pcall(saveinstance, {${optionParts.join(', ')}})\nif ok then return "Saved to ${escapeLuaString(fileName)}" else return "Error: " .. tostring(err) end`;

      await window.withProgress(
        { 'location': ProgressLocation.Notification, 'title': `Saving game to ${fileName}...`, 'cancellable': false },
        () => execute(code, result => result ?? `Saved to ${fileName}`, 'Save failed'),
      );
    }),

    commands.registerCommand('rbxdev-ls.saveInstance', async (item: GameTreeItem) => {
      if (isConnected() === false) return window.showErrorMessage('No executor connected');
      if (item === undefined) return window.showErrorMessage('No instance selected');

      const defaultName = `${item.name}.rbxm`;
      const fileName = await window.showInputBox({
        'title': `Save ${item.name}`,
        'prompt': 'Enter the file name',
        'value': defaultName,
        'validateInput': v => {
          if (v.trim() === '') return 'File name cannot be empty';
          if (
            v.endsWith('.rbxm') === false &&
            v.endsWith('.rbxmx') === false &&
            v.endsWith('.rbxl') === false &&
            v.endsWith('.rbxlx') === false
          )
            return 'File must end with .rbxm, .rbxmx, .rbxl, or .rbxlx';
          return undefined;
        },
      });

      if (fileName === undefined) return;

      const config = workspace.getConfiguration('rbxdev-ls');
      const decompile = config.get<boolean>('saveInstance.decompile', true);

      const lookup = toLuaLookup(stripMarkers(item.path));
      const safeFileName = escapeLuaString(fileName);
      const safeItemName = escapeLuaString(item.name);

      const code = `if saveinstance == nil then return "Error: saveinstance not available" end\nlocal target = ${lookup}\nif target == nil then return "Error: instance not found" end\nlocal ok, err = pcall(saveinstance, {Object = target, FilePath = "${safeFileName}", Decompile = ${decompile}})\nif ok then return "Saved ${safeItemName} to ${safeFileName}" else return "Error: " .. tostring(err) end`;

      await window.withProgress(
        { 'location': ProgressLocation.Notification, 'title': `Saving ${item.name}...`, 'cancellable': false },
        () => execute(code, result => result ?? `Saved ${item.name}`, 'Save failed'),
      );
    }),
  );
