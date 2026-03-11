// app/utils/notification.ts
export type NotificationType =
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
}

  export const sendNotification = async ({
    recipient_id, recipient_ids, userId, // 🟢 recipient_ids 추가
    booking_id, review_id,
    type,
    title,
    message, content,
    link, link_url,
    inquiry_id
  }: SendNotificationParams) => {
    
    // 1. 단일 발송 대상
    const finalUserId = recipient_id || userId;
    const finalMessage = message || content || '';
    const finalLink = link || link_url;
  
    // 🟢 2. 다중 발송 처리 (관리자 공지 등)
    if (recipient_ids && recipient_ids.length > 0) {
      try {
        console.log(`🚀 [Notification] 다중 발송 시작 (${recipient_ids.length}명)...`);
        
        // API 호출 (한 번에 배열로 보냄)
        const response = await fetch('/api/notifications/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_ids, // 🟢 배열 전달
            title,
            message: finalMessage,
            link: finalLink,
            type, 
            inquiry_id
          })
        });
  
        if (!response.ok) {
          const errData = await response.json();
          console.error('❌ [Notification] 다중 발송 실패:', errData);
        } else {
          console.log('✅ [Notification] 다중 발송 성공');
        }
      } catch (error) {
        console.error('❌ [Notification] 네트워크 오류:', error);
      }
      return; // 다중 발송 후 종료
    }

  if (!finalUserId) {
    console.error('❌ [Notification] 수신자 ID 누락');
    return;
  }

  try {
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
        inquiry_id
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('❌ [Notification] API 호출 실패:', errData);
    } else {
      console.log('✅ [Notification] API 호출 성공');
    }

  } catch (error) {
    console.error('❌ [Notification] 네트워크 오류:', error);
  }
};
