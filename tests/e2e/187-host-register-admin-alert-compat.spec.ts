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
const ADMIN_ALERT_TITLE = '새 호스트 신청이 접수되었습니다';
const ADMIN_ALERT_LINK = '/admin/dashboard?tab=APPROVALS';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdApplicationIds: string[] = [];
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
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.host.register.alert.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Register Alert ${prefix} ${timestamp}`,
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

async function createAuthUser(user: TestUser, options?: { role?: 'guest' | 'admin'; whitelistAdmin?: boolean }) {
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

  const role = options?.role || 'guest';
  const { error: userRowError } = await supabase
    .from('users')
    .upsert(
      {
        id: data.user.id,
        email: user.email,
        role,
      },
      { onConflict: 'id' }
    );

  if (userRowError) throw userRowError;

  if (options?.whitelistAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
    createdWhitelistEmails.push(user.email);
  }

  return data.user.id;
}

async function createPendingHostApplication(userId: string, user: TestUser) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: 'Korea',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1990.01.01',
      email: user.email,
      instagram: '@codex_host_register_alert',
      source: 'playwright',
      language_cert: 'TOPIK 6',
      profile_photo: 'https://example.com/profile.png',
      self_intro: 'legacy admin-alert compatibility route의 dedupe 동작을 검증하기 위한 테스트 지원서입니다. 충분한 길이의 소개문을 포함합니다.',
      id_card_file: 'id_card/compat-alert.png',
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: 'stale client compatibility shim이 같은 admin alert를 반복 적재하지 않는지 확인하기 위한 테스트 지원 동기입니다.',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create pending host application.');
  }

  createdApplicationIds.push(String(data.id));
  return String(data.id);
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function waitForAdminAlertNotification(adminUserId: string, applicantName: string, expectedCount: number) {
  const supabase = getAdminClient();
  const message = `${applicantName}님의 호스트 신청이 접수되었습니다.`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', adminUserId)
      .eq('type', 'admin_alert')
      .eq('title', ADMIN_ALERT_TITLE)
      .eq('message', message)
      .eq('link', ADMIN_ALERT_LINK);

    if (error) throw error;

    const notifications = data || [];
    if (notifications.length === expectedCount) {
      notifications.forEach((notification) => {
        const notificationId = Number(notification.id);
        if (!createdNotificationIds.includes(notificationId)) {
          createdNotificationIds.push(notificationId);
        }
      });
      return notifications.length;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Admin alert count for ${applicantName} did not reach ${expectedCount}.`);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  if (createdWhitelistEmails.length > 0) {
    await supabase.from('admin_whitelist').delete().in('email', createdWhitelistEmails);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test('legacy host register admin-alert shim dedupes recent matching alerts', async ({ page }) => {
  test.setTimeout(90000);

  const adminUser = createUser('admin');
  const applicantUser = createUser('applicant');
  const adminUserId = await createAuthUser(adminUser, { role: 'admin', whitelistAdmin: true });
  const applicantUserId = await createAuthUser(applicantUser);
  await createPendingHostApplication(applicantUserId, applicantUser);

  await login(page, applicantUser);

  const firstResponse = await page.request.post('/api/host/register/admin-alert');
  expect(firstResponse.status()).toBe(200);
  await expect(firstResponse.json()).resolves.toMatchObject({ success: true });
  expect(await waitForAdminAlertNotification(adminUserId, applicantUser.fullName, 1)).toBe(1);

  const secondResponse = await page.request.post('/api/host/register/admin-alert');
  expect(secondResponse.status()).toBe(200);
  await expect(secondResponse.json()).resolves.toMatchObject({
    success: true,
    skipped: true,
    deduped: true,
  });

  expect(await waitForAdminAlertNotification(adminUserId, applicantUser.fullName, 1)).toBe(1);
});
