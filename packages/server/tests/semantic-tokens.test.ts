import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { SemanticTokenModifiers, SemanticTokenTypes } from 'vscode-languageserver';
import { createDocumentManager } from '@lsp/documents';
import { collectSemanticTokens, semanticTokensLegend, setupSemanticTokensHandler } from '@lsp/handlers/semanticTokens';
import { parse } from '@parser/parser';
import { expectDefined } from '@tests/helpers/expect';
import { createLspHarness } from '@tests/helpers/lsp';
import type { TokenInfo } from '@typings/handlers';

const typeIndex = (name: string): number => semanticTokensLegend.tokenTypes.indexOf(name);
const modifierBit = (name: string): number => 1 << semanticTokensLegend.tokenModifiers.indexOf(name);

const typeToken = typeIndex(SemanticTokenTypes.type);
const functionToken = typeIndex(SemanticTokenTypes.function);
const methodToken = typeIndex(SemanticTokenTypes.method);
const parameterToken = typeIndex(SemanticTokenTypes.parameter);
const variableToken = typeIndex(SemanticTokenTypes.variable);
const propertyToken = typeIndex(SemanticTokenTypes.property);
const declarationBit = modifierBit(SemanticTokenModifiers.declaration);
const defaultLibraryBit = modifierBit(SemanticTokenModifiers.defaultLibrary);

const tokensOf = (code: string): TokenInfo[] => collectSemanticTokens(parse(code).ast);

const hasModifier = (token: TokenInfo, bit: number): boolean => (token.modifiers & bit) !== 0;

const documentManager = createDocumentManager({ 'roblox': undefined, 'sunc': undefined });
const harness = createLspHarness(documentManager);
setupSemanticTokensHandler(harness.connection, documentManager);

beforeAll(() => harness.start());
afterAll(() => harness.dispose());

const requestedLines = async (code: string, startLine: number, endLine: number): Promise<number[]> => {
  const uri = await harness.open(code);
  const data = await harness.semanticTokensRange(uri, {
    'start': { 'line': startLine, 'character': 0 },
    'end': { 'line': endLine, 'character': 0 },
  });
  const lines: number[] = [];
  let line = 0;
  for (let i = 0; i < data.length; i += 5) {
    line += data[i] ?? 0;
    lines.push(line);
  }
  return lines;
};

describe('Semantic Tokens', () => {
  describe('Token Classification', () => {
    test('classifies local variables as variable type', () => {
      const token = expectDefined(tokensOf('local myVar = 42').find(t => t.character === 6));
      expect(token.tokenType).toBe(variableToken);
      expect(hasModifier(token, declarationBit)).toBe(true);
    });

    test('classifies local functions as function type', () => {
      const tokens = tokensOf('local function myFunc() end');
      const token = expectDefined(tokens.find(t => t.tokenType === functionToken && t.character === 15));
      expect(hasModifier(token, declarationBit)).toBe(true);
    });

    test('classifies function parameters as parameter type', () =>
      expect(tokensOf('local function foo(x, y) end').filter(t => t.tokenType === parameterToken).length).toBe(2));

    test('classifies member access as property type', () =>
      expect(tokensOf('local x = obj.field').some(t => t.tokenType === propertyToken)).toBe(true));

    test('classifies method call as method type', () =>
      expect(tokensOf('obj:doSomething()').some(t => t.tokenType === methodToken)).toBe(true));

    test('classifies type alias name as type', () => {
      const token = expectDefined(tokensOf('type MyType = number').find(t => t.tokenType === typeToken));
      expect(hasModifier(token, declarationBit)).toBe(true);
    });

    test('classifies function calls as function type', () =>
      expect(tokensOf('print("hello")').some(t => t.tokenType === functionToken)).toBe(true));
  });

  describe('Builtin Globals', () => {
    test('marks print as defaultLibrary', () => {
      const token = expectDefined(tokensOf('print("test")').find(t => t.character === 0 && t.line === 0));
      expect(hasModifier(token, defaultLibraryBit)).toBe(true);
    });

    test('marks warn as defaultLibrary', () =>
      expect(
        tokensOf('warn("test")').some(t => hasModifier(t, defaultLibraryBit) && t.tokenType === functionToken),
      ).toBe(true));
  });

  describe('Range Filtering', () => {
    test('filters tokens to requested line range', async () => {
      const code = 'local a = 1\nlocal b = 2\nlocal c = 3\nlocal d = 4';
      const lines = await requestedLines(code, 1, 2);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every(line => line >= 1 && line <= 2)).toBe(true);
      expect(lines.length).toBeLessThan(tokensOf(code).length);
    });

    test('returns empty for out-of-range request', async () =>
      expect(await requestedLines('local x = 1', 100, 200)).toEqual([]));
  });
});
