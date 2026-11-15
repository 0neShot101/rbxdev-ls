import { CompletionItemKind, MarkupKind } from 'vscode-languageserver';

import { formatDocCommentForDisplay } from '@parser/docComment';

import type { DocComment } from '@typings/parser';
import type { FunctionType, LuauType } from '@typings/types';

/** Maps a Luau type to the completion item kind used to display it. */
export const typeToCompletionKind = (type: LuauType): CompletionItemKind => {
  switch (type.kind) {
    case 'Function':
      return CompletionItemKind.Function;
    case 'Class':
      return CompletionItemKind.Class;
    case 'Enum':
      return CompletionItemKind.Enum;
    case 'Table':
      return CompletionItemKind.Module;
    default:
      return CompletionItemKind.Variable;
  }
};

/** Renders a function signature for a completion item's detail line. */
export const formatFunctionDetail = (func: FunctionType): string => {
  const params = func.params.map(p => {
    const name = p.name ?? 'arg';
    const optional = p.optional ? '?' : '';
    return `${name}${optional}`;
  });
  return `(${params.join(', ')})`;
};

const escapeSnippet = (text: string): string => text.replace(/[$}\\]/g, '\\$&');

/** Builds a call snippet with tab stops for a function's parameters. */
export const formatFunctionSnippet = (name: string, func: FunctionType): string => {
  if (func.params.length === 0) return `${name}()$0`;

  let tabIndex = 1;
  let hasCallback = false;
  const paramSnippets: string[] = [];

  for (const p of func.params)
    if (p.type.kind === 'Function' && hasCallback === false) {
      hasCallback = true;
      const innerFunc = p.type;
      if (innerFunc.params.length === 0) paramSnippets.push(`function()\n\t$0\nend`);
      else {
        const innerParams = innerFunc.params.map(ip => {
          const pName = escapeSnippet(ip.name ?? 'arg');
          return `\${${tabIndex++}:${pName}}`;
        });
        paramSnippets.push(`function(${innerParams.join(', ')})\n\t$0\nend`);
      }
    } else {
      const paramName = escapeSnippet(p.name ?? 'arg');
      paramSnippets.push(`\${${tabIndex++}:${paramName}}`);
    }

  return `${name}(${paramSnippets.join(', ')})`;
};

/** Renders a doc comment as markdown completion documentation. */
export const formatDocumentation = (
  docComment: DocComment | undefined,
): { kind: 'markdown'; value: string } | undefined => {
  if (docComment === undefined) return undefined;

  const formatted = formatDocCommentForDisplay(docComment);
  if (formatted.length === 0) return undefined;

  return {
    'kind': MarkupKind.Markdown,
    'value': formatted,
  };
};
