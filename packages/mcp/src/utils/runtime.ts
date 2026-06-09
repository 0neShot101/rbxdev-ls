import { createServer } from 'net';

import { DEFAULT_BRIDGE_PORT } from '@mcp/constants';

const parsePort = (rawPort: string): number | undefined => {
  if (/^\d+$/.test(rawPort) === false) return undefined;

  const parsed = Number(rawPort);
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) return parsed;
  return undefined;
};

export const getConfiguredPort = (): number => {
  const envPort = process.env['RBXDEV_BRIDGE_PORT'];
  if (envPort !== undefined) {
    const parsed = parsePort(envPort);
    if (parsed !== undefined) return parsed;
  }

  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1] !== undefined) {
    const parsed = parsePort(process.argv[portArgIndex + 1] as string);
    if (parsed !== undefined) return parsed;
  }

  return DEFAULT_BRIDGE_PORT;
};

export const isPortAvailable = (port: number): Promise<boolean> =>
  new Promise(resolve => {
    const tester = createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '127.0.0.1');
  });
