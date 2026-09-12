import { expect, test } from '@playwright/test';

import {
  cleanupTestUsers,
  createAuthUser,
  createTestUser,
  formatDate,
  getTestAdminClient,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdRequestIds: string[] = [];
const createdBookingIds: string[] = [];

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdRequestIds.length > 0) {
    const { data: inquiries, error: inquiryReadError } = await supabase
      .from('inquiries')
      .select('id')
      .in('service_request_id', createdRequestIds);
    if (inquiryReadError) throw inquiryReadError;

    const inquiryIds = (inquiries || []).map((inquiry) => inquiry.id);
    if (inquiryIds.length > 0) {
      const { error: messageDeleteError } = await supabase
        .from('inquiry_messages')
        .delete()
        .in('inquiry_id', inquiryIds);
      if (messageDeleteError) throw messageDeleteError;

      const { error: inquiryDeleteError } = await supabase
        .from('inquiries')
        .delete()
        .in('id', inquiryIds);
      if (inquiryDeleteError) throw inquiryDeleteError;
    }
  }

  if (createdBookingIds.length > 0) {
    const { error } = await supabase.from('service_bookings').delete().in('id', createdBookingIds);
    if (error) throw error;
  }
  if (createdRequestIds.length > 0) {
    const { error } = await supabase.from('service_requests').delete().in('id', createdRequestIds);
    if (error) throw error;
  }

  await cleanupTestUsers(createdAuthUserIds);
});

