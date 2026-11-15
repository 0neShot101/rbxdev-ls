import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import type {
  AnalysisSample,
  BenchmarkRuntime,
  ColdSample,
  FixtureInput,
  FixtureSample,
  MemorySample,
  Summary,
} from '@benchmark/types/benchmark';

const COLD_RUNS = 5;
const WARMUPS = 5;
const MEASURED = 30;
const SYNTHETIC_COPIES = 5;

const readArgument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
};

const describeRuntime = (): string =>
  process.versions['bun'] === undefined ? `node ${process.version}` : `bun ${process.versions['bun']}`;

const sampleMemory = (): MemorySample => {
  const usage = process.memoryUsage();
  return { 'rssBytes': usage.rss, 'heapUsedBytes': usage.heapUsed };
};

const summarize = (values: ReadonlyArray<number>): Summary => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : (sorted[middle] ?? 0);
  const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
  return { median, p95 };
};

const time = (action: () => void): number => {
  const start = performance.now();
  action();
  return performance.now() - start;
};

const measure = (action: (iteration: number) => void): Summary => {
  for (let i = 0; i < WARMUPS; i++) action(i);
  const durations: number[] = [];
  for (let i = 0; i < MEASURED; i++) durations.push(time(() => action(WARMUPS + i)));
  return summarize(durations);
};

const parseFixture = (value: string, root: string): FixtureInput => {
  const separator = value.indexOf(':');
  const copies = Number(value.slice(0, separator));
  const path = value.slice(separator + 1);
  const name = relative(root, path).replaceAll('\\', '/');
  return { 'name': copies > 1 ? `${name} x${copies}` : name, path, copies };
};

/** Server modules load dynamically so cold timings include their evaluation and definition loading. */
const runCold = async (): Promise<void> => {
  const importStart = performance.now();
  const { createDocumentManager } = await import('@lsp/documents');
  const importMs = performance.now() - importStart;
  const constructStart = performance.now();
  const manager = createDocumentManager();
  const readyMs = performance.now();
  const constructMs = readyMs - constructStart;
  const memory = sampleMemory();
  const docsMs = time(() => {
    const { robloxDocs, luauDocs } = manager.globalEnv;
    if (
      robloxDocs?.get('@roblox/globaltype/Instance.Name') === undefined ||
      luauDocs?.get('@luau/global/print') === undefined
    )
      throw new Error('Bundled documentation failed to load');
  });
  const sample: ColdSample = {
    'kind': 'cold',
    'runtime': describeRuntime(),
    importMs,
    constructMs,
    readyMs,
    docsMs,
    memory,
  };
  process.stdout.write(`${JSON.stringify(sample)}\n`);
};

/** Shares the dynamic imports with the cold worker so a bundle never evaluates server modules before timing. */
const runAnalysis = async (root: string): Promise<void> => {
  const { createDocumentManager } = await import('@lsp/documents');
  const { parse } = await import('@parser/parser');
  const { TextDocument } = await import('vscode-languageserver-textdocument');
  const manager = createDocumentManager();
  const fixtures = process.argv
    .flatMap((value, index) => (process.argv[index - 1] === '--fixture' ? [value] : []))
    .map((value): FixtureSample => {
      const input = parseFixture(value, root);
      const source = readFileSync(input.path, 'utf-8');
      const content = Array.from({ 'length': input.copies }, () => source).join('\n');
      const uri = `file:///benchmark/${encodeURIComponent(input.name)}.luau`;
      const revise = (iteration: number): string => `${content}\n-- benchmark revision ${iteration}\n`;
      const parseSummary = measure(iteration => void parse(revise(iteration)));
      let version = 0;
      const analysis = measure(iteration => {
        version += 1;
        manager.parseDocument(TextDocument.create(uri, 'luau', version, revise(iteration)));
      });
      const stable = TextDocument.create(`${uri}.stable`, 'luau', 1, content);
      const parsed = manager.parseDocument(stable);
      const cacheHit = measure(() => void manager.parseDocument(stable));
      manager.removeDocument(uri);
      manager.removeDocument(stable.uri);
      return {
        'name': input.name,
        'bytes': Buffer.byteLength(content),
        'lines': content.split('\n').length,
        'parse': parseSummary,
        analysis,
        cacheHit,
        'parseErrors': parsed.parseErrors.length,
        'typeErrors': parsed.typeErrors.length,
      };
    });
  const sample: AnalysisSample = {
    'kind': 'analysis',
    'runtime': describeRuntime(),
    fixtures,
    'memory': sampleMemory(),
  };
  process.stdout.write(`${JSON.stringify(sample)}\n`);
};

