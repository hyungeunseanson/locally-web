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
      title: `[Playwright] Cancellation Approved Locale ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: 'cancellation approved locale 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: 'locale 검증용 코스입니다.' }],
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
    .select('id, title')
    .single();

  if (error || !data?.id) {
    throw error || new Error(`Failed to create host experience for ${host.email}`);
  }

  const experienceId = Number(data.id);
  createdExperienceIds.push(experienceId);
  return {
    experienceId,
    title: data.title as string,
  };
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

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  await cleanupBookings(createdBookingIds);

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Cancellation approved notification localization', () => {
  test('stores localized cancellation-approved copy for the guest recipient locale', async ({ page }) => {
    const host = createTestUser('cancel.approved.locale.host');
    const guest = createTestUser('cancel.approved.locale.guest');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);

    await setPreferredLocale(guestId, 'en');

    const experience = await createHostOwnedExperience(hostId, host);
    const bookingId = await createConfirmedBooking({
      guestId,
      guest,
      experienceId: experience.experienceId,
    });

    await login(page, host);

    const response = await page.request.post('/api/notifications/email', {
      data: {
        recipient_id: guestId,
        booking_id: bookingId,
        type: 'cancellation_approved',
        title: '취소 및 환불이 승인되었습니다',
        message: `"${experience.title}" 취소 및 환불이 승인되었습니다.`,
        link: '/guest/trips',
        copy_key: 'cancellation_approved',
        copy_params: {
          experienceTitle: experience.title,
        },
      },
    });

    expect(response.status()).toBe(200);

    const { data: notification, error } = await getAdminClient()
      .from('notifications')
      .select('id, title, message, type, link')
      .eq('user_id', guestId)
      .eq('type', 'cancellation_approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    expect(notification?.title).toBe('Your cancellation and refund have been approved');
    expect(notification?.message).toContain(experience.title);
    expect(notification?.message).toContain('have been approved');
    expect(notification?.link).toBe('/guest/trips');

    if (notification?.id) createdNotificationIds.push(Number(notification.id));
  });
});
