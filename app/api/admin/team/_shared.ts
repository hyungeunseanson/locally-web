import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

// Legacy team-chat quarantine ID kept only to exclude historical chat rows
// from current Team Workspace retention/count calculations.
export const TEAM_CHAT_ROOM_ID = '00000000-0000-0000-0000-000000000000';

export function createTeamRequestId(scope: string) {
  const nonce = Math.random().toString(36).slice(2, 8);
  return `team-${scope}-${Date.now().toString(36)}-${nonce}`;
}

export function teamError(message: string, status: number, requestId?: string) {
  return NextResponse.json({ success: false, error: message, requestId: requestId ?? null }, { status });
}

export async function resolveTeamAdminContext(
  routeName = 'shared',
  requestId = createTeamRequestId('shared')
) {
  const supabaseServer = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser();

  if (authError || !user) {
    console.error(`[admin/team/${routeName}][${requestId}] auth failed:`, authError);
    return { response: teamError('Unauthorized', 401, requestId) } as const;
  }

  const supabaseAdmin = createAdminClient();
  const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
    userId: user.id,
    email: user.email,
  });

  if (!isAdmin) {
    console.error(`[admin/team/${routeName}][${requestId}] forbidden for user ${user.id}`);
    return { response: teamError('Forbidden', 403, requestId) } as const;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error(`[admin/team/${routeName}][${requestId}] profile fetch error:`, profileError);
  }

  return {
    supabaseAdmin,
    user,
    authorName: profile?.full_name || user.email?.split('@')[0] || 'Admin',
  } as const;
}
