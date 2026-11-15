import { AnyType, StringType, createFunctionType, createTableType } from '@analyzer/values';

import type { LuauType } from '@typings/types';

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

/** Installs game, workspace, script, plugin, the Instance and Enum namespaces and direct service aliases, using AnyType when the relevant API data is unavailable. */
export const installRoots = (
  globals: Map<string, LuauType>,
  classes: ReadonlyMap<string, LuauType>,
  enums: ReadonlyMap<string, LuauType>,
): void => {
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
  } else globals.set('game', AnyType);

  const workspace = classes.get('Workspace');
  globals.set('workspace', workspace ?? AnyType);

  const baseScript = classes.get('BaseScript');
  const luaSourceContainer = classes.get('LuaSourceContainer');
  globals.set('script', baseScript ?? luaSourceContainer ?? AnyType);

  globals.set('plugin', AnyType);

  const instanceClass = classes.get('Instance');
  if (instanceClass === undefined) globals.set('Instance', AnyType);
  else
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

  if (enums.size === 0) globals.set('Enum', AnyType);
  else {
    const enumNamespace = new Map<string, { type: LuauType; readonly: boolean; optional: boolean }>();
    for (const [name, enumType] of enums)
      enumNamespace.set(name, { 'type': enumType, 'readonly': true, 'optional': false });
    globals.set('Enum', createTableType(enumNamespace));
  }
};
