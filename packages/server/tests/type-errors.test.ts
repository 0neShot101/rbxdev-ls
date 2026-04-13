import { parse } from '@parser/parser';
import { checkProgram } from '@typings/checker';
import { typeToString } from '@typings/types';
import { describe, expect, test } from 'bun:test';

import type { TypeDiagnostic } from '@typings/checker';
import type { LuauType } from '@typings/types';

const getDiagnostics = (code: string, mode: 'strict' | 'nonstrict' = 'strict'): ReadonlyArray<TypeDiagnostic> => {
  const result = parse(code);
  const typeCheckResult = checkProgram(result.ast, { 'mode': mode });
  return typeCheckResult.diagnostics;
};

const expectError = (code: string, errorCode: string, messageSubstring?: string): void => {
  const diags = getDiagnostics(code);
  const matches = diags.filter(d => d.code === errorCode);
  expect(matches.length).toBeGreaterThanOrEqual(1);
  if (messageSubstring !== undefined) {
    const hasMatch = matches.some(d => d.message.includes(messageSubstring));
    expect(hasMatch).toBe(true);
  }
};

const expectNoErrors = (code: string): void => {
  const diags = getDiagnostics(code);
  const errors = diags.filter(d => d.severity === 'error');
  expect(errors.length).toBe(0);
};

const getSymbolType = (code: string, varName: string): LuauType | undefined => {
  const result = parse(code);
  if (result.errors.length > 0) return undefined;
  const typeCheckResult = checkProgram(result.ast);
  return typeCheckResult.allSymbols.get(varName);
};

