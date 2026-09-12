import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_PROFILES = new Set(['default', 'smart', 'supabase-hint']);
const profile = process.env.CLOUDFLARE_PLACEMENT_PROFILE;
if (!REQUIRED_PROFILES.has(profile)) {
  throw new Error('CLOUDFLARE_PLACEMENT_PROFILE must be default, smart, or supabase-hint.');
}
if (process.env.CLOUDFLARE_PERFORMANCE_RUNNER_REGION?.toLowerCase() !== 'seoul') {
  throw new Error('Run this gate from the Seoul probe host and set CLOUDFLARE_PERFORMANCE_RUNNER_REGION=seoul.');
}

function requiredUrl(name) {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is required.`);
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an HTTPS origin without a path, query, or hash.`);
  }
  return url;
}

function requiredValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function integerSetting(name, fallback, minimum, maximum) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

const vercelOrigin = requiredUrl('VERCEL_PRODUCTION_BASE_URL');
const cloudflareOrigin = requiredUrl('CLOUDFLARE_PERFORMANCE_BASE_URL');
const allowedCloudflareHost = requiredValue('CLOUDFLARE_PERFORMANCE_ALLOWED_HOST');
if (cloudflareOrigin.hostname !== allowedCloudflareHost || cloudflareOrigin.origin === vercelOrigin.origin) {
  throw new Error('Cloudflare performance origin must match its exact allowlist and differ from Vercel.');
}

const accessHeaders = {
  'CF-Access-Client-Id': requiredValue('CLOUDFLARE_ACCESS_CLIENT_ID'),
  'CF-Access-Client-Secret': requiredValue('CLOUDFLARE_ACCESS_CLIENT_SECRET'),
};
const experienceId = requiredValue('CLOUDFLARE_PERFORMANCE_EXPERIENCE_ID');
const userId = requiredValue('CLOUDFLARE_PERFORMANCE_USER_ID');
const routes = [
  '/',
  '/search',
  `/experiences/${encodeURIComponent(experienceId)}`,
  `/users/${encodeURIComponent(userId)}`,
  '/api/home/experiences',
];
const warmups = integerSetting('CLOUDFLARE_PERFORMANCE_WARMUPS', 5, 1, 20);
const samples = integerSetting('CLOUDFLARE_PERFORMANCE_SAMPLES', 30, 10, 200);

async function requestOnce(origin, route, includeAccessHeaders) {
  const url = new URL(route, origin);
  if (url.origin !== origin.origin) throw new Error(`Cross-origin performance route rejected: ${url}`);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: route.startsWith('/api/') ? 'application/json' : 'text/html,application/xhtml+xml',
        'user-agent': 'Locally-Cloudflare-Seoul-Parity/1.0',
        ...(includeAccessHeaders ? accessHeaders : {}),
      },
    });
    const headersAt = performance.now();
    await response.arrayBuffer();
    const completedAt = performance.now();
    return {
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      ttfbMs: headersAt - startedAt,
      latencyMs: completedAt - startedAt,
    };
  } catch (error) {
    const completedAt = performance.now();
    return {
      status: 0,
      ok: false,
      ttfbMs: null,
      latencyMs: completedAt - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function percentile(values, quantile) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)];
}

function summarize(values) {
  const successes = values.filter((value) => value.ok);
  return {
    requests: values.length,
    errors: values.length - successes.length,
    errorRate: (values.length - successes.length) / values.length,
    statuses: Object.fromEntries(
      [...new Set(values.map((value) => value.status))]
        .sort((left, right) => left - right)
        .map((status) => [String(status), values.filter((value) => value.status === status).length])
    ),
    ttfbMs: {
      p50: percentile(successes.map((value) => value.ttfbMs), 0.5),
      p95: percentile(successes.map((value) => value.ttfbMs), 0.95),
    },
    latencyMs: {
      p50: percentile(successes.map((value) => value.latencyMs), 0.5),
      p95: percentile(successes.map((value) => value.latencyMs), 0.95),
    },
  };
}

const raw = Object.fromEntries(routes.map((route) => [route, { vercel: [], cloudflare: [] }]));
for (const route of routes) {
  for (let index = 0; index < warmups; index += 1) {
    await requestOnce(vercelOrigin, route, false);
    await requestOnce(cloudflareOrigin, route, true);
  }

  for (let index = 0; index < samples; index += 1) {
    const targets = index % 2 === 0 ? ['vercel', 'cloudflare'] : ['cloudflare', 'vercel'];
    for (const target of targets) {
      raw[route][target].push(
        target === 'vercel'
          ? await requestOnce(vercelOrigin, route, false)
          : await requestOnce(cloudflareOrigin, route, true)
      );
    }
  }
}

const result = {
  schemaVersion: 1,
  profile,
  runnerRegion: 'seoul',
  measuredAt: new Date().toISOString(),
  warmups,
  samples,
  origins: {
    vercel: vercelOrigin.origin,
    cloudflare: cloudflareOrigin.origin,
  },
  routes: Object.fromEntries(
    routes.map((route) => [route, {
      vercel: summarize(raw[route].vercel),
      cloudflare: summarize(raw[route].cloudflare),
    }])
  ),
};

const outputDirectory = path.join(process.cwd(), '.wrangler', 'performance');
const output = path.join(outputDirectory, `${profile}.json`);
await mkdir(outputDirectory, { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output: path.relative(process.cwd(), output), result }, null, 2));
