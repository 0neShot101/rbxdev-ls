import { describe, expect, test } from 'bun:test';
import { checkProgram } from '@analyzer/checker';
import { createTableType, NumberType, StringType, typeToString } from '@analyzer/values';
import { buildGlobalEnvironment, createEmptyGlobalEnvironment } from '@definitions/globals';
import { createAllStdLibraries } from '@definitions/stdlib';
import { parse } from '@parser/parser';
import type { TypeCheckResult } from '@typings/checker';
import type { GlobalEnvironment, RobloxApiDump, RobloxClass } from '@typings/definitions';
import type { TypeCheckMode } from '@typings/subtyping';
import type { ClassType, LuauType } from '@typings/types';

const check = (source: string, globals?: GlobalEnvironment, mode: TypeCheckMode = 'strict'): TypeCheckResult => {
  const parsed = parse(source);
  expect(parsed.errors).toEqual([]);
  return globals === undefined ? checkProgram(parsed.ast, { mode }) : checkProgram(parsed.ast, { mode, globals });
};

const symbolType = (result: TypeCheckResult, name: string): string => {
  const type = result.allSymbols.get(name);
  return type === undefined ? 'missing' : typeToString(type);
};

const tableKeys = (type: LuauType | undefined): ReadonlyArray<string> =>
  type !== undefined && type.kind === 'Table' ? [...type.properties.keys()] : [];

const fixtureClass = (name: string, superclass: string, tags: ReadonlyArray<string>): RobloxClass => ({
  'Name': name,
  'Superclass': superclass,
  'Members': [],
  'Tags': tags,
});

const fixtureApi: RobloxApiDump = {
  'Version': 1,
  'Classes': [
    {
      'Name': 'Instance',
      'Superclass': '<<<ROOT>>>',
      'Members': [
        {
          'MemberType': 'Property',
          'Name': 'Name',
          'ValueType': { 'Name': 'string', 'Category': 'Primitive' },
        },
      ],
      'Tags': ['NotCreatable'],
    },
    fixtureClass('ServiceProvider', 'Instance', ['NotCreatable']),
    fixtureClass('DataModel', 'ServiceProvider', ['NotCreatable']),
    fixtureClass('Workspace', 'Instance', ['NotCreatable', 'Service']),
    fixtureClass('NewService', 'Instance', ['NotCreatable', 'Service']),
    fixtureClass('NewPart', 'Instance', []),
    fixtureClass('HiddenThing', 'Instance', ['NotCreatable']),
  ],
  'Enums': [{ 'Name': 'FixtureEnum', 'Items': [{ 'Name': 'First', 'Value': 0 }] }],
};

const legacyGlobals = ['wait', 'delay', 'spawn', 'tick', 'time', 'elapsedTime', 'gcinfo', 'collectgarbage'];

