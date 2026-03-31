import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupBookings,
  createAuthUser,
  createTestUser,
  getAdminClient,
  insertTestBooking,
  login,
  type TestUser,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdBookingIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdNotificationIds: number[] = [];
const createdWhitelistEmails: string[] = [];

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

async function createHostOwnedExperience(hostId: string, host: TestUser) {
  const { data, error } = await getAdminClient()
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Host Unavailable Notification ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '호스트 진행 불가 검토 알림 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '알림 검증용 코스입니다.' }],
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

async function createConfirmedBooking(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
}) {
  const date = new Date();
  date.setDate(date.getDate() + 10);
  const bookingId = await insertTestBooking({
    userId: params.guestId,
    experienceId: params.experienceId,
    date: date.toISOString().slice(0, 10),
    time: '10:00',
    guests: 2,
    status: 'confirmed',
    paymentMethod: 'bank',
    amount: 60000,
    totalPrice: 60000,
    contactName: params.guest.fullName,
    contactPhone: params.guest.phone,
  });

  createdBookingIds.push(bookingId);
  return bookingId;
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

async function deleteCapturedNotifications() {
  if (createdNotificationIds.length === 0) return;
  await getAdminClient().from('notifications').delete().in('id', createdNotificationIds);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  await deleteCapturedNotifications();
  await cleanupBookings(createdBookingIds);

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Host-unavailable review notifications', () => {
  test('creates guest + host in-app notifications and admin alert on review request', async ({ page }) => {
    const host = createTestUser('host.unavailable.notify.host');
    const guest = createTestUser('host.unavailable.notify.guest');
    const admin = createTestUser('host.unavailable.notify.admin');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const adminId = await createAuthUser(admin, createdAuthUserIds);
    await setPreferredLocale(hostId, 'ko');
    await setPreferredLocale(guestId, 'en');
    await setPreferredLocale(adminId, 'ko');
    await makeAdminAndWhitelist(adminId, admin.email);

    const experienceId = await createHostOwnedExperience(hostId, host);
    const bookingId = await createConfirmedBooking({
      guestId,
      guest,
      experienceId,
    });

    await login(page, guest);

    const response = await page.request.post('/api/payment/cancel', {
      data: {
        bookingId,
        reasonCode: 'host_unavailable',
        reason: '호스트가 오늘 진행 불가하다고 안내함',
      },
    });

    expect(response.status()).toBe(200);

    const supabase = getAdminClient();

    const { data: guestNotification, error: guestNotificationError } = await supabase
      .from('notifications')
      .select('id, type, title, link, message')
      .eq('user_id', guestId)
      .eq('type', 'cancellation')
      .eq('title', 'Your cancellation review request was received.')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (guestNotificationError) throw guestNotificationError;
    expect(guestNotification?.link).toBe('/guest/trips');
    expect(guestNotification?.message).toContain('submitted for admin review');
    if (guestNotification?.id) createdNotificationIds.push(Number(guestNotification.id));

    const { data: hostNotification, error: hostNotificationError } = await supabase
      .from('notifications')
      .select('id, type, title, link, message')
      .eq('user_id', hostId)
      .eq('type', 'cancellation')
      .eq('title', '호스트 진행 불가 취소 검토 요청')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (hostNotificationError) throw hostNotificationError;
    expect(hostNotification?.link).toBe('/host/dashboard');
    expect(hostNotification?.message).toContain('운영팀 검토');
    if (hostNotification?.id) createdNotificationIds.push(Number(hostNotification.id));

    const { data: adminAlert, error: adminAlertError } = await supabase
      .from('notifications')
      .select('id, type, title, link, message')
      .eq('user_id', adminId)
      .eq('type', 'admin_alert')
      .eq('title', '호스트 진행 불가 취소 검토 요청')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (adminAlertError) throw adminAlertError;
    expect(adminAlert?.link).toBe('/admin/dashboard?tab=LEDGER');
    expect(adminAlert?.message).toContain('호스트 진행 불가 사유로 취소 검토를 요청했습니다');
    if (adminAlert?.id) createdNotificationIds.push(Number(adminAlert.id));
  });

  test('sends guest + host in-app notifications on admin reject and approve actions', async ({ page }) => {
    const host = createTestUser('host.unavailable.notify.flow.host');
    const guest = createTestUser('host.unavailable.notify.flow.guest');
    const admin = createTestUser('host.unavailable.notify.flow.admin');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const adminId = await createAuthUser(admin, createdAuthUserIds);
    await setPreferredLocale(hostId, 'ko');
    await setPreferredLocale(guestId, 'en');
    await setPreferredLocale(adminId, 'ko');
    await makeAdminAndWhitelist(adminId, admin.email);

    const experienceId = await createHostOwnedExperience(hostId, host);
    const firstBookingId = await createConfirmedBooking({
      guestId,
      guest,
      experienceId,
    });

    await login(page, guest);
    const firstReviewResponse = await page.request.post('/api/payment/cancel', {
      data: {
        bookingId: firstBookingId,
        reasonCode: 'host_unavailable',
        reason: '첫번째 검토 요청',
      },
    });
    expect(firstReviewResponse.status()).toBe(200);

    await login(page, admin);
    const rejectResponse = await page.request.post('/api/admin/bookings/reject-host-unavailable', {
      data: { bookingId: firstBookingId },
    });
    expect(rejectResponse.status()).toBe(200);

    const supabase = getAdminClient();

    const { data: rejectedGuestNotification, error: rejectedGuestNotificationError } = await supabase
      .from('notifications')
      .select('id, title, message')
      .eq('user_id', guestId)
      .eq('title', 'The host-unavailable cancellation request was declined.')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rejectedGuestNotificationError) throw rejectedGuestNotificationError;
    expect(rejectedGuestNotification?.message).toContain('will stay active');
    if (rejectedGuestNotification?.id) createdNotificationIds.push(Number(rejectedGuestNotification.id));

    const { data: rejectedHostNotification, error: rejectedHostNotificationError } = await supabase
      .from('notifications')
      .select('id, title, message')
      .eq('user_id', hostId)
      .eq('title', '호스트 진행 불가 취소 요청이 반려되었습니다.')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rejectedHostNotificationError) throw rejectedHostNotificationError;
    expect(rejectedHostNotification?.message).toContain('예약은 유지');
    if (rejectedHostNotification?.id) createdNotificationIds.push(Number(rejectedHostNotification.id));

    const secondBookingId = await createConfirmedBooking({
      guestId,
      guest,
      experienceId,
    });

    await login(page, guest);
    const secondReviewResponse = await page.request.post('/api/payment/cancel', {
      data: {
        bookingId: secondBookingId,
        reasonCode: 'host_unavailable',
        reason: '두번째 검토 요청',
      },
    });
    expect(secondReviewResponse.status()).toBe(200);

    await login(page, admin);
    const approveResponse = await page.request.post('/api/admin/bookings/force-cancel', {
      data: {
        bookingId: secondBookingId,
        source: 'host_fault_request',
      },
    });
    expect(approveResponse.status()).toBe(200);

    const { data: approvedGuestNotification, error: approvedGuestNotificationError } = await supabase
      .from('notifications')
      .select('id, title, message')
      .eq('user_id', guestId)
      .eq('title', 'The booking was cancelled due to host unavailable.')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (approvedGuestNotificationError) throw approvedGuestNotificationError;
    expect(approvedGuestNotification?.message).toContain('cancelled due to host unavailable');
    if (approvedGuestNotification?.id) createdNotificationIds.push(Number(approvedGuestNotification.id));

    const { data: approvedHostNotification, error: approvedHostNotificationError } = await supabase
      .from('notifications')
      .select('id, title, message')
      .eq('user_id', hostId)
      .eq('title', '😢 예약이 취소되었습니다.')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (approvedHostNotificationError) throw approvedHostNotificationError;
    expect(approvedHostNotification?.message).toContain('호스트 진행 불가 사유로 취소 처리되었습니다');
    if (approvedHostNotification?.id) createdNotificationIds.push(Number(approvedHostNotification.id));
  });
});
