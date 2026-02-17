import { parse } from '@parser/parser';
import { checkProgram } from '@typings/checker';
import { typeToString } from '@typings/types';
import { describe, expect, test } from 'bun:test';

import type { LuauType } from '@typings/types';

const getSymbolType = (code: string, varName: string): LuauType | undefined => {
  const result = parse(code);
  if (result.errors.length > 0) return undefined;

  const typeCheckResult = checkProgram(result.ast);
  const symbol = typeCheckResult.environment.globalScope.symbols.get(varName);
  return symbol?.type;
};

const getDiagnostics = (code: string) => {
  const result = parse(code);
  const typeCheckResult = checkProgram(result.ast);
  return typeCheckResult.diagnostics;
};

describe('Type Checker', () => {
  describe('Variable Type Inference', () => {
    test('infers number type from numeric literal', () => {
      const type = getSymbolType('local x = 42', 'x');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Primitive');
    });

    test('infers string type from string literal', () => {
      const type = getSymbolType('local x = "hello"', 'x');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Primitive');
    });

    test('infers boolean type from boolean literal', () => {
      const type = getSymbolType('local x = true', 'x');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Primitive');
    });

    test('infers nil type', () => {
      const type = getSymbolType('local x = nil', 'x');
      expect(type).toBeDefined();
    });

    test('infers table type from table constructor', () => {
      const type = getSymbolType('local t = { a = 1, b = "hello" }', 't');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Table');
    });

    test('infers function type from function expression', () => {
      const type = getSymbolType('local fn = function(x) return x end', 'fn');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Function');
    });
  });

  describe('Type Annotations', () => {
    test('respects explicit number annotation', () => {
      const type = getSymbolType('local x: number = 42', 'x');
      expect(type).toBeDefined();
      expect(typeToString(type!)).toBe('number');
    });

    test('respects explicit string annotation', () => {
      const type = getSymbolType('local x: string = "hello"', 'x');
      expect(type).toBeDefined();
      expect(typeToString(type!)).toBe('string');
    });

    test('respects explicit boolean annotation', () => {
      const type = getSymbolType('local x: boolean = true', 'x');
      expect(type).toBeDefined();
      expect(typeToString(type!)).toBe('boolean');
    });
  });

  describe('Type Aliases', () => {
    test('resolves simple type alias', () => {
      const code = 'type MyNum = number\nlocal x: MyNum = 42';
      const result = parse(code);
      expect(result.errors.length).toBe(0);

      const typeCheckResult = checkProgram(result.ast);
      expect(typeCheckResult.diagnostics.length).toBe(0);
    });

    test('resolves table type alias', () => {
      const code = 'type Point = { x: number, y: number }\nlocal p: Point = { x = 1, y = 2 }';
      const result = parse(code);
      expect(result.errors.length).toBe(0);

      const typeCheckResult = checkProgram(result.ast);
      const symbol = typeCheckResult.environment.globalScope.symbols.get('p');
      expect(symbol).toBeDefined();
    });

    test('resolves union type alias', () => {
      const code = 'type StringOrNum = string | number';
      const result = parse(code);
      expect(result.errors.length).toBe(0);

      const typeCheckResult = checkProgram(result.ast);
      expect(typeCheckResult.diagnostics.length).toBe(0);
    });
  });

  describe('Function Type Checking', () => {
    test('checks function with typed parameters', () => {
      const code = `local function add(a: number, b: number): number
  return a + b
end`;
      const type = getSymbolType(code, 'add');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Function');

      if (type!.kind === 'Function') {
        expect(type!.params.length).toBe(2);
      }
    });

    test('infers function with no type annotations', () => {
      const code = `local function greet(name)
  return "hello " .. name
end`;
      const type = getSymbolType(code, 'greet');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('Function');
    });
  });

  describe('allSymbols Map', () => {
    test('contains local variables', () => {
      const code = 'local x = 42\nlocal y = "hello"';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      expect(typeCheckResult.allSymbols.has('x')).toBe(true);
      expect(typeCheckResult.allSymbols.has('y')).toBe(true);
    });

    test('contains function names', () => {
      const code = 'local function myFunc() end';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      expect(typeCheckResult.allSymbols.has('myFunc')).toBe(true);
    });

    test('contains function parameters', () => {
      const code = 'local function foo(bar: number) end';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      expect(typeCheckResult.allSymbols.has('bar')).toBe(true);
    });
  });

  describe('Diagnostics', () => {
    test('produces no diagnostics for valid code', () => {
      const diagnostics = getDiagnostics('local x = 42');
      expect(diagnostics.length).toBe(0);
    });

    test('produces no diagnostics for typed code', () => {
      const diagnostics = getDiagnostics('local x: number = 42');
      expect(diagnostics.length).toBe(0);
    });

    test('produces no diagnostics for function declarations', () => {
      const diagnostics = getDiagnostics('local function foo(a: number, b: string)\n  return a\nend');
      expect(diagnostics.length).toBe(0);
    });
  });
});
