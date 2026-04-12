import crypto from 'crypto';
import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

import { POST as proxyNicePayCallbackPost } from '@/app/api/proxy-bookings/payment/nicepay-callback/route';
import { POST as proxyCardNotificationPost } from '@/app/api/proxy-bookings/payment/card-notification/route';
import * as proxyBookingNotifications from '@/app/utils/proxyBookingNotifications';
import {
  buildNicePayLaunchFields,
  getCardPaymentReadiness,
  verifyApprovedCardPayment,
  verifyCardPaymentNotification,
  readCardPaymentNotificationRequest,
} from '@/app/utils/payments/card/server';
import * as supabaseServerModule from '@/app/utils/supabase/server';

const NICEPAY_STATUS_QUERY_URL = 'https://pg-api.nicepay.co.kr/webapi/common/trans_status.jsp';
const TEST_PASSWORD = 'LocallyTest!2026';
const ORIGINAL_ENV = {
  CARD_PAYMENT_PROVIDER: process.env.CARD_PAYMENT_PROVIDER,
  NICEPAY_MID: process.env.NICEPAY_MID,
  NICEPAY_MERCHANT_KEY: process.env.NICEPAY_MERCHANT_KEY,
  NICEPAY_CLIENT_KEY: process.env.NICEPAY_CLIENT_KEY,
  NEXT_PUBLIC_NICEPAY_CLIENT_KEY: process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY,
};
let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdProxyRequestIds: string[] = [];
const createdInquiryIds: string[] = [];

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

