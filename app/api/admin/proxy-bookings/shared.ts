import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { getProxyPaymentMethod } from '@/app/utils/proxyBooking';

import type { ProxyCategory, ProxyFormData, ProxyPaymentMethod, ProxyStatus } from '@/app/types/proxy';

const ADMIN_PROXY_BOOKING_SELECT = [
  'id',
  'user_id',
  'category',
  'status',
  'form_data',
  'payment_channel',
  'payment_status',
  'locally_order_id',
  'tid',
].join(', ');

export type AdminProxyBookingRow = {
  id: string;
  user_id: string;
  category: ProxyCategory;
  status: ProxyStatus;
  form_data: ProxyFormData;
  payment_channel: 'NAVER' | 'LOCALLY';
  payment_status: 'WAITING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  locally_order_id: string | null;
  tid?: string | null;
};

export async function requireAdminProxyBooking(requestId: string) {
  const supabaseServer = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const supabaseAdmin = createAdminClient();
  const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
    userId: user.id,
    email: user.email,
  });

  if (!isAdmin) {
    return { error: 'Forbidden', status: 403 as const };
  }

  const { data: proxyRequest, error: requestError } = await supabaseAdmin
    .from('proxy_requests')
    .select(ADMIN_PROXY_BOOKING_SELECT)
    .eq('id', requestId)
    .maybeSingle<AdminProxyBookingRow>();

  if (requestError || !proxyRequest) {
    return { error: '전화 예약 요청을 찾을 수 없습니다.', status: 404 as const };
  }

  return {
    user,
    supabaseAdmin,
    proxyRequest,
  };
}

export function getProxyPaymentMethodOrNull(formData: ProxyFormData | null | undefined): ProxyPaymentMethod | null {
  return getProxyPaymentMethod(formData);
}

export async function updateProxyPaymentState(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  requestId: string;
  paymentStatus: 'WAITING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  currentPaymentStatus?: 'WAITING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  requestStatus?: ProxyStatus;
  tid?: string | null;
  paidAt?: string | null;
  refundedAt?: string | null;
}) {
  const basePayload: Record<string, string | null> = {
    payment_status: params.paymentStatus,
  };

  if (params.requestStatus) {
    basePayload.status = params.requestStatus;
  }
  if (params.tid !== undefined) {
    basePayload.tid = params.tid;
  }
  if (params.paidAt !== undefined) {
    basePayload.paid_at = params.paidAt;
  }
  if (params.refundedAt !== undefined) {
    basePayload.refunded_at = params.refundedAt;
  }

  const executeUpdate = async (payload: Record<string, string | null>) => {
    let query = params.supabaseAdmin
      .from('proxy_requests')
      .update(payload)
      .eq('id', params.requestId);

    if (params.currentPaymentStatus) {
      query = query.eq('payment_status', params.currentPaymentStatus);
    }

    const { data, error } = await query.select('id').maybeSingle();
    return { data, error };
  };

  const isMissingOptionalColumnError = (message: string, code?: string | null) => {
    return (
      /column .* does not exist/i.test(message) ||
      /could not find the '.*' column of 'proxy_requests' in the schema cache/i.test(message) ||
      code === 'PGRST204'
    );
  };

  let result = await executeUpdate(basePayload);

  if (result.error && isMissingOptionalColumnError(result.error.message, result.error.code)) {
    const fallbackPayload = { ...basePayload };
    delete fallbackPayload.tid;
    delete fallbackPayload.paid_at;
    delete fallbackPayload.refunded_at;
    result = await executeUpdate(fallbackPayload);
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return Boolean(result.data);
}
