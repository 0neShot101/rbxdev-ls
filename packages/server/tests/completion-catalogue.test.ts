import { PassThrough } from 'stream';

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  CompletionRequest,
  CompletionResolveRequest,
  createConnection,
  createMessageConnection,
  DidOpenTextDocumentNotification,
  HoverRequest,
  InitializedNotification,
  InitializeRequest,
  MarkupContent,
  StreamMessageReader,
  StreamMessageWriter,
  TextDocuments,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { docsSource } from '@definitions/updates/docsStore';
import { createExecutorBridge } from '@executor/server';
import { createDocumentManager } from '@lsp/documents';
import { setupCompletionHandler } from '@lsp/handlers/completion';
import { setupHoverHandler } from '@lsp/handlers/hover';

import type { RobloxApiDump } from '@typings/definitions';
import type { DocsDatabase } from '@typings/docs';
import type { CompletionItem, CompletionList, MessageConnection, Position } from 'vscode-languageserver/node';

const fixtureApi: RobloxApiDump = {
  'Version': 1,
  'Classes': [
    {
      'Name': 'Instance',
      'Superclass': '<<<ROOT>>>',
      'Members': [
        { 'MemberType': 'Property', 'Name': 'Name', 'ValueType': { 'Name': 'string', 'Category': 'Primitive' } },
      ],
      'Tags': ['NotCreatable'],
    },
    {
      'Name': 'ServiceProvider',
      'Superclass': 'Instance',
      'Members': [
        {
          'MemberType': 'Function',
          'Name': 'GetService',
          'Parameters': [{ 'Name': 'className', 'Type': { 'Name': 'string', 'Category': 'Primitive' } }],
          'ReturnType': { 'Name': 'Instance', 'Category': 'Class' },
        },
      ],
      'Tags': ['NotCreatable'],
    },
    { 'Name': 'DataModel', 'Superclass': 'ServiceProvider', 'Members': [], 'Tags': ['NotCreatable'] },
    { 'Name': 'Workspace', 'Superclass': 'Instance', 'Members': [], 'Tags': ['NotCreatable', 'Service'] },
    {
      'Name': 'NewService',
      'Superclass': 'Instance',
      'Members': [],
      'Tags': ['NotCreatable', 'Service'],
    },
    {
      'Name': 'NewPart',
      'Superclass': 'Instance',
      'Members': [
        {
          'MemberType': 'Function',
          'Name': 'Launch',
          'Parameters': [],
          'ReturnType': { 'Name': 'void', 'Category': 'Primitive' },
        },
      ],
    },
    { 'Name': 'HiddenBase', 'Superclass': 'Instance', 'Members': [], 'Tags': ['NotCreatable'] },
  ],
  'Enums': [],
};

const launchDocumentation = 'Launches the fixture part into the sky.';
const getServiceDocumentation = 'Returns the fixture service with the requested class name.';

const fixtureDocs: DocsDatabase = {
  '@roblox/globaltype/NewPart.Launch': {
    'documentation': launchDocumentation,
    'learn_more_link': 'https://example.invalid/NewPart#Launch',
    'code_sample': '',
  },
  '@roblox/globaltype/ServiceProvider.GetService': {
    'documentation': getServiceDocumentation,
    'learn_more_link': 'https://example.invalid/ServiceProvider#GetService',
    'code_sample': '',
  },
};

const clientToServer = new PassThrough();
const serverToClient = new PassThrough();
const serverConnection = createConnection(
  new StreamMessageReader(clientToServer),
  new StreamMessageWriter(serverToClient),
);
const client: MessageConnection = createMessageConnection(
  new StreamMessageReader(serverToClient),
  new StreamMessageWriter(clientToServer),
);

const documents = new TextDocuments(TextDocument);
const documentManager = createDocumentManager({
  'roblox': fixtureApi,
  'sunc': undefined,
  'robloxDocs': docsSource(fixtureDocs),
  'luauDocs': docsSource({}),
});
const executorBridge = createExecutorBridge(() => undefined);

