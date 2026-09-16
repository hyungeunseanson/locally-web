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

type InquiryRow = {
  id: number | string;
  user_id: string;
  host_id: string | null;
  type: string | null;
  status: string | null;
  content: string | null;
  service_request_id?: string | null;
};

const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdInquiryIds: Array<number | string> = [];
const createdServiceRequestIds: string[] = [];
const createdProxyRequestIds: string[] = [];
const createdAuditTargetIds: string[] = [];

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
    email: `codex.messaging.boundary.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Messaging Boundary ${prefix} ${timestamp}`,
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

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: user.fullName,
      phone: user.phone,
      email: user.email,
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

async function setUserRole(userId: string, email: string, role: 'host' | 'admin') {
  const { error } = await getAdminClient()
    .from('users')
    .upsert({ id: userId, email, role }, { onConflict: 'id' });

  if (error) throw error;
}

async function login(page: Page, user: TestUser) {
  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function createAdminSupportInquiry(params: {
  guestId: string;
  hostId?: string | null;
  type?: 'admin_support' | 'admin';
  status?: 'open' | 'in_progress' | 'resolved' | null;
  content: string;
}) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiries')
    .insert({
      user_id: params.guestId,
      host_id: params.hostId ?? null,
      type: params.type ?? 'admin_support',
      status: params.status ?? 'open',
      content: params.content,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create admin support inquiry fixture.');
  }

  createdInquiryIds.push(data.id);
  return Number(data.id);
}

async function readInquiry(inquiryId: number | string) {
  const { data, error } = await getAdminClient()
    .from('inquiries')
    .select('id, user_id, host_id, type, status, content, service_request_id')
    .eq('id', inquiryId)
    .maybeSingle<InquiryRow>();

  if (error) throw error;
  return data;
}

async function supportsServiceRequestId() {
  const { error } = await getAdminClient()
    .from('inquiries')
    .select('service_request_id')
    .limit(1);

  return !error;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function createServiceRequest(params: {
  guestId: string;
  guest: TestUser;
  hostId: string;
  label: string;
}) {
  const supabase = getAdminClient();
  const date = new Date();
  date.setDate(date.getDate() + 7);

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.guestId,
      selected_host_id: params.hostId,
      title: `[Playwright] Messaging Boundary ${params.label} ${Date.now()}`,
      description: '메시징 boundary contract 검증용 서비스 의뢰입니다.',
      city: '서울',
      country: 'Korea',
      service_date: formatDate(date),
      start_time: '11:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: params.guest.fullName,
      contact_phone: params.guest.phone,
      status: 'open',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create service request fixture.');
  }

  createdServiceRequestIds.push(data.id);
  return data.id;
}

async function createProxyRequestWithoutLinkedInquiry(
  userId: string,
  user: TestUser,
  options?: {
    paymentStatus?: 'WAITING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    requestStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  }
) {
  const { data, error } = await getAdminClient()
    .from('proxy_requests')
    .insert({
      user_id: userId,
      category: 'RESTAURANT',
      status: options?.requestStatus || 'PENDING',
      payment_channel: 'LOCALLY',
      payment_status: options?.paymentStatus || 'WAITING',
      locally_order_id: `LOCALLY-PROXY-${Date.now()}`,
      agreed_to_terms: true,
      form_data: {
        restaurant_name: `테스트 스시 ${Date.now()}`,
        preferred_slot_primary: '2026-01-15T19:00',
        reservation_name: user.fullName,
        guest_number: 2,
        korean_contact: user.phone,
        payment_method: 'bank',
        contact_name: user.fullName,
        contact_phone: user.phone,
        service_fee_krw: 4500,
      },
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create proxy request fixture.');
  }

  createdProxyRequestIds.push(String(data.id));
  return String(data.id);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdAuditTargetIds.length > 0) {
    await supabase
      .from('admin_audit_logs')
      .delete()
      .in('target_id', Array.from(new Set(createdAuditTargetIds)));
  }

  if (createdProxyRequestIds.length > 0) {
    await supabase.from('proxy_comments').delete().in('request_id', createdProxyRequestIds);
    await supabase.from('proxy_requests').delete().in('id', createdProxyRequestIds);
  }

  if (createdInquiryIds.length > 0) {
    await supabase
      .from('notifications')
      .delete()
      .in(
        'link',
        createdInquiryIds.flatMap((inquiryId) => [
          `/admin/dashboard?tab=CHATS&inquiryId=${inquiryId}`,
          `/guest/inbox?inquiryId=${inquiryId}`,
          `/host/dashboard?tab=inquiries&inquiryId=${inquiryId}`,
        ])
      );
    await supabase
      .from('admin_support_unread_alert_batches')
      .delete()
      .in('inquiry_id', createdInquiryIds);
    await supabase.from('inquiry_messages').delete().in('inquiry_id', createdInquiryIds);
    await supabase.from('inquiries').delete().in('id', createdInquiryIds);
  }

  if (createdServiceRequestIds.length > 0) {
    await supabase.from('service_requests').delete().in('id', createdServiceRequestIds);
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

test.describe.serial('Messaging boundary contracts', () => {
  test('reconciles or rolls back a persisted message before reporting an inquiry update failure', () => {
    const source = readFileSync('app/api/inquiries/thread/shared.ts', 'utf8');
    const messageInsert = source.indexOf(".from('inquiry_messages')\n    .insert({");
    const inquiryUpdate = source.indexOf("const updateResult = await supabaseAdmin", messageInsert);
    const reconciliation = source.indexOf("const reconcileResult = await supabaseAdmin", inquiryUpdate);
    const messageRollback = source.indexOf(".from('inquiry_messages')\n          .delete()", reconciliation);
    const recipientSideEffects = source.indexOf('const actorDisplayName = await', messageRollback);

    expect(messageInsert).toBeGreaterThan(-1);
    expect(inquiryUpdate).toBeGreaterThan(messageInsert);
    expect(reconciliation).toBeGreaterThan(inquiryUpdate);
    expect(messageRollback).toBeGreaterThan(reconciliation);
    expect(recipientSideEffects).toBeGreaterThan(messageRollback);
    expect(source.slice(reconciliation, recipientSideEffects)).toContain(".eq('id', insertedMessage.id)");
    expect(source.slice(reconciliation, recipientSideEffects)).toContain(".eq('inquiry_id', inquiry.id)");
    expect(source.slice(reconciliation, recipientSideEffects)).toContain('if (!rollbackError)');
  });

  test('creates a separate admin support inquiry for every user report', async ({ page }) => {
    const guestUser = createUser('separate-support-reports');
    const guestId = await createAuthUser(guestUser);
    await login(page, guestUser);

    const firstMessage = `첫 오류 신고 ${Date.now()}`;
    const secondMessage = `두 번째 불편 신고 ${Date.now()}`;
    const [firstResponse, secondResponse] = await Promise.all([
      page.request.post('/api/inquiries/thread', {
        data: { contextType: 'admin_support', message: firstMessage },
      }),
      page.request.post('/api/inquiries/thread', {
        data: { contextType: 'admin_support', message: secondMessage },
      }),
    ]);

    expect(firstResponse.status()).toBe(200);
    expect(secondResponse.status()).toBe(200);
    const first = await firstResponse.json();
    const second = await secondResponse.json();

    expect(first).toMatchObject({
      success: true,
      inquiryType: 'admin_support',
      guestId,
      hostId: null,
      createdThread: true,
      createdMessage: true,
    });
    expect(second).toMatchObject({
      success: true,
      inquiryType: 'admin_support',
      guestId,
      hostId: null,
      createdThread: true,
      createdMessage: true,
    });
    expect(String(first.inquiryId)).not.toBe(String(second.inquiryId));
    createdInquiryIds.push(first.inquiryId, second.inquiryId);
  });

  test('admin_initiated_support openOnly does not reuse a resolved support thread', async ({ page }) => {
    const adminUser = createUser('admin');
    const guestUser = createUser('guest');

    const adminId = await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestId = await createAuthUser(guestUser);
    const resolvedInquiryId = await createAdminSupportInquiry({
      guestId,
      status: 'resolved',
      content: `resolved support ${Date.now()}`,
    });

    await login(page, adminUser);

    const response = await page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'admin_initiated_support',
        guestId,
        openOnly: true,
      },
    });

    expect(response.ok()).toBeTruthy();
    const json = await response.json();

    expect(json).toMatchObject({
      success: true,
      inquiryType: 'admin_support',
      guestId,
      hostId: adminId,
      createdThread: true,
      createdMessage: false,
    });
    expect(Number(json.inquiryId)).not.toBe(resolvedInquiryId);

    createdInquiryIds.push(Number(json.inquiryId));

    const createdInquiry = await readInquiry(json.inquiryId);
    expect(createdInquiry).toMatchObject({
      id: json.inquiryId,
      user_id: guestId,
      host_id: adminId,
      type: 'admin_support',
      content: '관리자가 문의를 시작했습니다.',
    });
    expect(createdInquiry?.status ?? null).not.toBe('resolved');
  });

  test('admin-initiated guest support reuses the open thread and emits only chat notifications', async ({ page }) => {
    const adminUser = createUser('guest-support-admin');
    const guestUser = createUser('guest-support-recipient');
    const adminId = await createAuthUser(adminUser, { whitelistAdmin: true });
    const guestId = await createAuthUser(guestUser);
    const firstMessage = `guest support first ${Date.now()}`;
    const secondMessage = `guest support second ${Date.now()}`;

    await login(page, adminUser);

    const firstResponse = await page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'admin_initiated_support',
        guestId,
        message: firstMessage,
        openOnly: true,
      },
    });
    expect(firstResponse.status()).toBe(200);
    const first = await firstResponse.json();
    createdInquiryIds.push(first.inquiryId);

    expect(first).toMatchObject({
      success: true,
      guestId,
      hostId: adminId,
      createdThread: true,
      createdMessage: true,
      redirectUrl: `/admin/dashboard?tab=CHATS&inquiryId=${first.inquiryId}`,
    });

    const secondResponse = await page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'admin_initiated_support',
        guestId,
        message: secondMessage,
        openOnly: true,
      },
    });
    expect(secondResponse.status()).toBe(200);
    const second = await secondResponse.json();
    expect(second).toMatchObject({
      inquiryId: first.inquiryId,
      createdThread: false,
      createdMessage: true,
    });

    const { data: notifications, error: notificationError } = await getAdminClient()
      .from('notifications')
      .select('type, message, link')
      .eq('user_id', guestId)
      .eq('type', 'new_message')
      .eq('link', `/guest/inbox?inquiryId=${first.inquiryId}`);
    if (notificationError) throw notificationError;

    expect(notifications).toHaveLength(2);
    expect(notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'new_message',
        link: `/guest/inbox?inquiryId=${first.inquiryId}`,
      }),
    ]));
    expect(notifications?.some((notification) => notification.message?.includes(firstMessage))).toBe(true);
    expect(notifications?.some((notification) => notification.message?.includes(secondMessage))).toBe(true);
    expect(notifications?.some((notification) => notification.type === 'admin_alert')).toBe(false);
  });

  test('whitelist-only admins keep admin role, routing, and official historical-thread sender behavior', async ({ page }) => {
    const callerAdmin = createUser('whitelist-summary-caller');
    const whitelistAdmin = createUser('whitelist-only-admin');
    const guestUser = createUser('whitelist-routing-guest');
    const hostUser = createUser('whitelist-routing-host');
    await createAuthUser(callerAdmin, { whitelistAdmin: true });
    const whitelistAdminId = await createAuthUser(whitelistAdmin, { whitelistAdmin: true });
    const guestId = await createAuthUser(guestUser);
    const hostId = await createAuthUser(hostUser);
    await setUserRole(hostId, hostUser.email, 'host');

    await login(page, callerAdmin);
    const summaryResponse = await page.request.get('/api/admin/users-summary');
    expect(summaryResponse.status()).toBe(200);
    const summary = await summaryResponse.json();
    expect(summary.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: whitelistAdminId, role: 'admin' }),
    ]));

    const adminRecipientInquiryId = await createAdminSupportInquiry({
      guestId,
      hostId: whitelistAdminId,
      content: `whitelist admin recipient ${Date.now()}`,
    });
    await login(page, guestUser);
    const guestMessage = `route to whitelist admin ${Date.now()}`;
    const guestResponse = await page.request.post('/api/inquiries/message', {
      data: { inquiryId: adminRecipientInquiryId, content: guestMessage, type: 'text' },
    });
    expect(guestResponse.status()).toBe(200);

    const { data: adminRecipientNotification, error: adminRecipientNotificationError } = await getAdminClient()
      .from('notifications')
      .select('type, link')
      .eq('user_id', whitelistAdminId)
      .eq('type', 'new_message')
      .eq('link', `/admin/dashboard?tab=CHATS&inquiryId=${adminRecipientInquiryId}`)
      .maybeSingle();
    if (adminRecipientNotificationError) throw adminRecipientNotificationError;
    expect(adminRecipientNotification).toMatchObject({ type: 'new_message' });

    const historicalInquiryId = await createAdminSupportInquiry({
      guestId: whitelistAdminId,
      hostId,
      type: 'admin',
      content: `historical whitelist admin ${Date.now()}`,
    });
    createdAuditTargetIds.push(String(historicalInquiryId));
    await login(page, whitelistAdmin);
    const historicalMessage = `official historical reply ${Date.now()}`;
    const historicalResponse = await page.request.post('/api/inquiries/message', {
      data: { inquiryId: historicalInquiryId, content: historicalMessage, type: 'text' },
    });
    expect(historicalResponse.status()).toBe(200);

    const { data: hostNotification, error: hostNotificationError } = await getAdminClient()
      .from('notifications')
      .select('type, title, message, link')
      .eq('user_id', hostId)
      .eq('type', 'new_message')
      .eq('link', `/host/dashboard?tab=inquiries&inquiryId=${historicalInquiryId}`)
      .maybeSingle();
    if (hostNotificationError) throw hostNotificationError;
    expect(hostNotification).toMatchObject({ type: 'new_message' });
    expect(hostNotification?.title).toContain('Locally Support');
    expect(hostNotification?.message).toContain(historicalMessage);

    const { data: auditLog, error: auditLogError } = await getAdminClient()
      .from('admin_audit_logs')
      .select('action_type, admin_id, target_id')
      .eq('target_id', String(historicalInquiryId))
      .eq('action_type', 'ADMIN_CS_MESSAGE_SEND')
      .maybeSingle();
    if (auditLogError) throw auditLogError;
    expect(auditLog).toMatchObject({
      action_type: 'ADMIN_CS_MESSAGE_SEND',
      admin_id: whitelistAdminId,
      target_id: String(historicalInquiryId),
    });
  });

  test('host support uses the host inbox for admin messages and ChatMonitor for the host reply', async ({ page }) => {
    const adminUser = createUser('host-support-admin');
    const secondAdminUser = createUser('host-support-second-admin');
    const hostUser = createUser('host-support-recipient');
    const adminId = await createAuthUser(adminUser, { whitelistAdmin: true });
    await createAuthUser(secondAdminUser, { whitelistAdmin: true });
    const hostId = await createAuthUser(hostUser);
    await setUserRole(hostId, hostUser.email, 'host');

    const firstMessage = `host support first ${Date.now()}`;
    const hostReply = `host support reply ${Date.now()}`;
    const adminFollowUp = `host support follow-up ${Date.now()}`;

    await login(page, adminUser);
    const firstResponse = await page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'admin_initiated_support',
        guestId: hostId,
        message: firstMessage,
        openOnly: true,
      },
    });
    expect(firstResponse.status()).toBe(200);
    const first = await firstResponse.json();
    createdInquiryIds.push(first.inquiryId);

    const { data: firstNotification, error: firstNotificationError } = await getAdminClient()
      .from('notifications')
      .select('type, title, link')
      .eq('user_id', hostId)
      .eq('link', `/host/dashboard?tab=inquiries&inquiryId=${first.inquiryId}`)
      .maybeSingle();
    if (firstNotificationError) throw firstNotificationError;
    expect(firstNotification).toMatchObject({ type: 'new_message' });
    expect(firstNotification?.title).toContain('Locally Support');

    await login(page, hostUser);
    await page.goto(`/host/dashboard?tab=inquiries&inquiryId=${first.inquiryId}`, { waitUntil: 'networkidle' });
    await expect(page.getByText(/Locally Support|로컬리 고객센터/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(firstMessage, { exact: true })).toBeVisible({ timeout: 15000 });

    const replyResponse = await page.request.post('/api/inquiries/message', {
      data: { inquiryId: first.inquiryId, content: hostReply, type: 'text' },
    });
    expect(replyResponse.status()).toBe(200);

    const { data: adminNotification, error: adminNotificationError } = await getAdminClient()
      .from('notifications')
      .select('type, link')
      .eq('user_id', adminId)
      .eq('link', `/admin/dashboard?tab=CHATS&inquiryId=${first.inquiryId}`)
      .maybeSingle();
    if (adminNotificationError) throw adminNotificationError;
    expect(adminNotification).toMatchObject({ type: 'new_message' });

    await login(page, secondAdminUser);
    const followUpResponse = await page.request.post('/api/inquiries/message', {
      data: { inquiryId: first.inquiryId, content: adminFollowUp, type: 'text' },
    });
    expect(followUpResponse.status()).toBe(200);

    const { data: followUpNotifications, error: followUpNotificationError } = await getAdminClient()
      .from('notifications')
      .select('type, title, message, link')
      .eq('user_id', hostId)
      .eq('type', 'new_message')
      .eq('link', `/host/dashboard?tab=inquiries&inquiryId=${first.inquiryId}`);
    if (followUpNotificationError) throw followUpNotificationError;
    const followUpNotification = followUpNotifications?.find((notification) =>
      notification.message?.includes(adminFollowUp)
    );
    expect(followUpNotification).toMatchObject({ type: 'new_message' });
    expect(followUpNotification?.title).toContain('Locally Support');
  });

  test('rejects non-admin initiation and an empty admin message', async ({ page }) => {
    const guestUser = createUser('forbidden-support-initiator');
    const targetUser = createUser('forbidden-support-target');
    const adminUser = createUser('empty-support-admin');
    await createAuthUser(guestUser);
    const targetId = await createAuthUser(targetUser);
    await createAuthUser(adminUser, { whitelistAdmin: true });

    await login(page, guestUser);
    const forbiddenResponse = await page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'admin_initiated_support',
        guestId: targetId,
        message: 'forbidden',
        openOnly: true,
      },
    });
    expect(forbiddenResponse.status()).toBe(403);

    await login(page, adminUser);
    const emptyResponse = await page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'admin_initiated_support',
        guestId: targetId,
        message: '   ',
      },
    });
    expect(emptyResponse.status()).toBe(400);
  });

  test('service_request start-chat scopes inquiries by request id when service_request_id is available', async ({ page }) => {
    test.skip(!(await supportsServiceRequestId()), 'service_request_id capability is unavailable in this environment.');

    const guestUser = createUser('service-guest');
    const hostUser = createUser('service-host');

    const guestId = await createAuthUser(guestUser);
    const hostId = await createAuthUser(hostUser);
    const requestAId = await createServiceRequest({
      guestId,
      guest: guestUser,
      hostId,
      label: 'request-a',
    });
    const requestBId = await createServiceRequest({
      guestId,
      guest: guestUser,
      hostId,
      label: 'request-b',
    });

    await login(page, guestUser);

    const [responseA, responseB] = await Promise.all([
      page.request.post('/api/services/start-chat', { data: { requestId: requestAId } }),
      page.request.post('/api/services/start-chat', { data: { requestId: requestBId } }),
    ]);

    expect(responseA.ok()).toBeTruthy();
    expect(responseB.ok()).toBeTruthy();

    const jsonA = await responseA.json();
    const jsonB = await responseB.json();

    expect(jsonA.success).toBe(true);
    expect(jsonB.success).toBe(true);
    expect(String(jsonA.inquiryId)).not.toBe(String(jsonB.inquiryId));

    createdInquiryIds.push(String(jsonA.inquiryId));
    createdInquiryIds.push(String(jsonB.inquiryId));

    const [inquiryA, inquiryB] = await Promise.all([
      readInquiry(jsonA.inquiryId),
      readInquiry(jsonB.inquiryId),
    ]);

    expect(inquiryA).toMatchObject({
      user_id: guestId,
      host_id: hostId,
      service_request_id: requestAId,
    });
    expect(inquiryB).toMatchObject({
      user_id: guestId,
      host_id: hostId,
      service_request_id: requestBId,
    });
  });

  test('proxy booking comments fail closed when linked inquiry is missing', async ({ page }) => {
    const guestUser = createUser('proxy-guest');
    const guestId = await createAuthUser(guestUser);
    const requestId = await createProxyRequestWithoutLinkedInquiry(guestId, guestUser);

    await login(page, guestUser);

    const response = await page.request.post(`/api/proxy-bookings/${requestId}/comments`, {
      data: {
        content: `linked inquiry missing ${Date.now()}`,
      },
    });

    expect(response.status()).toBe(409);
    const json = await response.json();
    expect(json).toMatchObject({
      success: false,
      error: '연결된 1:1 문의를 찾을 수 없습니다.',
    });
  });

  test('proxy booking detail keeps lightweight read available but fails closed for thread reads when linked inquiry is missing', async ({ page }) => {
    const guestUser = createUser('proxy-detail-guest');
    const guestId = await createAuthUser(guestUser);
    const requestId = await createProxyRequestWithoutLinkedInquiry(guestId, guestUser);

    await login(page, guestUser);

    const lightweightResponse = await page.request.get(`/api/proxy-bookings/${requestId}?includeComments=false`);
    expect(lightweightResponse.status()).toBe(200);

    const lightweightJson = await lightweightResponse.json();
    expect(lightweightJson).toMatchObject({
      success: true,
      data: {
        id: requestId,
        linked_inquiry_id: null,
      },
      viewerIsAdmin: false,
    });

    const threadedResponse = await page.request.get(`/api/proxy-bookings/${requestId}`);
    expect(threadedResponse.status()).toBe(409);

    const threadedJson = await threadedResponse.json();
    expect(threadedJson).toMatchObject({
      success: false,
      error: '연결된 1:1 문의를 찾을 수 없습니다.',
    });
  });

  test('proxy booking self-service cancel stays fail-closed once payment is already completed', async ({ page }) => {
    const guestUser = createUser('proxy-paid-cancel');
    const guestId = await createAuthUser(guestUser);
    const requestId = await createProxyRequestWithoutLinkedInquiry(guestId, guestUser, {
      paymentStatus: 'COMPLETED',
    });

    await login(page, guestUser);

    const response = await page.request.patch(`/api/proxy-bookings/${requestId}`, {
      data: {
        status: 'CANCELLED',
      },
    });

    expect(response.status()).toBe(409);
    const json = await response.json();
    expect(json).toMatchObject({
      success: false,
      error: '결제 대기 상태에서만 요청을 취소할 수 있습니다.',
    });

    const { data: currentRequest, error } = await getAdminClient()
      .from('proxy_requests')
      .select('status, payment_status')
      .eq('id', requestId)
      .maybeSingle();

    if (error) throw error;
    expect(currentRequest).toMatchObject({
      status: 'PENDING',
      payment_status: 'COMPLETED',
    });
  });
});
