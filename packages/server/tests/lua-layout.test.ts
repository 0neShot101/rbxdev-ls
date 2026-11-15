import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, test } from 'bun:test';

import { lex } from '@parser/lexer';
import { parse } from '@parser/parser';
import { TokenKind } from '@typings/parser';

const root = join(import.meta.dir, '..', '..', '..');
const paths = [...new Bun.Glob('roblox/**/*.luau').scanSync({ 'cwd': root })].sort();
paths.push('scripts/executor-bridge.lua', 'packages/server/tests/fixtures/remote-spy.lua');

describe('project Lua layout', () => {
  for (const path of paths)
    test(path, () => {
      const source = readFileSync(join(root, path), 'utf8');
      const lines = source.split('\n');
      const { tokens, comments } = lex(source);
      expect(parse(source).errors).toEqual([]);
      expect(/^[ \t]*\t/m.test(source)).toBe(false);
      for (const token of tokens) if (token.kind === TokenKind.String) expect(token.value.startsWith("'")).toBe(true);
      for (const comment of comments) expect(lines[comment.start.line - 1]?.trim()).toMatch(/^--\[\[ [^\r\n]* \]\]--$/);
    });
});
