import { defineSymbol } from '@analyzer/environment';
import {
  AnyType,
  BooleanType,
  BufferType,
  NilType,
  NumberType,
  StringType,
  createArrayType,
  createDictionaryType,
  createFunctionType,
  createNumberLiteral,
  createTableType,
  createUnionType,
} from '@analyzer/values';

import type { TypeEnvironment } from '@typings/environment';
import type { DocComment } from '@typings/parser';
import type { FunctionParam, LuauType, PropertyType } from '@typings/types';

const macroDocs = 'https://lura.ph/dashboard/documents/macros';
const attributeDocs = 'https://lura.ph/dashboard/documents/attributes';
const legacyDocs = 'https://lura.ph/dashboard/documents/v14-macros';

const doc = (description: string, deprecated?: string): DocComment => ({
  description,
  'params': [],
  'returns': [],
  'type': undefined,
  'class': undefined,
  'fields': [],
  deprecated,
  'raw': description,
});

/** Adds documented Luraph v15 macros, attributes, and labelled v14 compatibility globals. */
export const addLuraphGlobals = (env: TypeEnvironment): void => {
  const register = (
    name: string,
    type: LuauType,
    description: string,
    reference = macroDocs,
    deprecated?: string,
  ): void =>
    defineSymbol(
      env,
      name,
      type.kind === 'Function' ? { ...type, description } : type,
      'Global',
      false,
      doc(`${description}\n\n[Luraph documentation](${reference})`, deprecated),
    );

  const keyType = createUnionType([NumberType, StringType]);
  const numericKeys = createUnionType([NumberType, createArrayType(NumberType)]);
  const encryptionParams: ReadonlyArray<FunctionParam> = [
    { 'name': 'toEncrypt', 'type': StringType, 'optional': false },
    { 'name': 'key', 'type': keyType, 'optional': true },
    { 'name': 'expression', 'type': AnyType, 'optional': true },
  ];
  const numberParams: ReadonlyArray<FunctionParam> = [
    { 'name': 'toEncrypt', 'type': NumberType, 'optional': false },
    { 'name': 'keyTable', 'type': createDictionaryType(AnyType, NumberType), 'optional': true },
  ];
  const encryptionDescription =
    'v15 supports either one argument, or three arguments with both key and expression. ' +
    'The input string and key must be compile-time constants. The key may be an integer, a 64-character hexadecimal string, ' +
    'or a brace-wrapped hexadecimal table-string. A table-string key requires a 32-entry byte-array runtime expression. ' +
    'The runtime expression must match the compilation key; a mismatch causes undefined behavior.';

  register(
    'LPH_OBFUSCATED',
    BooleanType,
    'Compile-time boolean replaced with true during obfuscation. Conditions using it are simplified and unreachable code is removed. ' +
      'Branch scopes still apply. Put global passthrough macro shims inside if not LPH_OBFUSCATED then; local macro overrides are not removed.',
  );
  register(
    'LPH_LINE',
    NumberType,
    'Compile-time number replaced with the current source line. Does not require line information to be enabled.',
  );
  register(
    'LPH_ASSUME',
    createFunctionType(
      [
        { 'name': 'expression', 'type': NumberType, 'optional': false },
        { 'name': 'expected', 'type': NumberType, 'optional': false },
      ],
      NumberType,
    ),
    'Snapshots a numeric expression and assumes it equals the expected compile-time value within the enclosing function and macro scope. ' +
      'Currently accepts numbers only. Later changes to referenced locals or upvalues do not update the snapshot.',
  );
  register(
    'LPH_OPAQUE',
    createFunctionType([{ 'name': 'type', 'type': BooleanType, 'optional': false }], BooleanType),
    'Generates an opaque predicate resolving to the supplied true or false value. May be combined with LPH_ASSUME.',
  );

  for (const name of ['LPH_ENCSTR', 'LPH_STRENC'])
    register(
      name,
      createFunctionType(encryptionParams, StringType),
      'Available in v14 and v15. v14 accepts one argument only. Encrypts a string constant. Aliases: LPH_ENCSTR, LPH_STRENC. ' +
        encryptionDescription,
    );

  for (const name of ['LPH_ENCBUF', 'LPH_BUFENC'])
    register(
      name,
      createFunctionType(encryptionParams, BufferType),
      'Luraph v15 only. Encrypts a string constant and returns a buffer. Luau targets only. Aliases: LPH_ENCBUF, LPH_BUFENC. ' +
        encryptionDescription,
    );

  for (const name of ['LPH_ENCNUM', 'LPH_NUMENC'])
    register(
      name,
      createFunctionType(numberParams, NumberType),
      'Encrypts a numeric constant, preserving its integer or floating-point representation on the target platform. ' +
        'The optional v15-only keyTable must use constructor indexer syntax: { [runtimeExpression] = expectedInteger }. v14 accepts one argument only. ' +
        'Up to 8 entries are supported; each runtime expression must match its expected integer. Aliases: LPH_ENCNUM, LPH_NUMENC.',
    );

  register(
    'LPH_CRASH',
    createFunctionType([], NilType),
    'Securely crashes the Luraph VM and corrupts its context. Produces no return values.',
  );
  register(
    'LPH_PRECHECK',
    createFunctionType(
      [
        { 'name': 'check', 'type': createFunctionType([], numericKeys), 'optional': false },
        { 'name': 'expectedKey', 'type': numericKeys, 'optional': false },
      ],
      NilType,
    ),
    'Inlines an anonymous, zero-parameter check into the loader. Its result must match the expected integer literal or array of integer literals for bytecode decryption to succeed. ' +
      'Must be a statement and produces no value. No upvalues other than _ENV are allowed. Multiple prechecks may be chained. ' +
      'Nested functions, attributes, and other macros are allowed, but ENCRYPT cannot be used inside a precheck.',
  );

  const rewriteOptions = createTableType(
    new Map([
      ['preset', { 'type': StringType, 'readonly': false, 'optional': true }],
      ['budget', { 'type': StringType, 'readonly': false, 'optional': true }],
      ['context', { 'type': createArrayType(AnyType), 'readonly': false, 'optional': true }],
    ]),
  );
  register(
    'LPH_REWRITE',
    createFunctionType(
      [
        { 'name': 'expression', 'type': NumberType, 'optional': false },
        { 'name': 'options', 'type': createUnionType([StringType, rewriteOptions]), 'optional': true },
      ],
      NumberType,
    ),
    'Rewrites integer/word arithmetic without changing target-width and overflow semantics. Accepts constants and simple local, upvalue, or global identifiers, not member/index accesses. ' +
      'At most 8 identifiers may be captured. Options are a preset string or a constant table with preset, budget, and context. ' +
      'Case-insensitive presets: fast, standard (default), strong, extreme. Budgets: small, medium (default), large. ' +
      'A constant-only expression requires at least 2 context identifiers. Not a replacement for arbitrary floating-point arithmetic.',
  );

  const stackProperties = new Map<string, PropertyType>();
  const stack = createTableType(stackProperties, { 'indexer': { 'keyType': NumberType, 'valueType': AnyType } });
  const packed = createTableType(new Map([['n', { 'type': NumberType, 'readonly': false, 'optional': false }]]), {
    'indexer': { 'keyType': NumberType, 'valueType': AnyType },
  });
  const range: ReadonlyArray<FunctionParam> = [
    { 'name': 'i', 'type': NumberType, 'optional': true },
    { 'name': 'j', 'type': NumberType, 'optional': true },
  ];

  for (const [name, result] of new Map<string, LuauType>([
    ['pack', packed],
    ['unpack', AnyType],
    ['clear', NilType],
  ]))
    stackProperties.set(name, {
      'type': createFunctionType(range, result, {
        'thisType': stack,
        'description': `Compiler proxy ${name}(i?, j?) over an inclusive array range. Omitted bounds select the entire allocation.`,
      }),
      'readonly': true,
      'optional': false,
    });

  register(
    'LPH_STACKALLOC',
    createFunctionType(
      [
        { 'name': 'size', 'type': NumberType, 'optional': false },
        {
          'name': 'zeroOrOne',
          'type': createUnionType([createNumberLiteral(0), createNumberLiteral(1)]),
          'optional': true,
        },
      ],
      stack,
    ),
    'Allocates stack registers without a table allocation. Index base is 1 by default, or 0 when requested. ' +
      'The assigned variable must not escape. Supports indexed reads/writes, #, upvalue capture, inlined calls, and pack/unpack/clear range proxy methods. ' +
      'pack returns a table with an n field; unpack returns individual values; clear assigns nil. ' +
      'Cannot allocate in VM(NONE) functions, but an allocation may be captured and accessed from a non-virtualized function. Proxy methods are compiler operations, not runtime functions.',
  );

  const descriptors: ReadonlyArray<FunctionParam> = [{ 'name': 'attributes', 'type': AnyType, 'optional': true }];
  register(
    'LPH_ATTRIBUTES',
    createFunctionType(descriptors, NilType, { 'isVariadic': true }),
    'Declares compile-time attributes as the first statement in a function, numeric loop body, or outermost file scope. ' +
      'Only the outermost scope may have a single if not LPH_OBFUSCATED then shim guard before this statement. ' +
      'VM/AST applicability and inheritance depend on the selected attribute. Attribute identifiers are compiler syntax, not ordinary runtime APIs.',
    attributeDocs,
  );
  register(
    'ENCRYPT',
    createFunctionType(
      [
        { 'name': 'key', 'type': keyType, 'optional': false },
        { 'name': 'expression', 'type': AnyType, 'optional': false },
      ],
      AnyType,
    ),
    'Function attribute: encrypts the function and decrypts/loads it using a matching runtime expression. Accepts integer, 64-character hexadecimal, or brace-wrapped hexadecimal table-string keys. ' +
      'VM(NONE) children are excluded. A table-string key expects a 32-entry byte array at runtime. A mismatched key causes undefined behavior.',
    attributeDocs,
  );
  register(
    'VM',
    createFunctionType([{ 'name': 'type', 'type': AnyType, 'optional': false }], AnyType),
    'Function attribute: choose NONE (non-virtualized), OPAL (default, balanced VM), or ONYX (security-focused VM). Pass the bare compiler option token.',
    attributeDocs,
  );
  register(
    'PRESET',
    createFunctionType([{ 'name': 'preset', 'type': AnyType, 'optional': false }], AnyType),
    'Inherited VM function attribute: FAST favors performance, BALANCED is the default, and SECURE favors security. Controls bytecode security intensity, not optimization level.',
    attributeDocs,
  );
  register(
    'OPTIMIZE',
    createFunctionType([{ 'name': 'level', 'type': NumberType, 'optional': false }], AnyType),
    'Function attribute: selects optimization level independently of security intensity. The highest level is the default. Use PRESET to change security intensity; available levels depend on Luraph.',
    attributeDocs,
  );
  register(
    'TRANSFORM',
    createFunctionType([{ 'name': 'transformations', 'type': AnyType, 'optional': true }], AnyType, {
      'isVariadic': true,
    }),
    'Inherited AST function attribute: applies rewriting passes to VM(NONE) functions. Supports EXTRACT, CONTROL_FLOW, and REWRITE_NAMECALLS. No transformations are applied by default.',
    attributeDocs,
  );
  register(
    'EXTRACT',
    createFunctionType([{ 'name': 'content', 'type': AnyType, 'optional': true }], AnyType, { 'isVariadic': true }),
    'TRANSFORM option: extracts constants and globals. Select GLOBALS and/or CONSTANTS; all types are extracted by default. Namecall method names require REWRITE_NAMECALLS as well.',
    attributeDocs,
  );
  register(
    'ERROR_HANDLING',
    createFunctionType([{ 'name': 'enabled', 'type': BooleanType, 'optional': false }], AnyType),
    'Inherited VM function attribute: enables original-line error reporting (true by default). False omits the routine for better performance and removes stack-level limitations, but loses original error lines. Not available for non-virtualized functions.',
    attributeDocs,
  );
  register(
    'INLINE',
    createFunctionType([{ 'name': 'checked', 'type': BooleanType, 'optional': true }], AnyType),
    'Function attribute: inline resolvable call sites. Checked inlining is the default; false permits escaping uses. Supports variadics, multiple returns, and upvalues, but not recursive or indirect calls. Inlined code inherits attributes from its destination.',
    attributeDocs,
  );
  register(
    'UNROLL',
    createFunctionType([{ 'name': 'checked', 'type': BooleanType, 'optional': true }], AnyType),
    'Numeric-loop attribute: unrolls loops whose start, limit, and step resolve during compilation. Checked unrolling is the default; false allows optional unrolling. Supports break, continue, and child functions without changing execution order.',
    attributeDocs,
  );

  for (const [name, description] of [
    ['NONE', 'VM option: non-virtualized code.'],
    ['OPAL', 'VM option: the default Luraph virtual machine, balancing performance and security.'],
    ['ONYX', 'VM option: a security-focused virtual machine with a distinct instruction set.'],
    ['FAST', 'PRESET option: low security intensity and high performance.'],
    ['BALANCED', 'PRESET option: default balance of security and performance.'],
    ['SECURE', 'PRESET option: high security intensity at a performance cost.'],
    ['CONTROL_FLOW', 'TRANSFORM option: flatten control flow throughout a non-virtualized function.'],
    ['REWRITE_NAMECALLS', 'TRANSFORM option: rewrite a:b(...) to a.b(a, ...).'],
    ['GLOBALS', 'EXTRACT option: extract global accesses.'],
    ['CONSTANTS', 'EXTRACT option: extract constants.'],
    [
      'NO_UPVALUES',
      'Bare function attribute: add a lightweight zero-upvalue wrapper for legacy API compatibility. Use only when necessary.',
    ],
  ])
    if (name !== undefined && description !== undefined)
      register(
        name,
        AnyType,
        `${description} Compile-time Luraph attribute syntax, not a normal runtime global value.`,
        attributeDocs,
      );

  for (const name of ['LPH_ENCFUNC', 'LPH_FUNCENC'])
    register(
      name,
      createFunctionType(
        [
          { 'name': 'toEncrypt', 'type': AnyType, 'optional': false },
          { 'name': 'encKey', 'type': StringType, 'optional': false },
          { 'name': 'decKey', 'type': StringType, 'optional': false },
        ],
        AnyType,
      ),
      'Supported v14 function-encryption macro; LPH_FUNCENC is an alias. Takes a constant function, a constant 64-character hexadecimal encryption key, ' +
        'and a runtime string decryption key. The encryption key must not occur elsewhere among script constants. ' +
        'The returned function is not automatically called. An incorrect runtime key produces undefined results. ' +
        'For v15, migrate to LPH_ATTRIBUTES(ENCRYPT(key, expression)).',
      legacyDocs,
      'Deprecated for v15 usage only; still supported in v14. Use LPH_ATTRIBUTES(ENCRYPT(key, expression)) when targeting v15.',
    );

  const legacyWrappers: ReadonlyArray<readonly [string, string, string]> = [
    ['LPH_JIT', 'toEnhance', 'Supported v14 optimization wrapper for performance-critical constant functions.'],
    [
      'LPH_JIT_MAX',
      'toEnhance',
      'Supported v14 optimization wrapper; applies more aggressive optimizations than LPH_JIT.',
    ],
    [
      'LPH_NO_VIRTUALIZE',
      'toDevirtualize',
      'Supported v14 non-virtualization wrapper. Exposes minified code, raw strings, and constants; ordinary Lua syntax, register, and recursion limits apply.',
    ],
    [
      'LPH_NO_UPVALUES',
      'toFix',
      'Supported v14 wrapper creating a zero-upvalue proxy. Incompatible with Static Environment and platforms using _ENV.',
    ],
  ];

  for (const [name, parameter, description] of legacyWrappers)
    register(
      name,
      createFunctionType([{ 'name': parameter, 'type': AnyType, 'optional': false }], AnyType),
      description +
        ' Returns a function without automatically calling it. The input must be a constant function. ' +
        'For v15, review the VM, PRESET, OPTIMIZE, and NO_UPVALUES attributes instead of using this wrapper.',
      legacyDocs,
      'Deprecated for v15 usage only; still supported in v14. Use the appropriate LPH_ATTRIBUTES declaration when targeting v15.',
    );
};
