import {
  AnyType,
  BooleanType,
  createArrayType,
  createFunctionType,
  createTableType,
  NilType,
  NumberType,
  StringType,
} from '@analyzer/values';
import {
  createDataTypeInstances,
  createGenericRBXScriptSignalType,
  createRBXScriptSignalType,
} from '@definitions/dataTypes';
import { once } from '@utils/once';

import type { ClassMethod, ClassProperty, FunctionParam, LuauType } from '@typings/types';

import type {
  ClassTypeUnderConstruction,
  ConvertedRobloxTypes,
  MutableClassData,
  RobloxApiDump,
  RobloxCallback,
  RobloxClass,
  RobloxClassCatalogues,
  RobloxDeprecation,
  RobloxEvent,
  RobloxFunction,
  RobloxMember,
  RobloxParameter,
  RobloxProperty,
  RobloxTag,
  RobloxTagObject,
  RobloxValueType,
} from '@typings/definitions';

const isRobloxProperty = (member: RobloxMember): member is RobloxProperty => member.MemberType === 'Property';

const isRobloxFunction = (member: RobloxMember): member is RobloxFunction => member.MemberType === 'Function';

const isRobloxEvent = (member: RobloxMember): member is RobloxEvent => member.MemberType === 'Event';

const isRobloxCallback = (member: RobloxMember): member is RobloxCallback => member.MemberType === 'Callback';

