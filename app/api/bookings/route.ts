import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';

type BookingRequestBody = {
    experienceId?: string | number;
    date?: string;
    time?: string;
    guests?: number | string;
    isPrivate?: boolean;
    isSoloGuarantee?: boolean;
    customerName?: string;
    customerPhone?: string;
    paymentMethod?: 'card' | 'bank' | 'paypal';
};

type AtomicBookingResult = {
    new_order_id: string;
    final_amount: number;
    host_id: string | null;
    experience_title: string | null;
};

export async function POST(request: Request) {
    try {
        // 1. 세션 확인 (호출자 인증)
        const supabaseServer = await createServerClient();
        const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await request.json()) as BookingRequestBody;
        const {
            experienceId, date, time, guests, isPrivate,
            isSoloGuarantee, customerName, customerPhone, paymentMethod
        } = body;
        const guestCount = Number(guests);
        const normalizedExperienceId = experienceId != null ? String(experienceId) : '';
        const normalizedIsPrivate = Boolean(isPrivate);
        const normalizedIsSoloGuarantee = Boolean(isSoloGuarantee);

        // 파라미터 유효성 검사
        if (!normalizedExperienceId || !date || !time || !customerName || !customerPhone || !Number.isFinite(guestCount) || guestCount < 1) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        if (normalizedIsSoloGuarantee && (normalizedIsPrivate || guestCount !== 1)) {
            return NextResponse.json({ success: false, error: '1인 출발 확정 옵션은 1명 일반 예약에서만 사용할 수 있습니다.' }, { status: 400 });
        }

        // 2. 관리자 권한 클라이언트 생성 (DB 제어용)
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

        // 3. 예약 원자화 RPC 호출 (슬롯 잠금 + 검증 + 삽입)
        const { data: bookingData, error: bookingError } = await supabaseAdmin
            .rpc('create_booking_atomic', {
                p_user_id: user.id,
                p_experience_id: normalizedExperienceId,
                p_date: date,
                p_time: time,
                p_guests: guestCount,
                p_is_private: normalizedIsPrivate,
                p_customer_name: customerName,
                p_customer_phone: customerPhone,
                p_payment_method: paymentMethod || 'card',
                p_is_solo_guarantee: normalizedIsSoloGuarantee
            })
            .maybeSingle<AtomicBookingResult>();

        if (bookingError || !bookingData) {
            const errorMessage = bookingError?.message || '예약 처리 중 오류가 발생했습니다.';
            if (errorMessage.includes('BOOKING_CONFLICT')) {
                return NextResponse.json({ success: false, error: '해당 시간대에 남은 좌석이 부족합니다.' }, { status: 409 });
            }
            if (errorMessage.includes('BOOKING_NOT_FOUND')) {
                return NextResponse.json({ success: false, error: '체험 정보를 찾을 수 없습니다.' }, { status: 404 });
            }
            if (errorMessage.includes('BOOKING_BAD_REQUEST')) {
                return NextResponse.json({ success: false, error: '필수 입력값이 올바르지 않습니다.' }, { status: 400 });
            }
            if (errorMessage.includes('profiles') && bookingError?.code === '23503') {
                return NextResponse.json({ success: false, error: '계정 동기화가 진행 중입니다. 약 5초 후 결제를 다시 시도해주세요.' }, { status: 400 });
            }
            throw new Error(errorMessage);
        }

        const newOrderId = bookingData.new_order_id;
        const finalAmount = Number(bookingData.final_amount);
        const hostId = bookingData.host_id;
        const experienceTitle = bookingData.experience_title || 'Locally 체험';

        // 7. 호스트 알림 발송 (클라이언트 인젝션 완벽 차단)
        // - 에러가 나더라도 예약 진행을 막지 않도록 비동기로 별도 에러 로깅만 처리
        if (hostId) {
            const isPending = paymentMethod === 'bank';
            const notiTitle = isPending ? '⏳ 새로운 예약 (입금 대기)' : '🎉 새로운 예약 (결제 진행중)';
            const notiMsg = isPending
                ? `'${experienceTitle}'에 무통장 입금 대기 중인 예약이 접수되었습니다.`
                : `'${experienceTitle}'에 새로운 결제가 진행되고 있습니다!`;

            supabaseAdmin.from('notifications').insert({
                user_id: hostId,
                type: 'new_booking',
                title: notiTitle,
                message: notiMsg,
                link: '/host/dashboard',
                is_read: false
            }).then(({ error }) => {
                if (error) console.error('Host Notification Error:', error);
            });
        }

        insertAdminAlerts({
            title: paymentMethod === 'bank' ? '새 예약이 접수되었습니다 (입금 대기)' : '새 예약이 생성되었습니다',
            message: `'${experienceTitle}' 예약이 ${paymentMethod === 'bank' ? '무통장 입금 대기 상태로' : '결제 진행 상태로'} 생성되었습니다.`,
            link: '/admin/dashboard?tab=LEDGER',
        }).catch((adminAlertError) => {
            console.error('Booking Admin Alert Error:', adminAlertError);
        });

        // 8. 성공 시 생성된 OrderId 및 검증된 최종 금액 반환
        return NextResponse.json({ success: true, newOrderId, finalAmount });

    } catch (error: unknown) {
        console.error('API Booking Transaction Error:', error);
        return NextResponse.json({ success: false, error: '예약 처리 중 서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
