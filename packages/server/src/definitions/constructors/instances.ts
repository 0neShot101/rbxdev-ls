import { AnyType, BooleanType, NumberType, createFunctionType, createTableType } from '@analyzer/values';

import type { LuauType } from '@typings/types';

/** Installs BrickColor through OverlapParams constructor namespaces. */
export const installInstanceConstructors = (globals: Map<string, LuauType>): void => {
  const vector3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };
  const brickColorType: LuauType = { 'kind': 'TypeReference', 'name': 'BrickColor' };
  globals.set(
    'BrickColor',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], brickColorType, {
              'description': 'Creates a BrickColor from a name, number, or Color3 value.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'palette',
          {
            'type': createFunctionType([{ 'name': 'index', 'type': NumberType, 'optional': false }], brickColorType, {
              'description': 'Returns the BrickColor from the default palette at the given index (0-127).',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'random',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns a random BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'White',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the White BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'Black',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the Black BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'Red',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the Red BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'Green',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the Green BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'Blue',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the Blue BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'Yellow',
          {
            'type': createFunctionType([], brickColorType, { 'description': 'Returns the Yellow BrickColor.' }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const tweenInfoType: LuauType = { 'kind': 'TypeReference', 'name': 'TweenInfo' };
  globals.set(
    'TweenInfo',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'time', 'type': NumberType, 'optional': true },
                { 'name': 'easingStyle', 'type': AnyType, 'optional': true },
                { 'name': 'easingDirection', 'type': AnyType, 'optional': true },
                { 'name': 'repeatCount', 'type': NumberType, 'optional': true },
                { 'name': 'reverses', 'type': BooleanType, 'optional': true },
                { 'name': 'delayTime', 'type': NumberType, 'optional': true },
              ],
              tweenInfoType,
              { 'description': 'Creates a new TweenInfo with the given easing parameters for use with TweenService.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const numberRangeType: LuauType = { 'kind': 'TypeReference', 'name': 'NumberRange' };
  globals.set(
    'NumberRange',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'min', 'type': NumberType, 'optional': false },
                { 'name': 'max', 'type': NumberType, 'optional': true },
              ],
              numberRangeType,
              { 'description': 'Creates a new NumberRange from a minimum and optional maximum value.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const numberSequenceType: LuauType = { 'kind': 'TypeReference', 'name': 'NumberSequence' };
  globals.set(
    'NumberSequence',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], numberSequenceType, {
              'description':
                'Creates a new NumberSequence from a single value, two values, or an array of NumberSequenceKeypoints.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const colorSequenceType: LuauType = { 'kind': 'TypeReference', 'name': 'ColorSequence' };
  globals.set(
    'ColorSequence',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'value', 'type': AnyType, 'optional': false }], colorSequenceType, {
              'description':
                'Creates a new ColorSequence from a single Color3, two Color3s, or an array of ColorSequenceKeypoints.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const rayType: LuauType = { 'kind': 'TypeReference', 'name': 'Ray' };
  globals.set(
    'Ray',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'origin', 'type': vector3Type, 'optional': false },
                { 'name': 'direction', 'type': vector3Type, 'optional': false },
              ],
              rayType,
              { 'description': 'Creates a new Ray from an origin point and a direction vector.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const region3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Region3' };
  globals.set(
    'Region3',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'min', 'type': vector3Type, 'optional': false },
                { 'name': 'max', 'type': vector3Type, 'optional': false },
              ],
              region3Type,
              { 'description': 'Creates a new Region3 from two Vector3 corners (min and max).' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const rectType: LuauType = { 'kind': 'TypeReference', 'name': 'Rect' };
  globals.set(
    'Rect',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], rectType, {
              'isVariadic': true,
              'description': 'Creates a new Rect from min/max points or x/y coordinates.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const raycastParamsType: LuauType = { 'kind': 'TypeReference', 'name': 'RaycastParams' };
  globals.set(
    'RaycastParams',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], raycastParamsType, {
              'description': 'Creates a new RaycastParams object for use with workspace:Raycast().',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const overlapParamsType: LuauType = { 'kind': 'TypeReference', 'name': 'OverlapParams' };
  globals.set(
    'OverlapParams',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], overlapParamsType, {
              'description': 'Creates a new OverlapParams object for use with spatial query methods.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );
};