const robloxTypeToLuau = (valueType: RobloxValueType, dataTypeMap: Map<string, LuauType>): LuauType => {
  if (valueType.Category === 'Primitive')
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

  if (valueType.Category === 'Class') return { 'kind': 'TypeReference', 'name': valueType.Name };

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

const convertParameter = (param: RobloxParameter, dataTypeMap: Map<string, LuauType>): FunctionParam => ({
  'name': param.Name,
  'type': robloxTypeToLuau(param.Type, dataTypeMap),
  'optional': param.Default !== undefined,
});

const isRobloxTagObject = (tag: RobloxTag): tag is RobloxTagObject => typeof tag === 'object' && tag !== null;

const getDeprecationInfo = (tags: ReadonlyArray<RobloxTag> | undefined): RobloxDeprecation => {
  if (tags === undefined) return { 'deprecated': false, 'deprecationMessage': undefined };

  const isDeprecated = tags.some(tag => tag === 'Deprecated');
  if (isDeprecated === false) return { 'deprecated': false, 'deprecationMessage': undefined };

  const tagObject = tags.find(isRobloxTagObject);
  const preferredName = tagObject?.PreferredDescriptorName;
  const message = preferredName !== undefined ? `Use '${preferredName}' instead.` : undefined;

  return { 'deprecated': true, 'deprecationMessage': message };
};

const hasClassTag = (robloxClass: RobloxClass, tag: string): boolean =>
  robloxClass.Tags?.some(classTag => classTag === tag) === true;

/** Derives service and creatable class names from Roblox API class tags, preserving upstream class order. */
export const collectClassCatalogues = (api: RobloxApiDump | undefined): RobloxClassCatalogues => {
  if (api === undefined) return { 'serviceNames': [], 'creatableClasses': [] };

  const serviceNames = api.Classes.filter(robloxClass => hasClassTag(robloxClass, 'Service')).map(
    robloxClass => robloxClass.Name,
  );
  const creatableClasses = api.Classes.filter(
    robloxClass => hasClassTag(robloxClass, 'Service') === false && hasClassTag(robloxClass, 'NotCreatable') === false,
  ).map(robloxClass => robloxClass.Name);
  return { serviceNames, creatableClasses };
};

const withDeprecation = <T extends ClassProperty | ClassMethod>(member: T, deprecation: RobloxDeprecation): T => {
  if (deprecation.deprecated === false) return member;
  if (deprecation.deprecationMessage === undefined) return { ...member, 'deprecated': true };
  return { ...member, 'deprecated': true, 'deprecationMessage': deprecation.deprecationMessage };
};

const convertMembers = (
  cls: RobloxClass,
  dataTypes: Map<string, LuauType>,
): Pick<MutableClassData, 'properties' | 'methods'> => {
  const properties = new Map<string, ClassProperty>();
  const methods = new Map<string, ClassMethod>();

  for (const member of cls.Members) {
    const deprecation = getDeprecationInfo(member.Tags);

    if (isRobloxProperty(member)) {
      const prop: ClassProperty = {
        'type': robloxTypeToLuau(member.ValueType, dataTypes),
        'readonly': member.Tags?.some(tag => tag === 'ReadOnly') === true,
        'security': 'None',
      };
      properties.set(member.Name, withDeprecation(prop, deprecation));
    }

    if (isRobloxFunction(member)) {
      const params = member.Parameters.map(parameter => convertParameter(parameter, dataTypes));
      const returnType = robloxTypeToLuau(member.ReturnType, dataTypes);
      const method: ClassMethod = { 'func': createFunctionType(params, returnType) };
      methods.set(member.Name, withDeprecation(method, deprecation));
    }

    if (isRobloxEvent(member)) {
      const eventParams = member.Parameters.map(parameter => ({
        'name': parameter.Name,
        'type': robloxTypeToLuau(parameter.Type, dataTypes),
      }));
      const eventProp: ClassProperty = {
        'type': createRBXScriptSignalType(eventParams),
        'readonly': true,
        'security': 'None',
      };
      properties.set(member.Name, withDeprecation(eventProp, deprecation));
    }

    if (isRobloxCallback(member)) {
      const params = member.Parameters.map(parameter => convertParameter(parameter, dataTypes));
      const returnType = robloxTypeToLuau(member.ReturnType, dataTypes);
      const callbackProp: ClassProperty = {
        'type': createFunctionType(params, returnType),
        'readonly': false,
        'security': 'None',
      };
      properties.set(member.Name, withDeprecation(callbackProp, deprecation));
    }
  }

  return { properties, methods };
};

/**
 * Converts a Roblox API dump to Luau type definitions. Every class exists immediately with its name and superclass;
 * a class's properties and methods are converted the first time either map is read.
 */
export const convertRobloxApiToTypes = (api: RobloxApiDump): ConvertedRobloxTypes => {
  const classes = new Map<string, LuauType>();
  const constructedClasses = new Map<string, ClassTypeUnderConstruction>();
  const enums = new Map<string, LuauType>();
  const dataTypes = createDataTypeInstances();

  for (const cls of api.Classes) {
    const members = once(() => convertMembers(cls, dataTypes));
    const classType: ClassTypeUnderConstruction = {
      'kind': 'Class',
      'name': cls.Name,
      'superclass': undefined,
      get 'properties'() {
        return members().properties;
      },
      get 'methods'() {
        return members().methods;
      },
      'events': new Map(),
      'tags': [],
    };
    constructedClasses.set(cls.Name, classType);
    classes.set(cls.Name, classType);
  }

  for (const cls of api.Classes)
    if (cls.Superclass !== '<<<ROOT>>>') {
      const classType = constructedClasses.get(cls.Name);
      const superType = constructedClasses.get(cls.Superclass);
      if (classType !== undefined && superType !== undefined) classType.superclass = superType;
    }

  injectRemoteMethods(classes, constructedClasses);

  for (const enumDef of api.Enums) {
    const enumItems = new Map<string, { type: LuauType; readonly: boolean; optional: boolean }>();
    for (const item of enumDef.Items)
      enumItems.set(item.Name, {
        'type': { 'kind': 'Literal', 'value': item.Value, 'baseType': 'number' },
        'readonly': true,
        'optional': false,
      });
    enums.set(enumDef.Name, createTableType(enumItems));
  }

  return { classes, enums, dataTypes };
};

const injectRemoteMethods = (
  classes: Map<string, LuauType>,
  constructedClasses: Map<string, ClassTypeUnderConstruction>,
): void => {
  const playerType: LuauType = classes.get('Player') ?? { 'kind': 'TypeReference', 'name': 'Player' };
  const rbxScriptSignalType = createGenericRBXScriptSignalType();
  const variadicCallback = createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], AnyType, {
    'isVariadic': true,
  });

  const remoteEvent = constructedClasses.get('RemoteEvent');
  if (remoteEvent !== undefined) {
    const { methods, properties } = remoteEvent;

    methods.set('FireServer', {
      'func': createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], NilType, {
        'isVariadic': true,
        'description':
          'Fires the RemoteEvent to the server with the given arguments. Can only be called from a LocalScript.',
      }),
    });

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

    methods.set('FireAllClients', {
      'func': createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], NilType, {
        'isVariadic': true,
        'description':
          'Fires the RemoteEvent to all connected clients with the given arguments. Can only be called from a Script.',
      }),
    });

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

  const remoteFunction = constructedClasses.get('RemoteFunction');
  if (remoteFunction !== undefined) {
    const { methods, properties } = remoteFunction;

    methods.set('InvokeServer', {
      'func': createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], AnyType, {
        'isVariadic': true,
        'description':
          'Invokes the RemoteFunction on the server and returns the result. Can only be called from a LocalScript.',
      }),
    });

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

  const unreliableRemoteEvent = constructedClasses.get('UnreliableRemoteEvent');
  if (unreliableRemoteEvent !== undefined) {
    const { methods, properties } = unreliableRemoteEvent;

    methods.set('FireServer', {
      'func': createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], NilType, {
        'isVariadic': true,
        'description':
          'Fires the UnreliableRemoteEvent to the server with the given arguments. Can only be called from a LocalScript.',
      }),
    });

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

    methods.set('FireAllClients', {
      'func': createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], NilType, {
        'isVariadic': true,
        'description':
          'Fires the UnreliableRemoteEvent to all connected clients with the given arguments. Can only be called from a Script.',
      }),
    });

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
