import {
  AnyType,
  BooleanType,
  NilType,
  NumberType,
  StringType,
  createArrayType,
  createFunctionType,
  createTableType,
  type LuauType,
  type PropertyType,
} from '@typings/types';

const prop = (type: LuauType, readonly = true, deprecated?: { deprecated: true; message?: string }): PropertyType => ({
  type,
  readonly,
  'optional': false,
  'deprecated': deprecated?.deprecated ?? false,
  ...(deprecated?.message ? { 'deprecationMessage': deprecated.message } : {}),
});

const methodProp = (
  params: Array<{ name: string; type: LuauType; optional?: boolean }>,
  returnType: LuauType,
  description?: string,
): PropertyType => ({
  'type': createFunctionType(
    params.map(p => ({ 'name': p.name, 'type': p.type, 'optional': p.optional ?? false })),
    returnType,
    description !== undefined ? { description } : undefined,
  ),
  'readonly': true,
  'optional': false,
});

/** Creates the RBXScriptConnection type definition with Connected and Disconnect members. */
export const createRBXScriptConnectionType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Connected', prop(BooleanType)],
      ['Disconnect', methodProp([], NilType, 'Disconnects the connection from the signal')],
    ]),
  );

/** Creates an RBXScriptSignal type with Connect, ConnectParallel, Once, and Wait members. */
export const createRBXScriptSignalType = (callbackParams: Array<{ name: string; type: LuauType }>): LuauType => {
  const connectionType = createRBXScriptConnectionType();
  const callbackType = createFunctionType(
    callbackParams.map(p => ({ ...p, 'optional': false })),
    NilType,
  );

  const waitReturnType = callbackParams.length > 0 ? callbackParams[0]!.type : NilType;

  return createTableType(
    new Map<string, PropertyType>([
      [
        'Connect',
        methodProp(
          [{ 'name': 'callback', 'type': callbackType }],
          connectionType,
          'Connects a callback function to the signal, returns a connection',
        ),
      ],
      [
        'ConnectParallel',
        methodProp(
          [{ 'name': 'callback', 'type': callbackType }],
          connectionType,
          'Connects a callback that runs in parallel, returns a connection',
        ),
      ],
      [
        'Once',
        methodProp(
          [{ 'name': 'callback', 'type': callbackType }],
          connectionType,
          'Connects a callback that fires only once, then disconnects',
        ),
      ],
      ['Wait', methodProp([], waitReturnType, 'Yields the current thread until the signal fires')],
    ]),
  );
};

/** Creates a generic RBXScriptSignal type without specific callback parameters. */
export const createGenericRBXScriptSignalType = (): LuauType => createRBXScriptSignalType([]);

/** Creates the Vector2 instance type definition with X, Y components and vector operations. */
export const createVector2InstanceType = (): LuauType => {
  const vector2Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector2' };

  return createTableType(
    new Map<string, PropertyType>([
      ['X', prop(NumberType)],
      ['Y', prop(NumberType)],
      ['Magnitude', prop(NumberType)],
      ['Unit', prop(vector2Ref)],
      ['Abs', methodProp([], vector2Ref, "Returns a new Vector2 with each component's absolute value")],
      ['Ceil', methodProp([], vector2Ref, 'Returns a new Vector2 with each component rounded up')],
      ['Floor', methodProp([], vector2Ref, 'Returns a new Vector2 with each component rounded down')],
      ['Sign', methodProp([], vector2Ref, "Returns a new Vector2 with each component's sign (-1, 0, or 1)")],
      [
        'Angle',
        methodProp(
          [
            { 'name': 'other', 'type': vector2Ref },
            { 'name': 'isSigned', 'type': BooleanType, 'optional': true },
          ],
          NumberType,
          'Returns the angle in radians between two vectors',
        ),
      ],
      [
        'Cross',
        methodProp(
          [{ 'name': 'other', 'type': vector2Ref }],
          NumberType,
          'Returns the cross product (scalar) of two 2D vectors',
        ),
      ],
      [
        'Dot',
        methodProp([{ 'name': 'other', 'type': vector2Ref }], NumberType, 'Returns the dot product of two vectors'),
      ],
      [
        'FuzzyEq',
        methodProp(
          [
            { 'name': 'other', 'type': vector2Ref },
            { 'name': 'epsilon', 'type': NumberType, 'optional': true },
          ],
          BooleanType,
          'Returns true if the vectors are approximately equal within epsilon',
        ),
      ],
      [
        'Lerp',
        methodProp(
          [
            { 'name': 'goal', 'type': vector2Ref },
            { 'name': 'alpha', 'type': NumberType },
          ],
          vector2Ref,
          'Returns a vector linearly interpolated between this and goal by alpha',
        ),
      ],
      [
        'Max',
        methodProp(
          [{ 'name': 'others', 'type': vector2Ref }],
          vector2Ref,
          'Returns a vector with the maximum of each component',
        ),
      ],
      [
        'Min',
        methodProp(
          [{ 'name': 'others', 'type': vector2Ref }],
          vector2Ref,
          'Returns a vector with the minimum of each component',
        ),
      ],
    ]),
  );
};

