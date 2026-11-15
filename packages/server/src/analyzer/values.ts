import type {
  LuauType,
  PrimitiveType,
  StringLiteralType,
  NumberLiteralType,
  BooleanLiteralType,
  FunctionType,
  FunctionParam,
  TypeParameterDef,
  TableType,
  PropertyType,
  TableIndexer,
  ClassType,
  ClassMethod,
  ClassProperty,
  EventType,
  EnumType,
  EnumItem,
  TypeVariable,
  AnyLuauType,
  UnknownLuauType,
  NeverLuauType,
  ErrorType,
  LazyType,
  Mutable,
} from '@typings/types';

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

/** Creates a string literal type representing an exact string value. */
export const createStringLiteral = (value: string): StringLiteralType => ({
  'kind': 'Literal',
  value,
  'baseType': 'string',
});

/** Creates a number literal type representing an exact numeric value. */
export const createNumberLiteral = (value: number): NumberLiteralType => ({
  'kind': 'Literal',
  value,
  'baseType': 'number',
});

/** Creates a boolean literal type representing true or false. */
export const createBooleanLiteral = (value: boolean): BooleanLiteralType => ({
  'kind': 'Literal',
  value,
  'baseType': 'boolean',
});

/** The literal boolean type representing true. */
export const TrueLiteral = createBooleanLiteral(true);
/** The literal boolean type representing false. */
export const FalseLiteral = createBooleanLiteral(false);

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
  const result: Mutable<FunctionType> = {
    'kind': 'Function',
    'typeParams': options?.typeParams ?? [],
    'thisType': options?.thisType,
    params,
    returnType,
    'isVariadic': options?.isVariadic ?? false,
  };

  if (options?.description !== undefined) result.description = options.description;
  if (options?.example !== undefined) result.example = options.example;

  return result;
};

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

/** Creates an enum type with the given name and items. */
export const createEnumType = (name: string, items: ReadonlyMap<string, EnumItem>): EnumType => ({
  'kind': 'Enum',
  name,
  items,
});

const dedupKey = (type: LuauType): string | undefined => {
  const resolved = resolveType(type);
  switch (resolved.kind) {
    case 'Primitive':
      return `P:${resolved.name}`;
    case 'Literal':
      return `L:${resolved.baseType}:${String(resolved.value)}`;
    case 'TypeVariable':
      return `V:${resolved.id}`;
    case 'Class':
      return `C:${resolved.name}`;
    case 'Enum':
      return `E:${resolved.name}`;
    case 'TypeReference':
      return `R:${resolved.name}`;
    case 'Any':
    case 'Unknown':
    case 'Never':
      return resolved.kind;
    default:
      return undefined;
  }
};

const dedupeTypes = (types: ReadonlyArray<LuauType>, skipKind: 'Never' | 'Unknown'): LuauType[] => {
  const seen = new Set<string>();
  const complex: LuauType[] = [];
  const unique: LuauType[] = [];

  for (const t of types) {
    if (t.kind === skipKind) continue;

    const key = dedupKey(t);
    if (key !== undefined) {
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(t);
      continue;
    }

    if (complex.some(u => typesEqual(t, u))) continue;
    complex.push(t);
    unique.push(t);
  }

  return unique;
};

/** Creates a union type, flattening nested unions and removing duplicates. */
export const createUnionType = (types: ReadonlyArray<LuauType>): LuauType => {
  const [first] = types;
  if (first === undefined) return NeverType;
  if (types.length === 1) return first;

  const flattened: LuauType[] = [];
  for (const t of types)
    if (t.kind === 'Union') flattened.push(...t.types);
    else flattened.push(t);

  const unique = dedupeTypes(flattened, 'Never');

  const [only] = unique;
  if (only === undefined) return NeverType;
  if (unique.length === 1) return only;

  if (unique.some(t => t.kind === 'Any')) return AnyType;

  return { 'kind': 'Union', 'types': unique };
};

/** Creates an intersection type, flattening nested intersections. */
export const createIntersectionType = (types: ReadonlyArray<LuauType>): LuauType => {
  const [first] = types;
  if (first === undefined) return UnknownType;
  if (types.length === 1) return first;

  const flattened: LuauType[] = [];
  for (const t of types)
    if (t.kind === 'Intersection') flattened.push(...t.types);
    else flattened.push(t);

  if (flattened.some(t => t.kind === 'Never')) return NeverType;

  const unique = dedupeTypes(flattened, 'Unknown');

  const [only] = unique;
  if (only === undefined) return UnknownType;
  if (unique.length === 1) return only;

  return { 'kind': 'Intersection', 'types': unique };
};

/** Creates an optional type (T | nil). */
export const createOptionalType = (type: LuauType): LuauType => {
  if (type.kind === 'Optional') return type;
  if (type.kind === 'Any' || type.kind === 'Unknown') return type;
  if (type.kind === 'Primitive' && type.name === 'nil') return type;
  return createUnionType([type, NilType]);
};

let typeVariableIdCounter = 0;

/** Creates a new type variable with a unique ID. */
export const createTypeVariable = (name: string): TypeVariable => ({
  'kind': 'TypeVariable',
  name,
  'id': typeVariableIdCounter++,
});

/** Resets the type variable ID counter (for testing). */
export const resetTypeVariableCounter = (): void => void (typeVariableIdCounter = 0);

/** The Luau `any` type, representing a value that bypasses type checking. */
export const AnyType: AnyLuauType = { 'kind': 'Any' };
/** The Luau `unknown` type, representing a value whose type must be narrowed before use. */
export const UnknownType: UnknownLuauType = { 'kind': 'Unknown' };
/** The Luau `never` type, representing an impossible or unreachable value. */
export const NeverType: NeverLuauType = { 'kind': 'Never' };

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

