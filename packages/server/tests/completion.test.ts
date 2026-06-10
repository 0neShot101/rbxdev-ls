import { createDocumentManager } from '@lsp/documents';
import { setupCompletionHandler } from '@lsp/handlers/completion';
import { describe, expect, test } from 'bun:test';
import { CompletionItemKind, CompletionItemTag, InsertTextFormat } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import type { ExecutorBridge, LiveGameModel } from '@typings/bridge';
import type {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Connection,
  Disposable,
  TextDocuments,
} from 'vscode-languageserver';

const liveGameModel: LiveGameModel = {
  'isConnected': false,
  'lastUpdate': 0,
  'services': new Map(),
  'getNode': () => undefined,
  'getChildren': () => undefined,
};

const executorBridgeStub: Pick<ExecutorBridge, 'isConnected' | 'liveGameModel' | 'execute' | 'requestModuleInterface'> =
  {
    'isConnected': false,
    liveGameModel,
    'execute': () => Promise.resolve({ 'success': false }),
    'requestModuleInterface': () => Promise.resolve({ 'success': false }),
  };
const executorBridge = executorBridgeStub as ExecutorBridge;

const openDocs = new Map<string, TextDocument>();
const documentsStub: Pick<TextDocuments<TextDocument>, 'get'> = {
  'get': (uri: string): TextDocument | undefined => openDocs.get(uri),
};
const documents = documentsStub as TextDocuments<TextDocument>;

const disposable: Disposable = { 'dispose': (): void => undefined };

let onCompletion: ((params: CompletionParams) => Promise<CompletionList>) | undefined;
const connectionStub: {
  console: { log: (message: string) => void };
  onCompletion: (handler: (params: CompletionParams) => Promise<CompletionList>) => Disposable;
  onCompletionResolve: (handler: (item: CompletionItem) => CompletionItem) => Disposable;
} = {
  'console': { 'log': (): void => undefined },
  'onCompletion': handler => {
    onCompletion = handler;
    return disposable;
  },
  'onCompletionResolve': () => disposable,
};
const connection = connectionStub as Connection;

const documentManager = createDocumentManager();
setupCompletionHandler(connection, documents, documentManager, executorBridge);

let docCount = 0;

const complete = async (code: string, line: number, character: number): Promise<CompletionList> => {
  const uri = `file:///completion-test-${docCount++}.luau`;
  const doc = TextDocument.create(uri, 'luau', 1, code);
  openDocs.set(uri, doc);
  documentManager.parseDocument(doc);
  expect(onCompletion).toBeDefined();
  return onCompletion!({ 'textDocument': { uri }, 'position': { line, character } });
};

describe('Completion Handler - global completions', () => {
  test('completes print with Function kind and call snippet for prefix "pri"', async () => {
    const list = await complete('pri', 0, 3);
    expect(list.isIncomplete).toBe(true);
    const print = list.items.find(i => i.label === 'print');
    expect(print).toBeDefined();
    expect(print!.kind).toBe(CompletionItemKind.Function);
    expect(print!.insertText).toBe('print(${1:arg})');
    expect(print!.insertTextFormat).toBe(InsertTextFormat.Snippet);
  });

  test('filters globals by prefix', async () => {
    const list = await complete('pri', 0, 3);
    expect(list.items.some(i => i.label === 'game')).toBe(false);
    expect(list.items.some(i => i.label === 'pairs')).toBe(false);
    expect(list.items.every(i => i.label.toLowerCase().startsWith('pri'))).toBe(true);
  });

  test('offers well-known globals with correct kinds in statement context', async () => {
    const list = await complete('local x = 1\n', 1, 0);
    const game = list.items.find(i => i.label === 'game');
    expect(game).toBeDefined();
    expect(game!.kind).toBe(CompletionItemKind.Class);
    const workspace = list.items.find(i => i.label === 'workspace');
    expect(workspace).toBeDefined();
    expect(workspace!.kind).toBe(CompletionItemKind.Class);
    const pairs = list.items.find(i => i.label === 'pairs');
    expect(pairs).toBeDefined();
    expect(pairs!.kind).toBe(CompletionItemKind.Function);
    const enumGlobal = list.items.find(i => i.label === 'Enum');
    expect(enumGlobal).toBeDefined();
    expect(enumGlobal!.kind).toBe(CompletionItemKind.Module);
  });

  test('tags global items with resolve data for completionItem/resolve', async () => {
    const list = await complete('pri', 0, 3);
    const print = list.items.find(i => i.label === 'print');
    expect(print).toBeDefined();
    expect(print!.data).toEqual({ 'resolve': 'global', 'name': 'print' });
  });
});

