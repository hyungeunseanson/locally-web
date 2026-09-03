import { assertNonProductionSupabaseTarget } from './helpers/productionSupabaseGuard';

export default async function productionGuard() {
  assertNonProductionSupabaseTarget();
}
