/**
 * LSP Connection Management
 *
 * Provides functions for creating and configuring the Language Server Protocol connection
 * between the server and the client (IDE/editor).
 */

import {
  createConnection,
  ProposedFeatures,
  type Connection,
  type InitializeParams,
  type InitializeResult,
} from 'vscode-languageserver/node';

import { serverCapabilities } from './capabilities';

/**
 * Type alias for the LSP Connection interface.
 * Represents an active connection between the language server and a client.
 */
export type ConnectionInstance = Connection;

/**
 * Creates a new LSP server connection with all proposed features enabled.
 *
 * Initializes a connection that listens for client requests and notifications
 * using the Node.js IPC transport with full proposed feature support.
 *
 * @returns The newly created LSP connection instance ready for handler registration
 */
export const createServerConnection = (): ConnectionInstance => {
  const connection = createConnection(ProposedFeatures.all);
  return connection;
};

/**
 * Creates the initialization result to send back to the client during LSP handshake.
 *
 * Constructs the response containing server capabilities and metadata. If the client
 * supports workspace folders, additional workspace-related capabilities are included.
 *
 * @param params - The initialization parameters received from the client containing client capabilities
 * @returns The initialization result containing server capabilities and server information
 */
export const createInitializeResult = (params: InitializeParams): InitializeResult => {
  const result: InitializeResult = {
    'capabilities': serverCapabilities,
    'serverInfo': {
      'name': 'rbxdev-ls',
      'version': '0.1.0',
    },
  };

  if (params.capabilities.workspace?.workspaceFolders === true) {
    result.capabilities.workspace = {
      'workspaceFolders': {
        'supported': true,
        'changeNotifications': true,
      },
    };
  }

  return result;
};
