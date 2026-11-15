import { resolveRequireModuleType } from '@lsp/handlers/completion/moduleTypes';

import type { ClassType, LuauType } from '@typings/types';
import type { DocumentManager } from '@typings/lsp';

/** Conventional variable names mapped to the Roblox class such variables usually hold. */
export const VARIABLE_NAME_HINTS: ReadonlyMap<string, string> = new Map([
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

/** Services reachable as `game.<Name>` mapped to their Roblox class names. */
export const SERVICE_CLASS_MAP: ReadonlyMap<string, string> = new Map([
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

/** Enables completion tracing output. */
export const DEBUG_COMPLETION = false;

/** Writes completion tracing output to stderr when tracing is enabled. */
export const debugLog = (...args: unknown[]): void => {
  if (DEBUG_COMPLETION) console.error('[completion]', ...args);
};

const TYPE_ANNOT_RE = `(?:\\s*:[^=]+)?`;

/** Follows local assignments of a variable back to a `game`, `workspace` or `require` root expression. */
export const traceVarExpression = (varName: string, content: string, depth = 0): string | undefined => {
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

const buildScanPatterns = (varName: string) => ({
  'instanceNew': new RegExp(
    `local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*Instance\\s*\\.\\s*new\\s*\\(\\s*["']([\\w]+)["']`,
  ),
  'getService': new RegExp(
    `local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*game\\s*:\\s*[Gg]et[Ss]ervice\\s*\\(?\\s*["']([\\w]+)["']`,
  ),
  'gameService': new RegExp(`local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*game\\s*\\.\\s*([\\w]+)`),
  'workspace': new RegExp(`local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*workspace\\b`),
  'findChildOfClass': new RegExp(
    `local\\s+${varName}${TYPE_ANNOT_RE}\\s*=.*:FindFirstChildOfClass\\s*\\(\\s*["']([\\w]+)["']`,
  ),
  'findChildWhichIsA': new RegExp(
    `local\\s+${varName}${TYPE_ANNOT_RE}\\s*=.*:FindFirstChildWhichIsA\\s*\\(\\s*["']([\\w]+)["']`,
  ),
  'require': new RegExp(`local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*require\\s*\\(\\s*([^)]+)\\s*\\)`),
  'indirect': new RegExp(`local\\s+${varName}${TYPE_ANNOT_RE}\\s*=\\s*(\\w+)([.:][^\\n]+)`),
  'isDefined': new RegExp(`local\\s+${varName}\\b`),
});

const scanPatternCache = new Map<string, ReturnType<typeof buildScanPatterns>>();

const scanPatternsFor = (varName: string): ReturnType<typeof buildScanPatterns> => {
  const cached = scanPatternCache.get(varName);
  if (cached !== undefined) return cached;

  if (scanPatternCache.size >= 512) scanPatternCache.clear();

  const patterns = buildScanPatterns(varName);
  scanPatternCache.set(varName, patterns);
  return patterns;
};

/** Infers a variable's type by scanning its assignment patterns in the document text. */
export const quickScanForVariableType = (
  varName: string,
  content: string,
  documentManager: DocumentManager,
  logFn?: (message: string) => void,
  documentUri?: string,
): LuauType | undefined => {
  const log = logFn ?? debugLog;
  log(`quickScan for: ${varName}`);

  const patterns = scanPatternsFor(varName);

  const instanceNewMatch = content.match(patterns.instanceNew);
  log(`instanceNewMatch: ${instanceNewMatch !== null ? instanceNewMatch[0] : 'null'}`);
  if (instanceNewMatch !== null) {
    const className = instanceNewMatch[1];
    if (className !== undefined) {
      const classType = documentManager.globalEnv.robloxClasses.get(className);
      log(`quickScan Instance.new class: ${className}, found: ${classType?.kind ?? 'undefined'}`);
      if (classType !== undefined) return classType;
    }
  }

  const getServiceMatch = content.match(patterns.getService);
  if (getServiceMatch !== null) {
    const serviceName = getServiceMatch[1];
    if (serviceName !== undefined) {
      const serviceClass = documentManager.globalEnv.robloxClasses.get(serviceName);
      if (serviceClass !== undefined) return serviceClass;
    }
  }

  const gameServiceMatch = content.match(patterns.gameService);
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

  if (patterns.workspace.test(content)) {
    const workspaceClass = documentManager.globalEnv.robloxClasses.get('Workspace');
    if (workspaceClass !== undefined) return workspaceClass;
  }

  const findChildOfClassMatch = content.match(patterns.findChildOfClass);
  if (findChildOfClassMatch !== null) {
    const className = findChildOfClassMatch[1];
    if (className !== undefined) {
      const classType = documentManager.globalEnv.robloxClasses.get(className);
      if (classType !== undefined) return classType;
    }
  }

  const findChildWhichIsAMatch = content.match(patterns.findChildWhichIsA);
  if (findChildWhichIsAMatch !== null) {
    const className = findChildWhichIsAMatch[1];
    if (className !== undefined) {
      const classType = documentManager.globalEnv.robloxClasses.get(className);
      if (classType !== undefined) return classType;
    }
  }

  const requireMatch = content.match(patterns.require);
  if (requireMatch !== null) {
    const requireArg = requireMatch[1]?.trim();
    if (requireArg !== undefined) {
      const moduleType = resolveRequireModuleType(requireArg, documentManager, documentUri);
      if (moduleType !== undefined) return moduleType;
    }
  }

  const indirectMatch = content.match(patterns.indirect);
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
  if (hintedClass !== undefined && patterns.isDefined.test(content)) {
    const classType = documentManager.globalEnv.robloxClasses.get(hintedClass);
    if (classType !== undefined) return classType;
  }

  return undefined;
};