describe('checker global isolation', () => {
  test('a second check sees no locals, aliases or table members from the first', () => {
    const globals = buildGlobalEnvironment({ 'roblox': fixtureApi, 'sunc': undefined });
    const first = check(
      'type Leaked = { value: number }\nlocal leaked = 1\nlocal holder = { a = 1 }\nholder.b = 2\nprint = nil',
      globals,
    );
    expect(first.environment.globalScope.symbols.has('leaked')).toBe(true);
    expect(first.environment.globalScope.types.has('Leaked')).toBe(true);

    const second = check('local probe = 1', globals);
    expect(second.environment.globalScope.symbols.has('leaked')).toBe(false);
    expect(second.environment.globalScope.symbols.has('holder')).toBe(false);
    expect(second.environment.globalScope.types.has('Leaked')).toBe(false);
    expect(second.environment.globalScope.symbols.get('print')?.type.kind).toBe('Function');
    expect(globals.env.globalScope.symbols.has('leaked')).toBe(false);
    expect(globals.env.globalScope.types.has('Leaked')).toBe(false);
  });

  test('standalone checks do not share local state', () => {
    const first = check('local leaked = { a = 1 }\nleaked.extra = true');
    const second = check('local probe = 1');
    expect(first.environment.globalScope.symbols.has('leaked')).toBe(true);
    expect(second.environment.globalScope.symbols.has('leaked')).toBe(false);
  });

  test('building environments in either order leaves the cached stdlib debug table untouched', () => {
    const stdlibDebugKeys = tableKeys(createAllStdLibraries().get('debug'));
    const emptyFirst = createEmptyGlobalEnvironment();
    const fullAfter = buildGlobalEnvironment({ 'roblox': undefined, 'sunc': undefined });
    const fullFirst = buildGlobalEnvironment({ 'roblox': undefined, 'sunc': undefined });
    const emptyAfter = createEmptyGlobalEnvironment();

    expect(tableKeys(createAllStdLibraries().get('debug'))).toEqual(stdlibDebugKeys);
    expect(stdlibDebugKeys.includes('getconstants')).toBe(false);
    expect(tableKeys(emptyFirst.env.globalScope.symbols.get('debug')?.type)).toEqual(stdlibDebugKeys);
    expect(tableKeys(emptyAfter.env.globalScope.symbols.get('debug')?.type)).toEqual(stdlibDebugKeys);
    expect(tableKeys(fullAfter.env.globalScope.symbols.get('debug')?.type)).toContain('getconstants');
    expect(tableKeys(fullFirst.env.globalScope.symbols.get('debug')?.type)).toEqual(
      tableKeys(fullAfter.env.globalScope.symbols.get('debug')?.type),
    );
  });
});

describe('disk-free canonical environment', () => {
  test('legacy globals, plugin, settings and static constructors exist without an API dump', () => {
    const result = check('local probe = 1');
    const symbols = result.environment.globalScope.symbols;
    for (const name of [
      ...legacyGlobals,
      'plugin',
      'settings',
      'UserSettings',
      'Vector3',
      'CFrame',
      'BrickColor',
      'DateTime',
      'vector',
    ])
      expect(symbols.has(name)).toBe(true);
    expect(symbols.get('plugin')?.type.kind).toBe('Any');
    expect(symbols.get('game')?.type.kind).toBe('Any');
    expect(symbols.get('Enum')?.type.kind).toBe('Any');
  });

  test('legacy globals keep their checker signatures', () => {
    const result = check(
      'local waited = wait(1)\nlocal ticked = tick()\nlocal memory = gcinfo()\nlocal collected = collectgarbage("count")\nlocal settingsValue = settings()',
    );
    expect(result.diagnostics).toEqual([]);
    expect(symbolType(result, 'waited')).toBe('number');
    expect(symbolType(result, 'ticked')).toBe('number');
    expect(symbolType(result, 'memory')).toBe('number');
    expect(symbolType(result, 'collected')).toBe('any');
    expect(symbolType(result, 'settingsValue')).toBe('any');
  });

  test('request responses expose typed fields', () => {
    const result = check(
      'local response = request({ Url = "https://example.com" })\nlocal status = response.StatusCode\nlocal body = http_request({ Url = "x" }).Body\nlocal ok = syn_request({ Url = "x" }).Success',
    );
    expect(result.diagnostics).toEqual([]);
    expect(symbolType(result, 'status')).toBe('number');
    expect(symbolType(result, 'body')).toBe('string');
    expect(symbolType(result, 'ok')).toBe('boolean');
  });

  test('explicit API data replaces fallbacks and option overlays override the base catalogue', () => {
    const globals = buildGlobalEnvironment({ 'roblox': fixtureApi, 'sunc': undefined });
    expect(globals.serviceNames).toEqual(['Workspace', 'NewService']);
    expect(globals.creatableClasses).toEqual(['NewPart']);

    const base = check(
      'local part = Instance.new("NewPart")\nlocal service = game:GetService("NewService")\nlocal root = game\nlocal item = Enum.FixtureEnum.First',
      globals,
    );
    expect(base.diagnostics).toEqual([]);
    expect(symbolType(base, 'part')).toBe('NewPart');
    expect(symbolType(base, 'service')).toBe('NewService');
    expect(symbolType(base, 'root')).toBe('DataModel');
    expect(symbolType(base, 'item')).toBe('number');

    const baseClass = globals.env.classes.get('NewPart');
    expect(baseClass).toBeDefined();
    if (baseClass === undefined) return;
    const overrideClass: ClassType = {
      ...baseClass,
      'properties': new Map([['Override', { 'type': StringType, 'readonly': true, 'security': 'None' }]]),
    };
    const overrideVector = createTableType(
      new Map([['Fixture', { 'type': NumberType, 'readonly': true, 'optional': false }]]),
    );
    const parsed = parse(
      'local part = Instance.new("NewPart")\nlocal label = part.Override\nlocal fixture = Vector3.new(1, 2, 3).Fixture',
    );
    const overlaid = checkProgram(parsed.ast, {
      globals,
      'mode': 'strict',
      'classes': new Map([['NewPart', overrideClass]]),
      'dataTypes': new Map([['Vector3', overrideVector]]),
    });
    expect(overlaid.diagnostics).toEqual([]);
    expect(symbolType(overlaid, 'label')).toBe('string');
    expect(symbolType(overlaid, 'fixture')).toBe('number');
    expect(globals.env.classes.get('NewPart')).toBe(baseClass);
  });
});

