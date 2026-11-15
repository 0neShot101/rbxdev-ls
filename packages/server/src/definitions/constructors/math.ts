import { AnyType, NumberType, StringType, createFunctionType, createTableType } from '@analyzer/values';

import type { LuauType } from '@typings/types';

/** Installs Vector2, Vector3, CFrame, Color3, UDim and UDim2 constructor namespaces. */
export const installMathConstructors = (globals: Map<string, LuauType>): void => {
  const vector3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };
  const vector2Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector2' };
  const cframeType: LuauType = { 'kind': 'TypeReference', 'name': 'CFrame' };
  const color3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Color3' };
  const udim2Type: LuauType = { 'kind': 'TypeReference', 'name': 'UDim2' };
  const udimType: LuauType = { 'kind': 'TypeReference', 'name': 'UDim' };

  globals.set(
    'Vector3',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'x', 'type': NumberType, 'optional': true },
                { 'name': 'y', 'type': NumberType, 'optional': true },
                { 'name': 'z', 'type': NumberType, 'optional': true },
              ],
              vector3Type,
              { 'description': 'Creates a new Vector3 from the given x, y, and z components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        ['zero', { 'type': vector3Type, 'readonly': true, 'optional': false }],
        ['one', { 'type': vector3Type, 'readonly': true, 'optional': false }],
        ['xAxis', { 'type': vector3Type, 'readonly': true, 'optional': false }],
        ['yAxis', { 'type': vector3Type, 'readonly': true, 'optional': false }],
        ['zAxis', { 'type': vector3Type, 'readonly': true, 'optional': false }],
        [
          'FromNormalId',
          {
            'type': createFunctionType([{ 'name': 'normalId', 'type': AnyType, 'optional': false }], vector3Type, {
              'description': 'Returns the unit Vector3 corresponding to the given Enum.NormalId.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'FromAxis',
          {
            'type': createFunctionType([{ 'name': 'axis', 'type': AnyType, 'optional': false }], vector3Type, {
              'description': 'Returns the unit Vector3 corresponding to the given Enum.Axis.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  globals.set(
    'Vector2',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'x', 'type': NumberType, 'optional': true },
                { 'name': 'y', 'type': NumberType, 'optional': true },
              ],
              vector2Type,
              { 'description': 'Creates a new Vector2 from the given x and y components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        ['zero', { 'type': vector2Type, 'readonly': true, 'optional': false }],
        ['one', { 'type': vector2Type, 'readonly': true, 'optional': false }],
        ['xAxis', { 'type': vector2Type, 'readonly': true, 'optional': false }],
        ['yAxis', { 'type': vector2Type, 'readonly': true, 'optional': false }],
      ]),
    ),
  );

  globals.set(
    'CFrame',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], cframeType, {
              'isVariadic': true,
              'description': 'Creates a new CFrame. Can take a position, position + lookAt, or 12 matrix components.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        ['identity', { 'type': cframeType, 'readonly': true, 'optional': false }],
        [
          'Angles',
          {
            'type': createFunctionType(
              [
                { 'name': 'rx', 'type': NumberType, 'optional': false },
                { 'name': 'ry', 'type': NumberType, 'optional': false },
                { 'name': 'rz', 'type': NumberType, 'optional': false },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from Euler angles in radians, applied in Z, Y, X order.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromEulerAnglesXYZ',
          {
            'type': createFunctionType(
              [
                { 'name': 'rx', 'type': NumberType, 'optional': false },
                { 'name': 'ry', 'type': NumberType, 'optional': false },
                { 'name': 'rz', 'type': NumberType, 'optional': false },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from Euler angles in radians, applied in Z, Y, X order.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromEulerAnglesYXZ',
          {
            'type': createFunctionType(
              [
                { 'name': 'rx', 'type': NumberType, 'optional': false },
                { 'name': 'ry', 'type': NumberType, 'optional': false },
                { 'name': 'rz', 'type': NumberType, 'optional': false },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from Euler angles in radians, applied in Z, X, Y order.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromOrientation',
          {
            'type': createFunctionType(
              [
                { 'name': 'rx', 'type': NumberType, 'optional': false },
                { 'name': 'ry', 'type': NumberType, 'optional': false },
                { 'name': 'rz', 'type': NumberType, 'optional': false },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from orientation angles in radians.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromAxisAngle',
          {
            'type': createFunctionType(
              [
                { 'name': 'axis', 'type': vector3Type, 'optional': false },
                { 'name': 'angle', 'type': NumberType, 'optional': false },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from an axis and rotation angle in radians.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromMatrix',
          {
            'type': createFunctionType(
              [
                { 'name': 'pos', 'type': vector3Type, 'optional': false },
                { 'name': 'vX', 'type': vector3Type, 'optional': false },
                { 'name': 'vY', 'type': vector3Type, 'optional': false },
                { 'name': 'vZ', 'type': vector3Type, 'optional': true },
              ],
              cframeType,
              { 'description': 'Creates a CFrame from a position and rotation matrix column vectors.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'lookAt',
          {
            'type': createFunctionType(
              [
                { 'name': 'at', 'type': vector3Type, 'optional': false },
                { 'name': 'lookAt', 'type': vector3Type, 'optional': false },
                { 'name': 'up', 'type': vector3Type, 'optional': true },
              ],
              cframeType,
              { 'description': 'Creates a CFrame at a position looking towards a target point.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'lookAlong',
          {
            'type': createFunctionType(
              [
                { 'name': 'at', 'type': vector3Type, 'optional': false },
                { 'name': 'direction', 'type': vector3Type, 'optional': false },
                { 'name': 'up', 'type': vector3Type, 'optional': true },
              ],
              cframeType,
              { 'description': 'Creates a CFrame at a position looking along a direction vector.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  globals.set(
    'Color3',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'r', 'type': NumberType, 'optional': true },
                { 'name': 'g', 'type': NumberType, 'optional': true },
                { 'name': 'b', 'type': NumberType, 'optional': true },
              ],
              color3Type,
              { 'description': 'Creates a Color3 from red, green, and blue components in the range [0, 1].' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromRGB',
          {
            'type': createFunctionType(
              [
                { 'name': 'r', 'type': NumberType, 'optional': false },
                { 'name': 'g', 'type': NumberType, 'optional': false },
                { 'name': 'b', 'type': NumberType, 'optional': false },
              ],
              color3Type,
              { 'description': 'Creates a Color3 from red, green, and blue components in the range [0, 255].' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromHSV',
          {
            'type': createFunctionType(
              [
                { 'name': 'h', 'type': NumberType, 'optional': false },
                { 'name': 's', 'type': NumberType, 'optional': false },
                { 'name': 'v', 'type': NumberType, 'optional': false },
              ],
              color3Type,
              {
                'description': 'Creates a Color3 from hue, saturation, and value components, each in the range [0, 1].',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromHex',
          {
            'type': createFunctionType([{ 'name': 'hex', 'type': StringType, 'optional': false }], color3Type, {
              'description': 'Creates a Color3 from a hexadecimal string (e.g., "#FF0000" or "FF0000").',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  globals.set(
    'UDim',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'scale', 'type': NumberType, 'optional': false },
                { 'name': 'offset', 'type': NumberType, 'optional': false },
              ],
              udimType,
              { 'description': 'Creates a new UDim from scale and offset components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  globals.set(
    'UDim2',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'xScale', 'type': NumberType, 'optional': false },
                { 'name': 'xOffset', 'type': NumberType, 'optional': false },
                { 'name': 'yScale', 'type': NumberType, 'optional': false },
                { 'name': 'yOffset', 'type': NumberType, 'optional': false },
              ],
              udim2Type,
              { 'description': 'Creates a new UDim2 from X and Y scale and offset components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromScale',
          {
            'type': createFunctionType(
              [
                { 'name': 'xScale', 'type': NumberType, 'optional': false },
                { 'name': 'yScale', 'type': NumberType, 'optional': false },
              ],
              udim2Type,
              { 'description': 'Creates a new UDim2 from X and Y scale components with zero offsets.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromOffset',
          {
            'type': createFunctionType(
              [
                { 'name': 'xOffset', 'type': NumberType, 'optional': false },
                { 'name': 'yOffset', 'type': NumberType, 'optional': false },
              ],
              udim2Type,
              { 'description': 'Creates a new UDim2 from X and Y offset components with zero scale.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );
};
