import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { getEligibleServiceHostIds } from '@/app/utils/serviceHostNotifications';
import { createAdminClient } from '@/app/utils/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

type ServicePaymentOpenedParams = {
  supabaseAdmin: AdminClient;
  requestId: string;
  requestTitle: string;
  requestCity: string;
  requestCountry: string;
  durationHours: number;
  guestCount: number;
  customerId: string;
};

type ServiceCancellationParams = {
  supabaseAdmin: AdminClient;
  requestId: string;
  requestTitle: string;
  customerId: string | null;
  hostId: string | null;
  refundAmount?: number | null;
};

type ServiceCancellationRequestedParams = {
  supabaseAdmin: AdminClient;
  requestId: string;
  requestTitle: string;
  customerId: string | null;
  hostId: string | null;
};

export async function notifyServicePaymentOpened(params: ServicePaymentOpenedParams) {
  const {
    supabaseAdmin,
    requestId,
    requestTitle,
    requestCity,
    requestCountry,
    durationHours,
    guestCount,
    customerId,
  } = params;

  try {
    const hostIds = await getEligibleServiceHostIds(supabaseAdmin, {
      requestCity,
      requestCountry,
      customerId,
    });

    if (hostIds.length > 0) {
      const notifications = hostIds.map((hostId) => ({
        user_id: hostId,
        type: 'service_request_new',
        title: `📋 새로운 맞춤 서비스 의뢰 — ${requestCity}`,
        message: `${requestTitle} (${durationHours}시간, ${guestCount}명)`,
        link: `/services/${requestId}`,
        is_read: false,
      }));
      const { error } = await supabaseAdmin.from('notifications').insert(notifications);
      if (error) {
        console.error('[ServiceNotificationFlows] host payment-open notification insert failed:', error);
      }

      void Promise.allSettled(
        hostIds.map((hostId) =>
          sendImmediateGenericEmail({
            recipientUserId: hostId,
            subject: '[Locally] 새로운 맞춤 서비스 의뢰가 도착했습니다',
            title: '새로운 맞춤 서비스 의뢰가 도착했습니다',
            message: `'${requestTitle}' 의뢰가 등록되었습니다. ${requestCity}에서 활동 가능한 호스트에게만 전달된 요청입니다. (${durationHours}시간, ${guestCount}명)`,
            link: `/services/${requestId}`,
            ctaLabel: '의뢰 확인하기',
          })
        )
      ).catch((emailError) => {
        console.error('[ServiceNotificationFlows] host payment-open email dispatch failed:', emailError);
      });
    }

    const { error: customerNotificationError } = await supabaseAdmin.from('notifications').insert({
      user_id: customerId,
      type: 'service_payment_confirmed',
      title: '✅ 결제가 완료되었습니다',
      message: `'${requestTitle}' 결제가 완료되어 현지 호스트 모집이 시작됩니다.`,
      link: `/services/${requestId}`,
      is_read: false,
    });

    if (customerNotificationError) {
      console.error('[ServiceNotificationFlows] customer payment-open notification insert failed:', customerNotificationError);
    }

    void sendImmediateGenericEmail({
      recipientUserId: customerId,
      subject: '[Locally] 서비스 결제가 완료되었습니다',
      title: '결제가 완료되었습니다',
      message: `'${requestTitle}' 결제가 완료되어 현지 호스트 모집이 시작됩니다.`,
      link: `/services/${requestId}`,
      ctaLabel: '의뢰 확인하기',
    }).catch((emailError) => {
      console.error('[ServiceNotificationFlows] customer payment-open email failed:', emailError);
    });
  } catch (error) {
    console.error('[ServiceNotificationFlows] payment-open side effect failed:', error);
  }
}

export async function notifyServiceCancellationRequested(
  params: ServiceCancellationRequestedParams
) {
  const { supabaseAdmin, requestId, requestTitle, customerId, hostId } = params;
  const recipientIds = [customerId, hostId].filter((value): value is string => Boolean(value));

  if (recipientIds.length === 0) return;

  try {
    const notifications = recipientIds.map((recipientId) => ({
      user_id: recipientId,
      type: 'service_cancelled',
      title: '취소 요청이 접수되었습니다.',
      message: `'${requestTitle}' 서비스 취소 요청이 접수되었습니다. 관리자가 검토 후 처리합니다.`,
      link: `/services/${requestId}`,
      is_read: false,
    }));
    const { error } = await supabaseAdmin.from('notifications').insert(notifications);
    if (error) {
      console.error('[ServiceNotificationFlows] cancellation-request notification insert failed:', error);
    }
  } catch (error) {
    console.error('[ServiceNotificationFlows] cancellation-request notification failed:', error);
  }

  void Promise.allSettled(
    recipientIds.map((recipientId) =>
      sendImmediateGenericEmail({
        recipientUserId: recipientId,
        subject: '[Locally] 서비스 취소 요청이 접수되었습니다',
        title: '취소 요청이 접수되었습니다',
        message: `'${requestTitle}' 서비스 취소 요청이 접수되었습니다. 관리자가 검토 후 처리합니다.`,
        link: `/services/${requestId}`,
        ctaLabel: '의뢰 확인하기',
      })
    )
  ).catch((emailError) => {
    console.error('[ServiceNotificationFlows] cancellation-request email dispatch failed:', emailError);
  });
}

export async function notifyServiceCancellationCompleted(
  params: ServiceCancellationParams
) {
  const { supabaseAdmin, requestId, requestTitle, customerId, hostId, refundAmount } = params;
  const recipientIds = [customerId, hostId].filter((value): value is string => Boolean(value));

  if (recipientIds.length === 0) return;

  const refundText =
    typeof refundAmount === 'number'
      ? refundAmount > 0
        ? ` 환불 금액: ₩${refundAmount.toLocaleString()}`
        : ' 환불 금액은 없습니다.'
      : '';
  const message = `'${requestTitle}' 서비스가 취소되었습니다.${refundText}`;

  try {
    const notifications = recipientIds.map((recipientId) => ({
      user_id: recipientId,
      type: 'service_cancelled',
      title: '서비스가 취소되었습니다.',
      message,
      link: `/services/${requestId}`,
      is_read: false,
    }));
    const { error } = await supabaseAdmin.from('notifications').insert(notifications);
    if (error) {
      console.error('[ServiceNotificationFlows] cancellation-complete notification insert failed:', error);
    }
  } catch (error) {
    console.error('[ServiceNotificationFlows] cancellation-complete notification failed:', error);
  }

  void Promise.allSettled(
    recipientIds.map((recipientId) =>
      sendImmediateGenericEmail({
        recipientUserId: recipientId,
        subject: '[Locally] 서비스 취소 안내',
        title: '서비스가 취소되었습니다',
        message,
        link: `/services/${requestId}`,
        ctaLabel: '의뢰 확인하기',
      })
    )
  ).catch((emailError) => {
    console.error('[ServiceNotificationFlows] cancellation-complete email dispatch failed:', emailError);
  });
}
