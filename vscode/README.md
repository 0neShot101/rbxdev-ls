# Roblox Luau Language Server

A high-performance VS Code extension for Roblox and Luau development with full API support, intelligent completions, and live game integration.

## Features

### Language Support
- **Full Roblox API** - Completions and type checking for all Roblox classes, methods, and properties
- **Luau Type System** - Support for type annotations, generics, and strict mode
- **Smart Completions** - Context-aware suggestions for services, instances, and methods
- **Hover Documentation** - Inline documentation for Roblox APIs
- **Signature Help** - Parameter hints while typing function calls
- **Go to Definition** - Navigate to module and function definitions
- **Find References** - Find all usages of variables and functions
- **Rename Symbol** - Safely rename variables across files
- **Document Symbols** - Outline view of functions and variables
- **Semantic Highlighting** - Enhanced syntax coloring for Luau

### Live Game Integration
- **Game Tree Explorer** - Browse the live game hierarchy in VS Code
- **Properties Panel** - View and edit instance properties in real-time
- **Execute Code** - Run Luau code directly in the game (Ctrl+Shift+E)
- **Teleport** - Teleport your character to any instance
- **Drag & Drop** - Reparent instances by dragging in the tree

### Diagnostics
- **Type Errors** - Catch type mismatches before runtime
- **Undefined Variables** - Detect typos and missing requires
- **Deprecation Warnings** - Know when you're using deprecated APIs

## Requirements

- VS Code 1.75.0 or higher
- For live game features: A compatible Roblox executor with WebSocket support

## Extension Settings

- `rbxdev-ls.typeCheckMode`: Type checking strictness (`strict`, `nonstrict`, `nocheck`)
- `rbxdev-ls.enableSuncApi`: Enable Sunc executor API support
- `rbxdev-ls.executorBridge.port`: WebSocket port for executor connections (default: 21324)

## Keybindings

| Command | Keybinding | Description |
|---------|------------|-------------|
| Execute in Roblox | `Ctrl+Shift+E` | Execute the current file |
| Execute Selection | `Ctrl+Shift+Alt+E` | Execute selected code |

## Game Tree Context Menu

Right-click any item in the Game Tree for options:
- **Copy Instance Path** - Copy the full path (e.g., `game.Workspace.Model`)
- **Insert Path at Cursor** - Insert the path into your code
- **Insert GetService** - Insert a GetService statement (for services)
- **Teleport To** - Teleport your character to the instance
- **Delete Instance** - Remove the instance from the game

## Getting Started

1. Install the extension
2. Open a folder containing `.lua` or `.luau` files
3. Start coding with full Roblox API support

## Live Game Setup

To enable live game features (Game Tree, Properties, Execute Code), add this script to your executor's **auto-execute** folder:

```lua
loadstring(game:HttpGetAsync'https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/scripts/executor-bridge.lua')()
```

This will automatically connect to VS Code when you join a game. The status bar will show "Roblox: Connected" when the bridge is active.

### Custom Configuration

You can pass a config table to customize the bridge:

```lua
loadstring(game:HttpGetAsync'https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/scripts/executor-bridge.lua')({
    host = 'ws://127.0.0.1:21324';  -- WebSocket host
    reconnectDelay = 5;              -- Seconds between reconnect attempts
    initialTreeDepth = 5;            -- How deep to load game tree initially
    expandedTreeDepth = 3;           -- How deep to load when expanding nodes
})
```

## License

MIT License - see [LICENSE](LICENSE) for details.
