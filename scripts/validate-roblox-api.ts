/**
 * Roblox API Validation Script
 * Validates that the converted Roblox API types are complete and correct
 */

import { buildGlobalEnvironment, type GlobalEnvironment } from '../src/@definitions/globals';

import type { ClassMethod, ClassType, FunctionType, LuauType } from '../src/@typings/types';

interface ValidationError {
  readonly category: string;
  readonly message: string;
}

interface ValidationResult {
  readonly passed: boolean;
  readonly errors: ReadonlyArray<ValidationError>;
  readonly warnings: ReadonlyArray<string>;
}

const isClassType = (type: LuauType): type is ClassType => type.kind === 'Class';

const getClassProperty = (classType: ClassType, propertyName: string, env: GlobalEnvironment): LuauType | undefined => {
  const prop = classType.properties.get(propertyName);
  if (prop !== undefined) return prop.type;

  // Check superclass
  if (classType.superclass !== undefined) {
    return getClassProperty(classType.superclass, propertyName, env);
  }

  return undefined;
};

const getClassMethod = (
  classType: ClassType,
  methodName: string,
  env: GlobalEnvironment,
): { func: FunctionType; method: ClassMethod } | undefined => {
  const method = classType.methods.get(methodName);
  if (method !== undefined) return { 'func': method.func, method };

  // Check superclass
  if (classType.superclass !== undefined) {
    return getClassMethod(classType.superclass, methodName, env);
  }

  return undefined;
};

const validatePlayersClass = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];
  const playersClass = env.robloxClasses.get('Players');

  if (playersClass === undefined) {
    errors.push({ 'category': 'Players', 'message': 'Players class not found' });
    return errors;
  }

  if (isClassType(playersClass) === false) {
    errors.push({ 'category': 'Players', 'message': 'Players is not a class type' });
    return errors;
  }

  // Check LocalPlayer property
  const localPlayer = getClassProperty(playersClass, 'LocalPlayer', env);
  if (localPlayer === undefined) {
    errors.push({ 'category': 'Players', 'message': 'LocalPlayer property not found on Players' });
  } else if (localPlayer.kind !== 'Class' && localPlayer.kind !== 'TypeReference') {
    errors.push({ 'category': 'Players', 'message': `LocalPlayer has wrong type: ${localPlayer.kind}` });
  } else if (localPlayer.kind === 'Class' && localPlayer.name !== 'Player') {
    errors.push({
      'category': 'Players',
      'message': `LocalPlayer should be Player but is ${localPlayer.name}`,
    });
  } else if (localPlayer.kind === 'TypeReference' && localPlayer.name !== 'Player') {
    errors.push({
      'category': 'Players',
      'message': `LocalPlayer should be Player but is ${localPlayer.name}`,
    });
  }

  return errors;
};

const validatePlayerClass = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];
  const playerClass = env.robloxClasses.get('Player');

  if (playerClass === undefined) {
    errors.push({ 'category': 'Player', 'message': 'Player class not found' });
    return errors;
  }

  if (isClassType(playerClass) === false) {
    errors.push({ 'category': 'Player', 'message': 'Player is not a class type' });
    return errors;
  }

  // Check Character property
  const character = getClassProperty(playerClass, 'Character', env);
  if (character === undefined) {
    errors.push({ 'category': 'Player', 'message': 'Character property not found on Player' });
  } else if (character.kind !== 'Class' && character.kind !== 'TypeReference') {
    errors.push({ 'category': 'Player', 'message': `Character has wrong type: ${character.kind}` });
  }

  // Check superclass is Instance
  if (playerClass.superclass === undefined || playerClass.superclass.name !== 'Instance') {
    errors.push({
      'category': 'Player',
      'message': `Player should inherit from Instance, but inherits from ${playerClass.superclass?.name ?? 'nothing'}`,
    });
  }

  return errors;
};

