import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

type SeededChatFixture = {
  admin: TestUser;
  adminId: string;
  guest: TestUser;
  guestId: string;
  host: TestUser;
  hostId: string;
  experienceId: number;
  inquiryId: number;
};

const TEST_PASSWORD = 'LocallyTest!2026';
const GUEST_CHAT_INPUT_SELECTOR = '[data-testid="guest-chat-composer"]';
const HOST_CHAT_INPUT_SELECTOR = '[data-testid="host-chat-composer"]';
const WARNING_BANNER_TEXT =
  /연락처·외부 링크 공유는 제재 대상입니다|Sharing contact details or external links may lead to penalties|連絡先や外部リンクの共有は制裁対象となる場合があります|分享联系方式或外部链接可能会导致处罚/;
const SOFT_DELETE_PLACEHOLDER = '[운영 정책에 의해 삭제된 메시지입니다.]';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdApplicationIds: number[] = [];
const createdExperienceIds: number[] = [];
const createdInquiryIds: number[] = [];
const createdMessageIds: number[] = [];
const auditLogTargetIds: string[] = [];

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
    email: `codex.chat.policy.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Chat Policy ${prefix} ${timestamp}`,
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

async function createAuthUser(user: TestUser, options?: { whitelistAdmin?: boolean }) {
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

  if (options?.whitelistAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
    createdWhitelistEmails.push(user.email);
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
      dob: '1992-04-12',
      email: user.email,
      instagram: '@codex_chat_policy',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '채팅 정책위반 모니터링 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '채팅 정책위반 모니터링 검증',
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
      title: `[Playwright] Chat Policy ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '채팅 정책위반 모니터링 검증용 체험입니다.',
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

async function createInquiryFixture(params: {
  guestId: string;
  hostId: string;
  experienceId: number;
}) {
  const supabase = getAdminClient();
  const now = new Date().toISOString();
  const initialContent = `기본 문의 ${Date.now()}`;

  const { data: inquiry, error: inquiryError } = await supabase
    .from('inquiries')
    .insert({
      user_id: params.guestId,
      host_id: params.hostId,
      experience_id: String(params.experienceId),
      type: 'general',
      content: initialContent,
      updated_at: now,
    })
    .select('id')
    .single();

  if (inquiryError || !inquiry?.id) {
    throw inquiryError || new Error('Failed to create inquiry fixture.');
  }

  createdInquiryIds.push(Number(inquiry.id));

  const { data: message, error: messageError } = await supabase
    .from('inquiry_messages')
    .insert({
      inquiry_id: inquiry.id,
      sender_id: params.guestId,
      content: initialContent,
      type: 'text',
      is_read: false,
    })
    .select('id')
    .single();

  if (messageError || !message?.id) {
    throw messageError || new Error('Failed to create inquiry message fixture.');
  }

  createdMessageIds.push(Number(message.id));
  return Number(inquiry.id);
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function openGuestInquiry(page: Page, inquiryId: number) {
  await page.goto(`/guest/inbox?inquiryId=${inquiryId}`, { waitUntil: 'networkidle' });
  await expect(page.locator(GUEST_CHAT_INPUT_SELECTOR).first()).toBeVisible({ timeout: 15000 });
}

async function openHostInquiry(page: Page, inquiryId: number) {
  await page.goto(`/host/dashboard?tab=inquiries&inquiryId=${inquiryId}`, { waitUntil: 'networkidle' });
  await expect(page.locator(HOST_CHAT_INPUT_SELECTOR).first()).toBeVisible({ timeout: 15000 });
}

async function createSeededFixture(): Promise<SeededChatFixture> {
  const admin = createUser('admin');
  const guest = createUser('guest');
  const host = createUser('host');

  const adminId = await createAuthUser(admin, { whitelistAdmin: true });
  const guestId = await createAuthUser(guest);
  const hostId = await createAuthUser(host);
  await createApprovedHostApplication(hostId, host);
  const experienceId = await createExperienceFixture(hostId);
  const inquiryId = await createInquiryFixture({ guestId, hostId, experienceId });

  return {
    admin,
    adminId,
    guest,
    guestId,
    host,
    hostId,
    experienceId,
    inquiryId,
  };
}

async function withLoggedInPage(browser: Browser, user: TestUser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, user);
  return { context, page };
}

test.describe.serial('Chat policy monitoring flow', () => {
  let fixture: SeededChatFixture;

  test.beforeAll(async () => {
    fixture = await createSeededFixture();
  });

  test.afterAll(async () => {
    const supabase = getAdminClient();

    if (createdAuthUserIds.length > 0) {
      await supabase.from('notifications').delete().in('user_id', createdAuthUserIds);
    }

    if (auditLogTargetIds.length > 0) {
      await supabase
        .from('admin_audit_logs')
        .delete()
        .in('target_id', Array.from(new Set(auditLogTargetIds)));
    }

    if (createdMessageIds.length > 0) {
      await supabase.from('inquiry_messages').delete().in('id', createdMessageIds);
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

    for (const email of createdWhitelistEmails) {
      await supabase.from('admin_whitelist').delete().eq('email', email);
    }

    for (const userId of createdAuthUserIds) {
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.from('users').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  test('shows inline warnings in guest and host chat composers', async ({ browser }) => {
    const guestSession = await withLoggedInPage(browser, fixture.guest);
    await openGuestInquiry(guestSession.page, fixture.inquiryId);

    const guestInput = guestSession.page.locator(GUEST_CHAT_INPUT_SELECTOR).first();
    await guestInput.fill('제 번호는 010-1234-5678 입니다.');
    await expect(guestSession.page.getByText(WARNING_BANNER_TEXT)).toBeVisible();
    await guestInput.fill('입금 확인 부탁드려요.');
    await expect(guestSession.page.getByText(WARNING_BANNER_TEXT)).toHaveCount(0);
    await guestSession.context.close();

    const hostSession = await withLoggedInPage(browser, fixture.host);
    await openHostInquiry(hostSession.page, fixture.inquiryId);

    const hostInput = hostSession.page.locator(HOST_CHAT_INPUT_SELECTOR).first();
    await hostInput.fill('contact me at policy.host@example.com');
    await expect(hostSession.page.getByText(WARNING_BANNER_TEXT)).toBeVisible();
    await hostInput.fill('일정 확인 부탁드립니다.');
    await expect(hostSession.page.getByText(WARNING_BANNER_TEXT)).toHaveCount(0);
    await hostSession.context.close();
  });

  test('creates admin alerts and shows policy badges in the admin monitor', async ({ browser }) => {
    test.setTimeout(90000);

    const flaggedMessage = `연락은\n010-2222-3333 또는\nhttps://open.kakao.com/o/policyflow 로 부탁드려요 ${Date.now()}`;

    const guestSession = await withLoggedInPage(browser, fixture.guest);
    await openGuestInquiry(guestSession.page, fixture.inquiryId);

    const guestInput = guestSession.page.locator(GUEST_CHAT_INPUT_SELECTOR).first();
    await guestInput.fill(flaggedMessage);
    await guestSession.page.getByText(WARNING_BANNER_TEXT).waitFor({ state: 'visible' });
    await guestInput.press('Enter');

    await expect.poll(async () => {
      const { data, error } = await getAdminClient()
        .from('notifications')
        .select('id, title, link')
        .eq('user_id', fixture.adminId)
        .eq('type', 'admin_alert')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data || []).some((row) =>
        row.title?.includes('채팅 정책위반 의심 메시지 감지') &&
        row.link?.includes(`inquiryId=${fixture.inquiryId}`)
      );
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toBe(true);

    await expect.poll(async () => {
      const { data, error } = await getAdminClient()
        .from('admin_audit_logs')
        .select('id')
        .eq('action_type', 'CHAT_POLICY_SIGNAL_DETECTED')
        .eq('target_id', String(fixture.inquiryId))
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      return (data || []).length;
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toBe(1);

    auditLogTargetIds.push(String(fixture.inquiryId));
    await guestSession.context.close();

    const adminSession = await withLoggedInPage(browser, fixture.admin);
    await adminSession.page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${fixture.inquiryId}`, { waitUntil: 'domcontentloaded' });

    const guestCard = adminSession.page.locator('[data-participant-card="guest"]');
    const hostCard = adminSession.page.locator('[data-participant-card="host"]');
    const inquiryRow = adminSession.page.getByTestId(`admin-chat-inquiry-row-${fixture.inquiryId}`);

    await expect(guestCard).toBeVisible({ timeout: 15000 });
    await expect(hostCard).toBeVisible({ timeout: 15000 });
    await expect(inquiryRow).toHaveAttribute('data-has-policy-signal', 'true', { timeout: 15000 });

    await guestCard.evaluate((node: HTMLButtonElement) => node.click());
    const guestProfileDialog = adminSession.page.getByRole('dialog', { name: '게스트 프로필' });
    await expect(guestProfileDialog).toBeVisible();
    await expect(adminSession.page.getByText(fixture.guest.email, { exact: true }).first()).toBeVisible();
    await expect(adminSession.page.getByText(fixture.guest.phone, { exact: true }).first()).toBeVisible();
    await guestProfileDialog.locator('button').nth(1).click();
    await expect(guestProfileDialog).toHaveCount(0, { timeout: 10000 });

    await hostCard.evaluate((node: HTMLButtonElement) => node.click());
    const hostProfileDialog = adminSession.page.getByRole('dialog', { name: '호스트 프로필' });
    await expect(hostProfileDialog).toBeVisible();
    await expect(adminSession.page.getByText(fixture.host.email, { exact: true }).first()).toBeVisible();
    await expect(adminSession.page.getByText(fixture.host.phone, { exact: true }).first()).toBeVisible();

    await adminSession.context.close();
  });

  test('soft deletes a flagged message without breaking preview or participant views', async ({ browser }) => {
    test.setTimeout(90000);

    const flaggedMessage = `soft delete target 010-4444-5555 ${Date.now()}`;

    const guestSession = await withLoggedInPage(browser, fixture.guest);
    await openGuestInquiry(guestSession.page, fixture.inquiryId);

    const guestInput = guestSession.page.locator(GUEST_CHAT_INPUT_SELECTOR).first();
    await guestInput.fill(flaggedMessage);
    await guestInput.press('Enter');

    await expect.poll(async () => {
      const { data, error } = await getAdminClient()
        .from('inquiry_messages')
        .select('id')
        .eq('inquiry_id', fixture.inquiryId)
        .eq('content', flaggedMessage)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.id ? Number(data.id) : null;
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).not.toBeNull();

    const { data: softDeletedMessageRow, error: softDeletedMessageError } = await getAdminClient()
      .from('inquiry_messages')
      .select('id')
      .eq('inquiry_id', fixture.inquiryId)
      .eq('content', flaggedMessage)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (softDeletedMessageError || !softDeletedMessageRow?.id) {
      throw softDeletedMessageError || new Error('Failed to resolve soft delete target message id.');
    }

    const softDeletedMessageId = Number(softDeletedMessageRow.id);

    createdMessageIds.push(softDeletedMessageId);

    await guestSession.context.close();

    const adminSession = await withLoggedInPage(browser, fixture.admin);
    await adminSession.page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${fixture.inquiryId}`, { waitUntil: 'domcontentloaded' });
    await expect(adminSession.page.locator('[data-participant-card="guest"]')).toBeVisible({ timeout: 15000 });

    const deleteButton = adminSession.page.locator(`[data-delete-message-id="${softDeletedMessageId}"]`);
    await expect(deleteButton).toBeVisible({ timeout: 15000 });
    await deleteButton.click();
    await expect(adminSession.page.getByText('메시지 삭제')).toBeVisible({ timeout: 15000 });
    await adminSession.page.getByRole('button', { name: '삭제', exact: true }).last().click();

    await expect(adminSession.page.getByText('운영 삭제').first()).toBeVisible({ timeout: 15000 });
    await expect(adminSession.page.getByText(SOFT_DELETE_PLACEHOLDER).first()).toBeVisible({ timeout: 15000 });

    await expect.poll(async () => {
      const { data, error } = await getAdminClient()
        .from('inquiry_messages')
        .select('type, content, is_read, read_at')
        .eq('id', softDeletedMessageId)
        .maybeSingle();

      if (error) throw error;

      return {
        type: data?.type || null,
        content: data?.content || null,
        is_read: Boolean(data?.is_read),
        hasReadAt: Boolean(data?.read_at),
      };
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toEqual({
      type: 'deleted',
      content: SOFT_DELETE_PLACEHOLDER,
      is_read: true,
      hasReadAt: true,
    });

    await expect.poll(async () => {
      const { data, error } = await getAdminClient()
        .from('inquiries')
        .select('content')
        .eq('id', fixture.inquiryId)
        .maybeSingle();

      if (error) throw error;
      return data?.content || null;
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toBe(SOFT_DELETE_PLACEHOLDER);

    auditLogTargetIds.push(String(softDeletedMessageId));

    await adminSession.context.close();

    const guestVerifySession = await withLoggedInPage(browser, fixture.guest);
    await openGuestInquiry(guestVerifySession.page, fixture.inquiryId);
    await expect(guestVerifySession.page.getByText(SOFT_DELETE_PLACEHOLDER).first()).toBeVisible({ timeout: 15000 });
    await guestVerifySession.context.close();

    const hostVerifySession = await withLoggedInPage(browser, fixture.host);
    await openHostInquiry(hostVerifySession.page, fixture.inquiryId);
    await expect(hostVerifySession.page.getByText(SOFT_DELETE_PLACEHOLDER).first()).toBeVisible({ timeout: 15000 });
    await hostVerifySession.context.close();
  });
});
