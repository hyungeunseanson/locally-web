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

async function createHostOwnedExperience(hostId: string, host: TestUser) {
  const { data, error } = await getAdminClient()
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Cancel Host Experience ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '체험 취소 error-safe 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '취소 error-safe 검증용 코스입니다.' }],
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

async function createBookingForExperience(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
  status: string;
  paymentMethod?: 'card' | 'bank' | 'paypal';
  amount?: number;
}) {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  const bookingId = await insertTestBooking({
    userId: params.guestId,
    experienceId: params.experienceId,
    date: date.toISOString().slice(0, 10),
    time: '10:00',
    guests: 1,
    status: params.status,
    paymentMethod: params.paymentMethod || 'bank',
    amount: params.amount ?? 30000,
    totalPrice: params.amount ?? 30000,
    contactName: params.guest.fullName,
    contactPhone: params.guest.phone,
  });

  createdBookingIds.push(bookingId);
  return bookingId;
}

async function promoteBookingToPaidCardWithTid(bookingId: string) {
  const { error } = await getAdminClient()
    .from('bookings')
    .update({
      status: 'PAID',
      payment_method: 'card',
      tid: `TID-${Date.now()}`,
    })
    .eq('id', bookingId);

  if (error) throw error;
}

async function makeUserAdmin(userId: string, email: string) {
  const { error } = await getAdminClient()
    .from('users')
    .upsert(
      {
        id: userId,
        email,
        role: 'admin',
      },
      { onConflict: 'id' }
    );

  if (error) throw error;
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  await cleanupBookings(createdBookingIds);

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Experience cancel error-safe flow', () => {
  test('rejects cancellation attempts from unrelated guests', async ({ page }) => {
    const host = createTestUser('exp.cancel.host');
    const guest = createTestUser('exp.cancel.guest');
    const otherGuest = createTestUser('exp.cancel.other');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    await createAuthUser(otherGuest, createdAuthUserIds);

    const experienceId = await createHostOwnedExperience(hostId, host);
    const bookingId = await createBookingForExperience({
      guestId,
      guest,
      experienceId,
      status: 'PENDING',
      paymentMethod: 'bank',
    });

    await login(page, otherGuest);

    const response = await page.request.post('/api/payment/cancel', {
      data: {
        bookingId,
        reason: 'unauthorized cancel attempt',
      },
    });

    expect(response.status()).toBe(403);

    const { data: booking, error } = await getAdminClient()
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw error;
    expect(booking?.status).toBe('PENDING');
  });

  test('rejects direct host cancellation and keeps the booking unchanged', async ({ page }) => {
    const host = createTestUser('exp.cancel.host-owner');
    const guest = createTestUser('exp.cancel.host-guest');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);

    const experienceId = await createHostOwnedExperience(hostId, host);
    const bookingId = await createBookingForExperience({
      guestId,
      guest,
      experienceId,
      status: 'PENDING',
      paymentMethod: 'bank',
    });

    await login(page, host);

    const response = await page.request.post('/api/payment/cancel', {
      data: {
        bookingId,
        reason: 'host initiated cancel',
        isHostCancel: true,
      },
    });

    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.any(String),
    });

    const { data: booking, error } = await getAdminClient()
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw error;
    expect(booking?.status).toBe('PENDING');
  });

  test('allows admins to cancel another guest booking', async ({ page }) => {
    const host = createTestUser('exp.cancel.admin-host');
    const guest = createTestUser('exp.cancel.admin-guest');
    const admin = createTestUser('exp.cancel.admin');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const adminId = await createAuthUser(admin, createdAuthUserIds);
    await makeUserAdmin(adminId, admin.email);

    const experienceId = await createHostOwnedExperience(hostId, host);
    const bookingId = await createBookingForExperience({
      guestId,
      guest,
      experienceId,
      status: 'PENDING',
      paymentMethod: 'bank',
    });

    await login(page, admin);

    const response = await page.request.post('/api/payment/cancel', {
      data: {
        bookingId,
        reason: 'admin initiated cancel',
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });

    const { data: booking, error } = await getAdminClient()
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw error;
    expect(booking?.status).toBe('cancelled');
  });

  test('routes host-unavailable guest cancellation into admin review without cancelling immediately', async ({ page }) => {
    const host = createTestUser('exp.cancel.review-host');
    const guest = createTestUser('exp.cancel.review-guest');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);

    const experienceId = await createHostOwnedExperience(hostId, host);
    const bookingId = await createBookingForExperience({
      guestId,
      guest,
      experienceId,
      status: 'confirmed',
      paymentMethod: 'bank',
    });

    await login(page, guest);

    const response = await page.request.post('/api/payment/cancel', {
      data: {
        bookingId,
        reasonCode: 'host_unavailable',
        reason: '호스트가 진행 불가하다고 안내함',
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      reviewPending: true,
    });

    const { data: booking, error } = await getAdminClient()
      .from('bookings')
      .select('status, cancel_reason, refund_amount')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw error;
    expect(booking?.status).toBe('confirmed');
    expect(booking?.cancel_reason).toContain('[HOST_UNAVAILABLE_REVIEW_PENDING]');
    expect([null, 0]).toContain(booking?.refund_amount ?? null);
  });

  test('allows admins to approve a host-unavailable review with full cancel flow', async ({ page }) => {
    const host = createTestUser('exp.cancel.review-approve-host');
    const guest = createTestUser('exp.cancel.review-approve-guest');
    const admin = createTestUser('exp.cancel.review-approve-admin');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const adminId = await createAuthUser(admin, createdAuthUserIds);
    await makeUserAdmin(adminId, admin.email);

    const experienceId = await createHostOwnedExperience(hostId, host);
    const bookingId = await createBookingForExperience({
      guestId,
      guest,
      experienceId,
      status: 'confirmed',
      paymentMethod: 'bank',
      amount: 30000,
    });

    await login(page, guest);
    const reviewResponse = await page.request.post('/api/payment/cancel', {
      data: {
        bookingId,
        reasonCode: 'host_unavailable',
        reason: '호스트 진행 불가',
      },
    });
    expect(reviewResponse.status()).toBe(200);

    await login(page, admin);
    const response = await page.request.post('/api/admin/bookings/force-cancel', {
      data: {
        bookingId,
        source: 'host_fault_request',
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });

    const { data: booking, error } = await getAdminClient()
      .from('bookings')
      .select('status, cancel_reason, refund_amount')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw error;
    expect(booking?.status).toBe('cancelled');
    expect(booking?.cancel_reason).toContain('호스트 진행 불가 확인 취소');
    expect(booking?.refund_amount).toBeGreaterThan(0);
  });

  test('allows admins to reject a host-unavailable review request and keep the booking', async ({ page }) => {
    const host = createTestUser('exp.cancel.review-reject-host');
    const guest = createTestUser('exp.cancel.review-reject-guest');
    const admin = createTestUser('exp.cancel.review-reject-admin');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const adminId = await createAuthUser(admin, createdAuthUserIds);
    await makeUserAdmin(adminId, admin.email);

    const experienceId = await createHostOwnedExperience(hostId, host);
    const bookingId = await createBookingForExperience({
      guestId,
      guest,
      experienceId,
      status: 'confirmed',
      paymentMethod: 'bank',
    });

    await login(page, guest);
    const reviewResponse = await page.request.post('/api/payment/cancel', {
      data: {
        bookingId,
        reasonCode: 'host_unavailable',
        reason: '호스트 진행 불가',
      },
    });
    expect(reviewResponse.status()).toBe(200);

    await login(page, admin);
    const response = await page.request.post('/api/admin/bookings/reject-host-unavailable', {
      data: {
        bookingId,
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });

    const { data: booking, error } = await getAdminClient()
      .from('bookings')
      .select('status, cancel_reason')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw error;
    expect(booking?.status).toBe('confirmed');
    expect(booking?.cancel_reason).toBeNull();
  });

  test('keeps a paid card booking unchanged when PG cancellation cannot start', async ({ page }) => {
    const host = createTestUser('exp.cancel.paid-host');
    const guest = createTestUser('exp.cancel.paid-guest');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);

    const experienceId = await createHostOwnedExperience(hostId, host);
    const bookingId = await createBookingForExperience({
      guestId,
      guest,
      experienceId,
      status: 'PAID',
      paymentMethod: 'card',
      amount: 49000,
    });
    await promoteBookingToPaidCardWithTid(bookingId);

    await login(page, guest);

    const response = await page.request.post('/api/payment/cancel', {
      data: {
        bookingId,
        reason: 'playwright pg failure contract',
      },
    });

    expect(response.status()).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.any(String),
    });

    const { data: booking, error } = await getAdminClient()
      .from('bookings')
      .select('status, refund_amount')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw error;

    expect(booking?.status).toBe('PAID');
    expect([null, 0]).toContain(booking?.refund_amount ?? null);
  });

  test('rejects re-cancelling an already cancelled booking', async ({ page }) => {
    const host = createTestUser('exp.cancel.terminal-host');
    const guest = createTestUser('exp.cancel.terminal-guest');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);

    const experienceId = await createHostOwnedExperience(hostId, host);
    const bookingId = await createBookingForExperience({
      guestId,
      guest,
      experienceId,
      status: 'cancelled',
      paymentMethod: 'bank',
    });

    await login(page, guest);

    const response = await page.request.post('/api/payment/cancel', {
      data: {
        bookingId,
        reason: 'terminal state retry',
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: '이미 취소됨',
    });
  });
});
