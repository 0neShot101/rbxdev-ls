/**
 * Comprehensive tests for expression chain resolution in autocompletion
 * Run with: bun tests/chain-resolution.test.ts
 *
 * Tests verify that:
 * - game:GetService('ServiceName') returns the correct service class
 * - Property access chains work correctly
 * - Method call return types are resolved
 * - TypeReference types are properly resolved
 */

import { buildGlobalEnvironment } from '../src/@definitions/globals';

import type { ClassType, LuauType } from '../src/@typings/types';

const globalEnv = buildGlobalEnvironment();

// Map of service names to their class types
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

// Matches the extractExpressionChain function from completion.ts
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

// Matches the resolveTypeReference function from completion.ts
const resolveTypeReference = (type: LuauType): LuauType => {
  if (type.kind === 'TypeReference') {
    const className = type.name;
    const classType = globalEnv.robloxClasses.get(className);
    if (classType !== undefined) return classType;
  }
  return type;
};

// Matches the resolveMemberType function from completion.ts
const resolveMemberType = (type: LuauType, memberName: string): LuauType | undefined => {
  const resolvedType = resolveTypeReference(type);

  if (resolvedType.kind === 'Class') {
    const prop = resolvedType.properties.get(memberName);
    if (prop !== undefined) return resolveTypeReference(prop.type);

    const method = resolvedType.methods.get(memberName);
    if (method !== undefined) return method.func;

    if (resolvedType.superclass !== undefined) {
      return resolveMemberType(resolvedType.superclass, memberName);
    }
  } else if (resolvedType.kind === 'Table') {
    const prop = resolvedType.properties.get(memberName);
    if (prop !== undefined) return resolveTypeReference(prop.type);
  }

  return undefined;
};

// Expression parser matching completion.ts implementation
type ExprPart =
  | { kind: 'property'; name: string }
  | { kind: 'method'; name: string; args: string }
  | { kind: 'call'; args: string };

const parseExpression = (expression: string): ExprPart[] => {
  const parts: ExprPart[] = [];
  let current = '';
  let i = 0;

  while (i < expression.length) {
    const char = expression[i];
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
      if (methodName !== '') {
        parts.push({ 'kind': 'method', 'name': methodName, args });
      }
    } else if (char === '(' || char === '[') {
      if (current !== '') {
        parts.push({ 'kind': 'property', 'name': current });
        current = '';
      }
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
    } else if (char !== undefined && /\w/.test(char)) {
      current += char;
      i++;
    } else {
      i++;
    }
  }

  if (current !== '') {
    parts.push({ 'kind': 'property', 'name': current });
  }

  return parts;
};

