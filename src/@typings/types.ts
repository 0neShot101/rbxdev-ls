/**
 * Luau Type System - Core Type Definitions
 *
 * This module provides the foundational type definitions for the Luau type system,
 * including primitive types, composite types, class types, and utility functions
 * for type manipulation and comparison.
 */

/**
 * Union of all possible Luau types in the type system.
 * This is the base type that all Luau type representations extend from.
 */
export type LuauType =
  | PrimitiveType
  | LiteralType
  | FunctionType
  | TableType
  | ClassType
  | EnumType
  | UnionType
  | IntersectionType
  | OptionalType
  | VariadicType
  | GenericType
  | TypeVariable
  | TypeReference
  | AnyType
  | UnknownType
  | NeverType
  | ErrorType
  | LazyType;

/**
 * Reference to a named type, resolved during type checking.
 * Used when a type is referenced by name before it has been fully resolved.
 * @property kind - Discriminator for the TypeReference type
 * @property name - The name of the referenced type
 * @property typeArgs - Optional array of type arguments for generic type references
 */
export interface TypeReference {
  readonly kind: 'TypeReference';
  readonly name: string;
  readonly typeArgs?: ReadonlyArray<LuauType>;
}

/**
 * Luau primitive types: nil, boolean, number, string, thread, buffer, vector.
 * These are the basic built-in types in the Luau language.
 * @property kind - Discriminator for the PrimitiveType type
 * @property name - The name of the primitive type
 */
export interface PrimitiveType {
  readonly kind: 'Primitive';
  readonly name: 'nil' | 'boolean' | 'number' | 'string' | 'thread' | 'buffer' | 'vector';
}

export const NilType: PrimitiveType = { 'kind': 'Primitive', 'name': 'nil' };
export const BooleanType: PrimitiveType = { 'kind': 'Primitive', 'name': 'boolean' };
export const NumberType: PrimitiveType = { 'kind': 'Primitive', 'name': 'number' };
export const StringType: PrimitiveType = { 'kind': 'Primitive', 'name': 'string' };
export const ThreadType: PrimitiveType = { 'kind': 'Primitive', 'name': 'thread' };
export const BufferType: PrimitiveType = { 'kind': 'Primitive', 'name': 'buffer' };
export const VectorType: PrimitiveType = { 'kind': 'Primitive', 'name': 'vector' };

/**
 * Literal type representing a specific string, number, or boolean value.
 * Allows for more precise type checking by constraining to exact values.
 * @property kind - Discriminator for the LiteralType type
 * @property value - The literal value (string, number, or boolean)
 * @property baseType - The underlying primitive type of the literal
 */
export interface LiteralType {
  readonly kind: 'Literal';
  readonly value: string | number | boolean;
  readonly baseType: 'string' | 'number' | 'boolean';
}

/**
 * Creates a string literal type representing an exact string value.
 * @param value - The string value for the literal type
 * @returns A LiteralType with baseType 'string' and the specified value
 */
export const createStringLiteral = (value: string): LiteralType => ({
  'kind': 'Literal',
  value,
  'baseType': 'string',
});

/**
 * Creates a number literal type representing an exact numeric value.
 * @param value - The number value for the literal type
 * @returns A LiteralType with baseType 'number' and the specified value
 */
export const createNumberLiteral = (value: number): LiteralType => ({
  'kind': 'Literal',
  value,
  'baseType': 'number',
});

/**
 * Creates a boolean literal type representing true or false.
 * @param value - The boolean value for the literal type
 * @returns A LiteralType with baseType 'boolean' and the specified value
 */
export const createBooleanLiteral = (value: boolean): LiteralType => ({
  'kind': 'Literal',
  value,
  'baseType': 'boolean',
});

export const TrueLiteral = createBooleanLiteral(true);
export const FalseLiteral = createBooleanLiteral(false);

/**
 * Function type with parameters, return type, and optional type parameters.
 * Represents callable values in the Luau type system.
 * @property kind - Discriminator for the FunctionType type
 * @property typeParams - Array of generic type parameter definitions
 * @property thisType - The type of 'self' for method calls, undefined for regular functions
 * @property params - Array of function parameter definitions
 * @property returnType - The type returned by the function
 * @property isVariadic - Whether the function accepts variable arguments
 * @property description - Optional documentation description for the function
 * @property example - Optional usage example for documentation
 */
