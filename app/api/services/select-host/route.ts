import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';

type SelectHostBody = {
  request_id?: string;
  application_id?: string;
};

type ServiceAdminClient = SupabaseClient;
type ServiceRpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};
type BookingBindingSnapshot = {
  id: string;
  host_id: string | null;
  application_id: string | null;
};
type SelectServiceHostAtomicResult = {
  selected_host_id: string;
  selected_application_id: string;
  rejected_host_ids: string[] | null;
};

type SelectHostFailureStage =
  | 'after-booking-update'
  | 'after-selected-application-update'
  | 'after-rejected-applications-update';

function getForcedSelectHostFailureStage(request: Request): SelectHostFailureStage | null {
  if (process.env.NODE_ENV === 'production') return null;

  const value = request.headers.get('x-locally-test-select-host-fail-stage');
  if (
    value === 'after-booking-update' ||
    value === 'after-selected-application-update' ||
    value === 'after-rejected-applications-update'
  ) {
    return value;
  }

  return null;
}

function isMissingServiceRpcError(error: ServiceRpcErrorLike | null | undefined, functionName: string) {
  if (!error) return false;

  const combinedMessage = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return (
    error.code === 'PGRST202' ||
    (combinedMessage.includes(functionName) &&
      (combinedMessage.includes('Could not find the function') ||
        combinedMessage.includes('No function matches') ||
        combinedMessage.includes('does not exist')))
  );
}

function mapServiceAtomicError(error: ServiceRpcErrorLike | null | undefined) {
  const message = `${error?.message || ''} ${error?.details || ''}`;

  if (message.includes('SVC_NOT_FOUND')) {
    return { status: 404, error: '의뢰 또는 지원서를 찾을 수 없습니다.' };
  }
  if (message.includes('SVC_FORBIDDEN')) {
    return { status: 403, error: '권한이 없습니다.' };
  }
  if (message.includes('SVC_INVALID_STATUS')) {
    return { status: 409, error: '호스트를 선택할 수 없는 상태입니다.' };
  }
  if (message.includes('SVC_BAD_REQUEST')) {
    return { status: 400, error: '지원서 정보가 올바르지 않습니다.' };
  }
  if (message.includes('SVC_BOOKING_MISSING')) {
    return { status: 409, error: '결제 예약을 찾을 수 없습니다.' };
  }

  return null;
}

async function trySelectServiceHostAtomic(
  supabaseAdmin: ServiceAdminClient,
  params: {
    customerId: string;
    requestId: string;
    applicationId: string;
  }
) {
  const rpcName = 'select_service_host_atomic';
  const { data, error } = await supabaseAdmin
    .rpc(rpcName, {
      p_customer_id: params.customerId,
      p_request_id: params.requestId,
      p_application_id: params.applicationId,
    })
    .maybeSingle<SelectServiceHostAtomicResult>();

  if (error) {
    if (isMissingServiceRpcError(error, rpcName)) {
      return { kind: 'missing' as const };
    }

    const mappedError = mapServiceAtomicError(error);
    if (mappedError) {
      return { kind: 'error' as const, ...mappedError };
    }

    console.error('Select Host Atomic RPC Error:', error);
    return {
      kind: 'error' as const,
      status: 500,
      error: '처리 중 오류가 발생했습니다.',
    };
  }

  if (!data?.selected_host_id || !data.selected_application_id) {
    return {
      kind: 'error' as const,
      status: 500,
      error: '처리 중 오류가 발생했습니다.',
    };
  }

  return {
    kind: 'success' as const,
    data,
  };
}