// Full expression type resolver matching completion.ts implementation
const resolveExpressionType = (expression: string): LuauType | undefined => {
  const parts = parseExpression(expression);

  if (parts.length === 0) return undefined;

  const firstPart = parts[0];
  if (firstPart === undefined || firstPart.kind !== 'property') return undefined;
  const firstName = firstPart.name;

  let currentType: LuauType | undefined;

  // Check global symbols
  const globalSymbol = globalEnv.env.globalScope.symbols.get(firstName);
  if (globalSymbol !== undefined) {
    currentType = globalSymbol.type;
  } else {
    const classType = globalEnv.robloxClasses.get(firstName);
    if (classType !== undefined) {
      currentType = classType;
    }
  }

  if (currentType === undefined) return undefined;

  // Resolve chain
  for (let partIdx = 1; partIdx < parts.length; partIdx++) {
    const part = parts[partIdx];
    if (part === undefined) break;

    if (part.kind === 'property') {
      // Special case: game.ServiceName
      if (partIdx === 1 && firstName === 'game') {
        const serviceClassName = SERVICE_CLASS_MAP.get(part.name);
        if (serviceClassName !== undefined) {
          const serviceClass = globalEnv.robloxClasses.get(serviceClassName);
          if (serviceClass !== undefined) {
            currentType = serviceClass;
            continue;
          }
        }
      }

      currentType = resolveMemberType(currentType, part.name);
      if (currentType === undefined) return undefined;
    } else if (part.kind === 'method') {
      // Special case: GetService
      if (part.name === 'GetService') {
        const serviceMatch = part.args.match(/["'](\w+)["']/);
        if (serviceMatch !== null) {
          const serviceName = serviceMatch[1];
          if (serviceName !== undefined) {
            const serviceClass = globalEnv.robloxClasses.get(serviceName);
            if (serviceClass !== undefined) {
              currentType = serviceClass;
              continue;
            }
          }
        }
      }

      // Special case: FindFirstChildOfClass/FindFirstChildWhichIsA
      if (part.name === 'FindFirstChildOfClass' || part.name === 'FindFirstChildWhichIsA') {
        const classMatch = part.args.match(/["'](\w+)["']/);
        if (classMatch !== null) {
          const className = classMatch[1];
          if (className !== undefined) {
            const classType = globalEnv.robloxClasses.get(className);
            if (classType !== undefined) {
              currentType = classType;
              continue;
            }
          }
        }
      }

      // For other methods, try to get return type (checking superclass chain)
      if (currentType !== undefined) {
        const resolvedCurrent = resolveTypeReference(currentType);
        if (resolvedCurrent.kind === 'Class') {
          // Search for method in class and all superclasses
          let searchClass: ClassType | undefined = resolvedCurrent;
          while (searchClass !== undefined) {
            const method = searchClass.methods.get(part.name);
            if (method !== undefined) {
              currentType = resolveTypeReference(method.func.returnType);
              break;
            }
            searchClass = searchClass.superclass;
          }
          if (searchClass !== undefined) continue;
        }
      }
      // If we can't resolve the method, return undefined
      return undefined;
    } else if (part.kind === 'call') {
      if (currentType !== undefined && currentType.kind === 'Function') {
        currentType = resolveTypeReference(currentType.returnType);
      }
    }
  }

  return currentType;
};

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

const expectType = (expression: string, expectedClassName: string) => {
  const result = resolveExpressionType(expression);
  if (result === undefined) {
    console.log(`FAIL: "${expression}" => undefined (expected ${expectedClassName})`);
    testsFailed++;
    return;
  }
  if (result.kind !== 'Class') {
    console.log(`FAIL: "${expression}" => ${result.kind} (expected Class ${expectedClassName})`);
    testsFailed++;
    return;
  }
  if (result.name !== expectedClassName) {
    console.log(`FAIL: "${expression}" => Class ${result.name} (expected ${expectedClassName})`);
    testsFailed++;
    return;
  }
  console.log(`PASS: "${expression}" => ${expectedClassName}`);
  testsPassed++;
};

const expectUndefined = (expression: string) => {
  const result = resolveExpressionType(expression);
  if (result === undefined) {
    console.log(`PASS: "${expression}" => undefined (expected undefined)`);
    testsPassed++;
    return;
  }
  console.log(`FAIL: "${expression}" => ${result.kind} (expected undefined)`);
  testsFailed++;
};

// Test simulating the full completion flow with beforeCursor string
const testCompletion = (beforeCursor: string, expectedClassName: string) => {
  const chainInfo = extractExpressionChain(beforeCursor);

  if (chainInfo === undefined) {
    console.log(`FAIL: "${beforeCursor}" => no chain (expected ${expectedClassName})`);
    testsFailed++;
    return;
  }

  let resolvedType = resolveExpressionType(chainInfo.expression);

  if (resolvedType !== undefined && resolvedType.kind === 'TypeReference') {
    const classType = globalEnv.robloxClasses.get(resolvedType.name);
    if (classType !== undefined) {
      resolvedType = classType;
    }
  }

  if (resolvedType === undefined) {
    console.log(`FAIL: "${beforeCursor}" => undefined (expected ${expectedClassName})`);
    testsFailed++;
    return;
  }

  if (resolvedType.kind === 'Class' && resolvedType.name === expectedClassName) {
    console.log(`PASS: "${beforeCursor}" => ${expectedClassName}`);
    testsPassed++;
    return;
  }

  if (resolvedType.kind === 'Class') {
    console.log(`FAIL: "${beforeCursor}" => Class ${resolvedType.name} (expected ${expectedClassName})`);
  } else {
    console.log(`FAIL: "${beforeCursor}" => ${resolvedType.kind} (expected Class ${expectedClassName})`);
  }
  testsFailed++;
};

// Run tests
console.log('=== Chain Resolution Tests ===\n');

console.log('--- Basic Expression Resolution ---');
expectType('game', 'DataModel');
expectType('workspace', 'Workspace');

console.log('\n--- GetService Resolution ---');
expectType('game:GetService("Players")', 'Players');
expectType('game:GetService("Workspace")', 'Workspace');
expectType('game:GetService("RunService")', 'RunService');
expectType('game:GetService("TweenService")', 'TweenService');
expectType("game:GetService('Players')", 'Players');

console.log('\n--- Property Access Resolution ---');
expectType('game.Players', 'Players');
expectType('game.Workspace', 'Workspace');
expectType('workspace.CurrentCamera', 'Camera');

console.log('\n--- Chain Resolution (Key Tests) ---');
expectType('game:GetService("Players").LocalPlayer', 'Player');
expectType('game.Players.LocalPlayer', 'Player');
expectType('game.Players.LocalPlayer.Character', 'Model');

console.log('\n--- FindFirstChildOfClass/WhichIsA Resolution ---');
expectType('game.Workspace:FindFirstChildOfClass("Part")', 'Part');
expectType('game.Workspace:FindFirstChildWhichIsA("BasePart")', 'BasePart');

console.log('\n--- Completion Handler Integration ---');
testCompletion('game.', 'DataModel');
testCompletion('game.Players.', 'Players');
testCompletion('game:GetService("Players").', 'Players');
testCompletion('game:GetService("Players").LocalPlayer.', 'Player');
testCompletion('game.Players.LocalPlayer.', 'Player');
testCompletion('game.Players.LocalPlayer.Character.', 'Model');
testCompletion('workspace.', 'Workspace');
testCompletion('workspace.CurrentCamera.', 'Camera');

console.log('\n--- Method Access Completions ---');
testCompletion('game:', 'DataModel');
testCompletion('game.Players:', 'Players');
testCompletion('game:GetService("Players"):', 'Players');
testCompletion('game.Players.LocalPlayer:', 'Player');

console.log('\n--- Edge Cases ---');
testCompletion("game:GetService('Players').", 'Players');
testCompletion("game:GetService('Players').LocalPlayer.", 'Player');
testCompletion("game : GetService ( 'Players' ) .", 'Players');

console.log('\n--- Chained WaitForChild/FindFirstChild Tests ---');
expectType('workspace:WaitForChild("X")', 'Instance');
expectType('workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds")', 'Instance');
expectType('workspace:FindFirstChild("X")', 'Instance');
expectType('workspace:FindFirstChild("X"):FindFirstChild("Y")', 'Instance');
expectType('workspace:WaitForChild("X"):FindFirstChild("Y")', 'Instance');
testCompletion('workspace:WaitForChild("X"):', 'Instance');
testCompletion('workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds"):', 'Instance');

console.log(`\n=== Results: ${testsPassed} passed, ${testsFailed} failed ===`);

if (testsFailed > 0) {
  process.exit(1);
}
