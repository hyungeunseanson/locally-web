import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { isAdminSupportInquiry } from '@/app/utils/inquiry';
import { getHostPublicProfile } from '@/app/utils/profile';
import { getServiceBookingStatusLabel, getServiceRequestStatusLabel } from '@/app/constants/serviceStatus';
import type {
  AdminUserActivityBooking,
  AdminUserGuestReviewItem,
  AdminUserTimelineItem,
} from '@/app/types/admin';
import type { ServiceBookingStatus, ServiceRequestStatus } from '@/app/types/service';
import { isUnapprovedCardPaymentAttempt } from '@/app/utils/bookings/pendingBookingHolds';

type BookingRow = {
  id: string;
  created_at: string;
  amount: number | null;
  total_price: number | null;
  status: string | null;
  guests: number | null;
  date: string | null;
  time: string | null;
  experience_id: number | null;
  payment_method: string | null;
  tid: string | null;
  cancel_reason: string | null;
};

type ReviewRow = {
  id: string;
  created_at: string;
  rating: number | null;
  content: string | null;
  experience_id: number | null;
};

type GuestReviewRow = {
  id: number;
  created_at: string;
  rating: number | null;
  content: string | null;
  host_id: string | null;
};

type InquiryRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  type: string | null;
  status: string | null;
  experience_id: number | null;
};

type ExperienceTitleRow = {
  id: number;
  title: string | null;
};

type HostProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type HostApplicationRow = {
  user_id: string;
  name: string | null;
  profile_photo: string | null;
  self_intro: string | null;
  languages: string[] | string | null;
};

type UserProfileDetailRow = {
  id: string;
  birth_date: string | null;
  nationality: string | null;
  kakao_id: string | null;
  mbti: string | null;
};

type ServiceRequestRow = {
  id: string;
  title: string | null;
  city: string | null;
  service_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ServiceBookingRow = {
  id: string;
  request_id: string | null;
  amount: number | null;
  status: string | null;
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
};

type InquiryMessageRow = {
  inquiry_id: string;
  sender_id: string | null;
  created_at: string;
};

type InquiryStatus = 'open' | 'in_progress' | 'resolved';

const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  open: '대기',
  in_progress: '처리중',
  resolved: '완료',
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  confirmed: '예약 확정',
  completed: '이용 완료',
  cancelled: '취소됨',
  cancellation_requested: '취소 요청',
  declined: '거절됨',
};

const TIMELINE_LIMIT = 40;
const PER_SOURCE_LIMIT = 20;

