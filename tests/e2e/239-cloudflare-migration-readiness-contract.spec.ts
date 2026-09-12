import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  getAboutLandingSections,
  hasCompleteAboutLandingLocale,
  type AboutLandingLocale,
} from '@/app/about/aboutLandingAssets';
import {
  getHostLandingSections,
  type HostLandingLocale,
} from '@/app/become-a-host2/hostLandingAssets';

const root = process.cwd();
const readText = (file: string) => readFileSync(path.join(root, file), 'utf8');
const readJson = (file: string) => JSON.parse(readText(file));
const wrangler = readJson('wrangler.jsonc');
const manifest = readJson('config/cloudflare/migration-manifest.json');
const packageJson = readJson('package.json');

test.describe('Cloudflare migration readiness contract', () => {
  test('uses committed landing manifests instead of a runtime project filesystem', () => {
    const aboutSource = readText('app/about/aboutLandingAssets.ts');
    const hostSource = readText('app/become-a-host2/hostLandingAssets.ts');
    const sitemapSource = readText('app/sitemap.ts');

    for (const source of [aboutSource, hostSource, sitemapSource]) {
      expect(source).not.toMatch(/from ['"](?:node:)?fs/);
      expect(source).not.toContain('process.cwd()');
    }

    const aboutLocales: AboutLandingLocale[] = ['ko', 'en', 'ja', 'zh'];
    expect(aboutLocales.filter(hasCompleteAboutLandingLocale)).toEqual(['ko', 'ja']);
    for (const locale of aboutLocales) {
      for (const section of getAboutLandingSections(locale)) {
        expect(existsSync(path.join(root, 'public', section.desktop.src))).toBe(true);
        expect(existsSync(path.join(root, 'public', section.mobile.src))).toBe(true);
      }
    }

    const hostLocales: HostLandingLocale[] = ['ko', 'en', 'ja', 'zh'];
    for (const locale of hostLocales) {
      const sections = getHostLandingSections(locale);
      expect(sections).toHaveLength(7);
      for (const section of sections) {
        expect(existsSync(path.join(root, 'public', section.desktop.src))).toBe(true);
        expect(existsSync(path.join(root, 'public', section.mobile.src))).toBe(true);
      }
    }
  });

  test('removes the Vercel Analytics runtime while preserving provider-neutral analytics', () => {
    expect(packageJson.dependencies['@vercel/analytics']).toBeUndefined();
    expect(existsSync(path.join(root, 'app/utils/analytics/runtime.ts'))).toBe(false);
    expect(readText('app/layout.tsx')).not.toContain('@vercel/analytics');
    expect(readText('app/layout.tsx')).not.toContain('shouldRenderVercelAnalytics');
    expect(readText('app/admin/dashboard/components/AnalyticsTab.tsx')).not.toContain('vercel.com/');
    expect(readText('app/layout.tsx')).toContain('GoogleAnalyticsGate');
  });

  test('declares complete and isolated OpenNext bindings for canary and production', () => {
    expect(wrangler.compatibility_date).toBe(manifest.runtimePins.compatibilityDate);
    expect(wrangler.compatibility_flags).toEqual(['nodejs_compat', 'global_fetch_strictly_public']);
    expect(wrangler.keep_vars).toBe(true);
    expect(wrangler.assets).toEqual({ directory: '.open-next/assets', binding: 'ASSETS' });

    for (const environmentName of ['canary', 'production']) {
      const environment = wrangler.env[environmentName];
      expect(environment.workers_dev).toBe(false);
      expect(environment.preview_urls).toBe(false);
      expect(environment.images).toEqual({ binding: 'IMAGES' });
      expect(environment.r2_buckets).toEqual([
        {
          binding: 'NEXT_INC_CACHE_R2_BUCKET',
          bucket_name: manifest.environments[environmentName].incrementalCacheR2,
        },
      ]);
      expect(environment.services).toEqual([
        {
          binding: 'WORKER_SELF_REFERENCE',
          service: manifest.environments[environmentName].worker,
        },
      ]);
      expect(environment.durable_objects.bindings.map((binding: { name: string }) => binding.name)).toEqual([
        'NEXT_CACHE_DO_QUEUE',
        'NEXT_TAG_CACHE_DO_SHARDED',
      ]);
    }

    const wranglerEnvironments = Object.values(wrangler.env) as Array<{
      r2_buckets: Array<{ bucket_name: string }>;
    }>;
    const configuredBuckets = wranglerEnvironments
      .flatMap((environment) => environment.r2_buckets)
      .map((binding: { bucket_name: string }) => binding.bucket_name);
    for (const forbiddenBucket of manifest.forbiddenR2Buckets) {
      expect(configuredBuckets).not.toContain(forbiddenBucket);
    }
  });

  test('keeps current Next image URLs and allows public storage from the isolated staging project', () => {
    const nextConfig = readText('next.config.ts');
    expect(nextConfig).toContain("hostname: '*.supabase.co'");
    expect(nextConfig).toContain("pathname: '/storage/v1/object/public/**'");
    expect(nextConfig).not.toContain("loader: 'custom'");
    expect(readText('app/components/PublicExperienceCardImage.tsx')).toContain('unoptimized');
    expect(readText('app/components/PublicHostProfileImage.tsx')).toContain('unoptimized');
  });

  test('keeps proxy activation deferred and codifies Seoul placement without leaking Access headers', () => {
    expect(existsSync(path.join(root, 'proxy.ts'))).toBe(false);
    expect(existsSync(path.join(root, 'app/middleware.ts'))).toBe(true);

    const placement = readText('scripts/cloudflare/render-placement-config.mjs');
    const performance = readText('scripts/cloudflare/measure-seoul-performance.mjs');
    expect(placement).toContain("['default', 'smart', 'supabase-hint']");
    expect(placement).toContain(
      "canary.placement = { mode: 'targeted', hostname: supabaseUrl.hostname }"
    );
    expect(performance).toContain("runnerRegion: 'seoul'");
    expect(performance).toContain('includeAccessHeaders ? accessHeaders : {}');
    expect(performance).toContain("redirect: 'manual'");
    expect(performance).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
