import { buildGlobalEnvironment } from '@definitions/globals';
import { describe, expect, test } from 'bun:test';

import type { ClassMethod, ClassProperty, ClassType, LuauType } from '@typings/types';

const globalEnv = buildGlobalEnvironment();

const isClassType = (type: LuauType): type is ClassType => type.kind === 'Class';

const resolveTypeReference = (type: LuauType): LuauType => {
  if (type.kind === 'TypeReference') {
    const resolved = globalEnv.robloxClasses.get(type.name);
    if (resolved !== undefined) return resolved;
  }
  return type;
};

const getMethodFromClass = (cls: ClassType, methodName: string): ClassMethod | undefined => {
  const method = cls.methods.get(methodName);
  if (method !== undefined) return method;

  if (cls.superclass !== undefined) return getMethodFromClass(cls.superclass, methodName);
  return undefined;
};

const getPropertyFromClass = (cls: ClassType, propName: string): ClassProperty | undefined => {
  const prop = cls.properties.get(propName);
  if (prop !== undefined) return prop;

  if (cls.superclass !== undefined) return getPropertyFromClass(cls.superclass, propName);
  return undefined;
};

const getClass = (name: string): ClassType | undefined => {
  const cls = globalEnv.robloxClasses.get(name);
  if (cls === undefined) return undefined;
  if (isClassType(cls) === false) return undefined;
  return cls;
};

describe('1. Players class - LocalPlayer property', () => {
  const playersClass = getClass('Players');

  test('Players class exists', () => {
    expect(playersClass).toBeDefined();
  });

  test('Players.LocalPlayer property exists', () => {
    expect(playersClass).toBeDefined();
    const localPlayerProp = getPropertyFromClass(playersClass!, 'LocalPlayer');
    expect(localPlayerProp).toBeDefined();
  });

  test('Players.LocalPlayer returns Player type', () => {
    expect(playersClass).toBeDefined();
    const localPlayerProp = getPropertyFromClass(playersClass!, 'LocalPlayer');
    expect(localPlayerProp).toBeDefined();

    const resolvedType = resolveTypeReference(localPlayerProp!.type);
    const isPlayerClass = isClassType(resolvedType) && resolvedType.name === 'Player';
    const isPlayerRef = localPlayerProp!.type.kind === 'TypeReference' && localPlayerProp!.type.name === 'Player';
    expect(isPlayerClass || isPlayerRef).toBe(true);
  });
});

describe('2. Player class - Character property', () => {
  const playerClass = getClass('Player');

  test('Player class exists', () => {
    expect(playerClass).toBeDefined();
  });

  test('Player.Character property exists', () => {
    expect(playerClass).toBeDefined();
    const characterProp = getPropertyFromClass(playerClass!, 'Character');
    expect(characterProp).toBeDefined();
  });

  test('Player.Character returns Model type', () => {
    expect(playerClass).toBeDefined();
    const characterProp = getPropertyFromClass(playerClass!, 'Character');
    expect(characterProp).toBeDefined();

    const resolvedType = resolveTypeReference(characterProp!.type);
    const isModelClass = isClassType(resolvedType) && resolvedType.name === 'Model';
    const isModelRef = characterProp!.type.kind === 'TypeReference' && characterProp!.type.name === 'Model';
    expect(isModelClass || isModelRef).toBe(true);
  });
});

describe('3. TweenService class - Create method', () => {
  const tweenServiceClass = getClass('TweenService');

  test('TweenService class exists', () => {
    expect(tweenServiceClass).toBeDefined();
  });

  test('TweenService:Create method exists', () => {
    expect(tweenServiceClass).toBeDefined();
    const createMethod = getMethodFromClass(tweenServiceClass!, 'Create');
    expect(createMethod).toBeDefined();
  });

  test('TweenService:Create returns Tween type', () => {
    expect(tweenServiceClass).toBeDefined();
    const createMethod = getMethodFromClass(tweenServiceClass!, 'Create');
    expect(createMethod).toBeDefined();

    const returnType = resolveTypeReference(createMethod!.func.returnType);
    const isTweenClass = isClassType(returnType) && returnType.name === 'Tween';
    const isTweenRef =
      createMethod!.func.returnType.kind === 'TypeReference' && createMethod!.func.returnType.name === 'Tween';
    expect(isTweenClass || isTweenRef).toBe(true);
  });
});

