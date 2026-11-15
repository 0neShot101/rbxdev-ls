import { join } from 'path';

import { expect, test } from 'bun:test';

test('real RemoteSpyPanel lifecycle regression (isolated VS Code mock)', () => {
  const fixture = join(import.meta.dir, 'fixtures', 'remote-spy-panel.fixture.ts');
  const result = Bun.spawnSync([process.execPath, 'test', fixture]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toContain('1 pass');
});
