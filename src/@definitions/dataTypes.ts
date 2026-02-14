/**
 * Roblox DataType Definitions
 *
 * This module provides type definitions for Roblox DataTypes. DataTypes are
 * value types that represent various data structures used throughout the Roblox API,
 * including vectors, matrices, colors, and other compound types.
 *
 * Supported data types include:
 * - Vectors: Vector2, Vector3, Vector2int16, Vector3int16
 * - Transforms: CFrame
 * - Colors: Color3, BrickColor
 * - UI: UDim, UDim2, Rect
 * - Animation: TweenInfo, NumberSequence, ColorSequence
 * - Physics: Ray, Region3, RaycastParams, OverlapParams, PhysicalProperties
 * - Time: DateTime
 * - Randomness: Random
 * - Signals: RBXScriptSignal, RBXScriptConnection
 * - And many more...
 */

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

/**
 * Creates a property definition for a data type.
 *
 * @param type - The Luau type of the property
 * @param readonly - Whether the property is read-only (defaults to true)
 * @param deprecated - Optional deprecation information with deprecated flag and message
 * @returns A PropertyType definition
 */
const prop = (type: LuauType, readonly = true, deprecated?: { deprecated: true; message?: string }): PropertyType => ({
  type,
  readonly,
  'optional': false,
  'deprecated': deprecated?.deprecated ?? false,
  ...(deprecated?.message ? { 'deprecationMessage': deprecated.message } : {}),
});

/**
 * Creates a method property definition for a data type.
 *
 * @param params - Array of parameter definitions with name, type, and optional flag
 * @param returnType - The return type of the method
 * @returns A PropertyType definition wrapping a FunctionType
 */
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

/**
 * Creates the RBXScriptConnection type definition.
 *
 * RBXScriptConnection represents a connection to an event signal. It provides:
 * - Connected: A boolean indicating if the connection is still active
 * - Disconnect: A method to disconnect from the event
 *
 * @returns A TableType representing RBXScriptConnection
 */
export const createRBXScriptConnectionType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Connected', prop(BooleanType)],
      ['Disconnect', methodProp([], NilType, 'Disconnects the connection from the signal')],
    ]),
  );

/**
 * Creates an RBXScriptSignal type with the given callback parameter types.
 *
 * RBXScriptSignal represents an event that can be connected to. The generated type includes:
 * - Connect(callback): Connects a callback to fire when the event fires, returns RBXScriptConnection
 * - ConnectParallel(callback): Connects a callback to run in parallel, returns RBXScriptConnection
 * - Once(callback): Connects a callback that disconnects after first fire, returns RBXScriptConnection
 * - Wait(): Yields until the event fires and returns the event arguments
 *
 * @param callbackParams - Array of parameter definitions for the callback function
 * @returns A TableType representing the RBXScriptSignal
 */