const validateTweenService = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];
  const tweenServiceClass = env.robloxClasses.get('TweenService');

  if (tweenServiceClass === undefined) {
    errors.push({ 'category': 'TweenService', 'message': 'TweenService class not found' });
    return errors;
  }

  if (isClassType(tweenServiceClass) === false) {
    errors.push({ 'category': 'TweenService', 'message': 'TweenService is not a class type' });
    return errors;
  }

  // Check Create method
  const createMethodResult = getClassMethod(tweenServiceClass, 'Create', env);
  if (createMethodResult === undefined) {
    errors.push({ 'category': 'TweenService', 'message': 'Create method not found on TweenService' });
  } else {
    // Check return type
    const returnType = createMethodResult.func.returnType;
    if (returnType.kind !== 'Class' && returnType.kind !== 'TypeReference') {
      errors.push({
        'category': 'TweenService',
        'message': `Create method should return Tween but returns ${returnType.kind}`,
      });
    } else if (returnType.kind === 'Class' && returnType.name !== 'Tween') {
      errors.push({
        'category': 'TweenService',
        'message': `Create method should return Tween but returns ${returnType.name}`,
      });
    } else if (returnType.kind === 'TypeReference' && returnType.name !== 'Tween') {
      errors.push({
        'category': 'TweenService',
        'message': `Create method should return Tween but returns ${returnType.name}`,
      });
    }
  }

  return errors;
};

const validateTweenBaseAndTween = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];
  const tweenBaseClass = env.robloxClasses.get('TweenBase');
  const tweenClass = env.robloxClasses.get('Tween');

  if (tweenBaseClass === undefined) {
    errors.push({ 'category': 'TweenBase', 'message': 'TweenBase class not found' });
    return errors;
  }

  if (isClassType(tweenBaseClass) === false) {
    errors.push({ 'category': 'TweenBase', 'message': 'TweenBase is not a class type' });
    return errors;
  }

  // Check Play, Pause, Cancel methods on TweenBase
  const playMethod = getClassMethod(tweenBaseClass, 'Play', env);
  if (playMethod === undefined) {
    errors.push({ 'category': 'TweenBase', 'message': 'Play method not found on TweenBase' });
  }

  const pauseMethod = getClassMethod(tweenBaseClass, 'Pause', env);
  if (pauseMethod === undefined) {
    errors.push({ 'category': 'TweenBase', 'message': 'Pause method not found on TweenBase' });
  }

  const cancelMethod = getClassMethod(tweenBaseClass, 'Cancel', env);
  if (cancelMethod === undefined) {
    errors.push({ 'category': 'TweenBase', 'message': 'Cancel method not found on TweenBase' });
  }

  // Validate Tween inherits from TweenBase
  if (tweenClass === undefined) {
    errors.push({ 'category': 'Tween', 'message': 'Tween class not found' });
    return errors;
  }

  if (isClassType(tweenClass) === false) {
    errors.push({ 'category': 'Tween', 'message': 'Tween is not a class type' });
    return errors;
  }

  if (tweenClass.superclass === undefined || tweenClass.superclass.name !== 'TweenBase') {
    errors.push({
      'category': 'Tween',
      'message': `Tween should inherit from TweenBase, but inherits from ${tweenClass.superclass?.name ?? 'nothing'}`,
    });
  }

  // Ensure Tween can access TweenBase methods through inheritance
  const tweenPlayMethod = getClassMethod(tweenClass, 'Play', env);
  if (tweenPlayMethod === undefined) {
    errors.push({ 'category': 'Tween', 'message': 'Play method not accessible on Tween (inheritance issue)' });
  }

  return errors;
};

const validateHumanoid = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];
  const humanoidClass = env.robloxClasses.get('Humanoid');

  if (humanoidClass === undefined) {
    errors.push({ 'category': 'Humanoid', 'message': 'Humanoid class not found' });
    return errors;
  }

  if (isClassType(humanoidClass) === false) {
    errors.push({ 'category': 'Humanoid', 'message': 'Humanoid is not a class type' });
    return errors;
  }

  // Check Health property
  const health = getClassProperty(humanoidClass, 'Health', env);
  if (health === undefined) {
    errors.push({ 'category': 'Humanoid', 'message': 'Health property not found on Humanoid' });
  }

  // Check WalkSpeed property
  const walkSpeed = getClassProperty(humanoidClass, 'WalkSpeed', env);
  if (walkSpeed === undefined) {
    errors.push({ 'category': 'Humanoid', 'message': 'WalkSpeed property not found on Humanoid' });
  }

  // Check MaxHealth property
  const maxHealth = getClassProperty(humanoidClass, 'MaxHealth', env);
  if (maxHealth === undefined) {
    errors.push({ 'category': 'Humanoid', 'message': 'MaxHealth property not found on Humanoid' });
  }

  // Verify Torso does NOT exist (it's a legacy/deprecated property that should not be present)
  const torso = humanoidClass.properties.get('Torso');
  if (torso !== undefined) {
    // This is a warning, not an error - Torso is deprecated
    console.log('Warning: Humanoid has deprecated Torso property');
  }

  return errors;
};

