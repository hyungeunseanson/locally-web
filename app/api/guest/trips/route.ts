import { createClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import { isOverdueActiveBooking } from '@/app/utils/bookingStartTime';
import { getHostPublicProfile } from '@/app/utils/profile';
import { isUnapprovedCardPaymentAttempt } from '@/app/utils/bookings/pendingBookingHolds';

const GUEST_TRIPS_BOOKING_SELECT = `
  id,
  order_id,
  date,
  time,
  guests,
  amount,
  status,
  payment_method,
  tid,
  cancel_reason,
  solo_guarantee_refund_status,
  solo_guarantee_refund_amount,
  solo_guarantee_refunded_at,
  created_at,
  experiences (
    id,
    host_id,
    title,
    title_ko,
    title_en,
    title_ja,
    title_zh,
    image_url,
    photos,
    location,
    meeting_point,
    meeting_point_i18n
  ),
  reviews (id, rating, content, created_at)
`;

type HostProfileRow = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

type HostApplicationRow = {
  user_id: string;
  name?: string | null;
  profile_photo?: string | null;
};

type BookingExperienceRow = {
  id?: string | number | null;
  host_id?: string | null;
  title?: string | null;
  title_ko?: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  title_zh?: string | null;
  image_url?: string | null;
  photos?: string[] | null;
  location?: string | null;
  meeting_point?: string | null;
  meeting_point_i18n?: Record<string, string> | null;
};

function normalizeBookingExperience(
  experience: BookingExperienceRow | BookingExperienceRow[] | null | undefined
) {
  return Array.isArray(experience) ? experience[0] || null : experience || null;
}

export async function GET() {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. 게스트의 모든 예약 가져오기 (체험 정보 + 후기 정보 포함)
    // 🟢 bookings 테이블과 reviews 테이블을 join해서 후기 작성 여부 확인
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(GUEST_TRIPS_BOOKING_SELECT)
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) throw error;

    const hostIds = Array.from(
      new Set(
        (bookings || [])
          .map((booking) => normalizeBookingExperience(booking.experiences)?.host_id)
          .filter(Boolean)
      )
    ) as string[];

    const [hostProfilesRes, hostAppsRes] = hostIds.length > 0
      ? await Promise.all([
        supabase
          .from('public_profiles')
          .select('id, full_name, avatar_url')
          .in('id', hostIds),
        supabase
          .from('public_host_applications')
          .select('user_id, name, profile_photo')
          .in('user_id', hostIds),
      ])
      : [{ data: [], error: null }, { data: [], error: null }];

    if (hostProfilesRes.error) throw hostProfilesRes.error;
    if (hostAppsRes.error) throw hostAppsRes.error;

    const hostProfiles = (hostProfilesRes.data || []) as HostProfileRow[];
    const hostApplications = (hostAppsRes.data || []) as HostApplicationRow[];
    const hostProfileMap = new Map(hostProfiles.map((profile) => [profile.id, profile]));
    const hostApplicationMap = new Map(hostApplications.map((application) => [application.user_id, application]));

    const now = new Date();
    const updatedTrips = [];

    // 2. 데이터 가공 및 '자동 완료' 계산
    let syncCompletedNeeded = false;

    for (const booking of (bookings || []).filter(
      (row) => !isUnapprovedCardPaymentAttempt(row)
    )) {
      const experience = normalizeBookingExperience(booking.experiences);
      let status = booking.status;
      const hostPublicProfile = experience?.host_id
        ? getHostPublicProfile(
          hostProfileMap.get(String(experience.host_id)),
          hostApplicationMap.get(String(experience.host_id)),
          'Host'
        )
        : null;

      // 시간이 지난 활성 예약(PAID, confirmed)은 응답에서만 completed로 계산한다.
      // 실제 DB sync는 별도 POST /api/guest/trips/sync-completed 에서 처리한다.
      if (isOverdueActiveBooking(status, booking.date, booking.time, now)) {
        status = 'completed';
        syncCompletedNeeded = true;
      }

      const firstReview = booking.reviews?.[0] || null;

      updatedTrips.push({
        id: booking.id,
        orderId: booking.order_id || booking.id.slice(0, 8),
        expId: experience?.id,
        title: experience?.title,
        title_ko: experience?.title_ko || null,
        title_en: experience?.title_en || null,
        title_ja: experience?.title_ja || null,
        title_zh: experience?.title_zh || null,
        image: experience?.image_url,
        photos: experience?.photos, // 🟢 누락되었던 체험 사진 배열 추가 매핑
        location: experience?.location,
        meetingPoint: experience?.meeting_point,
        meetingPointI18n: experience?.meeting_point_i18n || null,
        date: booking.date,
        time: booking.time,
        guests: booking.guests,
        price: booking.amount,
        status: status, // 업데이트된 상태 사용
        cancelReason: booking.cancel_reason || null,
        soloGuaranteeRefundStatus: booking.solo_guarantee_refund_status || null,
        soloGuaranteeRefundAmount: booking.solo_guarantee_refund_amount || 0,
        soloGuaranteeRefundedAt: booking.solo_guarantee_refunded_at || null,
        paymentDate: booking.created_at,
        hostId: experience?.host_id, // 메시지 보내기용
        hostName: hostPublicProfile?.name || 'Host',
        hostAvatarUrl: hostPublicProfile?.avatarUrl || null,
        hasReview: booking.reviews && booking.reviews.length > 0, // 🟢 후기 작성 여부 (배열 길이로 체크)
        review: firstReview ? {  // [R5] 수정용 후기 데이터
          id: firstReview.id,
          rating: firstReview.rating,
          content: firstReview.content,
          created_at: firstReview.created_at,
        } : null,
      });
    }

    return NextResponse.json({ trips: updatedTrips, syncCompletedNeeded });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