export const createRBXScriptSignalType = (callbackParams: Array<{ name: string; type: LuauType }>): LuauType => {
  const connectionType = createRBXScriptConnectionType();
  const callbackType = createFunctionType(
    callbackParams.map(p => ({ ...p, 'optional': false })),
    NilType,
  );

  // Wait() returns the first callback parameter when assigned to a single variable
  // (Luau automatically extracts first value from tuple returns)
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

/**
 * Creates a generic RBXScriptSignal type without specific callback parameters.
 *
 * Used when the event parameters are not known or when creating a general
 * RBXScriptSignal type reference.
 *
 * @returns A TableType representing a generic RBXScriptSignal
 */
export const createGenericRBXScriptSignalType = (): LuauType => createRBXScriptSignalType([]);

/**
 * Creates the Vector2 instance type definition.
 *
 * Vector2 represents a 2D vector with X and Y components. Properties and methods include:
 * - X, Y: Numeric components
 * - Magnitude, Unit: Vector properties
 * - Abs, Ceil, Floor, Sign: Component-wise operations
 * - Angle, Cross, Dot: Vector operations
 * - FuzzyEq, Lerp, Max, Min: Utility methods
 *
 * @returns A TableType representing Vector2 instance
 */
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

/**
 * Creates the Vector3 instance type definition.
 *
 * Vector3 represents a 3D vector with X, Y, and Z components. Properties and methods include:
 * - X, Y, Z: Numeric components
 * - Magnitude, Unit: Vector properties
 * - Abs, Ceil, Floor, Sign: Component-wise operations
 * - Angle, Cross, Dot: Vector operations
 * - FuzzyEq, Lerp, Max, Min: Utility methods
 *
 * @returns A TableType representing Vector3 instance
 */
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

/**
 * Creates the CFrame instance type definition.
 *
 * CFrame (Coordinate Frame) represents a 3D position and orientation. Properties and methods include:
 * - Position, Rotation: Transform components
 * - X, Y, Z: Position components
 * - LookVector, RightVector, UpVector, XVector, YVector, ZVector: Directional vectors
 * - Inverse, Lerp, Orthonormalize: Transform operations
 * - ToWorldSpace, ToObjectSpace: Space conversions
 * - PointToWorldSpace, PointToObjectSpace: Point conversions
 * - VectorToWorldSpace, VectorToObjectSpace: Vector conversions
 * - GetComponents, ToEulerAnglesXYZ, ToEulerAnglesYXZ, ToOrientation, ToAxisAngle: Decomposition
 * - FuzzyEq: Comparison
 *
 * @returns A TableType representing CFrame instance
 */
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

/**
 * Creates the Color3 instance type definition.
 *
 * Color3 represents an RGB color. Properties and methods include:
 * - R, G, B: Color components (0-1 range)
 * - Lerp: Interpolates between two colors
 * - ToHSV: Converts to HSV representation
 * - ToHex: Converts to hexadecimal string
 *
 * @returns A TableType representing Color3 instance
 */
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

/**
 * Creates the UDim instance type definition.
 *
 * UDim represents a one-dimensional UI value with scale and offset components.
 * Properties include:
 * - Scale: Fraction of parent size (0-1)
 * - Offset: Pixel offset
 *
 * @returns A TableType representing UDim instance
 */
export const createUDimInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Scale', prop(NumberType)],
      ['Offset', prop(NumberType)],
    ]),
  );

/**
 * Creates the UDim2 instance type definition.
 *
 * UDim2 represents a two-dimensional UI value with X and Y UDim components.
 * Properties and methods include:
 * - X, Y: UDim components
 * - Width, Height: Aliases for X and Y
 * - Lerp: Interpolates between two UDim2 values
 *
 * @returns A TableType representing UDim2 instance
 */
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

/**
 * Creates the BrickColor instance type definition.
 *
 * BrickColor represents a legacy color value from the predefined Roblox palette.
 * Properties include:
 * - Name: The color name
 * - Number: The palette index
 * - Color: The Color3 equivalent
 * - r, g, b: RGB components (0-1 range)
 *
 * @returns A TableType representing BrickColor instance
 */
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

/**
 * Creates the TweenInfo instance type definition.
 *
 * TweenInfo describes the parameters for a tween animation. Properties include:
 * - Time: Duration in seconds
 * - EasingStyle: The easing function to use
 * - EasingDirection: Direction of the easing (In, Out, InOut)
 * - RepeatCount: Number of times to repeat (-1 for infinite)
 * - Reverses: Whether to reverse direction on repeat
 * - DelayTime: Delay before starting
 *
 * @returns A TableType representing TweenInfo instance
 */
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

/**
 * Creates the NumberRange instance type definition.
 *
 * NumberRange represents a range between two numbers. Properties include:
 * - Min: The minimum value
 * - Max: The maximum value
 *
 * @returns A TableType representing NumberRange instance
 */
export const createNumberRangeInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Min', prop(NumberType)],
      ['Max', prop(NumberType)],
    ]),
  );

/**
 * Creates the NumberSequenceKeypoint instance type definition.
 *
 * NumberSequenceKeypoint represents a single point in a NumberSequence.
 * Properties include:
 * - Time: Position in the sequence (0-1)
 * - Value: The numeric value at this point
 * - Envelope: Random variance range
 *
 * @returns A TableType representing NumberSequenceKeypoint instance
 */
export const createNumberSequenceKeypointInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Time', prop(NumberType)],
      ['Value', prop(NumberType)],
      ['Envelope', prop(NumberType)],
    ]),
  );

/**
 * Creates the NumberSequence instance type definition.
 *
 * NumberSequence represents a sequence of number values over time.
 * Properties include:
 * - Keypoints: Array of NumberSequenceKeypoint values
 *
 * @returns A TableType representing NumberSequence instance
 */
