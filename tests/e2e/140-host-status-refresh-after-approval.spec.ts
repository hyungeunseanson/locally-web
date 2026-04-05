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
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.host.status.refresh.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Status Refresh ${timestamp}`,
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
  return data.user.id;
}

async function createRevisionHostApplication(userId: string, user: TestUser) {
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
      instagram: '@codex_host_status_refresh',
      source: 'playwright',
      language_cert: 'TOPIK 6',
      profile_photo: '',
      self_intro: '호스트 승인 stale 상태 갱신 검증용 지원서입니다. 충분한 길이의 소개 문장을 포함합니다.',
      id_card_file: '',
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '호스트 승인 stale 상태 갱신 검증을 위한 테스트 지원서입니다.',
      status: 'revision',
      admin_comment: '사진을 조금 더 선명하게 업로드해 주세요.',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create revision host application.');
  }

  createdApplicationIds.push(String(data.id));
  return String(data.id);
}

async function approveHostApplication(applicationId: string, userId: string) {
  const supabase = getAdminClient();

  const { error: applicationError } = await supabase
    .from('host_applications')
    .update({
      status: 'approved',
      admin_comment: null,
    })
    .eq('id', applicationId);

  if (applicationError) throw applicationError;

  const { error: roleError } = await supabase
    .from('users')
    .update({ role: 'host' })
    .eq('id', userId);

  if (roleError) throw roleError;

  const { data: notification, error: notificationError } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'host_application_approved',
      title: '🎉 호스트 승인이 완료되었습니다',
      message: '호스트 신청이 승인되었습니다. 이제 호스트 대시보드와 기능을 이용할 수 있습니다.',
      link: '/host/dashboard',
      is_read: false,
    })
    .select('id')
    .single();

  if (notificationError || !notification?.id) {
    throw notificationError || new Error('Failed to insert approval notification.');
  }

  createdNotificationIds.push(Number(notification.id));
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

  await page.waitForLoadState('networkidle');
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test('refreshes an open host dashboard from revision to approved without a page reload', async ({ page }) => {
  const user = createUser('dashboard');
  const userId = await createAuthUser(user);
  const applicationId = await createRevisionHostApplication(userId, user);

  await login(page, user);
  await page.goto('/host/dashboard', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /보완이 필요합니다|Revision Required|修正が必要です|需要补充信息/ })
  ).toBeVisible({ timeout: 15000 });

  await approveHostApplication(applicationId, userId);

  await expect(page.getByTestId('host-approval-welcome-overlay')).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText(
      /호스트 승인이 완료되었어요!|Your host approval is complete!|ホスト承認が完了しました！|恭喜，你已通过房东审核！/
    )
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole('heading', { name: /보완이 필요합니다|Revision Required|修正が必要です|需要补充信息/ })
  ).toHaveCount(0);
});
