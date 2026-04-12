import {
  AnyType,
  BooleanType,
  BufferType,
  createUnionType,
  NilType,
  NumberType,
  StringType,
  ThreadType,
  UnknownType,
  VectorType,
} from '@typings/types';

import type { TypeAnnotation } from '@typings/ast';
import type { LuauType, PrimitiveType } from '@typings/types';

/**
 * Resolves a subset of Luau type annotations to `LuauType` without needing
 * a full checker state. Handles primitives, optional, and flat unions —
 * the cases that show up in the function signatures of typical module
 * exports. Anything more exotic (generics, class references, user-defined
 * type aliases, table types, nested function types, etc.) falls back to
 * `AnyType` so downstream consumers still get a usable `FunctionType`
 * even when the detailed shape isn't available.
 *
 * This is a deliberately lossy converter intended for the workspace
 * module index, where we cannot run the full checker on every required
 * module. For full-fidelity resolution, the type checker's own
 * `resolveTypeAnnotation` is authoritative.
 */
export const resolveAnnotationToType = (annotation: TypeAnnotation | undefined): LuauType => {
  if (annotation === undefined) return AnyType;

  switch (annotation.kind) {
    case 'TypeReference': {
      const primitive = resolvePrimitiveByName(annotation.name);
      if (primitive !== undefined) return primitive;
      if (annotation.name === 'any') return AnyType;
      if (annotation.name === 'unknown') return UnknownType;
      // Class references, user type aliases, generics → unresolved here.
      // Fall back to any so the enclosing function type still works.
      return AnyType;
    }

    case 'OptionalType':
      return createUnionType([resolveAnnotationToType(annotation.type), NilType]);

    case 'UnionType':
      return createUnionType(annotation.types.map(t => resolveAnnotationToType(t)));

    case 'ParenthesizedType':
      return resolveAnnotationToType(annotation.type);

    case 'TypeLiteral':
      // String/number/boolean literal types reduce to their base primitive
      // for our purposes. We don't model literal types in the module index.
      if (typeof annotation.value === 'string') return StringType;
      if (typeof annotation.value === 'number') return NumberType;
      if (typeof annotation.value === 'boolean') return BooleanType;
      return AnyType;

    default:
      return AnyType;
  }
};

const resolvePrimitiveByName = (name: string): PrimitiveType | undefined => {
  switch (name) {
    case 'nil':
      return NilType;
    case 'boolean':
      return BooleanType;
    case 'number':
      return NumberType;
    case 'string':
      return StringType;
    case 'thread':
      return ThreadType;
    case 'buffer':
      return BufferType;
    case 'vector':
      return VectorType;
    default:
      return undefined;
  }
};
