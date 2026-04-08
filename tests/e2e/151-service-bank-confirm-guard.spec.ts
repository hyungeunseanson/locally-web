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
const createdServiceRequestIds: string[] = [];
const createdServiceBookingIds: string[] = [];
const createdAuditTargetIds: string[] = [];

async function createPendingServiceFixture(params: {
  customerId: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: 'bank' | 'card';
}) {
  const supabase = getTestAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 9);
  const title = `[Playwright] Service Bank Confirm Guard ${timestamp}`;

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title,
      description: '서비스 무통장 입금 확인 guard 검증용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(serviceDate),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: params.customerName,
      contact_phone: params.customerPhone,
      status: 'pending_payment',
    })
    .select('id, total_customer_price, total_host_payout, title')
    .single();

  if (requestError || !requestRow?.id) {
    throw requestError || new Error('Failed to create service request fixture.');
  }

  createdServiceRequestIds.push(requestRow.id);

  const orderId = `SVC-BANK-CONFIRM-${timestamp}-${Math.random().toString(16).slice(2, 8)}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: orderId,
    order_id: orderId,
    request_id: requestRow.id,
    application_id: null,
    customer_id: params.customerId,
    host_id: null,
    amount: Number(requestRow.total_customer_price || 0),
    host_payout_amount: Number(requestRow.total_host_payout || 0),
    platform_revenue:
      Number(requestRow.total_customer_price || 0) - Number(requestRow.total_host_payout || 0),
    status: 'PENDING',
    payment_method: params.paymentMethod,
    payout_status: 'pending',
    contact_name: params.customerName,
    contact_phone: params.customerPhone,
  });

  if (bookingError) throw bookingError;

  createdServiceBookingIds.push(orderId);
  createdAuditTargetIds.push(orderId);

  return {
    orderId,
    requestId: requestRow.id,
    title: requestRow.title || title,
  };
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

  if (createdAuditTargetIds.length > 0) {
    await supabase.from('admin_audit_logs').delete().in('target_id', createdAuditTargetIds);
  }

  if (createdServiceBookingIds.length > 0) {
    await supabase.from('service_bookings').delete().in('id', createdServiceBookingIds);
  }

  if (createdServiceRequestIds.length > 0) {
    await supabase.from('service_requests').delete().in('id', createdServiceRequestIds);
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

test.describe.serial('Service bank confirm guard contract', () => {
  test('rejects non-admin users before mutating service payment state', async ({ page }) => {
    const customerUser = createTestUser('service.bank.guard.customer');
    const customerId = await createAuthUser(customerUser);
    createdAuthUserIds.push(customerId);

    const fixture = await createPendingServiceFixture({
      customerId,
      customerName: customerUser.fullName,
      customerPhone: customerUser.phone,
      paymentMethod: 'bank',
    });

    await login(page, customerUser);

    const response = await postJson(page, '/api/admin/service-confirm-payment', {
      orderId: fixture.orderId,
    });

    expect(response.status).toBe(403);
    expect(response.body.success).toBeFalsy();

    const supabase = getTestAdminClient();
    const { data: bookingRow, error: bookingError } = await supabase
      .from('service_bookings')
      .select('status')
      .eq('id', fixture.orderId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    const { data: requestRow, error: requestError } = await supabase
      .from('service_requests')
      .select('status')
      .eq('id', fixture.requestId)
      .maybeSingle();

    if (requestError) throw requestError;

    expect(bookingRow?.status).toBe('PENDING');
    expect(requestRow?.status).toBe('pending_payment');
  });

  test('rejects non-bank bookings without mutating request open state', async ({ page }) => {
    const adminUser = createTestUser('service.bank.guard.admin');
    const customerUser = createTestUser('service.bank.guard.customer.card');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const customerId = await createAuthUser(customerUser);
    createdAuthUserIds.push(adminId, customerId);
    createdWhitelistEmails.push(adminUser.email);

    const fixture = await createPendingServiceFixture({
      customerId,
      customerName: customerUser.fullName,
      customerPhone: customerUser.phone,
      paymentMethod: 'card',
    });

    await login(page, adminUser);

    const response = await postJson(page, '/api/admin/service-confirm-payment', {
      orderId: fixture.orderId,
    });

    expect(response.status).toBe(409);
    expect(response.body.success).toBeFalsy();
    expect(response.body.error).toMatch(/무통장 입금 예약이 아닙니다/);

    const supabase = getTestAdminClient();
    const { data: bookingRow, error: bookingError } = await supabase
      .from('service_bookings')
      .select('status, payment_method')
      .eq('id', fixture.orderId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    const { data: requestRow, error: requestError } = await supabase
      .from('service_requests')
      .select('status')
      .eq('id', fixture.requestId)
      .maybeSingle();

    if (requestError) throw requestError;

    expect(bookingRow).toMatchObject({
      status: 'PENDING',
      payment_method: 'card',
    });
    expect(requestRow?.status).toBe('pending_payment');
  });

  test('handles concurrent admin confirms idempotently and opens the request once', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('service.bank.guard.admin.concurrent');
    const customerUser = createTestUser('service.bank.guard.customer.concurrent');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const customerId = await createAuthUser(customerUser);
    createdAuthUserIds.push(adminId, customerId);
    createdWhitelistEmails.push(adminUser.email);

    const fixture = await createPendingServiceFixture({
      customerId,
      customerName: customerUser.fullName,
      customerPhone: customerUser.phone,
      paymentMethod: 'bank',
    });

    await login(page, adminUser);

    const [firstResponse, secondResponse] = await Promise.all([
      postJson(page, '/api/admin/service-confirm-payment', {
        orderId: fixture.orderId,
      }),
      postJson(page, '/api/admin/service-confirm-payment', {
        orderId: fixture.orderId,
      }),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstResponse.body.success).toBeTruthy();
    expect(secondResponse.body.success).toBeTruthy();
    expect(
      [firstResponse.body.message, secondResponse.body.message].some((message) =>
        /입금 확인 완료\. 의뢰가 공개되었습니다\.|Already processed/.test(String(message || ''))
      )
    ).toBeTruthy();

    const supabase = getTestAdminClient();
    const { data: bookingRow, error: bookingError } = await supabase
      .from('service_bookings')
      .select('status, payment_method')
      .eq('id', fixture.orderId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    const { data: requestRow, error: requestError } = await supabase
      .from('service_requests')
      .select('status')
      .eq('id', fixture.requestId)
      .maybeSingle();

    if (requestError) throw requestError;

    expect(bookingRow).toMatchObject({
      status: 'PAID',
      payment_method: 'bank',
    });
    expect(requestRow?.status).toBe('open');

    const { data: paymentNotifications, error: notificationError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', customerId)
      .eq('type', 'service_payment_confirmed')
      .eq('link', `/services/${fixture.requestId}`);

    if (notificationError) throw notificationError;

    expect(paymentNotifications || []).toHaveLength(1);

    const { data: auditLogs, error: auditError } = await supabase
      .from('admin_audit_logs')
      .select('id')
      .eq('action_type', 'ADMIN_SERVICE_CONFIRM_BANK')
      .eq('target_id', fixture.orderId);

    if (auditError) throw auditError;

    expect(auditLogs || []).toHaveLength(1);
  });
});
