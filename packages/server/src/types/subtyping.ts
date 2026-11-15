/** The strictness level used when checking a Luau file. */
export type TypeCheckMode = 'nocheck' | 'nonstrict' | 'strict';

/** Settings carried through a subtype check: strictness mode and current variance. */
export interface SubtypeContext {
  readonly mode: TypeCheckMode;
  readonly variance: 'covariant' | 'contravariant' | 'invariant';
}
