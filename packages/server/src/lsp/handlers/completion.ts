import { getTableLiteralCompletions } from '@lsp/handlers/completion/fields';
import { getAutoImportCompletions, getLocalRequireCompletions } from '@lsp/handlers/completion/imports';
import { DEBUG_COMPLETION } from '@lsp/handlers/completion/inference';
import {
  getBracketCompletions,
  getLiveServiceCompletions,
  getRequireModuleCompletions,
} from '@lsp/handlers/completion/live';
import { completeMembers } from '@lsp/handlers/completion/members';
import { resolveCompletionItem } from '@lsp/handlers/completion/resolve';
import { getEnumCompletions, getStringCompletions } from '@lsp/handlers/completion/strings';
import {
  getGlobalCompletions,
  getLocalSymbolCompletions,
  getSnippetCompletions,
  getTypeAnnotationCompletions,
} from '@lsp/handlers/completion/symbols';

import type { ExecutorBridge } from '@typings/bridge';
import type { DocumentManager } from '@typings/lsp';
import type {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Connection,
  TextDocuments,
} from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/** Sets up the completion handler for the LSP connection. */
export const setupCompletionHandler = (
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  documentManager: DocumentManager,
  executorBridge: ExecutorBridge,
): void => {
  const liveGameModel = executorBridge.liveGameModel;

  const log = (message: string): void => {
    if (DEBUG_COMPLETION) connection.console.log(`[completion] ${message}`);
  };

  connection.onCompletion(async (params: CompletionParams): Promise<CompletionList> => {
    const liveDoc = documents.get(params.textDocument.uri);
    if (liveDoc === undefined) return { 'isIncomplete': false, 'items': [] };

    const content = liveDoc.getText();
    if (params.position.line >= liveDoc.lineCount) return { 'isIncomplete': false, 'items': [] };

    const lineStart = liveDoc.offsetAt({ 'line': params.position.line, 'character': 0 });
    const lineEnd = liveDoc.offsetAt({ 'line': params.position.line + 1, 'character': 0 });
    const rawLine = content.slice(lineStart, lineEnd);
    const line = rawLine.endsWith('\n') ? rawLine.slice(0, -1) : rawLine;

    const beforeCursor = line.slice(0, params.position.character);
    log(`beforeCursor: "${beforeCursor}"`);

    const document = documentManager.getDocument(params.textDocument.uri);
    log(`document exists: ${document !== undefined}, has typeCheck: ${document?.typeCheckResult !== undefined}`);

    const liveServiceCompletions = getLiveServiceCompletions(beforeCursor, liveGameModel);
    if (liveServiceCompletions !== undefined) return { 'isIncomplete': true, 'items': liveServiceCompletions };

    const bracketCompletions = getBracketCompletions(beforeCursor, liveGameModel);
    if (bracketCompletions !== undefined) return { 'isIncomplete': true, 'items': bracketCompletions };

    const stringCompletions = getStringCompletions(beforeCursor, documentManager);
    if (stringCompletions !== undefined) return { 'isIncomplete': true, 'items': stringCompletions };

    const enumCompletions = getEnumCompletions(beforeCursor, documentManager);
    if (enumCompletions !== undefined) return { 'isIncomplete': true, 'items': enumCompletions };

    const typeAnnotationCompletions = getTypeAnnotationCompletions(beforeCursor, document, documentManager);
    if (typeAnnotationCompletions !== undefined) return { 'isIncomplete': true, 'items': typeAnnotationCompletions };

    const requireModuleCompletions = await getRequireModuleCompletions(beforeCursor, executorBridge);
    if (requireModuleCompletions !== undefined) return { 'isIncomplete': true, 'items': requireModuleCompletions };

    const localRequireCompletions = getLocalRequireCompletions(beforeCursor, params.textDocument.uri);
    if (localRequireCompletions !== undefined) return { 'isIncomplete': true, 'items': localRequireCompletions };

    const tableFieldCompletions = getTableLiteralCompletions(beforeCursor, documentManager);
    if (tableFieldCompletions !== undefined) return { 'isIncomplete': true, 'items': tableFieldCompletions };

    const memberCompletions = await completeMembers({
      document,
      content,
      beforeCursor,
      'uri': params.textDocument.uri,
      documentManager,
      executorBridge,
      log,
    });
    if (memberCompletions !== undefined) return memberCompletions;

    const wordMatch = beforeCursor.match(/(\w*)$/);
    const prefix = wordMatch?.[1] ?? '';

    const localItems = getLocalSymbolCompletions(document, prefix, documentManager, params.position);
    const localNames = new Set(localItems.map(item => item.label));
    const globalItems = getGlobalCompletions(documentManager, prefix).filter(
      item => localNames.has(item.label) === false,
    );
    const snippetItems = getSnippetCompletions(prefix);
    const autoImportItems = getAutoImportCompletions(prefix, documentManager, params.textDocument.uri, content);

    return {
      'isIncomplete': true,
      'items': [...localItems, ...globalItems, ...snippetItems, ...autoImportItems],
    };
  });

  connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => resolveCompletionItem(item, documentManager),
  );
};
