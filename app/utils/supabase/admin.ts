import { createClient } from '@supabase/supabase-js';

// 🔒 서버 전용 클라이언트 생성 (클라이언트 컴포넌트 사용 금지)
export const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    // 키가 없으면 에러 대신 null을 반환하거나 안전한 깡통 클라이언트 반환
    // (클라이언트 환경에서 실수로 호출될 경우 방지)
    console.error('⚠️ [Server] Missing Service Role Key. Admin operations will fail.');
    throw new Error('Server configuration error'); 
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
 * 실패하더라도 에러를 던지지 않습니다 (Fail-Safe).
 */
export async function recordAuditLog({ admin_id, admin_email, action_type, target_type, target_id, details }: AuditLogParams) {
  try {
    const supabaseAdmin = createAdminClient();
    
    // 비동기로 처리하여 메인 로직 속도 저하 방지
    // await를 빼고 실행할 수도 있지만, Vercel Serverless 함수 종료 이슈 때문에 await 권장
    const { error } = await supabaseAdmin.from('admin_audit_logs').insert([{
      admin_id,
      admin_email,
      action_type,
      target_type,
      target_id,
      details: details || {}
    }]);
    
    if (error) {
      console.error('[AuditLog Warning] Insert failed:', error.message);
    } else {
      console.log(`[AuditLog] ${action_type} recorded.`);
    }
  } catch (err) {
    // ⚠️ 절대 에러를 밖으로 던지지 않음
    console.error('[AuditLog Error] Unexpected error:', err);
  }
}
