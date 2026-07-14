import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  cleanupAvailability,
  ensureAvailabilitySlot,
  findEmptyFutureDate,
  getAdminClient,
  reviewAllExperiencePaymentAgreements,
  type AvailabilityKey,
} from './helpers/experienceBooking';
import { requireLiveBaseUrl } from './helpers/liveBaseUrl';

const LIVE_BASE_URL = requireLiveBaseUrl();

const HOST_EMAIL = 'codex.host.1772980212472@example.com';
const HOST_PASSWORD = 'LocallyTest!2026';
const HOST_FALLBACK_NAME = 'Codex Live Host';
const HOST_FALLBACK_PHONE = '01017720212';
const HOST_EXPERIENCE_TITLE_PREFIX = '[Playwright] Live Guest Messaging Host';

type LiveHostAccount = {
  userId: string;
  email: string;
  fullName: string;
  phone: string;
};

type LiveHostExperience = {
  experienceId: number;
  title: string;
  hostId: string;
  maxGuests: number;
  price: number;
  privatePrice: number;
  isPrivateEnabled: boolean;
};

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

async function ensureApprovedLiveHostAccount(): Promise<LiveHostAccount> {
  const supabase = getAdminClient();
  let userId: string | null = null;

  const knownUserResult = await supabase.auth.admin.getUserById('cc84b331-7e78-4818-b9ba-f1a960017473');
  if (knownUserResult.data.user?.email?.toLowerCase() === HOST_EMAIL.toLowerCase()) {
    userId = knownUserResult.data.user.id;
  } else {
    const listedUsers = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matchedUser = listedUsers.data.users.find((user) => user.email?.toLowerCase() === HOST_EMAIL.toLowerCase());
    if (matchedUser?.id) {
      userId = matchedUser.id;
    }
  }

  if (userId) {
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(userId, {
      email: HOST_EMAIL,
      password: HOST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: HOST_FALLBACK_NAME,
        phone: HOST_FALLBACK_PHONE,
      },
    });

    if (updateUserError) throw updateUserError;
  } else {
    const createdUser = await supabase.auth.admin.createUser({
      email: HOST_EMAIL,
      password: HOST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: HOST_FALLBACK_NAME,
        phone: HOST_FALLBACK_PHONE,
      },
    });

    if (createdUser.error || !createdUser.data.user?.id) {
      throw createdUser.error || new Error(`Failed to create live host auth user for ${HOST_EMAIL}`);
    }

    userId = createdUser.data.user.id;
  }

  await waitForProfile(userId);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: HOST_FALLBACK_NAME,
      phone: HOST_FALLBACK_PHONE,
    })
    .eq('id', userId);

  if (profileError) throw profileError;

  const latestApplication = await supabase
    .from('host_applications')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestApplication.error) throw latestApplication.error;

  const hostApplicationPayload = {
    user_id: userId,
    host_nationality: '대한민국',
    languages: ['한국어'],
    language_levels: [{ language: '한국어', level: 5 }],
    name: HOST_FALLBACK_NAME,
    phone: HOST_FALLBACK_PHONE,
    dob: '1992-04-12',
    email: HOST_EMAIL,
    instagram: '@codex_live_host',
    source: 'playwright',
    language_cert: '',
    profile_photo: '',
    self_intro: '라이브 메시징 E2E 검증용 승인 호스트입니다.',
    id_card_file: '',
    bank_name: '국민은행',
    account_number: '12345678901234',
    account_holder: HOST_FALLBACK_NAME,
    motivation: '라이브 guest-host messaging 플로우 검증',
    status: 'approved',
  };

  if (latestApplication.data?.id) {
    const { error: updateApplicationError } = await supabase
      .from('host_applications')
      .update(hostApplicationPayload)
      .eq('id', latestApplication.data.id);

    if (updateApplicationError) throw updateApplicationError;
  } else {
    const { error: insertApplicationError } = await supabase
      .from('host_applications')
      .insert(hostApplicationPayload);

    if (insertApplicationError) throw insertApplicationError;
  }

  return {
    userId,
    email: HOST_EMAIL,
    fullName: HOST_FALLBACK_NAME,
    phone: HOST_FALLBACK_PHONE,
  };
}

