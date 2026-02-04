/**
 * Completion Handler
 * Provides autocompletion suggestions
 */

import { COMMON_CHILDREN, getCommonChildType } from '@definitions/commonChildren';
import { type ExecutorBridge } from '@executor';
import { formatDocCommentForDisplay } from '@parser/docComment';
import { typeToString } from '@typings/types';
import { generateRequirePath } from '@workspace/moduleIndex';
import { getDataModelPath } from '@workspace/rojo';
import {
  CompletionItemKind,
  CompletionItemTag,
  InsertTextFormat,
  MarkupKind,
  Position,
  TextEdit,
} from 'vscode-languageserver';

import type { LiveGameModel } from '@executor/gameTree';
import type { ModuleReference } from '@executor/protocol';
import type { DocumentManager, ParsedDocument } from '@lsp/documents';
import type { DocComment } from '@parser/docComment';
import type { ClassType, FunctionType, LuauType, TableType } from '@typings/types';
import type {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Connection,
  TextDocuments,
} from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

// Map of common variable names to their likely class types
const VARIABLE_NAME_HINTS: ReadonlyMap<string, string> = new Map([
  // Player variations
  ['player', 'Player'],
  ['plr', 'Player'],
  ['localPlayer', 'Player'],
  ['lp', 'Player'],
  ['localplayer', 'Player'],
  // Character/Model variations
  ['character', 'Model'],
  ['char', 'Model'],
  ['model', 'Model'],
  ['mdl', 'Model'],
  // Humanoid variations
  ['humanoid', 'Humanoid'],
  ['hum', 'Humanoid'],
  ['h', 'Humanoid'],
  // Parts
  ['part', 'BasePart'],
  ['basePart', 'BasePart'],
  ['meshPart', 'MeshPart'],
  ['unionOperation', 'UnionOperation'],
  ['head', 'BasePart'],
  ['torso', 'BasePart'],
  ['hrp', 'BasePart'],
  ['humanoidRootPart', 'BasePart'],
  ['rootPart', 'BasePart'],
  // Camera
  ['camera', 'Camera'],
  ['cam', 'Camera'],
  ['currentCamera', 'Camera'],
  // GUI
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
  // Audio
  ['sound', 'Sound'],
  ['music', 'Sound'],
  ['sfx', 'Sound'],
  // Animation
  ['animation', 'Animation'],
  ['anim', 'Animation'],
  ['animator', 'Animator'],
  ['animationTrack', 'AnimationTrack'],
  ['track', 'AnimationTrack'],
  // Tools and accessories
  ['tool', 'Tool'],
  ['accessory', 'Accessory'],
  // Organization
  ['folder', 'Folder'],
  ['configuration', 'Configuration'],
  // Remotes
  ['remote', 'RemoteEvent'],
  ['remoteEvent', 'RemoteEvent'],
  ['remoteFunction', 'RemoteFunction'],
  ['bindable', 'BindableEvent'],
  ['bindableEvent', 'BindableEvent'],
  ['bindableFunction', 'BindableFunction'],
  // Signals
  ['connection', 'RBXScriptConnection'],
  ['conn', 'RBXScriptConnection'],
  ['signal', 'RBXScriptSignal'],
  // Tweens
  ['tween', 'Tween'],
  ['tweenInfo', 'TweenInfo'],
  // Values
  ['value', 'ValueBase'],
  ['boolValue', 'BoolValue'],
  ['intValue', 'IntValue'],
  ['numberValue', 'NumberValue'],
  ['stringValue', 'StringValue'],
  ['objectValue', 'ObjectValue'],
  // Physics
  ['attachment', 'Attachment'],
  ['constraint', 'Constraint'],
  ['weld', 'WeldConstraint'],
  ['motor', 'Motor6D'],
  // Effects
  ['light', 'Light'],
  ['pointLight', 'PointLight'],
  ['spotLight', 'SpotLight'],
  ['surfaceLight', 'SurfaceLight'],
  ['beam', 'Beam'],
  ['trail', 'Trail'],
  ['particle', 'ParticleEmitter'],
  ['particles', 'ParticleEmitter'],
  ['highlight', 'Highlight'],
  // Misc
  ['instance', 'Instance'],
  ['child', 'Instance'],
  ['parent', 'Instance'],
  ['descendant', 'Instance'],
  ['ancestor', 'Instance'],
  ['clone', 'Instance'],
]);

// Roblox services that can be obtained via GetService
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

