# @oneshot101/rbxdev-mcp

MCP (Model Context Protocol) server that connects AI tools to live Roblox game instances. Lets Claude, Cursor, Windsurf, and other MCP-compatible AI assistants interact with your game in real-time.

## Setup

Add this to your MCP configuration:

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

**Where to put this config:**

| Tool | Config location |
|------|----------------|
| Claude Code | `~/.claude/mcp_config.json` |
| Claude Desktop | Settings > MCP Servers |
| Cursor | `.cursor/mcp.json` in your project |
| Windsurf | Cascade > MCP > Add Server |

### Requirements

- **Node.js 18+**
- **A Roblox executor** with WebSocket bridge support (e.g., Volt)
- The executor must be connected to a running Roblox game

### Port configuration

The server connects to the executor bridge on port `21324` by default. If the [rbxdev-ls VS Code extension](https://github.com/0neShot101/rbxdev-ls) is already running, the MCP server automatically connects as a proxy — no port conflicts.

To use a custom port:

```json
{
  "mcpServers": {
    "rbxdev-roblox": {
      "command": "npx",
      "args": ["-y", "@oneshot101/rbxdev-mcp"],
      "env": {
        "RBXDEV_BRIDGE_PORT": "21325"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `get_bridge_status` | Check if the bridge is running and connected |
| `execute_code` | Run Luau code in the game with full Roblox API access |
| `get_game_tree` | Browse the game hierarchy (services, instances, children) |
| `get_properties` | Read property values from any instance |
| `set_property` | Set properties on instances (supports Vector3, Color3, etc.) |
| `get_children` | List children of an instance |
| `create_instance` | Create new instances in the game |
| `clone_instance` | Clone existing instances |
| `delete_instance` | Remove instances from the game |
| `reparent_instance` | Move instances to a new parent |
| `teleport_player` | Teleport the local player to an instance |
| `get_script_source` | Decompile and read script source code |
| `get_console_output` | Read recent print/warn/error output |
| `refresh_game_tree` | Request a fresh snapshot of the game tree |
| `get_remote_calls` | View captured RemoteEvent/RemoteFunction calls |
| `set_remote_spy_enabled` | Toggle the Remote Spy |

## Resources

The server also exposes MCP resources for passive reading:

- `rbxdev://bridge/status` — Connection status as JSON
- `rbxdev://game/tree` — Full game tree as text
- `rbxdev://console/logs` — Recent console output

## How it works

The MCP server communicates with a Roblox executor over a local WebSocket connection. When you ask your AI assistant to interact with the game, it calls the MCP tools which send commands to the executor running inside Roblox.

```
AI Assistant <--stdio--> MCP Server <--WebSocket--> Executor <---> Roblox Game
```

If the rbxdev-ls VS Code extension is already running (it owns the WebSocket server), the MCP server connects as a proxy client through the extension's bridge — both tools share the same executor connection with zero conflicts.

## Part of rbxdev-ls

This MCP server is part of [rbxdev-ls](https://github.com/0neShot101/rbxdev-ls), a Roblox/Luau language server with type checking, completions, and live game integration.

## License

MIT