/** Creates the Vector3 instance type definition with X, Y, Z components and vector operations. */
export const createVector3InstanceType = (): LuauType => {
  const vector3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };

  return createTableType(
    new Map<string, PropertyType>([
      ['X', prop(NumberType)],
      ['Y', prop(NumberType)],
      ['Z', prop(NumberType)],
      ['Magnitude', prop(NumberType)],
      ['Unit', prop(vector3Ref)],
      ['Abs', methodProp([], vector3Ref, "Returns a new Vector3 with each component's absolute value")],
      ['Ceil', methodProp([], vector3Ref, 'Returns a new Vector3 with each component rounded up')],
      ['Floor', methodProp([], vector3Ref, 'Returns a new Vector3 with each component rounded down')],
      ['Sign', methodProp([], vector3Ref, "Returns a new Vector3 with each component's sign (-1, 0, or 1)")],
      [
        'Angle',
        methodProp(
          [
            { 'name': 'other', 'type': vector3Ref },
            { 'name': 'axis', 'type': vector3Ref, 'optional': true },
          ],
          NumberType,
          'Returns the angle in radians between two vectors',
        ),
      ],
      [
        'Cross',
        methodProp([{ 'name': 'other', 'type': vector3Ref }], vector3Ref, 'Returns the cross product of two vectors'),
      ],
      [
        'Dot',
        methodProp([{ 'name': 'other', 'type': vector3Ref }], NumberType, 'Returns the dot product of two vectors'),
      ],
      [
        'FuzzyEq',
        methodProp(
          [
            { 'name': 'other', 'type': vector3Ref },
            { 'name': 'epsilon', 'type': NumberType, 'optional': true },
          ],
          BooleanType,
          'Returns true if the vectors are approximately equal within epsilon',
        ),
      ],
      [
        'Lerp',
        methodProp(
          [
            { 'name': 'goal', 'type': vector3Ref },
            { 'name': 'alpha', 'type': NumberType },
          ],
          vector3Ref,
          'Returns a vector linearly interpolated between this and goal by alpha',
        ),
      ],
      [
        'Max',
        methodProp(
          [{ 'name': 'others', 'type': vector3Ref }],
          vector3Ref,
          'Returns a vector with the maximum of each component',
        ),
      ],
      [
        'Min',
        methodProp(
          [{ 'name': 'others', 'type': vector3Ref }],
          vector3Ref,
          'Returns a vector with the minimum of each component',
        ),
      ],
    ]),
  );
};

