#!/usr/bin/env node

import { startMcpServer } from '@mcp/server';

const main = async (): Promise<void> => {
  try {
    await startMcpServer();
  } catch (err) {
    console.error('[mcp] Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
};

main();
