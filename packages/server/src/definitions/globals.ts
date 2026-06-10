import { addLuauBuiltins, createTypeEnvironment } from '@typings/environment';
import {
  AnyType,
  BooleanType,
  NilType,
  NumberType,
  StringType,
  createFunctionType,
  createTableType,
  type LuauType,
} from '@typings/types';

import type { GlobalEnvironment, LoadedDefinitions } from '@typings/definitions';
import { loadDefinitions } from '@definitions/loader';
import { addLuarmorGlobals } from '@definitions/luarmor';
import { addLuraphGlobals } from '@definitions/luraph';
import { convertRobloxApiToTypes } from '@definitions/roblox';
import { createAllStdLibraries } from '@definitions/stdlib';
import { convertSuncApiToTypes, getDefaultSuncApi } from '@definitions/sunc';

const createGlobalFunctions = (): Map<string, LuauType> =>
  new Map([
    ['print', createFunctionType([], NilType, { 'isVariadic': true })],
    ['warn', createFunctionType([], NilType, { 'isVariadic': true })],
    [
      'error',
      createFunctionType(
        [
          { 'name': 'message', 'type': StringType, 'optional': false },
          { 'name': 'level', 'type': NumberType, 'optional': true },
        ],
        { 'kind': 'Never' },
      ),
    ],
    [
      'assert',
      createFunctionType(
        [
          { 'name': 'condition', 'type': AnyType, 'optional': false },
          { 'name': 'message', 'type': StringType, 'optional': true },
        ],
        AnyType,
      ),
    ],
    ['type', createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], StringType)],
    ['typeof', createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], StringType)],
    ['tostring', createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], StringType)],
    [
      'tonumber',
      createFunctionType(
        [
          { 'name': 'value', 'type': AnyType, 'optional': false },
          { 'name': 'base', 'type': NumberType, 'optional': true },
        ],
        { 'kind': 'Union', 'types': [NumberType, NilType] },
      ),
    ],
    [
      'select',
      createFunctionType(
        [{ 'name': 'index', 'type': { 'kind': 'Union', 'types': [NumberType, StringType] }, 'optional': false }],
        AnyType,
        { 'isVariadic': true },
      ),
    ],
    [
      'pairs',
      createFunctionType(
        [{ 'name': 't', 'type': createTableType(new Map()), 'optional': false }],
        createFunctionType([], AnyType),
      ),
    ],
    [
      'ipairs',
      createFunctionType(
        [{ 'name': 't', 'type': createTableType(new Map()), 'optional': false }],
        createFunctionType([], { 'kind': 'Union', 'types': [NumberType, NilType] }),
      ),
    ],
    [
      'next',
      createFunctionType(
        [
          { 'name': 't', 'type': createTableType(new Map()), 'optional': false },
          { 'name': 'index', 'type': AnyType, 'optional': true },
        ],
        AnyType,
      ),
    ],
    [
      'rawequal',
      createFunctionType(
        [
          { 'name': 'v1', 'type': AnyType, 'optional': false },
          { 'name': 'v2', 'type': AnyType, 'optional': false },
        ],
        BooleanType,
      ),
    ],
    [
      'rawget',
      createFunctionType(
        [
          { 'name': 't', 'type': createTableType(new Map()), 'optional': false },
          { 'name': 'index', 'type': AnyType, 'optional': false },
        ],
        AnyType,
      ),
    ],
    [
      'rawset',
      createFunctionType(
        [
          { 'name': 't', 'type': createTableType(new Map()), 'optional': false },
          { 'name': 'index', 'type': AnyType, 'optional': false },
          { 'name': 'value', 'type': AnyType, 'optional': false },
        ],
        createTableType(new Map()),
      ),
    ],
    [
      'rawlen',
      createFunctionType(
        [
          {
            'name': 'v',
            'type': { 'kind': 'Union', 'types': [StringType, createTableType(new Map())] },
            'optional': false,
          },
        ],
        NumberType,
      ),
    ],
    [
      'getmetatable',
      createFunctionType([{ 'name': 'object', 'type': AnyType, 'optional': false }], {
        'kind': 'Union',
        'types': [createTableType(new Map()), NilType],
      }),
    ],
    [
      'setmetatable',
      createFunctionType(
        [
          { 'name': 't', 'type': createTableType(new Map()), 'optional': false },
          {
            'name': 'metatable',
            'type': { 'kind': 'Union', 'types': [createTableType(new Map()), NilType] },
            'optional': false,
          },
        ],
        createTableType(new Map()),
      ),
    ],
    [
      'pcall',
      createFunctionType(
        [{ 'name': 'f', 'type': createFunctionType([], AnyType, { 'isVariadic': true }), 'optional': false }],
        BooleanType,
        { 'isVariadic': true },
      ),
    ],
    [
      'xpcall',
      createFunctionType(
        [
          { 'name': 'f', 'type': createFunctionType([], AnyType, { 'isVariadic': true }), 'optional': false },
          {
            'name': 'err',
            'type': createFunctionType([{ 'name': 'message', 'type': AnyType, 'optional': false }], AnyType),
            'optional': false,
          },
        ],
        BooleanType,
        { 'isVariadic': true },
      ),
    ],
    ['require', createFunctionType([{ 'name': 'module', 'type': AnyType, 'optional': false }], AnyType)],
    [
      'unpack',
      createFunctionType(
        [
          { 'name': 't', 'type': createTableType(new Map()), 'optional': false },
          { 'name': 'i', 'type': NumberType, 'optional': true },
          { 'name': 'j', 'type': NumberType, 'optional': true },
        ],
        AnyType,
        { 'isVariadic': true },
      ),
    ],
    ['collectgarbage', createFunctionType([{ 'name': 'opt', 'type': StringType, 'optional': true }], AnyType)],
    ['gcinfo', createFunctionType([], NumberType)],
    ['newproxy', createFunctionType([{ 'name': 'addMetatable', 'type': BooleanType, 'optional': true }], AnyType)],
    [
      'getfenv',
      createFunctionType(
        [
          {
            'name': 'f',
            'type': { 'kind': 'Union', 'types': [NumberType, createFunctionType([], AnyType)] },
            'optional': true,
          },
        ],
        createTableType(new Map()),
      ),
    ],
    [
      'setfenv',
      createFunctionType(
        [
          {
            'name': 'f',
            'type': { 'kind': 'Union', 'types': [NumberType, createFunctionType([], AnyType)] },
            'optional': false,
          },
          { 'name': 'env', 'type': createTableType(new Map()), 'optional': false },
        ],
        createFunctionType([], AnyType),
      ),
    ],
    ['tick', createFunctionType([], NumberType)],
    ['time', createFunctionType([], NumberType)],
    ['wait', createFunctionType([{ 'name': 'seconds', 'type': NumberType, 'optional': true }], NumberType)],
    [
      'delay',
      createFunctionType(
        [
          { 'name': 'delayTime', 'type': NumberType, 'optional': false },
          { 'name': 'callback', 'type': createFunctionType([], NilType), 'optional': false },
        ],
        NilType,
      ),
    ],
    [
      'spawn',
      createFunctionType([{ 'name': 'callback', 'type': createFunctionType([], NilType), 'optional': false }], NilType),
    ],
    ['elapsedTime', createFunctionType([], NumberType)],
    ['version', createFunctionType([], StringType)],
  ]);

