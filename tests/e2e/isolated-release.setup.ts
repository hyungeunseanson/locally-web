import { assertIsolatedReleaseTarget } from './helpers/productionSupabaseGuard';
import globalSetup from './global.setup';

export default async function isolatedReleaseSetup() {
  assertIsolatedReleaseTarget();
  await globalSetup();
}
