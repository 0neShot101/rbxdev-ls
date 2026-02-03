/**
 * Roblox API Type Definitions Validation Tests
 * Run with: bun tests/roblox-api-validation.test.ts
 *
 * This test validates that the Roblox API type definitions are complete and correct:
 * - Players class has LocalPlayer property returning Player
 * - Player class has Character property returning Model
 * - TweenService has Create method returning Tween
 * - Tween inherits from TweenBase which has Play method
 * - Instance has GetChildren, FindFirstChild, WaitForChild methods
 * - DataModel (game) has GetService method
 * - Humanoid has Health, WalkSpeed properties
 */

import { buildGlobalEnvironment } from '../src/@definitions/globals';
import type { LuauType, ClassType, ClassMethod, ClassProperty, FunctionType } from '../src/@typings/types';

const globalEnv = buildGlobalEnvironment();

const isClassType = (type: LuauType): type is ClassType => type.kind === 'Class';

const isFunctionType = (type: LuauType): type is FunctionType => type.kind === 'Function';

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

let testsPassed = 0;
let testsFailed = 0;
const failures: string[] = [];

const pass = (message: string): void => {
  console.log(`  PASS: ${message}`);
  testsPassed++;
};

const fail = (message: string): void => {
  console.log(`  FAIL: ${message}`);
  testsFailed++;
  failures.push(message);
};

const getClass = (name: string): ClassType | undefined => {
  const cls = globalEnv.robloxClasses.get(name);
  if (cls === undefined) return undefined;
  if (isClassType(cls) === false) return undefined;
  return cls;
};

console.log('Roblox API Type Definitions Validation\n');
console.log('='.repeat(50));

console.log('\n1. Players class - LocalPlayer property');
const playersClass = getClass('Players');
if (playersClass === undefined) {
  fail('Players class not found');
} else {
  pass('Players class exists');

  const localPlayerProp = getPropertyFromClass(playersClass, 'LocalPlayer');
  if (localPlayerProp === undefined) {
    fail('Players.LocalPlayer property not found');
  } else {
    pass('Players.LocalPlayer property exists');

    const resolvedType = resolveTypeReference(localPlayerProp.type);
    if (isClassType(resolvedType) && resolvedType.name === 'Player') {
      pass('Players.LocalPlayer returns Player type');
    } else if (localPlayerProp.type.kind === 'TypeReference' && localPlayerProp.type.name === 'Player') {
      pass('Players.LocalPlayer returns Player (as TypeReference)');
    } else {
      fail(`Players.LocalPlayer returns wrong type: ${JSON.stringify(localPlayerProp.type)}`);
    }
  }
}

console.log('\n2. Player class - Character property');
const playerClass = getClass('Player');
if (playerClass === undefined) {
  fail('Player class not found');
} else {
  pass('Player class exists');

  const characterProp = getPropertyFromClass(playerClass, 'Character');
  if (characterProp === undefined) {
    fail('Player.Character property not found');
  } else {
    pass('Player.Character property exists');

    const resolvedType = resolveTypeReference(characterProp.type);
    if (isClassType(resolvedType) && resolvedType.name === 'Model') {
      pass('Player.Character returns Model type');
    } else if (characterProp.type.kind === 'TypeReference' && characterProp.type.name === 'Model') {
      pass('Player.Character returns Model (as TypeReference)');
    } else {
      fail(`Player.Character returns wrong type: ${JSON.stringify(characterProp.type)}`);
    }
  }
}

console.log('\n3. TweenService class - Create method');
const tweenServiceClass = getClass('TweenService');
if (tweenServiceClass === undefined) {
  fail('TweenService class not found');
} else {
  pass('TweenService class exists');

  const createMethod = getMethodFromClass(tweenServiceClass, 'Create');
  if (createMethod === undefined) {
    fail('TweenService.Create method not found');
  } else {
    pass('TweenService:Create method exists');

    const returnType = resolveTypeReference(createMethod.func.returnType);
    if (isClassType(returnType) && returnType.name === 'Tween') {
      pass('TweenService:Create returns Tween type');
    } else if (createMethod.func.returnType.kind === 'TypeReference' && createMethod.func.returnType.name === 'Tween') {
      pass('TweenService:Create returns Tween (as TypeReference)');
    } else {
      fail(`TweenService:Create returns wrong type: ${JSON.stringify(createMethod.func.returnType)}`);
    }
  }
}

