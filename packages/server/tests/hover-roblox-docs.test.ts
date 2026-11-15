import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { MarkupContent } from 'vscode-languageserver';
import { BooleanType, StringType, createClassType, createFunctionType } from '@analyzer/values';
import { buildGlobalEnvironment } from '@definitions/globals';
import { docsSource } from '@definitions/updates/docsStore';
import { createExecutorBridge } from '@executor/server';
import { createDocumentManager } from '@lsp/documents';
import { setupHoverHandler } from '@lsp/handlers/hover';
import { createLspHarness } from '@tests/helpers/lsp';
import type { GlobalEnvironment } from '@typings/definitions';
import type { DocsDatabase } from '@typings/docs';
import type { DocumentManager, ParsedDocument } from '@typings/lsp';
import type { LuauType } from '@typings/types';
import type { Hover } from 'vscode-languageserver';

const instanceClass = createClassType('Instance', {
  'methods': new Map([
    [
      'IsA',
      { 'func': createFunctionType([{ 'name': 'className', 'type': StringType, 'optional': false }], BooleanType) },
    ],
    ['GetFullName', { 'func': createFunctionType([], StringType) }],
  ]),
});

const dataModelClass = createClassType('DataModel', { 'superclass': instanceClass });

const robloxDocs: DocsDatabase = {
  '@roblox/globaltype/Object.IsA': {
    'documentation': "Returns true if an object's class matches or inherits from a given class.",
    'learn_more_link': 'https://create.roblox.com/docs/reference/engine/classes/Object#IsA',
    'code_sample':
      'local Workspace = game:GetService("Workspace")\n\nprint(Workspace:IsA("Workspace")) -- true\nprint(Workspace:IsA("BasePart")) -- false\nprint(Workspace:IsA("Instance")) -- true',
  },
};

const baseEnv = buildGlobalEnvironment();

const markdownOf = (hover: Hover | null): string => {
  if (hover === null) throw new Error('expected a hover result');
  const contents = hover.contents;
  if (MarkupContent.is(contents)) return contents.value;
  throw new Error('expected markup content');
};

const createHoverSession = (robloxClasses: Map<string, LuauType>) => {
  const globalEnv: GlobalEnvironment = { ...baseEnv, robloxClasses, 'robloxDocs': docsSource(robloxDocs) };
  const openDocs = new Map<string, ParsedDocument>();
  const documentManager: DocumentManager = {
    ...createDocumentManager({ 'roblox': undefined, 'sunc': undefined }),
    globalEnv,
    'getDocument': uri => openDocs.get(uri),
  };
  const harness = createLspHarness(documentManager);
  setupHoverHandler(
    harness.connection,
    documentManager,
    createExecutorBridge(() => undefined),
  );
  let documentCount = 0;

  const hoverMarkdown = async (code: string, character: number): Promise<string> => {
    documentCount += 1;
    const uri = `file:///hover-roblox-docs-${documentCount}.luau`;
    openDocs.set(uri, {
      uri,
      'version': 1,
      'content': code,
      'ast': undefined,
      'parseErrors': [],
      'typeErrors': [],
      'typeCheckResult': undefined,
    });
    return markdownOf(await harness.hover(uri, { 'line': 0, character }));
  };

  return { harness, hoverMarkdown };
};

const expectedIsAMarkdown = [
  '```lua',
  'function DataModel.IsA(self: Object, className: string): boolean',
  '```',
  "Returns true if an object's class matches or inherits from a given class.",
  '',
  '[Learn More](https://create.roblox.com/docs/reference/engine/classes/Object#IsA)',
  '',
  '```lua',
  'local Workspace = game:GetService("Workspace")',
  '',
  'print(Workspace:IsA("Workspace")) -- true',
  'print(Workspace:IsA("BasePart")) -- false',
  'print(Workspace:IsA("Instance")) -- true',
  '```',
].join('\n');

describe('Hover Handler - official docs layout', () => {
  const hoverAliased = createHoverSession(
    new Map<string, LuauType>([
      ['DataModel', dataModelClass],
      ['Instance', instanceClass],
      ['game', dataModelClass],
    ]),
  );

  beforeAll(() => hoverAliased.harness.start());
  afterAll(() => hoverAliased.harness.dispose());

  test('game.IsA renders the docs entry found on the Object fallback class', async () => {
    const markdown = await hoverAliased.hoverMarkdown('game:IsA("Workspace")', 6);
    expect(markdown).toBe(expectedIsAMarkdown);
  });

  test('game.IsA via dot access renders the same docs entry', async () => {
    const markdown = await hoverAliased.hoverMarkdown('game.IsA', 6);
    expect(markdown).toBe(expectedIsAMarkdown);
  });

  test('a member with no docs entry renders the signature only', async () => {
    const markdown = await hoverAliased.hoverMarkdown('game.GetFullName', 7);
    expect(markdown).toBe('```lua\nfunction DataModel.GetFullName(self: Instance): string\n```');
  });
});

describe('Hover Handler - class-typed globals (production shape)', () => {
  const hoverProduction = createHoverSession(
    new Map<string, LuauType>([
      ['DataModel', dataModelClass],
      ['Instance', instanceClass],
    ]),
  );

  beforeAll(() => hoverProduction.harness.start());
  afterAll(() => hoverProduction.harness.dispose());

  test('game.IsA resolves through the game global symbol without a class alias', async () => {
    const markdown = await hoverProduction.hoverMarkdown('game:IsA("Workspace")', 6);
    expect(markdown).toBe(expectedIsAMarkdown);
  });

  test('game.GetFullName renders the signature only when no docs entry exists', async () => {
    const markdown = await hoverProduction.hoverMarkdown('game.GetFullName', 7);
    expect(markdown).toBe('```lua\nfunction DataModel.GetFullName(self: Instance): string\n```');
  });
});
