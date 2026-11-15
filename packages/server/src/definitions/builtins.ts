import {
  AnyType,
  BooleanType,
  NilType,
  NumberType,
  StringType,
  createFunctionType,
  createTableType,
} from '@analyzer/values';
import { createAllStdLibraries } from '@definitions/stdlib';

import type { LuauType } from '@typings/types';

/** Installs Luau builtin functions, standard libraries and legacy Roblox scheduler globals. */
export const installBuiltins = (globals: Map<string, LuauType>): void => {
  globals.set(
    'print',
    createFunctionType([{ 'name': undefined, 'type': AnyType, 'optional': false }], NilType, {
      'isVariadic': true,
      'description': 'Prints all arguments to the output, separated by spaces, followed by a newline.',
    }),
  );
  globals.set(
    'warn',
    createFunctionType([{ 'name': undefined, 'type': AnyType, 'optional': false }], NilType, {
      'isVariadic': true,
      'description': 'Prints all arguments to the output as a warning, separated by spaces, followed by a newline.',
    }),
  );
  globals.set(
    'error',
    createFunctionType(
      [{ 'name': 'message', 'type': AnyType, 'optional': false }],
      { 'kind': 'Never' },
      {
        'description': 'Raises an error with the given message. This function never returns.',
      },
    ),
  );
  globals.set(
    'assert',
    createFunctionType(
      [
        { 'name': 'condition', 'type': AnyType, 'optional': false },
        { 'name': 'message', 'type': StringType, 'optional': true },
      ],
      AnyType,
      {
        'description':
          'Raises an error if the condition is false or nil. Returns all arguments if the condition is truthy.',
      },
    ),
  );
  globals.set(
    'type',
    createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], StringType, {
      'description':
        'Returns the type of the value as a string. Possible results: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata".',
    }),
  );
  globals.set(
    'typeof',
    createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], StringType, {
      'description':
        'Returns the type of the value as a string, with Roblox type awareness. Returns specific types like "Vector3", "CFrame", "Instance" for Roblox objects.',
    }),
  );
  globals.set(
    'tostring',
    createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], StringType, {
      'description': 'Converts the given value to a string. Calls the __tostring metamethod if available.',
    }),
  );
  globals.set(
    'tonumber',
    createFunctionType(
      [{ 'name': 'value', 'type': AnyType, 'optional': false }],
      { 'kind': 'Union', 'types': [NumberType, NilType] },
      { 'description': 'Converts the given value to a number. Returns nil if the conversion fails.' },
    ),
  );
  globals.set(
    'pcall',
    createFunctionType(
      [{ 'name': 'func', 'type': AnyType, 'optional': false }],
      { 'kind': 'Union', 'types': [BooleanType, AnyType] },
      {
        'isVariadic': true,
        'description':
          'Calls the function in protected mode. Returns true and the results on success, or false and the error message on failure.',
      },
    ),
  );
  globals.set(
    'xpcall',
    createFunctionType(
      [
        { 'name': 'func', 'type': AnyType, 'optional': false },
        { 'name': 'handler', 'type': AnyType, 'optional': false },
      ],
      { 'kind': 'Union', 'types': [BooleanType, AnyType] },
      {
        'isVariadic': true,
        'description':
          'Calls the function in protected mode with a custom error handler. Returns true and the results on success, or false and the handler result on failure.',
      },
    ),
  );
  globals.set(
    'select',
    createFunctionType(
      [
        {
          'name': 'index',
          'type': { 'kind': 'Union', 'types': [NumberType, { 'kind': 'Literal', 'value': '#', 'baseType': 'string' }] },
          'optional': false,
        },
      ],
      AnyType,
      {
        'isVariadic': true,
        'description':
          'Returns all arguments after the given index, or the total number of arguments when index is "#".',
      },
    ),
  );
  globals.set(
    'pairs',
    createFunctionType([{ 'name': 'table', 'type': AnyType, 'optional': false }], AnyType, {
      'description': 'Returns an iterator function for traversing all key-value pairs in a table.',
    }),
  );
  globals.set(
    'ipairs',
    createFunctionType([{ 'name': 'table', 'type': AnyType, 'optional': false }], AnyType, {
      'description': 'Returns an iterator function for traversing the array portion of a table in order.',
    }),
  );
  globals.set(
    'next',
    createFunctionType(
      [
        { 'name': 'table', 'type': AnyType, 'optional': false },
        { 'name': 'index', 'type': AnyType, 'optional': true },
      ],
      AnyType,
      {
        'description':
          'Returns the next key-value pair in the table after the given index. Returns nil when there are no more elements.',
      },
    ),
  );
  globals.set(
    'unpack',
    createFunctionType([{ 'name': 'table', 'type': AnyType, 'optional': false }], AnyType, {
      'isVariadic': true,
      'description': 'Returns all elements from the given table as multiple values.',
    }),
  );
  globals.set(
    'rawget',
    createFunctionType(
      [
        { 'name': 'table', 'type': AnyType, 'optional': false },
        { 'name': 'index', 'type': AnyType, 'optional': false },
      ],
      AnyType,
      { 'description': 'Gets the value of table[index] without invoking any metamethods.' },
    ),
  );
  globals.set(
    'rawset',
    createFunctionType(
      [
        { 'name': 'table', 'type': AnyType, 'optional': false },
        { 'name': 'index', 'type': AnyType, 'optional': false },
        { 'name': 'value', 'type': AnyType, 'optional': false },
      ],
      AnyType,
      { 'description': 'Sets the value of table[index] without invoking any metamethods. Returns the table.' },
    ),
  );
  globals.set(
    'rawequal',
    createFunctionType(
      [
        { 'name': 'a', 'type': AnyType, 'optional': false },
        { 'name': 'b', 'type': AnyType, 'optional': false },
      ],
      BooleanType,
      { 'description': 'Returns true if a and b are equal without invoking the __eq metamethod.' },
    ),
  );
  globals.set(
    'rawlen',
    createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], NumberType, {
      'description': 'Returns the length of the table or string without invoking the __len metamethod.',
    }),
  );
  globals.set(
    'setmetatable',
    createFunctionType(
      [
        { 'name': 'table', 'type': AnyType, 'optional': false },
        { 'name': 'metatable', 'type': AnyType, 'optional': false },
      ],
      AnyType,
      { 'description': 'Sets the metatable for the given table. Pass nil to remove the metatable. Returns the table.' },
    ),
  );
  globals.set(
    'getmetatable',
    createFunctionType([{ 'name': 'table', 'type': AnyType, 'optional': false }], AnyType, {
      'description': 'Returns the metatable of the given table, or nil if it does not have one.',
    }),
  );
  globals.set(
    'require',
    createFunctionType([{ 'name': 'module', 'type': AnyType, 'optional': false }], AnyType, {
      'description':
        'Loads and runs the given module, returning any values the module returns. Caches the result for subsequent calls.',
    }),
  );
  globals.set(
    'getfenv',
    createFunctionType([{ 'name': 'func', 'type': AnyType, 'optional': true }], AnyType, {
      'description':
        'Returns the environment table of the given function or the current function if none is specified.',
    }),
  );
  globals.set(
    'setfenv',
    createFunctionType(
      [
        { 'name': 'func', 'type': AnyType, 'optional': false },
        { 'name': 'env', 'type': AnyType, 'optional': false },
      ],
      AnyType,
      { 'description': 'Sets the environment table for the given function. Returns the function.' },
    ),
  );
  globals.set(
    'newproxy',
    createFunctionType([{ 'name': 'addMeta', 'type': BooleanType, 'optional': true }], AnyType, {
      'description':
        'Creates a blank userdata. If addMeta is true, the userdata will have an empty metatable that can be modified.',
    }),
  );

  globals.set('_G', createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }));
  globals.set('_VERSION', StringType);
  globals.set('shared', createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }));

  for (const [name, type] of createAllStdLibraries()) globals.set(name, type);

  globals.set(
    'wait',
    createFunctionType([{ 'name': 'seconds', 'type': NumberType, 'optional': true }], NumberType, {
      'description': 'Yields the current thread for the given duration. Deprecated in favor of task.wait().',
    }),
  );
  globals.set(
    'delay',
    createFunctionType(
      [
        { 'name': 'seconds', 'type': NumberType, 'optional': false },
        { 'name': 'callback', 'type': AnyType, 'optional': false },
      ],
      NilType,
      { 'description': 'Schedules a function to run after the given delay. Deprecated in favor of task.delay().' },
    ),
  );
  globals.set(
    'spawn',
    createFunctionType([{ 'name': 'callback', 'type': AnyType, 'optional': false }], NilType, {
      'description': 'Schedules a function to run in a new thread. Deprecated in favor of task.spawn().',
    }),
  );
  globals.set(
    'tick',
    createFunctionType([], NumberType, {
      'description': 'Returns the time in seconds since the Unix epoch. Deprecated in favor of os.clock() or DateTime.',
    }),
  );
  globals.set(
    'time',
    createFunctionType([], NumberType, {
      'description': 'Returns the time in seconds since the game started running.',
    }),
  );
  globals.set(
    'elapsedTime',
    createFunctionType([], NumberType, {
      'description': 'Returns the time in seconds since Roblox started. Deprecated in favor of os.clock().',
    }),
  );
  globals.set(
    'gcinfo',
    createFunctionType([], NumberType, { 'description': 'Returns the total memory heap size in kilobytes.' }),
  );
  globals.set(
    'collectgarbage',
    createFunctionType([{ 'name': 'opt', 'type': StringType, 'optional': true }], AnyType, {
      'description': 'Performs garbage collection operations. Only "count" is supported on Roblox.',
    }),
  );
};
