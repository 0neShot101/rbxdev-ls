/**
 * Test preload that registers virtual modules for the server package's
 * internal path aliases (@parser/*, @typings/*), allowing the Luau parser
 * to be imported from source when validating bundler output.
 */

import { join } from 'path';
import { pathToFileURL } from 'url';
import { plugin } from 'bun';

const serverSource = join(import.meta.dir, '..', '..', 'server', 'src');

const aliasTargets: ReadonlyArray<readonly [string, string]> = [
  ['@parser/parser', 'parser/parser.ts'],
  ['@parser/lexer', 'parser/lexer.ts'],
  ['@parser/tokens', 'parser/tokens.ts'],
  ['@parser/docComment', 'parser/docComment.ts'],
  ['@typings/parser', 'types/parser.ts'],
  ['@typings/ast', 'types/ast.ts'],
];

plugin({
  'name': 'rbxdev-server-aliases',
  'setup': build => {
    for (const [alias, relativePath] of aliasTargets) {
      const target = pathToFileURL(join(serverSource, relativePath)).href;
      build.module(alias, () => ({
        'contents': `export * from ${JSON.stringify(target)};`,
        'loader': 'ts',
      }));
    }
  },
});
