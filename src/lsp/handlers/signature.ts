import { typeToString } from '@typings/types';
import { MarkupKind } from 'vscode-languageserver';

import type { DocumentManager } from '@typings/lsp';
import type { DocComment } from '@typings/parser';
import type { Symbol, Scope } from '@typings/environment';
import type { FunctionType } from '@typings/types';
import type {
  Connection,
  SignatureHelp,
  SignatureHelpParams,
  SignatureInformation,
  ParameterInformation,
} from 'vscode-languageserver';

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
  if (nameMatch === null) return undefined;

  return { 'name': nameMatch[1]!, argStart };
};

const findSymbol = (
  documentManager: DocumentManager,
  document: import('@typings/lsp').ParsedDocument,
  name: string,
): Symbol | undefined => {
  const globalSymbol = documentManager.globalEnv.env.globalScope.symbols.get(name);
  if (globalSymbol !== undefined) return globalSymbol;

  if (document.typeCheckResult !== undefined) {
    let scope: Scope | undefined = document.typeCheckResult.environment.currentScope;
    while (scope !== undefined) {
      const localSymbol = scope.symbols.get(name);
      if (localSymbol !== undefined) return localSymbol;
      scope = scope.parent;
    }

    const tcGlobalSymbol = document.typeCheckResult.environment.globalScope.symbols.get(name);
    if (tcGlobalSymbol !== undefined) return tcGlobalSymbol;
  }

  return undefined;
};

/** Registers the signature help handler with the LSP connection. */
export const setupSignatureHelpHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined) return null;

    const call = findFunctionCall(document.content, params.position.line, params.position.character);
    if (call === undefined) return null;

    const symbol = findSymbol(documentManager, document, call.name);
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
};
