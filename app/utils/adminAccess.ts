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
  const [userEntry, whitelistEntry] = await Promise.all([
    supabase.from('users').select('role').eq('id', userId).maybeSingle(),
    supabase.from('admin_whitelist').select('id').eq('email', email || '').maybeSingle(),
  ]);

  const userRole = typeof userEntry.data?.role === 'string' ? userEntry.data.role : null;
  const isWhitelisted = Boolean(whitelistEntry.data);

  return {
    isAdmin: userRole === 'admin' || isWhitelisted,
    userRole,
    isWhitelisted,
  };
}
