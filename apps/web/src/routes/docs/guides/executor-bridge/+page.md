
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

## Hot-reloading the bridge (contributors)

Keep your existing prod bridge script in the executor as the bootstrap. Once it connects to the extension, run:

```bash
bun run dev:bridge
```

The watcher connects to the bridge port as a proxy client and, on every save under `roblox/executor-bridge/src`, rebundles and pushes the fresh build into the connected client as an `execute` message. The in-game bridge swaps itself out using the same re-execution takeover it runs on a normal re-inject, so edits go live within about a second without touching the executor again.

A hot-reloaded build identifies itself as `<executor> (dev)` in the status bar, the `/health` endpoint, and the connection logs, so it is always clear whether prod or a dev build is live. Re-running the prod script (or rejoining the game) drops you back to a clean prod bridge.

If the watcher reports it is waiting for an executor, connect one and save again. The watcher reads its port from `RBXDEV_BRIDGE_PORT` (default `21324`).

## Troubleshooting

**Bridge not connecting?**

- Verify the extension is running (check the status bar)
- Ensure port 21324 is not blocked by a firewall
- Check the VS Code output panel (rbxdev-ls) for connection logs

**Game Tree not updating?**

- The auto-refresh system coalesces updates to prevent flooding. Changes appear within 2-30 seconds depending on frequency.
- Use the refresh button in the Game Tree panel to force a snapshot.
