import { createAdminClient } from '@/app/utils/supabase/admin';
import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { getProxyLinkedInquiryId, getProxyRequestTitle, getProxyCategoryLabel } from '@/app/utils/proxyBooking';
import type { ProxyFormData, ProxyRequest } from '@/app/types/proxy';

type ProxyPaymentEvent = 'confirmed' | 'cancelled' | 'refunded';

function getProxyRequesterName(params: {
  fallbackEmail?: string | null;
  formData: Record<string, unknown> | null | undefined;
  contactName?: string | null;
}) {
  const directContactName = typeof params.contactName === 'string' ? params.contactName.trim() : '';
  if (directContactName) return directContactName;

  const reservationName = typeof params.formData?.reservation_name === 'string'
    ? params.formData.reservation_name.trim()
    : '';
  if (reservationName) return reservationName;

  const fallbackEmail = typeof params.fallbackEmail === 'string' ? params.fallbackEmail.trim() : '';
  if (fallbackEmail) return fallbackEmail.split('@')[0];

  return '고객';
}

export async function notifyProxyRequestAdminIntake(params: {
  request: Pick<ProxyRequest, 'id' | 'category' | 'form_data'>;
  fallbackEmail?: string | null;
  paymentLabel: string;
  finalAmount: number;
}) {
  const requesterName = getProxyRequesterName({
    fallbackEmail: params.fallbackEmail,
    formData: params.request.form_data,
    contactName: typeof params.request.form_data?.contact_name === 'string'
      ? params.request.form_data.contact_name
      : null,
  });
  const categoryLabel = getProxyCategoryLabel(params.request.category);
  const alertLink = `/admin/dashboard?tab=CHATS&view=phone&proxyRequestId=${params.request.id}`;
  const alertMessage = `${categoryLabel} · ${requesterName} · ${params.paymentLabel} · ₩${params.finalAmount.toLocaleString()}`;

  try {
    await insertAdminAlerts({
      title: '새 전화 예약 요청이 접수되었습니다',
      message: alertMessage,
      link: alertLink,
    });

    void sendAdminAlertEmails({
      subject: '[Locally Admin] 새 전화 예약 요청이 접수되었습니다',
      title: '새 전화 예약 요청이 접수되었습니다',
      message: `${alertMessage}\n\nCustomer Support > 전화예약 탭에서 요청을 확인해주세요.`,
      link: alertLink,
      ctaLabel: '전화 예약 열기',
    }).catch((emailError) => {
      console.error('[ProxyBookingNotifications] admin intake email side effect failed:', emailError);
    });
  } catch (error) {
    console.error('[ProxyBookingNotifications] admin intake side effect failed:', error);
  }
}

function buildProxyCustomerLink(params: {
  requestId: string;
  formData: ProxyFormData | Record<string, unknown> | null | undefined;
}) {
  const linkedInquiryId = getProxyLinkedInquiryId(params.formData);
  if (linkedInquiryId) {
    return `/guest/inbox?inquiryId=${encodeURIComponent(linkedInquiryId)}`;
  }

  return `/proxy-bookings/${params.requestId}`;
}

function getPaymentEventPayload(params: {
  event: ProxyPaymentEvent;
  title: string;
  link: string;
}) {
  const { event, title, link } = params;

  switch (event) {
    case 'confirmed':
      return {
        notificationType: 'booking_confirmed',
        title: '전화 예약 결제가 확인되었습니다',
        message: `'${title}' 요청의 결제가 확인되었습니다. 운영팀이 요청을 진행하며, 자세한 안내는 1:1 문의함에서 드립니다.`,
        link,
      };
    case 'cancelled':
      return {
        notificationType: 'cancellation',
        title: '전화 예약 결제가 취소되었습니다',
        message: `'${title}' 요청의 결제가 취소되어 접수가 종료되었습니다.`,
        link,
      };
    case 'refunded':
      return {
        notificationType: 'cancellation',
        title: '전화 예약 결제가 환불 처리되었습니다',
        message: `'${title}' 요청의 결제가 환불 처리되었습니다. 자세한 내용은 1:1 문의함에서 확인해 주세요.`,
        link,
      };
    default:
      return {
        notificationType: 'general',
        title: '전화 예약 결제 상태가 변경되었습니다',
        message: `'${title}' 요청의 결제 상태가 변경되었습니다.`,
        link,
      };
  }
}

export async function notifyProxyPaymentEvent(params: {
  event: ProxyPaymentEvent;
  request: Pick<ProxyRequest, 'id' | 'category' | 'form_data' | 'user_id'>;
}) {
  const supabaseAdmin = createAdminClient();
  const requestTitle = getProxyRequestTitle(params.request);
  const link = buildProxyCustomerLink({
    requestId: params.request.id,
    formData: params.request.form_data,
  });
  const payload = getPaymentEventPayload({
    event: params.event,
    title: requestTitle,
    link,
  });

  const copyKey =
    params.event === 'confirmed'
      ? 'proxy.payment_confirmed'
      : params.event === 'cancelled'
        ? 'proxy.payment_cancelled'
        : 'proxy.payment_refunded';

  const notificationRow = await buildLocalizedNotificationInsert({
    supabaseAdmin,
    userId: params.request.user_id,
    type: payload.notificationType,
    link: payload.link,
    key: copyKey,
    copyParams: {
      requestTitle,
    },
  });

  const { error: notificationError } = await supabaseAdmin.from('notifications').insert(notificationRow);

  if (notificationError) {
    console.error('[ProxyBookingNotifications] failed to insert customer notification:', notificationError);
  }

  await sendImmediateGenericEmail({
    recipientUserId: params.request.user_id,
    subject: '',
    title: '',
    message: '',
    templatedEmail: {
      templateId: 'notice.copy',
      audience: 'guest',
      payload: {
        copyKey,
        copyParams: {
          requestTitle,
        },
        ctaUrl: payload.link,
      },
    },
  }).catch((emailError) => {
    console.error('[ProxyBookingNotifications] failed to send customer email:', emailError);
  });
}
