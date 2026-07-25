import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type GuestReviewBody = {
  bookingId?: unknown;
  rating?: unknown;
  content?: unknown;
};

type BookingOwnershipRow = {
  id: string | number;
  user_id: string;
  status: string;
  experiences: { host_id: string | null } | { host_id: string | null }[] | null;
};

function getHostId(relation: BookingOwnershipRow['experiences']) {
  if (Array.isArray(relation)) return relation[0]?.host_id ?? null;
  return relation?.host_id ?? null;
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
      .select('id, user_id, status, experiences!inner(host_id)')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;
    if (!bookingData) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const booking = bookingData as BookingOwnershipRow;
    const hostId = getHostId(booking.experiences);

    if (hostId !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // [Guard] 완료된 예약에 대해서만 후기 작성 허용
    if (booking.status !== 'completed') {
      return NextResponse.json({ success: false, error: '완료된 예약에 대해서만 후기를 작성할 수 있습니다.' }, { status: 400 });
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

    const { error: insertError } = await supabaseAdmin
      .from('guest_reviews')
      .insert({
        booking_id: bookingId,
        host_id: user.id,
        guest_id: booking.user_id,
        rating,
        content,
      });

    if (insertError) {
      // [Race Guard] DB unique constraint(booking_id, host_id) 위반 → 중복 후기 차단
      if ((insertError as { code?: string }).code === '23505') {
        return NextResponse.json({ success: false, error: 'Guest review already exists' }, { status: 409 });
      }
      throw insertError;
    }

    return NextResponse.json({ success: true, guestId: booking.user_id });
  } catch (error) {
    console.error('Host guest review route error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create guest review.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
