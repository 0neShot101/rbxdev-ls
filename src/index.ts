#!/usr/bin/env node

import { createServer, startServer } from '@core/server';

const main = (): void => {
  const server = createServer();
  startServer(server);
};

main();
