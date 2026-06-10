/**
 * Bundler launcher types used when spawning the luau-bundler CLI.
 */

/** A launcher candidate: the executable plus the args that precede the CLI's own. */
export type BundlerCommand = {
  command: string;
  prefix: string[];
  label: string;
};

/** Spawn failure enriched with the child process error code or exit code. */
export type BundlerRunError = Error & {
  code?: string | number;
};
