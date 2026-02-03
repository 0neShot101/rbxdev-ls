/**
 * Luau Type System - Subtyping and Assignability
 */

import { type ClassType, type FunctionType, type LuauType, resolveType, type TableType, typesEqual } from './types';

/**
 * Defines the strictness level for type checking operations.
 * - 'nocheck': Disables type checking entirely.
 * - 'nonstrict': Allows more permissive type coercions and implicit any.
 * - 'strict': Enforces full type safety with no implicit any.
 */
export type TypeCheckMode = 'nocheck' | 'nonstrict' | 'strict';

/**
 * Context information used during subtype checking operations.
 */
export interface SubtypeContext {
  /** The strictness mode for type checking. */
  readonly mode: TypeCheckMode;
  /** The variance direction for the current type comparison (covariant, contravariant, or invariant). */
  readonly variance: 'covariant' | 'contravariant' | 'invariant';
}

/**
 * The default subtype context used when no context is explicitly provided.
 * Uses strict mode with covariant variance.
 */
const defaultContext: SubtypeContext = {
  'mode': 'strict',
  'variance': 'covariant',
};

/**
 * Determines whether a type is a subtype of another type according to Luau's type system rules.
 * Handles primitives, unions, intersections, optionals, functions, tables, classes, generics, and variadics.
 * @param sub - The potential subtype to check.
 * @param sup - The potential supertype to check against.
 * @param ctx - The subtype context containing mode and variance information. Defaults to strict covariant.
 * @returns True if `sub` is a subtype of `sup`, meaning values of type `sub` can be assigned to variables of type `sup`.
 */
export const isSubtype = (sub: LuauType, sup: LuauType, ctx: SubtypeContext = defaultContext): boolean => {
  const subResolved = resolveType(sub);
  const supResolved = resolveType(sup);

  // Same types are always subtypes
  if (typesEqual(subResolved, supResolved)) return true;

  // TypeReference with same name should match (for Roblox DataTypes like Color3, Vector3, etc.)
  // This handles cases like: Vector2.new() returning TypeReference 'Vector2' being assigned to
  // a property that expects the Vector2 TableType structure
  if (subResolved.kind === 'TypeReference' && supResolved.kind === 'Table') {
    // A TypeReference is assignable to a matching Table type (duck typing for DataTypes)
    return true;
  }
  if (subResolved.kind === 'Table' && supResolved.kind === 'TypeReference') {
    // A Table type is assignable to a matching TypeReference
    return true;
  }
  if (subResolved.kind === 'TypeReference' && supResolved.kind === 'TypeReference') {
    // Two TypeReferences with the same name are equal
    if (subResolved.name === supResolved.name) return true;
  }

  // Any accepts and is accepted by everything in nonstrict mode
  if (ctx.mode !== 'strict') {
    if (subResolved.kind === 'Any' || supResolved.kind === 'Any') return true;
  }

  // Any is a supertype of everything
  if (supResolved.kind === 'Any') return true;

  // Unknown is a supertype of everything
  if (supResolved.kind === 'Unknown') return true;

  // Never is a subtype of everything
  if (subResolved.kind === 'Never') return true;

  // Any is a subtype of anything (unsound but practical)
  if (subResolved.kind === 'Any') return true;

  // Error types are subtypes of everything (to reduce cascading errors)
  if (subResolved.kind === 'Error') return true;

  // Handle nil as subtype of optional types
  if (subResolved.kind === 'Primitive' && subResolved.name === 'nil') {
    if (supResolved.kind === 'Optional') return true;
    if (supResolved.kind === 'Union') {
      return supResolved.types.some(t => t.kind === 'Primitive' && t.name === 'nil');
    }
  }

  // Optional<T> is subtype of T | nil
  if (subResolved.kind === 'Optional') {
    if (supResolved.kind === 'Optional') {
      return isSubtype(subResolved.type, supResolved.type, ctx);
    }
    if (supResolved.kind === 'Union') {
      const hasNil = supResolved.types.some(t => t.kind === 'Primitive' && t.name === 'nil');
      if (hasNil) {
        const nonNilTypes = supResolved.types.filter(t => t.kind !== 'Primitive' || t.name !== 'nil');
        if (nonNilTypes.length === 1) {
          return isSubtype(subResolved.type, nonNilTypes[0]!, ctx);
        }
        return isSubtype(subResolved.type, { 'kind': 'Union', 'types': nonNilTypes }, ctx);
      }
    }
  }

  // Union subtyping: sub is a subtype if ALL its members are subtypes
  if (subResolved.kind === 'Union') {
    return subResolved.types.every(t => isSubtype(t, supResolved, ctx));
  }

  // Union supertyping: sub is a subtype if it's a subtype of ANY member
  if (supResolved.kind === 'Union') {
    return supResolved.types.some(t => isSubtype(subResolved, t, ctx));
  }

  // Intersection subtyping: sub is a subtype if it's a subtype of ALL members
  if (supResolved.kind === 'Intersection') {
    return supResolved.types.every(t => isSubtype(subResolved, t, ctx));
  }

  // Intersection supertyping: sub is a subtype if ANY member is a subtype
  if (subResolved.kind === 'Intersection') {
    return subResolved.types.some(t => isSubtype(t, supResolved, ctx));
  }

  // Literal subtyping
  if (subResolved.kind === 'Literal') {
    if (supResolved.kind === 'Primitive') {
      return subResolved.baseType === supResolved.name;
    }
    if (supResolved.kind === 'Literal') {
      return subResolved.value === supResolved.value;
    }
  }

  // Function subtyping (contravariant in params, covariant in return)
  if (subResolved.kind === 'Function' && supResolved.kind === 'Function') {
    return isFunctionSubtype(subResolved, supResolved, ctx);
  }

  // Table subtyping (structural)
  if (subResolved.kind === 'Table' && supResolved.kind === 'Table') {
    return isTableSubtype(subResolved, supResolved, ctx);
  }

  // Class subtyping (nominal with inheritance)
  if (subResolved.kind === 'Class' && supResolved.kind === 'Class') {
    return isClassSubtype(subResolved, supResolved);
  }

  // Table can be subtype of class (duck typing in nonstrict mode)
  if (ctx.mode !== 'strict' && subResolved.kind === 'Table' && supResolved.kind === 'Class') {
    return isTableSubtypeOfClass(subResolved, supResolved, ctx);
  }

  // Variadic types
  if (subResolved.kind === 'Variadic' && supResolved.kind === 'Variadic') {
    return isSubtype(subResolved.type, supResolved.type, ctx);
  }

  // Generic types
  if (subResolved.kind === 'Generic' && supResolved.kind === 'Generic') {
    if (isSubtype(subResolved.base, supResolved.base, ctx) === false) return false;
    if (subResolved.typeArgs.length !== supResolved.typeArgs.length) return false;
    return subResolved.typeArgs.every((arg, i) => typesEqual(arg, supResolved.typeArgs[i]!));
  }

  return false;
};

