import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  createAuthUser,
  createTestUser,
  getAdminClient,
  login,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];

async function makeUserAdmin(userId: string, email: string) {
  const { error } = await getAdminClient()
    .from('users')
    .upsert(
      {
        id: userId,
        email,
        role: 'admin',
      },
      { onConflict: 'id' }
    );

  if (error) throw error;
}

async function whitelistEmail(email: string) {
  const { error } = await getAdminClient().from('admin_whitelist').insert({ email });
  if (error) throw error;
  createdWhitelistEmails.push(email);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Admin team notify guard', () => {
  test('blocks non-admin callers', async ({ page }) => {
    const user = createTestUser('team.notify.user');
    await createAuthUser(user, createdAuthUserIds);

    await login(page, user);

    const response = await page.request.post('/api/admin/notify-team', {
      data: {
        title: 'Forbidden Team Notify',
        message: 'non-admin should be blocked',
        eventType: 'team_todo',
      },
    });

    expect(response.status()).toBe(403);
  });

  test('rejects oversize payloads before sending', async ({ page }) => {
    const admin = createTestUser('team.notify.admin');
    const adminId = await createAuthUser(admin, createdAuthUserIds);
    await makeUserAdmin(adminId, admin.email);

    await login(page, admin);

    const response = await page.request.post('/api/admin/notify-team', {
      data: {
        title: 'T'.repeat(201),
        message: 'oversized title must fail',
        eventType: 'team_todo',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('accepts immediate team task comment emails for whitelisted teammates', async ({ page }) => {
    const actor = createTestUser('team.notify.actor');
    const teammate = createTestUser('team.notify.teammate');
    const actorId = await createAuthUser(actor, createdAuthUserIds);
    await createAuthUser(teammate, createdAuthUserIds);
    await makeUserAdmin(actorId, actor.email);
    await whitelistEmail(actor.email);
    await whitelistEmail(teammate.email);

    await login(page, actor);

    const title = `Playwright Team Todo ${Date.now()}`;
    const response = await page.request.post('/api/admin/notify-team', {
      data: {
        title,
        message: 'team task comments should notify teammates immediately',
        link: '/admin/dashboard?tab=TEAM',
        eventType: 'team_task_comment',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json() as {
      success?: boolean;
      mode?: string;
      count?: number;
      skipped?: number;
    };

    expect(body.success).toBe(true);
    expect(body.mode).toBe('immediate');
    expect(typeof body.count).toBe('number');
    expect(typeof body.skipped).toBe('number');
  });
});
