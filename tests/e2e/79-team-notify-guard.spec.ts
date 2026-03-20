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
const createdNotificationIds: number[] = [];

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

async function findAdminAlertNotificationId(userId: string, title: string) {
  const { data, error } = await getAdminClient()
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'admin_alert')
    .eq('title', title)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) return null;

  const id = Number(data.id);
  createdNotificationIds.push(id);
  return id;
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

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

  test('keeps non-email event types in-app only while resolving recipients from admin_whitelist', async ({ page }) => {
    const actor = createTestUser('team.notify.actor');
    const teammate = createTestUser('team.notify.teammate');
    const actorId = await createAuthUser(actor, createdAuthUserIds);
    const teammateId = await createAuthUser(teammate, createdAuthUserIds);
    await makeUserAdmin(actorId, actor.email);
    await whitelistEmail(actor.email);
    await whitelistEmail(teammate.email);

    await login(page, actor);

    const title = `Playwright Team Todo ${Date.now()}`;
    const response = await page.request.post('/api/admin/notify-team', {
      data: {
        title,
        message: 'team_todo should stay in-app only',
        link: '/admin/dashboard?tab=TEAM',
        eventType: 'team_todo',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json() as {
      success?: boolean;
      mode?: string;
      skipped?: string;
      notifications?: number;
    };

    expect(body.success).toBe(true);
    expect(body.mode).toBe('in_app_only');
    expect(body.skipped).toBe('event_type_not_enabled');
    expect(Number(body.notifications || 0)).toBeGreaterThanOrEqual(1);

    const notificationId = await findAdminAlertNotificationId(teammateId, title);
    expect(notificationId).not.toBeNull();
  });
});
