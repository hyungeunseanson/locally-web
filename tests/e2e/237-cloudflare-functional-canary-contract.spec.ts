import { existsSync, readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const cacheRoute = readFileSync('app/api/canary/cloudflare/cache/route.ts', 'utf8');
const smtpRoute = readFileSync('app/api/canary/cloudflare/smtp/route.ts', 'utf8');
const readinessRoute = readFileSync('app/api/canary/cloudflare/readiness/route.ts', 'utf8');
const guard = readFileSync('app/utils/cloudflareFunctionalCanary.ts', 'utf8');
const nextConfig = readFileSync('next.config.ts', 'utf8');
const accessRuntime = readFileSync('tests/cloudflare-functional/access-runtime.spec.ts', 'utf8');
const authRuntime = readFileSync('tests/cloudflare-functional/auth-rsc-runtime.spec.ts', 'utf8');
const globalSetup = readFileSync('tests/cloudflare-functional/global.setup.ts', 'utf8');
const helpers = readFileSync('tests/cloudflare-functional/helpers.ts', 'utf8');
const browserSupabase = readFileSync('app/utils/supabase/client.ts', 'utf8');
const chatHook = readFileSync('app/hooks/useChat.ts', 'utf8');
const notifications = readFileSync('app/context/NotificationContext.tsx', 'utf8');
const remoteConfig = readFileSync('playwright.cloudflare-functional.config.ts', 'utf8');

test.describe('Cloudflare functional canary contract', () => {
  test('keeps the canary hidden and secret-gated outside its named environment', () => {
    expect(wrangler.env.canary.vars.CLOUDFLARE_FUNCTIONAL_CANARY_ENABLED).toBe('true');
    expect(wrangler.env.canary.workers_dev).toBe(false);
    expect(wrangler.env.canary.preview_urls).toBe(false);
    expect(wrangler.env.production.vars?.CLOUDFLARE_FUNCTIONAL_CANARY_ENABLED).toBeUndefined();
    expect(guard).toContain("process.env.CLOUDFLARE_FUNCTIONAL_CANARY_ENABLED !== 'true'");
    expect(guard).toContain('CLOUDFLARE_FUNCTIONAL_CANARY_SECRET');
    expect(guard).toContain("'x-locally-canary-secret'");
    expect(guard).toContain("crypto.subtle.digest('SHA-256'");
    expect(guard).not.toContain('provided === expected');
  });

  test('requires account-edge Access and scopes automation credentials to the canary origin', () => {
    expect(globalSetup).toContain('CLOUDFLARE_ACCESS_CLIENT_ID');
    expect(globalSetup).toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(helpers).toContain('(url) => url.origin === canaryOrigin');
    expect(helpers).toContain('await route.continue({');
    expect(helpers).not.toContain('route.fetch({');
    expect(helpers).not.toContain('extraHTTPHeaders');
    expect(remoteConfig).not.toContain('extraHTTPHeaders');
    expect(remoteConfig).toContain("trace: 'off'");
    expect(authRuntime).toContain("requestHeaders['cf-access-client-id']");
    expect(authRuntime).toContain("requestHeaders['cf-access-client-secret']");
    expect(accessRuntime).toContain('maxRedirects: 0');
    expect(accessRuntime).toContain('expect([302, 401, 403]).toContain(blocked.status())');
    expect(accessRuntime).toContain("not.toContain('\"canaryEnabled\"')");
  });

  test('keeps Realtime browser-to-Supabase instead of proxying its WebSocket through the Worker', () => {
    expect(browserSupabase).toContain('createBrowserClient(supabaseUrl, supabaseKey)');
    expect(chatHook).toContain('.channel(`chat-realtime-updates-${currentUser.id}`)');
    expect(notifications).toContain(".channel('global-alerts')");
    expect(chatHook).not.toContain('/api/canary/cloudflare');
    expect(notifications).not.toContain('/api/canary/cloudflare');
  });

  test('exercises the 60 second OpenNext cache, SWR tag invalidation, and isolate identity', () => {
    expect(cacheRoute).toContain('CACHE_REVALIDATE_SECONDS = 60');
    expect(cacheRoute).toContain('unstable_cache(');
    expect(cacheRoute).toContain('revalidate: CACHE_REVALIDATE_SECONDS');
    expect(cacheRoute).toContain('CLOUDFLARE_FUNCTIONAL_CANARY_CACHE_TAG');
    expect(cacheRoute).toContain("revalidateTag(CLOUDFLARE_FUNCTIONAL_CANARY_CACHE_TAG, 'max')");
    expect(cacheRoute).toContain('const ISOLATE_ID = crypto.randomUUID()');
  });

  test('uses Cloudflare Images in both deployment environments and preserves image behavior', () => {
    expect(wrangler.env.canary.images).toEqual({ binding: 'IMAGES' });
    expect(wrangler.env.production.images).toEqual({ binding: 'IMAGES' });
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
    expect(readinessRoute).toContain('CLOUDFLARE_FUNCTIONAL_CANARY_STAGING_SUPABASE_PROJECT_REF');
    expect(readinessRoute).toContain('CLOUDFLARE_FUNCTIONAL_CANARY_STAGING_PROJECT_VERIFIED');
    expect(readinessRoute).toContain('CLOUDFLARE_FUNCTIONAL_CANARY_ALLOW_STAGING_WRITES');
    expect(readinessRoute).toContain('activeWriteGateConfigured');
    expect(readinessRoute).toContain('KNOWN_PRODUCTION_SUPABASE_PROJECT_REFS');
    expect(readinessRoute).toContain("'uhinvcydgzqlpnvieyal'");
    expect(globalSetup).toContain('KNOWN_PRODUCTION_SUPABASE_PROJECT_REFS');
    expect(globalSetup).toContain("'uhinvcydgzqlpnvieyal'");
    expect(readinessRoute).toContain("serverProbeRoute: '/api/admin/sentry-test'");
  });

  test('does not activate root proxy and exposes explicit local/remote commands', () => {
    expect(existsSync('proxy.ts')).toBe(false);
    expect(existsSync('app/middleware.ts')).toBe(true);
    expect(packageJson.scripts['cloudflare:functional:contract']).toBeTruthy();
    expect(packageJson.scripts['cloudflare:functional:remote']).toBeTruthy();
    expect(packageJson.scripts['cloudflare:functional:remote:access']).toBeTruthy();
    expect(packageJson.scripts['cloudflare:functional:remote:public']).toBeTruthy();
    expect(packageJson.scripts['cloudflare:functional:remote:storage']).toBeTruthy();
  });
});
