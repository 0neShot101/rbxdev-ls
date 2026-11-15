import type { DocsEntry, DocsSource } from '@typings/docs';

/** Converts the documentation HTML subset into markdown for hover and completion rendering. */
export const htmlToMarkdown = (text: string): string =>
  text
    .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**')
    .replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
    .replace(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Renders a documentation entry as a markdown section with description, Learn More link, and code sample. */
export const renderDocsEntry = (entry: DocsEntry): string => {
  const documentation = entry.documentation ?? '';
  const link = entry.learn_more_link ?? '';
  const sample = entry.code_sample ?? '';
  if (documentation === '' && link === '' && sample === '') return '';

  let markdown = htmlToMarkdown(documentation);
  if (link !== '') markdown += `\n\n[Learn More](${link})`;
  if (sample !== '') markdown += `\n\n\`\`\`lua\n${sample}\n\`\`\``;
  return markdown;
};

/** Finds the docs entry for a class member, walking the superclass chain and falling back to the Object class. */
export const lookupMemberDoc = (
  robloxDocs: DocsSource | undefined,
  className: string,
  memberName: string,
  getSuperclassName: (className: string) => string | undefined,
): { entry: DocsEntry; docsClassName: string } | undefined => {
  if (robloxDocs === undefined) return undefined;

  const visited = new Set<string>();
  let current: string | undefined = className;

  while (current !== undefined) {
    if (visited.has(current)) break;
    visited.add(current);

    const entry = robloxDocs.get(`@roblox/globaltype/${current}.${memberName}`);
    if (entry !== undefined) return { entry, 'docsClassName': current };

    current = getSuperclassName(current);
  }

  if (visited.has('Object')) return undefined;

  const objectEntry = robloxDocs.get(`@roblox/globaltype/Object.${memberName}`);
  if (objectEntry === undefined) return undefined;
  return { 'entry': objectEntry, 'docsClassName': 'Object' };
};

/** Finds the docs entry for a global function, preferring the Roblox database over the Luau database. */
export const lookupGlobalDoc = (
  robloxDocs: DocsSource | undefined,
  luauDocs: DocsSource | undefined,
  name: string,
): DocsEntry | undefined => robloxDocs?.get(`@roblox/global/${name}`) ?? luauDocs?.get(`@luau/global/${name}`);

/** Finds the docs entry for a library member, preferring the Roblox database over the Luau database. */
export const lookupLibraryDoc = (
  robloxDocs: DocsSource | undefined,
  luauDocs: DocsSource | undefined,
  libraryName: string,
  memberName: string,
): DocsEntry | undefined =>
  robloxDocs?.get(`@roblox/global/${libraryName}.${memberName}`) ??
  luauDocs?.get(`@luau/global/${libraryName}.${memberName}`);