export interface FunctionType {
  readonly kind: 'Function';
  readonly typeParams: ReadonlyArray<TypeParameterDef>;
  readonly thisType: LuauType | undefined;
  readonly params: ReadonlyArray<FunctionParam>;
  readonly returnType: LuauType;
  readonly isVariadic: boolean;
  readonly description?: string;
  readonly example?: string;
}

/**
 * Parameter definition for function types.
 * Describes a single parameter in a function signature.
 * @property name - The parameter name, undefined for unnamed parameters
 * @property type - The type of the parameter
 * @property optional - Whether the parameter is optional
 */
export interface FunctionParam {
  readonly name: string | undefined;
  readonly type: LuauType;
  readonly optional: boolean;
}

/**
 * Generic type parameter definition with optional constraint and default.
 * Used to define type parameters in generic functions and types.
 * @property name - The name of the type parameter (e.g., 'T', 'K', 'V')
 * @property constraint - Optional type constraint that the type argument must satisfy
 * @property defaultType - Optional default type used when no argument is provided
 */
export interface TypeParameterDef {
  readonly name: string;
  readonly constraint: LuauType | undefined;
  readonly defaultType: LuauType | undefined;
}

/**
 * Creates a function type with the given parameters and return type.
 * @param params - Array of function parameter definitions
 * @param returnType - The return type of the function
 * @param options - Optional configuration for the function type
 * @param options.typeParams - Array of generic type parameter definitions
 * @param options.thisType - The type of 'self' for method calls
 * @param options.isVariadic - Whether the function accepts variable arguments
 * @param options.description - Documentation description for the function
 * @param options.example - Usage example for documentation
 * @returns A FunctionType object representing the function signature
 */
export const createFunctionType = (
  params: ReadonlyArray<FunctionParam>,
  returnType: LuauType,
  options?: {
    typeParams?: ReadonlyArray<TypeParameterDef>;
    thisType?: LuauType;
    isVariadic?: boolean;
    description?: string;
    example?: string;
  },
): FunctionType => {
  const result: FunctionType = {
    'kind': 'Function',
    'typeParams': options?.typeParams ?? [],
    'thisType': options?.thisType,
    params,
    returnType,
    'isVariadic': options?.isVariadic ?? false,
  };

  if (options?.description !== undefined) {
    (result as { description?: string }).description = options.description;
  }
  if (options?.example !== undefined) {
    (result as { example?: string }).example = options.example;
  }

  return result;
};

/**
 * Table type with named properties, optional indexer, and metatable.
 * Represents Luau table values including arrays, dictionaries, and objects.
 * @property kind - Discriminator for the TableType type
 * @property properties - Map of property names to their type definitions
 * @property indexer - Optional indexer signature for dynamic key access
 * @property metatable - Optional metatable type for metamethod support
 * @property isArray - Whether this table represents an array-like structure
 */
export interface TableType {
  readonly kind: 'Table';
  readonly properties: ReadonlyMap<string, PropertyType>;
  readonly indexer: TableIndexer | undefined;
  readonly metatable: TableType | undefined;
  readonly isArray: boolean;
}

/**
 * Property definition for table types.
 * Describes a single named property within a table.
 * @property type - The type of the property value
 * @property readonly - Whether the property can be modified
 * @property optional - Whether the property may be absent
 * @property deprecated - Whether the property is deprecated
 * @property deprecationMessage - Optional message explaining the deprecation
 */
export interface PropertyType {
  readonly type: LuauType;
  readonly readonly: boolean;
  readonly optional: boolean;
  readonly deprecated?: boolean;
  readonly deprecationMessage?: string;
}

/**
 * Indexer signature for table types: [keyType]: valueType.
 * Allows dynamic key access with typed keys and values.
 * @property keyType - The type of keys that can be used to index the table
 * @property valueType - The type of values returned when indexing
 */
export interface TableIndexer {
  readonly keyType: LuauType;
  readonly valueType: LuauType;
}

/**
 * Creates a table type with the given properties.
 * @param properties - Map of property names to their type definitions
 * @param options - Optional configuration for the table type
 * @param options.indexer - Indexer signature for dynamic key access
 * @param options.metatable - Metatable type for metamethod support
 * @param options.isArray - Whether this table represents an array-like structure
 * @returns A TableType object representing the table structure
 */
