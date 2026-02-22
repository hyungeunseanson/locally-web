import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
            .select('id, date, time')
            .in('status', ['PAID', 'confirmed']);

        if (error) throw error;
        if (!pastBookings || pastBookings.length === 0) {
            return NextResponse.json({ message: 'No pending past bookings to complete' });
        }

        const idsToComplete = pastBookings
            .filter(b => {
                const expDateTime = new Date(`${b.date}T${b.time || '00:00'}`);
                return expDateTime < new Date(now);
            })
            .map(b => b.id);

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

        return NextResponse.json({ success: true, count: idsToComplete.length, ids: idsToComplete });
    } catch (err: any) {
        console.error('[CRON Complete] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
