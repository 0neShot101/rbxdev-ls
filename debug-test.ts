/**
 * Debug test script to trace elapsedTime and FireServer issues
 */
import { parse } from './src/@parser/parser';
import { checkProgram } from './src/@typings/checker';
import { buildGlobalEnvironment } from './src/@definitions/globals';

const testCode1 = `
--!strict
local elapsed = elapsedTime()
`;

const testCode2 = `
--!strict
local re = Instance.new("RemoteEvent")
re:FireServer()
`;

const runTest = (name: string, code: string): void => {
  console.error(`\n========== Testing: ${name} ==========\n`);

  const parseResult = parse(code);
  if (parseResult.errors.length > 0) {
    console.error('Parse errors:', parseResult.errors);
    return;
  }

  const globalEnv = buildGlobalEnvironment();

  // Build class map from globalEnv
  const classMap = new Map<import('./src/@typings/types').ClassType['name'], import('./src/@typings/types').ClassType>();
  for (const [name, type] of globalEnv.robloxClasses) {
    if (type.kind === 'Class') {
      classMap.set(name, type);
    }
  }

  const result = checkProgram(parseResult.ast, { classes: classMap });

  console.error('\nDiagnostics:');
  for (const diag of result.diagnostics) {
    console.error(`  [${diag.severity}] ${diag.message} at line ${diag.range.start.line + 1}`);
  }
  if (result.diagnostics.length === 0) {
    console.error('  (none)');
  }
};

runTest('elapsedTime', testCode1);
runTest('FireServer', testCode2);