const isMemory = (value: unknown): value is MemorySample =>
  typeof value === 'object' &&
  value !== null &&
  'rssBytes' in value &&
  typeof value.rssBytes === 'number' &&
  'heapUsedBytes' in value &&
  typeof value.heapUsedBytes === 'number';

const isSummary = (value: unknown): value is Summary =>
  typeof value === 'object' &&
  value !== null &&
  'median' in value &&
  typeof value.median === 'number' &&
  'p95' in value &&
  typeof value.p95 === 'number';

const isFixture = (value: unknown): value is FixtureSample =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  typeof value.name === 'string' &&
  'bytes' in value &&
  typeof value.bytes === 'number' &&
  'lines' in value &&
  typeof value.lines === 'number' &&
  'parse' in value &&
  isSummary(value.parse) &&
  'analysis' in value &&
  isSummary(value.analysis) &&
  'cacheHit' in value &&
  isSummary(value.cacheHit) &&
  'parseErrors' in value &&
  typeof value.parseErrors === 'number' &&
  'typeErrors' in value &&
  typeof value.typeErrors === 'number';

const isCold = (value: unknown): value is ColdSample =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  value.kind === 'cold' &&
  'runtime' in value &&
  typeof value.runtime === 'string' &&
  'importMs' in value &&
  typeof value.importMs === 'number' &&
  'constructMs' in value &&
  typeof value.constructMs === 'number' &&
  'readyMs' in value &&
  typeof value.readyMs === 'number' &&
  'docsMs' in value &&
  typeof value.docsMs === 'number' &&
  'memory' in value &&
  isMemory(value.memory);

const isAnalysis = (value: unknown): value is AnalysisSample =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  value.kind === 'analysis' &&
  'runtime' in value &&
  typeof value.runtime === 'string' &&
  'fixtures' in value &&
  Array.isArray(value.fixtures) &&
  value.fixtures.every(isFixture) &&
  'memory' in value &&
  isMemory(value.memory);

const decodeOutput = <T>(output: string, isSample: (value: unknown) => value is T): T => {
  const line = output.trim().split('\n').at(-1) ?? '';
  const value: unknown = JSON.parse(line);
  if (isSample(value) === false) throw new Error(`Unexpected benchmark worker output: ${line}`);
  return value;
};

const listLuau = (directory: string): string[] =>
  readdirSync(directory)
    .map(entry => join(directory, entry))
    .flatMap(path => {
      if (statSync(path).isDirectory()) return listLuau(path);
      return path.endsWith('.luau') ? [path] : [];
    })
    .sort();

const formatMs = (value: number): string => value.toFixed(2).padStart(9);

const formatMiB = (bytes: number): string => (bytes / 1024 / 1024).toFixed(1);

const formatSummary = (label: string, summary: Summary): string =>
  `  ${label.padEnd(9)} median ${formatMs(summary.median)} ms  p95 ${formatMs(summary.p95)} ms`;

const printCold = (samples: ReadonlyArray<ColdSample>): void => {
  const memory = summarize(samples.map(sample => sample.memory.rssBytes));
  const heap = summarize(samples.map(sample => sample.memory.heapUsedBytes));
  console.log(`Cold document manager, ${samples.length} separate processes`);
  console.log(formatSummary('import', summarize(samples.map(sample => sample.importMs))));
  console.log(formatSummary('construct', summarize(samples.map(sample => sample.constructMs))));
  console.log(formatSummary('ready', summarize(samples.map(sample => sample.readyMs))));
  console.log(formatSummary('docs', summarize(samples.map(sample => sample.docsMs))));
  console.log(`  RSS median ${formatMiB(memory.median)} MiB, heap used median ${formatMiB(heap.median)} MiB`);
  console.log('  ("docs" is the first Roblox and Luau documentation lookup, paid once by the first hover)');
};

