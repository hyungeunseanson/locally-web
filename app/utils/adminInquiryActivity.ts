import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminInquiryActivity = {
  inquiry_id: number | string;
  status: string | null;
  updated_at: string | null;
  last_message_at: string | null;
  last_sender_role: 'customer' | 'host' | 'admin' | null;
  last_message_content: string | null;
  needs_reply: boolean;
  reply_waiting_since: string | null;
  support_reopened_at: string | null;
  admin_unread_count: number;
};

export async function getAdminInquiryActivity(client: SupabaseClient, ids: (number | string)[]) {
  if (!ids.length) return new Map<string, AdminInquiryActivity>();
  const { data, error } = await client.rpc('get_admin_inquiry_activity', { p_inquiry_ids: ids });
  if (error) throw new Error('문의 활동 정보를 불러오지 못했습니다.');
  return new Map((data as AdminInquiryActivity[] ?? []).map(row => [String(row.inquiry_id), row]));
}
