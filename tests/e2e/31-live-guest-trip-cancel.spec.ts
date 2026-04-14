import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAvailability,
  getAdminClient,
  prepareBookableExperience,
  reviewAllExperiencePaymentAgreements,
  type AvailabilityKey,
} from './helpers/experienceBooking';
import { requireLiveBaseUrl } from './helpers/liveBaseUrl';

const LIVE_BASE_URL = requireLiveBaseUrl();

function createUniqueGuest() {
  const timestamp = Date.now();
  return {
    email: `codex.guest.cancel.${timestamp}@example.com`,
    password: 'LocallyTest!2026',
    fullName: `Codex Guest Cancel ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
    birthDate: '19940203',
  };
}

async function signUpGuest(page: Page, guest: ReturnType<typeof createUniqueGuest>) {
  await page.goto('/login', { waitUntil: 'networkidle' });

  const signupToggle = page.getByRole('button', {
    name: /Don't have an account\?|계정 생성|회원가입|Sign up|登録|注册/,
  });

  if (await signupToggle.first().isVisible().catch(() => false)) {
    await signupToggle.first().click();
  } else {
    await page.locator('div.mt-6.text-center.text-sm > button').click();
  }

  const signupResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/auth/v1/signup') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
    { timeout: 30000 }
  );

  await page.locator('input[type="email"]').fill(guest.email);
  await page.getByTestId('signup-password-input').fill(guest.password);
  await page.getByTestId('signup-password-confirm-input').fill(guest.password);
  await page.locator('input[autocomplete="name"]').fill(guest.fullName);
  await page.locator('select').first().selectOption({ index: 1 });
  await page.locator('input[autocomplete="tel"]').fill(guest.phone);
  await page.locator('input[autocomplete="bday"]').fill(guest.birthDate);
  await page.locator('select[autocomplete="sex"]').selectOption('Male');
  await page.getByText(/Agree to all|전체 동의|すべてに同意|全部同意/).click();
  await page.getByRole('button', { name: /회원가입|Sign up|登録|注册/ }).click();

  await signupResponsePromise;
  await page.waitForTimeout(4000);
}

async function findBookingByOrderId(orderId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('id, order_id, status, cancel_reason')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

test.describe.serial('Live guest trip cancellation flow', () => {
  test.use({ baseURL: LIVE_BASE_URL });
  test.setTimeout(300000);

  test('creates a pending bank-transfer booking and cancels it from trips', async ({ page }, testInfo) => {
    const guest = createUniqueGuest();
    const createdAvailabilityKeys: AvailabilityKey[] = [];
    const cancelReason = `E2E guest cancel reason ${Date.now()}`;
    const browserIssues: string[] = [];
    const cancelNetworkEvents: string[] = [];
    const cancelButtonDiagnostics: string[] = [];
    let bookingOrderId = '';
    let bookingId = '';
    const getTripCard = () =>
      page
        .getByTestId('guest-trips-desktop-main')
        .getByTestId(`guest-trip-card-${bookingId}`);

    page.on('pageerror', (error) => {
      browserIssues.push(`[pageerror] ${error.message}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        browserIssues.push(`[console:error] ${message.text()}`);
      }
    });
    page.on('request', (request) => {
      if (request.url().includes('/api/payment/cancel')) {
        cancelNetworkEvents.push(
          `[request] ${request.method()} ${request.url()} body=${request.postData() || ''}`
        );
      }
    });
    page.on('response', async (response) => {
      if (response.url().includes('/api/payment/cancel')) {
        const body = await response.text().catch(() => '');
        cancelNetworkEvents.push(
          `[response] ${response.status()} ${response.url()} body=${body}`
        );
      }
    });

    try {
      const bookableExperience = await prepareBookableExperience(createdAvailabilityKeys);

      await test.step('Create a fresh guest account', async () => {
        await signUpGuest(page, guest);
      });

      await test.step('Create a pending bank-transfer booking', async () => {
        await page.goto(
          `/experiences/${bookableExperience.experienceId}/payment?date=${bookableExperience.date}&time=${bookableExperience.time}&guests=1`,
          { waitUntil: 'domcontentloaded' }
        );
        await expect(page.getByTestId('exp-payment-booker-name')).toBeVisible({ timeout: 30000 });

        await page.getByTestId('exp-payment-booker-name').fill(guest.fullName);
        await page.getByTestId('exp-payment-booker-phone').fill(guest.phone);
        await page.getByTestId('exp-payment-method-bank').click();

        await reviewAllExperiencePaymentAgreements(page);

        await page.getByTestId('exp-payment-submit').click();
        await page.waitForURL(/\/payment\/complete\?orderId=/, { timeout: 30000 });

        const url = new URL(page.url());
        bookingOrderId = url.searchParams.get('orderId') || '';
        expect(bookingOrderId).not.toBe('');

        const booking = await findBookingByOrderId(bookingOrderId);
        bookingId = booking?.id ? String(booking.id) : '';
        expect(bookingId).not.toBe('');
      });

      await test.step('Cancel the pending booking from guest trips', async () => {
        await page.getByRole('link', {
          name: /예약 상세 내역 보기|View booking details|Booking details|予約詳細|预订详情/,
        }).last().click();

        await page.waitForURL(/\/guest\/trips/, { timeout: 20000 });
        const tripCard = getTripCard();
        await expect(tripCard).toBeVisible({ timeout: 20000 });
        await tripCard.locator('[data-testid^="guest-trip-menu-button-"]').click();
        await tripCard.locator('[data-testid^="guest-trip-cancel-button-"]').click();

        const cancelModal = page.getByTestId('guest-trip-cancel-modal');
        await expect(cancelModal).toBeVisible({ timeout: 10000 });
        await cancelModal.locator('textarea').fill(cancelReason);

        const cancelRequestPromise = page.waitForRequest(
          (request) =>
            request.url().includes('/api/payment/cancel') &&
            request.method() === 'POST',
          { timeout: 20000 }
        );
        const cancelResponsePromise = page.waitForResponse(
          (response) =>
            response.url().includes('/api/payment/cancel') &&
            response.request().method() === 'POST',
          { timeout: 20000 }
        );
        const confirmButton = cancelModal.getByRole('button', { name: /취소 확정|Confirm/i });
        await expect(confirmButton).toBeEnabled();
        const confirmButtonProbe = await confirmButton.evaluate((button) => {
          const rect = button.getBoundingClientRect();
          const elementAtCenter = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return {
            tagName: elementAtCenter?.tagName || null,
            text: elementAtCenter?.textContent || null,
            clickable:
              Boolean(elementAtCenter) &&
              (button === elementAtCenter || button.contains(elementAtCenter)),
          };
        });
        cancelButtonDiagnostics.push(JSON.stringify(confirmButtonProbe));
        await confirmButton.evaluate((button: HTMLButtonElement) => button.click());
        const cancelRequest = await cancelRequestPromise;
        cancelNetworkEvents.push(`[request-observed] ${cancelRequest.method()} ${cancelRequest.url()}`);
        const cancelResponse = await cancelResponsePromise;
        const cancelResult = await cancelResponse.json().catch(() => null);
        expect(cancelResponse.ok(), JSON.stringify(cancelResult)).toBeTruthy();
        await expect(cancelModal).toBeHidden({ timeout: 20000 });

        await expect(
          page.getByText(/예약 취소가 완료되었습니다|예약이 취소되었습니다|Reservation cancellation is complete|予約のキャンセルが完了しました|预订取消完成/i)
        ).toBeVisible({ timeout: 20000 });

        await expect
          .poll(async () => {
            const booking = await findBookingByOrderId(bookingOrderId);
            return booking?.status || '';
          }, {
            timeout: 15000,
            intervals: [500, 1000, 1500],
          })
          .toBe('cancelled');
      });

      await test.step('Capture final live state', async () => {
        await page.screenshot({
          path: testInfo.outputPath('live-guest-trip-cancel.png'),
          fullPage: true,
        });

        await testInfo.attach('live-guest-trip-cancel-metadata.json', {
          body: JSON.stringify(
            {
              guest,
              experience: bookableExperience,
              bookingOrderId,
              cancelReason,
            },
            null,
            2
          ),
          contentType: 'application/json',
        });

        if (browserIssues.length > 0) {
          await testInfo.attach('browser-issues.txt', {
            body: browserIssues.join('\n'),
            contentType: 'text/plain',
          });
        }
      });
    } finally {
      if (cancelNetworkEvents.length > 0) {
        await testInfo.attach('cancel-network-events.txt', {
          body: cancelNetworkEvents.join('\n'),
          contentType: 'text/plain',
        });
      }
      if (cancelButtonDiagnostics.length > 0) {
        await testInfo.attach('cancel-button-diagnostics.txt', {
          body: cancelButtonDiagnostics.join('\n'),
          contentType: 'text/plain',
        });
      }
      if (browserIssues.length > 0) {
        await testInfo.attach('browser-issues.txt', {
          body: browserIssues.join('\n'),
          contentType: 'text/plain',
        });
      }
      await cleanupAvailability(createdAvailabilityKeys);
    }
  });
});
