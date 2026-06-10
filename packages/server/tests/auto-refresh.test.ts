import { readFileSync } from 'fs';
import * as path from 'path';

import { describe, expect, test } from 'bun:test';

import { createBridgeCore } from '@executor/bridgeCore';
import type { ServerMessage } from '@typings/protocol';

const noop = (): void => {};

describe('BridgeCore.setAutoRefresh', () => {
  test('sends a setAutoRefresh message with the given enabled + intervalMs', () => {
    const sent: ServerMessage[] = [];
    const core = createBridgeCore(
      m => sent.push(m),
      () => true,
      noop,
    );

    core.setAutoRefresh(true, 5000);

    expect(sent).toHaveLength(1);
    const msg = sent[0]!;
    expect(msg.type).toBe('setAutoRefresh');
    if (msg.type === 'setAutoRefresh') {
      expect(msg.enabled).toBe(true);
      expect(msg.intervalMs).toBe(5000);
    }
  });

  test('forwards disabled state', () => {
    const sent: ServerMessage[] = [];
    const core = createBridgeCore(
      m => sent.push(m),
      () => true,
      noop,
    );

    core.setAutoRefresh(false, 2000);

    expect(sent).toHaveLength(1);
    const msg = sent[0]!;
    if (msg.type === 'setAutoRefresh') {
      expect(msg.enabled).toBe(false);
      expect(msg.intervalMs).toBe(2000);
    } else {
      throw new Error('expected setAutoRefresh message');
    }
  });

  test('does not require a connected executor (fire-and-forget)', () => {
    // Unlike createRequest-based methods, setAutoRefresh is fire-and-forget:
    // it should still call sendFn even when isReady() returns false, so the
    // extension can safely issue it before the handshake completes.
    const sent: ServerMessage[] = [];
    const core = createBridgeCore(
      m => sent.push(m),
      () => false,
      noop,
    );

    core.setAutoRefresh(true, 5000);

    expect(sent).toHaveLength(1);
  });
});

// Static-source regression checks for the two Lua client files. We can't
// run Luau code in a Bun test, but we can assert the critical structural
// invariants that a helpful refactor could easily break:
//  - the auto-refresh subsystem is present
//  - the dirty flag is cleared BEFORE rebuilding (reentrancy)
//  - the old "flood" comment is gone
//  - cleanup runs on disconnect

const readFile = (...parts: string[]): string =>
  readFileSync(path.join(import.meta.dir, '..', '..', '..', ...parts), 'utf8');

