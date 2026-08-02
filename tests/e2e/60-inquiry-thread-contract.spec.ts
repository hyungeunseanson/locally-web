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
const createdInquiryIds: number[] = [];
const createdMessageIds: number[] = [];

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click({ force: true });
    await expect(announcement).toHaveCount(0);
  }
}

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
    email: `codex.inquiry.thread.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Inquiry Thread ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

async function waitForProfile(userId: string) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
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
      instagram: '@codex_inquiry_thread',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '문의방 생성 계약 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '문의방 생성 계약 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(String(data.id));
}

async function createExperienceFixture(hostId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title: `[Playwright] Inquiry Thread ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '문의방 생성 계약 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '테스트 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 3번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 30000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: { age_limit: '만 19세 이상', activity_level: '보통' },
      status: 'active',
      is_active: true,
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
    throw error || new Error('Failed to create inquiry thread experience fixture.');
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

  if (createdMessageIds.length > 0) {
    await supabase.from('inquiry_messages').delete().in('id', createdMessageIds);
  }

  if (createdInquiryIds.length > 0) {
    await supabase
      .from('notifications')
      .delete()
      .eq('type', 'admin_alert')
      .in(
        'link',
        createdInquiryIds.map((inquiryId) => `/admin/dashboard?tab=CHATS&inquiryId=${inquiryId}`)
      );
    await supabase.from('inquiries').delete().in('id', createdInquiryIds);
  }

  if (createdExperienceIds.length > 0) {
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
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

test.describe.serial('Inquiry thread response contract', () => {
  test('returns first-message metadata for fast-path chat creation', async ({ page }) => {
    const guest = createUser('guest');
    const host = createUser('host');
    const guestId = await createAuthUser(guest);
    const hostId = await createAuthUser(host);
    await createApprovedHostApplication(hostId, host);
    const experienceId = await createExperienceFixture(hostId);

    await login(page, guest);

    const message = `첫 문의 fast path ${Date.now()}`;
    const response = await page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'experience_general',
        hostId,
        experienceId: String(experienceId),
        message,
      },
    });

    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json).toMatchObject({
      success: true,
      hostId,
      guestId,
      experienceId: String(experienceId),
      createdThread: true,
      createdMessage: true,
      displayContent: message,
    });
    expect(json.messageId).toBeTruthy();
    expect(json.updatedAt).toBeTruthy();

    createdInquiryIds.push(Number(json.inquiryId));
    createdMessageIds.push(Number(json.messageId));
  });

  test('redirects experience-detail inquiries into the guest inbox thread after submit', async ({ page }) => {
    test.setTimeout(90000);

    const guest = createUser('guest-ui');
    const host = createUser('host-ui');
    await createAuthUser(guest);
    const hostId = await createAuthUser(host);
    await createApprovedHostApplication(hostId, host);
    const experienceId = await createExperienceFixture(hostId);

    await login(page, guest);
    await page.goto(`/experiences/${experienceId}`, { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const inquiryMessage = `체험 상세 문의 UI ${Date.now()}`;
    const hostMessageButton = page.getByTestId('exp-host-message-trigger');
    await hostMessageButton.scrollIntoViewIfNeeded();
    await hostMessageButton.click();

    await page.getByTestId('exp-message-modal-textarea').fill(inquiryMessage);
    await page.getByTestId('exp-message-modal-submit').click();

    await page.waitForURL(/\/guest\/inbox\?inquiryId=\d+/, { timeout: 20000 });

    const inquiryId = new URL(page.url()).searchParams.get('inquiryId');
    expect(inquiryId).toBeTruthy();
    if (inquiryId) {
      createdInquiryIds.push(Number(inquiryId));
    }

    await expect(page.getByTestId('guest-inbox-header-profile-trigger')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(inquiryMessage).last()).toBeVisible({ timeout: 15000 });

    const { data: messageRow, error: messageError } = await getAdminClient()
      .from('inquiry_messages')
      .select('id')
      .eq('inquiry_id', Number(inquiryId))
      .eq('content', inquiryMessage)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (messageError) throw messageError;
    expect(messageRow?.id).toBeTruthy();
    if (messageRow?.id) {
      createdMessageIds.push(Number(messageRow.id));
    }
  });
});
