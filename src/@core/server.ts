import * as url from 'url';

import { createExecutorBridge } from '@executor';
import { hasCapability } from '@executor/capabilities';
import type { BridgeCapability } from '@typings/clientType';
import { createDocumentManager } from '@lsp/documents';
import { setupCallHierarchyHandler } from '@lsp/handlers/callHierarchy';
import { setupCodeLensHandler } from '@lsp/handlers/codeLens';
import { setupCodeActionHandler } from '@lsp/handlers/codeAction';
import { setupColorHandler } from '@lsp/handlers/color';
import { setupCompletionHandler } from '@lsp/handlers/completion';
import { setupDefinitionHandler } from '@lsp/handlers/definition';
import { setupDocumentHighlightHandler } from '@lsp/handlers/documentHighlight';
import { setupImplementationHandler } from '@lsp/handlers/implementation';
import { setupDocumentLinkHandler } from '@lsp/handlers/documentLink';
import { setupFoldingRangeHandler } from '@lsp/handlers/foldingRange';
import { setupDiagnosticsHandler } from '@lsp/handlers/diagnostics';
import { setupDocumentSymbolHandler } from '@lsp/handlers/documentSymbol';
import { setupFormattingHandler } from '@lsp/handlers/formatting';
import { setupHoverHandler } from '@lsp/handlers/hover';
import { setupInlayHintsHandler } from '@lsp/handlers/inlayHints';
import { setupLinkedEditingRangeHandler } from '@lsp/handlers/linkedEditingRange';
import { setupReferencesHandler } from '@lsp/handlers/references';
import { setupRenameHandler } from '@lsp/handlers/rename';
import { setupSemanticTokensHandler } from '@lsp/handlers/semanticTokens';
import { setupSelectionRangeHandler } from '@lsp/handlers/selectionRange';
import { setupSignatureHelpHandler } from '@lsp/handlers/signature';
import { setupTypeDefinitionHandler } from '@lsp/handlers/typeDefinition';
import { setupTypeHierarchyHandler } from '@lsp/handlers/typeHierarchy';
import { setupWorkspaceSymbolHandler } from '@lsp/handlers/workspaceSymbol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';

import type { ServerState } from '@typings/lsp';
import { createInitializeResult, createServerConnection } from './connection';

/** Creates a new language server instance with all required components. */
export const createServer = (): ServerState => {
  const connection = createServerConnection();
  const documents = new TextDocuments(TextDocument);
  const documentManager = createDocumentManager();
  const executorBridge = createExecutorBridge(msg => connection.console.log(msg));

  return { connection, documents, documentManager, executorBridge, 'initialized': false };
};

const EXECUTOR_BRIDGE_PORT = 21324;