/** Creates the CFrame instance type definition with position, orientation, and transform operations. */
export const createCFrameInstanceType = (): LuauType => {
  const cframeRef: LuauType = { 'kind': 'TypeReference', 'name': 'CFrame' };
  const vector3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };

  return createTableType(
    new Map<string, PropertyType>([
      ['Position', prop(vector3Ref)],
      ['p', prop(vector3Ref, true, { 'deprecated': true, 'message': 'Use Position instead' })],
      ['Rotation', prop(cframeRef)],
      ['X', prop(NumberType)],
      ['Y', prop(NumberType)],
      ['Z', prop(NumberType)],
      ['LookVector', prop(vector3Ref)],
      ['RightVector', prop(vector3Ref)],
      ['UpVector', prop(vector3Ref)],
      ['XVector', prop(vector3Ref)],
      ['YVector', prop(vector3Ref)],
      ['ZVector', prop(vector3Ref)],
      ['Inverse', methodProp([], cframeRef, 'Returns the inverse of this CFrame')],
      [
        'Lerp',
        methodProp(
          [
            { 'name': 'goal', 'type': cframeRef },
            { 'name': 'alpha', 'type': NumberType },
          ],
          cframeRef,
          'Returns a CFrame interpolated between this and goal by alpha',
        ),
      ],
      ['Orthonormalize', methodProp([], cframeRef, 'Returns a CFrame with a normalized rotation matrix')],
      [
        'ToWorldSpace',
        methodProp(
          [{ 'name': 'cf', 'type': cframeRef }],
          cframeRef,
          'Transforms a CFrame from local space to world space',
        ),
      ],
      [
        'ToObjectSpace',
        methodProp(
          [{ 'name': 'cf', 'type': cframeRef }],
          cframeRef,
          'Transforms a CFrame from world space to local space',
        ),
      ],
      [
        'PointToWorldSpace',
        methodProp(
          [{ 'name': 'v3', 'type': vector3Ref }],
          vector3Ref,
          'Transforms a Vector3 from local space to world space',
        ),
      ],
      [
        'PointToObjectSpace',
        methodProp(
          [{ 'name': 'v3', 'type': vector3Ref }],
          vector3Ref,
          'Transforms a Vector3 from world space to local space',
        ),
      ],
      [
        'VectorToWorldSpace',
        methodProp(
          [{ 'name': 'v3', 'type': vector3Ref }],
          vector3Ref,
          'Transforms a direction from local space to world space',
        ),
      ],
      [
        'VectorToObjectSpace',
        methodProp(
          [{ 'name': 'v3', 'type': vector3Ref }],
          vector3Ref,
          'Transforms a direction from world space to local space',
        ),
      ],
      [
        'GetComponents',
        methodProp([], AnyType, 'Returns the 12 components of the CFrame (position and rotation matrix)'),
      ],
      ['ToEulerAnglesXYZ', methodProp([], AnyType, 'Returns the rotation as Euler angles in radians (X, Y, Z order)')],
      ['ToEulerAnglesYXZ', methodProp([], AnyType, 'Returns the rotation as Euler angles in radians (Y, X, Z order)')],
      ['ToOrientation', methodProp([], AnyType, 'Returns the rotation as orientation angles in radians')],
      ['ToAxisAngle', methodProp([], AnyType, 'Returns the rotation as an axis and angle')],
      [
        'FuzzyEq',
        methodProp(
          [
            { 'name': 'other', 'type': cframeRef },
            { 'name': 'epsilon', 'type': NumberType, 'optional': true },
          ],
          BooleanType,
          'Returns true if the CFrames are approximately equal within epsilon',
        ),
      ],
    ]),
  );
};

/** Creates the Color3 instance type definition with R, G, B components and color operations. */
export const createColor3InstanceType = (): LuauType => {
  const color3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Color3' };

  return createTableType(
    new Map<string, PropertyType>([
      ['R', prop(NumberType)],
      ['G', prop(NumberType)],
      ['B', prop(NumberType)],
      [
        'Lerp',
        methodProp(
          [
            { 'name': 'goal', 'type': color3Ref },
            { 'name': 'alpha', 'type': NumberType },
          ],
          color3Ref,
          'Returns a Color3 interpolated between this and goal by alpha',
        ),
      ],
      ['ToHSV', methodProp([], AnyType, 'Returns the hue, saturation, and value of the color')],
      ['ToHex', methodProp([], StringType, 'Returns the color as a hex string')],
    ]),
  );
};

