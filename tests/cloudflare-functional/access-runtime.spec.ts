import { expect, request as playwrightRequest, test } from '@playwright/test';

import { CANARY_SECRET_HEADER, canaryHeaders, requiredEnv } from './helpers';

test('blocks an unauthenticated request at Access before OpenNext application code', async ({ request }) => {
  const anonymous = await playwrightRequest.newContext({
    baseURL: requiredEnv('CLOUDFLARE_CANARY_BASE_URL'),
  });

  try {
    const blocked = await anonymous.get('/api/canary/cloudflare/readiness', {
      headers: {
        [CANARY_SECRET_HEADER]: requiredEnv('CLOUDFLARE_FUNCTIONAL_CANARY_SECRET'),
      },
      maxRedirects: 0,
    });
    expect([302, 401, 403]).toContain(blocked.status());
    expect(await blocked.text()).not.toContain('"canaryEnabled"');

    const allowed = await request.get('/api/canary/cloudflare/readiness', {
      headers: canaryHeaders(),
      maxRedirects: 0,
    });
    expect(allowed.status()).toBe(200);
    expect(await allowed.json()).toMatchObject({
      runtime: { canaryEnabled: true },
    });
  } finally {
    await anonymous.dispose();
  }
});