export const createNumberSequenceInstanceType = (): LuauType => {
  const keypointType: LuauType = { 'kind': 'TypeReference', 'name': 'NumberSequenceKeypoint' };

  return createTableType(new Map<string, PropertyType>([['Keypoints', prop(createArrayType(keypointType))]]));
};

/**
 * Creates the ColorSequenceKeypoint instance type definition.
 *
 * ColorSequenceKeypoint represents a single point in a ColorSequence.
 * Properties include:
 * - Time: Position in the sequence (0-1)
 * - Value: The Color3 value at this point
 *
 * @returns A TableType representing ColorSequenceKeypoint instance
 */
export const createColorSequenceKeypointInstanceType = (): LuauType => {
  const color3Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Color3' };

  return createTableType(
    new Map<string, PropertyType>([
      ['Time', prop(NumberType)],
      ['Value', prop(color3Ref)],
    ]),
  );
};

/**
 * Creates the ColorSequence instance type definition.
 *
 * ColorSequence represents a sequence of color values over time.
 * Properties include:
 * - Keypoints: Array of ColorSequenceKeypoint values
 *
 * @returns A TableType representing ColorSequence instance
 */
export const createColorSequenceInstanceType = (): LuauType => {
  const keypointType: LuauType = { 'kind': 'TypeReference', 'name': 'ColorSequenceKeypoint' };

  return createTableType(new Map<string, PropertyType>([['Keypoints', prop(createArrayType(keypointType))]]));
};

/**
 * Creates the Ray instance type definition.
 *
 * Ray represents a half-line with an origin and direction.
 * Properties and methods include:
 * - Origin: Starting point of the ray
 * - Direction: Direction vector of the ray
 * - Unit: Normalized version of the ray
 * - ClosestPoint: Returns the closest point on the ray to a given point
 * - Distance: Returns the distance from the ray to a given point
 *
 * @returns A TableType representing Ray instance
 */
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

/**
 * Creates the Region3 instance type definition.
 *
 * Region3 represents an axis-aligned 3D rectangular region.
 * Properties and methods include:
 * - CFrame: The center transform of the region
 * - Size: The dimensions of the region
 * - ExpandToGrid: Expands the region to align with a grid
 *
 * @returns A TableType representing Region3 instance
 */
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

/**
 * Creates the Rect instance type definition.
 *
 * Rect represents a 2D rectangle. Properties include:
 * - Min: Minimum corner (top-left) as Vector2
 * - Max: Maximum corner (bottom-right) as Vector2
 * - Width: Width of the rectangle
 * - Height: Height of the rectangle
 *
 * @returns A TableType representing Rect instance
 */
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

/**
 * Creates the DateTime instance type definition.
 *
 * DateTime represents a point in time. Properties and methods include:
 * - UnixTimestamp: Seconds since Unix epoch
 * - UnixTimestampMillis: Milliseconds since Unix epoch
 * - ToUniversalTime: Converts to UTC date table
 * - ToLocalTime: Converts to local date table
 * - ToIsoDate: Converts to ISO 8601 string
 * - FormatUniversalTime, FormatLocalTime: Custom formatting
 *
 * @returns A TableType representing DateTime instance
 */
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

/**
 * Creates the Random instance type definition.
 *
 * Random provides deterministic random number generation. Methods include:
 * - NextNumber: Returns a random float in a range
 * - NextInteger: Returns a random integer in a range
 * - NextUnitVector: Returns a random unit Vector3
 * - Shuffle: Randomly shuffles a table in-place
 * - Clone: Creates a copy of the Random object
 *
 * @returns A TableType representing Random instance
 */
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

/**
 * Creates the RaycastParams instance type definition.
 *
 * RaycastParams configures raycast behavior. Properties and methods include:
 * - FilterDescendantsInstances: Instances to filter
 * - FilterType: Include or exclude filter
 * - IgnoreWater: Whether to ignore Terrain water
 * - CollisionGroup: Collision group name to use
 * - RespectCanCollide: Whether to respect CanCollide property
 * - BruteForceAllSlow: Performance vs accuracy tradeoff
 * - AddToFilter: Method to add instances to the filter
 *
 * @returns A TableType representing RaycastParams instance
 */
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

