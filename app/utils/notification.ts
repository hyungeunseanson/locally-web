// app/utils/notification.ts
export type NotificationType =
  | 'member_welcome'
  | 'circle_welcome'
  | 'booking_request'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_cancel_request'
  | 'cancellation_requested'
  | 'cancellation_approved'
  | 'cancellation'              // 예약 취소 완료 (payment/cancel API)
  | 'new_booking'
  | 'new_message'
  | 'message'                   // 채팅 메시지 알림 (NotificationContext 내부)
  | 'admin_alert'
  // [서비스 매칭 시스템]
  | 'service_request_new'       // 호스트에게: 내 지역 새 의뢰 등록
  | 'service_application_new'   // 고객에게: 새 지원자 등록
  | 'service_host_selected'     // 호스트에게: 고객에게 선택됨
  | 'service_host_rejected'     // 호스트에게: 다른 호스트 선택됨 (미선택)
  | 'service_payment_confirmed' // 양측: 결제 확정 → 매칭 완료
  | 'service_cancelled'        // 양측: 서비스 취소
  // [리뷰 시스템]
  | 'new_review'               // 호스트에게: 게스트가 새 후기 작성
  | 'review_reply'             // 게스트에게: 호스트가 후기에 답글
  | 'review_request';          // 게스트에게: 체험 완료 후 후기 작성 요청

type NotificationCopyKey =
  | 'review_reply'
  | 'cancellation_approved';

export type SendNotificationResult = {
  success?: boolean;
  count?: number;
  notifications?: number;
  emailsSent?: number;
  emailsSkipped?: number;
  emailFailures?: number;
  mode?: string;
  warning?: string;
};

interface SendNotificationParams {
  recipient_id?: string;
  recipient_ids?: string[]; // 🟢 다중 발송용 (관리자 기능)
  userId?: string;
  senderId?: string;
  booking_id?: string | number;
  review_id?: string | number;
  type: NotificationType;
  title: string;
  message?: string;
  content?: string;
  link?: string;
  link_url?: string;
  inquiry_id?: number;
  copy_key?: NotificationCopyKey;
  copy_params?: Record<string, unknown>;
}

async function parseNotificationResponse(response: Response) {
  return response.json().catch(() => null) as Promise<(SendNotificationResult & { error?: string }) | null>;
}

export const sendNotification = async ({
  recipient_id, recipient_ids, userId, // 🟢 recipient_ids 추가
  booking_id, review_id,
  type,
  title,
  message, content,
  link, link_url,
  inquiry_id,
  copy_key,
  copy_params
}: SendNotificationParams): Promise<SendNotificationResult> => {
  // 1. 단일 발송 대상
  const finalUserId = recipient_id || userId;
  const finalMessage = message || content || '';
  const finalLink = link || link_url;

  // 🟢 2. 다중 발송 처리 (관리자 공지 등)
  if (recipient_ids && recipient_ids.length > 0) {
    console.log(`🚀 [Notification] 다중 발송 시작 (${recipient_ids.length}명)...`);

    const response = await fetch('/api/notifications/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_ids, // 🟢 배열 전달
        title,
        message: finalMessage,
        link: finalLink,
        type,
        inquiry_id,
        copy_key,
        copy_params
      })
    });

    const payload = await parseNotificationResponse(response);
    if (!response.ok) {
      throw new Error(payload?.error || '알림 전송에 실패했습니다.');
    }

    console.log('✅ [Notification] 다중 발송 성공');
    return payload || { success: true };
  }

  if (!finalUserId) {
    throw new Error('수신자 ID가 필요합니다.');
  }

  console.log('🚀 [Notification] 알림 API 호출 시도...');

  // 🟢 클라이언트가 직접 DB에 넣지 않고, API에게 모든 처리를 위임함
  const response = await fetch('/api/notifications/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient_id: finalUserId,
      title,
      message: finalMessage,
      link: finalLink,
      booking_id,
      review_id,
      type,
      inquiry_id,
      copy_key,
      copy_params
    })
  });

  const payload = await parseNotificationResponse(response);
  if (!response.ok) {
    throw new Error(payload?.error || '알림 전송에 실패했습니다.');
  }

  console.log('✅ [Notification] API 호출 성공');
  return payload || { success: true };
};
