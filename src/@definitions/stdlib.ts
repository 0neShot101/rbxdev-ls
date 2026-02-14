/**
 * Luau Standard Library Type Definitions
 *
 * This module provides type definitions for the Luau standard library, including:
 * - math: Mathematical functions (abs, sin, cos, random, etc.)
 * - string: String manipulation functions (sub, find, format, etc.)
 * - table: Table manipulation functions (insert, remove, sort, etc.)
 * - coroutine: Coroutine management functions (create, resume, yield, etc.)
 * - bit32: Bitwise operations (band, bor, bxor, lshift, rshift, etc.)
 * - utf8: UTF-8 string utilities (char, codepoint, len, etc.)
 * - os: Operating system functions (clock, date, time)
 * - buffer: Binary data manipulation (create, read/write operations)
 * - task: Task scheduling functions (spawn, delay, wait, defer)
 * - debug: Debugging utilities (info, traceback, profilebegin)
 */

import {
  AnyType,
  BooleanType,
  createFunctionType,
  createTableType,
  type FunctionParam,
  type LuauType,
  NilType,
  NumberType,
  StringType,
} from '@typings/types';

/**
 * Creates a function parameter definition.
 *
 * @param name - The name of the parameter
 * @param type - The Luau type of the parameter
 * @param optional - Whether the parameter is optional (defaults to false)
 * @returns A FunctionParam object
 */
const createParam = (name: string, type: LuauType, optional = false): FunctionParam => ({
  name,
  type,
  optional,
});

/**
 * Creates a method type (function type) with the given parameters and return type.
 *
 * @param params - Array of function parameters
 * @param returnType - The return type of the method
 * @param isVariadic - Whether the method accepts variadic arguments (defaults to false)
 * @param description - A short description of the method for documentation
 * @returns A FunctionType representing the method
 */
const createMethod = (params: FunctionParam[], returnType: LuauType, isVariadic = false, description?: string) =>
  createFunctionType(params, returnType, { isVariadic, ...(description !== undefined ? { description } : {}) });

/**
 * Creates the Luau math library type definition.
 *
 * The math library provides mathematical functions including:
 * - Trigonometric: sin, cos, tan, asin, acos, atan, atan2
 * - Hyperbolic: sinh, cosh, tanh
 * - Rounding: ceil, floor, round, sign
 * - Exponential: exp, log, log10, pow, sqrt
 * - Utility: abs, clamp, min, max, fmod, modf, frexp, ldexp
 * - Random: random, randomseed
 * - Luau-specific: noise (Perlin noise)
 * - Constants: pi, huge
 *
 * @returns A TableType representing the math library
 */
