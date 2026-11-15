import * as fs from 'fs';
import * as path from 'path';

import { commands, ProgressLocation, StatusBarAlignment, window, workspace } from 'vscode';

import { resolveBundlerCommands, runBundler } from '#extension/bundlerLauncher';
import { isString } from '#extension/utils/guards';
import { parseJsonObject } from '#extension/utils/json';
import { getWorkspaceFolderPath } from '#extension/utils/workspace';

import type { ExtensionContext } from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import type { ExecutionController } from '@typings/controllers';

/**
 * Creates the execution controller: code execution, the execute button and mode, and bundling.
 * @param context - Extension context that owns the button and commands.
 * @param client - Language client used to execute code.
 * @returns The shared code executor.
 */
export const createExecution = (context: ExtensionContext, client: LanguageClient): ExecutionController => {
  let bundleMode: boolean = false;

  const executeCode = async (
    code: string,
    successMessage: (result?: string) => string,
    failurePrefix?: string,
  ): Promise<void> => {
    try {
      const response = await client.sendRequest<{ success: boolean; result?: string; error?: { message: string } }>(
        'custom/execute',
        { code },
      );

      if (response.success) window.showInformationMessage(successMessage(response.result));
      else
        window.showErrorMessage(
          `${failurePrefix ?? 'Execution failed'}: ${response.error?.message ?? 'Unknown error'}`,
        );
    } catch (error) {
      window.showErrorMessage(
        `${failurePrefix ?? 'Execute failed'}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const updateExecuteButton = (): void => {
    executeButton.text = bundleMode ? '$(package) Bundle & Execute' : '$(play) Roblox Execute';
    executeButton.tooltip = bundleMode
      ? 'Bundle & Execute in Roblox (Ctrl+Shift+E)'
      : 'Execute code in Roblox (Ctrl+Shift+E)';
  };
  const executeButton = window.createStatusBarItem(StatusBarAlignment.Right, 101);
  executeButton.command = 'rbxdev-ls.execute';
  updateExecuteButton();
  executeButton.show();
  context.subscriptions.push(executeButton);

  const initBundlerConfig = async (workspaceRoot: string): Promise<boolean> => {
    const sourceInput = await window.showInputBox({
      'prompt': 'Source directory (relative to workspace root)',
      'value': 'src',
      'placeHolder': 'src',
    });
    if (sourceInput === undefined) return false;

    const outputInput = await window.showInputBox({
      'prompt': 'Output file path (relative to workspace root)',
      'value': 'dist/out.lua',
      'placeHolder': 'dist/out.lua',
    });
    if (outputInput === undefined) return false;

    const entryInput = await window.showInputBox({
      'prompt': 'Entry module name (without extension)',
      'value': 'init',
      'placeHolder': 'init',
    });
    if (entryInput === undefined) return false;

    const config = { 'src': sourceInput, 'output': outputInput, 'entry': entryInput };
    const configPath = path.join(workspaceRoot, 'luau-bundler.config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const sourcePath = path.join(workspaceRoot, sourceInput);
    if (fs.existsSync(sourcePath) === false) {
      fs.mkdirSync(sourcePath, { 'recursive': true });
      const entryFile = path.join(sourcePath, `${entryInput}.luau`);
      if (fs.existsSync(entryFile) === false)
        fs.writeFileSync(entryFile, `-- ${entryInput}.luau\nprint("Hello from bundled script!")\n`);
    }

    window.showInformationMessage(`Created luau-bundler.config.json and ${sourceInput}/${entryInput}.luau`);
    return true;
  };

  const doBundleExecute = async (): Promise<void> => {
    const workspaceRoot = getWorkspaceFolderPath();
    if (workspaceRoot === undefined) return void window.showErrorMessage('No workspace folder open');

    let sourceDir = 'src';
    let outputFile = 'dist/out.lua';
    let entry = 'init';
    let project: string | undefined;

    const configPath = path.join(workspaceRoot, 'luau-bundler.config.json');
    const loadConfig = (): void => {
      try {
        const config = parseJsonObject(fs.readFileSync(configPath, 'utf-8'));
        if (config === undefined) return;
        if (isString(config['src'])) sourceDir = config['src'];
        if (isString(config['output'])) outputFile = config['output'];
        if (isString(config['entry'])) entry = config['entry'];
        if (isString(config['project'])) project = config['project'];
      } catch {
        /* An unreadable or malformed config keeps the default bundler options. */
      }
    };

    if (fs.existsSync(configPath)) loadConfig();
    else {
      const created = await initBundlerConfig(workspaceRoot);
      if (created === false) return;
      loadConfig();
    }

    const bundlerCommands = resolveBundlerCommands({
      'customPath': workspace.getConfiguration('rbxdev-ls').get<string>('bundler.path', ''),
      'extensionPath': context.extensionPath,
    });
    const sourceArgs = project !== undefined ? ['--project', project] : ['--src', sourceDir];
    const bundlerArgs = [...sourceArgs, '--out', outputFile, '--entry', entry];
    const outputPath = path.join(workspaceRoot, outputFile);

    try {
      await window.withProgress(
        {
          'location': ProgressLocation.Notification,
          'title': 'Bundling...',
          'cancellable': false,
        },
        () => runBundler(bundlerCommands, bundlerArgs, workspaceRoot),
      );
    } catch (error) {
      window.showErrorMessage(`Bundle failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    if (fs.existsSync(outputPath) === false)
      return void window.showErrorMessage(`Bundle output not found: ${outputFile}`);

    await executeCode(fs.readFileSync(outputPath, 'utf-8'), () => 'Bundle executed successfully');
  };

  context.subscriptions.push(
    commands.registerCommand('rbxdev-ls.execute', async () => {
      if (bundleMode === true) return doBundleExecute();

      const editor = window.activeTextEditor;
      if (editor === undefined) return window.showErrorMessage('No active editor');

      await executeCode(editor.document.getText(), result =>
        result !== undefined ? `Executed: ${result}` : 'Code executed successfully',
      );
    }),

    commands.registerCommand('rbxdev-ls.executeNormal', async () => {
      bundleMode = false;
      updateExecuteButton();
      await commands.executeCommand('rbxdev-ls.execute');
    }),

    commands.registerCommand('rbxdev-ls.executeSelection', async () => {
      const editor = window.activeTextEditor;
      if (editor === undefined) return window.showErrorMessage('No active editor');

      const code = editor.document.getText(editor.selection);
      if (code.trim().length === 0) return window.showErrorMessage('No code selected');

      await executeCode(code, () => 'Selection executed successfully');
    }),

    commands.registerCommand('rbxdev-ls.bundleExecute', async () => {
      bundleMode = true;
      updateExecuteButton();
      await doBundleExecute();
    }),
  );

  return { 'execute': executeCode };
};
