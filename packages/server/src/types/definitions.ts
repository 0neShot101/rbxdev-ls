import type { DocsSource } from '@typings/docs';
import type { TypeEnvironment } from '@typings/environment';
import type { ClassMethod, ClassProperty, ClassType, LuauType } from '@typings/types';

/** Roblox API dump in the subset consumed by the converter; multi-value returns are already reduced. */
export interface RobloxApiDump {
  readonly Version: number;
  readonly Classes: ReadonlyArray<RobloxClass>;
  readonly Enums: ReadonlyArray<RobloxEnum>;
}

/** Structured API tag carrying descriptor or thread-safety metadata. */
export interface RobloxTagObject {
  readonly PreferredDescriptorName?: string;
  readonly ThreadSafety?: string;
}

/** API tag: a plain flag such as `Deprecated`, or structured metadata. */
export type RobloxTag = string | RobloxTagObject;

/** One Roblox class with its members. */
export interface RobloxClass {
  readonly Name: string;
  readonly Superclass: string;
  readonly Members: ReadonlyArray<RobloxMember>;
  readonly Tags?: ReadonlyArray<RobloxTag>;
  readonly MemoryCategory?: string;
}

/** Any class member, discriminated by `MemberType`. */
export type RobloxMember = RobloxProperty | RobloxFunction | RobloxEvent | RobloxCallback;

/** Class property. */
export interface RobloxProperty {
  readonly MemberType: 'Property';
  readonly Name: string;
  readonly ValueType: RobloxValueType;
  readonly Category?: string;
  readonly Serialization?: RobloxSerialization;
  readonly Security?: RobloxSecurityTags;
  readonly Tags?: ReadonlyArray<RobloxTag>;
  readonly ThreadSafety?: string;
}

/** Class method. */
export interface RobloxFunction {
  readonly MemberType: 'Function';
  readonly Name: string;
  readonly Parameters: ReadonlyArray<RobloxParameter>;
  readonly ReturnType: RobloxValueType;
  readonly Security?: string;
  readonly Tags?: ReadonlyArray<RobloxTag>;
  readonly ThreadSafety?: string;
}

/** Class event. */
export interface RobloxEvent {
  readonly MemberType: 'Event';
  readonly Name: string;
  readonly Parameters: ReadonlyArray<RobloxParameter>;
  readonly Security?: string;
  readonly Tags?: ReadonlyArray<RobloxTag>;
  readonly ThreadSafety?: string;
}

/** Assignable callback property. */
export interface RobloxCallback {
  readonly MemberType: 'Callback';
  readonly Name: string;
  readonly Parameters: ReadonlyArray<RobloxParameter>;
  readonly ReturnType: RobloxValueType;
  readonly Security?: string;
  readonly Tags?: ReadonlyArray<RobloxTag>;
  readonly ThreadSafety?: string;
}

/** Function, event or callback parameter. */
export interface RobloxParameter {
  readonly Name: string;
  readonly Type: RobloxValueType;
  readonly Default?: string;
}

/** Named value type with its category. */
export interface RobloxValueType {
  readonly Name: string;
  readonly Category: 'Primitive' | 'Class' | 'DataType' | 'Enum' | 'Group';
}

/** Property serialization flags. */
export interface RobloxSerialization {
  readonly CanLoad: boolean;
  readonly CanSave: boolean;
}

/** Property read and write security levels. */
export interface RobloxSecurityTags {
  readonly Read: string;
  readonly Write: string;
}

/** Roblox enum with its items. */
export interface RobloxEnum {
  readonly Name: string;
  readonly Items: ReadonlyArray<RobloxEnumItem>;
}

/** One enum item. */
export interface RobloxEnumItem {
  readonly Name: string;
  readonly Value: number;
}

/** Executor (Sunc) API description: global functions and namespaced libraries. */
export interface SuncApiDefinition {
  readonly functions: ReadonlyArray<SuncFunction>;
  readonly namespaces: ReadonlyArray<SuncNamespace>;
}

/** One executor function. */
export interface SuncFunction {
  readonly name: string;
  readonly params: ReadonlyArray<SuncParameter>;
  readonly returnType: string;
  readonly description?: string;
  readonly example?: string;
}

/** One executor function parameter. */
export interface SuncParameter {
  readonly name: string;
  readonly type: string;
  readonly optional?: boolean;
}

/** A named library of executor functions such as `crypt` or `debug`. */
export interface SuncNamespace {
  readonly name: string;
  readonly functions: ReadonlyArray<SuncFunction>;
}

/** Executor globals and namespaces converted to Luau types. */
export interface ConvertedSuncTypes {
  readonly globals: Map<string, LuauType>;
  readonly namespaces: Map<string, LuauType>;
}

/** Class data collected before Luau class types are created. */
export interface MutableClassData {
  name: string;
  superclassName: string;
  properties: Map<string, ClassProperty>;
  methods: Map<string, ClassMethod>;
}

/** A Roblox class type still under construction: its superclass link and member maps are filled in by later passes. */
export interface ClassTypeUnderConstruction extends ClassType {
  superclass: ClassType | undefined;
  readonly properties: Map<string, ClassProperty>;
  readonly methods: Map<string, ClassMethod>;
}

/** Luau type definitions produced from a Roblox API dump, keyed by class, enum and data type name. */
export interface ConvertedRobloxTypes {
  classes: Map<string, LuauType>;
  enums: Map<string, LuauType>;
  dataTypes: Map<string, LuauType>;
}

/** Deprecation state derived from member tags. */
export interface RobloxDeprecation {
  deprecated: boolean;
  deprecationMessage: string | undefined;
}

/** Definition datasets loaded at startup; any dataset may be missing. */
export interface LoadedDefinitions {
  readonly roblox: RobloxApiDump | undefined;
  readonly sunc: SuncApiDefinition | undefined;
  readonly robloxDocs?: DocsSource | undefined;
  readonly luauDocs?: DocsSource | undefined;
}

/** Composed global environment shared by the checker and language features. */
export interface GlobalEnvironment {
  readonly env: TypeEnvironment;
  readonly robloxClasses: Map<string, LuauType>;
  readonly robloxEnums: Map<string, LuauType>;
  readonly robloxDataTypes: Map<string, LuauType>;
  readonly robloxDocs?: DocsSource | undefined;
  readonly luauDocs?: DocsSource | undefined;
  /** Names of classes tagged `Service` in the loaded Roblox API, in upstream order. */
  readonly serviceNames: ReadonlyArray<string>;
  /** Names of classes creatable through `Instance.new` (neither `NotCreatable` nor `Service`), in upstream order. */
  readonly creatableClasses: ReadonlyArray<string>;
}

/** Class-name catalogues derived from Roblox API class tags. */
export interface RobloxClassCatalogues {
  readonly serviceNames: ReadonlyArray<string>;
  readonly creatableClasses: ReadonlyArray<string>;
}
