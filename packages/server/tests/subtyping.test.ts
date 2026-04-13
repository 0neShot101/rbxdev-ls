import { commonType, excludeType, isAssignable, isSubtype, narrowType } from '@typings/subtyping';
import {
  BooleanType,
  NilType,
  NumberType,
  StringType,
  createBooleanLiteral,
  createClassType,
  createEnumType,
  createFunctionType,
  createNumberLiteral,
  createStringLiteral,
  createTableType,
} from '@typings/types';
import { describe, expect, test } from 'bun:test';

import type { SubtypeContext } from '@typings/subtyping';
import type { ClassType, LuauType } from '@typings/types';

const AnyType: LuauType = { 'kind': 'Any' };
const UnknownType: LuauType = { 'kind': 'Unknown' };
const NeverType: LuauType = { 'kind': 'Never' };
const ErrorType: LuauType = { 'kind': 'Error', 'message': 'test error' };

const strictCtx: SubtypeContext = { 'mode': 'strict', 'variance': 'covariant' };
const nonstrictCtx: SubtypeContext = { 'mode': 'nonstrict', 'variance': 'covariant' };

describe('isSubtype', () => {
  describe('Primitive Types', () => {
    test('number is subtype of number', () => {
      expect(isSubtype(NumberType, NumberType)).toBe(true);
    });

    test('string is subtype of string', () => {
      expect(isSubtype(StringType, StringType)).toBe(true);
    });

    test('boolean is subtype of boolean', () => {
      expect(isSubtype(BooleanType, BooleanType)).toBe(true);
    });

    test('number is not subtype of string', () => {
      expect(isSubtype(NumberType, StringType)).toBe(false);
    });

    test('string is not subtype of number', () => {
      expect(isSubtype(StringType, NumberType)).toBe(false);
    });

    test('nil is not subtype of number', () => {
      expect(isSubtype(NilType, NumberType)).toBe(false);
    });

    test('Any is subtype of number', () => {
      expect(isSubtype(AnyType, NumberType)).toBe(true);
    });

    test('number is subtype of Unknown', () => {
      expect(isSubtype(NumberType, UnknownType)).toBe(true);
    });
  });

  describe('Special Types', () => {
    test('Never is subtype of any type', () => {
      expect(isSubtype(NeverType, NumberType)).toBe(true);
      expect(isSubtype(NeverType, StringType)).toBe(true);
      expect(isSubtype(NeverType, BooleanType)).toBe(true);
    });

    test('Error is subtype of any type', () => {
      expect(isSubtype(ErrorType, NumberType)).toBe(true);
      expect(isSubtype(ErrorType, StringType)).toBe(true);
    });

    test('any type is subtype of Any', () => {
      expect(isSubtype(NumberType, AnyType)).toBe(true);
      expect(isSubtype(StringType, AnyType)).toBe(true);
      expect(isSubtype(BooleanType, AnyType)).toBe(true);
    });

    test('Any is subtype of string in nonstrict mode', () => {
      expect(isSubtype(AnyType, StringType, nonstrictCtx)).toBe(true);
    });

    test('Any is subtype of string in strict mode', () => {
      expect(isSubtype(AnyType, StringType, strictCtx)).toBe(true);
    });
  });

  describe('Literal Types', () => {
    test('string literal is subtype of string', () => {
      expect(isSubtype(createStringLiteral('hello'), StringType)).toBe(true);
    });

    test('number literal is subtype of number', () => {
      expect(isSubtype(createNumberLiteral(42), NumberType)).toBe(true);
    });

    test('boolean literal is subtype of boolean', () => {
      expect(isSubtype(createBooleanLiteral(true), BooleanType)).toBe(true);
    });

    test('string literal is not subtype of number', () => {
      expect(isSubtype(createStringLiteral('hello'), NumberType)).toBe(false);
    });

    test('same string literals are subtypes of each other', () => {
      expect(isSubtype(createStringLiteral('a'), createStringLiteral('a'))).toBe(true);
    });

    test('different string literals are not subtypes of each other', () => {
      expect(isSubtype(createStringLiteral('a'), createStringLiteral('b'))).toBe(false);
    });
  });

  describe('Optional and Nil Types', () => {
    test('nil is subtype of Optional(string)', () => {
      const optionalString: LuauType = { 'kind': 'Optional', 'type': StringType };
      expect(isSubtype(NilType, optionalString)).toBe(true);
    });

    test('nil is subtype of Union(string, nil)', () => {
      const unionWithNil: LuauType = { 'kind': 'Union', 'types': [StringType, NilType] };
      expect(isSubtype(NilType, unionWithNil)).toBe(true);
    });

    test('Optional(string) is subtype of Optional(string)', () => {
      const optA: LuauType = { 'kind': 'Optional', 'type': StringType };
      const optB: LuauType = { 'kind': 'Optional', 'type': StringType };
      expect(isSubtype(optA, optB)).toBe(true);
    });

    test('nil is not subtype of string', () => {
      expect(isSubtype(NilType, StringType)).toBe(false);
    });
  });

  describe('Union Types', () => {
    test('number is subtype of number | string', () => {
      const union: LuauType = { 'kind': 'Union', 'types': [NumberType, StringType] };
      expect(isSubtype(NumberType, union)).toBe(true);
    });

    test('string is subtype of number | string', () => {
      const union: LuauType = { 'kind': 'Union', 'types': [NumberType, StringType] };
      expect(isSubtype(StringType, union)).toBe(true);
    });

    test('boolean is not subtype of number | string', () => {
      const union: LuauType = { 'kind': 'Union', 'types': [NumberType, StringType] };
      expect(isSubtype(BooleanType, union)).toBe(false);
    });

    test('number | string is subtype of number | string | boolean', () => {
      const sub: LuauType = { 'kind': 'Union', 'types': [NumberType, StringType] };
      const sup: LuauType = { 'kind': 'Union', 'types': [NumberType, StringType, BooleanType] };
      expect(isSubtype(sub, sup)).toBe(true);
    });

    test('union where all members match supertype union', () => {
      const sub: LuauType = { 'kind': 'Union', 'types': [NumberType, BooleanType] };
      const sup: LuauType = { 'kind': 'Union', 'types': [NumberType, BooleanType, StringType] };
      expect(isSubtype(sub, sup)).toBe(true);
    });
  });

  describe('Intersection Types', () => {
    test('subtype of intersection requires subtype of all members', () => {
      const intersection: LuauType = { 'kind': 'Intersection', 'types': [NumberType, StringType] };
      expect(isSubtype(NumberType, intersection)).toBe(false);
    });

    test('intersection is subtype if at least one member is subtype', () => {
      const intersection: LuauType = { 'kind': 'Intersection', 'types': [NumberType, StringType] };
      expect(isSubtype(intersection, NumberType)).toBe(true);
    });

    test('intersection with no matching member is not subtype', () => {
      const intersection: LuauType = { 'kind': 'Intersection', 'types': [NumberType, StringType] };
      expect(isSubtype(intersection, BooleanType)).toBe(false);
    });
  });

  describe('Function Types', () => {
    test('same function type is subtype', () => {
      const fnA = createFunctionType([{ 'name': 'x', 'type': NumberType, 'optional': false }], StringType);
      const fnB = createFunctionType([{ 'name': 'x', 'type': NumberType, 'optional': false }], StringType);
      expect(isSubtype(fnA, fnB)).toBe(true);
    });

    test('function with fewer params is subtype when supertype has optional extras', () => {
      const fnSub = createFunctionType([{ 'name': 'x', 'type': NumberType, 'optional': false }], StringType);
      const fnSup = createFunctionType(
        [
          { 'name': 'x', 'type': NumberType, 'optional': false },
          { 'name': 'y', 'type': NumberType, 'optional': true },
        ],
        StringType,
      );
      expect(isSubtype(fnSub, fnSup)).toBe(true);
    });

    test('contravariant params: wider param type in sub is subtype', () => {
      const fnSub = createFunctionType(
        [{ 'name': 'x', 'type': { 'kind': 'Union', 'types': [NumberType, StringType] }, 'optional': false }],
        BooleanType,
      );
      const fnSup = createFunctionType([{ 'name': 'x', 'type': NumberType, 'optional': false }], BooleanType);
      expect(isSubtype(fnSub, fnSup)).toBe(true);
    });

    test('covariant returns: narrower return type in sub is subtype', () => {
      const fnSub = createFunctionType(
        [{ 'name': 'x', 'type': NumberType, 'optional': false }],
        createNumberLiteral(42),
      );
      const fnSup = createFunctionType([{ 'name': 'x', 'type': NumberType, 'optional': false }], NumberType);
      expect(isSubtype(fnSub, fnSup)).toBe(true);
    });

    test('wrong return type is not subtype', () => {
      const fnA = createFunctionType([{ 'name': 'x', 'type': NumberType, 'optional': false }], StringType);
      const fnB = createFunctionType([{ 'name': 'x', 'type': NumberType, 'optional': false }], BooleanType);
      expect(isSubtype(fnA, fnB)).toBe(false);
    });
  });

  describe('Table Types', () => {
    test('table with same properties is subtype', () => {
      const tableA = createTableType(new Map([['x', { 'type': NumberType, 'readonly': false, 'optional': false }]]));
      const tableB = createTableType(new Map([['x', { 'type': NumberType, 'readonly': false, 'optional': false }]]));
      expect(isSubtype(tableA, tableB)).toBe(true);
    });

    test('table with extra properties is subtype of narrower table', () => {
      const wider = createTableType(
        new Map([
          ['x', { 'type': NumberType, 'readonly': false, 'optional': false }],
          ['y', { 'type': StringType, 'readonly': false, 'optional': false }],
        ]),
      );
      const narrower = createTableType(new Map([['x', { 'type': NumberType, 'readonly': false, 'optional': false }]]));
      expect(isSubtype(wider, narrower)).toBe(true);
    });

    test('missing required property is not subtype', () => {
      const sub = createTableType(new Map([['x', { 'type': NumberType, 'readonly': false, 'optional': false }]]));
      const sup = createTableType(
        new Map([
          ['x', { 'type': NumberType, 'readonly': false, 'optional': false }],
          ['y', { 'type': StringType, 'readonly': false, 'optional': false }],
        ]),
      );
      expect(isSubtype(sub, sup)).toBe(false);
    });

    test('missing optional property is still subtype', () => {
      const sub = createTableType(new Map([['x', { 'type': NumberType, 'readonly': false, 'optional': false }]]));
      const sup = createTableType(
        new Map([
          ['x', { 'type': NumberType, 'readonly': false, 'optional': false }],
          ['y', { 'type': StringType, 'readonly': false, 'optional': true }],
        ]),
      );
      expect(isSubtype(sub, sup)).toBe(true);
    });

    test('table with indexer subtyping', () => {
      const sub = createTableType(new Map(), {
        'indexer': { 'keyType': StringType, 'valueType': NumberType },
      });
      const sup = createTableType(new Map(), {
        'indexer': { 'keyType': StringType, 'valueType': NumberType },
      });
      expect(isSubtype(sub, sup)).toBe(true);
    });
  });

  describe('Class Types', () => {
    const instanceClass: ClassType = createClassType('Instance');
    const basePartClass: ClassType = createClassType('BasePart', { 'superclass': instanceClass });
    const partClass: ClassType = createClassType('Part', { 'superclass': basePartClass });

    test('Part is subtype of Instance through superclass chain', () => {
      expect(isSubtype(partClass, instanceClass)).toBe(true);
    });

    test('BasePart is subtype of Instance', () => {
      expect(isSubtype(basePartClass, instanceClass)).toBe(true);
    });

    test('Instance is not subtype of Part', () => {
      expect(isSubtype(instanceClass, partClass)).toBe(false);
    });

    test('Part is subtype of Part (same name)', () => {
      expect(isSubtype(partClass, partClass)).toBe(true);
    });
  });

  describe('TypeReference Types', () => {
    test('TypeReference is subtype of Table', () => {
      const typeRef: LuauType = { 'kind': 'TypeReference', 'name': 'MyType' };
      const table = createTableType(new Map([['x', { 'type': NumberType, 'readonly': false, 'optional': false }]]));
      expect(isSubtype(typeRef, table)).toBe(true);
    });

    test('Table is subtype of TypeReference', () => {
      const table = createTableType(new Map([['x', { 'type': NumberType, 'readonly': false, 'optional': false }]]));
      const typeRef: LuauType = { 'kind': 'TypeReference', 'name': 'MyType' };
      expect(isSubtype(table, typeRef)).toBe(true);
    });

    test('same-name TypeReferences are subtypes of each other', () => {
      const refA: LuauType = { 'kind': 'TypeReference', 'name': 'Foo' };
      const refB: LuauType = { 'kind': 'TypeReference', 'name': 'Foo' };
      expect(isSubtype(refA, refB)).toBe(true);
    });
  });

  describe('Variadic Types', () => {
    test('Variadic(number) is subtype of Variadic(number)', () => {
      const varA: LuauType = { 'kind': 'Variadic', 'type': NumberType };
      const varB: LuauType = { 'kind': 'Variadic', 'type': NumberType };
      expect(isSubtype(varA, varB)).toBe(true);
    });

    test('Variadic(number) is not subtype of Variadic(string)', () => {
      const varA: LuauType = { 'kind': 'Variadic', 'type': NumberType };
      const varB: LuauType = { 'kind': 'Variadic', 'type': StringType };
      expect(isSubtype(varA, varB)).toBe(false);
    });
  });

  describe('Generic Types', () => {
    test('same generic types are subtypes', () => {
      const genA: LuauType = {
        'kind': 'Generic',
        'base': { 'kind': 'TypeReference', 'name': 'Array' },
        'typeArgs': [NumberType],
      };
      const genB: LuauType = {
        'kind': 'Generic',
        'base': { 'kind': 'TypeReference', 'name': 'Array' },
        'typeArgs': [NumberType],
      };
      expect(isSubtype(genA, genB)).toBe(true);
    });

    test('generic types with different type args are not subtypes', () => {
      const genA: LuauType = {
        'kind': 'Generic',
        'base': { 'kind': 'TypeReference', 'name': 'Array' },
        'typeArgs': [NumberType],
      };
      const genB: LuauType = {
        'kind': 'Generic',
        'base': { 'kind': 'TypeReference', 'name': 'Array' },
        'typeArgs': [StringType],
      };
      expect(isSubtype(genA, genB)).toBe(false);
    });
  });
});

