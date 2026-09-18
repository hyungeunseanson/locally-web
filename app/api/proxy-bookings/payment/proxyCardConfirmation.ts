import { updateProxyPaymentState } from '@/app/api/admin/proxy-bookings/shared';
import { notifyAdminsOfNewGuestInquiry } from '@/app/api/inquiries/thread/shared';
import { startOrAdvanceAdminSupportUnreadBatch } from '@/app/utils/adminSupportUnreadAlerts';
import {
  notifyProxyPaymentEvent,
  notifyProxyRequestAdminIntake,
} from '@/app/utils/proxyBookingNotifications';
import type { VerifiedCardPayment } from '@/app/utils/payments/card/types';
import { createAdminClient } from '@/app/utils/supabase/admin';
import type { ProxyCategory, ProxyFormData } from '@/app/types/proxy';
import {
  buildProxyInquiryInitialMessage,
  getProxyLinkedInquiryId,
  getProxyRequestFeeKrw,
  isProxyCardPaymentAnchor,
  PROXY_CARD_ANCHOR_MARKER,
} from '@/app/utils/proxyBooking';

export type ProxyCardRequestRow = {
  id: string;
  user_id: string;
  category: string;
  form_data: Record<string, unknown> | null;
  payment_channel: string;
  payment_status: string | null;
  tid?: string | null;
};

type ProxyCardConfirmationResult =
  | {
      success: true;
      alreadyProcessed?: boolean;
      inquiryId?: string;
      redirectUrl?: string;
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

  if (isProxyCardPaymentAnchor(proxyRequest)) {
    return finalizeProxyCardAnchor({
      supabaseAdmin,
      proxyRequest,
      verificationResult,
    });
  }

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

async function finalizeProxyCardAnchor(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  proxyRequest: ProxyCardRequestRow;
  verificationResult: VerifiedCardPayment;
}): Promise<ProxyCardConfirmationResult> {
  const { supabaseAdmin, proxyRequest, verificationResult } = params;
  let completedRequest = proxyRequest;

  if (String(proxyRequest.payment_status || '').toUpperCase() === 'WAITING') {
    const updated = await updateProxyPaymentState({
      supabaseAdmin,
      requestId: proxyRequest.id,
      currentPaymentStatus: 'WAITING',
      paymentStatus: 'COMPLETED',
      tid: verificationResult.providerTransactionId,
      paidAt: new Date().toISOString(),
    });

    if (updated) {
      completedRequest = {
        ...proxyRequest,
        payment_status: 'COMPLETED',
        tid: verificationResult.providerTransactionId,
      };
    } else {
      const { data: latestRequest, error: latestRequestError } = await supabaseAdmin
        .from('proxy_requests')
        .select('id, user_id, category, form_data, payment_channel, payment_status, tid')
        .eq('id', proxyRequest.id)
        .maybeSingle<ProxyCardRequestRow>();

      if (latestRequestError) {
        throw new Error(latestRequestError.message);
      }

      if (!latestRequest || String(latestRequest.payment_status || '').toUpperCase() !== 'COMPLETED') {
        return { success: true, alreadyProcessed: true };
      }

      completedRequest = latestRequest;

      if (!isProxyCardPaymentAnchor(completedRequest)) {
        const linkedInquiryId = getProxyLinkedInquiryId(completedRequest.form_data);
        return {
          success: true,
          alreadyProcessed: true,
          inquiryId: linkedInquiryId || undefined,
          redirectUrl: linkedInquiryId
            ? `/guest/inbox?inquiryId=${encodeURIComponent(linkedInquiryId)}`
            : undefined,
        };
      }
    }
  } else if (String(proxyRequest.payment_status || '').toUpperCase() !== 'COMPLETED') {
    return { success: true, alreadyProcessed: true };
  }

  const storedTid = String(completedRequest.tid || '').trim();
  const verifiedTid = String(verificationResult.providerTransactionId || '').trim();
  if (!storedTid || !verifiedTid || storedTid !== verifiedTid) {
    return {
      success: false,
      status: 409,
      error: '저장된 카드 결제 거래번호와 검증 결과가 일치하지 않습니다.',
    };
  }

  const formData = (completedRequest.form_data || {}) as ProxyFormData;
  const finalAmount = getProxyRequestFeeKrw(completedRequest.category as ProxyCategory, formData);
  if (verificationResult.approvedAmount !== finalAmount) {
    return {
      success: false,
      status: 409,
      error: '저장된 전화 예약 결제 금액과 검증 결과가 일치하지 않습니다.',
    };
  }

  const initialMessage = buildProxyInquiryInitialMessage({
    category: completedRequest.category as ProxyCategory,
    formData,
    paymentChannel: completedRequest.payment_channel,
    finalAmount,
  });

  const { data: activation, error: activationError } = await supabaseAdmin
    .rpc('finalize_proxy_card_intake_atomic', {
      p_proxy_request_id: completedRequest.id,
      p_verified_amount: verificationResult.approvedAmount,
      p_verified_tid: storedTid,
      p_initial_message: initialMessage,
    })
    .maybeSingle<{
      inquiry_id: number | string;
      message_id: number | string | null;
      message_created_at: string | null;
      activated_now: boolean;
    }>();

  if (activationError || !activation?.inquiry_id) {
    throw new Error(activationError?.message || '전화 예약 정식 접수 활성화에 실패했습니다.');
  }

  const inquiryId = String(activation.inquiry_id);
  const redirectUrl = `/guest/inbox?inquiryId=${encodeURIComponent(inquiryId)}`;

  if (!activation.activated_now) {
    return {
      success: true,
      alreadyProcessed: true,
      inquiryId,
      redirectUrl,
    };
  }

  const activatedFormData = {
    ...formData,
    linked_inquiry_id: activation.inquiry_id,
  } as ProxyFormData;
  delete activatedFormData[PROXY_CARD_ANCHOR_MARKER];

  try {
    await notifyAdminsOfNewGuestInquiry({
      inquiryId: activation.inquiry_id,
      inquiryType: 'admin_support',
    });
  } catch (error) {
    console.error('[proxy-card] inquiry admin alert failed:', error);
  }

  if (activation.message_id) {
    try {
      await startOrAdvanceAdminSupportUnreadBatch({
        supabaseAdmin,
        inquiryId: activation.inquiry_id,
        messageId: activation.message_id,
        messageCreatedAt: activation.message_created_at,
      });
    } catch (error) {
      console.error('[proxy-card] unread alert batch side effect failed:', error);
    }
  }

  await notifyProxyRequestAdminIntake({
    request: {
      id: completedRequest.id,
      category: completedRequest.category as ProxyCategory,
      form_data: activatedFormData,
    },
    paymentLabel: 'LOCALLY · 카드 · 결제 완료',
    finalAmount,
  });

  try {
    await notifyProxyPaymentEvent({
      event: 'confirmed',
      request: {
        id: completedRequest.id,
        user_id: completedRequest.user_id,
        category: completedRequest.category as ProxyCategory,
        form_data: activatedFormData,
      },
    });
  } catch (error) {
    console.error('[proxy-card] customer payment notification side effect failed:', error);
  }

  return {
    success: true,
    inquiryId,
    redirectUrl,
  };
}
