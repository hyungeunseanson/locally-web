import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

    // Admin 클라이언트 생성
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 유저 프로필 삭제 시, 연관된 모든 데이터를 먼저 삭제 (FK 제약 조건 해결)
    if (table === 'profiles' || table === 'users') {
      console.log(`[AdminDelete] Starting cascade delete for user: ${id}`);
      
      // 1. 참조하는 테이블들 데이터 먼저 삭제
      // (순서 중요: 자식 테이블 -> 부모 테이블)
      await supabaseAdmin.from('inquiry_messages').delete().eq('sender_id', id);
      await supabaseAdmin.from('inquiries').delete().or(`user_id.eq.${id},host_id.eq.${id}`);
      await supabaseAdmin.from('guest_reviews').delete().or(`guest_id.eq.${id},host_id.eq.${id}`);
      await supabaseAdmin.from('reviews').delete().eq('user_id', id);
      await supabaseAdmin.from('bookings').delete().eq('user_id', id);
      await supabaseAdmin.from('host_applications').delete().eq('user_id', id);
      await supabaseAdmin.from('experiences').delete().eq('host_id', id);
      await supabaseAdmin.from('wishlists').delete().eq('user_id', id);
      await supabaseAdmin.from('notifications').delete().eq('user_id', id);
      
      // 2. 프로필 삭제
      await supabaseAdmin.from('profiles').delete().eq('id', id);

      // 3. Auth 계정 삭제
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (authError) {
        console.error('Auth delete error:', authError);
        return NextResponse.json({ error: `Auth 삭제 실패: ${authError.message}` }, { status: 500 });
      }
      
      return NextResponse.json({ success: true });
    }

    // 일반 테이블 데이터 삭제
    const { error: dbError } = await supabaseAdmin.from(table).delete().eq('id', id);
    if (dbError) {
      console.error('DB delete error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('API Handler Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
