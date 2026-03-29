import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  createAuthUser,
  createTestUser,
  getAdminClient,
  login,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
const createdNotificationIds: number[] = [];

type NotificationRow = {
  id: number;
  title: string | null;
  message: string | null;
  link: string | null;
};

async function createHostExperience(hostId: string) {
  const { data, error } = await getAdminClient()
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Notification Owner ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: 'notification ownership 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: 'notification ownership 검증용 코스입니다.' }],
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
    throw error || new Error('Failed to create host experience.');
  }

  const experienceId = Number(data.id);
  createdExperienceIds.push(experienceId);
  return experienceId;
}

async function createBooking(params: {
  guestId: string;
  guestName: string;
  guestPhone: string;
  experienceId: number;
}) {
  const bookingId = `TEST-NOTI-BOOKING-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 14);
  const { error } = await getAdminClient().from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 30000,
    total_price: 30000,
    status: 'PENDING',
    guests: 1,
    date: serviceDate.toISOString().slice(0, 10),
    time: '10:00',
    type: 'group',
    contact_name: params.guestName,
    contact_phone: params.guestPhone,
    message: '',
    created_at: new Date().toISOString(),
    payment_method: 'bank',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
}

async function findNotificationIdByTitle(userId: string, title: string) {
  const { data, error } = await getAdminClient()
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) return null;

  const id = Number(data.id);
  createdNotificationIds.push(id);
  return id;
}

async function findNotificationByTitle(userId: string, title: string) {
  const { data, error } = await getAdminClient()
    .from('notifications')
    .select('id, title, message, link')
    .eq('user_id', userId)
    .eq('title', title)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) return null;

  const notification = data as NotificationRow;
  createdNotificationIds.push(Number(notification.id));
  return notification;
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Notification email policy', () => {
  test('requires authentication for notification send requests', async ({ request }) => {
    const response = await request.post('/api/notifications/email', {
      data: {
        recipient_id: 'missing-auth',
        type: 'new_booking',
        title: 'Unauthenticated Notification',
        message: 'blocked',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('blocks non-admin mass notification attempts', async ({ page }) => {
    const sender = createTestUser('noti.mass.sender');
    const recipientA = createTestUser('noti.mass.recipient-a');
    const recipientB = createTestUser('noti.mass.recipient-b');
    await createAuthUser(sender, createdAuthUserIds);
    const recipientAId = await createAuthUser(recipientA, createdAuthUserIds);
    const recipientBId = await createAuthUser(recipientB, createdAuthUserIds);

    await login(page, sender);

    const response = await page.request.post('/api/notifications/email', {
      data: {
        recipient_ids: [recipientAId, recipientBId],
        type: 'general',
        title: `Playwright Mass Send ${Date.now()}`,
        message: 'mass send must be blocked',
        link: '/notifications',
      },
    });

    expect(response.status()).toBe(403);
  });

  test('blocks a guest from sending a booking notification to an unrelated recipient', async ({ page }) => {
    const host = createTestUser('noti.host');
    const guest = createTestUser('noti.guest');
    const stranger = createTestUser('noti.stranger');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const strangerId = await createAuthUser(stranger, createdAuthUserIds);
    const experienceId = await createHostExperience(hostId);
    const bookingId = await createBooking({
      guestId,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      experienceId,
    });

    await login(page, guest);

    const title = `Playwright Unauthorized Booking Notification ${Date.now()}`;
    const response = await page.request.post('/api/notifications/email', {
      data: {
        recipient_id: strangerId,
        type: 'new_booking',
        booking_id: bookingId,
        title,
        message: 'should be forbidden',
        link: '/host/dashboard',
      },
    });

    expect(response.status()).toBe(403);

    const notificationId = await findNotificationIdByTitle(strangerId, title);
    expect(notificationId).toBeNull();
  });

  test('allows a legitimate single-recipient booking notification based on ownership', async ({ page }) => {
    const host = createTestUser('noti.legit.host');
    const guest = createTestUser('noti.legit.guest');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const experienceId = await createHostExperience(hostId);
    const bookingId = await createBooking({
      guestId,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      experienceId,
    });

    await login(page, guest);

    const title = `Playwright Legit Booking Notification ${Date.now()}`;
    const response = await page.request.post('/api/notifications/email', {
      data: {
        recipient_id: hostId,
        type: 'new_booking',
        booking_id: bookingId,
        title,
        message: 'legitimate ownership based notification',
        link: '/host/dashboard',
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });

    const notificationId = await findNotificationIdByTitle(hostId, title);
    expect(notificationId).not.toBeNull();
  });

  test('stores HTML-like text safely and drops unsafe links from legitimate notifications', async ({ page }) => {
    const host = createTestUser('noti.sanitized.host');
    const guest = createTestUser('noti.sanitized.guest');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const experienceId = await createHostExperience(hostId);
    const bookingId = await createBooking({
      guestId,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      experienceId,
    });

    await login(page, guest);

    const title = `Playwright <b>Unsafe</b> Booking Notification ${Date.now()}`;
    const message = 'Unsafe <img src=x onerror=alert(1)> content should stay text only';
    const response = await page.request.post('/api/notifications/email', {
      data: {
        recipient_id: hostId,
        type: 'new_booking',
        booking_id: bookingId,
        title,
        message,
        link: 'javascript:alert(1)',
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });

    const notification = await findNotificationByTitle(hostId, title);
    expect(notification).not.toBeNull();
    expect(notification?.title).toBe(title);
    expect(notification?.message).toBe(message);
    expect(notification?.link).toBeNull();
  });
});
