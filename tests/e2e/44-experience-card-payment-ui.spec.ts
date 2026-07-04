import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

import {
  prepareBookableExperience as prepareSharedBookableExperience,
  getVisibleReservationByTestId,
  reviewAllExperiencePaymentAgreements,
  selectReservationDate,
} from './helpers/experienceBooking';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

type BookableExperience = {
  experienceId: number;
  title: string;
  date: string;
  time: string;
};

type AvailabilityKey = {
  experienceId: number;
  date: string;
  time: string;
};

const TEST_PASSWORD = 'LocallyTest!2026';
const MOCK_IMP_UID = 'MOCK-IMP-UID-TEST';
const MOCK_TID = 'MOCK-NICEPAY-TID';
const MOCK_IAMPORT_SDK = `
  window.IMP = {
    init: function init() {},
    request_pay: function request_pay(data, callback) {
      callback({
        success: true,
        imp_uid: '${MOCK_IMP_UID}',
        merchant_uid: data.merchant_uid,
        status: 'paid'
      });
    }
  };
`;
const MOCK_NICEPAY_SDK = `
  window.goPay = function goPay(form) {
    var openerOrigin = window.__LOCALLY_OPENER_ORIGIN__ || window.location.origin;
    window.__nicepayFormTargetWasBlank = Boolean(form && !form.target);
    window.__nicepayFormAcceptCharset = form ? form.acceptCharset : '';
    window.__nicepayFormDisplay = form ? window.getComputedStyle(form).display : '';
    window.__nicepayFormHeight = form ? window.getComputedStyle(form).height : '';

    var parent = document.createElement('div');
    parent.id = 'nicepay-pgweb-test-container';
    var child = document.createElement('div');
    child.id = 'nicepay-pgweb-test-child';
    parent.appendChild(child);
    document.body.appendChild(parent);

    function postDebugToOpener() {
      window.__nicepayDeletePaymentParentWasPresent = Boolean(child.parentElement);
      child.parentElement.removeChild(child);
      parent.remove();
      if (window.opener && typeof window.opener.postMessage === 'function') {
        window.opener.postMessage({
          type: 'locally:nicepay-test-debug',
          formTargetWasBlank: window.__nicepayFormTargetWasBlank,
          formAcceptCharset: window.__nicepayFormAcceptCharset,
          formDisplay: window.__nicepayFormDisplay,
          formHeight: window.__nicepayFormHeight,
          deletePaymentParentWasPresent: window.__nicepayDeletePaymentParentWasPresent,
        }, openerOrigin);
      }
    }

    window.setTimeout(function sendNicePayResult() {
      postDebugToOpener();
      if (window.opener && typeof window.opener.postMessage === 'function') {
        window.opener.postMessage({
          type: 'locally:nicepay-result',
          success: true,
          payload: {
            AuthResultCode: '0000',
            TxTid: '${MOCK_TID}'
          }
        }, openerOrigin);
      }
    }, 0);
  };
`;
const MOCK_NICEPAY_LAUNCH_PAGE = (title: string) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>Locally NICEPAY Test</title>
    <script>
      window.__LOCALLY_OPENER_ORIGIN__ = window.location.origin;
      function nicepayStart() {
        window.goPay(document.payForm);
      }
      function nicepaySubmit() {
        document.payForm.submit();
      }
      function nicepayClose() {
        if (window.opener) {
          window.opener.postMessage({
            type: 'locally:nicepay-result',
            success: false,
            cancelled: true,
            message: '결제가 취소되었습니다.'
          }, window.__LOCALLY_OPENER_ORIGIN__);
        }
      }
    </script>
  </head>
  <body>
    <form name="payForm" method="post" action="/api/payment/nicepay/relay" accept-charset="euc-kr" style="overflow:hidden;height:0">
      <input type="hidden" name="Moid" value="MOCK-NICEPAY-ORDER" />
      <input type="hidden" name="Amt" value="110" />
      <input type="hidden" name="GoodsName" value="${title.replace(/"/g, '&quot;')}" />
    </form>
    <script src="https://pg-web.nicepay.co.kr/v3/common/js/nicepay-pgweb.js" onload="nicepayStart()"></script>
  </body>
