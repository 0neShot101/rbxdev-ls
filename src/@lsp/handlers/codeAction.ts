/**
 * Code Action Handler
 * Provides quick fixes and refactoring suggestions
 */

import { CodeActionKind } from 'vscode-languageserver';

import type { DocumentManager } from '@lsp/documents';
import type { CodeAction, CodeActionParams, Connection, TextDocuments, TextEdit } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Map of deprecated Roblox API names to their modern replacements.
 * Used to provide quick-fix suggestions for deprecated API usage.
 */
const DEPRECATION_REPLACEMENTS: ReadonlyMap<string, string> = new Map([
  // Player methods
  ['IsInGroup', 'IsInGroupAsync'],
  ['GetRankInGroup', 'GetRankInGroupAsync'],
  ['GetRoleInGroup', 'GetRoleInGroupAsync'],
  ['IsFriendsWith', 'IsFriendsWith'], // Same name but async version
  ['GetFriendsOnline', 'GetFriendsOnline'],
  // Instance methods
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
  // Humanoid
  ['LoadAnimation', 'Animator:LoadAnimation'],
  // CFrame
  ['p', 'Position'],
  // connect/Connect
  ['connect', 'Connect'],
  // Workspace
  ['CurrentCamera', 'Camera'],
]);

/**
 * Registers the code action handler with the LSP connection.
 * Provides quick fixes for deprecation warnings and unknown identifier errors.
 * @param connection - The LSP connection to register the handler on
 * @param documents - The text documents manager for accessing document content
 * @param _documentManager - The document manager (unused, kept for interface consistency)
 * @returns void
 */
export const setupCodeActionHandler = (
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  _documentManager: DocumentManager,
): void => {
  /**
   * Handles the code action request by generating quick fixes for diagnostics.
   * Processes deprecation warnings and unknown identifier errors to provide
   * appropriate replacement suggestions.
   * @param params - The code action parameters containing document URI, range, and diagnostics
   * @returns An array of code actions that can be applied to fix the issues
   */
  connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
    const doc = documents.get(params.textDocument.uri);
    if (doc === undefined) return [];

    const actions: CodeAction[] = [];

    // Check each diagnostic for potential fixes
    for (const diagnostic of params.context.diagnostics) {
      // Only handle our own diagnostics - check source or code
      // VS Code may pass diagnostics with source as undefined in some cases
      const isOurDiagnostic =
        diagnostic.source === 'rbxdev-ls' ||
        diagnostic.code === 'W001' ||
        diagnostic.code === 'E000' ||
        (diagnostic.source === undefined && diagnostic.message.includes('is deprecated'));

      if (isOurDiagnostic === false) continue;

      // Check for deprecation warnings
      if (diagnostic.message.includes('is deprecated')) {
        // Extract the deprecated name from the message
        // Try straight quotes first, then curly quotes
        let nameMatch = diagnostic.message.match(/'([^']+)' is deprecated/);
        if (nameMatch === null) {
          nameMatch = diagnostic.message.match(/['']([^'']+)[''] is deprecated/);
        }
        if (nameMatch === null) continue;

        const deprecatedName = nameMatch[1];
        if (deprecatedName === undefined) continue;

        // Check if we have a replacement
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

        // Also check if the message contains a "Use X instead" hint
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

      // Add quick fix for "Unknown identifier" to add local declaration
      if (diagnostic.message.startsWith('Unknown identifier')) {
        const identMatch = diagnostic.message.match(/Unknown identifier ['']([^'']+)['']/);
        if (identMatch !== null) {
          const identName = identMatch[1];
          if (identName !== undefined) {
            // Get the line content to find indentation
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
    }

    return actions;
  });
};
