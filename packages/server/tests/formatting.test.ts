import { basicFormat } from '@lsp/handlers/formatting';
import { describe, expect, test } from 'bun:test';

describe('Basic Formatter', () => {
  describe('Indentation', () => {
    test('indents after function keyword', () => {
      const input = 'function foo()\nprint("hello")\nend';
      const result = basicFormat(input);
      expect(result).toContain('\tprint("hello")');
    });

    test('indents after if-then', () => {
      const input = 'if true then\nprint("yes")\nend';
      const result = basicFormat(input);
      expect(result).toContain('\tprint("yes")');
    });

    test('indents after for loop', () => {
      const input = 'for i = 1, 10 do\nprint(i)\nend';
      const result = basicFormat(input);
      expect(result).toContain('\tprint(i)');
    });

    test('indents after while loop', () => {
      const input = 'while true do\nbreak\nend';
      const result = basicFormat(input);
      expect(result).toContain('\tbreak');
    });

    test('indents after repeat', () => {
      const input = 'repeat\nx = x + 1\nuntil x > 10';
      const result = basicFormat(input);
      expect(result).toContain('\tx = x + 1');
    });

    test('dedents on end keyword', () => {
      const input = 'function foo()\nprint("hello")\nend';
      const result = basicFormat(input);
      const lines = result.split('\n');
      expect(lines[lines.length - 1]).toBe('end');
    });

    test('handles else dedent and re-indent', () => {
      const input = 'if a then\nx()\nelse\ny()\nend';
      const result = basicFormat(input);
      const lines = result.split('\n');
      expect(lines[2]).toBe('else');
      expect(lines[3]).toBe('\ty()');
    });

    test('handles elseif dedent and re-indent', () => {
      const input = 'if a then\nx()\nelseif b then\ny()\nend';
      const result = basicFormat(input);
      const lines = result.split('\n');
      expect(lines[2]).toBe('elseif b then');
      expect(lines[3]).toBe('\ty()');
    });

    test('preserves empty lines', () => {
      const input = 'local a = 1\n\nlocal b = 2';
      const result = basicFormat(input);
      expect(result).toContain('\n\n');
    });

    test('handles nested blocks', () => {
      const input = 'function foo()\nif true then\nprint("x")\nend\nend';
      const result = basicFormat(input);
      expect(result).toContain('\t\tprint("x")');
    });

    test('handles do blocks', () => {
      const input = 'do\nlocal x = 1\nend';
      const result = basicFormat(input);
      expect(result).toContain('\tlocal x = 1');
    });

    test('handles until dedent', () => {
      const input = 'repeat\nx = x + 1\nuntil x > 10';
      const result = basicFormat(input);
      const lines = result.split('\n');
      expect(lines[lines.length - 1]).toBe('until x > 10');
    });
  });

  describe('Edge Cases', () => {
    test('handles already formatted code', () => {
      const input = 'local x = 1';
      const result = basicFormat(input);
      expect(result).toBe('local x = 1');
    });

    test('strips leading whitespace', () => {
      const input = '    local x = 1';
      const result = basicFormat(input);
      expect(result).toBe('local x = 1');
    });

    test('handles empty input', () => {
      const result = basicFormat('');
      expect(result).toBe('');
    });

    test('handles multiple empty lines', () => {
      const input = 'local a = 1\n\n\nlocal b = 2';
      const result = basicFormat(input);
      const lines = result.split('\n');
      expect(lines[0]).toBe('local a = 1');
      expect(lines[lines.length - 1]).toBe('local b = 2');
    });
  });
});
