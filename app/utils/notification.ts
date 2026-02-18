// app/utils/notification.ts
export type NotificationType = 
  | 'booking_request' 
  | 'booking_confirmed' 
  | 'booking_cancelled' 
  | 'booking_cancel_request'
  | 'cancellation_requested'
  | 'cancellation_approved'
  | 'new_booking' 
  | 'new_message' 
  | 'admin_alert';

  interface SendNotificationParams {
    recipient_id?: string;
    recipient_ids?: string[]; // 🟢 다중 발송용 (관리자 기능)
    userId?: string; 
    senderId?: string;
    type: NotificationType;
    title: string;          
    message?: string;       
    content?: string;       
    link?: string;          
    link_url?: string;      
    inquiry_id?: number; 
    supabaseClient?: any;
  }

  export const sendNotification = async ({
    recipient_id, recipient_ids, userId, // 🟢 recipient_ids 추가
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