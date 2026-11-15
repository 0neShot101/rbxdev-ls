import {
  AnyType,
  BooleanType,
  NilType,
  NumberType,
  StringType,
  createFunctionType,
  createTableType,
} from '@analyzer/values';

import type { LuauType } from '@typings/types';

/** Installs DateTime through ColorSequenceKeypoint constructor namespaces. */
export const installValueConstructors = (globals: Map<string, LuauType>): void => {
  const vector3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };
  const color3Type: LuauType = { 'kind': 'TypeReference', 'name': 'Color3' };
  const dateTimeType: LuauType = { 'kind': 'TypeReference', 'name': 'DateTime' };
  globals.set(
    'DateTime',
    createTableType(
      new Map([
        [
          'now',
          {
            'type': createFunctionType([], dateTimeType, {
              'description': 'Returns a DateTime representing the current UTC time.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromUnixTimestamp',
          {
            'type': createFunctionType([{ 'name': 'timestamp', 'type': NumberType, 'optional': false }], dateTimeType, {
              'description': 'Creates a DateTime from a Unix timestamp (seconds since epoch).',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromUnixTimestampMillis',
          {
            'type': createFunctionType([{ 'name': 'timestamp', 'type': NumberType, 'optional': false }], dateTimeType, {
              'description': 'Creates a DateTime from a Unix timestamp in milliseconds.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromIsoDate',
          {
            'type': createFunctionType([{ 'name': 'isoDate', 'type': StringType, 'optional': false }], dateTimeType, {
              'description': 'Creates a DateTime from an ISO 8601 date-time string.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromLocalTime',
          {
            'type': createFunctionType([{ 'name': 'dateTime', 'type': AnyType, 'optional': false }], dateTimeType, {
              'description': 'Creates a DateTime from a table of local time components.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromUniversalTime',
          {
            'type': createFunctionType([{ 'name': 'dateTime', 'type': AnyType, 'optional': false }], dateTimeType, {
              'description': 'Creates a DateTime from a table of UTC time components.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const randomType: LuauType = { 'kind': 'TypeReference', 'name': 'Random' };
  globals.set(
    'Random',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([{ 'name': 'seed', 'type': NumberType, 'optional': true }], randomType, {
              'description': 'Creates a new Random number generator with an optional seed.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const physicalPropertiesType: LuauType = { 'kind': 'TypeReference', 'name': 'PhysicalProperties' };
  globals.set(
    'PhysicalProperties',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'density', 'type': NumberType, 'optional': false },
                { 'name': 'friction', 'type': NumberType, 'optional': true },
                { 'name': 'elasticity', 'type': NumberType, 'optional': true },
                { 'name': 'frictionWeight', 'type': NumberType, 'optional': true },
                { 'name': 'elasticityWeight', 'type': NumberType, 'optional': true },
              ],
              physicalPropertiesType,
              {
                'description':
                  'Creates custom PhysicalProperties from a material or explicit density, friction, and elasticity values.',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const vector2int16Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector2int16' };
  globals.set(
    'Vector2int16',
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
              vector2int16Type,
              { 'description': 'Creates a new Vector2int16 from integer x and y components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const vector3int16Type: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3int16' };
  globals.set(
    'Vector3int16',
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
              vector3int16Type,
              { 'description': 'Creates a new Vector3int16 from integer x, y, and z components.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const region3int16Type: LuauType = { 'kind': 'TypeReference', 'name': 'Region3int16' };
  globals.set(
    'Region3int16',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'min', 'type': vector3int16Type, 'optional': false },
                { 'name': 'max', 'type': vector3int16Type, 'optional': false },
              ],
              region3int16Type,
              { 'description': 'Creates a new Region3int16 from two Vector3int16 corners.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const catalogSearchParamsType: LuauType = { 'kind': 'TypeReference', 'name': 'CatalogSearchParams' };
  globals.set(
    'CatalogSearchParams',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], catalogSearchParamsType, {
              'description': 'Creates a new CatalogSearchParams object for searching the avatar catalog.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const sharedTableType: LuauType = { 'kind': 'TypeReference', 'name': 'SharedTable' };
  globals.set(
    'SharedTable',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], sharedTableType, {
              'description': 'Creates a new empty SharedTable for cross-thread data sharing.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'clone',
          {
            'type': createFunctionType(
              [
                { 'name': 'st', 'type': sharedTableType, 'optional': false },
                { 'name': 'freezeClone', 'type': BooleanType, 'optional': true },
              ],
              sharedTableType,
              { 'description': 'Creates a clone of the given SharedTable, optionally freezing the clone.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'cloneAndFreeze',
          {
            'type': createFunctionType(
              [{ 'name': 'st', 'type': sharedTableType, 'optional': false }],
              sharedTableType,
              {
                'description': 'Creates a frozen clone of the given SharedTable.',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'isFrozen',
          {
            'type': createFunctionType([{ 'name': 'st', 'type': sharedTableType, 'optional': false }], BooleanType, {
              'description': 'Returns whether the given SharedTable is frozen.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'size',
          {
            'type': createFunctionType([{ 'name': 'st', 'type': sharedTableType, 'optional': false }], NumberType, {
              'description': 'Returns the number of entries in the given SharedTable.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'clear',
          {
            'type': createFunctionType([{ 'name': 'st', 'type': sharedTableType, 'optional': false }], NilType, {
              'description': 'Removes all entries from the given SharedTable.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const dockWidgetPluginGuiInfoType: LuauType = { 'kind': 'TypeReference', 'name': 'DockWidgetPluginGuiInfo' };
  globals.set(
    'DockWidgetPluginGuiInfo',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'initDockState', 'type': AnyType, 'optional': true },
                { 'name': 'initEnabled', 'type': BooleanType, 'optional': true },
                { 'name': 'overrideRestore', 'type': BooleanType, 'optional': true },
                { 'name': 'floatXSize', 'type': NumberType, 'optional': true },
                { 'name': 'floatYSize', 'type': NumberType, 'optional': true },
                { 'name': 'minWidth', 'type': NumberType, 'optional': true },
                { 'name': 'minHeight', 'type': NumberType, 'optional': true },
              ],
              dockWidgetPluginGuiInfoType,
              {
                'description': 'Creates a new DockWidgetPluginGuiInfo for configuring plugin widget docking behavior.',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const fontType: LuauType = { 'kind': 'TypeReference', 'name': 'Font' };
  globals.set(
    'Font',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'family', 'type': StringType, 'optional': false },
                { 'name': 'weight', 'type': AnyType, 'optional': true },
                { 'name': 'style', 'type': AnyType, 'optional': true },
              ],
              fontType,
              {
                'description':
                  'Creates a new Font from a font family asset ID or path, with optional weight and style.',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromEnum',
          {
            'type': createFunctionType([{ 'name': 'font', 'type': AnyType, 'optional': false }], fontType, {
              'description': 'Creates a Font from an Enum.Font value.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromId',
          {
            'type': createFunctionType(
              [
                { 'name': 'id', 'type': NumberType, 'optional': false },
                { 'name': 'weight', 'type': AnyType, 'optional': true },
                { 'name': 'style', 'type': AnyType, 'optional': true },
              ],
              fontType,
              { 'description': 'Creates a Font from a font asset ID with optional weight and style.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
        [
          'fromName',
          {
            'type': createFunctionType(
              [
                { 'name': 'name', 'type': StringType, 'optional': false },
                { 'name': 'weight', 'type': AnyType, 'optional': true },
                { 'name': 'style', 'type': AnyType, 'optional': true },
              ],
              fontType,
              { 'description': 'Creates a Font from a font name with optional weight and style.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const facesType: LuauType = { 'kind': 'TypeReference', 'name': 'Faces' };
  globals.set(
    'Faces',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], facesType, {
              'isVariadic': true,
              'description': 'Creates a new Faces object from a combination of Enum.NormalId values.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const axesType: LuauType = { 'kind': 'TypeReference', 'name': 'Axes' };
  globals.set(
    'Axes',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType([], axesType, {
              'isVariadic': true,
              'description': 'Creates a new Axes object from a combination of Enum.Axis or Enum.NormalId values.',
            }),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const pathWaypointType: LuauType = { 'kind': 'TypeReference', 'name': 'PathWaypoint' };
  globals.set(
    'PathWaypoint',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'position', 'type': vector3Type, 'optional': false },
                { 'name': 'action', 'type': AnyType, 'optional': true },
                { 'name': 'label', 'type': StringType, 'optional': true },
              ],
              pathWaypointType,
              { 'description': 'Creates a new PathWaypoint at the given position with optional action and label.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const numberSequenceKeypointType: LuauType = { 'kind': 'TypeReference', 'name': 'NumberSequenceKeypoint' };
  globals.set(
    'NumberSequenceKeypoint',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'time', 'type': NumberType, 'optional': false },
                { 'name': 'value', 'type': NumberType, 'optional': false },
                { 'name': 'envelope', 'type': NumberType, 'optional': true },
              ],
              numberSequenceKeypointType,
              {
                'description':
                  'Creates a new NumberSequenceKeypoint at the given time with a value and optional envelope.',
              },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );

  const colorSequenceKeypointType: LuauType = { 'kind': 'TypeReference', 'name': 'ColorSequenceKeypoint' };
  globals.set(
    'ColorSequenceKeypoint',
    createTableType(
      new Map([
        [
          'new',
          {
            'type': createFunctionType(
              [
                { 'name': 'time', 'type': NumberType, 'optional': false },
                { 'name': 'color', 'type': color3Type, 'optional': false },
              ],
              colorSequenceKeypointType,
              { 'description': 'Creates a new ColorSequenceKeypoint at the given time with the given color.' },
            ),
            'readonly': true,
            'optional': false,
          },
        ],
      ]),
    ),
  );
};