async function ensureLiveHostExperience(hostId: string): Promise<LiveHostExperience> {
  const supabase = getAdminClient();
  const { data: recentExperiences, error: recentExperiencesError } = await supabase
    .from('experiences')
    .select('id, title, status, host_id, max_guests, price, private_price, is_private_enabled')
    .eq('host_id', hostId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (recentExperiencesError) throw recentExperiencesError;

  const existingExperience = (recentExperiences || []).find((experience) =>
    String(experience.title || '').includes(HOST_EXPERIENCE_TITLE_PREFIX)
  );

  if (existingExperience?.id) {
    if (!['approved', 'active'].includes(String(existingExperience.status || '').toLowerCase())) {
      const { error: updateExperienceError } = await supabase
        .from('experiences')
        .update({ status: 'approved', is_active: true })
        .eq('id', existingExperience.id);

      if (updateExperienceError) throw updateExperienceError;
    }

    return {
      experienceId: Number(existingExperience.id),
      title: String(existingExperience.title || HOST_EXPERIENCE_TITLE_PREFIX),
      hostId: String(existingExperience.host_id || hostId),
      maxGuests: Number(existingExperience.max_guests || 4),
      price: Number(existingExperience.price || 30000),
      privatePrice: Number(existingExperience.private_price || 0),
      isPrivateEnabled: Boolean(existingExperience.is_private_enabled),
    };
  }

  const { data: createdExperience, error: createExperienceError } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `${HOST_EXPERIENCE_TITLE_PREFIX} ${new Date().toISOString().slice(0, 10)}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '라이브 guest-host messaging E2E 검증용 고정 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '라이브 메시징 검증용 테스트 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 30000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'approved',
      is_active: true,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id, title, host_id, max_guests, price, private_price, is_private_enabled')
    .single();

  if (createExperienceError || !createdExperience?.id) {
    throw createExperienceError || new Error('Failed to create the live host experience fixture.');
  }

  return {
    experienceId: Number(createdExperience.id),
    title: String(createdExperience.title || HOST_EXPERIENCE_TITLE_PREFIX),
    hostId: String(createdExperience.host_id || hostId),
    maxGuests: Number(createdExperience.max_guests || 4),
    price: Number(createdExperience.price || 30000),
    privatePrice: Number(createdExperience.private_price || 0),
    isPrivateEnabled: Boolean(createdExperience.is_private_enabled),
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

  const signupToggle = page.getByRole('button', {
    name: /Don't have an account\?|계정 생성|회원가입|Sign up|登録|注册/
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

  const signupSubmit = page.getByRole('button', { name: /회원가입|Sign up|登録|注册/ });
  if (await signupSubmit.isVisible().catch(() => false)) {
    throw new Error('Guest signup did not complete into an authenticated session.');
  }
}

async function loginHost(browser: Browser) {
  await ensureApprovedLiveHostAccount();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${LIVE_BASE_URL}/login`, { waitUntil: 'networkidle' });

  await page.locator('input[type="email"]').fill(HOST_EMAIL);
  await page.locator('input[type="password"]').fill(HOST_PASSWORD);
  await page.locator('button[type="submit"]').click();

  const results = await Promise.allSettled([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 }),
    page.getByText('Welcome back. You are now logged in.').waitFor({ state: 'visible', timeout: 30000 }),
    expect
      .poll(
        async () => {
          const cookies = await page.context().cookies();
          return cookies.some((cookie) => cookie.name.startsWith('sb-') && cookie.value.length > 0);
        },
        { timeout: 30000 }
      )
      .toBeTruthy(),
  ]);

  if (results.every((result) => result.status === 'rejected')) {
    const invalidCredentialsVisible = await page
      .getByText(/invalid email or password|이메일 또는 비밀번호가 올바르지 않습니다|ログイン情報が正しくありません|邮箱或密码不正确/i)
      .isVisible()
      .catch(() => false);
    const rateLimitVisible = await page
      .getByText(/too many attempts|잠시 후 다시 시도|しばらくしてから再度お試しください|请稍后重试/i)
      .isVisible()
      .catch(() => false);

    if (invalidCredentialsVisible) {
      throw new Error(`Login credentials were rejected for ${HOST_EMAIL}`);
    }
    if (rateLimitVisible) {
      throw new Error(`Login appears rate-limited for ${HOST_EMAIL}`);
    }

    throw new Error(`Login did not complete for ${HOST_EMAIL}`);
  }

  return { context, page };
}

test.describe.serial('Live guest booking, host messaging, and support inquiry flow', () => {
  test.use({ baseURL: LIVE_BASE_URL });
  test.setTimeout(300000);

  test('creates a guest, books via bank transfer, messages the host, receives a reply, and sends admin support inquiry', async ({ browser, page }, testInfo) => {
    const guest = createUniqueGuest();
    const createdAvailabilityKeys: AvailabilityKey[] = [];
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

    try {
      const liveHost = await ensureApprovedLiveHostAccount();
      const liveHostExperience = await ensureLiveHostExperience(liveHost.userId);
      const liveExperienceTime = '10:00';
      const liveExperienceDate = await findEmptyFutureDate(
        liveHostExperience.experienceId,
        liveExperienceTime,
        14,
        45
      );

      await ensureAvailabilitySlot(
        {
          experienceId: liveHostExperience.experienceId,
          date: liveExperienceDate,
          time: liveExperienceTime,
        },
        createdAvailabilityKeys
      );

      const bookableExperience = {
        ...liveHostExperience,
        date: liveExperienceDate,
        time: liveExperienceTime,
      };

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
        await expect(page.locator('a[href^="/guest/inbox"]').last()).toBeVisible({ timeout: 15000 });
      });

      await test.step('Send the first guest-to-host inquiry from the booking completion flow', async () => {
        await page.locator('a[href^="/guest/inbox"]').last().click();
        await page.waitForURL(/\/guest\/inbox/, { timeout: 20000 });

        const guestInput = page.getByTestId('guest-chat-composer');
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

          await expect(hostPage.getByText(guestToHostMessage).first()).toBeVisible({ timeout: 20000 });

          const replyInput = hostPage.getByTestId('host-chat-composer');
          await replyInput.fill(hostReplyMessage);
          await replyInput.press('Enter');

          await expect
            .poll(async () => {
              const message = await findInquiryMessage(generalInquiryId, hostReplyMessage);
              return message?.id ? String(message.id) : '';
            }, {
              timeout: 15000,
              intervals: [500, 1000, 1500],
            })
            .not.toBe('');

          await expect(hostPage.getByText(hostReplyMessage).last()).toBeVisible({ timeout: 20000 });
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