const printAnalysis = (sample: AnalysisSample): void => {
  console.log(`\nAnalysis, ${WARMUPS} warmups and ${MEASURED} measured revisions per fixture (median / p95 ms)`);
  console.log(
    [
      'fixture'.padEnd(52),
      'bytes'.padStart(8),
      'lines'.padStart(6),
      'parse'.padStart(19),
      'analysis'.padStart(19),
      'cache hit'.padStart(19),
      'P/T errors'.padStart(10),
    ].join(' '),
  );
  for (const fixture of sample.fixtures)
    console.log(
      [
        fixture.name.padEnd(52),
        String(fixture.bytes).padStart(8),
        String(fixture.lines).padStart(6),
        `${formatMs(fixture.parse.median)}/${formatMs(fixture.parse.p95)}`,
        `${formatMs(fixture.analysis.median)}/${formatMs(fixture.analysis.p95)}`,
        `${formatMs(fixture.cacheHit.median)}/${formatMs(fixture.cacheHit.p95)}`,
        `${fixture.parseErrors}/${fixture.typeErrors}`.padStart(10),
      ].join(' '),
    );
  console.log(
    `Analysis worker RSS ${formatMiB(sample.memory.rssBytes)} MiB, heap used ${formatMiB(sample.memory.heapUsedBytes)} MiB`,
  );
};

const bundleForNode = async (directory: string): Promise<string> => {
  const result = await Bun.build({
    'entrypoints': [import.meta.path],
    'outdir': directory,
    'target': 'node',
    'format': 'esm',
  });
  const output = result.outputs.find(artifact => artifact.kind === 'entry-point');
  if (result.success === false || output === undefined)
    throw new Error(`Benchmark bundle failed:\n${result.logs.map(log => log.message).join('\n')}`);
  return output.path;
};

const orchestrate = async (): Promise<void> => {
  const runtimeArgument = readArgument('--runtime') ?? 'node';
  if (runtimeArgument !== 'node' && runtimeArgument !== 'bun')
    throw new Error(`Unsupported runtime "${runtimeArgument}"; expected bun or node`);
  const runtime: BenchmarkRuntime = runtimeArgument;
  const serverRoot = resolve(import.meta.dir, '..');
  const repositoryRoot = resolve(serverRoot, '..', '..');
  const bridge = join(repositoryRoot, 'scripts', 'executor-bridge.lua');
  const sources = [
    ...listLuau(join(repositoryRoot, 'roblox', 'executor-bridge', 'src')),
    ...listLuau(join(repositoryRoot, 'roblox', 'studio-plugin', 'src')),
  ];
  const fixtures = [`1:${bridge}`, `${SYNTHETIC_COPIES}:${bridge}`, ...sources.map(path => `1:${path}`)];
  const temporary = runtime === 'node' ? mkdtempSync(join(tmpdir(), 'rbxdev-bench-')) : undefined;

  try {
    const command =
      temporary === undefined ? [process.execPath, import.meta.path] : ['node', await bundleForNode(temporary)];
    const runWorker = (args: ReadonlyArray<string>): string => {
      const [executable = '', ...prefix] = command;
      const result = spawnSync(executable, [...prefix, ...args], {
        'cwd': serverRoot,
        'encoding': 'utf-8',
        'maxBuffer': 64 * 1024 * 1024,
      });
      if (result.status !== 0) throw new Error(`Benchmark worker failed:\n${result.stderr}`);
      return result.stdout;
    };
    const cold = Array.from({ 'length': COLD_RUNS }, () => decodeOutput(runWorker(['--worker', 'cold']), isCold));
    const fixtureArgs = fixtures.flatMap(value => ['--fixture', value]);
    const analysis = decodeOutput(
      runWorker(['--worker', 'analysis', '--root', repositoryRoot, ...fixtureArgs]),
      isAnalysis,
    );
    console.log(`Runtime: ${analysis.runtime}`);
    printCold(cold);
    printAnalysis(analysis);
  } finally {
    if (temporary !== undefined) rmSync(temporary, { 'recursive': true, 'force': true });
  }
};

const worker = readArgument('--worker');
if (worker === 'cold') await runCold();
else if (worker === 'analysis') await runAnalysis(readArgument('--root') ?? process.cwd());
else await orchestrate();
