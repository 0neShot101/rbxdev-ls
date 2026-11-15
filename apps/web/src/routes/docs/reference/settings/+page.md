<svelte:head><title>Settings | rbxdev-ls docs</title></svelte:head>

# Settings

All settings are prefixed with `rbxdev-ls.` in VS Code's `settings.json`.

## Language server

| Setting         | Type                                 | Default  | Description                                                                                             |
| --------------- | ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------- |
| `typeCheckMode` | `strict` \| `nonstrict` \| `nocheck` | `strict` | Declared but not read by the language server. Files without a directive are checked in `nonstrict` mode |
| `enableSuncApi` | `boolean`                            | `true`   | Declared but not read by the language server                                                            |
| `debugLogs`     | `boolean`                            | `false`  | Enable verbose debug logging in the extension output and developer tools console                        |

## API updates

| Setting          | Type      | Default | Description                                                                                                         |
| ---------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `api.autoUpdate` | `boolean` | `true`  | Check daily for Roblox API and documentation updates. Downloaded data is used after the language server next starts |

Turning this off stops downloads. Data that was already downloaded and validated stays in use.

## Executor bridge

| Setting               | Type     | Default | Description                                                                                                  |
| --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `executorBridge.port` | `number` | `21324` | Port written into the MCP configuration by the setup command. The bridge listener does not read this setting |

## Game tree

| Setting                          | Type      | Default | Description                                                                                   |
| -------------------------------- | --------- | ------- | --------------------------------------------------------------------------------------------- |
| `autoRefreshGameTree.enabled`    | `boolean` | `false` | Refresh the game tree when instances are added or removed in Studio or the connected executor |
| `autoRefreshGameTree.intervalMs` | `number`  | `5000`  | Debounce window for auto-refresh in milliseconds. Values below `2000` are raised to `2000`    |

## Bundler

| Setting        | Type     | Default | Description                                                                                           |
| -------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `bundler.path` | `string` | `""`    | Custom path to a bundler executable. Leave empty to run `@oneshot101/luau-bundler` through npx or npm |

## MCP

| Setting       | Type      | Default | Description                                                                                                             |
| ------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `mcp.enabled` | `boolean` | `true`  | Declared but not read by the extension. Register the MCP server with the `Roblox: Setup MCP Server for Copilot` command |

## Save instance

| Setting                        | Type       | Default                               | Description                               |
| ------------------------------ | ---------- | ------------------------------------- | ----------------------------------------- |
| `saveInstance.decompile`       | `boolean`  | `true`                                | Decompile scripts when saving instances   |
| `saveInstance.noscripts`       | `boolean`  | `false`                               | Exclude all scripts when saving instances |
| `saveInstance.excludeServices` | `string[]` | `["Chat", "CoreGui", "CorePackages"]` | Services to exclude from full game saves  |

## Example configuration

```json
{
  "rbxdev-ls.typeCheckMode": "strict",
  "rbxdev-ls.enableSuncApi": false,
  "rbxdev-ls.executorBridge.port": 21324,
  "rbxdev-ls.mcp.enabled": true,
  "rbxdev-ls.bundler.path": "",
  "rbxdev-ls.debugLogs": false
}
```
