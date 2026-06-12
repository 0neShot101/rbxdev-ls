/// <reference types="@types/bun" />
/// <reference types="@types/node" />

/**
 * Executor bridge hot-reload watcher.
 *
 * Connects to the running language server's bridge port as a proxy client and
 * pushes a freshly bundled dev build of the executor bridge into the connected
 * Roblox client on every source change. The bundle is sent as an `execute`
 * message, so the in-game bridge swaps itself out using the same re-execution
 * takeover it already runs on a normal re-inject.
 *
 * Workflow: keep your existing prod bridge script in the executor as the
 * bootstrap. Once it connects, run `bun run dev:bridge`. From then on, saving
 * any file under roblox/executor-bridge/src hot-swaps the in-game bridge,
 * which re-identifies as "<executor> (dev)" so the status bar and /health
 * endpoint show whether prod or a dev build is live.
 */

import { watch } from 'fs';
import { join } from 'path';

import { bundle } from '../packages/luau-bundler/src/index';

const BRIDGE_PORT = Number(process.env['RBXDEV_BRIDGE_PORT'] ?? 21324);
const SOURCE_DIR = join(import.meta.dir, '..', 'roblox', 'executor-bridge', 'src');
const DEBOUNCE_MS = 150;
const RECONNECT_DELAY_MS = 2000;
/**
 * Delay before the first inject after an executor appears. A freshly connected
 * prod bridge is mid-way through serialising its full first-connect tree;
 * letting it finish before the dev build takes over avoids overlapping two
 * heavy serialisations and tearing the connection down while it is encoding.
 */
const INITIAL_INJECT_DELAY_MS = 1500;

/**
 * Wraps a dev bundle so it runs safely when pushed through the live bridge.
 *
 * The bundle is delivered as an `execute` message, which the running bridge
 * handles synchronously inside its own WebSocket message callback. The bundle's
 * re-execution takeover closes that very socket, and tearing a WebSocket down
 * from inside its own callback crashes the executor. Deferring the bundle onto
 * a fresh task thread moves the takeover off the callback stack so the close is
 * safe. The dev flag is set before the deferred body so the swapped-in build
 * still identifies as a dev build.
 */
const wrapDevBundle = (bundleSource: string): string =>
  `if getgenv then getgenv()._RBXDEV_DEV = true end\ntask.defer(function(...)\n${bundleSource}\nend)\n`;

interface ProxyWelcome {
  readonly type: 'proxyWelcome';
  readonly isConnected: boolean;
  readonly executorName?: string;
}

interface ProxyStatusChange {
  readonly type: 'proxyStatusChange';
  readonly status: 'connected' | 'disconnected';
  readonly executorName?: string;
}

interface ConnectedMessage {
  readonly type: 'connected';
  readonly executorName: string;
  readonly version: string;
}

let socket: WebSocket | undefined;
let executorConnected = false;
let hasPushedInitial = false;
let initialInjectScheduled = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

const stamp = (): string => new Date().toLocaleTimeString();

const log = (message: string): void => console.log(`[dev-bridge ${stamp()}] ${message}`);

const generateId = (): string => Math.random().toString(36).slice(2, 10);

const buildDevBundle = (): string => {
  const result = bundle({ 'sourceDir': SOURCE_DIR, 'header': 'rbxdev executor bridge (dev)' });
  log(`bundled ${result.moduleCount} modules in ${result.elapsedMs.toFixed(1)}ms`);
  return wrapDevBundle(result.output);
};

const pushBundle = (reason: string): void => {
  if (socket === undefined || socket.readyState !== WebSocket.OPEN)
    return log('not connected to bridge, skipping push');
  if (executorConnected === false) return log('no executor connected, will push on next change once connected');

  const code = buildDevBundle();
  socket.send(JSON.stringify({ 'type': 'execute', 'id': generateId(), code }));
  hasPushedInitial = true;
  log(`pushed dev build (${reason}); waiting for in-game bridge to swap and reconnect`);
};

const onExecutorAvailable = (): void => {
  executorConnected = true;
  if (hasPushedInitial || initialInjectScheduled) return;
  initialInjectScheduled = true;
  log(`executor present; pushing dev build in ${INITIAL_INJECT_DELAY_MS / 1000}s`);
  setTimeout(() => {
    initialInjectScheduled = false;
    pushBundle('initial inject');
  }, INITIAL_INJECT_DELAY_MS);
};

const handleMessage = (raw: string): void => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (typeof parsed !== 'object' || parsed === null) return;

  const message = parsed as { type?: string };

  if (message.type === 'proxyWelcome') {
    const welcome = message as ProxyWelcome;
    if (welcome.isConnected) {
      log(`bridge already has a client: ${welcome.executorName ?? 'unknown'}`);
      onExecutorAvailable();
    } else log('connected to bridge, waiting for an executor');
    return;
  }

  if (message.type === 'proxyStatusChange') {
    const change = message as ProxyStatusChange;
    if (change.status === 'connected') {
      log(`executor connected: ${change.executorName ?? 'unknown'}`);
      onExecutorAvailable();
    } else {
      executorConnected = false;
      log('executor disconnected');
    }
    return;
  }

  if (message.type === 'connected') {
    const connected = message as ConnectedMessage;
    const isDev = connected.executorName.endsWith('(dev)');
    log(`${isDev ? 'dev build live' : 'prod bridge live'}: ${connected.executorName} v${connected.version}`);
  }
};

const connect = (): void => {
  log(`connecting to ws://127.0.0.1:${BRIDGE_PORT}`);
  const ws = new WebSocket(`ws://127.0.0.1:${BRIDGE_PORT}`);
  socket = ws;

  ws.addEventListener('open', () => {
    log('connected, registering as proxy');
    ws.send(JSON.stringify({ 'type': 'proxyHandshake' }));
  });

  ws.addEventListener('message', event => {
    if (typeof event.data === 'string') handleMessage(event.data);
  });

  ws.addEventListener('close', () => {
    socket = undefined;
    executorConnected = false;
    hasPushedInitial = false;
    initialInjectScheduled = false;
    log(`disconnected from bridge, retrying in ${RECONNECT_DELAY_MS / 1000}s (is the LSP server running?)`);
    setTimeout(connect, RECONNECT_DELAY_MS);
  });

  ws.addEventListener('error', () => {
    /* close handler drives the retry */
  });
};

const onSourceChange = (): void => {
  if (debounceTimer !== undefined) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    pushBundle('file change');
  }, DEBOUNCE_MS);
};

log(`watching ${SOURCE_DIR}`);
watch(SOURCE_DIR, { 'recursive': true }, (_event, filename) => {
  if (filename === null) return;
  if (filename.endsWith('.luau') === false && filename.endsWith('.lua') === false) return;
  onSourceChange();
});

connect();
