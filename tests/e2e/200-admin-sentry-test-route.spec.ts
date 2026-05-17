import { expect, test, type Page } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  getTestAdminClient,
  login,
  type E2ETestUser,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];

async function postJson(page: Page, path: string) {
  return page.evaluate(async (url) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }, path);
}

async function createUser(user: E2ETestUser, options?: { isAdmin?: boolean }) {
  const userId = await createAuthUser(user, options);
  createdAuthUserIds.push(userId);
  if (options?.isAdmin) {
    createdWhitelistEmails.push(user.email);
  }
  return userId;
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Admin Sentry test route', () => {
  test('rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/admin/sentry-test?dryRun=1');

    expect(response.status()).toBe(401);
  });

  test('rejects signed-in non-admin users', async ({ page }) => {
    const intruder = createTestUser('sentry.test.intruder');
    await createUser(intruder);
    await login(page, intruder);

    const response = await postJson(page, '/api/admin/sentry-test?dryRun=1');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('allows admins to dry-run the endpoint without sending a Sentry event', async ({ page }) => {
    const admin = createTestUser('sentry.test.admin');
    await createUser(admin, { isAdmin: true });
    await login(page, admin);

    const response = await postJson(page, '/api/admin/sentry-test?dryRun=1');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      dryRun: true,
      sent: false,
    });
    expect(typeof response.body.sentryEnabled).toBe('boolean');
    expect(typeof response.body.environment).toBe('string');
  });
});
