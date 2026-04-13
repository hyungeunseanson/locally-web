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
const createdHostApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];

async function createApprovedHostApplication(userId: string, host: E2ETestUser) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: host.fullName,
      phone: host.phone,
      dob: '1991-01-01',
      email: host.email,
      instagram: '@codex_host_payout_summary',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '호스트 정산 요약 반영 검증용 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: host.fullName,
      motivation: '호스트 정산 반영 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdHostApplicationIds.push(data.id);
}

async function createExperienceFixture(hostId: string) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Host Payout Summary ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '호스트 정산 요약 반영 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '정산 반영 검증 코스입니다.' }],
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
    throw error || new Error('Failed to create payout summary experience.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function seedCompletedBooking(params: {
  hostId: string;
  host: E2ETestUser;
  experienceId: number;
  payoutStatus: 'pending' | 'paid';
  payoutAmount: number;
  createdAt: Date;
  payoutPaidAt?: string | null;
}) {
  const supabase = getTestAdminClient();
  const bookingId = `HOST-PAYOUT-SUMMARY-${params.payoutStatus.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const payload: Record<string, unknown> = {
    id: bookingId,
    order_id: bookingId,
    user_id: params.hostId,
    experience_id: params.experienceId,
    amount: Math.round(params.payoutAmount / 0.8),
    total_price: Math.round(params.payoutAmount / 0.8),
    total_experience_price: Math.round(params.payoutAmount / 0.8),
    status: 'completed',
    guests: 1,
    date: formatDate(params.createdAt),
    time: '10:00',
    type: 'group',
    contact_name: params.host.fullName,
    contact_phone: params.host.phone,
    message: '',
    created_at: params.createdAt.toISOString(),
    payment_method: 'card',
    host_payout_amount: params.payoutAmount,
    platform_revenue: Math.round(params.payoutAmount * 0.25),
    payout_status: params.payoutStatus,
    payout_paid_at: params.payoutPaidAt ?? null,
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  };

  const { error } = await supabase.from('bookings').insert(payload);
  if (error) throw error;
  createdBookingIds.push(bookingId);
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

  for (const applicationId of createdHostApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Host payout summary reflection', () => {
  test('shows pending and paid payout buckets without changing total hosting income', async ({ page }) => {
    test.setTimeout(120000);

    const hostUser = createTestUser('host.payout.summary');
    const hostId = await createAuthUser(hostUser);
    createdAuthUserIds.push(hostId);
    await createApprovedHostApplication(hostId, hostUser);
    const experienceId = await createExperienceFixture(hostId);

    const pendingDate = new Date();
    pendingDate.setDate(pendingDate.getDate() - 3);
    const paidDate = new Date();
    paidDate.setDate(paidDate.getDate() - 7);

    await seedCompletedBooking({
      hostId,
      host: hostUser,
      experienceId,
      payoutStatus: 'pending',
      payoutAmount: 24000,
      createdAt: pendingDate,
      payoutPaidAt: null,
    });
    await seedCompletedBooking({
      hostId,
      host: hostUser,
      experienceId,
      payoutStatus: 'paid',
      payoutAmount: 36000,
      createdAt: paidDate,
      payoutPaidAt: paidDate.toISOString(),
    });

    await login(page, hostUser);
    await page.goto('/host/dashboard?tab=earnings', { waitUntil: 'networkidle' });

    await expect(page.getByText(/완료 동기화.*정산|completion sync/i).first()).toBeVisible();
    await expect(page.getByText(/지급 대상으로 잡힌 금액만|eligible for payout/i).first()).toBeVisible();
    await expect(page.getByTestId('host-earnings-unified-total')).toContainText('₩24,000');
    await expect(page.getByTestId('host-earnings-breakdown-experience-pending')).toContainText('₩24,000');
    await expect(page.getByTestId('host-earnings-breakdown-service-pending')).toContainText('₩0');
    await expect(page.getByTestId('host-earnings-unified-last-paid')).not.toContainText(
      /아직 지급 완료 내역이 없어요|No completed payout yet|まだ支払い完了履歴がありません|暂时还没有已完成结算/
    );
    await page.getByTestId('host-earnings-experience-toggle').click();

    await expect(page.getByTestId('host-earnings-summary-pending-payout')).toContainText('₩24,000');
    await expect(page.getByTestId('host-earnings-summary-in-progress')).toContainText('₩0');
    await expect(page.getByTestId('host-earnings-summary-paid-payout')).toContainText('₩36,000');
    await expect(page.getByTestId('host-earnings-summary-last-paid')).not.toContainText(
      /아직 지급 완료 내역이 없어요|No completed payout yet|まだ支払い完了履歴がありません|暂时还没有已完成结算/
    );
    await expect(page.getByTestId('host-earnings-summary-net-payout')).toContainText('₩60,000');
  });
});