export const createTableType = (
  properties: ReadonlyMap<string, PropertyType>,
  options?: {
    indexer?: TableIndexer;
    metatable?: TableType;
    isArray?: boolean;
  },
): TableType => ({
  'kind': 'Table',
  properties,
  'indexer': options?.indexer,
  'metatable': options?.metatable,
  'isArray': options?.isArray ?? false,
});

/**
 * Creates an array type with the given element type.
 * Arrays are tables indexed by numbers starting at 1.
 * @param elementType - The type of elements in the array
 * @returns A TableType configured as an array with the specified element type
 */
export const createArrayType = (elementType: LuauType): TableType => ({
  'kind': 'Table',
  'properties': new Map(),
  'indexer': { 'keyType': NumberType, 'valueType': elementType },
  'metatable': undefined,
  'isArray': true,
});

/**
 * Creates a dictionary type with the given key and value types.
 * Dictionaries are tables with a consistent key and value type.
 * @param keyType - The type of keys in the dictionary
 * @param valueType - The type of values in the dictionary
 * @returns A TableType configured as a dictionary with the specified key and value types
 */
export const createDictionaryType = (keyType: LuauType, valueType: LuauType): TableType => ({
  'kind': 'Table',
  'properties': new Map(),
  'indexer': { keyType, valueType },
  'metatable': undefined,
  'isArray': false,
});

/**
 * Roblox Instance class type with properties, methods, events, and inheritance.
 * Represents Roblox API classes like Part, Model, Script, etc.
 * @property kind - Discriminator for the ClassType type
 * @property name - The name of the class (e.g., 'Part', 'Model')
 * @property superclass - The parent class, undefined for root classes
 * @property properties - Map of property names to their definitions
 * @property methods - Map of method names to their definitions
 * @property events - Map of event names to their definitions
 * @property tags - Array of API tags (e.g., 'Deprecated', 'ReadOnly')
 */
export interface ClassType {
  readonly kind: 'Class';
  readonly name: string;
  readonly superclass: ClassType | undefined;
  readonly properties: ReadonlyMap<string, ClassProperty>;
  readonly methods: ReadonlyMap<string, ClassMethod>;
  readonly events: ReadonlyMap<string, EventType>;
  readonly tags: ReadonlyArray<string>;
}

/**
 * Method definition for class types.
 * Wraps a FunctionType with additional metadata for class methods.
 * @property func - The function type representing the method signature
 * @property deprecated - Whether the method is deprecated
 * @property deprecationMessage - Optional message explaining the deprecation
 */
export interface ClassMethod {
  readonly func: FunctionType;
  readonly deprecated?: boolean;
  readonly deprecationMessage?: string;
}

/**
 * Property definition for class types with security level.
 * Describes a property on a Roblox class with access control.
 * @property type - The type of the property value
 * @property readonly - Whether the property can be modified
 * @property security - The security level required to access the property
 * @property deprecated - Whether the property is deprecated
 * @property deprecationMessage - Optional message explaining the deprecation
 */
export interface ClassProperty {
  readonly type: LuauType;
  readonly readonly: boolean;
  readonly security: SecurityLevel;
  readonly deprecated?: boolean;
  readonly deprecationMessage?: string;
}

/**
 * RBXScriptSignal event type with callback parameters.
 * Represents Roblox events that can be connected to callbacks.
 * @property kind - Discriminator for the EventType type
 * @property params - Array of parameters passed to event callbacks
 */
export interface EventType {
  readonly kind: 'Event';
  readonly params: ReadonlyArray<FunctionParam>;
}

/**
 * Roblox API security levels for properties and methods.
 * Determines what context can access a given API member.
 * - 'None': Accessible from any script
 * - 'LocalUserSecurity': Accessible only from local scripts
 * - 'PluginSecurity': Accessible only from Studio plugins
 * - 'RobloxScriptSecurity': Accessible only from Roblox core scripts
 */
export type SecurityLevel = 'None' | 'LocalUserSecurity' | 'PluginSecurity' | 'RobloxScriptSecurity';

/**
 * Creates a class type with the given name and options.
 * @param name - The name of the class (e.g., 'Part', 'Model')
 * @param options - Optional configuration for the class type
 * @param options.superclass - The parent class for inheritance
 * @param options.properties - Map of property names to their definitions
 * @param options.methods - Map of method names to their definitions
 * @param options.events - Map of event names to their definitions
 * @param options.tags - Array of API tags (e.g., 'Deprecated', 'ReadOnly')
 * @returns A ClassType object representing the Roblox class
 */
