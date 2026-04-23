import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAvailability,
  getAdminClient,
  prepareBookableExperience,
  reviewAllExperiencePaymentAgreements,
  type AvailabilityKey,
} from './helpers/experienceBooking';
import { requireLiveBaseUrl } from './helpers/liveBaseUrl';
import { getPublicBankInfo } from '@/app/utils/publicBankInfo';

const LIVE_BASE_URL = requireLiveBaseUrl();

function createUniqueGuest() {
  const timestamp = Date.now();
  return {
    email: `codex.guest.postbooking.${timestamp}@example.com`,
    password: 'LocallyTest!2026',
    fullName: `Codex Guest ${timestamp}`,
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

async function findGuestProfileIdByEmail(email: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data?.id ? String(data.id) : null;
}

async function findBookingByOrderId(orderId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('id, order_id, amount, user_id, experience_id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findLatestInquiry(params: {
  userId: string;
  hostId: string;
  experienceId: number;
  type: 'general';
}) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, type, experience_id, created_at')
    .eq('user_id', params.userId)
    .eq('host_id', params.hostId)
    .eq('type', params.type)
    .eq('experience_id', String(params.experienceId))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findInquiryMessage(inquiryId: string, content: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiry_messages')
    .select('id, inquiry_id, sender_id, content, created_at')
    .eq('inquiry_id', inquiryId)
    .eq('content', content)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

test.describe.serial('Live guest post-booking experience flow', () => {
  test.use({ baseURL: LIVE_BASE_URL });
  test.setTimeout(300000);

  test('creates a guest booking, verifies trips + receipt, and starts a host chat from trips', async ({ page }, testInfo) => {
    const guest = createUniqueGuest();
    const createdAvailabilityKeys: AvailabilityKey[] = [];
    const bankInfo = getPublicBankInfo();
    const bankAccountPattern = new RegExp(bankInfo.accountDigits.split('').join('\\D*'));
    const guestTripMessage = `E2E trip follow-up message ${Date.now()}`;
    const browserIssues: string[] = [];

    page.on('pageerror', (error) => {
      browserIssues.push(`[pageerror] ${error.message}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        browserIssues.push(`[console:error] ${message.text()}`);
      }
    });

    let guestUserId = '';
    let bookingOrderId = '';
    let bookingId = '';
    let bookingAmount = 0;
    let generalInquiryId = '';
    const getTripCard = () =>
      page
        .getByTestId('guest-trips-desktop-main')
        .getByTestId(`guest-trip-card-${bookingId}`);

    try {
      const bookableExperience = await prepareBookableExperience(createdAvailabilityKeys);

      await test.step('Create a fresh guest account', async () => {
        await signUpGuest(page, guest);
        await page.waitForTimeout(5000);

        guestUserId = (await findGuestProfileIdByEmail(guest.email)) || '';
        if (!guestUserId) {
          throw new Error('Guest profile was not created after signup.');
        }
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
        await expect(page.getByText(bankAccountPattern).first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(bankInfo.bankName).first()).toBeVisible({ timeout: 10000 });

        const noOffPlatformAgreement = page.getByTestId('exp-payment-agree-off-platform');
        const safetyAgreement = page.getByTestId('exp-payment-agree-safety');
        const termsAgreement = page.getByTestId('exp-payment-agree-terms');

        await expect(noOffPlatformAgreement).toBeVisible({ timeout: 15000 });
        await expect(safetyAgreement).toBeVisible({ timeout: 15000 });
        await expect(termsAgreement).toBeVisible({ timeout: 15000 });

        await reviewAllExperiencePaymentAgreements(page);

        await page.getByTestId('exp-payment-submit').click();
        await page.waitForURL(/\/payment\/complete\?orderId=/, { timeout: 30000 });

        const url = new URL(page.url());
        bookingOrderId = url.searchParams.get('orderId') || '';
        expect(bookingOrderId).not.toBe('');

        await expect
          .poll(async () => Boolean(await findBookingByOrderId(bookingOrderId)), {
            timeout: 15000,
            intervals: [500, 1000, 1500],
          })
          .toBe(true);

        const bookingRow = await findBookingByOrderId(bookingOrderId);
        if (!bookingRow) {
          throw new Error(`Could not load booking row for order ${bookingOrderId}.`);
        }
        bookingId = String(bookingRow.id || '');
        expect(bookingId).not.toBe('');
        bookingAmount = Number(bookingRow.amount || 0);
      });

      await test.step('Move from payment complete page into guest trips', async () => {
        await expect(page.getByText(/입금 대기 중입니다|입금 확인 중|Your payment is pending/i)).toBeVisible({
          timeout: 15000,
        });
        await expect(page.getByText(bankAccountPattern).first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(bankInfo.bankName).first()).toBeVisible({ timeout: 10000 });

        await page
          .getByRole('link', {
            name: /예약 상세 내역 보기|View booking details|Booking details|予約詳細|预订详情/,
          })
          .last()
          .click();

        await page.waitForURL(/\/guest\/trips/, { timeout: 20000 });
        const tripCard = getTripCard();
        await expect(tripCard).toBeVisible({ timeout: 20000 });
        await expect(tripCard.getByRole('heading').first()).toBeVisible({ timeout: 20000 });
        await expect(tripCard).toContainText(`#${bookingOrderId}`);
        await expect(tripCard).toContainText(bookableExperience.date);
        await expect(tripCard).toContainText(bookableExperience.time);
      });

      await test.step('Open the cancellation modal and verify refund policy copy', async () => {
        const tripCard = getTripCard();
        await tripCard.locator('[data-testid^="guest-trip-menu-button-"]').click();
        await tripCard.locator('[data-testid^="guest-trip-cancel-button-"]').click();

        const cancelModal = page.getByTestId('guest-trip-cancel-modal');

        await expect(cancelModal).toBeVisible({ timeout: 10000 });
        await expect(
          cancelModal.getByText(/체험일 당일\/지난 일정: 환불 불가|Experience day \/ Past date: Non-refundable/)
        ).toBeVisible({
          timeout: 10000,
        });
        await expect(
          cancelModal.getByText(/그 외 결제 당일 취소: 100%|Otherwise, cancellation on the payment day: 100%/)
        ).toBeVisible({
          timeout: 10000,
        });
        await expect(
          cancelModal.getByText(/20일 전: 100% \/ 8~19일 전: 80%|20 days before: 100% \/ 8~19 days before: 80%/)
        ).toBeVisible({
          timeout: 10000,
        });
        await expect(
          cancelModal.getByText(/2~7일 전: 70% \/ 1일 전: 40%|2~7 days before: 70% \/ 1 day before: 40%/)
        ).toBeVisible({
          timeout: 10000,
        });
        await expect(cancelModal).not.toContainText('24시간');

        const cancelCloseButton = page.getByTestId('guest-trip-cancel-close-button');
        await expect(cancelCloseButton).toBeVisible({ timeout: 10000 });
        await cancelCloseButton.evaluate((button: HTMLButtonElement) => button.click());
        await expect(cancelModal).toBeHidden({ timeout: 10000 });
      });

      await test.step('Open and verify the receipt modal from guest trips', async () => {
        const tripTitleText = (await getTripCard().getByRole('heading').first().textContent())?.trim() || '';
        expect(tripTitleText).not.toBe('');
        await getTripCard().getByTestId('guest-trip-pending-receipt-button').click();

        const receiptModal = page.getByTestId('guest-trip-receipt-modal');
        await expect(receiptModal).toBeVisible({ timeout: 15000 });
        await expect(receiptModal.getByText(String(bookingOrderId))).toBeVisible({ timeout: 10000 });
        await expect(receiptModal.getByText(tripTitleText, { exact: false })).toBeVisible({ timeout: 10000 });
        await expect(
          receiptModal.getByText(`₩${bookingAmount.toLocaleString()}`)
        ).toBeVisible({ timeout: 10000 });

        await page
          .getByTestId('guest-trip-receipt-close-button')
          .evaluate((button: HTMLButtonElement) => button.click());
        await expect(receiptModal).toBeHidden({ timeout: 10000 });
      });

      await test.step('Start a host chat from the booked trip card', async () => {
        await getTripCard().getByRole('button', { name: /메시지|Messages|Message|メッセージ|消息/i }).click();
        await page.waitForURL(/\/guest\/inbox/, { timeout: 20000 });

        const guestInput = page
          .locator('input[placeholder="메시지 입력..."], input[placeholder="Type a message..."]')
          .first();
        await expect(guestInput).toBeVisible({ timeout: 20000 });
        await guestInput.fill(guestTripMessage);
        await guestInput.press('Enter');

        await expect
          .poll(async () => {
            const inquiry = await findLatestInquiry({
              userId: guestUserId,
              hostId: bookableExperience.hostId,
              experienceId: bookableExperience.experienceId,
              type: 'general',
            });
            return inquiry?.id ? String(inquiry.id) : '';
          }, {
            timeout: 15000,
            intervals: [500, 1000, 1500],
          })
          .not.toBe('');

        generalInquiryId = String(
          (
            await findLatestInquiry({
              userId: guestUserId,
              hostId: bookableExperience.hostId,
              experienceId: bookableExperience.experienceId,
              type: 'general',
            })
          )?.id || ''
        );

        await expect
          .poll(async () => {
            const message = await findInquiryMessage(generalInquiryId, guestTripMessage);
            return message?.id ? String(message.id) : '';
          }, {
            timeout: 15000,
            intervals: [500, 1000, 1500],
          })
          .not.toBe('');

        await page.goto(`/guest/inbox?inquiryId=${generalInquiryId}`, { waitUntil: 'networkidle' });
        await expect(
          page.locator('div.bg-black.text-white.rounded-tr-sm').filter({ hasText: guestTripMessage }).last()
        ).toBeVisible({ timeout: 20000 });
      });

      await test.step('Capture final live state', async () => {
        await page.screenshot({
          path: testInfo.outputPath('live-guest-post-booking.png'),
          fullPage: true,
        });

        await testInfo.attach('live-guest-post-booking-metadata.json', {
          body: JSON.stringify(
            {
              guest,
              guestUserId,
              experience: bookableExperience,
              bookingOrderId,
              bookingAmount,
              generalInquiryId,
              guestTripMessage,
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
