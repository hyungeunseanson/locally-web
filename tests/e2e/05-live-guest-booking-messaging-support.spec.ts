import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';

const LIVE_BASE_URL = 'https://locally-web.vercel.app';
const HOST_EMAIL = 'codex.host.1772980212472@example.com';
const HOST_PASSWORD = 'LocallyTest!2026';
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
    email: `codex.guest.${timestamp}@example.com`,
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

async function findLatestInquiry(params: {
  userId: string;
  hostId: string;
  experienceId?: number;
  type: 'general' | 'admin_support';
}) {
  const supabase = getAdminClient();
  let query = supabase
    .from('inquiries')
    .select('id, type, experience_id, created_at')
    .eq('user_id', params.userId)
    .eq('host_id', params.hostId)
    .eq('type', params.type)
    .order('created_at', { ascending: false })
    .limit(1);

  if (params.experienceId != null) {
    query = query.eq('experience_id', String(params.experienceId));
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
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

async function findLatestAdminSupportInquiry(userId: string, content: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, host_id, content, type, created_at')
    .eq('user_id', userId)
    .eq('type', 'admin_support')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw error;

  return (data || []).find((row) => row.content === content) || null;
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

async function signUpGuest(page: Page, guest: ReturnType<typeof createUniqueGuest>) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('div.mt-6.text-center.text-sm > button').click();

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

  const signupSubmit = page.getByRole('button', { name: /회원가입|Sign up|登録|注册/ });
  if (await signupSubmit.isVisible().catch(() => false)) {
    throw new Error('Guest signup did not complete into an authenticated session.');
  }
}

async function loginHost(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${LIVE_BASE_URL}/login`, { waitUntil: 'networkidle' });

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/auth/v1/token?grant_type=password') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
    { timeout: 30000 }
  );

  await page.locator('input[type="email"]').fill(HOST_EMAIL);
  await page.locator('input[type="password"]').fill(HOST_PASSWORD);
  await page.locator('button[type="submit"]').click();

  await loginResponsePromise;
  await page.waitForTimeout(2000);

  return { context, page };
}

test.describe.serial('Live guest booking, host messaging, and support inquiry flow', () => {
  test.use({ baseURL: LIVE_BASE_URL });
  test.setTimeout(300000);

  test('creates a guest, books via bank transfer, messages the host, receives a reply, and sends admin support inquiry', async ({ browser, page }, testInfo) => {
    const guest = createUniqueGuest();
    const bookableExperience = await prepareBookableExperience();
    const guestToHostMessage = `E2E guest message ${Date.now()}`;
    const hostReplyMessage = `E2E host reply ${Date.now()}`;
    const adminInquiryMessage = `E2E admin support inquiry ${Date.now()}`;
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
    let generalInquiryId = '';
    let adminInquiryId = '';

    await test.step('Create a fresh guest account on the live site', async () => {
      await signUpGuest(page, guest);
      await page.waitForTimeout(5000);

      guestUserId = (await findGuestProfileIdByEmail(guest.email)) || '';
      if (!guestUserId) {
        throw new Error('Guest profile was not created after signup.');
      }
    });

    await test.step('Create a pending bank-transfer booking for the approved host experience', async () => {
      await page.goto(
        `/experiences/${bookableExperience.experienceId}/payment?date=${bookableExperience.date}&time=${bookableExperience.time}&guests=1`,
        { waitUntil: 'networkidle' }
      );

      await page.locator('input[placeholder="예약자 성함"]').fill(guest.fullName);
      await page.locator('input[placeholder="010-0000-0000"]').fill(guest.phone);

      await page.getByRole('button', { name: /무통장 입금/ }).click();
      await page.getByText(/직접 연락 및 플랫폼 외부 결제 유도/).click();
      await page.getByText(/게스트 안전 가이드라인/).click();
      await page.getByText(/구매 조건, 취소\/환불 규정/).click();

      await page.getByRole('button', { name: /결제하기/ }).click();
      await page.waitForURL(/\/payment\/complete\?orderId=/, { timeout: 30000 });

      const url = new URL(page.url());
      bookingOrderId = url.searchParams.get('orderId') || '';
      expect(bookingOrderId).not.toBe('');
      await expect(page.getByText(/메시지 보내러 가기/)).toBeVisible({ timeout: 15000 });
    });

    await test.step('Send the first guest-to-host inquiry from the booking completion flow', async () => {
      await page.getByRole('link', { name: /메시지 보내러 가기/ }).click();
      await page.waitForURL(/\/guest\/inbox/, { timeout: 20000 });

      const guestInput = page.locator('input[placeholder="메시지 입력..."], input[placeholder="Type a message..."]').first();
      await guestInput.fill(guestToHostMessage);
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

      generalInquiryId = String((await findLatestInquiry({
        userId: guestUserId,
        hostId: bookableExperience.hostId,
        experienceId: bookableExperience.experienceId,
        type: 'general',
      }))?.id || '');

      await page.goto(`/guest/inbox?inquiryId=${generalInquiryId}`, { waitUntil: 'networkidle' });
      await expect(
        page.locator('div.bg-black.text-white.rounded-tr-sm').filter({ hasText: guestToHostMessage }).last()
      ).toBeVisible({ timeout: 20000 });
    });

    await test.step('Log in as the host and reply to the guest message', async () => {
      const { context, page: hostPage } = await loginHost(browser);

      try {
        await hostPage.goto(`/host/dashboard?tab=inquiries&inquiryId=${generalInquiryId}`, {
          waitUntil: 'networkidle',
        });

        const guestBubble = hostPage
          .locator('div.bg-white.border.border-gray-200.rounded-tl-sm')
          .filter({ hasText: guestToHostMessage })
          .last();
        await expect(guestBubble).toBeVisible({ timeout: 20000 });

        const replyInput = hostPage.locator('input[placeholder="답장 입력..."], input[placeholder="Type a reply..."]').first();
        await replyInput.fill(hostReplyMessage);
        await hostPage.locator('button.bg-black.text-white.rounded-full').last().click();

        await expect
          .poll(async () => {
            const message = await findInquiryMessage(generalInquiryId, hostReplyMessage);
            return message?.id ? String(message.id) : '';
          }, {
            timeout: 15000,
            intervals: [500, 1000, 1500],
          })
          .not.toBe('');

        await expect(
          hostPage.locator('div.bg-black.text-white.rounded-tr-sm').filter({ hasText: hostReplyMessage }).last()
        ).toBeVisible({ timeout: 20000 });
      } finally {
        await context.close();
      }
    });

    await test.step('Verify the host reply appears in the guest inbox', async () => {
      await page.goto(`/guest/inbox?inquiryId=${generalInquiryId}`, { waitUntil: 'networkidle' });
      await expect(
        page.locator('div.bg-white.border.border-gray-200.rounded-tl-sm').filter({ hasText: hostReplyMessage }).last()
      ).toBeVisible({ timeout: 20000 });
    });

    await test.step('Send a 1:1 admin support inquiry as the guest', async () => {
      await page.goto('/help', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /1:1 채팅 문의|Chat Support|チャットサポート|在线咨询/ }).click();
      await page
        .locator(
          'textarea[placeholder="문의하실 내용을 입력해주세요."], textarea[placeholder="Please enter your inquiry."], textarea[placeholder="お問い合わせ内容を入力してください。"], textarea[placeholder="请输入咨询内容。"]'
        )
        .fill(adminInquiryMessage);
      await page.getByRole('button', { name: /문의 접수|Send inquiry|お問い合わせ送信|提交咨询/ }).click();

      await page.waitForURL(/\/guest\/inbox\?inquiryId=/, { timeout: 20000 });
      await expect(page.getByText(adminInquiryMessage).last()).toBeVisible({ timeout: 20000 });

      await expect
        .poll(async () => {
          const inquiry = await findLatestAdminSupportInquiry(guestUserId, adminInquiryMessage);
          return inquiry?.id ? String(inquiry.id) : '';
        }, {
          timeout: 15000,
          intervals: [500, 1000, 1500],
        })
        .not.toBe('');

      adminInquiryId = String((await findLatestAdminSupportInquiry(guestUserId, adminInquiryMessage))?.id || '');
    });

    await test.step('Capture the final live state and attach identifiers', async () => {
      await page.screenshot({
        path: testInfo.outputPath('live-guest-booking-messaging-support.png'),
        fullPage: true,
      });

      await testInfo.attach('live-flow-metadata.json', {
        body: JSON.stringify(
          {
            guest,
            guestUserId,
            experience: bookableExperience,
            bookingOrderId,
            generalInquiryId,
            adminInquiryId,
            guestToHostMessage,
            hostReplyMessage,
            adminInquiryMessage,
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
