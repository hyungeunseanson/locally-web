import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Locator, type Page } from '@playwright/test';

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
const createdExperienceIds: number[] = [];
const createdApplicationIds: number[] = [];

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
    email: `codex.host.edit-dates.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Edit Dates ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
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
      dob: '1993-05-01',
      email: user.email,
      instagram: '@codex_host_test',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '호스트 수정/일정 관리 UI 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: 'UI 보호막 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(Number(data.id));
  return Number(data.id);
}

async function createExperienceFixture(hostId: string) {
  const supabase = getAdminClient();
  const title = `[Playwright] Host Edit Dates ${Date.now()}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '호스트 수정/일정 관리 UI 검증용 체험입니다. 저장 route와 대시보드 이동이 실제로 이어지는지 확인합니다.',
      itinerary: [{ title: '홍대입구역', description: '테스트 코스입니다.' }],
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
        refund_policy: 'fixed',
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
    .select('id,title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    title: String(data.title),
  };
}

async function seedAvailability(experienceId: number, date: string) {
  const supabase = getAdminClient();
  const { error } = await supabase.from('experience_availability').insert([
    { experience_id: experienceId, date, start_time: '10:00', is_booked: false },
    { experience_id: experienceId, date, start_time: '11:00', is_booked: false },
  ]);

  if (error) throw error;
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });

  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function openExperienceTab(page: Page, experienceId: number) {
  await page.goto('/host/dashboard?tab=experiences', { waitUntil: 'networkidle' });
  await expect(page.locator(`a[href="/host/experiences/${experienceId}/edit"]:visible`).first()).toBeVisible({ timeout: 15000 });
}

function titleInput(page: Page) {
  return page.locator(
    'input[placeholder="체험 제목을 입력하세요"], input[placeholder="Enter experience title"], input[placeholder="体験タイトルを入力してください"], input[placeholder="请输入体验标题"]'
  ).first();
}

function saveButton(page: Page) {
  return page.getByRole('button', { name: /저장하기|Save|保存する|保存/ }).first();
}

function saveChangesButton(page: Page) {
  return page.getByRole('button', { name: /변경사항 저장|Save Changes|変更を保存|保存更改/ }).first();
}

function confirmButton(page: Page) {
  return page.getByRole('button', { name: /확인|Confirm|確認|确认/ }).first();
}

async function maybeAdvanceCalendar(page: Page, targetDate: Date) {
  const now = new Date();
  if (
    targetDate.getFullYear() !== now.getFullYear() ||
    targetDate.getMonth() !== now.getMonth()
  ) {
    const nextMonthButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') }).first();
    await nextMonthButton.click();
  }
}

function dayCell(page: Page, dayNumber: number): Locator {
  return page
    .locator('div.cursor-pointer')
    .filter({ has: page.locator(`span:text-is("${String(dayNumber)}")`) })
    .first();
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

test.describe.serial('Host dashboard edit and dates UI coverage', () => {
  test('edits an experience from the host dashboard experiences tab', async ({ page }) => {
    test.setTimeout(120000);

    const hostUser = createUser('edit');
    const hostId = await createAuthUser(hostUser);
    await createApprovedHostApplication(hostId, hostUser);
    const experience = await createExperienceFixture(hostId);
    const nextTitle = `${experience.title} Updated`;

    await login(page, hostUser);
    await openExperienceTab(page, experience.id);

    await page.locator(`a[href="/host/experiences/${experience.id}/edit"]:visible`).first().click();
    await page.waitForURL(new RegExp(`/host/experiences/${experience.id}/edit`), { timeout: 15000 });
    await expect(titleInput(page)).toHaveValue(experience.title);

    await titleInput(page).fill(nextTitle);

    const updateResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/host/experiences/${experience.id}`) &&
        response.request().method() === 'PATCH' &&
        response.status() === 200,
      { timeout: 15000 }
    );

    await saveButton(page).click();
    await updateResponsePromise;

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('experiences')
      .select('title')
      .eq('id', experience.id)
      .single();

    if (error) throw error;

    expect(data.title).toBe(nextTitle);
  });

  test('updates schedule availability from the host dashboard experiences tab', async ({ page }) => {
    test.setTimeout(120000);

    const hostUser = createUser('dates');
    const hostId = await createAuthUser(hostUser);
    await createApprovedHostApplication(hostId, hostUser);
    const experience = await createExperienceFixture(hostId);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const targetDateString = formatDate(targetDate);

    await seedAvailability(experience.id, targetDateString);

    await login(page, hostUser);
    await openExperienceTab(page, experience.id);

    await page.locator(`a[href="/host/experiences/${experience.id}/dates"]:visible`).first().click();
    await page.waitForURL(new RegExp(`/host/experiences/${experience.id}/dates`), { timeout: 15000 });

    await maybeAdvanceCalendar(page, targetDate);
    await dayCell(page, targetDate.getDate()).click();
    await expect(page.getByText(targetDateString)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: '12:00' }).first().click();

    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/host/experiences/${experience.id}/availability`) &&
        response.request().method() === 'POST' &&
        response.status() === 200,
      { timeout: 15000 }
    );

    await saveChangesButton(page).click();
    await confirmButton(page).click();
    await saveResponsePromise;

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('experience_availability')
      .select('date,start_time')
      .eq('experience_id', experience.id)
      .eq('date', targetDateString)
      .eq('start_time', '12:00')
      .maybeSingle();

    if (error) throw error;

    expect(data).toMatchObject({
      date: targetDateString,
      start_time: '12:00',
    });
  });
});