describe('4. Tween inherits from TweenBase which has Play method', () => {
  const tweenClass = getClass('Tween');
  const tweenBaseClass = getClass('TweenBase');

  test('Tween class exists', () => {
    expect(tweenClass).toBeDefined();
  });

  test('TweenBase class exists', () => {
    expect(tweenBaseClass).toBeDefined();
  });

  test('Tween inherits from TweenBase', () => {
    expect(tweenClass).toBeDefined();
    expect(tweenClass!.superclass).toBeDefined();
    expect(tweenClass!.superclass!.name).toBe('TweenBase');
  });

  test('TweenBase:Play method exists', () => {
    expect(tweenBaseClass).toBeDefined();
    const playMethod = getMethodFromClass(tweenBaseClass!, 'Play');
    expect(playMethod).toBeDefined();
  });

  test('TweenBase:Pause method exists', () => {
    expect(tweenBaseClass).toBeDefined();
    const pauseMethod = getMethodFromClass(tweenBaseClass!, 'Pause');
    expect(pauseMethod).toBeDefined();
  });

  test('TweenBase:Cancel method exists', () => {
    expect(tweenBaseClass).toBeDefined();
    const cancelMethod = getMethodFromClass(tweenBaseClass!, 'Cancel');
    expect(cancelMethod).toBeDefined();
  });

  test('Play method accessible from Tween via inheritance', () => {
    expect(tweenClass).toBeDefined();
    const playMethodFromTween = getMethodFromClass(tweenClass!, 'Play');
    expect(playMethodFromTween).toBeDefined();
  });
});

describe('5. Instance class - GetChildren, FindFirstChild, WaitForChild methods', () => {
  const instanceClass = getClass('Instance');

  test('Instance class exists', () => {
    expect(instanceClass).toBeDefined();
  });

  test('Instance:GetChildren method exists', () => {
    expect(instanceClass).toBeDefined();
    const getChildrenMethod = getMethodFromClass(instanceClass!, 'GetChildren');
    expect(getChildrenMethod).toBeDefined();
  });

  test('Instance:FindFirstChild method exists', () => {
    expect(instanceClass).toBeDefined();
    const findFirstChildMethod = getMethodFromClass(instanceClass!, 'FindFirstChild');
    expect(findFirstChildMethod).toBeDefined();
  });

  test('Instance:WaitForChild method exists', () => {
    expect(instanceClass).toBeDefined();
    const waitForChildMethod = getMethodFromClass(instanceClass!, 'WaitForChild');
    expect(waitForChildMethod).toBeDefined();
  });
});

describe('6. DataModel (game) class - GetService method', () => {
  const dataModelClass = getClass('DataModel');

  test('DataModel class exists', () => {
    expect(dataModelClass).toBeDefined();
  });

  test('DataModel:GetService method exists', () => {
    expect(dataModelClass).toBeDefined();
    const getServiceMethod = getMethodFromClass(dataModelClass!, 'GetService');
    expect(getServiceMethod).toBeDefined();
  });

  test('DataModel:GetService has at least one parameter', () => {
    expect(dataModelClass).toBeDefined();
    const getServiceMethod = getMethodFromClass(dataModelClass!, 'GetService');
    expect(getServiceMethod).toBeDefined();
    expect(getServiceMethod!.func.params.length >= 1).toBe(true);
  });
});

describe('7. Humanoid class - Health, WalkSpeed properties', () => {
  const humanoidClass = getClass('Humanoid');

  test('Humanoid class exists', () => {
    expect(humanoidClass).toBeDefined();
  });

  test('Humanoid.Health property exists', () => {
    expect(humanoidClass).toBeDefined();
    const healthProp = getPropertyFromClass(humanoidClass!, 'Health');
    expect(healthProp).toBeDefined();
  });

  test('Humanoid.Health is number type', () => {
    expect(humanoidClass).toBeDefined();
    const healthProp = getPropertyFromClass(humanoidClass!, 'Health');
    expect(healthProp).toBeDefined();
    const isNumberPrimitive = healthProp!.type.kind === 'Primitive' && healthProp!.type.name === 'number';
    expect(isNumberPrimitive).toBe(true);
  });

  test('Humanoid.WalkSpeed property exists', () => {
    expect(humanoidClass).toBeDefined();
    const walkSpeedProp = getPropertyFromClass(humanoidClass!, 'WalkSpeed');
    expect(walkSpeedProp).toBeDefined();
  });

  test('Humanoid Torso property is either absent or deprecated', () => {
    expect(humanoidClass).toBeDefined();
    const torsoProp = getPropertyFromClass(humanoidClass!, 'Torso');
    if (torsoProp !== undefined) {
      expect(torsoProp.deprecated).toBe(true);
    } else {
      expect(torsoProp).toBeUndefined();
    }
  });
});

describe('8. Verify game global has proper services', () => {
  const gameSymbol = globalEnv.env.globalScope.symbols.get('game');

  test('game global exists', () => {
    expect(gameSymbol).toBeDefined();
  });

  test('game is ClassType', () => {
    expect(gameSymbol).toBeDefined();
    expect(isClassType(gameSymbol!.type)).toBe(true);
  });

  test('game.Players accessible as property', () => {
    expect(gameSymbol).toBeDefined();
    expect(isClassType(gameSymbol!.type)).toBe(true);
    const gameType = gameSymbol!.type as ClassType;
    const playersProperty = getPropertyFromClass(gameType, 'Players');
    expect(playersProperty).toBeDefined();
  });

  test('game.TweenService accessible as property', () => {
    expect(gameSymbol).toBeDefined();
    expect(isClassType(gameSymbol!.type)).toBe(true);
    const gameType = gameSymbol!.type as ClassType;
    const tweenServiceProp = getPropertyFromClass(gameType, 'TweenService');
    expect(tweenServiceProp).toBeDefined();
  });
});