const GAME_SERVICES: ReadonlyArray<string> = [
  'Players',
  'Workspace',
  'Lighting',
  'ReplicatedFirst',
  'ReplicatedStorage',
  'ServerScriptService',
  'ServerStorage',
  'StarterGui',
  'StarterPack',
  'StarterPlayer',
  'Teams',
  'SoundService',
  'Chat',
  'TextChatService',
  'VoiceChatService',
  'LocalizationService',
  'TestService',
  'RunService',
  'UserInputService',
  'ContextActionService',
  'GuiService',
  'HapticService',
  'VRService',
  'TouchInputService',
  'TweenService',
  'AnimationClipProvider',
  'KeyframeSequenceProvider',
  'TextService',
  'ContentProvider',
  'PathfindingService',
  'PhysicsService',
  'CollectionService',
  'Debris',
  'ChangeHistoryService',
  'Selection',
  'HttpService',
  'NetworkClient',
  'NetworkServer',
  'MarketplaceService',
  'GamePassService',
  'BadgeService',
  'DataStoreService',
  'MemoryStoreService',
  'MessagingService',
  'SocialService',
  'FriendService',
  'GroupService',
  'AvatarEditorService',
  'AvatarImportService',
  'HumanoidDescriptionConverter',
  'AssetService',
  'InsertService',
  'PolicyService',
  'SafetyService',
  'ProximityPromptService',
  'MaterialService',
  'LogService',
  'AnalyticsService',
  'Stats',
  'ScriptContext',
  'NotificationService',
  'TeleportService',
  'ExperienceNotificationService',
  'CoreGui',
  'Camera',
  'GamepadService',
  'KeyboardService',
  'MouseService',
  'OpenCloudService',
];

