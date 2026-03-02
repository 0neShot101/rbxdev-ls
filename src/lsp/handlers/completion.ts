import * as path from 'path';

import { COMMON_CHILDREN, getCommonChildType } from '@definitions/commonChildren';
import type { ExecutorBridge, LiveGameModel } from '@typings/bridge';
import { formatDocCommentForDisplay } from '@parser/docComment';
import {
  AnyType,
  ClassType,
  createFunctionType,
  createTableType,
  FunctionType,
  LuauType,
  TableType,
  typeToString,
  type PropertyType,
} from '@typings/types';
import { generateRequirePath, listModuleFiles, resolveLocalModule } from '@workspace/moduleIndex';
import { getDataModelPath } from '@workspace/rojo';
import {
  CompletionItemKind,
  CompletionItemTag,
  InsertTextFormat,
  MarkupKind,
  Position,
  TextEdit,
} from 'vscode-languageserver';

import type { ModuleReference } from '@typings/protocol';
import type { TableContextInfo } from '@typings/handlers';
import type { DocumentManager, ParsedDocument } from '@typings/lsp';
import type { ModuleFileEntry, ModuleInfo } from '@typings/workspace';
import type { DocComment } from '@typings/parser';
import type {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Connection,
  TextDocuments,
} from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

const VARIABLE_NAME_HINTS: ReadonlyMap<string, string> = new Map([
  ['player', 'Player'],
  ['plr', 'Player'],
  ['localPlayer', 'Player'],
  ['lp', 'Player'],
  ['localplayer', 'Player'],
  ['character', 'Model'],
  ['char', 'Model'],
  ['model', 'Model'],
  ['mdl', 'Model'],
  ['humanoid', 'Humanoid'],
  ['hum', 'Humanoid'],
  ['h', 'Humanoid'],
  ['part', 'BasePart'],
  ['basePart', 'BasePart'],
  ['meshPart', 'MeshPart'],
  ['unionOperation', 'UnionOperation'],
  ['head', 'BasePart'],
  ['torso', 'BasePart'],
  ['hrp', 'BasePart'],
  ['humanoidRootPart', 'BasePart'],
  ['rootPart', 'BasePart'],
  ['camera', 'Camera'],
  ['cam', 'Camera'],
  ['currentCamera', 'Camera'],
  ['gui', 'ScreenGui'],
  ['screenGui', 'ScreenGui'],
  ['surfaceGui', 'SurfaceGui'],
  ['billboardGui', 'BillboardGui'],
  ['frame', 'Frame'],
  ['button', 'TextButton'],
  ['textButton', 'TextButton'],
  ['imageButton', 'ImageButton'],
  ['label', 'TextLabel'],
  ['textLabel', 'TextLabel'],
  ['imageLabel', 'ImageLabel'],
  ['textBox', 'TextBox'],
  ['scrollingFrame', 'ScrollingFrame'],
  ['viewportFrame', 'ViewportFrame'],
  ['sound', 'Sound'],
  ['music', 'Sound'],
  ['sfx', 'Sound'],
  ['animation', 'Animation'],
  ['anim', 'Animation'],
  ['animator', 'Animator'],
  ['animationTrack', 'AnimationTrack'],
  ['track', 'AnimationTrack'],
  ['tool', 'Tool'],
  ['accessory', 'Accessory'],
  ['folder', 'Folder'],
  ['configuration', 'Configuration'],
  ['remote', 'RemoteEvent'],
  ['remoteEvent', 'RemoteEvent'],
  ['remoteFunction', 'RemoteFunction'],
  ['bindable', 'BindableEvent'],
  ['bindableEvent', 'BindableEvent'],
  ['bindableFunction', 'BindableFunction'],
  ['connection', 'RBXScriptConnection'],
  ['conn', 'RBXScriptConnection'],
  ['signal', 'RBXScriptSignal'],
  ['tween', 'Tween'],
  ['tweenInfo', 'TweenInfo'],
  ['value', 'ValueBase'],
  ['boolValue', 'BoolValue'],
  ['intValue', 'IntValue'],
  ['numberValue', 'NumberValue'],
  ['stringValue', 'StringValue'],
  ['objectValue', 'ObjectValue'],
  ['attachment', 'Attachment'],
  ['constraint', 'Constraint'],
  ['weld', 'WeldConstraint'],
  ['motor', 'Motor6D'],
  ['light', 'Light'],
  ['pointLight', 'PointLight'],
  ['spotLight', 'SpotLight'],
  ['surfaceLight', 'SurfaceLight'],
  ['beam', 'Beam'],
  ['trail', 'Trail'],
  ['particle', 'ParticleEmitter'],
  ['particles', 'ParticleEmitter'],
  ['highlight', 'Highlight'],
  ['instance', 'Instance'],
  ['child', 'Instance'],
  ['parent', 'Instance'],
  ['descendant', 'Instance'],
  ['ancestor', 'Instance'],
  ['clone', 'Instance'],
]);

const ROBLOX_SERVICES = [
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
  'LocalizationService',
  'TestService',
  'RunService',
  'UserInputService',
  'ContextActionService',
  'GuiService',
  'HapticService',
  'VRService',
  'TweenService',
  'TextService',
  'PathfindingService',
  'PhysicsService',
  'CollectionService',
  'Debris',
  'HttpService',
  'MarketplaceService',
  'InsertService',
  'GamePassService',
  'BadgeService',
  'AssetService',
  'DataStoreService',
  'MemoryStoreService',
  'MessagingService',
  'TeleportService',
  'SocialService',
  'PolicyService',
  'LocalizationService',
  'LogService',
  'AnalyticsService',
  'ProximityPromptService',
  'MaterialService',
  'AvatarEditorService',
  'AnimationClipProvider',
  'KeyframeSequenceProvider',
  'ContentProvider',
  'GroupService',
  'FriendService',
  'NotificationService',
  'ScriptContext',
  'Stats',
  'UserGameSettings',
  'VirtualInputManager',
  'NetworkClient',
  'NetworkServer',
];

const CREATABLE_CLASSES = [
  'Part',
  'WedgePart',
  'CornerWedgePart',
  'TrussPart',
  'MeshPart',
  'SpawnLocation',
  'Seat',
  'VehicleSeat',
  'SkateboardPlatform',
  'UnionOperation',
  'NegateOperation',
  'IntersectOperation',
  'PartOperation',
  'PartOperationAsset',
  'OperationGraph',
  'Model',
  'Actor',
  'WorldModel',
  'BoolValue',
  'IntValue',
  'NumberValue',
  'StringValue',
  'ObjectValue',
  'CFrameValue',
  'Vector3Value',
  'Color3Value',
  'BrickColorValue',
  'RayValue',
  'BinaryStringValue',
  'DoubleConstrainedValue',
  'IntConstrainedValue',
  'WeldConstraint',
  'RigidConstraint',
  'HingeConstraint',
  'PrismaticConstraint',
  'CylindricalConstraint',
  'BallSocketConstraint',
  'RopeConstraint',
  'RodConstraint',
  'SpringConstraint',
  'TorsionSpringConstraint',
  'UniversalConstraint',
  'AlignOrientation',
  'AlignPosition',
  'AngularVelocity',
  'LinearVelocity',
  'VectorForce',
  'Torque',
  'LineForce',
  'Plane',
  'PlaneConstraint',
  'NoCollisionConstraint',
  'AnimationConstraint',
  'Weld',
  'Snap',
  'Glue',
  'Motor',
  'Motor6D',
  'Rotate',
  'RotateP',
  'RotateV',
  'VelocityMotor',
  'ManualGlue',
  'ManualWeld',
  'ScreenGui',
  'SurfaceGui',
  'BillboardGui',
  'AdGui',
  'GuiMain',
  'RelativeGui',
  'Frame',
  'TextLabel',
  'TextButton',
  'TextBox',
  'ImageLabel',
  'ImageButton',
  'ScrollingFrame',
  'ViewportFrame',
  'CanvasGroup',
  'VideoFrame',
  'Path2D',
  'UIListLayout',
  'UIGridLayout',
  'UITableLayout',
  'UIPageLayout',
  'UIPadding',
  'UIScale',
  'UIAspectRatioConstraint',
  'UISizeConstraint',
  'UITextSizeConstraint',
  'UICorner',
  'UIStroke',
  'UIGradient',
  'UIFlexItem',
  'UIDragDetector',
  'ParticleEmitter',
  'Fire',
  'Smoke',
  'Sparkles',
  'Explosion',
  'PointLight',
  'SpotLight',
  'SurfaceLight',
  'Beam',
  'Trail',
  'Highlight',
  'BloomEffect',
  'BlurEffect',
  'ColorCorrectionEffect',
  'ColorGradingEffect',
  'DepthOfFieldEffect',
  'SunRaysEffect',
  'Atmosphere',
  'Clouds',
  'Sky',
  'SelectionBox',
  'SelectionSphere',
  'SelectionPartLasso',
  'SelectionPointLasso',
  'SurfaceSelection',
  'BoxHandleAdornment',
  'ConeHandleAdornment',
  'CylinderHandleAdornment',
  'ImageHandleAdornment',
  'LineHandleAdornment',
  'SphereHandleAdornment',
  'PyramidHandleAdornment',
  'WireframeHandleAdornment',
  'ParabolaAdornment',
  'Handles',
  'ArcHandles',
  'Sound',
  'SoundGroup',
  'ChorusSoundEffect',
  'CompressorSoundEffect',
  'DistortionSoundEffect',
  'EchoSoundEffect',
  'EqualizerSoundEffect',
  'FlangeSoundEffect',
  'PitchShiftSoundEffect',
  'ReverbSoundEffect',
  'TremoloSoundEffect',
  'AudioAnalyzer',
  'AudioChannelMixer',
  'AudioChannelSplitter',
  'AudioChorus',
  'AudioCompressor',
  'AudioDeviceInput',
  'AudioDeviceOutput',
  'AudioDistortion',
  'AudioEcho',
  'AudioEmitter',
  'AudioEqualizer',
  'AudioFader',
  'AudioFilter',
  'AudioFlanger',
  'AudioGate',
  'AudioLimiter',
  'AudioListener',
  'AudioPitchShifter',
  'AudioPlayer',
  'AudioRecorder',
  'AudioReverb',
  'AudioSearchParams',
  'AudioSpeechToText',
  'AudioTextToSpeech',
  'AudioTremolo',
  'VideoDeviceInput',
  'VideoDisplay',
  'VideoPlayer',
  'Script',
  'LocalScript',
  'ModuleScript',
  'AuroraScript',
  'RemoteEvent',
  'RemoteFunction',
  'BindableEvent',
  'BindableFunction',
  'UnreliableRemoteEvent',
  'Animation',
  'AnimationController',
  'Animator',
  'Keyframe',
  'KeyframeMarker',
  'KeyframeSequence',
  'Pose',
  'NumberPose',
  'CurveAnimation',
  'FloatCurve',
  'EulerRotationCurve',
  'RotationCurve',
  'Vector3Curve',
  'ValueCurve',
  'CompositeValueCurve',
  'MarkerCurve',
  'AnimationRigData',
  'AnimationGraphDefinition',
  'AnimationNodeDefinition',
  'TrackerStreamAnimation',
  'RTAnimationTracker',
  'Humanoid',
  'HumanoidDescription',
  'HumanoidRigDescription',
  'HandRigDescription',
  'BodyPartDescription',
  'AccessoryDescription',
  'MakeupDescription',
  'Shirt',
  'Pants',
  'ShirtGraphic',
  'CharacterMesh',
  'BodyColors',
  'Accessory',
  'Accoutrement',
  'Hat',
  'Skin',
  'FaceControls',
  'AvatarRules',
  'AvatarAccessoryRules',
  'AvatarAnimationRules',
  'AvatarBodyRules',
  'AvatarClothingRules',
  'AvatarCollisionRules',
  'BodyForce',
  'BodyVelocity',
  'BodyPosition',
  'BodyGyro',
  'BodyAngularVelocity',
  'BodyThrust',
  'RocketPropulsion',
  'ControllerManager',
  'ControllerPartSensor',
  'AirController',
  'ClimbController',
  'GroundController',
  'SwimController',
  'HumanoidController',
  'VehicleController',
  'SkateboardController',
  'IKControl',
  'WrapDeformer',
  'WrapLayer',
  'WrapTarget',
  'WrapTextureTransfer',
  'Tool',
  'HopperBin',
  'Flag',
  'FlagStand',
  'Backpack',
  'StarterGear',
  'Camera',
  'Folder',
  'Configuration',
  'Attachment',
  'Bone',
  'ForceField',
  'AtmosphereSensor',
  'BuoyancySensor',
  'FluidForceSensor',
  'ClickDetector',
  'DragDetector',
  'ProximityPrompt',
  'Dialog',
  'DialogChoice',
  'Decal',
  'Texture',
  'SurfaceAppearance',
  'MaterialVariant',
  'TerrainDetail',
  'TerrainRegion',
  'SpecialMesh',
  'BlockMesh',
  'CylinderMesh',
  'FileMesh',
  'DataStoreOptions',
  'DataStoreSetOptions',
  'DataStoreIncrementOptions',
  'DataStoreGetOptions',
  'TextChannel',
  'TextChatCommand',
  'TextChatMessageProperties',
  'BubbleChatMessageProperties',
  'TextGenerator',
  'GetTextBoundsParams',
  'LocalizationTable',
  'Message',
  'Hint',
  'FloorWire',
  'Team',
  'Player',
  'TeleportOptions',
  'ExperienceInviteOptions',
  'PathfindingLink',
  'PathfindingModifier',
  'Tween',
  'InputAction',
  'InputBinding',
  'InputContext',
  'HapticEffect',
  'StyleSheet',
  'StyleRule',
  'StyleLink',
  'StyleDerive',
  'StyleQuery',
  'Annotation',
  'WorkspaceAnnotation',
  'Wire',
  'Noise',
  'TestService',
  'ProximityPromptService',
  'MemoryStoreService',
  'FlyweightService',
  'CSGDictionaryService',
  'NonReplicatedCSGDictionaryService',
  'HeightmapImporterService',
  'PluginAction',
  'PluginCapabilities',
  'Dragger',
  'AdvancedDragger',
  'StandalonePluginScripts',
  'StudioAttachment',
  'StudioCallout',
  'ExplorerFilter',
  'VisualizationMode',
  'VisualizationModeCategory',
  'VirtualInputManager',
  'Breakpoint',
  'DebuggerWatch',
  'ReflectionMetadata',
  'ReflectionMetadataCallbacks',
  'ReflectionMetadataClass',
  'ReflectionMetadataClasses',
  'ReflectionMetadataEnum',
  'ReflectionMetadataEnumItem',
  'ReflectionMetadataEnums',
  'ReflectionMetadataEvents',
  'ReflectionMetadataFunctions',
  'ReflectionMetadataMember',
  'ReflectionMetadataProperties',
  'ReflectionMetadataYieldFunctions',
  'FunctionalTest',
  'RenderingTest',
  'CustomEvent',
  'CustomEventReceiver',
  'CustomLog',
  'InternalSyncItem',
  'AdPortal',
  'HiddenSurfaceRemovalAsset',
  'MotorFeature',
  'Hole',
];

