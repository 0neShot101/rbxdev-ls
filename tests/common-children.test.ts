/**
 * Tests for common instance children type hints
 * Run with: bun tests/common-children.test.ts
 *
 * Tests verify that:
 * - Common children patterns resolve to expected types
 * - Inheritance is handled correctly (e.g., Model children work on Model subclasses)
 * - Non-existent children return undefined
 */

import { buildGlobalEnvironment } from '../src/@definitions/globals';
import { getCommonChildType, COMMON_CHILDREN } from '../src/@definitions/commonChildren';
import type { LuauType, ClassType } from '../src/@typings/types';

const globalEnv = buildGlobalEnvironment();

/**
 * Helper to get the superclass name from a class
 */
const getSuperclassName = (className: string): string | undefined => {
  const classType = globalEnv.robloxClasses.get(className);
  if (classType !== undefined && classType.kind === 'Class' && classType.superclass !== undefined) {
    return classType.superclass.name;
  }
  return undefined;
};

/**
 * Resolves a TypeReference to its actual class type
 */
const resolveTypeReference = (type: LuauType): LuauType => {
  if (type.kind === 'TypeReference') {
    const classType = globalEnv.robloxClasses.get(type.name);
    if (classType !== undefined) return classType;
  }
  return type;
};

/**
 * Mimics the resolveMemberType function with common children support
 */
const resolveMemberType = (type: LuauType, memberName: string): LuauType | undefined => {
  const resolvedType = resolveTypeReference(type);

  if (resolvedType.kind === 'Class') {
    const prop = resolvedType.properties.get(memberName);
    if (prop !== undefined) return resolveTypeReference(prop.type);

    const method = resolvedType.methods.get(memberName);
    if (method !== undefined) return method.func;

    if (resolvedType.superclass !== undefined) {
      const inheritedMember = resolveMemberType(resolvedType.superclass, memberName);
      if (inheritedMember !== undefined) return inheritedMember;
    }

    const commonChildType = getCommonChildType(resolvedType.name, memberName, getSuperclassName);
    if (commonChildType !== undefined) {
      const childClassType = globalEnv.robloxClasses.get(commonChildType);
      if (childClassType !== undefined) return childClassType;
    }
  } else if (resolvedType.kind === 'Table') {
    const prop = resolvedType.properties.get(memberName);
    if (prop !== undefined) return resolveTypeReference(prop.type);
  }

  return undefined;
};

let testsPassed = 0;
let testsFailed = 0;

const expectChildType = (parentClass: string, childName: string, expectedType: string) => {
  const parentType = globalEnv.robloxClasses.get(parentClass);
  if (parentType === undefined) {
    console.log(`FAIL: "${parentClass}.${childName}" => parent class not found`);
    testsFailed++;
    return;
  }

  const result = resolveMemberType(parentType, childName);
  if (result === undefined) {
    console.log(`FAIL: "${parentClass}.${childName}" => undefined (expected ${expectedType})`);
    testsFailed++;
    return;
  }

  if (result.kind !== 'Class') {
    console.log(`FAIL: "${parentClass}.${childName}" => ${result.kind} (expected Class ${expectedType})`);
    testsFailed++;
    return;
  }

  if (result.name !== expectedType) {
    console.log(`FAIL: "${parentClass}.${childName}" => Class ${result.name} (expected ${expectedType})`);
    testsFailed++;
    return;
  }

  console.log(`PASS: "${parentClass}.${childName}" => ${expectedType}`);
  testsPassed++;
};

const expectChildUndefined = (parentClass: string, childName: string) => {
  const parentType = globalEnv.robloxClasses.get(parentClass);
  if (parentType === undefined) {
    console.log(`FAIL: "${parentClass}.${childName}" => parent class not found`);
    testsFailed++;
    return;
  }

  const result = resolveMemberType(parentType, childName);
  if (result === undefined) {
    console.log(`PASS: "${parentClass}.${childName}" => undefined (expected undefined)`);
    testsPassed++;
    return;
  }

  console.log(`FAIL: "${parentClass}.${childName}" => ${result.kind} (expected undefined)`);
  testsFailed++;
};

console.log('=== Common Children Type Hints Tests ===\n');

