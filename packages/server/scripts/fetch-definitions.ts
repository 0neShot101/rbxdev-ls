import { resolve } from 'node:path';

import { refreshDefinitions } from '@definitions/updates/refresh';

const RELEASE_DEADLINE_MS = 120_000;

const destinationIndex = process.argv.indexOf('--destination');
const destination = resolve(
  destinationIndex === -1 ? resolve(import.meta.dir, '..', 'data') : (process.argv[destinationIndex + 1] ?? ''),
);

await refreshDefinitions({
  destination,
  'bundledDirectory': destination,
  'mode': 'release',
  'signal': AbortSignal.timeout(RELEASE_DEADLINE_MS),
  'logger': message => console.log(message),
});
console.log(`Definitions written to ${destination}`);