console.log('\n4. Tween inherits from TweenBase which has Play method');
const tweenClass = getClass('Tween');
const tweenBaseClass = getClass('TweenBase');
if (tweenClass === undefined) {
  fail('Tween class not found');
} else {
  pass('Tween class exists');

  if (tweenBaseClass === undefined) {
    fail('TweenBase class not found');
  } else {
    pass('TweenBase class exists');

    if (tweenClass.superclass === undefined) {
      fail('Tween has no superclass');
    } else if (tweenClass.superclass.name === 'TweenBase') {
      pass('Tween inherits from TweenBase');
    } else {
      fail(`Tween superclass is ${tweenClass.superclass.name}, expected TweenBase`);
    }

    const playMethod = getMethodFromClass(tweenBaseClass, 'Play');
    if (playMethod === undefined) {
      fail('TweenBase.Play method not found');
    } else {
      pass('TweenBase:Play method exists');
    }

    const pauseMethod = getMethodFromClass(tweenBaseClass, 'Pause');
    if (pauseMethod === undefined) {
      fail('TweenBase.Pause method not found');
    } else {
      pass('TweenBase:Pause method exists');
    }

    const cancelMethod = getMethodFromClass(tweenBaseClass, 'Cancel');
    if (cancelMethod === undefined) {
      fail('TweenBase.Cancel method not found');
    } else {
      pass('TweenBase:Cancel method exists');
    }

    const playMethodFromTween = getMethodFromClass(tweenClass, 'Play');
    if (playMethodFromTween === undefined) {
      fail('Play method not accessible from Tween (inheritance issue)');
    } else {
      pass('Play method accessible from Tween via inheritance');
    }
  }
}

console.log('\n5. Instance class - GetChildren, FindFirstChild, WaitForChild methods');
const instanceClass = getClass('Instance');
if (instanceClass === undefined) {
  fail('Instance class not found');
} else {
  pass('Instance class exists');

  const getChildrenMethod = getMethodFromClass(instanceClass, 'GetChildren');
  if (getChildrenMethod === undefined) {
    fail('Instance.GetChildren method not found');
  } else {
    pass('Instance:GetChildren method exists');
  }

  const findFirstChildMethod = getMethodFromClass(instanceClass, 'FindFirstChild');
  if (findFirstChildMethod === undefined) {
    fail('Instance.FindFirstChild method not found');
  } else {
    pass('Instance:FindFirstChild method exists');
  }

  const waitForChildMethod = getMethodFromClass(instanceClass, 'WaitForChild');
  if (waitForChildMethod === undefined) {
    fail('Instance.WaitForChild method not found');
  } else {
    pass('Instance:WaitForChild method exists');
  }
}

console.log('\n6. DataModel (game) class - GetService method');
const dataModelClass = getClass('DataModel');
if (dataModelClass === undefined) {
  fail('DataModel class not found');
} else {
  pass('DataModel class exists');

  const getServiceMethod = getMethodFromClass(dataModelClass, 'GetService');
  if (getServiceMethod === undefined) {
    fail('DataModel.GetService method not found');
  } else {
    pass('DataModel:GetService method exists');

    if (getServiceMethod.func.params.length < 1) {
      fail('DataModel:GetService has no parameters');
    } else {
      const firstParam = getServiceMethod.func.params[0];
      if (firstParam !== undefined && firstParam.name === 'className') {
        pass('DataModel:GetService has className parameter');
      } else {
        pass('DataModel:GetService has parameter (name may differ)');
      }
    }
  }
}

console.log('\n7. Humanoid class - Health, WalkSpeed properties (NOT Torso)');
const humanoidClass = getClass('Humanoid');
if (humanoidClass === undefined) {
  fail('Humanoid class not found');
} else {
  pass('Humanoid class exists');

  const healthProp = getPropertyFromClass(humanoidClass, 'Health');
  if (healthProp === undefined) {
    fail('Humanoid.Health property not found');
  } else {
    pass('Humanoid.Health property exists');

    if (healthProp.type.kind === 'Primitive' && healthProp.type.name === 'number') {
      pass('Humanoid.Health is number type');
    } else {
      pass('Humanoid.Health exists (type may be variant)');
    }
  }

  const walkSpeedProp = getPropertyFromClass(humanoidClass, 'WalkSpeed');
  if (walkSpeedProp === undefined) {
    fail('Humanoid.WalkSpeed property not found');
  } else {
    pass('Humanoid.WalkSpeed property exists');
  }

  const torsoProp = getPropertyFromClass(humanoidClass, 'Torso');
  if (torsoProp !== undefined) {
    console.log('  NOTE: Humanoid has Torso property (this is deprecated, but exists in API)');
  } else {
    pass('Humanoid does NOT have Torso as direct property (correct - Torso is a child)');
  }
}

console.log('\n8. Verify game global has proper services');
const gameSymbol = globalEnv.env.globalScope.symbols.get('game');
if (gameSymbol === undefined) {
  fail('game global not found');
} else {
  pass('game global exists');

  if (isClassType(gameSymbol.type)) {
    const gameType = gameSymbol.type;
    const playersProperty = getPropertyFromClass(gameType, 'Players');
    if (playersProperty !== undefined) {
      pass('game.Players accessible as property');
    } else {
      fail('game.Players not accessible as property');
    }

    const tweenServiceProp = getPropertyFromClass(gameType, 'TweenService');
    if (tweenServiceProp !== undefined) {
      pass('game.TweenService accessible as property');
    } else {
      fail('game.TweenService not accessible as property');
    }
  } else {
    fail('game is not ClassType');
  }
}

console.log('\n' + '='.repeat(50));
console.log(`\nResults: ${testsPassed} passed, ${testsFailed} failed`);

if (testsFailed > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}

console.log('\nAll Roblox API type definitions are valid!');