describe('isAssignable', () => {
  test('same types are assignable', () => {
    expect(isAssignable(NumberType, NumberType)).toBe(true);
  });

  test('number is assignable to string in nonstrict mode', () => {
    expect(isAssignable(NumberType, StringType, nonstrictCtx)).toBe(true);
  });

  test('number is not assignable to string in strict mode', () => {
    expect(isAssignable(NumberType, StringType, strictCtx)).toBe(false);
  });

  test('number is assignable to Enum type in nonstrict mode', () => {
    const enumType = createEnumType('KeyCode', new Map([['A', { 'name': 'A', 'value': 0 }]]));
    expect(isAssignable(NumberType, enumType, nonstrictCtx)).toBe(true);
  });

  test('subtype relationship implies assignability', () => {
    expect(isAssignable(createStringLiteral('hello'), StringType)).toBe(true);
  });
});

describe('commonType', () => {
  test('commonType of same types returns that type', () => {
    const result = commonType(NumberType, NumberType);
    expect(result.kind).toBe('Primitive');
    if (result.kind === 'Primitive') expect(result.name).toBe('number');
  });

  test('commonType of unrelated types returns union', () => {
    const result = commonType(NumberType, StringType);
    expect(result.kind).toBe('Union');
    if (result.kind === 'Union') {
      expect(result.types.length).toBe(2);
    }
  });

  test('commonType of subtype and supertype returns supertype', () => {
    const result = commonType(createNumberLiteral(42), NumberType);
    expect(result.kind).toBe('Primitive');
    if (result.kind === 'Primitive') expect(result.name).toBe('number');
  });

  test('commonType of supertype and subtype returns supertype', () => {
    const result = commonType(NumberType, createNumberLiteral(42));
    expect(result.kind).toBe('Primitive');
    if (result.kind === 'Primitive') expect(result.name).toBe('number');
  });
});

