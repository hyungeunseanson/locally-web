'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';

// 🔒 관리자 권한 확인
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
          } catch { }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  let isAdmin = false;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role === 'admin') isAdmin = true;

  if (!isAdmin) {
    const { data: userView } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
    if (userView?.role === 'admin') isAdmin = true;
  }

  // 🟢 [추가] 화이트리스트 이메일 확인
  if (!isAdmin) {
    const { data: whitelist } = await supabase.from('admin_whitelist').select('id').eq('email', user.email).maybeSingle();
    if (whitelist) isAdmin = true;
  }

  if (!isAdmin) throw new Error('Forbidden: Admin access required');

  return supabase;
}

// ✅ 상태 변경 (승인/거절)
export async function updateAdminStatus(table: 'host_applications' | 'experiences', id: string, status: string, comment?: string) {
  const supabase = await getAdminClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const supabaseAdmin = createAdminClient();

  // 🟢 [추가] 기록 전 대상 이름(제목/호스트명) 가져오기
  let targetTitle = id;
  try {
    if (table === 'experiences') {
      const { data } = await supabaseAdmin.from('experiences').select('title').eq('id', id).maybeSingle();
      if (data) targetTitle = data.title;
    } else if (table === 'host_applications') {
      const { data } = await supabaseAdmin.from('host_applications').select('name').eq('id', id).maybeSingle();
      if (data) targetTitle = data.name;
    }
  } catch (e) { }

  const updateData: any = { status };
  if (comment) updateData.admin_comment = comment;

  const { error } = await supabaseAdmin.from(table).update(updateData).eq('id', id);
  if (error) throw new Error(error.message);

  if (table === 'host_applications' && status === 'approved') {
    const { data: app } = await supabaseAdmin.from('host_applications').select('user_id').eq('id', id).maybeSingle();
    if (app) {
      await supabaseAdmin.from('profiles').update({ role: 'host' }).eq('id', app.user_id);
    }
  }

  // 🟢 로그 기록 (상세 정보 보강)
  await recordAuditLog({
    admin_id: adminUser?.id,
    admin_email: adminUser?.email,
    action_type: `UPDATE_${table.toUpperCase()}_STATUS`,
    target_type: table,
    target_id: id,
    details: {
      target_info: targetTitle,
      new_status: status,
      comment
    }
  });

  return { success: true };
}

// 🗑️ 데이터 삭제 (Server Action 사용 시 대비 - 로직 일치화)
export async function deleteAdminItem(table: string, id: string) {
  const supabase = await getAdminClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const supabaseAdmin = createAdminClient();

  let targetInfo = id;
  try {
    if (table === 'profiles') {
      const { data } = await supabaseAdmin.from('profiles').select('email').eq('id', id).maybeSingle();
      if (data) targetInfo = data.email;
    } else if (table === 'experiences') {
      const { data } = await supabaseAdmin.from('experiences').select('title').eq('id', id).maybeSingle();
      if (data) targetInfo = data.title;
    }
  } catch (e) { }

  if (table === 'profiles' || table === 'users') {
    await supabaseAdmin.auth.admin.deleteUser(id);
    await recordAuditLog({
      admin_id: adminUser?.id,
      admin_email: adminUser?.email,
      action_type: 'DELETE_USER_FULL',
      target_type: table,
      target_id: id,
      details: { target_info: targetInfo }
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
    target_id: id,
    details: { target_info: targetInfo }
  });

  return { success: true };
}

// 💰 정산 완료 처리 (다중 Bookings 업데이트)
export async function settleHostPayout(bookingIds: string[]) {
  const supabase = await getAdminClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const supabaseAdmin = createAdminClient();

  if (!bookingIds || bookingIds.length === 0) return { success: false, error: 'No bookings provided' };

  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ payout_status: 'paid' })
    .in('id', bookingIds);

  if (error) throw new Error(error.message);

  await recordAuditLog({
    admin_id: adminUser?.id,
    admin_email: adminUser?.email,
    action_type: 'SETTLE_HOST_PAYOUT',
    target_type: 'bookings',
    target_id: bookingIds.length > 1 ? 'MULTIPLE' : bookingIds[0],
    details: { booking_ids: bookingIds }
  });

  return { success: true };
}
