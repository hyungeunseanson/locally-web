import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';

type SelectHostBody = {
  request_id?: string;
  application_id?: string;
};

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as SelectHostBody;
    const { request_id, application_id } = body;

    if (!request_id || !application_id) {
      return NextResponse.json({ success: false, error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. 의뢰 조회 + 소유자 검증
    const { data: serviceRequest, error: reqError } = await supabaseAdmin
      .from('service_requests')
      .select('id, status, user_id, title, duration_hours')
      .eq('id', request_id)
      .maybeSingle();

    if (reqError || !serviceRequest) {
      return NextResponse.json({ success: false, error: '의뢰를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (serviceRequest.user_id !== user.id) {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    if (serviceRequest.status !== 'open') {
      return NextResponse.json({ success: false, error: '호스트를 선택할 수 없는 상태입니다.' }, { status: 409 });
    }

    // 2. 지원서 조회 + 상태 검증
    const { data: application, error: appError } = await supabaseAdmin
      .from('service_applications')
      .select('id, host_id, status')
      .eq('id', application_id)
      .eq('request_id', request_id)
      .maybeSingle();

    if (appError || !application) {
      return NextResponse.json({ success: false, error: '지원서를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (application.status !== 'pending') {
      return NextResponse.json({ success: false, error: '이미 처리된 지원서입니다.' }, { status: 409 });
    }

    const selectedHostId = application.host_id;

    // 3. 원자적 업데이트: service_requests 상태 변경
    const { error: updateReqErr } = await supabaseAdmin
      .from('service_requests')
      .update({
        status: 'matched',
        selected_application_id: application_id,
        selected_host_id: selectedHostId,
      })
      .eq('id', request_id);

    if (updateReqErr) {
      console.error('Select Host - Request Update Error:', updateReqErr);
      return NextResponse.json({ success: false, error: '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    // 4. 선택된 지원서 상태 변경
    const { error: updateAppErr } = await supabaseAdmin
      .from('service_applications')
      .update({ status: 'selected' })
      .eq('id', application_id);

    if (updateAppErr) {
      console.error('Select Host - Application Update Error:', updateAppErr);
    }

    // 5. 나머지 지원서 rejected 처리
    const { data: rejectedApplications, error: rejectedUpdateError } = await supabaseAdmin
      .from('service_applications')
      .update({ status: 'rejected' })
      .eq('request_id', request_id)
      .neq('id', application_id)
      .eq('status', 'pending')
      .select('host_id');

    if (rejectedUpdateError) {
      console.error('Select Host - Rejected Application Update Error:', rejectedUpdateError);
    }

    const rejectedHostIds = (rejectedApplications || [])
      .map((row) => row.host_id)
      .filter((id): id is string => Boolean(id));

    // 6. 에스크로 예약에 호스트 정보 채워넣기 (PAID 상태 예약)
    await supabaseAdmin
      .from('service_bookings')
      .update({ host_id: selectedHostId, application_id })
      .eq('request_id', request_id)
      .in('status', ['PAID', 'PENDING']);

    // 7. 선택된 호스트에게 알림 (비동기) — 에스크로: 이미 결제 완료 상태
    supabaseAdmin.from('notifications').insert({
      user_id: selectedHostId,
      type: 'service_host_selected',
      title: '🎉 고객에게 선택되었습니다!',
      message: `'${serviceRequest.title}' 의뢰에서 선택되셨습니다. 결제는 이미 완료되어 바로 진행됩니다.`,
      link: `/services/${request_id}`,
      is_read: false,
    }).then(({ error }) => {
      if (error) console.error('Select Host Notification Error:', error);
    });

    sendImmediateGenericEmail({
      recipientUserId: selectedHostId,
      subject: '[Locally] 고객에게 선택되었습니다',
      title: '고객에게 선택되었습니다',
      message: `'${serviceRequest.title}' 의뢰에서 선택되셨습니다. 바로 진행을 준비해주세요.`,
      link: `/services/${request_id}`,
      ctaLabel: '의뢰 확인하기',
    }).catch((emailError) => {
      console.error('Select Host Email Error:', emailError);
    });

    insertAdminAlerts({
      title: '서비스 호스트가 선택되었습니다',
      message: rejectedHostIds.length > 0
        ? `'${serviceRequest.title}' 의뢰에서 호스트 선택이 완료되었고, 미선택 ${rejectedHostIds.length}건이 함께 처리되었습니다.`
        : `'${serviceRequest.title}' 의뢰에서 호스트 선택이 완료되었습니다.`,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    }).catch((adminAlertError) => {
      console.error('Select Host Admin Alert Error:', adminAlertError);
    });

    // 8. 미선택 호스트들에게 알림 조회 (비동기)
    Promise.resolve(rejectedHostIds)
      .then((rejected) => {
        if (rejected.length === 0) return;
        const notifications = rejected
          .map((hostId) => ({
            user_id: hostId,
            type: 'service_host_rejected',
            title: '다른 호스트가 선택되었습니다.',
            message: `'${serviceRequest.title}' 의뢰에서 다른 호스트가 선택되었습니다.`,
            link: '/services',
            is_read: false,
          }));
        if (notifications.length === 0) return;
        supabaseAdmin.from('notifications').insert(notifications).then(({ error }) => {
          if (error) console.error('Reject Notification Error:', error);
        });
      });

    return NextResponse.json({ success: true, selectedHostId });

  } catch (error: unknown) {
    console.error('API Select Host Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
