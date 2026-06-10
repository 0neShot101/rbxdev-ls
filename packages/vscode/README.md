<div align="center">

<img src="https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/packages/vscode/icon.png" alt="rbxdev-ls logo" width="160">

<h1>rbxdev-ls</h1>

<p>Roblox/Luau language server for VS Code with type checking, completions, and live game integration</p>

<p>
  <a href="https://marketplace.visualstudio.com/items?itemName=rbxdev.rbxdev-ls"><img src="https://img.shields.io/visual-studio-marketplace/v/rbxdev.rbxdev-ls?style=flat-square&label=marketplace" alt="VS Code Marketplace version"></a>
  <img src="https://img.shields.io/badge/vscode-%3E%3D1.75.0-blue?style=flat-square" alt="VS Code >= 1.75.0">
  <img src="https://img.shields.io/badge/language-Luau-purple?style=flat-square" alt="Luau">
  <a href="https://github.com/0neShot101/rbxdev-ls/blob/main/LICENSE"><img src="https://img.shields.io/github/license/0neShot101/rbxdev-ls?style=flat-square" alt="MIT License"></a>
</p>

</div>

---

## Overview

rbxdev-ls is a VS Code extension that brings full Roblox API support and Luau type checking to your editor. It ships a custom language server that understands Roblox classes, services, data types, enums, and the Luau type system &mdash; providing completions, diagnostics, hover documentation, go-to-definition, rename, and formatting out of the box.

Beyond language features, the extension connects to a live Roblox game through a WebSocket executor bridge. This gives you a Game Tree explorer, a Properties panel, in-editor code execution, a Remote Spy, and instance manipulation &mdash; all without leaving VS Code. It also exposes 19 language model tools for GitHub Copilot and a built-in MCP server for Claude, Cursor, and other AI assistants, so your AI tools can interact with the running game directly.

## Features

- **Full Roblox API completions** &mdash; Every class, method, property, enum, and data type in the Roblox API, always up to date
- **Luau type checking** &mdash; Strict, nonstrict, and nocheck modes with diagnostics for type mismatches, undefined variables, and deprecated APIs
- **Live Game Tree** &mdash; Browse the running game hierarchy, inspect properties, and manipulate instances from the VS Code sidebar
- **In-editor code execution** &mdash; Execute Luau files or selections in the game with a single keybinding
- **Remote Spy** &mdash; Monitor RemoteEvent and RemoteFunction calls in real time with copyable Luau reproduction code
- **AI integration** &mdash; 19 language model tools for GitHub Copilot plus a built-in MCP server for external AI assistants
- **Bundle and execute** &mdash; Bundle multi-file Luau projects with `luau-bundle` and execute the result in-game
- **Save instances** &mdash; Save the full DataModel or individual instances to `.rbxl`/`.rbxm` files with optional script decompilation
- **Rojo sourcemap support** &mdash; Reads `sourcemap.json` for go-to-definition and module resolution in Rojo-managed projects

## Table of Contents

