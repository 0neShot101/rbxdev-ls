#!/usr/bin/env node
/**
 * rbxdev-ls - Roblox/Luau Language Server
 *
 * High-performance language server with full Roblox API and Sunc support
 */

import { createServer, startServer } from '@core/server';

/**
 * Entry point for the rbxdev-ls language server.
 * Creates and starts the language server instance.
 * @returns {void} No return value
 */
const main = (): void => {
  const server = createServer();
  startServer(server);
};

main();
