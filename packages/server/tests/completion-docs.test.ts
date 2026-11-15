import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { CompletionItemKind, MarkupContent, MarkupKind } from 'vscode-languageserver';
import { docsSource } from '@definitions/updates/docsStore';
import { createExecutorBridge } from '@executor/server';
import { createDocumentManager } from '@lsp/documents';
import { setupCompletionHandler } from '@lsp/handlers/completion';
import { createLspHarness } from '@tests/helpers/lsp';
import type { DocsDatabase } from '@typings/docs';
import type { CompletionItem } from 'vscode-languageserver';

const robloxDocsFixture: DocsDatabase = {
  '@roblox/globaltype/Object.IsA': {
    'documentation': "Returns true if an object's class matches or inherits from a given class.",
    'learn_more_link': 'https://create.roblox.com/docs/reference/engine/classes/Object#IsA',
    'code_sample': '',
  },
  '@roblox/global/warn': {
    'documentation': 'Displays a warning message in the output window.',
    'learn_more_link': 'https://create.roblox.com/docs/reference/engine/globals/RobloxGlobals#warn',
    'code_sample': '',
  },
};

const documentManager = createDocumentManager({
  'roblox': {
    'Version': 1,
    'Classes': [
      { 'Name': 'Instance', 'Superclass': '<<<ROOT>>>', 'Members': [], 'Tags': ['NotCreatable'] },
      { 'Name': 'DataModel', 'Superclass': 'Instance', 'Members': [], 'Tags': ['NotCreatable'] },
    ],
    'Enums': [],
  },
  'sunc': undefined,
  'robloxDocs': docsSource(robloxDocsFixture),
  'luauDocs': docsSource({}),
});
const harness = createLspHarness(documentManager);
setupCompletionHandler(
  harness.connection,
  harness.documents,
  documentManager,
  createExecutorBridge(() => undefined),
);

beforeAll(() => harness.start());
afterAll(() => harness.dispose());

const markdownOf = (item: CompletionItem): string => {
  const documentation = item.documentation;
  if (MarkupContent.is(documentation) && documentation.kind === MarkupKind.Markdown) return documentation.value;
  throw new Error('Expected markdown documentation');
};

describe('Completion Resolve - docs-backed member documentation', () => {
  test('resolves a stamped member item through the superclass chain to markdown docs', async () => {
    const item: CompletionItem = {
      'label': 'IsA',
      'kind': CompletionItemKind.Method,
      'data': { 'resolve': 'member', 'class': 'DataModel', 'member': 'IsA' },
    };

    const documentation = markdownOf(await harness.resolve(item));
    expect(documentation).toContain("Returns true if an object's class matches or inherits from a given class.");
    expect(documentation).toContain('[Learn More](https://create.roblox.com/docs/reference/engine/classes/Object#IsA)');
  });

  test('leaves a stamped member item without a docs entry unchanged', async () => {
    const item: CompletionItem = {
      'label': 'TotallyUnknownMember',
      'kind': CompletionItemKind.Method,
      'data': { 'resolve': 'member', 'class': 'DataModel', 'member': 'TotallyUnknownMember' },
    };

    const resolved = await harness.resolve(item);
    expect(resolved.label).toBe('TotallyUnknownMember');
    expect(resolved.documentation).toBeUndefined();
  });

  test('passes an unstamped item through resolve unchanged', async () => {
    const item: CompletionItem = {
      'label': 'someLocal',
      'kind': CompletionItemKind.Variable,
    };

    const resolved = await harness.resolve(item);
    expect(resolved).toEqual(item);
    expect(resolved.documentation).toBeUndefined();
  });
});

describe('Completion Resolve - docs-backed global documentation', () => {
  test('prefers docs database text for a stamped global item', async () => {
    const item: CompletionItem = {
      'label': 'warn',
      'kind': CompletionItemKind.Function,
      'data': { 'resolve': 'global', 'name': 'warn' },
    };

    const documentation = markdownOf(await harness.resolve(item));
    expect(documentation).toContain('Displays a warning message in the output window.');
    expect(documentation).toContain(
      '[Learn More](https://create.roblox.com/docs/reference/engine/globals/RobloxGlobals#warn)',
    );
  });

  test('keeps the hand-written fallback path for globals missing from the docs database', async () => {
    const item: CompletionItem = {
      'label': 'print',
      'kind': CompletionItemKind.Function,
      'data': { 'resolve': 'global', 'name': 'print' },
    };

    const resolved = await harness.resolve(item);
    expect(resolved.label).toBe('print');
    const documentation = markdownOf(resolved);
    expect(documentation).toContain('Prints all arguments to the output');
    expect(documentation).not.toContain('Displays a warning message in the output window.');
  });
});