/**
 * Creates the OverlapParams instance type definition.
 *
 * OverlapParams configures spatial query behavior. Properties and methods include:
 * - FilterDescendantsInstances: Instances to filter
 * - FilterType: Include or exclude filter
 * - MaxParts: Maximum number of parts to return
 * - CollisionGroup: Collision group name to use
 * - RespectCanCollide: Whether to respect CanCollide property
 * - BruteForceAllSlow: Performance vs accuracy tradeoff
 * - AddToFilter: Method to add instances to the filter
 *
 * @returns A TableType representing OverlapParams instance
 */
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

/**
 * Creates the RaycastResult instance type definition.
 *
 * RaycastResult is returned from raycast operations. Properties include:
 * - Instance: The Instance that was hit
 * - Position: The world position where the ray hit
 * - Normal: The surface normal at the hit point
 * - Material: The material at the hit point
 * - Distance: Distance from ray origin to hit point
 *
 * @returns A TableType representing RaycastResult instance
 */
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

/**
 * Creates the PathWaypoint instance type definition.
 *
 * PathWaypoint represents a point along a pathfinding path. Properties include:
 * - Position: The world position of the waypoint
 * - Action: The action to take at this waypoint (Walk, Jump)
 * - Label: Custom label for the waypoint
 *
 * @returns A TableType representing PathWaypoint instance
 */
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

/**
 * Creates the Font instance type definition.
 *
 * Font represents a text font configuration. Properties include:
 * - Family: The font family content ID
 * - Weight: The font weight enum
 * - Style: The font style enum
 * - Bold: Whether the font is bold
 *
 * @returns A TableType representing Font instance
 */
export const createFontInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Family', prop(StringType)],
      ['Weight', prop({ 'kind': 'TypeReference', 'name': 'Enum.FontWeight' })],
      ['Style', prop({ 'kind': 'TypeReference', 'name': 'Enum.FontStyle' })],
      ['Bold', prop(BooleanType)],
    ]),
  );

/**
 * Creates the Faces instance type definition.
 *
 * Faces represents a set of selected faces on a part. Properties include:
 * - Top, Bottom, Left, Right, Back, Front: Boolean for each face
 *
 * @returns A TableType representing Faces instance
 */
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

/**
 * Creates the Axes instance type definition.
 *
 * Axes represents a set of selected axes. Properties include:
 * - X, Y, Z: Boolean for each primary axis
 * - Top, Bottom, Left, Right, Back, Front: Boolean for each face direction
 *
 * @returns A TableType representing Axes instance
 */
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

/**
 * Creates the Vector2int16 instance type definition.
 *
 * Vector2int16 represents a 2D vector with 16-bit integer components.
 * Properties include:
 * - X, Y: Numeric components (integers)
 *
 * @returns A TableType representing Vector2int16 instance
 */
export const createVector2int16InstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['X', prop(NumberType)],
      ['Y', prop(NumberType)],
    ]),
  );

/**
 * Creates the Vector3int16 instance type definition.
 *
 * Vector3int16 represents a 3D vector with 16-bit integer components.
 * Properties include:
 * - X, Y, Z: Numeric components (integers)
 *
 * @returns A TableType representing Vector3int16 instance
 */
export const createVector3int16InstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['X', prop(NumberType)],
      ['Y', prop(NumberType)],
      ['Z', prop(NumberType)],
    ]),
  );

/**
 * Creates the Region3int16 instance type definition.
 *
 * Region3int16 represents an axis-aligned 3D region with integer coordinates.
 * Properties include:
 * - Min: Minimum corner as Vector3int16
 * - Max: Maximum corner as Vector3int16
 *
 * @returns A TableType representing Region3int16 instance
 */
export const createRegion3int16InstanceType = (): LuauType => {
  const vector3int16Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector3int16' };

  return createTableType(
    new Map<string, PropertyType>([
      ['Min', prop(vector3int16Ref)],
      ['Max', prop(vector3int16Ref)],
    ]),
  );
};

/**
 * Creates the PhysicalProperties instance type definition.
 *
 * PhysicalProperties describes physics simulation properties of a part.
 * Properties include:
 * - Density: Mass per unit volume
 * - Friction: Resistance to sliding
 * - Elasticity: Bounciness
 * - FrictionWeight: Influence of friction
 * - ElasticityWeight: Influence of elasticity
 *
 * @returns A TableType representing PhysicalProperties instance
 */
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

