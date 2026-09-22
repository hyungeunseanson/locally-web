import './helpers/serverOnlyTestShim';

import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { POST as cardLaunchPagePost } from '@/app/api/payment/card-launch-page/route';
import { POST as legacyCardLaunchPost } from '@/app/api/payment/card-launch/route';
import { resolveExperienceCardLaunch } from '@/app/utils/payments/card/experienceLaunch';
import * as supabaseAdminModule from '@/app/utils/supabase/admin';
import * as supabaseServerModule from '@/app/utils/supabase/server';

const NOW = new Date('2026-09-22T12:00:00.000Z');
const ORDER_ID = 'ORD-EXPERIENCE-LAUNCH-001';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const ORIGINAL_ENV = {
  CARD_PAYMENT_PROVIDER: process.env.CARD_PAYMENT_PROVIDER,
  NICEPAY_MID: process.env.NICEPAY_MID,
  NICEPAY_MERCHANT_KEY: process.env.NICEPAY_MERCHANT_KEY,
};

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    order_id: ORDER_ID,
    user_id: USER_ID,
    amount: 48700,
    status: 'PENDING',
    tid: null,
    payment_method: 'card',
    contact_name: 'DB Guest',
    contact_phone: '01012345678',
    payment_claim_state: 'processing',
    payment_claim_expires_at: '2026-09-22T12:10:00.000Z',
    payment_provider: 'nicepay',
    payment_provider_reference: ORDER_ID,
    experiences: { title: 'DB Experience Title' },
    ...overrides,
  };
}

function clients(params: {
  user?: { id: string; email?: string } | null;
  authError?: unknown;
  booking?: ReturnType<typeof booking> | null;
  bookingError?: unknown;
}) {
  const filters: Array<{ column: string; value: unknown }> = [];
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push({ column, value });
      return query;
    },
    maybeSingle: async () => ({
      data: params.booking === undefined ? booking() : params.booking,
      error: params.bookingError || null,
    }),
  };

  return {
    server: {
      auth: {
        getUser: async () => ({
          data: { user: params.user === undefined ? { id: USER_ID, email: 'db-user@example.com' } : params.user },
          error: params.authError || null,
        }),
      },
    },
    admin: {
      from: (table: string) => {
        expect(table).toBe('bookings');
        return query;
      },
    },
    filters,
  };
}

async function resolve(params: Parameters<typeof clients>[0] = {}) {
  const dependency = clients(params);
  const result = await resolveExperienceCardLaunch({
    supabaseServer: dependency.server as never,
    supabaseAdmin: dependency.admin as never,
    requestedOrderId: ORDER_ID,
    provider: 'nicepay',
    now: NOW,
  });
  return { result, dependency };
}

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
}

test.afterEach(() => {
  restoreEnv();
});

