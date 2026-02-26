<p align="center">
  <img src="vscode/icon.png" alt="rbxdev-ls logo" width="128" height="128">
</p>

# rbxdev-ls

`rbxdev-ls` is a Luau language server and VS Code extension for Roblox development.  
It gives you fast editor tooling, strict type checking, and optional live-game tooling through an executor bridge.

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/rbxdev.rbxdev-ls?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=rbxdev.rbxdev-ls)
[![Open VSX](https://img.shields.io/open-vsx/v/rbxdev/rbxdev-ls?label=Open%20VSX)](https://open-vsx.org/extension/rbxdev/rbxdev-ls)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Install

- VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=rbxdev.rbxdev-ls
- Open VSX: https://open-vsx.org/extension/rbxdev/rbxdev-ls

## What It Includes

### Language Server Features

- Roblox API completions and hover docs
- Luau type checking (`--!strict`, `--!nonstrict`, `--!nocheck`)
- Go to definition, find references, rename, document symbols
- Signature help, inlay hints, semantic tokens
- Auto-import suggestions from workspace modules
- Formatting support

### Live Roblox Features (Bridge Required)

- Game Tree explorer in the side bar
- Properties panel for the selected instance
- Execute current file or selection in-game
- Bundle and execute multi-file code
- Remote Spy utilities and quick-copy commands
- Actions like teleport, create/clone/delete/reparent, save instance/game

### MCP / AI Integration

- Built-in language model tools exposed by the extension
- Standalone `@oneshot101/rbxdev-mcp` package for MCP-compatible clients
- Works with the same bridge connection as the extension

## Default Shortcuts

- `Ctrl+Shift+E`: execute current file
- `Ctrl+Shift+Alt+E`: execute current selection
- `Ctrl+Alt+E`: bundle and execute
- `Ctrl+Shift+R`: copy last Remote Spy call
- `Ctrl+Shift+Alt+R`: insert last Remote Spy call
- `Ctrl+Alt+C`: quick copy last Remote Spy call

## Quick Start

1. Install the extension from VS Code Marketplace or Open VSX.
2. Open a folder with `.luau` or `.lua` files.
3. Start writing Luau with type checking and completions enabled.

Example:

```lua
--!strict

local Players = game:GetService("Players")
local localPlayer = Players.LocalPlayer
local character = localPlayer.Character or localPlayer.CharacterAdded:Wait()
```

## Executor Bridge Setup

To enable live game features, run this in your executor auto-execute:

```lua
loadstring(game:HttpGetAsync('https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/scripts/executor-bridge.lua'))()
```

Default bridge port: `21324`  
You can change it with the setting `rbxdev-ls.executorBridge.port`.

Optional custom bridge config:

```lua
loadstring(game:HttpGetAsync('https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/scripts/executor-bridge.lua'))({
    host = 'ws://127.0.0.1:21324';
    reconnectDelay = 5;
    firstConnectDepth = 999;
    updateTreeDepth = 2;
    expandedTreeDepth = 2;
})
```

## MCP Setup (Standalone)

If you want MCP tools in external clients (Claude Code, Cursor, etc.), add:

```json
{
  "mcpServers": {
    "rbxdev-roblox": {
      "command": "npx",
      "args": ["-y", "@oneshot101/rbxdev-mcp"]
    }
  }
}
```

Notes:

- Requires Node.js 18+
- Uses port `21324` by default
- If the VS Code extension is already running, MCP can connect through it as a proxy

## Extension Settings

Common settings:

- `rbxdev-ls.typeCheckMode`: `strict`, `nonstrict`, or `nocheck`
- `rbxdev-ls.enableSuncApi`: enable/disable Sunc API definitions
- `rbxdev-ls.executorBridge.port`: WebSocket port for bridge connections
- `rbxdev-ls.mcp.enabled`: enable/disable built-in MCP server integration
- `rbxdev-ls.bundler.path`: custom `luau-bundle` path
- `rbxdev-ls.debugLogs`: verbose extension logging

## Development

Prerequisites:

- Bun `>= 1.0.0`
- Node.js `>= 18` (for MCP package workflows)

Install dependencies:

```bash
bun install
cd vscode && bun install
```

Common commands (repo root):

```bash
bun run build         # Build language server
bun run build:mcp     # Build MCP server entry
bun run build:all     # Build server + MCP + studio plugin assets
bun run test          # Run test suite
bun run type-check    # TypeScript checks
bun run lint:check    # ESLint (no fixes)
bun run format:check  # Prettier check
bun run fetch-api     # Update Roblox API data
bun run build:vsix    # Build VSIX package
bun run build:beta    # Build beta VSIX package
bun run build:studio  # Build Roblox Studio plugin artifacts
```

Package VS Code extension directly:

```bash
cd vscode
bun run package
```

## Repository Layout

```text
src/
  @core/         LSP server and connection setup
  @lsp/          Language server handlers
  @parser/       Luau lexer/parser/doc comments
  @typings/      Type system and checker
  @definitions/  Roblox, stdlib, and executor definitions
  @workspace/    Workspace and Rojo integration
  @executor/     Bridge protocol and runtime state
  @mcp/          MCP server implementation

vscode/          VS Code extension source and packaging
packages/rbxdev-mcp/  Standalone MCP npm package
scripts/         Build and maintenance scripts
studio-plugin/   Roblox Studio plugin source
tests/           Unit and integration tests
```

## Contributing

Issues and pull requests are welcome.  
If you add behavior, include or update tests in `tests/`.

## License

MIT. See [LICENSE](LICENSE).
