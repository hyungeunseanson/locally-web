'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

  // DB에서 role 확인
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Forbidden: Admin access required');

  return supabase;
}

// ✅ 상태 변경 (승인/거절)
export async function updateAdminStatus(table: 'host_applications' | 'experiences', id: string, status: string, comment?: string) {
  const supabase = await getAdminClient();

  const updateData: any = { status };
  if (comment) updateData.admin_comment = comment;

  const { error } = await supabase.from(table).update(updateData).eq('id', id);
  if (error) throw new Error(error.message);

  // 호스트 승인 시 권한 부여
  if (table === 'host_applications' && status === 'approved') {
    const { data: app } = await supabase.from('host_applications').select('user_id').eq('id', id).single();
    if (app) {
      await supabase.from('users').update({ role: 'host' }).eq('id', app.user_id);
    }
  }

  return { success: true };
}

// 🗑️ 데이터 삭제
export async function deleteAdminItem(table: string, id: string) {
  const supabase = await getAdminClient();

  // 유저 프로필 삭제 시, Auth 계정도 함께 삭제 (완전 삭제)
  if (table === 'profiles' || table === 'users') {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw new Error(`Auth 삭제 실패: ${error.message}`);
    return { success: true };
  }

  // 일반 테이블 삭제
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}
