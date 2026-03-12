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
const createdWhitelistEmails: string[] = [];
const createdHostApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];

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

function createAdminUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.approvals.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Approvals Admin ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createApplicantUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.approvals.host.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Approvals Host ${timestamp}`,
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
      instagram: `@${user.fullName.replace(/\s+/g, '').toLowerCase()}`,
      source: 'E2E approvals test',
      language_cert: 'TOPIK 6',
      profile_photo: null,
      self_intro: '승인 관리 E2E 테스트용 호스트 지원서입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '관리자 승인 관리 테스트를 위한 지원서입니다.',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create pending host application.');
  }

  createdHostApplicationIds.push(data.id);
  return data.id;
}

async function createPendingExperience(hostId: string) {
  const supabase = getAdminClient();
  const title = `[Playwright] Admin Approval Experience ${Date.now()}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '승인 관리 E2E 테스트용 체험 설명입니다.',
      itinerary: [{ title: '홍대입구역', description: '테스트 동선입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 50000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'pending',
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id, title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create pending experience.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    title: String(data.title),
  };
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });

  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function assertHostApplicationStatus(applicationId: string, expectedStatus: string, expectedComment?: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .select('status, admin_comment')
    .eq('id', applicationId)
    .maybeSingle();

  if (error) throw error;
  expect(data?.status).toBe(expectedStatus);
  if (expectedComment) {
    expect(data?.admin_comment).toBe(expectedComment);
  }
}

async function assertExperienceStatus(experienceId: number, expectedStatus: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .select('status')
    .eq('id', experienceId)
    .maybeSingle();

  if (error) throw error;
  expect(data?.status).toBe(expectedStatus);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const applicationId of createdHostApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
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

test.describe.serial('Admin approvals smoke', () => {
  test('handles host application revision and experience approval from approvals dashboard', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    const applicantUser = createApplicantUser();

    await createAuthUser(adminUser, true);
    const applicantUserId = await createAuthUser(applicantUser);
    const hostApplicationId = await createPendingHostApplication(applicantUserId, applicantUser);
    const experience = await createPendingExperience(applicantUserId);
    const revisionReason = `E2E revision reason ${Date.now()}`;

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=APPROVALS', { waitUntil: 'networkidle' });

    await test.step('Request revision for a pending host application', async () => {
      const hostListItem = page.locator('div.cursor-pointer').filter({ hasText: applicantUser.fullName }).first();
      await expect(hostListItem).toBeVisible({ timeout: 15000 });
      await hostListItem.click();
      await expect(page.getByRole('button', { name: '보완 요청' })).toBeVisible({ timeout: 15000 });

      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept(revisionReason);
      });

      await page.getByRole('button', { name: '보완 요청' }).click();
      await expect(page.getByText('왼쪽 리스트에서 항목을 선택해주세요.')).toBeVisible({ timeout: 15000 });

      await assertHostApplicationStatus(hostApplicationId, 'revision', revisionReason);
    });

    await test.step('Approve a pending experience from approvals dashboard', async () => {
      await page.getByRole('button', { name: /체험 등록/ }).click();

      const expListItem = page.locator('div.cursor-pointer').filter({ hasText: experience.title }).first();
      await expect(expListItem).toBeVisible({ timeout: 15000 });
      await expListItem.click();
      await expect(page.locator('button').filter({ hasText: /^승인$/ }).first()).toBeVisible({ timeout: 15000 });

      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      await page.locator('button').filter({ hasText: /^승인$/ }).first().click();
      await expect(page.getByText('왼쪽 리스트에서 항목을 선택해주세요.')).toBeVisible({ timeout: 15000 });

      await assertExperienceStatus(experience.id, 'active');
    });
  });
});