describe('studio-plugin gameTree.luau auto-refresh subsystem', () => {
  const source = readFile('roblox', 'studio-plugin', 'src', 'handlers', 'gameTree.luau');

  test('exposes gameTree.setAutoRefresh and gameTree.shutdownAutoRefresh', () => {
    expect(/gameTree\.setAutoRefresh\s*=\s*function/.test(source)).toBe(true);
    expect(/gameTree\.shutdownAutoRefresh\s*=\s*function/.test(source)).toBe(true);
  });

  test('uses RunService.Heartbeat for the coalesced flush gate', () => {
    expect(/local\s+RunService\s*=\s*game:GetService['"]RunService['"]/.test(source)).toBe(true);
    expect(/RunService\.Heartbeat:Connect/.test(source)).toBe(true);
  });

  test('listens on both DescendantAdded and DescendantRemoving', () => {
    expect(/DescendantAdded:Connect\(markDirty\)/.test(source)).toBe(true);
    expect(/DescendantRemoving:Connect\(markDirty\)/.test(source)).toBe(true);
  });

  test('hooks game.ChildAdded for new top-level services', () => {
    expect(/game\.ChildAdded:Connect/.test(source)).toBe(true);
  });

  test('clears dirty state BEFORE rebuilding to preserve events during serialisation', () => {
    // heartbeatTick must reset isDirty before calling buildTree, so a
    // DescendantAdded firing mid-serialise re-arms the next flush.
    const tick = source.slice(source.indexOf('local heartbeatTick'));
    const clearsBefore = /isDirty\s*=\s*false[\s\S]*?pcall\(gameTree\.buildTree/.test(tick);
    expect(clearsBefore).toBe(true);
  });

  test('clamps interval to MIN_INTERVAL_SEC', () => {
    expect(/MIN_INTERVAL_SEC\s*=\s*2\.0/.test(source)).toBe(true);
    expect(/math\.max\(MIN_INTERVAL_SEC/.test(source)).toBe(true);
  });

  test('has a max-coalesce window to prevent starvation', () => {
    expect(/MAX_COALESCE_SEC\s*=\s*30\.0/.test(source)).toBe(true);
  });
});

describe('studio-plugin init.server.luau auto-refresh wiring', () => {
  const source = readFile('roblox', 'studio-plugin', 'src', 'init.server.luau');

  test('registers MESSAGE_HANDLERS.setAutoRefresh that forwards to gameTreeHandler', () => {
    expect(/MESSAGE_HANDLERS\.setAutoRefresh\s*=\s*function/.test(source)).toBe(true);
    expect(/gameTreeHandler\.setAutoRefresh\(message\.enabled,\s*message\.intervalMs/.test(source)).toBe(true);
  });

  test('calls shutdownAutoRefresh on WebSocket Closed and Error', () => {
    const closed = source.match(/wsClient\.Closed:Connect\(function\(\)[\s\S]*?end\)/);
    const errored = source.match(/wsClient\.Error:Connect\(function\([^)]*\)[\s\S]*?end\)/);
    expect(closed?.[0]).toContain('gameTreeHandler.shutdownAutoRefresh()');
    expect(errored?.[0]).toContain('gameTreeHandler.shutdownAutoRefresh()');
  });

  test('hooks plugin.Unloading to dispose listeners on plugin reload', () => {
    expect(/plugin\.Unloading:Connect/.test(source)).toBe(true);
    // The hook must reference shutdownAutoRefresh (via the handler module).
    const unload = source.match(/plugin\.Unloading:Connect\(function\(\)[\s\S]*?end\)/);
    expect(unload?.[0]).toContain('gameTreeHandler.shutdownAutoRefresh()');
  });
});

describe('executor-bridge.lua auto-refresh subsystem', () => {
  const source =
    readFile('roblox', 'executor-bridge', 'src', 'gameTree.luau') +
    readFile('roblox', 'executor-bridge', 'src', 'init.luau') +
    readFile('roblox', 'executor-bridge', 'src', 'state.luau');

  test('no longer contains the stale "flood" comment that said listeners are forbidden', () => {
    // Regression guard: this comment was the "grey zone" — if a helpful
    // refactor reintroduces it, the feature has been partially reverted.
    expect(source.includes('flood VS Code with redundant tree dumps')).toBe(false);
    expect(source.includes('No automatic DescendantAdded/DescendantRemoving listeners')).toBe(false);
  });

  test('declares the auto-refresh state and helpers', () => {
    expect(/local\s+autoRefreshEnabled\s*=\s*false/.test(source)).toBe(true);
    expect(/local\s+autoRefreshIntervalSec\s*=\s*5\.0/.test(source)).toBe(true);
    expect(/local\s+MIN_AUTO_REFRESH_INTERVAL_SEC\s*=\s*2\.0/.test(source)).toBe(true);
    expect(/local\s+MAX_COALESCE_SEC\s*=\s*30\.0/.test(source)).toBe(true);
  });

  test('uses RunService.Heartbeat (declared at file top) for the flush gate', () => {
    expect(/local\s+RunService\s*=\s*game:GetService['"]RunService['"]/.test(source)).toBe(true);
    expect(/RunService\.Heartbeat:Connect\(autoRefreshHeartbeatTick\)/.test(source)).toBe(true);
  });

  test('stores RBXScriptConnections in refreshConnections so re-execution cleanup disposes them', () => {
    // refreshConnections is the pre-wired table that the top-of-file
    // cleanup iterates when the bridge is re-executed.
    expect(/table\.insert\(.*refreshConnections,\s*addedConn\)/.test(source)).toBe(true);
    expect(/table\.insert\(.*refreshConnections,\s*removingConn\)/.test(source)).toBe(true);
    expect(/table\.insert\(.*refreshConnections,\s*autoRefreshHeartbeat\)/.test(source)).toBe(true);
    expect(/table\.insert\(.*refreshConnections,\s*autoRefreshTopLevel\)/.test(source)).toBe(true);
  });

  test('clears refreshConnections in-place (not by reassignment) to preserve getgenv reference', () => {
    // Reassigning `refreshConnections = {}` would leak the old table and
    // break the re-execution cleanup at the top of the file, since
    // getgenv()._RBXDEV_BRIDGE.refreshConnections would still point at
    // the stale reference.
    const detach = source.slice(source.indexOf('detachAutoRefreshListeners = function'));
    const detachEnd = detach.indexOf('\nend\n');
    const body = detach.slice(0, detachEnd + 5);
    expect(/for\s+i\s*=\s*#.*refreshConnections,\s*1,\s*-1\s+do\s+.*refreshConnections\[i\]\s*=\s*nil/.test(body)).toBe(
      true,
    );
    expect(/refreshConnections\s*=\s*\{\}\s*$/.test(body)).toBe(false);
  });

  test('registers MESSAGE_HANDLERS.setAutoRefresh that forwards to setAutoRefresh()', () => {
    expect(
      /MESSAGE_HANDLERS\.setAutoRefresh\s*=\s*function\(message\)[\s\S]*?setAutoRefresh\(message\.enabled,\s*message\.intervalMs\)/.test(
        source,
      ),
    ).toBe(true);
  });

  test('calls shutdownAutoRefresh on ws.OnClose so listeners release on disconnect', () => {
    const onClose = source.match(/ws\.OnClose:Connect\(function\(\)[\s\S]*?end\)/);
    expect(onClose?.[0]).toContain('shutdownAutoRefresh()');
  });

  test('clears dirty state before serialising the tree (reentrancy)', () => {
    const tick = source.slice(source.indexOf('autoRefreshHeartbeatTick'));
    const clearsBefore = /autoRefreshDirty\s*=\s*false[\s\S]*?getGameTree/.test(tick);
    expect(clearsBefore).toBe(true);
  });

  test('listens on both DescendantAdded and DescendantRemoving', () => {
    expect(/DescendantAdded:Connect\(markAutoRefreshDirty\)/.test(source)).toBe(true);
    expect(/DescendantRemoving:Connect\(markAutoRefreshDirty\)/.test(source)).toBe(true);
  });

  test('hooks game.ChildAdded so new top-level services get listeners attached', () => {
    const connect = source.match(/autoRefreshTopLevel\s*=\s*game\.ChildAdded:Connect\(function\(child\)[\s\S]*?end\)/);
    expect(connect).not.toBeNull();
    expect(connect?.[0]).toContain('attachAutoRefreshListeners(child)');
    expect(connect?.[0]).toContain('markAutoRefreshDirty()');
  });
});
