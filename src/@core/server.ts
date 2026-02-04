/**
 * LSP Server Lifecycle Management
 *
 * Handles the creation, initialization, and lifecycle of the language server.
 * Coordinates between the LSP connection, document management, executor bridge,
 * and all LSP feature handlers.
 */

import * as url from 'url';

import { createExecutorBridge, type ExecutorBridge } from '@executor';
import { createDocumentManager, type DocumentManager } from '@lsp/documents';
import { setupCodeActionHandler } from '@lsp/handlers/codeAction';
import { setupColorHandler } from '@lsp/handlers/color';
import { setupCompletionHandler } from '@lsp/handlers/completion';
import { setupDefinitionHandler } from '@lsp/handlers/definition';
import { setupDiagnosticsHandler } from '@lsp/handlers/diagnostics';
import { setupDocumentSymbolHandler } from '@lsp/handlers/documentSymbol';
import { setupFormattingHandler } from '@lsp/handlers/formatting';
import { setupHoverHandler } from '@lsp/handlers/hover';
import { setupInlayHintsHandler } from '@lsp/handlers/inlayHints';
import { setupReferencesHandler } from '@lsp/handlers/references';
import { setupRenameHandler } from '@lsp/handlers/rename';
import { setupSemanticTokensHandler } from '@lsp/handlers/semanticTokens';
import { setupSignatureHelpHandler } from '@lsp/handlers/signature';
import { TextDocument } from 'vscode-languageserver-textdocument';
// eslint-disable-next-line import/order
import { TextDocuments } from 'vscode-languageserver/node';

import { type ConnectionInstance, createInitializeResult, createServerConnection } from './connection';

/**
 * Represents the complete state of the language server.
 *
 * Contains all core components needed for server operation including
 * the LSP connection, document storage, document analysis manager,
 * and the executor bridge for live game integration.
 */
export interface ServerState {
  /** The active LSP connection to the client */
  readonly connection: ConnectionInstance;
  /** Collection of all open text documents synchronized from the client */
  readonly documents: TextDocuments<TextDocument>;
  /** Manager responsible for document parsing, analysis, and Roblox environment data */
  readonly documentManager: DocumentManager;
  /** Bridge for communicating with the Roblox executor for live code execution */
  readonly executorBridge: ExecutorBridge;
  /** Flag indicating whether the server has completed initialization */
  readonly initialized: boolean;
}

/**
 * Creates a new language server instance with all required components.
 *
 * Initializes the LSP connection, document collection, document manager
 * with Roblox environment data, and the executor bridge for live game
 * communication. The server is created in an uninitialized state.
 *
 * @returns A new ServerState object containing all server components in their initial state
 */
export const createServer = (): ServerState => {
  const connection = createServerConnection();
  const documents = new TextDocuments(TextDocument);
  const documentManager = createDocumentManager();
  const executorBridge = createExecutorBridge(msg => connection.console.log(msg));

  return {
    connection,
    documents,
    documentManager,
    executorBridge,
    'initialized': false,
  };
};

/** Default port number for the executor bridge WebSocket server */
const EXECUTOR_BRIDGE_PORT = 21324;

/**
 * Starts the language server and registers all LSP handlers.
 *
 * Configures the server to handle the full LSP lifecycle including:
 * - Initialization handshake with workspace folder detection
 * - Rojo project discovery and module indexing
 * - Executor bridge auto-start for live game integration
 * - Custom LSP requests for executor status and code execution
 * - All standard LSP feature handlers (completion, hover, diagnostics, etc.)
 *
 * @param state - The server state containing connection, documents, and other components
 * @returns void - The server runs until shutdown is requested
 */
