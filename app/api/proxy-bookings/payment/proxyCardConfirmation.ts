import { updateProxyPaymentState } from '@/app/api/admin/proxy-bookings/shared';
import { notifyProxyPaymentEvent } from '@/app/utils/proxyBookingNotifications';
import type { VerifiedCardPayment } from '@/app/utils/payments/card/types';
import { createAdminClient } from '@/app/utils/supabase/admin';
import type { ProxyCategory, ProxyFormData } from '@/app/types/proxy';

export type ProxyCardRequestRow = {
  id: string;
  user_id: string;
  category: string;
  form_data: Record<string, unknown> | null;
  payment_channel: string;
  payment_status: string | null;
};

type ProxyCardConfirmationResult =
  | {
      success: true;
      alreadyProcessed?: boolean;
    }
  | {
      success: false;
      status: number;
      error: string;
    };

export async function finalizeProxyCardPayment(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  proxyRequest: ProxyCardRequestRow;
  verificationResult: VerifiedCardPayment;
}): Promise<ProxyCardConfirmationResult> {
  const { supabaseAdmin, proxyRequest, verificationResult } = params;

  const updated = await updateProxyPaymentState({
    supabaseAdmin,
    requestId: proxyRequest.id,
    currentPaymentStatus: 'WAITING',
    paymentStatus: 'COMPLETED',
    tid: verificationResult.providerTransactionId,
    paidAt: new Date().toISOString(),
  });

  if (!updated) {
    return { success: true, alreadyProcessed: true };
  }

  await notifyProxyPaymentEvent({
    event: 'confirmed',
    request: {
      id: proxyRequest.id,
      user_id: proxyRequest.user_id,
      category: proxyRequest.category as ProxyCategory,
      form_data: (proxyRequest.form_data || {}) as ProxyFormData,
    },
  });

  return { success: true };
}
