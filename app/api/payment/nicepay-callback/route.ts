import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // 나이스페이가 보내주는 결과 데이터들
    const resCode = formData.get('resCode'); // 결과 코드 (0000이면 성공)
    const amount = formData.get('amt');      // 결제 금액
    const orderId = formData.get('moid');    // 주문 번호
    const authDate = formData.get('authDate'); // 승인 일자
    const tid = formData.get('tid'); // 거래번호

    // 🟢 [중요] 체험 ID와 예약 날짜/시간 등은 결제 요청 시 'MallReserved' 등으로 넘기거나,
    // orderId를 통해 'pending' 상태인 예약을 조회해서 가져와야 합니다.
    // 여기서는 로직 연결을 위해 insert 부분에 포함된다고 가정합니다.
    const experienceId = formData.get('MallReserved'); // (예시) 나이스페이 사용자 필드 사용 시

    // 1. 결제 성공(0000) 확인
    if (resCode === '0000') {
      const cookieStore = await cookies(); // Next.js 15+ await 필수
      
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll() },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                )
              } catch {
                // Server Component에서 쿠키 설정 불가 에러 무시
              }
            },
          },
        }
      );
      
      // 현재 로그인한 유저 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // 2. Supabase 'bookings' 테이블에 예약 정보 저장
        // 🟢 [수정] .select()를 붙여서 저장된 데이터를 바로 받아옵니다.
        const { data: bookingData, error } = await supabase.from('bookings').insert([
          {
            user_id: user.id,
            amount: Number(amount),
            order_id: orderId as string,
            tid: tid as string,
            status: 'PAID', // 결제 완료
            // experience_id: experienceId, // ⚠️ 실제로는 이 값이 꼭 있어야 호스트를 찾을 수 있습니다!
            created_at: new Date().toISOString()
          }
        ]).select().single();

        if (error) {
          console.error('DB 저장 에러:', error);
        } else if (bookingData) {
          // 🚀 3. [추가됨] 호스트에게 알림 이메일 발송
          // 내부 API 라우트를 호출하여 이메일 전송 트리거
          const origin = new URL(request.url).origin;
          
          try {
            await fetch(`${origin}/api/notifications/email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'booking_created', // 알림 유형
                booking_id: bookingData.id, // 저장된 예약 ID
                user_name: user.email, // 게스트 정보 (이름이 있다면 이름으로)
                amount: amount
              })
            });
            console.log('📧 알림 이메일 요청 전송 완료');
          } catch (emailError) {
            console.error('📧 이메일 발송 실패:', emailError);
            // 이메일 실패해도 결제는 성공 처리 (비즈니스 로직에 따라 다름)
          }
        }
      }

      // 4. 성공 페이지로 이동
      return NextResponse.redirect(
        new URL(`/payment/success?orderId=${orderId}&amount=${amount}`, request.url), 
        303
      );
    } else {
      // 결제 실패 시
      return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
    }
  } catch (err) {
    console.error('콜백 처리 중 오류:', err);
    return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
  }
}