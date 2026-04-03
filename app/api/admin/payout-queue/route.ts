import { NextResponse } from 'next/server';

import type {
  AdminCombinedPayoutQueueRow,
  AdminPayoutQueueDomainGroup,
  AdminPayoutQueueEntry,
} from '@/app/types/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { getBookingHostPayout, getBookingPlatformRevenue } from '@/app/utils/bookingFinance';
import { attachNullPayoutPaidAt, isMissingPayoutPaidAtColumnError } from '@/app/utils/payoutPaidAt';
import { getExperiencePayoutQueueState } from '@/app/utils/payoutQueue';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type ExperienceQueueRow = {
  id: string;
  order_id: string | null;
  created_at: string;
  date: string | null;
  time: string | null;
  amount: number;
  status: string;
  payout_status: string | null;
  payout_paid_at: string | null;
  host_payout_amount: number | null;
  platform_revenue: number | null;
  experience_id: number | null;
  user_id: string | null;
};

type ExperienceMetaRow = {
  id: number;
  title: string | null;
  host_id: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email?: string | null;
};

type HostApplicationRow = {
  user_id: string;
  name: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  host_nationality: string | null;
  created_at: string;
};

type ServiceQueueRow = {
  id: string;
  order_id: string | null;
  request_id: string | null;
  customer_id: string | null;
  host_id: string | null;
  amount: number;
  status: string;
  payout_status: string | null;
  payout_paid_at: string | null;
  host_payout_amount: number | null;
  platform_revenue: number | null;
  created_at: string;
};

type ServiceRequestRow = {
  id: string;
  title: string | null;
  service_date: string | null;
  start_time: string | null;
  contact_name: string | null;
  status: string | null;
};

function sortEntriesDesc(left: AdminPayoutQueueEntry, right: AdminPayoutQueueEntry) {
  return left.created_at < right.created_at ? 1 : -1;
}