/** Creates the UDim instance type definition with Scale and Offset components. */
export const createUDimInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Scale', prop(NumberType)],
      ['Offset', prop(NumberType)],
    ]),
  );

/** Creates the UDim2 instance type definition with X, Y UDim components and Lerp. */
export const createUDim2InstanceType = (): LuauType => {
  const udim2Ref: LuauType = { 'kind': 'TypeReference', 'name': 'UDim2' };
  const udimRef: LuauType = { 'kind': 'TypeReference', 'name': 'UDim' };

  return createTableType(
    new Map<string, PropertyType>([
      ['X', prop(udimRef)],
      ['Y', prop(udimRef)],
      ['Width', prop(udimRef)],
      ['Height', prop(udimRef)],
      [
        'Lerp',
        methodProp(
          [
            { 'name': 'goal', 'type': udim2Ref },
            { 'name': 'alpha', 'type': NumberType },
          ],
          udim2Ref,
          'Returns a UDim2 interpolated between this and goal by alpha',
        ),
      ],
    ]),
  );
};

/** Creates the BrickColor instance type definition with Name, Number, Color, and RGB components. */
export const createBrickColorInstanceType = (): LuauType => {
  const color3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Color3' };

  return createTableType(
    new Map<string, PropertyType>([
      ['Name', prop(StringType)],
      ['Number', prop(NumberType)],
      ['Color', prop(color3Ref)],
      ['r', prop(NumberType)],
      ['g', prop(NumberType)],
      ['b', prop(NumberType)],
    ]),
  );
};

/** Creates the TweenInfo instance type definition with animation timing parameters. */
export const createTweenInfoInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Time', prop(NumberType)],
      ['EasingStyle', prop({ 'kind': 'TypeReference', 'name': 'Enum.EasingStyle' })],
      ['EasingDirection', prop({ 'kind': 'TypeReference', 'name': 'Enum.EasingDirection' })],
      ['RepeatCount', prop(NumberType)],
      ['Reverses', prop(BooleanType)],
      ['DelayTime', prop(NumberType)],
    ]),
  );

/** Creates the NumberRange instance type definition with Min and Max values. */
export const createNumberRangeInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Min', prop(NumberType)],
      ['Max', prop(NumberType)],
    ]),
  );

/** Creates the NumberSequenceKeypoint instance type definition with Time, Value, and Envelope. */
export const createNumberSequenceKeypointInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Time', prop(NumberType)],
      ['Value', prop(NumberType)],
      ['Envelope', prop(NumberType)],
    ]),
  );

/** Creates the NumberSequence instance type definition with a Keypoints array. */
export const createNumberSequenceInstanceType = (): LuauType => {
  const keypointType: LuauType = { 'kind': 'TypeReference', 'name': 'NumberSequenceKeypoint' };

  return createTableType(new Map<string, PropertyType>([['Keypoints', prop(createArrayType(keypointType))]]));
};

/** Creates the ColorSequenceKeypoint instance type definition with Time and Color3 Value. */
export const createColorSequenceKeypointInstanceType = (): LuauType => {
  const color3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Color3' };

  return createTableType(
    new Map<string, PropertyType>([
      ['Time', prop(NumberType)],
      ['Value', prop(color3Ref)],
    ]),
  );
};

/** Creates the ColorSequence instance type definition with a Keypoints array. */
export const createColorSequenceInstanceType = (): LuauType => {
  const keypointType: LuauType = { 'kind': 'TypeReference', 'name': 'ColorSequenceKeypoint' };

  return createTableType(new Map<string, PropertyType>([['Keypoints', prop(createArrayType(keypointType))]]));
};

