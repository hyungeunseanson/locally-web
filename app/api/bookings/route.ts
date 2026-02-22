import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

export async function POST(request: Request) {
    try {
        // 1. 세션 확인 (호출자 인증)
        const supabaseServer = await createServerClient();
        const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            experienceId, date, time, guests, isPrivate,
            customerName, customerPhone, paymentMethod
        } = body;

        // 파라미터 유효성 검사
        if (!experienceId || !date || !time || !guests || !customerName || !customerPhone) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 2. 관리자 권한 클라이언트 생성 (DB 제어용)
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

        // 3. 체험 정보(가격, 정원 등) DB에서 서버 사이드 조회 (조작 방지)
        const { data: experience, error: expError } = await supabaseAdmin
            .from('experiences')
            .select('id, title, host_id, price, private_price, max_guests')
            .eq('id', experienceId)
            .maybeSingle(); // 🟢 docs/gemini.md Rule 1. 안전한 단일 조회

        if (expError || !experience) {
            return NextResponse.json({ success: false, error: 'Experience not found' }, { status: 404 });
        }

        // 4. 가격 계산 (서버 주도)
        const guestCount = Number(guests);
        const expPrice = Number(experience.price);
        const hostPrice = isPrivate ? Number(experience.private_price) : expPrice * guestCount;
        const guestFee = Math.floor(hostPrice * 0.1); // 수수료 10%
        const finalAmount = hostPrice + guestFee; // 🟢 결제할 찐 금액

        // 5. 초과 예약 검증 (서버 주도)
        const { data: existingBookings } = await supabaseAdmin
            .from('bookings')
            .select('guests, type')
            .eq('experience_id', experienceId)
            .eq('date', date)
            .eq('time', time)
            .in('status', ['PAID', 'confirmed']);

        const currentBookedCount = existingBookings?.reduce((sum, b) => sum + (b.guests || 0), 0) || 0;
        const hasPrivateBooking = existingBookings?.some(b => b.type === 'private');
        const maxGuests = experience.max_guests || 10;

        if (
            hasPrivateBooking ||
            (isPrivate && currentBookedCount > 0) ||
            (!isPrivate && (currentBookedCount + guestCount > maxGuests))
        ) {
            return NextResponse.json({ success: false, error: '해당 시간대에 남은 좌석이 부족합니다.' }, { status: 409 });
        }

        // 6. 트랜잭션: 중복 가능성 차단을 위해 랜덤 오더 ID 생성 및 예약 삽입
        const newOrderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const { error: bookingError } = await supabaseAdmin.from('bookings').insert([
            {
                id: newOrderId,
                order_id: newOrderId,
                user_id: user.id, // 인증된 유저의 ID
                experience_id: experienceId,
                amount: finalAmount,
                total_price: hostPrice,
                status: 'PENDING',
                guests: guestCount,
                date: date,
                time: time,
                type: isPrivate ? 'private' : 'group',
                contact_name: customerName,
                contact_phone: customerPhone,
                message: '', // 초기화
                created_at: new Date().toISOString()
            }
        ]);

        if (bookingError) throw bookingError;

        // 7. 호스트 알림 발송 (클라이언트 인젝션 완벽 차단)
        // - 에러가 나더라도 예약 진행을 막지 않도록 비동기로 별도 에러 로깅만 처리
        if (experience.host_id) {
            const isPending = paymentMethod === 'bank';
            const notiTitle = isPending ? '⏳ 새로운 예약 (입금 대기)' : '🎉 새로운 예약 (결제 진행중)';
            const notiMsg = isPending
                ? `'${experience.title}'에 무통장 입금 대기 중인 예약이 접수되었습니다.`
                : `'${experience.title}'에 새로운 결제가 진행되고 있습니다!`;

            supabaseAdmin.from('notifications').insert({
                user_id: experience.host_id,
                type: 'new_booking',
                title: notiTitle,
                message: notiMsg,
                link: '/host/dashboard',
                is_read: false
            }).then(({ error }) => {
                if (error) console.error('Host Notification Error:', error);
            });
        }

        // 8. 성공 시 생성된 OrderId 및 검증된 최종 금액 반환
        return NextResponse.json({ success: true, newOrderId, finalAmount });

    } catch (error: any) {
        console.error('API Booking Transaction Error:', error);
        return NextResponse.json({ success: false, error: '예약 처리 중 서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
