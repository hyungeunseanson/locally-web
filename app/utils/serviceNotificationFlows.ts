import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { notifyMembershipMilestone } from '@/app/utils/memberMilestoneNotifications';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
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
  supportInquiryId?: string | number | null;
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
    customerId,
    supportInquiryId,
  } = params;

  try {
    const customerLink = supportInquiryId
      ? `/guest/inbox?inquiryId=${encodeURIComponent(String(supportInquiryId))}`
      : `/services/${requestId}`;

    const customerNotificationRow = await buildLocalizedNotificationInsert({
      supabaseAdmin,
      userId: customerId,
      type: 'service_payment_confirmed',
      link: customerLink,
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
      subject: '',
      title: '',
      message: '',
      templatedEmail: {
        templateId: 'service.payment_confirmed',
        audience: 'guest',
        payload: {
          requestTitle,
          ctaUrl: customerLink,
        },
      },
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
    recipientIds.map(async (recipientId) => {
      return sendImmediateGenericEmail({
        recipientUserId: recipientId,
        subject: '',
        title: '',
        message: '',
        templatedEmail: {
          templateId: 'notice.copy',
          audience: recipientId === hostId ? 'host' : 'guest',
          payload: {
            copyKey: 'service.cancel_requested',
            copyParams: {
              requestTitle,
            },
            ctaUrl: `/services/${requestId}`,
          },
        },
      });
    })
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
    recipientIds.map(async (recipientId) => {
      return sendImmediateGenericEmail({
        recipientUserId: recipientId,
        subject: '',
        title: '',
        message: '',
        templatedEmail: {
          templateId: 'notice.copy',
          audience: recipientId === hostId ? 'host' : 'guest',
          payload: {
            copyKey: 'service.cancelled',
            copyParams: {
              requestTitle,
              refundAmount,
            },
            ctaUrl: `/services/${requestId}`,
          },
        },
      });
    })
  ).catch((emailError) => {
    console.error('[ServiceNotificationFlows] cancellation-complete email dispatch failed:', emailError);
  });
}
