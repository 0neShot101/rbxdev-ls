import { SymbolKind } from 'vscode-languageserver';

import type { Chunk, Statement, TypeAnnotation } from '@typings/ast';
import type { TypeAliasInfo } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type {
  Connection,
  Range,
  TypeHierarchyItem,
  TypeHierarchyPrepareParams,
  TypeHierarchySubtypesParams,
  TypeHierarchySupertypesParams,
} from 'vscode-languageserver';

const convertRange = (range: {
  start: { line: number; column: number };
  end: { line: number; column: number };
}): Range => ({
  'start': { 'line': range.start.line - 1, 'character': range.start.column - 1 },
  'end': { 'line': range.end.line - 1, 'character': range.end.column - 1 },
});

const positionInRange = (line: number, character: number, range: Range): boolean => {
  if (line < range.start.line || line > range.end.line) return false;
  if (line === range.start.line && character < range.start.character) return false;
  if (line === range.end.line && character > range.end.character) return false;
  return true;
};

export const collectTypeAliases = (chunk: Chunk): TypeAliasInfo[] => {
  const aliases: TypeAliasInfo[] = [];

  const walkStatements = (stmts: ReadonlyArray<Statement>): void => {
    for (const stmt of stmts) {
      switch (stmt.kind) {
        case 'TypeAlias':
          aliases.push({
            'name': stmt.name.name,
            'range': convertRange(stmt.range),
            'selectionRange': convertRange(stmt.name.range),
            'type': stmt.type,
          });
          break;

        case 'ExportStatement':
          if (stmt.declaration.kind === 'TypeAlias') {
            aliases.push({
              'name': stmt.declaration.name.name,
              'range': convertRange(stmt.range),
              'selectionRange': convertRange(stmt.declaration.name.range),
              'type': stmt.declaration.type,
            });
          }
          break;

        case 'IfStatement':
          walkStatements(stmt.thenBody);
          for (const clause of stmt.elseifClauses) walkStatements(clause.body);
          if (stmt.elseBody !== undefined) walkStatements(stmt.elseBody);
          break;

        case 'WhileStatement':
        case 'RepeatStatement':
        case 'DoStatement':
          walkStatements(stmt.body);
          break;

        case 'ForNumeric':
        case 'ForGeneric':
          walkStatements(stmt.body);
          break;
      }
    }
  };

  walkStatements(chunk.body);
  return aliases;
};

export const extractSupertypeNames = (type: TypeAnnotation): string[] => {
  const names: string[] = [];

  const collect = (t: TypeAnnotation): void => {
    switch (t.kind) {
      case 'TypeReference':
        names.push(t.name);
        break;

      case 'IntersectionType':
      case 'UnionType':
        for (const member of t.types) collect(member);
        break;

      case 'OptionalType':
      case 'VariadicType':
      case 'ParenthesizedType':
        collect(t.type);
        break;
    }
  };

  collect(type);
  return names;
};

const aliasToItem = (alias: TypeAliasInfo, uri: string): TypeHierarchyItem => ({
  'name': alias.name,
  'kind': SymbolKind.TypeParameter,
  uri,
  'range': alias.range,
  'selectionRange': alias.selectionRange,
  'data': { 'name': alias.name, uri },
});

/** Provides type hierarchy navigation for type alias relationships. */
export const setupTypeHierarchyHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.languages.typeHierarchy.onPrepare((params: TypeHierarchyPrepareParams): TypeHierarchyItem[] | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return null;

    const aliases = collectTypeAliases(document.ast);
    const { line, character } = params.position;

    for (const alias of aliases) {
      if (positionInRange(line, character, alias.range)) {
        return [aliasToItem(alias, params.textDocument.uri)];
      }
    }

    return null;
  });

  connection.languages.typeHierarchy.onSupertypes((params: TypeHierarchySupertypesParams): TypeHierarchyItem[] => {
    const data = params.item.data as { name: string; uri: string } | undefined;
    if (data === undefined) return [];

    const document = documentManager.getDocument(data.uri);
    if (document === undefined || document.ast === undefined) return [];

    const aliases = collectTypeAliases(document.ast);
    const target = aliases.find(a => a.name === data.name);
    if (target === undefined) return [];

    const supertypeNames = extractSupertypeNames(target.type);
    const results: TypeHierarchyItem[] = [];

    for (const name of supertypeNames) {
      const superAlias = aliases.find(a => a.name === name);
      if (superAlias !== undefined) results.push(aliasToItem(superAlias, data.uri));
    }

    return results;
  });

  connection.languages.typeHierarchy.onSubtypes((params: TypeHierarchySubtypesParams): TypeHierarchyItem[] => {
    const data = params.item.data as { name: string; uri: string } | undefined;
    if (data === undefined) return [];

    const document = documentManager.getDocument(data.uri);
    if (document === undefined || document.ast === undefined) return [];

    const aliases = collectTypeAliases(document.ast);
    const targetName = data.name;

    const results: TypeHierarchyItem[] = [];
    for (const alias of aliases) {
      if (alias.name === targetName) continue;
      const supers = extractSupertypeNames(alias.type);
      if (supers.includes(targetName)) results.push(aliasToItem(alias, data.uri));
    }

    return results;
  });
};
