import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { CompletionItemKind, CompletionItemTag, InsertTextFormat } from 'vscode-languageserver';
import { createExecutorBridge } from '@executor/server';
import { createDocumentManager } from '@lsp/documents';
import { setupCompletionHandler } from '@lsp/handlers/completion';
import { expectDefined } from '@tests/helpers/expect';
import { createLspHarness } from '@tests/helpers/lsp';
import type { CompletionList } from 'vscode-languageserver';

const documentManager = createDocumentManager();
const harness = createLspHarness(documentManager);
setupCompletionHandler(
  harness.connection,
  harness.documents,
  documentManager,
  createExecutorBridge(() => undefined),
);

beforeAll(() => harness.start());
afterAll(() => harness.dispose());

const complete = async (code: string, line: number, character: number): Promise<CompletionList> =>
  harness.complete(await harness.open(code), { line, character });

describe('Completion Handler - global completions', () => {
  test('completes print with Function kind and call snippet for prefix "pri"', async () => {
    const list = await complete('pri', 0, 3);
    expect(list.isIncomplete).toBe(true);
    const print = expectDefined(list.items.find(i => i.label === 'print'));
    expect(print.kind).toBe(CompletionItemKind.Function);
    expect(print.insertText).toBe('print(${1:arg})');
    expect(print.insertTextFormat).toBe(InsertTextFormat.Snippet);
  });

  test('filters globals by prefix', async () => {
    const list = await complete('pri', 0, 3);
    expect(list.items.some(i => i.label === 'game')).toBe(false);
    expect(list.items.some(i => i.label === 'pairs')).toBe(false);
    expect(list.items.every(i => i.label.toLowerCase().startsWith('pri'))).toBe(true);
  });

  test('offers well-known globals with correct kinds in statement context', async () => {
    const list = await complete('local x = 1\n', 1, 0);
    const game = expectDefined(list.items.find(i => i.label === 'game'));
    expect(game.kind).toBe(CompletionItemKind.Class);
    const workspace = expectDefined(list.items.find(i => i.label === 'workspace'));
    expect(workspace.kind).toBe(CompletionItemKind.Class);
    const pairs = expectDefined(list.items.find(i => i.label === 'pairs'));
    expect(pairs.kind).toBe(CompletionItemKind.Function);
    const enumGlobal = expectDefined(list.items.find(i => i.label === 'Enum'));
    expect(enumGlobal.kind).toBe(CompletionItemKind.Module);
  });

  test('tags global items with resolve data for completionItem/resolve', async () => {
    const list = await complete('pri', 0, 3);
    const print = expectDefined(list.items.find(i => i.label === 'print'));
    expect(print.data).toEqual({ 'resolve': 'global', 'name': 'print' });
  });
});

describe('Completion Handler - member access on game', () => {
  test('completes services and methods after "game."', async () => {
    const list = await complete('game.', 0, 5);
    expect(list.isIncomplete).toBe(true);
    const workspace = expectDefined(list.items.find(i => i.label === 'Workspace'));
    expect(workspace.kind).toBe(CompletionItemKind.Class);
    const players = expectDefined(list.items.find(i => i.label === 'Players'));
    expect(players.kind).toBe(CompletionItemKind.Class);
    const name = expectDefined(list.items.find(i => i.label === 'Name'));
    expect(name.kind).toBe(CompletionItemKind.Variable);
    const getService = expectDefined(list.items.find(i => i.label === 'GetService'));
    expect(getService.kind).toBe(CompletionItemKind.Method);
    expect(getService.insertText).toBe('GetService(${1:className})');
  });

  test('completes methods after "game:" but does not exclude properties', async () => {
    const list = await complete('game:', 0, 5);
    const getService = expectDefined(list.items.find(i => i.label === 'GetService'));
    expect(getService.kind).toBe(CompletionItemKind.Method);
    expect(getService.detail).toBe('(className)');
    const workspace = expectDefined(list.items.find(i => i.label === 'Workspace'));
    expect(workspace.kind).toBe(CompletionItemKind.Class);
    const name = list.items.find(i => i.label === 'Name');
    expect(name).toBeDefined();
  });

  test('tags class member items with resolve data for docs lookup', async () => {
    const list = await complete('game.', 0, 5);
    const getService = expectDefined(list.items.find(i => i.label === 'GetService'));
    expect(getService.data).toEqual({ 'resolve': 'member', 'class': 'ServiceProvider', 'member': 'GetService' });
    const name = expectDefined(list.items.find(i => i.label === 'Name'));
    expect(name.data).toEqual({ 'resolve': 'member', 'class': 'Instance', 'member': 'Name' });
  });

  test('filters members by prefix after "game:" and marks deprecated aliases', async () => {
    const list = await complete('game:GetS', 0, 9);
    expect(list.items.every(i => i.label.toLowerCase().startsWith('gets'))).toBe(true);
    const getService = list.items.find(i => i.label === 'GetService');
    expect(getService).toBeDefined();
    const deprecated = expectDefined(list.items.find(i => i.label === 'getService'));
    expect(deprecated.tags).toEqual([CompletionItemTag.Deprecated]);
    expect(deprecated.detail).toBe("(deprecated) Use 'GetService' instead.");
  });
});

