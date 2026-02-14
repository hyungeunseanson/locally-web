import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('🚨 [Cancel API] 3차 수정 버전 실행 (강제 취소 모드)');

  try {
    // 1. 필수 환경변수 확인
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('🔥 [Cancel API] 서비스 키 누락! Vercel 환경변수 확인 필요.');
      return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    // 2. 요청 데이터 파싱
    const { bookingId, reason } = await request.json();
    console.log(`🔍 [Cancel API] 요청 ID: ${bookingId}`);

    // 3. 관리자 권한 DB 접속
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 4. (중요) 기존 정보 조회 - 'tid' 컬럼이 없어도 에러 안 나게 특정 컬럼만 조회
    const { data: booking, error: dbError } = await supabase
      .from('bookings')
      .select('id, order_id, amount, status') // 🟢 tid 제외함 (DB에 없으므로)
      .eq('id', bookingId)
      .single();

    if (dbError || !booking) {
      console.error('🔥 [Cancel API] 예약 조회 실패:', dbError);
      return NextResponse.json({ error: '예약 정보 없음' }, { status: 404 });
    }

    // 5. 나이스페이 취소 로직은 'TID'가 있어야 가능한데, 
    // 현재 DB에 TID가 없으므로 PG사 취소는 건너뛰고 DB 상태만 바꿉니다.
    console.log('⚠️ [Cancel API] TID 없음. DB 상태만 강제로 취소 처리합니다.');

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled', 
        cancelled_at: new Date().toISOString() 
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('🔥 [Cancel API] DB 업데이트 실패:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log('✅ [Cancel API] 취소 처리 완료 (DB Only)');
    return NextResponse.json({ success: true, message: '취소 상태로 변경되었습니다.' });

  } catch (error: any) {
    console.error('🔥 [Cancel API] 시스템 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}