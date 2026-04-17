import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import {
  pickRepresentativePublicPaths,
  resolveAdsTxtExpectation,
} from './domain-parity-lib.mjs';

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

function createSurfaceKey(label) {
  return label.replace(/[^a-z0-9]+/gi, '_');
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

function validateHtmlSurface({
  label,
  response,
  expectedUrl,
  expectedOrigin,
  legacyOrigin,
  forbidLegacyAlias,
  failures,
}) {
  if (!response.ok) {
    failures.push(`${label} returned HTTP ${response.status}`);
    return;
  }

  const canonical = extractByRegex(
    response.text,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    `${label} canonical`
  );

  if (canonical !== expectedUrl) {
    failures.push(`${label} canonical mismatch: expected ${expectedUrl}, received ${canonical}`);
  }

  const ogUrl = extractOptionalByRegex(
    response.text,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i
  );
  const ogImage = extractOptionalByRegex(
    response.text,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  );

  if (ogUrl) {
    if (ogUrl !== expectedUrl) {
      failures.push(`${label} og:url mismatch: expected ${expectedUrl}, received ${ogUrl}`);
    }
  } else if (!ogImage?.startsWith(expectedOrigin)) {
    failures.push(
      `${label} og:image mismatch: expected an absolute URL under ${expectedOrigin}, received ${ogImage || 'missing'}`
    );
  }

  if (forbidLegacyAlias && response.text.includes(legacyOrigin)) {
    failures.push(`${label} HTML still references legacy alias ${legacyOrigin}`);
  }
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
  const surfaces = {};

  const robots = await fetchText(buildUrl(expectedOrigin, '/robots.txt'));
  surfaces.robots = {
    status: robots.status,
    finalUrl: robots.finalUrl,
    expectedUrl: `${expectedOrigin}/robots.txt`,
  };
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
  surfaces.sitemap = {
    status: sitemap.status,
    finalUrl: sitemap.finalUrl,
    expectedUrl: `${expectedOrigin}/sitemap.xml`,
  };
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

  const representativeStaticSurfaces = [
    { label: 'home', path: '/', expectedUrl: expectedOrigin },
    { label: 'community', path: '/community', expectedUrl: `${expectedOrigin}/community` },
    { label: 'search', path: '/search', expectedUrl: `${expectedOrigin}/search` },
    {
      label: 'services_intro',
      path: '/services/intro',
      expectedUrl: `${expectedOrigin}/services/intro`,
    },
  ];

  for (const surface of representativeStaticSurfaces) {
    const response = await fetchText(buildUrl(expectedOrigin, surface.path));
    surfaces[surface.label] = {
      status: response.status,
      finalUrl: response.finalUrl,
      expectedUrl: surface.expectedUrl,
    };

    validateHtmlSurface({
      label: surface.label,
      response,
      expectedUrl: surface.expectedUrl,
      expectedOrigin,
      legacyOrigin,
      forbidLegacyAlias,
      failures,
    });
  }

  const representativeDynamicPaths = sitemap.ok
    ? pickRepresentativePublicPaths({
        expectedOrigin,
        sitemapText: sitemap.text,
      }).filter((path) => !representativeStaticSurfaces.some((surface) => surface.path === path))
    : [];

  for (const path of representativeDynamicPaths) {
    const response = await fetchText(buildUrl(expectedOrigin, path));
    const key = createSurfaceKey(`dynamic_${path}`);
    surfaces[key] = {
      status: response.status,
      finalUrl: response.finalUrl,
      expectedUrl: `${expectedOrigin}${path}`,
    };

    validateHtmlSurface({
      label: path,
      response,
      expectedUrl: `${expectedOrigin}${path}`,
      expectedOrigin,
      legacyOrigin,
      forbidLegacyAlias,
      failures,
    });
  }

  const adsTxtExpectation = resolveAdsTxtExpectation(env);
  const adsTxt = await fetchText(buildUrl(expectedOrigin, '/ads.txt'));
  surfaces.ads_txt = {
    status: adsTxt.status,
    finalUrl: adsTxt.finalUrl,
    expectedStatus: adsTxtExpectation.expectedStatus,
  };

  if (adsTxt.status !== adsTxtExpectation.expectedStatus) {
    failures.push(
      `ads.txt status mismatch: expected HTTP ${adsTxtExpectation.expectedStatus}, received ${adsTxt.status}`
    );
  } else if (adsTxtExpectation.expectedStatus === 200 && !adsTxt.text.includes('google.com,')) {
    failures.push('ads.txt returned 200 but does not include a Google publisher entry');
  }

  const summary = {
    expectedOrigin,
    legacyOrigin,
    forbidLegacyAlias,
    pass: failures.length === 0,
    checkedAt: new Date().toISOString(),
    adsTxtExpectedStatus: adsTxtExpectation.expectedStatus,
    surfaces,
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

  console.log('[domain-gate] PASS representative robots/sitemap/canonical/og parity confirmed');
}

main().catch((error) => {
  console.error(`[domain-gate] FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
