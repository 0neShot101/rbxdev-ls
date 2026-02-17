import * as url from 'url';

import { walk } from '@parser/visitor';
import { resolveLocalModule } from '@workspace/moduleIndex';

import type { CallExpression, Chunk } from '@typings/ast';
import type { DocumentManager } from '@typings/lsp';
import type { Connection, DocumentLink, DocumentLinkParams } from 'vscode-languageserver';

const decodeFilePath = (documentUri: string): string | undefined => {
  try {
    let filePath = decodeURIComponent(new URL(documentUri).pathname);
    if (filePath.match(/^\/[A-Za-z]:/) !== null) filePath = filePath.slice(1);
    return filePath;
  } catch {
    return undefined;
  }
};

export const collectRequireLinks = (chunk: Chunk, documentUri: string): DocumentLink[] => {
  const links: DocumentLink[] = [];

  const filePath = decodeFilePath(documentUri);
  if (filePath === undefined) return links;

  walk(chunk, {
    'visitCallExpression': (node: CallExpression) => {
      if (node.callee.kind !== 'Identifier' || node.callee.name !== 'require') return;

      const firstArg = node.args[0];
      if (firstArg === undefined || firstArg.kind !== 'StringLiteral') return;
      if (firstArg.value.startsWith('./') === false && firstArg.value.startsWith('../') === false) return;

      const moduleInfo = resolveLocalModule(firstArg.value, filePath);
      if (moduleInfo === undefined) return;

      links.push({
        'range': {
          'start': { 'line': firstArg.range.start.line - 1, 'character': firstArg.range.start.column - 1 },
          'end': { 'line': firstArg.range.end.line - 1, 'character': firstArg.range.end.column - 1 },
        },
        'target': url.pathToFileURL(moduleInfo.filePath).toString(),
      });
    },
  });

  return links;
};

/** Makes require() string paths clickable as document links. */
export const setupDocumentLinkHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onDocumentLinks((params: DocumentLinkParams): DocumentLink[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return [];

    return collectRequireLinks(document.ast, params.textDocument.uri);
  });
};