/** Starts the language server and registers all LSP handlers. */
export const startServer = (state: ServerState): void => {
  const { connection, documents, documentManager, executorBridge } = state;

  let workspacePath: string | undefined;

  const bridgeRequest =
    <P, R>(method: (params: P) => Promise<R>, requiredCapability?: BridgeCapability) =>
    async (params: P) => {
      if (executorBridge.isConnected === false) return { 'success': false, 'error': 'No client connected' };
      if (
        requiredCapability !== undefined &&
        hasCapability(executorBridge.clientCapabilities, requiredCapability) === false
      )
        return {
          'success': false,
          'error': `Feature not available with ${executorBridge.clientType ?? 'current'} client`,
        };
      try {
        return await method(params);
      } catch (err) {
        return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
      }
    };

  connection.onInitialize(params => {
    connection.console.log('rbxdev-ls initializing...');
    connection.console.log(`Loaded ${documentManager.globalEnv.robloxClasses.size} Roblox classes`);
    connection.console.log(`Loaded ${documentManager.globalEnv.robloxEnums.size} Roblox enums`);

    if (
      params.workspaceFolders !== undefined &&
      params.workspaceFolders !== null &&
      params.workspaceFolders.length > 0
    ) {
      const firstFolder = params.workspaceFolders[0];
      if (firstFolder !== undefined) {
        try {
          workspacePath = url.fileURLToPath(firstFolder.uri);
        } catch {
          workspacePath = firstFolder.uri.replace('file:///', '').replace('file://', '');
        }
      }
    } else if (params.rootUri !== undefined && params.rootUri !== null) {
      try {
        workspacePath = url.fileURLToPath(params.rootUri);
      } catch {
        workspacePath = params.rootUri.replace('file:///', '').replace('file://', '');
      }
    } else if (params.rootPath !== undefined && params.rootPath !== null) {
      workspacePath = params.rootPath;
    }

    return createInitializeResult(params);
  });

  connection.onInitialized(() => {
    connection.console.log('rbxdev-ls initialized successfully');

    if (workspacePath !== undefined) {
      connection.console.log(`Initializing workspace: ${workspacePath}`);
      documentManager.initializeWorkspace(workspacePath);

      const rojoState = documentManager.getRojoState();
      if (rojoState?.project !== undefined) connection.console.log(`Found Rojo project: ${rojoState.project.name}`);

      const moduleIndex = documentManager.getModuleIndex();
      connection.console.log(`Indexed ${moduleIndex.size} modules`);
    }

    executorBridge.start(EXECUTOR_BRIDGE_PORT);
  });

  connection.onShutdown(() => {
    connection.console.log('rbxdev-ls shutting down...');
    executorBridge.stop();
  });

  connection.onRequest('custom/executorStatus', () => ({
    'isRunning': executorBridge.isRunning,
    'isConnected': executorBridge.isConnected,
    'executorName': executorBridge.executorName,
    'clientType': executorBridge.clientType ?? null,
  }));

  connection.onRequest('custom/execute', async (params: { code: string }) => {
    if (executorBridge.isConnected === false)
      return { 'success': false, 'error': { 'message': 'No client connected' } };
    if (hasCapability(executorBridge.clientCapabilities, 'execute') === false)
      return { 'success': false, 'error': { 'message': 'Code execution not available with current client' } };
    return executorBridge.execute(params.code);
  });

  connection.onRequest('custom/toggleBridge', () => {
    if (executorBridge.isRunning) executorBridge.stop();
    else executorBridge.start(EXECUTOR_BRIDGE_PORT);
    return { 'isRunning': executorBridge.isRunning, 'isConnected': executorBridge.isConnected };
  });

  connection.onRequest('custom/requestGameTree', () => {
    executorBridge.requestGameTree();
    return { 'success': true };
  });

  connection.onRequest('custom/getGameTree', (params?: { path?: string[] }) => {
    if (executorBridge.isConnected === false) return { 'success': false, 'error': 'No executor connected' };

    const model = executorBridge.liveGameModel;

    if (params?.path !== undefined && params.path.length > 0) {
      const node = model.getNode(params.path);
      if (node === undefined) return { 'success': false, 'error': `Node not found: ${params.path.join('.')}` };
      return { 'success': true, 'node': node };
    }

    const nodes: Array<{ name: string; className: string; children?: unknown[]; hasChildren?: boolean }> = [];
    for (const [, node] of model.services) nodes.push(node);
    return { 'success': true, 'nodes': nodes };
  });

  connection.onRequest(
    'custom/requestProperties',
    bridgeRequest((params: { path: string[] }) => executorBridge.requestProperties(params.path)),
  );

  connection.onRequest(
    'custom/setProperty',
    bridgeRequest((params: { path: string[]; property: string; value: string; valueType: string }) =>
      executorBridge.setProperty(params.path, params.property, params.value, params.valueType),
    ),
  );

  connection.onRequest(
    'custom/teleportTo',
    bridgeRequest((params: { path: string[] }) => executorBridge.teleportTo(params.path)),
  );

  connection.onRequest(
    'custom/deleteInstance',
    bridgeRequest((params: { path: string[] }) => executorBridge.deleteInstance(params.path)),
  );

  connection.onRequest(
    'custom/reparentInstance',
    bridgeRequest((params: { sourcePath: string[]; targetPath: string[] }) =>
      executorBridge.reparentInstance(params.sourcePath, params.targetPath),
    ),
  );

  connection.onRequest(
    'custom/requestChildren',
    bridgeRequest((params: { path: string[] }) => executorBridge.requestChildren(params.path)),
  );

  connection.onRequest(
    'custom/getScriptSource',
    bridgeRequest((params: { path: string[] }) => executorBridge.requestScriptSource(params.path)),
  );

  connection.onRequest(
    'custom/createInstance',
    bridgeRequest((params: { className: string; parentPath: string[]; name?: string }) =>
      executorBridge.createInstance(params.className, params.parentPath, params.name),
    ),
  );

  connection.onRequest(
    'custom/cloneInstance',
    bridgeRequest((params: { path: string[] }) => executorBridge.cloneInstance(params.path)),
  );

  connection.onRequest(
    'custom/setRemoteSpyEnabled',
    bridgeRequest((params: { enabled: boolean }) => executorBridge.setRemoteSpyEnabled(params.enabled), 'remoteSpy'),
  );

  connection.onRequest(
    'custom/setRemoteSpyFilter',
    bridgeRequest((params: { filter: string }) => executorBridge.setRemoteSpyFilter(params.filter), 'remoteSpy'),
  );

  connection.onRequest(
    'custom/setRemoteSpyBlockList',
    bridgeRequest(
      (params: { blocks: Array<{ type: 'path' | 'name'; value: string }> }) =>
        executorBridge.setRemoteSpyBlockList(params.blocks),
      'remoteSpy',
    ),
  );

  connection.onRequest(
    'custom/setScriptSource',
    bridgeRequest(
      (params: { path: string[]; source: string }) => executorBridge.setScriptSource(params.path, params.source),
      'scriptWrite',
    ),
  );

  connection.onRequest('custom/getRemoteSpyStatus', () => ({
    'isEnabled': executorBridge.isRemoteSpyEnabled,
    'callCount': executorBridge.remoteSpyCalls.length,
  }));

  connection.onRequest('custom/getRemoteSpyCalls', (params?: { limit?: number }) => {
    const limit = params?.limit ?? 50;
    return { 'success': true, 'calls': executorBridge.remoteSpyCalls.slice(-limit) };
  });

  executorBridge.onLog(log => connection.sendNotification('custom/log', log));
  executorBridge.onGameTreeUpdate(nodes => connection.sendNotification('custom/gameTreeUpdate', nodes));
  executorBridge.onRemoteSpy(call => connection.sendNotification('custom/remoteSpy', call));

  setupDiagnosticsHandler(connection, documents, documentManager, executorBridge.liveGameModel);
  setupCompletionHandler(connection, documents, documentManager, executorBridge);
  setupHoverHandler(connection, documentManager, executorBridge);
  setupSignatureHelpHandler(connection, documentManager);
  setupColorHandler(connection, documents);
  setupCodeActionHandler(connection, documents, documentManager);
  setupDocumentSymbolHandler(connection, documentManager);
  setupSemanticTokensHandler(connection, documentManager);
  setupDefinitionHandler(connection, documentManager);
  setupReferencesHandler(connection, documentManager);
  setupRenameHandler(connection, documentManager);
  setupInlayHintsHandler(connection, documentManager);
  setupFormattingHandler(connection, documents, documentManager);
  setupFoldingRangeHandler(connection, documentManager);
  setupWorkspaceSymbolHandler(connection, documentManager);
  setupCallHierarchyHandler(connection, documentManager);
  setupDocumentHighlightHandler(connection, documentManager);
  setupLinkedEditingRangeHandler(connection, documentManager);
  setupDocumentLinkHandler(connection, documentManager);
  setupCodeLensHandler(connection, documentManager);
  setupSelectionRangeHandler(connection, documentManager);
  setupTypeHierarchyHandler(connection, documentManager);
  setupTypeDefinitionHandler(connection, documentManager);
  setupImplementationHandler(connection, documentManager);

  documents.listen(connection);
  connection.listen();
};