const validateInstance = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];
  const instanceClass = env.robloxClasses.get('Instance');

  if (instanceClass === undefined) {
    errors.push({ 'category': 'Instance', 'message': 'Instance class not found' });
    return errors;
  }

  if (isClassType(instanceClass) === false) {
    errors.push({ 'category': 'Instance', 'message': 'Instance is not a class type' });
    return errors;
  }

  // Check key methods
  const findFirstChild = getClassMethod(instanceClass, 'FindFirstChild', env);
  if (findFirstChild === undefined) {
    errors.push({ 'category': 'Instance', 'message': 'FindFirstChild method not found on Instance' });
  }

  const waitForChild = getClassMethod(instanceClass, 'WaitForChild', env);
  if (waitForChild === undefined) {
    errors.push({ 'category': 'Instance', 'message': 'WaitForChild method not found on Instance' });
  }

  const getChildren = getClassMethod(instanceClass, 'GetChildren', env);
  if (getChildren === undefined) {
    errors.push({ 'category': 'Instance', 'message': 'GetChildren method not found on Instance' });
  }

  const destroy = getClassMethod(instanceClass, 'Destroy', env);
  if (destroy === undefined) {
    errors.push({ 'category': 'Instance', 'message': 'Destroy method not found on Instance' });
  }

  const clone = getClassMethod(instanceClass, 'Clone', env);
  if (clone === undefined) {
    errors.push({ 'category': 'Instance', 'message': 'Clone method not found on Instance' });
  }

  return errors;
};

const validateDataModel = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];
  const dataModelClass = env.robloxClasses.get('DataModel');

  if (dataModelClass === undefined) {
    errors.push({ 'category': 'DataModel', 'message': 'DataModel class not found' });
    return errors;
  }

  if (isClassType(dataModelClass) === false) {
    errors.push({ 'category': 'DataModel', 'message': 'DataModel is not a class type' });
    return errors;
  }

  // Check GetService method
  const getService = getClassMethod(dataModelClass, 'GetService', env);
  if (getService === undefined) {
    errors.push({ 'category': 'DataModel', 'message': 'GetService method not found on DataModel' });
  }

  return errors;
};

const validateModel = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];
  const modelClass = env.robloxClasses.get('Model');

  if (modelClass === undefined) {
    errors.push({ 'category': 'Model', 'message': 'Model class not found' });
    return errors;
  }

  if (isClassType(modelClass) === false) {
    errors.push({ 'category': 'Model', 'message': 'Model is not a class type' });
    return errors;
  }

  // Check PrimaryPart property
  const primaryPart = getClassProperty(modelClass, 'PrimaryPart', env);
  if (primaryPart === undefined) {
    errors.push({ 'category': 'Model', 'message': 'PrimaryPart property not found on Model' });
  }

  return errors;
};

const validateBasePart = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];
  const basePartClass = env.robloxClasses.get('BasePart');

  if (basePartClass === undefined) {
    errors.push({ 'category': 'BasePart', 'message': 'BasePart class not found' });
    return errors;
  }

  if (isClassType(basePartClass) === false) {
    errors.push({ 'category': 'BasePart', 'message': 'BasePart is not a class type' });
    return errors;
  }

  // Check Position property
  const position = getClassProperty(basePartClass, 'Position', env);
  if (position === undefined) {
    errors.push({ 'category': 'BasePart', 'message': 'Position property not found on BasePart' });
  }

  // Check CFrame property
  const cframe = getClassProperty(basePartClass, 'CFrame', env);
  if (cframe === undefined) {
    errors.push({ 'category': 'BasePart', 'message': 'CFrame property not found on BasePart' });
  }

  return errors;
};

