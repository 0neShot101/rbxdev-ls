import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { createUpdateScheduler } from '@core/updates';
import { loadDefinitions } from '@definitions/loader';
import { openDocsStore, serializeDocs } from '@definitions/updates/docsStore';
import { refreshDefinitions } from '@definitions/updates/refresh';
import { acquireLock, FILES, isRefreshDue, readCurrentSnapshot } from '@definitions/updates/storage';
import { decodeApiDump, encodeApiDump, openApiDump } from '@definitions/updates/validate';
import { expectDefined } from '@tests/helpers/expect';
import {
  apiDump,
  createDirectories,
  docsDatabase,
  fixtureEnvironment,
  respond,
  startFixtureServer,
  UPLOAD,
  versionResponse,
} from '@tests/helpers/updates';

import type { RefreshEnvironment, RefreshResult } from '@typings/updates';
import type { FixtureServer, UpdateDirectories } from '@tests/types/updates';

const DAY_MS = 24 * 60 * 60 * 1000;
let server: FixtureServer;
let directories: UpdateDirectories;
let now: number;

const serveUpstream = (version: string = '0.800.0.1', docsEtag: string = '"docs-1"'): void => {
  server.routes.set('/version', respond(versionResponse(version)));
  server.routes.set(`/api/${UPLOAD}`, respond(apiDump(), { 'gzip': true }));
  server.routes.set('/docs', respond(docsDatabase(), { 'etag': docsEtag }));
};

const refresh = (
  environment: RefreshEnvironment = fixtureEnvironment(server.origin, () => now),
  signal: AbortSignal = new AbortController().signal,
): Promise<RefreshResult> =>
  refreshDefinitions({
    'destination': directories.cache,
    'bundledDirectory': directories.bundle,
    'mode': 'runtime',
    signal,
    'logger': () => undefined,
    environment,
  });

const readPointer = (): string | undefined =>
  existsSync(join(directories.cache, FILES.pointer))
    ? readFileSync(join(directories.cache, FILES.pointer), 'utf-8')
    : undefined;

const generationCount = (): number =>
  readdirSync(directories.cache, { 'withFileTypes': true }).filter(entry => entry.isDirectory()).length;

const publishInitialSnapshot = async (): Promise<string> => {
  serveUpstream();
  expect((await refresh()).kind).toBe('published');
  now += DAY_MS + 1;
  server.requests.length = 0;
  return expectDefined(readPointer());
};

beforeEach(async () => {
  server = await startFixtureServer();
  directories = createDirectories({ 'luau-docs.json': docsDatabase('Luau print.') });
  now = 1_800_000_000_000;
});

afterEach(async () => {
  await server.close();
  directories.remove();
});

