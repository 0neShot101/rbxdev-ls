import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { createDownloader } from '@definitions/updates/download';

import type { AddressInfo } from 'node:net';

import type { RefreshEnvironment } from '@typings/updates';
import type { FixtureServer, RouteHandler, UpdateDirectories } from '@tests/types/updates';

/** Upload identifier served by the fixture version endpoint. */
export const UPLOAD = 'version-0123456789abcdef';

/** Builds a minimal valid API dump; `extraClass` adds one creatable class. */
export const apiDump = (extraClass: string = 'NewPart'): string =>
  JSON.stringify({
    'Version': 1,
    'Classes': [
      {
        'Name': 'Instance',
        'Superclass': '<<<ROOT>>>',
        'MemoryCategory': 'Instances',
        'Tags': ['NotCreatable', { 'PreferredDescriptorName': 'Instance' }],
        'Members': [
          { 'MemberType': 'Property', 'Name': 'Name', 'ValueType': { 'Name': 'string', 'Category': 'Primitive' } },
          {
            'MemberType': 'Function',
            'Name': 'GetBoundingBox',
            'Parameters': [],
            'ReturnType': [
              { 'Name': 'CFrame', 'Category': 'DataType' },
              { 'Name': 'Vector3', 'Category': 'DataType' },
            ],
          },
        ],
      },
      { 'Name': 'DataModel', 'Superclass': 'Instance', 'Members': [], 'Tags': ['NotCreatable'] },
      { 'Name': 'Workspace', 'Superclass': 'Instance', 'Members': [], 'Tags': ['NotCreatable', 'Service'] },
      { 'Name': extraClass, 'Superclass': 'Instance', 'Members': [] },
    ],
    'Enums': [{ 'Name': 'Material', 'Items': [{ 'Name': 'Plastic', 'Value': 256 }] }],
  });

/** Builds a minimal valid Roblox docs database. */
export const docsDatabase = (text: string = 'The name of the instance.'): string =>
  JSON.stringify({
    '@roblox/globaltype/Instance.Name': { 'documentation': text, 'learn_more_link': '', 'code_sample': '' },
  });

/** Serialises a Studio version response. */
export const versionResponse = (version: string, upload: string = UPLOAD): string =>
  JSON.stringify({ version, 'clientVersionUpload': upload });

/** Responds with a JSON body, optionally gzip-compressed, with an optional ETag. */
export const respond =
  (body: string, options: { readonly gzip?: boolean; readonly etag?: string } = {}): RouteHandler =>
  (request, response) => {
    if (options.etag !== undefined && request.headers['if-none-match'] === options.etag) {
      response.writeHead(304);
      response.end();
      return;
    }
    const headers: Record<string, string> = {};
    if (options.etag !== undefined) headers['etag'] = options.etag;
    if (options.gzip === true) headers['content-encoding'] = 'gzip';
    response.writeHead(200, headers);
    response.end(options.gzip === true ? gzipSync(body) : body);
  };

const isAddressInfo = (value: AddressInfo | string | null): value is AddressInfo =>
  typeof value === 'object' && value !== null;

/** Starts a local HTTP server whose routes tests replace per scenario. */
export const startFixtureServer = async (): Promise<FixtureServer> => {
  const routes = new Map<string, RouteHandler>();
  const requests: Array<{ readonly path: string; readonly etag: string | undefined }> = [];
  const server = createServer((incoming, response) => {
    const path = incoming.url ?? '/';
    const etag = incoming.headers['if-none-match'];
    requests.push({ path, 'etag': Array.isArray(etag) ? etag[0] : etag });
    const route = routes.get(path);
    if (route === undefined) {
      response.writeHead(404);
      response.end();
      return;
    }
    route(incoming, response);
  });
  const listening = Promise.withResolvers<void>();
  server.listen(0, '127.0.0.1', () => listening.resolve());
  await listening.promise;
  const address = server.address();
  const port = isAddressInfo(address) ? address.port : 0;
  const closed = (): Promise<void> => {
    const done = Promise.withResolvers<void>();
    server.closeAllConnections();
    server.close(() => done.resolve());
    return done.promise;
  };
  return { 'origin': `http://127.0.0.1:${port}`, routes, requests, 'close': closed };
};

/**
 * Builds a refresh environment that downloads from the fixture server.
 * @param origin - Fixture server origin.
 * @param now - Clock returning milliseconds.
 * @param deadlineMs - Download deadline.
 * @param rename - Rename implementation; tests inject failures.
 */
export const fixtureEnvironment = (
  origin: string,
  now: () => number,
  deadlineMs: number = 2_000,
  rename: RefreshEnvironment['rename'] = renameSync,
): RefreshEnvironment => ({
  'download': createDownloader(request, deadlineMs),
  'sources': {
    'version': `${origin}/version`,
    'api': upload => `${origin}/api/${upload}`,
    'robloxDocs': `${origin}/docs`,
    'luauDocs': `${origin}/luau`,
  },
  now,
  rename,
});

/**
 * Creates a cache directory and a bundled data directory with the given files.
 * @param bundled - File name to contents for the bundled directory.
 */
export const createDirectories = (bundled: Readonly<Record<string, string>>): UpdateDirectories => {
  const root = mkdtempSync(join(tmpdir(), 'rbxdev-updates-'));
  const cache = join(root, 'cache');
  const bundle = join(root, 'bundle');
  mkdirSync(cache);
  mkdirSync(bundle);
  for (const [file, contents] of Object.entries(bundled)) writeFileSync(join(bundle, file), contents);
  return { cache, bundle, 'remove': () => rmSync(root, { 'recursive': true, 'force': true }) };
};
