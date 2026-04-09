import { expect, test } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  formatDate,
  getTestAdminClient,
  login,
  type E2ETestUser,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdHostApplicationIds: number[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
const createdJobRunIds: number[] = [];

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
      instagram: '@codex_settlement_job_name',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '정산 완료 job_name 기록 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '정산 완료 job_name 기록 검증',
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
      title: `[Playwright] Settlement Sync Job Name ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '정산 완료 job_name 기록 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: 'job_name 검증 코스입니다.' }],
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
  date: Date;
  status?: 'confirmed' | 'PAID';
}) {
  const supabase = getTestAdminClient();
  const bookingId = `SETTLEMENT-JOB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.customerId,
    experience_id: params.experienceId,
    amount: 120000,
    total_price: 120000,
    total_experience_price: 120000,
    status: params.status || 'confirmed',
    guests: 1,
    date: formatDate(params.date),
    time: '10:00',
    type: 'group',
    contact_name: params.customer.fullName,
    contact_phone: params.customer.phone,
    message: '',
    created_at: params.date.toISOString(),
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

async function latestFailedRun(jobName: string) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('admin_job_runs')
    .select('id, job_name, status, target_identifier')
    .eq('job_name', jobName)
    .eq('status', 'failed')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data?.id) {
    createdJobRunIds.push(Number(data.id));
  }
  return data;
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdJobRunIds.length > 0) {
    await supabase.from('admin_job_runs').delete().in('id', createdJobRunIds);
  }

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const hostApplicationId of createdHostApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', hostApplicationId);
  }

  for (const authUserId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(authUserId);
  }
});

test.describe.serial('Settlement sync experience job name recording', () => {
  test('records run_due and force_one failures under the correct job names', async ({ page }) => {
    const admin = createTestUser('codex.settlement.jobname.admin');
    const host = createTestUser('codex.settlement.jobname.host');
    const guest = createTestUser('codex.settlement.jobname.guest');

    const adminId = await createAuthUser(admin, { isAdmin: true });
    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    createdAuthUserIds.push(adminId, hostId, guestId);

    await createApprovedHostApplication(hostId, host);
    const experienceId = await createExperienceFixture(hostId);

    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const runDueBookingId = await seedExperienceBooking({
      customerId: guestId,
      customer: guest,
      experienceId,
      date: pastDate,
      status: 'confirmed',
    });

    const forceOneBookingId = await seedExperienceBooking({
      customerId: guestId,
      customer: guest,
      experienceId,
      date: pastDate,
      status: 'confirmed',
    });

    await login(page, admin);
    await page.goto('/admin/dashboard?tab=SALES', { waitUntil: 'networkidle' });

    const runDueResponse = await page.evaluate(async () => {
      const response = await fetch('/api/admin/settlement-sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-locally-test-fail-settlement-sync-phase': 'after_lock',
        },
        body: JSON.stringify({
          mode: 'run_due',
          domain: 'experience',
        }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    });

    expect(runDueResponse.status).toBe(500);
    const runDueRecord = await latestFailedRun('experience_completion_sync');
    expect(runDueRecord?.job_name).toBe('experience_completion_sync');
    expect(runDueRecord?.target_identifier).toBeNull();

    const forceOneResponse = await page.evaluate(
      async (bookingId) => {
        const response = await fetch('/api/admin/settlement-sync', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-locally-test-fail-settlement-sync-phase': 'after_lock',
          },
          body: JSON.stringify({
            mode: 'force_one',
            domain: 'experience',
            identifier: bookingId,
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      forceOneBookingId
    );

    expect(forceOneResponse.status).toBe(500);
    const forceOneRecord = await latestFailedRun('experience_completion_sync_force_one');
    expect(forceOneRecord?.job_name).toBe('experience_completion_sync_force_one');
    expect(forceOneRecord?.target_identifier).toBe(forceOneBookingId);

    const supabase = getTestAdminClient();
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, status')
      .in('id', [runDueBookingId, forceOneBookingId])
      .order('id', { ascending: true });

    if (error) throw error;

    expect(bookings).toEqual(
      expect.arrayContaining([
        { id: forceOneBookingId, status: 'confirmed' },
        { id: runDueBookingId, status: 'confirmed' },
      ])
    );
  });
});
