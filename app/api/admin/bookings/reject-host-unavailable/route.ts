import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
  clearHostUnavailableReviewMarker,
  isHostUnavailableReviewPending,
} from '@/app/utils/hostUnavailableReview';

type RejectHostUnavailableBody = {
  bookingId?: string;
};

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

    const { bookingId } = (await request.json()) as RejectHostUnavailableBody;
    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'bookingId is required' }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        user_id,
        cancel_reason,
        experiences(host_id, title)
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!isHostUnavailableReviewPending(booking.cancel_reason)) {
      return NextResponse.json({ success: false, error: '호스트 진행 불가 검토 요청이 아닙니다.' }, { status: 409 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        cancel_reason: clearHostUnavailableReviewMarker(booking.cancel_reason),
      })
      .eq('id', bookingId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const experience = Array.isArray(booking.experiences) ? booking.experiences[0] : booking.experiences;
    const hostId = experience?.host_id || null;
    const expTitle = experience?.title || 'Locally 체험';

    try {
      const notifications = [];

      if (booking.user_id) {
        notifications.push({
          user_id: booking.user_id,
          type: 'cancellation',
          title: '호스트 진행 불가 취소 요청이 반려되었습니다.',
          message: `'${expTitle}' 예약은 유지되며, 필요 시 호스트와 직접 소통해주세요.`,
          link: '/guest/trips',
          is_read: false,
        });
      }

      if (hostId) {
        notifications.push({
          user_id: hostId,
          type: 'cancellation',
          title: '호스트 진행 불가 취소 요청이 반려되었습니다.',
          message: `'${expTitle}' 예약은 유지됩니다. 고객과 직접 소통해주세요.`,
          link: '/host/dashboard',
          is_read: false,
        });
      }

      if (notifications.length > 0) {
        await supabaseAdmin.from('notifications').insert(notifications);
      }
    } catch (notificationError) {
      console.error('[ADMIN] reject host unavailable side effect error:', notificationError);
    }

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_REJECT_HOST_UNAVAILABLE_CANCEL',
      target_type: 'booking',
      target_id: String(bookingId),
      details: {
        experience_title: expTitle,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Reject Error';
    console.error('[ADMIN] reject host unavailable error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

