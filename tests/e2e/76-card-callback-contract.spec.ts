import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupBookings,
  createAuthUser,
  createTestUser,
  getLatestHostExperience,
  insertTestBooking,
  login,
} from './helpers/experienceBooking';

type EnvMap = Record<string, string>;

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdExperienceBookingIds: string[] = [];
const createdServiceRequestIds: string[] = [];
const createdServiceBookingIds: string[] = [];

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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function createPaidExperienceBooking(params: {
  experienceId: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
}) {
  const date = new Date();
  date.setDate(date.getDate() + 15);
  const bookingId = await insertTestBooking({
    userId: params.customerId,
    experienceId: params.experienceId,
    date: formatDate(date),
    time: '11:00',
    guests: 1,
    status: 'PAID',
    paymentMethod: 'card',
    amount: 47000,
    totalPrice: 47000,
    contactName: params.customerName,
    contactPhone: params.customerPhone,
  });

  createdExperienceBookingIds.push(bookingId);
  return bookingId;
}

async function createPendingServiceFixture(customerId: string, customerName: string, customerPhone: string) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 9);
  const createdAt = new Date().toISOString();

  const { data: requestData, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Callback ${timestamp}`,
      description: '서비스 callback contract 검증용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(serviceDate),
      start_time: '15:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: customerName,
      contact_phone: customerPhone,
      status: 'open',
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select('id, total_customer_price')
    .single();

  if (requestError || !requestData?.id) {
    throw requestError || new Error('Failed to create service request fixture.');
  }
  createdServiceRequestIds.push(requestData.id);

  const bookingId = `SVC-CALLBACK-CONTRACT-${timestamp}`;
  const orderId = `SVC-CALLBACK-CONTRACT-ORD-${timestamp}`;
  const { error: bookingError } = await supabase
    .from('service_bookings')
    .insert({
      id: bookingId,
      order_id: orderId,
      request_id: requestData.id,
      application_id: null,
      customer_id: customerId,
      host_id: null,
      amount: requestData.total_customer_price,
      host_payout_amount: 80000,
      platform_revenue: Number(requestData.total_customer_price || 0) - 80000,
      status: 'PAID',
      payment_method: 'card',
      tid: `existing-${timestamp}`,
      payout_status: 'pending',
      contact_name: customerName,
      contact_phone: customerPhone,
      created_at: createdAt,
      updated_at: createdAt,
    });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);

  return {
    bookingId,
    orderId,
    requestId: requestData.id,
  };
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const bookingId of createdServiceBookingIds) {
    await supabase.from('service_bookings').delete().eq('id', bookingId);
  }

  for (const requestId of createdServiceRequestIds) {
    await supabase.from('service_requests').delete().eq('id', requestId);
  }

  await cleanupBookings(createdExperienceBookingIds);
  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Card callback contract', () => {
  test('blocks experience callback confirmation from a different logged-in user', async ({ page }) => {
    const owner = createTestUser('exp.callback.owner');
    const other = createTestUser('exp.callback.other');
    const ownerId = await createAuthUser(owner, createdAuthUserIds);
    await createAuthUser(other, createdAuthUserIds);
    const { experienceId } = await getLatestHostExperience();

    const bookingId = await createPaidExperienceBooking({
      experienceId,
      customerId: ownerId,
      customerName: owner.fullName,
      customerPhone: owner.phone,
    });

    await login(page, other);

    const response = await page.request.post('/api/payment/nicepay-callback', {
      data: {
        imp_uid: 'imp_cross_user_test',
        merchant_uid: bookingId,
        orderId: bookingId,
      },
    });

    expect(response.status()).toBe(403);
  });

  test('treats already paid experience callbacks as idempotent', async ({ page }) => {
    const owner = createTestUser('exp.callback.idempotent');
    const ownerId = await createAuthUser(owner, createdAuthUserIds);
    const { experienceId } = await getLatestHostExperience();

    const bookingId = await createPaidExperienceBooking({
      experienceId,
      customerId: ownerId,
      customerName: owner.fullName,
      customerPhone: owner.phone,
    });

    await login(page, owner);

    const response = await page.request.post('/api/payment/nicepay-callback', {
      data: {
        imp_uid: 'imp_already_processed',
        merchant_uid: bookingId,
        orderId: bookingId,
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: 'Already processed',
    });
  });

  test('treats completed experience card notifications as idempotent OK', async ({ request }) => {
    const owner = createTestUser('exp.notification.completed');
    const ownerId = await createAuthUser(owner, createdAuthUserIds);
    const { experienceId } = await getLatestHostExperience();

    const bookingId = await createPaidExperienceBooking({
      experienceId,
      customerId: ownerId,
      customerName: owner.fullName,
      customerPhone: owner.phone,
    });

    const { error: completeError } = await getAdminClient()
      .from('bookings')
      .update({
        status: 'completed',
        tid: 'TX-TID-COMPLETED-NOTI',
      })
      .eq('id', bookingId);

    if (completeError) throw completeError;

    const response = await request.post('/api/payment/card-notification', {
      form: {
        Moid: bookingId,
        TID: 'TX-TID-COMPLETED-NOTI',
        Amt: '47000',
        ResultCode: '3001',
        StateCd: '0',
        PayMethod: 'CARD',
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.text()).resolves.toBe('OK');
  });

  test('treats cancelled experience card notifications for the stored TID as idempotent OK', async ({ request }) => {
    const owner = createTestUser('exp.notification.cancelled');
    const ownerId = await createAuthUser(owner, createdAuthUserIds);
    const { experienceId } = await getLatestHostExperience();

    const bookingId = await createPaidExperienceBooking({
      experienceId,
      customerId: ownerId,
      customerName: owner.fullName,
      customerPhone: owner.phone,
    });

    const { error: cancelError } = await getAdminClient()
      .from('bookings')
      .update({
        status: 'cancelled',
        tid: 'TX-TID-CANCELLED-NOTI',
        refund_amount: 47000,
        host_payout_amount: 0,
        platform_revenue: 0,
      })
      .eq('id', bookingId);

    if (cancelError) throw cancelError;

    const response = await request.post('/api/payment/card-notification', {
      form: {
        Moid: bookingId,
        TID: 'TX-TID-CANCELLED-NOTI',
        Amt: '47000',
        ResultCode: '3001',
        StateCd: '0',
        PayMethod: 'CARD',
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.text()).resolves.toBe('OK');

    const { data: booking, error } = await getAdminClient()
      .from('bookings')
      .select('status, tid, refund_amount, host_payout_amount, platform_revenue')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw error;
    expect(booking).toMatchObject({
      status: 'cancelled',
      tid: 'TX-TID-CANCELLED-NOTI',
      refund_amount: 47000,
      host_payout_amount: 0,
      platform_revenue: 0,
    });
  });

  test('keeps mismatched cancelled experience notifications non-idempotent', async ({ request }) => {
    const owner = createTestUser('exp.notification.cancelled.mismatch');
    const ownerId = await createAuthUser(owner, createdAuthUserIds);
    const { experienceId } = await getLatestHostExperience();

    const bookingId = await createPaidExperienceBooking({
      experienceId,
      customerId: ownerId,
      customerName: owner.fullName,
      customerPhone: owner.phone,
    });

    const { error: cancelError } = await getAdminClient()
      .from('bookings')
      .update({
        status: 'cancelled',
        tid: 'TX-TID-CANCELLED-STORED',
        refund_amount: 47000,
        host_payout_amount: 0,
        platform_revenue: 0,
      })
      .eq('id', bookingId);

    if (cancelError) throw cancelError;

    const response = await request.post('/api/payment/card-notification', {
      form: {
        Moid: bookingId,
        TID: 'TX-TID-CANCELLED-DIFFERENT',
        Amt: '47000',
        ResultCode: '3001',
        StateCd: '0',
        PayMethod: 'CARD',
      },
    });

    expect(response.status()).toBe(409);
  });

  test('blocks service callback confirmation from a different logged-in user', async ({ page }) => {
    const owner = createTestUser('svc.callback.owner');
    const other = createTestUser('svc.callback.other');
    const ownerId = await createAuthUser(owner, createdAuthUserIds);
    await createAuthUser(other, createdAuthUserIds);

    const fixture = await createPendingServiceFixture(ownerId, owner.fullName, owner.phone);

    await login(page, other);

    const response = await page.request.post('/api/services/payment/nicepay-callback', {
      data: {
        imp_uid: 'imp_cross_service_user',
        merchant_uid: fixture.orderId,
        orderId: fixture.orderId,
      },
    });

    expect(response.status()).toBe(403);
  });

  test('treats already paid service callbacks as idempotent', async ({ page }) => {
    const owner = createTestUser('svc.callback.idempotent');
    const ownerId = await createAuthUser(owner, createdAuthUserIds);

    const fixture = await createPendingServiceFixture(ownerId, owner.fullName, owner.phone);

    await login(page, owner);

    const response = await page.request.post('/api/services/payment/nicepay-callback', {
      data: {
        imp_uid: 'imp_service_already_processed',
        merchant_uid: fixture.orderId,
        orderId: fixture.orderId,
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: 'Already processed',
    });
  });

  test('treats cancelled service card notifications for the stored TID as idempotent OK', async ({ request }) => {
    const owner = createTestUser('svc.notification.cancelled');
    const ownerId = await createAuthUser(owner, createdAuthUserIds);
    const fixture = await createPendingServiceFixture(ownerId, owner.fullName, owner.phone);

    const { error: cancelError } = await getAdminClient()
      .from('service_bookings')
      .update({
        status: 'cancelled',
        tid: 'SVC-TID-CANCELLED-NOTI',
        refund_amount: 90000,
        host_payout_amount: 0,
        platform_revenue: 0,
      })
      .eq('id', fixture.bookingId);

    if (cancelError) throw cancelError;

    const response = await request.post('/api/payment/card-notification', {
      form: {
        Moid: fixture.orderId,
        TID: 'SVC-TID-CANCELLED-NOTI',
        Amt: '90000',
        ResultCode: '3001',
        StateCd: '0',
        PayMethod: 'CARD',
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.text()).resolves.toBe('OK');

    const { data: serviceBooking, error } = await getAdminClient()
      .from('service_bookings')
      .select('status, tid, refund_amount, host_payout_amount, platform_revenue')
      .eq('id', fixture.bookingId)
      .maybeSingle();

    if (error) throw error;
    expect(serviceBooking).toMatchObject({
      status: 'cancelled',
      tid: 'SVC-TID-CANCELLED-NOTI',
      refund_amount: 90000,
      host_payout_amount: 0,
      platform_revenue: 0,
    });
  });
});
