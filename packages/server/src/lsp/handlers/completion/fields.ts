import { CompletionItemKind } from 'vscode-languageserver';

import { typeToString } from '@analyzer/values';

import type { TableContextInfo } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type { TableType } from '@typings/types';
import type { CompletionItem } from 'vscode-languageserver';

const getTableFieldCompletions = (
  expectedType: TableType,
  existingFields: Set<string>,
  prefix: string,
): CompletionItem[] => {
  const items: CompletionItem[] = [];

  for (const [name, prop] of expectedType.properties) {
    if (existingFields.has(name)) continue;
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const isOptional = prop.optional;
    const typeStr = typeToString(prop.type);

    const item: CompletionItem = {
      'label': name,
      'kind': CompletionItemKind.Field,
      'detail': `${typeStr}${isOptional ? ' (optional)' : ''}`,
      'insertText': `${name} = `,
      'sortText': isOptional ? `1_${name}` : `0_${name}`,
    };

    items.push(item);
  }

  return items;
};

const detectTableFieldContext = (beforeCursor: string): TableContextInfo | undefined => {
  let braceDepth = 0;
  let tableStartPos = -1;

  for (let i = beforeCursor.length - 1; i >= 0; i--) {
    const char = beforeCursor[i];
    if (char === '}') braceDepth++;
    else if (char === '{') {
      if (braceDepth === 0) {
        tableStartPos = i;
        break;
      }
      braceDepth--;
    }
  }

  if (tableStartPos === -1) return undefined;

  const beforeTable = beforeCursor.slice(0, tableStartPos).trimEnd();

  const funcCallMatch = beforeTable.match(/([a-zA-Z_]\w*(?:\s*[.:]\s*[a-zA-Z_]\w*)*)\s*\(\s*$/);
  if (funcCallMatch === null) return undefined;

  const functionExpression = funcCallMatch[1];
  if (functionExpression === undefined) return undefined;

  const funcNameMatch = functionExpression.match(/([a-zA-Z_]\w*)$/);
  const functionName = funcNameMatch?.[1] ?? functionExpression;

  const paramIndex = 0;

  const insideTable = beforeCursor.slice(tableStartPos + 1);
  const existingFields = parseExistingTableFields(insideTable);

  const prefixMatch = insideTable.match(/(?:,|\{)\s*([a-zA-Z_]\w*)$/);
  let prefix = prefixMatch?.[1] ?? '';

  if (prefix === '') {
    const trimmed = insideTable.trimStart();
    const startMatch = trimmed.match(/^([a-zA-Z_]\w*)$/);
    if (startMatch !== null) prefix = startMatch[1] ?? '';
  }

  return {
    functionName,
    paramIndex,
    existingFields,
    prefix,
  };
};

const parseExistingTableFields = (tableContent: string): Set<string> => {
  const fields = new Set<string>();

  const fieldPattern = /([a-zA-Z_]\w*)\s*=/g;
  let match;

  while ((match = fieldPattern.exec(tableContent)) !== null) if (match[1] !== undefined) fields.add(match[1]);

  return fields;
};

const getExpectedParameterType = (
  functionName: string,
  paramIndex: number,
  documentManager: DocumentManager,
): TableType | undefined => {
  const symbol = documentManager.globalEnv.env.globalScope.symbols.get(functionName);
  if (symbol === undefined) return undefined;
  if (symbol.type.kind !== 'Function') return undefined;

  const funcType = symbol.type;
  if (paramIndex >= funcType.params.length) return undefined;

  const param = funcType.params[paramIndex];
  if (param === undefined) return undefined;

  if (param.type.kind === 'Table') return param.type;

  return undefined;
};

/** Suggests fields of the expected table parameter type inside a table literal call argument. */
export const getTableLiteralCompletions = (
  beforeCursor: string,
  documentManager: DocumentManager,
): CompletionItem[] | undefined => {
  const tableContext = detectTableFieldContext(beforeCursor);
  if (tableContext === undefined) return undefined;

  const expectedType = getExpectedParameterType(tableContext.functionName, tableContext.paramIndex, documentManager);
  if (expectedType === undefined) return undefined;

  const tableFieldItems = getTableFieldCompletions(expectedType, tableContext.existingFields, tableContext.prefix);
  return tableFieldItems.length > 0 ? tableFieldItems : undefined;
};