const createRobloxGlobals = (classes: Map<string, LuauType>, enums: Map<string, LuauType>): Map<string, LuauType> => {
  const globals = new Map<string, LuauType>();

  const dataModel = classes.get('DataModel');
  if (dataModel !== undefined && dataModel.kind === 'Class') {
    const gameProperties = new Map(dataModel.properties);

    for (const serviceName of GAME_SERVICES) {
      const serviceClass = classes.get(serviceName);
      if (serviceClass !== undefined)
        gameProperties.set(serviceName, {
          'type': serviceClass,
          'readonly': true,
          'security': 'None',
        });
    }

    const gameType: LuauType = {
      'kind': 'Class',
      'name': 'DataModel',
      'superclass': dataModel.superclass,
      'properties': gameProperties,
      'methods': dataModel.methods,
      'events': dataModel.events,
      'tags': dataModel.tags,
    };

    globals.set('game', gameType);
  }

  const workspace = classes.get('Workspace');
  if (workspace !== undefined) globals.set('workspace', workspace);

  const baseScript = classes.get('BaseScript');
  const luaSourceContainer = classes.get('LuaSourceContainer');
  globals.set('script', baseScript ?? luaSourceContainer ?? AnyType);

  globals.set('shared', createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }));
  globals.set('_G', createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }));
  globals.set('_VERSION', StringType);

  const instanceClass = classes.get('Instance');
  if (instanceClass !== undefined)
    globals.set(
      'Instance',
      createTableType(
        new Map([
          [
            'new',
            {
              'type': createFunctionType(
                [
                  { 'name': 'className', 'type': StringType, 'optional': false },
                  { 'name': 'parent', 'type': instanceClass, 'optional': true },
                ],
                instanceClass,
                {
                  'description':
                    'Creates a new Instance of the given class name, optionally parented to the given parent.',
                },
              ),
              'readonly': true,
              'optional': false,
            },
          ],
          [
            'fromExisting',
            {
              'type': createFunctionType(
                [{ 'name': 'instance', 'type': instanceClass, 'optional': false }],
                instanceClass,
                { 'description': 'Creates a copy of an existing Instance and all of its descendants.' },
              ),
              'readonly': true,
              'optional': false,
            },
          ],
        ]),
      ),
    );

  const vector3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };
  const vector2Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector2' };
  const cframeType: LuauType = { 'kind': 'TypeReference', 'name': 'CFrame' };
  const color3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Color3' };
  const udim2Type: LuauType = { 'kind': 'TypeReference', 'name': 'UDim2' };
  const udimType: LuauType = { 'kind': 'TypeReference', 'name': 'UDim' };

  globals.set(
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
  );

  globals.set(
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
  );

  globals.set(
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
  );

  globals.set(
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
              {
                'description': 'Creates a Color3 from hue, saturation, and value components, each in the range [0, 1].',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromHex',
          {
            'type': createFunctionType([{ 'name': 'hex', 'type': StringType, 'optional': false }], color3Type, {
              'description': 'Creates a Color3 from a hexadecimal string (e.g., "#FF0000" or "FF0000").',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  globals.set(
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
  );

  globals.set(
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
  );

  const brickColorType: LuauType = { 'kind': 'TypeReference', 'name': 'BrickColor' };
  globals.set(
    'BrickColor',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], brickColorType, {
              'description': 'Creates a BrickColor from a name, number, or Color3 value.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'palette',
          {
            'type': createFunctionType([{ 'name': 'index', 'type': NumberType, 'optional': false }], brickColorType, {
              'description': 'Returns the BrickColor from the default palette at the given index (0-127).',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'random',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns a random BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'White',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the White BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'Black',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the Black BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'Red',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the Red BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'Green',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the Green BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'Blue',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the Blue BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'Yellow',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the Yellow BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const tweenInfoType: LuauType = { 'kind': 'TypeReference', 'name': 'TweenInfo' };
  globals.set(
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
              tweenInfoType,
              { 'description': 'Creates a new TweenInfo with the given easing parameters for use with TweenService.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const numberRangeType: LuauType = { 'kind': 'TypeReference', 'name': 'NumberRange' };
  globals.set(
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
              numberRangeType,
              { 'description': 'Creates a new NumberRange from a minimum and optional maximum value.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const numberSequenceType: LuauType = { 'kind': 'TypeReference', 'name': 'NumberSequence' };
  globals.set(
    'NumberSequence',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], numberSequenceType, {
              'description':
                'Creates a new NumberSequence from a single value, two values, or an array of NumberSequenceKeypoints.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const colorSequenceType: LuauType = { 'kind': 'TypeReference', 'name': 'ColorSequence' };
  globals.set(
    'ColorSequence',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], colorSequenceType, {
              'description':
                'Creates a new ColorSequence from a single Color3, two Color3s, or an array of ColorSequenceKeypoints.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const rayType: LuauType = { 'kind': 'TypeReference', 'name': 'Ray' };
  globals.set(
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
              rayType,
              { 'description': 'Creates a new Ray from an origin point and a direction vector.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const region3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Region3' };
  globals.set(
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
              region3Type,
              { 'description': 'Creates a new Region3 from two Vector3 corners (min and max).' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const rectType: LuauType = { 'kind': 'TypeReference', 'name': 'Rect' };
  globals.set(
    'Rect',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], rectType, {
              'isVariadic': true,
              'description': 'Creates a new Rect from min/max points or x/y coordinates.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const raycastParamsType: LuauType = { 'kind': 'TypeReference', 'name': 'RaycastParams' };
  globals.set(
    'RaycastParams',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], raycastParamsType, {
              'description': 'Creates a new RaycastParams object for use with workspace:Raycast().',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const overlapParamsType: LuauType = { 'kind': 'TypeReference', 'name': 'OverlapParams' };
  globals.set(
    'OverlapParams',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], overlapParamsType, {
              'description': 'Creates a new OverlapParams object for use with spatial query methods.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const dateTimeType: LuauType = { 'kind': 'TypeReference', 'name': 'DateTime' };
  globals.set(
    'DateTime',
    createTableType(
      new Map([
        [
          'now',
          {
            'type': createFunctionType([], dateTimeType, {
              'description': 'Returns a DateTime representing the current UTC time.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromUnixTimestamp',
          {
            'type': createFunctionType([{ 'name': 'timestamp', 'type': NumberType, 'optional': false }], dateTimeType, {
              'description': 'Creates a DateTime from a Unix timestamp (seconds since epoch).',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromUnixTimestampMillis',
          {
            'type': createFunctionType([{ 'name': 'timestamp', 'type': NumberType, 'optional': false }], dateTimeType, {
              'description': 'Creates a DateTime from a Unix timestamp in milliseconds.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromIsoDate',
          {
            'type': createFunctionType([{ 'name': 'isoDate', 'type': StringType, 'optional': false }], dateTimeType, {
              'description': 'Creates a DateTime from an ISO 8601 date-time string.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromLocalTime',
          {
            'type': createFunctionType([{ 'name': 'dateTime', 'type': AnyType, 'optional': false }], dateTimeType, {
              'description': 'Creates a DateTime from a table of local time components.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromUniversalTime',
          {
            'type': createFunctionType([{ 'name': 'dateTime', 'type': AnyType, 'optional': false }], dateTimeType, {
              'description': 'Creates a DateTime from a table of UTC time components.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const randomType: LuauType = { 'kind': 'TypeReference', 'name': 'Random' };
  globals.set(
    'Random',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'seed', 'type': NumberType, 'optional': true }], randomType, {
              'description': 'Creates a new Random number generator with an optional seed.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const physicalPropertiesType: LuauType = { 'kind': 'TypeReference', 'name': 'PhysicalProperties' };
  globals.set(
    'PhysicalProperties',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'density', 'type': NumberType, 'optional': false },
                { 'name': 'friction', 'type': NumberType, 'optional': true },
                { 'name': 'elasticity', 'type': NumberType, 'optional': true },
                { 'name': 'frictionWeight', 'type': NumberType, 'optional': true },
                { 'name': 'elasticityWeight', 'type': NumberType, 'optional': true },
              ],
              physicalPropertiesType,
              {
                'description':
                  'Creates custom PhysicalProperties from a material or explicit density, friction, and elasticity values.',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const vector2int16Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector2int16' };
  globals.set(
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
              vector2int16Type,
              { 'description': 'Creates a new Vector2int16 from integer x and y components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const vector3int16Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3int16' };
  globals.set(
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
              vector3int16Type,
              { 'description': 'Creates a new Vector3int16 from integer x, y, and z components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const region3int16Type: LuauType = { 'kind': 'TypeReference', 'name': 'Region3int16' };
  globals.set(
    'Region3int16',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'min', 'type': vector3int16Type, 'optional': false },
                { 'name': 'max', 'type': vector3int16Type, 'optional': false },
              ],
              region3int16Type,
              { 'description': 'Creates a new Region3int16 from two Vector3int16 corners.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const catalogSearchParamsType: LuauType = { 'kind': 'TypeReference', 'name': 'CatalogSearchParams' };
  globals.set(
    'CatalogSearchParams',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], catalogSearchParamsType, {
              'description': 'Creates a new CatalogSearchParams object for searching the avatar catalog.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const sharedTableType: LuauType = { 'kind': 'TypeReference', 'name': 'SharedTable' };
  globals.set(
    'SharedTable',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], sharedTableType, {
              'description': 'Creates a new empty SharedTable for cross-thread data sharing.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'clone',
          {
            'type': createFunctionType(
              [
                { 'name': 'st', 'type': sharedTableType, 'optional': false },
                { 'name': 'freezeClone', 'type': BooleanType, 'optional': true },
              ],
              sharedTableType,
              { 'description': 'Creates a clone of the given SharedTable, optionally freezing the clone.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'cloneAndFreeze',
          {
            'type': createFunctionType(
              [{ 'name': 'st', 'type': sharedTableType, 'optional': false }],
              sharedTableType,
              {
                'description': 'Creates a frozen clone of the given SharedTable.',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'isFrozen',
          {
            'type': createFunctionType([{ 'name': 'st', 'type': sharedTableType, 'optional': false }], BooleanType, {
              'description': 'Returns whether the given SharedTable is frozen.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'size',
          {
            'type': createFunctionType([{ 'name': 'st', 'type': sharedTableType, 'optional': false }], NumberType, {
              'description': 'Returns the number of entries in the given SharedTable.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'clear',
          {
            'type': createFunctionType([{ 'name': 'st', 'type': sharedTableType, 'optional': false }], NilType, {
              'description': 'Removes all entries from the given SharedTable.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const dockWidgetPluginGuiInfoType: LuauType = { 'kind': 'TypeReference', 'name': 'DockWidgetPluginGuiInfo' };
  globals.set(
    'DockWidgetPluginGuiInfo',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'initDockState', 'type': AnyType, 'optional': true },
                { 'name': 'initEnabled', 'type': BooleanType, 'optional': true },
                { 'name': 'overrideRestore', 'type': BooleanType, 'optional': true },
                { 'name': 'floatXSize', 'type': NumberType, 'optional': true },
                { 'name': 'floatYSize', 'type': NumberType, 'optional': true },
                { 'name': 'minWidth', 'type': NumberType, 'optional': true },
                { 'name': 'minHeight', 'type': NumberType, 'optional': true },
              ],
              dockWidgetPluginGuiInfoType,
              {
                'description': 'Creates a new DockWidgetPluginGuiInfo for configuring plugin widget docking behavior.',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const fontType: LuauType = { 'kind': 'TypeReference', 'name': 'Font' };
  globals.set(
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
              fontType,
              {
                'description':
                  'Creates a new Font from a font family asset ID or path, with optional weight and style.',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromEnum',
          {
            'type': createFunctionType([{ 'name': 'font', 'type': AnyType, 'optional': false }], fontType, {
              'description': 'Creates a Font from an Enum.Font value.',
            }),
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
              fontType,
              { 'description': 'Creates a Font from a font asset ID with optional weight and style.' },
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
              fontType,
              { 'description': 'Creates a Font from a font name with optional weight and style.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const facesType: LuauType = { 'kind': 'TypeReference', 'name': 'Faces' };
  globals.set(
    'Faces',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], facesType, {
              'isVariadic': true,
              'description': 'Creates a new Faces object from a combination of Enum.NormalId values.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const axesType: LuauType = { 'kind': 'TypeReference', 'name': 'Axes' };
  globals.set(
    'Axes',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], axesType, {
              'isVariadic': true,
              'description': 'Creates a new Axes object from a combination of Enum.Axis or Enum.NormalId values.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const pathWaypointType: LuauType = { 'kind': 'TypeReference', 'name': 'PathWaypoint' };
  globals.set(
    'PathWaypoint',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'position', 'type': vector3Type, 'optional': false },
                { 'name': 'action', 'type': AnyType, 'optional': true },
                { 'name': 'label', 'type': StringType, 'optional': true },
              ],
              pathWaypointType,
              { 'description': 'Creates a new PathWaypoint at the given position with optional action and label.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const numberSequenceKeypointType: LuauType = { 'kind': 'TypeReference', 'name': 'NumberSequenceKeypoint' };
  globals.set(
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
              numberSequenceKeypointType,
              {
                'description':
                  'Creates a new NumberSequenceKeypoint at the given time with a value and optional envelope.',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const colorSequenceKeypointType: LuauType = { 'kind': 'TypeReference', 'name': 'ColorSequenceKeypoint' };
  globals.set(
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
              colorSequenceKeypointType,
              { 'description': 'Creates a new ColorSequenceKeypoint at the given time with the given color.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

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
          'type': createFunctionType([], NumberType, { 'description': 'Returns the camera Y invert value.' }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'GetOnboardingCompleted',
        {
          'type': createFunctionType([{ 'name': 'onboardingId', 'type': StringType, 'optional': false }], BooleanType, {
            'description': 'Returns whether the specified onboarding has been completed.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'InFullScreen',
        {
          'type': createFunctionType([], BooleanType, {
            'description': 'Returns whether the game is currently in full screen mode.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'InStudioMode',
        {
          'type': createFunctionType([], BooleanType, {
            'description': 'Returns whether the game is running in Roblox Studio.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetCameraYInvertVisible',
        {
          'type': createFunctionType([], NilType, {
            'description': 'Makes the camera Y invert option visible in the game settings menu.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetGamepadCameraSensitivityVisible',
        {
          'type': createFunctionType([], NilType, {
            'description': 'Makes the gamepad camera sensitivity option visible in the game settings menu.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetOnboardingCompleted',
        {
          'type': createFunctionType([{ 'name': 'onboardingId', 'type': StringType, 'optional': false }], NilType, {
            'description': 'Marks the specified onboarding as completed.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

  const userSettingsType: LuauType = createTableType(
    new Map([
      [
        'GetService',
        {
          'type': createFunctionType(
            [{ 'name': 'serviceName', 'type': StringType, 'optional': false }],
            userGameSettingsType,
            { 'description': 'Returns the specified service from UserSettings.' },
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'IsUserFeatureEnabled',
        {
          'type': createFunctionType([{ 'name': 'feature', 'type': StringType, 'optional': false }], BooleanType, {
            'description': 'Returns whether the specified user feature is enabled.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

  globals.set(
    'UserSettings',
    createFunctionType([], userSettingsType, {
      'description': 'Returns the UserSettings object for accessing user game settings.',
    }),
  );

  const nativeVectorType: LuauType = { 'kind': 'Primitive', 'name': 'vector' };
  globals.set(
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
              nativeVectorType,
              { 'description': 'Creates a new native vector with x, y, z components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'magnitude',
          {
            'type': createFunctionType([{ 'name': 'v', 'type': nativeVectorType, 'optional': false }], NumberType, {
              'description': 'Returns the magnitude (length) of the vector.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'normalize',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': nativeVectorType, 'optional': false }],
              nativeVectorType,
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
                { 'name': 'a', 'type': nativeVectorType, 'optional': false },
                { 'name': 'b', 'type': nativeVectorType, 'optional': false },
              ],
              nativeVectorType,
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
                { 'name': 'a', 'type': nativeVectorType, 'optional': false },
                { 'name': 'b', 'type': nativeVectorType, 'optional': false },
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
              [{ 'name': 'v', 'type': nativeVectorType, 'optional': false }],
              nativeVectorType,
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
              [{ 'name': 'v', 'type': nativeVectorType, 'optional': false }],
              nativeVectorType,
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
              [{ 'name': 'v', 'type': nativeVectorType, 'optional': false }],
              nativeVectorType,
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
              [{ 'name': 'v', 'type': nativeVectorType, 'optional': false }],
              nativeVectorType,
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
                { 'name': 'v', 'type': nativeVectorType, 'optional': false },
                { 'name': 'min', 'type': nativeVectorType, 'optional': false },
                { 'name': 'max', 'type': nativeVectorType, 'optional': false },
              ],
              nativeVectorType,
              { 'description': 'Returns a vector with each component clamped between min and max.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'max',
          {
            'type': createFunctionType([], nativeVectorType, {
              'isVariadic': true,
              'description': 'Returns the component-wise maximum of the given vectors.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'min',
          {
            'type': createFunctionType([], nativeVectorType, {
              'isVariadic': true,
              'description': 'Returns the component-wise minimum of the given vectors.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        ['zero', { 'type': nativeVectorType, 'readonly': true, 'optional': false }],
        ['one', { 'type': nativeVectorType, 'readonly': true, 'optional': false }],
      ]),
    ),
  );

  const directGlobalServices = [
    'Players',
    'Workspace',
    'Lighting',
    'ReplicatedFirst',
    'ReplicatedStorage',
    'ServerScriptService',
    'ServerStorage',
    'StarterGui',
    'StarterPack',
    'StarterPlayer',
    'Teams',
    'SoundService',
    'Chat',
    'RunService',
    'UserInputService',
    'TweenService',
    'Debris',
    'HttpService',
    'CollectionService',
    'DataStoreService',
    'TeleportService',
  ];

  for (const serviceName of directGlobalServices) {
    const serviceClass = classes.get(serviceName);
    if (serviceClass !== undefined) globals.set(serviceName, serviceClass);
  }

  const enumNamespace = new Map<string, { type: LuauType; readonly: boolean; optional: boolean }>();
  for (const [name, enumType] of enums)
    enumNamespace.set(name, { 'type': enumType, 'readonly': true, 'optional': false });
  globals.set('Enum', createTableType(enumNamespace));

  return globals;
};

/** Builds the complete global environment by combining Roblox, standard library, and executor API definitions. */
export const buildGlobalEnvironment = (defs?: LoadedDefinitions): GlobalEnvironment => {
  const loadedDefs = defs ?? loadDefinitions();
  const env = createTypeEnvironment();

  let robloxClasses = new Map<string, LuauType>();
  let robloxEnums = new Map<string, LuauType>();
  let robloxDataTypes = new Map<string, LuauType>();

  if (loadedDefs.roblox !== undefined) {
    const converted = convertRobloxApiToTypes(loadedDefs.roblox);
    robloxClasses = converted.classes;
    robloxEnums = converted.enums;
    robloxDataTypes = converted.dataTypes;

    for (const [name, classType] of robloxClasses)
      if (classType.kind === 'Class') (env.classes as Map<string, LuauType>).set(name, classType);

    const robloxGlobals = createRobloxGlobals(robloxClasses, robloxEnums);
    for (const [name, type] of robloxGlobals)
      env.globalScope.symbols.set(name, {
        'kind': 'Variable',
        'declarationLocation': undefined,
        'docComment': undefined,
        name,
        type,
        'mutable': false,
      });
  }

  addLuauBuiltins(env);

  const suncApi = loadedDefs.sunc ?? getDefaultSuncApi();
  const suncTypes = convertSuncApiToTypes(suncApi);

  for (const [name, type] of suncTypes.globals)
    env.globalScope.symbols.set(name, {
      'kind': 'Function',
      'declarationLocation': undefined,
      'docComment': undefined,
      name,
      type,
      'mutable': false,
    });

  for (const [name, type] of suncTypes.namespaces) {
    const existing = env.globalScope.symbols.get(name);
    if (existing !== undefined && existing.type.kind === 'Table' && type.kind === 'Table') {
      const existingProps = existing.type.properties as Map<
        string,
        { type: LuauType; readonly: boolean; optional: boolean }
      >;
      for (const [propName, prop] of type.properties) existingProps.set(propName, prop);
    } else
      env.globalScope.symbols.set(name, {
        'kind': 'Variable',
        'declarationLocation': undefined,
        'docComment': undefined,
        name,
        type,
        'mutable': false,
      });
  }

  addLuarmorGlobals(env);
  addLuraphGlobals(env);

  return { env, robloxClasses, robloxEnums, robloxDataTypes };
};

/** Creates a minimal global environment with only standard library and global Luau functions. */
export const createEmptyGlobalEnvironment = (): GlobalEnvironment => {
  const env = createTypeEnvironment();

  const stdLibs = createAllStdLibraries();
  for (const [name, type] of stdLibs)
    env.globalScope.symbols.set(name, {
      'kind': 'Variable',
      'declarationLocation': undefined,
      'docComment': undefined,
      name,
      type,
      'mutable': false,
    });

  const globalFunctions = createGlobalFunctions();
  for (const [name, type] of globalFunctions)
    env.globalScope.symbols.set(name, {
      'kind': 'Function',
      'declarationLocation': undefined,
      'docComment': undefined,
      name,
      type,
      'mutable': false,
    });

  return { env, 'robloxClasses': new Map(), 'robloxEnums': new Map(), 'robloxDataTypes': new Map() };
};
