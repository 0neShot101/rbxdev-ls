import { request } from 'node:https';
import { createGunzip } from 'node:zlib';

import type { ClientRequest, IncomingMessage, OutgoingHttpHeaders } from 'node:http';
import type { Gunzip } from 'node:zlib';

import type { Dataset, DownloadResult, Downloader, RequestFunction, UpdateSources } from '@typings/updates';

const DEADLINE_MS = 20_000;
const MAX_REDIRECTS = 3;
const MEBIBYTE = 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Decoded-size limit of each dataset, in bytes. */
export const DATASET_LIMITS: Readonly<Record<Dataset, number>> = {
  'version': 16 * 1024,
  'api': 32 * MEBIBYTE,
  'robloxDocs': 32 * MEBIBYTE,
  'luauDocs': 2 * MEBIBYTE,
};

/** Fixed upstream sources; never configurable by users. */
export const UPSTREAM_SOURCES: UpdateSources = {
  'version': 'https://clientsettingscdn.roblox.com/v2/client-version/WindowsStudio64',
  'api': upload => `https://setup.rbxcdn.com/${upload}-Full-API-Dump.json`,
  'robloxDocs': 'https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/roblox/api-docs/en-us.json',
  'luauDocs': 'https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/1.69.0/scripts/api-docs/luau-en-us.json',
};

/**
 * Creates a downloader enforcing the updater's transfer policy: one 20 s deadline across redirects, gzip or
 * identity bodies only, per-dataset decoded-size limits, at most three same-origin redirects, no retries.
 * @param requestFunction - `https.request` in production; tests pass `http.request` with local URLs.
 */
export const createDownloader =
  (requestFunction: RequestFunction = request, deadlineMs: number = DEADLINE_MS): Downloader =>
  download =>
    new Promise<DownloadResult>((resolve, reject) => {
      const origin = new URL(download.url);
      const limit = DATASET_LIMITS[download.dataset];
      let active: ClientRequest | undefined;
      let decoder: Gunzip | undefined;
      let isSettled = false;

      const finish = (): void => {
        isSettled = true;
        clearTimeout(deadline);
        download.signal.removeEventListener('abort', onAbort);
        decoder?.destroy();
        active?.destroy();
      };

      const fail = (reason: string): void => {
        if (isSettled) return;
        finish();
        reject(new Error(`${download.dataset} download failed: ${reason}`));
      };

      const succeed = (result: DownloadResult): void => {
        if (isSettled) return;
        finish();
        resolve(result);
      };

      const onAbort = (): void => fail('cancelled');
      const deadline = setTimeout(() => fail(`no complete response within ${deadlineMs} ms`), deadlineMs);
      download.signal.addEventListener('abort', onAbort, { 'once': true });

      const readBody = (response: IncomingMessage): void => {
        const encoding = response.headers['content-encoding'] ?? 'identity';
        if (encoding !== 'gzip' && encoding !== 'identity') return fail(`unsupported content encoding ${encoding}`);
        const etag = response.headers.etag;
        const chunks: Buffer[] = [];
        let size = 0;
        const source = encoding === 'gzip' ? response.pipe((decoder = createGunzip())) : response;
        source.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > limit) return fail(`decoded body exceeds ${limit} bytes`);
          chunks.push(chunk);
        });
        source.on('end', () => succeed({ 'status': 'ok', 'body': Buffer.concat(chunks), etag }));
        source.on('error', (error: Error) => fail(error.message));
        response.on('aborted', () => fail('connection closed before the body completed'));
        response.on('error', (error: Error) => fail(error.message));
      };

      const get = (target: URL, redirects: number): void => {
        const headers: OutgoingHttpHeaders = { 'accept-encoding': 'gzip', 'user-agent': 'rbxdev-ls' };
        if (download.etag !== undefined) headers['if-none-match'] = download.etag;
        active = requestFunction(target, { headers }, response => {
          const status = response.statusCode ?? 0;
          if (status === 304) return succeed({ 'status': 'not-modified' });
          const location = response.headers.location;
          if (REDIRECT_STATUSES.has(status) && location !== undefined) {
            response.resume();
            const next = new URL(location, target);
            if (redirects >= MAX_REDIRECTS) return fail('too many redirects');
            if (next.protocol !== origin.protocol || next.host !== origin.host)
              return fail(`redirect to another origin ${next.origin}`);
            return get(next, redirects + 1);
          }
          if (status !== 200) {
            response.resume();
            return fail(`HTTP ${status}`);
          }
          return readBody(response);
        });
        active.on('error', (error: Error) => fail(error.message));
        active.end();
      };

      if (download.signal.aborted) fail('cancelled');
      else get(origin, 0);
    });
