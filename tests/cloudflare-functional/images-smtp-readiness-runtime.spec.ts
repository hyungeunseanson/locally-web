import { expect, test } from '@playwright/test';

import { canaryHeaders, requiredEnv } from './helpers';

test.describe.serial('Worker image, SMTP, and runtime readiness', () => {
  test('uses the Cloudflare Images binding for the unchanged /_next/image contract', async ({ request }) => {
    const local = await request.get('/_next/image?url=%2Fimages%2Flogo.png&w=64&q=75', {
      headers: { accept: 'image/webp' },
    });
    expect(local.status()).toBe(200);
    expect(local.headers()['content-type']).toMatch(/^image\/webp/);

    const stagingSupabaseImage = requiredEnv('CLOUDFLARE_CANARY_STAGING_SUPABASE_IMAGE_URL');
    const optimized = await request.get(
      `/_next/image?url=${encodeURIComponent(stagingSupabaseImage)}&w=256&q=75`,
      { headers: { accept: 'image/webp' } }
    );
    expect(optimized.status()).toBe(200);
    expect(optimized.headers()['content-type']).toMatch(/^image\/webp/);

    const publicR2Image = requiredEnv('CLOUDFLARE_CANARY_PUBLIC_R2_IMAGE_URL');
    const directR2 = await request.get(publicR2Image);
    expect(directR2.status()).toBe(200);
    expect(directR2.headers()['content-type']).toMatch(/^image\//);
  });

  test('reports only a non-Production Supabase and sandbox payment configuration as safe', async ({ request }) => {
    const response = await request.get('/api/canary/cloudflare/readiness', {
      headers: canaryHeaders(),
    });
    expect(response.status()).toBe(200);
    const readiness = await response.json();
    expect(readiness).toMatchObject({
      safe: true,
      runtime: { canaryEnabled: true },
      supabase: {
        configured: true,
        nonProduction: true,
        stagingWritesExplicitlyEnabled: true,
      },
      payments: {
        sandbox: true,
      },
      gmail: { probeSendsMail: false },
    });
  });

  for (const profile of ['transactional', 'admin'] as const) {
    for (const port of [465, 587] as const) {
      test(`verifies Gmail ${profile} SMTP authentication on port ${port} without sending mail`, async ({ request }) => {
        const response = await request.post('/api/canary/cloudflare/smtp', {
          headers: canaryHeaders(),
          data: { profile, port },
        });
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({
          ok: true,
          profile,
          port,
          sent: false,
        });
      });
    }
  }
});
