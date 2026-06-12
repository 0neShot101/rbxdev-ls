import {
  type ClassType,
  type FunctionType,
  type LuauType,
  resolveType,
  type TableType,
  typesEqual,
} from '@typings/types';

export type TypeCheckMode = 'nocheck' | 'nonstrict' | 'strict';

export interface SubtypeContext {
  readonly mode: TypeCheckMode;
  readonly variance: 'covariant' | 'contravariant' | 'invariant';
}

const defaultContext: SubtypeContext = {
  'mode': 'strict',
  'variance': 'covariant',
};

/** Determines whether a type is a subtype of another type according to Luau's type system rules. */
export const isSubtype = (sub: LuauType, sup: LuauType, ctx: SubtypeContext = defaultContext): boolean => {
  const subResolved = resolveType(sub);
  const supResolved = resolveType(sup);

  if (typesEqual(subResolved, supResolved)) return true;

  if (subResolved.kind === 'TypeReference' && supResolved.kind === 'Table') return true;
  if (subResolved.kind === 'Table' && supResolved.kind === 'TypeReference') return true;
  if (subResolved.kind === 'TypeReference' && supResolved.kind === 'TypeReference')
    if (subResolved.name === supResolved.name) return true;

  if (ctx.mode !== 'strict') if (subResolved.kind === 'Any' || supResolved.kind === 'Any') return true;

  if (supResolved.kind === 'Any') return true;
  if (supResolved.kind === 'Unknown') return true;
  if (subResolved.kind === 'Never') return true;
  if (subResolved.kind === 'Any') return true;
  if (subResolved.kind === 'Error') return true;

  if (subResolved.kind === 'Primitive' && subResolved.name === 'nil') {
    if (supResolved.kind === 'Optional') return true;
    if (supResolved.kind === 'Union') return supResolved.types.some(t => t.kind === 'Primitive' && t.name === 'nil');
  }

  if (subResolved.kind === 'Optional') {
    if (supResolved.kind === 'Optional') return isSubtype(subResolved.type, supResolved.type, ctx);
    if (supResolved.kind === 'Union') {
      const hasNil = supResolved.types.some(t => t.kind === 'Primitive' && t.name === 'nil');
      if (hasNil) {
        const nonNilTypes = supResolved.types.filter(t => t.kind !== 'Primitive' || t.name !== 'nil');
        if (nonNilTypes.length === 1) return isSubtype(subResolved.type, nonNilTypes[0]!, ctx);
        return isSubtype(subResolved.type, { 'kind': 'Union', 'types': nonNilTypes }, ctx);
      }
    }
  }

  if (subResolved.kind === 'Union') return subResolved.types.every(t => isSubtype(t, supResolved, ctx));

  if (supResolved.kind === 'Union') return supResolved.types.some(t => isSubtype(subResolved, t, ctx));

  if (supResolved.kind === 'Intersection') return supResolved.types.every(t => isSubtype(subResolved, t, ctx));

  if (subResolved.kind === 'Intersection') return subResolved.types.some(t => isSubtype(t, supResolved, ctx));

  if (subResolved.kind === 'Literal') {
    if (supResolved.kind === 'Primitive') return subResolved.baseType === supResolved.name;
    if (supResolved.kind === 'Literal') return subResolved.value === supResolved.value;
  }

  if (subResolved.kind === 'Function' && supResolved.kind === 'Function')
    return isFunctionSubtype(subResolved, supResolved, ctx);

  if (subResolved.kind === 'Table' && supResolved.kind === 'Table')
    return isTableSubtype(subResolved, supResolved, ctx);

  if (subResolved.kind === 'Class' && supResolved.kind === 'Class') return isClassSubtype(subResolved, supResolved);

  if (ctx.mode !== 'strict' && subResolved.kind === 'Table' && supResolved.kind === 'Class')
    return isTableSubtypeOfClass(subResolved, supResolved, ctx);

  if (subResolved.kind === 'Variadic' && supResolved.kind === 'Variadic')
    return isSubtype(subResolved.type, supResolved.type, ctx);

  if (subResolved.kind === 'Generic' && supResolved.kind === 'Generic') {
    if (isSubtype(subResolved.base, supResolved.base, ctx) === false) return false;
    if (subResolved.typeArgs.length !== supResolved.typeArgs.length) return false;
    return subResolved.typeArgs.every((arg, i) => typesEqual(arg, supResolved.typeArgs[i]!));
  }

  return false;
};

const isFunctionSubtype = (sub: FunctionType, sup: FunctionType, ctx: SubtypeContext): boolean => {
  if (isSubtype(sub.returnType, sup.returnType, ctx) === false) return false;

  if (sup.isVariadic === false && sub.params.length > sup.params.length) return false;

  const contravariantCtx: SubtypeContext = { ...ctx, 'variance': 'contravariant' };

  for (let i = 0; i < sup.params.length; i++) {
    const subParam = sub.params[i];
    const supParam = sup.params[i]!;

    if (subParam === undefined) {
      if (supParam.optional === false && sub.isVariadic === false) return false;
      continue;
    }

    if (isSubtype(supParam.type, subParam.type, contravariantCtx) === false) return false;
  }

  if (sup.thisType !== undefined) {
    if (sub.thisType === undefined) return false;
    if (isSubtype(sup.thisType, sub.thisType, contravariantCtx) === false) return false;
  }

  return true;
};

