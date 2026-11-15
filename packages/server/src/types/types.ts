/** Any Luau type shape the analyzer can represent, discriminated by `kind`. */
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
  | AnyLuauType
  | UnknownLuauType
  | NeverLuauType
  | ErrorType
  | LazyType;

/** A by-name reference to a named type, optionally instantiated with type arguments. */
export interface TypeReference {
  readonly kind: 'TypeReference';
  readonly name: string;
  readonly typeArgs?: ReadonlyArray<LuauType>;
}

/** A built-in Luau primitive type such as `nil`, `number`, or `string`. */
export interface PrimitiveType {
  readonly kind: 'Primitive';
  readonly name: 'nil' | 'boolean' | 'number' | 'string' | 'thread' | 'buffer' | 'vector';
}

/** A string singleton type whose `value` is the exact string. */
export interface StringLiteralType {
  readonly kind: 'Literal';
  readonly value: string;
  readonly baseType: 'string';
}

/** A number singleton type whose `value` is the exact number. */
export interface NumberLiteralType {
  readonly kind: 'Literal';
  readonly value: number;
  readonly baseType: 'number';
}

/** A boolean singleton type whose `value` is `true` or `false`. */
export interface BooleanLiteralType {
  readonly kind: 'Literal';
  readonly value: boolean;
  readonly baseType: 'boolean';
}

/** A singleton type for an exact value, discriminated by `baseType` so `value` narrows with it. */
export type LiteralType = StringLiteralType | NumberLiteralType | BooleanLiteralType;

/** A function signature with generics, optional `self` type, parameters, and return type. */
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

/** A single function parameter, optionally named. */
export interface FunctionParam {
  readonly name: string | undefined;
  readonly type: LuauType;
  readonly optional: boolean;
}

/** A generic type parameter declaration with optional constraint and default. */
export interface TypeParameterDef {
  readonly name: string;
  readonly constraint: LuauType | undefined;
  readonly defaultType: LuauType | undefined;
}

/** A structural table type with named properties, an optional indexer, and an optional metatable. */
export interface TableType {
  readonly kind: 'Table';
  readonly properties: ReadonlyMap<string, PropertyType>;
  readonly indexer: TableIndexer | undefined;
  readonly metatable: TableType | undefined;
  readonly isArray: boolean;
}

/** A named table property and its modifiers. */
export interface PropertyType {
  readonly type: LuauType;
  readonly readonly: boolean;
  readonly optional: boolean;
  readonly deprecated?: boolean;
  readonly deprecationMessage?: string;
}

/** A table indexer `[keyType]: valueType`. */
export interface TableIndexer {
  readonly keyType: LuauType;
  readonly valueType: LuauType;
}

/** A Roblox class type with inherited members, methods, events, and tags. */
export interface ClassType {
  readonly kind: 'Class';
  readonly name: string;
  readonly superclass: ClassType | undefined;
  readonly properties: ReadonlyMap<string, ClassProperty>;
  readonly methods: ReadonlyMap<string, ClassMethod>;
  readonly events: ReadonlyMap<string, EventType>;
  readonly tags: ReadonlyArray<string>;
}

/** A Roblox class method and its deprecation status. */
export interface ClassMethod {
  readonly func: FunctionType;
  readonly deprecated?: boolean;
  readonly deprecationMessage?: string;
}

/** A Roblox class property with access and security metadata. */
export interface ClassProperty {
  readonly type: LuauType;
  readonly readonly: boolean;
  readonly security: SecurityLevel;
  readonly deprecated?: boolean;
  readonly deprecationMessage?: string;
}

/** A Roblox event (RBXScriptSignal) with its callback parameters. */
export interface EventType {
  readonly kind: 'Event';
  readonly params: ReadonlyArray<FunctionParam>;
}

/** The Roblox security level required to access a class member. */
export type SecurityLevel = 'None' | 'LocalUserSecurity' | 'PluginSecurity' | 'RobloxScriptSecurity';

/** A Roblox enum type and its items. */
export interface EnumType {
  readonly kind: 'Enum';
  readonly name: string;
  readonly items: ReadonlyMap<string, EnumItem>;
}

/** A single Roblox enum item and its numeric value. */
export interface EnumItem {
  readonly name: string;
  readonly value: number;
}

/** A union `A | B` of member types. */
export interface UnionType {
  readonly kind: 'Union';
  readonly types: ReadonlyArray<LuauType>;
}

/** An intersection `A & B` of member types. */
export interface IntersectionType {
  readonly kind: 'Intersection';
  readonly types: ReadonlyArray<LuauType>;
}

/** An optional type `T?`, equivalent to `T | nil`. */
export interface OptionalType {
  readonly kind: 'Optional';
  readonly type: LuauType;
}

/** A variadic type pack `...T`. */
export interface VariadicType {
  readonly kind: 'Variadic';
  readonly type: LuauType;
}

/** A generic type instantiated with type arguments, such as `Array<T>`. */
export interface GenericType {
  readonly kind: 'Generic';
  readonly base: LuauType;
  readonly typeArgs: ReadonlyArray<LuauType>;
}

/** A type variable introduced during inference, identified by a unique `id`. */
export interface TypeVariable {
  readonly kind: 'TypeVariable';
  readonly name: string;
  readonly id: number;
}

/** The Luau `any` type shape, bypassing type checking. */
export interface AnyLuauType {
  readonly kind: 'Any';
}

/** The Luau `unknown` type shape, requiring narrowing before use. */
export interface UnknownLuauType {
  readonly kind: 'Unknown';
}

/** The Luau `never` type shape, representing an impossible value. */
export interface NeverLuauType {
  readonly kind: 'Never';
}

/** A type produced by a failed resolution, carrying the reason. */
export interface ErrorType {
  readonly kind: 'Error';
  readonly message: string;
}

/** A deferred type computed on first use and cached in `resolved`. */
export interface LazyType {
  readonly kind: 'Lazy';
  resolve: () => LuauType;
  resolved: LuauType | undefined;
}

/** A writable view of a readonly type shape, used while a factory assembles optional fields before returning it. */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };
