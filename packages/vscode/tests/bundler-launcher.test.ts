import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { afterAll, describe, expect, test } from 'bun:test';

import {
  BUNDLER_BIN,
  BUNDLER_PACKAGE,
  commandShims,
  isMissingExecutableError,
  quoteForShell,
  resolveBundlerCommands,
  runBundler,
} from '../src/bundlerLauncher';

import type { BundlerCommand, CandidateRunner } from '../src/types/bundler';

const tempRoots: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bundler-launcher-test-'));
  tempRoots.push(dir);
  return dir;
};

afterAll(() => {
  for (const dir of tempRoots) rmSync(dir, { 'recursive': true, 'force': true });
});

const codedError = (message: string, code?: string | number): Error =>
  code === undefined ? new Error(message) : Object.assign(new Error(message), { code });

const candidate = (command: string, label = command): BundlerCommand => ({ command, 'prefix': [], label });

describe('Bundler Launcher - commandShims', () => {
  test('prefers the .cmd shim on win32', () => {
    expect(commandShims('x', 'win32')).toEqual(['x.cmd', 'x']);
  });

  test('uses the bare command on linux', () => {
    expect(commandShims('x', 'linux')).toEqual(['x']);
  });
});

describe('Bundler Launcher - isMissingExecutableError', () => {
  test('matches missing-executable error codes', () => {
    expect(isMissingExecutableError(codedError('x', 'ENOENT'))).toBe(true);
    expect(isMissingExecutableError(codedError('x', 'EINVAL'))).toBe(true);
    expect(isMissingExecutableError(codedError('x', 9009))).toBe(true);
  });

  test('matches missing-executable messages without codes', () => {
    expect(isMissingExecutableError(new Error('spawn npx ENOENT'))).toBe(true);
    expect(isMissingExecutableError(new Error("'npx' is not recognized as an internal or external command"))).toBe(
      true,
    );
    expect(isMissingExecutableError(new Error('command not found: npx'))).toBe(true);
  });

  test('rejects unrelated errors and non-errors', () => {
    expect(isMissingExecutableError(new Error('boom'))).toBe(false);
    expect(isMissingExecutableError('not an error')).toBe(false);
    expect(isMissingExecutableError(undefined)).toBe(false);
  });
});

describe('Bundler Launcher - quoteForShell', () => {
  test('passes plain values through unchanged', () => {
    expect(quoteForShell('plain')).toBe('plain');
  });

  test('wraps values containing spaces', () => {
    expect(quoteForShell('has space')).toBe('"has space"');
  });

  test('doubles embedded quotes', () => {
    expect(quoteForShell('say "hi"')).toBe('"say ""hi"""');
  });

  test('wraps values containing cmd metacharacters', () => {
    expect(quoteForShell('a|b')).toBe('"a|b"');
    expect(quoteForShell('a>b')).toBe('"a>b"');
    expect(quoteForShell('a<b')).toBe('"a<b"');
    expect(quoteForShell('dev(x)')).toBe('"dev(x)"');
    expect(quoteForShell('a&b')).toBe('"a&b"');
  });
});

describe('Bundler Launcher - resolveBundlerCommands', () => {
  const npxShims = commandShims('npx');
  const npmShims = commandShims('npm');

  test('an existing custom path is the sole candidate with an empty prefix', () => {
    const dir = makeTempDir();
    const customPath = path.join(dir, 'luau-bundler.exe');
    writeFileSync(customPath, '');

    const commands = resolveBundlerCommands({ customPath, 'extensionPath': dir });
    expect(commands).toEqual([{ 'command': customPath, 'prefix': [], 'label': customPath }]);
  });

  test('a nonexistent custom path is ignored', () => {
    const dir = makeTempDir();
    const commands = resolveBundlerCommands({
      'customPath': path.join(dir, 'does-not-exist.exe'),
      'extensionPath': dir,
    });

    expect(commands.length).toBe(npxShims.length + npmShims.length);
    expect(commands.some(entry => entry.command.includes('does-not-exist'))).toBe(false);
  });

  test('a sibling luau-bundler checkout puts bun candidates first', () => {
    const root = makeTempDir();
    const extensionPath = path.join(root, 'vscode');
    const cliDir = path.join(root, 'luau-bundler', 'src');
    mkdirSync(extensionPath, { 'recursive': true });
    mkdirSync(cliDir, { 'recursive': true });
    const localCli = path.join(cliDir, 'cli.ts');
    writeFileSync(localCli, '');

    const commands = resolveBundlerCommands({ 'customPath': '', extensionPath });
    const bunShims = commandShims('bun');

    expect(commands.slice(0, bunShims.length)).toEqual(
      bunShims.map(command => ({ command, 'prefix': [localCli], 'label': command })),
    );
  });

  test('npx candidates always precede npm exec candidates', () => {
    const commands = resolveBundlerCommands({ 'customPath': '', 'extensionPath': makeTempDir() });

    expect(commands).toEqual([
      ...npxShims.map(command => ({ command, 'prefix': ['-y', BUNDLER_PACKAGE], 'label': command })),
      ...npmShims.map(command => ({
        command,
        'prefix': ['exec', '-y', '--package', BUNDLER_PACKAGE, '--', BUNDLER_BIN],
        'label': `${command} exec`,
      })),
    ]);
  });
});

describe('Bundler Launcher - runBundler', () => {
  test('aggregates labels when every candidate executable is missing', async () => {
    const candidates = [candidate('npx'), candidate('npm', 'npm exec')];
    const missingRunner: CandidateRunner = () => Promise.reject(codedError('spawn fail', 'ENOENT'));

    await expect(runBundler(candidates, [], '.', missingRunner)).rejects.toThrow(
      'Could not find a bundler launcher (npx, npm exec)',
    );
  });

  test('stops at the first successful candidate', async () => {
    const attempted: string[] = [];
    const runner: CandidateRunner = entry => {
      attempted.push(entry.command);
      return Promise.resolve();
    };

    await runBundler([candidate('bun'), candidate('npx')], [], '.', runner);
    expect(attempted).toEqual(['bun']);
  });

  test('propagates non-missing errors without trying later candidates', async () => {
    const attempted: string[] = [];
    const runner: CandidateRunner = entry => {
      attempted.push(entry.command);
      return Promise.reject(new Error('syntax error in bundle'));
    };

    await expect(runBundler([candidate('bun'), candidate('npx')], [], '.', runner)).rejects.toThrow(
      'syntax error in bundle',
    );
    expect(attempted).toEqual(['bun']);
  });
});