/** Creates the Ray instance type definition with Origin, Direction, and spatial query methods. */
export const createRayInstanceType = (): LuauType => {
  const vector3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };
  const rayRef: LuauType = { 'kind': 'TypeReference', 'name': 'Ray' };

  return createTableType(
    new Map<string, PropertyType>([
      ['Origin', prop(vector3Ref)],
      ['Direction', prop(vector3Ref)],
      ['Unit', prop(rayRef)],
      [
        'ClosestPoint',
        methodProp(
          [{ 'name': 'point', 'type': vector3Ref }],
          vector3Ref,
          'Returns the closest point on the ray to a given point',
        ),
      ],
      [
        'Distance',
        methodProp(
          [{ 'name': 'point', 'type': vector3Ref }],
          NumberType,
          'Returns the distance from the ray to a given point',
        ),
      ],
    ]),
  );
};

/** Creates the Region3 instance type definition with CFrame, Size, and ExpandToGrid. */
export const createRegion3InstanceType = (): LuauType => {
  const vector3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };
  const cframeRef: LuauType = { 'kind': 'TypeReference', 'name': 'CFrame' };
  const region3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Region3' };

  return createTableType(
    new Map<string, PropertyType>([
      ['CFrame', prop(cframeRef)],
      ['Size', prop(vector3Ref)],
      [
        'ExpandToGrid',
        methodProp(
          [{ 'name': 'resolution', 'type': NumberType }],
          region3Ref,
          'Expands the region to align with a grid of the given resolution',
        ),
      ],
    ]),
  );
};

/** Creates the Rect instance type definition with Min, Max, Width, and Height. */
export const createRectInstanceType = (): LuauType => {
  const vector2Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector2' };

  return createTableType(
    new Map<string, PropertyType>([
      ['Min', prop(vector2Ref)],
      ['Max', prop(vector2Ref)],
      ['Width', prop(NumberType)],
      ['Height', prop(NumberType)],
    ]),
  );
};

/** Creates the DateTime instance type definition with timestamps and formatting methods. */
export const createDateTimeInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['UnixTimestamp', prop(NumberType)],
      ['UnixTimestampMillis', prop(NumberType)],
      ['ToUniversalTime', methodProp([], AnyType, 'Returns a table of date/time components in UTC')],
      ['ToLocalTime', methodProp([], AnyType, 'Returns a table of date/time components in local time')],
      ['ToIsoDate', methodProp([], StringType, 'Returns the date/time as an ISO 8601 string')],
      [
        'FormatUniversalTime',
        methodProp(
          [
            { 'name': 'format', 'type': StringType },
            { 'name': 'locale', 'type': StringType, 'optional': true },
          ],
          StringType,
          'Returns the date/time formatted as a UTC string',
        ),
      ],
      [
        'FormatLocalTime',
        methodProp(
          [
            { 'name': 'format', 'type': StringType },
            { 'name': 'locale', 'type': StringType, 'optional': true },
          ],
          StringType,
          'Returns the date/time formatted as a local time string',
        ),
      ],
    ]),
  );

/** Creates the Random instance type definition with deterministic random generation methods. */
export const createRandomInstanceType = (): LuauType => {
  const vector3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };
  const randomRef: LuauType = { 'kind': 'TypeReference', 'name': 'Random' };

  return createTableType(
    new Map<string, PropertyType>([
      [
        'NextNumber',
        methodProp(
          [
            { 'name': 'min', 'type': NumberType, 'optional': true },
            { 'name': 'max', 'type': NumberType, 'optional': true },
          ],
          NumberType,
          'Returns a random number between min and max (or 0 and 1)',
        ),
      ],
      [
        'NextInteger',
        methodProp(
          [
            { 'name': 'min', 'type': NumberType },
            { 'name': 'max', 'type': NumberType },
          ],
          NumberType,
          'Returns a random integer between min and max inclusive',
        ),
      ],
      ['NextUnitVector', methodProp([], vector3Ref, 'Returns a random unit Vector3')],
      [
        'Shuffle',
        methodProp(
          [{ 'name': 't', 'type': createArrayType(AnyType) }],
          NilType,
          'Randomly shuffles the elements in a table',
        ),
      ],
      ['Clone', methodProp([], randomRef, 'Creates a copy of the Random object')],
    ]),
  );
};