describe('narrowType', () => {
  test('narrows union by matching member', () => {
    const union: LuauType = { 'kind': 'Union', 'types': [StringType, NumberType] };
    const result = narrowType(union, StringType);
    expect(result.kind).toBe('Primitive');
    if (result.kind === 'Primitive') expect(result.name).toBe('string');
  });

  test('narrows union to single matching member from three', () => {
    const union: LuauType = { 'kind': 'Union', 'types': [StringType, NumberType, BooleanType] };
    const result = narrowType(union, NumberType);
    expect(result.kind).toBe('Primitive');
    if (result.kind === 'Primitive') expect(result.name).toBe('number');
  });

  test('narrowing non-union to non-matching guard returns Never', () => {
    const result = narrowType(NumberType, StringType);
    expect(result.kind).toBe('Never');
  });

  test('narrows Union(string, nil) by string removes nil', () => {
    const union: LuauType = { 'kind': 'Union', 'types': [StringType, NilType] };
    const result = narrowType(union, StringType);
    expect(result.kind).toBe('Primitive');
    if (result.kind === 'Primitive') expect(result.name).toBe('string');
  });

  test('narrowing matching non-union type returns same type', () => {
    const result = narrowType(NumberType, NumberType);
    expect(result.kind).toBe('Primitive');
    if (result.kind === 'Primitive') expect(result.name).toBe('number');
  });
});

