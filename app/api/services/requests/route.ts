import { NextResponse } from 'next/server';

import {
  calculateServicePricing,
  isServiceType,
  SERVICE_COUNTRY,
  SERVICE_LANGUAGE_OPTIONS,
  SERVICE_MAX_GUESTS,
  validateServiceSchedule,
} from '@/app/utils/services/concierge';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type CreateRequestBody = {
  serviceType?: unknown;
  description?: unknown;
  city?: unknown;
  schedule?: unknown;
  languages?: unknown;
  guestCount?: unknown;
  contactName?: unknown;
  contactPhone?: unknown;
  idempotencyKey?: unknown;
};

type AtomicCreateResult = {
  request_id: string;
  booking_id: string;
  order_id: string;
  amount: number;
  hourly_rate: number;
  pricing_reason: string;
};

type ServiceRpcError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function mapCreateError(error: ServiceRpcError | null) {
  const detail = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  if (detail.includes('SVC_INVALID_SERVICE_TYPE')) return '서비스 유형을 확인해주세요.';
  if (detail.includes('SVC_INVALID_GUEST_COUNT')) return '인원은 1~10명으로 입력해주세요.';
  if (detail.includes('SVC_INVALID_LANGUAGES')) return '필요 언어를 하나 이상 선택해주세요.';
  if (detail.includes('SVC_INVALID_SCHEDULE')) return '일정을 다시 확인해주세요.';
  if (detail.includes('SVC_IDEMPOTENCY_KEY_REQUIRED')) return '요청 식별자가 누락되었습니다.';
  return '의뢰 생성 중 오류가 발생했습니다.';
}

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CreateRequestBody;
    if (!isServiceType(body.serviceType)) {
      return NextResponse.json({ success: false, error: '서비스 유형을 선택해주세요.' }, { status: 400 });
    }

    const description = normalizeText(body.description, 4_000);
    const city = normalizeText(body.city, 100);
    const contactName = normalizeText(body.contactName, 100);
    const contactPhone = normalizeText(body.contactPhone, 50);
    const guestCount = Number(body.guestCount);
    const idempotencyKey = normalizeText(
      request.headers.get('Idempotency-Key') || body.idempotencyKey,
      128
    );
    const scheduleValidation = validateServiceSchedule(body.schedule);
    const languages = Array.isArray(body.languages)
      ? Array.from(new Set(body.languages.map((value) => normalizeText(value, 30))))
        .filter((value) => (SERVICE_LANGUAGE_OPTIONS as readonly string[]).includes(value))
      : [];

    if (
      !description || !city || !contactName || !contactPhone || languages.length === 0 ||
      !Number.isInteger(guestCount) || guestCount < 1 || guestCount > SERVICE_MAX_GUESTS ||
      !/^[A-Za-z0-9:_-]{16,128}$/.test(idempotencyKey)
    ) {
      return NextResponse.json({ success: false, error: '필수 항목을 올바르게 입력해주세요.' }, { status: 400 });
    }
    if (!scheduleValidation.success) {
      return NextResponse.json({ success: false, error: scheduleValidation.error }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: duplicateRequest } = await supabaseAdmin
      .from('service_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_request_key', idempotencyKey)
      .maybeSingle();

    if (!duplicateRequest) {
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supabaseAdmin
        .from('service_requests')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneMinuteAgo);
      if ((count || 0) >= 5) {
        return NextResponse.json(
          { success: false, error: '요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.' },
          { status: 429 }
        );
      }
    }

    const pricing = calculateServicePricing({
      serviceType: body.serviceType,
      guestCount,
      totalHours: scheduleValidation.totalHours,
    });
    const { data, error } = await supabaseAdmin
      .rpc('create_service_concierge_request_atomic', {
        p_user_id: user.id,
        p_service_type: body.serviceType,
        p_description: description,
        p_city: city,
        p_schedule: scheduleValidation.schedule,
        p_languages: languages,
        p_guest_count: guestCount,
        p_contact_name: contactName,
        p_contact_phone: contactPhone,
        p_client_request_key: idempotencyKey,
      })
      .maybeSingle<AtomicCreateResult>();

    if (error || !data) {
      console.error('[service concierge] create RPC failed:', error);
      return NextResponse.json({ success: false, error: mapCreateError(error) }, { status: 500 });
    }
    if (Number(data.amount) !== pricing.totalPrice || Number(data.hourly_rate) !== pricing.hourlyRate) {
      console.error('[service concierge] server pricing mismatch:', { data, pricing });
      return NextResponse.json({ success: false, error: '가격 검증에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      requestId: data.request_id,
      orderId: data.order_id,
      amount: data.amount,
      hourlyRate: data.hourly_rate,
      pricingReason: data.pricing_reason,
      country: SERVICE_COUNTRY,
    });
  } catch (error) {
    console.error('[service concierge] request creation failed:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');
    const mode = searchParams.get('mode');
    if (!requestId && mode !== 'my') {
      return NextResponse.json(
        { success: false, code: 'SERVICE_MARKETPLACE_DISABLED', error: '호스트 공개 모집이 종료되었습니다.' },
        { status: 410 }
      );
    }

    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const supabaseAdmin = createAdminClient();

    if (requestId) {
      const { data: serviceRequest, error } = await supabaseAdmin
        .from('service_requests')
        .select('id, user_id, title, description, city, country, service_date, start_time, duration_hours, languages, guest_count, service_type, pricing_tier, pricing_reason, service_end_at, hourly_rate_customer, total_customer_price, status, selected_host_id, contact_name, contact_phone, created_at, updated_at')
        .eq('id', requestId)
        .maybeSingle();
      if (error || !serviceRequest) {
        return NextResponse.json({ success: false, error: '의뢰를 찾을 수 없습니다.' }, { status: 404 });
      }

      const isOwner = serviceRequest.user_id === user.id;
      const isAssignedHost = serviceRequest.selected_host_id === user.id;
      if (!isOwner && !isAssignedHost) {
        return NextResponse.json({ success: false, error: '의뢰를 찾을 수 없습니다.' }, { status: 404 });
      }

      const [scheduleResult, bookingResult, inquiryResult] = await Promise.all([
        supabaseAdmin
          .from('service_request_schedule_items')
          .select('id, service_date, start_time, duration_hours, sort_order')
          .eq('request_id', requestId)
          .order('sort_order', { ascending: true }),
        isOwner
          ? supabaseAdmin
            .from('service_bookings')
            .select('id, order_id, amount, status, payment_method, refund_amount, host_compensation_amount')
            .eq('request_id', requestId)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabaseAdmin
          .from('inquiries')
          .select('id, type, host_id')
          .eq('service_request_id', requestId)
          .or(isOwner ? `user_id.eq.${user.id},host_id.eq.${user.id}` : `host_id.eq.${user.id}`),
      ]);

      if (scheduleResult.error || bookingResult.error || inquiryResult.error) {
        console.error('[service concierge] detail relation fetch failed:', {
          schedule: scheduleResult.error,
          booking: bookingResult.error,
          inquiry: inquiryResult.error,
        });
        return NextResponse.json({ success: false, error: '의뢰 상세를 불러오지 못했습니다.' }, { status: 500 });
      }

      const supportInquiry = (inquiryResult.data || []).find((row) => row.type === 'admin_support' && !row.host_id);
      const hostInquiry = (inquiryResult.data || []).find((row) => row.type === 'general' && row.host_id);

      return NextResponse.json({
        success: true,
        data: {
          ...serviceRequest,
          user_id: undefined,
          selected_host_id: undefined,
          contact_name: isOwner ? serviceRequest.contact_name : null,
          contact_phone: isOwner ? serviceRequest.contact_phone : null,
          viewerRole: isOwner ? 'owner' : 'host',
          schedule: (scheduleResult.data || []).map((item) => ({
            id: item.id,
            serviceDate: item.service_date,
            startTime: String(item.start_time).slice(0, 5),
            durationHours: item.duration_hours,
            sortOrder: item.sort_order,
          })),
          booking: bookingResult.data,
          supportInquiryId: isOwner ? supportInquiry?.id || null : null,
          hostInquiryId: hostInquiry?.id || null,
        },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('service_requests')
      .select('id, title, city, country, service_date, start_time, duration_hours, guest_count, service_type, pricing_reason, service_end_at, hourly_rate_customer, total_customer_price, status, selected_host_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      return NextResponse.json({ success: false, error: '목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('[service concierge] request read failed:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
