const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const KNOWN_PRODUCTION_PROJECT_REFS = new Set(['uhinvcydgzqlpnvieyal']);

export function projectRefFromUrl(value) {
  const url = new URL(value);
  const suffix = '.supabase.co';
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !hostname.endsWith(suffix)) return null;
  const projectRef = hostname.slice(0, -suffix.length);
  return PROJECT_REF_PATTERN.test(projectRef) ? projectRef : null;
}

export function assertStagingTarget(env = process.env) {
  const url = env.SUPABASE_STAGING_URL?.trim();
  const serviceRoleKey = env.SUPABASE_STAGING_SERVICE_ROLE_KEY?.trim();
  const declaredRef = env.SUPABASE_STAGING_PROJECT_REF?.trim();

  if (!url || !serviceRoleKey || !declaredRef) {
    throw new Error(
      'SUPABASE_STAGING_URL, SUPABASE_STAGING_SERVICE_ROLE_KEY, and SUPABASE_STAGING_PROJECT_REF are required.'
    );
  }
  if (env.SUPABASE_STAGING_PROJECT_VERIFIED !== 'true') {
    throw new Error('SUPABASE_STAGING_PROJECT_VERIFIED=true is required.');
  }
  if (env.SUPABASE_STAGING_ALLOW_WRITES !== 'true') {
    throw new Error('SUPABASE_STAGING_ALLOW_WRITES=true is required.');
  }

  const urlRef = projectRefFromUrl(url);
  if (!urlRef || urlRef !== declaredRef) {
    throw new Error('The staging URL project ref must exactly match SUPABASE_STAGING_PROJECT_REF.');
  }
  if (KNOWN_PRODUCTION_PROJECT_REFS.has(urlRef)) {
    throw new Error('Refusing to run staging fixtures against a known Production Supabase project.');
  }

  return { url, serviceRoleKey, projectRef: urlRef };
}

export const knownProductionProjectRefs = Object.freeze([...KNOWN_PRODUCTION_PROJECT_REFS]);