test.describe.serial('concierge expand migration transition', () => {
  test('takes over a post-migration old-main write without repair or cutover race', async () => {
    const supabase = getTestAdminClient();
    const customer = createTestUser('concierge.transition.customer');
    const host = createTestUser('concierge.transition.host');
    const admin = createTestUser('concierge.transition.admin');
    const customerId = await createAuthUser(customer);
    const hostId = await createAuthUser(host);
    const adminId = await createAuthUser(admin, { isAdmin: true });
    createdAuthUserIds.push(customerId, hostId, adminId);

    const { error: hostError } = await supabase.from('host_applications').insert({
      user_id: hostId,
      host_nationality: '대한민국',
      languages: ['한국어', 'English'],
      language_levels: [
        { language: '한국어', level: 5 },
        { language: 'English', level: 4 },
      ],
      name: host.fullName,
      phone: host.phone,
      dob: '1991-01-01',
      email: host.email,
      instagram: '@codex_concierge_transition',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: 'Expand migration transition verification host.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: host.fullName,
      motivation: 'Expand migration transition verification.',
      status: 'approved',
    });
    if (hostError) throw hostError;

    const serviceDate = new Date();
    serviceDate.setDate(serviceDate.getDate() + 14);

    // Phase A: this is the exact RPC and payload shape used by origin/main.
    const { data: legacyResult, error: legacyError } = await supabase
      .rpc('create_service_request_with_booking_atomic', {
        p_user_id: customerId,
        p_title: 'Old-main transition request',
        p_description: 'Created after the expand migration and before the application cutover.',
        p_city: 'Tokyo',
        p_country: 'Japan',
        p_service_date: formatDate(serviceDate),
        p_start_time: '10:00',
        p_duration_hours: 40,
        p_languages: ['한국어', 'English'],
        p_guest_count: 100,
        p_contact_name: customer.fullName,
        p_contact_phone: customer.phone,
      })
      .single();
    if (legacyError || !legacyResult) throw legacyError || new Error('Legacy request creation failed.');

    const legacy = legacyResult as {
      request_id: string;
      booking_id: string;
      order_id: string;
      amount: number;
    };
    createdRequestIds.push(legacy.request_id);
    createdBookingIds.push(legacy.booking_id);

    const [{ data: request }, { data: schedule }, { data: booking }] = await Promise.all([
      supabase
        .from('service_requests')
        .select('id, guest_count, duration_hours, service_end_at, status')
        .eq('id', legacy.request_id)
        .single(),
      supabase
        .from('service_request_schedule_items')
        .select('request_id, service_date, start_time, duration_hours, sort_order, legacy_imported')
        .eq('request_id', legacy.request_id)
        .single(),
      supabase
        .from('service_bookings')
        .select('id, order_id, amount, status, payment_method')
        .eq('id', legacy.booking_id)
        .single(),
    ]);

    expect(request).toMatchObject({ guest_count: 100, duration_hours: 40, status: 'pending_payment' });
    expect(request?.service_end_at).toBeTruthy();
    expect(schedule).toMatchObject({
      request_id: legacy.request_id,
      duration_hours: 40,
      sort_order: 0,
      legacy_imported: true,
    });
    expect(booking).toMatchObject({
      id: legacy.booking_id,
      order_id: legacy.order_id,
      amount: 1400000,
      status: 'PENDING',
      payment_method: 'card',
    });

    // origin/main normalizes the pending legacy booking before returning the API response.
    const { error: normalizeError } = await supabase
      .from('service_bookings')
      .update({ payment_method: null })
      .eq('id', legacy.booking_id)
      .eq('status', 'PENDING')
      .eq('payment_method', 'card');
    if (normalizeError) throw normalizeError;

    // Phase B: the new application takes over payment, support, assignment and cancellation.
    const { error: bankLockError } = await supabase
      .from('service_bookings')
      .update({ payment_method: 'bank' })
      .eq('id', legacy.booking_id)
      .is('payment_method', null);
    if (bankLockError) throw bankLockError;

    const { data: paymentResult, error: paymentError } = await supabase
      .rpc('confirm_service_concierge_payment_atomic', {
        p_order_id: legacy.order_id,
        p_payment_method: 'bank',
        p_tid: null,
      })
      .single();
    if (paymentError || !paymentResult) throw paymentError || new Error('Concierge payment takeover failed.');
    const payment = paymentResult as { support_inquiry_id: number };
    expect(payment.support_inquiry_id).toBeTruthy();

    const { data: assignment, error: assignmentError } = await supabase
      .rpc('assign_service_concierge_host_atomic', {
        p_admin_id: adminId,
        p_request_id: legacy.request_id,
        p_host_id: hostId,
        p_host_hourly_rate: 20000,
        p_host_agreement_confirmed: true,
      })
      .single();
    if (assignmentError || !assignment) throw assignmentError || new Error('Concierge assignment takeover failed.');
    const assignedHost = assignment as { host_inquiry_id: number };
    expect(assignedHost.host_inquiry_id).toBeTruthy();

    const { data: inquiryRows, error: inquiryError } = await supabase
      .from('inquiries')
      .select('id, type, host_id')
      .eq('service_request_id', legacy.request_id);
    if (inquiryError) throw inquiryError;
    expect(inquiryRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'admin_support', host_id: null }),
        expect.objectContaining({ type: 'general', host_id: hostId }),
      ])
    );

    const { error: cancellationError } = await supabase.rpc(
      'request_service_cancellation_review_atomic',
      {
        p_actor_id: customerId,
        p_order_id: legacy.order_id,
        p_cancel_reason: 'Transition takeover cancellation verification',
      }
    );
    if (cancellationError) throw cancellationError;

    const { data: refundStart, error: refundStartError } = await supabase
      .rpc('begin_service_refund_operation_atomic', {
        p_admin_id: adminId,
        p_order_id: legacy.order_id,
        p_refund_amount: 1400000,
        p_host_compensation_amount: 0,
        p_idempotency_key: `transition-refund-${legacy.order_id}`,
      })
      .single();
    if (refundStartError || !refundStart) {
      throw refundStartError || new Error('Transition refund operation did not start.');
    }
    const refundOperation = refundStart as { operation_id: string };

    const { error: refundFinishError } = await supabase.rpc(
      'finish_service_refund_operation_atomic',
      {
        p_operation_id: refundOperation.operation_id,
        p_outcome: 'succeeded',
        p_provider_reference: 'synthetic-transition-refund',
        p_error_message: null,
      }
    );
    if (refundFinishError) throw refundFinishError;

    const [{ data: finalRequest }, { data: finalBooking }] = await Promise.all([
      supabase.from('service_requests').select('status').eq('id', legacy.request_id).single(),
      supabase
        .from('service_bookings')
        .select('status, refund_amount')
        .eq('id', legacy.booking_id)
        .single(),
    ]);
    expect(finalRequest?.status).toBe('cancelled');
    expect(finalBooking).toMatchObject({ status: 'cancelled', refund_amount: 1400000 });
  });

  test('keeps the new concierge guest policy at 1 through 10', async () => {
    const supabase = getTestAdminClient();
    const customer = createTestUser('concierge.transition.policy');
    const customerId = await createAuthUser(customer);
    createdAuthUserIds.push(customerId);
    const serviceDate = new Date();
    serviceDate.setDate(serviceDate.getDate() + 15);

    const { data, error } = await supabase.rpc('create_service_concierge_request_atomic', {
      p_user_id: customerId,
      p_service_type: 'general',
      p_description: 'The concierge RPC must retain its one-to-ten guest policy.',
      p_city: 'Tokyo',
      p_schedule: [
        { serviceDate: formatDate(serviceDate), startTime: '10:00', durationHours: 4 },
      ],
      p_languages: ['한국어'],
      p_guest_count: 11,
      p_contact_name: customer.fullName,
      p_contact_phone: customer.phone,
      p_client_request_key: `transition-policy-${Date.now()}`,
    });

    expect(data).toBeNull();
    expect(error?.message).toContain('SVC_INVALID_GUEST_COUNT');
  });
});
