import type { PostgrestError } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import type { AdminSalesBooking, AdminServiceSalesSummary } from '@/app/types/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
  type AdminRawRow,
  isPresent,
  readNumberField,
  readStringField,
  toAdminRawRows,
} from '@/app/utils/adminRowHelpers';
import { attachNullPayoutPaidAt, isMissingPayoutPaidAtColumnError } from '@/app/utils/payoutPaidAt';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type SalesBookingBase = {
  id: string;
  order_id: string | null;
  created_at: string;
  experience_id: number;
  user_id: string;
  amount: number;
  status: string;
  date: string;
  time: string;
  contact_name?: string;
  contact_phone?: string;
  guests?: number;
  payout_status: string | null;
  payout_paid_at: string | null;
  host_payout_amount: number | null;
  platform_revenue: number | null;
  refund_amount: number | null;
  payment_method: string | null;
  total_price?: number | null;
  total_experience_price?: number | null;
  price_at_booking?: number | null;
  solo_guarantee_price?: number | null;
};

type SalesExperienceRow = {
  id: number;
  title: string | null;
  host_id: string | null;
};

type SalesProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type SalesHostApplicationRow = {
  user_id: string;
  name: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  host_nationality: string | null;
};

type RowQueryResult = {
  data: AdminRawRow[];
  error: PostgrestError | null;
};

async function executeRowQuery(
  query: PromiseLike<{ data: unknown; error: PostgrestError | null }>
): Promise<RowQueryResult> {
  const { data, error } = await query;
  return {
    data: toAdminRawRows(data),
    error,
  };
}

function normalizeSalesBookingBase(row: AdminRawRow): SalesBookingBase | null {
  const id = readStringField(row, 'id');
  const createdAt = readStringField(row, 'created_at');
  const experienceId = readNumberField(row, 'experience_id');
  const userId = readStringField(row, 'user_id');
  const amount = readNumberField(row, 'amount');
  const status = readStringField(row, 'status');
  const date = readStringField(row, 'date');

  if (!id || !createdAt || experienceId == null || !userId || amount == null || !status || !date) {
    return null;
  }

  return {
    id,
    order_id: readStringField(row, 'order_id'),
    created_at: createdAt,
    experience_id: experienceId,
    user_id: userId,
    amount,
    status,
    date,
    time: readStringField(row, 'time') ?? '',
    contact_name: readStringField(row, 'contact_name') ?? undefined,
    contact_phone: readStringField(row, 'contact_phone') ?? undefined,
    guests: readNumberField(row, 'guests') ?? undefined,
    payout_status: readStringField(row, 'payout_status'),
    payout_paid_at: readStringField(row, 'payout_paid_at'),
    host_payout_amount: readNumberField(row, 'host_payout_amount'),
    platform_revenue: readNumberField(row, 'platform_revenue'),
    refund_amount: readNumberField(row, 'refund_amount'),
    payment_method: readStringField(row, 'payment_method'),
    total_price: readNumberField(row, 'total_price'),
    total_experience_price: readNumberField(row, 'total_experience_price'),
    price_at_booking: readNumberField(row, 'price_at_booking'),
    solo_guarantee_price: readNumberField(row, 'solo_guarantee_price'),
  };
}

function normalizeServiceSalesSummary(row: AdminRawRow): AdminServiceSalesSummary | null {
  const amount = readNumberField(row, 'amount');
  const status = readStringField(row, 'status');
  const createdAt = readStringField(row, 'created_at');

  if (amount == null || !status || !createdAt) {
    return null;
  }

  return {
    amount,
    host_payout_amount: readNumberField(row, 'host_payout_amount'),
    platform_revenue: readNumberField(row, 'platform_revenue'),
    status,
    created_at: createdAt,
    payout_status: readStringField(row, 'payout_status'),
    payout_paid_at: readStringField(row, 'payout_paid_at'),
  };
}

