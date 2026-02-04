/**
 * Game Tree Data Provider
 * Provides a VS Code TreeView showing the live Roblox game hierarchy
 */

import * as path from 'path';

import {
  CancellationToken,
  DataTransfer,
  DataTransferItem,
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeDragAndDropController,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
} from 'vscode';

/**
 * Represents a node in the Roblox game tree hierarchy
 */
export interface GameTreeNode {
  readonly name: string;
  readonly className: string;
  readonly children?: ReadonlyArray<GameTreeNode>;
  readonly hasChildren?: boolean; // For lazy loading - indicates unexpanded children exist
}

/**
 * Represents a tree item with path information for context menu operations
 */
export interface GameTreeItem {
  readonly name: string;
  readonly className: string;
  readonly path: ReadonlyArray<string>;
  readonly children?: ReadonlyArray<GameTreeNode>;
  readonly hasChildren?: boolean; // For lazy loading
  readonly isService: boolean;
}

/** MIME type for game tree drag and drop */
const GAME_TREE_MIME_TYPE = 'application/vnd.code.tree.rbxdev-gametree';

/**
 * Callback type for handling reparent operations
 */
export type ReparentCallback = (sourcePath: ReadonlyArray<string>, targetPath: ReadonlyArray<string>) => Promise<void>;

/**
 * Callback type for requesting children of a node (lazy loading)
 */
export type RequestChildrenCallback = (path: ReadonlyArray<string>) => Promise<ReadonlyArray<GameTreeNode> | undefined>;

