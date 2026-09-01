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
  /외부 연락처가 감지됐어요|External contact details detected|外部連絡先が検出されました|检测到外部联系方式/;
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

async function countAdminNotifications(params: {
  adminId: string;
  title: string;
  inquiryId?: number;
}) {
  let query = getAdminClient()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', params.adminId)
    .eq('type', 'admin_alert')
    .eq('title', params.title);

  if (params.inquiryId != null) {
    query = query.eq('link', `/admin/dashboard?tab=CHATS&inquiryId=${params.inquiryId}`);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
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

    for (const email of createdWhitelistEmails) {
      await supabase.from('admin_whitelist').delete().eq('email', email);
    }

    for (const userId of createdAuthUserIds) {
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.from('users').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  test('shows the persistent safety notice and inline warnings in guest and host chats', async ({ browser }) => {
    const guestSession = await withLoggedInPage(browser, fixture.guest);
    await openGuestInquiry(guestSession.page, fixture.inquiryId);

    await expect(guestSession.page.getByTestId('chat-safety-notice')).toBeVisible();
    await expect(guestSession.page.getByTestId('chat-safety-notification-link'))
      .toHaveAttribute('href', '/account');

    const guestInput = guestSession.page.locator(GUEST_CHAT_INPUT_SELECTOR).first();
    await guestInput.fill('제 번호는 010-1234-5678 입니다.');
    await expect(guestSession.page.getByText(WARNING_BANNER_TEXT)).toBeVisible();
    await guestInput.fill('입금 확인 부탁드려요.');
    await expect(guestSession.page.getByText(WARNING_BANNER_TEXT)).toHaveCount(0);
    await guestSession.context.close();

    const hostSession = await withLoggedInPage(browser, fixture.host);
    await openHostInquiry(hostSession.page, fixture.inquiryId);

    await expect(hostSession.page.getByTestId('chat-safety-notice')).toBeVisible();
    await expect(hostSession.page.getByTestId('chat-safety-notification-link'))
      .toHaveAttribute('href', '/host/dashboard?tab=profile');

    const hostInput = hostSession.page.locator(HOST_CHAT_INPUT_SELECTOR).first();
    await hostInput.fill('contact me at policy.host@example.com');
    await expect(hostSession.page.getByText(WARNING_BANNER_TEXT)).toBeVisible();
    await hostInput.fill('일정 확인 부탁드립니다.');
    await expect(hostSession.page.getByText(WARNING_BANNER_TEXT)).toHaveCount(0);
    await hostSession.context.close();
  });

  test('keeps guest-authored admin support contact details outside policy monitoring', async ({ browser }) => {
    test.setTimeout(150000);

    const flaggedSupportMessage = `전화 예약 요청서 010-3333-4444 https://open.kakao.com/o/support-${Date.now()}`;
    const guestSession = await withLoggedInPage(browser, fixture.guest);
    const createResponse = await guestSession.page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'admin_support',
        message: flaggedSupportMessage,
      },
    });

    expect(createResponse.status()).toBe(200);
    const createBody = await createResponse.json() as {
      inquiryId: number | string;
      messageId: number | string;
    };
    const inquiryId = Number(createBody.inquiryId);
    const messageId = Number(createBody.messageId);
    createdInquiryIds.push(inquiryId);
    createdMessageIds.push(messageId);

    await openGuestInquiry(guestSession.page, inquiryId);
    const guestInput = guestSession.page.locator(GUEST_CHAT_INPUT_SELECTOR).first();
    await guestInput.fill('010-5555-6666 https://open.kakao.com/o/support-followup');
    await expect(guestSession.page.getByText(WARNING_BANNER_TEXT)).toHaveCount(0);
    await expect(guestSession.page.getByTestId('chat-safety-notice')).toHaveCount(0);
    await guestSession.context.close();

    expect(await countAdminNotifications({
      adminId: fixture.adminId,
      title: '채팅 정책위반 의심 메시지 감지',
      inquiryId,
    })).toBe(0);

    const { count: auditCount, error: auditError } = await getAdminClient()
      .from('admin_audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('action_type', 'CHAT_POLICY_SIGNAL_DETECTED')
      .eq('target_id', String(inquiryId));
    if (auditError) throw auditError;
    expect(auditCount || 0).toBe(0);

    const adminSession = await withLoggedInPage(browser, fixture.admin);
    const inquiryListResponse = await adminSession.page.request.get('/api/admin/inquiries');
    expect(inquiryListResponse.status()).toBe(200);
    const inquiryListBody = await inquiryListResponse.json() as {
      data?: Array<{ id?: number | string; has_policy_signal?: boolean; policy_signal_categories?: string[] }>;
    };
    expect(inquiryListBody.data?.find((row) => String(row.id) === String(inquiryId))).toMatchObject({
      has_policy_signal: false,
      policy_signal_categories: [],
    });

    const messagesResponse = await adminSession.page.request.get(`/api/admin/inquiries/${inquiryId}/messages`);
    expect(messagesResponse.status()).toBe(200);
    const messagesBody = await messagesResponse.json() as {
      data?: Array<{ id?: number | string; has_policy_signal?: boolean; policy_signal_categories?: string[] }>;
    };
    expect(messagesBody.data?.find((row) => String(row.id) === String(messageId))).toMatchObject({
      has_policy_signal: false,
      policy_signal_categories: [],
    });
    await adminSession.context.close();
  });

  test('creates one Admin Alert only for a newly created guest inquiry', async ({ browser }) => {
    test.setTimeout(90000);

    const guestExperienceId = await createExperienceFixture(fixture.hostId);
    const guestSession = await withLoggedInPage(browser, fixture.guest);
    const firstMessage = `새 게스트 문의 알림 ${Date.now()}`;

    const createResponse = await guestSession.page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'experience_general',
        hostId: fixture.hostId,
        experienceId: String(guestExperienceId),
        message: firstMessage,
      },
    });

    expect(createResponse.status()).toBe(200);
    const createBody = await createResponse.json() as {
      inquiryId: number | string;
      messageId: number | string;
      createdThread: boolean;
      createdMessage: boolean;
    };
    expect(createBody.createdThread).toBe(true);
    expect(createBody.createdMessage).toBe(true);

    const inquiryId = Number(createBody.inquiryId);
    createdInquiryIds.push(inquiryId);
    createdMessageIds.push(Number(createBody.messageId));

    await expect.poll(() => countAdminNotifications({
      adminId: fixture.adminId,
      title: '새 게스트 문의',
      inquiryId,
    }), {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toBe(1);

    const followUp = `기존 문의 추가 메시지 ${Date.now()}`;
    const followUpResponse = await guestSession.page.request.post('/api/inquiries/message', {
      data: { inquiryId, content: followUp, type: 'text' },
    });
    expect(followUpResponse.status()).toBe(200);
    const followUpBody = await followUpResponse.json() as { messageId: number | string };
    createdMessageIds.push(Number(followUpBody.messageId));
    expect(await countAdminNotifications({
      adminId: fixture.adminId,
      title: '새 게스트 문의',
      inquiryId,
    })).toBe(1);

    await guestSession.context.close();

    const hostExperienceId = await createExperienceFixture(fixture.hostId);
    const hostSession = await withLoggedInPage(browser, fixture.host);
    const hostCreateResponse = await hostSession.page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'host_experience',
        guestId: fixture.guestId,
        experienceId: String(hostExperienceId),
        message: `호스트 시작 문의 ${Date.now()}`,
      },
    });

    expect(hostCreateResponse.status()).toBe(200);
    const hostCreateBody = await hostCreateResponse.json() as {
      inquiryId: number | string;
      messageId: number | string;
      createdThread: boolean;
    };
    expect(hostCreateBody.createdThread).toBe(true);
    const hostInquiryId = Number(hostCreateBody.inquiryId);
    createdInquiryIds.push(hostInquiryId);
    createdMessageIds.push(Number(hostCreateBody.messageId));
    expect(await countAdminNotifications({
      adminId: fixture.adminId,
      title: '새 게스트 문의',
      inquiryId: hostInquiryId,
    })).toBe(0);

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
    await expect(guestCard).toBeEnabled({ timeout: 15000 });
    await expect(hostCard).toBeEnabled({ timeout: 15000 });
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

  test('sends one official admin intervention without self-reporting policy signals', async ({ browser }) => {
    test.setTimeout(90000);

    const adminMessage = `Locally Support 안내 https://pf.kakao.com/_PtvSG/chat ${Date.now()}`;
    const policyAlertCountBefore = await countAdminNotifications({
      adminId: fixture.adminId,
      title: '채팅 정책위반 의심 메시지 감지',
      inquiryId: fixture.inquiryId,
    });

    const { count: policyAuditCountBefore, error: policyAuditBeforeError } = await getAdminClient()
      .from('admin_audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('action_type', 'CHAT_POLICY_SIGNAL_DETECTED')
      .eq('target_id', String(fixture.inquiryId));
    if (policyAuditBeforeError) throw policyAuditBeforeError;

    const adminSession = await withLoggedInPage(browser, fixture.admin);
    await adminSession.page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${fixture.inquiryId}`, { waitUntil: 'domcontentloaded' });

    const composer = adminSession.page.getByTestId('admin-chat-composer');
    const sendButton = adminSession.page.getByRole('button', { name: '메시지 전송' });
    await expect(composer).toBeVisible({ timeout: 15000 });
    await composer.fill(adminMessage);

    let messagePostCount = 0;
    await adminSession.page.route('**/api/inquiries/message', async (route) => {
      messagePostCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });

    await composer.press('Enter');
    await expect(sendButton).toBeDisabled();
    await composer.evaluate((element) => {
      element.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      }));
    });

    await expect.poll(() => messagePostCount, {
      timeout: 15000,
      intervals: [200, 500, 1000],
    }).toBe(1);
    await expect(composer).toBeEnabled({ timeout: 15000 });
    await expect(composer).toHaveValue('');
    await expect(sendButton).toBeDisabled();
    await adminSession.page.unroute('**/api/inquiries/message');

    const { data: insertedMessages, error: insertedMessagesError } = await getAdminClient()
      .from('inquiry_messages')
      .select('id')
      .eq('inquiry_id', fixture.inquiryId)
      .eq('sender_id', fixture.adminId)
      .eq('content', adminMessage);
    if (insertedMessagesError) throw insertedMessagesError;
    expect(insertedMessages).toHaveLength(1);

    const adminMessageId = Number(insertedMessages?.[0]?.id);
    createdMessageIds.push(adminMessageId);
    auditLogTargetIds.push(String(fixture.inquiryId));

    await expect.poll(async () => {
      const { data, error } = await getAdminClient()
        .from('admin_audit_logs')
        .select('details')
        .eq('action_type', 'ADMIN_MONITORED_CHAT_MESSAGE_SEND')
        .eq('target_id', String(fixture.inquiryId))
        .eq('details->>message_id', String(adminMessageId))
        .maybeSingle();
      if (error) throw error;
      return data?.details || null;
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toMatchObject({
      message_id: adminMessageId,
      content_length: adminMessage.length,
    });

    expect(await countAdminNotifications({
      adminId: fixture.adminId,
      title: '채팅 정책위반 의심 메시지 감지',
      inquiryId: fixture.inquiryId,
    })).toBe(policyAlertCountBefore);

    const { count: policyAuditCountAfter, error: policyAuditAfterError } = await getAdminClient()
      .from('admin_audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('action_type', 'CHAT_POLICY_SIGNAL_DETECTED')
      .eq('target_id', String(fixture.inquiryId));
    if (policyAuditAfterError) throw policyAuditAfterError;
    expect(policyAuditCountAfter).toBe(policyAuditCountBefore);

    const adminMessageRow = adminSession.page.locator(`[data-message-id="${adminMessageId}"]`);
    await expect(adminMessageRow).toHaveAttribute('data-official-support', 'true', { timeout: 15000 });
    await expect(adminMessageRow.getByText('Locally Support', { exact: true })).toBeVisible();
    await expect(adminMessageRow.getByTestId('admin-chat-message-policy-badge')).toHaveCount(0);
    await expect(adminSession.page.getByTestId(`admin-chat-inquiry-row-${fixture.inquiryId}`))
      .toHaveAttribute('data-has-policy-signal', 'false', { timeout: 15000 });

    const inquiryListResponse = await adminSession.page.request.get('/api/admin/inquiries');
    expect(inquiryListResponse.status()).toBe(200);
    const inquiryListBody = await inquiryListResponse.json() as {
      data?: Array<{ id?: number | string; has_policy_signal?: boolean }>;
    };
    expect(inquiryListBody.data?.find((row) => String(row.id) === String(fixture.inquiryId)))
      .toMatchObject({ has_policy_signal: false });
    await adminSession.context.close();

    const guestSession = await withLoggedInPage(browser, fixture.guest);
    await openGuestInquiry(guestSession.page, fixture.inquiryId);
    const guestMessageRow = guestSession.page.locator(`[data-message-id="${adminMessageId}"]`);
    await expect(guestMessageRow).toHaveAttribute('data-official-support', 'true', { timeout: 15000 });
    await expect(guestMessageRow.getByText('Locally Support', { exact: true })).toBeVisible();
    await guestSession.context.close();

    const hostSession = await withLoggedInPage(browser, fixture.host);
    await openHostInquiry(hostSession.page, fixture.inquiryId);
    const hostMessageRow = hostSession.page.locator(`[data-message-id="${adminMessageId}"]`);
    await expect(hostMessageRow).toHaveAttribute('data-official-support', 'true', { timeout: 15000 });
    await expect(hostMessageRow.getByText('Locally Support', { exact: true })).toBeVisible();
    await hostMessageRow.getByTestId(`host-inquiry-message-sender-${adminMessageId}`).click();
    await expect(hostSession.page.getByRole('dialog')).toHaveCount(0);
    await hostSession.context.close();
  });

  test('soft deletes only the selected monitored message with server-side access and inquiry guards', async ({ browser }) => {
    test.setTimeout(120000);

    const targetMessage = `manual moderation target ${Date.now()}`;
    const preservedMessage = `message that must remain ${Date.now()}`;

    const guestSession = await withLoggedInPage(browser, fixture.guest);
    await openGuestInquiry(guestSession.page, fixture.inquiryId);

    const guestInput = guestSession.page.locator(GUEST_CHAT_INPUT_SELECTOR).first();
    await guestInput.fill(targetMessage);
    await guestInput.press('Enter');
    await guestInput.fill(preservedMessage);
    await guestInput.press('Enter');

    const resolveMessageId = async (content: string) => {
      const { data, error } = await getAdminClient()
        .from('inquiry_messages')
        .select('id')
        .eq('inquiry_id', fixture.inquiryId)
        .eq('content', content)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.id ? Number(data.id) : null;
    };

    await expect.poll(() => resolveMessageId(targetMessage), {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).not.toBeNull();
    await expect.poll(() => resolveMessageId(preservedMessage), {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).not.toBeNull();

    const softDeletedMessageId = await resolveMessageId(targetMessage);
    const preservedMessageId = await resolveMessageId(preservedMessage);
    if (!softDeletedMessageId || !preservedMessageId) {
      throw new Error('Failed to resolve moderation test message ids.');
    }

    createdMessageIds.push(softDeletedMessageId, preservedMessageId);

    const fillerContents = Array.from(
      { length: 18 },
      (_, index) => `moderation scroll filler ${index + 1} ${'content '.repeat(10)}`
    );
    const { data: fillerRows, error: fillerError } = await getAdminClient()
      .from('inquiry_messages')
      .insert(fillerContents.map((content) => ({
        inquiry_id: fixture.inquiryId,
        sender_id: fixture.guestId,
        content,
        type: 'text',
        is_read: false,
      })))
      .select('id');
    if (fillerError || !fillerRows) {
      throw fillerError || new Error('Failed to seed moderation scroll messages.');
    }
    createdMessageIds.push(...fillerRows.map((row) => Number(row.id)));

    const guestForbiddenResponse = await guestSession.page.request.patch(
      `/api/admin/inquiries/messages/${softDeletedMessageId}`,
      {
        data: {
          action: 'soft_delete',
          inquiryId: fixture.inquiryId,
          reason: 'policy_violation',
        },
      }
    );
    expect(guestForbiddenResponse.status()).toBe(403);
    await guestSession.context.close();

    const hostSession = await withLoggedInPage(browser, fixture.host);
    const hostForbiddenResponse = await hostSession.page.request.patch(
      `/api/admin/inquiries/messages/${softDeletedMessageId}`,
      {
        data: {
          action: 'soft_delete',
          inquiryId: fixture.inquiryId,
          reason: 'policy_violation',
        },
      }
    );
    expect(hostForbiddenResponse.status()).toBe(403);
    await hostSession.context.close();

    const anonymousContext = await browser.newContext();
    const anonymousResponse = await anonymousContext.request.patch(
      `http://localhost:3000/api/admin/inquiries/messages/${softDeletedMessageId}`,
      {
        data: {
          action: 'soft_delete',
          inquiryId: fixture.inquiryId,
          reason: 'policy_violation',
        },
      }
    );
    expect(anonymousResponse.status()).toBe(401);
    await anonymousContext.close();

    const otherInquiryId = await createInquiryFixture({
      guestId: fixture.guestId,
      hostId: fixture.hostId,
      experienceId: fixture.experienceId,
    });

    const adminSession = await withLoggedInPage(browser, fixture.admin);
    const mismatchedInquiryResponse = await adminSession.page.request.patch(
      `/api/admin/inquiries/messages/${softDeletedMessageId}`,
      {
        data: {
          action: 'soft_delete',
          inquiryId: otherInquiryId,
          reason: 'policy_violation',
        },
      }
    );
    expect(mismatchedInquiryResponse.status()).toBe(409);

    const { data: beforeInquiry, error: beforeInquiryError } = await getAdminClient()
      .from('inquiries')
      .select('id, status')
      .eq('id', fixture.inquiryId)
      .maybeSingle();
    if (beforeInquiryError || !beforeInquiry) {
      throw beforeInquiryError || new Error('Failed to read inquiry before moderation.');
    }

    await adminSession.page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${fixture.inquiryId}`, { waitUntil: 'domcontentloaded' });
    await expect(adminSession.page.locator('[data-participant-card="guest"]')).toBeVisible({ timeout: 15000 });

    const adminTargetRow = adminSession.page.locator(`[data-message-id="${softDeletedMessageId}"]`);
    const adminPreservedRow = adminSession.page.locator(`[data-message-id="${preservedMessageId}"]`);
    const deleteButton = adminSession.page.locator(`[data-delete-message-id="${softDeletedMessageId}"]`);
    await expect(deleteButton).toBeVisible({ timeout: 15000 });
    await expect(adminTargetRow.getByTestId('admin-chat-message-policy-badge')).toHaveCount(0);
    await expect(adminPreservedRow.getByText(preservedMessage, { exact: true })).toBeVisible();

    await adminSession.page.route(`**/api/admin/inquiries/messages/${softDeletedMessageId}`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Intentional moderation failure' }),
      });
    });
    await deleteButton.click();
    await adminSession.page.getByRole('button', { name: '삭제', exact: true }).last().click();
    await expect(
      adminSession.page.getByRole('paragraph').filter({ hasText: 'Intentional moderation failure' }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(adminTargetRow.getByText(targetMessage, { exact: true })).toBeVisible();
    await expect(adminPreservedRow.getByText(preservedMessage, { exact: true })).toBeVisible();
    await adminSession.page.unroute(`**/api/admin/inquiries/messages/${softDeletedMessageId}`);

    await deleteButton.click();
    await expect(adminSession.page.getByText('메시지 삭제')).toBeVisible({ timeout: 15000 });
    await expect(adminSession.page.getByText(targetMessage, { exact: false }).last()).toBeVisible();

    const messageList = adminSession.page.getByTestId('admin-chat-message-list');
    await expect.poll(() => messageList.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await messageList.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event('scroll'));
    });
    const historyScrollTop = await messageList.evaluate((element) => element.scrollTop);
    await adminSession.page.getByRole('button', { name: '삭제', exact: true }).last().click();

    await expect(adminTargetRow.getByText('운영 삭제', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(adminTargetRow.getByText(SOFT_DELETE_PLACEHOLDER, { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(adminPreservedRow.getByText(preservedMessage, { exact: true })).toBeVisible();
    await expect(adminSession.page).toHaveURL(new RegExp(`inquiryId=${fixture.inquiryId}(?:&|$)`));
    await expect(adminSession.page.getByTestId(`admin-chat-inquiry-row-${fixture.inquiryId}`)).toHaveClass(/bg-blue-50/);
    await expect.poll(() => messageList.evaluate((element) => element.scrollTop)).toBe(historyScrollTop);

    await expect.poll(async () => {
      const { data, error } = await getAdminClient()
        .from('inquiry_messages')
        .select('id, type, content, is_read, read_at')
        .in('id', [softDeletedMessageId, preservedMessageId]);

      if (error) throw error;

      const deleted = data?.find((row) => Number(row.id) === softDeletedMessageId);
      const preserved = data?.find((row) => Number(row.id) === preservedMessageId);
      return {
        deleted: {
          type: deleted?.type || null,
          content: deleted?.content || null,
          is_read: Boolean(deleted?.is_read),
          hasReadAt: Boolean(deleted?.read_at),
        },
        preserved: {
          type: preserved?.type || null,
          content: preserved?.content || null,
        },
      };
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toEqual({
      deleted: {
        type: 'deleted',
        content: SOFT_DELETE_PLACEHOLDER,
        is_read: true,
        hasReadAt: true,
      },
      preserved: {
        type: 'text',
        content: preservedMessage,
      },
    });

    const { data: afterInquiry, error: afterInquiryError } = await getAdminClient()
      .from('inquiries')
      .select('id, status')
      .eq('id', fixture.inquiryId)
      .maybeSingle();
    if (afterInquiryError) throw afterInquiryError;
    expect(afterInquiry).toEqual(beforeInquiry);

    const stalePreview = `stale moderation preview ${Date.now()}`;
    const { error: stalePreviewError } = await getAdminClient()
      .from('inquiries')
      .update({ content: stalePreview })
      .eq('id', fixture.inquiryId);
    if (stalePreviewError) throw stalePreviewError;

    const retryResponse = await adminSession.page.request.patch(
      `/api/admin/inquiries/messages/${softDeletedMessageId}`,
      {
        data: {
          action: 'soft_delete',
          inquiryId: fixture.inquiryId,
          reason: 'policy_violation',
        },
      }
    );
    expect(retryResponse.status()).toBe(200);
    await expect(retryResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        messageId: softDeletedMessageId,
        inquiryId: fixture.inquiryId,
        alreadyDeleted: true,
        inquiryPreview: fillerContents.at(-1),
        previewSynced: true,
      },
    });

    await expect.poll(async () => {
      const { data, error } = await getAdminClient()
        .from('inquiries')
        .select('content')
        .eq('id', fixture.inquiryId)
        .maybeSingle();
      if (error) throw error;
      return data?.content || null;
    }).toBe(fillerContents.at(-1));

    auditLogTargetIds.push(String(softDeletedMessageId));

    await adminSession.context.close();

    const guestVerifySession = await withLoggedInPage(browser, fixture.guest);
    await openGuestInquiry(guestVerifySession.page, fixture.inquiryId);
    await expect(
      guestVerifySession.page.locator(`[data-message-id="${softDeletedMessageId}"]`).getByText(SOFT_DELETE_PLACEHOLDER, { exact: true })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      guestVerifySession.page.locator(`[data-message-id="${preservedMessageId}"]`).getByText(preservedMessage, { exact: true })
    ).toBeVisible();
    await guestVerifySession.context.close();

    const hostVerifySession = await withLoggedInPage(browser, fixture.host);
    await openHostInquiry(hostVerifySession.page, fixture.inquiryId);
    await expect(
      hostVerifySession.page.locator(`[data-message-id="${softDeletedMessageId}"]`).getByText(SOFT_DELETE_PLACEHOLDER, { exact: true })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      hostVerifySession.page.locator(`[data-message-id="${preservedMessageId}"]`).getByText(preservedMessage, { exact: true })
    ).toBeVisible();
    await hostVerifySession.context.close();
  });
});
