import type { LocalBinding, Scope, Symbol } from '@typings/environment';
import type { ParsedDocument } from '@typings/lsp';
import type { Position } from 'vscode-languageserver';

/** Returns local bindings visible at an editor position, respecting scope and declaration order. */
export const getVisibleLocals = (document: ParsedDocument, position: Position): ReadonlyMap<string, Symbol> => {
  const environment = document.typeCheckResult?.environment;
  const symbols = new Map<string, Symbol>();

  if (environment === undefined) return symbols;

  if (environment.localBindings === undefined) {
    let scope: Scope | undefined = environment.currentScope;

    while (scope !== undefined) {
      for (const [name, symbol] of scope.symbols)
        if (symbol.kind !== 'Global' && symbols.has(name) === false) symbols.set(name, symbol);

      scope = scope.parent;
    }

    return symbols;
  }

  const lines = document.content.split('\n');
  let offset = position.character;

  for (let line = 0; line < position.line; line++) offset += (lines[line]?.length ?? 0) + 1;

  const selected = new Map<string, LocalBinding>();
  const depths = new Map<string, number>();

  for (const binding of environment.localBindings) {
    const declaration = binding.declaration;
    const namesDeclaration = declaration.start.offset <= offset && offset < declaration.end.offset;

    if (binding.visibleFrom.offset > offset && namesDeclaration === false) continue;

    let scope: Scope | undefined = binding.scope;
    let depth = 0;
    let visible = true;

    while (scope !== undefined) {
      const range = scope.range;

      if (
        range !== undefined &&
        (offset < range.start.offset ||
          offset > range.end.offset ||
          (offset === range.end.offset && offset !== document.content.length))
      ) {
        visible = false;
        break;
      }

      depth++;
      scope = scope.parent;
    }

    if (visible === false) continue;

    const name = binding.symbol.name;
    const previous = selected.get(name);
    const previousDepth = depths.get(name) ?? -1;

    if (previousDepth > depth) continue;
    if (previous !== undefined && previousDepth === depth && previous.visibleFrom.offset > binding.visibleFrom.offset)
      continue;

    selected.set(name, binding);
    depths.set(name, depth);
  }

  for (const [name, binding] of selected) symbols.set(name, binding.symbol);

  return symbols;
};