/** Creates the RaycastParams instance type definition with filter and collision configuration. */
export const createRaycastParamsInstanceType = (): LuauType => {
  const instanceRef: LuauType = { 'kind': 'TypeReference', 'name': 'Instance' };

  return createTableType(
    new Map<string, PropertyType>([
      ['FilterDescendantsInstances', prop(createArrayType(instanceRef), false)],
      ['FilterType', prop({ 'kind': 'TypeReference', 'name': 'Enum.RaycastFilterType' }, false)],
      ['IgnoreWater', prop(BooleanType, false)],
      ['CollisionGroup', prop(StringType, false)],
      ['RespectCanCollide', prop(BooleanType, false)],
      ['BruteForceAllSlow', prop(BooleanType, false)],
      [
        'AddToFilter',
        methodProp(
          [{ 'name': 'instances', 'type': { 'kind': 'Union', 'types': [instanceRef, createArrayType(instanceRef)] } }],
          NilType,
          'Adds instances to the filter list',
        ),
      ],
    ]),
  );
};

/** Creates the OverlapParams instance type definition with spatial query configuration. */
export const createOverlapParamsInstanceType = (): LuauType => {
  const instanceRef: LuauType = { 'kind': 'TypeReference', 'name': 'Instance' };

  return createTableType(
    new Map<string, PropertyType>([
      ['FilterDescendantsInstances', prop(createArrayType(instanceRef), false)],
      ['FilterType', prop({ 'kind': 'TypeReference', 'name': 'Enum.RaycastFilterType' }, false)],
      ['MaxParts', prop(NumberType, false)],
      ['CollisionGroup', prop(StringType, false)],
      ['RespectCanCollide', prop(BooleanType, false)],
      ['BruteForceAllSlow', prop(BooleanType, false)],
      [
        'AddToFilter',
        methodProp(
          [{ 'name': 'instances', 'type': { 'kind': 'Union', 'types': [instanceRef, createArrayType(instanceRef)] } }],
          NilType,
          'Adds instances to the filter list',
        ),
      ],
    ]),
  );
};

/** Creates the RaycastResult instance type definition with hit Instance, Position, Normal, Material, and Distance. */
export const createRaycastResultInstanceType = (): LuauType => {
  const instanceRef: LuauType = { 'kind': 'TypeReference', 'name': 'Instance' };
  const vector3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };

  return createTableType(
    new Map<string, PropertyType>([
      ['Instance', prop(instanceRef)],
      ['Position', prop(vector3Ref)],
      ['Normal', prop(vector3Ref)],
      ['Material', prop({ 'kind': 'TypeReference', 'name': 'Enum.Material' })],
      ['Distance', prop(NumberType)],
    ]),
  );
};

/** Creates the PathWaypoint instance type definition with Position, Action, and Label. */
export const createPathWaypointInstanceType = (): LuauType => {
  const vector3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3' };

  return createTableType(
    new Map<string, PropertyType>([
      ['Position', prop(vector3Ref)],
      ['Action', prop({ 'kind': 'TypeReference', 'name': 'Enum.PathWaypointAction' })],
      ['Label', prop(StringType)],
    ]),
  );
};

/** Creates the Font instance type definition with Family, Weight, Style, and Bold. */
export const createFontInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Family', prop(StringType)],
      ['Weight', prop({ 'kind': 'TypeReference', 'name': 'Enum.FontWeight' })],
      ['Style', prop({ 'kind': 'TypeReference', 'name': 'Enum.FontStyle' })],
      ['Bold', prop(BooleanType)],
    ]),
  );

/** Creates the Faces instance type definition with boolean properties for each face direction. */
export const createFacesInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Top', prop(BooleanType)],
      ['Bottom', prop(BooleanType)],
      ['Left', prop(BooleanType)],
      ['Right', prop(BooleanType)],
      ['Back', prop(BooleanType)],
      ['Front', prop(BooleanType)],
    ]),
  );

