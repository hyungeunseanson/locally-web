import { readFileSync } from 'fs';

import { expect, test } from '@playwright/test';

const INTERNAL_SECRET = readFileSync('.env.local', 'utf8')
  .split(/\n/)
  .reduce<string>((secret, line) => {
    const match = line.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/);
    return match ? match[1] : secret;
  }, '');

test.describe('Internal email route guard', () => {
  test('rejects requests without the internal secret header', async ({ request }) => {
    const response = await request.post('/api/notifications/send-email', {
      data: {
        type: 'proxy_comment_notify',
        targetEmail: 'codex.invalid@example.com',
        targetRole: 'admin',
        requestId: 'REQ-MISSING-SECRET',
        content: 'missing secret should be blocked',
      },
    });

    expect(response.status()).toBe(403);
  });

  test('rejects requests with the wrong internal secret header', async ({ request }) => {
    const response = await request.post('/api/notifications/send-email', {
      headers: {
        'x-internal-secret': 'wrong-secret',
      },
      data: {
        type: 'proxy_comment_notify',
        targetEmail: 'codex.invalid@example.com',
        targetRole: 'admin',
        requestId: 'REQ-WRONG-SECRET',
        content: 'wrong secret should be blocked',
      },
    });

    expect(response.status()).toBe(403);
  });

  test('passes the secret gate before payload validation', async ({ request }) => {
    test.skip(!INTERNAL_SECRET, 'SUPABASE_SERVICE_ROLE_KEY is required for the secret-gate contract.');

    const response = await request.post('/api/notifications/send-email', {
      headers: {
        'x-internal-secret': INTERNAL_SECRET,
      },
      data: {
        type: 'proxy_comment_notify',
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Missing required fields',
    });
  });
});
