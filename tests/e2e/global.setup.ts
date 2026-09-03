import { readFileSync } from 'fs';

import { createClient } from '@supabase/supabase-js';

import { assertNonProductionSupabaseTarget } from './helpers/productionSupabaseGuard';

type EnvMap = Record<string, string>;

const ADMIN_WHITELIST_CLEANUP_OPT_IN = 'E2E_ALLOW_ADMIN_WHITELIST_CLEANUP';

function loadEnv(): EnvMap {
  return readFileSync('.env.local', 'utf8')
    .split(/\n/)
    .reduce<EnvMap>((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
}

async function cleanupStaleCodexAdminWhitelist() {
  assertNonProductionSupabaseTarget();
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('[playwright globalSetup] NEXT_PUBLIC_SUPABASE_URL is required.');
  }

  if (env[ADMIN_WHITELIST_CLEANUP_OPT_IN] !== 'true') {
    console.log(`[playwright globalSetup] cleanup skipped; set ${ADMIN_WHITELIST_CLEANUP_OPT_IN}=true to opt in.`);
    return;
  }

  const supabase = createClient(
    supabaseUrl,
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const { data, error } = await supabase
    .from('admin_whitelist')
    .select('id,email')
    .ilike('email', 'codex.%@example.com')
    .limit(500);

  if (error) {
    throw error;
  }

  const ids = (data || [])
    .map((row) => row.id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (ids.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase
    .from('admin_whitelist')
    .delete()
    .in('id', ids);

  if (deleteError) {
    throw deleteError;
  }

  console.log(`[playwright globalSetup] removed ${ids.length} stale codex admin whitelist rows`);
}

export default async function globalSetup() {
  assertNonProductionSupabaseTarget();
  await cleanupStaleCodexAdminWhitelist();
}
