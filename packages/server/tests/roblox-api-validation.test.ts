import { describe, expect, test } from 'bun:test';

import { buildGlobalEnvironment } from '@definitions/globals';
import { expectDefined } from '@tests/helpers/expect';

import type { ClassMethod, ClassProperty, ClassType, LuauType } from '@typings/types';

const globalEnv = buildGlobalEnvironment();

const isClassType = (type: LuauType): type is ClassType => type.kind === 'Class';

const findMethod = (cls: ClassType, name: string): ClassMethod | undefined =>
  cls.methods.get(name) ?? (cls.superclass === undefined ? undefined : findMethod(cls.superclass, name));

const findProperty = (cls: ClassType, name: string): ClassProperty | undefined =>
  cls.properties.get(name) ?? (cls.superclass === undefined ? undefined : findProperty(cls.superclass, name));

const findClass = (name: string): ClassType | undefined => {
  const cls = globalEnv.robloxClasses.get(name);
  return cls !== undefined && isClassType(cls) ? cls : undefined;
};

const requireClass = (name: string): ClassType => expectDefined(findClass(name));

/** Names the class a member type refers to, whether it is a resolved class or a by-name reference. */
const className = (type: LuauType): string | undefined => {
  if (type.kind === 'TypeReference') return type.name;
  return isClassType(type) ? type.name : undefined;
};

const propertyType = (owner: string, property: string): LuauType =>
  expectDefined(findProperty(requireClass(owner), property)).type;

describe('1. Players class - LocalPlayer property', () => {
  test('Players class exists', () => expect(findClass('Players')).toBeDefined());
  test('Players.LocalPlayer property exists', () =>
    expect(findProperty(requireClass('Players'), 'LocalPlayer')).toBeDefined());
  test('Players.LocalPlayer returns Player type', () =>
    expect(className(propertyType('Players', 'LocalPlayer'))).toBe('Player'));
});

describe('2. Player class - Character property', () => {
  test('Player class exists', () => expect(findClass('Player')).toBeDefined());
  test('Player.Character property exists', () =>
    expect(findProperty(requireClass('Player'), 'Character')).toBeDefined());
  test('Player.Character returns Model type', () =>
    expect(className(propertyType('Player', 'Character'))).toBe('Model'));
});

describe('3. TweenService class - Create method', () => {
  test('TweenService class exists', () => expect(findClass('TweenService')).toBeDefined());
  test('TweenService:Create method exists', () =>
    expect(findMethod(requireClass('TweenService'), 'Create')).toBeDefined());
  test('TweenService:Create returns Tween type', () => {
    const create = expectDefined(findMethod(requireClass('TweenService'), 'Create'));
    expect(className(create.func.returnType)).toBe('Tween');
  });
});

describe('4. Tween inherits from TweenBase which has Play method', () => {
  test('Tween class exists', () => expect(findClass('Tween')).toBeDefined());
  test('TweenBase class exists', () => expect(findClass('TweenBase')).toBeDefined());
  test('Tween inherits from TweenBase', () => expect(requireClass('Tween').superclass?.name).toBe('TweenBase'));
  test.each(['Play', 'Pause', 'Cancel'])('TweenBase:%s method exists', name =>
    expect(findMethod(requireClass('TweenBase'), name)).toBeDefined(),
  );
  test('Play method accessible from Tween via inheritance', () =>
    expect(findMethod(requireClass('Tween'), 'Play')).toBeDefined());
});

describe('5. Instance class - GetChildren, FindFirstChild, WaitForChild methods', () => {
  test('Instance class exists', () => expect(findClass('Instance')).toBeDefined());
  test.each(['GetChildren', 'FindFirstChild', 'WaitForChild'])('Instance:%s method exists', name =>
    expect(findMethod(requireClass('Instance'), name)).toBeDefined(),
  );
});

describe('6. DataModel (game) class - GetService method', () => {
  test('DataModel class exists', () => expect(findClass('DataModel')).toBeDefined());
  test('DataModel:GetService method exists', () =>
    expect(findMethod(requireClass('DataModel'), 'GetService')).toBeDefined());
  test('DataModel:GetService has at least one parameter', () =>
    expect(expectDefined(findMethod(requireClass('DataModel'), 'GetService')).func.params.length).toBeGreaterThan(0));
});

describe('7. Humanoid class - Health, WalkSpeed properties', () => {
  test('Humanoid class exists', () => expect(findClass('Humanoid')).toBeDefined());
  test('Humanoid.Health property exists', () => expect(findProperty(requireClass('Humanoid'), 'Health')).toBeDefined());
  test('Humanoid.Health is number type', () =>
    expect(propertyType('Humanoid', 'Health')).toMatchObject({ 'kind': 'Primitive', 'name': 'number' }));
  test('Humanoid.WalkSpeed property exists', () =>
    expect(findProperty(requireClass('Humanoid'), 'WalkSpeed')).toBeDefined());
  test('Humanoid Torso property is either absent or deprecated', () => {
    const torso = findProperty(requireClass('Humanoid'), 'Torso');
    expect(torso === undefined || torso.deprecated === true).toBe(true);
  });
});

describe('8. Verify game global has proper services', () => {
  const gameType = (): ClassType => {
    const type = expectDefined(globalEnv.env.globalScope.symbols.get('game')).type;
    if (isClassType(type) === false) throw new Error(`game is ${type.kind}, expected Class`);
    return type;
  };

  test('game global exists', () => expect(globalEnv.env.globalScope.symbols.get('game')).toBeDefined());
  test('game is ClassType', () => expect(gameType().kind).toBe('Class'));
  test.each(['Players', 'TweenService'])('game.%s accessible as property', name =>
    expect(findProperty(gameType(), name)).toBeDefined(),
  );
});
