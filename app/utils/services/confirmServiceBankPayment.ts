import type { SupabaseClient } from '@supabase/supabase-js';

import { insertAdminAlerts, sendAdminPaymentConfirmedEmail } from '@/app/utils/adminAlertCenter';
import { notifyServicePaymentOpened } from '@/app/utils/serviceNotificationFlows';

type AtomicPaymentRow = {
  booking_id: string;
  request_id: string;
  customer_id: string;
  amount: number;
  already_processed: boolean;
  support_inquiry_id: string;
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
  supportInquiryId: string;
};

type ConfirmFailure = {
  success: false;
  status: 400 | 404 | 409 | 500;
  error: string;
};

export type ConfirmServiceBankPaymentResult = ConfirmFailure | {
  success: true;
  alreadyProcessed: boolean;
  requestWasOpened: boolean;
  usedAtomicRpc: true;
  payment: ServiceBankPaymentContext;
};

function mapRpcError(error: { message?: string | null; details?: string | null; hint?: string | null }): ConfirmFailure {
  const detail = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  if (detail.includes('SVC_NOT_FOUND')) {
    return { success: false, status: 404, error: '예약 정보를 찾을 수 없습니다.' };
  }
  if (detail.includes('SVC_INVALID_PAYMENT_METHOD')) {
    return { success: false, status: 409, error: '무통장 입금 예약이 아닙니다.' };
  }
  if (detail.includes('SVC_PAYMENT_INVALID_STATUS')) {
    return { success: false, status: 409, error: '현재 상태에서는 입금 확인할 수 없습니다.' };
  }
  return { success: false, status: 500, error: '서비스 입금 확인 중 오류가 발생했습니다.' };
}

export async function confirmServiceBankPayment(
  supabaseAdmin: SupabaseClient,
  orderId: unknown
): Promise<ConfirmServiceBankPaymentResult> {
  if (typeof orderId !== 'string' || !orderId.trim()) {
    return { success: false, status: 400, error: '주문번호가 필요합니다.' };
  }

  const normalizedOrderId = orderId.trim();
  const { data, error } = await supabaseAdmin
    .rpc('confirm_service_concierge_payment_atomic', {
      p_order_id: normalizedOrderId,
      p_payment_method: 'bank',
      p_tid: null,
    })
    .maybeSingle<AtomicPaymentRow>();

  if (error || !data) {
    console.error('[service concierge] bank confirmation RPC failed:', error);
    return mapRpcError(error || {});
  }

  const { data: requestMeta, error: requestError } = await supabaseAdmin
    .from('service_requests')
    .select('title, city, country, duration_hours, guest_count')
    .eq('id', data.request_id)
    .maybeSingle();
  if (requestError || !requestMeta) {
    return { success: false, status: 500, error: '서비스 신청 정보를 확인하지 못했습니다.' };
  }

  return {
    success: true,
    alreadyProcessed: Boolean(data.already_processed),
    requestWasOpened: !data.already_processed,
    usedAtomicRpc: true,
    payment: {
      bookingId: data.booking_id,
      orderId: normalizedOrderId,
      requestId: data.request_id,
      customerId: data.customer_id,
      amount: Number(data.amount),
      requestTitle: requestMeta.title || '맞춤 서비스',
      requestCity: requestMeta.city || '',
      requestCountry: requestMeta.country || 'Japan',
      durationHours: Number(requestMeta.duration_hours || 0),
      guestCount: Number(requestMeta.guest_count || 0),
      supportInquiryId: data.support_inquiry_id,
    },
  };
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
    supportInquiryId: payment.supportInquiryId,
  });

  await Promise.allSettled([
    insertAdminAlerts({
      title: '서비스 입금 확인 완료',
      message: `'${payment.requestTitle}' 건이 관리자 호스트 배정 대기로 전환되었습니다.`,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    }),
    sendAdminPaymentConfirmedEmail({
      domain: 'service',
      title: payment.requestTitle,
      orderId: payment.orderId,
      amount: payment.amount,
      paymentMethod: 'bank',
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    }),
  ]);
}
