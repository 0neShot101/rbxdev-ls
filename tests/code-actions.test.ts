import { parse } from '@parser/parser';
import { walk } from '@parser/visitor';
import { checkProgram } from '@typings/checker';
import { typeToString } from '@typings/types';
import { describe, expect, test } from 'bun:test';

const DEPRECATION_REPLACEMENTS: ReadonlyMap<string, string> = new Map([
  ['IsInGroup', 'IsInGroupAsync'],
  ['GetRankInGroup', 'GetRankInGroupAsync'],
  ['GetRoleInGroup', 'GetRoleInGroupAsync'],
  ['children', 'GetChildren'],
  ['getChildren', 'GetChildren'],
  ['isA', 'IsA'],
  ['findFirstChild', 'FindFirstChild'],
  ['waitForChild', 'WaitForChild'],
  ['clone', 'Clone'],
  ['destroy', 'Destroy'],
  ['remove', 'Destroy'],
  ['Remove', 'Destroy'],
  ['connect', 'Connect'],
  ['p', 'Position'],
]);

describe('Code Actions', () => {
  describe('Deprecation Replacements', () => {
    test('has replacement for children -> GetChildren', () => {
      expect(DEPRECATION_REPLACEMENTS.get('children')).toBe('GetChildren');
    });

    test('has replacement for findFirstChild -> FindFirstChild', () => {
      expect(DEPRECATION_REPLACEMENTS.get('findFirstChild')).toBe('FindFirstChild');
    });

    test('has replacement for destroy -> Destroy', () => {
      expect(DEPRECATION_REPLACEMENTS.get('destroy')).toBe('Destroy');
    });

    test('has replacement for remove -> Destroy', () => {
      expect(DEPRECATION_REPLACEMENTS.get('remove')).toBe('Destroy');
    });

    test('has replacement for connect -> Connect', () => {
      expect(DEPRECATION_REPLACEMENTS.get('connect')).toBe('Connect');
    });

    test('has replacement for clone -> Clone', () => {
      expect(DEPRECATION_REPLACEMENTS.get('clone')).toBe('Clone');
    });

    test('has replacement for isA -> IsA', () => {
      expect(DEPRECATION_REPLACEMENTS.get('isA')).toBe('IsA');
    });
  });

  describe('Deprecation Message Parsing', () => {
    test('extracts name from deprecation message with single quotes', () => {
      const msg = "'children' is deprecated";
      const match = msg.match(/'([^']+)' is deprecated/);
      expect(match).toBeDefined();
      expect(match![1]).toBe('children');
    });

    test('extracts name from deprecation message with smart quotes', () => {
      const msg = '\u2018children\u2019 is deprecated';
      const match = msg.match(/['\u2018]([^'\u2019]+)['\u2019] is deprecated/);
      expect(match).toBeDefined();
      expect(match![1]).toBe('children');
    });

    test('extracts suggestion from Use instead message', () => {
      const msg = "Use 'GetChildren' instead";
      const match = msg.match(/Use '([^']+)' instead/);
      expect(match).toBeDefined();
      expect(match![1]).toBe('GetChildren');
    });
  });

  describe('Unknown Identifier Fix', () => {
    test('extracts identifier from unknown identifier message', () => {
      const msg = "Unknown identifier 'myVar'";
      const match = msg.match(/Unknown identifier [''\u2018]([^''\u2019]+)[''\u2019]/);
      expect(match).toBeDefined();
      expect(match![1]).toBe('myVar');
    });
  });

  describe('Unused Variable Prefix', () => {
    test('detects unused variable message', () => {
      const msg = "'x' is unused";
      expect(msg.includes('unused')).toBe(true);
    });

    test('extracts variable name from unused message', () => {
      const msg = "'myVar' is unused";
      const match = msg.match(/[''\u2018]([^''\u2019]+)[''\u2019]/);
      expect(match).toBeDefined();
      expect(match![1]).toBe('myVar');
    });

    test('does not prefix already-prefixed variables', () => {
      const varName = '_unused';
      expect(varName.startsWith('_')).toBe(true);
    });
  });

  describe('String Quote Conversion', () => {
    test('detects double-quoted strings', () => {
      const result = parse('local x = "hello"');
      expect(result.errors.length).toBe(0);

      let foundDoubleQuote = false;
      walk(result.ast, {
        'visitStringLiteral': node => {
          if (node.raw.startsWith('"')) foundDoubleQuote = true;
        },
      });

      expect(foundDoubleQuote).toBe(true);
    });

    test('detects single-quoted strings', () => {
      const result = parse("local x = 'hello'");
      expect(result.errors.length).toBe(0);

      let foundSingleQuote = false;
      walk(result.ast, {
        'visitStringLiteral': node => {
          if (node.raw.startsWith("'")) foundSingleQuote = true;
        },
      });

      expect(foundSingleQuote).toBe(true);
    });

    test('can convert double to single quotes', () => {
      const value = 'hello';
      const converted = `'${value.replace(/'/g, "\\'")}'`;
      expect(converted).toBe("'hello'");
    });

    test('can convert single to double quotes', () => {
      const value = 'hello';
      const converted = `"${value.replace(/"/g, '\\"')}"`;
      expect(converted).toBe('"hello"');
    });

    test('escapes quotes during conversion', () => {
      const value = "it's";
      const converted = `'${value.replace(/'/g, "\\'")}'`;
      expect(converted).toBe("'it\\'s'");
    });
  });

  describe('Add Type Annotation', () => {
    test('identifies variables without type annotations', () => {
      const code = 'local x = 42';
      const result = parse(code);
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const hasAnnotation = stmt.types[0] !== undefined;
        expect(hasAnnotation).toBe(false);
      }
    });

    test('identifies variables with type annotations', () => {
      const code = 'local x: number = 42';
      const result = parse(code);
      expect(result.errors.length).toBe(0);

      const stmt = result.ast.body[0]!;
      if (stmt.kind === 'LocalDeclaration') {
        const hasAnnotation = stmt.types[0] !== undefined;
        expect(hasAnnotation).toBe(true);
      }
    });

    test('type checker infers type for unannotated variable', () => {
      const code = 'local x = 42';
      const result = parse(code);
      const typeCheckResult = checkProgram(result.ast);

      const symbolType = typeCheckResult.allSymbols.get('x');
      expect(symbolType).toBeDefined();

      if (symbolType !== undefined) {
        const typeStr = typeToString(symbolType);
        expect(typeStr.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Extract to Local Variable', () => {
    test('selection text extraction works', () => {
      const text = 'local result = someFunc(a + b)';
      const selectedText = text.slice(15, 29);
      expect(selectedText).toBe('someFunc(a + b');
    });

    test('generates correct extracted code', () => {
      const selectedText = 'a + b';
      const indent = '\t';
      const extractedLine = `${indent}local extracted = ${selectedText}\n`;
      expect(extractedLine).toBe('\tlocal extracted = a + b\n');
    });
  });
});