export const createClassType = (
  name: string,
  options?: {
    superclass?: ClassType;
    properties?: ReadonlyMap<string, ClassProperty>;
    methods?: ReadonlyMap<string, ClassMethod>;
    events?: ReadonlyMap<string, EventType>;
    tags?: ReadonlyArray<string>;
  },
): ClassType => ({
  'kind': 'Class',
  name,
  'superclass': options?.superclass,
  'properties': options?.properties ?? new Map(),
  'methods': options?.methods ?? new Map(),
  'events': options?.events ?? new Map(),
  'tags': options?.tags ?? [],
});

/**
 * Roblox Enum type with named items.
 * Represents Roblox enumerations like Enum.KeyCode, Enum.Material, etc.
 * @property kind - Discriminator for the EnumType type
 * @property name - The name of the enum (e.g., 'KeyCode', 'Material')
 * @property items - Map of item names to their definitions
 */
export interface EnumType {
  readonly kind: 'Enum';
  readonly name: string;
  readonly items: ReadonlyMap<string, EnumItem>;
}

/**
 * Individual enum item with name and numeric value.
 * Represents a single value within a Roblox enumeration.
 * @property name - The name of the enum item (e.g., 'Space' for Enum.KeyCode.Space)
 * @property value - The underlying numeric value of the enum item
 */
export interface EnumItem {
  readonly name: string;
  readonly value: number;
}

/**
 * Creates an enum type with the given name and items.
 * @param name - The name of the enum (e.g., 'KeyCode', 'Material')
 * @param items - Map of item names to their definitions
 * @returns An EnumType object representing the Roblox enumeration
 */
export const createEnumType = (name: string, items: ReadonlyMap<string, EnumItem>): EnumType => ({
  'kind': 'Enum',
  name,
  items,
});

/**
 * Union type representing one of several possible types (A | B | C).
 * A value of this type can be any one of the constituent types.
 * @property kind - Discriminator for the UnionType type
 * @property types - Array of types that make up the union
 */
export interface UnionType {
  readonly kind: 'Union';
  readonly types: ReadonlyArray<LuauType>;
}

/**
 * Intersection type combining multiple types (A & B & C).
 * A value of this type must satisfy all constituent types simultaneously.
 * @property kind - Discriminator for the IntersectionType type
 * @property types - Array of types that must all be satisfied
 */
export interface IntersectionType {
  readonly kind: 'Intersection';
  readonly types: ReadonlyArray<LuauType>;
}

/**
 * Optional type (T?) equivalent to T | nil.
 * Represents a value that may or may not be present.
 * @property kind - Discriminator for the OptionalType type
 * @property type - The underlying type when the value is present
 */
export interface OptionalType {
  readonly kind: 'Optional';
  readonly type: LuauType;
}

/**
 * Variadic type for rest parameters (...T).
 * Represents zero or more values of the same type.
 * @property kind - Discriminator for the VariadicType type
 * @property type - The type of each element in the variadic sequence
 */
export interface VariadicType {
  readonly kind: 'Variadic';
  readonly type: LuauType;
}

/**
 * Creates a union type, flattening nested unions and removing duplicates.
 * Handles edge cases like empty arrays, single types, and 'any' types.
 * @param types - Array of types to combine into a union
 * @returns A simplified LuauType (may be a single type, never, any, or union)
 */
export const createUnionType = (types: ReadonlyArray<LuauType>): LuauType => {
  if (types.length === 0) return NeverType;
  if (types.length === 1) return types[0]!;

  // Flatten nested unions
  const flattened: LuauType[] = [];
  for (const t of types) {
    if (t.kind === 'Union') {
      flattened.push(...t.types);
    } else {
      flattened.push(t);
    }
  }

  // Remove duplicates and never
  const unique = flattened.filter((t, i) => {
    if (t.kind === 'Never') return false;
    return flattened.findIndex(u => typesEqual(t, u)) === i;
  });

  if (unique.length === 0) return NeverType;
  if (unique.length === 1) return unique[0]!;

  // Check for any
  if (unique.some(t => t.kind === 'Any')) return AnyType;

  return { 'kind': 'Union', 'types': unique };
};

/**
 * Creates an intersection type, flattening nested intersections.
 * Handles edge cases like empty arrays, single types, and 'never' types.
 * @param types - Array of types to combine into an intersection
 * @returns A simplified LuauType (may be a single type, never, unknown, or intersection)
 */
