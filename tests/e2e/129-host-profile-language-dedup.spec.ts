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

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.host.profile.lang.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Profile Lang ${prefix} ${timestamp}`,
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
      bio: '호스트 언어 중복 회귀 검증용 소개입니다.',
      introduction: 'host profile language dedup validation',
      phone: user.phone,
      job: 'Neighborhood Guide',
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  return data.user.id;
}

async function createHostApplication(userId: string, user: TestUser) {
  const { data, error } = await getAdminClient()
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['영어'],
      language_levels: [{ language: '영어', level: 4 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1990-01-01',
      email: user.email,
      instagram: '@codex_host_profile_lang',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '호스트 언어 중복 회귀 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '호스트 언어 중복 회귀 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(String(data.id));
}

async function createActiveExperience(hostId: string) {
  const title = `[Playwright] Host Profile Language Dedup ${Date.now()}`;
  const { data, error } = await getAdminClient()
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title,
      category: '맛집 탐방',
      languages: ['영어'],
      language_levels: [{ language: '영어', level: 4 }],
      duration: 2,
      max_guests: 4,
      description: '호스트 언어 중복 회귀 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '호스트 언어 중복 회귀 검증 동선' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 49000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'active',
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
    throw error || new Error('Failed to create active experience.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const applicationId of createdApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Host profile language dedup', () => {
  test('preselects canonical language chips and saves deduped profile languages', async ({ page }) => {
    test.setTimeout(90000);

    const user = createUser('dashboard');
    const userId = await createAuthUser(user);
    await createHostApplication(userId, user);

    const supabase = getAdminClient();
    const { error: seedError } = await supabase
      .from('profiles')
      .update({ languages: ['영어'] })
      .eq('id', userId);

    if (seedError) throw seedError;

    await login(page, user);
    await page.goto('/host/dashboard?tab=profile', { waitUntil: 'networkidle' });

    await expect(page.getByText('locally.partners@gmail.com')).toBeVisible({ timeout: 15000 });

    const englishChip = page.getByRole('button', { name: 'English' }).first();
    await expect(englishChip).toBeVisible({ timeout: 15000 });
    await expect(englishChip).toHaveClass(/bg-slate-900/);

    await page.getByRole('button', { name: /비공개 정보|Private Info|非公開情報|非公开信息/ }).click();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
    await expect(page.locator('input[name="dob"]')).toBeVisible();
    await expect(page.locator('input[name="bank_name"]')).toBeVisible();
    await page.getByRole('button', { name: /공개 프로필|Public Profile|公開プロフィール|公开资料/ }).click();

    const saveButton = page.getByRole('button', { name: /변경사항 저장하기|Save Changes|保存/ }).last();
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/host/profile') &&
        response.request().method() === 'POST'
    );

    await saveButton.click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status()).toBe(200);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('languages')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;

    expect(profile?.languages).toEqual(['English']);
  });

  test('dedupes aliased host languages in the experience detail host modal', async ({ page }) => {
    test.setTimeout(90000);

    const user = createUser('modal');
    const userId = await createAuthUser(user);
    await createHostApplication(userId, user);
    const experienceId = await createActiveExperience(userId);

    const supabase = getAdminClient();
    const { error: seedError } = await supabase
      .from('profiles')
      .update({ languages: ['영어', 'English'] })
      .eq('id', userId);

    if (seedError) throw seedError;

    await page.goto(`/experiences/${experienceId}`, { waitUntil: 'networkidle' });

    const hostCardButton = page.getByRole('button', { name: new RegExp(user.fullName) }).first();
    await expect(hostCardButton).toBeVisible({ timeout: 15000 });
    await hostCardButton.click();

    await expect(
      page.getByRole('heading', { name: /호스트 소개|Host profile|ホスト紹介|房东介绍/ })
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByText(/구사 언어: 영어|Languages: English|話せる言語: 英語|会说的语言: 英语/)
    ).toBeVisible();
    await expect(page.getByTestId('host-profile-nationality-chip')).toContainText(/한국|Korea|韓国|韩国/);
    await expect(
      page.getByText(/영어, 영어|English, English|英語, 英語|英语, 英语/)
    ).toHaveCount(0);

    await expect(page.getByRole('button', { name: /호스트에게 연락하기|Contact host|ホストに連絡する|联系房东/ })).toBeVisible();

    const fullProfileLink = page.getByTestId('host-profile-full-link');
    await expect(fullProfileLink).toBeVisible();
    await expect(fullProfileLink).toHaveAttribute('href', `/users/${userId}`);
    await fullProfileLink.click();

    await expect(page).toHaveURL(new RegExp(`/users/${userId}$`));
    await expect(page.getByRole('heading', { name: user.fullName, exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('public-host-experiences-section')).toBeVisible();
  });
});
