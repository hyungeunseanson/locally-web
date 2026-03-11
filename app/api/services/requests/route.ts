import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import crypto from 'crypto';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';

function generateOrderId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(4).toString('hex');
  return `SVC-${date}-${rand}`;
}

type CreateRequestBody = {
  title?: string;
  description?: string;
  city?: string;
  country?: string;
  service_date?: string;
  start_time?: string;
  duration_hours?: number | string;
  languages?: string[];
  guest_count?: number | string;
  contact_name?: string;
  contact_phone?: string;
};

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CreateRequestBody;
    const {
      title, description, city, country = 'JP',
      service_date, start_time, duration_hours,
      languages, guest_count, contact_name, contact_phone
    } = body;

    const durationNum = Number(duration_hours);
    const guestNum = Number(guest_count);

    if (
      !title || !description || !city || !service_date || !start_time ||
      !Number.isFinite(durationNum) || durationNum < 4 ||
      !Number.isFinite(guestNum) || guestNum < 1 ||
      !contact_name || !contact_phone
    ) {
      return NextResponse.json({ success: false, error: 'Missing or invalid required fields' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. service_requests 생성 (v2 에스크로: pending_payment 상태로 시작)
    const { data, error } = await supabaseAdmin
      .from('service_requests')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        city: city.trim(),
        country,
        service_date,
        start_time,
        duration_hours: durationNum,
        languages: languages ?? [],
        guest_count: guestNum,
        contact_name: contact_name.trim(),
        contact_phone: contact_phone.trim(),
        status: 'pending_payment',  // v2 에스크로: 결제 후 open 전환
      })
      .select('id, total_customer_price, total_host_payout, duration_hours')
      .single();

    if (error || !data) {
      console.error('Service Request Create Error:', error);
      return NextResponse.json({ success: false, error: '의뢰 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    // 2. 에스크로 예약 사전 생성 (PENDING, 호스트 미정)
    const orderId = generateOrderId();
    const { error: bookingError } = await supabaseAdmin
      .from('service_bookings')
      .insert({
        id: crypto.randomUUID(),
        order_id: orderId,
        request_id: data.id,
        customer_id: user.id,
        host_id: null,          // v2: 호스트 선택 전이므로 null
        application_id: null,   // v2: 호스트 선택 후 채워짐
        amount: data.total_customer_price,
        host_payout_amount: durationNum * 20000,
        platform_revenue: durationNum * 15000,
        status: 'PENDING',
        contact_name: contact_name.trim(),
        contact_phone: contact_phone.trim(),
        payment_method: 'card',
        payout_status: 'pending',
      });

    if (bookingError) {
      console.error('Service Booking Pre-create Error:', bookingError);
      // 예약 생성 실패 시 의뢰 취소 처리
      await supabaseAdmin.from('service_requests').update({ status: 'cancelled' }).eq('id', data.id);
      return NextResponse.json({ success: false, error: '예약 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    // 3. 호스트 알림은 결제 완료(open 전환) 시점에 발송 — 여기서는 생략
    insertAdminAlerts({
      title: '새 맞춤 의뢰가 생성되었습니다',
      message: `'${title.trim()}' 맞춤 의뢰가 생성되었습니다.`,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    }).catch((adminAlertError) => {
      console.error('Service Request Admin Alert Error:', adminAlertError);
    });

    return NextResponse.json({
      success: true,
      requestId: data.id,
      orderId,
      amount: data.total_customer_price,
    });

  } catch (error: unknown) {
    console.error('API Service Request Create Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');
    const mode = searchParams.get('mode'); // 'my' | 'board'
    const city = searchParams.get('city');

    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    const currentUser = authError ? null : user ?? null;

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (requestId) {
      const { data, error } = await supabaseAdmin
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (error || !data) {
        console.error('Service Request Detail Fetch Error:', error);
        return NextResponse.json({ success: false, error: '의뢰를 찾을 수 없습니다.' }, { status: 404 });
      }

      const canRead =
        data.status === 'open' ||
        currentUser?.id === data.user_id ||
        currentUser?.id === data.selected_host_id;

      if (!canRead) {
        return NextResponse.json({ success: false, error: '의뢰를 찾을 수 없습니다.' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data });
    }

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabaseAdmin
      .from('service_requests')
      .select('id, title, city, country, service_date, start_time, duration_hours, languages, guest_count, total_customer_price, total_host_payout, status, created_at, user_id')
      .order('created_at', { ascending: false });

    if (mode === 'my') {
      // 내 의뢰 목록
      query = query.eq('user_id', currentUser.id);
    } else {
      // 잡보드: open 상태만
      query = query.eq('status', 'open');
      if (city && city !== 'all') {
        query = query.eq('city', city);
      }
    }

    const { data, error } = await query.limit(50);

    if (error) {
      console.error('Service Requests Fetch Error:', error);
      return NextResponse.json({ success: false, error: '목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });

  } catch (error: unknown) {
    console.error('API Service Requests GET Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
