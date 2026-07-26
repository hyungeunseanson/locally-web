import { expect, test, type Page } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupBookings,
  createAuthUser,
  createTestUser,
  ensureAvailabilitySlot,
  getAdminClient,
  login,
  type AvailabilityKey,
  type TestUser,
} from './helpers/experienceBooking';

type Locale = 'ko' | 'en' | 'ja' | 'zh';

const createdAuthUserIds: string[] = [];
const createdBookingIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdNotificationIds: number[] = [];
const createdInquiryIds: number[] = [];
const createdWhitelistEmails: string[] = [];
const createdAvailabilityKeys: AvailabilityKey[] = [];

async function setPreferredLocale(userId: string, locale: Locale) {
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

async function waitForPreferredLocale(userId: string, locale: Locale) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) throw error;

    const value = data.user?.user_metadata?.preferred_locale;
    if (value === locale) return;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`preferred_locale for ${userId} did not become ${locale}.`);
}

async function createHostOwnedExperience(hostId: string, host: TestUser) {
  const { data, error } = await getAdminClient()
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Notification Localization ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '알림 다국어 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '알림 다국어 검증용 코스입니다.' }],
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
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error(`Failed to create host experience for ${host.email}`);
  }

  const experienceId = Number(data.id);
  createdExperienceIds.push(experienceId);
  return experienceId;
}

async function makeAdminAndWhitelist(userId: string, email: string) {
  const supabase = getAdminClient();

  const { error: userError } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        email,
        role: 'admin',
      },
      { onConflict: 'id' }
    );

  if (userError) throw userError;

  const { error: whitelistError } = await supabase
    .from('admin_whitelist')
    .upsert({ email }, { onConflict: 'email' });

  if (whitelistError) throw whitelistError;
  createdWhitelistEmails.push(email);
}

