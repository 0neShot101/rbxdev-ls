import { describe, expect, test } from 'bun:test';

import { htmlToMarkdown, lookupGlobalDoc, lookupLibraryDoc, lookupMemberDoc, renderDocsEntry } from '@definitions/docs';
import { loadDefinitions } from '@definitions/loader';
import { docsSource } from '@definitions/updates/docsStore';

import type { DocsDatabase, DocsEntry } from '@typings/docs';

const makeEntry = (overrides: Partial<DocsEntry>): DocsEntry => ({
  'documentation': '',
  'learn_more_link': '',
  'code_sample': '',
  ...overrides,
});

const superclasses = new Map([
  ['DataModel', 'Instance'],
  ['Workspace', 'DataModel'],
]);

const getSuperclassName = (className: string): string | undefined => superclasses.get(className);

describe('bundled documentation data', () => {
  const definitions = loadDefinitions();

  test('Roblox docs decode and document Instance members', () =>
    expect(lookupMemberDoc(definitions.robloxDocs, 'Instance', 'Name', getSuperclassName)).toBeDefined());

  test('Luau docs decode and document the print global', () =>
    expect(lookupGlobalDoc(undefined, definitions.luauDocs, 'print')?.documentation).toBeDefined());
});

describe('lookupMemberDoc', () => {
  test('finds an entry declared on a superclass through the hierarchy', () => {
    const robloxDocs: DocsDatabase = {
      '@roblox/globaltype/Instance.GetChildren': makeEntry({ 'documentation': 'Returns the children.' }),
    };

    const result = lookupMemberDoc(docsSource(robloxDocs), 'DataModel', 'GetChildren', getSuperclassName);

    expect(result).toBeDefined();
    expect(result?.docsClassName).toBe('Instance');
    expect(result?.entry.documentation).toBe('Returns the children.');
  });

  test('falls back to the Object class when the chain misses', () => {
    const robloxDocs: DocsDatabase = {
      '@roblox/globaltype/Object.IsA': makeEntry({ 'documentation': "Returns true if an object's class matches." }),
    };

    const result = lookupMemberDoc(docsSource(robloxDocs), 'Workspace', 'IsA', getSuperclassName);

    expect(result).toBeDefined();
    expect(result?.docsClassName).toBe('Object');
    expect(result?.entry.documentation).toBe("Returns true if an object's class matches.");
  });

  test('returns undefined for an unknown member', () => {
    const robloxDocs: DocsDatabase = {
      '@roblox/globaltype/Object.IsA': makeEntry({ 'documentation': "Returns true if an object's class matches." }),
    };

    expect(lookupMemberDoc(docsSource(robloxDocs), 'DataModel', 'NotARealMember', getSuperclassName)).toBeUndefined();
  });

  test('returns undefined when the database is missing', () =>
    expect(lookupMemberDoc(undefined, 'DataModel', 'IsA', getSuperclassName)).toBeUndefined());

  test('prefers the entry on the declaring class over a superclass entry', () => {
    const robloxDocs: DocsDatabase = {
      '@roblox/globaltype/DataModel.Destroy': makeEntry({ 'documentation': 'Destroys the data model.' }),
      '@roblox/globaltype/Instance.Destroy': makeEntry({ 'documentation': 'Destroys the instance.' }),
    };

    const result = lookupMemberDoc(docsSource(robloxDocs), 'DataModel', 'Destroy', getSuperclassName);

    expect(result?.docsClassName).toBe('DataModel');
    expect(result?.entry.documentation).toBe('Destroys the data model.');
  });
});

describe('lookupGlobalDoc', () => {
  test('prefers the Roblox database when the name exists in both', () => {
    const robloxDocs: DocsDatabase = {
      '@roblox/global/warn': makeEntry({ 'documentation': 'Roblox warn.' }),
    };
    const luauDocs: DocsDatabase = {
      '@luau/global/warn': makeEntry({ 'documentation': 'Luau warn.' }),
    };

    expect(lookupGlobalDoc(docsSource(robloxDocs), docsSource(luauDocs), 'warn')?.documentation).toBe('Roblox warn.');
  });

  test('falls through to the Luau database on a Roblox miss', () => {
    const luauDocs: DocsDatabase = {
      '@luau/global/print': makeEntry({ 'documentation': 'Prints values.' }),
    };

    expect(lookupGlobalDoc(undefined, docsSource(luauDocs), 'print')?.documentation).toBe('Prints values.');
  });

  test('returns undefined when the name is in neither database', () =>
    expect(lookupGlobalDoc(undefined, undefined, 'nope')).toBeUndefined());
});

