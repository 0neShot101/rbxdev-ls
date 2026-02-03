/**
 * Roblox API Dump Type Definitions
 *
 * This module provides type definitions and conversion utilities for the Roblox API dump.
 * The API dump is based on the Full-API-Dump.json structure from Roblox Client Tracker
 * and contains definitions for all Roblox classes, enums, properties, methods, and events.
 */

import {
  AnyType,
  BooleanType,
  createArrayType,
  createFunctionType,
  createTableType,
  NilType,
  NumberType,
  StringType,
  type ClassMethod,
  type ClassProperty,
  type FunctionParam,
  type LuauType,
} from '@typings/types';

import { createDataTypeInstances, createGenericRBXScriptSignalType, createRBXScriptSignalType } from './dataTypes';

/**
 * Represents the complete Roblox API dump structure.
 *
 * This interface models the top-level structure of the Roblox API dump JSON file,
 * containing version information and arrays of all classes and enums.
 */
export interface RobloxApiDump {
  /** The version number of the API dump */
  readonly Version: number;
  /** Array of all Roblox class definitions */
  readonly Classes: ReadonlyArray<RobloxClass>;
  /** Array of all Roblox enum definitions */
  readonly Enums: ReadonlyArray<RobloxEnum>;
}

/**
 * Represents a complex tag object that can be attached to Roblox API members.
 *
 * Tag objects provide additional metadata beyond simple string tags, such as
 * preferred alternative names for deprecated members or thread safety information.
 */
export interface RobloxTagObject {
  /** The preferred name to use instead of a deprecated member */
  readonly PreferredDescriptorName?: string;
  /** Thread safety classification for the member */
  readonly ThreadSafety?: string;
}

/**
 * A tag attached to a Roblox API member.
 *
 * Tags can be either simple strings (e.g., 'Deprecated', 'ReadOnly') or
 * complex objects with additional metadata.
 */
export type RobloxTag = string | RobloxTagObject;

/**
 * Represents a Roblox class definition from the API dump.
 *
 * This interface models a single class with its inheritance, members, and metadata.
 */
export interface RobloxClass {
  /** The name of the class (e.g., 'Part', 'Model', 'Humanoid') */
  readonly Name: string;
  /** The name of the parent class, or '<<<ROOT>>>' for the root class */
  readonly Superclass: string;
  /** Array of all members (properties, functions, events, callbacks) */
  readonly Members: ReadonlyArray<RobloxMember>;
  /** Optional array of tags providing metadata about the class */
  readonly Tags?: ReadonlyArray<RobloxTag>;
  /** Memory category classification for the class */
  readonly MemoryCategory?: string;
}

/**
 * Union type representing any member of a Roblox class.
 *
 * Members can be properties, functions, events, or callbacks.
 */
export type RobloxMember = RobloxProperty | RobloxFunction | RobloxEvent | RobloxCallback;

/**
 * Represents a property member of a Roblox class.
 *
 * Properties are data fields that can be read and optionally written.
 */
export interface RobloxProperty {
  /** Discriminator indicating this is a property */
  readonly MemberType: 'Property';
  /** The name of the property */
  readonly Name: string;
  /** The type of the property value */
  readonly ValueType: RobloxValueType;
  /** Category classification for the property */
  readonly Category?: string;
  /** Serialization capabilities (load/save) */
  readonly Serialization?: RobloxSerialization;
  /** Security tags for read/write access */
  readonly Security?: RobloxSecurityTags;
  /** Optional array of tags providing metadata */
  readonly Tags?: ReadonlyArray<RobloxTag>;
  /** Thread safety classification */
  readonly ThreadSafety?: string;
}

/**
 * Represents a function (method) member of a Roblox class.
 *
 * Functions are callable methods that accept parameters and return values.
 */
export interface RobloxFunction {
  /** Discriminator indicating this is a function */
  readonly MemberType: 'Function';
  /** The name of the function */
  readonly Name: string;
  /** Array of parameters the function accepts */
  readonly Parameters: ReadonlyArray<RobloxParameter>;
  /** The return type of the function */
  readonly ReturnType: RobloxValueType;
  /** Security level required to call this function */
  readonly Security?: string;
  /** Optional array of tags providing metadata */
  readonly Tags?: ReadonlyArray<RobloxTag>;
  /** Thread safety classification */
  readonly ThreadSafety?: string;
}