/** Classes that can be created with Instance.new (auto-generated from roblox-api.json) */
const CREATABLE_CLASSES = [
  // Parts and BaseParts
  'Part',
  'WedgePart',
  'CornerWedgePart',
  'TrussPart',
  'MeshPart',
  'SpawnLocation',
  'Seat',
  'VehicleSeat',
  'SkateboardPlatform',
  // CSG Operations
  'UnionOperation',
  'NegateOperation',
  'IntersectOperation',
  'PartOperation',
  'PartOperationAsset',
  'OperationGraph',
  // Models and Actors
  'Model',
  'Actor',
  'WorldModel',
  // Values
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
  // Constraints
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
  // Joints and Welds
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
  // UI - Containers
  'ScreenGui',
  'SurfaceGui',
  'BillboardGui',
  'AdGui',
  'GuiMain',
  'RelativeGui',
  // UI - Elements
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
  // UI - Layouts
  'UIListLayout',
  'UIGridLayout',
  'UITableLayout',
  'UIPageLayout',
  // UI - Modifiers
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
  // Effects - Particles
  'ParticleEmitter',
  'Fire',
  'Smoke',
  'Sparkles',
  'Explosion',
  // Effects - Lighting
  'PointLight',
  'SpotLight',
  'SurfaceLight',
  'Beam',
  'Trail',
  'Highlight',
  // Effects - Post-processing
  'BloomEffect',
  'BlurEffect',
  'ColorCorrectionEffect',
  'ColorGradingEffect',
  'DepthOfFieldEffect',
  'SunRaysEffect',
  // Effects - Atmosphere
  'Atmosphere',
  'Clouds',
  'Sky',
  // Selection and Handles
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
  // Sounds
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
  // Audio (new API)
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
  // Video
  'VideoDeviceInput',
  'VideoDisplay',
  'VideoPlayer',
  // Scripts
  'Script',
  'LocalScript',
  'ModuleScript',
  'AuroraScript',
  // Remote and Bindable
  'RemoteEvent',
  'RemoteFunction',
  'BindableEvent',
  'BindableFunction',
  'UnreliableRemoteEvent',
  // Animation
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
  // Character
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
  // Avatar Rules
  'AvatarRules',
  'AvatarAccessoryRules',
  'AvatarAnimationRules',
  'AvatarBodyRules',
  'AvatarClothingRules',
  'AvatarCollisionRules',
  // Body movers (legacy)
  'BodyForce',
  'BodyVelocity',
  'BodyPosition',
  'BodyGyro',
  'BodyAngularVelocity',
  'BodyThrust',
  'RocketPropulsion',
  // Controllers
  'ControllerManager',
  'ControllerPartSensor',
  'AirController',
  'ClimbController',
  'GroundController',
  'SwimController',
  'HumanoidController',
  'VehicleController',
  'SkateboardController',
  // IK and Rigging
  'IKControl',
  'WrapDeformer',
  'WrapLayer',
  'WrapTarget',
  'WrapTextureTransfer',
  // Tools
  'Tool',
  'HopperBin',
  'Flag',
  'FlagStand',
  'Backpack',
  'StarterGear',
  // Camera
  'Camera',
  // Folders and Organization
  'Folder',
  'Configuration',
  // Physics and Attachments
  'Attachment',
  'Bone',
  'ForceField',
  // Sensors
  'AtmosphereSensor',
  'BuoyancySensor',
  'FluidForceSensor',
  // Interaction
  'ClickDetector',
  'DragDetector',
  'ProximityPrompt',
  'Dialog',
  'DialogChoice',
  // Appearance
  'Decal',
  'Texture',
  'SurfaceAppearance',
  'MaterialVariant',
  'TerrainDetail',
  'TerrainRegion',
  // Meshes
  'SpecialMesh',
  'BlockMesh',
  'CylinderMesh',
  'FileMesh',
  // DataStore
  'DataStoreOptions',
  'DataStoreSetOptions',
  'DataStoreIncrementOptions',
  'DataStoreGetOptions',
  // Text and Chat
  'TextChannel',
  'TextChatCommand',
  'TextChatMessageProperties',
  'BubbleChatMessageProperties',
  'TextGenerator',
  'GetTextBoundsParams',
  'LocalizationTable',
  // Localization/Message (legacy)
  'Message',
  'Hint',
  'FloorWire',
  // Teams and Players
  'Team',
  'Player',
  // Teleport
  'TeleportOptions',
  'ExperienceInviteOptions',
  // Pathfinding
  'PathfindingLink',
  'PathfindingModifier',
  // Tween
  'Tween',
  // Input
  'InputAction',
  'InputBinding',
  'InputContext',
  'HapticEffect',
  // Styling (new)
  'StyleSheet',
  'StyleRule',
  'StyleLink',
  'StyleDerive',
  'StyleQuery',
  // Annotation
  'Annotation',
  'WorkspaceAnnotation',
  // Wire
  'Wire',
  'Noise',
  // Services (some are creatable)
  'TestService',
  'ProximityPromptService',
  'MemoryStoreService',
  'FlyweightService',
  'CSGDictionaryService',
  'NonReplicatedCSGDictionaryService',
  'HeightmapImporterService',
  // Plugin/Studio (limited use)
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
  // Debug
  'Breakpoint',
  'DebuggerWatch',
  // Reflection Metadata (internal)
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
  // Testing
  'FunctionalTest',
  'RenderingTest',
  'CustomEvent',
  'CustomEventReceiver',
  'CustomLog',
  'InternalSyncItem',
  // Other/Misc
  'AdPortal',
  'HiddenSurfaceRemovalAsset',
  'MotorFeature',
  'Hole',
];

/**
 * Converts a Luau type to the corresponding LSP CompletionItemKind.
 * @param type - The Luau type to convert
 * @returns The appropriate CompletionItemKind for the type
 */
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

/**
 * Formats a function's parameter list as a detail string for completion items.
 * @param func - The FunctionType to format
 * @returns A string in the format "(param1, param2?, ...)"
 */
const formatFunctionDetail = (func: FunctionType): string => {
  const params = func.params.map(p => {
    const name = p.name ?? 'arg';
    const optional = p.optional ? '?' : '';
    return `${name}${optional}`;
  });
  return `(${params.join(', ')})`;
};

/**
 * Formats a DocComment as markdown documentation for completion items.
 * @param docComment - The DocComment to format, or undefined
 * @returns A markdown documentation object, or undefined if no documentation
 */
const formatDocumentation = (docComment: DocComment | undefined): { kind: 'markdown'; value: string } | undefined => {
  if (docComment === undefined) return undefined;

  const formatted = formatDocCommentForDisplay(docComment);
  if (formatted.length === 0) return undefined;

  return {
    'kind': MarkupKind.Markdown,
    'value': formatted,
  };
};

/**
 * Gets completion items for properties of a TableType.
 * @param table - The TableType to get completions from
 * @param prefix - The prefix to filter completions by (case-insensitive)
 * @returns Array of CompletionItem objects for matching properties
 */
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
      // Just insert the function name, signature help will show params
      item.insertText = name;
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

/**
 * Returns completion items for table field names that match the expected TableType.
 * Excludes fields that have already been defined in the current table literal.
 * @param expectedType - The expected TableType for the table literal
 * @param existingFields - Set of field names already defined in the table
 * @param prefix - The prefix to filter completions by (case-insensitive)
 * @returns Array of CompletionItem objects for missing table fields
 */
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

/**
 * Context information for table field completions inside a function call.
 */
interface TableContextInfo {
  /** The name of the function being called */
  readonly functionName: string;
  /** The index of the parameter being filled (0-based) */
  readonly paramIndex: number;
  /** Set of field names already defined in the table literal */
  readonly existingFields: Set<string>;
  /** The prefix the user has started typing */
  readonly prefix: string;
}

/**
 * Detects if the cursor is inside a table constructor being passed to a function call.
 * @param beforeCursor - The text content before the cursor position
 * @returns TableContextInfo with function name, parameter index, existing fields, and prefix, or undefined if not in a table context
 */