describe('publication', () => {
  test('publishes a complete snapshot and accepts array return types', async () => {
    serveUpstream();
    const result = await refresh();
    expect(result.kind).toBe('published');

    const snapshot = expectDefined(readCurrentSnapshot(directories.cache));
    expect(snapshot.manifest.apiVersion).toBe('0.800.0.1');
    expect(snapshot.manifest.docsEtag).toBe('"docs-1"');
    expect(snapshot.manifest.docsLayout).toBe('sorted-lines');
    const storedApi = readFileSync(join(snapshot.directory, FILES.api), 'utf-8');
    expect(storedApi).not.toContain('MemoryCategory');
    expect(storedApi).toContain('{"PreferredDescriptorName":"Instance"}');
    const loaded = loadDefinitions({ 'cacheDirectory': directories.cache, 'bundledDirectory': directories.bundle });
    const instance = loaded.roblox?.Classes.find(item => item.Name === 'Instance');
    const boundingBox = instance?.Members.find(member => member.Name === 'GetBoundingBox');
    expect(boundingBox?.MemberType === 'Function' ? boundingBox.ReturnType.Name : undefined).toBe('CFrame');
    expect(loaded.roblox?.Classes.some(item => item.Name === 'NewPart')).toBe(true);
    expect(loaded.robloxDocs?.get('@roblox/globaltype/Instance.Name')?.documentation).toBe('The name of the instance.');
    expect(loaded.luauDocs?.get('@roblox/globaltype/Instance.Name')?.documentation).toBe('Luau print.');
  });

  test('an unchanged version and a 304 for docs reuse the snapshot without downloading the API', async () => {
    const pointer = await publishInitialSnapshot();
    const generations = generationCount();

    expect((await refresh()).kind).toBe('unchanged');
    expect(server.requests.some(entry => entry.path.startsWith('/api/'))).toBe(false);
    expect(server.requests.find(entry => entry.path === '/docs')?.etag).toBe('"docs-1"');
    expect(readPointer()).toBe(pointer);
    expect(generationCount()).toBe(generations);
  });

  test('a 304 without reusable docs bytes is followed by exactly one unconditional request', async () => {
    serveUpstream();
    let calls = 0;
    server.routes.set('/docs', (request, response) => {
      calls += 1;
      if (calls === 1) {
        response.writeHead(304);
        response.end();
        return;
      }
      respond(docsDatabase())(request, response);
    });

    expect((await refresh()).kind).toBe('published');
    expect(server.requests.filter(entry => entry.path === '/docs').map(entry => entry.etag)).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe('failures keep the previous snapshot', () => {
  const newerVersion = (): void => void server.routes.set('/version', respond(versionResponse('0.801.0.1')));
  const serveApi = (body: string): void => {
    newerVersion();
    server.routes.set(`/api/${UPLOAD}`, respond(body));
  };
  const breakApi = (search: string, replacement: string): string => {
    const valid = apiDump();
    const broken = valid.replace(search, replacement);
    if (broken === valid) throw new Error(`Fixture text ${search} not found`);
    return broken;
  };

  const cases: ReadonlyArray<readonly [string, () => void]> = [
    ['a version request timeout', () => void server.routes.set('/version', () => undefined)],
    ['a malformed version', () => void server.routes.set('/version', respond(versionResponse('latest')))],
    ['an oversized version body', () => void server.routes.set('/version', respond(' '.repeat(17 * 1024)))],
    [
      'a truncated gzip body',
      () => {
        newerVersion();
        server.routes.set(`/api/${UPLOAD}`, (_request, response) => {
          response.writeHead(200, { 'content-encoding': 'gzip' });
          response.end(gzipSync(apiDump()).subarray(0, 40));
        });
      },
    ],
    ['an invalid tag', () => serveApi(breakApi('"Tags":["NotCreatable",', '"Tags":[7,'))],
    [
      'a member without its value type',
      () => serveApi(breakApi(',"ValueType":{"Name":"string","Category":"Primitive"}', '')),
    ],
    [
      'an inheritance cycle',
      () =>
        serveApi(
          breakApi('"Name":"DataModel","Superclass":"Instance"', '"Name":"DataModel","Superclass":"Workspace"').replace(
            '"Name":"Workspace","Superclass":"Instance"',
            '"Name":"Workspace","Superclass":"DataModel"',
          ),
        ),
    ],
    ['an empty docs database', () => void server.routes.set('/docs', respond('{}', { 'etag': '"docs-2"' }))],
  ];

  test.each(cases)('%s leaves the pointer and data untouched', async (_name, breakUpstream) => {
    const pointer = await publishInitialSnapshot();
    const snapshot = expectDefined(readCurrentSnapshot(directories.cache));
    const api = readFileSync(join(snapshot.directory, FILES.api));
    breakUpstream();

    const result = await refresh(fixtureEnvironment(server.origin, () => now, 300));

    expect(result.kind).toBe('failed');
    expect(readPointer()).toBe(pointer);
    expect(readFileSync(join(snapshot.directory, FILES.api)).equals(api)).toBe(true);
    expect(existsSync(join(directories.cache, FILES.lock))).toBe(false);
  });

  test('a failed pointer rename keeps the previous pointer and removes the staged generation', async () => {
    const pointer = await publishInitialSnapshot();
    newerVersion();
    const generations = generationCount();
    const rename = (from: string, to: string): void => {
      if (to.endsWith(FILES.pointer)) throw new Error('EPERM: sharing violation');
      renameSync(from, to);
    };

    expect((await refresh(fixtureEnvironment(server.origin, () => now, 2_000, rename))).kind).toBe('failed');
    expect(readPointer()).toBe(pointer);
    expect(generationCount()).toBe(generations);
  });

  test('cancellation aborts the download and releases the lock', async () => {
    serveUpstream();
    const arrived = Promise.withResolvers<void>();
    server.routes.set('/version', () => arrived.resolve());
    const controller = new AbortController();

    const pending = refresh(
      fixtureEnvironment(server.origin, () => now, 60_000),
      controller.signal,
    );
    await arrived.promise;
    controller.abort();
    const result = await pending;

    expect(result).toMatchObject({ 'kind': 'failed', 'reason': 'version download failed: cancelled' });
    expect(existsSync(join(directories.cache, FILES.lock))).toBe(false);
    expect(readPointer()).toBeUndefined();
  });
});

describe('locking', () => {
  test('a concurrent attempt does not publish while another holds the lock', async () => {
    serveUpstream();
    const holder = acquireLock(directories.cache, now);
    expect(holder.kind).toBe('acquired');

    expect(await refresh()).toMatchObject({ 'kind': 'skipped', 'reason': 'another update is running' });
    expect(readPointer()).toBeUndefined();
    if (holder.kind === 'acquired') holder.release();
  });

  test('two interleaved reclaimers of a stale lock: only one reacquires it', () => {
    writeFileSync(
      join(directories.cache, FILES.lock),
      JSON.stringify({ 'id': 'crashed', 'startedAt': now - 10 * 60_000 }),
    );
    const inner: RefreshResult[] = [];
    const outer = acquireLock(directories.cache, now, {
      'afterRecoveryAcquired': () => {
        const second = acquireLock(directories.cache, now);
        inner.push(second.kind === 'acquired' ? { 'kind': 'published', 'generation': 'second' } : second);
      },
    });

    expect(outer.kind).toBe('acquired');
    expect(inner).toEqual([{ 'kind': 'skipped', 'reason': expect.stringContaining('recovery') }]);
    expect(existsSync(join(directories.cache, FILES.recovery))).toBe(false);
  });

  test('an occupied recovery lock is never reclaimed automatically', async () => {
    serveUpstream();
    writeFileSync(join(directories.cache, FILES.recovery), 'left by a crash');

    const result = await refresh();

    expect(result.kind).toBe('skipped');
    expect(existsSync(join(directories.cache, FILES.recovery))).toBe(true);
    expect(server.requests).toEqual([]);
  });

  test('invalid and future attempt times count as due; a recent attempt is not', () => {
    const check = join(directories.cache, FILES.check);
    writeFileSync(check, '{ not json');
    expect(isRefreshDue(directories.cache, now)).toBe(true);
    writeFileSync(check, JSON.stringify({ 'schema': 1, 'attemptedAt': now + DAY_MS }));
    expect(isRefreshDue(directories.cache, now)).toBe(true);
    writeFileSync(check, JSON.stringify({ 'schema': 1, 'attemptedAt': now - 60_000 }));
    expect(isRefreshDue(directories.cache, now)).toBe(false);
  });
});

describe('startup selection', () => {
  const bundle = (manifest: Record<string, number | string> | undefined): void => {
    writeFileSync(join(directories.bundle, FILES.api), apiDump('BundledPart'));
    writeFileSync(join(directories.bundle, FILES.docs), docsDatabase('Bundled docs.'));
    if (manifest !== undefined)
      writeFileSync(join(directories.bundle, FILES.manifest), JSON.stringify({ 'schema': 1, ...manifest }));
  };
  const load = (): ReturnType<typeof loadDefinitions> =>
    loadDefinitions({ 'cacheDirectory': directories.cache, 'bundledDirectory': directories.bundle });
  const hasClass = (name: string): boolean => load().roblox?.Classes.some(item => item.Name === name) === true;
  const docsText = (): string | undefined => load().robloxDocs?.get('@roblox/globaltype/Instance.Name')?.documentation;

  test('a corrupt pointer or cache file falls back to bundled data', async () => {
    bundle(undefined);
    serveUpstream();
    await refresh();
    const snapshot = expectDefined(readCurrentSnapshot(directories.cache));
    writeFileSync(join(snapshot.directory, FILES.api), '{"Version":1,"Classes":[]');
    expect(hasClass('BundledPart')).toBe(true);
    writeFileSync(join(directories.cache, FILES.pointer), 'garbage');
    expect(hasClass('BundledPart')).toBe(true);
    expect(docsText()).toBe('Bundled docs.');
  });

  test('a newer bundled API wins over an older cached API', async () => {
    serveUpstream('0.800.0.1');
    await refresh();
    bundle({ 'apiVersion': '0.900.0.1', 'docsFetchedAt': now + 1 });
    expect(hasClass('BundledPart')).toBe(true);
  });

  test('docs follow their own timestamps; ties keep the bundle; a legacy bundle prefers the cache', async () => {
    serveUpstream('0.800.0.1');
    await refresh();
    const cachedAt = expectDefined(readCurrentSnapshot(directories.cache)).manifest.docsFetchedAt;

    bundle({ 'apiVersion': '0.900.0.1', 'docsFetchedAt': cachedAt - 1 });
    expect(docsText()).toBe('The name of the instance.');
    expect(hasClass('BundledPart')).toBe(true);
    bundle({ 'apiVersion': '0.900.0.1', 'docsFetchedAt': cachedAt });
    expect(docsText()).toBe('Bundled docs.');
    bundle(undefined);
    writeFileSync(join(directories.bundle, FILES.manifest), 'legacy');
    expect(docsText()).toBe('The name of the instance.');
    expect(hasClass('NewPart')).toBe(true);
    expect(load().luauDocs?.get('@roblox/globaltype/Instance.Name')?.documentation).toBe('Luau print.');
  });

  test('cached docs with broken framing fall back to bundled docs', async () => {
    bundle(undefined);
    serveUpstream();
    await refresh();
    const snapshot = expectDefined(readCurrentSnapshot(directories.cache));
    expect(docsText()).toBe('The name of the instance.');
    writeFileSync(join(snapshot.directory, FILES.docs), '{"truncated":');
    expect(docsText()).toBe('Bundled docs.');
  });

  test('a cached generation in the legacy docs layout is replaced instead of reused', async () => {
    const pointer = await publishInitialSnapshot();
    const snapshot = expectDefined(readCurrentSnapshot(directories.cache));
    const manifestPath = join(snapshot.directory, FILES.manifest);
    writeFileSync(manifestPath, readFileSync(manifestPath, 'utf-8').replace(/,\s*"docsLayout": "sorted-lines"/, ''));

    expect((await refresh()).kind).toBe('published');
    expect(readPointer()).not.toBe(pointer);
    expect(server.requests.find(entry => entry.path === '/docs')?.etag).toBeUndefined();
    expect(readCurrentSnapshot(directories.cache)?.manifest.docsLayout).toBe('sorted-lines');
  });
});

describe('sorted-lines docs store', () => {
  const database = {
    '@roblox/global/zeta': { 'documentation': 'Last entry.' },
    '@roblox/global/alpha': { 'documentation': 'First entry.', 'params': [{ 'name': 'x', 'documentation': 'p' }] },
    '@roblox/global/"quoted"\\key': { 'documentation': 'Escaped key.' },
    '@roblox/global/überschrift': { 'documentation': 'Line one.\nLine two with "quotes" and a comma, here.' },
    '@roblox/global/middle': { 'overloads': { '() -> T': '@roblox/global/middle/overload/0' } },
  };
  const write = (bytes: Buffer | string): string => {
    const path = join(directories.bundle, 'store.json');
    writeFileSync(path, bytes);
    return path;
  };

  test('serialises valid JSON and finds every entry, including the first, last and escaped keys', () => {
    const bytes = serializeDocs(database);
    expect(JSON.parse(bytes.toString('utf-8'))).toEqual(database);

    const store = expectDefined(openDocsStore(write(bytes)));
    for (const [key, entry] of Object.entries(database)) expect(store.get(key)).toEqual(entry);
    expect(store.get('@roblox/global/absent')).toBeUndefined();
    expect(store.get('')).toBeUndefined();
    expect(store.get('~after-everything')).toBeUndefined();
  });

  test('finds each of many entries and nothing between them', () => {
    const many = Object.fromEntries(
      Array.from({ 'length': 500 }, (_unused, index) => [
        `@roblox/globaltype/Class${index}.Member`,
        { 'documentation': `Entry ${index}` },
      ]),
    );
    const store = expectDefined(openDocsStore(write(serializeDocs(many))));
    for (const [key, entry] of Object.entries(many)) expect(store.get(key)).toEqual(entry);
    expect(store.get('@roblox/globaltype/Class250.Membe')).toBeUndefined();
    expect(store.get('@roblox/globaltype/Class250.Member2')).toBeUndefined();
  });

  test('a corrupt entry is absent without hiding its neighbours', () => {
    const text = serializeDocs(database).toString('utf-8').replace('"Last entry."', '5');
    const store = expectDefined(openDocsStore(write(text)));
    expect(store.get('@roblox/global/zeta')).toBeUndefined();
    expect(store.get('@roblox/global/alpha')?.documentation).toBe('First entry.');
  });

  test('a file without the layout framing or a missing file is not opened', () => {
    expect(openDocsStore(write(JSON.stringify(database)))).toBeUndefined();
    expect(openDocsStore(write(''))).toBeUndefined();
    expect(openDocsStore(join(directories.bundle, 'missing.json'))).toBeUndefined();
  });
});

describe('class-lines API store', () => {
  const encoded = (): Buffer => encodeApiDump(expectDefined(decodeApiDump(apiDump())));

  test('opens to the same dump as a whole decode, including normalised returns', () => {
    const bytes = encoded();
    const whole = expectDefined(decodeApiDump(bytes.toString('utf-8')));
    const lazy = expectDefined(openApiDump(bytes));

    expect(lazy.Classes.map(item => item.Name)).toEqual(whole.Classes.map(item => item.Name));
    expect(lazy.Classes.map(item => item.Members)).toEqual(whole.Classes.map(item => item.Members));
    expect(lazy.Classes.map(item => item.Tags ?? [])).toEqual(whole.Classes.map(item => item.Tags ?? []));
    expect(lazy.Enums).toEqual(whole.Enums);
  });

  test('a damaged class line leaves that class without members and the others intact', () => {
    const text = encoded().toString('utf-8').replace('"Name":"Name","MemberType"', '"Name":5,"MemberType"');
    const lazy = expectDefined(openApiDump(Buffer.from(text)));

    expect(lazy.Classes.find(item => item.Name === 'Instance')?.Members).toEqual([]);
    expect(lazy.Classes.map(item => item.Name)).toContain('NewPart');
  });

  test('an upstream dump, a truncated file or an incoherent header is not opened', () => {
    const text = encoded().toString('utf-8');
    expect(openApiDump(Buffer.from(apiDump()))).toBeUndefined();
    expect(openApiDump(Buffer.from(text.slice(0, -20)))).toBeUndefined();
    expect(
      openApiDump(Buffer.from(text.replace('"Name":"Workspace","Superclass"', '"Name":"Other","Superclass"'))),
    ).toBeUndefined();
    expect(openApiDump(Buffer.from(text.replace(/\n\{"Name":"DataModel".*\n/, '\n')))).toBeUndefined();
  });

  test('prefetched documentation answers the same lookups', async () => {
    serveUpstream();
    await refresh();
    const loaded = loadDefinitions({
      'cacheDirectory': directories.cache,
      'bundledDirectory': directories.bundle,
      'prefetchDocs': true,
    });
    expect(loaded.robloxDocs?.get('@roblox/globaltype/Instance.Name')?.documentation).toBe('The name of the instance.');
  });
});

describe('background scheduling', () => {
  const childScript = join(import.meta.dir, 'fixtures', 'updates', 'child.ts');

  const launchFixtureChild = (): ReturnType<typeof spawn> =>
    spawn(process.execPath, [childScript, directories.cache, directories.bundle, server.origin], {
      'stdio': ['ignore', 'ignore', 'pipe', 'ipc'],
    });

  test('no child or network activity while updates are disabled', async () => {
    const launches: string[][] = [];
    const scheduler = createUpdateScheduler({
      'cacheDirectory': directories.cache,
      'bundledDirectory': directories.bundle,
      'entryScript': 'server.js',
      'log': () => undefined,
      'launch': args => {
        launches.push([...args]);
        return launchFixtureChild();
      },
      'initialDelayMs': 1,
    });
    scheduler.setEnabled(false);
    /** A real delay is the only way to observe that a disabled scheduler never fires. */
    await Bun.sleep(50);
    await scheduler.stop();
    expect(launches).toEqual([]);
    expect(server.requests).toEqual([]);
  });

  test('cooperative IPC cancellation stops the child and releases its lock', async () => {
    serveUpstream();
    const arrived = Promise.withResolvers<void>();
    server.routes.set('/version', () => arrived.resolve());
    const exited = Promise.withResolvers<number | null>();
    const scheduler = createUpdateScheduler({
      'cacheDirectory': directories.cache,
      'bundledDirectory': directories.bundle,
      'entryScript': 'server.js',
      'log': () => undefined,
      'launch': args => {
        expect(args).toEqual([
          'server.js',
          '--refresh-definitions',
          `--definitions-cache=${directories.cache}`,
          `--bundled-data=${directories.bundle}`,
        ]);
        const child = launchFixtureChild();
        child.on('exit', code => exited.resolve(code));
        return child;
      },
      'initialDelayMs': 1,
    });

    scheduler.setEnabled(true);
    await arrived.promise;
    expect(existsSync(join(directories.cache, FILES.lock))).toBe(true);
    await scheduler.stop();

    expect(await exited.promise).toBe(1);
    expect(existsSync(join(directories.cache, FILES.lock))).toBe(false);
    expect(readPointer()).toBeUndefined();
  });

  test('a child that fails to spawn is finalized, retried and does not block shutdown', async () => {
    const launches: string[][] = [];
    const logs: string[] = [];
    let onLog = (): void => undefined;
    const exits = (count: number): Promise<void> => {
      const { promise, resolve } = Promise.withResolvers<void>();
      onLog = () => {
        if (logs.filter(line => line.startsWith('Definitions updater exited')).length >= count) resolve();
      };
      onLog();
      return promise;
    };
    const scheduler = createUpdateScheduler({
      'cacheDirectory': directories.cache,
      'bundledDirectory': directories.bundle,
      'entryScript': 'server.js',
      'log': message => {
        logs.push(message);
        onLog();
      },
      'launch': args => {
        launches.push([...args]);
        return spawn(join(directories.cache, 'missing-runtime'), [], { 'stdio': ['ignore', 'ignore', 'pipe', 'ipc'] });
      },
      'initialDelayMs': 1,
    });

    scheduler.setEnabled(true);
    await exits(1);
    expect(logs.some(line => line.startsWith('Definitions updater failed to start'))).toBe(true);

    scheduler.setEnabled(false);
    scheduler.setEnabled(true);
    await exits(2);
    expect(launches).toHaveLength(2);

    await scheduler.stop();
    expect(server.requests).toEqual([]);
  });

  test('a forcibly killed child leaves the previous snapshot and a recoverable lock', async () => {
    const pointer = await publishInitialSnapshot();
    const arrived = Promise.withResolvers<void>();
    server.routes.set('/version', () => arrived.resolve());
    const child = launchFixtureChild();
    const exited = Promise.withResolvers<void>();
    child.on('exit', () => exited.resolve());

    await arrived.promise;
    child.kill('SIGKILL');
    await exited.promise;

    expect(existsSync(join(directories.cache, FILES.lock))).toBe(true);
    expect(readPointer()).toBe(pointer);
    expect(acquireLock(directories.cache, Date.now()).kind).toBe('skipped');
    expect(acquireLock(directories.cache, Date.now() + 6 * 60_000).kind).toBe('acquired');
  });
});
