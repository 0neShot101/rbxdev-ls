/**
 * Global Environment Builder
 *
 * This module combines all API definitions (Roblox, Sunc, standard library) into
 * a complete type environment for the language server. It creates the global scope
 * with all available types, functions, classes, and services.
 */

import { TypeEnvironment, createTypeEnvironment } from '@typings/environment';
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

import { loadDefinitions, type LoadedDefinitions } from './loader';
import { convertRobloxApiToTypes } from './roblox';
import { createAllStdLibraries } from './stdlib';
import { convertSuncApiToTypes, getDefaultSuncApi } from './sunc';

/**
 * Represents the complete global environment for the language server.
 *
 * This interface encapsulates all type information needed for Luau/Roblox
 * code analysis, including the type environment, Roblox class definitions,
 * enum definitions, and data type definitions.
 */
export interface GlobalEnvironment {
  /** The type environment containing the global scope and class registry */
  readonly env: TypeEnvironment;
  /** Map of Roblox class names to their type definitions */
  readonly robloxClasses: Map<string, LuauType>;
  /** Map of Roblox enum names to their type definitions */
  readonly robloxEnums: Map<string, LuauType>;
  /** Map of Roblox data type names (Vector3, CFrame, etc.) to their definitions */
  readonly robloxDataTypes: Map<string, LuauType>;
}

/**
 * Creates the map of global Luau/Roblox functions.
 *
 * This function defines all global functions available in the Luau environment including:
 * - I/O: print, warn, error
 * - Assertions: assert
 * - Type checking: type, typeof
 * - Conversions: tostring, tonumber
 * - Iteration: pairs, ipairs, next, select
 * - Table operations: rawequal, rawget, rawset, rawlen, unpack
 * - Metatables: getmetatable, setmetatable
 * - Error handling: pcall, xpcall
 * - Module loading: require
 * - Memory: collectgarbage, gcinfo, newproxy
 * - Environment: getfenv, setfenv
 * - Timing: tick, time, wait, delay, spawn, elapsedTime
 * - Version: version
 *
 * @returns A Map of function names to their FunctionType definitions
 */
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

/**
 * List of Roblox services that are accessible as game.ServiceName or via GetService.
 *
 * These services are added as properties on the game (DataModel) type to enable
 * direct access patterns like `game.Players` or `game.Workspace`.
 */
const GAME_SERVICES: ReadonlyArray<string> = [
  // Core Services
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

  // Audio/Visual
  'SoundService',
  'Lighting',

  // Communication
  'Chat',
  'TextChatService',
  'VoiceChatService',

  // Localization
  'LocalizationService',

  // Testing
  'TestService',

  // Runtime Services
  'RunService',
  'UserInputService',
  'ContextActionService',
  'GuiService',
  'HapticService',
  'VRService',
  'TouchInputService',

  // Animation
  'TweenService',
  'AnimationClipProvider',
  'KeyframeSequenceProvider',

  // Text/Content
  'TextService',
  'ContentProvider',

  // Navigation
  'PathfindingService',

  // Physics
  'PhysicsService',

  // Instance Management
  'CollectionService',
  'Debris',
  'ChangeHistoryService',
  'Selection',

  // Network/HTTP
  'HttpService',
  'NetworkClient',
  'NetworkServer',

  // Monetization
  'MarketplaceService',
  'GamePassService',
  'BadgeService',

  // Data Persistence
  'DataStoreService',
  'MemoryStoreService',

  // Messaging
  'MessagingService',

  // Social
  'SocialService',
  'FriendService',
  'GroupService',

  // Avatar
  'AvatarEditorService',
  'AvatarImportService',
  'HumanoidDescriptionConverter',

  // Assets
  'AssetService',
  'InsertService',

  // Policy/Safety
  'PolicyService',
  'SafetyService',

  // Interaction
  'ProximityPromptService',

  // Materials
  'MaterialService',

  // Logging/Analytics
  'LogService',
  'AnalyticsService',
  'Stats',
  'ScriptContext',

  // Notifications
  'NotificationService',

  // Teleportation
  'TeleportService',

  // Experience Communication
  'ExperienceNotificationService',

  // Chat/Voice
  'TextChatService',
  'VoiceChatService',

  // Studio Only (still useful for plugins)
  'CoreGui',
  'StarterPlayer',
  'Camera',

  // Input
  'GamepadService',
  'KeyboardService',
  'MouseService',

  // Performance
  'MemoryStoreService',
  'OpenCloudService',
];

