import { insertAdminAlerts, sendAdminPaymentConfirmedEmail } from '@/app/utils/adminAlertCenter';
import type { VerifiedCardPayment } from '@/app/utils/payments/card/types';
import { notifyServicePaymentOpened } from '@/app/utils/serviceNotificationFlows';
import { createAdminClient } from '@/app/utils/supabase/admin';

type ServiceRequestInfo = {
  title?: string | null;
  city?: string | null;
  country?: string | null;
  duration_hours?: number | null;
  guest_count?: number | null;
};

export type ServiceCardBookingRow = {
  id: string;
  order_id: string;
  request_id: string;
  customer_id: string | null;
  status: string;
  payment_method: string | null;
  amount: number | null;
  service_requests?: ServiceRequestInfo | ServiceRequestInfo[] | null;
};

type ServiceCardConfirmationResult =
  | {
      success: true;
      alreadyProcessed?: boolean;
      supportInquiryId?: string;
    }
  | {
      success: false;
      status: number;
      error: string;
    };

export async function finalizeServiceCardPayment(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  serviceBooking: ServiceCardBookingRow;
  verificationResult: VerifiedCardPayment;
}): Promise<ServiceCardConfirmationResult> {
  const { supabaseAdmin, serviceBooking, verificationResult } = params;

  if (!serviceBooking.customer_id) {
    throw new Error('[SERVICE] service booking customer_id is missing.');
  }

  const requestInfo = Array.isArray(serviceBooking.service_requests)
    ? serviceBooking.service_requests[0]
    : serviceBooking.service_requests;
  const requestTitle = requestInfo?.title || '맞춤 서비스';
  const reqCity = requestInfo?.city ?? '';
  const reqCountry = requestInfo?.country ?? '';
  const reqDuration = requestInfo?.duration_hours ?? 0;
  const reqGuests = requestInfo?.guest_count ?? 0;

  const { data: confirmation, error: confirmationError } = await supabaseAdmin
    .rpc('confirm_service_concierge_payment_atomic', {
      p_order_id: serviceBooking.order_id,
      p_payment_method: 'card',
      p_tid: verificationResult.providerTransactionId,
    })
    .maybeSingle<{
      booking_id: string;
      request_id: string;
      customer_id: string;
      amount: number;
      already_processed: boolean;
      support_inquiry_id: string;
    }>();

  if (confirmationError || !confirmation) {
    throw new Error(`[SERVICE] Atomic payment confirmation failed: ${confirmationError?.message || 'empty result'}`);
  }

  if (confirmation.already_processed) {
    return {
      success: true,
      alreadyProcessed: true,
      supportInquiryId: confirmation.support_inquiry_id,
    };
  }

  await notifyServicePaymentOpened({
    supabaseAdmin,
    requestId: serviceBooking.request_id,
    requestTitle,
    requestCity: reqCity,
    requestCountry: reqCountry,
    durationHours: reqDuration,
    guestCount: reqGuests,
    customerId: serviceBooking.customer_id,
    supportInquiryId: confirmation.support_inquiry_id,
  });

  insertAdminAlerts({
    title: '서비스 결제가 완료되었습니다',
    message: `'${requestTitle}' 서비스 결제가 완료되어 현지 담당자 배정 대기로 전환되었습니다.`,
    link: '/admin/dashboard?tab=SERVICE_REQUESTS',
  }).catch((adminAlertError) => {
    console.error('[SERVICE] Payment Admin Alert Error:', adminAlertError);
  });

  try {
    await sendAdminPaymentConfirmedEmail({
      domain: 'service',
      title: requestTitle,
      orderId: serviceBooking.order_id,
      amount: Number(serviceBooking.amount || 0),
      paymentMethod: 'card',
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    });
  } catch (adminEmailError) {
    console.error('[SERVICE] Payment Admin Email Error:', adminEmailError);
  }

  return { success: true, supportInquiryId: confirmation.support_inquiry_id };
}
