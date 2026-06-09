# MCP Tools Reference

The MCP server exposes 19 tools that AI assistants can call to interact with a running Roblox game.

## Connection

### get_bridge_status

Returns the current bridge connection state, executor name, and service count.

**Parameters:** None

**Returns:** `{ isRunning, isConnected, executorName, clientType }`

## Code Execution

### execute_code

Runs Luau code in the game with full Roblox API access.

**Parameters:**

| Name   | Type     | Required | Description                 |
| ------ | -------- | -------- | --------------------------- |
| `code` | `string` | Yes      | Luau source code to execute |

**Returns:** `{ success, result?, error? }`

The `result` field contains the stringified return value. Use `return` at the end of your code to capture output.

### get_console_output

Reads recent `print`, `warn`, and `error` output from the game.

**Parameters:**

| Name    | Type     | Required | Description                              |
| ------- | -------- | -------- | ---------------------------------------- |
| `limit` | `number` | No       | Maximum entries to return (default: 50)  |
| `level` | `string` | No       | Filter by level: `info`, `warn`, `error` |

## Instance Tree

### get_game_tree

Browses the game hierarchy with optional path filtering.

**Parameters:**

| Name     | Type       | Required | Description                               |
| -------- | ---------- | -------- | ----------------------------------------- |
| `path`   | `string[]` | No       | Path to a specific subtree                |
| `format` | `string`   | No       | Output format: `tree` (default) or `json` |

### get_children

Lists direct children of an instance.

**Parameters:**

| Name   | Type       | Required | Description                 |
| ------ | ---------- | -------- | --------------------------- |
| `path` | `string[]` | Yes      | Path to the parent instance |

### refresh_game_tree

Requests a fresh snapshot of the entire game tree from the executor.

**Parameters:** None

## Properties

### get_properties

Reads property values from an instance.

**Parameters:**

| Name         | Type       | Required | Description                                           |
| ------------ | ---------- | -------- | ----------------------------------------------------- |
| `path`       | `string[]` | Yes      | Path to the instance                                  |
| `properties` | `string[]` | No       | Specific properties to read (default: class defaults) |

### set_property

Sets a property value on an instance.

**Parameters:**

| Name        | Type       | Required | Description                                                                             |
| ----------- | ---------- | -------- | --------------------------------------------------------------------------------------- |
| `path`      | `string[]` | Yes      | Path to the instance                                                                    |
| `property`  | `string`   | Yes      | Property name                                                                           |
| `value`     | `string`   | Yes      | Value as a string                                                                       |
| `valueType` | `string`   | Yes      | Type: `string`, `number`, `boolean`, `Vector3`, `Color3`, `CFrame`, `UDim2`, `EnumItem` |

## Instance Manipulation

### create_instance

Creates a new instance under a parent.

**Parameters:**

| Name         | Type       | Required | Description                                |
| ------------ | ---------- | -------- | ------------------------------------------ |
| `className`  | `string`   | Yes      | Roblox class name (e.g., `Part`, `Folder`) |
| `parentPath` | `string[]` | Yes      | Path to the parent                         |
| `name`       | `string`   | No       | Name for the new instance                  |

### clone_instance

Duplicates an instance as a sibling of the original.

**Parameters:**

| Name   | Type       | Required | Description                   |
| ------ | ---------- | -------- | ----------------------------- |
| `path` | `string[]` | Yes      | Path to the instance to clone |

### delete_instance

Permanently removes an instance. This cannot be undone.

**Parameters:**

| Name   | Type       | Required | Description          |
| ------ | ---------- | -------- | -------------------- |
| `path` | `string[]` | Yes      | Path to the instance |

### reparent_instance

Moves an instance to a new parent.

**Parameters:**

| Name         | Type       | Required | Description     |
| ------------ | ---------- | -------- | --------------- |
| `sourcePath` | `string[]` | Yes      | Current path    |
| `targetPath` | `string[]` | Yes      | New parent path |

### teleport_player

Teleports the local player's character to an instance.

**Parameters:**

| Name   | Type       | Required | Description                 |
| ------ | ---------- | -------- | --------------------------- |
| `path` | `string[]` | Yes      | Path to the target instance |

## Scripts

### get_script_source

Decompiles and returns the source code of a script.

**Parameters:**

| Name   | Type       | Required | Description                                    |
| ------ | ---------- | -------- | ---------------------------------------------- |
| `path` | `string[]` | Yes      | Path to a Script, LocalScript, or ModuleScript |

## Remote Spy

### get_remote_calls

Returns captured RemoteEvent/RemoteFunction calls with reproducible Luau code.

**Parameters:**

| Name    | Type     | Required | Description                           |
| ------- | -------- | -------- | ------------------------------------- |
| `limit` | `number` | No       | Maximum calls to return (default: 50) |

### set_remote_spy_enabled

Toggles the Remote Spy on or off.

**Parameters:**

| Name      | Type      | Required | Description                                |
| --------- | --------- | -------- | ------------------------------------------ |
| `enabled` | `boolean` | Yes      | `true` to start capturing, `false` to stop |

### set_remote_spy_block_list

Sets remotes to block from firing to the server.

**Parameters:**

| Name     | Type                                          | Required | Description                    |
| -------- | --------------------------------------------- | -------- | ------------------------------ |
| `blocks` | `{ type: "path" \| "name"; value: string }[]` | Yes      | Remote paths or names to block |

## Studio

### set_script_source

Updates the source code of a Script, LocalScript, or ModuleScript when connected through Roblox Studio.

**Parameters:**

| Name     | Type       | Required | Description                 |
| -------- | ---------- | -------- | --------------------------- |
| `path`   | `string[]` | Yes      | Path to the script instance |
| `source` | `string`   | Yes      | New script source           |

## Saving

### save_instance

Saves the full DataModel or a specific instance to a file through executor `saveinstance()`.

**Parameters:**

| Name        | Type       | Required | Description                  |
| ----------- | ---------- | -------- | ---------------------------- |
| `path`      | `string[]` | No       | Optional instance path       |
| `fileName`  | `string`   | No       | Output filename              |
| `decompile` | `boolean`  | No       | Whether to decompile scripts |
