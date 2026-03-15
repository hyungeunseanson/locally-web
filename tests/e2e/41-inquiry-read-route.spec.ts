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
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.inquiry.read.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Inquiry Read ${prefix} ${timestamp}`,
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
      dob: '1994-03-01',
      email: user.email,
      instagram: '@codex_inquiry_read',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '문의 읽음 route 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '문의 읽음 route 검증',
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
      city: 'Seoul',
      title: `[Playwright] Inquiry Read ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '문의 읽음 route 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '테스트 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
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
      content: '문의 읽음 route 검증용 문의방입니다.',
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
  isRead?: boolean;
  readAt?: string | null;
}) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiry_messages')
    .insert({
      inquiry_id: params.inquiryId,
      sender_id: params.senderId,
      content: params.content,
      type: 'text',
      is_read: params.isRead ?? false,
      read_at: params.readAt ?? null,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create inquiry message fixture.');
  }

  createdMessageIds.push(Number(data.id));
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

  for (const messageId of createdMessageIds) {
    await supabase.from('inquiry_messages').delete().eq('id', messageId);
  }

  for (const inquiryId of createdInquiryIds) {
    await supabase.from('inquiries').delete().eq('id', inquiryId);
  }

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

test.describe.serial('Inquiry read route', () => {
  test('rejects unauthenticated read attempts', async ({ page }) => {
    const response = await page.request.post('/api/inquiries/read', {
      data: { inquiryId: 1 },
    });

    expect(response.status()).toBe(401);
  });

  test('forbids non-participants from marking inquiry messages as read', async ({ page }) => {
    test.setTimeout(90000);

    const host = createUser('host-forbid');
    const guest = createUser('guest-forbid');
    const intruder = createUser('intruder');

    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createAuthUser(intruder);

    await createApprovedHostApplication(hostId, host);
    const experienceId = await createExperienceFixture(hostId);
    const inquiryId = await createInquiry({ guestId, hostId, experienceId });
    await createInquiryMessage({
      inquiryId,
      senderId: guestId,
      content: '권한 없는 사용자가 읽음 처리하면 안 됩니다.',
    });

    await login(page, intruder);

    const response = await page.request.post('/api/inquiries/read', {
      data: { inquiryId },
    });

    expect(response.status()).toBe(403);
  });

  test('marks only counterparty unread messages as read', async ({ page }) => {
    test.setTimeout(90000);

    const host = createUser('host-owner');
    const guest = createUser('guest-owner');

    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);

    await createApprovedHostApplication(hostId, host);
    const experienceId = await createExperienceFixture(hostId);
    const inquiryId = await createInquiry({ guestId, hostId, experienceId });

    const alreadyReadAt = new Date(Date.now() - 60_000).toISOString();
    const unreadGuestMessageId = await createInquiryMessage({
      inquiryId,
      senderId: guestId,
      content: '호스트가 읽어야 하는 메시지입니다.',
    });
    const ownHostMessageId = await createInquiryMessage({
      inquiryId,
      senderId: hostId,
      content: '호스트 본인 메시지는 읽음 처리 대상이 아닙니다.',
    });
    const alreadyReadMessageId = await createInquiryMessage({
      inquiryId,
      senderId: guestId,
      content: '이미 읽음 처리된 메시지입니다.',
      isRead: true,
      readAt: alreadyReadAt,
    });

    await login(page, host);

    const response = await page.request.post('/api/inquiries/read', {
      data: { inquiryId },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      inquiryId,
      markedCount: 1,
    });

    const supabase = getAdminClient();
    const { data: messages, error } = await supabase
      .from('inquiry_messages')
      .select('id, sender_id, is_read, read_at')
      .in('id', [unreadGuestMessageId, ownHostMessageId, alreadyReadMessageId])
      .order('id', { ascending: true });

    if (error) throw error;

    const unreadGuestMessage = messages?.find((message) => Number(message.id) === unreadGuestMessageId);
    const ownHostMessage = messages?.find((message) => Number(message.id) === ownHostMessageId);
    const alreadyReadMessage = messages?.find((message) => Number(message.id) === alreadyReadMessageId);

    expect(unreadGuestMessage).toMatchObject({
      sender_id: guestId,
      is_read: true,
    });
    expect(unreadGuestMessage?.read_at).toBeTruthy();

    expect(ownHostMessage).toMatchObject({
      sender_id: hostId,
      is_read: false,
      read_at: null,
    });

    expect(alreadyReadMessage).toMatchObject({
      sender_id: guestId,
      is_read: true,
    });
    expect(new Date(String(alreadyReadMessage?.read_at)).toISOString()).toBe(
      new Date(alreadyReadAt).toISOString()
    );
  });
});