- [Quick Start](#quick-start)
- [Language Features](#language-features)
- [Live Game Integration](#live-game-integration)
- [AI Integration](#ai-integration)
- [Diagnostics](#diagnostics)
- [Settings](#settings)
- [Keybindings](#keybindings)
- [Game Tree Context Menu](#game-tree-context-menu)
- [Bridge Setup](#bridge-setup)
- [License](#license)

## Quick Start

1. Install **rbxdev-ls** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rbxdev.rbxdev-ls)
2. Open a folder containing `.lua` or `.luau` files
3. Start coding &mdash; completions, type checking, and hover documentation activate immediately

For live game features, see [Bridge Setup](#bridge-setup) below.

## Language Features

The language server provides the full set of editing features you expect from a typed language:

| Feature             | Description                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Completions         | Context-aware suggestions for Roblox services, classes, methods, properties, enums, and data type constructors |
| Type checking       | Luau type inference and annotation support with strict, nonstrict, and nocheck modes                           |
| Hover documentation | Inline docs for every Roblox API member and Luau built-in function                                             |
| Go-to-definition    | Navigate to module definitions, function declarations, and variable assignments                                |
| Find references     | Locate every usage of a variable, function, or type across the workspace                                       |
| Rename              | Safely rename symbols across all files that reference them                                                     |
| Document symbols    | Outline view showing all functions, variables, and types in the current file                                   |
| Workspace symbols   | Search for symbols across the entire workspace                                                                 |
| Signature help      | Parameter hints and overload information while typing function calls                                           |
| Inlay hints         | Inline type annotations for inferred variables and function returns                                            |
| Semantic tokens     | Enhanced syntax highlighting that distinguishes services, classes, types, and enums                            |
| Auto-import         | Automatically insert `require` statements when completing module exports                                       |
| Formatting          | Built-in Luau formatter that respects indentation and style conventions                                        |
| Code actions        | Quick fixes for undefined variables, missing requires, and type mismatches                                     |
| Call hierarchy      | Trace incoming and outgoing call chains for any function                                                       |
| Code lens           | Inline reference counts and navigation hints above functions                                                   |
| Folding ranges      | Collapse functions, blocks, tables, and multi-line comments                                                    |
| Color picker        | Visual color editing for `Color3.fromRGB`, `Color3.new`, and `Color3.fromHSV` calls                            |
| Document links      | Clickable links for `require` paths and module references                                                      |
| Selection ranges    | Smart selection expansion that follows Luau syntax boundaries                                                  |
| Linked editing      | Rename matching identifiers simultaneously in destructuring patterns                                           |

## Live Game Integration

When an executor bridge is connected (see [Bridge Setup](#bridge-setup)), the extension adds a sidebar panel and several commands for interacting with the running game.

### Game Tree Explorer

A tree view in the VS Code sidebar that mirrors the live game hierarchy. It shows every service and its children, updating when instances are added, removed, or renamed. Click any instance to view its properties in the Properties panel. Drag and drop instances to reparent them. Right-click for context actions (copy path, teleport, delete, view script source, create, clone, save).

### Properties Panel

A webview panel that displays all properties of the selected instance with their current values. Edit property values directly &mdash; the changes apply to the live game immediately. Supports all Roblox property types including Vector3, Color3, CFrame, UDim2, and enum values.

### Code Execution

Execute Luau code in the game without switching windows. The extension sends the code through the bridge and displays the result or error in the output panel.

| Command            | Keybinding         | Description                                                       |
| ------------------ | ------------------ | ----------------------------------------------------------------- |
| Execute in Roblox  | `Ctrl+Shift+E`     | Execute the current file in the game                              |
| Execute Selection  | `Ctrl+Shift+Alt+E` | Execute only the selected code                                    |
| Bundle and Execute | `Ctrl+Alt+E`       | Bundle the current file with `luau-bundle` and execute the result |

### Remote Spy

A dedicated panel that captures every `RemoteEvent:FireServer` and `RemoteFunction:InvokeServer` call between client and server. Each entry shows the remote name, method, arguments, and a copyable Luau snippet that reproduces the call. Filter by remote name, ignore specific remotes, and block remotes from firing.

| Command                 | Keybinding         | Description                                        |
| ----------------------- | ------------------ | -------------------------------------------------- |
| Copy Last Remote Call   | `Ctrl+Shift+R`     | Copy the last captured remote call to clipboard    |
| Insert Last Remote Call | `Ctrl+Shift+Alt+R` | Insert the last remote call at the cursor position |
| Quick Copy Remote       | `Ctrl+Alt+C`       | Quick copy the most recent remote call             |

### Instance Manipulation

Create, clone, delete, and reparent instances directly from the Game Tree. Drag and drop to reparent. Right-click to access all actions. Save any instance (or the entire DataModel) to disk as `.rbxl` or `.rbxm` files.

## AI Integration

### GitHub Copilot Tools

The extension registers 19 language model tools that GitHub Copilot can call directly. These cover the same capabilities as the MCP tools: bridge status, code execution, game tree traversal, property read/write, instance manipulation, script editing through Studio, saving instances, console output, and Remote Spy.

### Built-in MCP Server

The extension includes an embedded MCP server that external AI assistants (Claude, Cursor, Windsurf) can connect to. When `rbxdev-ls.mcp.enabled` is `true` (the default), the server starts automatically and shares the extension's executor bridge. See the [@oneshot101/rbxdev-mcp](https://www.npmjs.com/package/@oneshot101/rbxdev-mcp) package for standalone MCP usage outside VS Code.

### MCP Resources

Three read-only resources are exposed for AI tools that support MCP resource subscriptions:

| Resource URI             | Description                           |
| ------------------------ | ------------------------------------- |
| `rbxdev://bridge/status` | Connection status as JSON             |
| `rbxdev://game/tree`     | Full game hierarchy as formatted text |
| `rbxdev://console/logs`  | Recent console output                 |

## Diagnostics

The language server reports diagnostics as you type, covering type errors, undefined variables, and deprecation warnings. You can suppress diagnostics on a per-line or per-block basis with ignore directives.

| Directive          | Scope       | Usage                                                  |
| ------------------ | ----------- | ------------------------------------------------------ |
| `--@rbxls-ignore`  | Next line   | Place above the line to suppress all diagnostics on it |
| `--@rbxls-disable` | Block start | Suppress all diagnostics from this point forward       |
| `--@rbxls-enable`  | Block end   | Re-enable diagnostics after a `@rbxls-disable`         |

## Settings

All settings are under the `rbxdev-ls` namespace in VS Code.

| Setting                                    | Default                               | Purpose                                                                               |
| ------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------- |
| `rbxdev-ls.typeCheckMode`                  | `strict`                              | Type checking strictness: `strict`, `nonstrict`, or `nocheck`                         |
| `rbxdev-ls.enableSuncApi`                  | `true`                                | Enable Sunc executor API completions and type checking                                |
| `rbxdev-ls.executorBridge.port`            | `21324`                               | WebSocket port for executor bridge connections                                        |
| `rbxdev-ls.mcp.enabled`                    | `true`                                | Enable the built-in MCP server for AI assistants                                      |
| `rbxdev-ls.bundler.path`                   | `""`                                  | Custom path to the `luau-bundler` executable; leave empty to auto-run through npx/npm |
| `rbxdev-ls.saveInstance.decompile`         | `true`                                | Decompile scripts when saving instances to disk                                       |
| `rbxdev-ls.saveInstance.noscripts`         | `false`                               | Exclude all scripts from saved instances                                              |
| `rbxdev-ls.saveInstance.excludeServices`   | `["Chat", "CoreGui", "CorePackages"]` | Services to exclude from full DataModel saves                                         |
| `rbxdev-ls.autoRefreshGameTree.enabled`    | `false`                               | Automatically refresh the game tree when instances change in Studio or the executor   |
| `rbxdev-ls.autoRefreshGameTree.intervalMs` | `5000`                                | Debounce interval for auto-refresh in milliseconds (minimum 2000)                     |
| `rbxdev-ls.debugLogs`                      | `false`                               | Enable verbose debug logging in the extension output console                          |

## Keybindings

| Command                 | Keybinding         | When                             |
| ----------------------- | ------------------ | -------------------------------- |
| Execute in Roblox       | `Ctrl+Shift+E`     | Lua/Luau file is active          |
| Execute Selection       | `Ctrl+Shift+Alt+E` | Lua/Luau file with text selected |
| Bundle and Execute      | `Ctrl+Alt+E`       | Lua/Luau file is active          |
| Copy Last Remote Call   | `Ctrl+Shift+R`     | Lua/Luau file is active          |
| Insert Last Remote Call | `Ctrl+Shift+Alt+R` | Lua/Luau file is active          |
| Quick Copy Remote       | `Ctrl+Alt+C`       | Lua/Luau file is active          |

## Game Tree Context Menu

Right-click any item in the Game Tree sidebar for these actions:

| Action                | Description                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Copy Instance Path    | Copy the full dotted path to clipboard (e.g., `game.Workspace.Model.Part`)                               |
| Insert Path at Cursor | Insert the instance path into the active editor at the cursor                                            |
| Insert GetService     | Insert a `game:GetService("ServiceName")` statement (available on service nodes)                         |
| View Script Source    | Decompile and open the script in a read-only editor tab (available on Script, LocalScript, ModuleScript) |
| Teleport To           | Teleport the local player to the instance position                                                       |
| Create Instance       | Create a new child instance under the selected node                                                      |
| Clone Instance        | Duplicate the instance and all its children                                                              |
| Delete Instance       | Permanently remove the instance from the game                                                            |
| Save Instance         | Save the instance and its descendants to a `.rbxm` file on disk                                          |

## Bridge Setup

Live game features (Game Tree, Properties, code execution, Remote Spy) require a WebSocket bridge between VS Code and a Roblox executor. The bridge script ships with the repository and is hosted on GitHub for easy loading.

### Connect the bridge

Add this to your executor's auto-execute folder so it runs when you join a game:

```lua
loadstring(game:HttpGetAsync'https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/scripts/executor-bridge.lua')()
```

When the bridge connects, the VS Code status bar shows **Roblox: Connected** (or **Roblox: Studio** for Studio plugin connections). The Game Tree populates automatically.

### Custom bridge configuration

Pass a config table to override default bridge behavior:

```lua
loadstring(game:HttpGetAsync'https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/scripts/executor-bridge.lua')({
    host = 'ws://127.0.0.1:21324',
    reconnectDelay = 5,
    firstConnectDepth = 999,
    updateTreeDepth = 2,
    expandedTreeDepth = 2,
})
```

| Parameter           | Default                | Purpose                                                                 |
| ------------------- | ---------------------- | ----------------------------------------------------------------------- |
| `host`              | `ws://127.0.0.1:21324` | WebSocket URL the bridge connects to                                    |
| `reconnectDelay`    | `5`                    | Seconds to wait between reconnect attempts after a disconnect           |
| `firstConnectDepth` | `999`                  | Tree depth sent on first connect (deep dump for completions)            |
| `updateTreeDepth`   | `2`                    | Tree depth for subsequent incremental updates (shallow for performance) |
| `expandedTreeDepth` | `2`                    | Tree depth when expanding a collapsed node in the Game Tree view        |

The default behavior sends a full tree dump on first connect so the extension has complete data for completions and path resolution, then switches to shallow updates to minimize overhead.

### Custom port

If port 21324 is unavailable, change the port in VS Code settings (`rbxdev-ls.executorBridge.port`) and update the `host` parameter in the bridge config to match.

## License

[MIT](https://github.com/0neShot101/rbxdev-ls/blob/main/LICENSE) &copy; Andrew