const typeToCompletionKind = (type: LuauType): CompletionItemKind => {
  switch (type.kind) {
    case 'Function':
      return CompletionItemKind.Function;
    case 'Class':
      return CompletionItemKind.Class;
    case 'Enum':
      return CompletionItemKind.Enum;
    case 'Table':
      return CompletionItemKind.Module;
    default:
      return CompletionItemKind.Variable;
  }
};

const formatFunctionDetail = (func: FunctionType): string => {
  const params = func.params.map(p => {
    const name = p.name ?? 'arg';
    const optional = p.optional ? '?' : '';
    return `${name}${optional}`;
  });
  return `(${params.join(', ')})`;
};

const escapeSnippet = (text: string): string => text.replace(/[$}\\]/g, '\\$&');

const formatFunctionSnippet = (name: string, func: FunctionType): string => {
  if (func.params.length === 0) return `${name}()$0`;

  let tabIndex = 1;
  let hasCallback = false;
  const paramSnippets: string[] = [];

  for (const p of func.params) {
    if (p.type.kind === 'Function' && hasCallback === false) {
      hasCallback = true;
      const innerFunc = p.type;
      if (innerFunc.params.length === 0) {
        paramSnippets.push(`function()\n\t$0\nend`);
      } else {
        const innerParams = innerFunc.params.map(ip => {
          const pName = escapeSnippet(ip.name ?? 'arg');
          return `\${${tabIndex++}:${pName}}`;
        });
        paramSnippets.push(`function(${innerParams.join(', ')})\n\t$0\nend`);
      }
    } else {
      const paramName = escapeSnippet(p.name ?? 'arg');
      paramSnippets.push(`\${${tabIndex++}:${paramName}}`);
    }
  }

  return `${name}(${paramSnippets.join(', ')})`;
};

const formatDocumentation = (docComment: DocComment | undefined): { kind: 'markdown'; value: string } | undefined => {
  if (docComment === undefined) return undefined;

  const formatted = formatDocCommentForDisplay(docComment);
  if (formatted.length === 0) return undefined;

  return {
    'kind': MarkupKind.Markdown,
    'value': formatted,
  };
};

const getTableCompletions = (table: TableType, prefix: string): CompletionItem[] => {
  const items: CompletionItem[] = [];

  for (const [name, prop] of table.properties) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const item: CompletionItem = {
      'label': name,
      'kind': typeToCompletionKind(prop.type),
    };

    if (prop.type.kind === 'Function') {
      item.detail = formatFunctionDetail(prop.type);
      item.insertText = formatFunctionSnippet(name, prop.type);
      item.insertTextFormat = InsertTextFormat.Snippet;
    }

    if (prop.deprecated === true) {
      item.tags = [CompletionItemTag.Deprecated];
      if (prop.deprecationMessage !== undefined) {
        item.detail = `(deprecated) ${prop.deprecationMessage}`;
      } else {
        item.detail = '(deprecated)';
      }
    }

    items.push(item);
  }

  return items;
};

const getTableFieldCompletions = (
  expectedType: TableType,
  existingFields: Set<string>,
  prefix: string,
): CompletionItem[] => {
  const items: CompletionItem[] = [];

  for (const [name, prop] of expectedType.properties) {
    if (existingFields.has(name)) continue;
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const isOptional = prop.optional;
    const typeStr = typeToString(prop.type);

    const item: CompletionItem = {
      'label': name,
      'kind': CompletionItemKind.Field,
      'detail': `${typeStr}${isOptional ? ' (optional)' : ''}`,
      'insertText': `${name} = `,
      'sortText': isOptional ? `1_${name}` : `0_${name}`,
    };

    items.push(item);
  }

  return items;
};

const detectTableFieldContext = (beforeCursor: string): TableContextInfo | undefined => {
  let braceDepth = 0;
  let tableStartPos = -1;

  for (let i = beforeCursor.length - 1; i >= 0; i--) {
    const char = beforeCursor[i];
    if (char === '}') {
      braceDepth++;
    } else if (char === '{') {
      if (braceDepth === 0) {
        tableStartPos = i;
        break;
      }
      braceDepth--;
    }
  }

  if (tableStartPos === -1) return undefined;

  const beforeTable = beforeCursor.slice(0, tableStartPos).trimEnd();

  const funcCallMatch = beforeTable.match(/([a-zA-Z_]\w*(?:\s*[.:]\s*[a-zA-Z_]\w*)*)\s*\(\s*$/);
  if (funcCallMatch === null) return undefined;

  const functionExpression = funcCallMatch[1];
  if (functionExpression === undefined) return undefined;

  const funcNameMatch = functionExpression.match(/([a-zA-Z_]\w*)$/);
  const functionName = funcNameMatch?.[1] ?? functionExpression;

  const paramIndex = 0;

  const insideTable = beforeCursor.slice(tableStartPos + 1);
  const existingFields = parseExistingTableFields(insideTable);

  const prefixMatch = insideTable.match(/(?:,|\{)\s*([a-zA-Z_]\w*)$/);
  let prefix = prefixMatch?.[1] ?? '';

  if (prefix === '') {
    const trimmed = insideTable.trimStart();
    const startMatch = trimmed.match(/^([a-zA-Z_]\w*)$/);
    if (startMatch !== null) prefix = startMatch[1] ?? '';
  }

  return {
    functionName,
    paramIndex,
    existingFields,
    prefix,
  };
};

const parseExistingTableFields = (tableContent: string): Set<string> => {
  const fields = new Set<string>();

  const fieldPattern = /([a-zA-Z_]\w*)\s*=/g;
  let match;

  while ((match = fieldPattern.exec(tableContent)) !== null) {
    if (match[1] !== undefined) fields.add(match[1]);
  }

  return fields;
};

const getExpectedParameterType = (
  functionName: string,
  paramIndex: number,
  documentManager: DocumentManager,
): TableType | undefined => {
  const symbol = documentManager.globalEnv.env.globalScope.symbols.get(functionName);
  if (symbol === undefined) return undefined;
  if (symbol.type.kind !== 'Function') return undefined;

  const funcType = symbol.type;
  if (paramIndex >= funcType.params.length) return undefined;

  const param = funcType.params[paramIndex];
  if (param === undefined) return undefined;

  if (param.type.kind === 'Table') return param.type;

  return undefined;
};

const getCommonChildrenForClass = (
  className: string,
  getSuperclass: (name: string) => string | undefined,
): Map<string, string> => {
  const result = new Map<string, string>();
  let currentClass: string | undefined = className;

  while (currentClass !== undefined) {
    const children = COMMON_CHILDREN.get(currentClass);
    if (children !== undefined) {
      for (const [childName, childType] of children) {
        if (result.has(childName) === false) result.set(childName, childType);
      }
    }
    currentClass = getSuperclass(currentClass);
  }

  return result;
};

const getClassCompletions = (
  cls: ClassType,
  prefix: string,
  useColon: boolean,
  documentManager?: DocumentManager,
): CompletionItem[] => {
  const items: CompletionItem[] = [];
  const addedNames = new Set<string>();

  for (const [name, prop] of cls.properties) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const item: CompletionItem = {
      'label': name,
      'kind': typeToCompletionKind(prop.type),
    };

    if (prop.type.kind === 'Function') {
      item.detail = formatFunctionDetail(prop.type);
      item.insertText = formatFunctionSnippet(name, prop.type);
      item.insertTextFormat = InsertTextFormat.Snippet;
    }

    if (prop.deprecated === true) {
      item.tags = [CompletionItemTag.Deprecated];
      if (prop.deprecationMessage !== undefined) {
        item.detail = `(deprecated) ${prop.deprecationMessage}`;
      } else {
        item.detail = '(deprecated)';
      }
    }

    items.push(item);
    addedNames.add(name);
  }

  for (const [name, method] of cls.methods) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const item: CompletionItem = {
      'label': name,
      'kind': CompletionItemKind.Method,
      'detail': formatFunctionDetail(method.func),
      'insertText': formatFunctionSnippet(name, method.func),
      'insertTextFormat': InsertTextFormat.Snippet,
    };

    if (method.deprecated === true) {
      item.tags = [CompletionItemTag.Deprecated];
      if (method.deprecationMessage !== undefined) {
        item.detail = `(deprecated) ${method.deprecationMessage}`;
      } else {
        item.detail = '(deprecated)';
      }
    }

    items.push(item);
    addedNames.add(name);
  }

  if (cls.superclass !== undefined) {
    const inherited = getClassCompletions(cls.superclass, prefix, useColon, documentManager);
    for (const item of inherited) {
      if (addedNames.has(item.label) === false) {
        items.push(item);
        addedNames.add(item.label);
      }
    }
  }

  if (useColon === false && documentManager !== undefined) {
    const getSuperclass = (className: string): string | undefined => {
      const classType = documentManager.globalEnv.robloxClasses.get(className);
      if (classType !== undefined && classType.kind === 'Class' && classType.superclass !== undefined) {
        return classType.superclass.name;
      }
      return undefined;
    };

    const commonChildren = getCommonChildrenForClass(cls.name, getSuperclass);
    for (const [childName, childTypeName] of commonChildren) {
      if (addedNames.has(childName)) continue;
      if (prefix !== '' && childName.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

      items.push({
        'label': childName,
        'kind': CompletionItemKind.Field,
        'detail': `(child) ${childTypeName}`,
        'sortText': `z${childName}`,
        'documentation': {
          'kind': MarkupKind.Markdown,
          'value': `Common child instance of type \`${childTypeName}\`\n\nAccessed via \`FindFirstChild("${childName}")\` or direct indexing.`,
        },
      });
      addedNames.add(childName);
    }
  }

  return items;
};

const getGlobalCompletions = (documentManager: DocumentManager, prefix: string): CompletionItem[] => {
  const items: CompletionItem[] = [];
  const env = documentManager.globalEnv.env;

  for (const [name, symbol] of env.globalScope.symbols) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const item: CompletionItem = {
      'label': name,
      'kind': typeToCompletionKind(symbol.type),
    };

    if (symbol.type.kind === 'Function') {
      item.detail = formatFunctionDetail(symbol.type);
      item.insertText = formatFunctionSnippet(name, symbol.type);
      item.insertTextFormat = InsertTextFormat.Snippet;
    }

    item.data = { 'resolve': 'global', 'name': name };

    items.push(item);
  }

  return items;
};