/**
 * Represents an event member of a Roblox class.
 *
 * Events are signals that can be connected to with callbacks and fire with parameters.
 */
export interface RobloxEvent {
  /** Discriminator indicating this is an event */
  readonly MemberType: 'Event';
  /** The name of the event */
  readonly Name: string;
  /** Array of parameters passed to event callbacks */
  readonly Parameters: ReadonlyArray<RobloxParameter>;
  /** Security level required to connect to this event */
  readonly Security?: string;
  /** Optional array of tags providing metadata */
  readonly Tags?: ReadonlyArray<RobloxTag>;
  /** Thread safety classification */
  readonly ThreadSafety?: string;
}

/**
 * Represents a callback member of a Roblox class.
 *
 * Callbacks are assignable function properties that Roblox invokes at specific times.
 */
export interface RobloxCallback {
  /** Discriminator indicating this is a callback */
  readonly MemberType: 'Callback';
  /** The name of the callback */
  readonly Name: string;
  /** Array of parameters passed to the callback */
  readonly Parameters: ReadonlyArray<RobloxParameter>;
  /** The expected return type of the callback */
  readonly ReturnType: RobloxValueType;
  /** Security level required to assign this callback */
  readonly Security?: string;
  /** Optional array of tags providing metadata */
  readonly Tags?: ReadonlyArray<RobloxTag>;
  /** Thread safety classification */
  readonly ThreadSafety?: string;
}

/**
 * Represents a parameter in a function, event, or callback definition.
 */
export interface RobloxParameter {
  /** The name of the parameter */
  readonly Name: string;
  /** The type of the parameter */
  readonly Type: RobloxValueType;
  /** Optional default value as a string representation */
  readonly Default?: string;
}

/**
 * Represents a value type in the Roblox API.
 *
 * Value types are categorized as primitives (bool, int, string, etc.),
 * classes (Instance types), data types (Vector3, CFrame, etc.),
 * enums, or groups (Array, Dictionary, Tuple, Variant).
 */
export interface RobloxValueType {
  /** The name of the type (e.g., 'bool', 'Part', 'Vector3', 'Material') */
  readonly Name: string;
  /** The category of the type */
  readonly Category: 'Primitive' | 'Class' | 'DataType' | 'Enum' | 'Group';
}

/**
 * Represents serialization capabilities for a property.
 *
 * Indicates whether a property can be loaded from and saved to place files.
 */
export interface RobloxSerialization {
  /** Whether the property can be loaded from place files */
  readonly CanLoad: boolean;
  /** Whether the property can be saved to place files */
  readonly CanSave: boolean;
}

/**
 * Represents security tags for property access.
 *
 * Security tags define the permission level required to read or write a property.
 */
export interface RobloxSecurityTags {
  /** Security level required to read the property */
  readonly Read: string;
  /** Security level required to write the property */
  readonly Write: string;
}

/**
 * Represents a Roblox enum definition.
 *
 * Enums are collections of named numeric values used throughout the Roblox API.
 */
export interface RobloxEnum {
  /** The name of the enum (e.g., 'Material', 'KeyCode', 'EasingStyle') */
  readonly Name: string;
  /** Array of all items in the enum */
  readonly Items: ReadonlyArray<RobloxEnumItem>;
}

/**
 * Represents a single item within a Roblox enum.
 */
export interface RobloxEnumItem {
  /** The name of the enum item (e.g., 'Plastic', 'W', 'Linear') */
  readonly Name: string;
  /** The numeric value of the enum item */
  readonly Value: number;
}

/**
 * Type guard that checks if a member is a RobloxProperty.
 *
 * @param member - The member to check
 * @returns True if the member is a RobloxProperty, false otherwise
 */
const isRobloxProperty = (member: RobloxMember): member is RobloxProperty => member.MemberType === 'Property';

/**
 * Type guard that checks if a member is a RobloxFunction.
 *
 * @param member - The member to check
 * @returns True if the member is a RobloxFunction, false otherwise
 */
const isRobloxFunction = (member: RobloxMember): member is RobloxFunction => member.MemberType === 'Function';

/**
 * Type guard that checks if a member is a RobloxEvent.
 *
 * @param member - The member to check
 * @returns True if the member is a RobloxEvent, false otherwise
 */
const isRobloxEvent = (member: RobloxMember): member is RobloxEvent => member.MemberType === 'Event';

/**
 * Type guard that checks if a member is a RobloxCallback.
 *
 * @param member - The member to check
 * @returns True if the member is a RobloxCallback, false otherwise
 */
