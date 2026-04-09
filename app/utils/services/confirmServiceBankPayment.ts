import type { SupabaseClient } from '@supabase/supabase-js';

import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { notifyServicePaymentOpened } from '@/app/utils/serviceNotificationFlows';

type ServiceRequestMetaRow = {
  id: string;
  title: string | null;
  city: string | null;
  country: string | null;
  duration_hours: number | null;
  guest_count: number | null;
  status: string | null;
};

type ServiceBankPaymentBookingRow = {
  id: string;
  order_id: string | null;
  request_id: string | null;
  customer_id: string | null;
  amount: number | null;
  status: string;
  payment_method: string | null;
  service_requests: ServiceRequestMetaRow | ServiceRequestMetaRow[] | null;
};

type AtomicConfirmServiceBankPaymentRow = {
  booking_id: string;
  order_id: string;
  request_id: string;
  customer_id: string;
  amount: number;
  request_title: string | null;
  request_city: string | null;
  request_country: string | null;
  request_duration_hours: number | null;
  request_guest_count: number | null;
  already_processed: boolean;
  request_was_opened: boolean;
};

type ServiceRpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type ConfirmServiceBankPaymentFailure = {
  success: false;
  status: 400 | 404 | 409 | 500;
  error: string;
};

type AtomicConfirmServiceBankPaymentResult =
  | {
      kind: 'missing';
    }
  | {
      kind: 'error';
      failure: ConfirmServiceBankPaymentFailure;
    }
  | {
      kind: 'success';
      data: AtomicConfirmServiceBankPaymentRow;
    };

export type ServiceBankPaymentContext = {
  bookingId: string;
  orderId: string;
  requestId: string;
  customerId: string;
  amount: number;
  requestTitle: string;
  requestCity: string;
  requestCountry: string;
  durationHours: number;
  guestCount: number;
};

export type ConfirmServiceBankPaymentSuccess = {
  success: true;
  alreadyProcessed: boolean;
  requestWasOpened: boolean;
  usedAtomicRpc: boolean;
  payment: ServiceBankPaymentContext;
};

export type ConfirmServiceBankPaymentResult =
  | ConfirmServiceBankPaymentFailure
  | ConfirmServiceBankPaymentSuccess;

