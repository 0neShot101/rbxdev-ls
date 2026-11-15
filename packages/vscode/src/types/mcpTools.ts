import type { BlockEntry } from '@typings/remoteSpy';

/**
 * Produces the text of a language model tool result from the tool's decoded input.
 */
export type ToolHandler<Input> = (input: Input) => Promise<string>;

/**
 * Decodes raw language model tool input into a tool's named input contract.
 */
export type ToolInputGuard<Input> = (value: unknown) => value is Input;

/**
 * Output layout for tools that render game tree nodes.
 */
export type TreeFormat = 'tree' | 'json';

/**
 * Input of tools that take no arguments.
 */
export type EmptyToolInput = object;

/**
 * Input of `rbxdev_execute_code`.
 */
export interface ExecuteCodeInput {
  readonly code?: string;
}

/**
 * Input of tools that address a single instance by game path.
 */
export interface PathInput {
  readonly path?: ReadonlyArray<string>;
}

/**
 * Input of `rbxdev_get_game_tree` and `rbxdev_get_children`.
 */
export interface TreeInput extends PathInput {
  readonly format?: TreeFormat;
}

/**
 * Input of `rbxdev_get_properties`.
 */
export interface PropertiesInput extends PathInput {
  readonly properties?: ReadonlyArray<string>;
}

/**
 * Input of `rbxdev_set_property`.
 */
export interface SetPropertyInput extends PathInput {
  readonly property?: string;
  readonly value?: string;
  readonly valueType?: string;
}

/**
 * Input of `rbxdev_reparent_instance`.
 */
export interface ReparentInput {
  readonly sourcePath?: ReadonlyArray<string>;
  readonly targetPath?: ReadonlyArray<string>;
}

/**
 * Input of `rbxdev_create_instance`.
 */
export interface CreateInstanceInput {
  readonly className?: string;
  readonly parentPath?: ReadonlyArray<string>;
  readonly name?: string;
}

/**
 * Input of `rbxdev_get_remote_calls`.
 */
export interface RemoteCallsInput {
  readonly limit?: number;
}

/**
 * Input of `rbxdev_set_remote_spy_block_list`.
 */
export interface BlockListInput {
  readonly blocks?: ReadonlyArray<BlockEntry>;
}

/**
 * Input of `rbxdev_save_instance`.
 */
export interface SaveInstanceInput extends PathInput {
  readonly fileName?: string;
  readonly decompile?: boolean;
}
