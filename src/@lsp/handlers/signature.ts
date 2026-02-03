/**
 * Signature Help Handler
 * Provides function signature information while typing
 */

import { typeToString } from '@typings/types';
import { MarkupKind } from 'vscode-languageserver';

import type { DocumentManager } from '../documents';
import type { DocComment } from '@parser/docComment';
import type { Symbol, Scope } from '@typings/environment';
import type { FunctionType } from '@typings/types';
import type {
  Connection,
  SignatureHelp,
  SignatureHelpParams,
  SignatureInformation,
  ParameterInformation,
} from 'vscode-languageserver';

/**
 * Creates a signature information object for a function that will be displayed
 * in the signature help popup when the user types function arguments.
 * @param name - The name of the function
 * @param func - The function type containing parameter and return type information
 * @param docComment - Optional documentation comment associated with the function
 * @returns A SignatureInformation object containing the function's label, parameters, and documentation
 */
const createSignatureInfo = (
  name: string,
  func: FunctionType,
  docComment: DocComment | undefined,
): SignatureInformation => {
  const params: ParameterInformation[] = func.params.map(p => {
    const paramName = p.name ?? 'arg';
    const optional = p.optional ? '?' : '';
    const label = `${paramName}${optional}: ${typeToString(p.type)}`;

    // Find doc comment for this parameter
    let documentation: string | undefined;
    if (docComment !== undefined) {
      const docParam = docComment.params.find(dp => dp.name === paramName);
      if (docParam !== undefined && docParam.description !== undefined) {
        documentation = docParam.description;
      }
    }

    if (documentation !== undefined) {
      return {
        label,
        'documentation': {
          'kind': MarkupKind.Markdown,
          'value': documentation,
        },
      };
    }
    return { label };
  });

  const paramLabels = params.map(p => p.label).join(', ');
  const returnType = typeToString(func.returnType);
  const label = `${name}(${paramLabels}): ${returnType}`;

  // Build documentation from doc comment
  let documentation: string | undefined;
  if (docComment !== undefined) {
    const docParts: string[] = [];
    if (docComment.description !== undefined) {
      docParts.push(docComment.description);
    }
    if (docComment.deprecated !== undefined) {
      docParts.push(`\n\n**@deprecated** ${docComment.deprecated}`);
    }
    if (docParts.length > 0) {
      documentation = docParts.join('');
    }
  } else if (func.description !== undefined) {
    documentation = func.description;
  }

  if (documentation !== undefined) {
    return {
      label,
      'parameters': params,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': documentation,
      },
    };
  }

  return {
    label,
    'parameters': params,
  };
};

/**
 * Counts the number of commas in a string while respecting nesting depth
 * and string literals. Used to determine the active parameter index in
 * a function call.
 * @param text - The text to count commas in, typically the arguments portion of a function call
 * @returns The number of top-level commas found (commas inside nested structures are ignored)
 */
const countCommas = (text: string): number => {
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

    if (char === '(' || char === '[' || char === '{') {
      depth++;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
    } else if (char === ',' && depth === 0) {
      count++;
    }
  }

  return count;
};

/**
 * Locates a function call at the specified cursor position by searching
 * backwards for an opening parenthesis and extracting the function name.
 * @param content - The full document content as a string
 * @param line - The zero-indexed line number of the cursor position
 * @param character - The zero-indexed character position within the line
 * @returns An object containing the function name and argument start position, or undefined if no function call found
 */
const findFunctionCall = (
  content: string,
  line: number,
  character: number,
): { name: string; argStart: number } | undefined => {
  const lines = content.split('\n');
  const lineContent = lines[line];
  if (lineContent === undefined) return undefined;

  const beforeCursor = lineContent.slice(0, character);

  // Find opening paren
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

  // Find function name before the paren
  const beforeParen = beforeCursor.slice(0, argStart - 1);
  const nameMatch = beforeParen.match(/(\w+)\s*$/);
  if (nameMatch === null) return undefined;

  return { 'name': nameMatch[1]!, argStart };
};

/**
 * Searches for a symbol by name in both global and local scopes.
 * First checks the global environment, then traverses the local scope
 * chain from the type check result.
 * @param documentManager - The document manager containing the global environment
 * @param document - The parsed document containing the type check result with local scopes
 * @param name - The name of the symbol to find
 * @returns The found Symbol object, or undefined if the symbol does not exist
 */
const findSymbol = (
  documentManager: DocumentManager,
  document: import('../documents').ParsedDocument,
  name: string,
): Symbol | undefined => {
  // Check global symbols first
  const globalSymbol = documentManager.globalEnv.env.globalScope.symbols.get(name);
  if (globalSymbol !== undefined) return globalSymbol;

  // Check local symbols in type check result
  if (document.typeCheckResult !== undefined) {
    let scope: Scope | undefined = document.typeCheckResult.environment.currentScope;
    while (scope !== undefined) {
      const localSymbol = scope.symbols.get(name);
      if (localSymbol !== undefined) return localSymbol;
      scope = scope.parent;
    }

    // Also check global scope from type check result
    const tcGlobalSymbol = document.typeCheckResult.environment.globalScope.symbols.get(name);
    if (tcGlobalSymbol !== undefined) return tcGlobalSymbol;
  }

  return undefined;
};

/**
 * Registers the signature help handler with the LSP connection.
 * This handler provides function signature information when the user
 * types within function call parentheses, showing parameter names,
 * types, and documentation.
 * @param connection - The LSP connection to register the handler on
 * @param documentManager - The document manager for accessing parsed documents and global environment
 * @returns void
 */
export const setupSignatureHelpHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined) return null;

    const call = findFunctionCall(document.content, params.position.line, params.position.character);
    if (call === undefined) return null;

    // Find the function
    const symbol = findSymbol(documentManager, document, call.name);
    if (symbol === undefined || symbol.type.kind !== 'Function') return null;

    const signature = createSignatureInfo(call.name, symbol.type, symbol.docComment);

    // Calculate active parameter
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
};
