import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';

type SelectHostBody = {
  request_id?: string;
  application_id?: string;
};

type ServiceAdminClient = SupabaseClient;
type BookingBindingSnapshot = {
  id: string;
  host_id: string | null;
  application_id: string | null;
};

async function rollbackSelectHostState(
  supabaseAdmin: ServiceAdminClient,
  params: {
    requestId: string;
    originalRequest: {
      status: string;
      selected_application_id: string | null;
      selected_host_id: string | null;
    };
    bookingSnapshots: BookingBindingSnapshot[];
    requestUpdated: boolean;
    selectedApplicationUpdated: boolean;
    rejectedApplicationIds: string[];
    selectedApplicationId: string;
  }
) {
  const {
    requestId,
    originalRequest,
    bookingSnapshots,
    requestUpdated,
    selectedApplicationUpdated,
    rejectedApplicationIds,
    selectedApplicationId,
  } = params;

  const { data: currentRequest, error: currentRequestError } = await supabaseAdmin
    .from('service_requests')
    .select('status, selected_application_id, selected_host_id')
    .eq('id', requestId)
    .maybeSingle();

  if (currentRequestError) {
    console.error('Select Host Rollback - Current Request Fetch Error:', currentRequestError);
  }

  if (
    currentRequest &&
    currentRequest.status === 'matched' &&
    currentRequest.selected_application_id &&
    currentRequest.selected_host_id
  ) {
    const { error: selectedAlignError } = await supabaseAdmin
      .from('service_applications')
      .update({ status: 'selected' })
      .eq('id', currentRequest.selected_application_id);

    if (selectedAlignError) {
      console.error('Select Host Rollback - Winner App Align Error:', selectedAlignError);
    }

    const { error: othersAlignError } = await supabaseAdmin
      .from('service_applications')
      .update({ status: 'rejected' })
      .eq('request_id', requestId)
      .neq('id', currentRequest.selected_application_id)
      .in('status', ['pending', 'selected']);

    if (othersAlignError) {
      console.error('Select Host Rollback - Other Apps Align Error:', othersAlignError);
    }

    const { error: bookingAlignError } = await supabaseAdmin
      .from('service_bookings')
      .update({
        host_id: currentRequest.selected_host_id,
        application_id: currentRequest.selected_application_id,
      })
      .eq('request_id', requestId)
      .in('status', ['PAID', 'PENDING']);

    if (bookingAlignError) {
      console.error('Select Host Rollback - Booking Align Error:', bookingAlignError);
    }

    return;
  }

  if (requestUpdated) {
    const { error } = await supabaseAdmin
      .from('service_requests')
      .update({
        status: originalRequest.status,
        selected_application_id: originalRequest.selected_application_id,
        selected_host_id: originalRequest.selected_host_id,
      })
      .eq('id', requestId);

    if (error) {
      console.error('Select Host Rollback - Request Error:', error);
    }
  }

  if (rejectedApplicationIds.length > 0) {
    const { error } = await supabaseAdmin
      .from('service_applications')
      .update({ status: 'pending' })
      .in('id', rejectedApplicationIds);

    if (error) {
      console.error('Select Host Rollback - Rejected Apps Error:', error);
    }
  }

  if (selectedApplicationUpdated) {
    const { error } = await supabaseAdmin
      .from('service_applications')
      .update({ status: 'pending' })
      .eq('id', selectedApplicationId);

    if (error) {
      console.error('Select Host Rollback - Selected App Error:', error);
    }
  }

  for (const snapshot of bookingSnapshots) {
    const { error } = await supabaseAdmin
      .from('service_bookings')
      .update({
        host_id: snapshot.host_id,
        application_id: snapshot.application_id,
      })
      .eq('id', snapshot.id);

    if (error) {
      console.error('Select Host Rollback - Booking Error:', error);
    }
  }
}

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
      .select('id, status, user_id, title, duration_hours, selected_application_id, selected_host_id')
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
    const { data: bookingSnapshots, error: bookingFetchError } = await supabaseAdmin
      .from('service_bookings')
      .select('id, host_id, application_id')
      .eq('request_id', request_id)
      .in('status', ['PAID', 'PENDING']);

    if (bookingFetchError) {
      console.error('Select Host - Booking Fetch Error:', bookingFetchError);
      return NextResponse.json({ success: false, error: '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!bookingSnapshots || bookingSnapshots.length === 0) {
      return NextResponse.json({ success: false, error: '결제 예약을 찾을 수 없습니다.' }, { status: 409 });
    }

    let selectedApplicationUpdated = false;
    let requestUpdated = false;
    let rejectedHostIds: string[] = [];
    let rejectedApplicationIds: string[] = [];

    // 3. 에스크로 예약에 호스트 정보 채워넣기 (PAID/PENDING 상태 예약)
    const bookingIds = bookingSnapshots.map((row) => row.id);
    const { error: bookingUpdateError } = await supabaseAdmin
      .from('service_bookings')
      .update({ host_id: selectedHostId, application_id })
      .in('id', bookingIds);

    if (bookingUpdateError) {
      console.error('Select Host - Booking Update Error:', bookingUpdateError);
      return NextResponse.json({ success: false, error: '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    // 4. 선택된 지원서 상태 변경
    const { data: selectedApplicationRows, error: updateAppErr } = await supabaseAdmin
      .from('service_applications')
      .update({ status: 'selected' })
      .eq('id', application_id)
      .eq('status', 'pending')
      .select('id');

    if (updateAppErr) {
      console.error('Select Host - Application Update Error:', updateAppErr);
      await rollbackSelectHostState(supabaseAdmin, {
        requestId: request_id,
        originalRequest: serviceRequest,
        bookingSnapshots,
        requestUpdated,
        selectedApplicationUpdated,
        rejectedApplicationIds,
        selectedApplicationId: application_id,
      });
      return NextResponse.json({ success: false, error: '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!selectedApplicationRows || selectedApplicationRows.length !== 1) {
      await rollbackSelectHostState(supabaseAdmin, {
        requestId: request_id,
        originalRequest: serviceRequest,
        bookingSnapshots,
        requestUpdated,
        selectedApplicationUpdated,
        rejectedApplicationIds,
        selectedApplicationId: application_id,
      });
      return NextResponse.json({ success: false, error: '이미 처리된 지원서입니다.' }, { status: 409 });
    }

    selectedApplicationUpdated = true;

    // 5. 나머지 지원서 rejected 처리
    const { data: rejectedApplications, error: rejectedUpdateError } = await supabaseAdmin
      .from('service_applications')
      .update({ status: 'rejected' })
      .eq('request_id', request_id)
      .neq('id', application_id)
      .eq('status', 'pending')
      .select('id, host_id');

    if (rejectedUpdateError) {
      console.error('Select Host - Rejected Application Update Error:', rejectedUpdateError);
      await rollbackSelectHostState(supabaseAdmin, {
        requestId: request_id,
        originalRequest: serviceRequest,
        bookingSnapshots,
        requestUpdated,
        selectedApplicationUpdated,
        rejectedApplicationIds,
        selectedApplicationId: application_id,
      });
      return NextResponse.json({ success: false, error: '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    rejectedApplicationIds = (rejectedApplications || []).map((row) => row.id);
    rejectedHostIds = (rejectedApplications || [])
      .map((row) => row.host_id)
      .filter((id): id is string => Boolean(id));

    // 6. 마지막에 service_requests 상태 변경
    const { data: updatedRequestRows, error: updateReqErr } = await supabaseAdmin
      .from('service_requests')
      .update({
        status: 'matched',
        selected_application_id: application_id,
        selected_host_id: selectedHostId,
      })
      .eq('id', request_id)
      .eq('status', 'open')
      .select('id');

    if (updateReqErr) {
      console.error('Select Host - Request Update Error:', updateReqErr);
      await rollbackSelectHostState(supabaseAdmin, {
        requestId: request_id,
        originalRequest: serviceRequest,
        bookingSnapshots,
        requestUpdated,
        selectedApplicationUpdated,
        rejectedApplicationIds,
        selectedApplicationId: application_id,
      });
      return NextResponse.json({ success: false, error: '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!updatedRequestRows || updatedRequestRows.length !== 1) {
      await rollbackSelectHostState(supabaseAdmin, {
        requestId: request_id,
        originalRequest: serviceRequest,
        bookingSnapshots,
        requestUpdated,
        selectedApplicationUpdated,
        rejectedApplicationIds,
        selectedApplicationId: application_id,
      });
      return NextResponse.json({ success: false, error: '호스트를 선택할 수 없는 상태입니다.' }, { status: 409 });
    }

    requestUpdated = true;

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
