
# Settings

All settings are prefixed with `rbxdev-ls.` in VS Code's `settings.json`.

## Language Server

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `typeCheckMode` | `strict` \| `nonstrict` \| `nocheck` | `nonstrict` | Default type checking strictness for files without a directive |
| `enableSuncApi` | `boolean` | `false` | Load Sunc executor API definitions into the global scope |
| `debugLogs` | `boolean` | `false` | Enable verbose logging in the output panel |

## Executor Bridge

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `executorBridge.port` | `number` | `21324` | WebSocket port the bridge server listens on |

## Bundler

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `bundler.path` | `string` | `""` | Custom path to a bundler executable. Leave empty to use `npx @0neshot101/luau-bundler` |

## MCP

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mcp.enabled` | `boolean` | `true` | Start the embedded MCP server when the extension activates |

## Save Instance

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `saveInstance.decompile` | `boolean` | `true` | Decompile scripts when saving instances |
| `saveInstance.noscripts` | `boolean` | `false` | Exclude all scripts from saved instances |
| `saveInstance.isolatePlayers` | `boolean` | `false` | Only save the local player's data |

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
