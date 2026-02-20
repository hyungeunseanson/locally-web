import { createClient } from '@supabase/supabase-js';

export const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL or Service Role Key is missing.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

interface AuditLogParams {
  admin_id?: string;
  admin_email?: string;
  action_type: string;
  target_type: string;
  target_id: string;
  details?: any;
}

/**
 * 🔒 관리자 활동 로그를 기록합니다. (서버 전용)
 */
export async function recordAuditLog({ admin_id, admin_email, action_type, target_type, target_id, details }: AuditLogParams) {
  const supabaseAdmin = createAdminClient();
  
  try {
    const { error } = await supabaseAdmin.from('admin_audit_logs').insert([{
      admin_id,
      admin_email,
      action_type,
      target_type,
      target_id,
      details: details || {}
    }]);
    
    if (error) throw error;
    console.log(`[AuditLog] ${action_type} successfully recorded.`);
  } catch (err) {
    console.error('[AuditLog Error] Failed to write log:', err);
  }
}
