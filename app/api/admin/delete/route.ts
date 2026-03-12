import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, id } = body;

    if (!table || !id) {
      return NextResponse.json({ error: 'Missing table or id' }, { status: 400 });
    }

    const supabaseAuth = await createServerClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user: adminUser }, error: authError } = await supabaseAuth.auth.getUser();

    console.log('[AdminDelete] auth user:', adminUser);
    console.log('[AdminDelete] auth user id:', adminUser?.id ?? null);
    console.log('[AdminDelete] auth user email:', adminUser?.email ?? null);
    if (authError) {
      console.log('[AdminDelete] auth error:', {
        message: authError.message,
        status: authError.status,
        code: authError.code,
      });
    }

    if (authError || !adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 🚨 [보안 패치] 관리자 권한 확인 (Role or Whitelist)
    const [userEntry, whitelistEntry] = await Promise.all([
      supabaseAdmin.from('profiles').select('role').eq('id', adminUser.id).maybeSingle(),
      supabaseAdmin.from('admin_whitelist').select('id').eq('email', adminUser.email || '').maybeSingle()
    ]);

    console.log('[AdminDelete] profiles query result:', {
      data: userEntry.data,
      error: userEntry.error ? {
        message: userEntry.error.message,
        code: userEntry.error.code,
        details: userEntry.error.details,
        hint: userEntry.error.hint,
      } : null,
    });
    console.log('[AdminDelete] whitelist query result:', {
      data: whitelistEntry.data,
      error: whitelistEntry.error ? {
        message: whitelistEntry.error.message,
        code: whitelistEntry.error.code,
        details: whitelistEntry.error.details,
        hint: whitelistEntry.error.hint,
      } : null,
    });

    const isAdmin = (userEntry.data?.role === 'admin') || !!whitelistEntry.data;

    console.log('[AdminDelete] final isAdmin:', isAdmin);

    if (!isAdmin) {
      console.error(`🚨 [Security Warning] Unauthorized Delete Attempt by ${adminUser.email}`);
      return NextResponse.json({ error: 'Forbidden: Admin Access Required' }, { status: 403 });
    }
    // 유저 프로필 삭제 시, 연관된 모든 데이터를 먼저 삭제 (FK 제약 조건 해결)
    if (table === 'profiles' || table === 'users') {
      try {
        console.log(`[AdminDelete] Starting cascade delete for user: ${id}`);
        
        // 🟢 삭제 전 유저 정보(이메일) 미리 확보 (로그용)
        const { data: targetProfile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', id).maybeSingle();
        const targetInfo = targetProfile ? `${targetProfile.email} (${targetProfile.full_name})` : '알 수 없는 유저';

        // 1. 호스트일 경우: 내가 만든 체험에 연결된 데이터 먼저 삭제
        const { data: myExperiences } = await supabaseAdmin.from('experiences').select('id').eq('host_id', id);
        if (myExperiences && myExperiences.length > 0) {
          const expIds = myExperiences.map(e => e.id);
          await Promise.all([
            supabaseAdmin.from('bookings').delete().in('experience_id', expIds),
            supabaseAdmin.from('reviews').delete().in('experience_id', expIds),
            supabaseAdmin.from('inquiries').delete().in('experience_id', expIds),
            supabaseAdmin.from('wishlists').delete().in('experience_id', expIds),
            supabaseAdmin.from('experience_availability').delete().in('experience_id', expIds),
          ]);
          await supabaseAdmin.from('experiences').delete().in('id', expIds);
        }

        // 2. 게스트로서 남긴 데이터 삭제
        await Promise.all([
          supabaseAdmin.from('inquiry_messages').delete().eq('sender_id', id),
          supabaseAdmin.from('inquiries').delete().or(`user_id.eq.${id},host_id.eq.${id}`),
          supabaseAdmin.from('guest_reviews').delete().or(`guest_id.eq.${id},host_id.eq.${id}`),
          supabaseAdmin.from('reviews').delete().eq('user_id', id),
          supabaseAdmin.from('bookings').delete().eq('user_id', id),
          supabaseAdmin.from('host_applications').delete().eq('user_id', id),
          supabaseAdmin.from('wishlists').delete().eq('user_id', id),
          supabaseAdmin.from('notifications').delete().eq('user_id', id),
        ]);
        
        // 3. 프로필 삭제
        await supabaseAdmin.from('profiles').delete().eq('id', id);

        // 4. Auth 계정 삭제
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) {
          console.warn('Auth user deletion warning (Zombie account):', authError.message);
        }
        
        // 🟢 삭제 성공 로그 기록 (유저 정보 포함)
        await recordAuditLog({
          admin_id: adminUser?.id,
          admin_email: adminUser?.email,
          action_type: 'DELETE_USER_FULL',
          target_type: table,
          target_id: id,
          details: { target_info: targetInfo, cascade: true }
        });

        return NextResponse.json({ success: true });

      } catch (cascadeError: unknown) {
        console.error('Cascade delete error:', cascadeError);
        const message = cascadeError instanceof Error ? cascadeError.message : '알 수 없는 오류';
        return NextResponse.json({ error: `삭제 처리 중 오류: ${message}` }, { status: 500 });
      }
    }

    // 일반 테이블 데이터 삭제 (체험 등) - 삭제 전 제목 확보 시도
    let targetName = id;
    if (table === 'experiences') {
        const { data: exp } = await supabaseAdmin.from('experiences').select('title').eq('id', id).maybeSingle();
        if (exp) targetName = exp.title;
    }

    const { error: dbError } = await supabaseAdmin.from(table).delete().eq('id', id);
    if (dbError) {
      console.error('DB delete error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // 🟢 일반 삭제 로그 기록 (제목/이름 포함)
    await recordAuditLog({
      admin_id: adminUser?.id,
      admin_email: adminUser?.email,
      action_type: 'DELETE_ITEM',
      target_type: table,
      target_id: id,
      details: { target_info: targetName }
    });

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    console.error('API Handler Error:', err);
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