const detectTableFieldContext = (beforeCursor: string): TableContextInfo | undefined => {
  // Check if we're inside a table literal by looking for unmatched `{`
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

  // Get the part before the opening brace to find the function call
  const beforeTable = beforeCursor.slice(0, tableStartPos).trimEnd();

  // Match function call pattern: functionName( or functionName({
  // Also match method call: obj:methodName( or obj.methodName(
  const funcCallMatch = beforeTable.match(/([a-zA-Z_]\w*(?:\s*[.:]\s*[a-zA-Z_]\w*)*)\s*\(\s*$/);
  if (funcCallMatch === null) return undefined;

  const functionExpression = funcCallMatch[1];
  if (functionExpression === undefined) return undefined;

  // Extract just the function name (last identifier in the chain)
  const funcNameMatch = functionExpression.match(/([a-zA-Z_]\w*)$/);
  const functionName = funcNameMatch?.[1] ?? functionExpression;

  // Determine which parameter position we're at (currently simplified to always be 0)
  // A more complete implementation would count commas before this table
  const paramIndex = 0;

  // Parse existing fields in the table
  const insideTable = beforeCursor.slice(tableStartPos + 1);
  const existingFields = parseExistingTableFields(insideTable);

  // Get the prefix (what the user has started typing)
  const prefixMatch = insideTable.match(/(?:,|\{)\s*([a-zA-Z_]\w*)$/);
  let prefix = prefixMatch?.[1] ?? '';

  // Also check for a field name at the start of the table or after newline
  if (prefix === '') {
    const trimmed = insideTable.trimStart();
    const startMatch = trimmed.match(/^([a-zA-Z_]\w*)$/);
    if (startMatch !== null) {
      prefix = startMatch[1] ?? '';
    }
  }

  return {
    functionName,
    paramIndex,
    existingFields,
    prefix,
  };
};

/**
 * Parses the content inside a table literal to find existing field names.
 * @param tableContent - The string content inside the table braces
 * @returns A Set of field names that have been assigned in the table
 */
const parseExistingTableFields = (tableContent: string): Set<string> => {
  const fields = new Set<string>();

  // Match field assignments: FieldName = value or [key] = value
  // This regex looks for identifier followed by optional whitespace and =
  const fieldPattern = /([a-zA-Z_]\w*)\s*=/g;
  let match;

  while ((match = fieldPattern.exec(tableContent)) !== null) {
    if (match[1] !== undefined) {
      fields.add(match[1]);
    }
  }

  return fields;
};

/**
 * Resolves a function name to its expected parameter type at a given position.
 * @param functionName - The name of the function to look up
 * @param paramIndex - The 0-based index of the parameter
 * @param documentManager - The document manager for accessing global symbols
 * @returns The TableType expected at that parameter position, or undefined if not a table parameter
 */
const getExpectedParameterType = (
  functionName: string,
  paramIndex: number,
  documentManager: DocumentManager,
): TableType | undefined => {
  // Look up the function in global symbols
  const symbol = documentManager.globalEnv.env.globalScope.symbols.get(functionName);
  if (symbol === undefined) return undefined;
  if (symbol.type.kind !== 'Function') return undefined;

  const funcType = symbol.type;
  if (paramIndex >= funcType.params.length) return undefined;

  const param = funcType.params[paramIndex];
  if (param === undefined) return undefined;

  // Check if the expected parameter type is a TableType
  if (param.type.kind === 'Table') return param.type;

  return undefined;
};

/**
 * Collects common children names for a class and its superclasses.
 * @param className - The name of the class to get children for
 * @param getSuperclass - Function to get the superclass name for a given class
 * @returns Map of child names to their class types
 */
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

/**
 * Gets completion items for members of a ClassType, including properties, methods, and common children.
 * @param cls - The ClassType to get completions for
 * @param prefix - The prefix to filter completions by (case-insensitive)
 * @param useColon - Whether this is method access (colon notation)
 * @param documentManager - Optional document manager for resolving common children
 * @returns Array of CompletionItem objects for matching class members
 */
const getClassCompletions = (
  cls: ClassType,
  prefix: string,
  useColon: boolean,
  documentManager?: DocumentManager,
): CompletionItem[] => {
  const items: CompletionItem[] = [];
  const addedNames = new Set<string>();

  // Properties
  for (const [name, prop] of cls.properties) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const item: CompletionItem = {
      'label': name,
      'kind': typeToCompletionKind(prop.type),
    };

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

  // Methods
  for (const [name, method] of cls.methods) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const item: CompletionItem = {
      'label': name,
      'kind': CompletionItemKind.Method,
      'detail': formatFunctionDetail(method.func),
      'insertText': name,
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

  // Include inherited members
  if (cls.superclass !== undefined) {
    const inherited = getClassCompletions(cls.superclass, prefix, useColon, documentManager);
    for (const item of inherited) {
      if (addedNames.has(item.label) === false) {
        items.push(item);
        addedNames.add(item.label);
      }
    }
  }

  // Add common children as completions (only for property access, not method access)
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

/**
 * Gets completion items for global symbols and functions.
 * @param documentManager - The document manager containing the global environment
 * @param prefix - The prefix to filter completions by (case-insensitive)
 * @returns Array of CompletionItem objects for matching global symbols
 */
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
    }

    const documentation = formatDocumentation(symbol.docComment);
    if (documentation !== undefined) {
      item.documentation = documentation;
    }

    items.push(item);
  }

  return items;
};

/** Luau code snippets for common patterns */
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
  // Roblox-specific snippets
  {
    'label': 'connect',
    'insertText': ':Connect(function(${1:args})\n\t$0\nend)',
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

/**
 * Gets snippet completion items for common Luau code patterns.
 * @param prefix - The prefix to filter snippets by (case-insensitive)
 * @returns Array of CompletionItem objects for matching snippets
 */
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
      'sortText': `1_${snippet.label}`, // Sort after regular completions
    });
  }

  return items;
};

/**
 * Gets completions for GetService("...") showing only services with children from live game.
 * @param beforeCursor - The text content before the cursor position
 * @param liveGameModel - The live game model containing connected game tree data
 * @returns Array of CompletionItem objects for services, or undefined if not in GetService context
 */
