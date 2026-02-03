/**
 * Test script runner - show all errors
 */
import { buildGlobalEnvironment } from './src/@definitions/globals';
import { parse } from './src/@parser/parser';
import { checkProgram } from './src/@typings/checker';
import type { TypeCheckMode } from './src/@typings/subtyping';
import type { Comment } from './src/@parser/ast';
import * as fs from 'fs';

const testFile = process.argv[2] || './test-completions.luau';
const code = fs.readFileSync(testFile, 'utf-8');

const parseResult = parse(code);
console.error(`=== ${testFile} ===\n`);

// Detect mode from comments
const detectMode = (comments: ReadonlyArray<Comment>): TypeCheckMode => {
  for (const comment of comments) {
    if (comment.range.start.line > 5) break;
    const text = comment.value.trim();
    // Comment value may include -- prefix
    if (text === '--!strict' || text === '!strict') return 'strict';
    if (text === '--!nonstrict' || text === '!nonstrict') return 'nonstrict';
    if (text === '--!nocheck' || text === '!nocheck') return 'nocheck';
  }
  return 'nonstrict';
};

const mode = detectMode(parseResult.ast.comments);
console.error(`Mode: ${mode}\n`);

const globalEnv = buildGlobalEnvironment();

const classMap = new Map<import('./src/@typings/types').ClassType['name'], import('./src/@typings/types').ClassType>();
for (const [name, type] of globalEnv.robloxClasses) {
  if (type.kind === 'Class') {
    classMap.set(name, type);
  }
}

const result = checkProgram(parseResult.ast, { 'classes': classMap, 'mode': mode });

const errors = result.diagnostics.filter(d => d.severity === 'error');
const warnings = result.diagnostics.filter(d => d.severity === 'warning');

console.error(`Errors: ${errors.length}`);
console.error(`Warnings: ${warnings.length}`);

console.error('\n--- ALL ERRORS ---');
for (const err of errors) {
  console.error(`  Line ${err.range.start.line + 1}: ${err.message}`);
}

if (warnings.length > 0) {
  console.error('\n--- ALL WARNINGS ---');
  for (const warn of warnings) {
    console.error(`  Line ${warn.range.start.line + 1}: ${warn.message}`);
  }
}
