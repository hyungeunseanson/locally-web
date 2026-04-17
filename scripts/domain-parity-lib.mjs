function normalizeOrigin(origin) {
  return new URL(origin).origin.replace(/\/+$/, '');
}

export function extractSitemapUrls(sitemapText) {
  return Array.from(sitemapText.matchAll(/<loc>([^<]+)<\/loc>/gi), (match) => match[1].trim());
}

export function pickRepresentativePublicPaths({ expectedOrigin, sitemapText }) {
  const normalizedOrigin = normalizeOrigin(expectedOrigin);
  const urls = extractSitemapUrls(sitemapText);
  const sameOriginPaths = [];

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (normalizeOrigin(parsed.origin) !== normalizedOrigin) continue;
      sameOriginPaths.push(parsed.pathname);
    } catch {
      // Ignore malformed sitemap entries.
    }
  }

  const uniquePaths = Array.from(new Set(sameOriginPaths));
  const pickedPaths = [];

  for (const path of ['/search', '/services/intro']) {
    if (uniquePaths.includes(path)) {
      pickedPaths.push(path);
    }
  }

  for (const prefix of ['/experiences/', '/community/', '/users/']) {
    const match = uniquePaths.find((path) => path.startsWith(prefix));
    if (match) {
      pickedPaths.push(match);
    }
  }

  return Array.from(new Set(pickedPaths));
}

function readTrimmedEnv(env, key) {
  const rawValue = env[key];
  if (typeof rawValue !== 'string') return null;

  const value = rawValue.trim();
  return value.length > 0 ? value : null;
}

export function resolveAdsTxtExpectation(env = process.env) {
  const clientId = readTrimmedEnv(env, 'NEXT_PUBLIC_ADSENSE_CLIENT_ID');

  return {
    clientId,
    expectedStatus: clientId ? 200 : 404,
  };
}