/**
 * Creates the CatalogSearchParams instance type definition.
 *
 * CatalogSearchParams configures catalog search queries. Properties include:
 * - SearchKeyword: Text to search for
 * - MinPrice, MaxPrice: Price range filters
 * - SortType, SortAggregation: Sorting options
 * - CategoryFilter: Category to filter by
 * - AssetTypes, BundleTypes: Type filters
 * - IncludeOffSale: Whether to include off-sale items
 * - CreatorName: Filter by creator
 *
 * @returns A TableType representing CatalogSearchParams instance
 */
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

/**
 * Creates the RotationCurveKey instance type definition.
 *
 * RotationCurveKey represents a keyframe in a rotation animation curve.
 * Properties include:
 * - Time: Position in the animation
 * - Value: The CFrame rotation value
 * - Interpolation: How to interpolate to the next key
 *
 * @returns A TableType representing RotationCurveKey instance
 */
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

/**
 * Creates the FloatCurveKey instance type definition.
 *
 * FloatCurveKey represents a keyframe in a float animation curve.
 * Properties include:
 * - Time: Position in the animation
 * - Value: The numeric value
 * - Interpolation: How to interpolate to the next key
 * - LeftTangent, RightTangent: Tangent values for smooth interpolation
 *
 * @returns A TableType representing FloatCurveKey instance
 */
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

/**
 * Creates the EnumItem instance type definition.
 *
 * EnumItem represents an individual value within a Roblox enum.
 * Properties include:
 * - Name: The name of the enum item
 * - Value: The numeric value
 * - EnumType: Reference to the parent Enum
 *
 * @returns A TableType representing EnumItem instance
 */
export const createEnumItemInstanceType = (): LuauType =>
  createTableType(
    new Map<string, PropertyType>([
      ['Name', prop(StringType)],
      ['Value', prop(NumberType)],
      ['EnumType', prop({ 'kind': 'TypeReference', 'name': 'Enum' })],
    ]),
  );

/**
 * Creates the SharedTable instance type definition.
 *
 * SharedTable provides thread-safe shared data storage for Parallel Luau.
 * Methods include:
 * - clone: Creates a copy of the table
 * - cloneAndFreeze: Creates an immutable copy
 * - isFrozen: Checks if the table is frozen
 * - size: Returns the number of entries
 * - clear: Removes all entries
 *
 * SharedTable also supports indexing with string or number keys.
 *
 * @returns A TableType representing SharedTable instance
 */
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

/**
 * Creates the DockWidgetPluginGuiInfo instance type definition.
 *
 * DockWidgetPluginGuiInfo configures a plugin dock widget. Properties include:
 * - InitialDockState: Where the widget should dock
 * - InitialEnabled: Whether the widget starts enabled
 * - InitialEnabledShouldOverrideRestore: Whether to override saved state
 * - FloatingXSize, FloatingYSize: Size when floating
 * - MinWidth, MinHeight: Minimum dimensions
 *
 * @returns A TableType representing DockWidgetPluginGuiInfo instance
 */
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

/**
 * Creates a map of all Roblox DataType instance types.
 *
 * This function creates type definitions for all Roblox data types and returns
 * them as a Map for easy lookup during type resolution.
 *
 * Data types included:
 * - Vectors: Vector2, Vector3, Vector2int16, Vector3int16
 * - Transforms: CFrame
 * - Colors: Color3, BrickColor
 * - UI: UDim, UDim2, Rect
 * - Animation: TweenInfo, NumberSequence, NumberSequenceKeypoint, ColorSequence, ColorSequenceKeypoint
 * - Physics: Ray, Region3, Region3int16, RaycastParams, OverlapParams, RaycastResult, PhysicalProperties
 * - Time: DateTime
 * - Randomness: Random
 * - Pathfinding: PathWaypoint
 * - Text: Font
 * - Selection: Faces, Axes
 * - Catalog: CatalogSearchParams
 * - Animation: RotationCurveKey, FloatCurveKey
 * - Enum: EnumItem
 * - Parallel Luau: SharedTable
 * - Plugin: DockWidgetPluginGuiInfo
 * - Signals: RBXScriptSignal, RBXScriptConnection
 *
 * @returns A Map of data type names to their TableType definitions
 */
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