export const createMathLibrary = (): LuauType =>
  createTableType(
    new Map([
      [
        'abs',
        {
          'type': createMethod([createParam('x', NumberType)], NumberType, false, 'Returns the absolute value of x'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'acos',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the arc cosine of x in radians',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'asin',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the arc sine of x in radians',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'atan',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the arc tangent of x in radians',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'atan2',
        {
          'type': createMethod(
            [createParam('y', NumberType), createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the arc tangent of y/x in radians, using the signs of both to determine the quadrant',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'ceil',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the smallest integer greater than or equal to x',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'clamp',
        {
          'type': createMethod(
            [createParam('x', NumberType), createParam('min', NumberType), createParam('max', NumberType)],
            NumberType,
            false,
            'Returns x clamped between min and max',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'cos',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the cosine of x (in radians)',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'cosh',
        {
          'type': createMethod([createParam('x', NumberType)], NumberType, false, 'Returns the hyperbolic cosine of x'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'deg',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Converts angle x from radians to degrees',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'exp',
        {
          'type': createMethod([createParam('x', NumberType)], NumberType, false, 'Returns e raised to the power x'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'floor',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the largest integer less than or equal to x',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'fmod',
        {
          'type': createMethod(
            [createParam('x', NumberType), createParam('y', NumberType)],
            NumberType,
            false,
            'Returns the remainder of x divided by y',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'frexp',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns m and e such that x = m * 2^e',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      ['huge', { 'type': NumberType, 'readonly': true, 'optional': false }],
      [
        'ldexp',
        {
          'type': createMethod(
            [createParam('m', NumberType), createParam('e', NumberType)],
            NumberType,
            false,
            'Returns m * 2^e',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'log',
        {
          'type': createMethod(
            [createParam('x', NumberType), createParam('base', NumberType, true)],
            NumberType,
            false,
            'Returns the logarithm of x in the given base (default e)',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'log10',
        {
          'type': createMethod([createParam('x', NumberType)], NumberType, false, 'Returns the base-10 logarithm of x'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'max',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            true,
            'Returns the maximum value among the arguments',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      ['maxinteger', { 'type': NumberType, 'readonly': true, 'optional': false }],
      [
        'min',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            true,
            'Returns the minimum value among the arguments',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'modf',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the integer and fractional parts of x',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'noise',
        {
          'type': createMethod(
            [createParam('x', NumberType), createParam('y', NumberType, true), createParam('z', NumberType, true)],
            NumberType,
            false,
            'Returns a Perlin noise value for the given coordinates',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      ['pi', { 'type': NumberType, 'readonly': true, 'optional': false }],
      [
        'pow',
        {
          'type': createMethod(
            [createParam('x', NumberType), createParam('y', NumberType)],
            NumberType,
            false,
            'Returns x raised to the power y',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'rad',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Converts angle x from degrees to radians',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'random',
        {
          'type': createMethod(
            [createParam('m', NumberType, true), createParam('n', NumberType, true)],
            NumberType,
            false,
            'Returns a pseudo-random number. With no arguments returns [0,1), with one argument returns [1,n], with two returns [m,n]',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'randomseed',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NilType,
            false,
            'Sets the seed for the pseudo-random number generator',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'round',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns x rounded to the nearest integer',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'sign',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns -1, 0, or 1 depending on the sign of x',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'sin',
        {
          'type': createMethod([createParam('x', NumberType)], NumberType, false, 'Returns the sine of x (in radians)'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'sinh',
        {
          'type': createMethod([createParam('x', NumberType)], NumberType, false, 'Returns the hyperbolic sine of x'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'sqrt',
        {
          'type': createMethod([createParam('x', NumberType)], NumberType, false, 'Returns the square root of x'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'tan',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the tangent of x (in radians)',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'tanh',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the hyperbolic tangent of x',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

/**
 * Creates the Luau string library type definition.
 *
 * The string library provides string manipulation functions including:
 * - Character conversion: byte, char
 * - Pattern matching: find, match, gmatch, gsub
 * - Formatting: format
 * - Case conversion: lower, upper
 * - Substring: sub, len, reverse
 * - Repetition: rep
 * - Binary packing: pack, packsize, unpack
 * - Luau-specific: split
 *
 * @returns A TableType representing the string library
 */
export const createStringLibrary = (): LuauType =>
  createTableType(
    new Map([
      [
        'byte',
        {
          'type': createMethod(
            [createParam('s', StringType), createParam('i', NumberType, true), createParam('j', NumberType, true)],
            NumberType,
            true,
            'Returns the numeric byte codes of characters in the string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'char',
        {
          'type': createMethod(
            [createParam('codes', NumberType)],
            StringType,
            true,
            'Returns a string from the given byte values',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'find',
        {
          'type': createMethod(
            [
              createParam('s', StringType),
              createParam('pattern', StringType),
              createParam('init', NumberType, true),
              createParam('plain', BooleanType, true),
            ],
            { 'kind': 'Union', 'types': [NumberType, NilType] },
            false,
            'Searches for the first match of pattern in string s',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'format',
        {
          'type': createMethod(
            [createParam('formatstring', StringType)],
            StringType,
            true,
            'Returns a formatted string following the format string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'gmatch',
        {
          'type': createMethod(
            [createParam('s', StringType), createParam('pattern', StringType)],
            createFunctionType([], StringType),
            false,
            'Returns an iterator function that returns the next match from string s each time it is called',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'gsub',
        {
          'type': createMethod(
            [
              createParam('s', StringType),
              createParam('pattern', StringType),
              createParam('repl', {
                'kind': 'Union',
                'types': [StringType, createTableType(new Map()), createFunctionType([], StringType)],
              }),
              createParam('n', NumberType, true),
            ],
            StringType,
            false,
            'Returns a copy of s with all occurrences of pattern replaced by repl',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'len',
        {
          'type': createMethod([createParam('s', StringType)], NumberType, false, 'Returns the length of the string'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'lower',
        {
          'type': createMethod(
            [createParam('s', StringType)],
            StringType,
            false,
            'Returns a copy of the string with all uppercase letters changed to lowercase',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'match',
        {
          'type': createMethod(
            [createParam('s', StringType), createParam('pattern', StringType), createParam('init', NumberType, true)],
            { 'kind': 'Union', 'types': [StringType, NilType] },
            false,
            'Looks for the first match of pattern in string s',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'pack',
        {
          'type': createMethod(
            [createParam('fmt', StringType)],
            StringType,
            true,
            'Returns a binary string containing the values packed according to the format string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'packsize',
        {
          'type': createMethod(
            [createParam('fmt', StringType)],
            NumberType,
            false,
            'Returns the size of a string resulting from string.pack with the given format',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'rep',
        {
          'type': createMethod(
            [createParam('s', StringType), createParam('n', NumberType), createParam('sep', StringType, true)],
            StringType,
            false,
            'Returns a string that is n copies of string s separated by sep',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'reverse',
        {
          'type': createMethod(
            [createParam('s', StringType)],
            StringType,
            false,
            'Returns a reversed copy of the string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'split',
        {
          'type': createMethod(
            [createParam('s', StringType), createParam('separator', StringType, true)],
            createTableType(new Map(), { 'indexer': { 'keyType': NumberType, 'valueType': StringType } }),
            false,
            'Splits the string by the given separator and returns a table of substrings',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'sub',
        {
          'type': createMethod(
            [createParam('s', StringType), createParam('i', NumberType), createParam('j', NumberType, true)],
            StringType,
            false,
            'Returns a substring from index i to j',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'unpack',
        {
          'type': createMethod(
            [createParam('fmt', StringType), createParam('s', StringType), createParam('pos', NumberType, true)],
            AnyType,
            true,
            'Returns the values packed in the binary string according to the format string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'upper',
        {
          'type': createMethod(
            [createParam('s', StringType)],
            StringType,
            false,
            'Returns a copy of the string with all lowercase letters changed to uppercase',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

/**
 * Creates the Luau table library type definition.
 *
 * The table library provides table manipulation functions including:
 * - Modification: insert, remove, clear, sort
 * - Creation: create, clone, pack
 * - Traversal: concat, move, unpack
 * - Search: find
 * - Utility: getn, maxn
 * - Luau-specific: freeze, isfrozen
 *
 * @returns A TableType representing the table library
 */
export const createTableLibrary = (): LuauType =>
  createTableType(
    new Map([
      [
        'clear',
        {
          'type': createMethod(
            [createParam('t', createTableType(new Map()))],
            NilType,
            false,
            'Removes all elements from a table',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'clone',
        {
          'type': createMethod(
            [createParam('t', createTableType(new Map()))],
            createTableType(new Map()),
            false,
            'Returns a shallow copy of the table',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'concat',
        {
          'type': createMethod(
            [
              createParam('t', createTableType(new Map())),
              createParam('sep', StringType, true),
              createParam('i', NumberType, true),
              createParam('j', NumberType, true),
            ],
            StringType,
            false,
            'Returns a string with table elements joined by the separator',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'create',
        {
          'type': createMethod(
            [createParam('count', NumberType), createParam('value', AnyType, true)],
            createTableType(new Map()),
            false,
            'Creates a new table with count array elements, optionally initialized to value',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'find',
        {
          'type': createMethod(
            [
              createParam('t', createTableType(new Map())),
              createParam('value', AnyType),
              createParam('init', NumberType, true),
            ],
            { 'kind': 'Union', 'types': [NumberType, NilType] },
            false,
            'Returns the index of the first occurrence of value in the table',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'freeze',
        {
          'type': createMethod(
            [createParam('t', createTableType(new Map()))],
            createTableType(new Map()),
            false,
            'Makes a table read-only, preventing any modifications',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'getn',
        {
          'type': createMethod(
            [createParam('t', createTableType(new Map()))],
            NumberType,
            false,
            'Returns the number of elements in the array portion of the table',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'insert',
        {
          'type': createMethod(
            [
              createParam('t', createTableType(new Map())),
              createParam('pos', NumberType),
              createParam('value', AnyType, true),
            ],
            NilType,
            false,
            'Inserts value at position pos in the table',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'isfrozen',
        {
          'type': createMethod(
            [createParam('t', createTableType(new Map()))],
            BooleanType,
            false,
            'Returns true if the table is frozen (read-only)',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'maxn',
        {
          'type': createMethod(
            [createParam('t', createTableType(new Map()))],
            NumberType,
            false,
            'Returns the largest positive numeric index of the table',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'move',
        {
          'type': createMethod(
            [
              createParam('src', createTableType(new Map())),
              createParam('a', NumberType),
              createParam('b', NumberType),
              createParam('t', NumberType),
              createParam('dst', createTableType(new Map()), true),
            ],
            createTableType(new Map()),
            false,
            'Copies elements from table a1 to table a2',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'pack',
        {
          'type': createMethod(
            [],
            createTableType(new Map()),
            true,
            'Returns a new table with all arguments stored into keys 1, 2, etc.',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'remove',
        {
          'type': createMethod(
            [createParam('t', createTableType(new Map())), createParam('pos', NumberType, true)],
            AnyType,
            false,
            'Removes and returns the element at position pos',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'sort',
        {
          'type': createMethod(
            [
              createParam('t', createTableType(new Map())),
              createParam(
                'comp',
                createFunctionType([createParam('a', AnyType), createParam('b', AnyType)], BooleanType),
                true,
              ),
            ],
            NilType,
            false,
            'Sorts table elements in place using the given comparison function',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'unpack',
        {
          'type': createMethod(
            [
              createParam('t', createTableType(new Map())),
              createParam('i', NumberType, true),
              createParam('j', NumberType, true),
            ],
            AnyType,
            true,
            'Returns the elements from the table',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

/**
 * Creates the Luau coroutine library type definition.
 *
 * The coroutine library provides coroutine management functions including:
 * - Creation: create, wrap
 * - Execution: resume, yield
 * - State: status, running, isyieldable
 * - Cleanup: close
 *
 * @returns A TableType representing the coroutine library
 */
export const createCoroutineLibrary = (): LuauType =>
  createTableType(
    new Map([
      [
        'close',
        {
          'type': createMethod(
            [createParam('co', { 'kind': 'Primitive', 'name': 'thread' })],
            BooleanType,
            false,
            'Closes a coroutine, preventing it from being resumed',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'create',
        {
          'type': createMethod(
            [createParam('f', createFunctionType([], AnyType, { 'isVariadic': true }))],
            { 'kind': 'Primitive', 'name': 'thread' },
            false,
            'Creates a new coroutine from the given function',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'isyieldable',
        {
          'type': createMethod([], BooleanType, false, 'Returns true if the running coroutine can yield'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'resume',
        {
          'type': createMethod(
            [createParam('co', { 'kind': 'Primitive', 'name': 'thread' })],
            AnyType,
            true,
            'Starts or resumes execution of a coroutine',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'running',
        {
          'type': createMethod(
            [],
            { 'kind': 'Primitive', 'name': 'thread' },
            false,
            'Returns the running coroutine and a boolean indicating if it is the main thread',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'status',
        {
          'type': createMethod(
            [createParam('co', { 'kind': 'Primitive', 'name': 'thread' })],
            StringType,
            false,
            'Returns the status of a coroutine as a string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'wrap',
        {
          'type': createMethod(
            [createParam('f', createFunctionType([], AnyType, { 'isVariadic': true }))],
            createFunctionType([], AnyType, { 'isVariadic': true }),
            false,
            'Creates a coroutine and returns a function that resumes it each time it is called',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'yield',
        {
          'type': createMethod([], AnyType, true, 'Suspends execution of the calling coroutine'),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

/**
 * Creates the Luau bit32 library type definition.
 *
 * The bit32 library provides bitwise operations including:
 * - Logical: band, bor, bxor, bnot
 * - Shifts: lshift, rshift, arshift
 * - Rotation: lrotate, rrotate
 * - Extraction: extract, replace
 * - Testing: btest
 * - Counting: countlz, countrz
 *
 * @returns A TableType representing the bit32 library
 */
export const createBit32Library = (): LuauType =>
  createTableType(
    new Map([
      [
        'arshift',
        {
          'type': createMethod(
            [createParam('x', NumberType), createParam('disp', NumberType)],
            NumberType,
            false,
            'Returns x shifted arithmetically right by disp bits',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'band',
        {
          'type': createMethod([], NumberType, true, 'Returns the bitwise AND of its arguments'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'bnot',
        {
          'type': createMethod([createParam('x', NumberType)], NumberType, false, 'Returns the bitwise NOT of x'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'bor',
        {
          'type': createMethod([], NumberType, true, 'Returns the bitwise OR of its arguments'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'btest',
        {
          'type': createMethod([], BooleanType, true, 'Returns true if the bitwise AND of its arguments is not zero'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'bxor',
        {
          'type': createMethod([], NumberType, true, 'Returns the bitwise XOR of its arguments'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'countlz',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the number of consecutive leading zero bits in x',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'countrz',
        {
          'type': createMethod(
            [createParam('x', NumberType)],
            NumberType,
            false,
            'Returns the number of consecutive trailing zero bits in x',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'extract',
        {
          'type': createMethod(
            [createParam('n', NumberType), createParam('field', NumberType), createParam('width', NumberType, true)],
            NumberType,
            false,
            'Extracts bits from x at field position with width',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'lrotate',
        {
          'type': createMethod(
            [createParam('x', NumberType), createParam('disp', NumberType)],
            NumberType,
            false,
            'Returns x rotated left by disp bits',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'lshift',
        {
          'type': createMethod(
            [createParam('x', NumberType), createParam('disp', NumberType)],
            NumberType,
            false,
            'Returns x shifted left by disp bits',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'replace',
        {
          'type': createMethod(
            [
              createParam('n', NumberType),
              createParam('v', NumberType),
              createParam('field', NumberType),
              createParam('width', NumberType, true),
            ],
            NumberType,
            false,
            'Returns x with the bits at field position replaced by v',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'rrotate',
        {
          'type': createMethod(
            [createParam('x', NumberType), createParam('disp', NumberType)],
            NumberType,
            false,
            'Returns x rotated right by disp bits',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'rshift',
        {
          'type': createMethod(
            [createParam('x', NumberType), createParam('disp', NumberType)],
            NumberType,
            false,
            'Returns x shifted right by disp bits',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

/**
 * Creates the Luau utf8 library type definition.
 *
 * The utf8 library provides UTF-8 string utilities including:
 * - Conversion: char, codepoint
 * - Iteration: codes
 * - Length: len
 * - Position: offset
 * - Normalization: nfcnormalize, nfdnormalize
 * - Grapheme iteration: graphemes
 * - Pattern: charpattern
 *
 * @returns A TableType representing the utf8 library
 */
export const createUtf8Library = (): LuauType =>
  createTableType(
    new Map([
      [
        'char',
        {
          'type': createMethod([], StringType, true, 'Returns a string from the given Unicode code points'),
          'readonly': true,
          'optional': false,
        },
      ],
      ['charpattern', { 'type': StringType, 'readonly': true, 'optional': false }],
      [
        'codepoint',
        {
          'type': createMethod(
            [createParam('s', StringType), createParam('i', NumberType, true), createParam('j', NumberType, true)],
            NumberType,
            true,
            'Returns the code points of all characters in the string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'codes',
        {
          'type': createMethod(
            [createParam('s', StringType)],
            createFunctionType([], { 'kind': 'Union', 'types': [NumberType, NilType] }),
            false,
            'Returns an iterator for all code points in the string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'graphemes',
        {
          'type': createMethod(
            [createParam('s', StringType), createParam('i', NumberType, true), createParam('j', NumberType, true)],
            createFunctionType([], { 'kind': 'Union', 'types': [NumberType, NilType] }),
            false,
            'Returns an iterator for grapheme clusters in the string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'len',
        {
          'type': createMethod(
            [createParam('s', StringType), createParam('i', NumberType, true), createParam('j', NumberType, true)],
            { 'kind': 'Union', 'types': [NumberType, NilType] },
            false,
            'Returns the number of UTF-8 characters in the string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'nfcnormalize',
        {
          'type': createMethod(
            [createParam('s', StringType)],
            StringType,
            false,
            'Returns the NFC normalized form of the string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'nfdnormalize',
        {
          'type': createMethod(
            [createParam('s', StringType)],
            StringType,
            false,
            'Returns the NFD normalized form of the string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'offset',
        {
          'type': createMethod(
            [createParam('s', StringType), createParam('n', NumberType), createParam('i', NumberType, true)],
            { 'kind': 'Union', 'types': [NumberType, NilType] },
            false,
            'Returns the byte position of the nth character',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

/**
 * Creates the Luau os library type definition.
 *
 * The os library provides operating system related functions including:
 * - Timing: clock, time, difftime
 * - Date formatting: date
 *
 * Note: Luau's os library is sandboxed and does not include file system
 * operations, execute, or other potentially dangerous functions.
 *
 * @returns A TableType representing the os library
 */
export const createOsLibrary = (): LuauType =>
  createTableType(
    new Map([
      [
        'clock',
        {
          'type': createMethod([], NumberType, false, 'Returns the CPU time used by the program in seconds'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'date',
        {
          'type': createMethod(
            [createParam('format', StringType, true), createParam('time', NumberType, true)],
            { 'kind': 'Union', 'types': [StringType, createTableType(new Map())] },
            false,
            'Returns a formatted date/time string or table',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'difftime',
        {
          'type': createMethod(
            [createParam('t2', NumberType), createParam('t1', NumberType)],
            NumberType,
            false,
            'Returns the difference in seconds between two time values',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'time',
        {
          'type': createMethod(
            [createParam('table', createTableType(new Map()), true)],
            NumberType,
            false,
            'Returns the current time as a number',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

/**
 * Creates the Luau buffer library type definition.
 *
 * The buffer library provides binary data manipulation functions including:
 * - Creation: create, fromstring
 * - Conversion: tostring
 * - Information: len
 * - Copying: copy, fill
 * - Reading: readi8, readu8, readi16, readu16, readi32, readu32, readf32, readf64, readstring
 * - Writing: writei8, writeu8, writei16, writeu16, writei32, writeu32, writef32, writef64, writestring
 *
 * @returns A TableType representing the buffer library
 */
export const createBufferLibrary = (): LuauType =>
  createTableType(
    new Map([
      [
        'create',
        {
          'type': createMethod(
            [createParam('size', NumberType)],
            { 'kind': 'Primitive', 'name': 'buffer' },
            false,
            'Creates a new buffer with the specified size in bytes',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'fromstring',
        {
          'type': createMethod(
            [createParam('str', StringType)],
            { 'kind': 'Primitive', 'name': 'buffer' },
            false,
            'Creates a new buffer from a string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'tostring',
        {
          'type': createMethod(
            [createParam('b', { 'kind': 'Primitive', 'name': 'buffer' })],
            StringType,
            false,
            'Converts the buffer contents to a string',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'len',
        {
          'type': createMethod(
            [createParam('b', { 'kind': 'Primitive', 'name': 'buffer' })],
            NumberType,
            false,
            'Returns the size of the buffer in bytes',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'copy',
        {
          'type': createMethod(
            [
              createParam('target', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('targetOffset', NumberType),
              createParam('source', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('sourceOffset', NumberType, true),
              createParam('count', NumberType, true),
            ],
            NilType,
            false,
            'Copies bytes from one buffer region to another',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'fill',
        {
          'type': createMethod(
            [
              createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('offset', NumberType),
              createParam('value', NumberType),
              createParam('count', NumberType, true),
            ],
            NilType,
            false,
            'Fills a region of the buffer with a byte value',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'readi8',
        {
          'type': createMethod(
            [createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }), createParam('offset', NumberType)],
            NumberType,
            false,
            'Reads a signed 8-bit integer from the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'readu8',
        {
          'type': createMethod(
            [createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }), createParam('offset', NumberType)],
            NumberType,
            false,
            'Reads an unsigned 8-bit integer from the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'readi16',
        {
          'type': createMethod(
            [createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }), createParam('offset', NumberType)],
            NumberType,
            false,
            'Reads a signed 16-bit integer from the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'readu16',
        {
          'type': createMethod(
            [createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }), createParam('offset', NumberType)],
            NumberType,
            false,
            'Reads an unsigned 16-bit integer from the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'readi32',
        {
          'type': createMethod(
            [createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }), createParam('offset', NumberType)],
            NumberType,
            false,
            'Reads a signed 32-bit integer from the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'readu32',
        {
          'type': createMethod(
            [createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }), createParam('offset', NumberType)],
            NumberType,
            false,
            'Reads an unsigned 32-bit integer from the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'readf32',
        {
          'type': createMethod(
            [createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }), createParam('offset', NumberType)],
            NumberType,
            false,
            'Reads a 32-bit floating point value from the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'readf64',
        {
          'type': createMethod(
            [createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }), createParam('offset', NumberType)],
            NumberType,
            false,
            'Reads a 64-bit floating point value from the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'readstring',
        {
          'type': createMethod(
            [
              createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('offset', NumberType),
              createParam('count', NumberType),
            ],
            StringType,
            false,
            'Reads a string of count bytes from the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'writei8',
        {
          'type': createMethod(
            [
              createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('offset', NumberType),
              createParam('value', NumberType),
            ],
            NilType,
            false,
            'Writes a signed 8-bit integer to the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'writeu8',
        {
          'type': createMethod(
            [
              createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('offset', NumberType),
              createParam('value', NumberType),
            ],
            NilType,
            false,
            'Writes an unsigned 8-bit integer to the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'writei16',
        {
          'type': createMethod(
            [
              createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('offset', NumberType),
              createParam('value', NumberType),
            ],
            NilType,
            false,
            'Writes a signed 16-bit integer to the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'writeu16',
        {
          'type': createMethod(
            [
              createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('offset', NumberType),
              createParam('value', NumberType),
            ],
            NilType,
            false,
            'Writes an unsigned 16-bit integer to the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'writei32',
        {
          'type': createMethod(
            [
              createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('offset', NumberType),
              createParam('value', NumberType),
            ],
            NilType,
            false,
            'Writes a signed 32-bit integer to the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'writeu32',
        {
          'type': createMethod(
            [
              createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('offset', NumberType),
              createParam('value', NumberType),
            ],
            NilType,
            false,
            'Writes an unsigned 32-bit integer to the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'writef32',
        {
          'type': createMethod(
            [
              createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('offset', NumberType),
              createParam('value', NumberType),
            ],
            NilType,
            false,
            'Writes a 32-bit floating point value to the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'writef64',
        {
          'type': createMethod(
            [
              createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('offset', NumberType),
              createParam('value', NumberType),
            ],
            NilType,
            false,
            'Writes a 64-bit floating point value to the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'writestring',
        {
          'type': createMethod(
            [
              createParam('b', { 'kind': 'Primitive', 'name': 'buffer' }),
              createParam('offset', NumberType),
              createParam('value', StringType),
              createParam('count', NumberType, true),
            ],
            NilType,
            false,
            'Writes a string to the buffer at the given offset',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

/**
 * Creates the Luau task library type definition.
 *
 * The task library provides task scheduling functions including:
 * - Spawning: spawn, defer
 * - Delayed execution: delay, wait
 * - Cancellation: cancel
 * - Parallel Luau: synchronize, desynchronize
 *
 * This is the Roblox-specific task scheduler API that provides more
 * control over script execution compared to the legacy spawn/wait functions.
 *
 * @returns A TableType representing the task library
 */
export const createTaskLibrary = (): LuauType =>
  createTableType(
    new Map([
      [
        'cancel',
        {
          'type': createMethod(
            [createParam('thread', { 'kind': 'Primitive', 'name': 'thread' })],
            NilType,
            false,
            'Cancels a scheduled thread, preventing it from resuming',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'defer',
        {
          'type': createMethod(
            [createParam('f', createFunctionType([], AnyType, { 'isVariadic': true }))],
            { 'kind': 'Primitive', 'name': 'thread' },
            true,
            'Schedules a function to run after the current resumption cycle',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'delay',
        {
          'type': createMethod(
            [
              createParam('duration', NumberType),
              createParam('f', createFunctionType([], AnyType, { 'isVariadic': true })),
            ],
            { 'kind': 'Primitive', 'name': 'thread' },
            true,
            'Schedules a function to run after the specified delay in seconds',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'desynchronize',
        {
          'type': createMethod([], NilType, false, 'Causes the following code to run in parallel execution'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'spawn',
        {
          'type': createMethod(
            [createParam('f', createFunctionType([], AnyType, { 'isVariadic': true }))],
            { 'kind': 'Primitive', 'name': 'thread' },
            true,
            'Schedules a function to run immediately in a new thread',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'synchronize',
        {
          'type': createMethod([], NilType, false, 'Causes the following code to run in serial execution'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'wait',
        {
          'type': createMethod(
            [createParam('duration', NumberType, true)],
            NumberType,
            false,
            'Yields the current thread for at least the given duration, returns elapsed time',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

/**
 * Creates the Luau debug library type definition.
 *
 * The debug library provides debugging utilities including:
 * - Stack inspection: info, traceback
 * - Profiling: profilebegin, profileend
 * - Memory: setmemorycategory, resetmemorycategory
 *
 * Note: Luau's debug library is sandboxed and does not include
 * getupvalue, setupvalue, or other potentially dangerous functions
 * in the standard Roblox environment (these may be available in executors).
 *
 * @returns A TableType representing the debug library
 */
export const createDebugLibrary = (): LuauType =>
  createTableType(
    new Map([
      [
        'info',
        {
          'type': createMethod(
            [createParam('level', NumberType), createParam('what', StringType)],
            AnyType,
            true,
            'Returns information about the given function or stack level',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'traceback',
        {
          'type': createMethod(
            [createParam('message', StringType, true), createParam('level', NumberType, true)],
            StringType,
            false,
            'Returns a string with a traceback of the call stack',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'profilebegin',
        {
          'type': createMethod(
            [createParam('label', StringType)],
            NilType,
            false,
            'Starts a profiler label for MicroProfiler timing',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'profileend',
        {
          'type': createMethod([], NilType, false, 'Ends the most recent MicroProfiler profiler label'),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'setmemorycategory',
        {
          'type': createMethod(
            [createParam('tag', StringType)],
            NilType,
            false,
            'Sets the current memory category for memory profiling',
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'resetmemorycategory',
        {
          'type': createMethod([], NilType, false, 'Resets the memory category to the default'),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

/** Cached standard library types - they never change so we can reuse them */
let cachedStdLibs: Map<string, LuauType> | undefined;

/**
 * Creates and returns all Luau standard library type definitions.
 *
 * This function creates type definitions for all standard Luau libraries
 * and caches the result for subsequent calls, since the standard library
 * definitions never change.
 *
 * Libraries included:
 * - math: Mathematical operations
 * - string: String manipulation
 * - table: Table operations
 * - coroutine: Coroutine management
 * - bit32: Bitwise operations
 * - utf8: UTF-8 utilities
 * - os: OS-related functions
 * - buffer: Binary data manipulation
 * - task: Task scheduling
 * - debug: Debugging utilities
 *
 * @returns A Map of library names to their TableType definitions
 */
export const createAllStdLibraries = (): Map<string, LuauType> => {
  if (cachedStdLibs !== undefined) return cachedStdLibs;

  cachedStdLibs = new Map([
    ['math', createMathLibrary()],
    ['string', createStringLibrary()],
    ['table', createTableLibrary()],
    ['coroutine', createCoroutineLibrary()],
    ['bit32', createBit32Library()],
    ['utf8', createUtf8Library()],
    ['os', createOsLibrary()],
    ['buffer', createBufferLibrary()],
    ['task', createTaskLibrary()],
    ['debug', createDebugLibrary()],
  ]);

  return cachedStdLibs;
};
