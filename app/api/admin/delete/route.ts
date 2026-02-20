import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/app/utils/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, id } = body;

    if (!table || !id) {
      return NextResponse.json({ error: 'Missing table or id' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Server Config Error: Missing Supabase keys');
      return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = request.headers.get('Authorization');
    const { data: { user: adminUser } } = await supabaseAdmin.auth.getUser(authHeader?.split('Bearer ')[1]);

    // 유저 프로필 삭제 시, 연관된 모든 데이터를 먼저 삭제 (FK 제약 조건 해결)
    if (table === 'profiles' || table === 'users') {
      try {
        console.log(`[AdminDelete] Starting cascade delete for user: ${id}`);
        
        // 🟢 삭제 전 유저 정보(이메일) 미리 확보 (로그용)
        const { data: targetProfile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', id).single();
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

      } catch (cascadeError: any) {
        console.error('Cascade delete error:', cascadeError);
        return NextResponse.json({ error: `삭제 처리 중 오류: ${cascadeError.message}` }, { status: 500 });
      }
    }

    // 일반 테이블 데이터 삭제 (체험 등) - 삭제 전 제목 확보 시도
    let targetName = id;
    if (table === 'experiences') {
        const { data: exp } = await supabaseAdmin.from('experiences').select('title').eq('id', id).single();
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

  } catch (err: any) {
    console.error('API Handler Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
