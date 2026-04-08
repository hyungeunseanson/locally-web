import { NextResponse } from 'next/server';

import { BOOKING_CONFIRMED_STATUSES } from '@/app/constants/bookingStatus';
import type { HostUnifiedEarningsSummaryResponse } from '@/app/types/hostEarnings';
import {
  buildExperienceEarningsSummary,
  buildServiceEarningsSummary,
  buildUnifiedEarningsSummary,
} from '@/app/utils/hostEarningsSummary';
import { attachNullPayoutPaidAt, isMissingPayoutPaidAtColumnError } from '@/app/utils/payoutPaidAt';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type ExperienceSummaryBookingRow = {
  amount?: number | null;
  total_price?: number | null;
  total_experience_price?: number | null;
  created_at: string;
  date?: string | null;
  status: string;
  host_payout_amount?: number | null;
  platform_revenue?: number | null;
  price_at_booking?: number | null;
  solo_guarantee_price?: number | null;
  payout_status?: string | null;
  payout_paid_at?: string | null;
};

type ServiceSummaryBookingRow = {
  host_payout_amount: number | null;
  payout_paid_at: string | null;
  payout_status: string | null;
  status: string;
};

const INCLUDED_SERVICE_EARNINGS_STATUSES = ['PAID', 'confirmed', 'completed'] as const;

function getRequestedDelayMs(request: Request) {
  if (process.env.NODE_ENV === 'production') return 0;

  const raw = request.headers.get('x-locally-test-delay-host-earnings-summary');
  if (!raw) return 0;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;

  return Math.min(parsed, 3000);
}

export async function GET(request: Request) {
  try {
    const delayMs = getRequestedDelayMs(request);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    let { data: experienceBookingsRaw, error: experienceBookingsError } = await supabaseAdmin
      .from('bookings')
      .select(`
        amount,
        total_price,
        total_experience_price,
        created_at,
        date,
        status,
        host_payout_amount,
        platform_revenue,
        price_at_booking,
        solo_guarantee_price,
        payout_status,
        payout_paid_at,
        experiences!inner ( host_id )
      `)
      .eq('experiences.host_id', user.id)
      .in('status', [...BOOKING_CONFIRMED_STATUSES, 'cancelled', 'CANCELLED']);

    if (experienceBookingsError && isMissingPayoutPaidAtColumnError(experienceBookingsError)) {
      const fallbackResult = await supabaseAdmin
        .from('bookings')
        .select(`
          amount,
          total_price,
          total_experience_price,
          created_at,
          date,
          status,
          host_payout_amount,
          platform_revenue,
          price_at_booking,
          solo_guarantee_price,
          payout_status,
          experiences!inner ( host_id )
        `)
        .eq('experiences.host_id', user.id)
        .in('status', [...BOOKING_CONFIRMED_STATUSES, 'cancelled', 'CANCELLED']);

      experienceBookingsRaw = attachNullPayoutPaidAt(fallbackResult.data);
      experienceBookingsError = fallbackResult.error;
    }

    if (experienceBookingsError) {
      throw experienceBookingsError;
    }

    let { data: serviceBookingsRaw, error: serviceBookingsError } = await supabaseAdmin
      .from('service_bookings')
      .select('host_payout_amount, payout_status, payout_paid_at, status')
      .eq('host_id', user.id)
      .in('status', [...INCLUDED_SERVICE_EARNINGS_STATUSES]);

    if (serviceBookingsError && isMissingPayoutPaidAtColumnError(serviceBookingsError)) {
      const fallbackResult = await supabaseAdmin
        .from('service_bookings')
        .select('host_payout_amount, payout_status, status')
        .eq('host_id', user.id)
        .in('status', [...INCLUDED_SERVICE_EARNINGS_STATUSES]);

      serviceBookingsRaw = attachNullPayoutPaidAt(fallbackResult.data);
      serviceBookingsError = fallbackResult.error;
    }

    if (serviceBookingsError) {
      throw serviceBookingsError;
    }

    const experienceSummary = buildExperienceEarningsSummary(
      (experienceBookingsRaw || []) as ExperienceSummaryBookingRow[]
    );
    const serviceSummary = buildServiceEarningsSummary(
      (serviceBookingsRaw || []) as ServiceSummaryBookingRow[]
    );

    const response: HostUnifiedEarningsSummaryResponse = {
      success: true,
      summary: buildUnifiedEarningsSummary(experienceSummary, serviceSummary),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[HOST] earnings/summary error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load host earnings summary.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
