import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

type ProfileRow = {
  id: string;
  role?: string | null;
  [key: string]: unknown;
};

type UserRoleRow = {
  id: string;
  role: string | null;
};

export async function GET() {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (profilesError) {
      throw profilesError;
    }

    const profileRows = (profiles || []) as ProfileRow[];
    const profileIds = profileRows.map((profile) => profile.id).filter(Boolean);

    const roleMap = new Map<string, string | null>();

    if (profileIds.length > 0) {
      const { data: userRows, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .in('id', profileIds);

      if (usersError) {
        throw usersError;
      }

      ((userRows || []) as UserRoleRow[]).forEach((userRow) => {
        roleMap.set(userRow.id, userRow.role);
      });
    }

    const mergedProfiles = profileRows.map((profile) => ({
      ...profile,
      role: roleMap.get(profile.id) ?? null,
    }));

    return NextResponse.json({ success: true, data: mergedProfiles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/users-summary error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
