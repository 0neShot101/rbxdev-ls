
# Executor Bridge

The executor bridge is a Luau script that runs inside a Roblox game and opens a WebSocket connection back to VS Code. It enables live game features: Game Tree browsing, property editing, code execution, and Remote Spy.

## Setup

Paste this into your executor's auto-execute:

```lua
loadstring(game:HttpGetAsync('https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/scripts/executor-bridge.lua'))()
```

When you join a game, the bridge connects automatically. The VS Code status bar shows **Roblox: Connected** when active.

## Custom configuration

Pass a config table to customize the bridge behavior:

```lua
loadstring(game:HttpGetAsync('https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/scripts/executor-bridge.lua'))({
    host = 'ws://127.0.0.1:21324';
    reconnectDelay = 5;
    firstConnectDepth = 999;
    updateTreeDepth = 2;
    expandedTreeDepth = 2;
})
```

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `host` | `ws://127.0.0.1:21324` | WebSocket URL to connect to |
| `reconnectDelay` | `5` | Seconds between reconnection attempts |
| `firstConnectDepth` | `999` | Instance tree depth on first connection |
| `updateTreeDepth` | `3` | Depth of tree updates when instances change |
| `expandedTreeDepth` | `2` | Depth sent when expanding a tree node |

## How it works

1. The bridge detects your executor's WebSocket implementation (supports Volt, Wave, Zorara, Swift, and any executor with a standard WebSocket API)
2. It performs a health probe on the VS Code extension's HTTP endpoint
3. On successful connection, it sends a full game tree snapshot
4. The auto-refresh system uses coalesced Heartbeat events to efficiently stream instance changes

## Features enabled

Once connected, you get:

- **Game Tree** sidebar showing the live instance hierarchy
- **Properties panel** for viewing and editing instance properties
- **Code execution** with `Ctrl+Shift+E` (file) or `Ctrl+Shift+Alt+E` (selection)
- **Remote Spy** capturing FireServer and InvokeServer calls
- **Instance manipulation** (create, clone, delete, reparent, teleport)

## Troubleshooting

**Bridge not connecting?**

- Verify the extension is running (check the status bar)
- Ensure port 21324 is not blocked by a firewall
- Check the VS Code output panel (rbxdev-ls) for connection logs

**Game Tree not updating?**

- The auto-refresh system coalesces updates to prevent flooding. Changes appear within 2-30 seconds depending on frequency.
- Use the refresh button in the Game Tree panel to force a snapshot.
