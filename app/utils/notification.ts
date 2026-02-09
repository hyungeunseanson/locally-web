import { createClient } from '@/app/utils/supabase/client';

export type NotificationType = 
  | 'booking_request' 
  | 'booking_confirmed' 
  | 'booking_cancelled' 
  | 'booking_cancel_request' // 🟢 추가됨 (useGuestTrips에서 사용)
  | 'cancellation_requested'
  | 'cancellation_approved'
  | 'new_message' 
  | 'admin_alert';

interface SendNotificationParams {
  // supabase 인자 제거됨
  userId?: string;        // 기존 코드 호환용
  recipient_id?: string;  // 🟢 신규 코드 호환용
  senderId?: string;
  type: NotificationType;
  title?: string;
  message?: string;       // 기존 코드 호환용
  content?: string;       // 🟢 신규 코드 호환용
  link?: string;          // 기존 코드 호환용
  link_url?: string;      // 🟢 신규 코드 호환용
}

export const sendNotification = async ({
  userId, recipient_id,
  senderId,
  type,
  title = '새로운 알림', // 기본값 설정
  message, content,
  link, link_url
}: SendNotificationParams) => {
  const supabase = createClient(); // 🟢 여기서 직접 생성!

  // 두 가지 변수명 모두 지원하도록 매핑
  const finalUserId = userId || recipient_id;
  const finalMessage = message || content;
  const finalLink = link || link_url;

  if (!finalUserId) {
    console.error('❌ Notification failed: Missing userId/recipient_id');
    return;
  }

  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: finalUserId,
      sender_id: senderId || null,
      type,
      title,
      message: finalMessage,
      link: finalLink,
      is_read: false
    });

    if (error) throw error;
    console.log(`🔔 Notification sent to ${finalUserId}`);
  } catch (error) {
    console.error('❌ Failed to send notification:', error);
  }
};