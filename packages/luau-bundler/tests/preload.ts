/**
 * Test preload that registers virtual modules for the server package's
 * internal path aliases (@parser/*, @typings/*), allowing the Luau parser
 * to be imported from source when validating bundler output.
 */

import { join } from 'path';
import { pathToFileURL } from 'url';
import { plugin } from 'bun';

const serverSrc = join(import.meta.dir, '..', '..', 'server', 'src');

const aliases = [
  '@parser/parser',
  '@parser/lexer',
  '@parser/tokens',
  '@parser/docComment',
  '@typings/parser',
  '@typings/ast',
];

plugin({
  'name': 'rbxdev-server-aliases',
  'setup': build => {
    for (const alias of aliases) {
      const target = pathToFileURL(join(serverSrc, `${alias.slice(1)}.ts`)).href;
      build.module(alias, () => ({
        'contents': `export * from ${JSON.stringify(target)};`,
        'loader': 'ts',
      }));
    }
  },
});