describe('Completion Handler - member access on game', () => {
  test('completes services and methods after "game."', async () => {
    const list = await complete('game.', 0, 5);
    expect(list.isIncomplete).toBe(true);
    const workspace = list.items.find(i => i.label === 'Workspace');
    expect(workspace).toBeDefined();
    expect(workspace!.kind).toBe(CompletionItemKind.Class);
    const players = list.items.find(i => i.label === 'Players');
    expect(players).toBeDefined();
    expect(players!.kind).toBe(CompletionItemKind.Class);
    const name = list.items.find(i => i.label === 'Name');
    expect(name).toBeDefined();
    expect(name!.kind).toBe(CompletionItemKind.Variable);
    const getService = list.items.find(i => i.label === 'GetService');
    expect(getService).toBeDefined();
    expect(getService!.kind).toBe(CompletionItemKind.Method);
    expect(getService!.insertText).toBe('GetService(${1:className})');
  });

  test('completes methods after "game:" but does not exclude properties', async () => {
    const list = await complete('game:', 0, 5);
    const getService = list.items.find(i => i.label === 'GetService');
    expect(getService).toBeDefined();
    expect(getService!.kind).toBe(CompletionItemKind.Method);
    expect(getService!.detail).toBe('(className)');
    const workspace = list.items.find(i => i.label === 'Workspace');
    expect(workspace).toBeDefined();
    expect(workspace!.kind).toBe(CompletionItemKind.Class);
    const name = list.items.find(i => i.label === 'Name');
    expect(name).toBeDefined();
  });

  test('filters members by prefix after "game:" and marks deprecated aliases', async () => {
    const list = await complete('game:GetS', 0, 9);
    expect(list.items.every(i => i.label.toLowerCase().startsWith('gets'))).toBe(true);
    const getService = list.items.find(i => i.label === 'GetService');
    expect(getService).toBeDefined();
    const deprecated = list.items.find(i => i.label === 'getService');
    expect(deprecated).toBeDefined();
    expect(deprecated!.tags).toEqual([CompletionItemTag.Deprecated]);
    expect(deprecated!.detail).toBe("(deprecated) Use 'GetService' instead.");
  });
});

describe('Completion Handler - typed locals', () => {
  test('resolves a local assigned from game.Players and completes its members', async () => {
    const list = await complete('local players = game.Players\nplayers.', 1, 8);
    const localPlayer = list.items.find(i => i.label === 'LocalPlayer');
    expect(localPlayer).toBeDefined();
    expect(localPlayer!.kind).toBe(CompletionItemKind.Variable);
    const playerAdded = list.items.find(i => i.label === 'PlayerAdded');
    expect(playerAdded).toBeDefined();
    const getPlayers = list.items.find(i => i.label === 'GetPlayers');
    expect(getPlayers).toBeDefined();
    expect(getPlayers!.kind).toBe(CompletionItemKind.Method);
    expect(getPlayers!.insertText).toBe('GetPlayers()$0');
  });

  test('resolves a local assigned from game:GetService and completes via colon', async () => {
    const list = await complete('local players = game:GetService("Players")\nplayers:', 1, 8);
    const getPlayers = list.items.find(i => i.label === 'GetPlayers');
    expect(getPlayers).toBeDefined();
    expect(getPlayers!.kind).toBe(CompletionItemKind.Method);
    const inherited = list.items.find(i => i.label === 'FindFirstChild');
    expect(inherited).toBeDefined();
    expect(inherited!.kind).toBe(CompletionItemKind.Method);
  });
});

