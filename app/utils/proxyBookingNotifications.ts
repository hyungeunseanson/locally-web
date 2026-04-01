import { createAdminClient } from '@/app/utils/supabase/admin';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { buildLocalizedEmailCopy } from '@/app/utils/emailCopy';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { getProxyLinkedInquiryId, getProxyRequestTitle } from '@/app/utils/proxyBooking';
import type { ProxyFormData, ProxyRequest } from '@/app/types/proxy';

type ProxyPaymentEvent = 'confirmed' | 'cancelled' | 'refunded';

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
        message: `'${title}' 요청의 결제가 확인되었습니다. 담당자가 예약 진행을 이어갑니다.`,
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
        message: `'${title}' 요청의 결제가 환불 처리되었습니다. 세부 내용은 담당자 스레드에서 확인해주세요.`,
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

  const emailCopy = await buildLocalizedEmailCopy({
    supabaseAdmin,
    userId: params.request.user_id,
    key: copyKey,
    copyParams: {
      requestTitle,
    },
  });

  await sendImmediateGenericEmail({
    recipientUserId: params.request.user_id,
    subject: emailCopy.subject,
    title: emailCopy.title,
    message: emailCopy.message,
    link: payload.link,
    ctaLabel: emailCopy.ctaLabel,
  }).catch((emailError) => {
    console.error('[ProxyBookingNotifications] failed to send customer email:', emailError);
  });
}
