/**
 * Bundler launcher resolution and spawning, kept free of any VS Code API so it
 * stays unit-testable. The extension reads configuration and passes plain
 * options in.
 */

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import type { BundlerCommand, BundlerResolveOptions, BundlerRunError, CandidateRunner } from '@typings/bundler';

/** The published npm package that ships the bundler CLI. */
export const BUNDLER_PACKAGE = '@oneshot101/luau-bundler';

/** The bin name the published package exposes. */
export const BUNDLER_BIN = 'luau-bundler';

/** Exit code cmd.exe returns when a command is not recognized. */
export const CMD_NOT_FOUND_EXIT_CODE = 9009;

/**
 * Expands a command into the shims to try on the given platform. Windows
 * prefers the `.cmd` shim because npm-installed binaries are batch files.
 * @param command - The base command name (e.g. `npx`).
 * @param platform - The platform to expand for; defaults to the current one.
 * @returns Command names in the order they should be attempted.
 */
export const commandShims = (command: string, platform: NodeJS.Platform = process.platform): string[] =>
  platform === 'win32' ? [`${command}.cmd`, command] : [command];

/**
 * Determines whether a spawn failure means the executable itself is missing,
 * as opposed to the bundler running and failing.
 * @param error - The error thrown while running a candidate.
 * @returns True when the launcher should fall through to the next candidate.
 */
export const isMissingExecutableError = (error: unknown): boolean => {
  if (error instanceof Error === false) return false;
  const code = (error as BundlerRunError).code;
  if (code === 'ENOENT' || code === 'EINVAL' || code === CMD_NOT_FOUND_EXIT_CODE) return true;
  return /ENOENT|EINVAL|is not recognized|command not found/i.test(error.message);
};

/**
 * Quotes a value for cmd.exe, doubling embedded quotes. Values without shell
 * metacharacters pass through unchanged.
 * @param value - The command or argument to quote.
 * @returns The shell-safe value.
 */
export const quoteForShell = (value: string): string =>
  /[\s"&^]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/**
 * Runs a single launcher candidate via execFile, using a shell on Windows so
 * `.cmd` shims resolve. Rejects with the child error code preserved.
 * @param candidate - The launcher to spawn.
 * @param args - The bundler CLI arguments, appended after the candidate prefix.
 * @param cwd - The working directory for the spawn.
 * @returns A promise that resolves when the bundler exits successfully.
 */
export const runCandidate: CandidateRunner = (candidate: BundlerCommand, args: string[], cwd: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const useShell = process.platform === 'win32';
    const fullArgs = [...candidate.prefix, ...args];
    execFile(
      useShell ? quoteForShell(candidate.command) : candidate.command,
      useShell ? fullArgs.map(quoteForShell) : fullArgs,
      { cwd, 'windowsHide': true, 'shell': useShell },
      (error, _stdout, stderr) => {
        if (error !== null) {
          const message = stderr.trim() !== '' ? stderr.trim() : error.message;
          const runError = new Error(message) as BundlerRunError;
          if (typeof error.code === 'string' || typeof error.code === 'number') runError.code = error.code;
          reject(runError);
          return;
        }

        resolve();
      },
    );
  });

/**
 * Runs the bundler, falling through candidates whose executables are missing.
 * Any other failure propagates immediately.
 * @param candidates - Launchers in priority order.
 * @param args - The bundler CLI arguments.
 * @param cwd - The working directory for the spawn.
 * @param runner - The candidate runner; injectable for tests.
 * @returns A promise that resolves once a candidate succeeds.
 */
export const runBundler = async (
  candidates: BundlerCommand[],
  args: string[],
  cwd: string,
  runner: CandidateRunner = runCandidate,
): Promise<void> => {
  const missingLaunchers: string[] = [];

  for (const candidate of candidates) {
    try {
      await runner(candidate, args, cwd);
      return;
    } catch (error) {
      if (isMissingExecutableError(error)) {
        missingLaunchers.push(candidate.label);
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Could not find a bundler launcher (${missingLaunchers.join(', ')}). Install Node.js/npm or set rbxdev-ls.bundler.path to a luau-bundler executable.`,
  );
};

/**
 * Resolves bundler commands. Priority order:
 * 1. User-configured custom path (rbxdev-ls.bundler.path setting)
 * 2. Local workspace copy (../luau-bundler/src/cli.ts via bun, for development)
 * 3. Published package via npx/npm exec (for end users)
 * @param options - The configured custom path and the extension install path.
 * @returns Ordered command candidates and their prefix args.
 */
export const resolveBundlerCommands = (options: BundlerResolveOptions): BundlerCommand[] => {
  if (options.customPath !== '' && fs.existsSync(options.customPath))
    return [{ 'command': options.customPath, 'prefix': [], 'label': options.customPath }];

  const candidates: BundlerCommand[] = [];
  const localCli = path.join(options.extensionPath, '..', 'luau-bundler', 'src', 'cli.ts');
  if (fs.existsSync(localCli))
    for (const command of commandShims('bun')) candidates.push({ command, 'prefix': [localCli], 'label': command });

  for (const command of commandShims('npx'))
    candidates.push({ command, 'prefix': ['-y', BUNDLER_PACKAGE], 'label': command });

  for (const command of commandShims('npm'))
    candidates.push({
      command,
      'prefix': ['exec', '-y', '--package', BUNDLER_PACKAGE, '--', BUNDLER_BIN],
      'label': `${command} exec`,
    });

  return candidates;
};
