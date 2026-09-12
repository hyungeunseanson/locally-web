const PRODUCTION_HOSTS = new Set([
  'locally-travel.com',
  'www.locally-travel.com',
]);
const KNOWN_PRODUCTION_SUPABASE_PROJECT_REFS = new Set(['uhinvcydgzqlpnvieyal']);
const WRITE_GATES = new Set(['auth', 'realtime', 'storage', 'portone', 'nicepay', 'paypal']);

function projectRef(value: string | undefined) {
  if (!value) return null;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const suffix = '.supabase.co';
    if (!hostname.endsWith(suffix)) return null;
    const ref = hostname.slice(0, -suffix.length);
    return /^[a-z0-9]{20}$/.test(ref) ? ref : null;
  } catch {
    return null;
  }
}

export default async function globalSetup() {
  const rawBaseUrl = process.env.CLOUDFLARE_CANARY_BASE_URL;
  const allowedHost = process.env.CLOUDFLARE_CANARY_ALLOWED_HOST;
  const secret = process.env.CLOUDFLARE_FUNCTIONAL_CANARY_SECRET;
  const accessClientId = process.env.CLOUDFLARE_ACCESS_CLIENT_ID;
  const accessClientSecret = process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
  if (!rawBaseUrl || !allowedHost || !secret || !accessClientId || !accessClientSecret) {
    throw new Error(
      'The canary URL/host, app secret, and Cloudflare Access service-token credentials are required.'
    );
  }

  const baseUrl = new URL(rawBaseUrl);
  if (baseUrl.protocol !== 'https:' || baseUrl.hostname !== allowedHost) {
    throw new Error('Remote functional canary host must exactly match the explicit HTTPS allowlist.');
  }
  if (baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) {
    throw new Error('CLOUDFLARE_CANARY_BASE_URL must be an origin without a path, query, or hash.');
  }
  if (PRODUCTION_HOSTS.has(baseUrl.hostname) || baseUrl.hostname.endsWith('.vercel.app')) {
    throw new Error('Refusing to run the functional canary against Production or Vercel.');
  }

  const multiColoUrls = process.env.CLOUDFLARE_CANARY_MULTI_COLO_URLS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) || [];
  const multiColoAllowedHosts = new Set(
    (process.env.CLOUDFLARE_CANARY_MULTI_COLO_ALLOWED_HOSTS || allowedHost)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
  for (const rawUrl of multiColoUrls) {
    const url = new URL(rawUrl);
    if (
      url.protocol !== 'https:' ||
      !multiColoAllowedHosts.has(url.hostname) ||
      PRODUCTION_HOSTS.has(url.hostname) ||
      url.hostname.endsWith('.vercel.app')
    ) {
      throw new Error('A multi-colo URL is not an explicitly allowlisted canary HTTPS host.');
    }
  }

  const activeSupabaseProjectRef = projectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const declaredStagingProjectRef =
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_STAGING_SUPABASE_PROJECT_REF?.trim() || null;
  const activeWriteGate =
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_ACTIVE_WRITE_GATE?.trim() || null;
  const hasStagingConfiguration = Boolean(
    activeSupabaseProjectRef || declaredStagingProjectRef || activeWriteGate
  );

  if (hasStagingConfiguration) {
    if (
      !activeSupabaseProjectRef ||
      !declaredStagingProjectRef ||
      !/^[a-z0-9]{20}$/.test(declaredStagingProjectRef) ||
      activeSupabaseProjectRef !== declaredStagingProjectRef ||
      KNOWN_PRODUCTION_SUPABASE_PROJECT_REFS.has(activeSupabaseProjectRef) ||
      process.env.CLOUDFLARE_FUNCTIONAL_CANARY_SUPABASE_TIER !== 'staging' ||
      process.env.CLOUDFLARE_FUNCTIONAL_CANARY_STAGING_PROJECT_VERIFIED !== 'true'
    ) {
      throw new Error(
        'Remote writes require a non-Production, explicitly verified staging Supabase ref that exactly matches NEXT_PUBLIC_SUPABASE_URL.'
      );
    }
  }

  if (activeWriteGate) {
    if (!WRITE_GATES.has(activeWriteGate)) {
      throw new Error('CLOUDFLARE_FUNCTIONAL_CANARY_ACTIVE_WRITE_GATE is invalid.');
    }
    if (process.env.CLOUDFLARE_FUNCTIONAL_CANARY_ALLOW_STAGING_WRITES !== 'true') {
      throw new Error('The selected remote write gate requires explicit staging-write enablement.');
    }
    if (process.env.CLOUDFLARE_FUNCTIONAL_CANARY_PAYMENT_MODE !== 'sandbox') {
      throw new Error('Every remote write gate requires explicit sandbox payment mode.');
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('The selected remote write gate requires the staging Supabase anon key.');
    }
    if (activeWriteGate !== 'auth' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('This remote write gate requires a runner-scoped staging service-role key.');
    }
  }
  if (process.env.PAYPAL_ENV && process.env.PAYPAL_ENV !== 'sandbox') {
    throw new Error('Remote functional canary requires PAYPAL_ENV=sandbox.');
  }
  if (
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_PAYMENT_MODE &&
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_PAYMENT_MODE !== 'sandbox'
  ) {
    throw new Error('Remote functional canary payments must be explicitly sandboxed.');
  }
}
