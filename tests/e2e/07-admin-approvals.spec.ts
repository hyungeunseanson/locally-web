import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

const TEST_PASSWORD = 'LocallyTest!2026';
const HOST_PROFILE_PHOTO_URL = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=512';
const EXPERIENCE_PHOTO_URL = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdHostApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];
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

function createAdminUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.approvals.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Approvals Admin ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createApplicantUser(prefix: 'host' | 'applicant' = 'applicant'): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.approvals.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Approvals ${prefix === 'host' ? 'Host' : 'Applicant'} ${timestamp}`,
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

async function createHostApplication(
  userId: string,
  user: TestUser,
  status: 'pending' | 'approved' | 'rejected' | 'revision' = 'pending',
  options?: {
    createdAt?: string;
    name?: string;
  }
) {
  const supabase = getAdminClient();
  const applicantName = options?.name || user.fullName;
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      created_at: options?.createdAt,
      host_nationality: 'Korea',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: applicantName,
      phone: user.phone,
      dob: '1990.01.01',
      email: user.email,
      instagram: `@${applicantName.replace(/\s+/g, '').toLowerCase()}`,
      source: 'E2E approvals test',
      language_cert: 'TOPIK 6',
      profile_photo: HOST_PROFILE_PHOTO_URL,
      self_intro: '승인 관리 E2E 테스트용 호스트 지원서입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: applicantName,
      motivation: '관리자 승인 관리 테스트를 위한 지원서입니다.',
      status,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host application.');
  }

  createdHostApplicationIds.push(data.id);

  if (status === 'approved') {
    const { error: roleError } = await supabase
      .from('users')
      .update({ role: 'host' })
      .eq('id', userId);

    if (roleError) {
      console.warn('Approved host fixture could not update users.role:', roleError.message);
    }
  }

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
      description: '승인 관리 E2E 테스트용 체험 설명입니다. 호스트 재제출과 관리자 승인 흐름을 안정적으로 검증하기 위한 충분히 긴 소개 문구입니다.',
      itinerary: [{ title: '홍대입구역', description: '테스트 동선입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
      location: '서울 마포구 양화로 160',
      photos: [EXPERIENCE_PHOTO_URL],
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
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const { data, error } = await supabase
      .from('host_applications')
      .select('status, admin_comment')
      .eq('id', applicationId)
      .maybeSingle();

    if (error) throw error;
    if (data?.status === expectedStatus && (!expectedComment || data.admin_comment === expectedComment)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Host application ${applicationId} did not reach ${expectedStatus}.`);
}

async function assertExperienceStatus(experienceId: number, expectedStatus: string, expectedComment?: string) {
  const supabase = getAdminClient();
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const { data, error } = await supabase
      .from('experiences')
      .select('status, admin_comment')
      .eq('id', experienceId)
      .maybeSingle();

    if (error) throw error;
    if (data?.status === expectedStatus && (!expectedComment || data.admin_comment === expectedComment)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Experience ${experienceId} did not reach ${expectedStatus}.`);
}

async function waitForNotification(params: {
  userId: string;
  type: string;
  link: string;
}) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, link')
      .eq('user_id', params.userId)
      .eq('type', params.type)
      .eq('link', params.link)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data?.id) {
      createdNotificationIds.push(Number(data.id));
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Notification ${params.type} for ${params.userId} was not created.`);
}

async function openApprovals(page: Page) {
  await page.goto('/admin/dashboard?tab=APPROVALS', { waitUntil: 'networkidle' });
}

async function openApprovalsExperienceSubtab(page: Page) {
  await page.getByRole('button', { name: /체험 등록/ }).click();
}

async function updateExperienceTitleAndSave(page: Page, nextTitle: string) {
  const titleInput = page.locator('input:not([type="file"])').first();
  await expect(titleInput).toBeVisible({ timeout: 15000 });
  await titleInput.fill(nextTitle);

  const saveButton = page.getByRole('button', { name: /저장하기|Save|保存する|保存/ }).first();
  await expect(saveButton).toBeVisible({ timeout: 15000 });
  await saveButton.click();
}

