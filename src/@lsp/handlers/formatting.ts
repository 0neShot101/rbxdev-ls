/**
 * Document Formatting Handler
 * Integrates with StyLua for code formatting
 */

import { spawn } from 'child_process';

import type { DocumentManager } from '@lsp/documents';
import type { Connection, DocumentFormattingParams, TextDocuments, TextEdit } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Checks if StyLua is available on the system by attempting to run it.
 * Spawns a child process to execute 'stylua --version' and checks the exit code.
 * @returns A promise that resolves to true if StyLua is available, false otherwise
 */
const checkStyLuaAvailable = (): Promise<boolean> =>
  new Promise(resolve => {
    const process = spawn('stylua', ['--version'], { 'shell': true });

    /**
     * Handles spawn errors (e.g., command not found).
     */
    process.on('error', () => {
      resolve(false);
    });

    /**
     * Handles process exit and checks for successful execution.
     * @param code - The exit code of the process
     */
    process.on('close', code => {
      resolve(code === 0);
    });
  });

/**
 * Formats Luau code using the StyLua formatter.
 * Pipes the code to StyLua via stdin and captures the formatted output.
 * @param code - The source code to format
 * @returns A promise that resolves to the formatted code, or undefined if formatting failed
 */
const formatWithStyLua = (code: string): Promise<string | undefined> =>
  new Promise(resolve => {
    const process = spawn('stylua', ['--stdin-filepath', 'file.lua', '-'], {
      'shell': true,
      'stdio': ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';

    /**
     * Accumulates stdout data from the StyLua process.
     * @param data - Buffer containing stdout output
     */
    process.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    /**
     * Handles spawn errors.
     */
    process.on('error', () => {
      resolve(undefined);
    });

    /**
     * Handles process exit and returns formatted code on success.
     * @param code - The exit code of the process
     */
    process.on('close', code => {
      if (code === 0) {
        resolve(stdout);
      } else {
        resolve(undefined);
      }
    });

    process.stdin.write(code);
    process.stdin.end();
  });

/**
 * Simple built-in formatter used as a fallback when StyLua is not available.
 * Performs basic formatting by normalizing indentation based on Luau keywords.
 * @param code - The source code to format
 * @returns The formatted code with normalized indentation
 */
const basicFormat = (code: string): string => {
  const lines = code.split('\n');
  const result: string[] = [];
  let indent = 0;
  const indentStr = '\t';

  // Keywords that increase indent
  const increaseIndent = /^\s*(function|if|for|while|repeat|do)\b/;
  const decreaseIndent = /^\s*(end|else|elseif|until)\b/;
  const decreaseIncrease = /^\s*(else|elseif)\b/;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      result.push('');
      continue;
    }

    // Decrease indent for closing keywords
    if (decreaseIndent.test(trimmed)) {
      indent = Math.max(0, indent - 1);
    }

    // Add the line with proper indentation
    result.push(indentStr.repeat(indent) + trimmed);

    // Increase indent for opening keywords (but not for one-liners)
    if (increaseIndent.test(trimmed) && trimmed.includes(' end') === false) {
      indent++;
    }

    // Handle else/elseif (decrease then increase)
    if (decreaseIncrease.test(trimmed)) {
      // Already decreased above, now increase back
      indent++;
    }

    // Handle end on same line as function
    if (trimmed.endsWith('end') && trimmed.includes('function')) {
      // One-liner function, don't change indent
    }
  }

  return result.join('\n');
};

/** Cached result of StyLua availability check */
let styluaAvailable: boolean | undefined;

/**
 * Registers the document formatting handler with the LSP connection.
 * Handles textDocument/formatting requests using StyLua when available, with a basic fallback.
 * @param connection - The LSP connection to register the handler on
 * @param documents - The text documents manager for accessing document content
 * @param _documentManager - The document manager (unused, kept for interface consistency)
 * @returns void
 */
export const setupFormattingHandler = (
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  _documentManager: DocumentManager,
): void => {
  /**
   * Handles the document formatting request by formatting the entire document.
   * Uses StyLua if available, otherwise falls back to basic formatting.
   * @param params - The formatting parameters containing the document URI
   * @returns A promise resolving to an array of text edits to apply
   */
  connection.onDocumentFormatting(async (params: DocumentFormattingParams): Promise<TextEdit[]> => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) return [];

    const originalText = document.getText();

    // Check if StyLua is available (cache result)
    if (styluaAvailable === undefined) {
      styluaAvailable = await checkStyLuaAvailable();
      if (styluaAvailable) {
        connection.console.log('StyLua found - using for formatting');
      } else {
        connection.console.log('StyLua not found - using basic formatter');
      }
    }

    let formattedText: string | undefined;

    if (styluaAvailable) {
      formattedText = await formatWithStyLua(originalText);
    }

    // Fall back to basic formatter if StyLua failed or not available
    if (formattedText === undefined) {
      formattedText = basicFormat(originalText);
    }

    // If no changes, return empty array
    if (formattedText === originalText) {
      return [];
    }

    // Return a single edit that replaces the entire document
    const lineCount = originalText.split('\n').length;
    const lastLine = originalText.split('\n')[lineCount - 1] ?? '';

    return [
      {
        'range': {
          'start': { 'line': 0, 'character': 0 },
          'end': { 'line': lineCount - 1, 'character': lastLine.length },
        },
        'newText': formattedText,
      },
    ];
  });
};