describe('Type Errors (E002): Assignment Type Mismatches', () => {
  test('boolean assigned to string annotation', () => {
    expectError('local x: string = false', 'E002', 'not assignable');
  });

  test('string assigned to number annotation', () => {
    expectError('local x: number = "hello"', 'E002', 'not assignable');
  });

  test('number assigned to string annotation', () => {
    expectError('local x: string = 42', 'E002', 'not assignable');
  });

  test('number assigned to boolean annotation', () => {
    expectError('local x: boolean = 123', 'E002', 'not assignable');
  });

  test('string assigned to boolean annotation', () => {
    expectError('local x: boolean = "true"', 'E002', 'not assignable');
  });

  test('boolean assigned to number annotation', () => {
    expectError('local x: number = true', 'E002', 'not assignable');
  });

  test('nil assigned to number annotation', () => {
    expectError('local x: number = nil', 'E002', 'not assignable');
  });

  test('nil assigned to string annotation', () => {
    expectError('local x: string = nil', 'E002', 'not assignable');
  });

  test('nil assigned to boolean annotation', () => {
    expectError('local x: boolean = nil', 'E002', 'not assignable');
  });

  test('table assigned to string annotation', () => {
    expectError('local x: string = {}', 'E002', 'not assignable');
  });

  test('function assigned to number annotation', () => {
    expectError('local x: number = function() end', 'E002', 'not assignable');
  });

  test('string assigned to table annotation', () => {
    expectError('local x: { name: string } = "hello"', 'E002', 'not assignable');
  });

  test('reassignment with wrong type', () => {
    expectError('local x: number = 5\nx = "oops"', 'E002', 'not assignable');
  });

  test('multiple declarations with one wrong type', () => {
    const diags = getDiagnostics('local a: number, b: string = "wrong", 42');
    const errors = diags.filter(d => d.code === 'E002');
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Type Errors (E002): Valid Assignments (no errors)', () => {
  test('number to number', () => {
    expectNoErrors('local x: number = 42');
  });

  test('string to string', () => {
    expectNoErrors('local x: string = "hello"');
  });

  test('boolean to boolean', () => {
    expectNoErrors('local x: boolean = true');
  });

  test('nil to optional type', () => {
    expectNoErrors('local x: number? = nil');
  });

  test('number to optional number', () => {
    expectNoErrors('local x: number? = 42');
  });

  test('string to union of string | number', () => {
    expectNoErrors('local x: string | number = "hello"');
  });

  test('number to union of string | number', () => {
    expectNoErrors('local x: string | number = 42');
  });

  test('table to matching table type', () => {
    expectNoErrors('type Point = { x: number, y: number }\nlocal p: Point = { x = 1, y = 2 }');
  });

  test('function to function type', () => {
    expectNoErrors('local fn: (number) -> string = function(n: number): string return tostring(n) end');
  });

  test('any accepts anything', () => {
    expectNoErrors('local x: any = 42');
    expectNoErrors('local y: any = "hello"');
    expectNoErrors('local z: any = true');
    expectNoErrors('local w: any = nil');
  });
});

describe('Type Errors (E001): Break/Continue Outside Loop', () => {
  test('break at top level', () => {
    expectError('break', 'E001', 'break');
  });

  test('continue at top level', () => {
    expectError('continue', 'E001', 'continue');
  });

  test('break inside function but outside loop', () => {
    expectError('local function f()\n  break\nend', 'E001', 'break');
  });

  test('break inside loop is valid', () => {
    expectNoErrors('while true do\n  break\nend');
  });

  test('continue inside loop is valid', () => {
    expectNoErrors('for i = 1, 10 do\n  continue\nend');
  });

  test('break inside nested function in loop errors', () => {
    expectError('while true do\n  local function f()\n    break\n  end\nend', 'E001');
  });
});

describe('Type Errors (E003): Compound Assignment Operator Mismatches', () => {
  test('+= with string target', () => {
    expectError('local x: string = "hi"\nx += 1', 'E003', 'numeric operand');
  });

  test('-= with boolean target', () => {
    expectError('local x: boolean = true\nx -= 1', 'E003', 'numeric operand');
  });

  test('*= with string value', () => {
    expectError('local x: number = 5\nx *= "hello"', 'E003', 'numeric operand');
  });

  test('/= with boolean value', () => {
    expectError('local x: number = 5\nx /= true', 'E003', 'numeric operand');
  });

  test('+= with number is valid', () => {
    expectNoErrors('local x: number = 5\nx += 10');
  });

  test('..= with number is valid', () => {
    expectNoErrors('local x: string = "hi"\nx ..= " world"');
  });
});

describe('Type Errors (E004): For Loop Operand Types', () => {
  test('string as for loop start', () => {
    expectError('for i = "start", 10 do end', 'E004', 'start must be a number');
  });

  test('string as for loop end', () => {
    expectError('for i = 1, "end" do end', 'E004', 'end must be a number');
  });

  test('boolean as for loop step', () => {
    expectError('for i = 1, 10, true do end', 'E004', 'step must be a number');
  });

  test('table as for loop start', () => {
    expectError('for i = {}, 10 do end', 'E004', 'start must be a number');
  });

  test('valid numeric for loop', () => {
    expectNoErrors('for i = 1, 10 do end');
  });

  test('valid numeric for loop with step', () => {
    expectNoErrors('for i = 1, 10, 2 do end');
  });
});

describe('Type Errors (E005): Return Type Mismatches', () => {
  test('returning string from number function', () => {
    expectError('local function f(): number\n  return "hello"\nend', 'E005', 'not assignable');
  });

  test('returning number from string function', () => {
    expectError('local function f(): string\n  return 42\nend', 'E005', 'not assignable');
  });

  test('returning boolean from number function', () => {
    expectError('local function f(): number\n  return true\nend', 'E005', 'not assignable');
  });

  test('returning nil from number function', () => {
    expectError('local function f(): number\n  return nil\nend', 'E005', 'not assignable');
  });

  test('returning nothing from number function', () => {
    expectError('local function f(): number\n  return\nend', 'E005', 'not assignable');
  });

  test('valid return type', () => {
    expectNoErrors('local function f(): number\n  return 42\nend');
  });

  test('valid string return', () => {
    expectNoErrors('local function f(): string\n  return "hello"\nend');
  });

  test('returning nil from void function', () => {
    expectNoErrors('local function f()\n  return nil\nend');
  });
});

describe('Type Errors (E006): Unknown Identifiers (strict mode)', () => {
  test('undeclared variable', () => {
    expectError('local x = unknownVar', 'E006', 'Unknown identifier');
  });

  test('undeclared variable in expression', () => {
    expectError('local x = 1 + y', 'E006', 'Unknown identifier');
  });

  test('declared variable is valid', () => {
    expectNoErrors('local x = 42\nlocal y = x');
  });

  test('nonstrict mode allows undeclared variables', () => {
    const diags = getDiagnostics('local x = unknownVar', 'nonstrict');
    const errors = diags.filter(d => d.code === 'E006');
    expect(errors.length).toBe(0);
  });
});

describe('Type Errors (E007): Non-Callable Types', () => {
  test('calling a number', () => {
    expectError('local x: number = 42\nx()', 'E007', 'not callable');
  });

  test('calling a string', () => {
    expectError('local x: string = "hello"\nx()', 'E007', 'not callable');
  });

  test('calling a boolean', () => {
    expectError('local x: boolean = true\nx()', 'E007', 'not callable');
  });

  test('calling a function is valid', () => {
    expectNoErrors('local f = function() end\nf()');
  });
});

describe('Type Errors (E010): Unknown Type References (strict mode)', () => {
  test('unknown type in annotation', () => {
    expectError('local x: FooBarBaz = nil', 'E010', 'Unknown type');
  });

  test('unknown type in function param', () => {
    expectError('local function f(x: NonExistentType) end', 'E010', 'Unknown type');
  });

  test('unknown type in function return', () => {
    expectError('local function f(): MadeUpType\n  return nil\nend', 'E010', 'Unknown type');
  });

  test('known types are valid', () => {
    expectNoErrors('local x: number = 42');
    expectNoErrors('local y: string = "hi"');
    expectNoErrors('local z: boolean = true');
  });

  test('type alias makes type known', () => {
    expectNoErrors('type Foo = number\nlocal x: Foo = 42');
  });

  test('nonstrict mode allows unknown types', () => {
    const diags = getDiagnostics('local x: FooBarBaz = nil', 'nonstrict');
    const errors = diags.filter(d => d.code === 'E010');
    expect(errors.length).toBe(0);
  });
});

describe('Type Errors (E011): Invalid Operator Usage', () => {
  test('adding strings', () => {
    expectError('local x = "hello" + "world"', 'E011', 'cannot be applied');
  });

  test('subtracting booleans', () => {
    expectError('local x = true - false', 'E011', 'cannot be applied');
  });

  test('multiplying string by boolean', () => {
    expectError('local x = "hi" * true', 'E011', 'cannot be applied');
  });

  test('dividing strings', () => {
    expectError('local x = "a" / "b"', 'E011', 'cannot be applied');
  });

  test('numeric operations are valid', () => {
    expectNoErrors('local x = 1 + 2');
    expectNoErrors('local y = 10 - 5');
    expectNoErrors('local z = 3 * 4');
    expectNoErrors('local w = 8 / 2');
  });
});

describe('Type Errors (E013): Missing Return on All Paths (strict mode)', () => {
  test('function with declared return but no return statement', () => {
    expectError('local function f(): number\nend', 'E013', 'must return a value on all code paths');
  });

  test('function with return on all paths is valid', () => {
    expectNoErrors('local function f(): number\n  return 42\nend');
  });

  test('void function without return is valid', () => {
    expectNoErrors('local function f()\nend');
  });
});

describe('Type Inference Basics', () => {
  test('number literal infers number', () => {
    const type = getSymbolType('local x = 42', 'x');
    expect(type).toBeDefined();
    expect(type!.kind).toBe('Primitive');
    if (type!.kind === 'Primitive') expect(type!.name).toBe('number');
  });

  test('string literal infers string', () => {
    const type = getSymbolType('local x = "hello"', 'x');
    expect(type).toBeDefined();
    expect(type!.kind).toBe('Primitive');
    if (type!.kind === 'Primitive') expect(type!.name).toBe('string');
  });

  test('boolean literal infers boolean', () => {
    const type = getSymbolType('local x = true', 'x');
    expect(type).toBeDefined();
    expect(type!.kind).toBe('Primitive');
    if (type!.kind === 'Primitive') expect(type!.name).toBe('boolean');
  });

  test('nil literal widens to any for mutable variable', () => {
    const type = getSymbolType('local x = nil', 'x');
    expect(type).toBeDefined();
    expect(type!.kind).toBe('Any');
  });

  test('table constructor infers table', () => {
    const type = getSymbolType('local t = { a = 1, b = "hi" }', 't');
    expect(type).toBeDefined();
    expect(type!.kind).toBe('Table');
  });

  test('function expression infers function', () => {
    const type = getSymbolType('local f = function(x: number): string return "" end', 'f');
    expect(type).toBeDefined();
    expect(type!.kind).toBe('Function');
  });

  test('binary addition infers number', () => {
    const type = getSymbolType('local x = 1 + 2', 'x');
    expect(type).toBeDefined();
    if (type!.kind === 'Primitive') expect(type!.name).toBe('number');
  });

  test('string concatenation infers string', () => {
    const type = getSymbolType('local x = "a" .. "b"', 'x');
    expect(type).toBeDefined();
    if (type!.kind === 'Primitive') expect(type!.name).toBe('string');
  });

  test('comparison infers boolean', () => {
    const type = getSymbolType('local x = 1 > 2', 'x');
    expect(type).toBeDefined();
    if (type!.kind === 'Primitive') expect(type!.name).toBe('boolean');
  });

  test('unary not infers boolean', () => {
    const type = getSymbolType('local x = not true', 'x');
    expect(type).toBeDefined();
    if (type!.kind === 'Primitive') expect(type!.name).toBe('boolean');
  });

  test('unary minus infers number', () => {
    const type = getSymbolType('local x = -42', 'x');
    expect(type).toBeDefined();
  });

  test('length operator infers number', () => {
    const type = getSymbolType('local x = #"hello"', 'x');
    expect(type).toBeDefined();
    if (type!.kind === 'Primitive') expect(type!.name).toBe('number');
  });
});

describe('Type Annotations', () => {
  test('explicit number annotation', () => {
    const type = getSymbolType('local x: number = 42', 'x');
    expect(type).toBeDefined();
    expect(typeToString(type!)).toBe('number');
  });

  test('explicit string annotation', () => {
    const type = getSymbolType('local x: string = "hi"', 'x');
    expect(type).toBeDefined();
    expect(typeToString(type!)).toBe('string');
  });

  test('explicit boolean annotation', () => {
    const type = getSymbolType('local x: boolean = true', 'x');
    expect(type).toBeDefined();
    expect(typeToString(type!)).toBe('boolean');
  });

  test('optional type annotation', () => {
    const type = getSymbolType('local x: number? = nil', 'x');
    expect(type).toBeDefined();
    const str = typeToString(type!);
    expect(str.includes('number')).toBe(true);
  });

  test('union type annotation', () => {
    const type = getSymbolType('local x: string | number = 42', 'x');
    expect(type).toBeDefined();
    const str = typeToString(type!);
    expect(str.includes('string') || str.includes('number')).toBe(true);
  });

  test('table type annotation', () => {
    const type = getSymbolType('local x: { name: string, age: number } = { name = "test", age = 1 }', 'x');
    expect(type).toBeDefined();
    expect(type!.kind).toBe('Table');
  });

  test('function type annotation', () => {
    const type = getSymbolType('local f: (number, string) -> boolean = function(a, b) return true end', 'f');
    expect(type).toBeDefined();
    expect(type!.kind).toBe('Function');
  });

  test('array type annotation', () => {
    const type = getSymbolType('local x: { number } = { 1, 2, 3 }', 'x');
    expect(type).toBeDefined();
    expect(type!.kind).toBe('Table');
  });
});

describe('Type Aliases', () => {
  test('simple type alias resolves', () => {
    expectNoErrors('type MyNum = number\nlocal x: MyNum = 42');
  });

  test('table type alias resolves', () => {
    expectNoErrors('type Point = { x: number, y: number }\nlocal p: Point = { x = 1, y = 2 }');
  });

  test('union type alias resolves', () => {
    expectNoErrors('type ID = string | number\nlocal id: ID = "abc"');
  });

  test('optional type alias resolves', () => {
    expectNoErrors('type MaybeNum = number?\nlocal x: MaybeNum = nil');
  });

  test('type alias with wrong value errors', () => {
    expectError('type MyNum = number\nlocal x: MyNum = "wrong"', 'E002');
  });

  test('nested type alias', () => {
    expectNoErrors('type A = number\ntype B = A\nlocal x: B = 42');
  });
});

describe('Function Type Checking', () => {
  test('typed parameters with correct types', () => {
    expectNoErrors('local function add(a: number, b: number): number\n  return a + b\nend');
  });

  test('function with return type inference', () => {
    const type = getSymbolType('local function f()\n  return 42\nend', 'f');
    expect(type).toBeDefined();
    expect(type!.kind).toBe('Function');
  });

  test('function parameters tracked in allSymbols', () => {
    const result = parse('local function f(x: number, y: string) end');
    const typeCheckResult = checkProgram(result.ast);
    expect(typeCheckResult.allSymbols.has('x')).toBe(true);
    expect(typeCheckResult.allSymbols.has('y')).toBe(true);
  });

  test('nested function scoping', () => {
    expectNoErrors(`
      local function outer(): number
        local function inner(): string
          return "hi"
        end
        return 42
      end
    `);
  });

  test('nested function with wrong return type', () => {
    expectError(
      `local function outer(): number
        local function inner(): string
          return 42
        end
        return 1
      end`,
      'E005',
    );
  });
});

describe('Nonstrict Mode Behavior', () => {
  test('nonstrict allows type mismatches', () => {
    const diags = getDiagnostics('local x: number = "hello"', 'nonstrict');
    const errors = diags.filter(d => d.code === 'E002');
    expect(errors.length).toBe(0);
  });

  test('nonstrict allows undeclared variables', () => {
    const diags = getDiagnostics('local x = someRandomVar', 'nonstrict');
    const errors = diags.filter(d => d.code === 'E006');
    expect(errors.length).toBe(0);
  });

  test('nonstrict allows unknown types', () => {
    const diags = getDiagnostics('local x: WhateverType = nil', 'nonstrict');
    const errors = diags.filter(d => d.code === 'E010');
    expect(errors.length).toBe(0);
  });

  test('nonstrict still catches break outside loop', () => {
    const diags = getDiagnostics('break', 'nonstrict');
    const errors = diags.filter(d => d.code === 'E001');
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  test('nonstrict skips for loop type errors', () => {
    const diags = getDiagnostics('for i = "x", 10 do end', 'nonstrict');
    const errors = diags.filter(d => d.code === 'E004');
    expect(errors.length).toBe(0);
  });
});

describe('Complex Type Error Scenarios', () => {
  test('type cast with field mismatch', () => {
    const code = 'local x = { name = 42 } :: { name: string }';
    const diags = getDiagnostics(code);
    const errors = diags.filter(d => d.code === 'E002');
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  test('valid type cast', () => {
    expectNoErrors('local x = { name = "hi" } :: { name: string }');
  });

  test('multiple errors in one program', () => {
    const code = `
      local a: number = "wrong"
      local b: string = true
      local c: boolean = 42
    `;
    const diags = getDiagnostics(code);
    const typeErrors = diags.filter(d => d.code === 'E002');
    expect(typeErrors.length).toBeGreaterThanOrEqual(3);
  });

  test('error in nested scope', () => {
    expectError(
      `if true then
        local x: number = "bad"
      end`,
      'E002',
    );
  });

  test('error in while loop body', () => {
    expectError(
      `while true do
        local x: string = 42
        break
      end`,
      'E002',
    );
  });

  test('error in for loop body', () => {
    expectError(
      `for i = 1, 10 do
        local x: boolean = "nope"
      end`,
      'E002',
    );
  });

  test('chained wrong assignments', () => {
    const code = `
      local x: number = 1
      x = "string"
      x = true
    `;
    const diags = getDiagnostics(code);
    const typeErrors = diags.filter(d => d.code === 'E002');
    expect(typeErrors.length).toBeGreaterThanOrEqual(2);
  });

  test('if-expression types', () => {
    const type = getSymbolType('local x = if true then 42 else "hello"', 'x');
    expect(type).toBeDefined();
  });

  test('interpolated string infers string', () => {
    const type = getSymbolType('local x = `hello {42}`', 'x');
    expect(type).toBeDefined();
    if (type!.kind === 'Primitive') expect(type!.name).toBe('string');
  });
});

describe('Diagnostic Metadata', () => {
  test('diagnostics have correct severity', () => {
    const diags = getDiagnostics('local x: number = "wrong"');
    const error = diags.find(d => d.code === 'E002');
    expect(error).toBeDefined();
    expect(error!.severity).toBe('error');
  });

  test('diagnostics have range information', () => {
    const diags = getDiagnostics('local x: number = "wrong"');
    const error = diags.find(d => d.code === 'E002');
    expect(error).toBeDefined();
    expect(error!.range).toBeDefined();
    expect(error!.range.start).toBeDefined();
    expect(error!.range.end).toBeDefined();
  });

  test('diagnostics have code field', () => {
    const diags = getDiagnostics('local x: number = "wrong"');
    const error = diags.find(d => d.code === 'E002');
    expect(error).toBeDefined();
    expect(error!.code).toBe('E002');
  });

  test('diagnostics have message field', () => {
    const diags = getDiagnostics('local x: number = "wrong"');
    const error = diags.find(d => d.code === 'E002');
    expect(error).toBeDefined();
    expect(error!.message.length).toBeGreaterThan(0);
  });

  test('break error has line info', () => {
    const diags = getDiagnostics('break');
    const error = diags.find(d => d.code === 'E001');
    expect(error).toBeDefined();
    expect(error!.range.start.line).toBe(1);
  });
});