/**
 * Determines whether a function type is a subtype of another function type.
 * Applies contravariance for parameters and covariance for return types.
 * @param sub - The potential subtype function.
 * @param sup - The potential supertype function.
 * @param ctx - The subtype context containing mode and variance information.
 * @returns True if `sub` is a valid subtype of `sup` according to function subtyping rules.
 */
const isFunctionSubtype = (sub: FunctionType, sup: FunctionType, ctx: SubtypeContext): boolean => {
  // Check return type (covariant)
  if (isSubtype(sub.returnType, sup.returnType, ctx) === false) return false;

  // Check variadic compatibility
  if (sup.isVariadic === false && sub.params.length > sup.params.length) return false;

  // Check parameters (contravariant)
  const contravariantCtx: SubtypeContext = { ...ctx, 'variance': 'contravariant' };

  for (let i = 0; i < sup.params.length; i++) {
    const subParam = sub.params[i];
    const supParam = sup.params[i]!;

    if (subParam === undefined) {
      // Sub has fewer params - ok if sup param is optional or sub is variadic
      if (supParam.optional === false && sub.isVariadic === false) return false;
      continue;
    }

    // Parameters are contravariant: sup param must be subtype of sub param
    if (isSubtype(supParam.type, subParam.type, contravariantCtx) === false) return false;
  }

  // Check this type if present
  if (sup.thisType !== undefined) {
    if (sub.thisType === undefined) return false;
    if (isSubtype(sup.thisType, sub.thisType, contravariantCtx) === false) return false;
  }

  return true;
};

/**
 * Determines whether a table type is a structural subtype of another table type.
 * Checks that the subtype has all required properties of the supertype with compatible types.
 * @param sub - The potential subtype table.
 * @param sup - The potential supertype table.
 * @param ctx - The subtype context containing mode and variance information.
 * @returns True if `sub` is a valid structural subtype of `sup`.
 */
const isTableSubtype = (sub: TableType, sup: TableType, ctx: SubtypeContext): boolean => {
  // Check that sub has all required properties of sup
  for (const [key, supProp] of sup.properties) {
    const subProp = sub.properties.get(key);

    if (subProp === undefined) {
      if (supProp.optional === false) return false;
      continue;
    }

    // Property types must be compatible (covariant for readonly, invariant otherwise)
    if (supProp.readonly) {
      if (isSubtype(subProp.type, supProp.type, ctx) === false) return false;
    } else {
      // Mutable properties are invariant
      if (typesEqual(subProp.type, supProp.type) === false) return false;
    }
  }

  // Check indexer compatibility
  if (sup.indexer !== undefined) {
    if (sub.indexer === undefined) {
      // Check if all sub properties satisfy the indexer
      for (const [, subProp] of sub.properties) {
        if (isSubtype(subProp.type, sup.indexer.valueType, ctx) === false) return false;
      }
    } else {
      // Both have indexers - check compatibility
      if (isSubtype(sub.indexer.keyType, sup.indexer.keyType, ctx) === false) return false;
      if (isSubtype(sub.indexer.valueType, sup.indexer.valueType, ctx) === false) return false;
    }
  }

  return true;
};