describe('Completion Handler - typed locals', () => {
  test('resolves a local assigned from game.Players and completes its members', async () => {
    const list = await complete('local players = game.Players\nplayers.', 1, 8);
    const localPlayer = expectDefined(list.items.find(i => i.label === 'LocalPlayer'));
    expect(localPlayer.kind).toBe(CompletionItemKind.Variable);
    const playerAdded = list.items.find(i => i.label === 'PlayerAdded');
    expect(playerAdded).toBeDefined();
    const getPlayers = expectDefined(list.items.find(i => i.label === 'GetPlayers'));
    expect(getPlayers.kind).toBe(CompletionItemKind.Method);
    expect(getPlayers.insertText).toBe('GetPlayers()$0');
  });

  test('resolves a local assigned from game:GetService and completes via colon', async () => {
    const list = await complete('local players = game:GetService("Players")\nplayers:', 1, 8);
    const getPlayers = expectDefined(list.items.find(i => i.label === 'GetPlayers'));
    expect(getPlayers.kind).toBe(CompletionItemKind.Method);
    const inherited = expectDefined(list.items.find(i => i.label === 'FindFirstChild'));
    expect(inherited.kind).toBe(CompletionItemKind.Method);
  });
});

describe('Completion Handler - local symbols', () => {
  test('completes local variables in scope', async () => {
    const list = await complete('local myCount = 5\nmy', 1, 2);
    const myCount = expectDefined(list.items.find(i => i.label === 'myCount'));
    expect(myCount.kind).toBe(CompletionItemKind.Variable);
    expect(myCount.sortText).toBe('0myCount');
  });

  test('completes function parameters inside the function body', async () => {
    const list = await complete('local function addScore(amount)\n  amo\nend', 1, 5);
    const amount = expectDefined(list.items.find(i => i.label === 'amount'));
    expect(amount.kind).toBe(CompletionItemKind.Variable);
  });
});

describe('Completion Handler - keyword snippets', () =>
  test('offers for-loop snippets for prefix "fo"', async () => {
    const list = await complete('fo', 0, 2);
    const forSnippet = expectDefined(list.items.find(i => i.label === 'for'));
    expect(forSnippet.kind).toBe(CompletionItemKind.Snippet);
    expect(forSnippet.insertText).toBe('for ${1:i} = ${2:1}, ${3:10} do\n\t$0\nend');
    expect(forSnippet.insertTextFormat).toBe(InsertTextFormat.Snippet);
    const forIn = expectDefined(list.items.find(i => i.label === 'for in'));
    expect(forIn.sortText).toBe('1_for in');
  }));

describe('Completion Handler - string contexts', () => {
  test('completes service names inside game:GetService string argument', async () => {
    const list = await complete('local p = game:GetService("Pla', 0, 30);
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every(item => item.label.toLowerCase().startsWith('pla'))).toBe(true);
    expect(list.items[0]?.preselect).toBe(true);
    const players = list.items.find(item => item.label === 'Players');
    expect(players).toBeDefined();
    expect(players?.kind).toBe(CompletionItemKind.Class);
    expect(players?.insertText).toBe('Players');
  });

  test('completes enum members after Enum.<name>.', async () => {
    const list = await complete('Enum.KeyCode.', 0, 13);
    const space = expectDefined(list.items.find(i => i.label === 'Space'));
    expect(space.kind).toBe(CompletionItemKind.EnumMember);
    expect(space.detail).toBe('Enum.KeyCode');
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
    const print = expectDefined(list.items.find(i => i.label === 'print'));
    expect(print.kind).toBe(CompletionItemKind.Function);
  });

  test('falls back to global completions for dot access on an unknown identifier', async () => {
    const list = await complete('foo.', 0, 4);
    expect(list.isIncomplete).toBe(true);
    expect(list.items.some(i => i.label === 'print')).toBe(true);
    expect(list.items.some(i => i.label === 'game')).toBe(true);
  });
});
