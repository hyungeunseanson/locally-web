import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

const TEST_PASSWORD = 'LocallyTest!2026';
const HOST_PROFILE_PHOTO_URL = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=512';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdHostApplicationIds: string[] = [];
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
    email: `codex.admin.host.approval.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Admin Host Approval ${timestamp}`,
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

async function createAuthUser(user: TestUser, isAdmin = false) {
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

  const { error: userRowError } = await supabase
    .from('users')
    .upsert(
      {
        id: data.user.id,
        email: user.email,
        role: isAdmin ? 'admin' : 'guest',
      },
      { onConflict: 'id' }
    );

  if (userRowError) throw userRowError;

  if (isAdmin) {
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
      instagram: '@codex_admin_host_approval',
      source: 'playwright',
      language_cert: 'TOPIK 6',
      profile_photo: HOST_PROFILE_PHOTO_URL,
      self_intro: '관리자 승인 happy path 검증용 호스트 지원서입니다. 승인 이후 호스트 반영 체인을 테스트하기 위한 충분한 길이의 소개문입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '관리자 승인 happy path 검증을 위한 테스트 지원 동기입니다.',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create pending host application.');
  }

  createdHostApplicationIds.push(String(data.id));
  return String(data.id);
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

async function waitForHostApplicationStatus(applicationId: string, expectedStatus: string) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from('host_applications')
      .select('status')
      .eq('id', applicationId)
      .maybeSingle();

    if (error) throw error;
    if (data?.status === expectedStatus) return;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Host application ${applicationId} did not reach ${expectedStatus}.`);
}

async function waitForUserRole(userId: string, expectedRole: string) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data?.role === expectedRole) return;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`User ${userId} did not reach role ${expectedRole}.`);
}

async function waitForUnreadApprovalNotification(userId: string) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, is_read, link')
      .eq('user_id', userId)
      .eq('type', 'host_application_approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id && data.is_read === false && data.link === '/host/dashboard') {
      createdNotificationIds.push(Number(data.id));
      return Number(data.id);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Unread host approval notification was not created for ${userId}.`);
}

async function waitForNotificationRead(notificationId: number) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from('notifications')
      .select('is_read')
      .eq('id', notificationId)
      .maybeSingle();

    if (error) throw error;
    if (data?.is_read) return;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Notification ${notificationId} was not marked read.`);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  if (createdHostApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdHostApplicationIds);
  }

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test('admin approval grants host role and surfaces the welcome overlay to the applicant', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(120000);

  const adminUser = createUser('admin');
  const applicantUser = createUser('applicant');

  await createAuthUser(adminUser, true);
  const applicantUserId = await createAuthUser(applicantUser);
  const applicationId = await createPendingHostApplication(applicantUserId, applicantUser);

  const adminContext = await browser.newContext();
  const applicantContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const applicantPage = await applicantContext.newPage();

  try {
    await login(adminPage, adminUser);
    await adminPage.goto('/admin/dashboard?tab=APPROVALS', { waitUntil: 'networkidle' });

    const hostListItem = adminPage.locator('div.cursor-pointer').filter({ hasText: applicantUser.fullName }).first();
    await expect(hostListItem).toBeVisible({ timeout: 15000 });
    await hostListItem.click();

    const approveButton = adminPage.getByRole('button', { name: /승인 \(호스트 권한 부여\)/ });
    await expect(approveButton).toBeVisible({ timeout: 15000 });
    await approveButton.click();

    await expect(adminPage.locator('h4', { hasText: '승인 확인' }).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });
    await adminPage.getByRole('button', { name: '승인 및 권한 부여' }).filter({ visible: true }).first().click();

    await waitForHostApplicationStatus(applicationId, 'approved');
    await waitForUserRole(applicantUserId, 'host');
    const notificationId = await waitForUnreadApprovalNotification(applicantUserId);

    await login(applicantPage, applicantUser);
    await applicantPage.goto('/host/dashboard', { waitUntil: 'domcontentloaded' });

    const overlay = applicantPage.getByTestId('host-approval-welcome-overlay');
    await expect(overlay).toBeVisible({ timeout: 15000 });
    await expect(
      overlay.getByText(
        /호스트 승인이 완료되었어요!|Your host approval is complete!|ホスト承認が完了しました！|恭喜，你已通过房东审核！/
      )
    ).toBeVisible();

    await overlay.getByRole('button', { name: /나중에 보기|Maybe later|あとで見る|稍后再说/ }).click();
    await expect(overlay).toBeHidden({ timeout: 15000 });
    await waitForNotificationRead(notificationId);
  } finally {
    await adminContext.close();
    await applicantContext.close();
  }
});
