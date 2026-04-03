import { expect, test } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  formatDate,
  getTestAdminClient,
  loadTestEnv,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdServiceRequestIds: string[] = [];
const createdServiceApplicationIds: string[] = [];
const createdServiceBookingIds: string[] = [];

async function createPastServiceFixture() {
  const supabase = getTestAdminClient();
  const timestamp = Date.now();
  const customer = createTestUser('service.completion.customer');
  const host = createTestUser('service.completion.host');
  const customerId = await createAuthUser(customer);
  const hostId = await createAuthUser(host);

  createdAuthUserIds.push(customerId, hostId);

  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 4);

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Completion ${timestamp}`,
      description: '서비스 완료 크론 검증용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(pastDate),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      status: 'paid',
      selected_host_id: hostId,
    })
    .select('id')
    .single();

  if (requestError || !requestRow?.id) {
    throw requestError || new Error('Failed to create service request fixture.');
  }
  createdServiceRequestIds.push(requestRow.id);

  const { data: applicationRow, error: applicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: requestRow.id,
      host_id: hostId,
      appeal_message: '서비스 완료 크론 검증용 지원입니다.',
      status: 'selected',
    })
    .select('id')
    .single();

  if (applicationError || !applicationRow?.id) {
    throw applicationError || new Error('Failed to create service application fixture.');
  }
  createdServiceApplicationIds.push(applicationRow.id);

  const bookingId = `SVC-COMPLETE-CRON-${timestamp}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: bookingId,
    request_id: requestRow.id,
    application_id: applicationRow.id,
    customer_id: customerId,
    host_id: hostId,
    amount: 150000,
    host_payout_amount: 90000,
    platform_revenue: 60000,
    status: 'PAID',
    payout_status: 'pending',
    payment_method: 'card',
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);

  return { requestId: requestRow.id, bookingId };
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  for (const bookingId of createdServiceBookingIds) {
    await supabase.from('service_bookings').delete().eq('id', bookingId);
  }

  for (const applicationId of createdServiceApplicationIds) {
    await supabase.from('service_applications').delete().eq('id', applicationId);
  }

  for (const requestId of createdServiceRequestIds) {
    await supabase.from('service_requests').delete().eq('id', requestId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Service completion cron', () => {
  test('marks past paid service bookings as completed before payout eligibility', async ({ request }) => {
    test.setTimeout(120000);

    const fixture = await createPastServiceFixture();
    const env = loadTestEnv();
    const cronSecret = env.CRON_SECRET || 'codex-cron-secret';

    const response = await request.get('/api/cron/complete-services', {
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as {
      success: boolean;
      bookingIds?: string[];
      requestIds?: string[];
    };

    expect(payload.success).toBeTruthy();
    expect(payload.bookingIds || []).toContain(fixture.bookingId);
    expect(payload.requestIds || []).toContain(fixture.requestId);

    const supabase = getTestAdminClient();
    const [{ data: bookingRow, error: bookingError }, { data: requestRow, error: requestError }] = await Promise.all([
      supabase.from('service_bookings').select('status').eq('id', fixture.bookingId).maybeSingle(),
      supabase.from('service_requests').select('status').eq('id', fixture.requestId).maybeSingle(),
    ]);

    if (bookingError) throw bookingError;
    if (requestError) throw requestError;

    expect(bookingRow?.status).toBe('completed');
    expect(requestRow?.status).toBe('completed');
  });
});
