import { existsSync, readFileSync, rmSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

type CapturedMail = {
  to?: string | string[];
  subject?: string;
  html?: string;
};

type UnreadBatchRow = {
  inquiry_id: number;
  is_active: boolean;
  first_unread_message_id: number | null;
  first_unread_message_at: string | null;
  last_unread_message_id: number | null;
  last_unread_message_at: string | null;
  alert_due_at: string | null;
  in_app_sent_at: string | null;
  email_sent_at: string | null;
  processing_started_at: string | null;
};

const UNREAD_ALERT_IN_APP_AUDIT_ACTION = 'ADMIN_SUPPORT_UNREAD_ALERT_IN_APP_SENT';
const UNREAD_ALERT_EMAIL_AUDIT_ACTION = 'ADMIN_SUPPORT_UNREAD_ALERT_EMAIL_SENT';

const TEST_PASSWORD = 'LocallyTest!2026';
const CRON_SECRET = process.env.CRON_SECRET || 'codex-cron-secret';
const ALERT_TITLE = '고객센터 1:1 문의 미읽음';
const ALERT_SUBJECT = '[Locally Admin] 고객센터 1:1 문의 미읽음';
const MAIL_CAPTURE_PATH = '/tmp/locally-mock-nodemailer.jsonl';

let adminClient: SupabaseClient | null = null;
let supportsUnreadBatchTablePromise: Promise<boolean> | null = null;

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
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
    fullName: `${prefix.replace(/\./g, ' ')} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function readCapturedAdminSupportAlertEmails() {
  if (!existsSync(MAIL_CAPTURE_PATH)) {
    return [] as CapturedMail[];
  }

  return readFileSync(MAIL_CAPTURE_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CapturedMail)
    .filter((mail) => mail.subject === ALERT_SUBJECT);
}

function countCapturedAdminSupportAlertEmailsForRecipients(emails: string[]) {
  const recipientSet = new Set(emails.map((email) => email.trim().toLowerCase()));

  return readCapturedAdminSupportAlertEmails().filter((mail) => {
    const recipients = Array.isArray(mail.to) ? mail.to : [mail.to];
    return recipients.some((value) => {
      if (typeof value !== 'string') return false;
      return recipientSet.has(value.trim().toLowerCase());
    });
  }).length;
}

function resetMailCapture() {
  rmSync(MAIL_CAPTURE_PATH, { force: true });
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

async function login(page: Page, user: TestUser) {
  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function createAdminSupportInquiry(page: Page, message: string) {
  const response = await page.request.post('/api/inquiries/thread', {
    data: {
      contextType: 'admin_support',
      message,
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.json() as {
    success: boolean;
    inquiryId: number | string;
    createdMessage: boolean;
  };
  expect(body.success).toBe(true);
  expect(body.createdMessage).toBe(true);
  return Number(body.inquiryId);
}

async function sendInquiryMessage(page: Page, inquiryId: number, content: string) {
  const response = await page.request.post('/api/inquiries/message', {
    data: {
      inquiryId,
      content,
      type: 'text',
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.json() as {
    success: boolean;
  };
  expect(body.success).toBe(true);
}

async function supportsUnreadBatchTable() {
  if (!supportsUnreadBatchTablePromise) {
    supportsUnreadBatchTablePromise = (async () => {
      const { error } = await getAdminClient()
        .from('admin_support_unread_alert_batches')
        .select('inquiry_id')
        .limit(1);

      if (!error) return true;
      if (error.message.includes('admin_support_unread_alert_batches')) return false;
      throw error;
    })();
  }

  return supportsUnreadBatchTablePromise;
}

async function readUnreadBatch(inquiryId: number) {
  if (!(await supportsUnreadBatchTable())) {
    return null;
  }

  const { data, error } = await getAdminClient()
    .from('admin_support_unread_alert_batches')
    .select(
      'inquiry_id, is_active, first_unread_message_id, first_unread_message_at, last_unread_message_id, last_unread_message_at, alert_due_at, in_app_sent_at, email_sent_at, processing_started_at'
    )
    .eq('inquiry_id', inquiryId)
    .maybeSingle<UnreadBatchRow>();

  if (error) throw error;
  return data;
}

async function setBatchDueNow(params: {
  inquiryId: number;
  guestId: string;
  mode: 'table' | 'message';
}) {
  if (params.mode === 'message') {
    const { error } = await getAdminClient()
      .from('inquiry_messages')
      .update({
        created_at: new Date(Date.now() - 11 * 60_000).toISOString(),
      })
      .eq('inquiry_id', params.inquiryId)
      .eq('sender_id', params.guestId)
      .is('read_at', null);

    if (error) throw error;
    return;
  }

  const { error } = await getAdminClient()
    .from('admin_support_unread_alert_batches')
    .update({
      alert_due_at: new Date(Date.now() - 60_000).toISOString(),
      processing_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('inquiry_id', params.inquiryId);

  if (error) throw error;
}

async function countAdminAlerts(userIds: string[]) {
  const { count, error } = await getAdminClient()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .in('user_id', userIds)
    .eq('type', 'admin_alert')
    .eq('title', ALERT_TITLE);

  if (error) throw error;
  return count || 0;
}

async function countUnreadCustomerMessages(inquiryId: number, guestId: string) {
  const { count, error } = await getAdminClient()
    .from('inquiry_messages')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_id', inquiryId)
    .eq('sender_id', guestId)
    .is('read_at', null);

  if (error) throw error;
  return count || 0;
}

async function createGeneralInquiry(params: {
  guestId: string;
  hostId: string;
  message: string;
}) {
  const now = new Date().toISOString();
  const { data: inquiry, error: inquiryError } = await getAdminClient()
    .from('inquiries')
    .insert({
      user_id: params.guestId,
      host_id: params.hostId,
      type: 'general',
      status: 'open',
      content: params.message,
      updated_at: now,
    })
    .select('id')
    .single();

  if (inquiryError || !inquiry?.id) {
    throw inquiryError || new Error('Failed to create general inquiry.');
  }

  createdInquiryIds.push(Number(inquiry.id));

  const { data: insertedMessage, error: messageError } = await getAdminClient()
    .from('inquiry_messages')
    .insert({
      inquiry_id: inquiry.id,
      sender_id: params.guestId,
      content: params.message,
      type: 'text',
      is_read: false,
    })
    .select('id')
    .single();

  if (messageError || !insertedMessage?.id) {
    throw messageError || new Error('Failed to seed general inquiry message.');
  }

  createdInquiryMessageIds.push(Number(insertedMessage.id));
  return Number(inquiry.id);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdInquiryIds.length > 0) {
    await supabase.from('inquiry_messages').delete().in('inquiry_id', createdInquiryIds);
    if (await supportsUnreadBatchTable()) {
      await supabase.from('admin_support_unread_alert_batches').delete().in('inquiry_id', createdInquiryIds);
    }
    await supabase.from('inquiries').delete().in('id', createdInquiryIds);
    await supabase
      .from('admin_audit_logs')
      .delete()
      .eq('target_type', 'inquiries')
      .in('target_id', createdInquiryIds.map(String))
      .in('action_type', [UNREAD_ALERT_IN_APP_AUDIT_ACTION, UNREAD_ALERT_EMAIL_AUDIT_ACTION]);
  }

  if (createdInquiryMessageIds.length > 0) {
    await supabase.from('inquiry_messages').delete().in('id', createdInquiryMessageIds);
  }

  if (createdAuthUserIds.length > 0) {
    await supabase.from('notifications').delete().in('user_id', createdAuthUserIds);
  }

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }

  resetMailCapture();
});

test.describe.serial('Admin support unread alerts', () => {
  test('guards the cron route with CRON_SECRET', async ({ request }) => {
    const noAuth = await request.get('/api/cron/admin-support-unread-alerts');
    expect(noAuth.status()).toBe(401);

    const wrongAuth = await request.get('/api/cron/admin-support-unread-alerts', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    expect(wrongAuth.status()).toBe(401);
  });

  test('sends one admin alert + team email after 10 minutes of unread customer support inquiry and resets after admin read', async ({ browser, request }) => {
    test.setTimeout(120000);

    const adminA = createUser('admin.support.alerts.a');
    const adminB = createUser('admin.support.alerts.b');
    const guest = createUser('guest.support.alerts');

    const adminAId = await createAuthUser(adminA, { whitelistAdmin: true });
    const adminBId = await createAuthUser(adminB, { whitelistAdmin: true });
    const guestId = await createAuthUser(guest);
    const recipientIds = [adminAId, adminBId];
    const recipientEmails = [adminA.email, adminB.email];
    const hasBatchTable = await supportsUnreadBatchTable();

    resetMailCapture();

    const guestPage = await browser.newPage();
    const adminPage = await browser.newPage();

    try {
      await login(guestPage, guest);

      const firstMessage = `고객센터 첫 문의 ${Date.now()}`;
      const inquiryId = await createAdminSupportInquiry(guestPage, firstMessage);
      createdInquiryIds.push(inquiryId);

      expect(await countAdminAlerts(recipientIds)).toBe(0);
      expect(countCapturedAdminSupportAlertEmailsForRecipients(recipientEmails)).toBe(0);

      if (hasBatchTable) {
        const firstBatch = await readUnreadBatch(inquiryId);
        expect(firstBatch?.is_active).toBe(true);
        expect(firstBatch?.in_app_sent_at).toBeNull();
        expect(firstBatch?.email_sent_at).toBeNull();
        expect(firstBatch?.alert_due_at).toBeTruthy();
      }

      await setBatchDueNow({
        inquiryId,
        guestId,
        mode: hasBatchTable ? 'table' : 'message',
      });

      const firstCronResponse = await request.get('/api/cron/admin-support-unread-alerts', {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });

      expect(firstCronResponse.status()).toBe(200);
      const firstCronBody = await firstCronResponse.json() as Record<string, unknown>;
      expect(firstCronBody.success).toBe(true);

      await expect.poll(async () => countAdminAlerts(recipientIds), {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      }).toBe(2);

      await expect.poll(async () => countCapturedAdminSupportAlertEmailsForRecipients(recipientEmails), {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      }).toBe(2);

      if (hasBatchTable) {
        const alertedBatch = await readUnreadBatch(inquiryId);
        expect(alertedBatch?.in_app_sent_at).toBeTruthy();
        expect(alertedBatch?.email_sent_at).toBeTruthy();
      }

      const secondMessage = `같은 unread 배치 추가 메시지 ${Date.now()}`;
      await sendInquiryMessage(guestPage, inquiryId, secondMessage);

      if (hasBatchTable) {
        const batchAfterSecondCustomerMessage = await readUnreadBatch(inquiryId);
        expect(batchAfterSecondCustomerMessage?.is_active).toBe(true);
        expect(batchAfterSecondCustomerMessage?.in_app_sent_at).toBeTruthy();
        expect(batchAfterSecondCustomerMessage?.email_sent_at).toBeTruthy();

        await setBatchDueNow({
          inquiryId,
          guestId,
          mode: 'table',
        });
      }

      const secondCronResponse = await request.get('/api/cron/admin-support-unread-alerts', {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });

      expect(secondCronResponse.status()).toBe(200);
      const secondCronBody = await secondCronResponse.json() as Record<string, unknown>;
      expect(secondCronBody.success).toBe(true);
      expect(await countAdminAlerts(recipientIds)).toBe(2);
      expect(countCapturedAdminSupportAlertEmailsForRecipients(recipientEmails)).toBe(2);

      await login(adminPage, adminA);
      await adminPage.goto(`/admin/dashboard?tab=CHATS&inquiryId=${inquiryId}`, { waitUntil: 'domcontentloaded' });

      await expect(
        adminPage.locator('div.bg-white.border.border-slate-200.rounded-tl-none').filter({ hasText: secondMessage }).last()
      ).toBeVisible({ timeout: 15000 });

      await expect.poll(async () => countUnreadCustomerMessages(inquiryId, guestId), {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      }).toBe(0);

      await expect.poll(async () => {
        const row = await readUnreadBatch(inquiryId);
        return row?.is_active ?? false;
      }, {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      }).toBe(false);

      await adminPage.close();

      const thirdMessage = `읽은 뒤 새 unread 배치 ${Date.now()}`;
      await sendInquiryMessage(guestPage, inquiryId, thirdMessage);

      if (hasBatchTable) {
        const restartedBatch = await readUnreadBatch(inquiryId);
        expect(restartedBatch?.is_active).toBe(true);
        expect(restartedBatch?.in_app_sent_at).toBeNull();
        expect(restartedBatch?.email_sent_at).toBeNull();
      }

      await setBatchDueNow({
        inquiryId,
        guestId,
        mode: hasBatchTable ? 'table' : 'message',
      });

      const thirdCronResponse = await request.get('/api/cron/admin-support-unread-alerts', {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });

      expect(thirdCronResponse.status()).toBe(200);
      const thirdCronBody = await thirdCronResponse.json() as Record<string, unknown>;
      expect(thirdCronBody.success).toBe(true);

      await expect.poll(async () => countAdminAlerts(recipientIds), {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      }).toBe(4);

      await expect.poll(async () => countCapturedAdminSupportAlertEmailsForRecipients(recipientEmails), {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      }).toBe(4);

      const generalInquiryId = await createGeneralInquiry({
        guestId,
        hostId: adminAId,
        message: `일반 문의 초기 메시지 ${Date.now()}`,
      });

      await sendInquiryMessage(guestPage, generalInquiryId, `일반 문의 후속 메시지 ${Date.now()}`);

      if (hasBatchTable) {
        expect(await readUnreadBatch(generalInquiryId)).toBeNull();
      }
      expect(await countAdminAlerts(recipientIds)).toBe(4);
      expect(countCapturedAdminSupportAlertEmailsForRecipients(recipientEmails)).toBe(4);
    } finally {
      await guestPage.close();
      if (!adminPage.isClosed()) {
        await adminPage.close();
      }
    }
  });
});
