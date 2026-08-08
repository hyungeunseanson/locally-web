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
const SCHEDULE_COMMITMENT_TEXT =
  /열어둔 일정은 약속입니다|Open dates are a commitment|公開した日程は約束です|已开放的日期就是承诺/;

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdApplicationIds: number[] = [];
const createdAdminWhitelistEmails: string[] = [];

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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

async function createAuthUser(user: TestUser, options: { isAdmin?: boolean } = {}) {
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

  if (options.isAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
    createdAdminWhitelistEmails.push(user.email);
  }

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
    .select('id,title,duration')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    title: String(data.title),
    duration: Number(data.duration),
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

function descriptionInput(page: Page) {
  return page.locator(
    'textarea[placeholder^="상세 소개글을 입력하세요"], textarea[placeholder^="Enter a detailed description"], textarea[placeholder^="詳細紹介文を入力してください"], textarea[placeholder^="请输入详细介绍"]'
  ).first();
}

async function prepareLocaleRerenderRace(page: Page, experienceId: number) {
  await page.evaluate(() => {
    window.localStorage.setItem('app_lang', 'en');
    document.cookie = 'app_lang=ko; path=/; samesite=lax';
  });

  let matchingReadCount = 0;
  await page.route('**/rest/v1/experiences*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isMatchingRead =
      request.method() === 'GET' &&
      url.searchParams.get('id') === `eq.${experienceId}`;

    if (!isMatchingRead) {
      await route.continue();
      return;
    }

    matchingReadCount += 1;
    if (matchingReadCount === 1) {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ response });
  });
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

function selectedTimeLabel(page: Page, time: string): Locator {
  return page.locator('span').filter({ hasText: time }).first();
}

