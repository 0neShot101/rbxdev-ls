import { spawn } from 'child_process';

import type { DocumentManager } from '@typings/lsp';
import type {
  Connection,
  DocumentFormattingParams,
  DocumentOnTypeFormattingParams,
  DocumentRangeFormattingParams,
  TextDocuments,
  TextEdit,
} from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

const checkStyLuaAvailable = (): Promise<boolean> =>
  new Promise(resolve => {
    const process = spawn('stylua', ['--version'], { 'shell': true });

    process.on('error', () => {
      resolve(false);
    });

    process.on('close', code => {
      resolve(code === 0);
    });
  });

const formatWithStyLua = (code: string): Promise<string | undefined> =>
  new Promise(resolve => {
    const process = spawn('stylua', ['--stdin-filepath', 'file.lua', '-'], {
      'shell': true,
      'stdio': ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';

    process.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    process.on('error', () => {
      resolve(undefined);
    });

    process.on('close', code => {
      if (code === 0) resolve(stdout);
      else resolve(undefined);
    });

    process.stdin.write(code);
    process.stdin.end();
  });

const formatWithStyLuaRange = (code: string, rangeStart: number, rangeEnd: number): Promise<string | undefined> =>
  new Promise(resolve => {
    const args = [
      '--stdin-filepath',
      'file.lua',
      '--range-start',
      String(rangeStart),
      '--range-end',
      String(rangeEnd),
      '-',
    ];

    const process = spawn('stylua', args, {
      'shell': true,
      'stdio': ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';

    process.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    process.on('error', () => {
      resolve(undefined);
    });

    process.on('close', code => {
      if (code === 0) resolve(stdout);
      else resolve(undefined);
    });

    process.stdin.write(code);
    process.stdin.end();
  });

/** Formats Luau code using basic indentation rules as a fallback when StyLua is unavailable. */
export const basicFormat = (code: string): string => {
  const lines = code.split('\n');
  const result: string[] = [];
  let indent = 0;
  const indentStr = '\t';

  const increaseIndent = /^\s*(function|if|for|while|repeat|do)\b/;
  const decreaseIndent = /^\s*(end|else|elseif|until)\b/;
  const decreaseIncrease = /^\s*(else|elseif)\b/;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      result.push('');
      continue;
    }

    if (decreaseIndent.test(trimmed)) {
      indent = Math.max(0, indent - 1);
    }

    result.push(indentStr.repeat(indent) + trimmed);

    if (increaseIndent.test(trimmed) && trimmed.includes(' end') === false) {
      indent++;
    }

    if (decreaseIncrease.test(trimmed)) {
      indent++;
    }

    if (trimmed.endsWith('end') && trimmed.includes('function')) {
      // one-liner function, no indent change
    }
  }

  return result.join('\n');
};

let styluaAvailable: boolean | undefined;

/** Handles textDocument/formatting requests using StyLua when available, with a basic fallback. */
export const setupFormattingHandler = (
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  _documentManager: DocumentManager,
): void => {
  connection.onDocumentFormatting(async (params: DocumentFormattingParams): Promise<TextEdit[]> => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) return [];

    const originalText = document.getText();

    if (styluaAvailable === undefined) {
      styluaAvailable = await checkStyLuaAvailable();
      if (styluaAvailable) connection.console.log('StyLua found - using for formatting');
      else connection.console.log('StyLua not found - using basic formatter');
    }

    let formattedText: string | undefined;

    if (styluaAvailable) {
      formattedText = await formatWithStyLua(originalText);
    }

    if (formattedText === undefined) {
      formattedText = basicFormat(originalText);
    }

    if (formattedText === originalText) return [];

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

  connection.onDocumentRangeFormatting(async (params: DocumentRangeFormattingParams): Promise<TextEdit[]> => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) return [];

    const originalText = document.getText();

    if (styluaAvailable === undefined) {
      styluaAvailable = await checkStyLuaAvailable();
    }

    if (styluaAvailable) {
      const lines = originalText.split('\n');
      let byteOffset = 0;
      for (let i = 0; i < params.range.start.line; i++) {
        byteOffset += (lines[i]?.length ?? 0) + 1;
      }
      const rangeStart = byteOffset + params.range.start.character;

      byteOffset = 0;
      for (let i = 0; i < params.range.end.line; i++) {
        byteOffset += (lines[i]?.length ?? 0) + 1;
      }
      const rangeEnd = byteOffset + params.range.end.character;

      const formatted = await formatWithStyLuaRange(originalText, rangeStart, rangeEnd);
      if (formatted !== undefined && formatted !== originalText) {
        const lineCount = originalText.split('\n').length;
        const lastLine = originalText.split('\n')[lineCount - 1] ?? '';
        return [
          {
            'range': {
              'start': { 'line': 0, 'character': 0 },
              'end': { 'line': lineCount - 1, 'character': lastLine.length },
            },
            'newText': formatted,
          },
        ];
      }
    }

    const lines = originalText.split('\n');
    const rangeLines = lines.slice(params.range.start.line, params.range.end.line + 1);
    const rangeText = rangeLines.join('\n');
    const formatted = basicFormat(rangeText);

    if (formatted === rangeText) return [];

    return [
      {
        'range': params.range,
        'newText': formatted,
      },
    ];
  });

  connection.onDocumentOnTypeFormatting((params: DocumentOnTypeFormattingParams): TextEdit[] => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) return [];

    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = params.position.line;
    const previousLine = currentLine - 1;

    if (previousLine < 0) return [];

    const prevLineText = lines[previousLine];
    if (prevLineText === undefined) return [];

    const prevTrimmed = prevLineText.trimEnd();
    const prevIndentMatch = prevLineText.match(/^(\s*)/);
    const prevIndent = prevIndentMatch?.[1] ?? '';
    const indentUnit = params.options.insertSpaces === true ? ' '.repeat(params.options.tabSize) : '\t';

    const blockOpeners = /\b(then|do|else|repeat)\s*$|function\s*\([^)]*\)\s*$/;
    const blockClosers = /^\s*(end|until|else|elseif)\b/;

    if (blockOpeners.test(prevTrimmed)) {
      return [
        {
          'range': {
            'start': { 'line': currentLine, 'character': 0 },
            'end': { 'line': currentLine, 'character': params.position.character },
          },
          'newText': prevIndent + indentUnit,
        },
      ];
    }

    const currentLineText = lines[currentLine];
    if (currentLineText !== undefined && blockClosers.test(currentLineText)) {
      const dedented =
        prevIndent.length >= indentUnit.length ? prevIndent.slice(0, prevIndent.length - indentUnit.length) : '';
      return [
        {
          'range': {
            'start': { 'line': currentLine, 'character': 0 },
            'end': { 'line': currentLine, 'character': params.position.character },
          },
          'newText': dedented,
        },
      ];
    }

    return [];
  });
};
