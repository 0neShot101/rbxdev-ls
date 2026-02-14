/**
 * Luau Type System - Type Environment and Scope Management
 */

import { createAllStdLibraries } from '@definitions/stdlib';
import { RequestOptionsType, RequestResponseType } from '@definitions/sunc';
import {
  AnyType,
  BooleanType,
  createFunctionType,
  createTableType,
  NilType,
  NumberType,
  StringType,
} from '@typings/types';

import type { DocComment } from '@parser/docComment';
import type { TypeCheckMode } from '@typings/subtyping';
import type { ClassType, EnumType, LuauType } from '@typings/types';

/**
 * Represents a symbol in the type environment (variable, function, type alias, etc.)
 */
export interface Symbol {
  /** The name of the symbol */
  readonly name: string;
  /** The type of the symbol */
  readonly type: LuauType;
  /** The kind of symbol (Variable, Function, Parameter, etc.) */
  readonly kind: SymbolKind;
  /** Whether the symbol can be reassigned */
  readonly mutable: boolean;
  /** The location where the symbol was declared */
  readonly declarationLocation: SymbolLocation | undefined;
  /** Associated documentation comment */
  readonly docComment: DocComment | undefined;
}

/**
 * The kind of symbol in the type environment
 */
export type SymbolKind =
  | 'Variable'
  | 'Function'
  | 'Parameter'
  | 'TypeAlias'
  | 'TypeParameter'
  | 'Global'
  | 'Class'
  | 'Enum';

/**
 * Represents the source location of a symbol declaration
 */
export interface SymbolLocation {
  /** The file URI */
  readonly uri: string;
  /** The 1-based line number */
  readonly line: number;
  /** The 1-based column number */
  readonly column: number;
}

/**
 * Represents a lexical scope in the type environment
 */
export interface Scope {
  /** Unique identifier for this scope */
  readonly id: number;
  /** The parent scope (undefined for global scope) */
  readonly parent: Scope | undefined;
  /** Map of symbol names to their definitions */
  readonly symbols: Map<string, Symbol>;
  /** Map of type alias names to their definitions */
  readonly types: Map<string, LuauType>;
  /** The kind of scope */
  readonly kind: ScopeKind;
}

/**
 * The kind of lexical scope
 */
export type ScopeKind = 'Global' | 'Module' | 'Function' | 'Block' | 'Loop' | 'Conditional';

let scopeIdCounter = 0;

/**
 * Creates a new lexical scope
 * @param parent - The parent scope, or undefined for a root scope
 * @param kind - The kind of scope (defaults to 'Block')
 * @returns A new Scope object
 */
export const createScope = (parent: Scope | undefined, kind: ScopeKind = 'Block'): Scope => ({
  'id': scopeIdCounter++,
  parent,
  'symbols': new Map(),
  'types': new Map(),
  kind,
});

/**
 * Resets the scope ID counter (primarily for testing)
 */
export const resetScopeCounter = (): void => {
  scopeIdCounter = 0;
};

/**
 * The type environment containing scopes, classes, and enums for type checking
 */
export interface TypeEnvironment {
  /** The type checking mode (strict, nonstrict, etc.) */
  readonly mode: TypeCheckMode;
  /** The global/root scope */
  readonly globalScope: Scope;
  /** The currently active scope */
  currentScope: Scope;
  /** Map of class names to their type definitions */
  readonly classes: Map<string, ClassType>;
  /** Map of enum names to their type definitions */
  readonly enums: Map<string, EnumType>;
}

/**
 * Creates a new type environment for type checking
 * @param mode - The type checking mode (defaults to 'strict')
 * @returns A new TypeEnvironment with an empty global scope
 */
export const createTypeEnvironment = (mode: TypeCheckMode = 'strict'): TypeEnvironment => {
  const globalScope = createScope(undefined, 'Global');
  return {
    mode,
    globalScope,
    'currentScope': globalScope,
    'classes': new Map(),
    'enums': new Map(),
  };
};

/**
 * Defines a symbol in the current scope
 * @param env - The type environment
 * @param name - The name of the symbol
 * @param type - The type of the symbol
 * @param kind - The kind of symbol
 * @param mutable - Whether the symbol can be reassigned (defaults to true)
 * @param docComment - Optional documentation comment
 */
export const defineSymbol = (
  env: TypeEnvironment,
  name: string,
  type: LuauType,
  kind: SymbolKind,
  mutable = true,
  docComment?: DocComment,
): void => {
  env.currentScope.symbols.set(name, {
    name,
    type,
    kind,
    mutable,
    'declarationLocation': undefined,
    docComment,
  });
};

/**
 * Defines a symbol in the current scope with a source location
 * @param env - The type environment
 * @param name - The name of the symbol
 * @param type - The type of the symbol
 * @param kind - The kind of symbol
 * @param location - The source location of the declaration
 * @param mutable - Whether the symbol can be reassigned (defaults to true)
 * @param docComment - Optional documentation comment
 */
export const defineSymbolWithLocation = (
  env: TypeEnvironment,
  name: string,
  type: LuauType,
  kind: SymbolKind,
  location: SymbolLocation,
  mutable = true,
  docComment?: DocComment,
): void => {
  env.currentScope.symbols.set(name, {
    name,
    type,
    kind,
    mutable,
    'declarationLocation': location,
    docComment,
  });
};

/**
 * Looks up a symbol by name, searching through parent scopes
 * @param env - The type environment
 * @param name - The name of the symbol to find
 * @returns The symbol if found, undefined otherwise
 */
export const lookupSymbol = (env: TypeEnvironment, name: string): Symbol | undefined => {
  let scope: Scope | undefined = env.currentScope;

  while (scope !== undefined) {
    const symbol = scope.symbols.get(name);
    if (symbol !== undefined) return symbol;
    scope = scope.parent;
  }

  return undefined;
};

/**
 * Looks up a symbol in a specific scope only (does not search parent scopes)
 * @param scope - The scope to search in
 * @param name - The name of the symbol to find
 * @returns The symbol if found in this scope, undefined otherwise
 */
export const lookupSymbolInScope = (scope: Scope, name: string): Symbol | undefined => scope.symbols.get(name);

/**
 * Defines a type alias in the current scope
 * @param env - The type environment
 * @param name - The name of the type alias
 * @param type - The type that the alias refers to
 */
export const defineTypeAlias = (env: TypeEnvironment, name: string, type: LuauType): void => {
  env.currentScope.types.set(name, type);
};

/**
 * Looks up a type alias by name, searching through parent scopes
 * @param env - The type environment
 * @param name - The name of the type alias to find
 * @returns The type if found, undefined otherwise
 */
export const lookupTypeAlias = (env: TypeEnvironment, name: string): LuauType | undefined => {
  let scope: Scope | undefined = env.currentScope;

  while (scope !== undefined) {
    const type = scope.types.get(name);
    if (type !== undefined) return type;
    scope = scope.parent;
  }

  return undefined;
};

/**
 * Registers a class type in the environment
 * @param env - The type environment
 * @param classType - The class type to register
 */
export const defineClass = (env: TypeEnvironment, classType: ClassType): void => {
  env.classes.set(classType.name, classType);
};

/**
 * Looks up a class type by name
 * @param env - The type environment
 * @param name - The name of the class to find
 * @returns The class type if found, undefined otherwise
 */
export const lookupClass = (env: TypeEnvironment, name: string): ClassType | undefined => env.classes.get(name);

/**
 * Registers an enum type in the environment
 * @param env - The type environment
 * @param enumType - The enum type to register
 */
export const defineEnum = (env: TypeEnvironment, enumType: EnumType): void => {
  env.enums.set(enumType.name, enumType);
};

/**
 * Looks up an enum type by name
 * @param env - The type environment
 * @param name - The name of the enum to find
 * @returns The enum type if found, undefined otherwise
 */
