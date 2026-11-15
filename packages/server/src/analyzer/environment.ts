import type { NodeRange } from '@typings/ast';
import type { DocComment } from '@typings/parser';
import type { TypeCheckMode } from '@typings/subtyping';
import type { ClassType, EnumType, LuauType } from '@typings/types';
import type {
  BindingSite,
  Symbol,
  SymbolKind,
  SymbolLocation,
  Scope,
  ScopeKind,
  TypeEnvironment,
} from '@typings/environment';

let scopeIdCounter = 0;

/** Creates a new lexical scope, optionally recording the source range it covers. */
export const createScope = (parent: Scope | undefined, kind: ScopeKind = 'Block', range?: NodeRange): Scope => ({
  'id': scopeIdCounter++,
  parent,
  'symbols': new Map(),
  'types': new Map(),
  kind,
  range,
});

/** Resets the scope ID counter (primarily for testing). */
export const resetScopeCounter = (): void => void (scopeIdCounter = 0);

/** Creates a new type environment for type checking. */
export const createTypeEnvironment = (mode: TypeCheckMode = 'strict'): TypeEnvironment => {
  const globalScope = createScope(undefined, 'Global');
  return {
    mode,
    globalScope,
    'currentScope': globalScope,
    'classes': new Map(),
    'enums': new Map(),
    'localBindings': [],
  };
};

/** Defines a symbol in the current scope, retaining its lexical binding site when one is supplied. */
export const defineSymbol = (
  env: TypeEnvironment,
  name: string,
  type: LuauType,
  kind: SymbolKind,
  mutable = true,
  docComment?: DocComment,
  site?: BindingSite,
): void => {
  const symbol: Symbol = {
    name,
    type,
    kind,
    mutable,
    'declarationLocation': undefined,
    docComment,
  };

  env.currentScope.symbols.set(name, symbol);

  if (site !== undefined) env.localBindings?.push({ ...site, symbol, 'scope': site.scope ?? env.currentScope });
};

/** Defines a symbol in the current scope with a source location. */
export const defineSymbolWithLocation = (
  env: TypeEnvironment,
  name: string,
  type: LuauType,
  kind: SymbolKind,
  location: SymbolLocation,
  mutable = true,
  docComment?: DocComment,
): void =>
  void env.currentScope.symbols.set(name, {
    name,
    type,
    kind,
    mutable,
    'declarationLocation': location,
    docComment,
  });

/** Looks up a symbol by name, searching through parent scopes. */
export const lookupSymbol = (env: TypeEnvironment, name: string): Symbol | undefined => {
  let scope: Scope | undefined = env.currentScope;

  while (scope !== undefined) {
    const symbol = scope.symbols.get(name);
    if (symbol !== undefined) return symbol;
    scope = scope.parent;
  }

  return undefined;
};

/** Looks up a symbol in a specific scope only (does not search parent scopes). */
export const lookupSymbolInScope = (scope: Scope, name: string): Symbol | undefined => scope.symbols.get(name);

/** Defines a type alias in the current scope. */
export const defineTypeAlias = (env: TypeEnvironment, name: string, type: LuauType): void =>
  void env.currentScope.types.set(name, type);

/** Looks up a type alias by name, searching through parent scopes. */
export const lookupTypeAlias = (env: TypeEnvironment, name: string): LuauType | undefined => {
  let scope: Scope | undefined = env.currentScope;

  while (scope !== undefined) {
    const type = scope.types.get(name);
    if (type !== undefined) return type;
    scope = scope.parent;
  }

  return undefined;
};

/** Registers a class type in the environment. */
export const defineClass = (env: TypeEnvironment, classType: ClassType): void =>
  void env.classes.set(classType.name, classType);

/** Looks up a class type by name. */
export const lookupClass = (env: TypeEnvironment, name: string): ClassType | undefined => env.classes.get(name);

/** Registers an enum type in the environment. */
export const defineEnum = (env: TypeEnvironment, enumType: EnumType): void =>
  void env.enums.set(enumType.name, enumType);

/** Looks up an enum type by name. */
export const lookupEnum = (env: TypeEnvironment, name: string): EnumType | undefined => env.enums.get(name);

/** Enters a new scope, making it the current scope. */
export const enterScope = (env: TypeEnvironment, kind: ScopeKind = 'Block', range?: NodeRange): Scope => {
  const newScope = createScope(env.currentScope, kind, range);
  env.currentScope = newScope;
  return newScope;
};

/** Exits the current scope, returning to the parent scope. */
export const exitScope = (env: TypeEnvironment): Scope => {
  if (env.currentScope.parent === undefined) throw new Error('Cannot exit global scope');
  const oldScope = env.currentScope;
  env.currentScope = env.currentScope.parent;
  return oldScope;
};

/** Checks if the current scope is within a function. */
export const isInFunctionScope = (env: TypeEnvironment): boolean => {
  let scope: Scope | undefined = env.currentScope;
  while (scope !== undefined) {
    if (scope.kind === 'Function') return true;
    scope = scope.parent;
  }
  return false;
};

/** Checks if the current scope is within a loop (stops at function boundaries). */
export const isInLoopScope = (env: TypeEnvironment): boolean => {
  let scope: Scope | undefined = env.currentScope;
  while (scope !== undefined) {
    if (scope.kind === 'Loop') return true;
    if (scope.kind === 'Function') return false;
    scope = scope.parent;
  }
  return false;
};
