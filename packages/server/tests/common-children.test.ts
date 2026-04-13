import { getCommonChildType } from '@definitions/commonChildren';
import { buildGlobalEnvironment } from '@definitions/globals';
import { describe, expect, test } from 'bun:test';

import type { ClassType, LuauType } from '@typings/types';

const globalEnv = buildGlobalEnvironment();

const getSuperclassName = (className: string): string | undefined => {
  const classType = globalEnv.robloxClasses.get(className);
  if (classType === undefined || classType.kind !== 'Class' || classType.superclass === undefined) {
    return undefined;
  }
  return classType.superclass.name;
};

const resolveTypeReference = (type: LuauType): LuauType => {
  if (type.kind === 'TypeReference') {
    const classType = globalEnv.robloxClasses.get(type.name);
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

const expectChildType = (parentClass: string, childName: string, expectedType: string) => {
  test(`${parentClass}.${childName} resolves to ${expectedType}`, () => {
    const parentType = globalEnv.robloxClasses.get(parentClass);
    expect(parentType).toBeDefined();

    const result = resolveMemberType(parentType!, childName);
    expect(result).toBeDefined();
    expect(result!.kind).toBe('Class');
    expect((result as ClassType).name).toBe(expectedType);
  });
};

const expectChildUndefined = (parentClass: string, childName: string) => {
  test(`${parentClass}.${childName} resolves to undefined`, () => {
    const parentType = globalEnv.robloxClasses.get(parentClass);
    expect(parentType).toBeDefined();

    const result = resolveMemberType(parentType!, childName);
    expect(result).toBeUndefined();
  });
};

describe('Common Children Type Hints', () => {
  describe('Model Children (Character)', () => {
    expectChildType('Model', 'Humanoid', 'Humanoid');
    expectChildType('Model', 'HumanoidRootPart', 'BasePart');
    expectChildType('Model', 'Head', 'BasePart');
    expectChildType('Model', 'Torso', 'BasePart');
    expectChildType('Model', 'UpperTorso', 'BasePart');
    expectChildType('Model', 'LowerTorso', 'BasePart');
    expectChildType('Model', 'LeftArm', 'BasePart');
    expectChildType('Model', 'RightArm', 'BasePart');
    expectChildType('Model', 'PrimaryPart', 'BasePart');
  });

  describe('Player Children', () => {
    expectChildType('Player', 'Character', 'Model');
    expectChildType('Player', 'Backpack', 'Backpack');
    expectChildType('Player', 'PlayerGui', 'PlayerGui');
    expectChildType('Player', 'PlayerScripts', 'PlayerScripts');
  });

  describe('Workspace Children', () => {
    expectChildType('Workspace', 'CurrentCamera', 'Camera');
    expectChildType('Workspace', 'Terrain', 'Terrain');
  });

  describe('Tool/Accessory Children', () => {
    expectChildType('Tool', 'Handle', 'BasePart');
    expectChildType('Accessory', 'Handle', 'BasePart');
  });

  describe('GUI Children', () => {
    expectChildType('ScreenGui', 'Frame', 'Frame');
    expectChildType('Frame', 'UIListLayout', 'UIListLayout');
    expectChildType('Frame', 'UICorner', 'UICorner');
    expectChildType('Frame', 'UIStroke', 'UIStroke');
    expectChildType('TextButton', 'UICorner', 'UICorner');
  });

  describe('BasePart Children', () => {
    expectChildType('BasePart', 'Attachment', 'Attachment');
    expectChildType('BasePart', 'ClickDetector', 'ClickDetector');
    expectChildType('BasePart', 'ProximityPrompt', 'ProximityPrompt');
    expectChildType('BasePart', 'Sound', 'Sound');
    expectChildType('BasePart', 'ParticleEmitter', 'ParticleEmitter');
    expectChildType('BasePart', 'PointLight', 'PointLight');
  });

  describe('Humanoid/Animator Children', () => {
    expectChildType('Humanoid', 'Animator', 'Animator');
    expectChildType('Sound', 'EchoSoundEffect', 'EchoSoundEffect');
    expectChildType('Sound', 'ReverbSoundEffect', 'ReverbSoundEffect');
  });

  describe('StarterPlayer Children', () => {
    expectChildType('StarterPlayer', 'StarterPlayerScripts', 'StarterPlayerScripts');
    expectChildType('StarterPlayer', 'StarterCharacterScripts', 'StarterCharacterScripts');
  });

  describe('Negative Tests (should be undefined)', () => {
    expectChildUndefined('Model', 'NonExistentChild');
    expectChildUndefined('Player', 'SomeRandomChild');
    expectChildUndefined('Instance', 'Humanoid');
  });

  describe('Chained Access Tests', () => {
    test('Player.Character.Humanoid resolves to Humanoid', () => {
      const playerType = globalEnv.robloxClasses.get('Player');
      expect(playerType).toBeDefined();

      const characterType = resolveMemberType(playerType!, 'Character');
      expect(characterType).toBeDefined();
      expect(characterType!.kind).toBe('Class');

      const humanoidType = resolveMemberType(characterType!, 'Humanoid');
      expect(humanoidType).toBeDefined();
      expect(humanoidType!.kind).toBe('Class');
      expect((humanoidType as ClassType).name).toBe('Humanoid');
    });

    test('Player.Character.HumanoidRootPart resolves to BasePart', () => {
      const playerType = globalEnv.robloxClasses.get('Player');
      expect(playerType).toBeDefined();

      const characterType = resolveMemberType(playerType!, 'Character');
      expect(characterType).toBeDefined();
      expect(characterType!.kind).toBe('Class');

      const hrpType = resolveMemberType(characterType!, 'HumanoidRootPart');
      expect(hrpType).toBeDefined();
      expect(hrpType!.kind).toBe('Class');
      expect((hrpType as ClassType).name).toBe('BasePart');
    });
  });
});
