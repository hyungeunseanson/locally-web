import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

export function teamError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function resolveTeamAdminContext() {
  const supabaseServer = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser();

  if (authError || !user) {
    return { response: teamError('Unauthorized', 401) } as const;
  }

  const supabaseAdmin = createAdminClient();
  const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
    userId: user.id,
    email: user.email,
  });

  if (!isAdmin) {
    return { response: teamError('Forbidden', 403) } as const;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[admin/team] profile fetch error:', profileError);
  }

  return {
    supabaseAdmin,
    user,
    authorName: profile?.full_name || user.email?.split('@')[0] || 'Admin',
  } as const;
}
