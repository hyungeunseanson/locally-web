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
const createdProxyRequestIds: string[] = [];
const createdInquiryIds: string[] = [];
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

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.proxy.locale.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Proxy Locale ${prefix} ${timestamp}`,
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

async function setPreferredLocale(userId: string, locale: 'ko' | 'en' | 'ja' | 'zh') {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw error || new Error(`Failed to fetch auth user ${userId}.`);

  const metadata =
    data.user.user_metadata && typeof data.user.user_metadata === 'object'
      ? (data.user.user_metadata as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...metadata,
      preferred_locale: locale,
    },
  });

  if (updateError) throw updateError;
}

async function createAdminSupportInquiry(userId: string) {
  const { data, error } = await getAdminClient()
    .from('inquiries')
    .insert({
      user_id: userId,
      host_id: null,
      experience_id: null,
      content: '전화 예약 알림 로컬라이제이션 검증용 문의방입니다.',
      type: 'admin_support',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create admin support inquiry fixture.');
  }

  const inquiryId = String(data.id);
  createdInquiryIds.push(inquiryId);
  return inquiryId;
}

async function createProxyRequest(params: {
  userId: string;
  user: TestUser;
  includeLinkedInquiry?: boolean;
  paymentMethod?: 'bank' | 'card';
  paymentStatus?: 'WAITING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  requestStatus?: 'PENDING' | 'IN_PROGRESS' | 'CANCELLED' | 'COMPLETED';
  tid?: string | null;
}) {
  const linkedInquiryId = params.includeLinkedInquiry
    ? await createAdminSupportInquiry(params.userId)
    : null;
  const paymentMethod = params.paymentMethod || 'bank';
  const paymentStatus = params.paymentStatus || 'WAITING';
  const requestStatus = params.requestStatus || 'PENDING';

  const { data, error } = await getAdminClient()
    .from('proxy_requests')
    .insert({
      user_id: params.userId,
      category: 'RESTAURANT',
      status: requestStatus,
      payment_channel: 'LOCALLY',
      payment_status: paymentStatus,
      locally_order_id: `LOCALLY-PROXY-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      agreed_to_terms: true,
      ...(params.tid !== undefined ? { tid: params.tid } : {}),
      form_data: {
        restaurant_name: `테스트 스시 ${Date.now()}`,
        preferred_slot_primary: '2026-01-15T19:00',
        reservation_name: params.user.fullName,
        guest_number: 2,
        korean_contact: params.user.phone,
        payment_method: paymentMethod,
        contact_name: params.user.fullName,
        contact_phone: params.user.phone,
        service_fee_krw: 4500,
        ...(linkedInquiryId ? { linked_inquiry_id: linkedInquiryId } : {}),
      },
    })
    .select('id, form_data')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create proxy request.');
  }

  createdProxyRequestIds.push(String(data.id));
  return {
    requestId: String(data.id),
    restaurantName: String((data.form_data as Record<string, unknown>)?.restaurant_name || ''),
    linkedInquiryId,
  };
}

async function login(page: Page, user: TestUser, locale: 'ko' | 'en' | 'ja' | 'zh') {
  await page.context().clearCookies();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((nextLocale) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('app_lang', nextLocale);
    document.cookie = `app_lang=${nextLocale}; path=/; samesite=lax`;
  }, locale);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');
}

