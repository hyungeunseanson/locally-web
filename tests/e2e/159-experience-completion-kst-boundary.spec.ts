import { expect, test, type Page } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  getTestAdminClient,
  login,
  type E2ETestUser,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdHostApplicationIds: number[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];

function formatKstDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function formatKstTime(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
}

async function createApprovedHostApplication(userId: string, user: E2ETestUser) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1990-01-01',
      email: user.email,
      instagram: '@codex_kst_boundary',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: 'KST 경계 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: 'KST 경계 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdHostApplicationIds.push(Number(data.id));
}

async function createExperienceFixture(hostId: string) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Experience KST Boundary ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: 'KST 경계 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: 'KST 경계 검증 코스입니다.' }],
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
    throw error || new Error('Failed to create experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function seedExperienceBooking(params: {
  customerId: string;
  customer: E2ETestUser;
  experienceId: number;
  when: Date;
}) {
  const supabase = getTestAdminClient();
  const bookingId = `SETTLEMENT-KST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.customerId,
    experience_id: params.experienceId,
    amount: 120000,
    total_price: 120000,
    total_experience_price: 120000,
    status: 'confirmed',
    guests: 1,
    date: formatKstDate(params.when),
    time: formatKstTime(params.when),
    type: 'group',
    contact_name: params.customer.fullName,
    contact_phone: params.customer.phone,
    message: '',
    created_at: new Date().toISOString(),
    payment_method: 'card',
    host_payout_amount: 90000,
    platform_revenue: 30000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
}

async function postAdminSync(page: Page, body: Record<string, unknown>) {
  return page.evaluate(async (payload) => {
    const response = await fetch('/api/admin/settlement-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }, body);
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const applicationId of createdHostApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Experience completion KST boundary', () => {
  test('treats due state using DB KST calculation, not server local time', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('settlement.kst.admin');
    const hostUser = createTestUser('settlement.kst.host');
    const customerUser = createTestUser('settlement.kst.customer');
    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const hostId = await createAuthUser(hostUser);
    const customerId = await createAuthUser(customerUser);
    createdAuthUserIds.push(adminId, hostId, customerId);

    await createApprovedHostApplication(hostId, hostUser);
    const experienceId = await createExperienceFixture(hostId);

    const now = new Date();
    const dueAt = new Date(now.getTime() - 70 * 60 * 1000);
    const futureAt = new Date(now.getTime() + 70 * 60 * 1000);

    const dueBookingId = await seedExperienceBooking({
      customerId,
      customer: customerUser,
      experienceId,
      when: dueAt,
    });
    const futureBookingId = await seedExperienceBooking({
      customerId,
      customer: customerUser,
      experienceId,
      when: futureAt,
    });

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=SALES', { waitUntil: 'networkidle' });

    const futureResult = await postAdminSync(page, {
      mode: 'force_one',
      domain: 'experience',
      identifier: futureBookingId,
    });
    expect(futureResult.status).toBe(200);
    expect(futureResult.body.outcome).toBe('not_due');

    const dueResult = await postAdminSync(page, {
      mode: 'force_one',
      domain: 'experience',
      identifier: dueBookingId,
    });
    expect(dueResult.status).toBe(200);
    expect(dueResult.body.outcome).toBe('completed');

    const supabase = getTestAdminClient();
    const [futureRow, dueRow] = await Promise.all([
      supabase.from('bookings').select('status').eq('id', futureBookingId).maybeSingle(),
      supabase.from('bookings').select('status').eq('id', dueBookingId).maybeSingle(),
    ]);

    if (futureRow.error) throw futureRow.error;
    if (dueRow.error) throw dueRow.error;

    expect(futureRow.data?.status).toBe('confirmed');
    expect(dueRow.data?.status).toBe('completed');
  });
});
