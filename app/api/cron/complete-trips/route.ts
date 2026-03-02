import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';

export async function GET(request: Request) {
    // [M-2] Auto Complete Scheduler
    // Secure this endpoint with a secret key
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const now = new Date().toISOString();

        // 1. 상태가 PAID 또는 confirmed 인 예약 중, 날짜/시간이 현재보다 과거인 예약 물색
        const { data: pastBookings, error } = await supabase
            .from('bookings')
            .select('id, date, time, user_id, experiences(title)')
            .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

        if (error) throw error;
        if (!pastBookings || pastBookings.length === 0) {
            return NextResponse.json({ message: 'No pending past bookings to complete' });
        }

        const bookingsToComplete = pastBookings.filter(b => {
            const expDateTime = new Date(`${b.date}T${b.time || '00:00'}`);
            return expDateTime < new Date(now);
        });

        const idsToComplete = bookingsToComplete.map(b => b.id);

        if (idsToComplete.length === 0) {
            return NextResponse.json({ message: 'No pending past bookings to complete' });
        }

        // 2. 일괄 업데이트 (Batch Update)
        const { error: updateError } = await supabase
            .from('bookings')
            .update({ status: 'completed' })
            .in('id', idsToComplete);

        if (updateError) throw updateError;

        console.log(`[CRON] Auto-completed ${idsToComplete.length} past bookings.`);

        // [R2] 완료된 예약 게스트에게 후기 작성 요청 알림 발송
        if (bookingsToComplete.length > 0) {
            const notifications = bookingsToComplete.map(b => {
                const exp = b.experiences as any;
                const expTitle = exp?.title || '체험';
                return {
                    user_id: b.user_id,
                    type: 'review_request',
                    title: '후기를 남겨주세요!',
                    message: `'${expTitle}' 어떠셨나요? 소중한 후기를 남겨주세요.`,
                    link: '/guest/trips',
                    is_read: false,
                    created_at: new Date().toISOString(),
                };
            });

            const { error: notifError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (notifError) {
                console.error('[CRON] Review request notification error:', notifError);
            } else {
                console.log(`[CRON] Sent ${notifications.length} review request notifications.`);
            }
        }

        return NextResponse.json({ success: true, count: idsToComplete.length, ids: idsToComplete });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        console.error('[CRON Complete] Error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
