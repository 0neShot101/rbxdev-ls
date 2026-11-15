import { NumberType, createFunctionType, createTableType } from '@analyzer/values';

import type { LuauType } from '@typings/types';

/** Installs the native Luau vector library table. */
export const installVector = (globals: Map<string, LuauType>): void => {
  const nativeVectorType: LuauType = { 'kind': 'Primitive', 'name': 'vector' };
  globals.set(
    'vector',
    createTableType(
      new Map([
        [
          'create',
          {
            'type': createFunctionType(
              [
                { 'name': 'x', 'type': NumberType, 'optional': false },
                { 'name': 'y', 'type': NumberType, 'optional': false },
                { 'name': 'z', 'type': NumberType, 'optional': false },
              ],
              nativeVectorType,
              { 'description': 'Creates a new native vector with x, y, z components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'magnitude',
          {
            'type': createFunctionType([{ 'name': 'v', 'type': nativeVectorType, 'optional': false }], NumberType, {
              'description': 'Returns the magnitude (length) of the vector.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'normalize',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': nativeVectorType, 'optional': false }],
              nativeVectorType,
              { 'description': 'Returns the unit vector (normalized to length 1).' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'cross',
          {
            'type': createFunctionType(
              [
                { 'name': 'a', 'type': nativeVectorType, 'optional': false },
                { 'name': 'b', 'type': nativeVectorType, 'optional': false },
              ],
              nativeVectorType,
              { 'description': 'Returns the cross product of two vectors.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'dot',
          {
            'type': createFunctionType(
              [
                { 'name': 'a', 'type': nativeVectorType, 'optional': false },
                { 'name': 'b', 'type': nativeVectorType, 'optional': false },
              ],
              NumberType,
              { 'description': 'Returns the dot product of two vectors.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'floor',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': nativeVectorType, 'optional': false }],
              nativeVectorType,
              { 'description': 'Returns a vector with each component rounded down.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'ceil',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': nativeVectorType, 'optional': false }],
              nativeVectorType,
              { 'description': 'Returns a vector with each component rounded up.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'abs',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': nativeVectorType, 'optional': false }],
              nativeVectorType,
              { 'description': 'Returns a vector with the absolute value of each component.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'sign',
          {
            'type': createFunctionType(
              [{ 'name': 'v', 'type': nativeVectorType, 'optional': false }],
              nativeVectorType,
              { 'description': 'Returns a vector with the sign (-1, 0, or 1) of each component.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'clamp',
          {
            'type': createFunctionType(
              [
                { 'name': 'v', 'type': nativeVectorType, 'optional': false },
                { 'name': 'min', 'type': nativeVectorType, 'optional': false },
                { 'name': 'max', 'type': nativeVectorType, 'optional': false },
              ],
              nativeVectorType,
              { 'description': 'Returns a vector with each component clamped between min and max.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'max',
          {
            'type': createFunctionType([], nativeVectorType, {
              'isVariadic': true,
              'description': 'Returns the component-wise maximum of the given vectors.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'min',
          {
            'type': createFunctionType([], nativeVectorType, {
              'isVariadic': true,
              'description': 'Returns the component-wise minimum of the given vectors.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        ['zero', { 'type': nativeVectorType, 'readonly': true, 'optional': false }],
        ['one', { 'type': nativeVectorType, 'readonly': true, 'optional': false }],
      ]),
    ),
  );
};
