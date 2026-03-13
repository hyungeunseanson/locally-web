import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { isConfirmedBookingStatus } from '@/app/constants/bookingStatus';
import { isCompletedServiceBooking, isPaidServiceBooking } from '@/app/constants/serviceStatus';
import { normalizeLanguageList, normalizeProfileLanguageValue } from '@/app/utils/profile';

type AnalyticsBookingRow = {
  user_id: string | null;
  status: string | null;
  created_at: string | null;
};

type AnalyticsServiceBookingRow = {
  customer_id: string | null;
  status: string | null;
  created_at: string | null;
};

type AnalyticsProfileRow = {
  id: string;
  nationality: string | null;
  languages: string[] | string | null;
};

type AnalyticsEventSourceRow = {
  user_id: string | null;
  created_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  referrer_host: string | null;
  landing_path: string | null;
};

type CompositionBucket = {
  name: string;
  customers: number;
  percent: number;
};

type CustomerStats = {
  transactions: number;
  hasExperiencePurchase: boolean;
  hasServicePurchase: boolean;
};

type SourceStatus = 'ready' | 'collecting' | 'unavailable';

function toBuckets(counts: Record<string, number>, totalCustomers: number): CompositionBucket[] {
  return Object.entries(counts)
    .filter(([, customers]) => customers > 0)
    .map(([name, customers]) => ({
      name,
      customers,
      percent: totalCustomers > 0 ? (customers / totalCustomers) * 100 : 0,
    }))
    .sort((left, right) => right.customers - left.customers);
}