export const startServer = (state: ServerState): void => {
  const { connection, documents, documentManager, executorBridge } = state;

  let workspacePath: string | undefined;

  connection.onInitialize(params => {
    connection.console.log('rbxdev-ls initializing...');
    connection.console.log(`Loaded ${documentManager.globalEnv.robloxClasses.size} Roblox classes`);
    connection.console.log(`Loaded ${documentManager.globalEnv.robloxEnums.size} Roblox enums`);

    // Extract workspace path from initialization params
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

    // Initialize workspace for Rojo integration and module indexing
    if (workspacePath !== undefined) {
      connection.console.log(`Initializing workspace: ${workspacePath}`);
      documentManager.initializeWorkspace(workspacePath);

      const rojoState = documentManager.getRojoState();
      if (rojoState?.project !== undefined) {
        connection.console.log(`Found Rojo project: ${rojoState.project.name}`);
      }

      const moduleIndex = documentManager.getModuleIndex();
      connection.console.log(`Indexed ${moduleIndex.size} modules`);
    }

    // Auto-start executor bridge
    executorBridge.start(EXECUTOR_BRIDGE_PORT);
  });

  connection.onShutdown(() => {
    connection.console.log('rbxdev-ls shutting down...');
    executorBridge.stop();
  });

  // Custom LSP requests for executor bridge
  connection.onRequest('custom/executorStatus', () => ({
    'isRunning': executorBridge.isRunning,
    'isConnected': executorBridge.isConnected,
    'executorName': executorBridge.executorName,
  }));

  connection.onRequest('custom/execute', async (params: { code: string }) => {
    if (executorBridge.isConnected === false) {
      return { 'success': false, 'error': { 'message': 'No executor connected' } };
    }
    return executorBridge.execute(params.code);
  });

  connection.onRequest('custom/toggleBridge', () => {
    if (executorBridge.isRunning) {
      executorBridge.stop();
    } else {
      executorBridge.start(EXECUTOR_BRIDGE_PORT);
    }
    return {
      'isRunning': executorBridge.isRunning,
      'isConnected': executorBridge.isConnected,
    };
  });

  connection.onRequest('custom/requestGameTree', () => {
    executorBridge.requestGameTree();
    return { 'success': true };
  });

  connection.onRequest('custom/getGameTree', (params?: { path?: string[] }) => {
    if (executorBridge.isConnected === false) {
      return { 'success': false, 'error': 'No executor connected' };
    }

    const model = executorBridge.liveGameModel;

    if (params?.path !== undefined && params.path.length > 0) {
      const node = model.getNode(params.path);
      if (node === undefined) {
        return { 'success': false, 'error': `Node not found: ${params.path.join('.')}` };
      }
      return { 'success': true, 'node': node };
    }

    const nodes: Array<{ name: string; className: string; children?: unknown[]; hasChildren?: boolean }> = [];
    for (const [, node] of model.services) {
      nodes.push(node);
    }
    return { 'success': true, 'nodes': nodes };
  });

  connection.onRequest('custom/requestProperties', async (params: { path: string[] }) => {
    if (executorBridge.isConnected === false) {
      return { 'success': false, 'error': 'No executor connected' };
    }
    try {
      const result = await executorBridge.requestProperties(params.path);
      return result;
    } catch (err) {
      return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  connection.onRequest(
    'custom/setProperty',
    async (params: { path: string[]; property: string; value: string; valueType: string }) => {
      if (executorBridge.isConnected === false) {
        return { 'success': false, 'error': 'No executor connected' };
      }
      try {
        const result = await executorBridge.setProperty(params.path, params.property, params.value, params.valueType);
        return result;
      } catch (err) {
        return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
      }
    },
  );

  connection.onRequest('custom/teleportTo', async (params: { path: string[] }) => {
    if (executorBridge.isConnected === false) {
      return { 'success': false, 'error': 'No executor connected' };
    }
    try {
      const result = await executorBridge.teleportTo(params.path);
      return result;
    } catch (err) {
      return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  connection.onRequest('custom/deleteInstance', async (params: { path: string[] }) => {
    if (executorBridge.isConnected === false) {
      return { 'success': false, 'error': 'No executor connected' };
    }
    try {
      const result = await executorBridge.deleteInstance(params.path);
      return result;
    } catch (err) {
      return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  connection.onRequest('custom/reparentInstance', async (params: { sourcePath: string[]; targetPath: string[] }) => {
    if (executorBridge.isConnected === false) {
      return { 'success': false, 'error': 'No executor connected' };
    }
    try {
      const result = await executorBridge.reparentInstance(params.sourcePath, params.targetPath);
      return result;
    } catch (err) {
      return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  connection.onRequest('custom/requestChildren', async (params: { path: string[] }) => {
    if (executorBridge.isConnected === false) {
      return { 'success': false, 'error': 'No executor connected' };
    }
    try {
      const result = await executorBridge.requestChildren(params.path);
      return result;
    } catch (err) {
      return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  connection.onRequest('custom/getScriptSource', async (params: { path: string[] }) => {
    if (executorBridge.isConnected === false) {
      return { 'success': false, 'error': 'No executor connected' };
    }
    try {
      const result = await executorBridge.requestScriptSource(params.path);
      return result;
    } catch (err) {
      return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  connection.onRequest(
    'custom/createInstance',
    async (params: { className: string; parentPath: string[]; name?: string }) => {
      if (executorBridge.isConnected === false) {
        return { 'success': false, 'error': 'No executor connected' };
      }
      try {
        const result = await executorBridge.createInstance(params.className, params.parentPath, params.name);
        return result;
      } catch (err) {
        return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
      }
    },
  );

  connection.onRequest('custom/cloneInstance', async (params: { path: string[] }) => {
    if (executorBridge.isConnected === false) {
      return { 'success': false, 'error': 'No executor connected' };
    }
    try {
      const result = await executorBridge.cloneInstance(params.path);
      return result;
    } catch (err) {
      return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  connection.onRequest('custom/setRemoteSpyEnabled', async (params: { enabled: boolean }) => {
    if (executorBridge.isConnected === false) {
      return { 'success': false, 'error': 'No executor connected' };
    }
    try {
      const result = await executorBridge.setRemoteSpyEnabled(params.enabled);
      return result;
    } catch (err) {
      return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  connection.onRequest('custom/setRemoteSpyFilter', async (params: { filter: string }) => {
    if (executorBridge.isConnected === false) {
      return { 'success': false, 'error': 'No executor connected' };
    }
    try {
      const result = await executorBridge.setRemoteSpyFilter(params.filter);
      return result;
    } catch (err) {
      return { 'success': false, 'error': err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  connection.onRequest('custom/getRemoteSpyStatus', () => ({
    'isEnabled': executorBridge.isRemoteSpyEnabled,
    'callCount': executorBridge.remoteSpyCalls.length,
  }));

  connection.onRequest('custom/getRemoteSpyCalls', (params?: { limit?: number }) => {
    const limit = params?.limit ?? 50;
    const calls = executorBridge.remoteSpyCalls.slice(-limit);
    return { 'success': true, 'calls': calls };
  });

  // Forward executor bridge events to client
  executorBridge.onLog(log => {
    connection.sendNotification('custom/log', log);
  });

  executorBridge.onGameTreeUpdate(nodes => {
    connection.sendNotification('custom/gameTreeUpdate', nodes);
  });

  executorBridge.onRemoteSpy(call => {
    connection.sendNotification('custom/remoteSpy', call);
  });

  // Setup LSP handlers
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

  documents.listen(connection);
  connection.listen();
};
