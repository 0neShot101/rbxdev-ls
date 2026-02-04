#!/usr/bin/env node
/**
 * rbxdev-ls MCP Server
 *
 * Model Context Protocol server for AI assistants to interact with Roblox games
 */

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
