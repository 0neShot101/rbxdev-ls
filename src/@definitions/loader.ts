/**
 * API Definition Loader
 *
 * This module handles loading API definitions from JSON files. It provides
 * functions to load Roblox API dumps and Sunc executor API definitions
 * from the data directory.
 */

import { existsSync, readFileSync } from 'fs';
import { basename, dirname, join, resolve, sep } from 'path';

import type { RobloxApiDump } from './roblox';
import type { SuncApiDefinition } from './sunc';

/**
 * Container for loaded API definitions.
 *
 * This interface holds the loaded Roblox and Sunc API definitions,
 * with undefined values indicating the definition could not be loaded.
 */
export interface LoadedDefinitions {
  /** The Roblox API dump, or undefined if not loaded */
  readonly roblox: RobloxApiDump | undefined;
  /** The Sunc executor API definition, or undefined if not loaded */
  readonly sunc: SuncApiDefinition | undefined;
}

/**
 * Finds the data directory containing API definition JSON files.
 *
 * This function searches for the data directory in several possible locations:
 * 1. Current working directory + /data
 * 2. Script directory + /data
 * 3. Script parent directory + /data
 *
 * If no existing data directory is found, falls back to cwd + /data.
 *
 * @returns The path to the data directory
 */
const findDataDir = (): string => {
  const possiblePaths = [
    join(process.cwd(), 'data'),
    join(dirname(process.argv[1] ?? ''), 'data'),
    join(dirname(process.argv[1] ?? ''), '..', 'data'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) return path;
  }

  // Default fallback
  return join(process.cwd(), 'data');
};

/** The resolved data directory path */
const DATA_DIR = findDataDir();

/**
 * Loads and parses a JSON file from the data directory.
 *
 * This function performs security checks to prevent path traversal attacks
 * by ensuring the filename is a simple basename and the resolved path
 * stays within the data directory.
 *
 * @typeParam T - The expected type of the parsed JSON content
 * @param filename - The name of the JSON file to load (must be a simple filename, not a path)
 * @returns The parsed JSON content, or undefined if loading fails
 */
const loadJsonFile = <T>(filename: string): T | undefined => {
  if (filename !== basename(filename)) return undefined;

  const dataDir = resolve(DATA_DIR);
  const filepath = resolve(dataDir, filename);

  if (filepath.startsWith(dataDir + sep) === false) return undefined;
  if (existsSync(filepath) === false) return undefined;

  try {
    const content = readFileSync(filepath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return undefined;
  }
};

/**
 * Loads all API definitions from the data directory.
 *
 * Attempts to load:
 * - roblox-api.json: Roblox API dump
 * - sunc-api.json: Sunc executor API definition
 *
 * @returns A LoadedDefinitions object with loaded definitions or undefined for failed loads
 */
export const loadDefinitions = (): LoadedDefinitions => ({
  'roblox': loadJsonFile<RobloxApiDump>('roblox-api.json'),
  'sunc': loadJsonFile<SuncApiDefinition>('sunc-api.json'),
});

/**
 * Checks if any definitions were successfully loaded.
 *
 * @param defs - The LoadedDefinitions object to check
 * @returns True if at least one definition was loaded, false otherwise
 */
export const isDefinitionsLoaded = (defs: LoadedDefinitions): boolean =>
  defs.roblox !== undefined || defs.sunc !== undefined;