const LUAU_SNIPPETS: ReadonlyArray<{
  label: string;
  insertText: string;
  detail: string;
  documentation: string;
}> = [
  {
    'label': 'function',
    'insertText': 'function ${1:name}(${2:args})\n\t$0\nend',
    'detail': 'Function declaration',
    'documentation': 'Creates a new function with name and arguments.',
  },
  {
    'label': 'local function',
    'insertText': 'local function ${1:name}(${2:args})\n\t$0\nend',
    'detail': 'Local function declaration',
    'documentation': 'Creates a new local function.',
  },
  {
    'label': 'if',
    'insertText': 'if ${1:condition} then\n\t$0\nend',
    'detail': 'If statement',
    'documentation': 'Creates an if statement block.',
  },
  {
    'label': 'if else',
    'insertText': 'if ${1:condition} then\n\t$2\nelse\n\t$0\nend',
    'detail': 'If-else statement',
    'documentation': 'Creates an if-else statement block.',
  },
  {
    'label': 'if elseif',
    'insertText': 'if ${1:condition} then\n\t$2\nelseif ${3:condition} then\n\t$0\nend',
    'detail': 'If-elseif statement',
    'documentation': 'Creates an if-elseif statement block.',
  },
  {
    'label': 'for',
    'insertText': 'for ${1:i} = ${2:1}, ${3:10} do\n\t$0\nend',
    'detail': 'Numeric for loop',
    'documentation': 'Creates a numeric for loop.',
  },
  {
    'label': 'for in',
    'insertText': 'for ${1:key}, ${2:value} in ${3:pairs}(${4:table}) do\n\t$0\nend',
    'detail': 'Generic for loop',
    'documentation': 'Creates a generic for loop with pairs/ipairs.',
  },
  {
    'label': 'for ipairs',
    'insertText': 'for ${1:index}, ${2:value} in ipairs(${3:array}) do\n\t$0\nend',
    'detail': 'For loop with ipairs',
    'documentation': 'Iterate over array indices.',
  },
  {
    'label': 'for pairs',
    'insertText': 'for ${1:key}, ${2:value} in pairs(${3:table}) do\n\t$0\nend',
    'detail': 'For loop with pairs',
    'documentation': 'Iterate over table key-value pairs.',
  },
  {
    'label': 'while',
    'insertText': 'while ${1:condition} do\n\t$0\nend',
    'detail': 'While loop',
    'documentation': 'Creates a while loop.',
  },
  {
    'label': 'repeat',
    'insertText': 'repeat\n\t$0\nuntil ${1:condition}',
    'detail': 'Repeat-until loop',
    'documentation': 'Creates a repeat-until loop.',
  },
  {
    'label': 'do',
    'insertText': 'do\n\t$0\nend',
    'detail': 'Do block',
    'documentation': 'Creates a do-end block for scoping.',
  },
  {
    'label': 'return',
    'insertText': 'return $0',
    'detail': 'Return statement',
    'documentation': 'Returns value(s) from function.',
  },
  {
    'label': 'local',
    'insertText': 'local ${1:name} = $0',
    'detail': 'Local variable',
    'documentation': 'Declares a local variable.',
  },
  {
    'label': 'then',
    'insertText': 'then\n\t$0\nend',
    'detail': 'Then block',
    'documentation': 'Completes an if statement.',
  },
  {
    'label': 'connect',
    'insertText': 'Connect(function(${1:args})\n\t$0\nend)',
    'detail': 'Connect to event',
    'documentation': 'Connects a callback function to an event.',
  },
  {
    'label': 'task.spawn',
    'insertText': 'task.spawn(function()\n\t$0\nend)',
    'detail': 'Spawn new thread',
    'documentation': 'Spawns a new thread to run code.',
  },
  {
    'label': 'task.delay',
    'insertText': 'task.delay(${1:seconds}, function()\n\t$0\nend)',
    'detail': 'Delayed execution',
    'documentation': 'Runs code after a delay.',
  },
  {
    'label': 'pcall',
    'insertText': 'local ${1:success}, ${2:result} = pcall(function()\n\t$0\nend)',
    'detail': 'Protected call',
    'documentation': 'Wraps code in a protected call to catch errors.',
  },
  {
    'label': 'xpcall',
    'insertText': 'local ${1:success}, ${2:result} = xpcall(function()\n\t$3\nend, function(${4:err})\n\t$0\nend)',
    'detail': 'Extended protected call',
    'documentation': 'Protected call with custom error handler.',
  },
  {
    'label': 'module',
    'insertText': 'local ${1:Module} = {}\n\nfunction ${1:Module}.${2:init}()\n\t$0\nend\n\nreturn ${1:Module}',
    'detail': 'Module template',
    'documentation': 'Creates a basic ModuleScript template.',
  },
  {
    'label': 'class',
    'insertText':
      'local ${1:ClassName} = {}\n${1:ClassName}.__index = ${1:ClassName}\n\nfunction ${1:ClassName}.new(${2:args})\n\tlocal self = setmetatable({}, ${1:ClassName})\n\t$0\n\treturn self\nend\n\nreturn ${1:ClassName}',
    'detail': 'OOP class template',
    'documentation': 'Creates an OOP-style class with constructor.',
  },
];

const getSnippetCompletions = (prefix: string): CompletionItem[] => {
  const items: CompletionItem[] = [];

  for (const snippet of LUAU_SNIPPETS) {
    if (prefix !== '' && snippet.label.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    items.push({
      'label': snippet.label,
      'kind': CompletionItemKind.Snippet,
      'detail': snippet.detail,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': snippet.documentation,
      },
      'insertText': snippet.insertText,
      'insertTextFormat': InsertTextFormat.Snippet,
      'sortText': `1_${snippet.label}`,
    });
  }

  return items;
};

const getLiveServiceCompletions = (
  beforeCursor: string,
  liveGameModel: LiveGameModel,
): CompletionItem[] | undefined => {
  if (/game\s*:\s*[Gg]et[Ss]ervice\s*(?:\(\s*)?["'][^"']*$/.test(beforeCursor) === false) return undefined;

  if (liveGameModel.isConnected === false) return undefined;

  const match = beforeCursor.match(/["']([^"']*)$/);
  const prefix = match?.[1]?.toLowerCase() ?? '';

  const services = liveGameModel.services;
  if (services.size === 0) return undefined;

  const items: CompletionItem[] = [];

  for (const [name, node] of services) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix) === false) continue;

    const childCount = node.children?.length ?? 0;

    items.push({
      'label': name,
      'kind': CompletionItemKind.Module,
      'detail': `(live) ${childCount} children`,
      'insertText': name,
      'sortText': `0_${name}`,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': `Live service from connected game\n\n**Class:** \`${node.className}\`\n**Children:** ${childCount}`,
      },
    });
  }

  return items.length > 0 ? items : undefined;
};

const getBracketCompletions = (beforeCursor: string, liveGameModel: LiveGameModel): CompletionItem[] | undefined => {
  const bracketMatch = beforeCursor.match(
    /([a-zA-Z_]\w*(?:\s*[.:]\s*[a-zA-Z_]\w*|\s*\([^)]*\)|\s*\[[^\]]*\])*)\s*\[\s*["']([^"']*)$/,
  );

  if (bracketMatch === null) return undefined;

  const [, expr, prefix] = bracketMatch;
  if (expr === undefined) return undefined;

  const path = parseGameTreePath(expr.replace(/\s+/g, ''));
  if (path === undefined) return undefined;

  if (liveGameModel.isConnected === false) return undefined;

  const children = liveGameModel.getChildren(path);
  if (children === undefined || children.size === 0) return undefined;

  const items: CompletionItem[] = [];
  const lowerPrefix = (prefix ?? '').toLowerCase();

  for (const [name, node] of children) {
    if (lowerPrefix !== '' && name.toLowerCase().startsWith(lowerPrefix) === false) continue;

    items.push({
      'label': name,
      'kind': CompletionItemKind.Field,
      'detail': `(live) ${node.className}`,
      'insertText': name,
      'sortText': `0_${name}`,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': `Live instance: \`${node.className}\``,
      },
    });
  }

  return items.length > 0 ? items : undefined;
};

