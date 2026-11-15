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

/** Installs the UserSettings accessor and the legacy settings global. */
export const installSettings = (globals: Map<string, LuauType>): void => {
  const vector2Ref: LuauType = { 'kind': 'TypeReference', 'name': 'Vector2' };
  const userGameSettingsType: LuauType = createTableType(
    new Map([
      ['GamepadCameraSensitivity', { 'type': NumberType, 'readonly': false, 'optional': false }],
      ['MouseSensitivity', { 'type': NumberType, 'readonly': false, 'optional': false }],
      ['MouseSensitivityFirstPerson', { 'type': vector2Ref, 'readonly': false, 'optional': false }],
      ['MouseSensitivityThirdPerson', { 'type': vector2Ref, 'readonly': false, 'optional': false }],
      ['MasterVolume', { 'type': NumberType, 'readonly': false, 'optional': false }],
      [
        'ComputerCameraMovementMode',
        {
          'type': { 'kind': 'TypeReference', 'name': 'Enum.ComputerCameraMovementMode' },
          'readonly': false,
          'optional': false,
        },
      ],
      [
        'ComputerMovementMode',
        {
          'type': { 'kind': 'TypeReference', 'name': 'Enum.ComputerMovementMode' },
          'readonly': false,
          'optional': false,
        },
      ],
      [
        'ControlMode',
        { 'type': { 'kind': 'TypeReference', 'name': 'Enum.ControlMode' }, 'readonly': false, 'optional': false },
      ],
      [
        'RotationType',
        { 'type': { 'kind': 'TypeReference', 'name': 'Enum.RotationType' }, 'readonly': false, 'optional': false },
      ],
      [
        'TouchCameraMovementMode',
        {
          'type': { 'kind': 'TypeReference', 'name': 'Enum.TouchCameraMovementMode' },
          'readonly': false,
          'optional': false,
        },
      ],
      [
        'TouchMovementMode',
        { 'type': { 'kind': 'TypeReference', 'name': 'Enum.TouchMovementMode' }, 'readonly': false, 'optional': false },
      ],
      ['Fullscreen', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['GraphicsQualityLevel', { 'type': NumberType, 'readonly': false, 'optional': false }],
      [
        'SavedQualityLevel',
        {
          'type': { 'kind': 'TypeReference', 'name': 'Enum.SavedQualitySetting' },
          'readonly': false,
          'optional': false,
        },
      ],
      ['AllTutorialsDisabled', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['IsUsingCameraYInverted', { 'type': BooleanType, 'readonly': true, 'optional': false }],
      ['IsUsingGamepadCameraSensitivity', { 'type': BooleanType, 'readonly': true, 'optional': false }],
      ['ChatVisible', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['ChatTranslationEnabled', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['ChatTranslationLocale', { 'type': StringType, 'readonly': false, 'optional': false }],
      ['ChatTranslationToggleEnabled', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['HasEverUsedVR', { 'type': BooleanType, 'readonly': true, 'optional': false }],
      ['VREnabled', { 'type': BooleanType, 'readonly': true, 'optional': false }],
      ['VRRotationIntensity', { 'type': NumberType, 'readonly': false, 'optional': false }],
      ['VRSmoothRotationEnabled', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['VignetteEnabled', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['OnboardingsCompleted', { 'type': StringType, 'readonly': false, 'optional': false }],
      ['RCCProfilerRecordFrameRate', { 'type': NumberType, 'readonly': false, 'optional': false }],
      ['RCCProfilerRecordTimeFrame', { 'type': NumberType, 'readonly': false, 'optional': false }],
      ['DefaultCameraID', { 'type': StringType, 'readonly': false, 'optional': false }],
      ['DefaultMicrophoneID', { 'type': StringType, 'readonly': false, 'optional': false }],
      ['StartMaximized', { 'type': BooleanType, 'readonly': false, 'optional': false }],
      ['StartScreenPosition', { 'type': vector2Ref, 'readonly': false, 'optional': false }],
      ['StartScreenSize', { 'type': vector2Ref, 'readonly': false, 'optional': false }],
      [
        'GetCameraYInvertValue',
        {
          'type': createFunctionType([], NumberType, { 'description': 'Returns the camera Y invert value.' }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'GetOnboardingCompleted',
        {
          'type': createFunctionType([{ 'name': 'onboardingId', 'type': StringType, 'optional': false }], BooleanType, {
            'description': 'Returns whether the specified onboarding has been completed.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'InFullScreen',
        {
          'type': createFunctionType([], BooleanType, {
            'description': 'Returns whether the game is currently in full screen mode.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'InStudioMode',
        {
          'type': createFunctionType([], BooleanType, {
            'description': 'Returns whether the game is running in Roblox Studio.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetCameraYInvertVisible',
        {
          'type': createFunctionType([], NilType, {
            'description': 'Makes the camera Y invert option visible in the game settings menu.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetGamepadCameraSensitivityVisible',
        {
          'type': createFunctionType([], NilType, {
            'description': 'Makes the gamepad camera sensitivity option visible in the game settings menu.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'SetOnboardingCompleted',
        {
          'type': createFunctionType([{ 'name': 'onboardingId', 'type': StringType, 'optional': false }], NilType, {
            'description': 'Marks the specified onboarding as completed.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

  const userSettingsType: LuauType = createTableType(
    new Map([
      [
        'GetService',
        {
          'type': createFunctionType(
            [{ 'name': 'serviceName', 'type': StringType, 'optional': false }],
            userGameSettingsType,
            { 'description': 'Returns the specified service from UserSettings.' },
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'IsUserFeatureEnabled',
        {
          'type': createFunctionType([{ 'name': 'feature', 'type': StringType, 'optional': false }], BooleanType, {
            'description': 'Returns whether the specified user feature is enabled.',
          }),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
  );

  globals.set(
    'UserSettings',
    createFunctionType([], userSettingsType, {
      'description': 'Returns the UserSettings object for accessing user game settings.',
    }),
  );
  globals.set('settings', createFunctionType([], AnyType));
};
