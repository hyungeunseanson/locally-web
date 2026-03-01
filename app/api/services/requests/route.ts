import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

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
        status: 'open',
      })
      .select('id, total_customer_price, duration_hours')
      .single();

    if (error || !data) {
      console.error('Service Request Create Error:', error);
      return NextResponse.json({ success: false, error: '의뢰 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    // 해당 도시 활동 호스트들에게 알림 발송 (비동기)
    supabaseAdmin
      .from('host_applications')
      .select('user_id')
      .eq('status', 'approved')
      .then(async ({ data: hosts }) => {
        if (!hosts || hosts.length === 0) return;
        const hostIds = hosts
          .map((h) => h.user_id)
          .filter((id): id is string => !!id && id !== user.id);
        if (hostIds.length === 0) return;

        const notifications = hostIds.map((hostId) => ({
          user_id: hostId,
          type: 'service_request_new',
          title: `📋 새로운 맞춤 서비스 의뢰 — ${city}`,
          message: `${title} (${durationNum}시간, ${guestNum}명)`,
          link: `/services/${data.id}`,
          is_read: false,
        }));

        const { error: notiError } = await supabaseAdmin
          .from('notifications')
          .insert(notifications);
        if (notiError) console.error('Service Request Notification Error:', notiError);
      });

    return NextResponse.json({
      success: true,
      requestId: data.id,
      totalPrice: data.total_customer_price,
    });

  } catch (error: unknown) {
    console.error('API Service Request Create Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'my' | 'board'
    const city = searchParams.get('city');

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    let query = supabaseAdmin
      .from('service_requests')
      .select('id, title, city, country, service_date, start_time, duration_hours, languages, guest_count, total_customer_price, status, created_at, user_id')
      .order('created_at', { ascending: false });

    if (mode === 'my') {
      // 내 의뢰 목록
      query = query.eq('user_id', user.id);
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
