import { createClient } from '@/app/utils/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';

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
  userId?: string;        
  recipient_id?: string;  
  senderId?: string;      
  type: NotificationType;
  title: string;          
  message?: string;       
  content?: string;       
  link?: string;          
  link_url?: string;      
  supabaseClient?: SupabaseClient;
  
  // 🟢 [추가됨] 채팅방 ID (쿨타임 체크용)
  inquiry_id?: number; 
}

export const sendNotification = async ({
  userId, recipient_id,
  senderId,
  type,
  title = '새로운 알림',
  message, content,
  link, link_url,
  supabaseClient,
  inquiry_id // 🟢 인자 추가
}: SendNotificationParams) => {
  
  const supabase = supabaseClient || createClient();
  const finalUserId = userId || recipient_id;
  const finalMessage = message || content || '';
  const finalLink = link || link_url;

  if (!finalUserId) {
    console.error('❌ Notification failed: Missing recipient ID');
    return;
  }

  try {
    // (1) DB 알림 저장 (앱 내 알림 - 이건 무조건 저장)
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

    // (2) 이메일 발송 API 호출 (여기에 쿨타임 로직 적용됨)
    const emailTypes: NotificationType[] = [
      'booking_request', 
      'booking_confirmed', 
      'booking_cancelled', 
      'new_message' 
    ];

    if (emailTypes.includes(type)) {
      fetch('/api/notifications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: finalUserId,
          title,
          message: finalMessage,
          link: finalLink,
          type,        // 🟢 타입 전달
          inquiry_id   // 🟢 ID 전달
        })
      }).catch(err => console.error('⚠️ Failed to trigger email API:', err));
    }

  } catch (error) {
    console.error('❌ Failed to send notification:', error);
  }
};