function truncateText(value: string | null | undefined, maxLength = 48) {
  if (!value) return null;
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function getBookingStatusLabel(status: string | null) {
  if (!status) return null;
  return BOOKING_STATUS_LABELS[status.toLowerCase()] ?? status;
}

function getInquiryStatusLabel(status: string | null) {
  if (!status) return null;
  const normalized = status.toLowerCase() as InquiryStatus;
  return INQUIRY_STATUS_LABELS[normalized] ?? status;
}

function isLaterThan(createdAt: string, updatedAt: string | null | undefined) {
  if (!createdAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() > new Date(createdAt).getTime();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

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

    const [
      profileRes,
      bookingsRes,
      reviewsRes,
      guestReviewsRes,
      inquiriesRes,
      serviceRequestsRes,
      serviceBookingsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, birth_date, nationality, kakao_id, mbti')
        .eq('id', userId)
        .maybeSingle(),
      supabaseAdmin
        .from('bookings')
        .select('id, created_at, amount, total_price, status, guests, date, time, experience_id, payment_method, tid, cancel_reason')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabaseAdmin
        .from('reviews')
        .select('id, created_at, rating, content, experience_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabaseAdmin
        .from('guest_reviews')
        .select('id, created_at, rating, content, host_id')
        .eq('guest_id', userId)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabaseAdmin
        .from('inquiries')
        .select('id, created_at, updated_at, type, status, experience_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabaseAdmin
        .from('service_requests')
        .select('id, title, city, service_date, status, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabaseAdmin
        .from('service_bookings')
        .select('id, request_id, amount, status, refund_amount, created_at, updated_at')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (bookingsRes.error) throw bookingsRes.error;
    if (reviewsRes.error) throw reviewsRes.error;
    if (guestReviewsRes.error) throw guestReviewsRes.error;
    if (inquiriesRes.error) throw inquiriesRes.error;
    if (serviceRequestsRes.error) throw serviceRequestsRes.error;
    if (serviceBookingsRes.error) throw serviceBookingsRes.error;

    const profile = (profileRes.data || null) as UserProfileDetailRow | null;
    const bookingRows = ((bookingsRes.data || []) as BookingRow[]).filter(
      (booking) => !isUnapprovedCardPaymentAttempt(booking)
    );
    const reviewRows = (reviewsRes.data || []) as ReviewRow[];
    const guestReviewRows = (guestReviewsRes.data || []) as GuestReviewRow[];
    const inquiryRows = (inquiriesRes.data || []) as InquiryRow[];
    const serviceRequestRows = (serviceRequestsRes.data || []) as ServiceRequestRow[];
    const serviceBookingRows = (serviceBookingsRes.data || []) as ServiceBookingRow[];

    const inquiryIds = new Set(inquiryRows.map((row) => row.id));
    const firstReplyMap = new Map<string, InquiryMessageRow>();

    const experienceIds = Array.from(
      new Set([
        ...bookingRows.map((row) => row.experience_id),
        ...reviewRows.map((row) => row.experience_id),
        ...inquiryRows.map((row) => row.experience_id),
      ].filter(Boolean))
    ) as number[];

    const requestIds = Array.from(
      new Set([
        ...serviceRequestRows.map((row) => row.id),
        ...serviceBookingRows.map((row) => row.request_id),
      ].filter(Boolean))
    ) as string[];

    const hostIds = Array.from(
      new Set(guestReviewRows.map((row) => row.host_id).filter(Boolean))
    ) as string[];

    const [experiencesRes, serviceRequestLookupRes, inquiryMessagesRes, hostProfilesRes, hostApplicationsRes] = await Promise.all([
      experienceIds.length > 0
        ? supabaseAdmin.from('experiences').select('id, title').in('id', experienceIds)
        : Promise.resolve({ data: [] as ExperienceTitleRow[], error: null }),
      requestIds.length > 0
        ? supabaseAdmin.from('service_requests').select('id, title, city, service_date, status, created_at').in('id', requestIds)
        : Promise.resolve({ data: [] as ServiceRequestRow[], error: null }),
      inquiryIds.size > 0
        ? supabaseAdmin
            .from('inquiry_messages')
            .select('inquiry_id, sender_id, created_at')
            .in('inquiry_id', Array.from(inquiryIds))
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] as InquiryMessageRow[], error: null }),
      hostIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, full_name, avatar_url').in('id', hostIds)
        : Promise.resolve({ data: [] as HostProfileRow[], error: null }),
      hostIds.length > 0
        ? supabaseAdmin
            .from('public_host_applications')
            .select('user_id, name, profile_photo, self_intro, languages')
            .in('user_id', hostIds)
        : Promise.resolve({ data: [] as HostApplicationRow[], error: null }),
    ]);

    if (experiencesRes.error) throw experiencesRes.error;
    if (serviceRequestLookupRes.error) throw serviceRequestLookupRes.error;
    if (inquiryMessagesRes.error) throw inquiryMessagesRes.error;
    if (hostProfilesRes.error) throw hostProfilesRes.error;
    if (hostApplicationsRes.error) throw hostApplicationsRes.error;

    const inquiryMessageRows = (inquiryMessagesRes.data || []) as InquiryMessageRow[];

    const experienceMap = new Map<number, ExperienceTitleRow>(
      ((experiencesRes.data || []) as ExperienceTitleRow[]).map((row) => [row.id, row])
    );

    const serviceRequestMap = new Map<string, ServiceRequestRow>(
      ((serviceRequestLookupRes.data || []) as ServiceRequestRow[]).map((row) => [row.id, row])
    );

    const hostProfileMap = new Map<string, HostProfileRow>(
      ((hostProfilesRes.data || []) as HostProfileRow[]).map((row) => [row.id, row])
    );
    const hostApplicationMap = new Map<string, HostApplicationRow>(
      ((hostApplicationsRes.data || []) as HostApplicationRow[]).map((row) => [row.user_id, row])
    );

    inquiryMessageRows.forEach((row) => {
      if (!row.sender_id || row.sender_id === userId) return;
      if (!firstReplyMap.has(row.inquiry_id)) {
        firstReplyMap.set(row.inquiry_id, row);
      }
    });

    const bookings: AdminUserActivityBooking[] = bookingRows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      amount: row.amount,
      total_price: row.total_price,
      status: row.status,
      guests: row.guests,
      date: row.date,
      time: row.time,
      experience_title: row.experience_id ? experienceMap.get(row.experience_id)?.title ?? null : null,
    }));

    const guestReviews: AdminUserGuestReviewItem[] = guestReviewRows.map((row) => {
      const hostProfile = row.host_id ? hostProfileMap.get(row.host_id) ?? null : null;
      const hostApplication = row.host_id ? hostApplicationMap.get(row.host_id) ?? null : null;
      const hostPublicProfile = row.host_id
        ? getHostPublicProfile(hostProfile, hostApplication, '호스트')
        : null;

      return {
        id: row.id,
        created_at: row.created_at,
        rating: row.rating,
        content: row.content,
        host_id: row.host_id,
        host_name: hostPublicProfile?.name ?? null,
        host_avatar_url: hostPublicProfile?.avatarUrl ?? null,
      };
    });

    const timeline: AdminUserTimelineItem[] = [
      ...bookingRows.map((row) => {
        const experienceTitle = row.experience_id ? experienceMap.get(row.experience_id)?.title ?? null : null;
        return {
          id: `booking:${row.id}`,
          occurred_at: row.created_at,
          kind: 'booking' as const,
          title: `체험 예약 · ${experienceTitle || '알 수 없는 체험'}`,
          description: `${row.date || '날짜 미정'}${row.time ? ` ${row.time}` : ''} · ${row.guests || 1}명`,
          status: row.status,
          status_label: getBookingStatusLabel(row.status),
          amount: row.amount ?? row.total_price ?? null,
        };
      }),
      ...reviewRows.map((row) => {
        const experienceTitle = row.experience_id ? experienceMap.get(row.experience_id)?.title ?? null : null;
        const reviewSummary = truncateText(row.content);
        return {
          id: `review:${row.id}`,
          occurred_at: row.created_at,
          kind: 'review' as const,
          title: `리뷰 작성 · ${experienceTitle || '알 수 없는 체험'}`,
          description: reviewSummary ? `평점 ${(row.rating || 0).toFixed(1)}점 · ${reviewSummary}` : `평점 ${(row.rating || 0).toFixed(1)}점`,
          status: null,
          status_label: null,
          amount: null,
        };
      }),
      ...guestReviewRows.map((row) => {
        const hostProfile = row.host_id ? hostProfileMap.get(row.host_id) ?? null : null;
        const hostApplication = row.host_id ? hostApplicationMap.get(row.host_id) ?? null : null;
        const hostPublicProfile = row.host_id
          ? getHostPublicProfile(hostProfile, hostApplication, '호스트')
          : null;
        const reviewSummary = truncateText(row.content);
        return {
          id: `guest_review:${row.id}`,
          occurred_at: row.created_at,
          kind: 'review' as const,
          title: `호스트 평가 수신 · ${hostPublicProfile?.name || '알 수 없는 호스트'}`,
          description: reviewSummary ? `평점 ${(row.rating || 0).toFixed(1)}점 · ${reviewSummary}` : `평점 ${(row.rating || 0).toFixed(1)}점`,
          status: null,
          status_label: null,
          amount: null,
        };
      }),
      ...inquiryRows.map((row) => {
        const experienceTitle = row.experience_id ? experienceMap.get(row.experience_id)?.title ?? null : null;
        const isAdminSupport = isAdminSupportInquiry(row.type);
        return {
          id: `inquiry:${row.id}`,
          occurred_at: row.created_at,
          kind: 'inquiry' as const,
          title: isAdminSupport
            ? '관리자 1:1 문의 생성'
            : `체험 문의 시작 · ${experienceTitle || '일반 문의'}`,
          description: isAdminSupport
            ? '운영팀과 직접 대화를 시작했습니다.'
            : experienceTitle
              ? `${experienceTitle} 관련 문의를 시작했습니다.`
              : '일반 문의를 시작했습니다.',
          status: row.status,
          status_label: getInquiryStatusLabel(row.status),
          amount: null,
        };
      }),
      ...inquiryRows.flatMap((row) => {
        const experienceTitle = row.experience_id ? experienceMap.get(row.experience_id)?.title ?? null : null;
        const isAdminSupport = isAdminSupportInquiry(row.type);
        const reply = firstReplyMap.get(row.id);
        const events: AdminUserTimelineItem[] = [];

        if (reply) {
          events.push({
            id: `inquiry_reply:${row.id}`,
            occurred_at: reply.created_at,
            kind: 'inquiry' as const,
            title: isAdminSupport
              ? '운영팀 답변 도착'
              : `문의 답변 도착 · ${experienceTitle || '일반 문의'}`,
            description: isAdminSupport
              ? '운영팀이 문의에 답변했습니다.'
              : '호스트 또는 운영팀이 문의에 답변했습니다.',
            status: row.status,
            status_label: null,
            amount: null,
          });
        }

        if ((row.status || '').toLowerCase() === 'resolved' && isLaterThan(row.created_at, row.updated_at)) {
          events.push({
            id: `inquiry_resolved:${row.id}`,
            occurred_at: row.updated_at || row.created_at,
            kind: 'inquiry' as const,
            title: isAdminSupport
              ? '관리자 문의 해결 완료'
              : `문의 해결 완료 · ${experienceTitle || '일반 문의'}`,
            description: '문의가 해결 완료 상태로 변경되었습니다.',
            status: row.status,
            status_label: getInquiryStatusLabel(row.status),
            amount: null,
          });
        }

        return events;
      }),
      ...serviceRequestRows.map((row) => ({
        id: `service_request:${row.id}`,
        occurred_at: row.created_at,
        kind: 'service_request' as const,
        title: `맞춤 의뢰 생성 · ${row.title || '맞춤 의뢰'}`,
        description: `${row.city || '지역 미정'} · ${row.service_date || '날짜 미정'}`,
        status: row.status,
        status_label: getServiceRequestStatusLabel(row.status as ServiceRequestStatus),
        amount: null,
      })),
      ...serviceRequestRows.flatMap((row) => {
        if (!isLaterThan(row.created_at, row.updated_at)) return [];

        const normalizedStatus = row.status.toLowerCase();
        if (normalizedStatus === 'pending_payment' || normalizedStatus === 'open') return [];

        return [{
          id: `service_request_status:${row.id}`,
          occurred_at: row.updated_at,
          kind: 'service_request' as const,
          title: `맞춤 의뢰 상태 변경 · ${row.title || '맞춤 의뢰'}`,
          description: `${row.city || '지역 미정'} · ${row.service_date || '날짜 미정'}`,
          status: row.status,
          status_label: getServiceRequestStatusLabel(row.status as ServiceRequestStatus),
          amount: null,
        }];
      }),
      ...serviceBookingRows.map((row) => {
        const request = row.request_id ? serviceRequestMap.get(row.request_id) ?? null : null;
        return {
          id: `service_booking:${row.id}`,
          occurred_at: row.created_at,
          kind: 'service_booking' as const,
          title: `맞춤 의뢰 결제 · ${request?.title || '맞춤 의뢰'}`,
          description: `${request?.city || '지역 미정'} · ${request?.service_date || '날짜 미정'}`,
          status: row.status,
          status_label: row.status ? getServiceBookingStatusLabel(row.status as ServiceBookingStatus) : null,
          amount: row.amount ?? null,
        };
      }),
      ...serviceBookingRows.flatMap((row) => {
        if (!isLaterThan(row.created_at, row.updated_at) || !row.status) return [];

        if (row.status === 'PENDING' || row.status === 'PAID') return [];

        const request = row.request_id ? serviceRequestMap.get(row.request_id) ?? null : null;
        const statusDescription = row.refund_amount && row.refund_amount > 0
          ? `${request?.city || '지역 미정'} · 환불액 ₩${Number(row.refund_amount).toLocaleString()}`
          : `${request?.city || '지역 미정'} · ${request?.service_date || '날짜 미정'}`;

        return [{
          id: `service_booking_status:${row.id}`,
          occurred_at: row.updated_at,
          kind: 'service_booking' as const,
          title: `맞춤 의뢰 결제 상태 변경 · ${request?.title || '맞춤 의뢰'}`,
          description: statusDescription,
          status: row.status,
          status_label: getServiceBookingStatusLabel(row.status as ServiceBookingStatus),
          amount: row.refund_amount && row.refund_amount > 0 ? row.refund_amount : row.amount ?? null,
        }];
      }),
    ]
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, TIMELINE_LIMIT);

    return NextResponse.json({
      success: true,
      data: {
        profile: profile
          ? {
              birth_date: profile.birth_date,
              nationality: profile.nationality,
              kakao_id: profile.kakao_id,
              mbti: profile.mbti,
            }
          : null,
        bookings,
        timeline,
        guestReviews,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/users/[userId]/timeline error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
