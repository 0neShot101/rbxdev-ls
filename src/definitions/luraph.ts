import type { TypeEnvironment } from '@typings/environment';
import { defineSymbol } from '@typings/environment';
import type { DocComment } from '@typings/parser';
import { AnyType, BooleanType, NilType, NumberType, StringType, createFunctionType } from '@typings/types';

const doc = (description: string): DocComment => ({
  description,
  'params': [],
  'returns': [],
  'type': undefined,
  'class': undefined,
  'fields': [],
  'deprecated': undefined,
  'raw': description,
});

/** Adds Luraph (LPH) globals to the environment. */
export const addLuraphGlobals = (env: TypeEnvironment): void => {
  defineSymbol(
    env,
    'LPH_OBFUSCATED',
    BooleanType,
    'Global',
    false,
    doc(
      'A constant set to true during obfuscation, allowing code paths to only run in an obfuscated or unobfuscated context. Conditions containing this macro are simplified at compile time and unreachable code is removed.',
    ),
  );

  defineSymbol(
    env,
    'LPH_LINE',
    NumberType,
    'Global',
    false,
    doc(
      'Replaced with the current line number during compilation. This is a constant value, so line information does not need to be enabled.',
    ),
  );

  defineSymbol(
    env,
    'LPH_ENCSTR',
    createFunctionType([{ 'name': 'toEncrypt', 'type': StringType, 'optional': false }], StringType, {
      'description': 'Encrypts the specified string constant using a more intense encryption algorithm.',
    }),
    'Global',
    false,
  );

  defineSymbol(
    env,
    'LPH_ENCNUM',
    createFunctionType([{ 'name': 'toEncrypt', 'type': NumberType, 'optional': false }], NumberType, {
      'description':
        'Encrypts the specified number constant using a more intense encryption algorithm. Works on doubles and integers and always preserves types when encrypting.',
    }),
    'Global',
    false,
  );

  defineSymbol(
    env,
    'LPH_ENCFUNC',
    createFunctionType(
      [
        { 'name': 'func', 'type': AnyType, 'optional': false },
        { 'name': 'encKey', 'type': StringType, 'optional': false },
        { 'name': 'decKey', 'type': StringType, 'optional': false },
      ],
      AnyType,
      {
        'description':
          'Cryptographically encrypts the passed function with the provided encryption key and decrypts it at runtime with the decryption key. The encryption key must be a 64-length hex-encoded string.',
      },
    ),
    'Global',
    false,
  );

  defineSymbol(
    env,
    'LPH_CRASH',
    createFunctionType([], NilType, {
      'description': 'Securely crashes the VM and corrupts the VM context.',
    }),
    'Global',
    false,
  );

  defineSymbol(
    env,
    'LPH_JIT',
    createFunctionType([{ 'name': 'toEnhance', 'type': AnyType, 'optional': false }], AnyType, {
      'description':
        'Heavily optimizes the passed function to run at exponentially higher speeds. Use on performance-critical code like rendering loops or math calculations.',
    }),
    'Global',
    false,
  );

  defineSymbol(
    env,
    'LPH_JIT_MAX',
    createFunctionType([{ 'name': 'toEnhance', 'type': AnyType, 'optional': false }], AnyType, {
      'description':
        'A more intense version of LPH_JIT that applies even more optimization. Use on performance-critical code that does not need intensive security.',
    }),
    'Global',
    false,
  );

  defineSymbol(
    env,
    'LPH_NO_VIRTUALIZE',
    createFunctionType([{ 'name': 'toDevirtualize', 'type': AnyType, 'optional': false }], AnyType, {
      'description':
        'Disables obfuscation for the passed function. Code will be stripped of names and comments but raw strings and constants will be exposed. Only use on functions that do not need security.',
    }),
    'Global',
    false,
  );

  defineSymbol(
    env,
    'LPH_NO_UPVALUES',
    createFunctionType([{ 'name': 'toFix', 'type': AnyType, 'optional': false }], AnyType, {
      'description':
        'Wraps the passed function in a proxy function with 0 upvalues to fix bugs in programs that do not work with high upvalue counts. Does not work when Static Environment is enabled or on platforms with _ENV.',
    }),
    'Global',
    false,
  );
};
