
# MCP Server

The MCP (Model Context Protocol) server lets AI assistants interact with your running Roblox game. It exposes 16 tools for browsing instances, executing code, reading properties, and monitoring remote calls.

## Setup

### Registry configuration

The package is hosted on GitHub Packages. Add this to your `~/.npmrc`:

```
@0neshot101:registry=https://npm.pkg.github.com
```

### Claude Code

Add to `~/.claude/mcp_config.json`:

```json
{
  "mcpServers": {
    "rbxdev-roblox": {
      "command": "npx",
      "args": ["-y", "@0neshot101/rbxdev-mcp"]
    }
  }
}
```

### Claude Desktop

Open Settings, navigate to MCP Servers, and add the same configuration.

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "rbxdev-roblox": {
      "command": "npx",
      "args": ["-y", "@0neshot101/rbxdev-mcp"]
    }
  }
}
```

### Windsurf

Open Cascade, go to MCP, click Add Server, and enter the command `npx -y @0neshot101/rbxdev-mcp`.

## Proxy mode

If the rbxdev-ls VS Code extension is already running, it owns the WebSocket server on port 21324. The MCP server detects this and connects as a proxy client through the extension's bridge. Both tools share the same executor connection with no conflicts.

If the extension is not running, the MCP server starts its own WebSocket server and waits for an executor to connect directly.

## Custom port

Set the `RBXDEV_BRIDGE_PORT` environment variable:

```json
{
  "mcpServers": {
    "rbxdev-roblox": {
      "command": "npx",
      "args": ["-y", "@0neshot101/rbxdev-mcp"],
      "env": {
        "RBXDEV_BRIDGE_PORT": "21325"
      }
    }
  }
}
```

## Available tools

The server registers 16 tools that AI assistants can call:

| Tool | Description |
|------|-------------|
| `get_bridge_status` | Check connection status |
| `execute_code` | Run Luau code in the game |
| `get_game_tree` | Browse the instance hierarchy |
| `get_properties` | Read instance properties |
| `set_property` | Write instance properties |
| `get_children` | List children of an instance |
| `create_instance` | Create a new instance |
| `clone_instance` | Duplicate an instance |
| `delete_instance` | Remove an instance |
| `reparent_instance` | Move an instance |
| `teleport_player` | Teleport to an instance |
| `get_script_source` | Decompile script source |
| `get_console_output` | Read print/warn/error output |
| `refresh_game_tree` | Request a fresh tree snapshot |
| `get_remote_calls` | View captured remote calls |
| `set_remote_spy_enabled` | Toggle the Remote Spy |

## Resources

Three read-only MCP resources are also available:

| URI | Content |
|-----|---------|
| `rbxdev://bridge/status` | Connection status as JSON |
| `rbxdev://game/tree` | Full game hierarchy as text |
| `rbxdev://console/logs` | Recent console output |
