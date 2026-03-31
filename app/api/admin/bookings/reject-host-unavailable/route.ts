import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
  clearBookingReviewMarker,
  getBookingReviewType,
  isBookingReviewPending,
} from '@/app/utils/hostUnavailableReview';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';

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

    const reviewType = getBookingReviewType(booking.cancel_reason);

    if (!isBookingReviewPending(booking.cancel_reason)) {
      return NextResponse.json({ success: false, error: '운영 검토 요청이 아닙니다.' }, { status: 409 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        cancel_reason: clearBookingReviewMarker(booking.cancel_reason),
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
        notifications.push(
          await buildLocalizedNotificationInsert({
            supabaseAdmin,
            userId: booking.user_id,
            type: 'cancellation',
            link: '/guest/trips',
            key: 'booking.review_rejected',
            copyParams: {
              experienceTitle: expTitle,
              reviewType: reviewType === 'minimum_participants_unmet' ? 'minimum_participants_unmet' : 'host_unavailable',
              recipient: 'guest',
            },
          })
        );
      }

      if (hostId) {
        notifications.push(
          await buildLocalizedNotificationInsert({
            supabaseAdmin,
            userId: hostId,
            type: 'cancellation',
            link: '/host/dashboard',
            key: 'booking.review_rejected',
            copyParams: {
              experienceTitle: expTitle,
              reviewType: reviewType === 'minimum_participants_unmet' ? 'minimum_participants_unmet' : 'host_unavailable',
              recipient: 'host',
            },
          })
        );
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
      action_type: reviewType === 'minimum_participants_unmet'
        ? 'ADMIN_REJECT_MINIMUM_PARTICIPANTS_CANCEL'
        : 'ADMIN_REJECT_HOST_UNAVAILABLE_CANCEL',
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
