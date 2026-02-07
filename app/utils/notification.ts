import { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType = 
  | 'booking_request' 
  | 'booking_confirmed' 
  | 'booking_cancelled' 
  | 'cancellation_requested'
  | 'cancellation_approved'
  | 'new_message' 
  | 'admin_alert';

interface SendNotificationParams {
  supabase: SupabaseClient;
  userId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export const sendNotification = async ({
  supabase,
  userId,
  senderId,
  type,
  title,
  message,
  link
}: SendNotificationParams) => {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      sender_id: senderId,
      type,
      title,
      message,
      link,
      is_read: false
    });

    if (error) throw error;
    console.log(`🔔 Notification sent to ${userId}`);
  } catch (error) {
    console.error('❌ Failed to send notification:', error);
  }
};