function createEmptyDomainGroup(params: {
  hostId: string;
  hostName: string;
  bank: string;
  accountNumber: string;
  accountHolder: string;
  hostNationality: string;
  settlementState: AdminPayoutQueueDomainGroup['settlement_state'];
}): AdminPayoutQueueDomainGroup {
  return {
    host_id: params.hostId,
    host_name: params.hostName,
    bank: params.bank,
    account_number: params.accountNumber,
    account_holder: params.accountHolder,
    host_nationality: params.hostNationality,
    pending_amount: 0,
    paid_amount: 0,
    pending_count: 0,
    paid_count: 0,
    oldest_pending_created_at: null,
    settlement_state: params.settlementState,
    pending_entries: [],
    paid_entries: [],
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

    const buildExperienceQuery = (includePaidAt: boolean) => {
      const selectColumns = includePaidAt
        ? 'id, order_id, created_at, date, time, amount, status, payout_status, payout_paid_at, host_payout_amount, platform_revenue, experience_id, user_id'
        : 'id, order_id, created_at, date, time, amount, status, payout_status, host_payout_amount, platform_revenue, experience_id, user_id';

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
        query = query.limit(1500);
      }

      return query;
    };

    const buildServiceQuery = (includePaidAt: boolean) => {
      const selectColumns = includePaidAt
        ? 'id, order_id, request_id, customer_id, host_id, amount, status, payout_status, payout_paid_at, host_payout_amount, platform_revenue, created_at'
        : 'id, order_id, request_id, customer_id, host_id, amount, status, payout_status, host_payout_amount, platform_revenue, created_at';

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
        query = query.limit(1500);
      }

      return query;
    };

    let [
      { data: experienceRowsRaw, error: experienceError },
      { data: serviceRowsRaw, error: serviceError },
    ] = await Promise.all([buildExperienceQuery(true), buildServiceQuery(true)]);

    if (experienceError && isMissingPayoutPaidAtColumnError(experienceError)) {
      const fallbackResult = await buildExperienceQuery(false);
      experienceRowsRaw = attachNullPayoutPaidAt(fallbackResult.data);
      experienceError = fallbackResult.error;
    }

    if (serviceError && isMissingPayoutPaidAtColumnError(serviceError)) {
      const fallbackResult = await buildServiceQuery(false);
      serviceRowsRaw = attachNullPayoutPaidAt(fallbackResult.data);
      serviceError = fallbackResult.error;
    }

    if (experienceError) throw experienceError;
    if (serviceError) throw serviceError;

    const experienceRows = (experienceRowsRaw || []) as ExperienceQueueRow[];
    const serviceRows = (serviceRowsRaw || []) as ServiceQueueRow[];

    const experienceIds = Array.from(
      new Set(experienceRows.map((row) => row.experience_id).filter(Boolean))
    ) as number[];
    const serviceRequestIds = Array.from(
      new Set(serviceRows.map((row) => row.request_id).filter(Boolean))
    ) as string[];
    const guestIds = Array.from(
      new Set([
        ...experienceRows.map((row) => row.user_id),
        ...serviceRows.map((row) => row.customer_id),
      ].filter(Boolean))
    ) as string[];

    const [
      { data: experiencesRaw, error: experiencesError },
      { data: serviceRequestsRaw, error: serviceRequestsError },
      { data: guestProfilesRaw, error: guestProfilesError },
    ] = await Promise.all([
      experienceIds.length > 0
        ? supabaseAdmin.from('experiences').select('id, title, host_id').in('id', experienceIds)
        : Promise.resolve({ data: [], error: null }),
      serviceRequestIds.length > 0
        ? supabaseAdmin
            .from('service_requests')
            .select('id, title, service_date, start_time, contact_name, status')
            .in('id', serviceRequestIds)
        : Promise.resolve({ data: [], error: null }),
      guestIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, full_name, email').in('id', guestIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (experiencesError) throw experiencesError;
    if (serviceRequestsError) throw serviceRequestsError;
    if (guestProfilesError) throw guestProfilesError;

    const experienceMap = new Map(
      ((experiencesRaw || []) as ExperienceMetaRow[]).map((row) => [row.id, row])
    );
    const serviceRequestMap = new Map(
      ((serviceRequestsRaw || []) as ServiceRequestRow[]).map((row) => [row.id, row])
    );
    const guestProfileMap = new Map(
      ((guestProfilesRaw || []) as ProfileRow[]).map((row) => [row.id, row])
    );

    const hostIds = Array.from(
      new Set([
        ...((experiencesRaw || []) as ExperienceMetaRow[]).map((row) => row.host_id),
        ...serviceRows.map((row) => row.host_id),
      ].filter(Boolean))
    ) as string[];

    const [
      { data: hostProfilesRaw, error: hostProfilesError },
      { data: hostApplicationsRaw, error: hostApplicationsError },
    ] = await Promise.all([
      hostIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, full_name').in('id', hostIds)
        : Promise.resolve({ data: [], error: null }),
      hostIds.length > 0
        ? supabaseAdmin
            .from('host_applications')
            .select('user_id, name, bank_name, account_number, account_holder, host_nationality, created_at')
            .in('user_id', hostIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (hostProfilesError) throw hostProfilesError;
    if (hostApplicationsError) throw hostApplicationsError;

    const hostProfileMap = new Map(
      ((hostProfilesRaw || []) as ProfileRow[]).map((row) => [row.id, row])
    );
    const hostApplicationMap = new Map<string, HostApplicationRow>();

    for (const application of (hostApplicationsRaw || []) as HostApplicationRow[]) {
      if (application.user_id && !hostApplicationMap.has(application.user_id)) {
        hostApplicationMap.set(application.user_id, application);
      }
    }

    const experienceGroupsMap = new Map<string, AdminPayoutQueueDomainGroup>();
    for (const booking of experienceRows) {
      const experience = booking.experience_id ? experienceMap.get(booking.experience_id) : null;
      const hostId = experience?.host_id;
      if (!hostId) continue;

      const payoutAmount = getBookingHostPayout(booking);
      if (booking.status === 'cancelled' && payoutAmount <= 0) {
        continue;
      }

      const guestProfile = booking.user_id ? guestProfileMap.get(booking.user_id) : null;
      const hostProfile = hostProfileMap.get(hostId);
      const hostApplication = hostApplicationMap.get(hostId);
      const hostName = hostApplication?.name || hostProfile?.full_name || '알 수 없는 호스트';
      const bank = hostApplication?.bank_name || '계좌 미등록';
      const accountNumber = hostApplication?.account_number || '';
      const accountHolder = hostApplication?.account_holder || '-';
      const hostNationality = hostApplication?.host_nationality || '-';

      if (!experienceGroupsMap.has(hostId)) {
        experienceGroupsMap.set(
          hostId,
          createEmptyDomainGroup({
            hostId,
            hostName,
            bank,
            accountNumber,
            accountHolder,
            hostNationality,
            settlementState: 'completed',
          })
        );
      }

      const group = experienceGroupsMap.get(hostId);
      if (!group) continue;

      const entry: AdminPayoutQueueEntry = {
        id: booking.id,
        order_id: booking.order_id,
        domain: 'experience',
        created_at: booking.created_at,
        payout_paid_at: booking.payout_paid_at,
        date: booking.date,
        time: booking.time,
        title: experience?.title || 'Unknown Experience',
        guest_name: guestProfile?.full_name || 'No Name',
        amount: booking.amount || 0,
        payout_amount: payoutAmount,
        platform_revenue: getBookingPlatformRevenue(booking),
        status: booking.status,
        payout_status: booking.payout_status,
      };

      if (booking.payout_status === 'paid') {
        group.paid_entries.push(entry);
        group.paid_amount += entry.payout_amount;
        group.paid_count += 1;
      } else {
        group.pending_entries.push(entry);
        group.pending_amount += entry.payout_amount;
        group.pending_count += 1;
        if (!group.oldest_pending_created_at || booking.created_at < group.oldest_pending_created_at) {
          group.oldest_pending_created_at = booking.created_at;
        }
      }
    }

    const serviceGroupsMap = new Map<string, AdminPayoutQueueDomainGroup>();
    for (const booking of serviceRows) {
      if (!booking.host_id) continue;

      const isPendingServicePayout = booking.status === 'completed' && booking.payout_status !== 'paid';
      const isPaidServiceHistory =
        booking.payout_status === 'paid' && ['PAID', 'confirmed', 'completed'].includes(booking.status);

      if (!isPendingServicePayout && !isPaidServiceHistory) {
        continue;
      }

      const hostId = booking.host_id;
      const requestInfo = booking.request_id ? serviceRequestMap.get(booking.request_id) : null;
      const customerProfile = booking.customer_id ? guestProfileMap.get(booking.customer_id) : null;
      const hostProfile = hostProfileMap.get(hostId);
      const hostApplication = hostApplicationMap.get(hostId);
      const hostName = hostApplication?.name || hostProfile?.full_name || '알 수 없는 호스트';
      const bank = hostApplication?.bank_name || '계좌 미등록';
      const accountNumber = hostApplication?.account_number || '';
      const accountHolder = hostApplication?.account_holder || '-';
      const hostNationality = hostApplication?.host_nationality || '-';

      if (!serviceGroupsMap.has(hostId)) {
        serviceGroupsMap.set(
          hostId,
          createEmptyDomainGroup({
            hostId,
            hostName,
            bank,
            accountNumber,
            accountHolder,
            hostNationality,
            settlementState: 'completed',
          })
        );
      }

      const group = serviceGroupsMap.get(hostId);
      if (!group) continue;

      const entry: AdminPayoutQueueEntry = {
        id: booking.id,
        order_id: booking.order_id,
        domain: 'service',
        created_at: booking.created_at,
        payout_paid_at: booking.payout_paid_at,
        date: requestInfo?.service_date || null,
        time: requestInfo?.start_time || null,
        title: requestInfo?.title || '맞춤 서비스',
        guest_name: customerProfile?.full_name || requestInfo?.contact_name || 'No Name',
        amount: booking.amount || 0,
        payout_amount: Number(booking.host_payout_amount || 0),
        platform_revenue: Number(booking.platform_revenue || 0),
        status: booking.status,
        payout_status: booking.payout_status,
      };

      if (isPaidServiceHistory) {
        group.paid_entries.push(entry);
        group.paid_amount += entry.payout_amount;
        group.paid_count += 1;
      } else {
        group.pending_entries.push(entry);
        group.pending_amount += entry.payout_amount;
        group.pending_count += 1;
        if (!group.oldest_pending_created_at || booking.created_at < group.oldest_pending_created_at) {
          group.oldest_pending_created_at = booking.created_at;
        }
      }
    }

    const experienceGroups = Array.from(experienceGroupsMap.values())
      .map((group) => {
        const pending_entries = [...group.pending_entries].sort(sortEntriesDesc);
        const paid_entries = [...group.paid_entries].sort(sortEntriesDesc);

        return {
          ...group,
          pending_entries,
          paid_entries,
          settlement_state:
            group.pending_count > 0
              ? getExperiencePayoutQueueState({
                  pendingAmount: group.pending_amount,
                  oldestPendingCreatedAt: group.oldest_pending_created_at,
                })
              : 'completed',
        };
      })
      .sort((left, right) => right.pending_amount - left.pending_amount);

    const serviceGroups = Array.from(serviceGroupsMap.values())
      .map((group) => ({
        ...group,
        pending_entries: [...group.pending_entries].sort(sortEntriesDesc),
        paid_entries: [...group.paid_entries].sort(sortEntriesDesc),
        settlement_state: group.pending_count > 0 ? 'eligible' : 'completed',
      }))
      .sort((left, right) => right.pending_amount - left.pending_amount);

    const experienceGroupMap = new Map(experienceGroups.map((group) => [group.host_id, group]));
    const serviceGroupMap = new Map(serviceGroups.map((group) => [group.host_id, group]));
    const allHostIds = Array.from(
      new Set([...experienceGroupMap.keys(), ...serviceGroupMap.keys()])
    );

    const combinedHostTotals: AdminCombinedPayoutQueueRow[] = allHostIds.map((hostId) => {
      const experienceGroup = experienceGroupMap.get(hostId) || null;
      const serviceGroup = serviceGroupMap.get(hostId) || null;
      const fallback = experienceGroup || serviceGroup;

      const pending_amount =
        (experienceGroup?.pending_amount || 0) + (serviceGroup?.pending_amount || 0);
      const paid_amount = (experienceGroup?.paid_amount || 0) + (serviceGroup?.paid_amount || 0);
      const pending_count =
        (experienceGroup?.pending_count || 0) + (serviceGroup?.pending_count || 0);
      const paid_count = (experienceGroup?.paid_count || 0) + (serviceGroup?.paid_count || 0);

      let settlement_state: AdminCombinedPayoutQueueRow['settlement_state'] = 'completed';
      if ((serviceGroup?.pending_count || 0) > 0) {
        settlement_state = 'eligible';
      } else if ((experienceGroup?.pending_count || 0) > 0) {
        settlement_state = experienceGroup?.settlement_state || 'hold';
      }

      return {
        host_id: hostId,
        host_name: fallback?.host_name || '알 수 없는 호스트',
        bank: fallback?.bank || '계좌 미등록',
        account_number: fallback?.account_number || '',
        account_holder: fallback?.account_holder || '-',
        host_nationality: fallback?.host_nationality || '-',
        pending_amount,
        paid_amount,
        pending_count,
        paid_count,
        settlement_state,
        domains: {
          experience: experienceGroup,
          service: serviceGroup,
        },
      };
    });

    return NextResponse.json({
      success: true,
      experienceGroups,
      serviceGroups,
      combinedHostTotals,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/payout-queue error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
