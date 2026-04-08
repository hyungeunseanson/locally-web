import { expect, test, type Page } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  formatDate,
  getTestAdminClient,
  login,
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
      title: `[Playwright] Bank Confirm Parity ${Date.now()}`,
      category: '도보 투어',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 6,
      description: '무통장 정산 스냅샷 parity 검증용 체험입니다.',
      itinerary: [{ title: '서울역', description: '무통장 parity 검증 코스입니다.' }],
      spots: '서울역',
      meeting_point: '서울역 1번 출구',
      location: '서울 중구 한강대로 405',
      photos: ['https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200'],
      price: 50000,
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
    throw error || new Error('Failed to create bank parity experience.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function createPendingBankBooking(params: {
  bookingId: string;
  userId: string;
  experienceId: number;
  contactName: string;
  contactPhone: string;
}) {
  const supabase = getTestAdminClient();
  const date = new Date();
  date.setDate(date.getDate() + 14);

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
    date: formatDate(date),
    time: '10:00',
    type: 'group',
    contact_name: params.contactName,
    contact_phone: params.contactPhone,
    message: '',
    created_at: new Date().toISOString(),
    payment_method: 'bank',
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

test.describe.serial('Experience bank confirm snapshot parity', () => {
  test('keeps legacy bank confirm settlement snapshot aligned with admin confirm path', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('bank.parity.admin');
    const hostUser = createTestUser('bank.parity.host');
    const guestUser = createTestUser('bank.parity.guest');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const hostId = await createAuthUser(hostUser);
    const guestId = await createAuthUser(guestUser);
    createdAuthUserIds.push(adminId, hostId, guestId);
    createdWhitelistEmails.push(adminUser.email);

    const experienceId = await createExperienceFixture(hostId);
    const adminBookingId = `BANK-PARITY-ADMIN-${Date.now()}`;
    const legacyBookingId = `BANK-PARITY-LEGACY-${Date.now()}`;

    await createPendingBankBooking({
      bookingId: adminBookingId,
      userId: guestId,
      experienceId,
      contactName: guestUser.fullName,
      contactPhone: guestUser.phone,
    });
    await createPendingBankBooking({
      bookingId: legacyBookingId,
      userId: guestId,
      experienceId,
      contactName: guestUser.fullName,
      contactPhone: guestUser.phone,
    });

    await login(page, adminUser);

    const adminResponse = await postJson(page, '/api/admin/bookings/confirm-payment', {
      bookingId: adminBookingId,
    });
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.success).toBeTruthy();

    const legacyResponse = await postJson(page, '/api/bookings/confirm-payment', {
      bookingId: legacyBookingId,
    });
    expect(legacyResponse.status).toBe(200);
    expect(legacyResponse.body.success).toBeTruthy();

    const supabase = getTestAdminClient();
    const { data: bookingRows, error: bookingError } = await supabase
      .from('bookings')
      .select(
        'id, status, price_at_booking, total_experience_price, host_payout_amount, platform_revenue, payout_status'
      )
      .in('id', [adminBookingId, legacyBookingId]);

    if (bookingError) throw bookingError;

    const adminBooking = bookingRows?.find((row) => row.id === adminBookingId);
    const legacyBooking = bookingRows?.find((row) => row.id === legacyBookingId);

    expect(adminBooking).toBeTruthy();
    expect(legacyBooking).toBeTruthy();

    expect(adminBooking?.status).toBe('confirmed');
    expect(legacyBooking?.status).toBe('confirmed');
    expect(adminBooking?.payout_status).toBe('pending');
    expect(legacyBooking?.payout_status).toBe('pending');
    expect(adminBooking?.host_payout_amount).toBe(80000);
    expect(adminBooking?.platform_revenue).toBe(20000);
    expect(adminBooking?.price_at_booking).toBe(legacyBooking?.price_at_booking);
    expect(adminBooking?.total_experience_price).toBe(100000);
    expect(adminBooking?.total_experience_price).toBe(legacyBooking?.total_experience_price);
    expect(adminBooking?.host_payout_amount).toBe(legacyBooking?.host_payout_amount);
    expect(adminBooking?.platform_revenue).toBe(legacyBooking?.platform_revenue);
  });
});
