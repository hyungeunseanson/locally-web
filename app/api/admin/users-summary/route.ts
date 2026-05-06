import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
  type AdminRawRow,
  isPresent,
  readStringField,
  toAdminRawRows,
} from '@/app/utils/adminRowHelpers';

const ADMIN_USERS_SUMMARY_SELECT = [
  'id',
  'full_name',
  'avatar_url',
  'email',
  'phone',
  'last_active_at',
  'created_at',
].join(', ');

type ProfileRow = {
  id: string;
  name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  nationality?: string | null;
  kakao_id?: string | null;
  mbti?: string | null;
  last_active_at?: string | null;
  created_at?: string | null;
  role?: string | null;
};

type UserRoleRow = {
  id: string;
  role: string | null;
};

type HostApplicationStatusRow = {
  user_id: string;
  status: string | null;
};

const USER_ROLE_BATCH_SIZE = 100;
const HOST_APPLICATION_BATCH_SIZE = 100;
const HOST_APPROVED_STATUSES = new Set(['approved', 'active']);

function chunkIds(ids: string[], size: number) {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

function normalizeProfileRow(row: AdminRawRow): ProfileRow | null {
  const id = readStringField(row, 'id');
  if (!id) {
    return null;
  }

  return {
    id,
    name: readStringField(row, 'name'),
    full_name: readStringField(row, 'full_name'),
    avatar_url: readStringField(row, 'avatar_url'),
    email: readStringField(row, 'email'),
    phone: readStringField(row, 'phone'),
    last_active_at: readStringField(row, 'last_active_at'),
    created_at: readStringField(row, 'created_at'),
    role: null,
  };
}

function normalizeUserRoleRow(row: AdminRawRow): UserRoleRow | null {
  const id = readStringField(row, 'id');
  if (!id) {
    return null;
  }

  return {
    id,
    role: readStringField(row, 'role'),
  };
}

function normalizeHostApplicationStatusRow(row: AdminRawRow): HostApplicationStatusRow | null {
  const userId = readStringField(row, 'user_id');
  if (!userId) {
    return null;
  }

  return {
    user_id: userId,
    status: readStringField(row, 'status'),
  };
}

function resolveDashboardRole(userRole: string | null, hostStatus: string | null) {
  if (userRole === 'admin') {
    return 'admin';
  }

  const normalizedHostStatus = hostStatus?.trim().toLowerCase() || null;
  if (normalizedHostStatus && HOST_APPROVED_STATUSES.has(normalizedHostStatus)) {
    return 'host';
  }

  if (userRole === 'host') {
    return 'host';
  }

  return userRole;
}

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
      .select(ADMIN_USERS_SUMMARY_SELECT)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (profilesError) {
      throw profilesError;
    }

    const profileRows = toAdminRawRows(profiles).map(normalizeProfileRow).filter(isPresent);
    const profileIds = profileRows.map((profile) => profile.id).filter(Boolean);

    const roleMap = new Map<string, string | null>();
    const hostStatusMap = new Map<string, string | null>();

    if (profileIds.length > 0) {
      const [userRoleChunks, hostApplicationChunks] = await Promise.all([
        Promise.all(
          chunkIds(profileIds, USER_ROLE_BATCH_SIZE).map(async (batchIds) => {
            const { data: userRows, error: usersError } = await supabaseAdmin
              .from('users')
              .select('id, role')
              .in('id', batchIds);

            if (usersError) throw usersError;
            return toAdminRawRows(userRows).map(normalizeUserRoleRow).filter(isPresent);
          })
        ),
        Promise.all(
          chunkIds(profileIds, HOST_APPLICATION_BATCH_SIZE).map(async (batchIds) => {
            const { data: hostApplicationRows, error: hostApplicationsError } = await supabaseAdmin
              .from('public_host_applications')
              .select('user_id, status')
              .in('user_id', batchIds);

            if (hostApplicationsError) throw hostApplicationsError;
            return toAdminRawRows(hostApplicationRows).map(normalizeHostApplicationStatusRow).filter(isPresent);
          })
        ),
      ]);

      userRoleChunks.flat().forEach((userRow) => {
        roleMap.set(userRow.id, userRow.role);
      });

      hostApplicationChunks.flat().forEach((hostApplicationRow) => {
        hostStatusMap.set(hostApplicationRow.user_id, hostApplicationRow.status);
      });
    }

    const mergedProfiles = profileRows.map((profile) => ({
      ...profile,
      name: profile.name ?? profile.full_name ?? null,
      role: resolveDashboardRole(roleMap.get(profile.id) ?? null, hostStatusMap.get(profile.id) ?? null),
    }));

    return NextResponse.json({ success: true, data: mergedProfiles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/users-summary error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