function normalizeSalesExperienceRow(row: AdminRawRow): SalesExperienceRow | null {
  const id = readNumberField(row, 'id');
  if (id == null) {
    return null;
  }

  return {
    id,
    title: readStringField(row, 'title'),
    host_id: readStringField(row, 'host_id'),
  };
}

function normalizeSalesProfileRow(row: AdminRawRow): SalesProfileRow | null {
  const id = readStringField(row, 'id');
  if (!id) {
    return null;
  }

  return {
    id,
    full_name: readStringField(row, 'full_name'),
    email: readStringField(row, 'email'),
  };
}

function normalizeSalesHostApplicationRow(row: AdminRawRow): SalesHostApplicationRow | null {
  const userId = readStringField(row, 'user_id');
  if (!userId) {
    return null;
  }

  return {
    user_id: userId,
    name: readStringField(row, 'name'),
    bank_name: readStringField(row, 'bank_name'),
    account_number: readStringField(row, 'account_number'),
    account_holder: readStringField(row, 'account_holder'),
    host_nationality: readStringField(row, 'host_nationality'),
  };
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

    const buildBookingsQuery = (includePaidAt: boolean) => {
      const selectColumns = includePaidAt
        ? 'id, order_id, created_at, experience_id, user_id, amount, status, date, time, contact_name, contact_phone, guests, payout_status, payout_paid_at, host_payout_amount, platform_revenue, refund_amount, payment_method, total_price, total_experience_price, price_at_booking, solo_guarantee_price'
        : 'id, order_id, created_at, experience_id, user_id, amount, status, date, time, contact_name, contact_phone, guests, payout_status, host_payout_amount, platform_revenue, refund_amount, payment_method, total_price, total_experience_price, price_at_booking, solo_guarantee_price';

      let query = supabaseAdmin
        .from('bookings')
        .select(selectColumns)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false });

      if (startAt) {
        query = query.gte('created_at', startAt);
      }

      if (endAt) {
        query = query.lte('created_at', endAt);
      }

      if (!startAt && !endAt) {
        query = query.limit(1000);
      }

      return executeRowQuery(query);
    };

    const buildServiceSummaryQuery = (includePaidAt: boolean) => {
      const selectColumns = includePaidAt
        ? 'amount, host_payout_amount, platform_revenue, status, created_at, payout_status, payout_paid_at'
        : 'amount, host_payout_amount, platform_revenue, status, created_at, payout_status';

      let query = supabaseAdmin
        .from('service_bookings')
        .select(selectColumns)
        .in('status', ['PAID', 'confirmed', 'completed'])
        .order('created_at', { ascending: false });

      if (startAt) {
        query = query.gte('created_at', startAt);
      }

      if (endAt) {
        query = query.lte('created_at', endAt);
      }

      if (!startAt && !endAt) {
        query = query.limit(1000);
      }

      return executeRowQuery(query);
    };

    let [{ data: salesBookingsRaw, error: bookingsError }, { data: serviceSummaryRowsRaw, error: serviceSummaryError }] =
      await Promise.all([buildBookingsQuery(true), buildServiceSummaryQuery(true)]);

    if (bookingsError && isMissingPayoutPaidAtColumnError(bookingsError)) {
      const fallbackResult = await buildBookingsQuery(false);
      salesBookingsRaw = attachNullPayoutPaidAt(fallbackResult.data);
      bookingsError = fallbackResult.error;
    }

    if (serviceSummaryError && isMissingPayoutPaidAtColumnError(serviceSummaryError)) {
      const fallbackResult = await buildServiceSummaryQuery(false);
      serviceSummaryRowsRaw = attachNullPayoutPaidAt(fallbackResult.data);
      serviceSummaryError = fallbackResult.error;
    }

    if (bookingsError) throw bookingsError;
    if (serviceSummaryError) throw serviceSummaryError;

    const bookingRows = salesBookingsRaw.map(normalizeSalesBookingBase).filter(isPresent);
    const serviceRows = serviceSummaryRowsRaw
      .map(normalizeServiceSalesSummary)
      .filter(isPresent);

    if (bookingRows.length === 0) {
      return NextResponse.json({ success: true, data: [], serviceSummaryRows: serviceRows });
    }

    const experienceIds = Array.from(
      new Set(bookingRows.map((booking) => booking.experience_id).filter(isPresent))
    );
    const guestIds = Array.from(
      new Set(bookingRows.map((booking) => booking.user_id).filter(isPresent))
    );

    const [
      { data: experiencesRaw, error: experiencesError },
      { data: guestProfilesRaw, error: guestProfilesError },
    ] = await Promise.all([
      experienceIds.length > 0
        ? executeRowQuery(
            supabaseAdmin.from('experiences').select('id, title, host_id').in('id', experienceIds)
          )
        : Promise.resolve({ data: [], error: null }),
      guestIds.length > 0
        ? executeRowQuery(
            supabaseAdmin.from('profiles').select('id, full_name, email').in('id', guestIds)
          )
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (experiencesError) throw experiencesError;
    if (guestProfilesError) throw guestProfilesError;

    const experiences = experiencesRaw.map(normalizeSalesExperienceRow).filter(isPresent);
    const guestProfiles = guestProfilesRaw.map(normalizeSalesProfileRow).filter(isPresent);

    const hostIds = Array.from(
      new Set(experiences.map((experience) => experience.host_id).filter(isPresent))
    );

    const [
      { data: hostProfilesRaw, error: hostProfilesError },
      { data: hostApplicationsRaw, error: hostApplicationsError },
    ] = await Promise.all([
      hostIds.length > 0
        ? executeRowQuery(
            supabaseAdmin.from('profiles').select('id, full_name').in('id', hostIds)
          )
        : Promise.resolve({ data: [], error: null }),
      hostIds.length > 0
        ? executeRowQuery(
            supabaseAdmin
              .from('host_applications')
              .select(
                'user_id, name, bank_name, account_number, account_holder, host_nationality, created_at'
              )
              .in('user_id', hostIds)
              .order('created_at', { ascending: false })
          )
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (hostProfilesError) throw hostProfilesError;
    if (hostApplicationsError) throw hostApplicationsError;

    const experienceMap = new Map(experiences.map((experience) => [experience.id, experience]));
    const guestProfileMap = new Map(guestProfiles.map((profile) => [profile.id, profile]));
    const hostProfileMap = new Map(
      hostProfilesRaw.map(normalizeSalesProfileRow).filter(isPresent).map((profile) => [profile.id, profile])
    );
    const hostApplicationMap = new Map<string, SalesHostApplicationRow>();

    for (const application of hostApplicationsRaw
      .map(normalizeSalesHostApplicationRow)
      .filter(isPresent)) {
      if (!hostApplicationMap.has(application.user_id)) {
        hostApplicationMap.set(application.user_id, application);
      }
    }

    const enriched: AdminSalesBooking[] = bookingRows.map((booking) => {
      const experience = experienceMap.get(booking.experience_id) ?? null;
      const guestProfile = guestProfileMap.get(booking.user_id) ?? null;
      const hostProfile = experience?.host_id ? hostProfileMap.get(experience.host_id) : null;
      const hostApplication = experience?.host_id
        ? hostApplicationMap.get(experience.host_id) ?? null
        : null;
      const hostName = hostApplication?.name || hostProfile?.full_name || 'Unknown Host';

      return {
        ...booking,
        experiences: {
          title: experience?.title || 'Unknown Experience',
          host_id: experience?.host_id || '',
          profiles: {
            name: hostName,
          },
        },
        profiles: {
          email: guestProfile?.email || 'No Email',
          name: guestProfile?.full_name || 'No Name',
        },
        host_application: hostApplication
          ? {
              name: hostApplication.name,
              bank_name: hostApplication.bank_name,
              account_number: hostApplication.account_number,
              account_holder: hostApplication.account_holder,
              host_nationality: hostApplication.host_nationality,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, data: enriched, serviceSummaryRows: serviceRows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/sales-summary error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
