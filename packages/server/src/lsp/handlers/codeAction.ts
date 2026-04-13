import { walk } from '@parser/visitor';
import { typeToString } from '@typings/types';
import { CodeActionKind } from 'vscode-languageserver';

import type { DocumentManager } from '@typings/lsp';
import type { CodeAction, CodeActionParams, Connection, Range, TextDocuments, TextEdit } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/** Maps deprecated Roblox API method names to their non-deprecated replacements. */
export const DEPRECATION_REPLACEMENTS: ReadonlyMap<string, string> = new Map([
  ['IsInGroup', 'IsInGroupAsync'],
  ['GetRankInGroup', 'GetRankInGroupAsync'],
  ['GetRoleInGroup', 'GetRoleInGroupAsync'],
  ['IsFriendsWith', 'IsFriendsWith'],
  ['GetFriendsOnline', 'GetFriendsOnline'],
  ['children', 'GetChildren'],
  ['getChildren', 'GetChildren'],
  ['isA', 'IsA'],
  ['isAncestorOf', 'IsAncestorOf'],
  ['isDescendantOf', 'IsDescendantOf'],
  ['findFirstChild', 'FindFirstChild'],
  ['findFirstAncestor', 'FindFirstAncestor'],
  ['waitForChild', 'WaitForChild'],
  ['clone', 'Clone'],
  ['destroy', 'Destroy'],
  ['remove', 'Destroy'],
  ['Remove', 'Destroy'],
  ['LoadAnimation', 'Animator:LoadAnimation'],
  ['p', 'Position'],
  ['connect', 'Connect'],
  ['CurrentCamera', 'Camera'],
]);

const getSelectionText = (doc: TextDocument, range: Range): string | undefined => {
  const text = doc.getText(range);
  if (text.trim().length === 0) return undefined;
  return text;
};

