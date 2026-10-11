import { existsSync, readFileSync } from 'fs';

const PRODUCTION_SUPABASE_PROJECT_REF = 'uhinvcydgzqlpnvieyal';

function loadEnvFileValue(path: string, key: string) {
  if (!existsSync(path)) return null;

  for (const line of readFileSync(path, 'utf8').split(/\n/)) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match?.[1] === key) return match[2].trim();
  }

  return null;
}

function readProjectRef(value: string | null | undefined) {
  if (!value) return null;

  try {
    return new URL(value).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

export function assertNonProductionSupabaseTarget() {
  const targets = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    loadEnvFileValue('.env.local', 'NEXT_PUBLIC_SUPABASE_URL'),
  ];

  if (targets.some((value) => readProjectRef(value) === PRODUCTION_SUPABASE_PROJECT_REF)) {
    throw new Error(
      '[playwright safety] Refusing to run tests against the Production Supabase project.'
    );
  }
}

export function assertIsolatedReleaseTarget() {
  assertNonProductionSupabaseTarget();
  const fileSupabase = loadEnvFileValue('.env.local', 'NEXT_PUBLIC_SUPABASE_URL');
  const fileSite = loadEnvFileValue('.env.local', 'NEXT_PUBLIC_SITE_URL');
  let parsed: URL;
  try {
    parsed = new URL(fileSupabase || '');
  } catch {
    throw new Error('[playwright safety] Isolated Supabase URL is required in .env.local.');
  }
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)
    || !parsed.port || parsed.username || parsed.password) {
    throw new Error('[playwright safety] Isolated release E2E requires loopback Supabase Auth.');
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== fileSupabase
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== loadEnvFileValue('.env.local', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
    || process.env.SUPABASE_SERVICE_ROLE_KEY !== loadEnvFileValue('.env.local', 'SUPABASE_SERVICE_ROLE_KEY')) {
    throw new Error('[playwright safety] Browser server and E2E client must use the same isolated Supabase configuration.');
  }
  const appOrigin = 'http://127.0.0.1:3100';
  if (fileSite !== appOrigin || process.env.NEXT_PUBLIC_SITE_URL !== appOrigin
    || process.env.PLAYWRIGHT_LIVE_BASE_URL !== appOrigin) {
    throw new Error('[playwright safety] Isolated E2E browser and app server must share the local origin.');
  }
}