const validateGlobalConstructors = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];

  const globalSymbols = env.env.globalScope.symbols;

  // Check Vector3
  const vector3 = globalSymbols.get('Vector3');
  if (vector3 === undefined) {
    errors.push({ 'category': 'Globals', 'message': 'Vector3 global not found' });
  } else if (vector3.type.kind !== 'Table') {
    errors.push({ 'category': 'Globals', 'message': 'Vector3 is not a table type' });
  } else {
    const newMethod = vector3.type.properties.get('new');
    if (newMethod === undefined) {
      errors.push({ 'category': 'Globals', 'message': 'Vector3.new not found' });
    } else if (newMethod.type.kind === 'Function') {
      // Check return type is Vector3
      const returnType = newMethod.type.returnType;
      if (returnType.kind !== 'TypeReference' || returnType.name !== 'Vector3') {
        errors.push({
          'category': 'Globals',
          'message': `Vector3.new should return Vector3 but returns ${returnType.kind === 'TypeReference' ? returnType.name : returnType.kind}`,
        });
      }
    }
  }

  // Check CFrame
  const cframe = globalSymbols.get('CFrame');
  if (cframe === undefined) {
    errors.push({ 'category': 'Globals', 'message': 'CFrame global not found' });
  } else if (cframe.type.kind !== 'Table') {
    errors.push({ 'category': 'Globals', 'message': 'CFrame is not a table type' });
  } else {
    const newMethod = cframe.type.properties.get('new');
    if (newMethod === undefined) {
      errors.push({ 'category': 'Globals', 'message': 'CFrame.new not found' });
    } else if (newMethod.type.kind === 'Function') {
      const returnType = newMethod.type.returnType;
      if (returnType.kind !== 'TypeReference' || returnType.name !== 'CFrame') {
        errors.push({
          'category': 'Globals',
          'message': `CFrame.new should return CFrame but returns ${returnType.kind === 'TypeReference' ? returnType.name : returnType.kind}`,
        });
      }
    }
    const lookAt = cframe.type.properties.get('lookAt');
    if (lookAt === undefined) {
      errors.push({ 'category': 'Globals', 'message': 'CFrame.lookAt not found' });
    }
  }

  // Check UDim2
  const udim2 = globalSymbols.get('UDim2');
  if (udim2 === undefined) {
    errors.push({ 'category': 'Globals', 'message': 'UDim2 global not found' });
  } else if (udim2.type.kind !== 'Table') {
    errors.push({ 'category': 'Globals', 'message': 'UDim2 is not a table type' });
  } else {
    const newMethod = udim2.type.properties.get('new');
    if (newMethod === undefined) {
      errors.push({ 'category': 'Globals', 'message': 'UDim2.new not found' });
    } else if (newMethod.type.kind === 'Function') {
      const returnType = newMethod.type.returnType;
      if (returnType.kind !== 'TypeReference' || returnType.name !== 'UDim2') {
        errors.push({
          'category': 'Globals',
          'message': `UDim2.new should return UDim2 but returns ${returnType.kind === 'TypeReference' ? returnType.name : returnType.kind}`,
        });
      }
    }
    const fromScale = udim2.type.properties.get('fromScale');
    if (fromScale === undefined) {
      errors.push({ 'category': 'Globals', 'message': 'UDim2.fromScale not found' });
    }
  }

  // Check Color3
  const color3 = globalSymbols.get('Color3');
  if (color3 === undefined) {
    errors.push({ 'category': 'Globals', 'message': 'Color3 global not found' });
  } else if (color3.type.kind !== 'Table') {
    errors.push({ 'category': 'Globals', 'message': 'Color3 is not a table type' });
  } else {
    const newMethod = color3.type.properties.get('new');
    if (newMethod === undefined) {
      errors.push({ 'category': 'Globals', 'message': 'Color3.new not found' });
    } else if (newMethod.type.kind === 'Function') {
      const returnType = newMethod.type.returnType;
      if (returnType.kind !== 'TypeReference' || returnType.name !== 'Color3') {
        errors.push({
          'category': 'Globals',
          'message': `Color3.new should return Color3 but returns ${returnType.kind === 'TypeReference' ? returnType.name : returnType.kind}`,
        });
      }
    }
    const fromRGB = color3.type.properties.get('fromRGB');
    if (fromRGB === undefined) {
      errors.push({ 'category': 'Globals', 'message': 'Color3.fromRGB not found' });
    }
  }

  // Check TweenInfo
  const tweenInfo = globalSymbols.get('TweenInfo');
  if (tweenInfo === undefined) {
    errors.push({ 'category': 'Globals', 'message': 'TweenInfo global not found' });
  } else if (tweenInfo.type.kind !== 'Table') {
    errors.push({ 'category': 'Globals', 'message': 'TweenInfo is not a table type' });
  } else {
    const newMethod = tweenInfo.type.properties.get('new');
    if (newMethod === undefined) {
      errors.push({ 'category': 'Globals', 'message': 'TweenInfo.new not found' });
    } else if (newMethod.type.kind === 'Function') {
      const returnType = newMethod.type.returnType;
      // TweenInfo.new should return TweenInfo, not any
      if (returnType.kind === 'Any') {
        errors.push({
          'category': 'Globals',
          'message': 'TweenInfo.new returns any instead of TweenInfo',
        });
      }
    }
  }

  return errors;
};

