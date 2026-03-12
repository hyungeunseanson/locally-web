import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

type MarkServicePayoutsBody = {
  bookingIds?: string[];
};

const ELIGIBLE_SERVICE_PAYOUT_STATUSES = ['PAID', 'confirmed', 'completed'];

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as MarkServicePayoutsBody;
    const bookingIds = Array.from(new Set((body.bookingIds || []).filter(Boolean)));

    if (bookingIds.length === 0) {
      return NextResponse.json({ success: false, error: '정산 처리할 예약이 없습니다.' }, { status: 400 });
    }

    const { data: targetBookings, error: fetchError } = await supabaseAdmin
      .from('service_bookings')
      .select('id, order_id, status, payout_status, host_id')
      .in('id', bookingIds);

    if (fetchError) {
      throw fetchError;
    }

    if (!targetBookings || targetBookings.length !== bookingIds.length) {
      return NextResponse.json({ success: false, error: '일부 서비스 예약을 찾을 수 없습니다.' }, { status: 404 });
    }

    const invalidBookings = targetBookings.filter((booking) => {
      if (!booking.host_id) return true;
      if (booking.payout_status === 'paid') return true;
      return !ELIGIBLE_SERVICE_PAYOUT_STATUSES.includes(booking.status);
    });

    if (invalidBookings.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '정산 완료 처리할 수 없는 예약이 포함되어 있습니다.',
          invalidIds: invalidBookings.map((booking) => booking.id),
        },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('service_bookings')
      .update({ payout_status: 'paid' })
      .in('id', bookingIds);

    if (updateError) {
      throw updateError;
    }

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_SERVICE_PAYOUT_MARK_PAID',
      target_type: 'service_bookings',
      target_id: bookingIds.length === 1 ? bookingIds[0] : 'MULTIPLE',
      details: {
        booking_ids: bookingIds,
        order_ids: targetBookings.map((booking) => booking.order_id),
        count: bookingIds.length,
      },
    });

    return NextResponse.json({ success: true, updatedCount: bookingIds.length });
  } catch (error: unknown) {
    console.error('[ADMIN] service-payouts/mark-paid error:', error);
    const message = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
