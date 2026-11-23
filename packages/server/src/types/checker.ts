import type { CallExpression, NodeRange } from '@typings/ast';
import type { GlobalEnvironment } from '@typings/definitions';
import type { ClassType, LuauType } from '@typings/types';
import type { Scope, Symbol, TypeEnvironment } from '@typings/environment';
import type { IgnoreState } from '@typings/ignoreDirectives';
import type { TypeCheckMode } from '@typings/subtyping';

/** Tag indicating special diagnostic semantics for IDE rendering. */
export type DiagnosticTag = 'deprecated' | 'unnecessary';

/** Represents a type-related diagnostic message produced by the type checker. */
export interface TypeDiagnostic {
  readonly message: string;
  readonly range: NodeRange;
  readonly severity: 'error' | 'warning' | 'info' | 'hint';
  readonly code: string;
  readonly tags?: ReadonlyArray<DiagnosticTag>;
}

/** The result of type checking a Luau program. */
export interface TypeCheckResult {
  readonly diagnostics: ReadonlyArray<TypeDiagnostic>;
  readonly environment: TypeEnvironment;
  readonly allSymbols: ReadonlyMap<string, LuauType>;
  readonly exportedTypes: ReadonlyMap<string, LuauType> | undefined;
}

/** A type narrowing applied to a variable within a guarded branch. */
export interface TypeNarrowing {
  readonly symbol: Symbol;
  readonly narrowedType: LuauType;
}

/** Runtime type and separate type namespace of a required module. */
export interface RequiredModule {
  readonly valueType: LuauType;
  readonly getExportedTypes: () => ReadonlyMap<string, LuauType> | undefined;
}

/** Resolves a file or DataModel path used by a require call. */
export type RequireResolver = (path: string | ReadonlyArray<string>) => RequiredModule | undefined;

/** Mutable state threaded through a single type-checking pass. */
export interface CheckerState {
  readonly env: TypeEnvironment;
  /** Named Roblox datatype instance types used to resolve member access on datatype references. */
  readonly dataTypes: ReadonlyMap<string, LuauType>;
  readonly diagnostics: TypeDiagnostic[];
  readonly ignoreState: IgnoreState;
  returnType: LuauType | undefined;
  isVariadic: boolean;
  narrowings: WeakMap<Scope, Map<Symbol, LuauType>> | undefined;
  readonly allSymbols: Map<string, LuauType>;
  readonly requireResolver: RequireResolver | undefined;
  modules: WeakMap<CallExpression | Symbol, RequiredModule> | undefined;
  exportedTypes: Map<string, LuauType> | undefined;
}

/** Options controlling how a type-checking pass constructs its state. */
export interface CheckerOptions {
  readonly mode?: TypeCheckMode;
  /** Canonical global catalogue copied into the pass; defaults to the disk-free standalone environment. */
  readonly globals?: GlobalEnvironment;
  readonly classes?: Map<string, ClassType>;
  readonly dataTypes?: Map<string, LuauType>;
  readonly ignoreState?: IgnoreState;
  readonly requireResolver?: RequireResolver;
}