const isTableSubtype = (sub: TableType, sup: TableType, ctx: SubtypeContext): boolean => {
  for (const [key, supProp] of sup.properties) {
    const subProp = sub.properties.get(key);

    if (subProp === undefined) {
      if (supProp.optional === false) return false;
      continue;
    }

    if (isSubtype(subProp.type, supProp.type, ctx) === false) return false;
  }

  if (sup.indexer !== undefined)
    if (sub.indexer === undefined)
      for (const [key, subProp] of sub.properties) {
        if (sup.properties.has(key)) continue;
        if (isSubtype(subProp.type, sup.indexer.valueType, ctx) === false) return false;
      }
    else {
      if (isSubtype(sub.indexer.keyType, sup.indexer.keyType, ctx) === false) return false;
      if (isSubtype(sub.indexer.valueType, sup.indexer.valueType, ctx) === false) return false;
    }

  return true;
};

const isClassSubtype = (sub: ClassType, sup: ClassType): boolean => {
  if (sub.name === sup.name) return true;

  let current: ClassType | undefined = sub.superclass;
  while (current !== undefined) {
    if (current.name === sup.name) return true;
    current = current.superclass;
  }

  return false;
};

const isTableSubtypeOfClass = (sub: TableType, sup: ClassType, ctx: SubtypeContext): boolean => {
  for (const [key, classProp] of sup.properties) {
    const tableProp = sub.properties.get(key);
    if (tableProp === undefined) return false;
    if (isSubtype(tableProp.type, classProp.type, ctx) === false) return false;
  }

  for (const [key, method] of sup.methods) {
    const tableProp = sub.properties.get(key);
    if (tableProp === undefined) return false;
    if (tableProp.type.kind !== 'Function') return false;
    if (isFunctionSubtype(tableProp.type, method.func, ctx) === false) return false;
  }

  return true;
};

/** Determines whether a source type can be assigned to a target type, including implicit coercions. */
export const isAssignable = (source: LuauType, target: LuauType, ctx: SubtypeContext = defaultContext): boolean => {
  if (isSubtype(source, target, ctx)) return true;

  if (ctx.mode === 'nonstrict') {
    const sourceResolved = resolveType(source);
    const targetResolved = resolveType(target);

    if (sourceResolved.kind === 'Primitive' && sourceResolved.name === 'number')
      if (targetResolved.kind === 'Primitive' && targetResolved.name === 'string') return true;

    const isSourceNumber =
      (sourceResolved.kind === 'Primitive' && sourceResolved.name === 'number') ||
      (sourceResolved.kind === 'Literal' && sourceResolved.baseType === 'number');
    const isTargetEnum =
      targetResolved.kind === 'Enum' ||
      (targetResolved.kind === 'TypeReference' && targetResolved.name.startsWith('Enum.'));

    if (isSourceNumber && isTargetEnum) return true;
  }

  return false;
};

/** Finds the common supertype of two types, used for type inference in conditional expressions. */
export const commonType = (a: LuauType, b: LuauType, ctx: SubtypeContext = defaultContext): LuauType => {
  if (isSubtype(a, b, ctx)) return b;
  if (isSubtype(b, a, ctx)) return a;

  return { 'kind': 'Union', 'types': [a, b] };
};

/** Narrows a type based on a type guard, filtering union members to only those matching the guard. */
export const narrowType = (type: LuauType, guard: LuauType): LuauType => {
  const resolved = resolveType(type);

  if (resolved.kind === 'Union') {
    const narrowed = resolved.types.filter(t => isSubtype(t, guard, defaultContext));
    if (narrowed.length === 0) return { 'kind': 'Never' };
    if (narrowed.length === 1) return narrowed[0]!;
    if (narrowed.length === resolved.types.length) return resolved;
    return { 'kind': 'Union', 'types': narrowed };
  }

  if (isSubtype(resolved, guard, defaultContext)) return resolved;

  return { 'kind': 'Never' };
};

/** Removes a type from a union type, typically used for nil narrowing after truthiness checks. */
export const excludeType = (type: LuauType, excluded: LuauType): LuauType => {
  const resolved = resolveType(type);

  if (resolved.kind === 'Union') {
    const remaining = resolved.types.filter(t => isSubtype(t, excluded, defaultContext) === false);
    if (remaining.length === 0) return { 'kind': 'Never' };
    if (remaining.length === 1) return remaining[0]!;
    if (remaining.length === resolved.types.length) return resolved;
    return { 'kind': 'Union', 'types': remaining };
  }

  if (isSubtype(resolved, excluded, defaultContext)) return { 'kind': 'Never' };

  return resolved;
};