describe('canonical constructors', () => {
  const globals = buildGlobalEnvironment();
  const constructors: ReadonlyArray<readonly [string, string]> = [
    ['BrickColor', 'new'],
    ['Vector3', 'new'],
    ['CFrame', 'new'],
    ['Color3', 'fromRGB'],
    ['UDim2', 'new'],
    ['DateTime', 'now'],
    ['TweenInfo', 'new'],
    ['Ray', 'new'],
    ['Random', 'new'],
    ['NumberRange', 'new'],
  ];

  test('checker and completion environment agree on named constructor return types', () => {
    for (const [namespace, member] of constructors) {
      const namespaceType = globals.env.globalScope.symbols.get(namespace)?.type;
      const memberType =
        namespaceType !== undefined && namespaceType.kind === 'Table'
          ? namespaceType.properties.get(member)?.type
          : undefined;
      const declared =
        memberType !== undefined && memberType.kind === 'Function' ? typeToString(memberType.returnType) : 'missing';
      expect(declared).toBe(namespace);

      const standalone = check(`local value = ${namespace}.${member}()`);
      const managed = check(`local value = ${namespace}.${member}()`, globals, 'nonstrict');
      expect(symbolType(standalone, 'value')).toBe(declared);
      expect(symbolType(managed, 'value')).toBe(declared);
    }
  });

  test('datatype members resolve in strict standalone checks', () => {
    const result = check(
      'local color = BrickColor.new("Bright red")\nlocal colorName = color.Name\nlocal x = Vector3.new(1, 2, 3).X',
    );
    expect(result.diagnostics).toEqual([]);
    expect(symbolType(result, 'colorName')).toBe('string');
    expect(symbolType(result, 'x')).toBe('number');
  });

  test('dynamic Instance children still resolve to Instance', () => {
    const result = check('local child = workspace.SomeUnknownChild\nlocal nested = child.Deeper', globals);
    expect(result.diagnostics).toEqual([]);
    expect(symbolType(result, 'child')).toBe('Instance');
    expect(symbolType(result, 'nested')).toBe('Instance');
  });

  test('loadstring results are callable', () => {
    for (const environment of [undefined, globals]) {
      const result = check('local chunk = loadstring("return 1")\nlocal value = chunk()', environment);
      expect(result.diagnostics).toEqual([]);
    }
  });
});
