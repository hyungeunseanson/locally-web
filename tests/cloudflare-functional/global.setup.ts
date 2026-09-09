const PRODUCTION_SUPABASE_PROJECT_REF = 'uhinvcydgzqlpnvieyal';
const PRODUCTION_HOSTS = new Set([
  'locally-travel.com',
  'www.locally-travel.com',
]);

function projectRef(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

export default async function globalSetup() {
  const rawBaseUrl = process.env.CLOUDFLARE_CANARY_BASE_URL;
  const allowedHost = process.env.CLOUDFLARE_CANARY_ALLOWED_HOST;
  const secret = process.env.CLOUDFLARE_FUNCTIONAL_CANARY_SECRET;
  if (!rawBaseUrl || !allowedHost || !secret) {
    throw new Error(
      'CLOUDFLARE_CANARY_BASE_URL, CLOUDFLARE_CANARY_ALLOWED_HOST, and CLOUDFLARE_FUNCTIONAL_CANARY_SECRET are required.'
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

  if (projectRef(process.env.NEXT_PUBLIC_SUPABASE_URL) === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error('Refusing to run the functional canary against Production Supabase.');
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