</html>`;

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdAvailabilityKeys: AvailabilityKey[] = [];

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

function createCustomerUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.exp.card.ui.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Experience Card UI Customer ${timestamp}`,
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

async function prepareBookableExperience(): Promise<BookableExperience> {
  const experience = await prepareSharedBookableExperience(createdAvailabilityKeys, {
    searchAnyHost: true,
    time: '10:00',
  });

  return {
    experienceId: experience.experienceId,
    title: experience.title,
    date: experience.date,
    time: experience.time,
  };
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const userId of createdAuthUserIds) {
    await supabase.from('bookings').delete().eq('user_id', userId);
  }

  for (const slot of createdAvailabilityKeys) {
    await supabase
      .from('experience_availability')
      .delete()
      .eq('experience_id', slot.experienceId)
      .eq('date', slot.date)
      .eq('start_time', slot.time);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Experience card payment UI smoke', () => {
  test('opens the platform fee tooltip on mobile tap without breaking dismissal', async ({ page }) => {
    test.setTimeout(120000);

    const customerUser = createCustomerUser();
    await createAuthUser(customerUser);
    const experience = await prepareBookableExperience();

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, customerUser);
    await page.goto(
      `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1`,
      { waitUntil: 'networkidle' }
    );

    const feeTrigger = page.getByTestId('exp-payment-platform-fee-trigger');
    const feeTooltip = page.getByTestId('exp-payment-platform-fee-tooltip');

    await expect(feeTrigger).toBeVisible({ timeout: 15000 });
    await feeTrigger.click();
    await expect(feeTooltip).toBeVisible();

    await page.getByText(/로컬리 서비스 수수료|Locally service fee|Locallyサービス手数料|Locally 服务费/).first().click();
    await expect(feeTooltip).toBeHidden();
  });

  test('completes mocked card payment flow for an experience booking', async ({ page }) => {
    test.setTimeout(120000);

    const customerUser = createCustomerUser();
    const customerId = await createAuthUser(customerUser);
    const experience = await prepareBookableExperience();

    let callbackSeen = false;
    let observedOrderId = '';

    await page.route('**/api/payment/card-ready', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ready: true,
          provider: 'portone',
          runtime: {
            provider: 'portone',
            merchantCode: 'imp_test_locally',
            scriptSrc: 'https://cdn.iamport.kr/v1/iamport.js',
          },
        }),
      });
    });

    await page.route('https://cdn.iamport.kr/v1/iamport.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: MOCK_IAMPORT_SDK,
      });
    });

    await page.route('**/api/payment/nicepay-callback', async (route) => {
      const payload = route.request().postDataJSON() as {
        imp_uid?: string;
        merchant_uid?: string;
        orderId?: string;
      };

      expect(payload.imp_uid).toBe(MOCK_IMP_UID);

      observedOrderId = String(payload.orderId || payload.merchant_uid || '');
      expect(observedOrderId).toBeTruthy();
      callbackSeen = true;

      const { data: booking, error: bookingError } = await getAdminClient()
        .from('bookings')
        .select('id, status, payment_method, user_id')
        .eq('order_id', observedOrderId)
        .maybeSingle();

      if (bookingError) throw bookingError;

      expect(booking).toMatchObject({
        status: 'PENDING',
        payment_method: 'card',
        user_id: customerId,
      });

      if (!booking) {
        throw new Error(`Expected booking row for order_id=${observedOrderId}`);
      }

      const { error: updateError } = await getAdminClient()
        .from('bookings')
        .update({
          status: 'PAID',
          payment_method: 'card',
          tid: MOCK_TID,
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      await page.evaluate(() => {
        const overlay = document.createElement('div');
        overlay.id = 'nicepay-stale-overlay-test';
        overlay.textContent = 'Please, wait...';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '2147483647';
        overlay.style.background = 'rgba(0, 0, 0, 0.6)';
        document.body.appendChild(overlay);
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
        }),
      });
    });

    await login(page, customerUser);
    await page.goto(
      `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1`,
      { waitUntil: 'networkidle' }
    );

    await page.locator('input[type="text"]').fill(customerUser.fullName);
    await page.locator('input[type="tel"]').fill(customerUser.phone);
    await reviewAllExperiencePaymentAgreements(page);

    await expect(page.getByRole('button', { name: /카드|Card|カード|银行卡/ }).first()).toBeEnabled({ timeout: 15000 });
    await page.getByRole('button', { name: /결제하기|Pay|決済する|支付/ }).last().click();

    await expect
      .poll(async () => {
        if (!observedOrderId) return null;

        const { data, error } = await getAdminClient()
          .from('bookings')
          .select('status, payment_method, tid')
          .eq('order_id', observedOrderId)
          .maybeSingle();

        if (error) throw error;
        return data;
      })
      .toMatchObject({
        status: 'PAID',
        payment_method: 'card',
        tid: MOCK_TID,
      });

    await page.waitForURL(
      new RegExp(`/experiences/${experience.experienceId}/payment/complete\\?orderId=${observedOrderId}`),
      { timeout: 15000 }
    );

    expect(callbackSeen).toBe(true);
    await expect(page.locator('#nicepay-stale-overlay-test')).toHaveCount(0);
    await expect(page.getByText('Please, wait...')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: /예약이 확정되었습니다!|Your booking is confirmed!|予約が確定しました！|预订已确认！/ })
    ).toBeVisible();
    await expect(page.getByText(observedOrderId)).toBeVisible();
    await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
    await expect(page.getByText(experience.date)).toBeVisible();
    await expect(page.getByText(experience.time)).toBeVisible();

    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });
    await selectReservationDate(page, experience.date);
    const bookedTime = getVisibleReservationByTestId(
      page,
      `reservation-time-${experience.time.slice(0, 5)}`
    );
    await expect(bookedTime).toBeDisabled();
    await expect(page.getByTestId('reservation-solo-option')).toHaveCount(0);
  });

  test('lets NicePay finish its own DOM cleanup before removing stale payment artifacts', async ({
    page,
  }) => {
    test.setTimeout(120000);

    const customerUser = createCustomerUser();
    const customerId = await createAuthUser(customerUser);
    const experience = await prepareBookableExperience();
    const pageErrors: string[] = [];
    const mainFrameNavigations: string[] = [];

    let callbackSeen = false;
    let observedOrderId = '';

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        mainFrameNavigations.push(frame.url());
      }
    });

    await page.route('**/api/payment/card-ready', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ready: true,
          provider: 'nicepay',
          runtime: {
            provider: 'nicepay',
            merchantCode: 'nicepay-test-mid',
            scriptSrc: 'https://pg-web.nicepay.co.kr/v3/common/js/nicepay-pgweb.js',
          },
        }),
      });
    });

    await page.context().route(
      'https://pg-web.nicepay.co.kr/v3/common/js/nicepay-pgweb.js',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: MOCK_NICEPAY_SDK,
        });
      }
    );

    await page.context().route('**/api/payment/card-launch-page', async (route) => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().postData() || '').toContain('provider=nicepay');

      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: MOCK_NICEPAY_LAUNCH_PAGE(experience.title),
      });
    });

    await page.route('**/api/payment/nicepay-callback', async (route) => {
      const payload = route.request().postDataJSON() as {
        TxTid?: string;
        approvalId?: string;
        merchant_uid?: string;
        orderId?: string;
      };

      expect(payload.TxTid).toBe(MOCK_TID);
      expect(payload.approvalId).toBe(MOCK_TID);

      observedOrderId = String(payload.orderId || payload.merchant_uid || '');
      expect(observedOrderId).toBeTruthy();
      callbackSeen = true;

      const { data: booking, error: bookingError } = await getAdminClient()
        .from('bookings')
        .select('id, status, payment_method, user_id')
        .eq('order_id', observedOrderId)
        .maybeSingle();

      if (bookingError) throw bookingError;

      expect(booking).toMatchObject({
        status: 'PENDING',
        payment_method: 'card',
        user_id: customerId,
      });

      if (!booking) {
        throw new Error(`Expected booking row for order_id=${observedOrderId}`);
      }

      const { error: updateError } = await getAdminClient()
        .from('bookings')
        .update({
          status: 'PAID',
          payment_method: 'card',
          tid: MOCK_TID,
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      await page.evaluate(() => {
        const overlay = document.createElement('div');
        overlay.id = 'nicepay-stale-overlay-test';
        overlay.textContent = 'Please, wait...';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '2147483647';
        overlay.style.background = 'rgba(0, 0, 0, 0.6)';
        document.body.appendChild(overlay);
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
        }),
      });
    });

    await login(page, customerUser);
    await page.goto(
      `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1`,
      { waitUntil: 'networkidle' }
    );

    await page.locator('input[type="text"]').fill(customerUser.fullName);
    await page.locator('input[type="tel"]').fill(customerUser.phone);
    await reviewAllExperiencePaymentAgreements(page);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(document.querySelector('script[src*="nicepay-pgweb.js"]'))
        )
      )
      .toBe(false);
    await page.evaluate(() => {
      window.addEventListener('message', (event) => {
        const data = event.data as {
          type?: string;
          formTargetWasBlank?: boolean;
          formAcceptCharset?: string;
          formDisplay?: string;
          formHeight?: string;
          deletePaymentParentWasPresent?: boolean;
        };

        if (!data || data.type !== 'locally:nicepay-test-debug') return;

        Object.assign(window, {
          __nicepayFormTargetWasBlank: data.formTargetWasBlank,
          __nicepayFormAcceptCharset: data.formAcceptCharset,
          __nicepayFormDisplay: data.formDisplay,
          __nicepayFormHeight: data.formHeight,
          __nicepayDeletePaymentParentWasPresent: data.deletePaymentParentWasPresent,
        });
      });
    });

    await expect(page.getByRole('button', { name: /카드|Card|カード|银行卡/ }).first()).toBeEnabled({
      timeout: 15000,
    });
    await page.getByRole('button', { name: /결제하기|Pay|決済する|支付/ }).last().click();

    await expect
      .poll(() => observedOrderId || null, { timeout: 15000 })
      .toBeTruthy();

    await page.waitForURL(
      new RegExp(`/experiences/${experience.experienceId}/payment/complete\\?orderId=${observedOrderId}`),
      { timeout: 15000 }
    );

    expect(callbackSeen).toBe(true);
    expect(
      await page.evaluate(() =>
        Boolean((window as { __nicepayDeletePaymentParentWasPresent?: boolean })
          .__nicepayDeletePaymentParentWasPresent)
      )
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        Boolean((window as { __nicepayFormTargetWasBlank?: boolean }).__nicepayFormTargetWasBlank)
      )
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        String((window as { __nicepayFormAcceptCharset?: string }).__nicepayFormAcceptCharset)
      )
    ).toBe('euc-kr');
    expect(
      await page.evaluate(() =>
        String((window as { __nicepayFormDisplay?: string }).__nicepayFormDisplay)
      )
    ).not.toBe('none');
    expect(
      await page.evaluate(() =>
        String((window as { __nicepayFormHeight?: string }).__nicepayFormHeight)
      )
    ).toBe('0px');
    expect(pageErrors.filter((message) => message.includes('removeChild'))).toEqual([]);
    expect(mainFrameNavigations.filter((url) => url.includes('nicepay.co.kr'))).toEqual([]);
    await expect(page.locator('#nicepay-stale-overlay-test')).toHaveCount(0);
    await expect(page.getByText('Please, wait...')).toHaveCount(0);
    await expect(
      page.getByRole('heading', {
        name: /예약이 확정되었습니다!|Your booking is confirmed!|予約が確定しました！|预订已确认！/,
      })
    ).toBeVisible();
  });
});