const isRobloxCallback = (member: RobloxMember): member is RobloxCallback => member.MemberType === 'Callback';

/**
 * Converts a Roblox value type to a Luau type representation.
 *
 * This function handles all categories of Roblox types including primitives,
 * classes, data types, enums, and groups, mapping them to their appropriate
 * Luau type representations.
 *
 * @param valueType - The Roblox value type to convert
 * @param classMap - Map of class names to their LuauType definitions
 * @param dataTypeMap - Map of data type names to their LuauType definitions
 * @returns The corresponding LuauType representation
 */
const robloxTypeToLuau = (
  valueType: RobloxValueType,
  classMap: Map<string, LuauType>,
  dataTypeMap: Map<string, LuauType>,
): LuauType => {
  if (valueType.Category === 'Primitive') {
    switch (valueType.Name) {
      case 'bool':
        return BooleanType;
      case 'int':
      case 'int64':
      case 'float':
      case 'double':
        return NumberType;
      case 'string':
      case 'Content':
      case 'BinaryString':
      case 'SharedString':
        return StringType;
      case 'void':
      case 'null':
        return NilType;
      default:
        return AnyType;
    }
  }

  if (valueType.Category === 'Class') {
    const classType = classMap.get(valueType.Name);
    if (classType !== undefined) return classType;
    return { 'kind': 'TypeReference', 'name': valueType.Name };
  }

  if (valueType.Category === 'DataType') {
    const typeName = valueType.Name.replace(/\?$/, '');
    const isOptional = valueType.Name.endsWith('?');

    const dataType = dataTypeMap.get(typeName);
    if (dataType !== undefined) {
      if (isOptional) return { 'kind': 'Union', 'types': [dataType, NilType] };
      return dataType;
    }

    if (typeName === 'buffer') return { 'kind': 'Primitive', 'name': 'buffer' };

    if (typeName === 'Instances') {
      const instanceArrayType = createArrayType({ 'kind': 'TypeReference', 'name': 'Instance' });
      if (isOptional) return { 'kind': 'Union', 'types': [instanceArrayType, NilType] };
      return instanceArrayType;
    }

    if (typeName === 'CoordinateFrame') {
      const cframeRef: LuauType = { 'kind': 'TypeReference', 'name': 'CFrame' };
      if (isOptional) return { 'kind': 'Union', 'types': [cframeRef, NilType] };
      return cframeRef;
    }

    if (typeName === 'Function') {
      const funcType = createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], AnyType, {
        'isVariadic': true,
      });
      if (isOptional) return { 'kind': 'Union', 'types': [funcType, NilType] };
      return funcType;
    }

    if (typeName === 'Content') return StringType;
    if (typeName === 'ProtectedString') return StringType;
    if (typeName === 'BinaryString') return StringType;

    const typeRef: LuauType = { 'kind': 'TypeReference', 'name': typeName };
    if (isOptional) return { 'kind': 'Union', 'types': [typeRef, NilType] };
    return typeRef;
  }

  if (valueType.Category === 'Enum') return { 'kind': 'TypeReference', 'name': `Enum.${valueType.Name}` };

  if (valueType.Category === 'Group') {
    const groupName = valueType.Name.replace(/\?$/, '');
    const isOptional = valueType.Name.endsWith('?');

    const wrapOptional = (type: LuauType): LuauType => {
      if (isOptional) return { 'kind': 'Union', 'types': [type, NilType] };
      return type;
    };

    switch (groupName) {
      case 'Array':
        return wrapOptional(createArrayType(AnyType));
      case 'Dictionary':
        return wrapOptional(createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }));
      case 'Tuple':
        return wrapOptional(AnyType);
      case 'Variant':
        return wrapOptional(AnyType);
      case 'Objects':
        return wrapOptional(createArrayType({ 'kind': 'TypeReference', 'name': 'Instance' }));
      default:
        return wrapOptional(AnyType);
    }
  }

  return AnyType;
};

/**
 * Converts a Roblox parameter definition to a Luau function parameter.
 *
 * @param param - The Roblox parameter to convert
 * @param classMap - Map of class names to their LuauType definitions
 * @param dataTypeMap - Map of data type names to their LuauType definitions
 * @returns A FunctionParam object representing the parameter
 */
