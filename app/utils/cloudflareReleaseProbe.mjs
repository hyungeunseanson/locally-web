const VERSION_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const RELEASE_PROBE_PATH = '/.well-known/locally-release';

/** A dedicated read-only response, before Next/ISR. Never annotate user pages. */
export function withReleaseProbeIdentity(request, response, metadata) {
  const url = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method) || url.pathname !== RELEASE_PROBE_PATH || url.search
    || request.headers.get('X-Locally-Release-Probe') !== '1'
    || request.headers.has('cookie') || request.headers.has('authorization')
    || !VERSION_ID.test(metadata?.id ?? '')) return response;
  return new Response(null, { status: 204, headers: {
    'X-Locally-Worker-Version': metadata.id,
    'Cache-Control': 'private, no-store',
    Vary: 'X-Locally-Release-Probe, Cloudflare-Workers-Version-Overrides',
  } });
}
