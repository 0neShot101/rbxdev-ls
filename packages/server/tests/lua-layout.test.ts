import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, test } from 'bun:test';

import { tokenize } from '@parser/lexer';
import { parse } from '@parser/parser';
import { TokenKind } from '@typings/parser';

const root = join(import.meta.dir, '..', '..', '..');
const paths = [...new Bun.Glob('roblox/**/*.luau').scanSync({ 'cwd': root })].sort();
paths.push('scripts/executor-bridge.lua');

describe('project Lua layout', () => {
  for (const path of paths)
    test(path, () => {
      const source = readFileSync(join(root, path), 'utf8');
      const lines = source.split('\n');
      const tokens = tokenize(source);

      expect(parse(source).errors).toEqual([]);
      expect(/^[ \t]*\t/m.test(source)).toBe(false);

      for (const token of tokens) {
        if (token.kind === TokenKind.String) expect(token.value.startsWith("'")).toBe(true);
        if (token.kind === TokenKind.Comment)
          expect(lines[token.start.line - 1]?.trim()).toMatch(/^--\[\[ [^\r\n]* \]\]--$/);
      }
    });
});
