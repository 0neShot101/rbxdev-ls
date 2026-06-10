import {
  createConnection,
  ProposedFeatures,
  type InitializeParams,
  type InitializeResult,
} from 'vscode-languageserver/node';

import { serverCapabilities } from '@core/capabilities';
import type { ConnectionInstance } from '@typings/lsp';

/** Creates a new LSP server connection with all proposed features enabled. */
export const createServerConnection = (): ConnectionInstance => createConnection(ProposedFeatures.all);

/** Creates the initialization result to send back to the client during LSP handshake. */
export const createInitializeResult = (params: InitializeParams): InitializeResult => {
  const result: InitializeResult = {
    'capabilities': serverCapabilities,
    'serverInfo': { 'name': 'rbxdev-ls', 'version': '0.1.0' },
  };

  if (params.capabilities.workspace?.workspaceFolders === true)
    result.capabilities.workspace = {
      'workspaceFolders': { 'supported': true, 'changeNotifications': true },
    };

  return result;
};