/** Provides quick fixes, refactors, and source actions for Luau code. */
export const setupCodeActionHandler = (
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  documentManager: DocumentManager,
): void => {
  connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
    const doc = documents.get(params.textDocument.uri);
    if (doc === undefined) return [];

    const actions: CodeAction[] = [];

    for (const diagnostic of params.context.diagnostics) {
      const isOurDiagnostic =
        diagnostic.source === 'rbxdev-ls' ||
        diagnostic.code === 'W001' ||
        diagnostic.code === 'E000' ||
        (diagnostic.source === undefined && diagnostic.message.includes('is deprecated'));

      if (isOurDiagnostic === false) continue;

      if (diagnostic.message.includes('is deprecated')) {
        let nameMatch = diagnostic.message.match(/'([^']+)' is deprecated/);
        if (nameMatch === null) {
          nameMatch = diagnostic.message.match(/['']([^'']+)[''] is deprecated/);
        }
        if (nameMatch === null) continue;

        const deprecatedName = nameMatch[1];
        if (deprecatedName === undefined) continue;

        const replacement = DEPRECATION_REPLACEMENTS.get(deprecatedName);
        if (replacement !== undefined) {
          const edit: TextEdit = {
            'range': diagnostic.range,
            'newText': replacement,
          };

          actions.push({
            'title': `Replace '${deprecatedName}' with '${replacement}'`,
            'kind': CodeActionKind.QuickFix,
            'diagnostics': [diagnostic],
            'isPreferred': true,
            'edit': {
              'changes': {
                [params.textDocument.uri]: [edit],
              },
            },
          });
        }

        let useInsteadMatch = diagnostic.message.match(/Use '([^']+)' instead/);
        if (useInsteadMatch === null) {
          useInsteadMatch = diagnostic.message.match(/Use ['']([^'']+)[''] instead/);
        }
        if (useInsteadMatch !== null) {
          const suggestedReplacement = useInsteadMatch[1];
          if (suggestedReplacement !== undefined && suggestedReplacement !== replacement) {
            const edit: TextEdit = {
              'range': diagnostic.range,
              'newText': suggestedReplacement,
            };

            actions.push({
              'title': `Replace with '${suggestedReplacement}'`,
              'kind': CodeActionKind.QuickFix,
              'diagnostics': [diagnostic],
              'isPreferred': replacement === undefined,
              'edit': {
                'changes': {
                  [params.textDocument.uri]: [edit],
                },
              },
            });
          }
        }
      }

      if (diagnostic.message.startsWith('Unknown identifier')) {
        const identMatch = diagnostic.message.match(/Unknown identifier ['']([^'']+)['']/);
        if (identMatch !== null) {
          const identName = identMatch[1];
          if (identName !== undefined) {
            const lineText = doc.getText({
              'start': { 'line': diagnostic.range.start.line, 'character': 0 },
              'end': { 'line': diagnostic.range.start.line, 'character': 1000 },
            });
            const indentMatch = lineText.match(/^(\s*)/);
            const indent = indentMatch?.[1] ?? '';

            actions.push({
              'title': `Add 'local ${identName} = nil' above`,
              'kind': CodeActionKind.QuickFix,
              'diagnostics': [diagnostic],
              'edit': {
                'changes': {
                  [params.textDocument.uri]: [
                    {
                      'range': {
                        'start': { 'line': diagnostic.range.start.line, 'character': 0 },
                        'end': { 'line': diagnostic.range.start.line, 'character': 0 },
                      },
                      'newText': `${indent}local ${identName} = nil\n`,
                    },
                  ],
                },
              },
            });
          }
        }
      }

      if (diagnostic.message.includes('unused') || diagnostic.message.includes('Unused')) {
        const unusedMatch = diagnostic.message.match(/['']([^'']+)['']/);
        if (unusedMatch !== null) {
          const varName = unusedMatch[1];
          if (varName !== undefined && varName.startsWith('_') === false) {
            actions.push({
              'title': `Prefix '${varName}' with '_'`,
              'kind': CodeActionKind.QuickFix,
              'diagnostics': [diagnostic],
              'edit': {
                'changes': {
                  [params.textDocument.uri]: [
                    {
                      'range': diagnostic.range,
                      'newText': `_${varName}`,
                    },
                  ],
                },
              },
            });
          }
        }
      }
    }

    const selectedText = getSelectionText(doc, params.range);
    const isSelection =
      params.range.start.line !== params.range.end.line || params.range.start.character !== params.range.end.character;

    if (selectedText !== undefined && isSelection) {
      const lineText = doc.getText({
        'start': { 'line': params.range.start.line, 'character': 0 },
        'end': { 'line': params.range.start.line, 'character': 1000 },
      });
      const indentMatch = lineText.match(/^(\s*)/);
      const indent = indentMatch?.[1] ?? '';

      actions.push({
        'title': 'Extract to local variable',
        'kind': CodeActionKind.RefactorExtract,
        'edit': {
          'changes': {
            [params.textDocument.uri]: [
              {
                'range': {
                  'start': { 'line': params.range.start.line, 'character': 0 },
                  'end': { 'line': params.range.start.line, 'character': 0 },
                },
                'newText': `${indent}local extracted = ${selectedText}\n`,
              },
              {
                'range': params.range,
                'newText': 'extracted',
              },
            ],
          },
        },
      });
    }

    const parsedDoc = documentManager.getDocument(params.textDocument.uri);
    if (parsedDoc?.ast !== undefined && parsedDoc.typeCheckResult !== undefined) {
      const allSymbols = parsedDoc.typeCheckResult.allSymbols;

      walk(parsedDoc.ast, {
        'visitLocalDeclaration': node => {
          for (let i = 0; i < node.names.length; i++) {
            const name = node.names[i];
            const typeAnnotation = node.types[i];
            if (name === undefined || typeAnnotation !== undefined) continue;

            const nameLine = name.range.start.line - 1;
            if (nameLine !== params.range.start.line) continue;

            const nameStart = name.range.start.column - 1;
            const nameEnd = name.range.end.column - 1;
            if (params.range.start.character < nameStart || params.range.start.character > nameEnd) continue;

            const symbolType = allSymbols.get(name.name);
            if (symbolType === undefined || symbolType.kind === 'Any' || symbolType.kind === 'Unknown') continue;

            const typeStr = typeToString(symbolType);
            if (typeStr === 'nil' || typeStr.length > 60 || typeStr.includes('not found')) continue;

            actions.push({
              'title': `Add type annotation: ${typeStr}`,
              'kind': CodeActionKind.QuickFix,
              'edit': {
                'changes': {
                  [params.textDocument.uri]: [
                    {
                      'range': {
                        'start': { 'line': nameLine, 'character': nameEnd },
                        'end': { 'line': nameLine, 'character': nameEnd },
                      },
                      'newText': `: ${typeStr}`,
                    },
                  ],
                },
              },
            });
          }
        },
      });
    }

    if (parsedDoc?.ast !== undefined) {
      walk(parsedDoc.ast, {
        'visitStringLiteral': node => {
          const nodeLine = node.range.start.line - 1;
          const nodeStart = node.range.start.column - 1;
          const nodeEnd = node.range.end.column - 1;

          if (nodeLine !== params.range.start.line) return;
          if (params.range.start.character < nodeStart || params.range.start.character > nodeEnd) return;

          const raw = node.raw;
          if (raw.startsWith('"')) {
            actions.push({
              'title': 'Convert to single quotes',
              'kind': CodeActionKind.RefactorRewrite,
              'edit': {
                'changes': {
                  [params.textDocument.uri]: [
                    {
                      'range': {
                        'start': { 'line': nodeLine, 'character': nodeStart },
                        'end': { 'line': nodeLine, 'character': nodeEnd },
                      },
                      'newText': `'${node.value.replace(/'/g, "\\'")}'`,
                    },
                  ],
                },
              },
            });
          } else if (raw.startsWith("'")) {
            actions.push({
              'title': 'Convert to double quotes',
              'kind': CodeActionKind.RefactorRewrite,
              'edit': {
                'changes': {
                  [params.textDocument.uri]: [
                    {
                      'range': {
                        'start': { 'line': nodeLine, 'character': nodeStart },
                        'end': { 'line': nodeLine, 'character': nodeEnd },
                      },
                      'newText': `"${node.value.replace(/"/g, '\\"')}"`,
                    },
                  ],
                },
              },
            });
          }
        },
      });
    }

    return actions;
  });
};
