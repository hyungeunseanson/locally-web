import { NextRequest, NextResponse } from 'next/server';

import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type GuestReviewBody = {
  bookingId?: unknown;
  rating?: unknown;
  content?: unknown;
};

type BookingOwnershipRow = {
  id: string | number;
  user_id: string | null;
  status: string;
  experiences:
    | { host_id: string | null; title: string | null }
    | { host_id: string | null; title: string | null }[]
    | null;
};

type CreateGuestReviewAtomicRow = {
  outcome?: unknown;
  review_id?: unknown;
  guest_id?: unknown;
  notification_created?: unknown;
};

function getExperience(relation: BookingOwnershipRow['experiences']) {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation ?? null;
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as GuestReviewBody;
    const bookingId = body.bookingId != null ? String(body.bookingId) : '';
    const content = asTrimmedString(body.content);
    const rating = Number(body.rating);

    if (
      !bookingId ||
      !content ||
      !Number.isFinite(rating) ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, status, experiences!inner(host_id, title)')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;
    if (!bookingData) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const booking = bookingData as BookingOwnershipRow;
    const experience = getExperience(booking.experiences);
    const hostId = experience?.host_id ?? null;

    if (hostId !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // [Guard] 완료된 예약에 대해서만 후기 작성 허용
    if (booking.status !== 'completed') {
      return NextResponse.json({ success: false, error: '완료된 예약에 대해서만 후기를 작성할 수 있습니다.' }, { status: 400 });
    }
    if (!booking.user_id) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const { data: existingReview, error: existingReviewError } = await supabaseAdmin
      .from('guest_reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('host_id', user.id)
      .maybeSingle();

    if (existingReviewError) throw existingReviewError;
    if (existingReview?.id) {
      return NextResponse.json({ success: false, error: 'Guest review already exists' }, { status: 409 });
    }

    const experienceTitle = experience?.title || 'Locally Experience';
    const localizedNotification = await buildLocalizedNotificationInsert({
      supabaseAdmin,
      userId: booking.user_id,
      type: 'guest_review_received',
      link: '/account',
      key: 'review.guest_received.guest',
      copyParams: { experienceTitle },
    });

    const { data: atomicData, error: atomicError } = await supabaseAdmin.rpc(
      'create_guest_review_with_notification_atomic',
      {
        p_booking_id: bookingId,
        p_host_id: user.id,
        p_rating: rating,
        p_content: content,
        p_notification_title: localizedNotification.title,
        p_notification_message: localizedNotification.message,
      }
    );

    if (atomicError) {
      if ((atomicError as { code?: string }).code === '23505') {
        return NextResponse.json({ success: false, error: 'Guest review already exists' }, { status: 409 });
      }
      throw atomicError;
    }

    const atomicRow = (
      Array.isArray(atomicData) ? atomicData[0] : atomicData
    ) as CreateGuestReviewAtomicRow | null;
    const outcome = typeof atomicRow?.outcome === 'string' ? atomicRow.outcome : '';

    if (outcome === 'duplicate') {
      return NextResponse.json({ success: false, error: 'Guest review already exists' }, { status: 409 });
    }
    if (outcome === 'not_found') {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }
    if (outcome === 'forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (outcome === 'invalid_status') {
      return NextResponse.json(
        { success: false, error: '완료된 예약에 대해서만 후기를 작성할 수 있습니다.' },
        { status: 400 }
      );
    }
    if (outcome === 'invalid_payload') {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    if (outcome !== 'created') {
      throw new Error('Guest review RPC returned an invalid outcome.');
    }

    const guestId =
      typeof atomicRow?.guest_id === 'string' && atomicRow.guest_id
        ? atomicRow.guest_id
        : booking.user_id;

    try {
      await sendImmediateGenericEmail({
        recipientUserId: guestId,
        templatedEmail: {
          templateId: 'notice.copy',
          audience: 'guest',
          payload: {
            copyKey: 'review.guest_received.guest',
            copyParams: { experienceTitle },
            ctaUrl: '/account',
          },
        },
      });
    } catch (emailError) {
      console.warn('Host guest review email failed after review save:', emailError);
    }

    return NextResponse.json({ success: true, guestId });
  } catch (error) {
    console.error('Host guest review route error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create guest review.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