/**
 * Creates Roblox-specific global variables and namespaces.
 *
 * This function creates all Roblox-specific globals including:
 * - game: The DataModel with all services as properties
 * - workspace: The Workspace service
 * - script: The current script reference
 * - shared: Shared table for cross-script communication
 * - _G: Global table
 * - _VERSION: Lua version string
 * - Instance: Instance constructor namespace
 * - Data type constructors: Vector3, Vector2, CFrame, Color3, UDim2, etc.
 * - Utility types: TweenInfo, NumberRange, RaycastParams, DateTime, Random, etc.
 * - Enum: Namespace containing all Roblox enums
 * - UserSettings: Function to access user game settings
 * - vector: Native Luau vector library
 * - Direct service references for commonly used services
 *
 * @param classes - Map of Roblox class names to their type definitions
 * @param enums - Map of Roblox enum names to their type definitions
 * @returns A Map of global names to their type definitions
 */
const createRobloxGlobals = (classes: Map<string, LuauType>, enums: Map<string, LuauType>): Map<string, LuauType> => {
  const globals = new Map<string, LuauType>();

  // Create a custom game type that extends DataModel with service properties
  const dataModel = classes.get('DataModel');
  if (dataModel !== undefined && dataModel.kind === 'Class') {
    // Create a new properties map with all DataModel properties plus services
    const gameProperties = new Map(dataModel.properties);

    // Add service properties
    for (const serviceName of GAME_SERVICES) {
      const serviceClass = classes.get(serviceName);
      if (serviceClass !== undefined) {
        gameProperties.set(serviceName, {
          'type': serviceClass,
          'readonly': true,
          'security': 'None',
        });
      }
    }

    // Create the game type with services
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

  // workspace (Workspace)
  const workspace = classes.get('Workspace');
  if (workspace !== undefined) globals.set('workspace', workspace);

  // script (LuaSourceContainer) - use BaseScript for better type info
  const baseScript = classes.get('BaseScript');
  const luaSourceContainer = classes.get('LuaSourceContainer');
  globals.set('script', baseScript ?? luaSourceContainer ?? AnyType);

  // shared table - allows dynamic property access
  globals.set('shared', createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }));

  // _G table - allows dynamic property access
  globals.set('_G', createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }));

  // _VERSION
  globals.set('_VERSION', StringType);

  // Instance namespace
  const instanceClass = classes.get('Instance');
  if (instanceClass !== undefined) {
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
              ),
              'readonly': true,
              'optional': false,
            },
          ],
        ]),
      ),
    );
  }

  // Roblox datatype constructors
  const vector3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };
  const vector2Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector2' };
  const cframeType: LuauType = { 'kind': 'TypeReference', 'name': 'CFrame' };
  const color3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Color3' };
  const udim2Type: LuauType = { 'kind': 'TypeReference', 'name': 'UDim2' };
  const udimType: LuauType = { 'kind': 'TypeReference', 'name': 'UDim' };

  // Vector3
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
            'type': createFunctionType([{ 'name': 'normalId', 'type': AnyType, 'optional': false }], vector3Type),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'FromAxis',
          {
            'type': createFunctionType([{ 'name': 'axis', 'type': AnyType, 'optional': false }], vector3Type),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // Vector2
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

  // CFrame
  globals.set(
    'CFrame',
    createTableType(
      new Map([
        [
          'new',
          { 'type': createFunctionType([], cframeType, { 'isVariadic': true }), 'readonly': true, 'optional': false },
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // Color3
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromHex',
          {
            'type': createFunctionType([{ 'name': 'hex', 'type': StringType, 'optional': false }], color3Type),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // UDim
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // UDim2
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // BrickColor
  const brickColorType: LuauType = { 'kind': 'TypeReference', 'name': 'BrickColor' };
  globals.set(
    'BrickColor',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], brickColorType),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'palette',
          {
            'type': createFunctionType([{ 'name': 'index', 'type': NumberType, 'optional': false }], brickColorType),
            'readonly': true,
            'optional': false,
          },
        ],
        ['random', { 'type': createFunctionType([], brickColorType), 'readonly': true, 'optional': false }],
        ['White', { 'type': createFunctionType([], brickColorType), 'readonly': true, 'optional': false }],
        ['Black', { 'type': createFunctionType([], brickColorType), 'readonly': true, 'optional': false }],
        ['Red', { 'type': createFunctionType([], brickColorType), 'readonly': true, 'optional': false }],
        ['Green', { 'type': createFunctionType([], brickColorType), 'readonly': true, 'optional': false }],
        ['Blue', { 'type': createFunctionType([], brickColorType), 'readonly': true, 'optional': false }],
        ['Yellow', { 'type': createFunctionType([], brickColorType), 'readonly': true, 'optional': false }],
      ]),
    ),
  );

  // TweenInfo
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // NumberRange
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // NumberSequence
  const numberSequenceType: LuauType = { 'kind': 'TypeReference', 'name': 'NumberSequence' };
  globals.set(
    'NumberSequence',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], numberSequenceType),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // ColorSequence
  const colorSequenceType: LuauType = { 'kind': 'TypeReference', 'name': 'ColorSequence' };
  globals.set(
    'ColorSequence',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], colorSequenceType),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // Ray
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // Region3
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // Rect
  const rectType: LuauType = { 'kind': 'TypeReference', 'name': 'Rect' };
  globals.set(
    'Rect',
    createTableType(
      new Map([
        [
          'new',
          { 'type': createFunctionType([], rectType, { 'isVariadic': true }), 'readonly': true, 'optional': false },
        ],
      ]),
    ),
  );

  // RaycastParams
  const raycastParamsType: LuauType = { 'kind': 'TypeReference', 'name': 'RaycastParams' };
  globals.set(
    'RaycastParams',
    createTableType(
      new Map([['new', { 'type': createFunctionType([], raycastParamsType), 'readonly': true, 'optional': false }]]),
    ),
  );

  // OverlapParams
  const overlapParamsType: LuauType = { 'kind': 'TypeReference', 'name': 'OverlapParams' };
  globals.set(
    'OverlapParams',
    createTableType(
      new Map([['new', { 'type': createFunctionType([], overlapParamsType), 'readonly': true, 'optional': false }]]),
    ),
  );

  // DateTime
  const dateTimeType: LuauType = { 'kind': 'TypeReference', 'name': 'DateTime' };
  globals.set(
    'DateTime',
    createTableType(
      new Map([
        ['now', { 'type': createFunctionType([], dateTimeType), 'readonly': true, 'optional': false }],
        [
          'fromUnixTimestamp',
          {
            'type': createFunctionType([{ 'name': 'timestamp', 'type': NumberType, 'optional': false }], dateTimeType),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromUnixTimestampMillis',
          {
            'type': createFunctionType([{ 'name': 'timestamp', 'type': NumberType, 'optional': false }], dateTimeType),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromIsoDate',
          {
            'type': createFunctionType([{ 'name': 'isoDate', 'type': StringType, 'optional': false }], dateTimeType),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromLocalTime',
          {
            'type': createFunctionType([{ 'name': 'dateTime', 'type': AnyType, 'optional': false }], dateTimeType),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromUniversalTime',
          {
            'type': createFunctionType([{ 'name': 'dateTime', 'type': AnyType, 'optional': false }], dateTimeType),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // Random
  const randomType: LuauType = { 'kind': 'TypeReference', 'name': 'Random' };
  globals.set(
    'Random',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'seed', 'type': NumberType, 'optional': true }], randomType),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // PhysicalProperties
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // Vector2int16
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // Vector3int16
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // Region3int16
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // CatalogSearchParams
  const catalogSearchParamsType: LuauType = { 'kind': 'TypeReference', 'name': 'CatalogSearchParams' };
  globals.set(
    'CatalogSearchParams',
    createTableType(
      new Map([
        ['new', { 'type': createFunctionType([], catalogSearchParamsType), 'readonly': true, 'optional': false }],
      ]),
    ),
  );

  // SharedTable
  const sharedTableType: LuauType = { 'kind': 'TypeReference', 'name': 'SharedTable' };
  globals.set(
    'SharedTable',
    createTableType(
      new Map([
        ['new', { 'type': createFunctionType([], sharedTableType), 'readonly': true, 'optional': false }],
        [
          'clone',
          {
            'type': createFunctionType(
              [
                { 'name': 'st', 'type': sharedTableType, 'optional': false },
                { 'name': 'freezeClone', 'type': BooleanType, 'optional': true },
              ],
              sharedTableType,
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'cloneAndFreeze',
          {
            'type': createFunctionType([{ 'name': 'st', 'type': sharedTableType, 'optional': false }], sharedTableType),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'isFrozen',
          {
            'type': createFunctionType([{ 'name': 'st', 'type': sharedTableType, 'optional': false }], BooleanType),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'size',
          {
            'type': createFunctionType([{ 'name': 'st', 'type': sharedTableType, 'optional': false }], NumberType),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'clear',
          {
            'type': createFunctionType([{ 'name': 'st', 'type': sharedTableType, 'optional': false }], NilType),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // DockWidgetPluginGuiInfo (for plugin development)
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // Font
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromEnum',
          {
            'type': createFunctionType([{ 'name': 'font', 'type': AnyType, 'optional': false }], fontType),
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // Faces
  const facesType: LuauType = { 'kind': 'TypeReference', 'name': 'Faces' };
  globals.set(
    'Faces',
    createTableType(
      new Map([
        [
          'new',
          { 'type': createFunctionType([], facesType, { 'isVariadic': true }), 'readonly': true, 'optional': false },
        ],
      ]),
    ),
  );

  // Axes
  const axesType: LuauType = { 'kind': 'TypeReference', 'name': 'Axes' };
  globals.set(
    'Axes',
    createTableType(
      new Map([
        [
          'new',
          { 'type': createFunctionType([], axesType, { 'isVariadic': true }), 'readonly': true, 'optional': false },
        ],
      ]),
    ),
  );

  // PathWaypoint
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // NumberSequenceKeypoint
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // ColorSequenceKeypoint
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  // UserGameSettings - returned by UserSettings():GetService("UserGameSettings")
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
          'type': createFunctionType([], NumberType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'GetOnboardingCompleted',
        {
          'type': createFunctionType([{ 'name': 'onboardingId', 'type': StringType, 'optional': false }], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'InFullScreen',
        {
          'type': createFunctionType([], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'InStudioMode',
        {
          'type': createFunctionType([], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetCameraYInvertVisible',
        {
          'type': createFunctionType([], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetGamepadCameraSensitivityVisible',
        {
          'type': createFunctionType([], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetOnboardingCompleted',
        {
          'type': createFunctionType([{ 'name': 'onboardingId', 'type': StringType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

  // UserSettings type - returned by UserSettings() global function
  const userSettingsType: LuauType = createTableType(
    new Map([
      [
        'GetService',
        {
          'type': createFunctionType(
            [{ 'name': 'serviceName', 'type': StringType, 'optional': false }],
            userGameSettingsType,
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'IsUserFeatureEnabled',
        {
          'type': createFunctionType([{ 'name': 'feature', 'type': StringType, 'optional': false }], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

  // UserSettings() global function
  globals.set('UserSettings', createFunctionType([], userSettingsType));

  // Native vector library (Luau built-in, lowercase)
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'magnitude',
          {
            'type': createFunctionType([{ 'name': 'v', 'type': nativeVectorType, 'optional': false }], NumberType),
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
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'max',
          {
            'type': createFunctionType([], nativeVectorType, { 'isVariadic': true }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'min',
          {
            'type': createFunctionType([], nativeVectorType, { 'isVariadic': true }),
            'readonly': true,
            'optional': false,
          },
        ],
        ['zero', { 'type': nativeVectorType, 'readonly': true, 'optional': false }],
        ['one', { 'type': nativeVectorType, 'readonly': true, 'optional': false }],
      ]),
    ),
  );

  // Add commonly used services as direct globals (for convenience)
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
    if (serviceClass !== undefined) {
      globals.set(serviceName, serviceClass);
    }
  }

  // Enum namespace
  const enumNamespace = new Map<string, { type: LuauType; readonly: boolean; optional: boolean }>();
  for (const [name, enumType] of enums) {
    enumNamespace.set(name, { 'type': enumType, 'readonly': true, 'optional': false });
  }
  globals.set('Enum', createTableType(enumNamespace));

  return globals;
};

/**
 * Builds the complete global environment from loaded definitions.
 *
 * This function orchestrates the creation of the entire type environment by:
 * 1. Loading Roblox API definitions (classes, enums, data types)
 * 2. Populating the class registry with Roblox classes
 * 3. Adding Roblox-specific globals (game, workspace, constructors, etc.)
 * 4. Loading standard library definitions (math, string, table, etc.)
 * 5. Loading global Luau functions (print, require, pcall, etc.)
 * 6. Loading Sunc/executor API definitions
 * 7. Merging namespaces where appropriate (e.g., debug)
 *
 * @param defs - Optional pre-loaded definitions. If not provided, definitions are loaded from files.
 * @returns The complete GlobalEnvironment with all type information
 */
export const buildGlobalEnvironment = (defs?: LoadedDefinitions): GlobalEnvironment => {
  const loadedDefs = defs ?? loadDefinitions();
  const env = createTypeEnvironment();

  let robloxClasses = new Map<string, LuauType>();
  let robloxEnums = new Map<string, LuauType>();
  let robloxDataTypes = new Map<string, LuauType>();

  // Load Roblox API if available
  if (loadedDefs.roblox !== undefined) {
    const converted = convertRobloxApiToTypes(loadedDefs.roblox);
    robloxClasses = converted.classes;
    robloxEnums = converted.enums;
    robloxDataTypes = converted.dataTypes;

    // Populate env.classes with Roblox classes for TypeReference resolution
    for (const [name, classType] of robloxClasses) {
      if (classType.kind === 'Class') {
        (env.classes as Map<string, LuauType>).set(name, classType);
      }
    }

    // Add Roblox globals
    const robloxGlobals = createRobloxGlobals(robloxClasses, robloxEnums);
    for (const [name, type] of robloxGlobals) {
      env.globalScope.symbols.set(name, {
        'kind': 'Variable',
        'declarationLocation': undefined,
        'docComment': undefined,
        name,
        type,
        'mutable': false,
      });
    }
  }

  // Load standard library
  const stdLibs = createAllStdLibraries();
  for (const [name, type] of stdLibs) {
    env.globalScope.symbols.set(name, {
      'kind': 'Variable',
      'declarationLocation': undefined,
      'docComment': undefined,
      name,
      type,
      'mutable': false,
    });
  }

  // Load global functions
  const globalFunctions = createGlobalFunctions();
  for (const [name, type] of globalFunctions) {
    env.globalScope.symbols.set(name, {
      'kind': 'Function',
      'declarationLocation': undefined,
      'docComment': undefined,
      name,
      type,
      'mutable': false,
    });
  }

  // Load Sunc API
  const suncApi = loadedDefs.sunc ?? getDefaultSuncApi();
  const suncTypes = convertSuncApiToTypes(suncApi);

  for (const [name, type] of suncTypes.globals) {
    env.globalScope.symbols.set(name, {
      'kind': 'Function',
      'declarationLocation': undefined,
      'docComment': undefined,
      name,
      type,
      'mutable': false,
    });
  }

  for (const [name, type] of suncTypes.namespaces) {
    // Merge with existing namespace if present (like debug)
    const existing = env.globalScope.symbols.get(name);
    if (existing !== undefined && existing.type.kind === 'Table' && type.kind === 'Table') {
      // Merge properties - cast to mutable Map since we know the underlying structure is mutable
      const existingProps = existing.type.properties as Map<
        string,
        { type: LuauType; readonly: boolean; optional: boolean }
      >;
      for (const [propName, prop] of type.properties) {
        existingProps.set(propName, prop);
      }
    } else {
      env.globalScope.symbols.set(name, {
        'kind': 'Variable',
        'declarationLocation': undefined,
        'docComment': undefined,
        name,
        type,
        'mutable': false,
      });
    }
  }

  return { env, robloxClasses, robloxEnums, robloxDataTypes };
};

/**
 * Creates a minimal global environment without Roblox-specific types.
 *
 * This function creates a basic Luau environment containing only:
 * - Standard library definitions (math, string, table, etc.)
 * - Global Luau functions (print, require, pcall, etc.)
 *
 * This is useful for pure Luau analysis without Roblox-specific features
 * or when the Roblox API dump is not available.
 *
 * @returns A minimal GlobalEnvironment with empty Roblox type maps
 */
export const createEmptyGlobalEnvironment = (): GlobalEnvironment => {
  const env = createTypeEnvironment();

  // Load standard library
  const stdLibs = createAllStdLibraries();
  for (const [name, type] of stdLibs) {
    env.globalScope.symbols.set(name, {
      'kind': 'Variable',
      'declarationLocation': undefined,
      'docComment': undefined,
      name,
      type,
      'mutable': false,
    });
  }

  // Load global functions
  const globalFunctions = createGlobalFunctions();
  for (const [name, type] of globalFunctions) {
    env.globalScope.symbols.set(name, {
      'kind': 'Function',
      'declarationLocation': undefined,
      'docComment': undefined,
      name,
      type,
      'mutable': false,
    });
  }

  return { env, 'robloxClasses': new Map(), 'robloxEnums': new Map(), 'robloxDataTypes': new Map() };
};
