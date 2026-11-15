import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { WebSocket } from 'ws';

import { createExecutorBridge } from '@executor';
import { handleToolCall } from '@mcp/handlers/toolCalls';

import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResult } from 'rbxdev-server';

const listening = Promise.withResolvers<void>();
const bridge = createExecutorBridge(message => {
  if (message.includes('server started')) listening.resolve();
});
const frames: string[] = [];
const waiters: Array<() => void> = [];
let socket: WebSocket | undefined;

const nextFrame = async (): Promise<string> => {
  while (frames.length === 0) {
    const { promise, resolve } = Promise.withResolvers<void>();
    waiters.push(resolve);
    await promise;
  }
  return frames.shift() ?? '';
};

const frameType = (frame: string): string => {
  const parsed = /"type":"([A-Za-z]+)"/.exec(frame);
  return parsed?.[1] ?? '';
};

const frameId = (frame: string): string => /"id":"([^"]+)"/.exec(frame)?.[1] ?? '';

/** Sends a marker request and returns the frames the client received before it. */
const framesBeforeMarker = async (): Promise<string[]> => {
  bridge.requestGameTree();
  const earlier: string[] = [];
  for (let frame = await nextFrame(); frameType(frame) !== 'requestGameTree'; frame = await nextFrame())
    earlier.push(frame);
  return earlier;
};

const call = (name: string, args: CallToolRequest['params']['arguments']): Promise<ToolResult> =>
  handleToolCall({ 'method': 'tools/call', 'params': { name, 'arguments': args } }, bridge, []);

const textOf = (result: ToolResult): string => result.content.map(block => block.text).join('');

beforeAll(async () => {
  const probe = Bun.serve({ 'port': 0, 'fetch': () => new Response() });
  const port = probe.port;
  await probe.stop();
  if (port === undefined) throw new Error('No free port');
  bridge.start(port);
  await listening.promise;

  const connected = Promise.withResolvers<void>();
  bridge.onStatusChange(status => {
    if (status === 'connected') connected.resolve();
  });
  const opened = Promise.withResolvers<void>();
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  client.on('open', () => opened.resolve());
  client.on('message', (data, isBinary) => {
    if (isBinary === false && Buffer.isBuffer(data)) frames.push(data.toString('utf-8'));
    waiters.splice(0).forEach(resolve => resolve());
  });
  await opened.promise;
  client.send(JSON.stringify({ 'type': 'connected', 'executorName': 'TestExec', 'version': '1.0' }));
  socket = client;
  await connected.promise;
  await framesBeforeMarker();
});

afterAll(() => {
  socket?.close();
  bridge.stop();
});

describe('MCP tool argument decoding', () => {
  test('rejects non-string path segments without contacting the client', async () => {
    const result = await call('teleport_player', { 'path': ['Workspace', 5] });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('Error: path must be an array of strings');
    expect(await framesBeforeMarker()).toEqual([]);
  });

  test('rejects absent required fields without contacting the client', async () => {
    const result = await call('set_property', { 'path': ['Workspace', 'Part'], 'property': 'Name', 'value': 'x' });
    expect(textOf(result)).toBe('Error: valueType parameter is required (string)');
    expect(await framesBeforeMarker()).toEqual([]);
  });

  test.each([
    ['get_console_output', { 'limit': '10' }, 'Error: limit must be a number'],
    ['get_remote_calls', { 'limit': true }, 'Error: limit must be a number'],
    ['save_instance', { 'decompile': 'yes' }, 'Error: decompile must be a boolean'],
    ['get_children', { 'path': ['Workspace'], 'format': 3 }, 'Error: format must be "tree" or "json"'],
    ['set_remote_spy_enabled', { 'enabled': 'true' }, 'Error: enabled parameter is required (boolean)'],
    [
      'set_remote_spy_block_list',
      { 'blocks': [{ 'type': 'id', 'value': 'x' }] },
      'Error: each block must be { type: "path" | "name", value: string }',
    ],
  ])('%s rejects wrong scalar types', async (name, args, message) => {
    const result = await call(name, args);
    expect(textOf(result)).toBe(message);
    expect(await framesBeforeMarker()).toEqual([]);
  });

  test('valid input still reaches the client and keeps its output', async () => {
    const pending = call('teleport_player', { 'path': ['Workspace', 'SpawnLocation'] });
    const request = await nextFrame();
    expect(frameType(request)).toBe('teleportTo');
    socket?.send(JSON.stringify({ 'type': 'teleportToResult', 'id': frameId(request), 'success': true }));
    expect(textOf(await pending)).toBe('Successfully teleported to Workspace.SpawnLocation');
  });

  test('absent optional arguments keep their defaults', async () => {
    const result = await call('get_console_output', {});
    expect(textOf(result)).toBe('No console output');
  });
});
