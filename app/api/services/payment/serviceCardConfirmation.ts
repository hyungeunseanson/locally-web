import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
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

  const { data: updatedBooking, error: bookingUpdateErr } = await supabaseAdmin
    .from('service_bookings')
    .update({
      status: 'PAID',
      payment_method: 'card',
      tid: verificationResult.providerTransactionId,
    })
    .eq('order_id', serviceBooking.order_id)
    .eq('status', 'PENDING')
    .select('id')
    .maybeSingle();

  if (bookingUpdateErr) {
    throw new Error(`[SERVICE] Booking update failed: ${bookingUpdateErr.message}`);
  }

  if (!updatedBooking) {
    return { success: true, alreadyProcessed: true };
  }

  const { error: requestUpdateErr } = await supabaseAdmin
    .from('service_requests')
    .update({ status: 'open' })
    .eq('id', serviceBooking.request_id);

  if (requestUpdateErr) {
    console.error('[SERVICE] Request status update failed:', requestUpdateErr);
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
  });

  insertAdminAlerts({
    title: '서비스 결제가 완료되었습니다',
    message: `'${requestTitle}' 서비스 결제가 완료되어 호스트 모집이 시작되었습니다.`,
    link: '/admin/dashboard?tab=SERVICE_REQUESTS',
  }).catch((adminAlertError) => {
    console.error('[SERVICE] Payment Admin Alert Error:', adminAlertError);
  });

  return { success: true };
}
