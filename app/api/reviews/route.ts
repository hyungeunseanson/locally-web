import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { NextResponse } from 'next/server';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { syncReviewAggregates } from '@/app/utils/reviews/reviewAggregates';

function parseReviewRating(value: unknown) {
  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(normalized)) return null;
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

    // 🟢 [보안 핵심] 예약 유효성 검증 (Status Check & Ownership Check)
    const { data: booking } = await supabase
      .from('bookings')
      .select('status, user_id, experience_id')
      .eq('id', normalizedBookingId)
      .maybeSingle();

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

    // 🟢 [중복 방지] 이미 작성된 후기가 있는지 확인
    const { count: existingReviewCount } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', normalizedBookingId);

    if (existingReviewCount && existingReviewCount > 0) {
      return NextResponse.json({ error: '이미 후기를 작성하셨습니다.' }, { status: 409 });
    }

    // [R1] 체험 정보 조회 (호스트 알림 + R6 프로필 집계용)
    const { data: experience } = await supabase
      .from('experiences')
      .select('host_id, title')
      .eq('id', booking.experience_id)
      .maybeSingle();

    // 3. 후기 저장 (Insert)
    const { error: insertError } = await supabase.from('reviews').insert({
      user_id: user.id,
      experience_id: booking.experience_id,
      booking_id: normalizedBookingId,
      rating: normalizedRating,
      content: normalizedContent,
      photos: [],
      created_at: new Date().toISOString()
    });

    if (insertError) throw insertError;

    const supabaseAdmin = createAdminClient();
    await syncReviewAggregates({
      experienceId: booking.experience_id,
      hostId: experience?.host_id ?? null,
      supabaseAdmin,
    });

    // [R1] 호스트에게 새 후기 알림 발송
    if (experience?.host_id) {
      const notificationRow = await buildLocalizedNotificationInsert({
        supabaseAdmin,
        userId: experience.host_id,
        type: 'new_review',
        link: '/host/dashboard?tab=reviews',
        key: 'review.new.host',
        copyParams: {
          experienceTitle: experience.title || 'Locally Experience',
        },
      });
      const { error: notificationError } = await supabaseAdmin.from('notifications').insert(notificationRow);
      if (notificationError) {
        console.error('Review host notification error:', notificationError);
      }

      sendImmediateGenericEmail({
        recipientUserId: experience.host_id,
        subject: '',
        title: '',
        message: '',
        templatedEmail: {
          templateId: 'review.new_host',
          audience: 'host',
          payload: {
            experienceTitle: experience.title || 'Locally Experience',
            ctaUrl: '/host/dashboard?tab=reviews',
          },
        },
      }).catch((emailError) => {
        console.error('Review host email error:', emailError);
      });
    }

    if (experience?.title) {
      try {
        await insertAdminAlerts({
          title: '새 후기가 등록되었습니다',
          message: `'${experience.title}' 체험에 새 후기가 작성되었습니다.`,
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