export const lookupEnum = (env: TypeEnvironment, name: string): EnumType | undefined => env.enums.get(name);

/**
 * Enters a new scope, making it the current scope
 * @param env - The type environment
 * @param kind - The kind of scope to create (defaults to 'Block')
 * @returns The newly created scope
 */
export const enterScope = (env: TypeEnvironment, kind: ScopeKind = 'Block'): Scope => {
  const newScope = createScope(env.currentScope, kind);
  env.currentScope = newScope;
  return newScope;
};

/**
 * Exits the current scope, returning to the parent scope
 * @param env - The type environment
 * @returns The scope that was exited
 * @throws Error if attempting to exit the global scope
 */
export const exitScope = (env: TypeEnvironment): Scope => {
  if (env.currentScope.parent === undefined) {
    throw new Error('Cannot exit global scope');
  }
  const oldScope = env.currentScope;
  env.currentScope = env.currentScope.parent;
  return oldScope;
};

/**
 * Checks if the current scope is within a function
 * @param env - The type environment
 * @returns True if inside a function scope, false otherwise
 */
export const isInFunctionScope = (env: TypeEnvironment): boolean => {
  let scope: Scope | undefined = env.currentScope;
  while (scope !== undefined) {
    if (scope.kind === 'Function') return true;
    scope = scope.parent;
  }
  return false;
};

/**
 * Checks if the current scope is within a loop (stops at function boundaries)
 * @param env - The type environment
 * @returns True if inside a loop scope, false otherwise
 */
export const isInLoopScope = (env: TypeEnvironment): boolean => {
  let scope: Scope | undefined = env.currentScope;
  while (scope !== undefined) {
    if (scope.kind === 'Loop') return true;
    if (scope.kind === 'Function') return false; // Stop at function boundary
    scope = scope.parent;
  }
  return false;
};

/**
 * Adds standard Luau built-in functions and variables to the environment
 * @param env - The type environment to populate
 */
