
# Installation

## VS Code Extension

Install from either marketplace:

- **VS Code Marketplace**: Search for `rbxdev-ls` in the extensions panel, or run:

```
ext install rbxdev.rbxdev-ls
```

- **Open VSX**: Available at [open-vsx.org/extension/rbxdev/rbxdev-ls](https://open-vsx.org/extension/rbxdev/rbxdev-ls)

The extension activates automatically when you open any `.lua` or `.luau` file, or a workspace containing a `default.project.json`.

## MCP Server

If you want AI assistants (Claude, Cursor, Windsurf) to interact with your game, install the MCP server separately. See the [MCP Server guide](/docs/guides/mcp-server) for setup instructions.

## Luau Bundler

The bundler is available as a standalone CLI for bundling multi-file Luau projects into a single script:

```bash
npx @oneshot101/luau-bundler --src src --out dist/out.lua
```

See the [Luau Bundler guide](/docs/guides/luau-bundler) for configuration and usage.

## Requirements

| Dependency | Version | Purpose |
|-----------|---------|---------|
| VS Code | 1.75.0+ | Extension host |
| Node.js | 18+ | MCP server (if used standalone) |
| Bun | 1.0+ | Development only |
