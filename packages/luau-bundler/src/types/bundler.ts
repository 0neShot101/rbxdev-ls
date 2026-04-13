/** Configuration options for the Luau bundler. */
export interface BundlerOptions {
  /** Path to the source directory containing .lua/.luau files. */
  sourceDir: string;
  /** Module name used as the entry point (default: "init"). */
  entry?: string;
  /** Header comment prepended to the output (default: none). */
  header?: string;
  /** Whether to pass varargs through to modules (default: true). */
  passVarargs?: boolean;
}

/** Result returned after bundling completes. */
export interface BundleResult {
  /** The bundled Lua source code. */
  output: string;
  /** Number of modules included in the bundle. */
  moduleCount: number;
  /** Time taken to bundle in milliseconds. */
  elapsedMs: number;
}

/** Shape of a Rojo default.project.json file (only the fields we need). */
export interface RojoProject {
  name: string;
  tree: {
    $path?: string;
    $className?: string;
  };
}
