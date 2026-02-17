import { buildGlobalEnvironment } from '@definitions/globals';
import { describe, expect, test } from 'bun:test';

import type { ClassType, LuauType } from '@typings/types';

const globalEnv = buildGlobalEnvironment();

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

const extractExpressionChain = (
  beforeCursor: string,
): { 'expression': string; 'prefix': string; 'isMethodAccess': boolean } | undefined => {
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

const resolveTypeReference = (type: LuauType): LuauType => {
  if (type.kind === 'TypeReference') {
    const className = type.name;
    const classType = globalEnv.robloxClasses.get(className);
    if (classType !== undefined) return classType;
  }
  return type;
};

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

type ExprPart =
  | { 'kind': 'property'; 'name': string }
  | { 'kind': 'method'; 'name': string; 'args': string }
  | { 'kind': 'call'; 'args': string };

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

const resolveExpressionType = (expression: string): LuauType | undefined => {
  const parts = parseExpression(expression);

  if (parts.length === 0) return undefined;

  const firstPart = parts[0];
  if (firstPart === undefined || firstPart.kind !== 'property') return undefined;
  const firstName = firstPart.name;

  let currentType: LuauType | undefined;

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

  for (let partIdx = 1; partIdx < parts.length; partIdx++) {
    const part = parts[partIdx];
    if (part === undefined) break;

    if (part.kind === 'property') {
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

      if (currentType !== undefined) {
        const resolvedCurrent = resolveTypeReference(currentType);
        if (resolvedCurrent.kind === 'Class') {
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
      return undefined;
    } else if (part.kind === 'call') {
      if (currentType !== undefined && currentType.kind === 'Function') {
        currentType = resolveTypeReference(currentType.returnType);
      }
    }
  }

  return currentType;
};

const resolveCompletion = (beforeCursor: string): LuauType | undefined => {
  const chainInfo = extractExpressionChain(beforeCursor);
  if (chainInfo === undefined) return undefined;

  let resolvedType = resolveExpressionType(chainInfo.expression);

  if (resolvedType !== undefined && resolvedType.kind === 'TypeReference') {
    const classType = globalEnv.robloxClasses.get(resolvedType.name);
    if (classType !== undefined) {
      resolvedType = classType;
    }
  }

  return resolvedType;
};

describe('Basic Expression Resolution', () => {
  test('game resolves to DataModel', () => {
    const result = resolveExpressionType('game');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('DataModel');
  });

  test('workspace resolves to Workspace', () => {
    const result = resolveExpressionType('workspace');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Workspace');
  });
});

describe('GetService Resolution', () => {
  test('game:GetService("Players") resolves to Players', () => {
    const result = resolveExpressionType('game:GetService("Players")');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Players');
  });

  test('game:GetService("Workspace") resolves to Workspace', () => {
    const result = resolveExpressionType('game:GetService("Workspace")');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Workspace');
  });

  test('game:GetService("RunService") resolves to RunService', () => {
    const result = resolveExpressionType('game:GetService("RunService")');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('RunService');
  });

  test('game:GetService("TweenService") resolves to TweenService', () => {
    const result = resolveExpressionType('game:GetService("TweenService")');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('TweenService');
  });

  test("game:GetService('Players') resolves to Players with single quotes", () => {
    const result = resolveExpressionType("game:GetService('Players')");
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Players');
  });
});

describe('Property Access Resolution', () => {
  test('game.Players resolves to Players', () => {
    const result = resolveExpressionType('game.Players');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Players');
  });

  test('game.Workspace resolves to Workspace', () => {
    const result = resolveExpressionType('game.Workspace');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Workspace');
  });

  test('workspace.CurrentCamera resolves to Camera', () => {
    const result = resolveExpressionType('workspace.CurrentCamera');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Camera');
  });
});

describe('Chain Resolution', () => {
  test('game:GetService("Players").LocalPlayer resolves to Player', () => {
    const result = resolveExpressionType('game:GetService("Players").LocalPlayer');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Player');
  });

  test('game.Players.LocalPlayer resolves to Player', () => {
    const result = resolveExpressionType('game.Players.LocalPlayer');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Player');
  });

  test('game.Players.LocalPlayer.Character resolves to Model', () => {
    const result = resolveExpressionType('game.Players.LocalPlayer.Character');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Model');
  });
});

describe('FindFirstChildOfClass/WhichIsA Resolution', () => {
  test('game.Workspace:FindFirstChildOfClass("Part") resolves to Part', () => {
    const result = resolveExpressionType('game.Workspace:FindFirstChildOfClass("Part")');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Part');
  });

  test('game.Workspace:FindFirstChildWhichIsA("BasePart") resolves to BasePart', () => {
    const result = resolveExpressionType('game.Workspace:FindFirstChildWhichIsA("BasePart")');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('BasePart');
  });
});

describe('Completion Handler Integration', () => {
  test('game. resolves to DataModel', () => {
    const result = resolveCompletion('game.');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('DataModel');
  });

  test('game.Players. resolves to Players', () => {
    const result = resolveCompletion('game.Players.');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Players');
  });

  test('game:GetService("Players"). resolves to Players', () => {
    const result = resolveCompletion('game:GetService("Players").');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Players');
  });

  test('game:GetService("Players").LocalPlayer. resolves to Player', () => {
    const result = resolveCompletion('game:GetService("Players").LocalPlayer.');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Player');
  });

  test('game.Players.LocalPlayer. resolves to Player', () => {
    const result = resolveCompletion('game.Players.LocalPlayer.');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Player');
  });

  test('game.Players.LocalPlayer.Character. resolves to Model', () => {
    const result = resolveCompletion('game.Players.LocalPlayer.Character.');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Model');
  });

  test('workspace. resolves to Workspace', () => {
    const result = resolveCompletion('workspace.');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Workspace');
  });

  test('workspace.CurrentCamera. resolves to Camera', () => {
    const result = resolveCompletion('workspace.CurrentCamera.');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Camera');
  });
});

describe('Method Access Completions', () => {
  test('game: resolves to DataModel', () => {
    const result = resolveCompletion('game:');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('DataModel');
  });

  test('game.Players: resolves to Players', () => {
    const result = resolveCompletion('game.Players:');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Players');
  });

  test('game:GetService("Players"): resolves to Players', () => {
    const result = resolveCompletion('game:GetService("Players"):');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Players');
  });

  test('game.Players.LocalPlayer: resolves to Player', () => {
    const result = resolveCompletion('game.Players.LocalPlayer:');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Player');
  });
});

describe('Edge Cases', () => {
  test("game:GetService('Players'). resolves to Players with single quotes", () => {
    const result = resolveCompletion("game:GetService('Players').");
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Players');
  });

  test("game:GetService('Players').LocalPlayer. resolves to Player with single quotes", () => {
    const result = resolveCompletion("game:GetService('Players').LocalPlayer.");
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Player');
  });

  test("game : GetService ( 'Players' ) . resolves to Players with extra whitespace", () => {
    const result = resolveCompletion("game : GetService ( 'Players' ) .");
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Players');
  });
});

describe('WaitForChild Chains', () => {
  test('Instance class has WaitForChild method', () => {
    const instanceClass = globalEnv.robloxClasses.get('Instance');
    expect(instanceClass).toBeDefined();
    expect(instanceClass?.kind).toBe('Class');
    const waitForChild = (instanceClass as ClassType).methods.get('WaitForChild');
    expect(waitForChild).toBeDefined();
  });

  test('workspace:WaitForChild("X") resolves to Instance', () => {
    const result = resolveExpressionType('workspace:WaitForChild("X")');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Instance');
  });

  test('workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds") resolves to Instance', () => {
    const result = resolveExpressionType('workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds")');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Instance');
  });

  test('workspace:FindFirstChild("X") resolves to Instance', () => {
    const result = resolveExpressionType('workspace:FindFirstChild("X")');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Instance');
  });

  test('workspace:FindFirstChild("X"):FindFirstChild("Y") resolves to Instance', () => {
    const result = resolveExpressionType('workspace:FindFirstChild("X"):FindFirstChild("Y")');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Instance');
  });

  test('workspace:WaitForChild("X"):FindFirstChild("Y") resolves to Instance', () => {
    const result = resolveExpressionType('workspace:WaitForChild("X"):FindFirstChild("Y")');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Instance');
  });

  test('workspace:WaitForChild("X"): completion resolves to Instance', () => {
    const result = resolveCompletion('workspace:WaitForChild("X"):');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Instance');
  });

  test('workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds"): completion resolves to Instance', () => {
    const result = resolveCompletion('workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds"):');
    expect(result).toBeDefined();
    expect(result?.kind).toBe('Class');
    expect((result as ClassType).name).toBe('Instance');
  });

  test('extractExpressionChain parses WaitForChild chain correctly', () => {
    const chain = extractExpressionChain('workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds"):');
    expect(chain).toBeDefined();
    expect(chain?.expression).toBeDefined();
    expect(chain?.isMethodAccess).toBe(true);
  });
});
