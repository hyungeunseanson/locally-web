import { NextResponse } from 'next/server';

import {
  SERVICE_BOOKING_ACTIVE_STATUSES,
  SERVICE_REQUEST_ACTIVE_STATUSES,
} from '@/app/constants/serviceStatus';
import { createAdminClient } from '@/app/utils/supabase/admin';

type ServiceCompletionRequestRow = {
  id: string;
  service_date: string | null;
  status: string;
  selected_host_id: string | null;
};

type ServiceCompletionBookingRow = {
  id: string;
  request_id: string | null;
  status: string;
  host_id: string | null;
};

function getTodayKSTDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const todayKST = getTodayKSTDateString();

    const { data: candidateRequestsRaw, error: requestError } = await supabaseAdmin
      .from('service_requests')
      .select('id, service_date, status, selected_host_id')
      .lt('service_date', todayKST)
      .in('status', [...SERVICE_REQUEST_ACTIVE_STATUSES]);

    if (requestError) throw requestError;

    const candidateRequests = ((candidateRequestsRaw || []) as ServiceCompletionRequestRow[])
      .filter((row) => row.selected_host_id);

    if (candidateRequests.length === 0) {
      return NextResponse.json({
        success: true,
        requestCount: 0,
        bookingCount: 0,
        requestIds: [],
        bookingIds: [],
      });
    }

    const requestIds = candidateRequests.map((row) => row.id);
    const { data: candidateBookingsRaw, error: bookingError } = await supabaseAdmin
      .from('service_bookings')
      .select('id, request_id, status, host_id')
      .in('request_id', requestIds)
      .in('status', [...SERVICE_BOOKING_ACTIVE_STATUSES]);

    if (bookingError) throw bookingError;

    const candidateBookings = ((candidateBookingsRaw || []) as ServiceCompletionBookingRow[])
      .filter((row) => row.host_id && row.request_id);

    if (candidateBookings.length === 0) {
      return NextResponse.json({
        success: true,
        requestCount: 0,
        bookingCount: 0,
        requestIds: [],
        bookingIds: [],
      });
    }

    const bookingIdsToComplete = candidateBookings.map((row) => row.id);
    const requestIdsToComplete = Array.from(
      new Set(candidateBookings.map((row) => row.request_id).filter(Boolean))
    ) as string[];

    const [{ error: updateBookingError }, { error: updateRequestError }] = await Promise.all([
      supabaseAdmin
        .from('service_bookings')
        .update({ status: 'completed' })
        .in('id', bookingIdsToComplete)
        .in('status', [...SERVICE_BOOKING_ACTIVE_STATUSES]),
      supabaseAdmin
        .from('service_requests')
        .update({ status: 'completed' })
        .in('id', requestIdsToComplete)
        .in('status', [...SERVICE_REQUEST_ACTIVE_STATUSES]),
    ]);

    if (updateBookingError) throw updateBookingError;
    if (updateRequestError) throw updateRequestError;

    console.log(
      `[CRON] Auto-completed ${bookingIdsToComplete.length} service bookings across ${requestIdsToComplete.length} requests.`
    );

    return NextResponse.json({
      success: true,
      requestCount: requestIdsToComplete.length,
      bookingCount: bookingIdsToComplete.length,
      requestIds: requestIdsToComplete,
      bookingIds: bookingIdsToComplete,
      completedBeforeDate: todayKST,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[CRON complete-services] error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
