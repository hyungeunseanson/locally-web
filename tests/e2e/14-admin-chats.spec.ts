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
const createdWhitelistEmails: string[] = [];
const createdInquiryIds: number[] = [];
const createdInquiryMessageIds: number[] = [];
const FALSE_CONFLICT_TOAST = '다른 관리자에 의해 이미 상태가 변경되었습니다. 최신 상태를 확인해주세요.';

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
    email: `codex.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `${prefix} ${timestamp}`,
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

  if (options?.whitelistAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
    createdWhitelistEmails.push(user.email);
  }

  return data.user.id;
}

async function seedAdminSupportInquiry(
  guestUserId: string,
  message: string,
  options?: { status?: 'open' | 'in_progress' | 'resolved'; updatedAt?: string }
) {
  const supabase = getAdminClient();
  const now = options?.updatedAt || new Date().toISOString();

  const { data: inquiry, error: inquiryError } = await supabase
    .from('inquiries')
    .insert({
      user_id: guestUserId,
      host_id: null,
      type: 'admin_support',
      status: options?.status || 'open',
      content: message,
      updated_at: now,
    })
    .select('id')
    .single();

  if (inquiryError || !inquiry?.id) {
    throw inquiryError || new Error('Failed to create admin support inquiry');
  }

  createdInquiryIds.push(inquiry.id);

  const { data: insertedMessage, error: messageError } = await supabase
    .from('inquiry_messages')
    .insert({
      inquiry_id: inquiry.id,
      sender_id: guestUserId,
      content: message,
      type: 'text',
      is_read: false,
    })
    .select('id')
    .single();

  if (messageError || !insertedMessage?.id) {
    throw messageError || new Error('Failed to create inquiry message');
  }

  createdInquiryMessageIds.push(insertedMessage.id);

  return Number(inquiry.id);
}

async function appendInquiryMessages(
  inquiryId: number,
  senderId: string,
  messages: string[]
) {
  if (messages.length === 0) return;

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiry_messages')
    .insert(messages.map((content) => ({
      inquiry_id: inquiryId,
      sender_id: senderId,
      content,
      type: 'text',
      is_read: false,
    })))
    .select('id');

  if (error || !data) {
    throw error || new Error('Failed to append inquiry messages');
  }

  createdInquiryMessageIds.push(...data.map((message) => Number(message.id)));

  const { error: inquiryError } = await supabase
    .from('inquiries')
    .update({
      content: messages[messages.length - 1],
      updated_at: new Date().toISOString(),
    })
    .eq('id', inquiryId);

  if (inquiryError) throw inquiryError;
}

async function inquiryRowOrder(page: Page) {
  return page.locator('[data-testid^="admin-chat-inquiry-row-"]').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-testid')?.replace('admin-chat-inquiry-row-', '') || '')
  );
}

function adminMessageRow(page: Page, content: string) {
  return page.locator('div[data-message-id]').filter({ hasText: content });
}

async function readInquiryStatus(inquiryId: number) {
  const { data, error } = await getAdminClient()
    .from('inquiries')
    .select('status, updated_at')
    .eq('id', inquiryId)
    .maybeSingle();

  if (error) throw error;
  return data;
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

  if (createdInquiryMessageIds.length > 0) {
    await supabase.from('inquiry_messages').delete().in('id', createdInquiryMessageIds);
  }

  if (createdInquiryIds.length > 0) {
    await supabase.from('inquiries').delete().in('id', createdInquiryIds);
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

test.describe.serial('Admin chats smoke', () => {
  test('keeps the last user selection after a deep link without repeating detail requests', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createUser('admin.chats.detail');
    const guestUser = createUser('guest.chats.detail');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestUserId = await createAuthUser(guestUser);

    const inquiryMessageA = `코덱스 관리자 상세 진입 문의 A ${Date.now()}`;
    const inquiryMessageB = `코덱스 관리자 상세 진입 문의 B ${Date.now()}`;
    const inquiryIdA = await seedAdminSupportInquiry(guestUserId, inquiryMessageA);
    const inquiryIdB = await seedAdminSupportInquiry(guestUserId, inquiryMessageB);

    await login(page, adminUser);

    let listRequestCount = 0;
    const detailRequestCounts = new Map<string, number>();
    await page.route('**/api/admin/inquiries', async (route) => {
      listRequestCount += 1;
      await route.continue();
    });
    await page.route('**/api/admin/inquiries/*/messages', async (route) => {
      const inquiryId = route.request().url().match(/\/inquiries\/([^/]+)\/messages/)?.[1] || '';
      detailRequestCounts.set(inquiryId, (detailRequestCounts.get(inquiryId) || 0) + 1);
      await route.continue();
    });

    await page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${inquiryIdA}`, { waitUntil: 'domcontentloaded' });

    await expect(
      page.locator('div.bg-white.border.border-slate-200.rounded-tl-none').filter({ hasText: inquiryMessageA }).last()
    ).toBeVisible({ timeout: 15000 });

    await page.getByTestId(`admin-chat-inquiry-row-${inquiryIdB}`).click();
    await expect(
      page.locator('div.bg-white.border.border-slate-200.rounded-tl-none').filter({ hasText: inquiryMessageB }).last()
    ).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(new RegExp(`inquiryId=${inquiryIdB}(?:&|$)`));
    await expect(page.getByText(`문의 ID #${inquiryIdB}`, { exact: true })).toBeVisible();
    expect(detailRequestCounts.get(String(inquiryIdA)) || 0).toBe(1);
    expect(detailRequestCounts.get(String(inquiryIdB)) || 0).toBe(1);
    expect(listRequestCount).toBeLessThanOrEqual(2);

    await page.unroute('**/api/admin/inquiries/*/messages');
    await page.unroute('**/api/admin/inquiries');
  });

  test('ignores a slower response from an inquiry selected before the current one', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createUser('admin.chats.race');
    const guestUser = createUser('guest.chats.race');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestUserId = await createAuthUser(guestUser);

    const inquiryMessageA = `코덱스 응답 역전 문의 A ${Date.now()}`;
    const inquiryMessageB = `코덱스 응답 역전 문의 B ${Date.now()}`;
    const inquiryIdA = await seedAdminSupportInquiry(guestUserId, inquiryMessageA);
    const inquiryIdB = await seedAdminSupportInquiry(guestUserId, inquiryMessageB);

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=CHATS', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(`admin-chat-inquiry-row-${inquiryIdA}`)).toBeVisible({ timeout: 15000 });

    let releaseAResponse = () => {};
    const aResponseGate = new Promise<void>((resolve) => {
      releaseAResponse = resolve;
    });
    await page.route(`**/api/admin/inquiries/${inquiryIdA}/messages`, async (route) => {
      await aResponseGate;
      await route.continue();
    });

    try {
      await page.getByTestId(`admin-chat-inquiry-row-${inquiryIdA}`).click();
      await expect(page.getByTestId('admin-chat-messages-loading')).toBeVisible();
      await expect(page.getByTestId('admin-chat-composer')).toBeDisabled();

      await page.getByTestId(`admin-chat-inquiry-row-${inquiryIdB}`).click();
      await expect(
        page.locator('div.bg-white.border.border-slate-200.rounded-tl-none').filter({ hasText: inquiryMessageB }).last()
      ).toBeVisible({ timeout: 15000 });

      releaseAResponse();
      await page.waitForTimeout(750);

      await expect(page.getByText(`문의 ID #${inquiryIdB}`, { exact: true })).toBeVisible();
      await expect(adminMessageRow(page, inquiryMessageA)).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`inquiryId=${inquiryIdB}(?:&|$)`));
    } finally {
      releaseAResponse();
      await page.unroute(`**/api/admin/inquiries/${inquiryIdA}/messages`);
    }
  });

  test('clears the previous conversation and disables replies while the next inquiry loads', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createUser('admin.chats.loading');
    const guestUser = createUser('guest.chats.loading');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestUserId = await createAuthUser(guestUser);

    const inquiryMessageA = `코덱스 전환 로딩 문의 A ${Date.now()}`;
    const inquiryMessageB = `코덱스 전환 로딩 문의 B ${Date.now()}`;
    const inquiryIdA = await seedAdminSupportInquiry(guestUserId, inquiryMessageA);
    const inquiryIdB = await seedAdminSupportInquiry(guestUserId, inquiryMessageB);

    await login(page, adminUser);
    await page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${inquiryIdA}`, { waitUntil: 'domcontentloaded' });
    await expect(adminMessageRow(page, inquiryMessageA)).toBeVisible({ timeout: 15000 });
    const inquiryADraft = `Inquiry A draft ${Date.now()}`;
    await page.getByTestId('admin-chat-composer').fill(inquiryADraft);

    let releaseBResponse = () => {};
    const bResponseGate = new Promise<void>((resolve) => {
      releaseBResponse = resolve;
    });
    await page.route(`**/api/admin/inquiries/${inquiryIdB}/messages`, async (route) => {
      await bResponseGate;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Intentional detail error' }),
      });
    });

    try {
      await page.getByTestId(`admin-chat-inquiry-row-${inquiryIdB}`).click();
      await expect(page.getByText(`문의 ID #${inquiryIdB}`, { exact: true })).toBeVisible();
      await expect(page.getByTestId('admin-chat-messages-loading')).toBeVisible();
      await expect(page.getByTestId('admin-chat-composer')).toBeDisabled();
      await expect(adminMessageRow(page, inquiryMessageA)).toHaveCount(0);

      releaseBResponse();
      await expect(page.getByTestId('admin-chat-messages-error')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('admin-chat-composer')).toBeDisabled();
      await expect(adminMessageRow(page, inquiryMessageA)).toHaveCount(0);
    } finally {
      releaseBResponse();
      await page.unroute(`**/api/admin/inquiries/${inquiryIdB}/messages`);
    }

    await page.getByTestId('admin-chat-messages-error').getByRole('button').click();
    await expect(adminMessageRow(page, inquiryMessageB)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('admin-chat-composer')).toBeEnabled();
    await expect(page.getByTestId('admin-chat-composer')).toHaveValue('');

    await page.getByTestId(`admin-chat-inquiry-row-${inquiryIdA}`).click();
    await expect(adminMessageRow(page, inquiryMessageA)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('admin-chat-composer')).toHaveValue(inquiryADraft);
  });

  test('does not let a completed send from the previous inquiry change the current selection or scroll', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createUser('admin.chats.send-switch');
    const guestUser = createUser('guest.chats.send-switch');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestUserId = await createAuthUser(guestUser);

    const inquiryMessageA = `코덱스 전송 전환 문의 A ${Date.now()}`;
    const inquiryMessageB = `코덱스 전송 전환 문의 B ${Date.now()}`;
    const inquiryIdA = await seedAdminSupportInquiry(guestUserId, inquiryMessageA, { status: 'in_progress' });
    const inquiryIdB = await seedAdminSupportInquiry(guestUserId, inquiryMessageB, { status: 'in_progress' });
    await appendInquiryMessages(
      inquiryIdB,
      guestUserId,
      Array.from({ length: 28 }, (_, index) => `B 스크롤 이력 ${index + 1} ${'내용 '.repeat(12)}`)
    );

    await login(page, adminUser);
    await page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${inquiryIdA}`, { waitUntil: 'domcontentloaded' });
    await expect(adminMessageRow(page, inquiryMessageA)).toBeVisible({ timeout: 15000 });

    let releaseSend = () => {};
    let markSendStarted = () => {};
    let markSendFinished = () => {};
    const sendGate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    const sendStarted = new Promise<void>((resolve) => {
      markSendStarted = resolve;
    });
    const sendFinished = new Promise<void>((resolve) => {
      markSendFinished = resolve;
    });
    const sentText = `A 지연 전송 ${Date.now()}`;

    await page.route('**/api/inquiries/message', async (route) => {
      const body = route.request().postDataJSON() as { inquiryId?: number | string };
      if (String(body.inquiryId) !== String(inquiryIdA)) {
        await route.continue();
        return;
      }

      markSendStarted();
      await sendGate;
      const response = await route.fetch();
      await route.fulfill({ response });
      markSendFinished();
    });

    try {
      await page.getByTestId('admin-chat-composer').fill(sentText);
      await page.getByTestId('admin-chat-composer').press('Enter');
      await sendStarted;

      await page.getByTestId(`admin-chat-inquiry-row-${inquiryIdB}`).click();
      await expect(adminMessageRow(page, 'B 스크롤 이력 28')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(`문의 ID #${inquiryIdB}`, { exact: true })).toBeVisible();
      await page.waitForTimeout(2000);

      const messageList = page.getByTestId('admin-chat-message-list');
      await messageList.evaluate((element) => {
        element.scrollTop = 0;
        element.dispatchEvent(new Event('scroll'));
      });
      await page.waitForTimeout(500);
      expect(await messageList.evaluate((element) => element.scrollTop)).toBe(0);

      releaseSend();
      await sendFinished;
      await expect(page.getByTestId('admin-chat-composer')).toBeEnabled({ timeout: 15000 });
      await page.waitForTimeout(750);

      await expect(page.getByText(`문의 ID #${inquiryIdB}`, { exact: true })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`inquiryId=${inquiryIdB}(?:&|$)`));
      await expect(adminMessageRow(page, sentText)).toHaveCount(0);
      expect(await messageList.evaluate((element) => element.scrollTop)).toBe(0);
    } finally {
      releaseSend();
      await page.unroute('**/api/inquiries/message');
    }
  });

  test('preserves history position on read-only refreshes and follows an intentional send at the bottom', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createUser('admin.chats.scroll');
    const guestUser = createUser('guest.chats.scroll');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestUserId = await createAuthUser(guestUser);

    const inquiryMessage = `코덱스 스크롤 문의 ${Date.now()}`;
    const inquiryId = await seedAdminSupportInquiry(guestUserId, inquiryMessage, { status: 'in_progress' });
    await appendInquiryMessages(
      inquiryId,
      guestUserId,
      Array.from({ length: 28 }, (_, index) => `스크롤 이력 ${index + 1} ${'내용 '.repeat(12)}`)
    );

    await login(page, adminUser);

    let detailRequestCount = 0;
    await page.route(`**/api/admin/inquiries/${inquiryId}/messages`, async (route) => {
      detailRequestCount += 1;
      await route.continue();
    });

    await page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${inquiryId}`, { waitUntil: 'domcontentloaded' });
    const messageList = page.getByTestId('admin-chat-message-list');
    await expect(messageList.getByText('스크롤 이력 28', { exact: false })).toBeVisible({ timeout: 15000 });
    await expect.poll(() => detailRequestCount).toBe(1);
    await page.waitForTimeout(2000);
    expect(detailRequestCount).toBe(1);

    await messageList.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(750);
    const historyScrollTop = await messageList.evaluate((element) => element.scrollTop);
    expect(detailRequestCount).toBe(1);
    expect(historyScrollTop).toBe(0);

    const { error: readUpdateError } = await getAdminClient()
      .from('inquiry_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('inquiry_id', inquiryId);
    if (readUpdateError) throw readUpdateError;

    await page.getByTitle('새로고침').click();
    await page.waitForTimeout(750);
    expect(detailRequestCount).toBe(1);
    await expect.poll(() => messageList.evaluate((element) => element.scrollTop)).toBe(historyScrollTop);

    await messageList.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event('scroll'));
    });

    const followUpdate = `하단 추적 관리자 전송 ${Date.now()}`;
    await page.getByTestId('admin-chat-composer').fill(followUpdate);
    await page.getByTestId('admin-chat-composer').press('Enter');
    await expect(adminMessageRow(page, followUpdate)).toBeVisible({ timeout: 15000 });
    await expect.poll(() => messageList.evaluate((element) =>
      element.scrollHeight - element.scrollTop - element.clientHeight
    )).toBeLessThanOrEqual(64);

    await page.unroute(`**/api/admin/inquiries/${inquiryId}/messages`);
  });

  test('groups resolved inquiries below active inquiries and clears a selection that leaves its filter', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createUser('admin.chats.sorting');
    const guestUser = createUser('guest.chats.sorting');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestUserId = await createAuthUser(guestUser);

    const now = Date.now();
    const activeRecentId = await seedAdminSupportInquiry(guestUserId, `활성 최근 ${now}`, {
      status: 'open',
      updatedAt: new Date(now - 60_000).toISOString(),
    });
    const activeOlderId = await seedAdminSupportInquiry(guestUserId, `활성 이전 ${now}`, {
      status: 'in_progress',
      updatedAt: new Date(now - 120_000).toISOString(),
    });
    const resolvedRecentId = await seedAdminSupportInquiry(guestUserId, `완료 최근 ${now}`, {
      status: 'resolved',
      updatedAt: new Date(now).toISOString(),
    });
    const resolvedOlderId = await seedAdminSupportInquiry(guestUserId, `완료 이전 ${now}`, {
      status: 'resolved',
      updatedAt: new Date(now - 180_000).toISOString(),
    });

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=CHATS', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(`admin-chat-inquiry-row-${resolvedOlderId}`)).toBeVisible({ timeout: 15000 });
    const statusRequestBodies: Array<string | null> = [];
    page.on('request', (request) => {
      if (request.url().endsWith(`/api/admin/inquiries/${activeRecentId}/status`)) {
        statusRequestBodies.push(request.postData());
      }
    });

    let order = await inquiryRowOrder(page);
    expect(order.indexOf(String(activeRecentId))).toBeLessThan(order.indexOf(String(activeOlderId)));
    expect(order.indexOf(String(activeOlderId))).toBeLessThan(order.indexOf(String(resolvedRecentId)));
    expect(order.indexOf(String(resolvedRecentId))).toBeLessThan(order.indexOf(String(resolvedOlderId)));

    await page.getByRole('button', { name: '대기', exact: true }).click();
    await page.getByTestId(`admin-chat-inquiry-row-${activeRecentId}`).click();
    await expect(page.getByText(`문의 ID #${activeRecentId}`, { exact: true })).toBeVisible({ timeout: 15000 });
    await page.locator('div.absolute.top-2.right-2').getByRole('button', { name: '완료', exact: true }).click();

    await expect.poll(async () => (await readInquiryStatus(activeRecentId))?.status || null, {
      timeout: 15000,
    }).toBe('resolved');
    expect(statusRequestBodies).toHaveLength(1);
    expect(statusRequestBodies[0]).toContain('"status":"resolved"');
    await expect(page.getByText(`문의 ID #${activeRecentId}`, { exact: true })).toHaveCount(0, { timeout: 15000 });
    await expect(page).not.toHaveURL(/inquiryId=/);

    await page.getByRole('button', { name: '전체', exact: true }).click();
    await expect(page.getByTestId(`admin-chat-inquiry-row-${activeRecentId}`)).toBeVisible({ timeout: 15000 });
    order = await inquiryRowOrder(page);
    expect(order.indexOf(String(activeOlderId))).toBeLessThan(order.indexOf(String(activeRecentId)));
    expect(order.indexOf(String(activeRecentId))).toBeLessThan(order.indexOf(String(resolvedRecentId)));
    expect(order.indexOf(String(resolvedRecentId))).toBeLessThan(order.indexOf(String(resolvedOlderId)));
  });

  test('updates admin support inquiry status through admin route', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createUser('admin.chats');
    const guestUser = createUser('guest.chats');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestUserId = await createAuthUser(guestUser);

    const inquiryMessage = `코덱스 관리자 상담 문의 ${Date.now()}`;
    const inquiryId = await seedAdminSupportInquiry(guestUserId, inquiryMessage);

    await login(page, adminUser);
    await page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${inquiryId}`, { waitUntil: 'domcontentloaded' });

    const inquiriesResponse = await page.request.get('/api/admin/inquiries');
    expect(inquiriesResponse.ok()).toBeTruthy();
    const inquiriesPayload = await inquiriesResponse.json();
    const inquiryListItem = Array.isArray(inquiriesPayload?.data)
      ? inquiriesPayload.data.find((row: { id?: number | string }) => String(row.id) === String(inquiryId))
      : null;

    expect(inquiryListItem).toBeTruthy();
    expect(inquiryListItem?.guest?.email).toBeUndefined();
    expect(inquiryListItem?.guest?.phone).toBeUndefined();
    expect(inquiryListItem?.host?.email).toBeUndefined();
    expect(inquiryListItem?.host?.phone).toBeUndefined();
    expect(inquiryListItem?.inquiry_messages).toBeUndefined();

    const messagesResponse = await page.request.get(`/api/admin/inquiries/${inquiryId}/messages`);
    expect(messagesResponse.ok()).toBeTruthy();
    const messagesPayload = await messagesResponse.json();
    expect(messagesPayload?.inquiry?.guest?.email).toBe(guestUser.email);
    expect(messagesPayload?.inquiry?.guest?.phone).toBe(guestUser.phone);

    await expect(
      page.locator('div.bg-white.border.border-slate-200.rounded-tl-none').filter({ hasText: inquiryMessage }).last()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-participant-card="guest"]')).toBeVisible();
    await expect(page.locator('[data-participant-card="host"]')).toHaveCount(0);

    const detailStatusGroup = page.locator('div.absolute.top-2.right-2');
    await detailStatusGroup.getByRole('button', { name: '처리중', exact: true }).click();

    await expect.poll(async () => {
      const inquiry = await readInquiryStatus(inquiryId);
      return inquiry?.status || null;
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toBe('in_progress');
  });

  test('promotes first admin reply to in_progress without showing false conflict toast', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createUser('admin.chats.reply');
    const guestUser = createUser('guest.chats.reply');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestUserId = await createAuthUser(guestUser);

    const inquiryMessage = `코덱스 관리자 첫 답변 문의 ${Date.now()}\n게스트 둘째 줄`;
    const adminReply = `관리자 첫 답변 ${Date.now()}\n관리자 둘째 줄`;
    const inquiryId = await seedAdminSupportInquiry(guestUserId, inquiryMessage);

    await login(page, adminUser);
    await page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${inquiryId}`, { waitUntil: 'domcontentloaded' });

    const guestMessageBubble = page.locator('div.bg-white.border.border-slate-200.rounded-tl-none').filter({ hasText: inquiryMessage }).last();
    await expect(guestMessageBubble).toBeVisible({ timeout: 15000 });
    await expect(guestMessageBubble).toHaveCSS('white-space', 'pre-wrap');

    await page.getByPlaceholder('답변을 입력하세요...').fill(adminReply);
    await page.getByPlaceholder('답변을 입력하세요...').press('Enter');

    const adminMessageBubble = page
      .locator('div[data-message-id]')
      .filter({ hasText: adminReply })
      .last()
      .locator('div.bg-black.text-white');
    await expect(adminMessageBubble).toBeVisible({ timeout: 15000 });
    await expect(adminMessageBubble).toHaveCSS('white-space', 'pre-wrap');

    await expect.poll(async () => {
      const inquiry = await readInquiryStatus(inquiryId);
      return inquiry?.status || null;
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toBe('in_progress');

    await expect(page.getByText(FALSE_CONFLICT_TOAST)).toHaveCount(0);
  });

  test('still shows the conflict toast when inquiry status really changed elsewhere', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createUser('admin.chats.conflict');
    const guestUser = createUser('guest.chats.conflict');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestUserId = await createAuthUser(guestUser);

    const inquiryMessage = `코덱스 관리자 충돌 문의 ${Date.now()}`;
    const inquiryId = await seedAdminSupportInquiry(guestUserId, inquiryMessage);

    await login(page, adminUser);
    await page.goto(`/admin/dashboard?tab=CHATS&inquiryId=${inquiryId}`, { waitUntil: 'domcontentloaded' });

    await expect(
      page.locator('div.bg-white.border.border-slate-200.rounded-tl-none').filter({ hasText: inquiryMessage }).last()
    ).toBeVisible({ timeout: 15000 });

    let conflictInjected = false;
    await page.route(`**/api/admin/inquiries/${inquiryId}/status`, async (route) => {
      if (!conflictInjected) {
        conflictInjected = true;
        const { error } = await getAdminClient()
          .from('inquiries')
          .update({
            status: 'resolved',
            updated_at: new Date().toISOString(),
          })
          .eq('id', inquiryId);

        if (error) {
          throw error;
        }
      }

      await route.continue();
    });

    const detailStatusGroup = page.locator('div.absolute.top-2.right-2');
    await detailStatusGroup.getByRole('button', { name: '처리중', exact: true }).click();

    await expect(
      page.getByRole('paragraph').filter({ hasText: FALSE_CONFLICT_TOAST }).first()
    ).toBeVisible({ timeout: 15000 });

    await expect.poll(async () => {
      const inquiry = await readInquiryStatus(inquiryId);
      return inquiry?.status || null;
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toBe('resolved');

    await page.unroute(`**/api/admin/inquiries/${inquiryId}/status`);
  });
});
