import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { captureServerException } from '@/app/utils/monitoring/sentry';

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

type BookingErrorCode =
    | 'unauthorized'
    | 'missing_required_fields'
    | 'customer_name_too_long'
    | 'customer_phone_invalid'
    | 'solo_guarantee_invalid'
    | 'solo_guarantee_option_hidden'
    | 'invalid_payment_method'
    | 'max_guests_exceeded'
    | 'booking_conflict'
    | 'booking_pending_hold'
    | 'booking_not_found'
    | 'booking_bad_request'
    | 'solo_guarantee_unavailable_existing_booking'
    | 'profile_sync_in_progress'
    | 'server_error';

const FALLBACK_MAX_GUESTS = 10;

function createErrorResponse(status: number, errorCode: BookingErrorCode, error: string) {
    return NextResponse.json({ success: false, errorCode, error }, { status });
}

export async function POST(request: Request) {
    try {
        // 1. 세션 확인 (호출자 인증)
        const supabaseServer = await createServerClient();
        const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !user) {
            return createErrorResponse(401, 'unauthorized', 'Unauthorized');
        }

        const body = (await request.json()) as BookingRequestBody;
        const {
            experienceId, date, time, guests, isPrivate,
            isSoloGuarantee, customerName, customerPhone, paymentMethod
        } = body;
        const guestCount = Number(guests);
        const normalizedExperienceId = experienceId != null ? String(experienceId) : '';
        const normalizedTime = typeof time === 'string' ? time.slice(0, 5) : '';
        const normalizedIsPrivate = Boolean(isPrivate);
        const normalizedIsSoloGuarantee = Boolean(isSoloGuarantee);

        // 파라미터 유효성 검사
        if (!normalizedExperienceId || !date || !normalizedTime || !customerName || !customerPhone || !Number.isFinite(guestCount) || guestCount < 1) {
            return createErrorResponse(400, 'missing_required_fields', 'Missing required fields');
        }

        // [Security] customerName/customerPhone 길이 + 전화번호 형식 검증
        // — 무제한 입력 허용 시 DB 및 이메일 템플릿에 비정상 데이터 삽입 가능
        if (typeof customerName !== 'string' || customerName.trim().length > 100) {
            return createErrorResponse(400, 'customer_name_too_long', '이름은 100자 이하여야 합니다.');
        }
        if (typeof customerPhone !== 'string' || !/^[\d\s\-\+\(\)]{7,20}$/.test(customerPhone.trim())) {
            return createErrorResponse(400, 'customer_phone_invalid', '올바른 전화번호 형식이 아닙니다.');
        }

        if (normalizedIsSoloGuarantee && (normalizedIsPrivate || guestCount !== 1)) {
            return createErrorResponse(
                400,
                'solo_guarantee_invalid',
                '1인 출발 확정 옵션은 1명 일반 예약에서만 사용할 수 있습니다.'
            );
        }

        // [Guard] paymentMethod 런타임 허용값 검증
        const ALLOWED_PAYMENT_METHODS = new Set(['card', 'bank', 'paypal']);
        if (paymentMethod && !ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
            return createErrorResponse(400, 'invalid_payment_method', 'Invalid payment method');
        }

        // 2. 관리자 권한 클라이언트 생성 (DB 제어용)
        const supabaseAdmin = createAdminClient();

        const { data: experienceMeta, error: experienceLookupError } = await supabaseAdmin
            .from('experiences')
            .select('max_guests, solo_guarantee_option_visible')
            .eq('id', normalizedExperienceId)
            .maybeSingle();

        if (experienceLookupError) {
            console.warn('[api/bookings] experience max_guests precheck skipped:', experienceLookupError.message);
        } else if (experienceMeta) {
            const effectiveMaxGuests = Math.max(1, Number(experienceMeta.max_guests || FALLBACK_MAX_GUESTS));
            if (guestCount > effectiveMaxGuests) {
                return createErrorResponse(
                    400,
                    'max_guests_exceeded',
                    `최대 예약 가능 인원은 ${effectiveMaxGuests}명입니다.`
                );
            }

            if (normalizedIsSoloGuarantee && experienceMeta.solo_guarantee_option_visible === false) {
                return createErrorResponse(
                    400,
                    'solo_guarantee_option_hidden',
                    '이 체험에는 1인 출발 확정 옵션을 사용할 수 없습니다.'
                );
            }
        }

        // 3. 예약 원자화 RPC 호출 (슬롯 잠금 + 검증 + 삽입)
        // [Note] solo-guarantee 사전 DB 조회(TOCTOU 취약)는 제거. RPC가 atomic하게 동일 조건 검증함.
        const { data: bookingData, error: bookingError } = await supabaseAdmin
            .rpc('create_booking_atomic', {
                p_user_id: user.id,
                p_experience_id: normalizedExperienceId,
                p_date: date,
                p_time: normalizedTime,
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
                const { data: pendingHolds } = await supabaseAdmin
                    .from('bookings')
                    .select('id')
                    .eq('experience_id', normalizedExperienceId)
                    .eq('date', date)
                    .eq('time', normalizedTime)
                    .in('status', ['PENDING', 'pending'])
                    .limit(1);

                if (pendingHolds && pendingHolds.length > 0) {
                    return createErrorResponse(
                        409,
                        'booking_pending_hold',
                        '다른 결제 대기 예약이 좌석을 임시 보유 중입니다. 잠시 후 다시 시도해주세요.'
                    );
                }

                return createErrorResponse(409, 'booking_conflict', '해당 시간대에 남은 좌석이 부족합니다.');
            }
            if (errorMessage.includes('BOOKING_NOT_FOUND')) {
                return createErrorResponse(404, 'booking_not_found', '체험 정보를 찾을 수 없습니다.');
            }
            if (errorMessage.includes('BOOKING_BAD_REQUEST')) {
                if (errorMessage.includes('Solo guarantee is unavailable when confirmed bookings already exist')) {
                    return createErrorResponse(
                        400,
                        'solo_guarantee_unavailable_existing_booking',
                        '이미 확정된 예약이 있는 일정에는 1인 출발 확정 옵션을 사용할 수 없습니다.'
                    );
                }
                return createErrorResponse(400, 'booking_bad_request', '필수 입력값이 올바르지 않습니다.');
            }
            if (errorMessage.includes('profiles') && bookingError?.code === '23503') {
                return createErrorResponse(
                    400,
                    'profile_sync_in_progress',
                    '계정 동기화가 진행 중입니다. 약 5초 후 결제를 다시 시도해주세요.'
                );
            }
            throw new Error(errorMessage);
        }

        const newOrderId = bookingData.new_order_id;
        const finalAmount = Number(bookingData.final_amount);
        const hostId = bookingData.host_id;
        const experienceTitle = bookingData.experience_title || 'Locally 체험';
        const isBankTransferPending = paymentMethod === 'bank';

        // 7. 호스트 알림 발송 (클라이언트 인젝션 완벽 차단)
        // - 에러가 나더라도 예약 진행을 막지 않도록 비동기로 별도 에러 로깅만 처리
        if (hostId) {
            const guestUserId = user.id;
            (async () => {
                let guestDisplayName = customerName || '게스트';
                const { data: guestProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('full_name')
                    .eq('id', guestUserId)
                    .maybeSingle();
                if (guestProfile?.full_name) guestDisplayName = guestProfile.full_name;

                const notificationRow = await buildLocalizedNotificationInsert({
                    supabaseAdmin,
                    userId: hostId,
                    type: 'new_booking',
                    link: '/host/dashboard',
                    key: 'booking.new.host',
                    copyParams: {
                        experienceTitle,
                        guestName: guestDisplayName,
                        state: isBankTransferPending ? 'pending' : 'processing',
                    },
                });

                const { error } = await supabaseAdmin.from('notifications').insert(notificationRow);
                if (error) console.error('Host Notification Error:', error);
            })();
        }

        const adminAlertTitle = isBankTransferPending ? '새 예약이 접수되었습니다 (입금 대기)' : '새 예약이 생성되었습니다';
        const adminAlertMessage = `'${experienceTitle}' 예약이 ${isBankTransferPending ? '무통장 입금 대기 상태로' : '결제 진행 상태로'} 생성되었습니다.`;
        const adminAlertLink = '/admin/dashboard?tab=LEDGER';

        void (async () => {
            await insertAdminAlerts({
                title: adminAlertTitle,
                message: adminAlertMessage,
                link: adminAlertLink,
            });

            if (!isBankTransferPending) return;

            await sendAdminAlertEmails({
                subject: `[Locally Admin] ${adminAlertTitle}`,
                title: adminAlertTitle,
                message: `${adminAlertMessage}\n\nLEDGER 탭에서 예약을 확인해주세요.`,
                link: adminAlertLink,
                ctaLabel: '예약 보기',
            });
        })().catch((adminAlertError) => {
            console.error('Booking Admin Alert Error:', adminAlertError);
        });

        // 8. 성공 시 생성된 OrderId 및 검증된 최종 금액 반환
        return NextResponse.json({ success: true, newOrderId, finalAmount });

    } catch (error: unknown) {
        captureServerException(error, { route: '/api/bookings', method: 'POST' });
        console.error('API Booking Transaction Error:', error);
        return createErrorResponse(500, 'server_error', '예약 처리 중 서버 오류가 발생했습니다.');
    }
}
