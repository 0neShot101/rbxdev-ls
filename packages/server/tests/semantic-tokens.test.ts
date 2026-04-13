import { parse } from '@parser/parser';
import { walk } from '@parser/visitor';
import { describe, expect, test } from 'bun:test';

import type { Chunk, Identifier } from '@typings/ast';
import type { TokenInfo } from '@typings/handlers';

const TOKEN_TYPE_TYPE = 1;
const TOKEN_TYPE_CLASS = 2;
const TOKEN_TYPE_ENUM = 3;
const TOKEN_TYPE_FUNCTION = 5;
const TOKEN_TYPE_METHOD = 6;
const TOKEN_TYPE_PARAMETER = 7;
const TOKEN_TYPE_VARIABLE = 8;
const TOKEN_TYPE_PROPERTY = 9;

const MOD_DECLARATION = 1 << 0;
const MOD_DEFAULT_LIBRARY = 1 << 6;

const BUILTIN_GLOBALS = new Set([
  'print',
  'warn',
  'error',
  'assert',
  'type',
  'typeof',
  'tostring',
  'tonumber',
  'select',
  'next',
  'pairs',
  'ipairs',
  'rawget',
  'rawset',
  'rawequal',
  'rawlen',
  'setmetatable',
  'getmetatable',
  'pcall',
  'xpcall',
  'require',
  'loadstring',
  'newproxy',
  'unpack',
  'gcinfo',
  'collectgarbage',
  'game',
  'workspace',
  'script',
  'plugin',
  'shared',
  '_G',
  'Enum',
  'Instance',
  'Vector3',
  'Vector2',
  'CFrame',
  'Color3',
  'UDim',
  'UDim2',
  'Rect',
  'Ray',
  'BrickColor',
  'TweenInfo',
  'NumberRange',
  'NumberSequence',
  'ColorSequence',
  'Region3',
  'Axes',
  'Faces',
  'PhysicalProperties',
  'Random',
  'DateTime',
  'task',
  'debug',
  'math',
  'string',
  'table',
  'coroutine',
  'bit32',
  'utf8',
  'buffer',
  'os',
  'tick',
  'time',
  'elapsedTime',
  'wait',
  'delay',
  'spawn',
]);

const ROBLOX_CLASSES = new Set(['Instance', 'Part', 'Model', 'Humanoid', 'Player', 'Players', 'Workspace']);

const collectSemanticTokens = (chunk: Chunk): TokenInfo[] => {
  const tokens: TokenInfo[] = [];
  const parameterNames = new Set<string>();
  const localVariables = new Set<string>();
  const localFunctions = new Set<string>();

  const addToken = (
    node: { range: { start: { line: number; column: number } } },
    length: number,
    tokenType: number,
    modifiers = 0,
  ) => {
    tokens.push({
      'line': node.range.start.line - 1,
      'character': node.range.start.column - 1,
      length,
      tokenType,
      modifiers,
    });
  };

  const classifyIdentifier = (ident: Identifier, isDeclaration: boolean): void => {
    const name = ident.name;
    let tokenType = TOKEN_TYPE_VARIABLE;
    let modifiers = isDeclaration ? MOD_DECLARATION : 0;

    if (parameterNames.has(name)) {
      tokenType = TOKEN_TYPE_PARAMETER;
    } else if (localFunctions.has(name)) {
      tokenType = TOKEN_TYPE_FUNCTION;
    } else if (BUILTIN_GLOBALS.has(name)) {
      tokenType = TOKEN_TYPE_VARIABLE;
      modifiers |= MOD_DEFAULT_LIBRARY;
    } else if (ROBLOX_CLASSES.has(name)) {
      tokenType = TOKEN_TYPE_CLASS;
      modifiers |= MOD_DEFAULT_LIBRARY;
    } else if (name === 'Enum') {
      tokenType = TOKEN_TYPE_ENUM;
      modifiers |= MOD_DEFAULT_LIBRARY;
    }

    addToken(ident, name.length, tokenType, modifiers);
  };

  walk(chunk, {
    'visitLocalDeclaration': node => {
      for (const name of node.names) {
        localVariables.add(name.name);
        classifyIdentifier(name, true);
      }
    },
    'visitLocalFunction': node => {
      localFunctions.add(node.name.name);
      addToken(node.name, node.name.name.length, TOKEN_TYPE_FUNCTION, MOD_DECLARATION);
      for (const param of node.func.params) {
        if (param.name !== undefined) {
          parameterNames.add(param.name.name);
          addToken(param.name, param.name.name.length, TOKEN_TYPE_PARAMETER, MOD_DECLARATION);
        }
      }
    },
    'visitFunctionDeclaration': node => {
      addToken(node.name.base, node.name.base.name.length, TOKEN_TYPE_FUNCTION, MOD_DECLARATION);
      for (const part of node.name.path) addToken(part, part.name.length, TOKEN_TYPE_PROPERTY);
      if (node.name.method !== undefined)
        addToken(node.name.method, node.name.method.name.length, TOKEN_TYPE_METHOD, MOD_DECLARATION);
      for (const param of node.func.params) {
        if (param.name !== undefined) {
          parameterNames.add(param.name.name);
          addToken(param.name, param.name.name.length, TOKEN_TYPE_PARAMETER, MOD_DECLARATION);
        }
      }
    },
    'visitTypeAlias': node => {
      addToken(node.name, node.name.name.length, TOKEN_TYPE_TYPE, MOD_DECLARATION);
    },
    'visitMemberExpression': node => {
      addToken(node.property, node.property.name.length, TOKEN_TYPE_PROPERTY);
    },
    'visitMethodCallExpression': node => {
      addToken(node.method, node.method.name.length, TOKEN_TYPE_METHOD);
    },
    'visitCallExpression': node => {
      if (node.callee.kind === 'Identifier') {
        let modifiers = 0;
        if (BUILTIN_GLOBALS.has(node.callee.name)) modifiers |= MOD_DEFAULT_LIBRARY;
        addToken(node.callee, node.callee.name.length, TOKEN_TYPE_FUNCTION, modifiers);
      }
    },
    'visitTypeReference': node => {
      if (ROBLOX_CLASSES.has(node.name)) {
        tokens.push({
          'line': node.range.start.line - 1,
          'character': node.range.start.column - 1,
          'length': node.name.length,
          'tokenType': TOKEN_TYPE_CLASS,
          'modifiers': MOD_DEFAULT_LIBRARY,
        });
      } else {
        tokens.push({
          'line': node.range.start.line - 1,
          'character': node.range.start.column - 1,
          'length': node.name.length,
          'tokenType': TOKEN_TYPE_TYPE,
          'modifiers': 0,
        });
      }
    },
  });

  return tokens;
};