const convertParameter = (
  param: RobloxParameter,
  classMap: Map<string, LuauType>,
  dataTypeMap: Map<string, LuauType>,
): FunctionParam => ({
  'name': param.Name,
  'type': robloxTypeToLuau(param.Type, classMap, dataTypeMap),
  'optional': param.Default !== undefined,
});

/**
 * Mutable intermediate representation of a class used during conversion.
 *
 * This interface is used internally during the multi-pass conversion process
 * to build up class data before creating the final immutable ClassType.
 */
interface MutableClassData {
  /** The name of the class */
  name: string;
  /** The name of the superclass */
  superclassName: string;
  /** Map of property names to their definitions */
  properties: Map<string, ClassProperty>;
  /** Map of method names to their definitions */
  methods: Map<string, ClassMethod>;
}

/**
 * Contains deprecation information extracted from member tags.
 */
interface DeprecationInfo {
  /** Whether the member is deprecated */
  deprecated: boolean;
  /** Optional message suggesting an alternative to use */
  deprecationMessage: string | undefined;
}

/**
 * Type guard that checks if a tag is a RobloxTagObject.
 *
 * @param tag - The tag to check
 * @returns True if the tag is a RobloxTagObject, false if it is a string
 */
const isRobloxTagObject = (tag: RobloxTag): tag is RobloxTagObject => typeof tag === 'object' && tag !== null;

/**
 * Extracts deprecation information from an array of tags.
 *
 * This function checks for the 'Deprecated' tag and extracts the preferred
 * alternative name if available from a tag object.
 *
 * @param tags - Optional array of tags to check for deprecation info
 * @returns An object containing deprecation status and optional message
 */
const getDeprecationInfo = (tags: ReadonlyArray<RobloxTag> | undefined): DeprecationInfo => {
  if (tags === undefined) return { 'deprecated': false, 'deprecationMessage': undefined };

  const isDeprecated = tags.some(tag => tag === 'Deprecated');
  if (isDeprecated === false) return { 'deprecated': false, 'deprecationMessage': undefined };

  const tagObject = tags.find(isRobloxTagObject);
  const preferredName = tagObject?.PreferredDescriptorName;
  const message = preferredName !== undefined ? `Use '${preferredName}' instead.` : undefined;

  return { 'deprecated': true, 'deprecationMessage': message };
};

/**
 * Converts a complete Roblox API dump to Luau type definitions.
 *
 * This function performs a multi-pass conversion:
 * 1. First pass: Collect class data into mutable structures
 * 2. Second pass: Create ClassType instances with resolved properties
 * 3. Third pass: Resolve superclass references
 * 4. Fourth pass: Inject special methods for RemoteEvent, RemoteFunction, etc.
 * 5. Convert all enum definitions
 *
 * @param api - The Roblox API dump to convert
 * @returns An object containing maps of classes, enums, and data types
 */