export const createIntersectionType = (types: ReadonlyArray<LuauType>): LuauType => {
  if (types.length === 0) return UnknownType;
  if (types.length === 1) return types[0]!;

  // Flatten nested intersections
  const flattened: LuauType[] = [];
  for (const t of types) {
    if (t.kind === 'Intersection') {
      flattened.push(...t.types);
    } else {
      flattened.push(t);
    }
  }

  // Check for never
  if (flattened.some(t => t.kind === 'Never')) return NeverType;

  // Remove duplicates and unknown
  const unique = flattened.filter((t, i) => {
    if (t.kind === 'Unknown') return false;
    return flattened.findIndex(u => typesEqual(t, u)) === i;
  });

  if (unique.length === 0) return UnknownType;
  if (unique.length === 1) return unique[0]!;

  return { 'kind': 'Intersection', 'types': unique };
};

/**
 * Creates an optional type (T | nil).
 * Returns the original type if already optional, any, unknown, or nil.
 * @param type - The type to make optional
 * @returns A union of the type with nil, or the original type if already optional
 */
export const createOptionalType = (type: LuauType): LuauType => {
  if (type.kind === 'Optional') return type;
  if (type.kind === 'Any' || type.kind === 'Unknown') return type;
  if (type.kind === 'Primitive' && type.name === 'nil') return type;
  return createUnionType([type, NilType]);
};

/**
 * Generic type with type arguments applied.
 * Represents a generic type after type parameters have been substituted.
 * @property kind - Discriminator for the GenericType type
 * @property base - The base generic type before substitution
 * @property typeArgs - Array of type arguments applied to the generic
 */
export interface GenericType {
  readonly kind: 'Generic';
  readonly base: LuauType;
  readonly typeArgs: ReadonlyArray<LuauType>;
}

/**
 * Type variable used in generic type definitions.
 * Represents a placeholder type that will be substituted with a concrete type.
 * @property kind - Discriminator for the TypeVariable type
 * @property name - The name of the type variable (e.g., 'T', 'K', 'V')
 * @property id - Unique identifier to distinguish type variables with the same name
 */
export interface TypeVariable {
  readonly kind: 'TypeVariable';
  readonly name: string;
  readonly id: number;
}

let typeVariableIdCounter = 0;

/**
 * Creates a new type variable with a unique ID.
 * Each call generates a type variable with an incrementing unique identifier.
 * @param name - The name of the type variable (e.g., 'T', 'K', 'V')
 * @returns A TypeVariable with the given name and a unique ID
 */
export const createTypeVariable = (name: string): TypeVariable => ({
  'kind': 'TypeVariable',
  name,
  'id': typeVariableIdCounter++,
});

/**
 * Resets the type variable ID counter (for testing).
 * Should only be used in test environments to ensure consistent IDs.
 * @returns void
 */
export const resetTypeVariableCounter = (): void => {
  typeVariableIdCounter = 0;
};

/**
 * The any type - compatible with all types.
 * Disables type checking and allows any operation.
 * @property kind - Discriminator for the AnyType type
 */
export interface AnyType {
  readonly kind: 'Any';
}

/**
 * The unknown type - requires type narrowing before use.
 * Safer alternative to 'any' that requires explicit type checks.
 * @property kind - Discriminator for the UnknownType type
 */
export interface UnknownType {
  readonly kind: 'Unknown';
}

/**
 * The never type - represents impossible values.
 * Used for exhaustive checks and functions that never return.
 * @property kind - Discriminator for the NeverType type
 */
export interface NeverType {
  readonly kind: 'Never';
}

/**
 * Error type for type checking failures.
 * Used to propagate type errors through the type system.
 * @property kind - Discriminator for the ErrorType type
 * @property message - Human-readable description of the type error
 */
export interface ErrorType {
  readonly kind: 'Error';
  readonly message: string;
}

/**
 * Lazy type for deferred resolution (used for recursive types).
 * Allows defining types that reference themselves or are computed on demand.
 * @property kind - Discriminator for the LazyType type
 * @property resolve - Function to compute the actual type when needed
 * @property resolved - Cached result of the resolve function, undefined until resolved
 */
