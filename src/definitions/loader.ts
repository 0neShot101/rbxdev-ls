import { existsSync, readFileSync } from 'fs';
import { basename, dirname, join, resolve, sep } from 'path';

import type { LoadedDefinitions, RobloxApiDump, SuncApiDefinition } from '@typings/definitions';

const findDataDir = (): string => {
  const possiblePaths = [
    join(process.cwd(), 'data'),
    join(dirname(process.argv[1] ?? ''), 'data'),
    join(dirname(process.argv[1] ?? ''), '..', 'data'),
  ];

  for (const path of possiblePaths) if (existsSync(path)) return path;

  return join(process.cwd(), 'data');
};

const DATA_DIR = findDataDir();

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

/** Loads all API definitions from the data directory. */
export const loadDefinitions = (): LoadedDefinitions => ({
  'roblox': loadJsonFile<RobloxApiDump>('roblox-api.json'),
  'sunc': loadJsonFile<SuncApiDefinition>('sunc-api.json'),
});

/** Checks if any definitions were successfully loaded. */
export const isDefinitionsLoaded = (defs: LoadedDefinitions): boolean =>
  defs.roblox !== undefined || defs.sunc !== undefined;
