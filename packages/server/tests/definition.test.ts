import { describe, expect, test } from 'bun:test';
import { collectDeclarations } from '@lsp/handlers/definition';
import { collectTypeDeclarations } from '@lsp/handlers/typeDefinition';
import { parse } from '@parser/parser';
import { walk } from '@parser/visitor';

describe('Go to Definition', () => {
  describe('Local Variable Declarations', () => {
    test('finds local variable declaration', () => {
      const result = parse('local myVar = 42\nprint(myVar)');
      const declarations = collectDeclarations(result.ast);

      expect(declarations.has('myVar')).toBe(true);
      expect(declarations.get('myVar')?.length).toBeGreaterThan(0);
      expect(declarations.get('myVar')?.[0]?.line).toBe(0);
    });

    test('finds multiple declarations', () => {
      const result = parse('local a = 1\nlocal b = 2\nlocal c = 3');
      const declarations = collectDeclarations(result.ast);

      expect(declarations.has('a')).toBe(true);
      expect(declarations.has('b')).toBe(true);
      expect(declarations.has('c')).toBe(true);
    });

    test('finds declarations inside functions', () => {
      const result = parse('local function foo()\n  local inner = 1\nend');
      const declarations = collectDeclarations(result.ast);

      expect(declarations.has('foo')).toBe(true);
      expect(declarations.has('inner')).toBe(true);
    });
  });

  describe('Function Declarations', () => {
    test('finds local function', () => {
      const result = parse('local function myFunc() end');
      const declarations = collectDeclarations(result.ast);

      expect(declarations.has('myFunc')).toBe(true);
    });

    test('finds global function', () => {
      const result = parse('function globalFunc() end');
      const declarations = collectDeclarations(result.ast);

      expect(declarations.has('globalFunc')).toBe(true);
    });

    test('finds function parameters', () => {
      const result = parse('local function foo(param1, param2) end');
      const declarations = collectDeclarations(result.ast);

      expect(declarations.has('foo')).toBe(true);
      expect(declarations.has('param1')).toBe(true);
      expect(declarations.has('param2')).toBe(true);
    });
  });

  describe('For Loop Variables', () => {
    test('finds numeric for variable', () => {
      const result = parse('for i = 1, 10 do end');
      const declarations = collectDeclarations(result.ast);

      expect(declarations.has('i')).toBe(true);
    });

    test('finds generic for variables', () => {
      const result = parse('for k, v in pairs(t) do end');
      const declarations = collectDeclarations(result.ast);

      expect(declarations.has('k')).toBe(true);
      expect(declarations.has('v')).toBe(true);
    });
  });

  describe('Type Alias Declarations', () => {
    test('finds type alias', () => {
      const result = parse('type MyType = number');
      const declarations = collectDeclarations(result.ast);

      expect(declarations.has('MyType')).toBe(true);
    });

    test('finds exported type alias', () => {
      const result = parse('export type PublicType = string');
      const declarations = collectDeclarations(result.ast);

      expect(declarations.has('PublicType')).toBe(true);
    });
  });
});

describe('Go to Type Definition', () => {
  describe('Type Declaration Collection', () => {
    test('collects type alias declarations', () => {
      const result = parse('type Point = { x: number, y: number }');
      const typeDecls = collectTypeDeclarations(result.ast);

      expect(typeDecls.has('Point')).toBe(true);
      expect(typeDecls.get('Point')?.line).toBe(0);
    });

    test('collects exported type declarations', () => {
      const result = parse('export type MyType = string');
      const typeDecls = collectTypeDeclarations(result.ast);

      expect(typeDecls.has('MyType')).toBe(true);
    });

    test('collects multiple type aliases', () => {
      const code = `type Pos = { x: number, y: number }
type Size = { width: number, height: number }
type Rect = { pos: Pos, size: Size }`;
      const result = parse(code);
      const typeDecls = collectTypeDeclarations(result.ast);

      expect(typeDecls.has('Pos')).toBe(true);
      expect(typeDecls.has('Size')).toBe(true);
      expect(typeDecls.has('Rect')).toBe(true);
    });
  });

  describe('TypeReference Walking', () => {
    test('finds TypeReference nodes in AST', () => {
      const code = `type MyType = number
local x: MyType = 42`;
      const result = parse(code);
      const typeRefs: string[] = [];

      walk(result.ast, {
        'visitTypeReference': node => void typeRefs.push(node.name),
      });

      expect(typeRefs).toContain('MyType');
    });

    test('finds TypeReference in function parameters', () => {
      const code = `type Config = { debug: boolean }
local function init(cfg: Config) end`;
      const result = parse(code);
      const typeRefs: string[] = [];

      walk(result.ast, {
        'visitTypeReference': node => void typeRefs.push(node.name),
      });

      expect(typeRefs).toContain('Config');
    });

    test('finds TypeReference in return types', () => {
      const code = `type Result = string
local function getResult(): Result
  return "ok"
end`;
      const result = parse(code);
      const typeRefs: string[] = [];

      walk(result.ast, {
        'visitTypeReference': node => void typeRefs.push(node.name),
      });

      expect(typeRefs).toContain('Result');
    });
  });
});