async function waitForNotification(params: {
  userId: string;
  type?: string;
  title: string;
}) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    let query = supabase
      .from('notifications')
      .select('id, type, title, message, link, booking_id')
      .eq('user_id', params.userId)
      .eq('title', params.title)
      .order('created_at', { ascending: false })
      .limit(1);

    if (params.type) {
      query = query.eq('type', params.type);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    if (data?.id) {
      createdNotificationIds.push(Number(data.id));
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Notification not found: ${params.title}`);
}

async function loginWithStoredLocale(page: Page, user: TestUser, locale: Locale) {
  await page.context().clearCookies();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.addInitScript(({ value }) => {
    window.localStorage.setItem('app_lang', value);
    document.cookie = `app_lang=${value}; path=/`;
  }, { value: locale });

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

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  if (createdInquiryIds.length > 0) {
    await supabase.from('inquiry_messages').delete().in('inquiry_id', createdInquiryIds);
    await supabase.from('inquiries').delete().in('id', createdInquiryIds);
  }

  if (createdWhitelistEmails.length > 0) {
    for (const email of createdWhitelistEmails) {
      await supabase.from('admin_whitelist').delete().eq('email', email);
    }
  }

  await cleanupBookings(createdBookingIds);

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Notification localization runtime', () => {
  test.describe.configure({ timeout: 120000 });

  test('syncs preferred_locale from the stored UI language on login', async ({ page }) => {
    const user = createTestUser('notification.locale.sync');
    const userId = await createAuthUser(user, createdAuthUserIds);

    await loginWithStoredLocale(page, user, 'ja');
    await waitForPreferredLocale(userId, 'ja');
  });

  test('localizes new booking, confirmed booking, inquiry, and membership notifications by recipient locale', async ({ page }) => {
    const host = createTestUser('notification.locale.host');
    const guest = createTestUser('notification.locale.guest');
    const admin = createTestUser('notification.locale.admin');

    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const adminId = await createAuthUser(admin, createdAuthUserIds);

    await setPreferredLocale(hostId, 'ja');
    await setPreferredLocale(guestId, 'en');
    await setPreferredLocale(adminId, 'ko');
    await makeAdminAndWhitelist(adminId, admin.email);

    const experienceId = await createHostOwnedExperience(hostId, host);
    const date = new Date();
    date.setDate(date.getDate() + 15);
    const bookingDate = date.toISOString().slice(0, 10);
    const bookingTime = '10:00';

    await ensureAvailabilitySlot(
      {
        experienceId,
        date: bookingDate,
        time: bookingTime,
      },
      createdAvailabilityKeys
    );

    await login(page, guest);
    const bookingResponse = await page.request.post('/api/bookings', {
      data: {
        experienceId,
        date: bookingDate,
        time: bookingTime,
        guests: 1,
        isPrivate: false,
        isSoloGuarantee: false,
        customerName: guest.fullName,
        customerPhone: guest.phone,
        paymentMethod: 'bank',
      },
    });

    expect(bookingResponse.status()).toBe(200);
    const bookingBody = await bookingResponse.json();
    const bookingId = String(bookingBody.newOrderId);
    createdBookingIds.push(bookingId);

    const guestPendingNotification = await waitForNotification({
      userId: guestId,
      type: 'booking_pending',
      title: '⏳ Booking received (payment confirmation pending)',
    });
    expect(guestPendingNotification.message).toContain('confirmed after payment is verified');
    expect(guestPendingNotification.link).toBe('/guest/trips');
    expect(guestPendingNotification.booking_id).toBe(bookingId);

    const { data: pendingBooking, error: pendingBookingError } = await getAdminClient()
      .from('bookings')
      .select('status, amount, total_price, guests, payment_method, is_solo_guarantee')
      .eq('id', bookingId)
      .maybeSingle();
    if (pendingBookingError) throw pendingBookingError;
    expect(pendingBooking).toMatchObject({
      status: 'PENDING',
      amount: Number(bookingBody.finalAmount),
      guests: 1,
      payment_method: 'bank',
      is_solo_guarantee: false,
    });
    expect(Number(pendingBooking?.total_price)).toBeGreaterThan(0);

    const hostPendingNotification = await waitForNotification({
      userId: hostId,
      type: 'new_booking',
      title: '⏳ 新しい予約（入金待ち）',
    });
    expect(hostPendingNotification.message).toContain('銀行振込予約');

    await login(page, admin);
    const confirmResponse = await page.request.post('/api/admin/bookings/confirm-payment', {
      data: { bookingId },
    });
    expect(confirmResponse.status()).toBe(200);

    const hostConfirmedNotification = await waitForNotification({
      userId: hostId,
      type: 'booking_confirmed',
      title: '💰 入金確認完了！ゲストに今すぐメッセージを',
    });
    expect(hostConfirmedNotification.message).toContain('入金確認が完了しました');

    const guestConfirmedNotification = await waitForNotification({
      userId: guestId,
      type: 'booking_confirmed',
      title: '✅ Booking confirmation',
    });
    expect(guestConfirmedNotification.message).toContain('bank transfer');

    const memberNotification = await waitForNotification({
      userId: guestId,
      type: 'member_welcome',
      title: '✨ Tier 1 is now open',
    });
    expect(memberNotification.message).toContain('first purchase');

    await login(page, guest);
    const inquiryThreadResponse = await page.request.post('/api/inquiries/thread', {
      data: {
        contextType: 'experience_general',
        experienceId,
        message: 'Please share the exact meeting spot.',
      },
    });

    expect(inquiryThreadResponse.status()).toBe(200);
    const inquiryThreadBody = await inquiryThreadResponse.json();
    const inquiryId = Number(inquiryThreadBody.inquiryId);
    createdInquiryIds.push(inquiryId);

    const hostInquiryNotification = await waitForNotification({
      userId: hostId,
      type: 'new_message',
      title: `💬 ${guest.fullName}さんから新しいメッセージ`,
    });
    expect(hostInquiryNotification.message).toBe('Please share the exact meeting spot.');

    await login(page, host);
    const inquiryReplyResponse = await page.request.post('/api/inquiries/message', {
      data: {
        inquiryId,
        content: 'Meet me at Exit 1 of Hongdae Station.',
      },
    });
    expect(inquiryReplyResponse.status()).toBe(200);

    const guestInquiryNotification = await waitForNotification({
      userId: guestId,
      type: 'new_message',
      title: `💬 New message from ${host.fullName}`,
    });
    expect(guestInquiryNotification.message).toBe('Meet me at Exit 1 of Hongdae Station.');
  });
});
