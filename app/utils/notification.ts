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
  userId?: string; 
  senderId?: string; // API에서는 안 쓰지만 호환성 위해 남김
  type: NotificationType;
  title: string;          
  message?: string;       
  content?: string;       
  link?: string;          
  link_url?: string;      
  inquiry_id?: number; 
  supabaseClient?: any; // 호환성용
}

export const sendNotification = async ({
  recipient_id, userId,
  type,
  title,
  message, content,
  link, link_url,
  inquiry_id
}: SendNotificationParams) => {
  
  const finalUserId = recipient_id || userId;
  const finalMessage = message || content || '';
  const finalLink = link || link_url;

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