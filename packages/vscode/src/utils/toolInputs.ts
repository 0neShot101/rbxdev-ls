import { isBoolean, isListEntry, isNumber, isObject, isString, isStringArray } from '#extension/utils/guards';

import type {
  BlockListInput,
  CreateInstanceInput,
  EmptyToolInput,
  ExecuteCodeInput,
  PathInput,
  PropertiesInput,
  ReparentInput,
  RemoteCallsInput,
  SaveInstanceInput,
  SetPropertyInput,
  TreeInput,
} from '@typings/mcpTools';

/**
 * Checks input of tools that take no arguments.
 */
export const isEmptyInput = (value: unknown): value is EmptyToolInput => isObject(value);

/**
 * Checks `rbxdev_execute_code` input.
 */
export const isExecuteCodeInput = (value: unknown): value is ExecuteCodeInput =>
  isObject(value) && ('code' in value === false || isString(value.code));

/**
 * Checks input of tools that address one instance by game path.
 */
export const isPathInput = (value: unknown): value is PathInput =>
  isObject(value) && ('path' in value === false || isStringArray(value.path));

/**
 * Checks game tree and children tool input.
 */
export const isTreeInput = (value: unknown): value is TreeInput =>
  isPathInput(value) && ('format' in value === false || value.format === 'tree' || value.format === 'json');

/**
 * Checks `rbxdev_get_properties` input.
 */
export const isPropertiesInput = (value: unknown): value is PropertiesInput =>
  isPathInput(value) && ('properties' in value === false || isStringArray(value.properties));

/**
 * Checks `rbxdev_set_property` input.
 */
export const isSetPropertyInput = (value: unknown): value is SetPropertyInput =>
  isPathInput(value) &&
  ('property' in value === false || isString(value.property)) &&
  ('value' in value === false || isString(value.value)) &&
  ('valueType' in value === false || isString(value.valueType));

/**
 * Checks `rbxdev_reparent_instance` input.
 */
export const isReparentInput = (value: unknown): value is ReparentInput =>
  isObject(value) &&
  ('sourcePath' in value === false || isStringArray(value.sourcePath)) &&
  ('targetPath' in value === false || isStringArray(value.targetPath));

/**
 * Checks `rbxdev_create_instance` input.
 */
export const isCreateInstanceInput = (value: unknown): value is CreateInstanceInput =>
  isObject(value) &&
  ('className' in value === false || isString(value.className)) &&
  ('parentPath' in value === false || isStringArray(value.parentPath)) &&
  ('name' in value === false || isString(value.name));

/**
 * Checks `rbxdev_get_remote_calls` input.
 */
export const isRemoteCallsInput = (value: unknown): value is RemoteCallsInput =>
  isObject(value) && ('limit' in value === false || isNumber(value.limit));

/**
 * Checks `rbxdev_set_remote_spy_block_list` input.
 */
export const isBlockListInput = (value: unknown): value is BlockListInput =>
  isObject(value) && ('blocks' in value === false || (Array.isArray(value.blocks) && value.blocks.every(isListEntry)));

/**
 * Checks `rbxdev_save_instance` input.
 */
export const isSaveInstanceInput = (value: unknown): value is SaveInstanceInput =>
  isPathInput(value) &&
  ('fileName' in value === false || isString(value.fileName)) &&
  ('decompile' in value === false || isBoolean(value.decompile));
