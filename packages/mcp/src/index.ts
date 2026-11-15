#!/usr/bin/env node

import { startMcpServer } from '@mcp/server';

const main = async (): Promise<void> => {
  try {
    await startMcpServer();
  } catch (cause) {
    console.error('[mcp] Fatal error:', cause instanceof Error ? cause.message : String(cause));
    process.exit(1);
  }
};

void main();
