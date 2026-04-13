import { parse } from '@parser/parser';
import { walk } from '@parser/visitor';
import { describe, expect, test } from 'bun:test';

import type { Statement } from '@typings/ast';

interface FunctionInfo {
  readonly name: string;
  readonly line: number;
}

const collectFunctions = (statements: ReadonlyArray<Statement>): FunctionInfo[] => {
  const functions: FunctionInfo[] = [];

  const walkStatements = (stmts: ReadonlyArray<Statement>): void => {
    for (const stmt of stmts) {
      switch (stmt.kind) {
        case 'LocalFunction':
          functions.push({
            'name': stmt.name.name,
            'line': stmt.range.start.line - 1,
          });
          break;

        case 'FunctionDeclaration': {
          let fullName = stmt.name.base.name;
          for (const part of stmt.name.path) fullName += '.' + part.name;
          if (stmt.name.method !== undefined) fullName += ':' + stmt.name.method.name;
          functions.push({
            'name': fullName,
            'line': stmt.range.start.line - 1,
          });
          break;
        }

        case 'LocalDeclaration':
          for (let i = 0; i < stmt.names.length; i++) {
            const name = stmt.names[i];
            const value = stmt.values[i];
            if (name === undefined || value === undefined || value.kind !== 'FunctionExpression') continue;
            functions.push({
              'name': name.name,
              'line': stmt.range.start.line - 1,
            });
          }
          break;

        case 'IfStatement':
          walkStatements(stmt.thenBody);
          for (const clause of stmt.elseifClauses) walkStatements(clause.body);
          if (stmt.elseBody !== undefined) walkStatements(stmt.elseBody);
          break;

        case 'WhileStatement':
        case 'RepeatStatement':
        case 'DoStatement':
          walkStatements(stmt.body);
          break;

        case 'ForNumeric':
        case 'ForGeneric':
          walkStatements(stmt.body);
          break;

        case 'ExportStatement':
          walkStatements([stmt.declaration]);
          break;
      }
    }
  };

  walkStatements(statements);
  return functions;
};

const collectReferences = (code: string): Map<string, number> => {
  const result = parse(code);
  const references = new Map<string, number>();

  walk(result.ast, {
    'visitIdentifier': node => {
      const count = references.get(node.name) ?? 0;
      references.set(node.name, count + 1);
    },
    'visitLocalDeclaration': node => {
      for (const name of node.names) {
        const count = references.get(name.name) ?? 0;
        references.set(name.name, count + 1);
      }
    },
    'visitLocalFunction': node => {
      const count = references.get(node.name.name) ?? 0;
      references.set(node.name.name, count + 1);
    },
    'visitFunctionDeclaration': node => {
      const count = references.get(node.name.base.name) ?? 0;
      references.set(node.name.base.name, count + 1);
    },
    'visitMemberExpression': node => {
      const count = references.get(node.property.name) ?? 0;
      references.set(node.property.name, count + 1);
    },
    'visitMethodCallExpression': node => {
      const count = references.get(node.method.name) ?? 0;
      references.set(node.method.name, count + 1);
    },
  });

  return references;
};

describe('Document Symbols', () => {
  describe('Function Collection', () => {
    test('collects local functions', () => {
      const result = parse('local function foo() end\nlocal function bar() end');
      const functions = collectFunctions(result.ast.body);

      expect(functions.length).toBe(2);
      expect(functions[0]!.name).toBe('foo');
      expect(functions[1]!.name).toBe('bar');
    });

    test('collects global function declarations', () => {
      const result = parse('function MyModule.init() end');
      const functions = collectFunctions(result.ast.body);

      expect(functions.length).toBe(1);
      expect(functions[0]!.name).toBe('MyModule.init');
    });

    test('collects method declarations', () => {
      const result = parse('function MyClass:method() end');
      const functions = collectFunctions(result.ast.body);

      expect(functions.length).toBe(1);
      expect(functions[0]!.name).toBe('MyClass:method');
    });

    test('collects function expressions assigned to locals', () => {
      const result = parse('local myFunc = function() end');
      const functions = collectFunctions(result.ast.body);

      expect(functions.length).toBe(1);
      expect(functions[0]!.name).toBe('myFunc');
    });

    test('collects functions inside if blocks', () => {
      const result = parse('if true then\n  local function inner() end\nend');
      const functions = collectFunctions(result.ast.body);

      expect(functions.length).toBe(1);
      expect(functions[0]!.name).toBe('inner');
    });

    test('collects functions inside loops', () => {
      const result = parse('while true do\n  local function loopFunc() end\nend');
      const functions = collectFunctions(result.ast.body);

      expect(functions.length).toBe(1);
      expect(functions[0]!.name).toBe('loopFunc');
    });

    test('returns correct line numbers', () => {
      const code = `local function first()
end

local function second()
end`;
      const result = parse(code);
      const functions = collectFunctions(result.ast.body);

      expect(functions.length).toBe(2);
      expect(functions[0]!.line).toBe(0);
      expect(functions[1]!.line).toBe(3);
    });

    test('handles empty file', () => {
      const result = parse('');
      const functions = collectFunctions(result.ast.body);

      expect(functions.length).toBe(0);
    });
  });
});

describe('Code Lens - Reference Counting', () => {
  test('counts references to a function', () => {
    const code = `local function myFunc()
end
myFunc()
myFunc()`;
    const refs = collectReferences(code);
    const count = refs.get('myFunc') ?? 0;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('counts references to a variable', () => {
    const code = `local x = 1
print(x)
local y = x + 1`;
    const refs = collectReferences(code);
    const count = refs.get('x') ?? 0;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('counts declaration-only variable references', () => {
    const code = 'local unused = 42';
    const refs = collectReferences(code);
    const count = refs.get('unused') ?? 0;
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

describe('Call Hierarchy', () => {
  describe('Call Site Collection', () => {
    test('finds function calls in body', () => {
      const code = `local function foo()
  bar()
  baz()
end`;
      const result = parse(code);
      const callNames: string[] = [];

      walk(result.ast, {
        'visitCallExpression': node => {
          if (node.callee.kind === 'Identifier') callNames.push(node.callee.name);
        },
      });

      expect(callNames).toContain('bar');
      expect(callNames).toContain('baz');
    });

    test('finds method calls in body', () => {
      const code = `local function foo()
  obj:method()
  thing:doStuff()
end`;
      const result = parse(code);
      const methodNames: string[] = [];

      walk(result.ast, {
        'visitMethodCallExpression': node => {
          methodNames.push(node.method.name);
        },
      });

      expect(methodNames).toContain('method');
      expect(methodNames).toContain('doStuff');
    });

    test('identifies containing function for call sites', () => {
      const code = `local function outer()
  inner()
end

local function inner()
end`;
      const result = parse(code);
      const functions = collectFunctions(result.ast.body);

      expect(functions.length).toBe(2);
      expect(functions[0]!.name).toBe('outer');
      expect(functions[1]!.name).toBe('inner');
    });
  });
});