/** Map of class names to icon file names */
const CLASS_ICON_MAP: Record<string, string> = {
  // Scripts
  'Script': 'script',
  'LocalScript': 'localscript',
  'ModuleScript': 'modulescript',

  // Containers
  'Folder': 'folder',
  'Model': 'model',
  'Configuration': 'configuration',
  'Actor': 'model',

  // Parts
  'Part': 'part',
  'MeshPart': 'meshpart',
  'UnionOperation': 'union',
  'NegateOperation': 'negate',
  'WedgePart': 'wedgepart',
  'CornerWedgePart': 'cornerpart',
  'SpawnLocation': 'spawnlocation',
  'Seat': 'seat',
  'VehicleSeat': 'vehicleseat',
  'TrussPart': 'trusspart',
  'SkateboardPlatform': 'part',

  // Services
  'Workspace': 'workspace',
  'Terrain': 'workspace',
  'Camera': 'camera',
  'Players': 'players',
  'ReplicatedStorage': 'storage',
  'ReplicatedFirst': 'storage',
  'ServerStorage': 'storage',
  'ServerScriptService': 'storage',
  'StarterGui': 'screengui',
  'StarterPack': 'folder',
  'StarterPlayer': 'players',
  'StarterPlayerScripts': 'folder',
  'StarterCharacterScripts': 'folder',
  'Lighting': 'lighting',
  'SoundService': 'sound',
  'Teams': 'players',
  'Chat': 'storage',
  'LocalizationService': 'storage',
  'TestService': 'storage',
  'RunService': 'storage',
  'TweenService': 'storage',
  'Debris': 'storage',
  'HttpService': 'storage',
  'MarketplaceService': 'storage',
  'PolicyService': 'storage',
  'TeleportService': 'storage',
  'DataStoreService': 'storage',
  'MemoryStoreService': 'storage',
  'MessagingService': 'storage',
  'PhysicsService': 'storage',
  'CollectionService': 'storage',
  'ContextActionService': 'storage',
  'UserInputService': 'storage',
  'VRService': 'storage',
  'PathfindingService': 'storage',
  'InsertService': 'storage',
  'AssetService': 'storage',
  'BadgeService': 'storage',
  'GamePassService': 'storage',
  'GroupService': 'storage',
  'SocialService': 'storage',
  'TextService': 'storage',
  'ProximityPromptService': 'storage',
  'AnalyticsService': 'storage',

  // Lighting
  'PointLight': 'lighting',
  'SpotLight': 'lighting',
  'SurfaceLight': 'lighting',
  'Atmosphere': 'atmosphere',
  'Sky': 'sky',
  'BloomEffect': 'bloom',
  'BlurEffect': 'blur',
  'ColorCorrectionEffect': 'colorcorrection',
  'DepthOfFieldEffect': 'depthoffield',
  'SunRaysEffect': 'sunrays',

  // Sound
  'Sound': 'sound',
  'SoundGroup': 'sound',
  'ChorusSoundEffect': 'sound',
  'CompressorSoundEffect': 'sound',
  'DistortionSoundEffect': 'sound',
  'EchoSoundEffect': 'sound',
  'EqualizerSoundEffect': 'sound',
  'FlangeSoundEffect': 'sound',
  'PitchShiftSoundEffect': 'sound',
  'ReverbSoundEffect': 'sound',
  'TremoloSoundEffect': 'sound',

  // GUI - Containers
  'ScreenGui': 'screengui',
  'SurfaceGui': 'surfacegui',
  'BillboardGui': 'billboardgui',
  'PlayerGui': 'screengui',
  'CoreGui': 'screengui',
  'Frame': 'frame',
  'ScrollingFrame': 'frame',
  'CanvasGroup': 'frame',
  'ViewportFrame': 'viewportframe',

  // GUI - Elements
  'TextLabel': 'textlabel',
  'TextButton': 'textlabel',
  'TextBox': 'textlabel',
  'ImageLabel': 'image',
  'ImageButton': 'image',
  'VideoFrame': 'image',

  // GUI - Layout
  'UIListLayout': 'uilayout',
  'UIGridLayout': 'uilayout',
  'UITableLayout': 'uilayout',
  'UIPageLayout': 'uilayout',

  // GUI - Constraints
  'UIAspectRatioConstraint': 'uiconstraint',
  'UISizeConstraint': 'uiconstraint',
  'UITextSizeConstraint': 'uiconstraint',

  // GUI - Modifiers
  'UICorner': 'uiconstraint',
  'UIGradient': 'uiconstraint',
  'UIPadding': 'uiconstraint',
  'UIScale': 'uiconstraint',
  'UIStroke': 'uiconstraint',

  // Remote/Bindable
  'RemoteEvent': 'remoteevent',
  'BindableEvent': 'remoteevent',
  'RemoteFunction': 'remotefunction',
  'BindableFunction': 'remotefunction',
  'UnreliableRemoteEvent': 'remoteevent',

  // Values
  'IntValue': 'intvalue',
  'NumberValue': 'intvalue',
  'BoolValue': 'boolvalue',
  'StringValue': 'stringvalue',
  'ObjectValue': 'objectvalue',
  'Color3Value': 'color3value',
  'Vector3Value': 'vector3value',
  'CFrameValue': 'cframevalue',
  'BrickColorValue': 'color3value',
  'RayValue': 'vector3value',
  'IntConstrainedValue': 'intvalue',
  'DoubleConstrainedValue': 'intvalue',

  // Animation
  'Animation': 'animation',
  'AnimationController': 'animation',
  'AnimationTrack': 'animation',
  'Animator': 'animation',
  'Keyframe': 'animation',
  'KeyframeSequence': 'animation',
  'Pose': 'animation',

  // Character
  'Humanoid': 'humanoid',
  'HumanoidDescription': 'humanoid',
  'Accessory': 'accessory',
  'Hat': 'hat',
  'Shirt': 'shirt',
  'Pants': 'pants',
  'ShirtGraphic': 'shirt',
  'BodyColors': 'color3value',
  'CharacterMesh': 'meshpart',

  // Effects
  'ParticleEmitter': 'particleemitter',
  'Fire': 'particleemitter',
  'Smoke': 'particleemitter',
  'Sparkles': 'particleemitter',
  'Explosion': 'explosion',
  'Beam': 'beam',
  'Trail': 'trail',

  // Appearance
  'Decal': 'decal',
  'Texture': 'texture',
  'SurfaceAppearance': 'texture',
  'MaterialVariant': 'texture',

  // Physics - Attachments
  'Attachment': 'attachment',
  'Bone': 'attachment',

  // Physics - Welds/Joints
  'Weld': 'weld',
  'WeldConstraint': 'weld',
  'ManualWeld': 'weld',
  'Motor': 'motor',
  'Motor6D': 'motor',
  'Snap': 'weld',
  'Glue': 'weld',
  'Rotate': 'motor',
  'RotateP': 'motor',
  'RotateV': 'motor',
  'VelocityMotor': 'motor',

  // Physics - Constraints
  'AlignOrientation': 'constraint',
  'AlignPosition': 'constraint',
  'AngularVelocity': 'constraint',
  'BallSocketConstraint': 'constraint',
  'CylindricalConstraint': 'constraint',
  'HingeConstraint': 'constraint',
  'LineForce': 'constraint',
  'LinearVelocity': 'constraint',
  'PlaneConstraint': 'constraint',
  'PrismaticConstraint': 'constraint',
  'RigidConstraint': 'constraint',
  'RodConstraint': 'constraint',
  'RopeConstraint': 'constraint',
  'SpringConstraint': 'constraint',
  'Torque': 'constraint',
  'UniversalConstraint': 'constraint',
  'VectorForce': 'constraint',
  'NoCollisionConstraint': 'constraint',

  // Physics - Body Movers (Legacy)
  'BodyForce': 'bodyforce',
  'BodyGyro': 'bodyforce',
  'BodyPosition': 'bodyvelocity',
  'BodyVelocity': 'bodyvelocity',
  'BodyAngularVelocity': 'bodyvelocity',
  'BodyThrust': 'bodyforce',
  'RocketPropulsion': 'bodyforce',

  // Interaction
  'ClickDetector': 'clickdetector',
  'ProximityPrompt': 'proximityprompt',
  'DragDetector': 'clickdetector',

  // Selection/Highlight
  'Highlight': 'highlight',
  'SelectionBox': 'selectionbox',
  'SelectionSphere': 'selectionbox',
  'BoxHandleAdornment': 'selectionbox',
  'ConeHandleAdornment': 'selectionbox',
  'CylinderHandleAdornment': 'selectionbox',
  'ImageHandleAdornment': 'selectionbox',
  'LineHandleAdornment': 'selectionbox',
  'SphereHandleAdornment': 'selectionbox',
  'WireframeHandleAdornment': 'selectionbox',

  // Tools
  'Tool': 'tool',
  'HopperBin': 'tool',
  'BackpackItem': 'tool',

  // Teams
  'Team': 'team',

  // Player related
  'Player': 'player',
  'Backpack': 'backpack',
  'PlayerScripts': 'folder',
  'PlayerMouse': 'clickdetector',
  'Character': 'character',

  // Meshes
  'BlockMesh': 'blockmesh',
  'CylinderMesh': 'cylindermesh',
  'SpecialMesh': 'specialmesh',
  'FileMesh': 'specialmesh',
  'EditableMesh': 'meshpart',

  // Starter
  'StarterGear': 'startergear',

  // Touch
  'TouchTransmitter': 'touchtransmitter',

  // Dialog
  'Dialog': 'dialog',
  'DialogChoice': 'dialog',

  // Misc
  'ForceField': 'forcefield',
  'DataModel': 'workspace',
};

