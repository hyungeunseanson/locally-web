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
      expect(environment.r2_buckets).toContainEqual({
        binding: 'NEXT_INC_CACHE_R2_BUCKET',
        bucket_name: manifest.environments[environmentName].incrementalCacheR2,
      });
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

    expect(wrangler.env.canary.r2_buckets).toHaveLength(1);
    expect(wrangler.env.canary.queues).toBeUndefined();
    expect(wrangler.env.production.r2_buckets).toContainEqual({
      binding: manifest.bindings.publicExperienceMediaR2,
      bucket_name: manifest.environments.production.publicExperienceMediaR2,
    });
    expect(wrangler.env.production.queues?.producers).toEqual([
      {
        binding: manifest.bindings.publicExperienceMediaQueueProducer,
        queue: manifest.environments.production.publicExperienceMediaQueue,
      },
      {
        binding: manifest.bindings.experienceTranslationQueueProducer,
        queue: manifest.environments.production.experienceTranslationQueue,
      },
    ]);
    expect(wrangler.env.production.vars).toMatchObject({
      [manifest.publicExperienceMediaProducerPolicy.enabledVariable]: 'false',
      [manifest.publicExperienceMediaProducerPolicy.experienceIdsVariable]: '',
      [manifest.experienceTranslationReleasePolicy.queueEnabledVariable]: 'false',
      [manifest.experienceTranslationReleasePolicy.scheduledRecoveryEnabledVariable]: 'false',
      [manifest.homePopularityReleasePolicy.scheduledEnabledVariable]: 'false',
      [manifest.adminSupportUnreadReleasePolicy.scheduledEnabledVariable]: 'false',
      [manifest.notificationRetentionReleasePolicy.scheduledEnabledVariable]: 'false',
      [manifest.experienceCompletionReleasePolicy.scheduledEnabledVariable]: 'false',
    });
    expect(wrangler.env.production.queues?.consumers).toContainEqual({
      queue: manifest.environments.production.experienceTranslationQueue,
      max_batch_size: manifest.experienceTranslationQueuePolicy.maxBatchSize,
      max_retries: manifest.experienceTranslationQueuePolicy.maxRetries,
      dead_letter_queue: manifest.environments.production.experienceTranslationDeadLetterQueue,
      max_concurrency: manifest.experienceTranslationQueuePolicy.maxConcurrency,
      retry_delay: manifest.experienceTranslationQueuePolicy.retryDelaySeconds,
    });
    expect(wrangler.env.production.triggers).toEqual({
      crons: [
        manifest.experienceTranslationQueuePolicy.recoveryCron,
        manifest.adminSupportUnreadReleasePolicy.cron,
        manifest.notificationRetentionReleasePolicy.cron,
        manifest.experienceCompletionReleasePolicy.cron,
      ],
    });
    expect(manifest.homePopularityReleasePolicy.cron).toBe(
      manifest.experienceTranslationQueuePolicy.recoveryCron
    );
    expect(wrangler.env.canary.vars).not.toHaveProperty(
      manifest.publicExperienceMediaProducerPolicy.enabledVariable
    );
    expect(wrangler.env.canary.vars).not.toHaveProperty(
      manifest.publicExperienceMediaProducerPolicy.experienceIdsVariable
    );
    expect(wrangler.env.canary.vars).not.toHaveProperty(
      manifest.experienceTranslationReleasePolicy.queueEnabledVariable
    );
    expect(wrangler.env.canary.vars).not.toHaveProperty(
      manifest.experienceTranslationReleasePolicy.scheduledRecoveryEnabledVariable
    );
    expect(wrangler.env.canary.vars).not.toHaveProperty(
      manifest.homePopularityReleasePolicy.scheduledEnabledVariable
    );
    expect(wrangler.env.canary.vars).not.toHaveProperty(
      manifest.adminSupportUnreadReleasePolicy.scheduledEnabledVariable
    );
    expect(wrangler.env.canary.vars).not.toHaveProperty(
      manifest.notificationRetentionReleasePolicy.scheduledEnabledVariable
    );
    expect(wrangler.env.canary.vars).not.toHaveProperty(
      manifest.experienceCompletionReleasePolicy.scheduledEnabledVariable
    );
    expect(wrangler.env.canary.vars).not.toHaveProperty(
      manifest.experienceMediaSourceReleasePolicy.enabledVariable
    );
    expect(wrangler.env.canary.triggers).toBeUndefined();

    const wranglerEnvironments = Object.values(wrangler.env) as Array<{
      r2_buckets: Array<{ binding: string; bucket_name: string }>;
    }>;
    const incrementalCacheBuckets = wranglerEnvironments.map(
      (environment) =>
        environment.r2_buckets.find(
          (binding: { binding: string }) =>
            binding.binding === manifest.bindings.incrementalCacheR2
        )?.bucket_name
    );
    for (const forbiddenBucket of manifest.forbiddenIncrementalCacheR2Buckets) {
      expect(incrementalCacheBuckets).not.toContain(forbiddenBucket);
    }
  });

  test('owns the Production public media build-time flag without forcing local or Preview builds', () => {
    expect(manifest.environments.production.publicExperienceMediaBaseUrl).toBe(
      'https://media-canary.locally-travel.com'
    );
    expect(manifest.environments.production.publicHostProfileMediaBaseUrl).toBe(
      'https://profiles-media.locally-travel.com'
    );
    expect(manifest.environmentVariables.productionBuildRequired).toEqual([
      'NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL',
      'NEXT_PUBLIC_CLOUDFLARE_HOST_PROFILE_BASE_URL',
      'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED',
      'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS',
    ]);
    expect(manifest.publicExperienceMediaReaderPolicy).toEqual({
      enabledVariable: 'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED',
      experienceIdsVariable: 'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS',
      defaultEnabled: 'false',
      defaultExperienceIds: '',
    });
    expect(packageJson.scripts['cloudflare:build:production']).toBe(
      'node scripts/cloudflare/run-production-build.mjs'
    );
    expect(packageJson.scripts['precloudflare:deploy:production']).toBeUndefined();
    expect(packageJson.scripts['cloudflare:deploy:production']).toBe(
      'node scripts/cloudflare/run-production-deploy.mjs'
    );
    expect(manifest.publicExperienceMediaReleasePolicy.defaultProductionProfile).toBe(
      'approved-cohort'
    );
    expect(manifest.publicExperienceMediaReleasePolicy.profiles.off).toEqual({
      enabled: 'false',
      experienceIds: [],
    });
    expect(manifest.publicExperienceMediaReleasePolicy.profiles['single-3309']).toEqual({
      enabled: 'true',
      experienceIds: [3309],
    });
    expect(manifest.experienceMediaSourceReleasePolicy).toEqual({
      defaultProductionProfile: 'off',
      enabledVariable: 'EXPERIENCE_MEDIA_R2_SOURCE_ENABLED',
      rawDefault: 'false',
    });
    expect(wrangler.env.production.vars.EXPERIENCE_MEDIA_R2_SOURCE_ENABLED).toBe('false');
    expect(
      manifest.publicExperienceMediaReleasePolicy.profiles['approved-cohort'].experienceIds
    ).toEqual([
      3071, 3081, 3188, 3253, 3307, 3308, 3309, 3331, 3343, 3402, 3403,
      3404, 3405, 3410, 3416, 3439, 3496, 3570, 3664, 3861, 4262, 4313,
      4397, 4413, 4414, 4424, 4523, 4597, 4659, 4660, 4811, 4837, 4838,
    ]);
    expect(packageJson.scripts.build).toBe('next build');
    expect(packageJson.scripts['cloudflare:build']).toBe('opennextjs-cloudflare build');
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