/** Creates the Axes instance type definition with boolean properties for each axis and face direction. */
export const createAxesInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['X', prop(BooleanType)],
      ['Y', prop(BooleanType)],
      ['Z', prop(BooleanType)],
      ['Top', prop(BooleanType)],
      ['Bottom', prop(BooleanType)],
      ['Left', prop(BooleanType)],
      ['Right', prop(BooleanType)],
      ['Back', prop(BooleanType)],
      ['Front', prop(BooleanType)],
    ]),
  );

/** Creates the Vector2int16 instance type definition with X and Y integer components. */
export const createVector2int16InstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['X', prop(NumberType)],
      ['Y', prop(NumberType)],
    ]),
  );

/** Creates the Vector3int16 instance type definition with X, Y, and Z integer components. */
export const createVector3int16InstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['X', prop(NumberType)],
      ['Y', prop(NumberType)],
      ['Z', prop(NumberType)],
    ]),
  );

/** Creates the Region3int16 instance type definition with Min and Max Vector3int16 corners. */
export const createRegion3int16InstanceType = (): LuauType => {
  const vector3int16Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3int16' };

  return createTableType(
    new Map<string, PropertyType>([
      ['Min', prop(vector3int16Ref)],
      ['Max', prop(vector3int16Ref)],
    ]),
  );
};

/** Creates the PhysicalProperties instance type definition with Density, Friction, and Elasticity. */
export const createPhysicalPropertiesInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Density', prop(NumberType)],
      ['Friction', prop(NumberType)],
      ['Elasticity', prop(NumberType)],
      ['FrictionWeight', prop(NumberType)],
      ['ElasticityWeight', prop(NumberType)],
    ]),
  );

/** Creates the CatalogSearchParams instance type definition with search and filter configuration. */
export const createCatalogSearchParamsInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['SearchKeyword', prop(StringType, false)],
      ['MinPrice', prop(NumberType, false)],
      ['MaxPrice', prop(NumberType, false)],
      ['SortType', prop({ 'kind': 'TypeReference', 'name': 'Enum.CatalogSortType' }, false)],
      ['SortAggregation', prop({ 'kind': 'TypeReference', 'name': 'Enum.CatalogSortAggregation' }, false)],
      ['CategoryFilter', prop({ 'kind': 'TypeReference', 'name': 'Enum.CatalogCategoryFilter' }, false)],
      ['AssetTypes', prop(createArrayType(AnyType), false)],
      ['BundleTypes', prop(createArrayType(AnyType), false)],
      ['IncludeOffSale', prop(BooleanType, false)],
      ['CreatorName', prop(StringType, false)],
    ]),
  );

/** Creates the RotationCurveKey instance type definition with Time, CFrame Value, and Interpolation. */
export const createRotationCurveKeyInstanceType = (): LuauType => {
  const cframeRef: LuauType = { 'kind': 'TypeReference', 'name': 'CFrame' };

  return createTableType(
    new Map<string, PropertyType>([
      ['Time', prop(NumberType)],
      ['Value', prop(cframeRef)],
      ['Interpolation', prop({ 'kind': 'TypeReference', 'name': 'Enum.KeyInterpolationMode' })],
    ]),
  );
};

/** Creates the FloatCurveKey instance type definition with Time, Value, Interpolation, and tangents. */
export const createFloatCurveKeyInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Time', prop(NumberType)],
      ['Value', prop(NumberType)],
      ['Interpolation', prop({ 'kind': 'TypeReference', 'name': 'Enum.KeyInterpolationMode' })],
      ['LeftTangent', prop(NumberType)],
      ['RightTangent', prop(NumberType)],
    ]),
  );

/** Creates the EnumItem instance type definition with Name, Value, and EnumType. */
export const createEnumItemInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Name', prop(StringType)],
      ['Value', prop(NumberType)],
      ['EnumType', prop({ 'kind': 'TypeReference', 'name': 'Enum' })],
    ]),
  );