/**
 * TreeDataProvider for displaying the live Roblox game hierarchy
 */
export class GameTreeDataProvider implements TreeDataProvider<GameTreeItem>, TreeDragAndDropController<GameTreeItem> {
  private _onDidChangeTreeData = new EventEmitter<GameTreeItem | undefined>();
  readonly onDidChangeTreeData: Event<GameTreeItem | undefined> = this._onDidChangeTreeData.event;

  private rootNodes: ReadonlyArray<GameTreeNode> = [];
  private reparentCallback: ReparentCallback | undefined;
  private requestChildrenCallback: RequestChildrenCallback | undefined;
  private extensionPath: string;
  /** Cache of fetched children by path (joined with '.') */
  private childrenCache: Map<string, ReadonlyArray<GameTreeNode>> = new Map();

  /** Drag and drop MIME types */
  readonly dropMimeTypes = [GAME_TREE_MIME_TYPE];
  readonly dragMimeTypes = [GAME_TREE_MIME_TYPE];

  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }

  /**
   * Registers a callback for handling reparent operations
   * @param callback - Function to call when an item is dropped onto another
   */
  onReparent = (callback: ReparentCallback): void => {
    this.reparentCallback = callback;
  };

  /**
   * Registers a callback for requesting children of a node (lazy loading)
   * @param callback - Function to call when children need to be fetched
   */
  onRequestChildren = (callback: RequestChildrenCallback): void => {
    this.requestChildrenCallback = callback;
  };

  /**
   * Refreshes the tree with new game tree data
   * @param nodes - Array of root-level game tree nodes (services)
   */
  refresh = (nodes: ReadonlyArray<GameTreeNode>): void => {
    this.rootNodes = nodes;
    this.childrenCache.clear();
    this._onDidChangeTreeData.fire(undefined);
  };

  /**
   * Clears the tree (called on disconnect)
   */
  clear = (): void => {
    this.rootNodes = [];
    this.childrenCache.clear();
    this._onDidChangeTreeData.fire(undefined);
  };

  getTreeItem = (element: GameTreeItem): TreeItem => {
    // Support lazy loading: show expand arrow if hasChildren is true OR if children array has items
    const hasChildren = element.hasChildren === true ||
      (element.children !== undefined && element.children.length > 0);
    const item = new TreeItem(
      element.name,
      hasChildren ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None
    );
    item.description = element.className;
    item.tooltip = `${element.className}\nPath: game.${element.path.join('.')}`;
    item.contextValue = element.isService ? 'service' : 'instance';
    item.iconPath = this.getIconForClass(element.className);
    return item;
  };

  getChildren = async (element?: GameTreeItem): Promise<GameTreeItem[]> => {
    if (element === undefined) {
      return this.rootNodes.map(node => ({
        'name': node.name,
        'className': node.className,
        'path': [node.name],
        'children': node.children,
        'hasChildren': node.hasChildren,
        'isService': true,
      }));
    }

    console.log('[GameTree] getChildren called for:', element.name, 'hasChildren:', element.hasChildren, 'children:', element.children?.length ?? 'undefined');

    // Check if children are available in the element
    if (element.children !== undefined && element.children.length > 0) {
      console.log('[GameTree] Returning existing children:', element.children.length);
      return element.children.map(child => ({
        'name': child.name,
        'className': child.className,
        'path': [...element.path, child.name],
        'children': child.children,
        'hasChildren': child.hasChildren,
        'isService': false,
      }));
    }

    // Check if we have cached children for this path
    const pathKey = element.path.join('.');
    const cachedChildren = this.childrenCache.get(pathKey);
    if (cachedChildren !== undefined) {
      console.log('[GameTree] Returning cached children:', cachedChildren.length);
      return cachedChildren.map(child => ({
        'name': child.name,
        'className': child.className,
        'path': [...element.path, child.name],
        'children': child.children,
        'hasChildren': child.hasChildren,
        'isService': false,
      }));
    }

    // If hasChildren is true but no children yet, fetch them via callback
    console.log('[GameTree] Checking lazy load: hasChildren=', element.hasChildren, 'callback=', this.requestChildrenCallback !== undefined);
    if (element.hasChildren === true && this.requestChildrenCallback !== undefined) {
      console.log('[GameTree] Fetching children for path:', element.path);
      const fetchedChildren = await this.requestChildrenCallback(element.path);
      console.log('[GameTree] Fetched children result:', fetchedChildren?.length ?? 'undefined');
      if (fetchedChildren !== undefined && fetchedChildren.length > 0) {
        // Cache the fetched children
        this.childrenCache.set(pathKey, fetchedChildren);
        return fetchedChildren.map(child => ({
          'name': child.name,
          'className': child.className,
          'path': [...element.path, child.name],
          'children': child.children,
          'hasChildren': child.hasChildren,
          'isService': false,
        }));
      }
    }

    console.log('[GameTree] Returning empty array');
    return [];
  };

  /**
   * Called when starting to drag items
   */
  handleDrag = (source: readonly GameTreeItem[], dataTransfer: DataTransfer, _token: CancellationToken): void => {
    // Only allow dragging non-service items
    const draggableItems = source.filter(item => item.isService === false);
    if (draggableItems.length === 0) return;

    // Store the paths of dragged items
    const paths = draggableItems.map(item => item.path);
    dataTransfer.set(GAME_TREE_MIME_TYPE, new DataTransferItem(JSON.stringify(paths)));
  };

  /**
   * Called when items are dropped
   */
  handleDrop = async (
    target: GameTreeItem | undefined,
    dataTransfer: DataTransfer,
    _token: CancellationToken
  ): Promise<void> => {
    if (target === undefined || this.reparentCallback === undefined) return;

    const transferItem = dataTransfer.get(GAME_TREE_MIME_TYPE);
    if (transferItem === undefined) return;

    const paths = JSON.parse(await transferItem.asString()) as ReadonlyArray<ReadonlyArray<string>>;

    // Reparent each dragged item to the target
    for (const sourcePath of paths) {
      // Don't allow dropping onto self or parent
      if (this.isParentOrSelf(sourcePath, target.path)) continue;

      await this.reparentCallback(sourcePath, target.path);
    }
  };

  /**
   * Checks if target is a parent of or the same as source
   */
  private isParentOrSelf = (sourcePath: ReadonlyArray<string>, targetPath: ReadonlyArray<string>): boolean => {
    // Can't drop on self
    if (sourcePath.length === targetPath.length) {
      return sourcePath.every((segment, i) => segment === targetPath[i]);
    }

    // Can't drop on own child (target is longer and starts with source)
    if (targetPath.length > sourcePath.length) {
      return sourcePath.every((segment, i) => segment === targetPath[i]);
    }

    return false;
  };

  private getIconForClass = (className: string): Uri => {
    // Check direct match first
    let iconName = CLASS_ICON_MAP[className];

    // Check for partial matches if no direct match
    if (iconName === undefined) {
      if (className.includes('Value')) {
        if (className.includes('Int') || className.includes('Number') || className.includes('Double')) iconName = 'intvalue';
        else if (className.includes('Bool')) iconName = 'boolvalue';
        else if (className.includes('String')) iconName = 'stringvalue';
        else if (className.includes('Object') || className.includes('Instance')) iconName = 'objectvalue';
        else if (className.includes('Color')) iconName = 'color3value';
        else if (className.includes('Vector') || className.includes('Ray')) iconName = 'vector3value';
        else if (className.includes('CFrame')) iconName = 'cframevalue';
        else iconName = 'intvalue';
      }
      else if (className.includes('Part') || className.includes('Mesh')) iconName = 'part';
      else if (className.includes('Light') || className.includes('Atmosphere') || className.includes('Sky') || className.includes('Effect')) iconName = 'lighting';
      else if (className.includes('Constraint')) iconName = 'constraint';
      else if (className.includes('Weld') || className.includes('Joint') || className.includes('Snap') || className.includes('Glue')) iconName = 'weld';
      else if (className.includes('Motor') || className.includes('Rotate')) iconName = 'motor';
      else if (className.includes('Force') || className.includes('Velocity') || className.includes('Gyro') || className.includes('Thrust')) iconName = 'bodyforce';
      else if (className.includes('Animation') || className.includes('Keyframe') || className.includes('Pose')) iconName = 'animation';
      else if (className.includes('Particle') || className.includes('Fire') || className.includes('Smoke') || className.includes('Sparkle')) iconName = 'particleemitter';
      else if (className.includes('Beam')) iconName = 'beam';
      else if (className.includes('Trail')) iconName = 'trail';
      else if (className.includes('Humanoid')) iconName = 'humanoid';
      else if (className.includes('Gui')) iconName = 'frame';
      else if (className.includes('UILayout') || className.includes('Layout')) iconName = 'uilayout';
      else if (className.includes('UIConstraint') || className.includes('UI')) iconName = 'uiconstraint';
      else if (className.includes('Text')) iconName = 'textlabel';
      else if (className.includes('Image') || className.includes('Video')) iconName = 'image';
      else if (className.includes('Button')) iconName = 'textlabel';
      else if (className.includes('Sound')) iconName = 'sound';
      else if (className.includes('Remote') || className.includes('Bindable')) iconName = 'remoteevent';
      else if (className.includes('Decal') || className.includes('Texture') || className.includes('Surface')) iconName = 'decal';
      else if (className.includes('Click') || className.includes('Drag')) iconName = 'clickdetector';
      else if (className.includes('Proximity')) iconName = 'proximityprompt';
      else if (className.includes('Selection') || className.includes('Highlight') || className.includes('Adornment')) iconName = 'highlight';
      else if (className.includes('Attachment') || className.includes('Bone')) iconName = 'attachment';
      else if (className.includes('Tool') || className.includes('Accessory')) iconName = 'tool';
      else if (className.includes('Service')) iconName = 'storage';
      else iconName = 'default';
    }

    return Uri.file(path.join(this.extensionPath, 'images', `${iconName}.svg`));
  };
}
