import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { settleExperienceBookingPayouts } from '@/app/utils/adminPayouts';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};
type PayoutBookingOverrides = {
  status?: string;
  hostPayoutAmount?: number | null;
  platformRevenue?: number | null;
  amount?: number;
  totalPrice?: number;
};

const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];

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

function createUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.payout.guard.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Payout Guard ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
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

async function createAuthUser(user: TestUser) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      phone: user.phone,
    },
  });

  if (error || !data.user?.id) {
    throw error || new Error(`Failed to create auth user for ${user.email}`);
  }

  createdAuthUserIds.push(data.user.id);
  await waitForProfile(data.user.id);

  return data.user.id;
}

async function createExperienceFixture(hostId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Payout Guard ${Date.now()}`,
      category: '도보 투어',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 6,
      description: '정산 race guard 검증용 체험입니다.',
      itinerary: [{ title: '서울역', description: '정산 검증 코스입니다.' }],
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
    throw error || new Error('Failed to create payout guard experience.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function createPendingPayoutBooking(
  userId: string,
  experienceId: number,
  fullName: string,
  phone: string,
  overrides: PayoutBookingOverrides = {}
) {
  const supabase = getAdminClient();
  const bookingId = `PAYOUT-GUARD-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() - 2);
  const amount = overrides.amount ?? 55000;
  const totalPrice = overrides.totalPrice ?? 50000;
  const hasHostPayoutOverride = Object.prototype.hasOwnProperty.call(overrides, 'hostPayoutAmount');
  const hasPlatformRevenueOverride = Object.prototype.hasOwnProperty.call(overrides, 'platformRevenue');
  const hostPayoutAmount = hasHostPayoutOverride ? overrides.hostPayoutAmount : 40000;
  const platformRevenue = hasPlatformRevenueOverride
    ? overrides.platformRevenue
    : amount - Number(hostPayoutAmount ?? 0);

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: userId,
    experience_id: experienceId,
    amount,
    total_price: totalPrice,
    total_experience_price: totalPrice,
    status: overrides.status ?? 'completed',
    guests: 1,
    date: bookingDate.toISOString().slice(0, 10),
    time: '10:00',
    type: 'group',
    contact_name: fullName,
    contact_phone: phone,
    message: '',
    created_at: bookingDate.toISOString(),
    payment_method: 'card',
    host_payout_amount: hostPayoutAmount,
    platform_revenue: platformRevenue,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Admin host payout guard contract', () => {
  test('settles a completed experience payout once', async () => {
    const user = createUser();
    const userId = await createAuthUser(user);
    const experienceId = await createExperienceFixture(userId);
    const bookingId = await createPendingPayoutBooking(userId, experienceId, user.fullName, user.phone);
    const supabase = getAdminClient();

    const result = await settleExperienceBookingPayouts(supabase, [bookingId]);
    expect(result).toMatchObject({ success: true });

    const { data: bookingRow, error: bookingError } = await supabase
      .from('bookings')
      .select('payout_status, payout_paid_at')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(bookingRow?.payout_status).toBe('paid');
    expect(bookingRow?.payout_paid_at).toBeTruthy();
  });

  test('keeps cancelled bookings with retained host payout eligible', async () => {
    const user = createUser();
    const userId = await createAuthUser(user);
    const experienceId = await createExperienceFixture(userId);
    const bookingId = await createPendingPayoutBooking(
      userId,
      experienceId,
      user.fullName,
      user.phone,
      {
        status: 'cancelled',
        hostPayoutAmount: 12000,
        platformRevenue: 3000,
      }
    );
    const supabase = getAdminClient();

    const result = await settleExperienceBookingPayouts(supabase, [bookingId]);
    expect(result).toMatchObject({ success: true });

    const { data: bookingRow, error: bookingError } = await supabase
      .from('bookings')
      .select('payout_status, payout_paid_at')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(bookingRow?.payout_status).toBe('paid');
    expect(bookingRow?.payout_paid_at).toBeTruthy();
  });

  test('rejects active bookings before payout settlement', async () => {
    const user = createUser();
    const userId = await createAuthUser(user);
    const experienceId = await createExperienceFixture(userId);
    const bookingId = await createPendingPayoutBooking(
      userId,
      experienceId,
      user.fullName,
      user.phone,
      { status: 'PAID' }
    );
    const supabase = getAdminClient();

    const result = await settleExperienceBookingPayouts(supabase, [bookingId]);
    expect(result).toMatchObject({
      success: false,
      error: '정산 완료 처리할 수 없는 예약이 포함되어 있습니다.',
      invalidStatusIds: [bookingId],
    });

    const { data: bookingRow, error: bookingError } = await supabase
      .from('bookings')
      .select('payout_status, payout_paid_at')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(bookingRow?.payout_status).toBe('pending');
    expect(bookingRow?.payout_paid_at).toBeFalsy();
  });

  test('rejects zero amount experience payouts', async () => {
    const user = createUser();
    const userId = await createAuthUser(user);
    const experienceId = await createExperienceFixture(userId);
    const bookingId = await createPendingPayoutBooking(
      userId,
      experienceId,
      user.fullName,
      user.phone,
      {
        hostPayoutAmount: 0,
        platformRevenue: 55000,
      }
    );
    const supabase = getAdminClient();

    const result = await settleExperienceBookingPayouts(supabase, [bookingId]);
    expect(result).toMatchObject({
      success: false,
      error: '정산 완료 처리할 수 없는 예약이 포함되어 있습니다.',
      invalidStatusIds: [bookingId],
    });

    const { data: bookingRow, error: bookingError } = await supabase
      .from('bookings')
      .select('payout_status, payout_paid_at')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(bookingRow?.payout_status).toBe('pending');
    expect(bookingRow?.payout_paid_at).toBeFalsy();
  });

  test('rejects cancelled bookings without an explicit retained host payout snapshot', async () => {
    const user = createUser();
    const userId = await createAuthUser(user);
    const experienceId = await createExperienceFixture(userId);
    const bookingId = await createPendingPayoutBooking(
      userId,
      experienceId,
      user.fullName,
      user.phone,
      {
        status: 'cancelled',
        hostPayoutAmount: null,
        platformRevenue: null,
      }
    );
    const supabase = getAdminClient();

    const result = await settleExperienceBookingPayouts(supabase, [bookingId]);
    expect(result).toMatchObject({
      success: false,
      error: '정산 완료 처리할 수 없는 예약이 포함되어 있습니다.',
      invalidStatusIds: [bookingId],
    });

    const { data: bookingRow, error: bookingError } = await supabase
      .from('bookings')
      .select('payout_status, payout_paid_at')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(bookingRow?.payout_status).toBe('pending');
    expect(bookingRow?.payout_paid_at).toBeFalsy();
  });

  test('allows only one concurrent settlement update for the same booking', async () => {
    const user = createUser();
    const userId = await createAuthUser(user);
    const experienceId = await createExperienceFixture(userId);
    const bookingId = await createPendingPayoutBooking(userId, experienceId, user.fullName, user.phone);
    const supabase = getAdminClient();

    const [firstResult, secondResult] = await Promise.all([
      settleExperienceBookingPayouts(supabase, [bookingId]),
      settleExperienceBookingPayouts(supabase, [bookingId]),
    ]);

    expect([firstResult.success, secondResult.success].filter(Boolean)).toHaveLength(1);

    const failure = firstResult.success ? secondResult : firstResult;
    if (failure.success) {
      throw new Error('Expected one settlement call to fail, but both succeeded.');
    }

    expect(failure.error).toMatch(/이미 정산 완료된 예약이 포함되어 있습니다|다른 관리자에 의해 정산 상태가 변경되었습니다/);

    const { data: bookingRow, error: bookingError } = await supabase
      .from('bookings')
      .select('payout_status, payout_paid_at')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(bookingRow?.payout_status).toBe('paid');
    expect(bookingRow?.payout_paid_at).toBeTruthy();
  });
});