export const addLuauBuiltins = (env: TypeEnvironment): void => {
  defineSymbol(
    env,
    'print',
    createFunctionType([{ 'name': undefined, 'type': AnyType, 'optional': false }], NilType, {
      'isVariadic': true,
      'description': 'Prints all arguments to the output, separated by spaces, followed by a newline.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'warn',
    createFunctionType([{ 'name': undefined, 'type': AnyType, 'optional': false }], NilType, {
      'isVariadic': true,
      'description': 'Prints all arguments to the output as a warning, separated by spaces, followed by a newline.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'error',
    createFunctionType([{ 'name': 'message', 'type': AnyType, 'optional': false }], { 'kind': 'Never' }, {
      'description': 'Raises an error with the given message. This function never returns.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'assert',
    createFunctionType(
      [
        { 'name': 'condition', 'type': AnyType, 'optional': false },
        { 'name': 'message', 'type': StringType, 'optional': true },
      ],
      AnyType,
      { 'description': 'Raises an error if the condition is false or nil. Returns all arguments if the condition is truthy.' },
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'type',
    createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], StringType, {
      'description':
        'Returns the type of the value as a string. Possible results: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata".',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'typeof',
    createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], StringType, {
      'description':
        'Returns the type of the value as a string, with Roblox type awareness. Returns specific types like "Vector3", "CFrame", "Instance" for Roblox objects.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'tostring',
    createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], StringType, {
      'description': 'Converts the given value to a string. Calls the __tostring metamethod if available.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'tonumber',
    createFunctionType(
      [{ 'name': 'value', 'type': AnyType, 'optional': false }],
      { 'kind': 'Union', 'types': [NumberType, NilType] },
      { 'description': 'Converts the given value to a number. Returns nil if the conversion fails.' },
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
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
    'Global',
    false,
  );
  defineSymbol(
    env,
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
    'Global',
    false,
  );
  defineSymbol(
    env,
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
    'Global',
    false,
  );
  defineSymbol(
    env,
    'pairs',
    createFunctionType([{ 'name': 'table', 'type': AnyType, 'optional': false }], AnyType, {
      'description': 'Returns an iterator function for traversing all key-value pairs in a table.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'ipairs',
    createFunctionType([{ 'name': 'table', 'type': AnyType, 'optional': false }], AnyType, {
      'description': 'Returns an iterator function for traversing the array portion of a table in order.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'next',
    createFunctionType(
      [
        { 'name': 'table', 'type': AnyType, 'optional': false },
        { 'name': 'index', 'type': AnyType, 'optional': true },
      ],
      AnyType,
      { 'description': 'Returns the next key-value pair in the table after the given index. Returns nil when there are no more elements.' },
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'unpack',
    createFunctionType([{ 'name': 'table', 'type': AnyType, 'optional': false }], AnyType, {
      'isVariadic': true,
      'description': 'Returns all elements from the given table as multiple values.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'rawget',
    createFunctionType(
      [
        { 'name': 'table', 'type': AnyType, 'optional': false },
        { 'name': 'index', 'type': AnyType, 'optional': false },
      ],
      AnyType,
      { 'description': 'Gets the value of table[index] without invoking any metamethods.' },
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
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
    'Global',
    false,
  );
  defineSymbol(
    env,
    'rawequal',
    createFunctionType(
      [
        { 'name': 'a', 'type': AnyType, 'optional': false },
        { 'name': 'b', 'type': AnyType, 'optional': false },
      ],
      BooleanType,
      { 'description': 'Returns true if a and b are equal without invoking the __eq metamethod.' },
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'rawlen',
    createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], NumberType, {
      'description': 'Returns the length of the table or string without invoking the __len metamethod.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'setmetatable',
    createFunctionType(
      [
        { 'name': 'table', 'type': AnyType, 'optional': false },
        { 'name': 'metatable', 'type': AnyType, 'optional': false },
      ],
      AnyType,
      { 'description': 'Sets the metatable for the given table. Pass nil to remove the metatable. Returns the table.' },
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'getmetatable',
    createFunctionType([{ 'name': 'table', 'type': AnyType, 'optional': false }], AnyType, {
      'description': 'Returns the metatable of the given table, or nil if it does not have one.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'require',
    createFunctionType([{ 'name': 'module', 'type': AnyType, 'optional': false }], AnyType, {
      'description': 'Loads and runs the given module, returning any values the module returns. Caches the result for subsequent calls.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'getfenv',
    createFunctionType([{ 'name': 'func', 'type': AnyType, 'optional': true }], AnyType, {
      'description': 'Returns the environment table of the given function or the current function if none is specified.',
    }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'setfenv',
    createFunctionType(
      [
        { 'name': 'func', 'type': AnyType, 'optional': false },
        { 'name': 'env', 'type': AnyType, 'optional': false },
      ],
      AnyType,
      { 'description': 'Sets the environment table for the given function. Returns the function.' },
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'newproxy',
    createFunctionType([{ 'name': 'addMeta', 'type': BooleanType, 'optional': true }], AnyType, {
      'description': 'Creates a blank userdata. If addMeta is true, the userdata will have an empty metatable that can be modified.',
    }),
    'Global',
    false,
  );

  // Global variables - _G and shared allow dynamic property access
  defineSymbol(
    env,
    '_G',
    createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }),
    'Global',
    true,
  );
  defineSymbol(env, '_VERSION', StringType, 'Global', false);
  defineSymbol(
    env,
    'shared',
    createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }),
    'Global',
    true,
  );

  // Standard libraries (math, string, table, task, etc.)
  const stdLibs = createAllStdLibraries();
  for (const [name, type] of stdLibs) {
    defineSymbol(env, name, type, 'Global', false);
  }
};

/**
 * Adds Roblox-specific globals and datatype constructors to the environment
 * @param env - The type environment to populate
 */
export const addRobloxGlobals = (env: TypeEnvironment): void => {
  defineSymbol(env, 'game', AnyType, 'Global', false);
  defineSymbol(env, 'workspace', AnyType, 'Global', false);
  defineSymbol(env, 'script', AnyType, 'Global', false);
  defineSymbol(env, 'plugin', AnyType, 'Global', false);
  defineSymbol(env, 'Enum', AnyType, 'Global', false);
  defineSymbol(env, 'Instance', AnyType, 'Global', false);

  // Roblox datatype constructors
  const vector3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };
  const vector2Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector2' };
  const cframeType: LuauType = { 'kind': 'TypeReference', 'name': 'CFrame' };
  const color3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Color3' };
  const udim2Type: LuauType = { 'kind': 'TypeReference', 'name': 'UDim2' };
  const udimType: LuauType = { 'kind': 'TypeReference', 'name': 'UDim' };

  // Vector3
  defineSymbol(
    env,
    'Vector3',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'x', 'type': NumberType, 'optional': true },
                { 'name': 'y', 'type': NumberType, 'optional': true },
                { 'name': 'z', 'type': NumberType, 'optional': true },
              ],
              vector3Type,
              { 'description': 'Creates a new Vector3 from the given x, y, and z components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        ['zero', { 'type': vector3Type, 'readonly': true, 'optional': false }],
        ['one', { 'type': vector3Type, 'readonly': true, 'optional': false }],
        ['xAxis', { 'type': vector3Type, 'readonly': true, 'optional': false }],
        ['yAxis', { 'type': vector3Type, 'readonly': true, 'optional': false }],
        ['zAxis', { 'type': vector3Type, 'readonly': true, 'optional': false }],
        [
          'FromNormalId',
          {
            'type': createFunctionType([{ 'name': 'normalId', 'type': AnyType, 'optional': false }], vector3Type, {
              'description': 'Returns the unit Vector3 corresponding to the given Enum.NormalId.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'FromAxis',
          {
            'type': createFunctionType([{ 'name': 'axis', 'type': AnyType, 'optional': false }], vector3Type, {
              'description': 'Returns the unit Vector3 corresponding to the given Enum.Axis.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // Vector2
  defineSymbol(
    env,
    'Vector2',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'x', 'type': NumberType, 'optional': true },
                { 'name': 'y', 'type': NumberType, 'optional': true },
              ],
              vector2Type,
              { 'description': 'Creates a new Vector2 from the given x and y components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        ['zero', { 'type': vector2Type, 'readonly': true, 'optional': false }],
        ['one', { 'type': vector2Type, 'readonly': true, 'optional': false }],
        ['xAxis', { 'type': vector2Type, 'readonly': true, 'optional': false }],
        ['yAxis', { 'type': vector2Type, 'readonly': true, 'optional': false }],
      ]),
    ),
    'Global',
    false,
  );

  // CFrame
  defineSymbol(
    env,
    'CFrame',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], cframeType, {
              'isVariadic': true,
              'description': 'Creates a new CFrame. Can take a position, position + lookAt, or 12 matrix components.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        ['identity', { 'type': cframeType, 'readonly': true, 'optional': false }],
        [
          'Angles',
          {
            'type': createFunctionType(
              [
                { 'name': 'rx', 'type': NumberType, 'optional': false },
                { 'name': 'ry', 'type': NumberType, 'optional': false },
                { 'name': 'rz', 'type': NumberType, 'optional': false },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from Euler angles in radians, applied in Z, Y, X order.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromEulerAnglesXYZ',
          {
            'type': createFunctionType(
              [
                { 'name': 'rx', 'type': NumberType, 'optional': false },
                { 'name': 'ry', 'type': NumberType, 'optional': false },
                { 'name': 'rz', 'type': NumberType, 'optional': false },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from Euler angles in radians, applied in Z, Y, X order.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromEulerAnglesYXZ',
          {
            'type': createFunctionType(
              [
                { 'name': 'rx', 'type': NumberType, 'optional': false },
                { 'name': 'ry', 'type': NumberType, 'optional': false },
                { 'name': 'rz', 'type': NumberType, 'optional': false },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from Euler angles in radians, applied in Z, X, Y order.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromOrientation',
          {
            'type': createFunctionType(
              [
                { 'name': 'rx', 'type': NumberType, 'optional': false },
                { 'name': 'ry', 'type': NumberType, 'optional': false },
                { 'name': 'rz', 'type': NumberType, 'optional': false },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from orientation angles in radians.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromAxisAngle',
          {
            'type': createFunctionType(
              [
                { 'name': 'axis', 'type': vector3Type, 'optional': false },
                { 'name': 'angle', 'type': NumberType, 'optional': false },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from an axis and rotation angle in radians.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromMatrix',
          {
            'type': createFunctionType(
              [
                { 'name': 'pos', 'type': vector3Type, 'optional': false },
                { 'name': 'vX', 'type': vector3Type, 'optional': false },
                { 'name': 'vY', 'type': vector3Type, 'optional': false },
                { 'name': 'vZ', 'type': vector3Type, 'optional': true },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from a position and rotation matrix column vectors.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'lookAt',
          {
            'type': createFunctionType(
              [
                { 'name': 'at', 'type': vector3Type, 'optional': false },
                { 'name': 'lookAt', 'type': vector3Type, 'optional': false },
                { 'name': 'up', 'type': vector3Type, 'optional': true },
              ],
              cframeType,
              { 'description': 'Creates a CFrame at a position looking towards a target point.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'lookAlong',
          {
            'type': createFunctionType(
              [
                { 'name': 'at', 'type': vector3Type, 'optional': false },
                { 'name': 'direction', 'type': vector3Type, 'optional': false },
                { 'name': 'up', 'type': vector3Type, 'optional': true },
              ],
              cframeType,
              { 'description': 'Creates a CFrame at a position looking along a direction vector.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // Color3
  defineSymbol(
    env,
    'Color3',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'r', 'type': NumberType, 'optional': true },
                { 'name': 'g', 'type': NumberType, 'optional': true },
                { 'name': 'b', 'type': NumberType, 'optional': true },
              ],
              color3Type,
              { 'description': 'Creates a Color3 from red, green, and blue components in the range [0, 1].' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromRGB',
          {
            'type': createFunctionType(
              [
                { 'name': 'r', 'type': NumberType, 'optional': false },
                { 'name': 'g', 'type': NumberType, 'optional': false },
                { 'name': 'b', 'type': NumberType, 'optional': false },
              ],
              color3Type,
              { 'description': 'Creates a Color3 from red, green, and blue components in the range [0, 255].' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromHSV',
          {
            'type': createFunctionType(
              [
                { 'name': 'h', 'type': NumberType, 'optional': false },
                { 'name': 's', 'type': NumberType, 'optional': false },
                { 'name': 'v', 'type': NumberType, 'optional': false },
              ],
              color3Type,
              { 'description': 'Creates a Color3 from hue, saturation, and value components, each in the range [0, 1].' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromHex',
          {
            'type': createFunctionType(
              [{ 'name': 'hex', 'type': StringType, 'optional': false }],
              color3Type,
              { 'description': 'Creates a Color3 from a hexadecimal string (e.g., "#FF0000" or "FF0000").' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // BrickColor
  defineSymbol(
    env,
    'BrickColor',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [{ 'name': 'value', 'type': AnyType, 'optional': false }],
              AnyType,
              { 'description': 'Creates a BrickColor from a name, number, or Color3 value.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'palette',
          {
            'type': createFunctionType(
              [{ 'name': 'index', 'type': NumberType, 'optional': false }],
              AnyType,
              { 'description': 'Returns the BrickColor from the default palette at the given index (0-127).' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        ['random', { 'type': createFunctionType([], AnyType, { 'description': 'Returns a random BrickColor.' }), 'readonly': true, 'optional': false }],
        ['White', { 'type': createFunctionType([], AnyType), 'readonly': true, 'optional': false }],
        ['Black', { 'type': createFunctionType([], AnyType), 'readonly': true, 'optional': false }],
        ['Red', { 'type': createFunctionType([], AnyType), 'readonly': true, 'optional': false }],
        ['Green', { 'type': createFunctionType([], AnyType), 'readonly': true, 'optional': false }],
        ['Blue', { 'type': createFunctionType([], AnyType), 'readonly': true, 'optional': false }],
        ['Yellow', { 'type': createFunctionType([], AnyType), 'readonly': true, 'optional': false }],
      ]),
    ),
    'Global',
    false,
  );

  // UDim
  defineSymbol(
    env,
    'UDim',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'scale', 'type': NumberType, 'optional': false },
                { 'name': 'offset', 'type': NumberType, 'optional': false },
              ],
              udimType,
              { 'description': 'Creates a new UDim from scale and offset components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // UDim2
  defineSymbol(
    env,
    'UDim2',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'xScale', 'type': NumberType, 'optional': false },
                { 'name': 'xOffset', 'type': NumberType, 'optional': false },
                { 'name': 'yScale', 'type': NumberType, 'optional': false },
                { 'name': 'yOffset', 'type': NumberType, 'optional': false },
              ],
              udim2Type,
              { 'description': 'Creates a new UDim2 from X and Y scale and offset components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromScale',
          {
            'type': createFunctionType(
              [
                { 'name': 'xScale', 'type': NumberType, 'optional': false },
                { 'name': 'yScale', 'type': NumberType, 'optional': false },
              ],
              udim2Type,
              { 'description': 'Creates a new UDim2 from X and Y scale components with zero offsets.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromOffset',
          {
            'type': createFunctionType(
              [
                { 'name': 'xOffset', 'type': NumberType, 'optional': false },
                { 'name': 'yOffset', 'type': NumberType, 'optional': false },
              ],
              udim2Type,
              { 'description': 'Creates a new UDim2 from X and Y offset components with zero scale.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // Rect
  defineSymbol(
    env,
    'Rect',
    createTableType(
      new Map([
        [
          'new',
          { 'type': createFunctionType([], AnyType, { 'isVariadic': true, 'description': 'Creates a new Rect from min/max points or x/y coordinates.' }), 'readonly': true, 'optional': false },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // Region3
  defineSymbol(
    env,
    'Region3',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'min', 'type': vector3Type, 'optional': false },
                { 'name': 'max', 'type': vector3Type, 'optional': false },
              ],
              AnyType,
              { 'description': 'Creates a new Region3 from two Vector3 corners (min and max).' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // Ray
  defineSymbol(
    env,
    'Ray',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'origin', 'type': vector3Type, 'optional': false },
                { 'name': 'direction', 'type': vector3Type, 'optional': false },
              ],
              AnyType,
              { 'description': 'Creates a new Ray from an origin point and a direction vector.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // TweenInfo
  defineSymbol(
    env,
    'TweenInfo',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'time', 'type': NumberType, 'optional': true },
                { 'name': 'easingStyle', 'type': AnyType, 'optional': true },
                { 'name': 'easingDirection', 'type': AnyType, 'optional': true },
                { 'name': 'repeatCount', 'type': NumberType, 'optional': true },
                { 'name': 'reverses', 'type': BooleanType, 'optional': true },
                { 'name': 'delayTime', 'type': NumberType, 'optional': true },
              ],
              AnyType,
              { 'description': 'Creates a new TweenInfo with the given easing parameters for use with TweenService.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // NumberRange
  defineSymbol(
    env,
    'NumberRange',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'min', 'type': NumberType, 'optional': false },
                { 'name': 'max', 'type': NumberType, 'optional': true },
              ],
              AnyType,
              { 'description': 'Creates a new NumberRange from a minimum and optional maximum value.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // NumberSequence
  defineSymbol(
    env,
    'NumberSequence',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [{ 'name': 'value', 'type': AnyType, 'optional': false }],
              AnyType,
              { 'description': 'Creates a new NumberSequence from a single value, two values, or an array of NumberSequenceKeypoints.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // NumberSequenceKeypoint
  defineSymbol(
    env,
    'NumberSequenceKeypoint',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'time', 'type': NumberType, 'optional': false },
                { 'name': 'value', 'type': NumberType, 'optional': false },
                { 'name': 'envelope', 'type': NumberType, 'optional': true },
              ],
              AnyType,
              { 'description': 'Creates a new NumberSequenceKeypoint at the given time with a value and optional envelope.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // ColorSequence
  defineSymbol(
    env,
    'ColorSequence',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [{ 'name': 'value', 'type': AnyType, 'optional': false }],
              AnyType,
              { 'description': 'Creates a new ColorSequence from a single Color3, two Color3s, or an array of ColorSequenceKeypoints.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // ColorSequenceKeypoint
  defineSymbol(
    env,
    'ColorSequenceKeypoint',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'time', 'type': NumberType, 'optional': false },
                { 'name': 'color', 'type': color3Type, 'optional': false },
              ],
              AnyType,
              { 'description': 'Creates a new ColorSequenceKeypoint at the given time with the given color.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // PhysicalProperties
  defineSymbol(
    env,
    'PhysicalProperties',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [{ 'name': 'material', 'type': AnyType, 'optional': false }],
              AnyType,
              { 'description': 'Creates custom PhysicalProperties from a material or explicit density, friction, and elasticity values.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // OverlapParams
  defineSymbol(
    env,
    'OverlapParams',
    createTableType(
      new Map([['new', { 'type': createFunctionType([], AnyType, { 'description': 'Creates a new OverlapParams object for use with spatial query methods.' }), 'readonly': true, 'optional': false }]]),
    ),
    'Global',
    false,
  );

  // RaycastParams
  defineSymbol(
    env,
    'RaycastParams',
    createTableType(
      new Map([['new', { 'type': createFunctionType([], AnyType, { 'description': 'Creates a new RaycastParams object for use with workspace:Raycast().' }), 'readonly': true, 'optional': false }]]),
    ),
    'Global',
    false,
  );

  // Native vector type (Luau built-in)
  defineSymbol(
    env,
    'vector',
    createTableType(
      new Map([
        [
          'create',
          {
            'type': createFunctionType(
              [
                { 'name': 'x', 'type': NumberType, 'optional': false },
                { 'name': 'y', 'type': NumberType, 'optional': false },
                { 'name': 'z', 'type': NumberType, 'optional': false },
              ],
              { 'kind': 'Primitive', 'name': 'vector' },
              { 'description': 'Creates a new native vector with x, y, z components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'magnitude',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': AnyType, 'optional': false }],
              NumberType,
              { 'description': 'Returns the magnitude (length) of the vector.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'normalize',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': AnyType, 'optional': false }],
              { 'kind': 'Primitive', 'name': 'vector' },
              { 'description': 'Returns the unit vector (normalized to length 1).' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'cross',
          {
            'type': createFunctionType(
              [
                { 'name': 'a', 'type': AnyType, 'optional': false },
                { 'name': 'b', 'type': AnyType, 'optional': false },
              ],
              { 'kind': 'Primitive', 'name': 'vector' },
              { 'description': 'Returns the cross product of two vectors.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'dot',
          {
            'type': createFunctionType(
              [
                { 'name': 'a', 'type': AnyType, 'optional': false },
                { 'name': 'b', 'type': AnyType, 'optional': false },
              ],
              NumberType,
              { 'description': 'Returns the dot product of two vectors.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'floor',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': AnyType, 'optional': false }],
              { 'kind': 'Primitive', 'name': 'vector' },
              { 'description': 'Returns a vector with each component rounded down.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'ceil',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': AnyType, 'optional': false }],
              { 'kind': 'Primitive', 'name': 'vector' },
              { 'description': 'Returns a vector with each component rounded up.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'abs',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': AnyType, 'optional': false }],
              { 'kind': 'Primitive', 'name': 'vector' },
              { 'description': 'Returns a vector with the absolute value of each component.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'sign',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': AnyType, 'optional': false }],
              { 'kind': 'Primitive', 'name': 'vector' },
              { 'description': 'Returns a vector with the sign (-1, 0, or 1) of each component.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'clamp',
          {
            'type': createFunctionType(
              [
                { 'name': 'v', 'type': AnyType, 'optional': false },
                { 'name': 'min', 'type': AnyType, 'optional': false },
                { 'name': 'max', 'type': AnyType, 'optional': false },
              ],
              { 'kind': 'Primitive', 'name': 'vector' },
              { 'description': 'Returns a vector with each component clamped between min and max.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'max',
          {
            'type': createFunctionType([], { 'kind': 'Primitive', 'name': 'vector' }, { 'isVariadic': true, 'description': 'Returns the component-wise maximum of the given vectors.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'min',
          {
            'type': createFunctionType([], { 'kind': 'Primitive', 'name': 'vector' }, { 'isVariadic': true, 'description': 'Returns the component-wise minimum of the given vectors.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        ['zero', { 'type': { 'kind': 'Primitive', 'name': 'vector' }, 'readonly': true, 'optional': false }],
        ['one', { 'type': { 'kind': 'Primitive', 'name': 'vector' }, 'readonly': true, 'optional': false }],
      ]),
    ),
    'Global',
    false,
  );

  // Axes
  defineSymbol(
    env,
    'Axes',
    createTableType(
      new Map([
        [
          'new',
          { 'type': createFunctionType([], AnyType, { 'isVariadic': true, 'description': 'Creates a new Axes object from a combination of Enum.Axis or Enum.NormalId values.' }), 'readonly': true, 'optional': false },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // Faces
  defineSymbol(
    env,
    'Faces',
    createTableType(
      new Map([
        [
          'new',
          { 'type': createFunctionType([], AnyType, { 'isVariadic': true, 'description': 'Creates a new Faces object from a combination of Enum.NormalId values.' }), 'readonly': true, 'optional': false },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // Font
  defineSymbol(
    env,
    'Font',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'family', 'type': StringType, 'optional': false },
                { 'name': 'weight', 'type': AnyType, 'optional': true },
                { 'name': 'style', 'type': AnyType, 'optional': true },
              ],
              AnyType,
              { 'description': 'Creates a new Font from a font family asset ID or path, with optional weight and style.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromEnum',
          {
            'type': createFunctionType(
              [{ 'name': 'font', 'type': AnyType, 'optional': false }],
              AnyType,
              { 'description': 'Creates a Font from an Enum.Font value.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromName',
          {
            'type': createFunctionType(
              [
                { 'name': 'name', 'type': StringType, 'optional': false },
                { 'name': 'weight', 'type': AnyType, 'optional': true },
                { 'name': 'style', 'type': AnyType, 'optional': true },
              ],
              AnyType,
              { 'description': 'Creates a Font from a font name with optional weight and style.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromId',
          {
            'type': createFunctionType(
              [
                { 'name': 'id', 'type': NumberType, 'optional': false },
                { 'name': 'weight', 'type': AnyType, 'optional': true },
                { 'name': 'style', 'type': AnyType, 'optional': true },
              ],
              AnyType,
              { 'description': 'Creates a Font from a font asset ID with optional weight and style.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // DateTime
  defineSymbol(
    env,
    'DateTime',
    createTableType(
      new Map([
        ['now', { 'type': createFunctionType([], AnyType, { 'description': 'Returns a DateTime representing the current UTC time.' }), 'readonly': true, 'optional': false }],
        [
          'fromUnixTimestamp',
          {
            'type': createFunctionType(
              [{ 'name': 'timestamp', 'type': NumberType, 'optional': false }],
              AnyType,
              { 'description': 'Creates a DateTime from a Unix timestamp (seconds since epoch).' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromUnixTimestampMillis',
          {
            'type': createFunctionType(
              [{ 'name': 'timestamp', 'type': NumberType, 'optional': false }],
              AnyType,
              { 'description': 'Creates a DateTime from a Unix timestamp in milliseconds.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromIsoDate',
          {
            'type': createFunctionType(
              [{ 'name': 'isoDate', 'type': StringType, 'optional': false }],
              AnyType,
              { 'description': 'Creates a DateTime from an ISO 8601 date-time string.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromLocalTime',
          {
            'type': createFunctionType(
              [{ 'name': 'dateTime', 'type': AnyType, 'optional': false }],
              AnyType,
              { 'description': 'Creates a DateTime from a table of local time components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromUniversalTime',
          {
            'type': createFunctionType(
              [{ 'name': 'dateTime', 'type': AnyType, 'optional': false }],
              AnyType,
              { 'description': 'Creates a DateTime from a table of UTC time components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // PathWaypoint
  defineSymbol(
    env,
    'PathWaypoint',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'position', 'type': { 'kind': 'TypeReference', 'name': 'Vector3' }, 'optional': false },
                { 'name': 'action', 'type': AnyType, 'optional': true },
                { 'name': 'label', 'type': StringType, 'optional': true },
              ],
              AnyType,
              { 'description': 'Creates a new PathWaypoint at the given position with optional action and label.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // CatalogSearchParams
  defineSymbol(
    env,
    'CatalogSearchParams',
    createTableType(
      new Map([['new', { 'type': createFunctionType([], AnyType, { 'description': 'Creates a new CatalogSearchParams object for searching the avatar catalog.' }), 'readonly': true, 'optional': false }]]),
    ),
    'Global',
    false,
  );

  // Random
  defineSymbol(
    env,
    'Random',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [{ 'name': 'seed', 'type': NumberType, 'optional': true }],
              AnyType,
              { 'description': 'Creates a new Random number generator with an optional seed.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // Region3int16
  defineSymbol(
    env,
    'Region3int16',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'min', 'type': AnyType, 'optional': false },
                { 'name': 'max', 'type': AnyType, 'optional': false },
              ],
              AnyType,
              { 'description': 'Creates a new Region3int16 from two Vector3int16 corners.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // Vector2int16
  defineSymbol(
    env,
    'Vector2int16',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'x', 'type': NumberType, 'optional': true },
                { 'name': 'y', 'type': NumberType, 'optional': true },
              ],
              AnyType,
              { 'description': 'Creates a new Vector2int16 from integer x and y components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // Vector3int16
  defineSymbol(
    env,
    'Vector3int16',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'x', 'type': NumberType, 'optional': true },
                { 'name': 'y', 'type': NumberType, 'optional': true },
                { 'name': 'z', 'type': NumberType, 'optional': true },
              ],
              AnyType,
              { 'description': 'Creates a new Vector3int16 from integer x, y, and z components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
    'Global',
    false,
  );

  // Roblox-specific globals
  defineSymbol(
    env,
    'wait',
    createFunctionType(
      [{ 'name': 'seconds', 'type': NumberType, 'optional': true }],
      NumberType,
      { 'description': 'Yields the current thread for the given duration. Deprecated in favor of task.wait().' },
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'delay',
    createFunctionType(
      [
        { 'name': 'seconds', 'type': NumberType, 'optional': false },
        { 'name': 'callback', 'type': AnyType, 'optional': false },
      ],
      NilType,
      { 'description': 'Schedules a function to run after the given delay. Deprecated in favor of task.delay().' },
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'spawn',
    createFunctionType(
      [{ 'name': 'callback', 'type': AnyType, 'optional': false }],
      NilType,
      { 'description': 'Schedules a function to run in a new thread. Deprecated in favor of task.spawn().' },
    ),
    'Global',
    false,
  );
  defineSymbol(env, 'tick', createFunctionType([], NumberType, { 'description': 'Returns the time in seconds since the Unix epoch. Deprecated in favor of os.clock() or DateTime.' }), 'Global', false);
  defineSymbol(env, 'time', createFunctionType([], NumberType, { 'description': 'Returns the time in seconds since the game started running.' }), 'Global', false);
  defineSymbol(env, 'elapsedTime', createFunctionType([], NumberType, { 'description': 'Returns the time in seconds since Roblox started. Deprecated in favor of os.clock().' }), 'Global', false);
  defineSymbol(env, 'gcinfo', createFunctionType([], NumberType, { 'description': 'Returns the total memory heap size in kilobytes.' }), 'Global', false);
  defineSymbol(
    env,
    'collectgarbage',
    createFunctionType(
      [{ 'name': 'opt', 'type': StringType, 'optional': true }],
      AnyType,
      { 'description': 'Performs garbage collection operations. Only "count" is supported on Roblox.' },
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'loadstring',
    createFunctionType(
      [{ 'name': 'code', 'type': StringType, 'optional': false }],
      createFunctionType([], AnyType, { 'isVariadic': true }),
      { 'description': 'Compiles and returns the given string as a function. Disabled on Roblox by default.' },
    ),
    'Global',
    false,
  );

  // UserGameSettings type - returned by UserSettings():GetService("UserGameSettings")
  const vector2Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector2' };
  const userGameSettingsType: LuauType = createTableType(
    new Map([
      ['GamepadCameraSensitivity', { 'type': NumberType, 'readonly': false, 'optional': false }],
      ['MouseSensitivity', { 'type': NumberType, 'readonly': false, 'optional': false }],
      ['MouseSensitivityFirstPerson', { 'type': vector2Ref, 'readonly': false, 'optional': false }],
      ['MouseSensitivityThirdPerson', { 'type': vector2Ref, 'readonly': false, 'optional': false }],
      ['MasterVolume', { 'type': NumberType, 'readonly': false, 'optional': false }],
      [
        'ComputerCameraMovementMode',
        {
          'type': { 'kind': 'TypeReference', 'name': 'Enum.ComputerCameraMovementMode' },
          'readonly': false,
          'optional': false,
        },
      ],
      [
        'ComputerMovementMode',
        {
          'type': { 'kind': 'TypeReference', 'name': 'Enum.ComputerMovementMode' },
          'readonly': false,
          'optional': false,
        },
      ],
      [
        'ControlMode',
        { 'type': { 'kind': 'TypeReference', 'name': 'Enum.ControlMode' }, 'readonly': false, 'optional': false },
      ],
      [
        'RotationType',
        { 'type': { 'kind': 'TypeReference', 'name': 'Enum.RotationType' }, 'readonly': false, 'optional': false },
      ],
      [
        'TouchCameraMovementMode',
        {
          'type': { 'kind': 'TypeReference', 'name': 'Enum.TouchCameraMovementMode' },
          'readonly': false,
          'optional': false,
        },
      ],
      [
        'TouchMovementMode',
        { 'type': { 'kind': 'TypeReference', 'name': 'Enum.TouchMovementMode' }, 'readonly': false, 'optional': false },
      ],
      ['Fullscreen', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['GraphicsQualityLevel', { 'type': NumberType, 'readonly': false, 'optional': false }],
      [
        'SavedQualityLevel',
        {
          'type': { 'kind': 'TypeReference', 'name': 'Enum.SavedQualitySetting' },
          'readonly': false,
          'optional': false,
        },
      ],
      ['AllTutorialsDisabled', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['IsUsingCameraYInverted', { 'type': BooleanType, 'readonly': true, 'optional': false }],
      ['IsUsingGamepadCameraSensitivity', { 'type': BooleanType, 'readonly': true, 'optional': false }],
      ['ChatVisible', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['ChatTranslationEnabled', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['ChatTranslationLocale', { 'type': StringType, 'readonly': false, 'optional': false }],
      ['ChatTranslationToggleEnabled', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['HasEverUsedVR', { 'type': BooleanType, 'readonly': true, 'optional': false }],
      ['VREnabled', { 'type': BooleanType, 'readonly': true, 'optional': false }],
      ['VRRotationIntensity', { 'type': NumberType, 'readonly': false, 'optional': false }],
      ['VRSmoothRotationEnabled', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['VignetteEnabled', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['OnboardingsCompleted', { 'type': StringType, 'readonly': false, 'optional': false }],
      ['RCCProfilerRecordFrameRate', { 'type': NumberType, 'readonly': false, 'optional': false }],
      ['RCCProfilerRecordTimeFrame', { 'type': NumberType, 'readonly': false, 'optional': false }],
      ['DefaultCameraID', { 'type': StringType, 'readonly': false, 'optional': false }],
      ['DefaultMicrophoneID', { 'type': StringType, 'readonly': false, 'optional': false }],
      ['StartMaximized', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['StartScreenPosition', { 'type': vector2Ref, 'readonly': false, 'optional': false }],
      ['StartScreenSize', { 'type': vector2Ref, 'readonly': false, 'optional': false }],
      [
        'GetCameraYInvertValue',
        {
          'type': createFunctionType([], NumberType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'GetOnboardingCompleted',
        {
          'type': createFunctionType([{ 'name': 'onboardingId', 'type': StringType, 'optional': false }], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'InFullScreen',
        {
          'type': createFunctionType([], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'InStudioMode',
        {
          'type': createFunctionType([], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetCameraYInvertVisible',
        {
          'type': createFunctionType([], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetGamepadCameraSensitivityVisible',
        {
          'type': createFunctionType([], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetOnboardingCompleted',
        {
          'type': createFunctionType([{ 'name': 'onboardingId', 'type': StringType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

  // UserSettings type - returned by UserSettings() global function
  const userSettingsType: LuauType = createTableType(
    new Map([
      [
        'GetService',
        {
          'type': createFunctionType(
            [{ 'name': 'serviceName', 'type': StringType, 'optional': false }],
            userGameSettingsType,
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'IsUserFeatureEnabled',
        {
          'type': createFunctionType([{ 'name': 'feature', 'type': StringType, 'optional': false }], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

  // UserSettings() global function
  defineSymbol(env, 'UserSettings', createFunctionType([], userSettingsType), 'Global', false);
  defineSymbol(env, 'settings', createFunctionType([], AnyType), 'Global', false);
};

/**
 * Adds Sunc executor-specific globals to the environment
 * @param env - The type environment to populate
 */
export const addSuncGlobals = (env: TypeEnvironment): void => {
  defineSymbol(env, 'checkcaller', createFunctionType([], BooleanType), 'Global', false);
  defineSymbol(
    env,
    'clonefunction',
    createFunctionType([{ 'name': 'func', 'type': AnyType, 'optional': false }], AnyType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'hookfunction',
    createFunctionType(
      [
        { 'name': 'func', 'type': AnyType, 'optional': false },
        { 'name': 'hook', 'type': AnyType, 'optional': false },
      ],
      AnyType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'hookmetamethod',
    createFunctionType(
      [
        { 'name': 'obj', 'type': AnyType, 'optional': false },
        { 'name': 'method', 'type': StringType, 'optional': false },
        { 'name': 'hook', 'type': AnyType, 'optional': false },
      ],
      createFunctionType([], AnyType, { 'isVariadic': true }), // Returns the original function
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'iscclosure',
    createFunctionType([{ 'name': 'func', 'type': AnyType, 'optional': false }], BooleanType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'islclosure',
    createFunctionType([{ 'name': 'func', 'type': AnyType, 'optional': false }], BooleanType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'isexecutorclosure',
    createFunctionType([{ 'name': 'func', 'type': AnyType, 'optional': false }], BooleanType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'newcclosure',
    createFunctionType([{ 'name': 'func', 'type': AnyType, 'optional': false }], AnyType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'restorefunction',
    createFunctionType([{ 'name': 'func', 'type': AnyType, 'optional': false }], NilType),
    'Global',
    false,
  );

  // Environment
  defineSymbol(env, 'getgc', createFunctionType([], AnyType), 'Global', false);
  defineSymbol(env, 'getgenv', createFunctionType([], AnyType), 'Global', false);
  defineSymbol(env, 'getrenv', createFunctionType([], AnyType), 'Global', false);
  defineSymbol(env, 'getreg', createFunctionType([], AnyType), 'Global', false);
  defineSymbol(
    env,
    'filtergc',
    createFunctionType([{ 'name': 'filter', 'type': AnyType, 'optional': false }], AnyType),
    'Global',
    false,
  );

  // Filesystem
  defineSymbol(
    env,
    'readfile',
    createFunctionType([{ 'name': 'path', 'type': StringType, 'optional': false }], StringType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'writefile',
    createFunctionType(
      [
        { 'name': 'path', 'type': StringType, 'optional': false },
        { 'name': 'content', 'type': StringType, 'optional': false },
      ],
      NilType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'appendfile',
    createFunctionType(
      [
        { 'name': 'path', 'type': StringType, 'optional': false },
        { 'name': 'content', 'type': StringType, 'optional': false },
      ],
      NilType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'isfile',
    createFunctionType([{ 'name': 'path', 'type': StringType, 'optional': false }], BooleanType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'isfolder',
    createFunctionType([{ 'name': 'path', 'type': StringType, 'optional': false }], BooleanType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'delfile',
    createFunctionType([{ 'name': 'path', 'type': StringType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'delfolder',
    createFunctionType([{ 'name': 'path', 'type': StringType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'makefolder',
    createFunctionType([{ 'name': 'path', 'type': StringType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'listfiles',
    createFunctionType([{ 'name': 'path', 'type': StringType, 'optional': false }], AnyType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'loadfile',
    createFunctionType([{ 'name': 'path', 'type': StringType, 'optional': false }], AnyType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'getcustomasset',
    createFunctionType([{ 'name': 'path', 'type': StringType, 'optional': false }], StringType),
    'Global',
    false,
  );

  // Encoding
  defineSymbol(
    env,
    'base64encode',
    createFunctionType([{ 'name': 'data', 'type': StringType, 'optional': false }], StringType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'base64decode',
    createFunctionType([{ 'name': 'data', 'type': StringType, 'optional': false }], StringType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'lz4compress',
    createFunctionType([{ 'name': 'data', 'type': StringType, 'optional': false }], StringType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'lz4decompress',
    createFunctionType(
      [
        { 'name': 'data', 'type': StringType, 'optional': false },
        { 'name': 'size', 'type': NumberType, 'optional': false },
      ],
      StringType,
    ),
    'Global',
    false,
  );

  // Instances
  defineSymbol(
    env,
    'cloneref',
    createFunctionType([{ 'name': 'instance', 'type': AnyType, 'optional': false }], AnyType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'compareinstances',
    createFunctionType(
      [
        { 'name': 'a', 'type': AnyType, 'optional': false },
        { 'name': 'b', 'type': AnyType, 'optional': false },
      ],
      BooleanType,
    ),
    'Global',
    false,
  );
  defineSymbol(env, 'getinstances', createFunctionType([], AnyType), 'Global', false);
  defineSymbol(env, 'getnilinstances', createFunctionType([], AnyType), 'Global', false);
  defineSymbol(env, 'gethui', createFunctionType([], AnyType), 'Global', false);
  defineSymbol(
    env,
    'fireclickdetector',
    createFunctionType([{ 'name': 'detector', 'type': AnyType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'fireproximityprompt',
    createFunctionType([{ 'name': 'prompt', 'type': AnyType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'firetouchinterest',
    createFunctionType(
      [
        { 'name': 'part', 'type': AnyType, 'optional': false },
        { 'name': 'humanoid', 'type': AnyType, 'optional': false },
        { 'name': 'state', 'type': NumberType, 'optional': false },
      ],
      NilType,
    ),
    'Global',
    false,
  );

  // Scripts
  defineSymbol(env, 'getcallingscript', createFunctionType([], AnyType), 'Global', false);
  defineSymbol(env, 'getloadedmodules', createFunctionType([], AnyType), 'Global', false);
  defineSymbol(env, 'getrunningscripts', createFunctionType([], AnyType), 'Global', false);
  defineSymbol(env, 'getscripts', createFunctionType([], AnyType), 'Global', false);
  defineSymbol(
    env,
    'getscriptbytecode',
    createFunctionType([{ 'name': 'script', 'type': AnyType, 'optional': false }], StringType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'getscriptclosure',
    createFunctionType([{ 'name': 'script', 'type': AnyType, 'optional': false }], AnyType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'getscripthash',
    createFunctionType([{ 'name': 'script', 'type': AnyType, 'optional': false }], StringType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'getsenv',
    createFunctionType([{ 'name': 'script', 'type': AnyType, 'optional': false }], AnyType),
    'Global',
    false,
  );

  // Metatable
  defineSymbol(
    env,
    'getrawmetatable',
    createFunctionType([{ 'name': 'obj', 'type': AnyType, 'optional': false }], AnyType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'setrawmetatable',
    createFunctionType(
      [
        { 'name': 'obj', 'type': AnyType, 'optional': false },
        { 'name': 'mt', 'type': AnyType, 'optional': false },
      ],
      AnyType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'isreadonly',
    createFunctionType([{ 'name': 'table', 'type': AnyType, 'optional': false }], BooleanType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'setreadonly',
    createFunctionType(
      [
        { 'name': 'table', 'type': AnyType, 'optional': false },
        { 'name': 'readonly', 'type': BooleanType, 'optional': false },
      ],
      NilType,
    ),
    'Global',
    false,
  );
  defineSymbol(env, 'getnamecallmethod', createFunctionType([], StringType), 'Global', false);

  // Reflection
  defineSymbol(
    env,
    'gethiddenproperty',
    createFunctionType(
      [
        { 'name': 'obj', 'type': AnyType, 'optional': false },
        { 'name': 'prop', 'type': StringType, 'optional': false },
      ],
      AnyType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'sethiddenproperty',
    createFunctionType(
      [
        { 'name': 'obj', 'type': AnyType, 'optional': false },
        { 'name': 'prop', 'type': StringType, 'optional': false },
        { 'name': 'value', 'type': AnyType, 'optional': false },
      ],
      NilType,
    ),
    'Global',
    false,
  );
  defineSymbol(env, 'getthreadidentity', createFunctionType([], NumberType), 'Global', false);
  defineSymbol(
    env,
    'setthreadidentity',
    createFunctionType([{ 'name': 'identity', 'type': NumberType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'isscriptable',
    createFunctionType(
      [
        { 'name': 'obj', 'type': AnyType, 'optional': false },
        { 'name': 'prop', 'type': StringType, 'optional': false },
      ],
      BooleanType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'setscriptable',
    createFunctionType(
      [
        { 'name': 'obj', 'type': AnyType, 'optional': false },
        { 'name': 'prop', 'type': StringType, 'optional': false },
        { 'name': 'scriptable', 'type': BooleanType, 'optional': false },
      ],
      NilType,
    ),
    'Global',
    false,
  );

  // Signals
  defineSymbol(
    env,
    'firesignal',
    createFunctionType([{ 'name': 'signal', 'type': AnyType, 'optional': false }], NilType, { 'isVariadic': true }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'getconnections',
    createFunctionType([{ 'name': 'signal', 'type': AnyType, 'optional': false }], AnyType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'replicatesignal',
    createFunctionType([{ 'name': 'signal', 'type': AnyType, 'optional': false }], NilType),
    'Global',
    false,
  );

  // Misc
  defineSymbol(
    env,
    'identifyexecutor',
    createFunctionType([], { 'kind': 'Union', 'types': [StringType, { 'kind': 'Primitive', 'name': 'nil' }] }),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'request',
    createFunctionType([{ 'name': 'options', 'type': RequestOptionsType, 'optional': false }], RequestResponseType),
    'Global',
    false,
  );

  // Additional common executor globals
  defineSymbol(
    env,
    'setsimulationradius',
    createFunctionType([{ 'name': 'radius', 'type': NumberType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'set_simulation_radius',
    createFunctionType([{ 'name': 'radius', 'type': NumberType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'set_hidden_prop',
    createFunctionType(
      [
        { 'name': 'obj', 'type': AnyType, 'optional': false },
        { 'name': 'prop', 'type': StringType, 'optional': false },
        { 'name': 'value', 'type': AnyType, 'optional': false },
      ],
      NilType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'get_hidden_prop',
    createFunctionType(
      [
        { 'name': 'obj', 'type': AnyType, 'optional': false },
        { 'name': 'prop', 'type': StringType, 'optional': false },
      ],
      AnyType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'getpropvalue',
    createFunctionType(
      [
        { 'name': 'obj', 'type': AnyType, 'optional': false },
        { 'name': 'prop', 'type': StringType, 'optional': false },
      ],
      AnyType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'setpropvalue',
    createFunctionType(
      [
        { 'name': 'obj', 'type': AnyType, 'optional': false },
        { 'name': 'prop', 'type': StringType, 'optional': false },
        { 'name': 'value', 'type': AnyType, 'optional': false },
      ],
      NilType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'get_signal_cons',
    createFunctionType([{ 'name': 'signal', 'type': AnyType, 'optional': false }], AnyType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'setclipboard',
    createFunctionType([{ 'name': 'text', 'type': StringType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(env, 'getclipboard', createFunctionType([], StringType), 'Global', false);
  defineSymbol(
    env,
    'toclipboard',
    createFunctionType([{ 'name': 'text', 'type': StringType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'Hash',
    createFunctionType([{ 'name': 'data', 'type': StringType, 'optional': false }], StringType),
    'Global',
    false,
  );

  // Executor detection flags
  defineSymbol(env, 'PROTOSMASHER_LOADED', BooleanType, 'Global', false);
  defineSymbol(env, 'KRNL_LOADED', BooleanType, 'Global', false);
  defineSymbol(env, 'SENTINEL_LOADED', BooleanType, 'Global', false);
  defineSymbol(env, 'SIRHURT_LOADED', BooleanType, 'Global', false);

  // Console functions
  defineSymbol(
    env,
    'rconsoleprint',
    createFunctionType([{ 'name': 'text', 'type': StringType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(env, 'rconsoleclear', createFunctionType([], NilType), 'Global', false);
  defineSymbol(
    env,
    'rconsolename',
    createFunctionType([{ 'name': 'name', 'type': StringType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(env, 'rconsoleinput', createFunctionType([], StringType), 'Global', false);
  defineSymbol(
    env,
    'printconsole',
    createFunctionType([{ 'name': 'text', 'type': StringType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'queueonteleport',
    createFunctionType([{ 'name': 'script', 'type': StringType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'queue_on_teleport',
    createFunctionType([{ 'name': 'script', 'type': StringType, 'optional': false }], NilType),
    'Global',
    false,
  );

  // Mouse functions
  defineSymbol(env, 'mouse1click', createFunctionType([], NilType), 'Global', false);
  defineSymbol(env, 'mouse1press', createFunctionType([], NilType), 'Global', false);
  defineSymbol(env, 'mouse1release', createFunctionType([], NilType), 'Global', false);
  defineSymbol(env, 'mouse2click', createFunctionType([], NilType), 'Global', false);
  defineSymbol(env, 'mouse2press', createFunctionType([], NilType), 'Global', false);
  defineSymbol(env, 'mouse2release', createFunctionType([], NilType), 'Global', false);
  defineSymbol(
    env,
    'mousemoverel',
    createFunctionType(
      [
        { 'name': 'x', 'type': NumberType, 'optional': false },
        { 'name': 'y', 'type': NumberType, 'optional': false },
      ],
      NilType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'mousemoveabs',
    createFunctionType(
      [
        { 'name': 'x', 'type': NumberType, 'optional': false },
        { 'name': 'y', 'type': NumberType, 'optional': false },
      ],
      NilType,
    ),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'mousescroll',
    createFunctionType([{ 'name': 'pixels', 'type': NumberType, 'optional': false }], NilType),
    'Global',
    false,
  );

  // Keyboard functions
  defineSymbol(
    env,
    'keypress',
    createFunctionType([{ 'name': 'keycode', 'type': NumberType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'keyrelease',
    createFunctionType([{ 'name': 'keycode', 'type': NumberType, 'optional': false }], NilType),
    'Global',
    false,
  );
  defineSymbol(env, 'isrbxactive', createFunctionType([], BooleanType), 'Global', false);
  defineSymbol(env, 'isgameactive', createFunctionType([], BooleanType), 'Global', false);

  // HTTP variants
  defineSymbol(
    env,
    'http_request',
    createFunctionType([{ 'name': 'options', 'type': RequestOptionsType, 'optional': false }], RequestResponseType),
    'Global',
    false,
  );
  defineSymbol(
    env,
    'syn_request',
    createFunctionType([{ 'name': 'options', 'type': RequestOptionsType, 'optional': false }], RequestResponseType),
    'Global',
    false,
  );

  // Crypt namespace
  const cryptNamespace = createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } });
  defineSymbol(env, 'crypt', cryptNamespace, 'Global', false);

  // syn namespace (Synapse X specific)
  const synNamespace = createTableType(
    new Map([
      [
        'request',
        {
          'type': createFunctionType(
            [{ 'name': 'options', 'type': RequestOptionsType, 'optional': false }],
            RequestResponseType,
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'cache_invalidate',
        {
          'type': createFunctionType([{ 'name': 'obj', 'type': AnyType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'cache_isbached',
        {
          'type': createFunctionType([{ 'name': 'obj', 'type': AnyType, 'optional': false }], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'cache_replace',
        {
          'type': createFunctionType(
            [
              { 'name': 'obj', 'type': AnyType, 'optional': false },
              { 'name': 'newObj', 'type': AnyType, 'optional': false },
            ],
            NilType,
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'crypt',
        {
          'type': createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'set_thread_identity',
        {
          'type': createFunctionType([{ 'name': 'identity', 'type': NumberType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      ['get_thread_identity', { 'type': createFunctionType([], NumberType), 'readonly': true, 'optional': false }],
      [
        'is_cached',
        {
          'type': createFunctionType([{ 'name': 'obj', 'type': AnyType, 'optional': false }], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'write_clipboard',
        {
          'type': createFunctionType([{ 'name': 'text', 'type': StringType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'queue_on_teleport',
        {
          'type': createFunctionType([{ 'name': 'script', 'type': StringType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'protect_gui',
        {
          'type': createFunctionType([{ 'name': 'gui', 'type': AnyType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'unprotect_gui',
        {
          'type': createFunctionType([{ 'name': 'gui', 'type': AnyType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'secure_call',
        {
          'type': createFunctionType([{ 'name': 'func', 'type': AnyType, 'optional': false }], AnyType, {
            'isVariadic': true,
          }),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
    { 'indexer': { 'keyType': StringType, 'valueType': AnyType } },
  );
  defineSymbol(env, 'syn', synNamespace, 'Global', false);
};
