import { join } from 'path';

import { describe, expect, test } from 'bun:test';

const lua = process.env.LUA_BIN ?? Bun.which('lua') ?? Bun.which('lua5.4') ?? Bun.which('lua5.1');
const fixture = join(import.meta.dir, 'fixtures', 'remote-spy.lua');
const source = join(
  import.meta.dir,
  '..',
  '..',
  '..',
  'roblox',
  'executor-bridge',
  'src',
  'handlers',
  'remoteSpy.luau',
);
const scenarios = [
  'capture-source',
  'source-classification',
  'source-reentrance',
  'namecall-priority',
  'raw-priority',
  'method-hooks',
  'returns',
  'capability-fallback',
  'raw-lock',
  'raw-writable',
  'raw-ownership',
  'missing-capabilities',
  'partial-rollback',
  'rollback-failure',
  'native-errors',
  'namecall-native-errors',
  'capture-failure',
  'block-and-caller',
  'pattern-filter',
  'disable-retry',
];

describe('Executor remote spy handler (mocked native boundaries; requires Lua)', () => {
  for (const scenario of scenarios)
    test.skipIf(lua === null || lua === undefined)(scenario, () => {
      if (lua === null || lua === undefined) throw new Error('Install Lua or set LUA_BIN');
      const result = Bun.spawnSync([lua, fixture, source, scenario]);
      expect(result.stderr.toString()).toBe('');
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString().trim()).toBe(`PASS ${scenario}`);
    });
});
