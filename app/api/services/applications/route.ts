import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type ApplyBody = {
  request_id?: string;
  appeal_message?: string;
};

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as ApplyBody;
    const { request_id, appeal_message } = body;

    if (!request_id || !appeal_message?.trim()) {
      return NextResponse.json({ success: false, error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. 의뢰 존재 + open 상태 + 본인 의뢰 아님 검증
    const { data: serviceRequest, error: reqError } = await supabaseAdmin
      .from('service_requests')
      .select('id, status, user_id, title, city, duration_hours')
      .eq('id', request_id)
      .maybeSingle();

    if (reqError || !serviceRequest) {
      return NextResponse.json({ success: false, error: '의뢰를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (serviceRequest.status !== 'open') {
      return NextResponse.json({ success: false, error: '이미 마감된 의뢰입니다.' }, { status: 409 });
    }

    if (serviceRequest.user_id === user.id) {
      return NextResponse.json({ success: false, error: '본인의 의뢰에는 지원할 수 없습니다.' }, { status: 403 });
    }

    // 2. 호스트 승인 여부 확인
    const { data: hostApp } = await supabaseAdmin
      .from('host_applications')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!hostApp || hostApp.status !== 'approved') {
      return NextResponse.json({ success: false, error: '승인된 호스트만 지원할 수 있습니다.' }, { status: 403 });
    }

    // 3. 중복 지원 방지 (DB UNIQUE 제약으로도 보호되나 메시지 개선용)
    const { data: existing } = await supabaseAdmin
      .from('service_applications')
      .select('id, status')
      .eq('request_id', request_id)
      .eq('host_id', user.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'withdrawn') {
        // 철회 후 재지원 허용: 기존 행 업데이트
        const { error: updateErr } = await supabaseAdmin
          .from('service_applications')
          .update({ appeal_message: appeal_message.trim(), status: 'pending' })
          .eq('id', existing.id);

        if (updateErr) {
          return NextResponse.json({ success: false, error: '지원 중 오류가 발생했습니다.' }, { status: 500 });
        }
      } else {
        return NextResponse.json({ success: false, error: '이미 지원한 의뢰입니다.' }, { status: 409 });
      }
    } else {
      // 4. 지원서 삽입
      const { error: insertErr } = await supabaseAdmin
        .from('service_applications')
        .insert({
          request_id,
          host_id: user.id,
          appeal_message: appeal_message.trim(),
          status: 'pending',
        });

      if (insertErr) {
        console.error('Service Application Insert Error:', insertErr);
        return NextResponse.json({ success: false, error: '지원 중 오류가 발생했습니다.' }, { status: 500 });
      }
    }

    // 5. 의뢰 소유자(고객)에게 알림 (비동기)
    supabaseAdmin.from('notifications').insert({
      user_id: serviceRequest.user_id,
      type: 'service_application_new',
      title: '📩 새로운 호스트 지원자가 있습니다!',
      message: `'${serviceRequest.title}'에 새로운 호스트가 지원했습니다.`,
      link: `/services/${request_id}`,
      is_read: false,
    }).then(({ error }) => {
      if (error) console.error('Service Application Notification Error:', error);
    });

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error('API Service Application Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