test.describe.serial('Experience NICEPAY launch boundary', () => {
  test('rejects an unauthenticated launch before issuing provider fields', async () => {
    const { result } = await resolve({ user: null });
    expect(result).toEqual({ ok: false, code: 'authentication_required' });
  });

  test('renders a safe outcome without loading NICEPAY when authentication is missing', async () => {
    process.env.CARD_PAYMENT_PROVIDER = 'nicepay';
    process.env.NICEPAY_MID = 'nicepay-test-mid';
    process.env.NICEPAY_MERCHANT_KEY = 'nicepay-test-merchant-key';

    const dependency = clients({ user: null });
    const originalCreateServerClient = supabaseServerModule.createClient;
    const originalCreateAdminClient = supabaseAdminModule.createAdminClient;
    (supabaseServerModule as { createClient: typeof supabaseServerModule.createClient }).createClient =
      (async () => dependency.server as never) as typeof supabaseServerModule.createClient;
    (supabaseAdminModule as { createAdminClient: typeof supabaseAdminModule.createAdminClient }).createAdminClient =
      (() => dependency.admin as never) as typeof supabaseAdminModule.createAdminClient;

    try {
      const response = await cardLaunchPagePost(
        new Request('https://locally.example/api/payment/card-launch-page', {
          method: 'POST',
          body: new URLSearchParams({ provider: 'nicepay', orderId: ORDER_ID, amount: '1' }),
        })
      );
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).not.toContain('nicepay-pgweb.js');
      expect(html).not.toContain('window.goPay(document.payForm)');
      expect(html).not.toContain('name="Amt"');
    } finally {
      (supabaseServerModule as { createClient: typeof supabaseServerModule.createClient }).createClient =
        originalCreateServerClient;
      (supabaseAdminModule as { createAdminClient: typeof supabaseAdminModule.createAdminClient }).createAdminClient =
        originalCreateAdminClient;
    }
  });

  test('rejects another user booking', async () => {
    const { result } = await resolve({
      booking: booking({ user_id: '00000000-0000-4000-8000-000000000002' }),
    });
    expect(result).toEqual({ ok: false, code: 'booking_unavailable' });
  });

  test('rejects a booking without a payment claim', async () => {
    const { result } = await resolve({ booking: booking({ payment_claim_state: null }) });
    expect(result).toEqual({ ok: false, code: 'claim_invalid' });
  });

  test('rejects claimed state until the card attempt is processing', async () => {
    const { result } = await resolve({ booking: booking({ payment_claim_state: 'claimed' }) });
    expect(result).toEqual({ ok: false, code: 'claim_invalid' });
  });

  test('rejects a claim for the wrong provider', async () => {
    const { result } = await resolve({ booking: booking({ payment_provider: 'portone' }) });
    expect(result).toEqual({ ok: false, code: 'claim_invalid' });
  });

  test('rejects a claim with the wrong provider reference', async () => {
    const { result } = await resolve({
      booking: booking({ payment_provider_reference: 'ORD-OTHER-ATTEMPT' }),
    });
    expect(result).toEqual({ ok: false, code: 'claim_invalid' });
  });

  test('rejects an expired processing claim', async () => {
    const { result } = await resolve({
      booking: booking({ payment_claim_expires_at: NOW.toISOString() }),
    });
    expect(result).toEqual({ ok: false, code: 'claim_invalid' });
  });

  test('accepts only a valid processing claim and reads the booking by exact order id', async () => {
    const { result, dependency } = await resolve();
    expect(result).toMatchObject({
      ok: true,
      orderId: ORDER_ID,
      amount: 48700,
    });
    expect(dependency.filters).toEqual([{ column: 'order_id', value: ORDER_ID }]);
  });

  test('uses DB financial and customer values instead of request values', async () => {
    const { result } = await resolve({
      booking: booking({
        amount: 73100,
        contact_name: 'Authoritative DB Name',
        contact_phone: '01099998888',
        experiences: { title: 'Authoritative DB Title' },
      }),
    });

    expect(result).toEqual({
      ok: true,
      orderId: ORDER_ID,
      productName: 'Authoritative DB Title',
      amount: 73100,
      buyerName: 'Authoritative DB Name',
      buyerTel: '01099998888',
      buyerEmail: 'db-user@example.com',
    });
  });

  test('fails closed when the returned booking does not exactly match the requested order', async () => {
    const { result } = await resolve({ booking: booking({ order_id: 'ORD-MISMATCH' }) });
    expect(result).toEqual({ ok: false, code: 'booking_unavailable' });
  });

  test('renders provider fields only after server validation and always signs the DB amount', async () => {
    process.env.CARD_PAYMENT_PROVIDER = 'nicepay';
    process.env.NICEPAY_MID = 'nicepay-test-mid';
    process.env.NICEPAY_MERCHANT_KEY = 'nicepay-test-merchant-key';

    const dependency = clients({});
    const originalCreateServerClient = supabaseServerModule.createClient;
    const originalCreateAdminClient = supabaseAdminModule.createAdminClient;

    (supabaseServerModule as { createClient: typeof supabaseServerModule.createClient }).createClient =
      (async () => dependency.server as never) as typeof supabaseServerModule.createClient;
    (supabaseAdminModule as { createAdminClient: typeof supabaseAdminModule.createAdminClient }).createAdminClient =
      (() => dependency.admin as never) as typeof supabaseAdminModule.createAdminClient;

    try {
      const response = await cardLaunchPagePost(
        new Request('https://locally.example/api/payment/card-launch-page', {
          method: 'POST',
          body: new URLSearchParams({
            provider: 'nicepay',
            orderId: ORDER_ID,
            productName: 'ATTACKER PRODUCT',
            amount: '1',
            buyerName: 'ATTACKER NAME',
            buyerTel: '000',
            buyerEmail: 'attacker@example.com',
          }),
        })
      );
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('window.goPay(document.payForm)');
      expect(html).toContain('name="Amt" value="48700"');
      expect(html).toContain('name="GoodsName" value="DB Experience Title"');
      expect(html).toContain('name="BuyerName" value="DB Guest"');
      expect(html).toContain('name="BuyerEmail" value="db-user@example.com"');
      expect(html).not.toContain('ATTACKER PRODUCT');
      expect(html).not.toContain('attacker@example.com');
    } finally {
      (supabaseServerModule as { createClient: typeof supabaseServerModule.createClient }).createClient =
        originalCreateServerClient;
      (supabaseAdminModule as { createAdminClient: typeof supabaseAdminModule.createAdminClient }).createAdminClient =
        originalCreateAdminClient;
    }
  });

  test('keeps the unused JSON signer fail closed', async () => {
    process.env.CARD_PAYMENT_PROVIDER = 'nicepay';
    const response = await legacyCardLaunchPost(
      new Request('https://locally.example/api/payment/card-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'nicepay',
          orderId: ORDER_ID,
          amount: 1,
          productName: 'Untrusted',
        }),
      })
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ success: false });
  });

  test('preserves the authenticated Proxy launch contract and its DB-owned fee', async () => {
    process.env.CARD_PAYMENT_PROVIDER = 'nicepay';
    process.env.NICEPAY_MID = 'nicepay-test-mid';
    process.env.NICEPAY_MERCHANT_KEY = 'nicepay-test-merchant-key';

    const proxyOrderId = 'LOCALLY-PROXY-BOUNDARY-001';
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({
        data: {
          id: 'proxy-request-1',
          user_id: USER_ID,
          category: 'RESTAURANT',
          form_data: {
            payment_method: 'card',
            contact_name: 'Proxy DB Guest',
            contact_phone: '01055556666',
            service_fee_krw: 4500,
          },
          payment_channel: 'LOCALLY',
          payment_status: 'WAITING',
          tid: null,
          locally_order_id: proxyOrderId,
        },
        error: null,
      }),
    };
    const originalCreateServerClient = supabaseServerModule.createClient;
    const originalCreateAdminClient = supabaseAdminModule.createAdminClient;
    (supabaseServerModule as { createClient: typeof supabaseServerModule.createClient }).createClient =
      (async () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: USER_ID, email: 'proxy-db-user@example.com' } },
            error: null,
          }),
        },
      }) as never) as typeof supabaseServerModule.createClient;
    (supabaseAdminModule as { createAdminClient: typeof supabaseAdminModule.createAdminClient }).createAdminClient =
      (() => ({
        from: (table: string) => {
          expect(table).toBe('proxy_requests');
          return query;
        },
      }) as never) as typeof supabaseAdminModule.createAdminClient;

    try {
      const response = await cardLaunchPagePost(
        new Request('https://locally.example/api/payment/card-launch-page', {
          method: 'POST',
          body: new URLSearchParams({
            provider: 'nicepay',
            orderId: proxyOrderId,
            amount: '1',
            productName: 'ATTACKER PROXY PRODUCT',
          }),
        })
      );
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('window.goPay(document.payForm)');
      expect(html).toContain('name="Amt" value="4500"');
      expect(html).toContain('name="BuyerName" value="Proxy DB Guest"');
      expect(html).toContain('name="BuyerEmail" value="proxy-db-user@example.com"');
      expect(html).not.toContain('ATTACKER PROXY PRODUCT');
    } finally {
      (supabaseServerModule as { createClient: typeof supabaseServerModule.createClient }).createClient =
        originalCreateServerClient;
      (supabaseAdminModule as { createAdminClient: typeof supabaseAdminModule.createAdminClient }).createAdminClient =
        originalCreateAdminClient;
    }
  });

  test('preserves Proxy and Service launch branches while removing request amount as Experience truth', () => {
    const launchPage = readFileSync('app/api/payment/card-launch-page/route.ts', 'utf8');
    const legacyLaunch = readFileSync('app/api/payment/card-launch/route.ts', 'utf8');
    const paymentPage = readFileSync('app/experiences/[id]/payment/page.tsx', 'utf8');

    expect(launchPage).toContain("launchOrderId.startsWith('LOCALLY-PROXY-')");
    expect(launchPage).toContain("!launchOrderId.startsWith('SVC-')");
    expect(launchPage.indexOf('resolveExperienceCardLaunch({'))
      .toBeLessThan(launchPage.indexOf('buildNicePayLaunchFields({'));
    expect(launchPage).toContain('launchAmount = launch.amount;');
    expect(launchPage).toContain('amount: launchAmount');
    expect(legacyLaunch).not.toContain('buildNicePayLaunchFields');
    expect(paymentPage.indexOf("fetch('/api/payment/card-claim'"))
      .toBeLessThan(paymentPage.indexOf('launchCardPayment({'));
  });
});
