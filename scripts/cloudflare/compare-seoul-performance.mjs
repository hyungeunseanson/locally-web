import { readFile } from 'node:fs/promises';
import path from 'node:path';

const profiles = ['default', 'smart', 'supabase-hint'];
const directory = path.join(process.cwd(), '.wrangler', 'performance');
const reports = await Promise.all(
  profiles.map(async (profile) => JSON.parse(await readFile(path.join(directory, `${profile}.json`), 'utf8')))
);

const maxErrorRate = Number(process.env.CLOUDFLARE_PERFORMANCE_MAX_ERROR_RATE || 0.01);
const maxErrorRateDelta = Number(process.env.CLOUDFLARE_PERFORMANCE_MAX_ERROR_RATE_DELTA || 0.005);
const p50Ratio = Number(process.env.CLOUDFLARE_PERFORMANCE_P50_RATIO || 1.2);
const p50MarginMs = Number(process.env.CLOUDFLARE_PERFORMANCE_P50_MARGIN_MS || 50);
const p95Ratio = Number(process.env.CLOUDFLARE_PERFORMANCE_P95_RATIO || 1.25);
const p95MarginMs = Number(process.env.CLOUDFLARE_PERFORMANCE_P95_MARGIN_MS || 100);

function routePasses(route) {
  const { vercel, cloudflare } = route;
  return (
    cloudflare.errorRate <= maxErrorRate &&
    cloudflare.errorRate <= vercel.errorRate + maxErrorRateDelta &&
    cloudflare.ttfbMs.p50 <= vercel.ttfbMs.p50 * p50Ratio + p50MarginMs &&
    cloudflare.ttfbMs.p95 <= vercel.ttfbMs.p95 * p95Ratio + p95MarginMs &&
    cloudflare.latencyMs.p50 <= vercel.latencyMs.p50 * p50Ratio + p50MarginMs &&
    cloudflare.latencyMs.p95 <= vercel.latencyMs.p95 * p95Ratio + p95MarginMs
  );
}

const candidates = reports.map((report) => {
  if (report.profile !== profiles[reports.indexOf(report)] || report.runnerRegion !== 'seoul') {
    throw new Error(`Invalid performance report identity: ${report.profile}`);
  }
  const routeResults = Object.fromEntries(
    Object.entries(report.routes).map(([route, metrics]) => [route, routePasses(metrics)])
  );
  const cloudflareP95 = Object.values(report.routes)
    .map((route) => route.cloudflare.ttfbMs.p95)
    .reduce((sum, value) => sum + value, 0);
  return {
    profile: report.profile,
    passes: Object.values(routeResults).every(Boolean),
    routeResults,
    cloudflareP95Total: cloudflareP95,
  };
});

const passing = candidates
  .filter((candidate) => candidate.passes)
  .sort((left, right) => left.cloudflareP95Total - right.cloudflareP95Total);
if (passing.length === 0) {
  console.error(JSON.stringify({ status: 'FAIL', candidates }, null, 2));
  throw new Error('No Cloudflare placement profile met the Seoul parity gate on every route.');
}

console.log(JSON.stringify({
  status: 'LOCALLY_CLOUDFLARE_SEOUL_PERFORMANCE_PASS',
  selectedProfile: passing[0].profile,
  candidates,
}, null, 2));
