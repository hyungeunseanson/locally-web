import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdNotificationIds: number[] = [];

function loadEnv(): EnvMap {
  return readFileSync('.env.local', 'utf8')
    .split(/\n/)
    .reduce<EnvMap>((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
}

function getAdminClient() {
  if (adminClient) return adminClient;

  const env = loadEnv();
  adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.notification.read.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Notification Read ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

async function waitForProfile(userId: string) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Profile was not created for auth user ${userId}.`);
}

async function createAuthUser(user: TestUser) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      phone: user.phone,
    },
  });

  if (error || !data.user?.id) {
    throw error || new Error(`Failed to create auth user for ${user.email}`);
  }

  createdAuthUserIds.push(data.user.id);
  await waitForProfile(data.user.id);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: user.fullName,
      phone: user.phone,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  return data.user.id;
}

async function insertUnreadNotification(userId: string, link: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'booking_confirmed',
      title: '알림 읽음 테스트',
      message: '읽음 처리 테스트 알림입니다.',
      link,
      is_read: false,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to seed unread notification.');
  }

  createdNotificationIds.push(Number(data.id));
  return Number(data.id);
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();

  const results = await Promise.allSettled([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }),
    page.getByText('Welcome back. You are now logged in.').waitFor({ state: 'visible', timeout: 15000 }),
  ]);

  if (results.every((result) => result.status === 'rejected')) {
    throw new Error(`Login did not complete for ${user.email}`);
  }
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('notification read route', () => {
  test('marks one notification and markAll only for the current user', async ({ page }) => {
    const user = createUser('owner');
    const other = createUser('other');
    const userId = await createAuthUser(user);
    const otherUserId = await createAuthUser(other);

    const firstId = await insertUnreadNotification(userId, '/notifications');
    const secondId = await insertUnreadNotification(userId, '/notifications');
    const otherId = await insertUnreadNotification(otherUserId, '/notifications');

    await login(page, user);

    const singleResult = await page.evaluate(async (notificationId) => {
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      return {
        status: response.status,
        body: await response.json(),
      };
    }, firstId);

    expect(singleResult.status).toBe(200);
    expect(singleResult.body.success).toBe(true);
    expect(singleResult.body.markedIds).toContain(firstId);

    const supabase = getAdminClient();
    const { data: singleRows, error: singleRowsError } = await supabase
      .from('notifications')
      .select('id, is_read')
      .in('id', [firstId, secondId, otherId]);

    if (singleRowsError) throw singleRowsError;

    const singleMap = new Map((singleRows || []).map((row) => [Number(row.id), Boolean(row.is_read)]));
    expect(singleMap.get(firstId)).toBe(true);
    expect(singleMap.get(secondId)).toBe(false);
    expect(singleMap.get(otherId)).toBe(false);

    const allResult = await page.evaluate(async () => {
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      return {
        status: response.status,
        body: await response.json(),
      };
    });

    expect(allResult.status).toBe(200);
    expect(allResult.body.success).toBe(true);

    const { data: allRows, error: allRowsError } = await supabase
      .from('notifications')
      .select('id, is_read')
      .in('id', [firstId, secondId, otherId]);

    if (allRowsError) throw allRowsError;

    const allMap = new Map((allRows || []).map((row) => [Number(row.id), Boolean(row.is_read)]));
    expect(allMap.get(firstId)).toBe(true);
    expect(allMap.get(secondId)).toBe(true);
    expect(allMap.get(otherId)).toBe(false);
  });
});