async function activateTimeOption(page: Page, time: string) {
  const button = page.getByRole('button', { name: time }).first();
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.scrollIntoViewIfNeeded();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await button.click();

    const className = (await button.getAttribute('class')) || '';
    if (className.includes('bg-black')) {
      return button;
    }

    await page.waitForTimeout(250);
  }

  await expect(button).toHaveClass(/bg-black/, { timeout: 10000 });
  return button;
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

  for (const email of createdAdminWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
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
    await prepareLocaleRerenderRace(page, experience.id);

    await page.locator(`a[href="/host/experiences/${experience.id}/edit"]:visible`).first().click();
    await page.waitForURL(new RegExp(`/host/experiences/${experience.id}/edit`), { timeout: 15000 });
    await expect(titleInput(page)).toHaveValue(experience.title);
    await expect(page.getByTestId('host-edit-duration-input')).toHaveValue(String(experience.duration));
    await expect(
      page.getByText(
        /인기 체험 노출은 게스트의 위시리스트 저장 수를 바탕으로 집계됩니다\. 저장하고 싶은 체험이 되도록 사진, 소개, 후기 경험을 꾸준히 관리해보세요\.|Popular experience placement is based on how many times guests save your experience to their wishlist\. Keep improving your photos, description, and review experience so your experience becomes one guests want to save\.|人気体験の表示は、ゲストのウィッシュリスト保存数をもとに集計されます。保存したくなる体験になるよう、写真・紹介文・レビュー体験を継続的に整えてみてください。|热门体验展示会根据游客加入愿望清单的保存数量进行统计。请持续优化照片、介绍和评价体验，让你的体验成为游客愿意先收藏的内容。/
      )
    ).toBeVisible();

    await titleInput(page).fill(nextTitle);
    await page.getByTestId('host-edit-duration-input').fill('4');
    await page.waitForTimeout(1800);
    await expect(titleInput(page)).toHaveValue(nextTitle);
    await expect(page.getByTestId('host-edit-duration-input')).toHaveValue('4');

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
      .select('title, duration')
      .eq('id', experience.id)
      .single();

    if (error) throw error;

    expect(data.title).toBe(nextTitle);
    expect(data.duration).toBe(4);
  });

  test('preserves an admin draft across delayed auth and locale rerenders', async ({ page }) => {
    test.setTimeout(120000);

    const hostUser = createUser('admin-edit-owner');
    const hostId = await createAuthUser(hostUser);
    await createApprovedHostApplication(hostId, hostUser);
    const experience = await createExperienceFixture(hostId);
    const adminUser = createUser('admin-editor');
    await createAuthUser(adminUser, { isAdmin: true });
    const nextTitle = `${experience.title} Admin Updated`;
    const nextDescription = `관리자 편집값 원복 방지 검증 설명 ${Date.now()}입니다. 지연된 조회 이후에도 이 내용이 그대로 유지되어야 합니다.`;
    let patchCount = 0;

    page.on('request', (request) => {
      if (
        request.method() === 'PATCH' &&
        request.url().includes(`/api/host/experiences/${experience.id}`)
      ) {
        patchCount += 1;
      }
    });

    await login(page, adminUser);
    await prepareLocaleRerenderRace(page, experience.id);
    await page.goto(
      `/host/experiences/${experience.id}/edit?returnTo=${encodeURIComponent(`/admin/dashboard?tab=EXPS&experienceId=${experience.id}`)}`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(titleInput(page)).toHaveValue(experience.title, { timeout: 15000 });
    await titleInput(page).fill(nextTitle);
    await page.getByRole('button', { name: /상세 설명|Details|詳細|详情/ }).click();
    await expect(descriptionInput(page)).toBeVisible({ timeout: 10000 });
    await descriptionInput(page).fill(nextDescription);

    await page.waitForTimeout(1800);
    expect(patchCount).toBe(0);
    await expect(descriptionInput(page)).toHaveValue(nextDescription);
    await page.getByRole('button', { name: /기본 정보|Basic|基本|基本信息/ }).click();
    await expect(titleInput(page)).toHaveValue(nextTitle);

    const updateResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/host/experiences/${experience.id}`) &&
        response.request().method() === 'PATCH' &&
        response.status() === 200,
      { timeout: 15000 }
    );

    await saveButton(page).click();
    await updateResponsePromise;
    expect(patchCount).toBe(1);
    await page.waitForTimeout(500);
    await expect(titleInput(page)).toHaveValue(nextTitle);

    const { data, error } = await getAdminClient()
      .from('experiences')
      .select('title,description')
      .eq('id', experience.id)
      .single();

    if (error) throw error;
    expect(data).toMatchObject({
      title: nextTitle,
      description: nextDescription,
    });
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
    await expect(page.getByText(SCHEDULE_COMMITMENT_TEXT)).toBeVisible({ timeout: 10000 });

    await maybeAdvanceCalendar(page, targetDate);
    await dayCell(page, targetDate.getDate()).click();
    await expect(page.getByText(targetDateString)).toBeVisible({ timeout: 10000 });
    await expect(selectedTimeLabel(page, '10:00')).toBeVisible({ timeout: 10000 });
    await expect(selectedTimeLabel(page, '11:00')).toBeVisible({ timeout: 10000 });

    await activateTimeOption(page, '07:00');
    await expect(selectedTimeLabel(page, '07:00')).toBeVisible({ timeout: 10000 });

    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/host/experiences/${experience.id}/availability`) &&
        response.request().method() === 'POST' &&
        response.status() === 200,
      { timeout: 15000 }
    );

    await saveChangesButton(page).click();
    await confirmButton(page).click();
    const saveResponse = await saveResponsePromise;
    const savePayload = saveResponse.request().postDataJSON() as {
      availability?: Record<string, string[]>;
    };

    expect(savePayload.availability?.[targetDateString]).toContain('07:00');

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('experience_availability')
      .select('date,start_time')
      .eq('experience_id', experience.id)
      .eq('date', targetDateString)
      .eq('start_time', '07:00')
      .maybeSingle();

    if (error) throw error;

    expect(data).toMatchObject({
      date: targetDateString,
      start_time: '07:00',
    });
  });

  test('keeps the mobile schedule editor compact while exposing 07:00 slots', async ({ page }) => {
    test.setTimeout(120000);

    const hostUser = createUser('dates-mobile');
    const hostId = await createAuthUser(hostUser);
    await createApprovedHostApplication(hostId, hostUser);
    const experience = await createExperienceFixture(hostId);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const targetDateString = formatDate(targetDate);

    await seedAvailability(experience.id, targetDateString);

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, hostUser);
    await openExperienceTab(page, experience.id);

    await page.locator(`a[href="/host/experiences/${experience.id}/dates"]:visible`).first().click();
    await page.waitForURL(new RegExp(`/host/experiences/${experience.id}/dates`), { timeout: 15000 });
    await expect(page.getByText(SCHEDULE_COMMITMENT_TEXT)).toBeVisible({ timeout: 10000 });

    await maybeAdvanceCalendar(page, targetDate);
    const targetDayCell = dayCell(page, targetDate.getDate());
    await expect(targetDayCell).toBeVisible({ timeout: 10000 });

    const dayCellBox = await targetDayCell.boundingBox();
    expect(dayCellBox).not.toBeNull();
    expect(dayCellBox!.height).toBeLessThanOrEqual(70);

    await targetDayCell.click();
    await expect(page.getByText(targetDateString)).toBeVisible({ timeout: 10000 });

    const earlyTimeButton = page.getByRole('button', { name: '07:00' }).first();
    await expect(earlyTimeButton).toBeVisible({ timeout: 10000 });

    const timeButtonBox = await earlyTimeButton.boundingBox();
    expect(timeButtonBox).not.toBeNull();
    expect(timeButtonBox!.height).toBeLessThanOrEqual(38);
  });
});
