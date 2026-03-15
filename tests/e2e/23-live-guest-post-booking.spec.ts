import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

const LIVE_BASE_URL = 'https://locally-web.vercel.app';
const HOST_USER_ID = 'cc84b331-7e78-4818-b9ba-f1a960017473';

type EnvMap = Record<string, string>;
type BookableExperience = {
  experienceId: number;
  title: string;
  hostId: string;
  date: string;
  time: string;
};

let adminClient: SupabaseClient | null = null;

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

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

async function prepareBookableExperience(): Promise<BookableExperience> {
  const supabase = getAdminClient();

  const { data: experience, error: experienceError } = await supabase
    .from('experiences')
    .select('id, title, status, host_id')
    .eq('host_id', HOST_USER_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (experienceError) throw experienceError;
  if (!experience) {
    throw new Error('No host experience found for the approved test host.');
  }

  if (experience.status !== 'approved' && experience.status !== 'active') {
    const { error: updateError } = await supabase
      .from('experiences')
      .update({ status: 'approved' })
      .eq('id', experience.id);

    if (updateError) throw updateError;
  }

  let date = '';
  const time = '10:00';

  for (let offset = 14; offset <= 45; offset += 1) {
    const candidateDate = new Date();
    candidateDate.setDate(candidateDate.getDate() + offset);
    const candidate = formatDate(candidateDate);

    const { count, error: bookingCountError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('experience_id', experience.id)
      .eq('date', candidate)
      .eq('time', time)
      .in('status', ['PENDING', 'PAID', 'confirmed', 'pending', 'paid']);

    if (bookingCountError) throw bookingCountError;

    if (!count || count === 0) {
      date = candidate;
      break;
    }
  }

  if (!date) {
    throw new Error('Could not find an empty future booking slot for the test experience.');
  }

  const { data: existingSlots, error: slotFetchError } = await supabase
    .from('experience_availability')
    .select('experience_id')
    .eq('experience_id', experience.id)
    .eq('date', date)
    .eq('start_time', time)
    .limit(1);

  if (slotFetchError) throw slotFetchError;

  if (!existingSlots || existingSlots.length === 0) {
    const { error: slotInsertError } = await supabase
      .from('experience_availability')
      .insert({
        experience_id: experience.id,
        date,
        start_time: time,
        is_booked: false,
      });

    if (slotInsertError) throw slotInsertError;
  }

  return {
    experienceId: Number(experience.id),
    title: String(experience.title),
    hostId: String(experience.host_id),
    date,
    time,
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
  await page.locator('input[type="password"]').fill(guest.password);
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
    const bookableExperience = await prepareBookableExperience();
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
    let bookingAmount = 0;
    let generalInquiryId = '';
    let paymentBankAccount = '';
    let paymentBankName = '';

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
        { waitUntil: 'networkidle' }
      );

      await page.locator('input[placeholder="예약자 성함"]').fill(guest.fullName);
      await page.locator('input[placeholder="010-0000-0000"]').fill(guest.phone);

      await page.getByRole('button', { name: /무통장 입금/ }).click();

      const bankCard = page.locator('div').filter({ hasText: /입금하실 계좌/ }).last();
      paymentBankAccount = (await bankCard.locator('span.font-black').textContent())?.trim() || '';
      paymentBankName = (await bankCard.locator('span.bg-yellow-300').textContent())?.trim() || '';
      expect(paymentBankAccount).not.toBe('');
      expect(paymentBankName).not.toBe('');

      const noOffPlatformAgreement = page.getByText(/호스트와의 직접 연락.*플랫폼 외부 결제/).first();
      const safetyAgreement = page.getByText(/게스트 안전 가이드라인/).first();
      const termsAgreement = page.getByText(/구매 조건, 취소\/환불 규정/).first();

      await expect(noOffPlatformAgreement).toBeVisible({ timeout: 15000 });
      await expect(safetyAgreement).toBeVisible({ timeout: 15000 });
      await expect(termsAgreement).toBeVisible({ timeout: 15000 });

      await noOffPlatformAgreement.click();
      await safetyAgreement.click();
      await termsAgreement.click();

      await page.getByRole('button', { name: /결제하기/ }).click();
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
      bookingAmount = Number(bookingRow.amount || 0);
    });

    await test.step('Move from payment complete page into guest trips', async () => {
      await expect(page.getByText(/입금을 대기 중입니다|입금 확인 중|Payment pending/i)).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText(paymentBankAccount)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(new RegExp(paymentBankName))).toBeVisible({ timeout: 10000 });

      await page
        .getByRole('link', {
          name: /예약 상세 내역 보기|View booking details|Booking details|予約詳細|预订详情/,
        })
        .click();

      await page.waitForURL(/\/guest\/trips/, { timeout: 20000 });
      await expect(
        page.getByRole('heading', { name: bookableExperience.title, exact: true }).last()
      ).toBeVisible({ timeout: 20000 });
      await expect(page.getByText(new RegExp(`#${bookingOrderId}`)).last()).toBeVisible({ timeout: 20000 });
      await expect(page.getByText(bookableExperience.date).last()).toBeVisible({ timeout: 20000 });
      await expect(page.getByText(bookableExperience.time).last()).toBeVisible({ timeout: 20000 });
    });

    await test.step('Open the cancellation modal and verify refund policy copy', async () => {
      await page.locator('button:has(svg.lucide-more-horizontal)').first().click();
      await page.getByRole('button', { name: /취소 요청|취소 요청하기|Cancel/i }).click();

      const cancelModal = page.locator('div.fixed.inset-0.z-50').filter({
        hasText: /예약 취소 요청|취소 규정 요약/,
      });

      await expect(cancelModal).toBeVisible({ timeout: 10000 });
      await expect(cancelModal.getByText('결제 후 24시간 이내 철회(투어 2일 전까지): 100%')).toBeVisible({
        timeout: 10000,
      });
      await expect(cancelModal.getByText('20일 전: 100% / 8~19일 전: 80%')).toBeVisible({
        timeout: 10000,
      });
      await expect(cancelModal.getByText('2~7일 전: 70% / 1일 전: 40%')).toBeVisible({
        timeout: 10000,
      });
      await expect(cancelModal.getByText('당일/지난 일정: 환불 불가')).toBeVisible({
        timeout: 10000,
      });

      await cancelModal.getByRole('button', { name: /닫기|Close/i }).click();
      await expect(cancelModal).toBeHidden({ timeout: 10000 });
    });

    await test.step('Open and verify the receipt modal from guest trips', async () => {
      await page.getByRole('button', { name: /영수증|Receipt|領収書|收据/i }).last().click();

      const receiptModal = page.locator('div.fixed.inset-0.z-50').filter({
        hasText: /결제 영수증|Payment Receipt|領収書|付款收据/,
      });
      await expect(receiptModal).toBeVisible({ timeout: 15000 });
      await expect(receiptModal.getByText(String(bookingOrderId))).toBeVisible({ timeout: 10000 });
      await expect(receiptModal.getByText(bookableExperience.title)).toBeVisible({ timeout: 10000 });
      await expect(
        receiptModal.getByText(`₩${bookingAmount.toLocaleString()}`)
      ).toBeVisible({ timeout: 10000 });

      await receiptModal.getByRole('button').first().click();
      await expect(receiptModal).toBeHidden({ timeout: 10000 });
    });

    await test.step('Start a host chat from the booked trip card', async () => {
      await page.getByRole('button', { name: /메시지|Messages|Message|メッセージ|消息/i }).last().click();
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
  });
});
