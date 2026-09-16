import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { NextResponse } from 'next/server';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { isBookingReviewEligible } from '@/app/utils/reviews/reviewEligibility';

type BookingExperience = {
  duration?: number | string | null;
  host_id?: string | null;
  title?: string | null;
};

type CreateExperienceReviewAtomicRow = {
  outcome?: unknown;
  review_id?: unknown;
  experience_id?: unknown;
  host_id?: unknown;
  experience_title?: unknown;
};

function getExperience(
  relation: BookingExperience | BookingExperience[] | null | undefined
) {
  return Array.isArray(relation) ? relation[0] ?? null : relation ?? null;
}

function parseReviewRating(value: unknown) {
  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(normalized)) return null;
  if (!Number.isInteger(normalized)) return null;
  if (normalized < 1 || normalized > 5) return null;
  return normalized;
}

function normalizeReviewContent(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    // 1. 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { experienceId, bookingId, rating, content } = body;
    const normalizedExperienceId = Number(experienceId);
    const normalizedBookingId = typeof bookingId === 'string' ? bookingId.trim() : '';
    const normalizedRating = parseReviewRating(rating);
    const normalizedContent = normalizeReviewContent(content);

    // 2. 필수 값 체크
    if (!Number.isInteger(normalizedExperienceId) || normalizedExperienceId <= 0 || !normalizedBookingId) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }
    if (normalizedRating === null) {
      return NextResponse.json({ error: '평점은 1점부터 5점까지 입력해주세요.' }, { status: 400 });
    }
    if (normalizedContent.length < 10) {
      return NextResponse.json({ error: '후기는 10자 이상 작성해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('status, user_id, experience_id, date, time, experiences!inner(duration, host_id, title)')
      .eq('id', normalizedBookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    if (!booking) {
      return NextResponse.json({ error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (booking.user_id !== user.id) {
      return NextResponse.json({ error: '본인의 예약에만 후기를 작성할 수 있습니다.' }, { status: 403 });
    }

    if (booking.status !== 'completed') {
      return NextResponse.json({ error: '체험 완료(completed) 상태일 때만 후기를 작성할 수 있습니다.' }, { status: 400 });
    }
    if (booking.experience_id !== normalizedExperienceId) {
      return NextResponse.json({ error: '예약 정보와 일치하지 않는 체험입니다.' }, { status: 400 });
    }

    const experience = getExperience(booking.experiences as BookingExperience | BookingExperience[] | null);
    if (!isBookingReviewEligible({
      date: booking.date,
      time: booking.time,
      duration: experience?.duration,
    })) {
      return NextResponse.json({ error: '체험 예정 종료 후에 후기를 작성할 수 있습니다.' }, { status: 400 });
    }

    const { data: atomicData, error: atomicError } = await supabaseAdmin.rpc(
      'create_experience_review_atomic',
      {
        p_booking_id: normalizedBookingId,
        p_user_id: user.id,
        p_experience_id: normalizedExperienceId,
        p_rating: normalizedRating,
        p_content: normalizedContent,
      }
    );

    if (atomicError) {
      if ((atomicError as { code?: string }).code === '23505') {
        return NextResponse.json({ error: '이미 후기를 작성하셨습니다.' }, { status: 409 });
      }
      throw atomicError;
    }

    const atomicRow = (
      Array.isArray(atomicData) ? atomicData[0] : atomicData
    ) as CreateExperienceReviewAtomicRow | null;
    const outcome = typeof atomicRow?.outcome === 'string' ? atomicRow.outcome : '';

    if (outcome === 'duplicate') {
      return NextResponse.json({ error: '이미 후기를 작성하셨습니다.' }, { status: 409 });
    }
    if (outcome === 'not_found') {
      return NextResponse.json({ error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (outcome === 'forbidden') {
      return NextResponse.json({ error: '본인의 예약에만 후기를 작성할 수 있습니다.' }, { status: 403 });
    }
    if (outcome === 'invalid_status') {
      return NextResponse.json({ error: '체험 완료(completed) 상태일 때만 후기를 작성할 수 있습니다.' }, { status: 400 });
    }
    if (outcome === 'not_eligible') {
      return NextResponse.json({ error: '체험 예정 종료 후에 후기를 작성할 수 있습니다.' }, { status: 400 });
    }
    if (outcome === 'invalid_payload') {
      return NextResponse.json({ error: '후기 입력값을 확인해주세요.' }, { status: 400 });
    }
    if (outcome !== 'created') {
      throw new Error('Review RPC returned an invalid outcome.');
    }

    const hostId = typeof atomicRow?.host_id === 'string'
      ? atomicRow.host_id
      : experience?.host_id ?? null;
    const rawExperienceTitle = typeof atomicRow?.experience_title === 'string' && atomicRow.experience_title
      ? atomicRow.experience_title
      : experience?.title ?? null;
    const experienceTitle = rawExperienceTitle || 'Locally Experience';

    // [R1] 호스트에게 새 후기 알림 발송
    if (hostId) {
      try {
        const notificationRow = await buildLocalizedNotificationInsert({
          supabaseAdmin,
          userId: hostId,
          type: 'new_review',
          link: '/host/dashboard?tab=reviews',
          key: 'review.new.host',
          copyParams: { experienceTitle },
        });
        const { error: notificationError } = await supabaseAdmin.from('notifications').insert(notificationRow);
        if (notificationError) throw notificationError;
      } catch (notificationError) {
        console.error('Review host notification error:', notificationError);
      }

      try {
        await sendImmediateGenericEmail({
          recipientUserId: hostId,
          subject: '',
          title: '',
          message: '',
          templatedEmail: {
            templateId: 'review.new_host',
            audience: 'host',
            payload: {
              experienceTitle,
              ctaUrl: '/host/dashboard?tab=reviews',
            },
          },
        });
      } catch (emailError) {
        console.error('Review host email error:', emailError);
      }
    }

    if (rawExperienceTitle) {
      try {
        await insertAdminAlerts({
          title: '새 후기가 등록되었습니다',
          message: `'${rawExperienceTitle}' 체험에 새 후기가 작성되었습니다.`,
        });
      } catch (adminAlertError) {
        console.error('Review admin alert error:', adminAlertError);
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    console.error("Review Error:", err);
    const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