function normalizeServiceRequestMeta(
  value: ServiceBankPaymentBookingRow['service_requests']
): ServiceRequestMetaRow | null {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function buildPaymentContext(
  booking: Pick<
    ServiceBankPaymentBookingRow,
    'id' | 'order_id' | 'request_id' | 'customer_id' | 'amount'
  >,
  requestMeta: ServiceRequestMetaRow | null
): ServiceBankPaymentContext | null {
  if (!booking.order_id || !booking.request_id || !booking.customer_id || !requestMeta?.id) {
    return null;
  }

  return {
    bookingId: booking.id,
    orderId: booking.order_id,
    requestId: booking.request_id,
    customerId: booking.customer_id,
    amount: Number(booking.amount || 0),
    requestTitle: requestMeta.title || '맞춤 서비스',
    requestCity: requestMeta.city || '',
    requestCountry: requestMeta.country || '',
    durationHours: requestMeta.duration_hours || 0,
    guestCount: requestMeta.guest_count || 0,
  };
}

function isMissingServiceRpcError(error: ServiceRpcErrorLike | null | undefined, functionName: string) {
  if (!error) return false;

  const combinedMessage = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return (
    error.code === 'PGRST202' ||
    (combinedMessage.includes(functionName) &&
      (combinedMessage.includes('Could not find the function') ||
        combinedMessage.includes('No function matches') ||
        combinedMessage.includes('does not exist')))
  );
}

function parseAtomicConfirmError(error: ServiceRpcErrorLike): ConfirmServiceBankPaymentFailure {
  const combinedMessage = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;

  if (combinedMessage.includes('SVC_NOT_FOUND')) {
    return { success: false, status: 404, error: '예약 정보를 찾을 수 없습니다.' };
  }

  if (combinedMessage.includes('SVC_INVALID_PAYMENT_METHOD')) {
    return { success: false, status: 409, error: '무통장 입금 예약이 아닙니다.' };
  }

  if (
    combinedMessage.includes('SVC_INVALID_STATUS') ||
    combinedMessage.includes('SVC_REQUEST_INVALID_STATUS') ||
    combinedMessage.includes('SVC_REQUEST_MISSING')
  ) {
    return {
      success: false,
      status: 409,
      error: '현재 상태에서는 입금 확인할 수 없습니다.',
    };
  }

  return {
    success: false,
    status: 500,
    error: '서비스 입금 확인 중 오류가 발생했습니다.',
  };
}

async function tryConfirmServiceBankPaymentAtomic(
  supabaseAdmin: SupabaseClient,
  orderId: string
): Promise<AtomicConfirmServiceBankPaymentResult> {
  const rpcName = 'confirm_service_bank_payment_atomic';
  const { data, error } = await supabaseAdmin
    .rpc(rpcName, {
      p_order_id: orderId,
    })
    .maybeSingle<AtomicConfirmServiceBankPaymentRow>();

  if (error) {
    if (isMissingServiceRpcError(error, rpcName)) {
      return { kind: 'missing' as const };
    }
    const failure = parseAtomicConfirmError(error);
    if (failure.status === 500) {
      console.error('[service bank confirm] atomic RPC error:', error);
    }

    return {
      kind: 'error' as const,
      failure,
    };
  }

  if (!data?.booking_id || !data.request_id || !data.customer_id || !data.order_id) {
    return {
      kind: 'error' as const,
      failure: {
        success: false,
        status: 500,
        error: '서비스 입금 확인 중 오류가 발생했습니다.',
      },
    };
  }

  return {
    kind: 'success' as const,
    data,
  };
}

async function fetchServiceBankPaymentBooking(
  supabaseAdmin: SupabaseClient,
  orderId: string
) {
  const { data, error } = await supabaseAdmin
    .from('service_bookings')
    .select(`
      id,
      order_id,
      request_id,
      customer_id,
      amount,
      status,
      payment_method,
      service_requests(id, title, city, country, duration_hours, guest_count, status)
    `)
    .eq('order_id', orderId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ServiceBankPaymentBookingRow;
}

async function rollbackPendingServiceBankPayment(
  supabaseAdmin: SupabaseClient,
  bookingId: string
) {
  const { error } = await supabaseAdmin
    .from('service_bookings')
    .update({ status: 'PENDING' })
    .eq('id', bookingId)
    .eq('status', 'PAID')
    .eq('payment_method', 'bank');

  return { error };
}

async function confirmServiceBankPaymentFallback(
  supabaseAdmin: SupabaseClient,
  orderId: string
): Promise<ConfirmServiceBankPaymentResult> {
  const booking = await fetchServiceBankPaymentBooking(supabaseAdmin, orderId);
  if (!booking) {
    return { success: false, status: 404, error: '예약 정보를 찾을 수 없습니다.' };
  }

  const requestMeta = normalizeServiceRequestMeta(booking.service_requests);
  const payment = buildPaymentContext(booking, requestMeta);

  if (!payment || !requestMeta) {
    return {
      success: false,
      status: 409,
      error: '현재 상태에서는 입금 확인할 수 없습니다.',
    };
  }

  if ((booking.payment_method || '').toLowerCase() !== 'bank') {
    return { success: false, status: 409, error: '무통장 입금 예약이 아닙니다.' };
  }

  if (['PAID', 'confirmed', 'completed'].includes(booking.status)) {
    return {
      success: true,
      alreadyProcessed: true,
      requestWasOpened: requestMeta.status === 'open',
      usedAtomicRpc: false,
      payment,
    };
  }

  if (booking.status !== 'PENDING') {
    return {
      success: false,
      status: 409,
      error: '현재 상태에서는 입금 확인할 수 없습니다.',
    };
  }

  const { data: updatedBooking, error: bookingUpdateError } = await supabaseAdmin
    .from('service_bookings')
    .update({ status: 'PAID' })
    .eq('id', booking.id)
    .eq('status', 'PENDING')
    .eq('payment_method', 'bank')
    .select('id')
    .maybeSingle();

  if (bookingUpdateError) {
    throw new Error(`[service bank confirm] booking update failed: ${bookingUpdateError.message}`);
  }

  if (!updatedBooking) {
    const latestBooking = await fetchServiceBankPaymentBooking(supabaseAdmin, orderId);
    const latestRequestMeta = normalizeServiceRequestMeta(latestBooking?.service_requests || null);
    const latestPayment = latestBooking ? buildPaymentContext(latestBooking, latestRequestMeta) : null;

    if (latestBooking && latestPayment && ['PAID', 'confirmed', 'completed'].includes(latestBooking.status)) {
      return {
        success: true,
        alreadyProcessed: true,
        requestWasOpened: latestRequestMeta?.status === 'open',
        usedAtomicRpc: false,
        payment: latestPayment,
      };
    }

    return {
      success: false,
      status: 409,
      error: '현재 상태에서는 입금 확인할 수 없습니다.',
    };
  }

  if (requestMeta.status === 'open') {
    return {
      success: true,
      alreadyProcessed: false,
      requestWasOpened: false,
      usedAtomicRpc: false,
      payment,
    };
  }

  const { data: updatedRequest, error: requestUpdateError } = await supabaseAdmin
    .from('service_requests')
    .update({ status: 'open' })
    .eq('id', requestMeta.id)
    .eq('status', 'pending_payment')
    .select('id')
    .maybeSingle();

  if (requestUpdateError) {
    const rollbackResult = await rollbackPendingServiceBankPayment(supabaseAdmin, booking.id);
    if (rollbackResult.error) {
      console.error('[service bank confirm] rollback after request update error failed:', rollbackResult.error);
    }
    throw new Error(`[service bank confirm] request update failed: ${requestUpdateError.message}`);
  }

  if (!updatedRequest) {
    const { data: latestRequest, error: latestRequestError } = await supabaseAdmin
      .from('service_requests')
      .select('status')
      .eq('id', requestMeta.id)
      .maybeSingle();

    if (latestRequestError) {
      const rollbackResult = await rollbackPendingServiceBankPayment(supabaseAdmin, booking.id);
      if (rollbackResult.error) {
        console.error('[service bank confirm] rollback after latest request lookup failed:', rollbackResult.error);
      }
      throw new Error(`[service bank confirm] latest request lookup failed: ${latestRequestError.message}`);
    }

    if (latestRequest?.status !== 'open') {
      const rollbackResult = await rollbackPendingServiceBankPayment(supabaseAdmin, booking.id);
      if (rollbackResult.error) {
        console.error('[service bank confirm] rollback after invalid request status failed:', rollbackResult.error);
      }

      return {
        success: false,
        status: 409,
        error: '현재 상태에서는 입금 확인할 수 없습니다.',
      };
    }

    return {
      success: true,
      alreadyProcessed: false,
      requestWasOpened: false,
      usedAtomicRpc: false,
      payment,
    };
  }

  return {
    success: true,
    alreadyProcessed: false,
    requestWasOpened: true,
    usedAtomicRpc: false,
    payment,
  };
}

export async function confirmServiceBankPayment(
  supabaseAdmin: SupabaseClient,
  orderId: unknown
): Promise<ConfirmServiceBankPaymentResult> {
  if (typeof orderId !== 'string' || !orderId.trim()) {
    return { success: false, status: 400, error: '주문번호가 필요합니다.' };
  }

  const normalizedOrderId = orderId.trim();
  const atomicResult = await tryConfirmServiceBankPaymentAtomic(supabaseAdmin, normalizedOrderId);

  if (atomicResult.kind === 'error') {
    return atomicResult.failure;
  }

  if (atomicResult.kind === 'success') {
    return {
      success: true,
      alreadyProcessed: Boolean(atomicResult.data.already_processed),
      requestWasOpened: Boolean(atomicResult.data.request_was_opened),
      usedAtomicRpc: true,
      payment: {
        bookingId: atomicResult.data.booking_id,
        orderId: atomicResult.data.order_id,
        requestId: atomicResult.data.request_id,
        customerId: atomicResult.data.customer_id,
        amount: Number(atomicResult.data.amount || 0),
        requestTitle: atomicResult.data.request_title || '맞춤 서비스',
        requestCity: atomicResult.data.request_city || '',
        requestCountry: atomicResult.data.request_country || '',
        durationHours: atomicResult.data.request_duration_hours || 0,
        guestCount: atomicResult.data.request_guest_count || 0,
      },
    };
  }

  console.error(
    '[service bank confirm] atomic RPC missing; using guarded fallback until migration is applied.'
  );
  return confirmServiceBankPaymentFallback(supabaseAdmin, normalizedOrderId);
}

export async function runServiceBankConfirmSideEffects(
  supabaseAdmin: SupabaseClient,
  payment: ServiceBankPaymentContext
) {
  await notifyServicePaymentOpened({
    supabaseAdmin,
    requestId: payment.requestId,
    requestTitle: payment.requestTitle,
    requestCity: payment.requestCity,
    requestCountry: payment.requestCountry,
    durationHours: payment.durationHours,
    guestCount: payment.guestCount,
    customerId: payment.customerId,
  });

  try {
    await insertAdminAlerts({
      title: '서비스 입금 확인이 완료되었습니다',
      message: `'${payment.requestTitle}' 서비스의 무통장 입금이 확인되어 호스트 모집이 시작되었습니다.`,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    });
  } catch (error) {
    console.error('[service bank confirm] admin alert failed:', error);
  }
}
