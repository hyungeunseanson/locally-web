import { expect, test } from '@playwright/test';

import { getExpectedTestCronSecret } from './helpers/testSupabase';

const CRON_SECRET = getExpectedTestCronSecret();

test.describe('Cron secret guards', () => {
  test('rejects cron requests without an authorization header', async ({ request }) => {
    const responses = await Promise.all([
      request.get('/api/cron/cancel-pending'),
      request.get('/api/cron/complete-trips'),
      request.get('/api/cron/complete-services'),
      request.get('/api/cron/experience-translations'),
      request.get('/api/cron/admin-support-unread-alerts'),
      request.get('/api/cron/home-popularity-snapshot'),
      request.get('/api/bot/auto-post'),
      request.get('/api/bot/auto-comment'),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(401);
    }
  });

  test('rejects cron requests with the wrong bearer secret', async ({ request }) => {
    const responses = await Promise.all([
      request.get('/api/cron/cancel-pending', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/cron/complete-trips', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/cron/complete-services', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/cron/experience-translations', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/cron/admin-support-unread-alerts', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/cron/home-popularity-snapshot', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/bot/auto-post', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      request.get('/api/bot/auto-comment', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(401);
    }
  });

  test('allows the configured cron secret or local dev fallback through the guard before business logic runs', async ({ request }) => {
    const response = await request.get('/api/cron/cancel-pending', {
      headers: {
        authorization: `Bearer ${CRON_SECRET}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json() as Record<string, unknown>;
    expect(body.success === true || typeof body.message === 'string').toBe(true);
  });
});