function notifyServiceHostSelection(params: {
  supabaseAdmin: ServiceAdminClient;
  requestId: string;
  requestTitle: string;
  selectedHostId: string;
  rejectedHostIds: string[];
}) {
  const { supabaseAdmin, requestId, requestTitle, selectedHostId, rejectedHostIds } = params;

  buildLocalizedNotificationInsert({
    supabaseAdmin,
    userId: selectedHostId,
    type: 'service_host_selected',
    link: `/services/${requestId}`,
    key: 'service.host_selected',
    copyParams: {
      requestTitle,
    },
  }).then((notificationRow) => {
    return supabaseAdmin.from('notifications').insert(notificationRow);
  }).then(({ error }) => {
    if (error) console.error('Select Host Notification Error:', error);
  }).catch((notificationError) => {
    console.error('Select Host Notification Error:', notificationError);
  });

  sendImmediateGenericEmail({
    recipientUserId: selectedHostId,
    subject: '[Locally] 고객에게 선택되었습니다',
    title: '고객에게 선택되었습니다',
    message: `'${requestTitle}' 의뢰에서 선택되셨습니다. 바로 진행을 준비해주세요.`,
    link: `/services/${requestId}`,
    ctaLabel: '의뢰 확인하기',
  }).catch((emailError) => {
    console.error('Select Host Email Error:', emailError);
  });

  insertAdminAlerts({
    title: '서비스 호스트가 선택되었습니다',
    message: rejectedHostIds.length > 0
      ? `'${requestTitle}' 의뢰에서 호스트 선택이 완료되었고, 미선택 ${rejectedHostIds.length}건이 함께 처리되었습니다.`
      : `'${requestTitle}' 의뢰에서 호스트 선택이 완료되었습니다.`,
    link: '/admin/dashboard?tab=SERVICE_REQUESTS',
  }).catch((adminAlertError) => {
    console.error('Select Host Admin Alert Error:', adminAlertError);
  });

  Promise.resolve(rejectedHostIds)
    .then((rejected) => {
      if (rejected.length === 0) return;
      return Promise.all(
        rejected.map((hostId) =>
          buildLocalizedNotificationInsert({
            supabaseAdmin,
            userId: hostId,
            type: 'service_host_rejected',
            link: '/services',
            key: 'service.host_rejected',
            copyParams: {
              requestTitle,
            },
          })
        )
      ).then((notifications) => {
        if (notifications.length === 0) return;
        return supabaseAdmin.from('notifications').insert(notifications).then(({ error }) => {
          if (error) console.error('Reject Notification Error:', error);
        });
      });
    })
    .catch((notificationError) => {
      console.error('Reject Notification Error:', notificationError);
    });
}

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
    const forcedFailureStage = getForcedSelectHostFailureStage(request);

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

    if (!forcedFailureStage) {
      const atomicSelectResult = await trySelectServiceHostAtomic(supabaseAdmin, {
        customerId: user.id,
        requestId: request_id,
        applicationId: application_id,
      });

      if (atomicSelectResult.kind === 'success') {
        notifyServiceHostSelection({
          supabaseAdmin,
          requestId: request_id,
          requestTitle: serviceRequest.title,
          selectedHostId: atomicSelectResult.data.selected_host_id,
          rejectedHostIds: (atomicSelectResult.data.rejected_host_ids || []).filter(Boolean),
        });

        return NextResponse.json({ success: true, selectedHostId: atomicSelectResult.data.selected_host_id });
      }

      if (atomicSelectResult.kind === 'error') {
        return NextResponse.json(
          { success: false, error: atomicSelectResult.error },
          { status: atomicSelectResult.status }
        );
      }

      // [CRITICAL] RPC 미배포(missing) → 비원자적 폴백은 이중 선택 race 위험 → 503 차단
      return NextResponse.json(
        { success: false, error: '서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }

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

    if (forcedFailureStage === 'after-booking-update') {
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

    if (forcedFailureStage === 'after-selected-application-update') {
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

    if (forcedFailureStage === 'after-rejected-applications-update') {
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

    notifyServiceHostSelection({
      supabaseAdmin,
      requestId: request_id,
      requestTitle: serviceRequest.title,
      selectedHostId,
      rejectedHostIds,
    });

    return NextResponse.json({ success: true, selectedHostId });

  } catch (error: unknown) {
    console.error('API Select Host Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