describe('Semantic Tokens', () => {
  describe('Token Classification', () => {
    test('classifies local variables as variable type', () => {
      const result = parse('local myVar = 42');
      const tokens = collectSemanticTokens(result.ast);

      const varToken = tokens.find(t => t.character === 6);
      expect(varToken).toBeDefined();
      expect(varToken!.tokenType).toBe(TOKEN_TYPE_VARIABLE);
      expect(varToken!.modifiers & MOD_DECLARATION).toBeTruthy();
    });

    test('classifies local functions as function type', () => {
      const result = parse('local function myFunc() end');
      const tokens = collectSemanticTokens(result.ast);

      const funcToken = tokens.find(t => t.tokenType === TOKEN_TYPE_FUNCTION && t.character === 15);
      expect(funcToken).toBeDefined();
      expect(funcToken!.modifiers & MOD_DECLARATION).toBeTruthy();
    });

    test('classifies function parameters as parameter type', () => {
      const result = parse('local function foo(x, y) end');
      const tokens = collectSemanticTokens(result.ast);

      const paramTokens = tokens.filter(t => t.tokenType === TOKEN_TYPE_PARAMETER);
      expect(paramTokens.length).toBe(2);
    });

    test('classifies member access as property type', () => {
      const result = parse('local x = obj.field');
      const tokens = collectSemanticTokens(result.ast);

      const propToken = tokens.find(t => t.tokenType === TOKEN_TYPE_PROPERTY);
      expect(propToken).toBeDefined();
    });

    test('classifies method call as method type', () => {
      const result = parse('obj:doSomething()');
      const tokens = collectSemanticTokens(result.ast);

      const methodToken = tokens.find(t => t.tokenType === TOKEN_TYPE_METHOD);
      expect(methodToken).toBeDefined();
    });

    test('classifies type alias name as type', () => {
      const result = parse('type MyType = number');
      const tokens = collectSemanticTokens(result.ast);

      const typeToken = tokens.find(t => t.tokenType === TOKEN_TYPE_TYPE);
      expect(typeToken).toBeDefined();
      expect(typeToken!.modifiers & MOD_DECLARATION).toBeTruthy();
    });

    test('classifies function calls as function type', () => {
      const result = parse('print("hello")');
      const tokens = collectSemanticTokens(result.ast);

      const callToken = tokens.find(t => t.tokenType === TOKEN_TYPE_FUNCTION);
      expect(callToken).toBeDefined();
    });
  });

  describe('Builtin Globals', () => {
    test('marks print as defaultLibrary', () => {
      const result = parse('print("test")');
      const tokens = collectSemanticTokens(result.ast);

      const printToken = tokens.find(t => t.character === 0 && t.line === 0);
      expect(printToken).toBeDefined();
      expect(printToken!.modifiers & MOD_DEFAULT_LIBRARY).toBeTruthy();
    });

    test('marks warn as defaultLibrary', () => {
      const result = parse('warn("test")');
      const tokens = collectSemanticTokens(result.ast);

      const warnToken = tokens.find(
        t => (t.modifiers & MOD_DEFAULT_LIBRARY) !== 0 && t.tokenType === TOKEN_TYPE_FUNCTION,
      );
      expect(warnToken).toBeDefined();
    });
  });

  describe('Range Filtering', () => {
    test('filters tokens to requested line range', () => {
      const code = 'local a = 1\nlocal b = 2\nlocal c = 3\nlocal d = 4';
      const result = parse(code);
      const allTokens = collectSemanticTokens(result.ast);

      const filtered = allTokens.filter(t => t.line >= 1 && t.line <= 2);

      for (const token of filtered) {
        expect(token.line).toBeGreaterThanOrEqual(1);
        expect(token.line).toBeLessThanOrEqual(2);
      }

      expect(filtered.length).toBeLessThan(allTokens.length);
    });

    test('returns empty for out-of-range request', () => {
      const result = parse('local x = 1');
      const allTokens = collectSemanticTokens(result.ast);

      const filtered = allTokens.filter(t => t.line >= 100 && t.line <= 200);
      expect(filtered.length).toBe(0);
    });
  });
});
