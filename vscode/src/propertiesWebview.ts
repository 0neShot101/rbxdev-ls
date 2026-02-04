/**
 * Properties Webview Provider
 * Shows properties with inline editing like Roblox Studio
 */

import {
  CancellationToken,
  ExtensionContext,
  Webview,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from 'vscode';

/**
 * Represents a property entry from the executor
 */
export interface PropertyEntry {
  readonly name: string;
  readonly valueType: string;
  readonly value: string;
  readonly className?: string;
}

/**
 * Callback for when a property value is changed
 */
export type PropertyChangeCallback = (
  instancePath: ReadonlyArray<string>,
  property: string,
  value: string,
  valueType: string
) => Promise<boolean>;

/**
 * Common enum values for dropdowns
 */
const ENUM_VALUES: Record<string, string[]> = {
  // Parts
  'Material': ['Plastic', 'Wood', 'Slate', 'Concrete', 'CorrodedMetal', 'DiamondPlate', 'Foil', 'Grass', 'Ice', 'Marble', 'Granite', 'Brick', 'Pebble', 'Sand', 'Fabric', 'SmoothPlastic', 'Metal', 'WoodPlanks', 'Cobblestone', 'Neon', 'Glass', 'ForceField', 'Air', 'Water', 'Rock', 'Glacier', 'Snow', 'Sandstone', 'Mud', 'Basalt', 'Ground', 'CrackedLava', 'Asphalt', 'LeafyGrass', 'Salt', 'Limestone', 'Pavement', 'Cardboard', 'Carpet', 'CeramicTiles', 'ClayRoofTiles', 'Plaster', 'RoofShingles', 'Rubber', 'Leather'],
  'PartType': ['Block', 'Cylinder', 'Ball', 'Wedge', 'CornerWedge'],
  'Shape': ['Block', 'Cylinder', 'Ball'],
  'SurfaceType': ['Smooth', 'Glue', 'Weld', 'Studs', 'Inlet', 'Universal', 'Hinge', 'Motor', 'SteppingMotor'],
  'FormFactor': ['Symmetric', 'Brick', 'Plate', 'Custom'],
  'RenderFidelity': ['Automatic', 'Precise', 'Performance'],

  // Text
  'Font': ['Legacy', 'Arial', 'ArialBold', 'SourceSans', 'SourceSansBold', 'SourceSansSemibold', 'SourceSansLight', 'SourceSansItalic', 'Bodoni', 'Garamond', 'Cartoon', 'Code', 'Highway', 'SciFi', 'Arcade', 'Fantasy', 'Antique', 'Gotham', 'GothamMedium', 'GothamBold', 'GothamBlack', 'Ubuntu', 'Michroma', 'TitilliumWeb', 'JosefinSans', 'Oswald', 'Merriweather', 'Roboto', 'RobotoMono', 'Sarpanch', 'SpecialElite', 'FredokaOne', 'Creepster', 'IndieFlower', 'PermanentMarker', 'DenkOne', 'BuilderSans', 'BuilderSansMedium', 'BuilderSansBold', 'BuilderSansExtraBold'],
  'FontWeight': ['Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Heavy'],
  'FontStyle': ['Normal', 'Italic'],
  'TextXAlignment': ['Center', 'Left', 'Right'],
  'TextYAlignment': ['Center', 'Top', 'Bottom'],
  'TextTruncate': ['None', 'AtEnd', 'SplitWord'],
  'TextDirection': ['Auto', 'LeftToRight', 'RightToLeft'],
  'LineJoinMode': ['Round', 'Bevel', 'Miter'],

  // UI Layout
  'SortOrder': ['LayoutOrder', 'Name', 'Custom'],
  'HorizontalAlignment': ['Center', 'Left', 'Right'],
  'VerticalAlignment': ['Center', 'Top', 'Bottom'],
  'FillDirection': ['Horizontal', 'Vertical'],
  'StartCorner': ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'],
  'ItemLineAlignment': ['Automatic', 'Start', 'Center', 'End', 'Stretch'],

  // Images
  'ScaleType': ['Stretch', 'Slice', 'Tile', 'Fit', 'Crop'],
  'ResamplerMode': ['Default', 'Pixelated'],

  // Animation/Tweening
  'EasingStyle': ['Linear', 'Sine', 'Back', 'Quad', 'Quart', 'Quint', 'Bounce', 'Elastic', 'Exponential', 'Circular', 'Cubic'],
  'EasingDirection': ['In', 'Out', 'InOut'],
  'AnimationPriority': ['Idle', 'Movement', 'Action', 'Action2', 'Action3', 'Action4', 'Core'],
  'PlaybackState': ['Begin', 'Delayed', 'Playing', 'Paused', 'Completed', 'Cancelled'],

  // Humanoid
  'HumanoidDisplayDistanceType': ['None', 'Viewer', 'Subject'],
  'HumanoidHealthDisplayType': ['DisplayWhenDamaged', 'AlwaysOn', 'AlwaysOff'],
  'HumanoidRigType': ['R6', 'R15'],
  'HumanoidStateType': ['FallingDown', 'Running', 'RunningNoPhysics', 'Climbing', 'StrafingNoPhysics', 'Ragdoll', 'GettingUp', 'Jumping', 'Landed', 'Flying', 'Freefall', 'Seated', 'PlatformStanding', 'Dead', 'Swimming', 'Physics', 'None'],

  // Constraints
  'ActuatorType': ['None', 'Motor', 'Servo'],
  'ConstraintMode': ['Pointwise', 'OneAttachment', 'TwoAttachment'],
  'SurfaceConstraintMode': ['RightAngle', 'Perpendicular', 'Parallel'],

  // Particles/Effects
  'ParticleEmitterShape': ['Box', 'Sphere', 'Cylinder', 'Disc'],
  'ParticleEmitterShapeInOut': ['Outward', 'Inward', 'InAndOut'],
  'ParticleEmitterShapeStyle': ['Volume', 'Surface'],
  'ParticleFlipbookLayout': ['None', 'Grid2x2', 'Grid4x4', 'Grid8x8'],
  'ParticleFlipbookMode': ['Loop', 'OneShot', 'PingPong', 'Random'],
  'ParticleOrientation': ['FacingCamera', 'FacingCameraWorldUp', 'VelocityParallel', 'VelocityPerpendicular'],

  // Lighting
  'Technology': ['Legacy', 'Voxel', 'Compatibility', 'ShadowMap', 'Future'],
  'ShadowSoftness': ['None', 'Light', 'Heavy'],

  // Sound
  'RollOffMode': ['Inverse', 'Linear', 'LinearSquare', 'InverseTapered'],
  'VolumeMode': ['Normal', 'AddVolume', 'SubVolume'],

  // GUI
  'AutomaticSize': ['None', 'X', 'Y', 'XY'],
  'BorderMode': ['Outline', 'Middle', 'Inset'],
  'SizeConstraint': ['RelativeXY', 'RelativeXX', 'RelativeYY'],
  'ZIndexBehavior': ['Global', 'Sibling'],
  'ScreenInsets': ['None', 'DeviceSafeInsets', 'CoreUISafeInsets', 'TopbarSafeInsets'],
  'SafeAreaCompatibility': ['None', 'FullscreenExtension'],
  'ScrollBarInset': ['None', 'ScrollBar', 'Always'],
  'ScrollingDirection': ['X', 'Y', 'XY'],
  'ElasticBehavior': ['WhenScrollable', 'Always', 'Never'],
  'SelectionBehavior': ['Escape', 'Stop'],
  'ApplyStrokeMode': ['Contextual', 'Border'],
  'AspectType': ['FitWithinMaxSize', 'ScaleWithParentSize'],
  'DominantAxis': ['Width', 'Height'],

  // ProximityPrompt
  'ProximityPromptStyle': ['Default', 'Custom'],
  'ProximityPromptExclusivity': ['OnePerButton', 'OneGlobally', 'AlwaysShow'],

  // Camera
  'CameraMode': ['Classic', 'LockFirstPerson'],
  'CameraType': ['Fixed', 'Watch', 'Attach', 'Track', 'Follow', 'Custom', 'Scriptable', 'Orbital'],
  'FieldOfViewMode': ['Vertical', 'Diagonal', 'MaxAxis'],

  // Input
  'KeyCode': ['Unknown', 'Backspace', 'Tab', 'Clear', 'Return', 'Pause', 'Escape', 'Space', 'QuotedDouble', 'Hash', 'Dollar', 'Percent', 'Ampersand', 'Quote', 'LeftParenthesis', 'RightParenthesis', 'Asterisk', 'Plus', 'Comma', 'Minus', 'Period', 'Slash', 'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Colon', 'Semicolon', 'LessThan', 'Equals', 'GreaterThan', 'Question', 'At', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'LeftBracket', 'BackSlash', 'RightBracket', 'Caret', 'Underscore', 'Backquote', 'Delete', 'World0', 'World1', 'KeypadZero', 'KeypadOne', 'KeypadTwo', 'KeypadThree', 'KeypadFour', 'KeypadFive', 'KeypadSix', 'KeypadSeven', 'KeypadEight', 'KeypadNine', 'KeypadPeriod', 'KeypadDivide', 'KeypadMultiply', 'KeypadMinus', 'KeypadPlus', 'KeypadEnter', 'KeypadEquals', 'Up', 'Down', 'Right', 'Left', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'LeftShift', 'RightShift', 'LeftMeta', 'RightMeta', 'LeftAlt', 'RightAlt', 'LeftControl', 'RightControl', 'CapsLock', 'NumLock', 'ScrollLock', 'LeftSuper', 'RightSuper', 'Mode', 'Compose', 'Help', 'Print', 'SysReq', 'Break', 'Menu', 'Power', 'Euro', 'Undo', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15'],
  'UserInputType': ['MouseButton1', 'MouseButton2', 'MouseButton3', 'MouseWheel', 'MouseMovement', 'Touch', 'Keyboard', 'Focus', 'Accelerometer', 'Gyro', 'Gamepad1', 'Gamepad2', 'Gamepad3', 'Gamepad4', 'Gamepad5', 'Gamepad6', 'Gamepad7', 'Gamepad8', 'TextInput', 'InputMethod', 'None'],
  'ContextActionPriority': ['Low', 'Medium', 'Default', 'High'],
  'ContextActionResult': ['Sink', 'Pass'],

  // Mesh
  'MeshType': ['Head', 'Torso', 'Wedge', 'Prism', 'Pyramid', 'ParallelRamp', 'RightAngleRamp', 'CornerWedge', 'Brick', 'Sphere', 'Cylinder', 'FileMesh'],

  // Collision
  'CollisionFidelity': ['Default', 'Hull', 'Box', 'PreciseConvexDecomposition'],
  'FluidFidelity': ['Automatic', 'UseCollisionGeometry', 'UsePreciseGeometry'],

  // Selection/Adornments
  'HighlightDepthMode': ['AlwaysOnTop', 'Occluded'],
  'AdornCullingMode': ['Automatic', 'Never'],
  'HandleType': ['MoveAxis', 'RotateAxis', 'ResizeAxis'],

  // Network
  'ClientReplicateTarget': ['None', 'Server', 'All'],
  'PacketPriority': ['Immediate', 'High', 'Medium', 'Low', 'Idle'],

  // Character Appearance
  'BodyPart': ['Head', 'Torso', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg'],
  'BodyPartR15': ['Head', 'UpperTorso', 'LowerTorso', 'LeftFoot', 'LeftLowerLeg', 'LeftUpperLeg', 'RightFoot', 'RightLowerLeg', 'RightUpperLeg', 'LeftHand', 'LeftLowerArm', 'LeftUpperArm', 'RightHand', 'RightLowerArm', 'RightUpperArm', 'RootPart', 'Unknown'],
  'AvatarItemType': ['Asset', 'Bundle'],
  'AccessoryType': ['Unknown', 'Hat', 'Hair', 'Face', 'Neck', 'Shoulder', 'Front', 'Back', 'Waist', 'TShirt', 'Shirt', 'Pants', 'Jacket', 'Sweater', 'Shorts', 'LeftShoe', 'RightShoe', 'DressSkirt', 'Eyebrow', 'Eyelash', 'Head', 'LeftArm', 'LeftLeg', 'RightArm', 'RightLeg', 'Torso'],

  // Misc
  'NormalId': ['Top', 'Bottom', 'Front', 'Back', 'Left', 'Right'],
  'Axis': ['X', 'Y', 'Z'],
  'InputType': ['NoInput', 'Constant', 'Sin'],
  'PathStatus': ['Success', 'ClosestNoPath', 'ClosestOutOfRange', 'FailStartNotEmpty', 'FailFinishNotEmpty', 'NoPath'],
  'PathWaypointAction': ['Walk', 'Jump', 'Custom'],
  'ExplosionType': ['NoCraters', 'Craters'],
  'DeviceType': ['Unknown', 'Desktop', 'Tablet', 'Phone'],
  'DeviceTouchMovementMode': ['UserChoice', 'Thumbstick', 'DPad', 'Thumbpad', 'ClickToMove', 'Scriptable', 'DynamicThumbstick'],
  'ComputerMovementMode': ['Default', 'KeyboardMouse', 'ClickToMove', 'Scriptable'],
  'ComputerCameraMovementMode': ['Default', 'Follow', 'Classic', 'Orbital', 'CameraToggle'],
  'TouchCameraMovementMode': ['Default', 'Follow', 'Classic', 'Orbital'],
  'VirtualCursorMode': ['Default', 'Disabled', 'Enabled'],
  'OutputLayoutMode': ['Horizontal', 'Vertical'],
  'DialogPurpose': ['Quest', 'Help', 'Shop'],
  'DialogTone': ['Neutral', 'Friendly', 'Enemy'],
  'DialogBehaviorType': ['SinglePlayer', 'MultiplePlayers'],
  'LoadCharacterLayeredClothing': ['Default', 'Disabled', 'Enabled'],
  'GameAvatarType': ['R6', 'R15', 'PlayerChoice'],
  'VRScaling': ['World', 'Off'],
};

/**
 * WebviewViewProvider for displaying instance properties with inline editing
 */
export class PropertiesWebviewProvider implements WebviewViewProvider {
  public static readonly viewType = 'rbxdev-properties';

  private webviewView?: WebviewView;
  private properties: PropertyEntry[] = [];
  private instanceName: string = '';
  private currentPath: ReadonlyArray<string> = [];
  private onChangeCallback?: PropertyChangeCallback;

  constructor(private readonly context: ExtensionContext) {}

  /**
   * Registers a callback for property changes
   */
  onPropertyChange = (callback: PropertyChangeCallback): void => {
    this.onChangeCallback = callback;
  };

  /**
   * Updates the properties display
   */
  setProperties = (instanceName: string, properties: PropertyEntry[], path: ReadonlyArray<string>): void => {
    this.instanceName = instanceName;
    this.properties = properties;
    this.currentPath = path;
    this.updateWebview();
  };

  /**
   * Clears the properties display
   */
  clear = (): void => {
    this.instanceName = '';
    this.properties = [];
    this.currentPath = [];
    this.updateWebview();
  };

  resolveWebviewView = (
    webviewView: WebviewView,
    _context: WebviewViewResolveContext,
    _token: CancellationToken
  ): void => {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'propertyChange' && this.onChangeCallback !== undefined) {
        const success = await this.onChangeCallback(
          this.currentPath,
          message.property,
          message.value,
          message.valueType
        );
        // Send result back to webview
        webviewView.webview.postMessage({ 'type': 'changeResult', 'property': message.property, success });
      }
    });

    this.updateWebview();
  };

  private updateWebview = (): void => {
    if (this.webviewView === undefined) return;
    this.webviewView.webview.html = this.getHtml(this.webviewView.webview);
  };

  private getHtml = (webview: Webview): string => {
    const properties = this.properties;
    const instanceName = this.instanceName;

    // Generate property rows
    const propertyRows = properties.map(prop => this.getPropertyRow(prop)).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 8px;
    }
    .header {
      font-weight: bold;
      padding: 4px 0 8px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
      margin-bottom: 8px;
      color: var(--vscode-foreground);
    }
    .empty {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 8px 0;
    }
    .property-row {
      display: flex;
      align-items: center;
      padding: 3px 0;
      gap: 8px;
    }
    .property-name {
      flex: 0 0 100px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .property-value {
      flex: 1;
      min-width: 0;
    }
    input[type="text"], input[type="number"], select {
      width: 100%;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      padding: 3px 6px;
      font-size: 12px;
      font-family: var(--vscode-font-family);
      border-radius: 2px;
    }
    input:focus, select:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }
    input[type="color"] {
      width: 24px;
      height: 24px;
      padding: 0;
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
      cursor: pointer;
      vertical-align: middle;
    }
    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .color-input-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .color-input-group input[type="text"] {
      flex: 1;
    }
    .vector-input {
      display: flex;
      gap: 4px;
    }
    .vector-input input {
      flex: 1;
      min-width: 0;
    }
    .saving {
      opacity: 0.5;
    }
    .error {
      border-color: var(--vscode-inputValidation-errorBorder) !important;
    }
  </style>
</head>
<body>
  ${instanceName ? `<div class="header">${this.escapeHtml(instanceName)}</div>` : ''}
  ${properties.length === 0 ? '<div class="empty">Select an instance to view properties</div>' : ''}
  <div id="properties">
    ${propertyRows}
  </div>
  <script>
    const vscode = acquireVsCodeApi();

    function sendChange(property, value, valueType) {
      const input = document.querySelector('[data-property="' + property + '"]');
      if (input) input.classList.add('saving');
      vscode.postMessage({ type: 'propertyChange', property, value, valueType });
    }

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'changeResult') {
        const input = document.querySelector('[data-property="' + message.property + '"]');
        if (input) {
          input.classList.remove('saving');
          if (!message.success) {
            input.classList.add('error');
            setTimeout(() => input.classList.remove('error'), 2000);
          }
        }
      }
    });

    // Color picker change handler
    function onColorChange(property, colorInput, textInput) {
      const hex = colorInput.value;
      const r = parseInt(hex.substr(1,2), 16) / 255;
      const g = parseInt(hex.substr(3,2), 16) / 255;
      const b = parseInt(hex.substr(5,2), 16) / 255;
      const rgb = r.toFixed(3) + ', ' + g.toFixed(3) + ', ' + b.toFixed(3);
      textInput.value = rgb;
      sendChange(property, rgb, 'Color3');
    }

    // Text to color sync
    function syncTextToColor(textInput, colorInput) {
      const parts = textInput.value.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 3 && parts.every(n => !isNaN(n) && n >= 0 && n <= 1)) {
        const hex = '#' + parts.map(n => Math.round(n * 255).toString(16).padStart(2, '0')).join('');
        colorInput.value = hex;
      }
    }
  </script>