console.log('--- Model Children (Character) ---');
expectChildType('Model', 'Humanoid', 'Humanoid');
expectChildType('Model', 'HumanoidRootPart', 'BasePart');
expectChildType('Model', 'Head', 'BasePart');
expectChildType('Model', 'Torso', 'BasePart');
expectChildType('Model', 'UpperTorso', 'BasePart');
expectChildType('Model', 'LowerTorso', 'BasePart');
expectChildType('Model', 'LeftArm', 'BasePart');
expectChildType('Model', 'RightArm', 'BasePart');
expectChildType('Model', 'PrimaryPart', 'BasePart');

console.log('\n--- Player Children ---');
expectChildType('Player', 'Character', 'Model');
expectChildType('Player', 'Backpack', 'Backpack');
expectChildType('Player', 'PlayerGui', 'PlayerGui');
expectChildType('Player', 'PlayerScripts', 'PlayerScripts');

console.log('\n--- Workspace Children ---');
expectChildType('Workspace', 'CurrentCamera', 'Camera');
expectChildType('Workspace', 'Terrain', 'Terrain');

console.log('\n--- Tool/Accessory Children ---');
expectChildType('Tool', 'Handle', 'BasePart');
expectChildType('Accessory', 'Handle', 'BasePart');

console.log('\n--- GUI Children ---');
expectChildType('ScreenGui', 'Frame', 'Frame');
expectChildType('Frame', 'UIListLayout', 'UIListLayout');
expectChildType('Frame', 'UICorner', 'UICorner');
expectChildType('Frame', 'UIStroke', 'UIStroke');
expectChildType('TextButton', 'UICorner', 'UICorner');

console.log('\n--- BasePart Children ---');
expectChildType('BasePart', 'Attachment', 'Attachment');
expectChildType('BasePart', 'ClickDetector', 'ClickDetector');
expectChildType('BasePart', 'ProximityPrompt', 'ProximityPrompt');
expectChildType('BasePart', 'Sound', 'Sound');
expectChildType('BasePart', 'ParticleEmitter', 'ParticleEmitter');
expectChildType('BasePart', 'PointLight', 'PointLight');

console.log('\n--- Humanoid/Animator Children ---');
expectChildType('Humanoid', 'Animator', 'Animator');
expectChildType('Sound', 'EchoSoundEffect', 'EchoSoundEffect');
expectChildType('Sound', 'ReverbSoundEffect', 'ReverbSoundEffect');

console.log('\n--- StarterPlayer Children ---');
expectChildType('StarterPlayer', 'StarterPlayerScripts', 'StarterPlayerScripts');
expectChildType('StarterPlayer', 'StarterCharacterScripts', 'StarterCharacterScripts');

console.log('\n--- Negative Tests (should be undefined) ---');
expectChildUndefined('Model', 'NonExistentChild');
expectChildUndefined('Player', 'SomeRandomChild');
expectChildUndefined('Instance', 'Humanoid');

console.log('\n--- Chained Access Tests ---');
const playerType = globalEnv.robloxClasses.get('Player');
if (playerType !== undefined) {
  const characterType = resolveMemberType(playerType, 'Character');
  if (characterType !== undefined && characterType.kind === 'Class') {
    const humanoidType = resolveMemberType(characterType, 'Humanoid');
    if (humanoidType !== undefined && humanoidType.kind === 'Class' && humanoidType.name === 'Humanoid') {
      console.log('PASS: "Player.Character.Humanoid" => Humanoid (chained)');
      testsPassed++;
    } else {
      console.log('FAIL: "Player.Character.Humanoid" => wrong type or undefined');
      testsFailed++;
    }

    const hrpType = resolveMemberType(characterType, 'HumanoidRootPart');
    if (hrpType !== undefined && hrpType.kind === 'Class' && hrpType.name === 'BasePart') {
      console.log('PASS: "Player.Character.HumanoidRootPart" => BasePart (chained)');
      testsPassed++;
    } else {
      console.log('FAIL: "Player.Character.HumanoidRootPart" => wrong type or undefined');
      testsFailed++;
    }
  }
}

console.log(`\n=== Results: ${testsPassed} passed, ${testsFailed} failed ===`);

if (testsFailed > 0) {
  process.exit(1);
}
