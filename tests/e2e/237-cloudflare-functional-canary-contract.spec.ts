import { existsSync, readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const cacheRoute = readFileSync('app/api/canary/cloudflare/cache/route.ts', 'utf8');
const smtpRoute = readFileSync('app/api/canary/cloudflare/smtp/route.ts', 'utf8');
const readinessRoute = readFileSync('app/api/canary/cloudflare/readiness/route.ts', 'utf8');
const guard = readFileSync('app/utils/cloudflareFunctionalCanary.ts', 'utf8');
const nextConfig = readFileSync('next.config.ts', 'utf8');

test.describe('Cloudflare functional canary contract', () => {
  test('keeps the canary hidden and secret-gated outside its named environment', () => {
    expect(wrangler.env.canary.vars.CLOUDFLARE_FUNCTIONAL_CANARY_ENABLED).toBe('true');
    expect(wrangler.env.production.vars?.CLOUDFLARE_FUNCTIONAL_CANARY_ENABLED).toBeUndefined();
    expect(guard).toContain("process.env.CLOUDFLARE_FUNCTIONAL_CANARY_ENABLED !== 'true'");
    expect(guard).toContain('CLOUDFLARE_FUNCTIONAL_CANARY_SECRET');
    expect(guard).toContain("'x-locally-canary-secret'");
    expect(guard).toContain("crypto.subtle.digest('SHA-256'");
    expect(guard).not.toContain('provided === expected');
  });

  test('exercises the 60 second OpenNext cache, SWR tag invalidation, and isolate identity', () => {
    expect(cacheRoute).toContain('CACHE_REVALIDATE_SECONDS = 60');
    expect(cacheRoute).toContain('unstable_cache(');
    expect(cacheRoute).toContain('revalidate: CACHE_REVALIDATE_SECONDS');
    expect(cacheRoute).toContain('CLOUDFLARE_FUNCTIONAL_CANARY_CACHE_TAG');
    expect(cacheRoute).toContain("revalidateTag(CLOUDFLARE_FUNCTIONAL_CANARY_CACHE_TAG, 'max')");
    expect(cacheRoute).toContain('const ISOLATE_ID = crypto.randomUUID()');
  });

  test('uses Cloudflare Images only in canary and preserves current image application behavior', () => {
    expect(wrangler.env.canary.images).toEqual({ binding: 'IMAGES' });
    expect(wrangler.env.production.images).toBeUndefined();
    expect(nextConfig).not.toContain("loader: 'custom'");
    expect(readFileSync('app/components/PublicExperienceCardImage.tsx', 'utf8')).toContain('unoptimized');
    expect(readFileSync('app/components/PublicExperienceDetailImage.tsx', 'utf8')).toContain('supabase-fallback');
  });

  test('makes Gmail probes non-delivery checks and keeps financial/Sentry checks read-only', () => {
    expect(smtpRoute).toContain('await transporter.verify()');
    expect(smtpRoute).not.toContain('.sendMail(');
    expect(smtpRoute).toContain('port === 465');
    expect(smtpRoute).toContain('port === 587');
    expect(readinessRoute).toContain("CLOUDFLARE_FUNCTIONAL_CANARY_PAYMENT_MODE === 'sandbox'");
    expect(readinessRoute).toContain("serverProbeRoute: '/api/admin/sentry-test'");
  });

  test('does not activate root proxy and exposes explicit local/remote commands', () => {
    expect(existsSync('proxy.ts')).toBe(false);
    expect(existsSync('app/middleware.ts')).toBe(true);
    expect(packageJson.scripts['cloudflare:functional:contract']).toBeTruthy();
    expect(packageJson.scripts['cloudflare:functional:remote']).toBeTruthy();
  });
});