export const convertRobloxApiToTypes = (
  api: RobloxApiDump,
): {
  classes: Map<string, LuauType>;
  enums: Map<string, LuauType>;
  dataTypes: Map<string, LuauType>;
} => {
  const classDataMap = new Map<string, MutableClassData>();
  const classes = new Map<string, LuauType>();
  const enums = new Map<string, LuauType>();
  const dataTypes = createDataTypeInstances();

  // First pass: collect class data into mutable structures
  for (const cls of api.Classes) {
    const classData: MutableClassData = {
      'name': cls.Name,
      'superclassName': cls.Superclass,
      'properties': new Map(),
      'methods': new Map(),
    };
    classDataMap.set(cls.Name, classData);

    for (const member of cls.Members) {
      const deprecation = getDeprecationInfo(member.Tags);
      const hasStringTag = (tag: string): boolean => member.Tags?.some(t => t === tag) === true;

      if (isRobloxProperty(member)) {
        const propType = robloxTypeToLuau(member.ValueType, classes, dataTypes);
        const isReadonly = hasStringTag('ReadOnly');
        const prop: ClassProperty = {
          'type': propType,
          'readonly': isReadonly,
          'security': 'None',
        };
        if (deprecation.deprecated) {
          (prop as { deprecated: boolean }).deprecated = true;
          if (deprecation.deprecationMessage !== undefined) {
            (prop as { deprecationMessage: string }).deprecationMessage = deprecation.deprecationMessage;
          }
        }
        classData.properties.set(member.Name, prop);
      }

      if (isRobloxFunction(member)) {
        const params = member.Parameters.map(p => convertParameter(p, classes, dataTypes));
        const returnType = robloxTypeToLuau(member.ReturnType, classes, dataTypes);
        const method: ClassMethod = {
          'func': createFunctionType(params, returnType),
        };
        if (deprecation.deprecated) {
          (method as { deprecated: boolean }).deprecated = true;
          if (deprecation.deprecationMessage !== undefined) {
            (method as { deprecationMessage: string }).deprecationMessage = deprecation.deprecationMessage;
          }
        }
        classData.methods.set(member.Name, method);
      }

      if (isRobloxEvent(member)) {
        const eventParams = member.Parameters.map(p => ({
          'name': p.Name,
          'type': robloxTypeToLuau(p.Type, classes, dataTypes),
        }));
        const signalType = createRBXScriptSignalType(eventParams);
        const eventProp: ClassProperty = {
          'type': signalType,
          'readonly': true,
          'security': 'None',
        };
        if (deprecation.deprecated) {
          (eventProp as { deprecated: boolean }).deprecated = true;
          if (deprecation.deprecationMessage !== undefined) {
            (eventProp as { deprecationMessage: string }).deprecationMessage = deprecation.deprecationMessage;
          }
        }
        classData.properties.set(member.Name, eventProp);
      }

      if (isRobloxCallback(member)) {
        const params = member.Parameters.map(p => convertParameter(p, classes, dataTypes));
        const returnType = robloxTypeToLuau(member.ReturnType, classes, dataTypes);
        const callbackProp: ClassProperty = {
          'type': createFunctionType(params, returnType),
          'readonly': false,
          'security': 'None',
        };
        if (deprecation.deprecated) {
          (callbackProp as { deprecated: boolean }).deprecated = true;
          if (deprecation.deprecationMessage !== undefined) {
            (callbackProp as { deprecationMessage: string }).deprecationMessage = deprecation.deprecationMessage;
          }
        }
        classData.properties.set(member.Name, callbackProp);
      }
    }
  }

  // Second pass: create ClassType instances with resolved superclasses
  for (const [name, data] of classDataMap) {
    const classType: LuauType = {
      'kind': 'Class',
      'name': name,
      'superclass': undefined,
      'properties': data.properties,
      'methods': data.methods,
      'events': new Map(),
      'tags': [],
    };
    classes.set(name, classType);
  }

  // Third pass: resolve superclass references
  for (const [name, data] of classDataMap) {
    if (data.superclassName !== '<<<ROOT>>>') {
      const classType = classes.get(name);
      const superType = classes.get(data.superclassName);
      if (
        classType !== undefined &&
        superType !== undefined &&
        classType.kind === 'Class' &&
        superType.kind === 'Class'
      ) {
        (classType as { superclass: LuauType | undefined }).superclass = superType;
      }
    }
  }

  // Fourth pass: inject special methods for RemoteEvent, RemoteFunction, UnreliableRemoteEvent
  injectRemoteMethods(classes, dataTypes);

  // Convert enums
  for (const enumDef of api.Enums) {
    const enumItems = new Map<string, { type: LuauType; readonly: boolean; optional: boolean }>();
    for (const item of enumDef.Items) {
      enumItems.set(item.Name, {
        'type': { 'kind': 'Literal', 'value': item.Value, 'baseType': 'number' },
        'readonly': true,
        'optional': false,
      });
    }
    enums.set(enumDef.Name, createTableType(enumItems));
  }

  return { classes, enums, dataTypes };
};

/**
 * Injects special methods for RemoteEvent, RemoteFunction, and UnreliableRemoteEvent.
 *
 * These methods (FireServer, FireClient, FireAllClients, InvokeServer, InvokeClient)
 * and event properties (OnServerEvent, OnClientEvent, OnServerInvoke, OnClientInvoke)
 * are always available regardless of client/server context to provide a complete
 * development experience.
 *
 * @param classes - Map of class names to their LuauType definitions to be mutated
 * @param _dataTypes - Map of data type names (unused but kept for future extensibility)
 */