function sha256Hex(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
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

function ensureSupabaseEnv() {
  const env = loadEnv();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
}

function getAdminClient() {
  if (adminClient) return adminClient;

  ensureSupabaseEnv();
  adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.nicepay.proxy.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `NicePay Proxy ${prefix} ${timestamp}`,
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

    await new Promise((resolve) => setTimeout(resolve, 300));
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
      email: user.email,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

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
      content: 'NicePay proxy notification route contract fixture.',
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

async function createProxyRequestFixture(params: {
  userId: string;
  user: TestUser;
  paymentStatus?: 'WAITING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  tid?: string | null;
}) {
  const linkedInquiryId = await createAdminSupportInquiry(params.userId);
  const locallyOrderId = `LOCALLY-PROXY-NICEPAY-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const { data, error } = await getAdminClient()
    .from('proxy_requests')
    .insert({
      user_id: params.userId,
      category: 'RESTAURANT',
      status: 'PENDING',
      payment_channel: 'LOCALLY',
      payment_status: params.paymentStatus || 'WAITING',
      locally_order_id: locallyOrderId,
      agreed_to_terms: true,
      ...(params.tid !== undefined ? { tid: params.tid } : {}),
      form_data: {
        restaurant_name: `테스트 스시 ${Date.now()}`,
        preferred_slot_primary: '2026-01-15T19:00',
        reservation_name: params.user.fullName,
        guest_number: 2,
        korean_contact: params.user.phone,
        payment_method: 'card',
        contact_name: params.user.fullName,
        contact_phone: params.user.phone,
        service_fee_krw: 4500,
        linked_inquiry_id: linkedInquiryId,
      },
    })
    .select('id, locally_order_id, form_data')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create proxy request fixture.');
  }

  createdProxyRequestIds.push(String(data.id));
  return {
    requestId: String(data.id),
    orderId: String(data.locally_order_id || ''),
    linkedInquiryId,
    restaurantName: String((data.form_data as Record<string, unknown>)?.restaurant_name || ''),
  };
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });

  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

function withNicePayEnv() {
  process.env.CARD_PAYMENT_PROVIDER = 'nicepay';
  process.env.NICEPAY_MID = 'nicepay-test-mid';
  process.env.NICEPAY_MERCHANT_KEY = 'nicepay-test-merchant-key';
  process.env.NICEPAY_CLIENT_KEY = 'nicepay-server-client-key';
  process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY = 'nicepay-public-client-key';
}

function resetEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test.afterEach(() => {
  resetEnv();
});

test.afterAll(async () => {
  const supabase = getAdminClient();

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

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe('Card payment provider cutover contracts', () => {
  test('rejects unauthenticated proxy callback attempts', async ({ request }) => {
    const response = await request.post('/api/proxy-bookings/payment/nicepay-callback', {
      data: {
        orderId: 'LOCALLY-PROXY-UNAUTH-TEST',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('blocks proxy callback confirmation from a different logged-in user', async ({ page }) => {
    ensureSupabaseEnv();

    const owner = createUser('proxy-callback-owner');
    const other = createUser('proxy-callback-other');
    const ownerId = await createAuthUser(owner);
    await createAuthUser(other);

    const fixture = await createProxyRequestFixture({
      userId: ownerId,
      user: owner,
      paymentStatus: 'WAITING',
    });

    await login(page, other);

    const response = await page.request.post('/api/proxy-bookings/payment/nicepay-callback', {
      data: {
        approvalId: 'TX-TID-PROXY-CROSS-USER',
        merchant_uid: fixture.orderId,
        orderId: fixture.orderId,
      },
    });

    expect(response.status()).toBe(403);
  });

  test('treats already completed proxy callbacks as idempotent', async ({ page }) => {
    ensureSupabaseEnv();

    const owner = createUser('proxy-callback-idempotent');
    const ownerId = await createAuthUser(owner);

    const fixture = await createProxyRequestFixture({
      userId: ownerId,
      user: owner,
      paymentStatus: 'COMPLETED',
      tid: 'TX-TID-PROXY-ALREADY-PROCESSED',
    });

    await login(page, owner);

    const response = await page.request.post('/api/proxy-bookings/payment/nicepay-callback', {
      data: {
        approvalId: 'TX-TID-PROXY-ALREADY-PROCESSED',
        merchant_uid: fixture.orderId,
        orderId: fixture.orderId,
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: 'Already processed',
    });
  });

  test('requires the full NicePay credential bundle before the provider is ready', () => {
    process.env.CARD_PAYMENT_PROVIDER = 'nicepay';
    delete process.env.NICEPAY_MID;
    delete process.env.NICEPAY_MERCHANT_KEY;
    delete process.env.NICEPAY_CLIENT_KEY;
    delete process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY;

    const readiness = getCardPaymentReadiness();

    expect(readiness).toMatchObject({
      provider: 'nicepay',
      ready: false,
      reason: 'missing_nicepay_credentials',
    });
    expect(readiness.missingConfig).toEqual([
      'NICEPAY_MID',
      'NICEPAY_MERCHANT_KEY',
      'NICEPAY_CLIENT_KEY',
      'NEXT_PUBLIC_NICEPAY_CLIENT_KEY',
    ]);
  });

  test('exposes NicePay runtime and signed launch fields once the full bundle exists', () => {
    withNicePayEnv();

    const readiness = getCardPaymentReadiness();
    expect(readiness).toMatchObject({
      provider: 'nicepay',
      ready: true,
      runtime: {
        provider: 'nicepay',
        merchantCode: 'nicepay-test-mid',
        publicClientKey: 'nicepay-public-client-key',
      },
    });
    expect(readiness.runtime?.scriptSrc).toContain('nicepay-pg-web.js');

    const fields = buildNicePayLaunchFields({
      orderId: 'ORD-NICEPAY-001',
      productName: 'Locally Test Product',
      amount: 55000,
      buyerName: '테스트 고객',
      buyerTel: '01012345678',
      buyerEmail: 'test@example.com',
      returnUrl: 'https://locally.example/api/payment/nicepay/relay',
    });

    expect(fields).toMatchObject({
      MID: 'nicepay-test-mid',
      Moid: 'ORD-NICEPAY-001',
      Amt: '55000',
      ReturnURL: 'https://locally.example/api/payment/nicepay/relay',
      PayMethod: 'CARD',
    });
    expect(fields.SignData).toBe(
      sha256Hex(`${fields.EdiDate}${fields.MID}${fields.Amt}${process.env.NICEPAY_MERCHANT_KEY}`)
    );
  });

  test('verifies NicePay approval payloads through the server-side approval API', async () => {
    withNicePayEnv();

    const authToken = 'AUTH-TOKEN-001';
    const amount = 88000;
    const providerPayload = {
      AuthResultCode: '0000',
      AuthToken: authToken,
      TxTid: 'TX-TID-001',
      MID: process.env.NICEPAY_MID!,
      Moid: 'ORD-NICEPAY-VERIFY-001',
      Amt: String(amount),
      NextAppURL: 'https://webapi.nicepay.co.kr/webapi/pay_process.jsp',
      PayMethod: 'CARD',
      Signature: sha256Hex(
        `${authToken}${process.env.NICEPAY_MID}${amount}${process.env.NICEPAY_MERCHANT_KEY}`
      ),
    };

    const originalFetch = global.fetch;
    global.fetch = (async (input, init) => {
      expect(String(input)).toBe('https://webapi.nicepay.co.kr/webapi/pay_process.jsp');
      expect(init?.method).toBe('POST');
      const body = new URLSearchParams(String(init?.body || ''));
      expect(body.get('MID')).toBe(process.env.NICEPAY_MID);
      expect(body.get('AuthToken')).toBe(authToken);
      expect(body.get('Amt')).toBe(String(amount));

      return new Response(
        JSON.stringify({
          ResultCode: '3001',
          ResultMsg: 'Approval complete',
          TID: 'TX-TID-001',
          Moid: 'ORD-NICEPAY-VERIFY-001',
          Amt: String(amount),
          PayMethod: 'CARD',
          Signature: sha256Hex(
            `TX-TID-001${process.env.NICEPAY_MID}${amount}${process.env.NICEPAY_MERCHANT_KEY}`
          ),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const result = await verifyApprovedCardPayment({
        provider: 'nicepay',
        approvalId: 'TX-TID-001',
        orderId: 'ORD-NICEPAY-VERIFY-001',
        expectedAmount: amount,
        providerPayload,
      });

      expect(result).toMatchObject({
        provider: 'nicepay',
        approvedAmount: amount,
        providerTransactionId: 'TX-TID-001',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('verifies NicePay notifications through the transaction status query', async () => {
    withNicePayEnv();

    const notification = await readCardPaymentNotificationRequest(
      new Request('https://locally.example/api/payment/card-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          Moid: 'ORD-NICEPAY-NOTI-001',
          TID: 'TX-TID-NOTI-001',
          Amt: '45000',
          ResultCode: '3001',
          StateCd: '0',
          PayMethod: 'CARD',
        }).toString(),
      })
    );

    const originalFetch = global.fetch;
    global.fetch = (async (input, init) => {
      expect(String(input)).toBe(NICEPAY_STATUS_QUERY_URL);
      expect(init?.method).toBe('POST');
      const body = new URLSearchParams(String(init?.body || ''));
      expect(body.get('MID')).toBe(process.env.NICEPAY_MID);
      expect(body.get('TID')).toBe('TX-TID-NOTI-001');

      return new Response(
        JSON.stringify({
          ResultCode: '0000',
          ResultMsg: 'OK',
          Status: '0',
          TID: 'TX-TID-NOTI-001',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const result = await verifyCardPaymentNotification({
        notification,
        orderId: 'ORD-NICEPAY-NOTI-001',
        expectedAmount: 45000,
      });

      expect(result).toMatchObject({
        provider: 'nicepay',
        approvedAmount: 45000,
        providerTransactionId: 'TX-TID-NOTI-001',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('processes proxy NicePay notification routes by orderId and stays idempotent on replay', async () => {
    ensureSupabaseEnv();
    withNicePayEnv();

    const guest = createUser('proxy-order-id');
    const guestId = await createAuthUser(guest);
    await setPreferredLocale(guestId, 'en');

    const fixture = await createProxyRequestFixture({
      userId: guestId,
      user: guest,
    });

    const originalFetch = global.fetch;
    const originalNotifyProxyPaymentEvent = proxyBookingNotifications.notifyProxyPaymentEvent;
    const capturedEvents: Array<{ event: string; requestId: string }> = [];
    global.fetch = (async (input, init) => {
      if (String(input) === NICEPAY_STATUS_QUERY_URL) {
        expect(init?.method).toBe('POST');
        const body = new URLSearchParams(String(init?.body || ''));
        expect(body.get('MID')).toBe(process.env.NICEPAY_MID);
        expect(body.get('TID')).toBe('TX-TID-PROXY-ORDER-ID');

        return new Response(
          JSON.stringify({
            ResultCode: '0000',
            ResultMsg: 'OK',
            Status: '0',
            TID: 'TX-TID-PROXY-ORDER-ID',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return originalFetch(input, init);
    }) as typeof fetch;
    (proxyBookingNotifications as { notifyProxyPaymentEvent: typeof proxyBookingNotifications.notifyProxyPaymentEvent }).notifyProxyPaymentEvent =
      (async (params) => {
        capturedEvents.push({
          event: params.event,
          requestId: params.request.id,
        });
      }) as typeof proxyBookingNotifications.notifyProxyPaymentEvent;

    try {
      const requestBody = new URLSearchParams({
        Moid: fixture.orderId,
        TID: 'TX-TID-PROXY-ORDER-ID',
        Amt: '4500',
        ResultCode: '3001',
        StateCd: '0',
        PayMethod: 'CARD',
      }).toString();

      const request = new Request('https://locally.example/api/proxy-bookings/payment/card-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody,
      });

      const response = await proxyCardNotificationPost(request);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ success: true });

      const { data: updatedRow, error: updatedRowError } = await getAdminClient()
        .from('proxy_requests')
        .select('payment_status, tid')
        .eq('id', fixture.requestId)
        .maybeSingle();

      if (updatedRowError) throw updatedRowError;
      expect(updatedRow).toMatchObject({
        payment_status: 'COMPLETED',
        tid: 'TX-TID-PROXY-ORDER-ID',
      });

      expect(capturedEvents).toEqual([
        {
          event: 'confirmed',
          requestId: fixture.requestId,
        },
      ]);

      const replayResponse = await proxyCardNotificationPost(
        new Request('https://locally.example/api/proxy-bookings/payment/card-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: requestBody,
        })
      );
      expect(replayResponse.status).toBe(200);
      await expect(replayResponse.json()).resolves.toMatchObject({
        success: true,
        message: 'Already processed',
      });
      expect(capturedEvents).toHaveLength(1);
    } finally {
      global.fetch = originalFetch;
      (proxyBookingNotifications as { notifyProxyPaymentEvent: typeof proxyBookingNotifications.notifyProxyPaymentEvent }).notifyProxyPaymentEvent =
        originalNotifyProxyPaymentEvent;
    }
  });

  test('falls back to providerTransactionId lookup for proxy NicePay notifications', async () => {
    ensureSupabaseEnv();
    withNicePayEnv();

    const guest = createUser('proxy-tid-fallback');
    const guestId = await createAuthUser(guest);
    await setPreferredLocale(guestId, 'ja');

    const fixture = await createProxyRequestFixture({
      userId: guestId,
      user: guest,
      paymentStatus: 'WAITING',
      tid: 'TX-TID-PROXY-FALLBACK',
    });

    const originalFetch = global.fetch;
    const originalNotifyProxyPaymentEvent = proxyBookingNotifications.notifyProxyPaymentEvent;
    const capturedEvents: Array<{ event: string; requestId: string }> = [];
    global.fetch = (async (input, init) => {
      if (String(input) === NICEPAY_STATUS_QUERY_URL) {
        const body = new URLSearchParams(String(init?.body || ''));
        expect(body.get('MID')).toBe(process.env.NICEPAY_MID);
        expect(body.get('TID')).toBe('TX-TID-PROXY-FALLBACK');

        return new Response(
          JSON.stringify({
            ResultCode: '0000',
            ResultMsg: 'OK',
            Status: '0',
            TID: 'TX-TID-PROXY-FALLBACK',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return originalFetch(input, init);
    }) as typeof fetch;
    (proxyBookingNotifications as { notifyProxyPaymentEvent: typeof proxyBookingNotifications.notifyProxyPaymentEvent }).notifyProxyPaymentEvent =
      (async (params) => {
        capturedEvents.push({
          event: params.event,
          requestId: params.request.id,
        });
      }) as typeof proxyBookingNotifications.notifyProxyPaymentEvent;

    try {
      const request = new Request('https://locally.example/api/proxy-bookings/payment/card-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          TID: 'TX-TID-PROXY-FALLBACK',
          Amt: '4500',
          ResultCode: '3001',
          StateCd: '0',
          PayMethod: 'CARD',
        }).toString(),
      });

      const response = await proxyCardNotificationPost(request);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ success: true });

      const { data: updatedRow, error: updatedRowError } = await getAdminClient()
        .from('proxy_requests')
        .select('payment_status, tid')
        .eq('id', fixture.requestId)
        .maybeSingle();

      if (updatedRowError) throw updatedRowError;
      expect(updatedRow).toMatchObject({
        payment_status: 'COMPLETED',
        tid: 'TX-TID-PROXY-FALLBACK',
      });
      expect(capturedEvents).toEqual([
        {
          event: 'confirmed',
          requestId: fixture.requestId,
        },
      ]);
    } finally {
      global.fetch = originalFetch;
      (proxyBookingNotifications as { notifyProxyPaymentEvent: typeof proxyBookingNotifications.notifyProxyPaymentEvent }).notifyProxyPaymentEvent =
        originalNotifyProxyPaymentEvent;
    }
  });

  test('processes proxy NicePay callback routes for the owning user and stays idempotent on replay', async () => {
    ensureSupabaseEnv();
    withNicePayEnv();

    const guest = createUser('proxy-callback-direct');
    const guestId = await createAuthUser(guest);
    await setPreferredLocale(guestId, 'en');

    const fixture = await createProxyRequestFixture({
      userId: guestId,
      user: guest,
    });

    const authToken = 'AUTH-TOKEN-PROXY-CALLBACK';
    const amount = 4500;
    const providerPayload = {
      AuthResultCode: '0000',
      AuthToken: authToken,
      TxTid: 'TX-TID-PROXY-CALLBACK',
      MID: process.env.NICEPAY_MID!,
      Moid: fixture.orderId,
      Amt: String(amount),
      NextAppURL: 'https://webapi.nicepay.co.kr/webapi/pay_process.jsp',
      PayMethod: 'CARD',
      Signature: sha256Hex(
        `${authToken}${process.env.NICEPAY_MID}${amount}${process.env.NICEPAY_MERCHANT_KEY}`
      ),
    };

    const originalFetch = global.fetch;
    const originalCreateServerClient = supabaseServerModule.createClient;
    const originalNotifyProxyPaymentEvent = proxyBookingNotifications.notifyProxyPaymentEvent;
    const capturedEvents: Array<{ event: string; requestId: string }> = [];

    global.fetch = (async (input, init) => {
      if (String(input) === 'https://webapi.nicepay.co.kr/webapi/pay_process.jsp') {
        expect(init?.method).toBe('POST');
        const body = new URLSearchParams(String(init?.body || ''));
        expect(body.get('MID')).toBe(process.env.NICEPAY_MID);
        expect(body.get('AuthToken')).toBe(authToken);
        expect(body.get('Amt')).toBe(String(amount));

        return new Response(
          JSON.stringify({
            ResultCode: '3001',
            ResultMsg: 'Approval complete',
            TID: 'TX-TID-PROXY-CALLBACK',
            Moid: fixture.orderId,
            Amt: String(amount),
            PayMethod: 'CARD',
            Signature: sha256Hex(
              `TX-TID-PROXY-CALLBACK${process.env.NICEPAY_MID}${amount}${process.env.NICEPAY_MERCHANT_KEY}`
            ),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    (supabaseServerModule as { createClient: typeof supabaseServerModule.createClient }).createClient =
      (async () =>
        ({
          auth: {
            getUser: async () => ({
              data: { user: { id: guestId } },
              error: null,
            }),
          },
        }) as Awaited<ReturnType<typeof supabaseServerModule.createClient>>) as typeof supabaseServerModule.createClient;

    (proxyBookingNotifications as { notifyProxyPaymentEvent: typeof proxyBookingNotifications.notifyProxyPaymentEvent }).notifyProxyPaymentEvent =
      (async (params) => {
        capturedEvents.push({
          event: params.event,
          requestId: params.request.id,
        });
      }) as typeof proxyBookingNotifications.notifyProxyPaymentEvent;

    try {
      const requestBody = {
        approvalId: 'TX-TID-PROXY-CALLBACK',
        merchant_uid: fixture.orderId,
        orderId: fixture.orderId,
        providerPayload,
      };

      const response = await proxyNicePayCallbackPost(
        new Request('https://locally.example/api/proxy-bookings/payment/nicepay-callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ success: true });

      const { data: updatedRow, error: updatedRowError } = await getAdminClient()
        .from('proxy_requests')
        .select('payment_status, tid')
        .eq('id', fixture.requestId)
        .maybeSingle();

      if (updatedRowError) throw updatedRowError;
      expect(updatedRow).toMatchObject({
        payment_status: 'COMPLETED',
        tid: 'TX-TID-PROXY-CALLBACK',
      });

      expect(capturedEvents).toEqual([
        {
          event: 'confirmed',
          requestId: fixture.requestId,
        },
      ]);

      const replayResponse = await proxyNicePayCallbackPost(
        new Request('https://locally.example/api/proxy-bookings/payment/nicepay-callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })
      );

      expect(replayResponse.status).toBe(200);
      await expect(replayResponse.json()).resolves.toMatchObject({
        success: true,
        message: 'Already processed',
      });
      expect(capturedEvents).toHaveLength(1);
    } finally {
      global.fetch = originalFetch;
      (supabaseServerModule as { createClient: typeof supabaseServerModule.createClient }).createClient =
        originalCreateServerClient;
      (proxyBookingNotifications as { notifyProxyPaymentEvent: typeof proxyBookingNotifications.notifyProxyPaymentEvent }).notifyProxyPaymentEvent =
        originalNotifyProxyPaymentEvent;
    }
  });
});