const getLiveServiceCompletions = (
  beforeCursor: string,
  liveGameModel: LiveGameModel,
): CompletionItem[] | undefined => {
  // Match game:GetService(" or game:GetService(' or game:GetService" (shorthand) - case insensitive
  if (/game\s*:\s*[Gg]et[Ss]ervice\s*(?:\(\s*)?["'][^"']*$/.test(beforeCursor) === false) return undefined;

  if (liveGameModel.isConnected === false) return undefined;

  const match = beforeCursor.match(/["']([^"']*)$/);
  const prefix = match?.[1]?.toLowerCase() ?? '';

  // Get services from live game tree (only services with children)
  const services = liveGameModel.services;
  if (services.size === 0) return undefined;

  const items: CompletionItem[] = [];

  for (const [name, node] of services) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix) === false) continue;

    // Count children
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

/**
 * Gets completions for bracket notation like game.Workspace['...'].
 * Returns live game tree children for the path before the bracket.
 * @param beforeCursor - The text content before the cursor position
 * @param liveGameModel - The live game model containing connected game tree data
 * @param documentManager - The document manager for type resolution
 * @returns Array of CompletionItem objects for children, or undefined if not in bracket context
 */
const getBracketCompletions = (beforeCursor: string, liveGameModel: LiveGameModel): CompletionItem[] | undefined => {
  // Match expressions like: game.Workspace[' or game.Workspace[" or game:GetService("Players")['
  // Pattern: expression followed by [' or ["
  const bracketMatch = beforeCursor.match(
    /([a-zA-Z_]\w*(?:\s*[.:]\s*[a-zA-Z_]\w*|\s*\([^)]*\)|\s*\[[^\]]*\])*)\s*\[\s*["']([^"']*)$/,
  );

  if (bracketMatch === null) return undefined;

  const [, expr, prefix] = bracketMatch;
  if (expr === undefined) return undefined;

  // Parse the expression to get the game tree path
  const path = parseGameTreePath(expr.replace(/\s+/g, ''));
  if (path === undefined) return undefined;

  // Get children from live game tree
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

/**
 * Gets completion items for string arguments to common Roblox functions.
 * Handles GetService, Instance.new, BrickColor.new, FindFirstChild, IsA, GetPropertyChangedSignal, etc.
 * @param beforeCursor - The text content before the cursor position
 * @param documentManager - The document manager for accessing Roblox classes
 * @returns Array of CompletionItem objects, or undefined if not in a string argument context
 */
const getStringCompletions = (beforeCursor: string, documentManager: DocumentManager): CompletionItem[] | undefined => {
  // GetService("...") or GetService'...' (Lua allows func'string' shorthand)
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

  // Instance.new("...") or Instance.new'...'
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

  // BrickColor.new("...") or BrickColor.new'...'
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
        'sortText': `0${idx.toString().padStart(3, '0')}`, // Sort before other completions
        'preselect': idx === 0,
      }));
  }

  // FindFirstChild/WaitForChild/FindFirstAncestor - with or without parens
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

  // FindFirstChildOfClass/FindFirstChildWhichIsA - class names
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

  // IsA("...") or IsA'...'
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

  // GetPropertyChangedSignal("...") or GetPropertyChangedSignal'...'
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

  // SetAttribute/GetAttribute("...")
  if (/(?:SetAttribute|GetAttribute)\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    return undefined;
  }

  // CollectionService:GetTagged/HasTag/AddTag/RemoveTag
  if (/(?:GetTagged|HasTag|AddTag|RemoveTag)\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    return undefined;
  }

  return undefined;
};

/**
 * Gets completion items for Roblox enums (Enum.EnumType or Enum.EnumType.EnumValue).
 * @param beforeCursor - The text content before the cursor position
 * @param documentManager - The document manager containing Roblox enum definitions
 * @returns Array of CompletionItem objects for enum types or values, or undefined if not in enum context
 */
const getEnumCompletions = (beforeCursor: string, documentManager: DocumentManager): CompletionItem[] | undefined => {
  // Match Enum.EnumType.
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

  // Match Enum. (list all enum types)
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

// Map of common service name to their class type
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

/**
 * Resolves a TypeReference to its actual type by looking up Roblox classes and datatypes.
 * @param type - The type to resolve (may be a TypeReference or already resolved)
 * @param documentManager - The document manager containing type definitions
 * @returns The resolved type, or the original type if not a TypeReference
 */
const resolveTypeReference = (type: LuauType, documentManager: DocumentManager): LuauType => {
  if (type.kind === 'TypeReference') {
    const typeName = type.name;

    // Check Roblox classes first
    const classType = documentManager.globalEnv.robloxClasses.get(typeName);
    if (classType !== undefined) return classType;

    // Check DataTypes (Vector3, CFrame, Color3, UDim2, etc.)
    const dataType = documentManager.globalEnv.robloxDataTypes.get(typeName);
    if (dataType !== undefined) return dataType;
  }
  return type;
};

/** Enable debug logging for expression resolution */
const DEBUG_COMPLETION = false;

/**
 * Logs debug messages when DEBUG_COMPLETION is enabled.
 * @param args - Arguments to log
 * @returns void
 */
const debugLog = (...args: unknown[]): void => {
  if (DEBUG_COMPLETION) console.error('[completion]', ...args);
};

/**
 * Quick scans document content to find variable types from Instance.new and GetService patterns.
 * This is used as a fallback when the full type check result is not available.
 * @param varName - The variable name to find the type for
 * @param content - The document content to scan
 * @param documentManager - The document manager for looking up class types
 * @param logFn - Optional logging function for debug output
 * @returns The inferred LuauType for the variable, or undefined if not found
 */
const quickScanForVariableType = (
  varName: string,
  content: string,
  documentManager: DocumentManager,
  logFn?: (msg: string) => void,
): LuauType | undefined => {
  const log = logFn ?? debugLog;
  log(`quickScan for: ${varName}`);

  // Pattern: local varName = Instance.new("ClassName")
  const instanceNewPattern = new RegExp(
    `local\\s+${varName}\\s*=\\s*Instance\\s*\\.\\s*new\\s*\\(\\s*["']([\\w]+)["']`,
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

  // Pattern: local varName = game:GetService("ServiceName") or game:getService("ServiceName")
  const getServicePattern = new RegExp(
    `local\\s+${varName}\\s*=\\s*game\\s*:\\s*[Gg]et[Ss]ervice\\s*\\(\\s*["']([\\w]+)["']`,
  );
  const getServiceMatch = content.match(getServicePattern);
  if (getServiceMatch !== null) {
    const serviceName = getServiceMatch[1];
    if (serviceName !== undefined) {
      const serviceClass = documentManager.globalEnv.robloxClasses.get(serviceName);
      if (serviceClass !== undefined) return serviceClass;
    }
  }

  // Pattern: local varName = game.ServiceName
  const gameServicePattern = new RegExp(`local\\s+${varName}\\s*=\\s*game\\s*\\.\\s*([\\w]+)`);
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

  // Pattern: local varName = workspace (or other globals)
  const workspacePattern = new RegExp(`local\\s+${varName}\\s*=\\s*workspace\\b`);
  if (workspacePattern.test(content)) {
    const workspaceClass = documentManager.globalEnv.robloxClasses.get('Workspace');
    if (workspaceClass !== undefined) return workspaceClass;
  }

  // Pattern: local varName = something:FindFirstChildOfClass("ClassName")
  const findChildOfClassPattern = new RegExp(
    `local\\s+${varName}\\s*=.*:FindFirstChildOfClass\\s*\\(\\s*["']([\\w]+)["']`,
  );
  const findChildOfClassMatch = content.match(findChildOfClassPattern);
  if (findChildOfClassMatch !== null) {
    const className = findChildOfClassMatch[1];
    if (className !== undefined) {
      const classType = documentManager.globalEnv.robloxClasses.get(className);
      if (classType !== undefined) return classType;
    }
  }

  // Pattern: local varName = something:FindFirstChildWhichIsA("ClassName")
  const findChildWhichIsAPattern = new RegExp(
    `local\\s+${varName}\\s*=.*:FindFirstChildWhichIsA\\s*\\(\\s*["']([\\w]+)["']`,
  );
  const findChildWhichIsAMatch = content.match(findChildWhichIsAPattern);
  if (findChildWhichIsAMatch !== null) {
    const className = findChildWhichIsAMatch[1];
    if (className !== undefined) {
      const classType = documentManager.globalEnv.robloxClasses.get(className);
      if (classType !== undefined) return classType;
    }
  }

  // Pattern: local varName = player.Character or player:FindFirstChild("Humanoid") etc.
  // Try to use variable name hints for the variable name
  const hintedClass = VARIABLE_NAME_HINTS.get(varName);
  if (hintedClass !== undefined) {
    // Verify this variable is actually defined
    const isDefinedPattern = new RegExp(`local\\s+${varName}\\b`);
    if (isDefinedPattern.test(content)) {
      const classType = documentManager.globalEnv.robloxClasses.get(hintedClass);
      if (classType !== undefined) return classType;
    }
  }

  return undefined;
};

/**
 * Resolves a type from a chained expression like "game.Players.PlayerAdded" or "game:GetService('Players').LocalPlayer".
 * Handles property access, method calls, GetService, FindFirstChild, Clone, and other common patterns.
 * @param expression - The expression string to resolve
 * @param documentManager - The document manager for type lookups
 * @param document - Optional parsed document for local symbol lookups
 * @param liveContent - Optional live document content for quick scanning
 * @param logFn - Optional logging function for debug output
 * @returns The resolved LuauType, or undefined if resolution fails
 */
const resolveExpressionType = (
  expression: string,
  documentManager: DocumentManager,
  document?: ParsedDocument,
  liveContent?: string,
  logFn?: (msg: string) => void,
): LuauType | undefined => {
  const log = logFn ?? debugLog;
  log(`Resolving expression: ${expression}`);

  // Parse the expression into parts, handling method calls and GetService specially
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
      // Read method name
      let methodName = '';
      while (i < expression.length && /\w/.test(expression[i] ?? '')) {
        methodName += expression[i];
        i++;
      }
      // Skip whitespace
      while (i < expression.length && /\s/.test(expression[i] ?? '')) i++;
      // Read arguments
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
          // String literal shorthand
          const quote = expression[i];
          i++;
          while (i < expression.length && expression[i] !== quote) i++;
          if (expression[i] === quote) i++;
        }
        args = expression.slice(startArgs, i);
      }
      if (methodName !== '') {
        parts.push({ 'kind': 'method', 'name': methodName, args });
      }
    } else if (char === '(' || char === '[') {
      if (current !== '') {
        parts.push({ 'kind': 'property', 'name': current });
        current = '';
      }
      // Skip to matching bracket
      const open = char;
      const close = char === '(' ? ')' : ']';
      const startArgs = i;
      let depth = 1;
      i++;
      while (i < expression.length && depth > 0) {
        if (expression[i] === open) depth++;
        else if (expression[i] === close) depth--;
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

  if (current !== '') {
    parts.push({ 'kind': 'property', 'name': current });
  }

  if (parts.length === 0) return undefined;

  // Start with the first part - look it up in globals
  const firstPart = parts[0];
  if (firstPart === undefined || firstPart.kind !== 'property') return undefined;
  const firstName = firstPart.name;

  let currentType: LuauType | undefined;

  // Check global symbols first
  const globalSymbol = documentManager.globalEnv.env.globalScope.symbols.get(firstName);
  if (globalSymbol !== undefined) {
    currentType = globalSymbol.type;
    log(`First part '${firstName}' resolved from globals: ${currentType.kind}`);
  } else {
    // Check Roblox classes
    const classType = documentManager.globalEnv.robloxClasses.get(firstName);
    if (classType !== undefined) {
      currentType = classType;
      log(`First part '${firstName}' resolved from robloxClasses: ${currentType.kind}`);
    }
  }

  // Check local symbols from type check result using allSymbols map
  if (currentType === undefined && document?.typeCheckResult !== undefined) {
    log(`Checking allSymbols for '${firstName}'...`);
    const symbolType = document.typeCheckResult.allSymbols.get(firstName);
    if (symbolType !== undefined) {
      log(`Found '${firstName}' in allSymbols, type: ${symbolType.kind}`);
      const resolved = resolveTypeReference(symbolType, documentManager);
      log(`Resolved type: ${resolved.kind}${resolved.kind === 'Class' ? ` (${(resolved as ClassType).name})` : ''}`);
      // Only use if it resolves to a useful type (Class or Table)
      if (resolved.kind === 'Class' || resolved.kind === 'Table') {
        currentType = resolved;
      } else {
        log(`allSymbols type for '${firstName}' is not useful: ${resolved.kind}`);
      }
    } else {
      log(`'${firstName}' not found in allSymbols`);
    }
  } else if (currentType === undefined) {
    log(
      `Skipping allSymbols check: doc=${document !== undefined}, typeCheck=${document?.typeCheckResult !== undefined}`,
    );
  }

  // Quick scan fallback: try to find variable type from document content patterns
  // This works even when the type check result is outdated or has unhelpful types
  if (currentType === undefined && liveContent !== undefined) {
    log(`Running quick scan for '${firstName}'...`);
    const scannedType = quickScanForVariableType(firstName, liveContent, documentManager, log);
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

  // Try variable name hints as fallback
  if (currentType === undefined) {
    const hintedClass = VARIABLE_NAME_HINTS.get(firstName);
    if (hintedClass !== undefined) {
      const classType = documentManager.globalEnv.robloxClasses.get(hintedClass);
      if (classType !== undefined) {
        currentType = classType;
      }
    }
  }

  if (currentType === undefined) return undefined;

  // Resolve each subsequent part
  for (let partIdx = 1; partIdx < parts.length; partIdx++) {
    const part = parts[partIdx];
    if (part === undefined) break;

    if (part.kind === 'property') {
      // Special case: game.ServiceName - treat service names as returning that service's class
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

      // Special case: workspace is also accessible via game.Workspace
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
      // Special case: GetService('ServiceName') returns the service class (case insensitive)
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

      // Special case: FindFirstChildOfClass/FindFirstChildWhichIsA returns the specified class type
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

      // Special case: FindFirstAncestorOfClass/FindFirstAncestorWhichIsA with class name
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

      // Special case: Clone() returns the same type as the object being cloned
      if (part.name === 'Clone' && part.args === '()') {
        // currentType stays the same since Clone returns the same type
        continue;
      }

      // Special case: WaitForChild/FindFirstChild with known common child names
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
        // If no common child found, fall through to normal method resolution
      }

      // For other methods, try to get return type (checking superclass chain)
      debugLog('Resolving method:', part.name, 'on type:', currentType?.kind);
      if (currentType !== undefined) {
        const resolvedCurrent = resolveTypeReference(currentType, documentManager);
        debugLog(
          'Resolved current type:',
          resolvedCurrent.kind,
          resolvedCurrent.kind === 'Class' ? resolvedCurrent.name : '',
        );
        if (resolvedCurrent.kind === 'Class') {
          // Search for method in class and all superclasses
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
      // If we can't resolve the method, return undefined
      debugLog('Failed to resolve method:', part.name);
      return undefined;
    } else if (part.kind === 'call') {
      // Function call on current type - try to get return type if it's a function
      if (currentType !== undefined && currentType.kind === 'Function') {
        currentType = resolveTypeReference(currentType.returnType, documentManager);
      }
      // Otherwise keep current type (for things like Instance.new("Part"))
    }
  }

  return currentType;
};

/**
 * Gets the superclass name for a given class.
 * @param className - The name of the class to get the superclass for
 * @param documentManager - The document manager containing class definitions
 * @returns The superclass name, or undefined if no superclass exists
 */
const getSuperclassName = (className: string, documentManager: DocumentManager): string | undefined => {
  const classType = documentManager.globalEnv.robloxClasses.get(className);
  if (classType !== undefined && classType.kind === 'Class' && classType.superclass !== undefined) {
    return classType.superclass.name;
  }
  return undefined;
};

/**
 * Resolves the type of accessing a member (property or method) on a type.
 * Handles class properties, methods, superclass inheritance, and common child patterns.
 * @param type - The base type to access the member on
 * @param memberName - The name of the member to access
 * @param documentManager - The document manager for type resolution
 * @returns The type of the member, or undefined if not found
 */
const resolveMemberType = (
  type: LuauType,
  memberName: string,
  documentManager: DocumentManager,
): LuauType | undefined => {
  // Resolve TypeReference first
  const resolvedType = resolveTypeReference(type, documentManager);

  if (resolvedType.kind === 'Class') {
    // Check properties
    const prop = resolvedType.properties.get(memberName);
    if (prop !== undefined) return resolveTypeReference(prop.type, documentManager);

    // Check methods - return the FunctionType, not the ClassMethod wrapper
    const method = resolvedType.methods.get(memberName);
    if (method !== undefined) return method.func;

    // Check superclass for inherited members
    if (resolvedType.superclass !== undefined) {
      const inheritedMember = resolveMemberType(resolvedType.superclass, memberName, documentManager);
      if (inheritedMember !== undefined) return inheritedMember;
    }

    // Check common children patterns (e.g., character.Humanoid, player.Character)
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

/**
 * Extracts the expression chain before the cursor.
 * For "game.Players.PlayerAdded:" returns "game.Players.PlayerAdded".
 * @param beforeCursor - The text content before the cursor position
 * @returns Object with expression, prefix, and whether it's method access, or undefined if no chain found
 */
const extractExpressionChain = (
  beforeCursor: string,
): { expression: string; prefix: string; isMethodAccess: boolean } | undefined => {
  // Match chained expression ending with . or :
  // This regex captures: identifier(.identifier)*(.|:)prefix?
  // Also handles Lua string literal shorthand: func'string' or func"string"
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

/**
 * Gets auto-import completion items for exports from other modules in the workspace.
 * Generates require statements and inserts them at the appropriate location.
 * @param prefix - The prefix to filter exports by (minimum 2 characters)
 * @param documentManager - The document manager containing the module index
 * @param currentDocUri - The URI of the current document to exclude from results
 * @param content - The document content for determining import insertion location
 * @returns Array of CompletionItem objects with auto-import text edits
 */
const getAutoImportCompletions = (
  prefix: string,
  documentManager: DocumentManager,
  currentDocUri: string,
  content: string,
): CompletionItem[] => {
  if (prefix.length < 2) return []; // Require at least 2 chars to avoid noise

  const exports = documentManager.searchModuleExports(prefix);
  if (exports.length === 0) return [];

  // Get the current document's DataModel path for require path generation
  const rojoState = documentManager.getRojoState();
  let currentDataModelPath: string[] = [];

  if (rojoState?.dataModel !== undefined) {
    // Convert file:// URI to file path
    let filePath = currentDocUri;
    try {
      if (currentDocUri.startsWith('file://')) {
        filePath = decodeURIComponent(currentDocUri.replace('file:///', '').replace('file://', ''));
        // Handle Windows paths
        if (filePath.match(/^[a-zA-Z]:/)) {
          // Already correct
        } else if (filePath.match(/^\/[a-zA-Z]:/)) {
          filePath = filePath.slice(1);
        }
      }
    } catch {
      // Use as-is
    }

    const dataModelPath = getDataModelPath(rojoState.dataModel, filePath);
    if (dataModelPath !== undefined) {
      currentDataModelPath = dataModelPath;
    }
  }

  // Find the first line to insert the require statement
  const lines = content.split('\n');
  let insertLine = 0;

  // Skip leading comments and empty lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (line === '' || line.startsWith('--')) {
      insertLine = i + 1;
    } else {
      break;
    }
  }

  // Find the end of existing require statements
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
    // Skip if we've already added an export with this name
    if (seenNames.has(exp.name)) continue;
    seenNames.add(exp.name);

    // Skip if the export is from the current file
    if (exp.filePath === currentDocUri) continue;

    // Generate the require path
    let requirePath: string;
    if (currentDataModelPath.length > 0) {
      requirePath = generateRequirePath(currentDataModelPath, exp.modulePath.split('.'));
    } else {
      // Fallback: use game path
      requirePath = `game.${exp.modulePath}`;
    }

    // Generate the module variable name (last part of the path)
    const pathParts = exp.modulePath.split('.');
    const moduleName = pathParts[pathParts.length - 1] ?? 'Module';

    // Create the require statement
    const requireStatement = `local ${moduleName} = require(${requirePath})\n`;

    // Create the completion item
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
      'sortText': `2_${exp.name}`, // Sort after local completions
      'insertText': `${moduleName}.${exp.name}`,
      'additionalTextEdits': [TextEdit.insert(Position.create(insertLine, 0), requireStatement)],
    };

    items.push(item);
  }

  return items;
};

/**
 * Gets the ClassType for a node at a given path in the live game tree.
 * @param path - Array of path segments to the node (e.g., ["Workspace", "Part"])
 * @param liveGameModel - The live game model containing the game tree
 * @param documentManager - The document manager for looking up class types
 * @returns The ClassType of the node, or undefined if not found or not connected
 */
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
  if (classType !== undefined && classType.kind === 'Class') {
    return classType;
  }

  return undefined;
};

/**
 * Gets completion items from the live game tree for a given path.
 * For example, for "game.Workspace." returns all children of Workspace from the live game.
 * @param path - Array of path segments to the parent node
 * @param prefix - The prefix to filter children by (case-insensitive)
 * @param liveGameModel - The live game model containing the game tree
 * @param documentManager - The document manager (unused but kept for consistency)
 * @returns Array of CompletionItem objects for live game tree children
 */
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
      'sortText': `0_${name}`, // Sort before static completions
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': `Live instance from connected game\n\n**Class:** \`${node.className}\`${node.children !== undefined ? `\n**Children:** ${node.children.length}` : ''}`,
      },
    });
  }

  return items;
};