describe('lookupLibraryDoc', () => {
  test('prefers the Roblox database when the member exists in both', () => {
    const robloxDocs: DocsDatabase = {
      '@roblox/global/task.wait': makeEntry({ 'documentation': 'Roblox task wait.' }),
    };
    const luauDocs: DocsDatabase = {
      '@luau/global/task.wait': makeEntry({ 'documentation': 'Luau task wait.' }),
    };

    expect(lookupLibraryDoc(docsSource(robloxDocs), docsSource(luauDocs), 'task', 'wait')?.documentation).toBe(
      'Roblox task wait.',
    );
  });

  test('falls through to the Luau database on a Roblox miss', () => {
    const luauDocs: DocsDatabase = {
      '@luau/global/math.abs': makeEntry({ 'documentation': 'Absolute value.' }),
    };

    expect(lookupLibraryDoc(undefined, docsSource(luauDocs), 'math', 'abs')?.documentation).toBe('Absolute value.');
  });

  test('returns undefined when the member is in neither database', () =>
    expect(lookupLibraryDoc(undefined, undefined, 'math', 'nope')).toBeUndefined());
});

describe('htmlToMarkdown', () => {
  test('converts code tags to backticks', () =>
    expect(htmlToMarkdown('Call <code>IsA</code> here.')).toBe('Call `IsA` here.'));

  test('converts anchor tags to markdown links', () =>
    expect(htmlToMarkdown('<a href="https://create.roblox.com/docs">Read more</a>')).toBe(
      '[Read more](https://create.roblox.com/docs)',
    ));

  test('converts bold and emphasis tags', () =>
    expect(htmlToMarkdown('<b>bold</b> <strong>strong</strong> <em>em</em> <i>i</i>')).toBe(
      '**bold** **strong** *em* *i*',
    ));

  test('decodes HTML entities', () =>
    expect(htmlToMarkdown('&lt;T&gt; &amp; &quot;quoted&quot; it&#39;s')).toBe('<T> & "quoted" it\'s'));

  test('converts br variants to newlines', () =>
    expect(htmlToMarkdown('one<br>two<br/>three<br />four')).toBe('one\ntwo\nthree\nfour'));

  test('strips remaining unknown tags', () =>
    expect(htmlToMarkdown('keep <span class="x">this</span> text')).toBe('keep this text'));

  test('collapses runs of three or more newlines', () => expect(htmlToMarkdown('a\n\n\n\nb')).toBe('a\n\nb'));

  test('trims surrounding whitespace', () => expect(htmlToMarkdown('  padded  ')).toBe('padded'));
});

describe('renderDocsEntry', () => {
  test('returns an empty string when every part is empty', () => expect(renderDocsEntry(makeEntry({}))).toBe(''));

  test('omits the Learn More link when it is empty', () => {
    const rendered = renderDocsEntry(makeEntry({ 'documentation': 'Description.' }));

    expect(rendered).toBe('Description.');
    expect(rendered).not.toContain('Learn More');
  });

  test('omits the lua block when the code sample is empty', () => {
    const rendered = renderDocsEntry(
      makeEntry({ 'documentation': 'Description.', 'learn_more_link': 'https://create.roblox.com/docs' }),
    );

    expect(rendered).not.toContain('```lua');
  });

  test('renders sections in description, link, sample order', () => {
    const rendered = renderDocsEntry(
      makeEntry({
        'documentation': 'Does a <code>thing</code>.',
        'learn_more_link': 'https://create.roblox.com/docs/reference',
        'code_sample': 'print("hi")',
      }),
    );

    expect(rendered).toBe(
      'Does a `thing`.\n\n[Learn More](https://create.roblox.com/docs/reference)\n\n```lua\nprint("hi")\n```',
    );
  });
});
