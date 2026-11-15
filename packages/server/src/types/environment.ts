import type { NodeRange } from '@typings/ast';
import type { DocComment, TokenPosition } from '@typings/parser';
import type { TypeCheckMode } from '@typings/subtyping';
import type { ClassType, EnumType, LuauType } from '@typings/types';

/** Represents a symbol in the type environment (variable, function, type alias, etc.) */
export interface Symbol {
  readonly name: string;
  readonly type: LuauType;
  readonly kind: SymbolKind;
  readonly mutable: boolean;
  readonly declarationLocation: SymbolLocation | undefined;
  readonly docComment: DocComment | undefined;
}

/** The kind of symbol in the type environment. */
export type SymbolKind =
  | 'Variable'
  | 'Function'
  | 'Parameter'
  | 'TypeAlias'
  | 'TypeParameter'
  | 'Global'
  | 'Class'
  | 'Enum';

/** Represents the source location of a symbol declaration. */
export interface SymbolLocation {
  readonly uri: string;
  readonly line: number;
  readonly column: number;
}

/** Represents a lexical scope in the type environment. */
export interface Scope {
  readonly id: number;
  readonly parent: Scope | undefined;
  readonly symbols: Map<string, Symbol>;
  readonly types: Map<string, LuauType>;
  readonly kind: ScopeKind;
  readonly range?: NodeRange | undefined;
}

/** The kind of lexical scope. */
export type ScopeKind = 'Global' | 'Module' | 'Function' | 'Block' | 'Loop' | 'Conditional';

/** Source positions at which a declaration is named and becomes visible. */
export interface BindingSite {
  readonly declaration: NodeRange;
  readonly visibleFrom: TokenPosition;
  readonly scope?: Scope;
}

/** A source-level binding retained after its lexical scope has been checked. */
export interface LocalBinding extends BindingSite {
  readonly symbol: Symbol;
  readonly scope: Scope;
}

/** The type environment containing scopes, classes, and enums for type checking. */
export interface TypeEnvironment {
  readonly mode: TypeCheckMode;
  readonly globalScope: Scope;
  currentScope: Scope;
  readonly classes: Map<string, ClassType>;
  readonly enums: Map<string, EnumType>;
  readonly localBindings?: LocalBinding[];
}