</body>
</html>`;
  };

  private getPropertyRow = (prop: PropertyEntry): string => {
    const name = this.escapeHtml(prop.name);
    const value = this.escapeHtml(prop.value);
    const valueType = prop.valueType;

    let inputHtml = '';

    switch (valueType) {
      case 'boolean':
        inputHtml = `<input type="checkbox" data-property="${name}" ${prop.value === 'true' ? 'checked' : ''}
          onchange="sendChange('${name}', this.checked ? 'true' : 'false', 'boolean')">`;
        break;

      case 'Color3': {
        // Convert RGB to hex for color picker
        const parts = prop.value.split(',').map(s => parseFloat(s.trim()));
        let hex = '#888888';
        if (parts.length === 3 && parts.every(n => !isNaN(n))) {
          hex = '#' + parts.map(n => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, '0')).join('');
        }
        inputHtml = `<div class="color-input-group">
          <input type="color" value="${hex}" id="color-${name}"
            onchange="onColorChange('${name}', this, document.getElementById('text-${name}'))">
          <input type="text" id="text-${name}" data-property="${name}" value="${value}"
            oninput="syncTextToColor(this, document.getElementById('color-${name}'))"
            onchange="sendChange('${name}', this.value, 'Color3')">
        </div>`;
        break;
      }

      case 'EnumItem': {
        // Parse enum type and create dropdown
        const enumMatch = prop.value.match(/^Enum\.(\w+)\.(\w+)$/);
        if (enumMatch !== null && enumMatch[1] !== undefined) {
          const enumType = enumMatch[1];
          const currentValue = enumMatch[2];
          const values = ENUM_VALUES[enumType];

          if (values !== undefined) {
            const options = values.map(v =>
              `<option value="Enum.${enumType}.${v}" ${v === currentValue ? 'selected' : ''}>${v}</option>`
            ).join('');
            inputHtml = `<select data-property="${name}" onchange="sendChange('${name}', this.value, 'EnumItem')">
              ${options}
            </select>`;
          } else {
            inputHtml = `<input type="text" data-property="${name}" value="${value}"
              onchange="sendChange('${name}', this.value, 'EnumItem')">`;
          }
        } else {
          inputHtml = `<input type="text" data-property="${name}" value="${value}"
            onchange="sendChange('${name}', this.value, 'EnumItem')">`;
        }
        break;
      }

      case 'BrickColor': {
        const brickColors = ['White', 'Grey', 'Light grey', 'Black', 'Really black', 'Bright red', 'Bright orange', 'Bright yellow', 'Bright green', 'Bright blue', 'Bright violet', 'Hot pink', 'Lime green', 'Cyan', 'Teal', 'Deep blue', 'Navy blue', 'Dark green', 'Brown', 'Reddish brown', 'Nougat'];
        const options = brickColors.map(c =>
          `<option value="${c}" ${c === prop.value ? 'selected' : ''}>${c}</option>`
        ).join('');
        inputHtml = `<select data-property="${name}" onchange="sendChange('${name}', this.value, 'BrickColor')">
          ${options}
          <option value="${value}" ${!brickColors.includes(prop.value) ? 'selected' : ''}>${value}</option>
        </select>`;
        break;
      }

      case 'number':
        inputHtml = `<input type="text" data-property="${name}" value="${value}"
          onchange="sendChange('${name}', this.value, 'number')">`;
        break;

      case 'Vector3':
      case 'CFrame':
        inputHtml = `<input type="text" data-property="${name}" value="${value}" placeholder="x, y, z"
          onchange="sendChange('${name}', this.value, '${valueType}')">`;
        break;

      case 'Vector2':
        inputHtml = `<input type="text" data-property="${name}" value="${value}" placeholder="x, y"
          onchange="sendChange('${name}', this.value, '${valueType}')">`;
        break;

      case 'UDim2':
        inputHtml = `<input type="text" data-property="${name}" value="${value}" placeholder="{xS, xO}, {yS, yO}"
          onchange="sendChange('${name}', this.value, 'UDim2')">`;
        break;

      default:
        inputHtml = `<input type="text" data-property="${name}" value="${value}"
          onchange="sendChange('${name}', this.value, '${valueType}')">`;
    }

    return `<div class="property-row">
      <span class="property-name" title="${name}">${name}</span>
      <div class="property-value">${inputHtml}</div>
    </div>`;
  };

  private escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
}
