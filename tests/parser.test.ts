import { parse } from '@parser/parser';
import { describe, expect, test } from 'bun:test';

describe('Parser', () => {
  describe('Basic Parsing', () => {
    test('parses empty source', () => {
      const result = parse('');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(0);
    });

    test('parses local variable declaration', () => {
      const result = parse('local x = 42');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);
      expect(result.ast.body[0]!.kind).toBe('LocalDeclaration');
    });

    test('parses multiple statements', () => {
      const result = parse('local a = 1\nlocal b = 2\nlocal c = 3');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(3);
    });

    test('parses print call', () => {
      const result = parse('print("hello")');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);
      expect(result.ast.body[0]!.kind).toBe('CallStatement');
    });
  });

  describe('Function Declarations', () => {
    test('parses local function', () => {
      const result = parse('local function foo(a, b)\n  return a + b\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('LocalFunction');
      if (stmt.kind === 'LocalFunction') {
        expect(stmt.name.name).toBe('foo');
        expect(stmt.func.params.length).toBe(2);
      }
    });

    test('parses global function declaration', () => {
      const result = parse('function MyModule.init()\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('FunctionDeclaration');
      if (stmt.kind === 'FunctionDeclaration') {
        expect(stmt.name.base.name).toBe('MyModule');
        expect(stmt.name.path.length).toBe(1);
        expect(stmt.name.path[0]!.name).toBe('init');
      }
    });

    test('parses method declaration', () => {
      const result = parse('function MyClass:method(self)\nend');
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'FunctionDeclaration') {
        expect(stmt.name.method).toBeDefined();
        expect(stmt.name.method!.name).toBe('method');
      }
    });

    test('parses function with typed parameters', () => {
      const result = parse('local function add(a: number, b: number): number\n  return a + b\nend');
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalFunction') {
        expect(stmt.func.params[0]!.type).toBeDefined();
        expect(stmt.func.params[0]!.type!.kind).toBe('TypeReference');
        expect(stmt.func.returnType).toBeDefined();
      }
    });
  });

  describe('Control Flow', () => {
    test('parses if statement', () => {
      const result = parse('if true then\n  print("yes")\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body[0]!.kind).toBe('IfStatement');
    });

    test('parses if-elseif-else', () => {
      const result = parse('if a then\n  x()\nelseif b then\n  y()\nelse\n  z()\nend');
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'IfStatement') {
        expect(stmt.elseifClauses.length).toBe(1);
        expect(stmt.elseBody).toBeDefined();
      }
    });

    test('parses while loop', () => {
      const result = parse('while true do\n  break\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body[0]!.kind).toBe('WhileStatement');
    });

    test('parses for numeric loop', () => {
      const result = parse('for i = 1, 10 do\n  print(i)\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body[0]!.kind).toBe('ForNumeric');
    });

    test('parses for generic loop', () => {
      const result = parse('for k, v in pairs(t) do\n  print(k, v)\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body[0]!.kind).toBe('ForGeneric');
    });

    test('parses repeat-until loop', () => {
      const result = parse('repeat\n  x = x + 1\nuntil x > 10');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body[0]!.kind).toBe('RepeatStatement');
    });
  });

  describe('Type Annotations', () => {
    test('parses type alias', () => {
      const result = parse('type Point = { x: number, y: number }');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body[0]!.kind).toBe('TypeAlias');

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'TypeAlias') {
        expect(stmt.name.name).toBe('Point');
        expect(stmt.type.kind).toBe('TableType');
      }
    });

    test('parses export type', () => {
      const result = parse('export type MyType = string | number');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body[0]!.kind).toBe('ExportStatement');

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'ExportStatement') {
        expect(stmt.declaration.kind).toBe('TypeAlias');
      }
    });

    test('parses union type annotation', () => {
      const result = parse('local x: string | number = "hello"');
      expect(result.errors.length).toBe(0);
    });

    test('parses optional type annotation', () => {
      const result = parse('local x: string? = nil');
      expect(result.errors.length).toBe(0);
    });

    test('parses function type annotation', () => {
      const result = parse('local fn: (number, string) -> boolean');
      expect(result.errors.length).toBe(0);
    });

    test('parses generic type', () => {
      const result = parse('type Container<T> = { value: T }');
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'TypeAlias') {
        expect(stmt.typeParams).toBeDefined();
        expect(stmt.typeParams!.length).toBe(1);
        expect(stmt.typeParams![0]!.name).toBe('T');
      }
    });
  });

  describe('Expressions', () => {
    test('parses table constructor', () => {
      const result = parse('local t = { a = 1, b = 2 }');
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        expect(stmt.values[0]!.kind).toBe('TableExpression');
      }
    });

    test('parses function expression', () => {
      const result = parse('local fn = function(x) return x end');
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        expect(stmt.values[0]!.kind).toBe('FunctionExpression');
      }
    });

    test('parses method call', () => {
      const result = parse('obj:method(arg)');
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'CallStatement') {
        expect(stmt.expression.kind).toBe('MethodCallExpression');
      }
    });

    test('parses member expression', () => {
      const result = parse('local x = obj.field');
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        expect(stmt.values[0]!.kind).toBe('MemberExpression');
      }
    });

    test('parses string interpolation', () => {
      const result = parse('local s = `hello {name}`');
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        expect(stmt.values[0]!.kind).toBe('InterpolatedString');
      }
    });

    test('parses if expression', () => {
      const result = parse('local x = if a then b else c');
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        expect(stmt.values[0]!.kind).toBe('IfExpression');
      }
    });
  });

  describe('Error Recovery', () => {
    test('reports error on invalid syntax', () => {
      const result = parse('local = 42');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('reports error on unclosed block', () => {
      const result = parse('if true then\n  print("x")');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Comments', () => {
    test('parses single-line comments', () => {
      const result = parse('-- this is a comment\nlocal x = 1');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);
    });

    test('parses multi-line comments', () => {
      const result = parse('--[[\n  multi-line comment\n]]\nlocal x = 1');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);
    });
  });
});
