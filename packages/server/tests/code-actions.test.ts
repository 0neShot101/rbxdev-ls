import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { CodeActionKind } from 'vscode-languageserver';
import { createDocumentManager } from '@lsp/documents';
import { setupCodeActionHandler } from '@lsp/handlers/codeAction';
import { expectDefined } from '@tests/helpers/expect';
import { createLspHarness } from '@tests/helpers/lsp';
import type { CodeAction, Diagnostic, Range, TextEdit } from 'vscode-languageserver';

const documentManager = createDocumentManager({ 'roblox': undefined, 'sunc': undefined });
const harness = createLspHarness(documentManager);
setupCodeActionHandler(harness.connection, harness.documents, documentManager);

beforeAll(() => harness.start());
afterAll(() => harness.dispose());

const rangeOf = (line: number, start: number, end = start): Range => ({
  'start': { line, 'character': start },
  'end': { line, 'character': end },
});

const diagnosticOf = (message: string, range: Range): Diagnostic => ({ range, message, 'source': 'rbxdev-ls' });

const requestActions = async (
  text: string,
  range: Range,
  diagnostics: Diagnostic[] = [],
): Promise<{ uri: string; actions: ReadonlyArray<CodeAction> }> => {
  const uri = await harness.open(text);
  const actions = await harness.codeActions({ 'textDocument': { uri }, range, 'context': { diagnostics } });
  return { uri, actions };
};

const editsFor = (actions: ReadonlyArray<CodeAction>, title: string, uri: string): ReadonlyArray<TextEdit> =>
  expectDefined(expectDefined(actions.find(action => action.title === title)).edit?.changes?.[uri]);

describe('Code Actions', () => {
  describe('Deprecation Replacements', () =>
    test.each([
      ['children', 'GetChildren'],
      ['findFirstChild', 'FindFirstChild'],
      ['destroy', 'Destroy'],
      ['remove', 'Destroy'],
      ['connect', 'Connect'],
      ['clone', 'Clone'],
      ['isA', 'IsA'],
    ])('replaces deprecated %s with %s', async (name, replacement) => {
      const range = rangeOf(0, 5, 5 + name.length);
      const diagnostic = diagnosticOf(`'${name}' is deprecated`, range);
      const { actions } = await requestActions(`part:${name}()`, rangeOf(0, 5), [diagnostic]);
      const action = expectDefined(
        actions.find(candidate => candidate.title === `Replace '${name}' with '${replacement}'`),
      );
      expect(action.kind).toBe(CodeActionKind.QuickFix);
      expect(action.isPreferred).toBe(true);
      expect(action.diagnostics).toEqual([diagnostic]);
    }));

  describe('Deprecation Message Parsing', () => {
    test('offers the suggestion named in a "Use ... instead" message', async () => {
      const range = rangeOf(0, 5, 12);
      const diagnostic = diagnosticOf("'getKids' is deprecated. Use 'GetChildren' instead", range);
      const { uri, actions } = await requestActions('part:getKids()', rangeOf(0, 5), [diagnostic]);
      expect(editsFor(actions, "Replace with 'GetChildren'", uri)).toEqual([{ range, 'newText': 'GetChildren' }]);
    });

    test('ignores deprecation messages from other sources', async () => {
      const diagnostic: Diagnostic = {
        'range': rangeOf(0, 5, 13),
        'message': "'children' is deprecated",
        'source': 'other',
      };
      const { actions } = await requestActions('part:children()', rangeOf(0, 5), [diagnostic]);
      expect(actions.some(action => action.title.startsWith('Replace'))).toBe(false);
    });
  });

  describe('Unknown Identifier Fix', () =>
    test('declares the unknown identifier above its line with matching indentation', async () => {
      const diagnostic = diagnosticOf("Unknown identifier 'myVar'", rangeOf(1, 7, 12));
      const { uri, actions } = await requestActions('do\n\tprint(myVar)\nend', rangeOf(1, 7), [diagnostic]);
      expect(editsFor(actions, "Add 'local myVar = nil' above", uri)).toEqual([
        { 'range': rangeOf(1, 0), 'newText': '\tlocal myVar = nil\n' },
      ]);
    }));

  describe('Unused Variable Prefix', () => {
    test('prefixes an unused variable with an underscore', async () => {
      const range = rangeOf(0, 6, 11);
      const { uri, actions } = await requestActions('local myVar = 1', rangeOf(0, 6), [
        diagnosticOf("'myVar' is unused", range),
      ]);
      expect(editsFor(actions, "Prefix 'myVar' with '_'", uri)).toEqual([{ range, 'newText': '_myVar' }]);
    });

    test('does not prefix an already-prefixed variable', async () => {
      const diagnostic = diagnosticOf("'_unused' is unused", rangeOf(0, 6, 13));
      const { actions } = await requestActions('local _unused = 1', rangeOf(0, 6), [diagnostic]);
      expect(actions.some(action => action.title.startsWith('Prefix'))).toBe(false);
    });
  });

  describe('String Quote Conversion', () =>
    test.each([
      ['local x = "hello"', 'Convert to single quotes', "'hello'"],
      ["local x = 'hello'", 'Convert to double quotes', '"hello"'],
      ['local x = "it\'s"', 'Convert to single quotes', "'it\\'s'"],
    ])('%s offers "%s"', async (text, title, newText) => {
      const { uri, actions } = await requestActions(text, rangeOf(0, 12));
      expect(editsFor(actions, title, uri)).toEqual([{ 'range': rangeOf(0, 10, text.length), newText }]);
    }));

  describe('Add Type Annotation', () => {
    test('annotates an unannotated local with its inferred type', async () => {
      const { uri, actions } = await requestActions('local x = 42', rangeOf(0, 6));
      expect(editsFor(actions, 'Add type annotation: number', uri)).toEqual([
        { 'range': rangeOf(0, 7), 'newText': ': number' },
      ]);
    });

    test('does not annotate an already annotated local', async () => {
      const { actions } = await requestActions('local x: number = 42', rangeOf(0, 6));
      expect(actions.some(action => action.title.startsWith('Add type annotation'))).toBe(false);
    });
  });

  describe('Extract to Local Variable', () =>
    test('extracts the selection into a local above the current line', async () => {
      const selection = rangeOf(0, 15, 30);
      const { uri, actions } = await requestActions('local result = someFunc(a + b)', selection);
      expect(editsFor(actions, 'Extract to local variable', uri)).toEqual([
        { 'range': rangeOf(0, 0), 'newText': 'local extracted = someFunc(a + b)\n' },
        { 'range': selection, 'newText': 'extracted' },
      ]);
    }));
});
