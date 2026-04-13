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

export interface TypeReference {
  readonly kind: 'TypeReference';
  readonly name: string;
  readonly typeArgs?: ReadonlyArray<LuauType>;
}

export interface PrimitiveType {
  readonly kind: 'Primitive';
  readonly name: 'nil' | 'boolean' | 'number' | 'string' | 'thread' | 'buffer' | 'vector';
}

/** The Luau nil primitive type. */
export const NilType: PrimitiveType = { 'kind': 'Primitive', 'name': 'nil' };
/** The Luau boolean primitive type. */
export const BooleanType: PrimitiveType = { 'kind': 'Primitive', 'name': 'boolean' };
/** The Luau number primitive type. */
export const NumberType: PrimitiveType = { 'kind': 'Primitive', 'name': 'number' };
/** The Luau string primitive type. */
export const StringType: PrimitiveType = { 'kind': 'Primitive', 'name': 'string' };
/** The Luau thread (coroutine) primitive type. */
export const ThreadType: PrimitiveType = { 'kind': 'Primitive', 'name': 'thread' };
/** The Luau buffer primitive type. */
export const BufferType: PrimitiveType = { 'kind': 'Primitive', 'name': 'buffer' };
/** The Luau vector primitive type. */
export const VectorType: PrimitiveType = { 'kind': 'Primitive', 'name': 'vector' };

export interface LiteralType {
  readonly kind: 'Literal';
  readonly value: string | number | boolean;
  readonly baseType: 'string' | 'number' | 'boolean';
}

/** Creates a string literal type representing an exact string value. */
export const createStringLiteral = (value: string): LiteralType => ({
  'kind': 'Literal',
  value,
  'baseType': 'string',
});

/** Creates a number literal type representing an exact numeric value. */
export const createNumberLiteral = (value: number): LiteralType => ({
  'kind': 'Literal',
  value,
  'baseType': 'number',
});

/** Creates a boolean literal type representing true or false. */
export const createBooleanLiteral = (value: boolean): LiteralType => ({
  'kind': 'Literal',
  value,
  'baseType': 'boolean',
});

/** The literal boolean type representing true. */
export const TrueLiteral = createBooleanLiteral(true);
/** The literal boolean type representing false. */
export const FalseLiteral = createBooleanLiteral(false);

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

export interface FunctionParam {
  readonly name: string | undefined;
  readonly type: LuauType;
  readonly optional: boolean;
}

export interface TypeParameterDef {
  readonly name: string;
  readonly constraint: LuauType | undefined;
  readonly defaultType: LuauType | undefined;
}

/** Creates a function type with the given parameters and return type. */
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

export interface TableType {
  readonly kind: 'Table';
  readonly properties: ReadonlyMap<string, PropertyType>;
  readonly indexer: TableIndexer | undefined;
  readonly metatable: TableType | undefined;
  readonly isArray: boolean;
}

export interface PropertyType {
  readonly type: LuauType;
  readonly readonly: boolean;
  readonly optional: boolean;
  readonly deprecated?: boolean;
  readonly deprecationMessage?: string;
}

export interface TableIndexer {
  readonly keyType: LuauType;
  readonly valueType: LuauType;
}

/** Creates a table type with the given properties. */
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

/** Creates an array type with the given element type. */
export const createArrayType = (elementType: LuauType): TableType => ({
  'kind': 'Table',
  'properties': new Map(),
  'indexer': { 'keyType': NumberType, 'valueType': elementType },
  'metatable': undefined,
  'isArray': true,
});

/** Creates a dictionary type with the given key and value types. */
export const createDictionaryType = (keyType: LuauType, valueType: LuauType): TableType => ({
  'kind': 'Table',
  'properties': new Map(),
  'indexer': { keyType, valueType },
  'metatable': undefined,
  'isArray': false,
});

export interface ClassType {
  readonly kind: 'Class';
  readonly name: string;
  readonly superclass: ClassType | undefined;
  readonly properties: ReadonlyMap<string, ClassProperty>;
  readonly methods: ReadonlyMap<string, ClassMethod>;
  readonly events: ReadonlyMap<string, EventType>;
  readonly tags: ReadonlyArray<string>;
}

export interface ClassMethod {
  readonly func: FunctionType;
  readonly deprecated?: boolean;
  readonly deprecationMessage?: string;
}

export interface ClassProperty {
  readonly type: LuauType;
  readonly readonly: boolean;
  readonly security: SecurityLevel;
  readonly deprecated?: boolean;
  readonly deprecationMessage?: string;
}

export interface EventType {
  readonly kind: 'Event';
  readonly params: ReadonlyArray<FunctionParam>;
}

export type SecurityLevel = 'None' | 'LocalUserSecurity' | 'PluginSecurity' | 'RobloxScriptSecurity';

/** Creates a class type with the given name and options. */
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

export interface EnumType {
  readonly kind: 'Enum';
  readonly name: string;
  readonly items: ReadonlyMap<string, EnumItem>;
}

export interface EnumItem {
  readonly name: string;
  readonly value: number;
}

/** Creates an enum type with the given name and items. */
export const createEnumType = (name: string, items: ReadonlyMap<string, EnumItem>): EnumType => ({
  'kind': 'Enum',
  name,
  items,
});

export interface UnionType {
  readonly kind: 'Union';
  readonly types: ReadonlyArray<LuauType>;
}

export interface IntersectionType {
  readonly kind: 'Intersection';
  readonly types: ReadonlyArray<LuauType>;
}

export interface OptionalType {
  readonly kind: 'Optional';
  readonly type: LuauType;
}

export interface VariadicType {
  readonly kind: 'Variadic';
  readonly type: LuauType;
}

