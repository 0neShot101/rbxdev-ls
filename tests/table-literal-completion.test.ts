import { parse } from '@parser/parser';
import { checkProgram } from '@typings/checker';
import { describe, expect, test } from 'bun:test';

const testTableType = (code: string, varName: string, expectedKeys: string[]) => {
  const result = parse(code);
  expect(result.errors.length).toBe(0);

  const typeCheckResult = checkProgram(result.ast);
  const symbol = typeCheckResult.environment.globalScope.symbols.get(varName);
  expect(symbol).toBeDefined();
  expect(symbol!.type.kind).toBe('Table');

  if (symbol!.type.kind === 'Table') {
    const actualKeys = Array.from(symbol!.type.properties.keys()).sort();
    expect(actualKeys).toEqual([...expectedKeys].sort());
  }
};

describe('Table Literal Completions', () => {
  describe('Bracket String Key Syntax', () => {
    test('single-quoted bracket keys', () => {
      testTableType(
        `local aaaa = {
    ['aaa'] = 1,
    ['vvv'] = 2,
    ['ccc'] = 3
}`,
        'aaaa',
        ['aaa', 'vvv', 'ccc'],
      );
    });

    test('double-quoted bracket keys', () => {
      testTableType(
        `local t = {
    ["key1"] = "value1",
    ["key2"] = "value2"
}`,
        't',
        ['key1', 'key2'],
      );
    });
  });

  describe('Identifier Key Syntax', () => {
    test('plain identifier keys', () => {
      testTableType(
        `local obj = {
    name = "test",
    value = 42,
    active = true
}`,
        'obj',
        ['name', 'value', 'active'],
      );
    });
  });

  describe('Mixed Key Syntax', () => {
    test('mix of identifier and bracket keys', () => {
      testTableType(
        `local mixed = {
    normalKey = 1,
    ['bracketKey'] = 2,
    ["doubleQuoteKey"] = 3
}`,
        'mixed',
        ['normalKey', 'bracketKey', 'doubleQuoteKey'],
      );
    });
  });

  describe('Nested Tables', () => {
    test('outer table has correct keys', () => {
      testTableType(
        `local outer = {
    inner = {
        a = 1,
        b = 2
    },
    value = 3
}`,
        'outer',
        ['inner', 'value'],
      );
    });
  });
});