/**
 * Determines whether a class type is a nominal subtype of another class type.
 * Checks if the subtype is the same class or inherits from the supertype.
 * @param sub - The potential subtype class.
 * @param sup - The potential supertype class.
 * @returns True if `sub` is the same class as `sup` or inherits from it.
 */
const isClassSubtype = (sub: ClassType, sup: ClassType): boolean => {
  // Same class
  if (sub.name === sup.name) return true;

  // Check inheritance chain
  let current: ClassType | undefined = sub.superclass;
  while (current !== undefined) {
    if (current.name === sup.name) return true;
    current = current.superclass;
  }

  return false;
};

/**
 * Determines whether a table type is structurally compatible with a class type (duck typing).
 * Used in nonstrict mode to allow tables to be assigned to class-typed variables.
 * @param sub - The table type to check.
 * @param sup - The class type to check against.
 * @param ctx - The subtype context containing mode and variance information.
 * @returns True if the table has all properties and methods required by the class.
 */
const isTableSubtypeOfClass = (sub: TableType, sup: ClassType, ctx: SubtypeContext): boolean => {
  // Check that table has all properties of the class
  for (const [key, classProp] of sup.properties) {
    const tableProp = sub.properties.get(key);
    if (tableProp === undefined) return false;
    if (isSubtype(tableProp.type, classProp.type, ctx) === false) return false;
  }

  // Check methods
  for (const [key, method] of sup.methods) {
    const tableProp = sub.properties.get(key);
    if (tableProp === undefined) return false;
    if (tableProp.type.kind !== 'Function') return false;
    if (isFunctionSubtype(tableProp.type, method.func, ctx) === false) return false;
  }

  return true;
};

/**
 * Determines whether a source type can be assigned to a target type, including implicit coercions.
 * This is more permissive than subtyping in nonstrict mode, allowing certain coercions like number to string.
 * @param source - The type of the value being assigned.
 * @param target - The type of the variable or parameter being assigned to.
 * @param ctx - The subtype context containing mode and variance information. Defaults to strict covariant.
 * @returns True if the source type can be assigned to the target type.
 */
export const isAssignable = (source: LuauType, target: LuauType, ctx: SubtypeContext = defaultContext): boolean => {
  // Subtype is always assignable
  if (isSubtype(source, target, ctx)) return true;

  // In nonstrict mode, allow more coercions
  if (ctx.mode === 'nonstrict') {
    const sourceResolved = resolveType(source);
    const targetResolved = resolveType(target);

    // Allow number to string coercion
    if (sourceResolved.kind === 'Primitive' && sourceResolved.name === 'number') {
      if (targetResolved.kind === 'Primitive' && targetResolved.name === 'string') {
        return true;
      }
    }

    // Allow number to enum coercion (Roblox allows setting enum properties with numbers like .BinType = 1)
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

/**
 * Finds the common supertype of two types, used for type inference in conditional expressions.
 * If one type is a subtype of the other, returns the supertype. Otherwise, creates a union type.
 * @param a - The first type to find a common type for.
 * @param b - The second type to find a common type for.
 * @param ctx - The subtype context containing mode and variance information. Defaults to strict covariant.
 * @returns The common supertype, either the broader of the two types or a union of both.
 */
export const commonType = (a: LuauType, b: LuauType, ctx: SubtypeContext = defaultContext): LuauType => {
  if (isSubtype(a, b, ctx)) return b;
  if (isSubtype(b, a, ctx)) return a;

  // Create union
  return { 'kind': 'Union', 'types': [a, b] };
};

/**
 * Narrows a type based on a type guard, filtering union members to only those matching the guard.
 * Used for control flow analysis when type guards are applied (e.g., typeof checks).
 * @param type - The type to narrow.
 * @param guard - The type guard to apply for narrowing.
 * @returns The narrowed type, which may be never if no union members match the guard.
 */
export const narrowType = (type: LuauType, guard: LuauType): LuauType => {
  const resolved = resolveType(type);

  if (resolved.kind === 'Union') {
    const narrowed = resolved.types.filter(t => isSubtype(t, guard, defaultContext));
    if (narrowed.length === 0) return { 'kind': 'Never' };
    if (narrowed.length === 1) return narrowed[0]!;
    return { 'kind': 'Union', 'types': narrowed };
  }

  if (isSubtype(resolved, guard, defaultContext)) return resolved;

  return { 'kind': 'Never' };
};

/**
 * Removes a type from a union type, typically used for nil narrowing after truthiness checks.
 * Filters out union members that are subtypes of the excluded type.
 * @param type - The type to exclude from.
 * @param excluded - The type to exclude from the union.
 * @returns The resulting type with the excluded type removed, which may be never if all members are excluded.
 */
export const excludeType = (type: LuauType, excluded: LuauType): LuauType => {
  const resolved = resolveType(type);

  if (resolved.kind === 'Union') {
    const remaining = resolved.types.filter(t => isSubtype(t, excluded, defaultContext) === false);
    if (remaining.length === 0) return { 'kind': 'Never' };
    if (remaining.length === 1) return remaining[0]!;
    return { 'kind': 'Union', 'types': remaining };
  }

  if (isSubtype(resolved, excluded, defaultContext)) return { 'kind': 'Never' };

  return resolved;
};
