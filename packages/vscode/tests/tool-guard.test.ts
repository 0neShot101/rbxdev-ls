import { describe, expect, test } from 'bun:test';

import { catchTool, guardTool } from '@extension/utils/toolGuard';

const createClientStub = () => {
  const requests: string[] = [];
  return {
    requests,
    'sendRequest': async (method: string): Promise<string> => {
      requests.push(method);
      return `handled ${method}`;
    },
  };
};

describe('guardTool', () => {
  test('returns the connection error without reaching the client when disconnected', async () => {
    const client = createClientStub();
    const handler = guardTool(
      () => false,
      async () => client.sendRequest('custom/teleportTo'),
    );

    expect(await handler({ 'path': ['Workspace'] })).toBe('Error: No executor connected');
    expect(client.requests).toEqual([]);
  });

  test('forwards input to the handler when connected', async () => {
    const client = createClientStub();
    const received: unknown[] = [];
    const handler = guardTool(
      () => true,
      async input => {
        received.push(input);
        return client.sendRequest('custom/teleportTo');
      },
    );

    expect(await handler({ 'path': ['Workspace'] })).toBe('handled custom/teleportTo');
    expect(received).toEqual([{ 'path': ['Workspace'] }]);
    expect(client.requests).toEqual(['custom/teleportTo']);
  });

  test('converts a thrown error into an error result', async () => {
    const handler = guardTool(
      () => true,
      async () => {
        throw new Error('bridge offline');
      },
    );

    expect(await handler(undefined)).toBe('Error: bridge offline');
  });
});

describe('catchTool', () =>
  test('converts non-Error throws into an error result', async () => {
    const handler = catchTool(async () => {
      throw 'timeout';
    });

    expect(await handler(undefined)).toBe('Error: timeout');
  }));
