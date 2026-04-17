import { NextResponse } from 'next/server';

import type {
  HostServiceEarningsItem,
  HostServiceEarningsResponse,
} from '@/app/types/hostEarnings';
import { buildServiceEarningsSummary, getServiceSettlementStage } from '@/app/utils/hostEarningsSummary';
import { attachNullPayoutPaidAt, isMissingPayoutPaidAtColumnError } from '@/app/utils/payoutPaidAt';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type ServiceEarningsBookingRow = {
  id: string;
  order_id: string | null;
  request_id: string | null;
  host_id: string | null;
  host_payout_amount: number | null;
  payout_status: string | null;
  payout_paid_at: string | null;
  status: string;
  created_at: string;
};

type ServiceRequestMetaRow = {
  id: string;
  title: string | null;
  service_date: string | null;
  start_time: string | null;
};

const INCLUDED_SERVICE_EARNINGS_STATUSES = ['PAID', 'confirmed', 'completed'] as const;
const MAX_SERVICE_EARNINGS_ITEMS = 5;

export async function GET() {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    let { data: serviceBookingsRaw, error: serviceBookingsError } = await supabaseAdmin
      .from('service_bookings')
      .select(
        'id, order_id, request_id, host_id, host_payout_amount, payout_status, payout_paid_at, status, created_at'
      )
      .eq('host_id', user.id)
      .in('status', [...INCLUDED_SERVICE_EARNINGS_STATUSES])
      .order('created_at', { ascending: false });

    if (serviceBookingsError && isMissingPayoutPaidAtColumnError(serviceBookingsError)) {
      const fallbackResult = await supabaseAdmin
        .from('service_bookings')
        .select('id, order_id, request_id, host_id, host_payout_amount, payout_status, status, created_at')
        .eq('host_id', user.id)
        .in('status', [...INCLUDED_SERVICE_EARNINGS_STATUSES])
        .order('created_at', { ascending: false });

      serviceBookingsRaw = attachNullPayoutPaidAt(fallbackResult.data);
      serviceBookingsError = fallbackResult.error;
    }

    if (serviceBookingsError) {
      throw serviceBookingsError;
    }

    const serviceBookings = ((serviceBookingsRaw || []) as ServiceEarningsBookingRow[]).filter(
      (booking) => booking.host_id === user.id && Number(booking.host_payout_amount || 0) > 0
    );

    const recentServiceBookings = serviceBookings.slice(0, MAX_SERVICE_EARNINGS_ITEMS);

    const requestIds = Array.from(
      new Set(recentServiceBookings.map((booking) => booking.request_id).filter(Boolean))
    ) as string[];

    const { data: serviceRequestsRaw, error: serviceRequestsError } = requestIds.length
      ? await supabaseAdmin
          .from('service_requests')
          .select('id, title, service_date, start_time')
          .in('id', requestIds)
      : { data: [], error: null };

    if (serviceRequestsError) {
      throw serviceRequestsError;
    }

    const requestMap = new Map(
      ((serviceRequestsRaw || []) as ServiceRequestMetaRow[]).map((request) => [request.id, request])
    );

    const items: HostServiceEarningsItem[] = recentServiceBookings.map((booking) => {
      const requestMeta = booking.request_id ? requestMap.get(booking.request_id) : null;

      return {
        id: booking.id,
        order_id: booking.order_id || booking.id,
        request_id: booking.request_id,
        title: requestMeta?.title || '맞춤 서비스',
        service_date: requestMeta?.service_date || null,
        start_time: requestMeta?.start_time || null,
        status: booking.status,
        payout_status: booking.payout_status,
        host_payout_amount: Number(booking.host_payout_amount || 0),
        payout_paid_at: booking.payout_paid_at,
        created_at: booking.created_at,
        settlement_stage: getServiceSettlementStage(booking),
      };
    });

    const summary = buildServiceEarningsSummary(serviceBookings);

    const response: HostServiceEarningsResponse = {
      success: true,
      summary,
      items,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[HOST] earnings/services error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load service earnings.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
