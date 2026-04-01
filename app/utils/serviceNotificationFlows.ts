import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { notifyMembershipMilestone } from '@/app/utils/memberMilestoneNotifications';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
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
      const notifications = await Promise.all(
        hostIds.map((hostId) =>
          buildLocalizedNotificationInsert({
            supabaseAdmin,
            userId: hostId,
            type: 'service_request_new',
            link: `/services/${requestId}`,
            key: 'service.request_new.host',
            copyParams: {
              requestTitle,
              requestCity,
              durationHours,
              guestCount,
            },
          })
        )
      );
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

    const customerNotificationRow = await buildLocalizedNotificationInsert({
      supabaseAdmin,
      userId: customerId,
      type: 'service_payment_confirmed',
      link: `/services/${requestId}`,
      key: 'service.payment_confirmed.customer',
      copyParams: {
        requestTitle,
      },
    });

    const { error: customerNotificationError } = await supabaseAdmin
      .from('notifications')
      .insert(customerNotificationRow);

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

    void notifyMembershipMilestone({
      supabaseAdmin,
      userId: customerId,
    }).catch((milestoneError) => {
      console.error('[ServiceNotificationFlows] membership milestone failed:', milestoneError);
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
    const notifications = await Promise.all(
      recipientIds.map((recipientId) =>
        buildLocalizedNotificationInsert({
          supabaseAdmin,
          userId: recipientId,
          type: 'service_cancelled',
          link: `/services/${requestId}`,
          key: 'service.cancel_requested',
          copyParams: {
            requestTitle,
          },
        })
      )
    );
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

  try {
    const notifications = await Promise.all(
      recipientIds.map((recipientId) =>
        buildLocalizedNotificationInsert({
          supabaseAdmin,
          userId: recipientId,
          type: 'service_cancelled',
          link: `/services/${requestId}`,
          key: 'service.cancelled',
          copyParams: {
            requestTitle,
            refundAmount,
          },
        })
      )
    );
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
        message:
          typeof refundAmount === 'number'
            ? refundAmount > 0
              ? `'${requestTitle}' 서비스가 취소되었습니다. 환불 금액: ₩${refundAmount.toLocaleString()}`
              : `'${requestTitle}' 서비스가 취소되었습니다. 환불 금액은 없습니다.`
            : `'${requestTitle}' 서비스가 취소되었습니다.`,
        link: `/services/${requestId}`,
        ctaLabel: '의뢰 확인하기',
      })
    )
  ).catch((emailError) => {
    console.error('[ServiceNotificationFlows] cancellation-complete email dispatch failed:', emailError);
  });
}
