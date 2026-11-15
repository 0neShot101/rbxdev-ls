import { spawn } from 'node:child_process';

import { CHECK_INTERVAL_MS, isRefreshDue, millisecondsUntilDue } from '@definitions/updates/storage';

import type { ChildProcess } from 'node:child_process';

import type { ChildLauncher, SchedulerOptions, UpdateScheduler } from '@typings/updates';

const INITIAL_DELAY_MS = 30_000;
const CANCEL_GRACE_MS = 2_000;
const CHILD_KILL_MS = 125_000;

const launchChild: ChildLauncher = args =>
  spawn(process.execPath, [...args], {
    'stdio': ['ignore', 'ignore', 'pipe', 'ipc'],
    'env': { ...process.env, 'ELECTRON_RUN_AS_NODE': '1' },
    'windowsHide': true,
  });

/**
 * Creates the scheduler that runs definitions refreshes in a short-lived child process: first 30 s after
 * initialization, then once per day, only while enabled and only when a daily check is due. The parent owns the
 * child: it drains stderr, cancels it over IPC, and force-kills it after a two-second grace period.
 * @param options - Cache and bundle locations, entry script, logger and test seams.
 */
export const createUpdateScheduler = (options: SchedulerOptions): UpdateScheduler => {
  const launch = options.launch ?? launchChild;
  const now = options.now ?? Date.now;
  let timer: NodeJS.Timeout | undefined;
  let child: ChildProcess | undefined;
  let exited: Promise<void> = Promise.resolve();

  const clearTimer = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };

  const start = (): void => {
    if (child !== undefined || isRefreshDue(options.cacheDirectory, now()) === false) return;
    const spawned = launch([
      options.entryScript,
      '--refresh-definitions',
      `--definitions-cache=${options.cacheDirectory}`,
      `--bundled-data=${options.bundledDirectory}`,
    ]);
    const killer = setTimeout(() => spawned.kill(), CHILD_KILL_MS);
    killer.unref();
    let isFinished = false;
    let finished = (): void => undefined;
    const done = new Promise<void>(resolve => (finished = () => resolve()));
    /** Runs once, on `close` or on a failed spawn that may never emit `exit`, so the next refresh is never blocked. */
    const finalize = (code: number | null): void => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(killer);
      if (child === spawned) child = undefined;
      options.log(`Definitions updater exited with code ${code ?? 'null'}`);
      finished();
    };
    spawned.stderr?.setEncoding('utf-8');
    spawned.stderr?.on('data', (text: string) => options.log(text.trimEnd()));
    spawned.on('error', error => {
      options.log(`Definitions updater failed to start: ${error.message}`);
      if (spawned.pid === undefined) finalize(null);
    });
    spawned.on('close', code => finalize(code));
    child = spawned;
    exited = done;
  };

  const arm = (delayMs: number): void => {
    clearTimer();
    timer = setTimeout(() => {
      timer = undefined;
      const wait = millisecondsUntilDue(options.cacheDirectory, now());
      if (wait > 0) return arm(wait);
      start();
      return arm(CHECK_INTERVAL_MS);
    }, delayMs);
    timer.unref();
  };

  const cancel = async (): Promise<void> => {
    const running = child;
    if (running === undefined) return;
    if (running.connected) running.send({ 'type': 'cancel' });
    const grace = setTimeout(() => running.kill(), CANCEL_GRACE_MS);
    await exited;
    clearTimeout(grace);
  };

  const setEnabled = (enabled: boolean): void => {
    if (enabled === false) {
      clearTimer();
      void cancel();
      return;
    }
    if (timer === undefined)
      arm(Math.max(options.initialDelayMs ?? INITIAL_DELAY_MS, millisecondsUntilDue(options.cacheDirectory, now())));
  };

  const stop = async (): Promise<void> => {
    clearTimer();
    await cancel();
  };

  return { setEnabled, stop };
};