/**
 * Splits an expression into path segments, handling both dot notation and bracket notation.
 * For example, "Workspace.Part" returns ["Workspace", "Part"].
 * For example, "Workspace['0neShot102'].Head" returns ["Workspace", "0neShot102", "Head"].
 * @param expr - The expression string to split
 * @returns Array of path segment strings
 */
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
      // Find the closing bracket and extract the string
      i++; // Skip '['
      // Skip whitespace
      while (i < expr.length && /\s/.test(expr[i] ?? '')) i++;
      // Get the quote character
      const quote = expr[i];
      if (quote === '"' || quote === "'") {
        i++; // Skip opening quote
        let name = '';
        while (i < expr.length && expr[i] !== quote) {
          name += expr[i];
          i++;
        }
        if (name !== '') {
          parts.push(name);
        }
        i++; // Skip closing quote
        // Skip to closing bracket
        while (i < expr.length && expr[i] !== ']') i++;
        i++; // Skip ']'
      } else {
        // Variable index, skip to ]
        while (i < expr.length && expr[i] !== ']') i++;
        i++;
      }
    } else if (char === ':') {
      if (current !== '') {
        parts.push(current);
        current = '';
      }
      i++;
    } else if (/\w/.test(char ?? '')) {
      current += char;
      i++;
    } else {
      i++;
    }
  }

  if (current !== '') {
    parts.push(current);
  }

  return parts;
};