/** Creates a union type, flattening nested unions and removing duplicates. */
export const createUnionType = (types: ReadonlyArray<LuauType>): LuauType => {
  if (types.length === 0) return NeverType;
  if (types.length === 1) return types[0]!;

  const flattened: LuauType[] = [];
  for (const t of types) {
    if (t.kind === 'Union') {
      flattened.push(...t.types);
    } else {
      flattened.push(t);
    }
  }

  const unique = flattened.filter((t, i) => {
    if (t.kind === 'Never') return false;
    return flattened.findIndex(u => typesEqual(t, u)) === i;
  });

  if (unique.length === 0) return NeverType;
  if (unique.length === 1) return unique[0]!;

  if (unique.some(t => t.kind === 'Any')) return AnyType;

  return { 'kind': 'Union', 'types': unique };
};

/** Creates an intersection type, flattening nested intersections. */
export const createIntersectionType = (types: ReadonlyArray<LuauType>): LuauType => {
  if (types.length === 0) return UnknownType;
  if (types.length === 1) return types[0]!;

  const flattened: LuauType[] = [];
  for (const t of types) {
    if (t.kind === 'Intersection') {
      flattened.push(...t.types);
    } else {
      flattened.push(t);
    }
  }

  if (flattened.some(t => t.kind === 'Never')) return NeverType;

  const unique = flattened.filter((t, i) => {
    if (t.kind === 'Unknown') return false;
    return flattened.findIndex(u => typesEqual(t, u)) === i;
  });

  if (unique.length === 0) return UnknownType;
  if (unique.length === 1) return unique[0]!;

  return { 'kind': 'Intersection', 'types': unique };
};

/** Creates an optional type (T | nil). */
export const createOptionalType = (type: LuauType): LuauType => {
  if (type.kind === 'Optional') return type;
  if (type.kind === 'Any' || type.kind === 'Unknown') return type;
  if (type.kind === 'Primitive' && type.name === 'nil') return type;
  return createUnionType([type, NilType]);
};

export interface GenericType {
  readonly kind: 'Generic';
  readonly base: LuauType;
  readonly typeArgs: ReadonlyArray<LuauType>;
}

export interface TypeVariable {
  readonly kind: 'TypeVariable';
  readonly name: string;
  readonly id: number;
}

let typeVariableIdCounter = 0;

/** Creates a new type variable with a unique ID. */
export const createTypeVariable = (name: string): TypeVariable => ({
  'kind': 'TypeVariable',
  name,
  'id': typeVariableIdCounter++,
});

/** Resets the type variable ID counter (for testing). */
export const resetTypeVariableCounter = (): void => {
  typeVariableIdCounter = 0;
};

export interface AnyType {
  readonly kind: 'Any';
}

export interface UnknownType {
  readonly kind: 'Unknown';
}

export interface NeverType {
  readonly kind: 'Never';
}

export interface ErrorType {
  readonly kind: 'Error';
  readonly message: string;
}

export interface LazyType {
  readonly kind: 'Lazy';
  resolve: () => LuauType;
  resolved: LuauType | undefined;
}

/* eslint-disable @typescript-eslint/no-redeclare */
/** The Luau `any` type, representing a value that bypasses type checking. */
export const AnyType: AnyType = { 'kind': 'Any' };
/** The Luau `unknown` type, representing a value whose type must be narrowed before use. */
export const UnknownType: UnknownType = { 'kind': 'Unknown' };
/** The Luau `never` type, representing an impossible or unreachable value. */
export const NeverType: NeverType = { 'kind': 'Never' };
/* eslint-enable @typescript-eslint/no-redeclare */

/** Creates an error type with the given message. */
export const createErrorType = (message: string): ErrorType => ({
  'kind': 'Error',
  message,
});

/** Creates a lazy type with the given resolver function. */
export const createLazyType = (resolver: () => LuauType): LazyType => ({
  'kind': 'Lazy',
  'resolve': resolver,
  'resolved': undefined,
});

/** Resolves a lazy type, caching the result. */
export const resolveLazyType = (type: LazyType): LuauType => {
  if (type.resolved !== undefined) return type.resolved;
  type.resolved = type.resolve();
  return type.resolved;
};

/** Resolves type references and lazy types. */
export const resolveType = (type: LuauType, classes?: Map<string, ClassType>): LuauType => {
  if (type.kind === 'Lazy') return resolveLazyType(type);
  if (type.kind === 'TypeReference' && classes !== undefined) {
    const resolved = classes.get(type.name);
    if (resolved !== undefined) return resolved;
  }
  return type;
};

/** Type guard for primitive types. */
export const isPrimitive = (type: LuauType): type is PrimitiveType => type.kind === 'Primitive';

/** Checks if type is nil. */
export const isNil = (type: LuauType): boolean => type.kind === 'Primitive' && type.name === 'nil';

/** Checks if type is boolean. */
export const isBoolean = (type: LuauType): boolean => type.kind === 'Primitive' && type.name === 'boolean';

/** Checks if type is number. */
export const isNumber = (type: LuauType): boolean => type.kind === 'Primitive' && type.name === 'number';

/** Checks if type is string. */
export const isString = (type: LuauType): boolean => type.kind === 'Primitive' && type.name === 'string';

/** Checks if type is falsy (nil or false literal). */
export const isFalsy = (type: LuauType): boolean => isNil(type) || (type.kind === 'Literal' && type.value === false);

/** Checks if type is truthy (not nil or false). */
export const isTruthy = (type: LuauType): boolean => isFalsy(type) === false;

/** Checks if type is callable (function or any). */
export const isCallable = (type: LuauType): boolean => type.kind === 'Function' || type.kind === 'Any';

/** Checks structural equality between two types. */
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

/** Converts a type to its string representation. */
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