documents.onDidChangeContent(change => void documentManager.parseDocument(change.document));

let documentCount = 0;

const openDocument = async (text: string): Promise<string> => {
  documentCount += 1;
  const uri = `file:///completion-catalogue-${documentCount}.luau`;
  await client.sendNotification(DidOpenTextDocumentNotification.type, {
    'textDocument': { uri, 'languageId': 'luau', 'version': 1, text },
  });
  return uri;
};

const completeAt = async (uri: string, position: Position): Promise<ReadonlyArray<CompletionItem>> => {
  const result: CompletionItem[] | CompletionList | null = await client.sendRequest(CompletionRequest.type, {
    'textDocument': { uri },
    position,
  });
  if (result === null) return [];

  return Array.isArray(result) ? result : result.items;
};

const completeEndOf = async (text: string): Promise<ReadonlyArray<string>> => {
  const uri = await openDocument(text);
  const items = await completeAt(uri, { 'line': 0, 'character': text.length });
  return items.map(item => item.label);
};

beforeAll(async () => {
  setupCompletionHandler(serverConnection, documents, documentManager, executorBridge);
  setupHoverHandler(serverConnection, documentManager, executorBridge);
  documents.listen(serverConnection);
  serverConnection.listen();
  client.listen();
  await client.sendRequest(InitializeRequest.type, {
    'processId': null,
    'rootUri': null,
    'capabilities': {},
    'workspaceFolders': null,
  });
  await client.sendNotification(InitializedNotification.type, {});
});

afterAll(() => {
  client.dispose();
  serverConnection.dispose();
  clientToServer.end();
  serverToClient.end();
});

describe('Completion catalogues derived from the loaded Roblox API', () => {
  test('exposes fixture services and creatable classes on the global environment', () => {
    expect(documentManager.globalEnv.serviceNames).toEqual(['Workspace', 'NewService']);
    expect(documentManager.globalEnv.creatableClasses).toEqual(['NewPart']);
  });

  test('suggests fixture services inside a GetService string', async () => {
    const labels = await completeEndOf('local service = game:GetService("New');
    expect(labels).toEqual(['NewService']);
  });

  test('suggests every fixture service for an empty GetService string in upstream order', async () => {
    const labels = await completeEndOf('local service = game:GetService("');
    expect(labels).toEqual(['Workspace', 'NewService']);
  });

  test('suggests only creatable fixture classes inside an Instance.new string', async () => {
    const labels = await completeEndOf('local part = Instance.new("');
    expect(labels).toEqual(['NewPart']);
    expect(labels.includes('HiddenBase')).toBe(false);
    expect(labels.includes('NewService')).toBe(false);
  });

  test('resolves fixture documentation for a member completion of a created instance', async () => {
    const text = 'local part = Instance.new("NewPart")\npart:';
    const uri = await openDocument(text);
    const items = await completeAt(uri, { 'line': 1, 'character': 5 });
    const launch = items.find(item => item.label === 'Launch');
    expect(launch).toBeDefined();
    if (launch === undefined) return;

    expect(launch.data).toEqual({ 'resolve': 'member', 'class': 'NewPart', 'member': 'Launch' });

    const resolved = await client.sendRequest(CompletionResolveRequest.type, launch);
    const documentation = resolved.documentation;
    expect(MarkupContent.is(documentation)).toBe(true);
    expect(MarkupContent.is(documentation) ? documentation.value : '').toContain(launchDocumentation);
  });

  test('shows fixture documentation when hovering an inherited member of a global instance', async () => {
    const uri = await openDocument('local service = game:GetService("NewService")');
    const hover = await client.sendRequest(HoverRequest.type, {
      'textDocument': { uri },
      'position': { 'line': 0, 'character': 24 },
    });
    expect(hover !== null && MarkupContent.is(hover.contents) ? hover.contents.value : '').toContain(
      getServiceDocumentation,
    );
  });
});
