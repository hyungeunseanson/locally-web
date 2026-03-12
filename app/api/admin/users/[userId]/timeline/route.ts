import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { isAdminSupportInquiry } from '@/app/utils/inquiry';
import { getServiceBookingStatusLabel, getServiceRequestStatusLabel } from '@/app/constants/serviceStatus';
import type { AdminUserActivityBooking, AdminUserTimelineItem } from '@/app/types/admin';
import type { ServiceBookingStatus, ServiceRequestStatus } from '@/app/types/service';

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
};

type ReviewRow = {
  id: string;
  created_at: string;
  rating: number | null;
  content: string | null;
  experience_id: number | null;
};

type InquiryRow = {
  id: string;
  created_at: string;
  type: string | null;
  status: string | null;
  experience_id: number | null;
};

type ExperienceTitleRow = {
  id: number;
  title: string | null;
};

type ServiceRequestRow = {
  id: string;
  title: string | null;
  city: string | null;
  service_date: string | null;
  status: string;
  created_at: string;
};

type ServiceBookingRow = {
  id: string;
  request_id: string | null;
  amount: number | null;
  status: string | null;
  refund_amount: number | null;
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

const TIMELINE_LIMIT = 25;
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
      bookingsRes,
      reviewsRes,
      inquiriesRes,
      serviceRequestsRes,
      serviceBookingsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select('id, created_at, amount, total_price, status, guests, date, time, experience_id')
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
        .from('inquiries')
        .select('id, created_at, type, status, experience_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabaseAdmin
        .from('service_requests')
        .select('id, title, city, service_date, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabaseAdmin
        .from('service_bookings')
        .select('id, request_id, amount, status, refund_amount, created_at')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
    ]);

    if (bookingsRes.error) throw bookingsRes.error;
    if (reviewsRes.error) throw reviewsRes.error;
    if (inquiriesRes.error) throw inquiriesRes.error;
    if (serviceRequestsRes.error) throw serviceRequestsRes.error;
    if (serviceBookingsRes.error) throw serviceBookingsRes.error;

    const bookingRows = (bookingsRes.data || []) as BookingRow[];
    const reviewRows = (reviewsRes.data || []) as ReviewRow[];
    const inquiryRows = (inquiriesRes.data || []) as InquiryRow[];
    const serviceRequestRows = (serviceRequestsRes.data || []) as ServiceRequestRow[];
    const serviceBookingRows = (serviceBookingsRes.data || []) as ServiceBookingRow[];

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

    const [experiencesRes, serviceRequestLookupRes] = await Promise.all([
      experienceIds.length > 0
        ? supabaseAdmin.from('experiences').select('id, title').in('id', experienceIds)
        : Promise.resolve({ data: [] as ExperienceTitleRow[], error: null }),
      requestIds.length > 0
        ? supabaseAdmin.from('service_requests').select('id, title, city, service_date, status, created_at').in('id', requestIds)
        : Promise.resolve({ data: [] as ServiceRequestRow[], error: null }),
    ]);

    if (experiencesRes.error) throw experiencesRes.error;
    if (serviceRequestLookupRes.error) throw serviceRequestLookupRes.error;

    const experienceMap = new Map<number, ExperienceTitleRow>(
      ((experiencesRes.data || []) as ExperienceTitleRow[]).map((row) => [row.id, row])
    );

    const serviceRequestMap = new Map<string, ServiceRequestRow>(
      ((serviceRequestLookupRes.data || []) as ServiceRequestRow[]).map((row) => [row.id, row])
    );

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
    ]
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, TIMELINE_LIMIT);

    return NextResponse.json({ success: true, data: { bookings, timeline } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/users/[userId]/timeline error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
