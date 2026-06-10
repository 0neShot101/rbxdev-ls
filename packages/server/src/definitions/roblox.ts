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

import type {
  MutableClassData,
  RobloxApiDump,
  RobloxCallback,
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

import {
  createDataTypeInstances,
  createGenericRBXScriptSignalType,
  createRBXScriptSignalType,
} from '@definitions/dataTypes';

const isRobloxProperty = (member: RobloxMember): member is RobloxProperty => member.MemberType === 'Property';

const isRobloxFunction = (member: RobloxMember): member is RobloxFunction => member.MemberType === 'Function';

const isRobloxEvent = (member: RobloxMember): member is RobloxEvent => member.MemberType === 'Event';

const isRobloxCallback = (member: RobloxMember): member is RobloxCallback => member.MemberType === 'Callback';

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

const convertParameter = (
  param: RobloxParameter,
  classMap: Map<string, LuauType>,
  dataTypeMap: Map<string, LuauType>,
): FunctionParam => ({
  'name': param.Name,
  'type': robloxTypeToLuau(param.Type, classMap, dataTypeMap),
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

/** Converts a complete Roblox API dump to Luau type definitions via multi-pass conversion. */
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
          if (deprecation.deprecationMessage !== undefined)
            (prop as { deprecationMessage: string }).deprecationMessage = deprecation.deprecationMessage;
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
          if (deprecation.deprecationMessage !== undefined)
            (method as { deprecationMessage: string }).deprecationMessage = deprecation.deprecationMessage;
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
          if (deprecation.deprecationMessage !== undefined)
            (eventProp as { deprecationMessage: string }).deprecationMessage = deprecation.deprecationMessage;
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
          if (deprecation.deprecationMessage !== undefined)
            (callbackProp as { deprecationMessage: string }).deprecationMessage = deprecation.deprecationMessage;
        }
        classData.properties.set(member.Name, callbackProp);
      }
    }
  }

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

  for (const [name, data] of classDataMap)
    if (data.superclassName !== '<<<ROOT>>>') {
      const classType = classes.get(name);
      const superType = classes.get(data.superclassName);
      if (
        classType !== undefined &&
        superType !== undefined &&
        classType.kind === 'Class' &&
        superType.kind === 'Class'
      )
        (classType as { superclass: LuauType | undefined }).superclass = superType;
    }

  injectRemoteMethods(classes, dataTypes);

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

const injectRemoteMethods = (classes: Map<string, LuauType>, _dataTypes: Map<string, LuauType>): void => {
  const playerType: LuauType = classes.get('Player') ?? { 'kind': 'TypeReference', 'name': 'Player' };
  const rbxScriptSignalType = createGenericRBXScriptSignalType();
  const variadicCallback = createFunctionType([{ 'name': '...', 'type': AnyType, 'optional': false }], AnyType, {
    'isVariadic': true,
  });

  const remoteEvent = classes.get('RemoteEvent');
  if (remoteEvent !== undefined && remoteEvent.kind === 'Class') {
    const methods = remoteEvent.methods as Map<string, ClassMethod>;
    const properties = remoteEvent.properties as Map<string, ClassProperty>;

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

  const remoteFunction = classes.get('RemoteFunction');
  if (remoteFunction !== undefined && remoteFunction.kind === 'Class') {
    const methods = remoteFunction.methods as Map<string, ClassMethod>;
    const properties = remoteFunction.properties as Map<string, ClassProperty>;

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

  const unreliableRemoteEvent = classes.get('UnreliableRemoteEvent');
  if (unreliableRemoteEvent !== undefined && unreliableRemoteEvent.kind === 'Class') {
    const methods = unreliableRemoteEvent.methods as Map<string, ClassMethod>;
    const properties = unreliableRemoteEvent.properties as Map<string, ClassProperty>;

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
