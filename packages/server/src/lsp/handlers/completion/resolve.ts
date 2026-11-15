import { MarkupKind } from 'vscode-languageserver';

import { lookupGlobalDoc, lookupMemberDoc, renderDocsEntry } from '@definitions/docs';
import { getSuperclassName } from '@lsp/handlers/completion/expression';
import { formatDocumentation } from '@lsp/handlers/completion/format';
import { isCompletionItemData } from '@lsp/handlers/itemData';

import type { DocumentManager } from '@typings/lsp';
import type { CompletionItem } from 'vscode-languageserver';

/** Fills deferred markdown documentation for a member or global completion item from the loaded docs and doc comments. */
export const resolveCompletionItem = (item: CompletionItem, documentManager: DocumentManager): CompletionItem => {
  const data: unknown = item.data;
  if (isCompletionItemData(data) === false) return item;

  if (data.resolve === 'member') {
    const getSuperclass = (className: string): string | undefined => getSuperclassName(className, documentManager);
    const result = lookupMemberDoc(documentManager.globalEnv.robloxDocs, data.class, data.member, getSuperclass);
    if (result === undefined) return item;
    item.documentation = { 'kind': MarkupKind.Markdown, 'value': renderDocsEntry(result.entry) };
    return item;
  }

  if (data.resolve === 'global') {
    const docsEntry = lookupGlobalDoc(
      documentManager.globalEnv.robloxDocs,
      documentManager.globalEnv.luauDocs,
      data.name,
    );
    if (docsEntry !== undefined) {
      item.documentation = { 'kind': MarkupKind.Markdown, 'value': renderDocsEntry(docsEntry) };
      return item;
    }

    const symbol = documentManager.globalEnv.env.globalScope.symbols.get(data.name);
    if (symbol !== undefined) {
      const documentation = formatDocumentation(symbol.docComment);
      if (documentation !== undefined) item.documentation = documentation;

      if (symbol.type.kind === 'Function' && symbol.type.description !== undefined) {
        const parts: string[] = [];
        parts.push(symbol.type.description);
        if (symbol.type.example !== undefined) {
          parts.push('');
          parts.push('```lua');
          parts.push(symbol.type.example);
          parts.push('```');
        }
        if (item.documentation === undefined)
          item.documentation = { 'kind': MarkupKind.Markdown, 'value': parts.join('\n') };
      }
    }
  }

  return item;
};