function getSourceLabel(event: AnalyticsEventSourceRow) {
  const utmSource = String(event.utm_source || '').trim();
  const utmMedium = String(event.utm_medium || '').trim();
  const referrerHost = String(event.referrer_host || '').trim().replace(/^www\./i, '');
  const landingPath = String(event.landing_path || '').trim();

  if (utmSource) {
    return utmMedium ? `${utmSource} (${utmMedium})` : utmSource;
  }

  if (referrerHost) {
    return referrerHost;
  }

  if (landingPath) {
    return '직접 방문';
  }

  return '';
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const startAt = requestUrl.searchParams.get('startAt');
    const endAt = requestUrl.searchParams.get('endAt');

    if (startAt && Number.isNaN(Date.parse(startAt))) {
      return NextResponse.json({ success: false, error: 'Invalid startAt' }, { status: 400 });
    }

    if (endAt && Number.isNaN(Date.parse(endAt))) {
      return NextResponse.json({ success: false, error: 'Invalid endAt' }, { status: 400 });
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
    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('user_id, status, created_at')
      .in('status', ['PAID', 'confirmed', 'completed']);

    let serviceBookingsQuery = supabaseAdmin
      .from('service_bookings')
      .select('customer_id, status, created_at')
      .in('status', ['PAID', 'confirmed', 'completed']);

    if (startAt) {
      bookingsQuery = bookingsQuery.gte('created_at', startAt);
      serviceBookingsQuery = serviceBookingsQuery.gte('created_at', startAt);
    }

    if (endAt) {
      bookingsQuery = bookingsQuery.lte('created_at', endAt);
      serviceBookingsQuery = serviceBookingsQuery.lte('created_at', endAt);
    }

    const [
      { data: bookingRows, error: bookingsError },
      { data: serviceBookingRows, error: serviceBookingsError },
    ] = await Promise.all([bookingsQuery, serviceBookingsQuery]);

    if (bookingsError) throw bookingsError;
    if (serviceBookingsError) throw serviceBookingsError;

    const customerStats = new Map<string, CustomerStats>();

    ((bookingRows || []) as AnalyticsBookingRow[]).forEach((booking) => {
      if (!booking.user_id || !isConfirmedBookingStatus(booking.status || '')) return;

      const current = customerStats.get(booking.user_id) || {
        transactions: 0,
        hasExperiencePurchase: false,
        hasServicePurchase: false,
      };

      current.transactions += 1;
      current.hasExperiencePurchase = true;
      customerStats.set(booking.user_id, current);
    });

    ((serviceBookingRows || []) as AnalyticsServiceBookingRow[]).forEach((booking) => {
      if (!booking.customer_id) return;
      if (!isPaidServiceBooking(booking.status || '') && !isCompletedServiceBooking(booking.status || '')) return;

      const current = customerStats.get(booking.customer_id) || {
        transactions: 0,
        hasExperiencePurchase: false,
        hasServicePurchase: false,
      };

      current.transactions += 1;
      current.hasServicePurchase = true;
      customerStats.set(booking.customer_id, current);
    });

    const customerIds = Array.from(customerStats.keys());
    const totalPayingCustomers = customerIds.length;

    let profileRows: AnalyticsProfileRow[] = [];

    if (customerIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, nationality, languages')
        .in('id', customerIds);

      if (profilesError) throw profilesError;
      profileRows = (profiles || []) as AnalyticsProfileRow[];
    }

    const nationalityCounts: Record<string, number> = {};
    const languageCounts: Record<string, number> = {};
    const loyaltyCounts: Record<string, number> = {
      '신규 결제 고객': 0,
      '반복 결제 고객': 0,
    };
    const purchaseCounts: Record<string, number> = {
      '체험 전용': 0,
      '서비스 전용': 0,
      '체험 + 서비스': 0,
    };
    const sourceCounts: Record<string, number> = {};
    let sourceTrackedCustomers = 0;
    let sourceStatus: SourceStatus = 'collecting';

    customerStats.forEach((stat) => {
      if (stat.transactions >= 2) {
        loyaltyCounts['반복 결제 고객'] += 1;
      } else {
        loyaltyCounts['신규 결제 고객'] += 1;
      }

      if (stat.hasExperiencePurchase && stat.hasServicePurchase) {
        purchaseCounts['체험 + 서비스'] += 1;
      } else if (stat.hasExperiencePurchase) {
        purchaseCounts['체험 전용'] += 1;
      } else {
        purchaseCounts['서비스 전용'] += 1;
      }
    });

    profileRows.forEach((profile) => {
      const nationality = String(profile.nationality || '미입력').trim() || '미입력';
      nationalityCounts[nationality] = (nationalityCounts[nationality] || 0) + 1;

      const languages = normalizeLanguageList(profile.languages)
        .map((language) => normalizeProfileLanguageValue(language))
        .filter(Boolean);

      if (languages.length === 0) {
        languageCounts['미입력'] = (languageCounts['미입력'] || 0) + 1;
        return;
      }

      const uniqueLanguages = Array.from(new Set(languages));
      uniqueLanguages.forEach((language) => {
        languageCounts[language] = (languageCounts[language] || 0) + 1;
      });
    });

    if (customerIds.length > 0) {
      try {
        let sourceEventsQuery = supabaseAdmin
          .from('analytics_events')
          .select('user_id, created_at, utm_source, utm_medium, referrer_host, landing_path')
          .in('user_id', customerIds)
          .in('event_type', ['view', 'click', 'payment_init']);

        if (startAt) {
          sourceEventsQuery = sourceEventsQuery.gte('created_at', startAt);
        }

        if (endAt) {
          sourceEventsQuery = sourceEventsQuery.lte('created_at', endAt);
        }

        const { data: sourceEvents, error: sourceEventsError } = await sourceEventsQuery;

        if (sourceEventsError) throw sourceEventsError;

        const firstSourceByCustomer = new Map<string, string>();

        ((sourceEvents || []) as AnalyticsEventSourceRow[])
          .filter((event) => Boolean(event.user_id))
          .sort((left, right) => {
            const leftTime = new Date(left.created_at || 0).getTime();
            const rightTime = new Date(right.created_at || 0).getTime();
            return leftTime - rightTime;
          })
          .forEach((event) => {
            const userId = event.user_id;
            if (!userId || firstSourceByCustomer.has(userId)) return;

            const label = getSourceLabel(event);
            if (!label) return;

            firstSourceByCustomer.set(userId, label);
          });

        sourceTrackedCustomers = firstSourceByCustomer.size;

        if (sourceTrackedCustomers > 0) {
          sourceStatus = 'ready';
          firstSourceByCustomer.forEach((label) => {
            sourceCounts[label] = (sourceCounts[label] || 0) + 1;
          });
        }
      } catch (sourceError) {
        console.warn('[api/admin/analytics-customer-composition] source mix unavailable', sourceError);
        sourceStatus = 'unavailable';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalPayingCustomers,
        nationalityMix: toBuckets(nationalityCounts, totalPayingCustomers).slice(0, 6),
        languageMix: toBuckets(languageCounts, totalPayingCustomers).slice(0, 6),
        loyaltyMix: toBuckets(loyaltyCounts, totalPayingCustomers),
        purchaseMix: toBuckets(purchaseCounts, totalPayingCustomers),
        sourceAvailable: sourceStatus === 'ready',
        sourceStatus,
        sourceTrackedCustomers,
        sourceMix: toBuckets(sourceCounts, sourceTrackedCustomers).slice(0, 6),
      },
    });
  } catch (error) {
    console.error('[api/admin/analytics-customer-composition] error', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build analytics customer composition summary' },
      { status: 500 }
    );
  }
}
