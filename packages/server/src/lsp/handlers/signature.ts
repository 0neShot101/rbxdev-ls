import { MarkupKind } from 'vscode-languageserver';

import { typeToString } from '@analyzer/values';
import { getVisibleLocals } from '@lsp/handlers/lexical';

import type { Symbol } from '@typings/environment';
import type { DocComment } from '@typings/parser';
import type { FunctionType } from '@typings/types';
import type { DocumentManager, ParsedDocument } from '@typings/lsp';
import type {
  Connection,
  ParameterInformation,
  Position,
  SignatureHelp,
  SignatureHelpParams,
  SignatureInformation,
} from 'vscode-languageserver';

/**
 * Creates an LSP SignatureInformation object from a function type.
 * @param name - The function name.
 */
export const createSignatureInfo = (
  name: string,
  func: FunctionType,
  docComment: DocComment | undefined,
): SignatureInformation => {
  const params: ParameterInformation[] = func.params.map(p => {
    const paramName = p.name ?? 'arg';
    const optional = p.optional ? '?' : '';
    const label = `${paramName}${optional}: ${typeToString(p.type)}`;

    let documentation: string | undefined;
    if (docComment !== undefined) {
      const docParam = docComment.params.find(dp => dp.name === paramName);
      if (docParam !== undefined && docParam.description !== undefined) documentation = docParam.description;
    }

    if (documentation !== undefined)
      return {
        label,
        'documentation': {
          'kind': MarkupKind.Markdown,
          'value': documentation,
        },
      };
    return { label };
  });

  const paramLabels = params.map(p => p.label).join(', ');
  const returnType = typeToString(func.returnType);
  const label = `${name}(${paramLabels}): ${returnType}`;

  let documentation: string | undefined;
  if (docComment !== undefined) {
    const docParts: string[] = [];
    if (docComment.description !== undefined) docParts.push(docComment.description);
    if (docComment.deprecated !== undefined) docParts.push(`\n\n**@deprecated** ${docComment.deprecated}`);
    if (docParts.length > 0) documentation = docParts.join('');
  }

  if (documentation === undefined && func.description !== undefined) documentation = func.description;

  if (documentation !== undefined)
    return {
      label,
      'parameters': params,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': documentation,
      },
    };

  return {
    label,
    'parameters': params,
  };
};

/**
 * Counts unmatched commas in a string (respecting parentheses nesting) to determine active parameter.
 * @param text - The text between the opening paren and the cursor.
 * @returns The number of argument-separating commas.
 */
export const countCommas = (text: string): number => {
  let count = 0;
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (const char of text) {
    if (inString) {
      if (char === stringChar) inString = false;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') depth++;
    else if (char === ')' || char === ']' || char === '}') depth--;
    else if (char === ',' && depth === 0) count++;
  }

  return count;
};

/**
 * Finds the function call context at the cursor position for signature help.
 * @param content - The full document text.
 */
export const findFunctionCall = (
  content: string,
  line: number,
  character: number,
): { name: string; argStart: number } | undefined => {
  const lines = content.split('\n');
  const lineContent = lines[line];
  if (lineContent === undefined) return undefined;

  const beforeCursor = lineContent.slice(0, character);

  let parenDepth = 0;
  let argStart = -1;

  for (let i = beforeCursor.length - 1; i >= 0; i--) {
    const char = beforeCursor[i];
    if (char === ')') parenDepth++;
    else if (char === '(') {
      if (parenDepth === 0) {
        argStart = i + 1;
        break;
      }
      parenDepth--;
    }
  }

  if (argStart === -1) return undefined;

  const beforeParen = beforeCursor.slice(0, argStart - 1);
  const nameMatch = beforeParen.match(/(\w+)\s*$/);
  const name = nameMatch?.[1];
  if (name === undefined) return undefined;

  return { name, argStart };
};

const findSymbol = (
  documentManager: DocumentManager,
  document: ParsedDocument,
  name: string,
  position: Position,
): Symbol | undefined => {
  const local = getVisibleLocals(document, position).get(name);
  const builtin = documentManager.globalEnv.env.globalScope.symbols.get(name);
  const checked = document.typeCheckResult?.environment.globalScope.symbols.get(name);

  return local ?? builtin ?? (checked?.kind === 'Global' ? checked : undefined);
};

/** Registers the signature help handler with the LSP connection. */
export const setupSignatureHelpHandler = (connection: Connection, documentManager: DocumentManager): void =>
  void connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined) return null;

    const call = findFunctionCall(document.content, params.position.line, params.position.character);
    if (call === undefined) return null;

    const symbol = findSymbol(documentManager, document, call.name, params.position);
    if (symbol === undefined || symbol.type.kind !== 'Function') return null;

    const signature = createSignatureInfo(call.name, symbol.type, symbol.docComment);

    const lines = document.content.split('\n');
    const lineContent = lines[params.position.line];
    if (lineContent === undefined) return null;

    const argsText = lineContent.slice(call.argStart, params.position.character);
    const activeParameter = countCommas(argsText);

    return {
      'signatures': [signature],
      'activeSignature': 0,
      activeParameter,
    };
  });