const getStringCompletions = (beforeCursor: string, documentManager: DocumentManager): CompletionItem[] | undefined => {
  if (/[Gg]etService\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    return ROBLOX_SERVICES.filter(s => s.toLowerCase().startsWith(prefix)).map((service, idx) => ({
      'label': service,
      'kind': CompletionItemKind.Class,
      'insertText': service,
      'sortText': `0${idx.toString().padStart(3, '0')}`,
      'preselect': idx === 0,
    }));
  }

  if (/Instance\s*\.\s*new\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    return CREATABLE_CLASSES.filter(c => c.toLowerCase().startsWith(prefix)).map((cls, idx) => ({
      'label': cls,
      'kind': CompletionItemKind.Class,
      'insertText': cls,
      'sortText': `0${idx.toString().padStart(3, '0')}`,
      'preselect': idx === 0,
    }));
  }

  if (/[Bb]rick[Cc]olor\s*\.\s*new\s*(?:\(\s*)?["'][^"']*$/.test(beforeCursor)) {
    const match = beforeCursor.match(/["']([^"']*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    const brickColors = [
      'White',
      'Grey',
      'Light yellow',
      'Brick yellow',
      'Light green (Mint)',
      'Light reddish violet',
      'Pastel Blue',
      'Light orange brown',
      'Nougat',
      'Bright red',
      'Med. reddish violet',
      'Bright blue',
      'Bright yellow',
      'Earth orange',
      'Black',
      'Dark grey',
      'Dark green',
      'Medium green',
      'Lig. Yellowich orange',
      'Bright green',
      'Dark orange',
      'Light bluish violet',
      'Transparent',
      'Tr. Red',
      'Tr. Lg blue',
      'Tr. Blue',
      'Tr. Yellow',
      'Light blue',
      'Tr. Flu. Reddish orange',
      'Tr. Green',
      'Tr. Flu. Green',
      'Phosph. White',
      'Light red',
      'Medium red',
      'Medium blue',
      'Light grey',
      'Bright violet',
      'Br. yellowish orange',
      'Bright orange',
      'Bright bluish green',
      'Earth yellow',
      'Bright bluish violet',
      'Tr. Brown',
      'Medium bluish violet',
      'Tr. Medi. reddish violet',
      'Med. yellowish green',
      'Med. bluish green',
      'Light bluish green',
      'Br. yellowish green',
      'Lig. yellowish green',
      'Med. yellowish orange',
      'Br. reddish orange',
      'Bright reddish violet',
      'Light orange',
      'Tr. Bright bluish violet',
      'Gold',
      'Dark nougat',
      'Silver',
      'Neon orange',
      'Neon green',
      'Sand blue',
      'Sand violet',
      'Medium orange',
      'Sand yellow',
      'Earth blue',
      'Earth green',
      'Tr. Flu. Blue',
      'Sand blue metallic',
      'Sand violet metallic',
      'Sand yellow metallic',
      'Dark grey metallic',
      'Black metallic',
      'Light grey metallic',
      'Sand green',
      'Sand red',
      'Dark red',
      'Tr. Flu. Yellow',
      'Tr. Flu. Red',
      'Gun metallic',
      'Red flip/flop',
      'Yellow flip/flop',
      'Silver flip/flop',
      'Curry',
      'Fire Yellow',
      'Flame yellowish orange',
      'Reddish brown',
      'Flame reddish orange',
      'Medium stone grey',
      'Royal blue',
      'Dark Royal blue',
      'Bright reddish lilac',
      'Dark stone grey',
      'Lemon metalic',
      'Light stone grey',
      'Dark Curry',
      'Faded green',
      'Turquoise',
      'Light Royal blue',
      'Medium Royal blue',
      'Rust',
      'Brown',
      'Reddish lilac',
      'Lilac',
      'Light lilac',
      'Bright purple',
      'Light purple',
      'Light pink',
      'Light brick yellow',
      'Warm yellowish orange',
      'Cool yellow',
      'Dove blue',
      'Medium lilac',
      'Slime green',
      'Smoky grey',
      'Dark blue',
      'Parsley green',
      'Steel blue',
      'Storm blue',
      'Lapis',
      'Dark indigo',
      'Sea green',
      'Shamrock',
      'Fossil',
      'Mulberry',
      'Forest green',
      'Cadet blue',
      'Electric blue',
      'Eggplant',
      'Moss',
      'Artichoke',
      'Sage green',
      'Ghost grey',
      'Lilac',
      'Plum',
      'Olivine',
      'Laurel green',
      'Quill grey',
      'Crimson',
      'Mint',
      'Baby blue',
      'Carnation pink',
      'Persimmon',
      'Maroon',
      'Gold',
      'Daisy orange',
      'Pearl',
      'Fog',
      'Salmon',
      'Terra Cotta',
      'Cocoa',
      'Wheat',
      'Buttermilk',
      'Mauve',
      'Sunrise',
      'Tawny',
      'Rust',
      'Cashmere',
      'Khaki',
      'Lily white',
      'Seashell',
      'Burgundy',
      'Cork',
      'Burlap',
      'Beige',
      'Oyster',
      'Pine Cone',
      'Fawn brown',
      'Hurricane grey',
      'Cloudy grey',
      'Linen',
      'Copper',
      'Dirt brown',
      'Bronze',
      'Flint',
      'Dark taupe',
      'Burnt Sienna',
      'Institutional white',
      'Mid gray',
      'Really black',
      'Really red',
      'Deep orange',
      'Alder',
      'Dusty Rose',
      'Olive',
      'New Yeller',
      'Really blue',
      'Navy blue',
      'Deep blue',
      'Cyan',
      'CGA brown',
      'Magenta',
      'Pink',
      'Deep orange',
      'Teal',
      'Toothpaste',
      'Lime green',
      'Camo',
      'Grime',
      'Lavender',
      'Pastel light blue',
      'Pastel orange',
      'Pastel violet',
      'Pastel blue-green',
      'Pastel green',
      'Pastel yellow',
      'Pastel brown',
      'Royal purple',
      'Hot pink',
    ];
    return brickColors
      .filter(c => c.toLowerCase().startsWith(prefix))
      .map((color, idx) => ({
        'label': color,
        'kind': CompletionItemKind.Color,
        'insertText': color,
        'sortText': `0${idx.toString().padStart(3, '0')}`,
        'preselect': idx === 0,
      }));
  }

  if (/(?:FindFirstChild|WaitForChild|FindFirstAncestor)\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    const items: CompletionItem[] = [];
    for (const cls of documentManager.globalEnv.robloxClasses.keys()) {
      if (cls.toLowerCase().startsWith(prefix)) {
        items.push({
          'label': cls,
          'kind': CompletionItemKind.Class,
        });
      }
    }
    return items.slice(0, 50);
  }

  if (
    /(?:FindFirstChildOfClass|FindFirstChildWhichIsA|FindFirstAncestorOfClass|FindFirstAncestorWhichIsA)\s*(?:\(\s*)?["'][\w]*$/.test(
      beforeCursor,
    )
  ) {
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    const items: CompletionItem[] = [];
    for (const cls of documentManager.globalEnv.robloxClasses.keys()) {
      if (cls.toLowerCase().startsWith(prefix)) {
        items.push({
          'label': cls,
          'kind': CompletionItemKind.Class,
        });
      }
    }
    return items.slice(0, 50);
  }

  if (/IsA\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    const items: CompletionItem[] = [];
    for (const cls of documentManager.globalEnv.robloxClasses.keys()) {
      if (cls.toLowerCase().startsWith(prefix)) {
        items.push({
          'label': cls,
          'kind': CompletionItemKind.Class,
        });
      }
    }
    return items.slice(0, 50);
  }

  if (/GetPropertyChangedSignal\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    const commonProps = [
      'Name',
      'Parent',
      'Position',
      'CFrame',
      'Size',
      'Color',
      'Transparency',
      'Anchored',
      'CanCollide',
      'Visible',
      'Text',
      'Value',
      'Enabled',
      'Health',
      'MaxHealth',
      'WalkSpeed',
      'JumpPower',
      'JumpHeight',
      'Velocity',
      'AssemblyLinearVelocity',
      'AssemblyAngularVelocity',
      'Material',
      'BrickColor',
      'CanQuery',
      'CanTouch',
      'Massless',
      'RootPriority',
    ];
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    return commonProps
      .filter(p => p.toLowerCase().startsWith(prefix))
      .map(prop => ({
        'label': prop,
        'kind': CompletionItemKind.Property,
      }));
  }

  if (/(?:SetAttribute|GetAttribute)\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) return undefined;

  if (/(?:GetTagged|HasTag|AddTag|RemoveTag)\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) return undefined;

  return undefined;
};

const getEnumCompletions = (beforeCursor: string, documentManager: DocumentManager): CompletionItem[] | undefined => {
  const enumMatch = beforeCursor.match(/Enum\.(\w+)\.(\w*)$/);
  if (enumMatch !== null) {
    const [, enumName, prefix] = enumMatch;
    if (enumName === undefined) return undefined;

    const enumType = documentManager.globalEnv.robloxEnums.get(enumName);
    if (enumType !== undefined && enumType.kind === 'Table') {
      const items: CompletionItem[] = [];
      for (const [name] of enumType.properties) {
        if (prefix !== undefined && prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false)
          continue;
        items.push({
          'label': name,
          'kind': CompletionItemKind.EnumMember,
          'detail': `Enum.${enumName}`,
        });
      }
      return items;
    }
  }

  const enumBaseMatch = beforeCursor.match(/Enum\.(\w*)$/);
  if (enumBaseMatch !== null) {
    const [, prefix] = enumBaseMatch;
    const items: CompletionItem[] = [];
    for (const enumName of documentManager.globalEnv.robloxEnums.keys()) {
      if (prefix !== undefined && prefix !== '' && enumName.toLowerCase().startsWith(prefix.toLowerCase()) === false)
        continue;
      items.push({
        'label': enumName,
        'kind': CompletionItemKind.Enum,
        'detail': 'Roblox Enum',
      });
    }
    return items;
  }

  return undefined;
};

const SERVICE_CLASS_MAP: ReadonlyMap<string, string> = new Map([
  ['Players', 'Players'],
  ['Workspace', 'Workspace'],
  ['Lighting', 'Lighting'],
  ['ReplicatedFirst', 'ReplicatedFirst'],
  ['ReplicatedStorage', 'ReplicatedStorage'],
  ['ServerScriptService', 'ServerScriptService'],
  ['ServerStorage', 'ServerStorage'],
  ['StarterGui', 'StarterGui'],
  ['StarterPack', 'StarterPack'],
  ['StarterPlayer', 'StarterPlayer'],
  ['Teams', 'Teams'],
  ['SoundService', 'SoundService'],
  ['Chat', 'Chat'],
  ['LocalizationService', 'LocalizationService'],
  ['TestService', 'TestService'],
  ['RunService', 'RunService'],
  ['UserInputService', 'UserInputService'],
  ['ContextActionService', 'ContextActionService'],
  ['GuiService', 'GuiService'],
  ['HapticService', 'HapticService'],
  ['VRService', 'VRService'],
  ['TweenService', 'TweenService'],
  ['TextService', 'TextService'],
  ['PathfindingService', 'PathfindingService'],
  ['PhysicsService', 'PhysicsService'],
  ['CollectionService', 'CollectionService'],
  ['Debris', 'Debris'],
  ['HttpService', 'HttpService'],
  ['MarketplaceService', 'MarketplaceService'],
  ['DataStoreService', 'DataStoreService'],
  ['MemoryStoreService', 'MemoryStoreService'],
  ['MessagingService', 'MessagingService'],
  ['TeleportService', 'TeleportService'],
  ['SocialService', 'SocialService'],
  ['PolicyService', 'PolicyService'],
  ['ProximityPromptService', 'ProximityPromptService'],
  ['ContentProvider', 'ContentProvider'],
  ['LogService', 'LogService'],
  ['AnalyticsService', 'AnalyticsService'],
  ['GroupService', 'GroupService'],
]);

const resolveTypeReference = (type: LuauType, documentManager: DocumentManager): LuauType => {
  if (type.kind === 'TypeReference') {
    const typeName = type.name;

    const classType = documentManager.globalEnv.robloxClasses.get(typeName);
    if (classType !== undefined) return classType;

    const dataType = documentManager.globalEnv.robloxDataTypes.get(typeName);
    if (dataType !== undefined) return dataType;
  }
  return type;
};

const getLocalSymbolCompletions = (
  document: ParsedDocument | undefined,
  prefix: string,
  documentManager: DocumentManager,
): CompletionItem[] => {
  if (document === undefined || document.typeCheckResult === undefined) return [];

  const items: CompletionItem[] = [];
  const globalNames = new Set(documentManager.globalEnv.env.globalScope.symbols.keys());

  for (const [name, symbolType] of document.typeCheckResult.allSymbols) {
    if (globalNames.has(name)) continue;
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const resolved = resolveTypeReference(symbolType, documentManager);
    const item: CompletionItem = {
      'label': name,
      'kind': typeToCompletionKind(resolved),
      'detail': resolved.kind === 'Function' ? formatFunctionDetail(resolved as FunctionType) : resolved.kind,
      'sortText': `0${name}`,
    };

    if (resolved.kind === 'Function') {
      item.insertText = formatFunctionSnippet(name, resolved as FunctionType);
      item.insertTextFormat = InsertTextFormat.Snippet;
    }

    items.push(item);
  }

  return items;
};

const DEBUG_COMPLETION = false;

const debugLog = (...args: unknown[]): void => {
  if (DEBUG_COMPLETION) console.error('[completion]', ...args);
};

const moduleExportsToTableType = (moduleInfo: ModuleInfo): LuauType => {
  const properties = new Map<string, PropertyType>();
  for (const exp of moduleInfo.exports) {
    let propType: LuauType;
    switch (exp.kind) {
      case 'function':
        propType = createFunctionType([], AnyType);
        break;
      case 'table':
        propType = createTableType(new Map());
        break;
      default:
        propType = AnyType;
        break;
    }
    properties.set(exp.name, { 'type': propType, 'readonly': true, 'optional': false });
  }
  return createTableType(properties);
};

const TYPE_ANNOT_RE = `(?:\\s*:[^=]+)?`;

const traceVarExpression = (varName: string, content: string, depth = 0): string | undefined => {
  if (depth > 5) return undefined;

  if (varName === 'game' || varName === 'workspace') return varName;

  const assignPattern = new RegExp(`local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*(.+)`);
  const assignMatch = content.match(assignPattern);
  if (assignMatch === null || assignMatch[1] === undefined) return undefined;

  const rhs = assignMatch[1].trim().replace(/;.*$/, '');

  if (/^require\s*\(/.test(rhs)) return rhs;

  const indirectMatch = rhs.match(/^(\w+)([.:].+)/);
  if (indirectMatch !== null && indirectMatch[1] !== undefined && indirectMatch[2] !== undefined) {
    const sourceVar = indirectMatch[1];
    const suffix = indirectMatch[2];
    const sourceExpr = traceVarExpression(sourceVar, content, depth + 1);
    if (sourceExpr !== undefined) return `${sourceExpr}${suffix}`;
  }

  return undefined;
};

const splitMemberExpression = (expr: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (ch === '.') {
      if (current !== '') parts.push(current);
      current = '';
      i++;
    } else if (ch === '[') {
      if (current !== '') parts.push(current);
      current = '';
      i++;
      const quote = expr[i];
      if (quote === "'" || quote === '"') {
        i++;
        let key = '';
        while (i < expr.length && expr[i] !== quote) {
          key += expr[i];
          i++;
        }
        if (i < expr.length) i++;
        if (i < expr.length && expr[i] === ']') i++;
        parts.push(key);
      } else {
        while (i < expr.length && expr[i] !== ']') i++;
        if (i < expr.length) i++;
      }
    } else {
      current += ch;
      i++;
    }
  }

  if (current !== '') parts.push(current);
  return parts;
};

const resolveRequireModuleType = (
  requireArg: string,
  documentManager: DocumentManager,
  documentUri?: string,
): LuauType | undefined => {
  const stringMatch = requireArg.match(/^["'](\.\.?\/[^"']+)["']$/);
  if (stringMatch !== null && documentUri !== undefined) {
    const relativePath = stringMatch[1]!;
    let filePath: string;
    try {
      filePath = decodeURIComponent(new URL(documentUri).pathname);
      if (filePath.match(/^\/[A-Za-z]:/) !== null) filePath = filePath.slice(1);
    } catch {
      return undefined;
    }

    const moduleInfo = resolveLocalModule(relativePath, filePath);
    if (moduleInfo !== undefined && moduleInfo.exports.length > 0) return moduleExportsToTableType(moduleInfo);
    return undefined;
  }

  const gamePrefix = requireArg.match(/^game\s*[.[]/);
  const rawExpr =
    gamePrefix !== null ? requireArg.slice(gamePrefix[0].length - (gamePrefix[0].endsWith('[') ? 1 : 0)) : requireArg;

  const pathParts = splitMemberExpression(rawExpr).filter(p => p.length > 0);

  if (pathParts.length === 0) return undefined;

  const moduleIndex = documentManager.getModuleIndex();

  const stripScriptSuffix = (name: string): string => name.replace(/\.(client|server)$/, '');

  for (const [, moduleInfo] of moduleIndex) {
    const dmPath = moduleInfo.dataModelPath;
    if (dmPath.length < pathParts.length) continue;

    const offset = dmPath.length - pathParts.length;
    let matches = true;
    for (let i = 0; i < pathParts.length; i++) {
      const expected = pathParts[i] ?? '';
      const actual = dmPath[offset + i] ?? '';
      if (
        actual !== expected &&
        actual !== stripScriptSuffix(expected) &&
        stripScriptSuffix(actual) !== stripScriptSuffix(expected)
      ) {
        matches = false;
        break;
      }
    }
    if (matches && moduleInfo.exports.length > 0) return moduleExportsToTableType(moduleInfo);
  }

  return undefined;
};

const quickScanForVariableType = (
  varName: string,
  content: string,
  documentManager: DocumentManager,
  logFn?: (msg: string) => void,
  documentUri?: string,
): LuauType | undefined => {
  const log = logFn ?? debugLog;
  log(`quickScan for: ${varName}`);

  const instanceNewPattern = new RegExp(
    `local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*Instance\\s*\\.\\s*new\\s*\\(\\s*["']([\\w]+)["']`,
  );
  const instanceNewMatch = content.match(instanceNewPattern);
  log(`instanceNewMatch: ${instanceNewMatch !== null ? instanceNewMatch[0] : 'null'}`);
  if (instanceNewMatch !== null) {
    const className = instanceNewMatch[1];
    if (className !== undefined) {
      const classType = documentManager.globalEnv.robloxClasses.get(className);
      log(`quickScan Instance.new class: ${className}, found: ${classType?.kind ?? 'undefined'}`);
      if (classType !== undefined) return classType;
    }
  }

  const getServicePattern = new RegExp(
    `local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*game\\s*:\\s*[Gg]et[Ss]ervice\\s*\\(?\\s*["']([\\w]+)["']`,
  );
  const getServiceMatch = content.match(getServicePattern);
  if (getServiceMatch !== null) {
    const serviceName = getServiceMatch[1];
    if (serviceName !== undefined) {
      const serviceClass = documentManager.globalEnv.robloxClasses.get(serviceName);
      if (serviceClass !== undefined) return serviceClass;
    }
  }

  const gameServicePattern = new RegExp(`local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*game\\s*\\.\\s*([\\w]+)`);
  const gameServiceMatch = content.match(gameServicePattern);
  if (gameServiceMatch !== null) {
    const serviceName = gameServiceMatch[1];
    if (serviceName !== undefined) {
      const serviceClassName = SERVICE_CLASS_MAP.get(serviceName);
      if (serviceClassName !== undefined) {
        const serviceClass = documentManager.globalEnv.robloxClasses.get(serviceClassName);
        if (serviceClass !== undefined) return serviceClass;
      }
    }
  }

  const workspacePattern = new RegExp(`local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*workspace\\b`);
  if (workspacePattern.test(content)) {
    const workspaceClass = documentManager.globalEnv.robloxClasses.get('Workspace');
    if (workspaceClass !== undefined) return workspaceClass;
  }

  const findChildOfClassPattern = new RegExp(
    `local\\s+${varName}${TYPE_ANNOT_RE}\\s*=.*:FindFirstChildOfClass\\s*\\(\\s*["']([\\w]+)["']`,
  );
  const findChildOfClassMatch = content.match(findChildOfClassPattern);
  if (findChildOfClassMatch !== null) {
    const className = findChildOfClassMatch[1];
    if (className !== undefined) {
      const classType = documentManager.globalEnv.robloxClasses.get(className);
      if (classType !== undefined) return classType;
    }
  }

  const findChildWhichIsAPattern = new RegExp(
    `local\\s+${varName}${TYPE_ANNOT_RE}\\s*=.*:FindFirstChildWhichIsA\\s*\\(\\s*["']([\\w]+)["']`,
  );
  const findChildWhichIsAMatch = content.match(findChildWhichIsAPattern);
  if (findChildWhichIsAMatch !== null) {
    const className = findChildWhichIsAMatch[1];
    if (className !== undefined) {
      const classType = documentManager.globalEnv.robloxClasses.get(className);
      if (classType !== undefined) return classType;
    }
  }

  const requirePattern = new RegExp(`local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*require\\s*\\(\\s*([^)]+)\\s*\\)`);
  const requireMatch = content.match(requirePattern);
  if (requireMatch !== null) {
    const requireArg = requireMatch[1]?.trim();
    if (requireArg !== undefined) {
      const moduleType = resolveRequireModuleType(requireArg, documentManager, documentUri);
      if (moduleType !== undefined) return moduleType;
    }
  }

  const indirectPattern = new RegExp(`local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*(\\w+)([.:][^\\n]+)`);
  const indirectMatch = content.match(indirectPattern);
  if (indirectMatch !== null && indirectMatch[1] !== undefined && indirectMatch[2] !== undefined) {
    const sourceVar = indirectMatch[1];
    const suffix = indirectMatch[2].trim();

    if (sourceVar !== 'Instance' && sourceVar !== 'game' && sourceVar !== 'workspace' && sourceVar !== 'require') {
      const sourceType = quickScanForVariableType(sourceVar, content, documentManager, logFn, documentUri);
      if (sourceType !== undefined && sourceType.kind === 'Class') {
        const memberName = suffix.match(/^[.:]\s*(\w+)/)?.[1];
        if (memberName !== undefined) {
          let cls: ClassType | undefined = sourceType;
          while (cls !== undefined) {
            const prop = cls.properties.get(memberName);
            if (prop !== undefined) {
              if (prop.type.kind === 'Class') return prop.type;
              return prop.type;
            }
            const method = cls.methods.get(memberName);
            if (method !== undefined) return method.func.returnType;
            cls = cls.superclass;
          }
        }
      }
    }
  }

  const hintedClass = VARIABLE_NAME_HINTS.get(varName);
  if (hintedClass !== undefined) {
    const isDefinedPattern = new RegExp(`local\\s+${varName}\\b`);
    if (isDefinedPattern.test(content)) {
      const classType = documentManager.globalEnv.robloxClasses.get(hintedClass);
      if (classType !== undefined) return classType;
    }
  }

  return undefined;
};

const resolveExpressionType = (
  expression: string,
  documentManager: DocumentManager,
  document?: ParsedDocument,
  liveContent?: string,
  logFn?: (msg: string) => void,
  documentUri?: string,
): LuauType | undefined => {
  const log = logFn ?? debugLog;
  log(`Resolving expression: ${expression}`);

  type ExprPart =
    | { kind: 'property'; name: string }
    | { kind: 'method'; name: string; args: string }
    | { kind: 'call'; args: string };
  const parts: ExprPart[] = [];
  let current = '';
  let i = 0;

  while (i < expression.length) {
    const char = expression[i] ?? '';
    if (char === '.') {
      if (current !== '') {
        parts.push({ 'kind': 'property', 'name': current });
        current = '';
      }
      i++;
    } else if (char === ':') {
      if (current !== '') {
        parts.push({ 'kind': 'property', 'name': current });
        current = '';
      }
      i++;
      let methodName = '';
      while (i < expression.length && /\w/.test(expression[i] ?? '')) {
        methodName += expression[i];
        i++;
      }
      while (i < expression.length && /\s/.test(expression[i] ?? '')) i++;
      let args = '';
      if (expression[i] === '(' || expression[i] === '"' || expression[i] === "'") {
        const startArgs = i;
        if (expression[i] === '(') {
          let depth = 1;
          i++;
          while (i < expression.length && depth > 0) {
            if (expression[i] === '(') depth++;
            else if (expression[i] === ')') depth--;
            i++;
          }
        } else {
          const quote = expression[i];
          i++;
          while (i < expression.length && expression[i] !== quote) i++;
          if (expression[i] === quote) i++;
        }
        args = expression.slice(startArgs, i);
      }
      if (methodName !== '') parts.push({ 'kind': 'method', 'name': methodName, args });
    } else if (char === '[') {
      if (current !== '') {
        parts.push({ 'kind': 'property', 'name': current });
        current = '';
      }
      const startBracket = i;
      let depth = 1;
      i++;
      while (i < expression.length && depth > 0) {
        if (expression[i] === '[') depth++;
        else if (expression[i] === ']') depth--;
        i++;
      }
      const bracketContent = expression.slice(startBracket + 1, i - 1).trim();
      const stringKeyMatch = bracketContent.match(/^['"](.+)['"]$/);
      if (stringKeyMatch !== null && stringKeyMatch[1] !== undefined) {
        parts.push({ 'kind': 'property', 'name': stringKeyMatch[1] });
      } else {
        parts.push({ 'kind': 'call', 'args': expression.slice(startBracket, i) });
      }
    } else if (char === '(') {
      if (current !== '') {
        parts.push({ 'kind': 'property', 'name': current });
        current = '';
      }
      const startArgs = i;
      let depth = 1;
      i++;
      while (i < expression.length && depth > 0) {
        if (expression[i] === '(') depth++;
        else if (expression[i] === ')') depth--;
        i++;
      }
      parts.push({ 'kind': 'call', 'args': expression.slice(startArgs, i) });
    } else if (/\w/.test(char)) {
      current += char;
      i++;
    } else {
      i++;
    }
  }

  if (current !== '') parts.push({ 'kind': 'property', 'name': current });

  if (parts.length === 0) return undefined;

  const firstPart = parts[0];
  if (firstPart === undefined || firstPart.kind !== 'property') return undefined;
  const firstName = firstPart.name;

  let currentType: LuauType | undefined;

  const globalSymbol = documentManager.globalEnv.env.globalScope.symbols.get(firstName);
  if (globalSymbol !== undefined) {
    currentType = globalSymbol.type;
    log(`First part '${firstName}' resolved from globals: ${currentType.kind}`);
  } else {
    const classType = documentManager.globalEnv.robloxClasses.get(firstName);
    if (classType !== undefined) {
      currentType = classType;
      log(`First part '${firstName}' resolved from robloxClasses: ${currentType.kind}`);
    }
  }

  if (currentType === undefined && document?.typeCheckResult !== undefined) {
    log(`Checking allSymbols for '${firstName}'...`);
    const symbolType = document.typeCheckResult.allSymbols.get(firstName);
    if (symbolType !== undefined) {
      log(`Found '${firstName}' in allSymbols, type: ${symbolType.kind}`);
      const resolved = resolveTypeReference(symbolType, documentManager);
      log(`Resolved type: ${resolved.kind}${resolved.kind === 'Class' ? ` (${(resolved as ClassType).name})` : ''}`);

      if (resolved.kind === 'Class' || resolved.kind === 'Table') {
        currentType = resolved;
      } else if (resolved.kind === 'Union') {
        const nonNilTypes = (resolved as { types: ReadonlyArray<LuauType> }).types.filter(
          (t: LuauType) => t.kind !== 'Primitive' || (t as { name: string }).name !== 'nil',
        );
        for (const member of nonNilTypes) {
          const memberResolved = resolveTypeReference(member, documentManager);
          if (memberResolved.kind === 'Class' || memberResolved.kind === 'Table') {
            currentType = memberResolved;
            break;
          }
        }
      } else if (resolved.kind === 'Function') {
        const funcType = resolved as { returnType: LuauType };
        const returnResolved = resolveTypeReference(funcType.returnType, documentManager);
        if (returnResolved.kind === 'Class' || returnResolved.kind === 'Table') {
          currentType = returnResolved;
        }
      } else if (resolved.kind !== 'Any') {
        log(`allSymbols type for '${firstName}' not directly usable: ${resolved.kind}`);
      }
    } else {
      log(`'${firstName}' not found in allSymbols`);
    }
  } else if (currentType === undefined) {
    log(
      `Skipping allSymbols check: doc=${document !== undefined}, typeCheck=${document?.typeCheckResult !== undefined}`,
    );
  }

  if (currentType === undefined && liveContent !== undefined) {
    log(`Running quick scan for '${firstName}'...`);
    const scannedType = quickScanForVariableType(firstName, liveContent, documentManager, log, documentUri);
    if (scannedType !== undefined) {
      log(
        `Quick scan found '${firstName}': ${scannedType.kind}${scannedType.kind === 'Class' ? ` (${(scannedType as ClassType).name})` : ''}`,
      );
      currentType = scannedType;
    } else {
      log(`Quick scan found nothing for '${firstName}'`);
    }
  } else if (currentType === undefined) {
    log(`Skipping quick scan: liveContent=${liveContent !== undefined}`);
  }

  if (currentType === undefined) {
    const hintedClass = VARIABLE_NAME_HINTS.get(firstName);
    if (hintedClass !== undefined) {
      const classType = documentManager.globalEnv.robloxClasses.get(hintedClass);
      if (classType !== undefined) currentType = classType;
    }
  }

  if (currentType === undefined) return undefined;

  for (let partIdx = 1; partIdx < parts.length; partIdx++) {
    const part = parts[partIdx];
    if (part === undefined) break;

    if (part.kind === 'property') {
      if (partIdx === 1 && firstName === 'game') {
        const serviceClassName = SERVICE_CLASS_MAP.get(part.name);
        if (serviceClassName !== undefined) {
          const serviceClass = documentManager.globalEnv.robloxClasses.get(serviceClassName);
          if (serviceClass !== undefined) {
            currentType = serviceClass;
            continue;
          }
        }
      }

      if (partIdx === 1 && firstName === 'game' && part.name === 'Workspace') {
        const workspaceClass = documentManager.globalEnv.robloxClasses.get('Workspace');
        if (workspaceClass !== undefined) {
          currentType = workspaceClass;
          continue;
        }
      }

      currentType = resolveMemberType(currentType, part.name, documentManager);
      if (currentType === undefined) return undefined;
    } else if (part.kind === 'method') {
      if (part.name.toLowerCase() === 'getservice') {
        const serviceMatch = part.args.match(/["'](\w+)["']/);
        if (serviceMatch !== null) {
          const serviceName = serviceMatch[1];
          if (serviceName !== undefined) {
            const serviceClass = documentManager.globalEnv.robloxClasses.get(serviceName);
            if (serviceClass !== undefined) {
              currentType = serviceClass;
              continue;
            }
          }
        }
      }

      if (part.name === 'FindFirstChildOfClass' || part.name === 'FindFirstChildWhichIsA') {
        const classMatch = part.args.match(/["'](\w+)["']/);
        if (classMatch !== null) {
          const className = classMatch[1];
          if (className !== undefined) {
            const classType = documentManager.globalEnv.robloxClasses.get(className);
            if (classType !== undefined) {
              currentType = classType;
              continue;
            }
          }
        }
      }

      if (part.name === 'FindFirstAncestorOfClass' || part.name === 'FindFirstAncestorWhichIsA') {
        const classMatch = part.args.match(/["'](\w+)["']/);
        if (classMatch !== null) {
          const className = classMatch[1];
          if (className !== undefined) {
            const classType = documentManager.globalEnv.robloxClasses.get(className);
            if (classType !== undefined) {
              currentType = classType;
              continue;
            }
          }
        }
      }

      if (part.name === 'Clone' && part.args === '()') continue;

      if (part.name === 'WaitForChild' || part.name === 'FindFirstChild') {
        const childMatch = part.args.match(/["'](\w+)["']/);
        if (childMatch !== null && currentType !== undefined) {
          const childName = childMatch[1];
          const resolvedCurrent = resolveTypeReference(currentType, documentManager);
          if (childName !== undefined && resolvedCurrent.kind === 'Class') {
            const commonChildType = getCommonChildType(resolvedCurrent.name, childName, className =>
              getSuperclassName(className, documentManager),
            );
            if (commonChildType !== undefined) {
              const childClassType = documentManager.globalEnv.robloxClasses.get(commonChildType);
              if (childClassType !== undefined) {
                debugLog('WaitForChild/FindFirstChild resolved via common child:', childName, '->', commonChildType);
                currentType = childClassType;
                continue;
              }
            }
          }
        }
      }

      debugLog('Resolving method:', part.name, 'on type:', currentType?.kind);
      if (currentType !== undefined) {
        const resolvedCurrent = resolveTypeReference(currentType, documentManager);
        debugLog(
          'Resolved current type:',
          resolvedCurrent.kind,
          resolvedCurrent.kind === 'Class' ? resolvedCurrent.name : '',
        );
        if (resolvedCurrent.kind === 'Class') {
          let searchClass: ClassType | undefined = resolvedCurrent;
          while (searchClass !== undefined) {
            const method = searchClass.methods.get(part.name);
            if (method !== undefined) {
              debugLog('Found method in class:', searchClass.name, 'return type:', method.func.returnType);
              currentType = resolveTypeReference(method.func.returnType, documentManager);
              debugLog(
                'After resolving return type:',
                currentType.kind,
                currentType.kind === 'Class' ? currentType.name : '',
              );
              break;
            }
            debugLog('Method not found on:', searchClass.name, 'checking superclass');
            searchClass = searchClass.superclass;
          }
          if (searchClass !== undefined) {
            debugLog('Method resolution succeeded, continuing with type:', currentType?.kind);
            continue;
          }
          debugLog('Method not found in class hierarchy');
        }
      }
      debugLog('Failed to resolve method:', part.name);
      return undefined;
    } else if (part.kind === 'call') {
      if (currentType !== undefined && currentType.kind === 'Function') {
        currentType = resolveTypeReference(currentType.returnType, documentManager);
      }
    }
  }

  return currentType;
};

const getSuperclassName = (className: string, documentManager: DocumentManager): string | undefined => {
  const classType = documentManager.globalEnv.robloxClasses.get(className);
  if (classType !== undefined && classType.kind === 'Class' && classType.superclass !== undefined) {
    return classType.superclass.name;
  }
  return undefined;
};

const resolveMemberType = (
  type: LuauType,
  memberName: string,
  documentManager: DocumentManager,
): LuauType | undefined => {
  const resolvedType = resolveTypeReference(type, documentManager);

  if (resolvedType.kind === 'Class') {
    const prop = resolvedType.properties.get(memberName);
    if (prop !== undefined) return resolveTypeReference(prop.type, documentManager);

    const method = resolvedType.methods.get(memberName);
    if (method !== undefined) return method.func;

    if (resolvedType.superclass !== undefined) {
      const inheritedMember = resolveMemberType(resolvedType.superclass, memberName, documentManager);
      if (inheritedMember !== undefined) return inheritedMember;
    }

    const commonChildType = getCommonChildType(resolvedType.name, memberName, className =>
      getSuperclassName(className, documentManager),
    );
    if (commonChildType !== undefined) {
      const childClassType = documentManager.globalEnv.robloxClasses.get(commonChildType);
      if (childClassType !== undefined) return childClassType;
    }
  } else if (resolvedType.kind === 'Table') {
    const prop = resolvedType.properties.get(memberName);
    if (prop !== undefined) return resolveTypeReference(prop.type, documentManager);
  }

  return undefined;
};

const extractExpressionChain = (
  beforeCursor: string,
): { expression: string; prefix: string; isMethodAccess: boolean } | undefined => {
  const chainMatch = beforeCursor.match(
    /([a-zA-Z_]\w*(?:\s*\.\s*[a-zA-Z_]\w*|\s*:\s*[a-zA-Z_]\w*|\s*\([^)]*\)|\s*\[[^\]]*\]|\s*'[^']*'|\s*"[^"]*")*)\s*([.:])(\w*)$/,
  );

  if (chainMatch !== null) {
    const [, expr, accessor, prefix] = chainMatch;
    if (expr === undefined || accessor === undefined) return undefined;

    return {
      'expression': expr.replace(/\s+/g, ''),
      'prefix': prefix ?? '',
      'isMethodAccess': accessor === ':',
    };
  }

  return undefined;
};

const getAutoImportCompletions = (
  prefix: string,
  documentManager: DocumentManager,
  currentDocUri: string,
  content: string,
): CompletionItem[] => {
  if (prefix.length < 2) return [];

  const exports = documentManager.searchModuleExports(prefix);
  if (exports.length === 0) return [];

  const rojoState = documentManager.getRojoState();
  let currentDataModelPath: string[] = [];

  if (rojoState?.dataModel !== undefined) {
    let filePath = currentDocUri;
    try {
      if (currentDocUri.startsWith('file://')) {
        filePath = decodeURIComponent(currentDocUri.replace('file:///', '').replace('file://', ''));
        if (filePath.match(/^\/[a-zA-Z]:/)) {
          filePath = filePath.slice(1);
        }
      }
    } catch {
      /* noop */
    }

    const dataModelPath = getDataModelPath(rojoState.dataModel, filePath);
    if (dataModelPath !== undefined) currentDataModelPath = dataModelPath;
  }

  const lines = content.split('\n');
  let insertLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (line === '' || line.startsWith('--')) {
      insertLine = i + 1;
    } else {
      break;
    }
  }

  for (let i = insertLine; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (line.startsWith('local') && line.includes('require(')) {
      insertLine = i + 1;
    } else if (line !== '' && line.startsWith('--') === false) {
      break;
    }
  }

  const items: CompletionItem[] = [];
  const seenNames = new Set<string>();

  for (const exp of exports) {
    if (seenNames.has(exp.name)) continue;
    seenNames.add(exp.name);

    if (exp.filePath === currentDocUri) continue;

    let requirePath: string;
    if (currentDataModelPath.length > 0) {
      requirePath = generateRequirePath(currentDataModelPath, exp.modulePath.split('.'));
    } else {
      requirePath = `game.${exp.modulePath}`;
    }

    const pathParts = exp.modulePath.split('.');
    const moduleName = pathParts[pathParts.length - 1] ?? 'Module';

    const requireStatement = `local ${moduleName} = require(${requirePath})\n`;

    const item: CompletionItem = {
      'label': exp.name,
      'kind':
        exp.kind === 'function'
          ? CompletionItemKind.Function
          : exp.kind === 'type'
            ? CompletionItemKind.Interface
            : CompletionItemKind.Variable,
      'detail': `(auto-import) from ${exp.modulePath}`,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': `Import \`${exp.name}\` from \`${exp.modulePath}\`\n\n\`\`\`lua\n${requireStatement}\`\`\``,
      },
      'sortText': `2_${exp.name}`,
      'insertText': `${moduleName}.${exp.name}`,
      'additionalTextEdits': [TextEdit.insert(Position.create(insertLine, 0), requireStatement)],
    };

    items.push(item);
  }

  return items;
};

const getLiveGameTreeNodeType = (
  path: string[],
  liveGameModel: LiveGameModel,
  documentManager: DocumentManager,
): ClassType | undefined => {
  if (liveGameModel.isConnected === false) return undefined;
  if (path.length === 0) return undefined;

  const node = liveGameModel.getNode(path);
  if (node === undefined) return undefined;

  const classType = documentManager.globalEnv.robloxClasses.get(node.className);
  if (classType !== undefined && classType.kind === 'Class') return classType;

  return undefined;
};

const getLiveGameTreeCompletions = (path: string[], prefix: string, liveGameModel: LiveGameModel): CompletionItem[] => {
  if (liveGameModel.isConnected === false) return [];

  const children = liveGameModel.getChildren(path);
  if (children === undefined) return [];

  const items: CompletionItem[] = [];

  for (const [name, node] of children) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    items.push({
      'label': name,
      'kind': CompletionItemKind.Field,
      'detail': `(live) ${node.className}`,
      'sortText': `0_${name}`,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': `Live instance from connected game\n\n**Class:** \`${node.className}\`${node.children !== undefined ? `\n**Children:** ${node.children.length}` : ''}`,
      },
    });
  }

  return items;
};

const CHILD_ACCESS_METHODS = new Set(['WaitForChild', 'FindFirstChild']);

const extractStringArg = (expr: string, startIdx: number): { value: string; endIdx: number } | undefined => {
  let i = startIdx;
  while (i < expr.length && /\s/.test(expr[i] ?? '')) i++;

  const opener = expr[i];
  if (opener === '(' || opener === "'" || opener === '"') {
    const isParenWrapped = opener === '(';
    if (isParenWrapped) {
      i++;
      while (i < expr.length && /\s/.test(expr[i] ?? '')) i++;
    }

    const quote = expr[i];
    if (quote === "'" || quote === '"') {
      i++;
      let value = '';
      while (i < expr.length && expr[i] !== quote) {
        value += expr[i];
        i++;
      }
      if (i < expr.length) i++;
      if (isParenWrapped) {
        while (i < expr.length && expr[i] !== ')') i++;
        if (i < expr.length) i++;
      }
      if (value !== '') return { value, 'endIdx': i };
    }
  }
  return undefined;
};

const splitPathExpression = (expr: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    if (char === '.') {
      if (current !== '') {
        parts.push(current);
        current = '';
      }
      i++;
    } else if (char === '[') {
      if (current !== '') {
        parts.push(current);
        current = '';
      }
      i++;
      while (i < expr.length && /\s/.test(expr[i] ?? '')) i++;
      const quote = expr[i];
      if (quote === '"' || quote === "'") {
        i++;
        let name = '';
        while (i < expr.length && expr[i] !== quote) {
          name += expr[i];
          i++;
        }
        if (name !== '') parts.push(name);
        i++;
        while (i < expr.length && expr[i] !== ']') i++;
        i++;
      } else {
        while (i < expr.length && expr[i] !== ']') i++;
        i++;
      }
    } else if (char === ':') {
      if (current !== '') {
        if (CHILD_ACCESS_METHODS.has(current)) {
          const arg = extractStringArg(expr, i + 1);
          if (arg !== undefined) {
            parts.push(arg.value);
            current = '';
            i = arg.endIdx;
            continue;
          }
        }
        parts.push(current);
        current = '';
      }
      i++;
    } else if (/\w/.test(char ?? '')) {
      current += char;
      i++;
    } else if ((char === "'" || char === '"') && CHILD_ACCESS_METHODS.has(current)) {
      const arg = extractStringArg(expr, i);
      if (arg !== undefined) {
        parts.push(arg.value);
        current = '';
        i = arg.endIdx;
        continue;
      }
      i++;
    } else if (char === '(') {
      if (CHILD_ACCESS_METHODS.has(current)) {
        const arg = extractStringArg(expr, i);
        if (arg !== undefined) {
          parts.push(arg.value);
          current = '';
          i = arg.endIdx;
          continue;
        }
      }
      if (current !== '') {
        current = '';
      }
      let depth = 1;
      i++;
      while (i < expr.length && depth > 0) {
        if (expr[i] === '(') depth++;
        else if (expr[i] === ')') depth--;
        i++;
      }
    } else {
      i++;
    }
  }

  if (current !== '' && CHILD_ACCESS_METHODS.has(current) === false) parts.push(current);

  return parts;
};

const GAME_SERVICE_NAMES = new Set([
  'Workspace',
  'Players',
  'ReplicatedStorage',
  'ReplicatedFirst',
  'ServerStorage',
  'ServerScriptService',
  'StarterGui',
  'StarterPack',
  'StarterPlayer',
  'Lighting',
  'SoundService',
  'Chat',
  'Teams',
  'CoreGui',
  'StarterPlayerScripts',
  'StarterCharacterScripts',
]);

const parseGameTreePath = (expression: string): string[] | undefined => {
  const expr = expression.trim();

  if (expr.startsWith('game.') || expr.startsWith('game:') || expr.startsWith('game[')) {
    let rest = expr.slice(4);
    if (rest.startsWith('.') || rest.startsWith(':')) rest = rest.slice(1);

    const getServiceMatch = rest.match(/^[Gg]et[Ss]ervice\s*(?:\(\s*["'](\w+)["']\s*\)|["'](\w+)["'])/);
    if (getServiceMatch !== null) {
      const serviceName = getServiceMatch[1] ?? getServiceMatch[2];
      if (serviceName === undefined) return undefined;

      const remaining = rest.slice(getServiceMatch[0].length);
      const path = [serviceName];
      if (remaining !== '') path.push(...splitPathExpression(remaining));
      return path;
    }

    const parts = splitPathExpression(rest);
    return parts.length > 0 ? parts : undefined;
  }

  if (expr.startsWith('workspace.') || expr.startsWith('workspace:') || expr.startsWith('workspace[')) {
    let rest = expr.slice(9);
    if (rest.startsWith('.') || rest.startsWith(':')) rest = rest.slice(1);
    const parts = splitPathExpression(rest);
    return ['Workspace', ...parts];
  }

  if (expr === 'workspace') return ['Workspace'];

  const firstIdent = expr.match(/^(\w+)/);
  if (firstIdent !== null && firstIdent[1] !== undefined && GAME_SERVICE_NAMES.has(firstIdent[1])) {
    const serviceName = firstIdent[1];
    const rest = expr.slice(serviceName.length);
    if (rest === '') return [serviceName];
    const parts = splitPathExpression(rest);
    return [serviceName, ...parts];
  }

  return undefined;
};

const extractRequireExpression = (beforeCursor: string): ModuleReference | undefined => {
  const requireMatch = beforeCursor.match(/require\s*\(\s*game[.[\]]([^)]+)\s*\)[.:]\s*$/);
  if (requireMatch === null) return undefined;

  const rawPath = requireMatch[1];
  if (rawPath === undefined) return undefined;

  const pathParts = splitMemberExpression(rawPath).filter(p => p.length > 0);
  if (pathParts.length === 0) return undefined;

  return { 'kind': 'path', 'path': pathParts };
};

const formatModuleDetail = (entry: ModuleFileEntry): string => {
  if (entry.exports.length === 0) return entry.isFolder ? 'module' : 'Luau';

  const funcs = entry.exports.filter(e => e.kind === 'function');
  const values = entry.exports.filter(e => e.kind !== 'function');

  const parts: string[] = [];
  if (funcs.length > 0) parts.push(`${funcs.length} function${funcs.length > 1 ? 's' : ''}`);
  if (values.length > 0) parts.push(`${values.length} value${values.length > 1 ? 's' : ''}`);
  return parts.join(', ');
};

const formatModuleDoc = (entry: ModuleFileEntry): string => {
  if (entry.exports.length === 0) return '';

  const lines: string[] = ['```lua'];
  for (const exp of entry.exports.slice(0, 15)) {
    const icon = exp.kind === 'function' ? 'function' : exp.kind === 'table' ? 'table' : 'value';
    lines.push(`${exp.name}: ${icon}`);
  }
  if (entry.exports.length > 15) lines.push(`... and ${entry.exports.length - 15} more`);
  lines.push('```');
  return lines.join('\n');
};

const getLocalRequireCompletions = (beforeCursor: string, documentUri: string): CompletionItem[] | undefined => {
  const match = beforeCursor.match(/require\s*\(\s*["'](\.\.?\/[^"']*)$/);
  if (match === null) return undefined;

  const partialPath = match[1];
  if (partialPath === undefined) return undefined;

  let filePath: string;
  try {
    filePath = decodeURIComponent(new URL(documentUri).pathname);
    if (filePath.match(/^\/[A-Za-z]:/) !== null) filePath = filePath.slice(1);
  } catch {
    return undefined;
  }

  const currentDir = filePath.replace(/[/\\][^/\\]*$/, '');
  const lastSlash = partialPath.lastIndexOf('/');
  const dirPart = partialPath.slice(0, lastSlash + 1);
  const prefix = partialPath.slice(lastSlash + 1).toLowerCase();

  const searchDir = path.resolve(currentDir, dirPart);
  const entries = listModuleFiles(searchDir);
  if (entries.length === 0) return undefined;

  const items: CompletionItem[] = [];
  for (const entry of entries) {
    if (prefix.length > 0 && entry.name.toLowerCase().startsWith(prefix) === false) continue;

    const detail = formatModuleDetail(entry);
    const doc = formatModuleDoc(entry);

    const item: CompletionItem = {
      'label': entry.name,
      'labelDetails': { 'description': entry.ext },
      'kind': CompletionItemKind.Module,
      'detail': detail,
      'sortText': `0_${entry.name}`,
    };

    if (doc.length > 0) item.documentation = { 'kind': MarkupKind.Markdown, 'value': doc };

    items.push(item);
  }

  return items.length > 0 ? items : undefined;
};

const moduleInterfaceCache = new Map<string, { items: CompletionItem[]; timestamp: number }>();
const MODULE_CACHE_TTL = 30_000;

const getRequireModuleCompletions = async (
  beforeCursor: string,
  executorBridge: ExecutorBridge,
): Promise<CompletionItem[] | undefined> => {
  if (executorBridge.isConnected === false) return undefined;

  const moduleRef = extractRequireExpression(beforeCursor);
  if (moduleRef === undefined) return undefined;

  const cacheKey = moduleRef.kind === 'path' ? moduleRef.path.join('.') : String(moduleRef.id);
  const cached = moduleInterfaceCache.get(cacheKey);
  if (cached !== undefined && Date.now() - cached.timestamp < MODULE_CACHE_TTL) return cached.items;

  try {
    const result = await executorBridge.requestModuleInterface(moduleRef);
    if (result.success === false || result.interface === undefined) return undefined;

    const items: CompletionItem[] = [];
    const moduleInterface = result.interface;

    if (moduleInterface.kind === 'table' && moduleInterface.properties !== undefined) {
      for (const prop of moduleInterface.properties) {
        if (prop.name.startsWith('__')) continue;
        const item: CompletionItem = {
          'label': prop.name,
          'kind': prop.valueKind === 'function' ? CompletionItemKind.Function : CompletionItemKind.Field,
          'detail': `(runtime) ${prop.valueKind}`,
          'sortText': `0_${prop.name}`,
        };

        if (prop.valueKind === 'function' && prop.functionArity !== undefined) {
          item.detail = `(runtime) function (${prop.functionArity} params)`;
        }

        items.push(item);
      }
    }

    if (items.length > 0) {
      moduleInterfaceCache.set(cacheKey, { items, 'timestamp': Date.now() });
      return items;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

/** Sets up the completion handler for the LSP connection. */
export const setupCompletionHandler = (
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  documentManager: DocumentManager,
  executorBridge: ExecutorBridge,
): void => {
  const liveGameModel = executorBridge.liveGameModel;

  const log = (msg: string): void => {
    if (DEBUG_COMPLETION) connection.console.log(`[completion] ${msg}`);
  };

  connection.onCompletion(async (params: CompletionParams): Promise<CompletionList> => {
    const liveDoc = documents.get(params.textDocument.uri);
    if (liveDoc === undefined) return { 'isIncomplete': false, 'items': [] };

    const content = liveDoc.getText();
    const lines = content.split('\n');
    const line = lines[params.position.line];
    if (line === undefined) return { 'isIncomplete': false, 'items': [] };

    const beforeCursor = line.slice(0, params.position.character);
    log(`beforeCursor: "${beforeCursor}"`);

    const document = documentManager.getDocument(params.textDocument.uri);
    log(`document exists: ${document !== undefined}, has typeCheck: ${document?.typeCheckResult !== undefined}`);

    const liveServiceCompletions = getLiveServiceCompletions(beforeCursor, liveGameModel);
    if (liveServiceCompletions !== undefined) return { 'isIncomplete': true, 'items': liveServiceCompletions };

    const bracketCompletions = getBracketCompletions(beforeCursor, liveGameModel);
    if (bracketCompletions !== undefined) return { 'isIncomplete': true, 'items': bracketCompletions };

    const stringCompletions = getStringCompletions(beforeCursor, documentManager);
    if (stringCompletions !== undefined) return { 'isIncomplete': true, 'items': stringCompletions };

    const enumCompletions = getEnumCompletions(beforeCursor, documentManager);
    if (enumCompletions !== undefined) return { 'isIncomplete': true, 'items': enumCompletions };

    const typeAnnotMatch = beforeCursor.match(/\w\s*:\s+(\w*)$/) ?? beforeCursor.match(/\)\s*:\s*(\w*)$/);
    if (typeAnnotMatch !== null) {
      const prefix = typeAnnotMatch[1] ?? '';
      const items: CompletionItem[] = [];
      const addedNames = new Set<string>();

      const addType = (name: string, detail: string, sortPrefix: string): void => {
        if (addedNames.has(name)) return;
        if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) return;
        addedNames.add(name);
        items.push({
          'label': name,
          'kind': CompletionItemKind.TypeParameter,
          'detail': detail,
          'sortText': `${sortPrefix}${name}`,
        });
      };

      if (document?.typeCheckResult !== undefined) {
        const walkScope = (scope: typeof document.typeCheckResult.environment.globalScope): void => {
          for (const [name] of scope.types) addType(name, 'type alias', '0_');
          if (scope.parent !== undefined) walkScope(scope.parent);
        };
        walkScope(document.typeCheckResult.environment.globalScope);
      }

      for (const [name] of documentManager.globalEnv.robloxClasses) addType(name, 'Roblox class', '1_');
      for (const [name] of documentManager.globalEnv.robloxDataTypes) addType(name, 'Roblox type', '1_');

      const builtinTypes = ['string', 'number', 'boolean', 'nil', 'any', 'never', 'unknown', 'thread', 'buffer'];
      for (const name of builtinTypes) addType(name, 'primitive', '2_');

      if (items.length > 0) return { 'isIncomplete': true, items };
    }

    const requireModuleCompletions = await getRequireModuleCompletions(beforeCursor, executorBridge);
    if (requireModuleCompletions !== undefined) return { 'isIncomplete': true, 'items': requireModuleCompletions };

    const localRequireCompletions = getLocalRequireCompletions(beforeCursor, params.textDocument.uri);
    if (localRequireCompletions !== undefined) return { 'isIncomplete': true, 'items': localRequireCompletions };

    const tableContext = detectTableFieldContext(beforeCursor);
    if (tableContext !== undefined) {
      const expectedType = getExpectedParameterType(
        tableContext.functionName,
        tableContext.paramIndex,
        documentManager,
      );
      if (expectedType !== undefined) {
        const tableFieldItems = getTableFieldCompletions(
          expectedType,
          tableContext.existingFields,
          tableContext.prefix,
        );
        if (tableFieldItems.length > 0) return { 'isIncomplete': true, 'items': tableFieldItems };
      }
    }

    const chainInfo = extractExpressionChain(beforeCursor);
    log(`chainInfo: ${JSON.stringify(chainInfo)}`);
    if (chainInfo !== null && chainInfo !== undefined) {
      let gameTreePath = parseGameTreePath(chainInfo.expression);

      if (gameTreePath === undefined) {
        const traceFirst = chainInfo.expression.split(/[.:]/)[0]?.trim();
        if (traceFirst !== undefined) {
          const tracedExpr = traceVarExpression(traceFirst, content);
          if (tracedExpr !== undefined) {
            const fullExpr = chainInfo.expression.replace(traceFirst, tracedExpr);
            gameTreePath = parseGameTreePath(fullExpr) ?? undefined;
            log(`Traced '${traceFirst}' → '${tracedExpr}', gameTreePath: ${JSON.stringify(gameTreePath)}`);
          }
        }
      }

      log(`gameTreePath: ${JSON.stringify(gameTreePath)}`);

      let resolvedType = resolveExpressionType(
        chainInfo.expression,
        documentManager,
        document,
        content,
        log,
        params.textDocument.uri,
      );
      log(
        `resolvedType: ${resolvedType?.kind}${resolvedType?.kind === 'Class' ? ` (${(resolvedType as ClassType).name})` : ''}`,
      );

      if (resolvedType !== undefined && resolvedType.kind === 'TypeReference') {
        resolvedType = resolveTypeReference(resolvedType, documentManager);
      }

      if (resolvedType !== undefined) {
        if (resolvedType.kind === 'Class') {
          const classItems = getClassCompletions(
            resolvedType,
            chainInfo.prefix,
            chainInfo.isMethodAccess,
            documentManager,
          );

          if (gameTreePath !== undefined && chainInfo.isMethodAccess === false) {
            const liveItems = getLiveGameTreeCompletions(gameTreePath, chainInfo.prefix, liveGameModel);
            log(`liveItems count: ${liveItems.length}`);

            const seenNames = new Set(liveItems.map(i => i.label));
            const uniqueClassItems = classItems.filter(i => seenNames.has(i.label) === false);

            return {
              'isIncomplete': true,
              'items': [...liveItems, ...uniqueClassItems],
            };
          }

          return {
            'isIncomplete': true,
            'items': classItems,
          };
        }
        if (resolvedType.kind === 'Table') {
          return {
            'isIncomplete': true,
            'items': getTableCompletions(resolvedType, chainInfo.prefix),
          };
        }
      }

      if (resolvedType === undefined && executorBridge.isConnected) {
        const firstName = chainInfo.expression.split(/[.:]/)[0]?.trim();
        if (firstName !== undefined) {
          const assignExpr = traceVarExpression(firstName, content);
          log(`Traced '${firstName}' to: ${assignExpr ?? 'undefined'}`);

          const reqExprMatch = assignExpr?.match(/^require\s*\(\s*([^)]+)\s*\)(.*)/);
          if (reqExprMatch !== null && reqExprMatch !== undefined && reqExprMatch[1] !== undefined) {
            const rawModulePath = reqExprMatch[1].trim();
            const rawChain = (reqExprMatch[2] ?? '').trim();
            const parenIdx = rawChain.indexOf('(');
            const chainedCall = parenIdx >= 0 ? rawChain.slice(0, parenIdx) + '()' : rawChain;
            log(`Trying executor bridge for require: ${rawModulePath}${chainedCall}`);
            try {
              const serviceNames = [
                'ReplicatedStorage',
                'ReplicatedFirst',
                'ServerStorage',
                'ServerScriptService',
                'StarterGui',
                'StarterPack',
                'StarterPlayer',
                'Lighting',
                'SoundService',
                'Workspace',
                'Players',
                'Chat',
                'Teams',
              ];
              const preamble: string[] = [];
              for (const svc of serviceNames) {
                if (rawModulePath.startsWith(svc)) {
                  preamble.push(`local ${svc} = game:GetService("${svc}")`);
                  break;
                }
              }
              const modulePath = rawModulePath;

              const inspectScript = [
                ...preamble,
                `local mod = require(${modulePath})`,
                chainedCall.length > 0 ? `mod = mod${chainedCall}` : '',
                'local result = {}',
                'local visited = {}',
                'local current = mod',
                'while current and type(current) == "table" do',
                '  if visited[current] then break end',
                '  visited[current] = true',
                '  for k, v in pairs(current) do',
                '    if type(k) == "string" and not result[k] and k:sub(1,2) ~= "__" then',
                '      result[k] = type(v)',
                '    end',
                '  end',
                '  local mt = getmetatable(current)',
                '  current = mt and type(mt) == "table" and mt.__index or nil',
                'end',
                'return game:GetService("HttpService"):JSONEncode(result)',
              ]
                .filter(l => l.length > 0)
                .join('\n');

              const execResult = await executorBridge.execute(inspectScript);
              log(
                `Bridge exec result: success=${execResult.success}, result=${execResult.result ?? 'undefined'}, error=${execResult.error?.message ?? 'none'}`,
              );
              if (execResult.success && execResult.result !== undefined) {
                const members: Record<string, string> = JSON.parse(execResult.result);
                const items: CompletionItem[] = [];
                for (const [name, valueType] of Object.entries(members)) {
                  items.push({
                    'label': name,
                    'kind': valueType === 'function' ? CompletionItemKind.Function : CompletionItemKind.Field,
                    'detail': valueType,
                    'sortText': `0_${name}`,
                  });
                }
                if (items.length > 0) return { 'isIncomplete': true, items };
              }
            } catch {
              log(`Executor bridge inspect request failed`);
            }
          }
        }
      }

      if (gameTreePath !== undefined) {
        const liveNodeType = getLiveGameTreeNodeType(gameTreePath, liveGameModel, documentManager);
        log(
          `liveNodeType: ${liveNodeType?.kind ?? 'undefined'}${liveNodeType?.kind === 'Class' ? ` (${liveNodeType.name})` : ''}`,
        );

        if (liveNodeType !== undefined) {
          const classItems = getClassCompletions(
            liveNodeType,
            chainInfo.prefix,
            chainInfo.isMethodAccess,
            documentManager,
          );

          if (chainInfo.isMethodAccess === false) {
            const liveItems = getLiveGameTreeCompletions(gameTreePath, chainInfo.prefix, liveGameModel);
            log(`liveItems (from type) count: ${liveItems.length}`);

            const seenNames = new Set(liveItems.map(i => i.label));
            const uniqueClassItems = classItems.filter(i => seenNames.has(i.label) === false);

            return {
              'isIncomplete': true,
              'items': [...liveItems, ...uniqueClassItems],
            };
          }

          return {
            'isIncomplete': true,
            'items': classItems,
          };
        }

        if (chainInfo.isMethodAccess === false) {
          const liveItems = getLiveGameTreeCompletions(gameTreePath, chainInfo.prefix, liveGameModel);
          log(`liveItems (fallback) count: ${liveItems.length}`);

          const lastPathSegment = gameTreePath[gameTreePath.length - 1];
          let staticClassItems: CompletionItem[] = [];

          if (lastPathSegment !== undefined) {
            const classType = documentManager.globalEnv.robloxClasses.get(lastPathSegment);
            if (classType !== undefined && classType.kind === 'Class') {
              staticClassItems = getClassCompletions(classType, chainInfo.prefix, false, documentManager);
              log(`staticClassItems (from path) count: ${staticClassItems.length}`);
            }
          }

          if (liveItems.length > 0 || staticClassItems.length > 0) {
            const seenNames = new Set(liveItems.map(i => i.label));
            const uniqueStaticItems = staticClassItems.filter(i => seenNames.has(i.label) === false);

            return {
              'isIncomplete': true,
              'items': [...liveItems, ...uniqueStaticItems],
            };
          }
        }
      }

      const hasChain =
        chainInfo.expression.includes('.') || chainInfo.expression.includes(':') || chainInfo.expression.includes('[');

      if (hasChain) return { 'isIncomplete': false, 'items': [] };

      const classType = documentManager.globalEnv.robloxClasses.get(chainInfo.expression);
      if (classType !== undefined && classType.kind === 'Class') {
        return {
          'isIncomplete': true,
          'items': getClassCompletions(classType, chainInfo.prefix, chainInfo.isMethodAccess, documentManager),
        };
      }

      const hintedClass = VARIABLE_NAME_HINTS.get(chainInfo.expression.toLowerCase());
      if (hintedClass !== undefined) {
        const hintedClassType = documentManager.globalEnv.robloxClasses.get(hintedClass);
        if (hintedClassType !== undefined && hintedClassType.kind === 'Class') {
          return {
            'isIncomplete': true,
            'items': getClassCompletions(hintedClassType, chainInfo.prefix, chainInfo.isMethodAccess, documentManager),
          };
        }
      }
    }

    debugLog('Fallback: trying simple member/method patterns');
    const memberMatch = beforeCursor.match(/(\w+)\.(\w*)$/);
    const methodMatch = beforeCursor.match(/(\w+):(\w*)$/);
    debugLog('methodMatch:', methodMatch);

    if (memberMatch !== null) {
      const [, objectName, prefix] = memberMatch;
      if (objectName === undefined) return { 'isIncomplete': false, 'items': [] };

      if (document?.typeCheckResult !== undefined) {
        const localType = document.typeCheckResult.allSymbols.get(objectName);
        if (localType !== undefined) {
          const resolved = resolveTypeReference(localType, documentManager);
          if (resolved.kind === 'Table') {
            return {
              'isIncomplete': true,
              'items': getTableCompletions(resolved, prefix ?? ''),
            };
          }
          if (resolved.kind === 'Class') {
            return {
              'isIncomplete': true,
              'items': getClassCompletions(resolved, prefix ?? '', false, documentManager),
            };
          }
        }
      }

      const symbol = documentManager.globalEnv.env.globalScope.symbols.get(objectName);
      if (symbol !== undefined) {
        if (symbol.type.kind === 'Table') {
          return {
            'isIncomplete': true,
            'items': getTableCompletions(symbol.type, prefix ?? ''),
          };
        }
        if (symbol.type.kind === 'Class') {
          return {
            'isIncomplete': true,
            'items': getClassCompletions(symbol.type, prefix ?? '', false, documentManager),
          };
        }
      }

      const classType = documentManager.globalEnv.robloxClasses.get(objectName);
      if (classType !== undefined && classType.kind === 'Class') {
        return {
          'isIncomplete': true,
          'items': getClassCompletions(classType, prefix ?? '', false, documentManager),
        };
      }

      const hintedClass = VARIABLE_NAME_HINTS.get(objectName.toLowerCase());
      if (hintedClass !== undefined) {
        const hintedClassType = documentManager.globalEnv.robloxClasses.get(hintedClass);
        if (hintedClassType !== undefined && hintedClassType.kind === 'Class') {
          return {
            'isIncomplete': true,
            'items': getClassCompletions(hintedClassType, prefix ?? '', false, documentManager),
          };
        }
      }
    }

    if (methodMatch !== null) {
      const [, objectName, prefix] = methodMatch;
      if (objectName === undefined) return { 'isIncomplete': false, 'items': [] };

      if (document?.typeCheckResult !== undefined) {
        const localType = document.typeCheckResult.allSymbols.get(objectName);
        if (localType !== undefined) {
          const resolved = resolveTypeReference(localType, documentManager);
          if (resolved.kind === 'Class') {
            return {
              'isIncomplete': true,
              'items': getClassCompletions(resolved, prefix ?? '', true, documentManager),
            };
          }
          if (resolved.kind === 'Table') {
            return {
              'isIncomplete': true,
              'items': getTableCompletions(resolved, prefix ?? ''),
            };
          }
        }
      }

      const symbol = documentManager.globalEnv.env.globalScope.symbols.get(objectName);
      if (symbol !== undefined && symbol.type.kind === 'Class') {
        return {
          'isIncomplete': true,
          'items': getClassCompletions(symbol.type, prefix ?? '', true, documentManager),
        };
      }

      const classType = documentManager.globalEnv.robloxClasses.get(objectName);
      if (classType !== undefined && classType.kind === 'Class') {
        return {
          'isIncomplete': true,
          'items': getClassCompletions(classType, prefix ?? '', true, documentManager),
        };
      }

      const hintedClass = VARIABLE_NAME_HINTS.get(objectName.toLowerCase());
      if (hintedClass !== undefined) {
        const hintedClassType = documentManager.globalEnv.robloxClasses.get(hintedClass);
        if (hintedClassType !== undefined && hintedClassType.kind === 'Class') {
          return {
            'isIncomplete': true,
            'items': getClassCompletions(hintedClassType, prefix ?? '', true, documentManager),
          };
        }
      }
    }

    const wordMatch = beforeCursor.match(/(\w*)$/);
    const prefix = wordMatch?.[1] ?? '';

    const localItems = getLocalSymbolCompletions(document, prefix, documentManager);
    const globalItems = getGlobalCompletions(documentManager, prefix);
    const snippetItems = getSnippetCompletions(prefix);
    const autoImportItems = getAutoImportCompletions(prefix, documentManager, params.textDocument.uri, content);

    return {
      'isIncomplete': true,
      'items': [...localItems, ...globalItems, ...snippetItems, ...autoImportItems],
    };
  });

  connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    const data = item.data as { resolve?: string; name?: string } | undefined;
    if (data === undefined || data.resolve === undefined) return item;

    if (data.resolve === 'global' && data.name !== undefined) {
      const symbol = documentManager.globalEnv.env.globalScope.symbols.get(data.name);
      if (symbol !== undefined) {
        const documentation = formatDocumentation(symbol.docComment);
        if (documentation !== undefined) item.documentation = documentation;

        if (symbol.type.kind === 'Function' && symbol.type.description !== undefined) {
          const parts: string[] = [];
          parts.push(symbol.type.description);
          if (symbol.type.example !== undefined) {
            parts.push('');
            parts.push('```lua');
            parts.push(symbol.type.example);
            parts.push('```');
          }
          if (item.documentation === undefined) {
            item.documentation = { 'kind': MarkupKind.Markdown, 'value': parts.join('\n') };
          }
        }
      }
    }

    return item;
  });
};
