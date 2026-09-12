import { NextResponse } from 'next/server';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

export async function GET(request: Request) {
  const supabaseServer = await createServerClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = new URL(request.url).searchParams.get('requestId');
  if (!requestId) {
    return NextResponse.json({ success: false, error: 'requestId is required' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: serviceRequest, error: requestError } = await supabaseAdmin
    .from('service_requests')
    .select('id, user_id, title, service_date, start_time, duration_hours, guest_count, service_type, pricing_reason, hourly_rate_customer, total_customer_price, contact_name, contact_phone, status')
    .eq('id', requestId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (requestError || !serviceRequest) {
    return NextResponse.json({ success: false, error: '결제할 의뢰를 찾을 수 없습니다.' }, { status: 404 });
  }

  const [bookingResult, scheduleResult] = await Promise.all([
    supabaseAdmin
      .from('service_bookings')
      .select('id, order_id, amount, status, payment_method')
      .eq('request_id', requestId)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('service_request_schedule_items')
      .select('id, service_date, start_time, duration_hours, sort_order')
      .eq('request_id', requestId)
      .order('sort_order', { ascending: true }),
  ]);

  if (bookingResult.error || scheduleResult.error) {
    return NextResponse.json({ success: false, error: '결제 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
  if (!bookingResult.data || bookingResult.data.status !== 'PENDING') {
    return NextResponse.json(
      { success: false, code: 'SERVICE_PAYMENT_NOT_PENDING', error: '이미 결제가 처리되었거나 취소된 의뢰입니다.' },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    request: {
      id: serviceRequest.id,
      title: serviceRequest.title,
      service_date: serviceRequest.service_date,
      start_time: serviceRequest.start_time,
      duration_hours: serviceRequest.duration_hours,
      guest_count: serviceRequest.guest_count,
      service_type: serviceRequest.service_type,
      pricing_reason: serviceRequest.pricing_reason,
      hourly_rate_customer: serviceRequest.hourly_rate_customer,
      total_customer_price: serviceRequest.total_customer_price,
      contact_name: serviceRequest.contact_name,
      contact_phone: serviceRequest.contact_phone,
      schedule: (scheduleResult.data || []).map((item) => ({
        id: item.id,
        serviceDate: item.service_date,
        startTime: String(item.start_time).slice(0, 5),
        durationHours: item.duration_hours,
        sortOrder: item.sort_order,
      })),
    },
    booking: bookingResult.data,
  });
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      code: 'SERVICE_MARKETPLACE_DISABLED',
      error: '기존 지원서 기반 서비스 예약은 종료되었습니다.',
    },
    { status: 410 }
  );
}
