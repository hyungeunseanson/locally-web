type PublicWriteGuardOptions = {
  bucket: string;
  limit: number;
  windowMs: number;
  identifier?: string | null;
  scopeKey?: string | null;
};

type PublicWriteGuardResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
  blockedByOrigin?: boolean;
};

type RateLimitStore = Map<string, number[]>;

declare global {
  // eslint-disable-next-line no-var
  var __locallyPublicWriteRateLimitStore: RateLimitStore | undefined;
}

function getRateLimitStore(): RateLimitStore {
  if (!globalThis.__locallyPublicWriteRateLimitStore) {
    globalThis.__locallyPublicWriteRateLimitStore = new Map<string, number[]>();
  }

  return globalThis.__locallyPublicWriteRateLimitStore;
}

function getRequestOriginCandidates(request: Request) {
  const candidates = new Set<string>();

  try {
    candidates.add(new URL(request.url).origin);
  } catch {
    // Ignore malformed runtime URLs and fall back to env-based origin checks below.
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      candidates.add(new URL(siteUrl).origin);
    } catch {
      // Ignore invalid env configuration.
    }
  }

  return candidates;
}

function isCrossSiteBrowserRequest(request: Request) {
  const secFetchSite = String(request.headers.get('sec-fetch-site') || '').toLowerCase();
  if (secFetchSite === 'cross-site') {
    return true;
  }

  const origin = request.headers.get('origin');
  if (!origin) {
    return false;
  }

  return !getRequestOriginCandidates(request).has(origin);
}

function getClientAddress(request: Request) {
  const headerCandidates = [
    request.headers.get('x-forwarded-for'),
    request.headers.get('x-real-ip'),
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-vercel-forwarded-for'),
  ];

  for (const candidate of headerCandidates) {
    if (!candidate) continue;
    const value = candidate.split(',')[0]?.trim();
    if (value) return value;
  }

  return 'unknown';
}

function getClientFingerprint(request: Request, identifier?: string | null) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (normalizedIdentifier) {
    return `id:${normalizedIdentifier.slice(0, 200)}`;
  }

  const ip = getClientAddress(request);
  const userAgent = String(request.headers.get('user-agent') || '').slice(0, 160);
  return `ip:${ip}|ua:${userAgent}`;
}

function pruneHits(hits: number[], now: number, windowMs: number) {
  return hits.filter((timestamp) => now - timestamp < windowMs);
}

export function enforcePublicWriteGuard(
  request: Request,
  { bucket, limit, windowMs, identifier, scopeKey }: PublicWriteGuardOptions
): PublicWriteGuardResult {
  if (isCrossSiteBrowserRequest(request)) {
    return {
      allowed: false,
      blockedByOrigin: true,
    };
  }

  const now = Date.now();
  const store = getRateLimitStore();
  const clientKey = getClientFingerprint(request, identifier);
  const normalizedScopeKey = String(scopeKey || '').trim() || 'global';
  const storeKey = `${bucket}:${normalizedScopeKey}:${clientKey}`;
  const existingHits = pruneHits(store.get(storeKey) || [], now, windowMs);

  if (existingHits.length >= limit) {
    const oldestHit = existingHits[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldestHit + windowMs - now) / 1000)),
    };
  }

  existingHits.push(now);
  store.set(storeKey, existingHits);

  return {
    allowed: true,
  };
}
