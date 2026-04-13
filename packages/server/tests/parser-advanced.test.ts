import { parse } from '@parser/parser';
import { describe, expect, test } from 'bun:test';

describe('Parser Advanced', () => {
  describe('Continue Statement', () => {
    test('continue inside for loop parses', () => {
      const result = parse('for i = 1, 10 do\n  continue\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'ForNumeric') {
        expect(stmt.body.length).toBe(1);
        expect(stmt.body[0]!.kind).toBe('ContinueStatement');
      }
    });

    test('continue inside while loop parses', () => {
      const result = parse('while true do\n  continue\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'WhileStatement') {
        expect(stmt.body.length).toBe(1);
        expect(stmt.body[0]!.kind).toBe('ContinueStatement');
      }
    });

    test('continue inside nested loops', () => {
      const result = parse('for i = 1, 10 do\n  for j = 1, 10 do\n    continue\n  end\n  continue\nend');
      expect(result.errors.length).toBe(0);

      const outer = result.ast.body[0]!;
      if (outer.kind === 'ForNumeric') {
        expect(outer.body.length).toBe(2);

        const inner = outer.body[0]!;
        if (inner.kind === 'ForNumeric') {
          expect(inner.body.length).toBe(1);
          expect(inner.body[0]!.kind).toBe('ContinueStatement');
        }

        expect(outer.body[1]!.kind).toBe('ContinueStatement');
      }
    });
  });

  describe('Do Statement', () => {
    test('do ... end block parses with body', () => {
      const result = parse('do\n  local x = 1\n  print(x)\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('DoStatement');
      if (stmt.kind === 'DoStatement') {
        expect(stmt.body.length).toBe(2);
        expect(stmt.body[0]!.kind).toBe('LocalDeclaration');
        expect(stmt.body[1]!.kind).toBe('CallStatement');
      }
    });

    test('nested do blocks', () => {
      const result = parse('do\n  do\n    local x = 1\n  end\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const outer = result.ast.body[0]!;
      expect(outer.kind).toBe('DoStatement');
      if (outer.kind === 'DoStatement') {
        expect(outer.body.length).toBe(1);

        const inner = outer.body[0]!;
        expect(inner.kind).toBe('DoStatement');
        if (inner.kind === 'DoStatement') {
          expect(inner.body.length).toBe(1);
          expect(inner.body[0]!.kind).toBe('LocalDeclaration');
        }
      }
    });
  });

  describe('Type Cast Expression', () => {
    test('parenthesized type cast parses', () => {
      const result = parse('local x = (value :: number)');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const value = stmt.values[0]!;
        expect(value.kind).toBe('ParenthesizedExpression');
        if (value.kind === 'ParenthesizedExpression') {
          expect(value.expression.kind).toBe('TypeCastExpression');
        }
      }
    });

    test('type cast with string type', () => {
      const result = parse('local x = someValue :: string');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const value = stmt.values[0]!;
        expect(value.kind).toBe('TypeCastExpression');
        if (value.kind === 'TypeCastExpression') {
          expect(value.type.kind).toBe('TypeReference');
          if (value.type.kind === 'TypeReference') {
            expect(value.type.name).toBe('string');
          }
        }
      }
    });

    test('nested type cast', () => {
      const result = parse('local x = (x :: any) :: number');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const value = stmt.values[0]!;
        expect(value.kind).toBe('TypeCastExpression');
        if (value.kind === 'TypeCastExpression') {
          expect(value.type.kind).toBe('TypeReference');
          if (value.type.kind === 'TypeReference') {
            expect(value.type.name).toBe('number');
          }

          const inner = value.expression;
          expect(inner.kind).toBe('ParenthesizedExpression');
          if (inner.kind === 'ParenthesizedExpression') {
            expect(inner.expression.kind).toBe('TypeCastExpression');
            if (inner.expression.kind === 'TypeCastExpression') {
              expect(inner.expression.type.kind).toBe('TypeReference');
              if (inner.expression.type.kind === 'TypeReference') {
                expect(inner.expression.type.name).toBe('any');
              }
            }
          }
        }
      }
    });
  });

  describe('Intersection Types', () => {
    test('two-type intersection', () => {
      const result = parse('type A = B & C');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('TypeAlias');
      if (stmt.kind === 'TypeAlias') {
        expect(stmt.name.name).toBe('A');
        expect(stmt.type.kind).toBe('IntersectionType');
        if (stmt.type.kind === 'IntersectionType') {
          expect(stmt.type.types.length).toBe(2);
        }
      }
    });

    test('multiple intersections', () => {
      const result = parse('type D = A & B & C');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'TypeAlias') {
        expect(stmt.type.kind).toBe('IntersectionType');
        if (stmt.type.kind === 'IntersectionType') {
          expect(stmt.type.types.length).toBeGreaterThanOrEqual(2);
        }
      }
    });
  });

  describe('Typeof Type', () => {
    test('typeof in type alias', () => {
      const result = parse('type T = typeof(workspace)');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('TypeAlias');
      if (stmt.kind === 'TypeAlias') {
        expect(stmt.type.kind).toBe('TypeofType');
        if (stmt.type.kind === 'TypeofType') {
          expect(stmt.type.expression.kind).toBe('Identifier');
          if (stmt.type.expression.kind === 'Identifier') {
            expect(stmt.type.expression.name).toBe('workspace');
          }
        }
      }
    });

    test('typeof as variable annotation', () => {
      const result = parse('local x: typeof(someVar) = someVar');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const typeAnnotation = stmt.types[0];
        expect(typeAnnotation).toBeDefined();
        if (typeAnnotation !== undefined) {
          expect(typeAnnotation.kind).toBe('TypeofType');
        }
      }
    });
  });

  describe('Compound Assignment', () => {
    test('+= operator', () => {
      const result = parse('x += 1');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('CompoundAssignment');
      if (stmt.kind === 'CompoundAssignment') {
        expect(stmt.operator).toBe('+=');
      }
    });

    test('-= operator', () => {
      const result = parse('x -= 1');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('CompoundAssignment');
      if (stmt.kind === 'CompoundAssignment') {
        expect(stmt.operator).toBe('-=');
      }
    });

    test('*= operator', () => {
      const result = parse('x *= 2');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('CompoundAssignment');
      if (stmt.kind === 'CompoundAssignment') {
        expect(stmt.operator).toBe('*=');
      }
    });

    test('..= operator', () => {
      const result = parse('x ..= "suffix"');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('CompoundAssignment');
      if (stmt.kind === 'CompoundAssignment') {
        expect(stmt.operator).toBe('..=');
      }
    });
  });

  describe('Multiple Assignment', () => {
    test('local with multiple names and values', () => {
      const result = parse('local a, b, c = 1, 2, 3');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('LocalDeclaration');
      if (stmt.kind === 'LocalDeclaration') {
        expect(stmt.names.length).toBe(3);
        expect(stmt.values.length).toBe(3);
      }
    });

    test('swap assignment', () => {
      const result = parse('a, b = b, a');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('Assignment');
      if (stmt.kind === 'Assignment') {
        expect(stmt.targets.length).toBe(2);
        expect(stmt.values.length).toBe(2);
      }
    });

    test('more names than values', () => {
      const result = parse('local x, y = unpack(t)');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('LocalDeclaration');
      if (stmt.kind === 'LocalDeclaration') {
        expect(stmt.names.length).toBe(2);
        expect(stmt.values.length).toBe(1);
      }
    });
  });

  describe('Vararg Functions', () => {
    test('variadic parameter', () => {
      const result = parse('local function pack(...)\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('LocalFunction');
      if (stmt.kind === 'LocalFunction') {
        const lastParam = stmt.func.params[stmt.func.params.length - 1];
        expect(lastParam).toBeDefined();
        if (lastParam !== undefined) {
          expect(lastParam.isVariadic).toBe(true);
        }
      }
    });

    test('typed variadic parameter', () => {
      const result = parse('local function typed(...: number)\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('LocalFunction');
      if (stmt.kind === 'LocalFunction') {
        const lastParam = stmt.func.params[stmt.func.params.length - 1];
        expect(lastParam).toBeDefined();
        if (lastParam !== undefined) {
          expect(lastParam.isVariadic).toBe(true);
          expect(lastParam.type).toBeDefined();
          if (lastParam.type !== undefined) {
            expect(lastParam.type.kind).toBe('TypeReference');
            if (lastParam.type.kind === 'TypeReference') {
              expect(lastParam.type.name).toBe('number');
            }
          }
        }
      }
    });
  });

  describe('Generic Functions', () => {
    test('single generic type parameter', () => {
      const result = parse('local function identity<T>(x: T): T\n  return x\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('LocalFunction');
      if (stmt.kind === 'LocalFunction') {
        expect(stmt.func.typeParams).toBeDefined();
        if (stmt.func.typeParams !== undefined) {
          expect(stmt.func.typeParams.length).toBe(1);
          expect(stmt.func.typeParams[0]!.name).toBe('T');
        }
      }
    });

    test('multiple generic type parameters on type alias', () => {
      const result = parse('type Container<T, U> = { key: T, value: U }');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('TypeAlias');
      if (stmt.kind === 'TypeAlias') {
        expect(stmt.typeParams).toBeDefined();
        if (stmt.typeParams !== undefined) {
          expect(stmt.typeParams.length).toBe(2);
          expect(stmt.typeParams[0]!.name).toBe('T');
          expect(stmt.typeParams[1]!.name).toBe('U');
        }
      }
    });

    test('three generic type parameters', () => {
      const result = parse('type Triple<A, B, C> = { a: A, b: B, c: C }');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('TypeAlias');
      if (stmt.kind === 'TypeAlias') {
        expect(stmt.typeParams).toBeDefined();
        if (stmt.typeParams !== undefined) {
          expect(stmt.typeParams.length).toBe(3);
          expect(stmt.typeParams[0]!.name).toBe('A');
          expect(stmt.typeParams[1]!.name).toBe('B');
          expect(stmt.typeParams[2]!.name).toBe('C');
        }
      }
    });
  });

  describe('Return Type Tuples', () => {
    test('function with tuple return type', () => {
      const result = parse('local function swap(a, b): (string, number)\n  return b, a\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('LocalFunction');
      if (stmt.kind === 'LocalFunction') {
        expect(stmt.func.returnType).toBeDefined();
      }
    });

    test('function with three-element tuple return type', () => {
      const result = parse('local function multi(): (number, string, boolean)\n  return 1, "", true\nend');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('LocalFunction');
      if (stmt.kind === 'LocalFunction') {
        expect(stmt.func.returnType).toBeDefined();
      }
    });
  });

  describe('Table Types', () => {
    test('table type with indexer', () => {
      const result = parse('type Dict = { [string]: number }');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('TypeAlias');
      if (stmt.kind === 'TypeAlias') {
        expect(stmt.type.kind).toBe('TableType');
        if (stmt.type.kind === 'TableType') {
          expect(stmt.type.indexer).toBeDefined();
          if (stmt.type.indexer !== undefined) {
            expect(stmt.type.indexer.keyType.kind).toBe('TypeReference');
            expect(stmt.type.indexer.valueType.kind).toBe('TypeReference');
          }
        }
      }
    });

    test('table type array form', () => {
      const result = parse('type Array = { number }');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('TypeAlias');
      if (stmt.kind === 'TypeAlias') {
        expect(stmt.type.kind).toBe('TableType');
      }
    });

    test('table type with properties and indexer', () => {
      const result = parse('type Mixed = { name: string, [number]: boolean }');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('TypeAlias');
      if (stmt.kind === 'TypeAlias') {
        expect(stmt.type.kind).toBe('TableType');
        if (stmt.type.kind === 'TableType') {
          expect(stmt.type.properties.length).toBeGreaterThanOrEqual(1);
          expect(stmt.type.indexer).toBeDefined();
        }
      }
    });
  });

  describe('String Interpolation Advanced', () => {
    test('interpolated string with expressions stored as raw parts', () => {
      const result = parse('local s = `{a + b} and {c}`');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const value = stmt.values[0]!;
        expect(value.kind).toBe('InterpolatedString');
        if (value.kind === 'InterpolatedString') {
          expect(value.parts.length).toBeGreaterThanOrEqual(1);
          expect(value.parts[0]!.kind).toBe('StringLiteral');
        }
      }
    });

    test('simple interpolated string preserves raw content', () => {
      const result = parse('local s = `hello {name} world`');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const value = stmt.values[0]!;
        expect(value.kind).toBe('InterpolatedString');
        if (value.kind === 'InterpolatedString') {
          expect(value.parts.length).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe('Chained Method Calls', () => {
    test('method call on method call', () => {
      const result = parse('game:GetService("Players"):FindFirstChild("test")');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      expect(stmt.kind).toBe('CallStatement');
      if (stmt.kind === 'CallStatement') {
        expect(stmt.expression.kind).toBe('MethodCallExpression');
        if (stmt.expression.kind === 'MethodCallExpression') {
          expect(stmt.expression.method.name).toBe('FindFirstChild');
          expect(stmt.expression.object.kind).toBe('MethodCallExpression');
          if (stmt.expression.object.kind === 'MethodCallExpression') {
            expect(stmt.expression.object.method.name).toBe('GetService');
          }
        }
      }
    });

    test('nested member expressions', () => {
      const result = parse('local x = t.a.b.c');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const value = stmt.values[0]!;
        expect(value.kind).toBe('MemberExpression');
        if (value.kind === 'MemberExpression') {
          expect(value.property.name).toBe('c');
          expect(value.object.kind).toBe('MemberExpression');
          if (value.object.kind === 'MemberExpression') {
            expect(value.object.property.name).toBe('b');
            expect(value.object.object.kind).toBe('MemberExpression');
            if (value.object.object.kind === 'MemberExpression') {
              expect(value.object.object.property.name).toBe('a');
            }
          }
        }
      }
    });
  });

  describe('Complex Error Recovery', () => {
    test('missing expression after assignment operator', () => {
      const result = parse('local x =');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.ast.body.length).toBeGreaterThanOrEqual(0);
    });

    test('missing then in if statement', () => {
      const result = parse('if true\n  print("x")\nend');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('missing do in for loop', () => {
      const result = parse('for i = 1, 10\n  print(i)\nend');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('unclosed function still produces body', () => {
      const result = parse('local function foo()\n  local x = 1');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.ast.body.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    test('empty table', () => {
      const result = parse('local t = {}');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const value = stmt.values[0]!;
        expect(value.kind).toBe('TableExpression');
        if (value.kind === 'TableExpression') {
          expect(value.fields.length).toBe(0);
        }
      }
    });

    test('single-element table', () => {
      const result = parse('local t = {42}');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const value = stmt.values[0]!;
        expect(value.kind).toBe('TableExpression');
        if (value.kind === 'TableExpression') {
          expect(value.fields.length).toBe(1);
        }
      }
    });

    test('trailing comma in table', () => {
      const result = parse('local t = {1, 2, 3,}');
      expect(result.errors.length).toBe(0);
      expect(result.ast.body.length).toBe(1);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const value = stmt.values[0]!;
        expect(value.kind).toBe('TableExpression');
        if (value.kind === 'TableExpression') {
          expect(value.fields.length).toBe(3);
        }
      }
    });
  });
});