const validateInstanceMethods = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];
  const instanceClass = env.robloxClasses.get('Instance');

  if (instanceClass === undefined || isClassType(instanceClass) === false) {
    return errors;
  }

  // Check FindFirstChild returns Instance (not any)
  const findFirstChildResult = getClassMethod(instanceClass, 'FindFirstChild', env);
  if (findFirstChildResult !== undefined) {
    const returnType = findFirstChildResult.func.returnType;
    if (returnType.kind === 'Any') {
      errors.push({
        'category': 'Instance',
        'message': 'FindFirstChild returns any instead of Instance',
      });
    }
  }

  // Check GetChildren returns {Instance} (not any)
  const getChildrenResult = getClassMethod(instanceClass, 'GetChildren', env);
  if (getChildrenResult !== undefined) {
    const returnType = getChildrenResult.func.returnType;
    if (returnType.kind === 'Any') {
      errors.push({
        'category': 'Instance',
        'message': 'GetChildren returns any instead of {Instance}',
      });
    }
  }

  // Check WaitForChild returns Instance
  const waitForChildResult = getClassMethod(instanceClass, 'WaitForChild', env);
  if (waitForChildResult !== undefined) {
    const returnType = waitForChildResult.func.returnType;
    if (returnType.kind === 'Any') {
      errors.push({
        'category': 'Instance',
        'message': 'WaitForChild returns any instead of Instance',
      });
    }
  }

  return errors;
};

const validateWorkspace = (env: GlobalEnvironment): ReadonlyArray<ValidationError> => {
  const errors: ValidationError[] = [];
  const workspaceClass = env.robloxClasses.get('Workspace');

  if (workspaceClass === undefined) {
    errors.push({ 'category': 'Workspace', 'message': 'Workspace class not found' });
    return errors;
  }

  if (isClassType(workspaceClass) === false) {
    errors.push({ 'category': 'Workspace', 'message': 'Workspace is not a class type' });
    return errors;
  }

  // Check Gravity property
  const gravity = getClassProperty(workspaceClass, 'Gravity', env);
  if (gravity === undefined) {
    errors.push({ 'category': 'Workspace', 'message': 'Gravity property not found on Workspace' });
  }

  return errors;
};

const runValidation = (): ValidationResult => {
  console.log('Building global environment...');
  const env = buildGlobalEnvironment();

  console.log(`Loaded ${env.robloxClasses.size} Roblox classes`);
  console.log(`Loaded ${env.robloxEnums.size} Roblox enums`);

  const allErrors: ValidationError[] = [];
  const warnings: string[] = [];

  console.log('\nValidating key classes...\n');

  // Run all validators
  allErrors.push(...validatePlayersClass(env));
  allErrors.push(...validatePlayerClass(env));
  allErrors.push(...validateTweenService(env));
  allErrors.push(...validateTweenBaseAndTween(env));
  allErrors.push(...validateHumanoid(env));
  allErrors.push(...validateInstance(env));
  allErrors.push(...validateInstanceMethods(env));
  allErrors.push(...validateDataModel(env));
  allErrors.push(...validateModel(env));
  allErrors.push(...validateBasePart(env));
  allErrors.push(...validateWorkspace(env));
  allErrors.push(...validateGlobalConstructors(env));

  // Print results
  if (allErrors.length === 0) {
    console.log('All validations passed!');
  } else {
    console.log(`Found ${allErrors.length} error(s):\n`);
    for (const error of allErrors) {
      console.log(`  [${error.category}] ${error.message}`);
    }
  }

  return {
    'passed': allErrors.length === 0,
    'errors': allErrors,
    warnings,
  };
};

// Run the validation
const result = runValidation();
process.exit(result.passed ? 0 : 1);
