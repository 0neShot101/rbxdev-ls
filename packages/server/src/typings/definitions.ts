import type { TypeEnvironment } from '@typings/environment';
import type { LuauType } from '@typings/types';

export interface RobloxApiDump {
  readonly Version: number;
  readonly Classes: ReadonlyArray<RobloxClass>;
  readonly Enums: ReadonlyArray<RobloxEnum>;
}

export interface RobloxTagObject {
  readonly PreferredDescriptorName?: string;
  readonly ThreadSafety?: string;
}

export type RobloxTag = string | RobloxTagObject;

export interface RobloxClass {
  readonly Name: string;
  readonly Superclass: string;
  readonly Members: ReadonlyArray<RobloxMember>;
  readonly Tags?: ReadonlyArray<RobloxTag>;
  readonly MemoryCategory?: string;
}

export type RobloxMember = RobloxProperty | RobloxFunction | RobloxEvent | RobloxCallback;

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

export interface RobloxFunction {
  readonly MemberType: 'Function';
  readonly Name: string;
  readonly Parameters: ReadonlyArray<RobloxParameter>;
  readonly ReturnType: RobloxValueType;
  readonly Security?: string;
  readonly Tags?: ReadonlyArray<RobloxTag>;
  readonly ThreadSafety?: string;
}

export interface RobloxEvent {
  readonly MemberType: 'Event';
  readonly Name: string;
  readonly Parameters: ReadonlyArray<RobloxParameter>;
  readonly Security?: string;
  readonly Tags?: ReadonlyArray<RobloxTag>;
  readonly ThreadSafety?: string;
}

export interface RobloxCallback {
  readonly MemberType: 'Callback';
  readonly Name: string;
  readonly Parameters: ReadonlyArray<RobloxParameter>;
  readonly ReturnType: RobloxValueType;
  readonly Security?: string;
  readonly Tags?: ReadonlyArray<RobloxTag>;
  readonly ThreadSafety?: string;
}

export interface RobloxParameter {
  readonly Name: string;
  readonly Type: RobloxValueType;
  readonly Default?: string;
}

export interface RobloxValueType {
  readonly Name: string;
  readonly Category: 'Primitive' | 'Class' | 'DataType' | 'Enum' | 'Group';
}

export interface RobloxSerialization {
  readonly CanLoad: boolean;
  readonly CanSave: boolean;
}

export interface RobloxSecurityTags {
  readonly Read: string;
  readonly Write: string;
}

export interface RobloxEnum {
  readonly Name: string;
  readonly Items: ReadonlyArray<RobloxEnumItem>;
}

export interface RobloxEnumItem {
  readonly Name: string;
  readonly Value: number;
}

export interface SuncApiDefinition {
  readonly functions: ReadonlyArray<SuncFunction>;
  readonly namespaces: ReadonlyArray<SuncNamespace>;
}

export interface SuncFunction {
  readonly name: string;
  readonly params: ReadonlyArray<SuncParameter>;
  readonly returnType: string;
  readonly description?: string;
  readonly example?: string;
}

export interface SuncParameter {
  readonly name: string;
  readonly type: string;
  readonly optional?: boolean;
}

export interface SuncNamespace {
  readonly name: string;
  readonly functions: ReadonlyArray<SuncFunction>;
}

export interface MutableClassData {
  name: string;
  superclassName: string;
  properties: Map<string, import('@typings/types').ClassProperty>;
  methods: Map<string, import('@typings/types').ClassMethod>;
}

export interface RobloxDeprecation {
  deprecated: boolean;
  deprecationMessage: string | undefined;
}

export interface LoadedDefinitions {
  readonly roblox: RobloxApiDump | undefined;
  readonly sunc: SuncApiDefinition | undefined;
}

export interface GlobalEnvironment {
  readonly env: TypeEnvironment;
  readonly robloxClasses: Map<string, LuauType>;
  readonly robloxEnums: Map<string, LuauType>;
  readonly robloxDataTypes: Map<string, LuauType>;
}
