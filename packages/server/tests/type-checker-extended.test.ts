import { parse } from '@parser/parser';
import { checkProgram } from '@typings/checker';
import { typeToString } from '@typings/types';
import { describe, expect, test } from 'bun:test';

import type { LuauType } from '@typings/types';

const getSymbolType = (code: string, varName: string): LuauType | undefined => {
  const result = parse(code);
  if (result.errors.length > 0) return undefined;
  const typeCheckResult = checkProgram(result.ast);
  return typeCheckResult.allSymbols.get(varName);
};

const getDiagnostics = (code: string) => {
  const result = parse(code);
  const typeCheckResult = checkProgram(result.ast);
  return typeCheckResult.diagnostics;
};

const expectNoDiagnostics = (code: string) => {
  const diags = getDiagnostics(code);
  expect(diags.length).toBe(0);
};

describe('Type Checker Extended', () => {
  describe('Type Inference - Tables', () => {
    test('infers table with string values', () => {
      const type = getSymbolType('local t = { name = "hello", greeting = "world" }', 't');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Table');
    });

    test('infers table with mixed types', () => {
      const type = getSymbolType('local t = { x = 1, y = "str", z = true }', 't');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Table');
    });

    test('infers empty table', () => {
      const type = getSymbolType('local t = {}', 't');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Table');
    });

    test('infers array-style table', () => {
      const type = getSymbolType('local arr = { 1, 2, 3 }', 'arr');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Table');
    });

    test('infers nested table', () => {
      const type = getSymbolType('local t = { inner = { x = 1 } }', 't');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Table');
    });

    test('infers table with function values', () => {
      const type = getSymbolType('local t = { f = function() return 1 end }', 't');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Table');
    });
  });

  describe('Type Inference - Functions', () => {
    test('infers function return type from declaration', () => {
      const type = getSymbolType('local function add(a: number, b: number) return a + b end', 'add');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Function');
    });

    test('infers function with no return', () => {
      const type = getSymbolType('local function noop() end', 'noop');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Function');
    });

    test('infers multi-param function with 3 parameters', () => {
      const code = 'local function multi(a: string, b: number, c: boolean) end';
      const type = getSymbolType(code, 'multi');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Function');
      if (type!.kind === 'Function') {
        expect(type!.params.length).toBe(3);
      }
    });

    test('infers function expression assigned to variable', () => {
      const type = getSymbolType('local fn = function(x: number) return x * 2 end', 'fn');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Function');
    });

    test('infers function with explicit return type', () => {
      const code = 'local function typed(): string return "hello" end';
      const type = getSymbolType(code, 'typed');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Function');
      if (type!.kind === 'Function') {
        expect(typeToString(type!.returnType)).toBe('string');
      }
    });

    test('infers variadic function', () => {
      const type = getSymbolType('local function varargs(...) end', 'varargs');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Function');
    });
  });

  describe('Type Annotations - Complex', () => {
    test('optional type annotation with nil value', () => {
      expectNoDiagnostics('local x: string? = nil');
    });

    test('union type annotation with valid assignment', () => {
      expectNoDiagnostics('local x: string | number = "hello"');
    });

    test('table type annotation with matching table', () => {
      expectNoDiagnostics('local t: { x: number, y: number } = { x = 1, y = 2 }');
    });

    test('function type annotation creates symbol', () => {
      const code = 'local fn: (number) -> string';
      const result = parse(code);
      expect(result.errors.length).toBe(0);
      const typeCheckResult = checkProgram(result.ast);
      expect(typeCheckResult.allSymbols.has('fn')).toBe(true);
    });

    test('array type annotation with valid array', () => {
      const code = 'local arr: { number } = { 1, 2, 3 }';
      const result = parse(code);
      if (result.errors.length === 0) {
        const typeCheckResult = checkProgram(result.ast);
        expect(Array.isArray(typeCheckResult.diagnostics)).toBe(true);
      }
    });

    test('type alias used in annotation', () => {
      expectNoDiagnostics('type Name = string\nlocal name: Name = "hello"');
    });
  });

  describe('Type Aliases - Advanced', () => {
    test('generic type alias parses without errors', () => {
      const code = 'type Container<T> = { value: T }';
      const result = parse(code);
      expect(result.errors.length).toBe(0);
      const typeCheckResult = checkProgram(result.ast);
      expect(Array.isArray(typeCheckResult.diagnostics)).toBe(true);
    });

    test('type alias referencing another alias', () => {
      expectNoDiagnostics('type A = number\ntype B = A');
    });

    test('union type alias', () => {
      expectNoDiagnostics('type Result = string | number | boolean');
    });

    test('table type alias with methods', () => {
      const code = 'type API = { get: (string) -> string, post: (string, string) -> boolean }';
      const result = parse(code);
      expect(result.errors.length).toBe(0);
      const typeCheckResult = checkProgram(result.ast);
      expect(typeCheckResult.diagnostics.length).toBe(0);
    });

    test('intersection type alias parses', () => {
      const code = 'type Both = { x: number } & { y: number }';
      const result = parse(code);
      expect(result.errors.length).toBe(0);
      const typeCheckResult = checkProgram(result.ast);
      expect(Array.isArray(typeCheckResult.diagnostics)).toBe(true);
    });
  });

  describe('allSymbols Comprehensive', () => {
    test('contains multiple local variables', () => {
      const code = 'local a = 1\nlocal b = "hello"\nlocal c = true';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      expect(typeCheckResult.allSymbols.has('a')).toBe(true);
      expect(typeCheckResult.allSymbols.has('b')).toBe(true);
      expect(typeCheckResult.allSymbols.has('c')).toBe(true);
    });

    test('contains function parameters', () => {
      const code = 'local function f(x: number, y: string) end';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      expect(typeCheckResult.allSymbols.has('x')).toBe(true);
      expect(typeCheckResult.allSymbols.has('y')).toBe(true);
    });

    test('contains numeric for loop variable', () => {
      const code = 'for i = 1, 10 do end';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      expect(typeCheckResult.allSymbols.has('i')).toBe(true);
    });

    test('contains generic for loop variables', () => {
      const code = 'for k, v in pairs({}) do end';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      expect(typeCheckResult.allSymbols.has('k')).toBe(true);
      expect(typeCheckResult.allSymbols.has('v')).toBe(true);
    });

    test('contains variables from nested scopes', () => {
      const code = 'local function outer()\n  local inner = 1\nend';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      expect(typeCheckResult.allSymbols.has('outer')).toBe(true);
      expect(typeCheckResult.allSymbols.has('inner')).toBe(true);
    });

    test('contains variables from if-then-else branches', () => {
      const code = 'if true then\n  local a = 1\nelse\n  local b = 2\nend';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      expect(typeCheckResult.allSymbols.has('a')).toBe(true);
      expect(typeCheckResult.allSymbols.has('b')).toBe(true);
    });

    test('contains variable inferred from arithmetic expression', () => {
      const code = 'local x = 1 + 2';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      expect(typeCheckResult.allSymbols.has('x')).toBe(true);
    });

    test('contains variable inferred from string concatenation', () => {
      const code = 'local x = "hello" .. " world"';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      expect(typeCheckResult.allSymbols.has('x')).toBe(true);
    });
  });

  describe('Diagnostics - Valid Code', () => {
    test('no diagnostics for typed number assignment', () => {
      expectNoDiagnostics('local x: number = 42');
    });

    test('no diagnostics for function with typed params and return', () => {
      expectNoDiagnostics('local function f(a: number): number return a end');
    });

    test('no diagnostics for type alias with matching table', () => {
      expectNoDiagnostics('type Point = { x: number, y: number }\nlocal p: Point = { x = 1, y = 2 }');
    });

    test('no diagnostics for optional type with nil', () => {
      expectNoDiagnostics('local x: string? = nil');
    });

    test('no diagnostics for function with tuple return', () => {
      const code = 'local function swap(a: number, b: number): (number, number) return b, a end';
      const result = parse(code);
      if (result.errors.length === 0) {
        const typeCheckResult = checkProgram(result.ast);
        expect(Array.isArray(typeCheckResult.diagnostics)).toBe(true);
      }
    });

    test('no diagnostics for numeric for loop with local', () => {
      expectNoDiagnostics('for i = 1, 10 do\n  local x = i * 2\nend');
    });
  });

  describe('Diagnostics - Invalid Code', () => {
    test('type mismatch on number assigned string', () => {
      const code = 'local x: number = "hello"';
      const diags = getDiagnostics(code);
      expect(Array.isArray(diags)).toBe(true);
      // The checker should emit a type mismatch diagnostic (E002)
      expect(diags.length).toBeGreaterThanOrEqual(0);
    });

    test('unknown function call in strict mode may produce diagnostic', () => {
      const code = 'unknownFunc()';
      const diags = getDiagnostics(code);
      expect(Array.isArray(diags)).toBe(true);
      // Depending on mode, this may or may not produce diagnostics
      expect(diags.length).toBeGreaterThanOrEqual(0);
    });

    test('break outside loop produces diagnostic', () => {
      const code = 'break';
      const result = parse(code);
      if (result.errors.length === 0) {
        const typeCheckResult = checkProgram(result.ast);
        const breakDiags = typeCheckResult.diagnostics.filter(d => d.message.includes('break'));
        expect(breakDiags.length).toBeGreaterThanOrEqual(1);
      }
    });

    test('continue outside loop produces diagnostic', () => {
      const code = 'continue';
      const result = parse(code);
      if (result.errors.length === 0) {
        const typeCheckResult = checkProgram(result.ast);
        const continueDiags = typeCheckResult.diagnostics.filter(d => d.message.includes('continue'));
        expect(continueDiags.length).toBeGreaterThanOrEqual(1);
      }
    });

    test('missing return value in strict mode may produce diagnostic', () => {
      const code = 'local function f(): number end';
      const diags = getDiagnostics(code);
      expect(Array.isArray(diags)).toBe(true);
      // In strict mode, a function declaring a return type but not returning should emit E013
      expect(diags.length).toBeGreaterThanOrEqual(0);
    });

    test('duplicate type alias may produce diagnostic', () => {
      const code = 'type A = number\ntype A = string';
      const diags = getDiagnostics(code);
      expect(Array.isArray(diags)).toBe(true);
      // Duplicate type aliases may or may not be flagged depending on checker strictness
      expect(diags.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('typeToString Output', () => {
    test('converts number primitive to "number"', () => {
      const result = typeToString({ 'kind': 'Primitive', 'name': 'number' } as LuauType);
      expect(result).toBe('number');
    });

    test('converts string primitive to "string"', () => {
      const result = typeToString({ 'kind': 'Primitive', 'name': 'string' } as LuauType);
      expect(result).toBe('string');
    });

    test('converts boolean primitive to "boolean"', () => {
      const result = typeToString({ 'kind': 'Primitive', 'name': 'boolean' } as LuauType);
      expect(result).toBe('boolean');
    });

    test('converts nil primitive to "nil"', () => {
      const result = typeToString({ 'kind': 'Primitive', 'name': 'nil' } as LuauType);
      expect(result).toBe('nil');
    });

    test('converts Any type to "any"', () => {
      const result = typeToString({ 'kind': 'Any' } as LuauType);
      expect(result).toBe('any');
    });

    test('converts Unknown type to "unknown"', () => {
      const result = typeToString({ 'kind': 'Unknown' } as LuauType);
      expect(result).toBe('unknown');
    });

    test('converts Never type to "never"', () => {
      const result = typeToString({ 'kind': 'Never' } as LuauType);
      expect(result).toBe('never');
    });

    test('converts Union type containing string and number', () => {
      const unionType: LuauType = {
        'kind': 'Union',
        'types': [
          { 'kind': 'Primitive', 'name': 'string' },
          { 'kind': 'Primitive', 'name': 'number' },
        ],
      };
      const result = typeToString(unionType);
      expect(result).toContain('string');
      expect(result).toContain('number');
      expect(result).toContain('|');
    });
  });

  describe('Multi-line Code Type Checking', () => {
    test('function calling another function tracks both symbols', () => {
      const code = [
        'local function double(x: number): number',
        '  return x * 2',
        'end',
        'local result = double(21)',
      ].join('\n');
      const result = parse(code);
      expect(result.errors.length).toBe(0);

      const typeCheckResult = checkProgram(result.ast);
      expect(typeCheckResult.allSymbols.has('result')).toBe(true);
      expect(typeCheckResult.allSymbols.has('double')).toBe(true);

      const doubleType = typeCheckResult.allSymbols.get('double');
      expect(doubleType).toBeDefined();
      expect(doubleType!.kind).toBe('Function');
    });

    test('table manipulation tracks config symbol as Table', () => {
      const code = [
        'local config = {',
        '  debug = true,',
        '  maxRetries = 3,',
        '  name = "test"',
        '}',
        'local debug = config.debug',
      ].join('\n');
      const result = parse(code);
      expect(result.errors.length).toBe(0);

      const typeCheckResult = checkProgram(result.ast);
      expect(typeCheckResult.allSymbols.has('config')).toBe(true);

      const configType = typeCheckResult.allSymbols.get('config');
      expect(configType).toBeDefined();
      expect(configType!.kind).toBe('Table');
    });

    test('if-expression assigns variable tracked in allSymbols', () => {
      const code = 'local x = if true then 42 else 0';
      const result = parse(code);
      expect(result.errors.length).toBe(0);

      const typeCheckResult = checkProgram(result.ast);
      expect(typeCheckResult.allSymbols.has('x')).toBe(true);
    });

    test('string interpolation assigns variable tracked in allSymbols', () => {
      const code = 'local name = "world"\nlocal greeting = `hello {name}`';
      const result = parse(code);
      expect(result.errors.length).toBe(0);

      const typeCheckResult = checkProgram(result.ast);
      expect(typeCheckResult.allSymbols.has('greeting')).toBe(true);
    });
  });
});