export interface LazyType {
  readonly kind: 'Lazy';
  resolve: () => LuauType;
  resolved: LuauType | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const AnyType: AnyType = { 'kind': 'Any' };
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const UnknownType: UnknownType = { 'kind': 'Unknown' };
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const NeverType: NeverType = { 'kind': 'Never' };

/**
 * Creates an error type with the given message.
 * Used to represent type checking failures in the type system.
 * @param message - Human-readable description of the type error
 * @returns An ErrorType with the specified error message
 */
export const createErrorType = (message: string): ErrorType => ({
  'kind': 'Error',
  message,
});

/**
 * Creates a lazy type with the given resolver function.
 * The resolver is called on first access and the result is cached.
 * @param resolver - Function that computes and returns the actual type
 * @returns A LazyType that will resolve to the computed type when accessed
 */
export const createLazyType = (resolver: () => LuauType): LazyType => ({
  'kind': 'Lazy',
  'resolve': resolver,
  'resolved': undefined,
});

/**
 * Resolves a lazy type, caching the result.
 * Subsequent calls return the cached value without re-computing.
 * @param type - The lazy type to resolve
 * @returns The resolved LuauType (cached after first resolution)
 */
export const resolveLazyType = (type: LazyType): LuauType => {
  if (type.resolved !== undefined) return type.resolved;
  type.resolved = type.resolve();
  return type.resolved;
};

/**
 * Resolves type references and lazy types.
 * Handles both lazy type resolution and named type reference lookup.
 * @param type - The type to resolve
 * @param classes - Optional map of class names to their types for reference resolution
 * @returns The resolved LuauType, or the original type if no resolution needed
 */
export const resolveType = (type: LuauType, classes?: Map<string, ClassType>): LuauType => {
  if (type.kind === 'Lazy') return resolveLazyType(type);
  if (type.kind === 'TypeReference' && classes !== undefined) {
    const resolved = classes.get(type.name);
    if (resolved !== undefined) return resolved;
  }
  return type;
};

/**
 * Type guard for primitive types.
 * @param type - The type to check
 * @returns True if the type is a PrimitiveType, false otherwise
 */
export const isPrimitive = (type: LuauType): type is PrimitiveType => type.kind === 'Primitive';

/**
 * Checks if type is nil.
 * @param type - The type to check
 * @returns True if the type represents the nil primitive type
 */
export const isNil = (type: LuauType): boolean => type.kind === 'Primitive' && type.name === 'nil';

/**
 * Checks if type is boolean.
 * @param type - The type to check
 * @returns True if the type represents the boolean primitive type
 */
export const isBoolean = (type: LuauType): boolean => type.kind === 'Primitive' && type.name === 'boolean';

/**
 * Checks if type is number.
 * @param type - The type to check
 * @returns True if the type represents the number primitive type
 */
export const isNumber = (type: LuauType): boolean => type.kind === 'Primitive' && type.name === 'number';

/**
 * Checks if type is string.
 * @param type - The type to check
 * @returns True if the type represents the string primitive type
 */
export const isString = (type: LuauType): boolean => type.kind === 'Primitive' && type.name === 'string';

/**
 * Checks if type is falsy (nil or false literal).
 * In Luau, only nil and false are considered falsy values.
 * @param type - The type to check
 * @returns True if the type represents a falsy value (nil or false)
 */
export const isFalsy = (type: LuauType): boolean => isNil(type) || (type.kind === 'Literal' && type.value === false);

/**
 * Checks if type is truthy (not nil or false).
 * In Luau, all values except nil and false are considered truthy.
 * @param type - The type to check
 * @returns True if the type represents a truthy value
 */
export const isTruthy = (type: LuauType): boolean => isFalsy(type) === false;

/**
 * Checks if type is callable (function or any).
 * A type is callable if it can be invoked with function call syntax.
 * @param type - The type to check
 * @returns True if the type can be called as a function
 */
export const isCallable = (type: LuauType): boolean => type.kind === 'Function' || type.kind === 'Any';

/**
 * Checks structural equality between two types.
 * Compares types deeply, resolving lazy types and references as needed.
 * @param a - The first type to compare
 * @param b - The second type to compare
 * @returns True if both types are structurally equivalent
 */
export const typesEqual = (a: LuauType, b: LuauType): boolean => {
  const resolvedA = resolveType(a);
  const resolvedB = resolveType(b);

  if (resolvedA.kind !== resolvedB.kind) return false;

  switch (resolvedA.kind) {
    case 'Primitive':
      return resolvedA.name === (resolvedB as PrimitiveType).name;

    case 'Literal':
      return resolvedA.value === (resolvedB as LiteralType).value;

    case 'TypeVariable':
      return resolvedA.id === (resolvedB as TypeVariable).id;

    case 'Class':
      return resolvedA.name === (resolvedB as ClassType).name;

    case 'Enum':
      return resolvedA.name === (resolvedB as EnumType).name;

    case 'TypeReference':
      return resolvedA.name === (resolvedB as TypeReference).name;

    case 'Any':
    case 'Unknown':
    case 'Never':
      return true;

    case 'Optional':
      return typesEqual(resolvedA.type, (resolvedB as OptionalType).type);

    case 'Variadic':
      return typesEqual(resolvedA.type, (resolvedB as VariadicType).type);

    case 'Union':
    case 'Intersection': {
      const bTypes = (resolvedB as UnionType | IntersectionType).types;
      if (resolvedA.types.length !== bTypes.length) return false;
      return resolvedA.types.every((t, i) => typesEqual(t, bTypes[i]!));
    }

    case 'Function': {
      const bFunc = resolvedB as FunctionType;
      if (resolvedA.params.length !== bFunc.params.length) return false;
      if (typesEqual(resolvedA.returnType, bFunc.returnType) === false) return false;
      return resolvedA.params.every((p, i) => typesEqual(p.type, bFunc.params[i]!.type));
    }

    case 'Table': {
      const bTable = resolvedB as TableType;
      if (resolvedA.properties.size !== bTable.properties.size) return false;
      for (const [key, prop] of resolvedA.properties) {
        const bProp = bTable.properties.get(key);
        if (bProp === undefined) return false;
        if (typesEqual(prop.type, bProp.type) === false) return false;
      }
      return true;
    }

    default:
      return false;
  }
};

/**
 * Converts a type to its string representation.
 * Produces human-readable type notation for display and error messages.
 * @param type - The type to convert to a string
 * @returns A string representation of the type in Luau syntax
 */
export const typeToString = (type: LuauType): string => {
  const resolved = resolveType(type);

  switch (resolved.kind) {
    case 'Primitive':
      return resolved.name;

    case 'Literal':
      if (typeof resolved.value === 'string') return `"${resolved.value}"`;
      return String(resolved.value);

    case 'Function': {
      const params = resolved.params.map(p => {
        const name = p.name !== undefined ? `${p.name}: ` : '';
        return `${name}${typeToString(p.type)}`;
      });
      return `(${params.join(', ')}) -> ${typeToString(resolved.returnType)}`;
    }

    case 'Table': {
      if (resolved.isArray && resolved.indexer !== undefined) {
        return `{${typeToString(resolved.indexer.valueType)}}`;
      }
      if (resolved.properties.size === 0 && resolved.indexer !== undefined) {
        return `{[${typeToString(resolved.indexer.keyType)}]: ${typeToString(resolved.indexer.valueType)}}`;
      }
      const props = Array.from(resolved.properties.entries())
        .map(([k, v]) => `${k}: ${typeToString(v.type)}`)
        .join(', ');
      if (resolved.indexer !== undefined) {
        const indexerStr = `[${typeToString(resolved.indexer.keyType)}]: ${typeToString(resolved.indexer.valueType)}`;
        return `{${props}, ${indexerStr}}`;
      }
      return `{${props}}`;
    }

    case 'Class':
      return resolved.name;

    case 'Enum':
      return `Enum.${resolved.name}`;

    case 'Union':
      return resolved.types.map(typeToString).join(' | ');

    case 'Intersection':
      return resolved.types.map(typeToString).join(' & ');

    case 'Optional':
      return `${typeToString(resolved.type)}?`;

    case 'Variadic':
      return `...${typeToString(resolved.type)}`;

    case 'Generic':
      return `${typeToString(resolved.base)}<${resolved.typeArgs.map(typeToString).join(', ')}>`;

    case 'TypeVariable':
      return resolved.name;

    case 'TypeReference':
      return resolved.name;

    case 'Any':
      return 'any';

    case 'Unknown':
      return 'unknown';

    case 'Never':
      return 'never';

    case 'Error':
      return `<error: ${resolved.message}>`;

    case 'Lazy':
      return typeToString(resolveLazyType(resolved));

    default:
      return '<unknown>';
  }
};
