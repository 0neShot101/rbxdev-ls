import { describe, expect, test } from 'bun:test';
import { createBridgeCore } from '@executor/bridgeCore';

import type { ServerMessage } from '@typings/protocol';

const noop = (): void => {};

const createRecordingCore = (isReady: boolean) => {
  const sent: ServerMessage[] = [];
  const core = createBridgeCore(
    message => void sent.push(message),
    () => isReady,
    noop,
  );
  return { core, sent };
};

describe('BridgeCore.setAutoRefresh', () => {
  test('sends a setAutoRefresh message with the given enabled + intervalMs', () => {
    const { core, sent } = createRecordingCore(true);

    core.setAutoRefresh(true, 5000);

    expect(sent).toEqual([{ 'type': 'setAutoRefresh', 'enabled': true, 'intervalMs': 5000 }]);
  });

  test('forwards disabled state', () => {
    const { core, sent } = createRecordingCore(true);

    core.setAutoRefresh(false, 2000);

    expect(sent).toEqual([{ 'type': 'setAutoRefresh', 'enabled': false, 'intervalMs': 2000 }]);
  });

  test('sends before the handshake completes because the request is fire-and-forget', () => {
    const { core, sent } = createRecordingCore(false);

    core.setAutoRefresh(true, 5000);

    expect(sent).toHaveLength(1);
  });

  /**
   * A hot reload adopts the live socket, so the transport never reports a disconnect and the editor's
   * connect-transition replay never fires; the bridge must re-apply the editor's last request.
   */
  test('replays the requested state when reloaded bridge code handshakes on the same socket', () => {
    const { core, sent } = createRecordingCore(true);

    core.setAutoRefresh(true, 5000);
    core.handleMessage(JSON.stringify({ 'type': 'connected', 'executorName': 'Synapse', 'version': '1.0.0' }));
    expect(sent.filter(message => message.type === 'setAutoRefresh')).toHaveLength(1);

    core.handleMessage(JSON.stringify({ 'type': 'connected', 'executorName': 'Synapse (dev)', 'version': '1.0.0' }));

    const replayed = sent.filter(message => message.type === 'setAutoRefresh');
    expect(replayed).toHaveLength(2);
    expect(replayed[1]).toEqual({ 'type': 'setAutoRefresh', 'enabled': true, 'intervalMs': 5000 });
  });

  test('does not replay a state the editor never requested', () => {
    const { core, sent } = createRecordingCore(true);

    const handshake = JSON.stringify({ 'type': 'connected', 'executorName': 'Synapse', 'version': '1.0.0' });
    core.handleMessage(handshake);
    core.handleMessage(handshake);

    expect(sent.filter(message => message.type === 'setAutoRefresh')).toHaveLength(0);
  });
});