describe('Completion Handler - local symbols', () => {
  test('completes local variables in scope', async () => {
    const list = await complete('local myCount = 5\nmy', 1, 2);
    const myCount = list.items.find(i => i.label === 'myCount');
    expect(myCount).toBeDefined();
    expect(myCount!.kind).toBe(CompletionItemKind.Variable);
    expect(myCount!.sortText).toBe('0myCount');
  });

  test('completes function parameters inside the function body', async () => {
    const list = await complete('local function addScore(amount)\n  amo\nend', 1, 5);
    const amount = list.items.find(i => i.label === 'amount');
    expect(amount).toBeDefined();
    expect(amount!.kind).toBe(CompletionItemKind.Variable);
  });
});

describe('Completion Handler - keyword snippets', () => {
  test('offers for-loop snippets for prefix "fo"', async () => {
    const list = await complete('fo', 0, 2);
    const forSnippet = list.items.find(i => i.label === 'for');
    expect(forSnippet).toBeDefined();
    expect(forSnippet!.kind).toBe(CompletionItemKind.Snippet);
    expect(forSnippet!.insertText).toBe('for ${1:i} = ${2:1}, ${3:10} do\n\t$0\nend');
    expect(forSnippet!.insertTextFormat).toBe(InsertTextFormat.Snippet);
    const forIn = list.items.find(i => i.label === 'for in');
    expect(forIn).toBeDefined();
    expect(forIn!.sortText).toBe('1_for in');
  });
});

describe('Completion Handler - string contexts', () => {
  test('completes service names inside game:GetService string argument', async () => {
    const list = await complete('local p = game:GetService("Pla', 0, 30);
    expect(list.items).toHaveLength(1);
    const players = list.items[0];
    expect(players).toBeDefined();
    expect(players!.label).toBe('Players');
    expect(players!.kind).toBe(CompletionItemKind.Class);
    expect(players!.insertText).toBe('Players');
    expect(players!.preselect).toBe(true);
  });

  test('completes enum members after Enum.<name>.', async () => {
    const list = await complete('Enum.KeyCode.', 0, 13);
    const space = list.items.find(i => i.label === 'Space');
    expect(space).toBeDefined();
    expect(space!.kind).toBe(CompletionItemKind.EnumMember);
    expect(space!.detail).toBe('Enum.KeyCode');
  });
});

describe('Completion Handler - edge cases', () => {
  test('returns globals and snippets at position 0 of an empty document', async () => {
    const list = await complete('', 0, 0);
    expect(list.isIncomplete).toBe(true);
    expect(list.items.some(i => i.label === 'print' && i.kind === CompletionItemKind.Function)).toBe(true);
    expect(list.items.some(i => i.label === 'game' && i.kind === CompletionItemKind.Class)).toBe(true);
    expect(list.items.some(i => i.label === 'function' && i.kind === CompletionItemKind.Snippet)).toBe(true);
  });

  test('returns an empty list inside an ordinary string literal', async () => {
    const list = await complete('print("hel', 0, 10);
    expect(list.items).toHaveLength(0);
  });

  test('still completes globals on a line after an earlier syntax error', async () => {
    const list = await complete('local x = \npri', 1, 3);
    const print = list.items.find(i => i.label === 'print');
    expect(print).toBeDefined();
    expect(print!.kind).toBe(CompletionItemKind.Function);
  });

  test('falls back to global completions for dot access on an unknown identifier', async () => {
    const list = await complete('foo.', 0, 4);
    expect(list.isIncomplete).toBe(true);
    expect(list.items.some(i => i.label === 'print')).toBe(true);
    expect(list.items.some(i => i.label === 'game')).toBe(true);
  });
});