/** Checks pairwise structural equality of two type lists, requiring equal length. */
export const typeListsEqual = (a: ReadonlyArray<LuauType>, b: ReadonlyArray<LuauType>): boolean =>
  a.length === b.length &&
  a.every((t, i) => {
    const other = b[i];
    return other !== undefined && typesEqual(t, other);
  });

/** Checks structural equality between two types. */
export const typesEqual = (a: LuauType, b: LuauType): boolean => {
  const resolvedA = resolveType(a);
  const resolvedB = resolveType(b);

  switch (resolvedA.kind) {
    case 'Primitive':
      return resolvedB.kind === 'Primitive' && resolvedA.name === resolvedB.name;

    case 'Literal':
      return resolvedB.kind === 'Literal' && resolvedA.value === resolvedB.value;

    case 'TypeVariable':
      return resolvedB.kind === 'TypeVariable' && resolvedA.id === resolvedB.id;

    case 'Class':
      return resolvedB.kind === 'Class' && resolvedA.name === resolvedB.name;

    case 'Enum':
      return resolvedB.kind === 'Enum' && resolvedA.name === resolvedB.name;

    case 'TypeReference':
      return resolvedB.kind === 'TypeReference' && resolvedA.name === resolvedB.name;

    case 'Any':
    case 'Unknown':
    case 'Never':
      return resolvedB.kind === resolvedA.kind;

    case 'Optional':
      return resolvedB.kind === 'Optional' && typesEqual(resolvedA.type, resolvedB.type);

    case 'Variadic':
      return resolvedB.kind === 'Variadic' && typesEqual(resolvedA.type, resolvedB.type);

    case 'Union':
      return resolvedB.kind === 'Union' && typeListsEqual(resolvedA.types, resolvedB.types);

    case 'Intersection':
      return resolvedB.kind === 'Intersection' && typeListsEqual(resolvedA.types, resolvedB.types);

    case 'Function': {
      if (resolvedB.kind !== 'Function') return false;
      if (resolvedA.params.length !== resolvedB.params.length) return false;
      if (typesEqual(resolvedA.returnType, resolvedB.returnType) === false) return false;
      return resolvedA.params.every((p, i) => {
        const other = resolvedB.params[i];
        return other !== undefined && typesEqual(p.type, other.type);
      });
    }

    case 'Table': {
      if (resolvedB.kind !== 'Table') return false;
      if (resolvedA.properties.size !== resolvedB.properties.size) return false;
      for (const [key, prop] of resolvedA.properties) {
        const bProp = resolvedB.properties.get(key);
        if (bProp === undefined) return false;
        if (typesEqual(prop.type, bProp.type) === false) return false;
      }
      return true;
    }

    default:
      return false;
  }
};

/** Memoization cache for typeToString, keyed by type object identity. */
const typeToStringCache = new WeakMap<LuauType, string>();

/** Converts a type to its string representation. */
export const typeToString = (type: LuauType): string => {
  const cached = typeToStringCache.get(type);
  if (cached !== undefined) return cached;

  const resolved = resolveType(type);

  let result: string;

  switch (resolved.kind) {
    case 'Primitive':
      result = resolved.name;
      break;

    case 'Literal':
      result = resolved.baseType === 'string' ? `"${resolved.value}"` : String(resolved.value);
      break;

    case 'Function': {
      const params = resolved.params.map(p => {
        const name = p.name !== undefined ? `${p.name}: ` : '';
        return `${name}${typeToString(p.type)}`;
      });
      result = `(${params.join(', ')}) -> ${typeToString(resolved.returnType)}`;
      break;
    }

    case 'Table': {
      if (resolved.isArray && resolved.indexer !== undefined) result = `{${typeToString(resolved.indexer.valueType)}}`;
      else if (resolved.properties.size === 0 && resolved.indexer !== undefined)
        result = `{[${typeToString(resolved.indexer.keyType)}]: ${typeToString(resolved.indexer.valueType)}}`;
      else {
        const props = Array.from(resolved.properties.entries())
          .map(([k, v]) => `${k}: ${typeToString(v.type)}`)
          .join(', ');
        if (resolved.indexer !== undefined) {
          const indexerStr = `[${typeToString(resolved.indexer.keyType)}]: ${typeToString(resolved.indexer.valueType)}`;
          result = `{${props}, ${indexerStr}}`;
        } else result = `{${props}}`;
      }
      break;
    }

    case 'Class':
      result = resolved.name;
      break;

    case 'Enum':
      result = `Enum.${resolved.name}`;
      break;

    case 'Union':
      result = resolved.types.map(typeToString).join(' | ');
      break;

    case 'Intersection':
      result = resolved.types.map(typeToString).join(' & ');
      break;

    case 'Optional':
      result = `${typeToString(resolved.type)}?`;
      break;

    case 'Variadic':
      result = `...${typeToString(resolved.type)}`;
      break;

    case 'Generic':
      result = `${typeToString(resolved.base)}<${resolved.typeArgs.map(typeToString).join(', ')}>`;
      break;

    case 'TypeVariable':
      result = resolved.name;
      break;

    case 'TypeReference':
      result = resolved.name;
      break;

    case 'Any':
      result = 'any';
      break;

    case 'Unknown':
      result = 'unknown';
      break;

    case 'Never':
      result = 'never';
      break;

    case 'Error':
      result = `<error: ${resolved.message}>`;
      break;

    case 'Lazy':
      result = typeToString(resolveLazyType(resolved));
      break;

    default:
      result = '<unknown>';
  }

  typeToStringCache.set(resolved, result);

  return result;
};
