# rbxdev-ls

A fast, full-featured language server for Roblox Luau development.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)

---

## Features

### Intelligent Completions
- Full Roblox API — all classes, methods, properties, and events
- Sunc executor functions out of the box
- Live game tree completions when connected to an executor
- Auto-import suggestions from your workspace modules
- Context-aware table field completions

### Type Checking
- Bidirectional type inference
- `--!strict`, `--!nonstrict`, and `--!nocheck` modes
- All Roblox datatypes (Vector3, CFrame, Color3, UDim2, etc.)
- Generics, unions, intersections, and optional types
- Inheritance-aware class typing

### Navigation
- Go to definition
- Find all references
- Rename symbol across files
- Document symbol outline

### Editor Goodies
- Hover docs with full type signatures
- Signature help while typing function args
- Semantic highlighting
- Inlay hints for inferred types
- Color picker for Color3 values
- StyLua formatting integration

### Workspace Integration
- Rojo project file support
- DataModel path resolution
- Automatic require path generation

---

## Installation

### VS Code

```bash
cd vscode
bun install
bun run package
# Install the .vsix file
```

Or grab it from the releases page.

### Standalone

```bash
bun install
bun run build
```

The server speaks LSP over stdio — plug it into any editor that supports language servers.

---

## Usage

Drop a mode comment at the top of your file:

```lua
--!strict

local Players = game:GetService("Players")
local player = Players.LocalPlayer
local character = player.Character or player.CharacterAdded:Wait()

-- Full type inference and completions from here
```

### Executor Bridge

The language server can connect to Roblox executors for live game data. When an executor connects to port `21324`:

- Get completions from the actual game tree
- See real Instance children and properties
- No more guessing what exists at runtime

---

## Project Layout

```
src/
├── @core/        # LSP server setup
├── @parser/      # Luau lexer & parser
├── @typings/     # Type system
├── @definitions/ # Roblox API types
├── @lsp/         # All the LSP handlers
├── @executor/    # Runtime bridge
└── @workspace/   # Rojo support
```

---

## Development

```bash
bun run dev        # Watch mode
bun run build      # Production build
bun run type-check # Check types
bun run lint       # Lint & fix
bun run format     # Prettier
```

### Updating Roblox API

```bash
bun run fetch-api
```

Pulls the latest API dump from Roblox and regenerates type definitions.

---

## Contributing

PRs welcome. If you're adding a feature, write a test for it.

---

## License

MIT
