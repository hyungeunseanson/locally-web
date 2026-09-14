import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import nextConfig from '../../next.config';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const migrationManifest = JSON.parse(
  readFileSync('config/cloudflare/migration-manifest.json', 'utf8')
);
const foundationWorkflow = readFileSync(
  '.github/workflows/cloudflare-foundation-check.yml',
  'utf8'
);

test.describe('patched Next.js runtime contract', () => {
  test('pins the patched stable framework and matching lint configuration', () => {
    expect(packageJson.dependencies.next).toBe('16.3.5');
    expect(packageJson.devDependencies['eslint-config-next']).toBe('16.3.5');
    expect(packageJson.overrides.next.postcss).toBe('8.5.23');
    expect(lockfile.packages['node_modules/next'].version).toBe('16.3.5');
    expect(lockfile.packages['node_modules/eslint-config-next'].version).toBe('16.3.5');
    expect(lockfile.packages['node_modules/next/node_modules/postcss'].version).toBe('8.5.23');
    expect(lockfile.packages['node_modules/sharp'].version).toBe('0.35.4');
    expect(migrationManifest.runtimePins.next).toBe('16.3.5');
    expect(foundationWorkflow).toContain('next@16.3.5');
    expect(foundationWorkflow).not.toContain('next@16.2.4');
  });

  test('preserves the image security and source boundary', () => {
    expect(nextConfig.images?.formats).toEqual(['image/webp']);
    expect(nextConfig.images?.qualities).toEqual([65, 75]);
    expect(nextConfig.images?.dangerouslyAllowSVG).toBe(true);
    expect(nextConfig.images?.contentDispositionType).toBe('attachment');
    expect(nextConfig.images?.contentSecurityPolicy).toBe(
      "default-src 'self'; script-src 'none'; sandbox;"
    );

    expect(nextConfig.images?.remotePatterns).toEqual([
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'http', hostname: 'k.kakaocdn.net' },
      { protocol: 'https', hostname: 'k.kakaocdn.net' },
      { protocol: 'http', hostname: 't1.kakaocdn.net' },
      { protocol: 'https', hostname: 't1.kakaocdn.net' },
      { protocol: 'http', hostname: 'img1.kakaocdn.net' },
      { protocol: 'https', hostname: 'img1.kakaocdn.net' },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ]);
  });

  test('preserves representative redirect and rewrite behavior', async () => {
    const redirects = await nextConfig.redirects?.();
    const rewrites = await nextConfig.rewrites?.();

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: '/home', destination: '/', permanent: true }),
        expect.objectContaining({
          source: '/become-a-host2',
          destination: '/become-a-host',
          permanent: true,
        }),
      ])
    );
    expect(rewrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/api/public/experiences/:experienceId/reviews',
          destination: '/api/public-experiences/:experienceId/reviews',
        }),
        expect.objectContaining({
          source: '/:locale(ko|en|ja|zh)/:path*',
          destination: '/:path*',
        }),
      ])
    );
  });
});
