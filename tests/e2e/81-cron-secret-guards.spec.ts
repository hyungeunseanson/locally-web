import { expect, test } from '@playwright/test';

const CRON_SECRET = process.env.CRON_SECRET || '';

test.describe('Cron secret guards', () => {
  test('rejects cron requests without an authorization header', async ({ request }) => {
    const responses = await Promise.all([
      request.get('/api/cron/cancel-pending'),
      request.get('/api/cron/complete-trips'),
      request.get('/api/cron/complete-services'),
      request.get('/api/cron/experience-translations'),
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
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(401);
    }
  });

  test('allows a valid cron secret through the guard before business logic runs', async ({ request }) => {
    test.skip(!CRON_SECRET, 'CRON_SECRET is required to verify the success contract.');

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
