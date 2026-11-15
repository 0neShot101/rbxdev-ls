import { PassThrough } from 'stream';
import {
  CodeAction,
  CodeActionRequest,
  CompletionRequest,
  CompletionResolveRequest,
  createConnection,
  createMessageConnection,
  DidOpenTextDocumentNotification,
  HoverRequest,
  InitializedNotification,
  InitializeRequest,
  SemanticTokensRangeRequest,
  SignatureHelpRequest,
  StreamMessageReader,
  StreamMessageWriter,
  TextDocuments,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentManager } from '@typings/lsp';
import type { LspHarness } from '@tests/types/lsp';

/**
 * Creates a server connection paired with an in-memory JSON-RPC client.
 * Opened documents are parsed into the supplied document manager.
 * @param documentManager - Manager that parses every opened or changed document.
 * @returns A harness whose handlers must be registered before `start`.
 */
export const createLspHarness = (documentManager: DocumentManager): LspHarness => {
  const clientToServer = new PassThrough();
  const serverToClient = new PassThrough();
  const connection = createConnection(new StreamMessageReader(clientToServer), new StreamMessageWriter(serverToClient));
  const client = createMessageConnection(
    new StreamMessageReader(serverToClient),
    new StreamMessageWriter(clientToServer),
  );
  const documents = new TextDocuments(TextDocument);
  let documentCount = 0;

  documents.onDidChangeContent(change => void documentManager.parseDocument(change.document));

  return {
    connection,
    documents,
    'start': async () => {
      documents.listen(connection);
      connection.listen();
      client.listen();
      await client.sendRequest(InitializeRequest.type, {
        'processId': null,
        'rootUri': null,
        'capabilities': {},
        'workspaceFolders': null,
      });
      await client.sendNotification(InitializedNotification.type, {});
    },
    'open': async text => {
      documentCount += 1;
      const uri = `file:///harness-${documentCount}.luau`;
      await client.sendNotification(DidOpenTextDocumentNotification.type, {
        'textDocument': { uri, 'languageId': 'luau', 'version': 1, text },
      });
      return uri;
    },
    'complete': async (uri, position) => {
      const result = await client.sendRequest(CompletionRequest.type, { 'textDocument': { uri }, position });
      if (result === null || Array.isArray(result)) throw new Error('Expected a completion list');
      return result;
    },
    'codeActions': async params => {
      const result = await client.sendRequest(CodeActionRequest.type, params);
      return result === null ? [] : result.filter(CodeAction.is);
    },
    'resolve': item => client.sendRequest(CompletionResolveRequest.type, item),
    'hover': (uri, position) => client.sendRequest(HoverRequest.type, { 'textDocument': { uri }, position }),
    'signature': (uri, position) =>
      client.sendRequest(SignatureHelpRequest.type, { 'textDocument': { uri }, position }),
    'semanticTokensRange': async (uri, range) => {
      const result = await client.sendRequest(SemanticTokensRangeRequest.type, { 'textDocument': { uri }, range });
      return result === null ? [] : result.data;
    },
    'dispose': () => {
      client.dispose();
      connection.dispose();
      clientToServer.end();
      serverToClient.end();
    },
  };
};
