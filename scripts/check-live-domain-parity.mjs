import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const LEGACY_PROJECT_ALIAS = 'https://locally-web.vercel.app';
const USER_AGENT = 'locally-cutover-domain-gate/1.0';

function loadEnvFile(path) {
  if (!existsSync(path)) return {};

  return readFileSync(path, 'utf8')
    .split(/\n/)
    .reduce((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (!match) return acc;
      acc[match[1]] = match[2];
      return acc;
    }, {});
}

function readTrimmedEnv(env, key) {
  const rawValue = env[key];
  if (typeof rawValue !== 'string') return null;

  const value = rawValue.trim();
  return value.length > 0 ? value : null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUrl(origin, pathname) {
  return `${origin}${pathname}`;
}

function extractByRegex(source, regex, label) {
  const match = source.match(regex);
  if (!match?.[1]) {
    throw new Error(`Missing ${label}.`);
  }

  return match[1];
}

function extractOptionalByRegex(source, regex) {
  const match = source.match(regex);
  return match?.[1] || null;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
    },
    redirect: 'follow',
    cache: 'no-store',
  });

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url,
    text,
  };
}

async function main() {
  const envFromFile = loadEnvFile(resolve('.env.local'));
  const env = { ...process.env, ...envFromFile };
  const baseUrl =
    readTrimmedEnv(env, 'PLAYWRIGHT_LIVE_BASE_URL') ||
    readTrimmedEnv(env, 'NEXT_PUBLIC_SITE_URL');

  if (!baseUrl) {
    throw new Error('Missing PLAYWRIGHT_LIVE_BASE_URL or NEXT_PUBLIC_SITE_URL.');
  }

  const expectedOrigin = new URL(baseUrl).origin.replace(/\/+$/, '');
  const legacyOrigin = new URL(LEGACY_PROJECT_ALIAS).origin;
  const forbidLegacyAlias = expectedOrigin !== legacyOrigin;
  const failures = [];

  const robots = await fetchText(buildUrl(expectedOrigin, '/robots.txt'));
  if (!robots.ok) {
    failures.push(`robots.txt returned HTTP ${robots.status}`);
  } else {
    const expectedSitemapLine = `Sitemap: ${expectedOrigin}/sitemap.xml`;
    if (!robots.text.includes(expectedSitemapLine)) {
      failures.push(`robots.txt does not include "${expectedSitemapLine}"`);
    }
    if (forbidLegacyAlias && robots.text.includes(legacyOrigin)) {
      failures.push(`robots.txt still references legacy alias ${legacyOrigin}`);
    }
  }

  const sitemap = await fetchText(buildUrl(expectedOrigin, '/sitemap.xml'));
  if (!sitemap.ok) {
    failures.push(`sitemap.xml returned HTTP ${sitemap.status}`);
  } else {
    if (!sitemap.text.includes(expectedOrigin)) {
      failures.push(`sitemap.xml does not include expected origin ${expectedOrigin}`);
    }
    if (forbidLegacyAlias && sitemap.text.includes(legacyOrigin)) {
      failures.push(`sitemap.xml still references legacy alias ${legacyOrigin}`);
    }
  }

  const home = await fetchText(buildUrl(expectedOrigin, '/'));
  if (!home.ok) {
    failures.push(`/ returned HTTP ${home.status}`);
  } else {
    const homeCanonical = extractByRegex(
      home.text,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      'home canonical'
    );
    if (homeCanonical !== expectedOrigin) {
      failures.push(`home canonical mismatch: expected ${expectedOrigin}, received ${homeCanonical}`);
    }

    const homeOgUrl = extractOptionalByRegex(
      home.text,
      /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i
    );
    const homeOgImage = extractOptionalByRegex(
      home.text,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    );

    if (homeOgUrl) {
      if (homeOgUrl !== expectedOrigin) {
        failures.push(`home og:url mismatch: expected ${expectedOrigin}, received ${homeOgUrl}`);
      }
    } else if (!homeOgImage?.startsWith(expectedOrigin)) {
      failures.push(
        `home og:image mismatch: expected an absolute URL under ${expectedOrigin}, received ${homeOgImage || 'missing'}`
      );
    }

    if (forbidLegacyAlias && home.text.includes(legacyOrigin)) {
      failures.push(`home HTML still references legacy alias ${legacyOrigin}`);
    }
  }

  const community = await fetchText(buildUrl(expectedOrigin, '/community'));
  if (!community.ok) {
    failures.push(`/community returned HTTP ${community.status}`);
  } else {
    const expectedCommunityCanonical = `${expectedOrigin}/community`;
    const communityCanonical = extractByRegex(
      community.text,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      'community canonical'
    );
    if (communityCanonical !== expectedCommunityCanonical) {
      failures.push(
        `community canonical mismatch: expected ${expectedCommunityCanonical}, received ${communityCanonical}`
      );
    }

    const communityOgUrl = extractOptionalByRegex(
      community.text,
      /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i
    );
    const communityOgImage = extractOptionalByRegex(
      community.text,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    );

    if (communityOgUrl) {
      if (communityOgUrl !== expectedCommunityCanonical) {
        failures.push(
          `community og:url mismatch: expected ${expectedCommunityCanonical}, received ${communityOgUrl}`
        );
      }
    } else if (!communityOgImage?.startsWith(expectedOrigin)) {
      failures.push(
        `community og:image mismatch: expected an absolute URL under ${expectedOrigin}, received ${communityOgImage || 'missing'}`
      );
    }

    if (forbidLegacyAlias && community.text.includes(legacyOrigin)) {
      failures.push(`community HTML still references legacy alias ${legacyOrigin}`);
    }
  }

  const summary = {
    expectedOrigin,
    legacyOrigin,
    forbidLegacyAlias,
    pass: failures.length === 0,
    checkedAt: new Date().toISOString(),
    surfaces: {
      robots: {
        status: robots.status,
        finalUrl: robots.finalUrl,
      },
      sitemap: {
        status: sitemap.status,
        finalUrl: sitemap.finalUrl,
      },
      home: {
        status: home.status,
        finalUrl: home.finalUrl,
      },
      community: {
        status: community.status,
        finalUrl: community.finalUrl,
      },
    },
    failures,
  };

  mkdirSync(resolve('test-results/live'), { recursive: true });
  writeFileSync(
    resolve('test-results/live/domain-parity-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8'
  );

  console.log(`[domain-gate] expectedOrigin=${expectedOrigin}`);
  console.log(`[domain-gate] legacyOrigin=${legacyOrigin}`);
  console.log(
    `[domain-gate] legacyAliasMode=${forbidLegacyAlias ? 'forbidden' : 'allowed-as-current-runtime'}`
  );

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`[domain-gate] FAIL ${failure}`);
    }
    process.exit(1);
  }

  console.log('[domain-gate] PASS robots/sitemap/canonical/og parity confirmed');
}

main().catch((error) => {
  console.error(`[domain-gate] FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
