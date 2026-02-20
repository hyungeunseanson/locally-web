'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';

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
  const supabase = await getAdminClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
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

  // 🟢 로그 기록
  await recordAuditLog({
    admin_id: adminUser?.id,
    admin_email: adminUser?.email,
    action_type: `UPDATE_${table.toUpperCase()}_STATUS`,
    target_type: table,
    target_id: id,
    details: { new_status: status, comment }
  });

  return { success: true };
}

// 🗑️ 데이터 삭제 (Server Action)
export async function deleteAdminItem(table: string, id: string) {
  const supabase = await getAdminClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const supabaseAdmin = createAdminClient();

  if (table === 'profiles' || table === 'users') {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) {
      console.warn('Auth user deletion warning:', error.message);
    }
    
    await recordAuditLog({
      admin_id: adminUser?.id,
      admin_email: adminUser?.email,
      action_type: 'DELETE_USER_FULL',
      target_type: table,
      target_id: id
    });
    return { success: true };
  }

  const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);

  await recordAuditLog({
    admin_id: adminUser?.id,
    admin_email: adminUser?.email,
    action_type: 'DELETE_ITEM',
    target_type: table,
    target_id: id
  });

  return { success: true };
}