/** Creates the SharedTable instance type definition with thread-safe data storage operations. */
export const createSharedTableInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      [
        'clone',
        methodProp(
          [{ 'name': 'freezeClone', 'type': BooleanType, 'optional': true }],
          {
            'kind': 'TypeReference',
            'name': 'SharedTable',
          },
          'Creates a copy of the SharedTable',
        ),
      ],
      [
        'cloneAndFreeze',
        methodProp(
          [],
          { 'kind': 'TypeReference', 'name': 'SharedTable' },
          'Creates an immutable copy of the SharedTable',
        ),
      ],
      ['isFrozen', methodProp([], BooleanType, 'Returns true if the SharedTable is frozen')],
      ['size', methodProp([], NumberType, 'Returns the number of entries in the SharedTable')],
      ['clear', methodProp([], NilType, 'Removes all entries from the SharedTable')],
    ]),
    { 'indexer': { 'keyType': { 'kind': 'Union', 'types': [StringType, NumberType] }, 'valueType': AnyType } },
  );

/** Creates the DockWidgetPluginGuiInfo instance type definition with dock state and size configuration. */
export const createDockWidgetPluginGuiInfoInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['InitialDockState', prop({ 'kind': 'TypeReference', 'name': 'Enum.InitialDockState' })],
      ['InitialEnabled', prop(BooleanType)],
      ['InitialEnabledShouldOverrideRestore', prop(BooleanType)],
      ['FloatingXSize', prop(NumberType)],
      ['FloatingYSize', prop(NumberType)],
      ['MinWidth', prop(NumberType)],
      ['MinHeight', prop(NumberType)],
    ]),
  );

/** Creates a map of all Roblox DataType instance types for type resolution lookup. */
export const createDataTypeInstances = (): Map<string, LuauType> =>
  new Map<string, LuauType>([
    ['Vector2', createVector2InstanceType()],
    ['Vector3', createVector3InstanceType()],
    ['Vector2int16', createVector2int16InstanceType()],
    ['Vector3int16', createVector3int16InstanceType()],
    ['CFrame', createCFrameInstanceType()],
    ['Color3', createColor3InstanceType()],
    ['UDim', createUDimInstanceType()],
    ['UDim2', createUDim2InstanceType()],
    ['BrickColor', createBrickColorInstanceType()],
    ['TweenInfo', createTweenInfoInstanceType()],
    ['NumberRange', createNumberRangeInstanceType()],
    ['NumberSequence', createNumberSequenceInstanceType()],
    ['NumberSequenceKeypoint', createNumberSequenceKeypointInstanceType()],
    ['ColorSequence', createColorSequenceInstanceType()],
    ['ColorSequenceKeypoint', createColorSequenceKeypointInstanceType()],
    ['Ray', createRayInstanceType()],
    ['Region3', createRegion3InstanceType()],
    ['Region3int16', createRegion3int16InstanceType()],
    ['Rect', createRectInstanceType()],
    ['DateTime', createDateTimeInstanceType()],
    ['Random', createRandomInstanceType()],
    ['RaycastParams', createRaycastParamsInstanceType()],
    ['OverlapParams', createOverlapParamsInstanceType()],
    ['RaycastResult', createRaycastResultInstanceType()],
    ['PathWaypoint', createPathWaypointInstanceType()],
    ['Font', createFontInstanceType()],
    ['Faces', createFacesInstanceType()],
    ['Axes', createAxesInstanceType()],
    ['PhysicalProperties', createPhysicalPropertiesInstanceType()],
    ['CatalogSearchParams', createCatalogSearchParamsInstanceType()],
    ['RotationCurveKey', createRotationCurveKeyInstanceType()],
    ['FloatCurveKey', createFloatCurveKeyInstanceType()],
    ['EnumItem', createEnumItemInstanceType()],
    ['SharedTable', createSharedTableInstanceType()],
    ['DockWidgetPluginGuiInfo', createDockWidgetPluginGuiInfoInstanceType()],
    ['RBXScriptSignal', createGenericRBXScriptSignalType()],
    ['RBXScriptConnection', createRBXScriptConnectionType()],
  ]);
