/** JavaScript runtime used to execute benchmark workers. */
export type BenchmarkRuntime = 'bun' | 'node';

/** Memory observed in a worker after its measured work. */
export interface MemorySample {
  readonly rssBytes: number;
  readonly heapUsedBytes: number;
}

/** Median and nearest-rank 95th percentile of a sample set, in the samples' unit. */
export interface Summary {
  readonly median: number;
  readonly p95: number;
}

/** Cold document-manager construction measured in one worker process. */
export interface ColdSample {
  readonly kind: 'cold';
  readonly runtime: string;
  readonly importMs: number;
  readonly constructMs: number;
  /** Milliseconds from runtime start until the document manager exists. */
  readonly readyMs: number;
  /** Cost of the first Roblox and Luau documentation lookups, which open both sources. */
  readonly docsMs: number;
  /** Memory once the document manager exists, before documentation is loaded. */
  readonly memory: MemorySample;
}

/** Analysis measurements for one Luau input, in milliseconds. */
export interface FixtureSample {
  readonly name: string;
  readonly bytes: number;
  readonly lines: number;
  readonly parse: Summary;
  readonly analysis: Summary;
  readonly cacheHit: Summary;
  readonly parseErrors: number;
  readonly typeErrors: number;
}

/** Results of every analysis fixture measured in one worker process. */
export interface AnalysisSample {
  readonly kind: 'analysis';
  readonly runtime: string;
  readonly fixtures: ReadonlyArray<FixtureSample>;
  readonly memory: MemorySample;
}

/** Fixture supplied to an analysis worker. */
export interface FixtureInput {
  readonly name: string;
  readonly path: string;
  readonly copies: number;
}