describe('excludeType', () => {
  test('excludes nil from Union(string, nil) leaving string', () => {
    const union: LuauType = { 'kind': 'Union', 'types': [StringType, NilType] };
    const result = excludeType(union, NilType);
    expect(result.kind).toBe('Primitive');
    if (result.kind === 'Primitive') expect(result.name).toBe('string');
  });

  test('excludes number from Union(string, number, boolean) leaving union', () => {
    const union: LuauType = { 'kind': 'Union', 'types': [StringType, NumberType, BooleanType] };
    const result = excludeType(union, NumberType);
    expect(result.kind).toBe('Union');
    if (result.kind === 'Union') {
      expect(result.types.length).toBe(2);
    }
  });

  test('excludes string from string returns Never', () => {
    const result = excludeType(StringType, StringType);
    expect(result.kind).toBe('Never');
  });

  test('excluding non-present type returns original', () => {
    const result = excludeType(StringType, NumberType);
    expect(result.kind).toBe('Primitive');
    if (result.kind === 'Primitive') expect(result.name).toBe('string');
  });

  test('excluding nil from union without nil returns same union', () => {
    const union: LuauType = { 'kind': 'Union', 'types': [StringType, NumberType] };
    const result = excludeType(union, NilType);
    expect(result.kind).toBe('Union');
    if (result.kind === 'Union') {
      expect(result.types.length).toBe(2);
    }
  });
});
