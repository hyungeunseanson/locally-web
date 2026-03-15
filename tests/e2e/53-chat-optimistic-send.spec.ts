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
const createdApplicationIds: number[] = [];
const createdExperienceIds: number[] = [];
const createdInquiryIds: number[] = [];
const createdMessageIds: number[] = [];

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
    email: `codex.chat.optimistic.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Chat Optimistic ${prefix} ${timestamp}`,
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
      instagram: '@codex_chat_optimistic',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '채팅 optimistic send 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '채팅 optimistic send 검증',
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
      title: `[Playwright] Chat Optimistic ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '채팅 optimistic send 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '테스트 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 3번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 30000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
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

async function createInquiry(params: {
  guestId: string;
  hostId: string;
  experienceId: number;
}) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiries')
    .insert({
      user_id: params.guestId,
      host_id: params.hostId,
      experience_id: String(params.experienceId),
      content: '기존 문의방입니다.',
      type: 'general',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create inquiry fixture.');
  }

  createdInquiryIds.push(Number(data.id));
  return Number(data.id);
}

async function createInquiryMessage(params: {
  inquiryId: number;
  senderId: string;
  content: string;
}) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiry_messages')
    .insert({
      inquiry_id: params.inquiryId,
      sender_id: params.senderId,
      content: params.content,
      type: 'text',
      is_read: false,
      read_at: null,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create inquiry message fixture.');
  }

  createdMessageIds.push(Number(data.id));
}

async function findInquiryMessage(inquiryId: number, content: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiry_messages')
    .select('id, content')
    .eq('inquiry_id', inquiryId)
    .eq('content', content)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
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

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const messageId of createdMessageIds) {
    await supabase.from('inquiry_messages').delete().eq('id', messageId);
  }

  for (const inquiryId of createdInquiryIds) {
    await supabase.from('inquiries').delete().eq('id', inquiryId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const applicationId of createdApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
});

test('guest inbox appends text messages optimistically before delayed send resolves', async ({ page }) => {
  test.setTimeout(90000);

  const host = createUser('host');
  const guest = createUser('guest');
  const hostId = await createAuthUser(host);
  const guestId = await createAuthUser(guest);
  await createApprovedHostApplication(hostId, host);
  const experienceId = await createExperienceFixture(hostId);
  const inquiryId = await createInquiry({ guestId, hostId, experienceId });
  await createInquiryMessage({
    inquiryId,
    senderId: hostId,
    content: '기존 호스트 메시지',
  });

  await login(page, guest);
  await page.goto(`/guest/inbox?inquiryId=${inquiryId}`, { waitUntil: 'networkidle' });
  await expect(page.getByText('기존 호스트 메시지')).toBeVisible();

  const messageText = `Optimistic guest message ${Date.now()}`;
  let responseResolved = false;

  await page.route('**/api/inquiries/message', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const response = await route.fetch();
    responseResolved = true;
    await route.fulfill({ response });
  });

  await page.getByPlaceholder(/메시지 입력|Type a message|メッセージを入力|输入消息/).fill(messageText);
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-send') }).click();

  await expect(page.getByPlaceholder(/메시지 입력|Type a message|メッセージを入力|输入消息/)).toHaveValue('');
  await page.waitForTimeout(300);
  expect(responseResolved).toBe(false);
  await expect(page.getByText(messageText).first()).toBeVisible({ timeout: 700 });

  await expect.poll(() => responseResolved).toBe(true);
  await expect.poll(async () => {
    const row = await findInquiryMessage(inquiryId, messageText);
    return row?.content || null;
  }).toBe(messageText);
});