/**
 * Parses an expression path into segments for live game tree lookup.
 * Handles game.Service, game:GetService("Service"), and workspace patterns.
 * For example, "game.Workspace.Part" returns ["Workspace", "Part"].
 * For example, "workspace.Part" returns ["Workspace", "Part"].
 * For example, "game.Workspace['0neShot102']" returns ["Workspace", "0neShot102"].
 * @param expression - The expression string to parse
 * @returns Array of path segments starting from the service level, or undefined if not a game tree path
 */
const parseGameTreePath = (expression: string): string[] | undefined => {
  // Remove leading/trailing whitespace
  const expr = expression.trim();

  // Handle game.Service or game:GetService("Service") patterns
  if (expr.startsWith('game.') || expr.startsWith('game:') || expr.startsWith('game[')) {
    let rest = expr.slice(4); // Remove "game"
    if (rest.startsWith('.') || rest.startsWith(':')) {
      rest = rest.slice(1);
    }

    // Handle GetService("ServiceName") or GetService'ServiceName' (with or without parens) - case insensitive
    const getServiceMatch = rest.match(/^[Gg]et[Ss]ervice\s*(?:\(\s*["'](\w+)["']\s*\)|["'](\w+)["'])/);
    if (getServiceMatch !== null) {
      const serviceName = getServiceMatch[1] ?? getServiceMatch[2];
      if (serviceName === undefined) return undefined;

      const remaining = rest.slice(getServiceMatch[0].length);
      const path = [serviceName];
      if (remaining !== '') {
        path.push(...splitPathExpression(remaining));
      }
      return path;
    }

    // Handle direct property/bracket access
    const parts = splitPathExpression(rest);
    return parts.length > 0 ? parts : undefined;
  }

  // Handle workspace shorthand
  if (expr.startsWith('workspace.') || expr.startsWith('workspace:') || expr.startsWith('workspace[')) {
    let rest = expr.slice(9); // Remove "workspace"
    if (rest.startsWith('.') || rest.startsWith(':')) {
      rest = rest.slice(1);
    }
    const parts = splitPathExpression(rest);
    return ['Workspace', ...parts];
  }

  // Handle just "workspace" (for workspace.)
  if (expr === 'workspace') {
    return ['Workspace'];
  }

  return undefined;
};

/**
 * Extracts a require() expression from a member access chain.
 * Returns the module reference if the expression is a require().member pattern.
 * @param beforeCursor - The text before the cursor
 * @returns The module reference, or undefined if not a require expression
 */
const extractRequireExpression = (beforeCursor: string): ModuleReference | undefined => {
  // Match patterns like:
  // require(game.ReplicatedStorage.Module).
  // require(game.ReplicatedStorage.Module):
  const requireMatch = beforeCursor.match(/require\s*\(\s*game\.([^)]+)\s*\)[.:]\s*$/);
  if (requireMatch === null) return undefined;

  const pathStr = requireMatch[1];
  if (pathStr === undefined) return undefined;

  const pathParts = pathStr
    .split('.')
    .map(p => p.trim())
    .filter(p => p.length > 0);
  if (pathParts.length === 0) return undefined;

  return { 'kind': 'path', 'path': pathParts };
};

/**
 * Gets completions for a require() expression by querying the executor bridge.
 * @param beforeCursor - The text before the cursor
 * @param executorBridge - The executor bridge for module interface queries
 * @returns Completion items for the module's exports, or undefined
 */
const getRequireModuleCompletions = async (
  beforeCursor: string,
  executorBridge: ExecutorBridge,
): Promise<CompletionItem[] | undefined> => {
  if (executorBridge.isConnected === false) return undefined;

  const moduleRef = extractRequireExpression(beforeCursor);
  if (moduleRef === undefined) return undefined;

  try {
    const result = await executorBridge.requestModuleInterface(moduleRef);
    if (result.success === false || result.interface === undefined) return undefined;

    const items: CompletionItem[] = [];
    const moduleInterface = result.interface;

    if (moduleInterface.kind === 'table' && moduleInterface.properties !== undefined) {
      for (const prop of moduleInterface.properties) {
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

    return items.length > 0 ? items : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Sets up the completion handler for the LSP connection.
 * Registers a handler that provides intelligent autocompletion for Luau code.
 * @param connection - The LSP connection to register the handler on
 * @param documents - The TextDocuments manager for accessing live document content
 * @param documentManager - The document manager for type information and workspace state
 * @param executorBridge - The executor bridge for live game and module interface completions
 * @returns void
 */
export const setupCompletionHandler = (
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  documentManager: DocumentManager,
  executorBridge: ExecutorBridge,
): void => {
  const liveGameModel = executorBridge.liveGameModel;

  // Use connection.console.log for debugging (shows in VS Code Output panel)
  const log = (msg: string): void => {
    if (DEBUG_COMPLETION) connection.console.log(`[completion] ${msg}`);
  };

  connection.onCompletion(async (params: CompletionParams): Promise<CompletionList> => {
    // Get LIVE document content directly from VS Code (not cached/debounced)
    const liveDoc = documents.get(params.textDocument.uri);
    if (liveDoc === undefined) return { 'isIncomplete': false, 'items': [] };

    // Get the line content before cursor from LIVE content
    const content = liveDoc.getText();
    const lines = content.split('\n');
    const line = lines[params.position.line];
    if (line === undefined) return { 'isIncomplete': false, 'items': [] };

    const beforeCursor = line.slice(0, params.position.character);
    log(`beforeCursor: "${beforeCursor}"`);

    // Get document with type information (use cached, don't block on parsing)
    const document = documentManager.getDocument(params.textDocument.uri);
    log(`document exists: ${document !== undefined}, has typeCheck: ${document?.typeCheckResult !== undefined}`);

    // Check for live service completions (game:GetService("..."))
    const liveServiceCompletions = getLiveServiceCompletions(beforeCursor, liveGameModel);
    if (liveServiceCompletions !== undefined) return { 'isIncomplete': true, 'items': liveServiceCompletions };

    // Check for bracket completions (game.Workspace['...'])
    const bracketCompletions = getBracketCompletions(beforeCursor, liveGameModel);
    if (bracketCompletions !== undefined) return { 'isIncomplete': true, 'items': bracketCompletions };

    // Check for string completions (GetService, Instance.new, etc.)
    const stringCompletions = getStringCompletions(beforeCursor, documentManager);
    if (stringCompletions !== undefined) return { 'isIncomplete': true, 'items': stringCompletions };

    // Check for Enum completions
    const enumCompletions = getEnumCompletions(beforeCursor, documentManager);
    if (enumCompletions !== undefined) return { 'isIncomplete': true, 'items': enumCompletions };

    // Check for require() module completions (fetches from connected executor)
    const requireModuleCompletions = await getRequireModuleCompletions(beforeCursor, executorBridge);
    if (requireModuleCompletions !== undefined) return { 'isIncomplete': true, 'items': requireModuleCompletions };

    // Check for table field completions (inside a table literal passed to a function)
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

    // Check for chained member/method access (handles game.Players.PlayerAdded:)
    const chainInfo = extractExpressionChain(beforeCursor);
    log(`chainInfo: ${JSON.stringify(chainInfo)}`);
    if (chainInfo !== null && chainInfo !== undefined) {
      // Check for live game tree completions first
      const gameTreePath = parseGameTreePath(chainInfo.expression);
      log(`gameTreePath: ${JSON.stringify(gameTreePath)}`);

      let resolvedType = resolveExpressionType(chainInfo.expression, documentManager, document, content, log);
      log(
        `resolvedType: ${resolvedType?.kind}${resolvedType?.kind === 'Class' ? ` (${(resolvedType as ClassType).name})` : ''}`,
      );

      // Resolve TypeReference if needed
      if (resolvedType !== undefined && resolvedType.kind === 'TypeReference') {
        resolvedType = resolveTypeReference(resolvedType, documentManager);
      }

      if (resolvedType !== undefined) {
        if (resolvedType.kind === 'Class') {
          // Get class completions first
          const classItems = getClassCompletions(
            resolvedType,
            chainInfo.prefix,
            chainInfo.isMethodAccess,
            documentManager,
          );

          // Add live game tree children if connected and this is a game tree path
          if (gameTreePath !== undefined && chainInfo.isMethodAccess === false) {
            const liveItems = getLiveGameTreeCompletions(gameTreePath, chainInfo.prefix, liveGameModel);
            log(`liveItems count: ${liveItems.length}`);

            // Merge: live items first (they have sortText starting with 0_), then class items
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

      // Even if type resolution failed, try live game tree completions and type lookup
      if (gameTreePath !== undefined) {
        // Try to get the type from the live game tree node
        const liveNodeType = getLiveGameTreeNodeType(gameTreePath, liveGameModel, documentManager);
        log(
          `liveNodeType: ${liveNodeType?.kind ?? 'undefined'}${liveNodeType?.kind === 'Class' ? ` (${liveNodeType.name})` : ''}`,
        );

        if (liveNodeType !== undefined) {
          // Get class completions based on the live node's className
          const classItems = getClassCompletions(
            liveNodeType,
            chainInfo.prefix,
            chainInfo.isMethodAccess,
            documentManager,
          );

          // Also add live children if not doing method access
          if (chainInfo.isMethodAccess === false) {
            const liveItems = getLiveGameTreeCompletions(gameTreePath, chainInfo.prefix, liveGameModel);
            log(`liveItems (from type) count: ${liveItems.length}`);

            // Merge: live items first, then class items
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

        // No type found from live game, but still try to get static completions from path
        if (chainInfo.isMethodAccess === false) {
          const liveItems = getLiveGameTreeCompletions(gameTreePath, chainInfo.prefix, liveGameModel);
          log(`liveItems (fallback) count: ${liveItems.length}`);

          // Try to infer class from path (e.g., "Players" -> Players class, "Workspace" -> Workspace class)
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
            // Merge: live items first, then unique static items
            const seenNames = new Set(liveItems.map(i => i.label));
            const uniqueStaticItems = staticClassItems.filter(i => seenNames.has(i.label) === false);

            return {
              'isIncomplete': true,
              'items': [...liveItems, ...uniqueStaticItems],
            };
          }
        }
      }

      // Check if this is a chained expression (has . or : in the expression)
      const hasChain =
        chainInfo.expression.includes('.') || chainInfo.expression.includes(':') || chainInfo.expression.includes('[');

      if (hasChain) {
        // For chained expressions, if resolution failed at any point, return empty completions
        // This prevents false positives like Humanoid.Torso. giving BasePart completions
        // when Humanoid doesn't actually have a Torso property
        return { 'isIncomplete': false, 'items': [] };
      }

      // Simple single-identifier expression - try class lookup or variable hint
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

    // Fallback: Check for simple member access patterns
    debugLog('Fallback: trying simple member/method patterns');
    const memberMatch = beforeCursor.match(/(\w+)\.(\w*)$/);
    const methodMatch = beforeCursor.match(/(\w+):(\w*)$/);
    debugLog('methodMatch:', methodMatch);

    if (memberMatch !== null) {
      const [, objectName, prefix] = memberMatch;
      if (objectName === undefined) return { 'isIncomplete': false, 'items': [] };

      // Find the object in scope - check local symbols from document type check result first
      if (document?.typeCheckResult !== undefined) {
        const env = document.typeCheckResult.environment;
        const localSymbol = env.globalScope.symbols.get(objectName);
        if (localSymbol !== undefined) {
          if (localSymbol.type.kind === 'Table') {
            return {
              'isIncomplete': true,
              'items': getTableCompletions(localSymbol.type, prefix ?? ''),
            };
          }
          if (localSymbol.type.kind === 'Class') {
            return {
              'isIncomplete': true,
              'items': getClassCompletions(localSymbol.type, prefix ?? '', false, documentManager),
            };
          }
        }
      }

      // Check global built-in symbols
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

      // Check Roblox classes directly
      const classType = documentManager.globalEnv.robloxClasses.get(objectName);
      if (classType !== undefined && classType.kind === 'Class') {
        return {
          'isIncomplete': true,
          'items': getClassCompletions(classType, prefix ?? '', false, documentManager),
        };
      }

      // Try variable name hints as fallback
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

      // Check local symbols from document type check result first
      if (document?.typeCheckResult !== undefined) {
        const env = document.typeCheckResult.environment;
        const localSymbol = env.globalScope.symbols.get(objectName);
        if (localSymbol !== undefined && localSymbol.type.kind === 'Class') {
          return {
            'isIncomplete': true,
            'items': getClassCompletions(localSymbol.type, prefix ?? '', true, documentManager),
          };
        }
        if (localSymbol !== undefined && localSymbol.type.kind === 'Table') {
          return {
            'isIncomplete': true,
            'items': getTableCompletions(localSymbol.type, prefix ?? ''),
          };
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

      // Try variable name hints as fallback
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

    // Default: global completions + snippets + auto-imports
    const wordMatch = beforeCursor.match(/(\w*)$/);
    const prefix = wordMatch?.[1] ?? '';

    const globalItems = getGlobalCompletions(documentManager, prefix);
    const snippetItems = getSnippetCompletions(prefix);
    const autoImportItems = getAutoImportCompletions(prefix, documentManager, params.textDocument.uri, content);

    return {
      'isIncomplete': true,
      'items': [...globalItems, ...snippetItems, ...autoImportItems],
    };
  });
};
