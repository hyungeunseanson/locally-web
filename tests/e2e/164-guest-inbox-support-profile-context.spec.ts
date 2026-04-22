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
const SUPPORT_TITLE_REGEX = /1:1 문의 \(고객센터\)|Support Chat|1:1 お問い合わせ|1:1 咨询/;
const SUPPORT_NAME_REGEX = /로컬리 고객센터|Locally Support|Locallyサポート|Locally 客服/;

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdApplicationIds: number[] = [];
const createdExperienceIds: number[] = [];
const createdInquiryIds: number[] = [];
const createdInquiryMessageIds: number[] = [];

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
    email: `codex.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

async function waitForProfile(userId: string) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 12; attempt += 1) {
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
      instagram: '@codex_support_profile',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '게스트 문의함 support/general 분기 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '게스트 문의함 UI 검증',
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
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title: `[Playwright] Support Context ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '게스트 문의함 support/general UI 검증용 체험입니다.',
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
      status: 'approved',
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
    throw error || new Error('Failed to create experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function seedGeneralInquiry(params: {
  guestId: string;
  hostId: string;
  experienceId: number;
  message: string;
}) {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { data: inquiry, error: inquiryError } = await supabase
    .from('inquiries')
    .insert({
      user_id: params.guestId,
      host_id: params.hostId,
      experience_id: String(params.experienceId),
      type: 'general',
      content: params.message,
      updated_at: now,
    })
    .select('id')
    .single();

  if (inquiryError || !inquiry?.id) {
    throw inquiryError || new Error('Failed to create general inquiry.');
  }

  createdInquiryIds.push(Number(inquiry.id));

  const { data: insertedMessage, error: messageError } = await supabase
    .from('inquiry_messages')
    .insert({
      inquiry_id: inquiry.id,
      sender_id: params.hostId,
      content: params.message,
      type: 'text',
      is_read: false,
    })
    .select('id')
    .single();

  if (messageError || !insertedMessage?.id) {
    throw messageError || new Error('Failed to create general inquiry message.');
  }

  createdInquiryMessageIds.push(Number(insertedMessage.id));
  return Number(inquiry.id);
}

async function seedAdminSupportInquiry(params: {
  guestId: string;
  adminId: string;
  guestMessage: string;
  adminReply: string;
}) {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { data: inquiry, error: inquiryError } = await supabase
    .from('inquiries')
    .insert({
      user_id: params.guestId,
      host_id: null,
      type: 'admin_support',
      status: 'open',
      content: params.adminReply,
      updated_at: now,
    })
    .select('id')
    .single();

  if (inquiryError || !inquiry?.id) {
    throw inquiryError || new Error('Failed to create admin support inquiry.');
  }

  createdInquiryIds.push(Number(inquiry.id));

  const { data: guestMessageRow, error: guestMessageError } = await supabase
    .from('inquiry_messages')
    .insert({
      inquiry_id: inquiry.id,
      sender_id: params.guestId,
      content: params.guestMessage,
      type: 'text',
      is_read: false,
    })
    .select('id')
    .single();

  if (guestMessageError || !guestMessageRow?.id) {
    throw guestMessageError || new Error('Failed to create guest support message.');
  }

  createdInquiryMessageIds.push(Number(guestMessageRow.id));

  const { data: adminReplyRow, error: adminReplyError } = await supabase
    .from('inquiry_messages')
    .insert({
      inquiry_id: inquiry.id,
      sender_id: params.adminId,
      content: params.adminReply,
      type: 'text',
      is_read: false,
    })
    .select('id')
    .single();

  if (adminReplyError || !adminReplyRow?.id) {
    throw adminReplyError || new Error('Failed to create admin reply message.');
  }

  createdInquiryMessageIds.push(Number(adminReplyRow.id));
  return Number(inquiry.id);
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 15000,
      waitUntil: 'commit',
    }),
    page.locator('button[type="submit"]').click(),
  ]);
  await page.waitForLoadState('networkidle');
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdInquiryMessageIds.length > 0) {
    await supabase.from('inquiry_messages').delete().in('id', createdInquiryMessageIds);
  }

  if (createdInquiryIds.length > 0) {
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

test.describe.serial('Guest inbox support profile context', () => {
  test('keeps guest inbox host affordances non-profiled for both support and general threads', async ({ page }) => {
    test.setTimeout(90000);

    const guest = createUser('guest.support.context');
    const host = createUser('host.support.context');
    const admin = createUser('admin.support.context');

    const guestId = await createAuthUser(guest);
    const hostId = await createAuthUser(host);
    const adminId = await createAuthUser(admin);

    await createApprovedHostApplication(hostId, host);
    const experienceId = await createExperienceFixture(hostId);

    const generalInquiryId = await seedGeneralInquiry({
      guestId,
      hostId,
      experienceId,
      message: `일반 문의에 대한 호스트 답변 ${Date.now()}`,
    });
    const supportInquiryId = await seedAdminSupportInquiry({
      guestId,
      adminId,
      guestMessage: `고객센터 문의 ${Date.now()}`,
      adminReply: `고객센터 답변 ${Date.now()}`,
    });

    await login(page, guest);

    await page.goto(`/guest/inbox?inquiryId=${supportInquiryId}`, { waitUntil: 'networkidle' });
    await expect(page.getByText(SUPPORT_TITLE_REGEX).last()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(SUPPORT_NAME_REGEX).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId('guest-inbox-header-profile-trigger').click();
    await expect(page.getByText('About Me')).toHaveCount(0);

    const supportMessageTrigger = page.locator('[data-testid^="guest-inbox-message-sender-trigger-"]').first();
    await supportMessageTrigger.click();
    await expect(page.getByText('About Me')).toHaveCount(0);

    await page.goto(`/guest/inbox?inquiryId=${generalInquiryId}`, { waitUntil: 'networkidle' });
    await expect(page.getByText(host.fullName).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId('guest-inbox-header-profile-trigger').click();
    await expect(page.getByText('About Me')).toHaveCount(0);

    const generalMessageTrigger = page.locator('[data-testid^="guest-inbox-message-sender-trigger-"]').first();
    await generalMessageTrigger.click();
    await expect(page.getByText('About Me')).toHaveCount(0);
  });
});
