/**
 * Tests for table literal key completions
 * Run with: bun tests/table-literal-completion.test.ts
 *
 * Tests verify that:
 * - Table literals with string keys capture those keys as properties
 * - Local variables with table types provide completions
 */

import { parse } from '../src/@parser/parser';
import { checkProgram } from '../src/@typings/checker';

let testsPassed = 0;
let testsFailed = 0;

const testTableType = (code: string, varName: string, expectedKeys: string[]): void => {
  const result = parse(code);

  if (result.errors.length > 0) {
    console.log(`FAIL: Parse error in code: ${result.errors[0]?.message}`);
    testsFailed++;
    return;
  }

  const typeCheckResult = checkProgram(result.ast);
  const env = typeCheckResult.environment;

  // Look for the variable in the global scope (top-level locals are stored there)
  const symbol = env.globalScope.symbols.get(varName);

  if (symbol === undefined) {
    console.log(`FAIL: Variable "${varName}" not found in scope`);
    testsFailed++;
    return;
  }

  const varType = symbol.type;

  if (varType.kind !== 'Table') {
    console.log(`FAIL: Variable "${varName}" has type ${varType.kind}, expected Table`);
    testsFailed++;
    return;
  }

  const actualKeys = Array.from(varType.properties.keys()).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  if (JSON.stringify(actualKeys) !== JSON.stringify(sortedExpectedKeys)) {
    console.log(`FAIL: Table "${varName}" has keys [${actualKeys.join(', ')}], expected [${sortedExpectedKeys.join(', ')}]`);
    testsFailed++;
    return;
  }

  console.log(`PASS: Table "${varName}" has keys [${sortedExpectedKeys.join(', ')}]`);
  testsPassed++;
};

console.log('=== Table Literal Completion Tests ===\n');

console.log('--- Bracket String Key Syntax ---');
testTableType(
  `local aaaa = {
    ['aaa'] = 1,
    ['vvv'] = 2,
    ['ccc'] = 3
}`,
  'aaaa',
  ['aaa', 'vvv', 'ccc'],
);

testTableType(
  `local t = {
    ["key1"] = "value1",
    ["key2"] = "value2"
}`,
  't',
  ['key1', 'key2'],
);

console.log('\n--- Identifier Key Syntax ---');
testTableType(
  `local obj = {
    name = "test",
    value = 42,
    active = true
}`,
  'obj',
  ['name', 'value', 'active'],
);

console.log('\n--- Mixed Key Syntax ---');
testTableType(
  `local mixed = {
    normalKey = 1,
    ['bracketKey'] = 2,
    ["doubleQuoteKey"] = 3
}`,
  'mixed',
  ['normalKey', 'bracketKey', 'doubleQuoteKey'],
);

console.log('\n--- Nested Tables ---');
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

console.log(`\n=== Results: ${testsPassed} passed, ${testsFailed} failed ===`);

if (testsFailed > 0) {
  process.exit(1);
}