const injectRemoteMethods = (classes: Map<string, LuauType>, _dataTypes: Map<string, LuauType>): void => {
  const playerType: LuauType = classes.get('Player') ?? { 'kind': 'TypeReference', 'name': 'Player' };
  const rbxScriptSignalType = createGenericRBXScriptSignalType();
  const variadicCallback = createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], AnyType, {
    'isVariadic': true,
  });

  // RemoteEvent methods
  const remoteEvent = classes.get('RemoteEvent');
  if (remoteEvent !== undefined && remoteEvent.kind === 'Class') {
    const methods = remoteEvent.methods as Map<string, ClassMethod>;
    const properties = remoteEvent.properties as Map<string, ClassProperty>;

    // Client to Server
    methods.set('FireServer', {
      'func': createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], NilType, {
        'isVariadic': true,
        'description':
          'Fires the RemoteEvent to the server with the given arguments. Can only be called from a LocalScript.',
      }),
    });

    // Server to Client
    methods.set('FireClient', {
      'func': createFunctionType(
        [
          { 'name': 'player', 'type': playerType, 'optional': false },
          { 'name': '...', 'type': AnyType, 'optional': false },
        ],
        NilType,
        {
          'isVariadic': true,
          'description':
            'Fires the RemoteEvent to a specific client with the given arguments. Can only be called from a Script.',
        },
      ),
    });

    // Server to All Clients
    methods.set('FireAllClients', {
      'func': createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], NilType, {
        'isVariadic': true,
        'description':
          'Fires the RemoteEvent to all connected clients with the given arguments. Can only be called from a Script.',
      }),
    });

    // Event signals
    properties.set('OnServerEvent', {
      'type': rbxScriptSignalType,
      'readonly': true,
      'security': 'None',
    });

    properties.set('OnClientEvent', {
      'type': rbxScriptSignalType,
      'readonly': true,
      'security': 'None',
    });
  }

  // RemoteFunction methods
  const remoteFunction = classes.get('RemoteFunction');
  if (remoteFunction !== undefined && remoteFunction.kind === 'Class') {
    const methods = remoteFunction.methods as Map<string, ClassMethod>;
    const properties = remoteFunction.properties as Map<string, ClassProperty>;

    // Client to Server
    methods.set('InvokeServer', {
      'func': createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], AnyType, {
        'isVariadic': true,
        'description':
          'Invokes the RemoteFunction on the server and returns the result. Can only be called from a LocalScript.',
      }),
    });

    // Server to Client
    methods.set('InvokeClient', {
      'func': createFunctionType(
        [
          { 'name': 'player', 'type': playerType, 'optional': false },
          { 'name': '...', 'type': AnyType, 'optional': false },
        ],
        AnyType,
        {
          'isVariadic': true,
          'description':
            'Invokes the RemoteFunction on a specific client and returns the result. Can only be called from a Script.',
        },
      ),
    });

    // Callback properties
    properties.set('OnServerInvoke', {
      'type': variadicCallback,
      'readonly': false,
      'security': 'None',
    });

    properties.set('OnClientInvoke', {
      'type': variadicCallback,
      'readonly': false,
      'security': 'None',
    });
  }

  // UnreliableRemoteEvent methods (same as RemoteEvent)
  const unreliableRemoteEvent = classes.get('UnreliableRemoteEvent');
  if (unreliableRemoteEvent !== undefined && unreliableRemoteEvent.kind === 'Class') {
    const methods = unreliableRemoteEvent.methods as Map<string, ClassMethod>;
    const properties = unreliableRemoteEvent.properties as Map<string, ClassProperty>;

    // Client to Server
    methods.set('FireServer', {
      'func': createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], NilType, {
        'isVariadic': true,
        'description':
          'Fires the UnreliableRemoteEvent to the server with the given arguments. Can only be called from a LocalScript.',
      }),
    });

    // Server to Client
    methods.set('FireClient', {
      'func': createFunctionType(
        [
          { 'name': 'player', 'type': playerType, 'optional': false },
          { 'name': '...', 'type': AnyType, 'optional': false },
        ],
        NilType,
        {
          'isVariadic': true,
          'description':
            'Fires the UnreliableRemoteEvent to a specific client with the given arguments. Can only be called from a Script.',
        },
      ),
    });

    // Server to All Clients
    methods.set('FireAllClients', {
      'func': createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], NilType, {
        'isVariadic': true,
        'description':
          'Fires the UnreliableRemoteEvent to all connected clients with the given arguments. Can only be called from a Script.',
      }),
    });

    // Event signals
    properties.set('OnServerEvent', {
      'type': rbxScriptSignalType,
      'readonly': true,
      'security': 'None',
    });

    properties.set('OnClientEvent', {
      'type': rbxScriptSignalType,
      'readonly': true,
      'security': 'None',
    });
  }
};
