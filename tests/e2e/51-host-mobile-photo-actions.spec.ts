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
const TEST_IMAGE = 'tests/e2e/test-image.png';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdApplicationIds: number[] = [];
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
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.mobile.photo.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Mobile Photo ${prefix} ${timestamp}`,
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

async function createApprovedHostApplication(userId: string, user: TestUser) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1992-04-12',
      email: user.email,
      instagram: '@codex_mobile_photo',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '모바일 사진 액션 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '모바일 사진 액션 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(Number(data.id));
}

async function createExperienceFixture(hostId: string) {
  const supabase = getAdminClient();
  const title = `[Playwright] Mobile Photo ${Date.now()}`;

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
      description: '모바일 사진 액션 검증용 체험입니다. 수정 화면에서 대표 사진 교체/삭제를 확인합니다.',
      itinerary: [{ title: '홍대입구역', description: '테스트 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 3번 출구',
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
      is_active: false,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create mobile photo experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
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

  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/account/);
}

test.use({ viewport: { width: 390, height: 844 } });

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdExperienceIds.length > 0) {
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
});

test('mobile host create/edit supports hero photo replace and delete actions', async ({ page }) => {
  const host = createUser('host');
  const hostId = await createAuthUser(host);
  await createApprovedHostApplication(hostId, host);
  const experienceId = await createExperienceFixture(hostId);

  await login(page, host);

  await page.goto('/host/create', { waitUntil: 'domcontentloaded' });
  const cityButton = page.locator('button').filter({ hasText: /^Seoul$/ }).first();
  const categoryButton = page.locator('button').filter({ hasText: /^Food Tour$/ }).first();
  const languageButton = page.locator('button').filter({ hasText: /^Korean$/ }).first();

  await expect(cityButton).toBeVisible();

  await cityButton.click();
  await expect(cityButton).toHaveClass(/bg-black/);

  await categoryButton.click();
  await expect(categoryButton).toHaveClass(/border-\[#222\]/);

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: /진행 가능한 언어|Available languages/ })).toBeVisible({ timeout: 10000 });

  await languageButton.click();
  await page.getByRole('button', { name: /Lv\.?5/ }).first().click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await page.locator('input[type="file"][multiple]').setInputFiles(TEST_IMAGE);
  await expect(page.locator('img[alt="preview 0"]')).toBeVisible();

  await page.locator('img[alt="preview 0"]').click();
  await expect(page.getByTestId('host-photo-action-sheet')).toBeVisible();
  await page.getByTestId('host-photo-action-delete').click();
  await expect(page.locator('img[alt="preview 0"]')).toHaveCount(0);

  await page.locator('input[type="file"][multiple]').setInputFiles(TEST_IMAGE);
  const createPreview = page.locator('img[alt="preview 0"]');
  const beforeReplaceSrc = await createPreview.getAttribute('src');

  await createPreview.click();
  await page.getByTestId('host-photo-action-change').click();
  await page.getByTestId('create-replace-photo-input').setInputFiles(TEST_IMAGE);
  await expect.poll(async () => createPreview.getAttribute('src')).not.toBe(beforeReplaceSrc);

  await page.goto(`/host/experiences/${experienceId}/edit`, { waitUntil: 'commit' }).catch(() => {});
  await expect(page).toHaveURL(new RegExp(`/host/experiences/${experienceId}/edit`));
  const editPreview = page.locator('img[alt="experience-0"]');
  await expect(editPreview).toBeVisible();

  const beforeEditReplaceSrc = await editPreview.getAttribute('src');
  await editPreview.click();
  await page.getByTestId('host-photo-action-change').click();
  await page.getByTestId('edit-replace-photo-input').setInputFiles(TEST_IMAGE);
  await expect.poll(async () => editPreview.getAttribute('src')).not.toBe(beforeEditReplaceSrc);

  await editPreview.click();
  await page.getByTestId('host-photo-action-delete').click();
  await expect(page.locator('img[alt="experience-0"]')).toHaveCount(0);
});
