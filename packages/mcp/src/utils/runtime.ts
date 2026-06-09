import { createServer } from 'net';

import { DEFAULT_BRIDGE_PORT } from '@mcp/constants';

export const getConfiguredPort = (): number => {
  const envPort = process.env['RBXDEV_BRIDGE_PORT'];
  if (envPort !== undefined) {
    const parsed = parseInt(envPort, 10);
    if (Number.isNaN(parsed) === false && parsed > 0 && parsed < 65536) return parsed;
  }

  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1] !== undefined) {
    const parsed = parseInt(process.argv[portArgIndex + 1] as string, 10);
    if (Number.isNaN(parsed) === false && parsed > 0 && parsed < 65536) return parsed;
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
