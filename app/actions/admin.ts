'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/app/utils/supabase/admin';

// 🔒 관리자 권한 확인 (재사용 함수)
async function getAdminClient() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // 관리자 권한 체크: profiles 테이블 우선 확인 후 users 테이블 확인
  let isAdmin = false;
  
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role === 'admin') isAdmin = true;
  
  if (!isAdmin) {
     const { data: userView } = await supabase.from('users').select('role').eq('id', user.id).single();
     if (userView?.role === 'admin') isAdmin = true;
  }

  if (!isAdmin) throw new Error('Forbidden: Admin access required');

  return supabase;
}

// ✅ 상태 변경 (승인/거절)
export async function updateAdminStatus(table: 'host_applications' | 'experiences', id: string, status: string, comment?: string) {
  await getAdminClient(); // 권한 체크
  const supabaseAdmin = createAdminClient();

  const updateData: any = { status };
  if (comment) updateData.admin_comment = comment;

  const { error } = await supabaseAdmin.from(table).update(updateData).eq('id', id);
  if (error) throw new Error(error.message);

  if (table === 'host_applications' && status === 'approved') {
    const { data: app } = await supabaseAdmin.from('host_applications').select('user_id').eq('id', id).single();
    if (app) {
      await supabaseAdmin.from('profiles').update({ role: 'host' }).eq('id', app.user_id);
    }
  }

  return { success: true };
}

// 🗑️ 데이터 삭제
export async function deleteAdminItem(table: string, id: string) {
  console.log(`[AdminAction] deleteAdminItem called for table: ${table}, id: ${id}`);

  try {
    // 1. 관리자 권한 체크
    console.log('[AdminAction] Verifying admin permissions...');
    await getAdminClient();
    console.log('[AdminAction] Permission verified.');

    // 2. Admin 클라이언트 생성
    console.log('[AdminAction] Creating admin client...');
    const supabaseAdmin = createAdminClient();
    console.log('[AdminAction] Admin client created successfully.');

    // 유저 프로필 삭제 시, Auth 계정도 함께 삭제 (완전 삭제)
    if (table === 'profiles' || table === 'users') {
      console.log('[AdminAction] Attempting to delete Auth user...');
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) {
        console.error('[AdminAction] Auth delete failed:', error);
        throw new Error(`Auth 삭제 실패: ${error.message}`);
      }
      console.log('[AdminAction] Auth user deleted successfully.');
      return { success: true };
    }

    // 일반 테이블 삭제
    console.log('[AdminAction] Deleting from table...');
    const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
    if (error) {
      console.error('[AdminAction] Table delete failed:', error);
      throw new Error(error.message);
    }
    console.log('[AdminAction] Item deleted successfully.');
    return { success: true };

  } catch (error: any) {
    console.error('[AdminAction] Critical Error:', error);
    throw new Error(`Server Error: ${error.message}`);
  }
}