async function waitForNotification(params: {
  userId: string;
  type: string;
  link: string;
}) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, link')
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

  throw new Error(`Notification not found for ${params.userId} / ${params.type} / ${params.link}.`);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  if (createdInquiryIds.length > 0) {
    await supabase.from('inquiry_messages').delete().in('inquiry_id', createdInquiryIds);
  }

  if (createdProxyRequestIds.length > 0) {
    await supabase.from('proxy_comments').delete().in('request_id', createdProxyRequestIds);
    await supabase.from('proxy_requests').delete().in('id', createdProxyRequestIds);
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

test.describe.serial('Proxy notification localization', () => {
  test('localizes proxy payment confirmation and admin reply notifications by recipient locale', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createUser('admin');
    const paymentGuest = createUser('payment-guest');
    const replyGuest = createUser('reply-guest');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const paymentGuestId = await createAuthUser(paymentGuest);
    const replyGuestId = await createAuthUser(replyGuest);

    await setPreferredLocale(paymentGuestId, 'en');
    await setPreferredLocale(replyGuestId, 'ja');

    const paymentRequest = await createProxyRequest({
      userId: paymentGuestId,
      user: paymentGuest,
      includeLinkedInquiry: true,
    });
    const replyRequest = await createProxyRequest({
      userId: replyGuestId,
      user: replyGuest,
      includeLinkedInquiry: true,
    });

    await login(page, adminUser, 'ko');

    const confirmResponse = await page.request.post('/api/admin/proxy-bookings/confirm-payment', {
      data: {
        requestId: paymentRequest.requestId,
      },
    });
    expect(confirmResponse.status()).toBe(200);

    const paymentNotification = await waitForNotification({
      userId: paymentGuestId,
      type: 'booking_confirmed',
      link: `/guest/inbox?inquiryId=${encodeURIComponent(paymentRequest.linkedInquiryId || '')}`,
    });
    expect(paymentNotification.title).toBe('Phone booking payment was confirmed.');
    expect(paymentNotification.message).toContain(paymentRequest.restaurantName);

    const replyText = `担当チームよりご案内します。${Date.now()}`;
    const commentResponse = await page.request.post(`/api/proxy-bookings/${replyRequest.requestId}/comments`, {
      data: {
        content: replyText,
      },
    });
    expect(commentResponse.status()).toBe(200);

    const replyNotification = await waitForNotification({
      userId: replyGuestId,
      type: 'new_message',
      link: `/guest/inbox?inquiryId=${encodeURIComponent(replyRequest.linkedInquiryId || '')}`,
    });
    expect(replyNotification.title).toBe('💬 Locally Supportから新しいメッセージ');
    expect(replyNotification.message).toBe(replyText);
  });

  test('localizes proxy payment cancellation notifications and writes FAILED/CANCELLED state', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createUser('cancel-admin');
    const cancelGuest = createUser('cancel-guest');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const cancelGuestId = await createAuthUser(cancelGuest);
    await setPreferredLocale(cancelGuestId, 'en');

    const cancelRequest = await createProxyRequest({
      userId: cancelGuestId,
      user: cancelGuest,
      includeLinkedInquiry: true,
      paymentMethod: 'bank',
      paymentStatus: 'WAITING',
      requestStatus: 'PENDING',
    });

    await login(page, adminUser, 'ko');

    const cancelResponse = await page.request.post('/api/admin/proxy-bookings/cancel-payment', {
      data: {
        requestId: cancelRequest.requestId,
      },
    });
    expect(cancelResponse.status()).toBe(200);

    const { data: cancelledRow, error: cancelledRowError } = await getAdminClient()
      .from('proxy_requests')
      .select('payment_status, status')
      .eq('id', cancelRequest.requestId)
      .maybeSingle();

    if (cancelledRowError) throw cancelledRowError;
    expect(cancelledRow).toMatchObject({
      payment_status: 'FAILED',
      status: 'CANCELLED',
    });

    const cancelNotification = await waitForNotification({
      userId: cancelGuestId,
      type: 'cancellation',
      link: `/guest/inbox?inquiryId=${encodeURIComponent(cancelRequest.linkedInquiryId || '')}`,
    });
    expect(cancelNotification.title).toBe('Phone booking payment was cancelled.');
    expect(cancelNotification.message).toContain(cancelRequest.restaurantName);
  });

  test('localizes proxy payment refund notifications and writes REFUNDED state', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createUser('refund-admin');
    const refundGuest = createUser('refund-guest');

    await createAuthUser(adminUser, { whitelistAdmin: true });
    const refundGuestId = await createAuthUser(refundGuest);
    await setPreferredLocale(refundGuestId, 'ja');

    const refundRequest = await createProxyRequest({
      userId: refundGuestId,
      user: refundGuest,
      includeLinkedInquiry: true,
      paymentMethod: 'bank',
      paymentStatus: 'COMPLETED',
      requestStatus: 'PENDING',
    });

    await login(page, adminUser, 'ko');

    const refundResponse = await page.request.post('/api/admin/proxy-bookings/refund-payment', {
      data: {
        requestId: refundRequest.requestId,
      },
    });
    expect(refundResponse.status()).toBe(200);

    const { data: refundedRow, error: refundedRowError } = await getAdminClient()
      .from('proxy_requests')
      .select('payment_status')
      .eq('id', refundRequest.requestId)
      .maybeSingle();

    if (refundedRowError) throw refundedRowError;
    expect(refundedRow).toMatchObject({
      payment_status: 'REFUNDED',
    });

    const refundNotification = await waitForNotification({
      userId: refundGuestId,
      type: 'cancellation',
      link: `/guest/inbox?inquiryId=${encodeURIComponent(refundRequest.linkedInquiryId || '')}`,
    });
    expect(refundNotification.title).toBe('電話予約の決済が返金処理されました。');
    expect(refundNotification.message).toContain(refundRequest.restaurantName);
  });
});
