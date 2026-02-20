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

    // 유저 프로필 삭제 시, Auth 계정도 함께 삭제 (완전 삭제)
    if (table === 'profiles' || table === 'users') {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (authError) {
        console.error('Auth delete error:', authError);
        // 프로필만 있고 Auth가 없는 경우도 있으므로 에러 무시하고 진행할 수도 있으나, 일단 에러 반환
        return NextResponse.json({ error: `Auth 삭제 실패: ${authError.message}` }, { status: 500 });
      }
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
