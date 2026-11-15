import { runRefreshChild } from '@definitions/updates/refresh';
import { fixtureEnvironment } from '@tests/helpers/updates';

const [cache = '', bundle = '', origin = ''] = process.argv.slice(2);
process.exitCode = await runRefreshChild(cache, bundle, fixtureEnvironment(origin, Date.now, 60_000));
