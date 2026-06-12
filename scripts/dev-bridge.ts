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

/** Preamble prepended to every dev bundle so the bridge identifies as a dev build. */
const DEV_PREAMBLE = 'if getgenv then getgenv()._RBXDEV_DEV = true end\n';

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
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

const stamp = (): string => new Date().toLocaleTimeString();

const log = (message: string): void => console.log(`[dev-bridge ${stamp()}] ${message}`);

const generateId = (): string => Math.random().toString(36).slice(2, 10);

const buildDevBundle = (): string => {
  const result = bundle({ 'sourceDir': SOURCE_DIR, 'header': 'rbxdev executor bridge (dev)' });
  log(`bundled ${result.moduleCount} modules in ${result.elapsedMs.toFixed(1)}ms`);
  return DEV_PREAMBLE + result.output;
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
  if (hasPushedInitial === false) pushBundle('initial inject');
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
