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
