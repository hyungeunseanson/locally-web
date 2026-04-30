import { expect, test, type Page } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  formatDate,
  getTestAdminClient,
  login,
  type E2ETestUser,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];

async function createExperienceFixture(hostId: string) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Bank Confirm Guard ${Date.now()}`,
      category: '도보 투어',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 6,
      description: '체험 무통장 입금 확인 가드 검증용 체험입니다.',
      itinerary: [{ title: '서울역', description: '무통장 검증 코스입니다.' }],
      spots: '서울역',
      meeting_point: '서울역 1번 출구',
      location: '서울 중구 한강대로 405',
      photos: ['https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200'],
      price: 100000,
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
    throw error || new Error('Failed to create bank confirm guard experience.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function createBookingFixture(params: {
  bookingId: string;
  userId: string;
  guest: E2ETestUser;
  experienceId: number;
  paymentMethod: 'bank' | 'card';
}) {
  const supabase = getTestAdminClient();
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 7);

  const { error } = await supabase.from('bookings').insert({
    id: params.bookingId,
    order_id: params.bookingId,
    user_id: params.userId,
    experience_id: params.experienceId,
    amount: 100000,
    total_price: 100000,
    total_experience_price: 100000,
    status: 'PENDING',
    guests: 2,
    date: formatDate(bookingDate),
    time: '10:00',
    type: 'group',
    contact_name: params.guest.fullName,
    contact_phone: params.guest.phone,
    message: '',
    created_at: new Date().toISOString(),
    payment_method: params.paymentMethod,
    host_payout_amount: null,
    platform_revenue: null,
    payout_status: null,
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(params.bookingId);
}

async function postJson(page: Page, url: string, body: Record<string, unknown>) {
  return page.evaluate(
    async ({ path, payload }) => {
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    },
    { path: url, payload: body }
  );
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdAuthUserIds.length > 0) {
    await supabase.from('notifications').delete().in('user_id', createdAuthUserIds);
  }

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Experience bank confirm guards', () => {
  test('blocks non-admin users from both bank confirm routes', async ({ page }) => {
    test.setTimeout(120000);

    const intruderUser = createTestUser('bank.confirm.intruder');
    const hostUser = createTestUser('bank.confirm.guard.host');
    const guestUser = createTestUser('bank.confirm.guard.guest');

    const intruderId = await createAuthUser(intruderUser);
    const hostId = await createAuthUser(hostUser);
    const guestId = await createAuthUser(guestUser);
    createdAuthUserIds.push(intruderId, hostId, guestId);

    const experienceId = await createExperienceFixture(hostId);
    const bookingId = `BANK-CONFIRM-FORBIDDEN-${Date.now()}`;
    await createBookingFixture({
      bookingId,
      userId: guestId,
      guest: guestUser,
      experienceId,
      paymentMethod: 'bank',
    });

    await login(page, intruderUser);

    const adminResponse = await postJson(page, '/api/admin/bookings/confirm-payment', { bookingId });
    expect(adminResponse.status).toBe(403);
    expect(adminResponse.body.error).toMatch(/Forbidden/);

    const legacyResponse = await postJson(page, '/api/bookings/confirm-payment', { bookingId });
    expect(legacyResponse.status).toBe(403);
    expect(legacyResponse.body.error).toMatch(/Forbidden/);
  });

  test('rejects non-bank bookings without mutating settlement data on both routes', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('bank.confirm.admin');
    const hostUser = createTestUser('bank.confirm.card.host');
    const guestUser = createTestUser('bank.confirm.card.guest');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const hostId = await createAuthUser(hostUser);
    const guestId = await createAuthUser(guestUser);
    createdAuthUserIds.push(adminId, hostId, guestId);
    createdWhitelistEmails.push(adminUser.email);

    const experienceId = await createExperienceFixture(hostId);
    const bookingId = `BANK-CONFIRM-CARD-${Date.now()}`;
    await createBookingFixture({
      bookingId,
      userId: guestId,
      guest: guestUser,
      experienceId,
      paymentMethod: 'card',
    });

    await login(page, adminUser);

    const adminResponse = await postJson(page, '/api/admin/bookings/confirm-payment', { bookingId });
    expect(adminResponse.status).toBe(409);
    expect(adminResponse.body.error).toMatch(/무통장 예약만 입금 확인할 수 있습니다/);

    const legacyResponse = await postJson(page, '/api/bookings/confirm-payment', { bookingId });
    expect(legacyResponse.status).toBe(409);
    expect(legacyResponse.body.error).toMatch(/무통장 예약만 입금 확인할 수 있습니다/);

    const { data: bookingRow, error: bookingError } = await getTestAdminClient()
      .from('bookings')
      .select('status, host_payout_amount, platform_revenue, payout_status')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(bookingRow).toMatchObject({
      status: 'PENDING',
      host_payout_amount: null,
      platform_revenue: null,
      payout_status: null,
    });
  });

  test('handles concurrent admin bank confirms idempotently and writes the settlement snapshot once', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('bank.confirm.race.admin');
    const hostUser = createTestUser('bank.confirm.race.host');
    const guestUser = createTestUser('bank.confirm.race.guest');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const hostId = await createAuthUser(hostUser);
    const guestId = await createAuthUser(guestUser);
    createdAuthUserIds.push(adminId, hostId, guestId);
    createdWhitelistEmails.push(adminUser.email);

    const experienceId = await createExperienceFixture(hostId);
    const bookingId = `BANK-CONFIRM-RACE-${Date.now()}`;
    await createBookingFixture({
      bookingId,
      userId: guestId,
      guest: guestUser,
      experienceId,
      paymentMethod: 'bank',
    });

    await login(page, adminUser);

    const responses = await page.evaluate(async (id) => {
      const requestBody = JSON.stringify({ bookingId: id });
      const headers = { 'content-type': 'application/json' };

      const execute = async () => {
        const response = await fetch('/api/admin/bookings/confirm-payment', {
          method: 'POST',
          headers,
          body: requestBody,
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      };

      return Promise.all([execute(), execute()]);
    }, bookingId);

    expect(responses).toHaveLength(2);
    expect(responses[0].status).toBe(200);
    expect(responses[1].status).toBe(200);
    expect(responses.every((response) => response.body.success)).toBeTruthy();
    expect(responses.some((response) => response.body.message === 'Already processed')).toBeTruthy();

    const { data: bookingRow, error: bookingError } = await getTestAdminClient()
      .from('bookings')
      .select('status, price_at_booking, total_experience_price, host_payout_amount, platform_revenue, payout_status')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(bookingRow).toMatchObject({
      status: 'confirmed',
      total_experience_price: 100000,
      host_payout_amount: 80000,
      platform_revenue: 20000,
      payout_status: 'pending',
    });

    const { data: hostNotificationRows, error: hostNotificationError } = await getTestAdminClient()
      .from('notifications')
      .select('title, message, link')
      .eq('user_id', hostId)
      .eq('type', 'booking_confirmed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (hostNotificationError) throw hostNotificationError;
    expect(hostNotificationRows?.[0]?.title).toContain('바로 메시지');
    expect(hostNotificationRows?.[0]?.message).toContain('준비 안내');
    expect(hostNotificationRows?.[0]?.link).toContain('/host/dashboard?tab=inquiries');
    expect(hostNotificationRows?.[0]?.link).toContain(`guestId=${encodeURIComponent(guestId)}`);
    expect(hostNotificationRows?.[0]?.link).toContain(`expId=${experienceId}`);
  });
});