async function expectDirectImageSrc(locator: Locator, expectedPattern: RegExp) {
  await expect(locator).toHaveAttribute('src', expectedPattern, { timeout: 15000 });
  const src = await locator.getAttribute('src');
  expect(src).not.toContain('/_next/image');
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

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
  test('blocks status changes for non-latest host application rows', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    const applicantUser = createApplicantUser('applicant');
    const adminUserId = await createAuthUser(adminUser, true);
    expect(adminUserId).toBeTruthy();
    const applicantUserId = await createAuthUser(applicantUser);
    const timestamp = Date.now();
    const oldApplicationName = `Approvals Stale Application ${timestamp}`;
    const latestApplicationName = `Approvals Latest Application ${timestamp}`;
    const oldApplicationId = await createHostApplication(applicantUserId, applicantUser, 'approved', {
      createdAt: new Date(timestamp - 60_000).toISOString(),
      name: oldApplicationName,
    });
    const latestApplicationId = await createHostApplication(applicantUserId, applicantUser, 'pending', {
      createdAt: new Date(timestamp).toISOString(),
      name: latestApplicationName,
    });
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    try {
      await login(adminPage, adminUser);

      const oldDetailResponse = await adminPage.request.get(`/api/admin/host-applications?id=${oldApplicationId}`);
      expect(oldDetailResponse.ok()).toBeTruthy();
      await expect(oldDetailResponse.json()).resolves.toMatchObject({
        data: {
          id: oldApplicationId,
          is_latest_for_user: false,
        },
      });

      const latestDetailResponse = await adminPage.request.get(`/api/admin/host-applications?id=${latestApplicationId}`);
      expect(latestDetailResponse.ok()).toBeTruthy();
      await expect(latestDetailResponse.json()).resolves.toMatchObject({
        data: {
          id: latestApplicationId,
          is_latest_for_user: true,
        },
      });

      const listResponse = await adminPage.request.get('/api/admin/host-applications');
      expect(listResponse.ok()).toBeTruthy();
      const listPayload = await listResponse.json();
      const listRows = Array.isArray(listPayload?.data) ? listPayload.data : [];
      expect(listRows.find((row: { id?: string }) => row.id === oldApplicationId)).toMatchObject({
        is_latest_for_user: false,
      });
      expect(listRows.find((row: { id?: string }) => row.id === latestApplicationId)).toMatchObject({
        is_latest_for_user: true,
      });

      await openApprovals(adminPage);
      await adminPage.getByRole('button', { name: 'ALL' }).click();

      const oldListItem = adminPage.locator('div.cursor-pointer').filter({ hasText: oldApplicationName }).first();
      await expect(oldListItem).toBeVisible({ timeout: 15000 });
      await oldListItem.click();

      await expect(adminPage.getByText('공개 노출은 최신 지원서 기준입니다. 이전 지원서는 상태를 변경할 수 없습니다.')).toBeVisible({
        timeout: 15000,
      });
      const staleRevisionButton = adminPage.getByRole('button', { name: '보완 요청' }).first();
      const staleRejectButton = adminPage.getByRole('button', { name: '거절' }).first();
      const staleApproveButton = adminPage.getByRole('button', { name: /승인 \(호스트 권한 부여\)/ }).first();
      await expect(staleRevisionButton).toBeDisabled();
      await expect(staleRejectButton).toBeDisabled();
      await expect(staleApproveButton).toBeDisabled();
      await assertHostApplicationStatus(oldApplicationId, 'approved');
    } finally {
      await adminContext.close();
    }
  });

  test('handles host application revision, experience revision, host resubmission, and experience approval', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120000);

    const adminUser = createAdminUser();
    const applicantUser = createApplicantUser('applicant');
    const hostUser = createApplicantUser('host');

    await createAuthUser(adminUser, true);
    const applicantUserId = await createAuthUser(applicantUser);
    const hostUserId = await createAuthUser(hostUser);

    const hostApplicationId = await createHostApplication(applicantUserId, applicantUser, 'pending');
    await createHostApplication(hostUserId, hostUser, 'approved');
    const experience = await createPendingExperience(hostUserId);

    const hostRevisionReason = `Host application revision ${Date.now()}`;
    const experienceRevisionReason = `Experience revision ${Date.now()}`;
    const resubmittedTitle = `${experience.title} Resubmitted`;
    let revisionNotificationTitle = '';
    let approvedNotificationTitle = '';

    const adminContext = await browser.newContext();
    const hostContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const hostPage = await hostContext.newPage();

    try {
      await login(adminPage, adminUser);
      await openApprovals(adminPage);

      const experienceListResponse = await adminPage.request.get('/api/admin/experiences');
      expect(experienceListResponse.ok()).toBeTruthy();
      const experienceListPayload = await experienceListResponse.json();
      const summaryExperience = Array.isArray(experienceListPayload?.data)
        ? experienceListPayload.data.find((row: { id?: number | string }) => Number(row.id) === experience.id)
        : null;

      expect(summaryExperience).toBeTruthy();
      expect(summaryExperience).not.toHaveProperty('description');
      expect(summaryExperience).not.toHaveProperty('meeting_point');
      expect(summaryExperience).not.toHaveProperty('location');

      const experienceDetailResponse = await adminPage.request.get(`/api/admin/experiences?id=${experience.id}`);
      expect(experienceDetailResponse.ok()).toBeTruthy();
      const experienceDetailPayload = await experienceDetailResponse.json();
      expect(experienceDetailPayload?.data?.description).toContain('승인 관리 E2E 테스트용 체험 설명입니다.');
      expect(experienceDetailPayload?.data?.meeting_point).toBe('홍대입구역 1번 출구');

      await test.step('Request revision for a pending host application and close the details panel', async () => {
        const hostListItem = adminPage.locator('div.cursor-pointer').filter({ hasText: applicantUser.fullName }).first();
        await expect(hostListItem).toBeVisible({ timeout: 15000 });
        await expectDirectImageSrc(hostListItem.locator('img').first(), /images\.unsplash\.com/);
        await hostListItem.click();

        const hostApproveButton = adminPage.getByRole('button', { name: /승인 \(호스트 권한 부여\)/ });
        await expect(hostApproveButton).toBeVisible({ timeout: 15000 });
        await expectDirectImageSrc(adminPage.getByAltText('Host application profile photo'), /images\.unsplash\.com/);

        await adminPage.getByRole('button', { name: '보완 요청' }).click();
        await expect(adminPage.locator('h4', { hasText: '보완 사유 입력' }).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });
        await adminPage.locator('textarea[placeholder*="사유를 입력해주세요"]').filter({ visible: true }).first().fill(hostRevisionReason);
        await adminPage.getByRole('button', { name: '보완 요청 전송' }).filter({ visible: true }).first().click();

        await assertHostApplicationStatus(hostApplicationId, 'revision', hostRevisionReason);
        await expect(hostApproveButton).not.toBeVisible({ timeout: 15000 });
        await adminPage.getByRole('button', { name: 'PENDING' }).click();
        await expect(adminPage.locator('div.cursor-pointer').filter({ hasText: applicantUser.fullName }).first()).toBeVisible({ timeout: 15000 });
        await adminPage.getByRole('button', { name: 'ALL' }).click();
      });

      await test.step('Request revision for a pending experience, persist admin_comment, and clear stale selection', async () => {
        await openApprovalsExperienceSubtab(adminPage);

        const expListItem = adminPage.locator('div.cursor-pointer').filter({ hasText: experience.title }).first();
        await expect(expListItem).toBeVisible({ timeout: 15000 });
        await expectDirectImageSrc(expListItem.locator('img').first(), /images\.unsplash\.com/);
        await expListItem.click();

        const experienceApproveButton = adminPage.locator('button').filter({ hasText: /^승인$/ }).first();
        await expect(experienceApproveButton).toBeVisible({ timeout: 15000 });
        await expectDirectImageSrc(adminPage.locator('img[alt$="photo 1"]').first(), /images\.unsplash\.com/);

        await adminPage.getByRole('button', { name: '보완 요청' }).click();
        await expect(adminPage.locator('h4', { hasText: '보완 사유 입력' }).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });
        await adminPage.locator('textarea[placeholder*="사유를 입력해주세요"]').filter({ visible: true }).first().fill(experienceRevisionReason);
        await adminPage.getByRole('button', { name: '보완 요청 전송' }).filter({ visible: true }).first().click();

        await assertExperienceStatus(experience.id, 'revision', experienceRevisionReason);
        const revisionNotification = await waitForNotification({
          userId: hostUserId,
          type: 'experience_revision_requested',
          link: `/host/experiences/${experience.id}/edit`,
        });
        revisionNotificationTitle = revisionNotification.title;
        expect(revisionNotification.message).toContain(experienceRevisionReason);
        await expect(experienceApproveButton).not.toBeVisible({ timeout: 15000 });
        await adminPage.getByRole('button', { name: 'PENDING' }).click();
        await expect(adminPage.locator('div.cursor-pointer').filter({ hasText: experience.title }).first()).toBeVisible({ timeout: 15000 });
        await adminPage.getByRole('button', { name: 'ALL' }).click();
      });

      await test.step('Host sees the revision comment and resubmits the experience back to pending', async () => {
        await login(hostPage, hostUser);
        await hostPage.goto('/host/dashboard?tab=experiences', { waitUntil: 'networkidle' });

        await expect(hostPage.getByText(experienceRevisionReason)).toBeVisible({ timeout: 15000 });
        await hostPage.goto('/host/notifications', { waitUntil: 'networkidle' });
        await expect(hostPage.getByText(revisionNotificationTitle).first()).toBeVisible({ timeout: 15000 });
        await hostPage.getByText(revisionNotificationTitle).first().click();
        await hostPage.waitForURL(new RegExp(`/host/experiences/${experience.id}/edit$`), { timeout: 15000 });
        await updateExperienceTitleAndSave(hostPage, resubmittedTitle);

        await assertExperienceStatus(experience.id, 'pending');
      });

      await test.step('Admin can approve the resubmitted experience from approvals dashboard', async () => {
        await openApprovals(adminPage);
        await openApprovalsExperienceSubtab(adminPage);

        const expListItem = adminPage.locator('div.cursor-pointer').filter({ hasText: resubmittedTitle }).first();
        await expect(expListItem).toBeVisible({ timeout: 15000 });
        await expListItem.click();

        const experienceApproveButton = adminPage.locator('button').filter({ hasText: /^승인$/ }).first();
        await expect(experienceApproveButton).toBeVisible({ timeout: 15000 });
        await experienceApproveButton.click();

        await expect(adminPage.locator('h4', { hasText: '승인 확인' }).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });
        await adminPage.getByRole('button', { name: '승인 및 권한 부여' }).filter({ visible: true }).first().click();

        await assertExperienceStatus(experience.id, 'active');
        const approvedNotification = await waitForNotification({
          userId: hostUserId,
          type: 'experience_approved',
          link: `/host/experiences/${experience.id}`,
        });
        approvedNotificationTitle = approvedNotification.title;
        expect(approvedNotification.message).toContain(resubmittedTitle);
        await expect(experienceApproveButton).not.toBeVisible({ timeout: 15000 });
      });

      await test.step('Host can open the approved experience from notifications', async () => {
        await hostPage.goto('/host/notifications', { waitUntil: 'networkidle' });
        await expect(hostPage.getByText(approvedNotificationTitle).first()).toBeVisible({ timeout: 15000 });
        await hostPage.getByText(approvedNotificationTitle).first().click();
        await hostPage.waitForURL(new RegExp(`/host/experiences/${experience.id}$`), { timeout: 15000 });
      });
    } finally {
      await adminContext.close();
      await hostContext.close();
    }
  });
});
