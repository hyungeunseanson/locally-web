const CANARY_SECRET_HEADER = 'x-locally-canary-secret';

export const CLOUDFLARE_FUNCTIONAL_CANARY_CACHE_TAG =
  'cloudflare-functional-canary-cache-v1';

async function sha256(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  );
}

async function secretsMatch(provided: string, expected: string) {
  const [providedHash, expectedHash] = await Promise.all([
    sha256(provided),
    sha256(expected),
  ]);

  let difference = 0;
  for (let index = 0; index < providedHash.length; index += 1) {
    difference |= providedHash[index] ^ expectedHash[index];
  }

  return difference === 0;
}

export async function isCloudflareFunctionalCanaryRequest(request: Request) {
  if (process.env.CLOUDFLARE_FUNCTIONAL_CANARY_ENABLED !== 'true') {
    return false;
  }

  const expected = process.env.CLOUDFLARE_FUNCTIONAL_CANARY_SECRET;
  const provided = request.headers.get(CANARY_SECRET_HEADER);
  if (!expected || !provided) return false;

  return secretsMatch(provided, expected);
}

export function canaryJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('cache-control', 'no-store, max-age=0');
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('x-robots-tag', 'noindex, nofollow');

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function hiddenCanaryResponse() {
  return canaryJson({ error: 'Not found' }, { status: 404 });
}
