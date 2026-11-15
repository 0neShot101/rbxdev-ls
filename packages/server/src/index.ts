#!/usr/bin/env node

const readOption = (name: string): string | undefined =>
  process.argv.find(argument => argument.startsWith(`--${name}=`))?.slice(name.length + 3);

/**
 * The refresh child imports only the updater, so it never creates an LSP connection, document manager or bridge.
 * The language server reads its definition options before creating any of them.
 */
const main = async (): Promise<void> => {
  if (process.argv.includes('--refresh-definitions')) {
    const { runRefreshChild } = await import('@definitions/updates/refresh');
    const { findDataDir } = await import('@definitions/loader');
    const cacheDirectory = readOption('definitions-cache');
    if (cacheDirectory === undefined) throw new Error('--refresh-definitions requires --definitions-cache=<directory>');
    process.exitCode = await runRefreshChild(cacheDirectory, readOption('bundled-data') ?? findDataDir());
    return;
  }

  const { createServer, startServer } = await import('@core/server');
  const server = createServer({
    'cacheDirectory': readOption('definitions-cache'),
    'isUpdateEnabled': readOption('definitions-update') === 'true',
  });
  startServer(server);
};

void main();
