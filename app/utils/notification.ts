import { createClient } from '@/app/utils/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js'; // 🟢 타입 임포트 추가

export type NotificationType = 
  | 'booking_request' 
  | 'booking_confirmed' 
  | 'booking_cancelled' 
  | 'booking_cancel_request'
  | 'cancellation_requested'
  | 'cancellation_approved'
  | 'new_message' 
  | 'admin_alert';

interface SendNotificationParams {
  userId?: string;        // 기존 코드 호환용
  recipient_id?: string;  // 신규 코드 호환용
  senderId?: string;      // 없으면 시스템 알림
  type: NotificationType;
  title: string;          // title은 필수값으로 유지 (기본값 처리 하단에서 함)
  message?: string;       // 기존 코드 호환용
  content?: string;       // 신규 코드 호환용
  link?: string;          // 기존 코드 호환용
  link_url?: string;      // 신규 코드 호환용
  
  // 🟢 [핵심 추가] 서버에서 관리자 권한으로 보낼 때 필요함
  supabaseClient?: SupabaseClient; 
}

export const sendNotification = async ({
  userId, recipient_id,
  senderId,
  type,
  title = '새로운 알림',
  message, content,
  link, link_url,
  supabaseClient // 🟢 인자로 받음
}: SendNotificationParams) => {
  
  // 🟢 [핵심 로직] 외부에서 클라이언트를 주면 그걸 쓰고(서버용), 안 주면 브라우저용 생성
  const supabase = supabaseClient || createClient();

  const finalUserId = userId || recipient_id;
  const finalMessage = message || content || ''; // 빈 문자열 처리로 안전성 확보
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
    console.log(`🔔 Notification sent to ${finalUserId}: ${title}`);
  } catch (error) {
    console.error('❌ Failed to send notification:', error);
  }
};