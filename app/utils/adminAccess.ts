import type { SupabaseClient } from '@supabase/supabase-js';

type AdminAccessParams = {
  userId: string;
  email?: string | null;
};

type AdminAccessResult = {
  isAdmin: boolean;
  userRole: string | null;
  isWhitelisted: boolean;
};

// Admin auth source is users.role with admin_whitelist as the exception path.
export async function resolveAdminAccess(
  supabase: SupabaseClient,
  { userId, email }: AdminAccessParams
): Promise<AdminAccessResult> {
  // [Security] email 없으면 whitelist 쿼리 자체를 건너뜀
  // — email=''로 쿼리 시 admin_whitelist에 빈 이메일 행이 있으면 무조건 어드민이 되는 버그 방지
  const [userEntry, whitelistEntry] = await Promise.all([
    supabase.from('users').select('role').eq('id', userId).maybeSingle(),
    email
      ? supabase.from('admin_whitelist').select('id').eq('email', email).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const userRole = typeof userEntry.data?.role === 'string' ? userEntry.data.role : null;
  const isWhitelisted = Boolean(whitelistEntry.data);

  return {
    isAdmin: userRole === 'admin' || isWhitelisted,
    userRole,
    isWhitelisted,
  };
}
