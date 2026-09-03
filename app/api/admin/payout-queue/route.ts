import type { PostgrestError } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import type {
  AdminCombinedPayoutQueueRow,
  AdminPayoutQueueDomainGroup,
  AdminPayoutQueueEntry,
} from '@/app/types/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
  type AdminRawRow,
  isPresent,
  readNumberField,
  readStringField,
  toAdminRawRows,
} from '@/app/utils/adminRowHelpers';
import { getBookingHostPayout, getBookingPlatformRevenue } from '@/app/utils/bookingFinance';
import { attachNullPayoutPaidAt, isMissingPayoutPaidAtColumnError } from '@/app/utils/payoutPaidAt';
import { getExperiencePayoutQueueState } from '@/app/utils/payoutQueue';
import { isSoloGuaranteeRefundUnresolvedStatus } from '@/app/utils/soloGuaranteeRefundStatus';
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
  solo_guarantee_refund_status: string | null;
  solo_guarantee_refund_amount: number | null;
};

type ExperienceMetaRow = {
  id: number;
  title: string | null;
  host_id: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type HostApplicationRow = {
  user_id: string;
  name: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  host_nationality: string | null;
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

type RowQueryResult = {
  data: AdminRawRow[];
  error: PostgrestError | null;
};

type PayoutQueueView = 'all' | 'pending' | 'history';

type ManualPayoutRow = {
  id: string;
  request_key: string;
  host_id: string;
  settlement_type: 'host_exit_final' | 'legacy_carryover';
  booking_ids: string[];
  current_booking_amount: number;
  legacy_amount: number;
  total_paid_amount: number;
  reason: string;
  legacy_source_reference: string | null;
  transfer_reference: string;
  paid_by_admin_email: string;
  paid_at: string;
};

const PAYOUT_PAGE_SIZE = 500;
const PAYOUT_MAX_ROWS = 10000;

function isMissingManualPayoutTableError(error: { code?: string; message?: string }) {
  return error.code === '42P01' || error.code === 'PGRST205' || /admin_manual_payouts.*not find/i.test(error.message || '');
}

async function executeRowQuery(
  query: PromiseLike<{ data: unknown; error: PostgrestError | null }>
): Promise<RowQueryResult> {
  const { data, error } = await query;
  return {
    data: toAdminRawRows(data),
    error,
  };
}

function normalizeExperienceQueueRow(row: AdminRawRow): ExperienceQueueRow | null {
  const id = readStringField(row, 'id');
  const createdAt = readStringField(row, 'created_at');
  const amount = readNumberField(row, 'amount');
  const status = readStringField(row, 'status');

  if (!id || !createdAt || amount == null || !status) {
    return null;
  }

  return {
    id,
    order_id: readStringField(row, 'order_id'),
    created_at: createdAt,
    date: readStringField(row, 'date'),
    time: readStringField(row, 'time'),
    amount,
    status,
    payout_status: readStringField(row, 'payout_status'),
    payout_paid_at: readStringField(row, 'payout_paid_at'),
    host_payout_amount: readNumberField(row, 'host_payout_amount'),
    platform_revenue: readNumberField(row, 'platform_revenue'),
    experience_id: readNumberField(row, 'experience_id'),
    user_id: readStringField(row, 'user_id'),
    solo_guarantee_refund_status: readStringField(row, 'solo_guarantee_refund_status'),
    solo_guarantee_refund_amount: readNumberField(row, 'solo_guarantee_refund_amount'),
  };
}

function normalizeExperienceMetaRow(row: AdminRawRow): ExperienceMetaRow | null {
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

function normalizeProfileRow(row: AdminRawRow): ProfileRow | null {
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

function normalizeHostApplicationRow(row: AdminRawRow): HostApplicationRow | null {
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

function normalizeServiceQueueRow(row: AdminRawRow): ServiceQueueRow | null {
  const id = readStringField(row, 'id');
  const createdAt = readStringField(row, 'created_at');
  const amount = readNumberField(row, 'amount');
  const status = readStringField(row, 'status');

  if (!id || !createdAt || amount == null || !status) {
    return null;
  }

  return {
    id,
    order_id: readStringField(row, 'order_id'),
    request_id: readStringField(row, 'request_id'),
    customer_id: readStringField(row, 'customer_id'),
    host_id: readStringField(row, 'host_id'),
    amount,
    status,
    payout_status: readStringField(row, 'payout_status'),
    payout_paid_at: readStringField(row, 'payout_paid_at'),
    host_payout_amount: readNumberField(row, 'host_payout_amount'),
    platform_revenue: readNumberField(row, 'platform_revenue'),
    created_at: createdAt,
  };
}

function normalizeServiceRequestRow(row: AdminRawRow): ServiceRequestRow | null {
  const id = readStringField(row, 'id');
  if (!id) {
    return null;
  }

  return {
    id,
    title: readStringField(row, 'title'),
    service_date: readStringField(row, 'service_date'),
    start_time: readStringField(row, 'start_time'),
    contact_name: readStringField(row, 'contact_name'),
    status: readStringField(row, 'status'),
  };
}

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
    const requestedView = requestUrl.searchParams.get('view') || 'all';

    if (!['all', 'pending', 'history'].includes(requestedView)) {
      return NextResponse.json({ success: false, error: 'Invalid view' }, { status: 400 });
    }
    const view = requestedView as PayoutQueueView;

    if (startAt && Number.isNaN(Date.parse(startAt))) {
      return NextResponse.json({ success: false, error: 'Invalid startAt' }, { status: 400 });
    }

    if (endAt && Number.isNaN(Date.parse(endAt))) {
      return NextResponse.json({ success: false, error: 'Invalid endAt' }, { status: 400 });
    }
    const normalizedStartAt = startAt ? new Date(startAt).toISOString() : null;
    const normalizedEndAt = endAt ? new Date(endAt).toISOString() : null;

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

    let manualPayoutsAvailable = true;
    if (view === 'pending') {
      const availability = await supabaseAdmin
        .from('admin_manual_payouts')
        .select('id', { count: 'exact', head: true });
      if (availability.error) {
        if (!isMissingManualPayoutTableError(availability.error)) throw availability.error;
        manualPayoutsAvailable = false;
      }
    }

    const fetchExperienceRows = async (includePaidAt: boolean) => {
      const selectColumns = includePaidAt
        ? 'id, order_id, created_at, date, time, amount, status, payout_status, payout_paid_at, host_payout_amount, platform_revenue, experience_id, user_id, solo_guarantee_refund_status, solo_guarantee_refund_amount'
        : 'id, order_id, created_at, date, time, amount, status, payout_status, host_payout_amount, platform_revenue, experience_id, user_id, solo_guarantee_refund_status, solo_guarantee_refund_amount';

      const rows: AdminRawRow[] = [];
      for (let offset = 0; offset < PAYOUT_MAX_ROWS; offset += PAYOUT_PAGE_SIZE) {
        let query = supabaseAdmin
          .from('bookings')
          .select(selectColumns)
          .in('status', ['completed', 'COMPLETED', 'cancelled', 'CANCELLED']);

        if (view === 'pending') query = query.or('payout_status.eq.pending,payout_status.is.null');
        if (view === 'history') query = query.eq('payout_status', 'paid');

        const dateColumn = view === 'history' ? 'payout_paid_at' : 'created_at';
        if (view === 'history' && normalizedStartAt && normalizedEndAt) {
          query = query.or(`payout_paid_at.is.null,and(payout_paid_at.gte.${normalizedStartAt},payout_paid_at.lte.${normalizedEndAt})`);
        } else if (view === 'history' && normalizedStartAt) {
          query = query.or(`payout_paid_at.is.null,payout_paid_at.gte.${normalizedStartAt}`);
        } else if (view === 'history' && normalizedEndAt) {
          query = query.or(`payout_paid_at.is.null,payout_paid_at.lte.${normalizedEndAt}`);
        } else {
          if (view !== 'pending' && normalizedStartAt) query = query.gte(dateColumn, normalizedStartAt);
          if (view !== 'pending' && normalizedEndAt) query = query.lte(dateColumn, normalizedEndAt);
        }

        const result = await executeRowQuery(
          query
            .order(dateColumn, { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + PAYOUT_PAGE_SIZE - 1)
        );
        if (result.error) return { data: rows, error: result.error };
        rows.push(...result.data);
        if (result.data.length < PAYOUT_PAGE_SIZE) return { data: rows, error: null };
      }
      throw new Error('체험 정산 데이터가 안전 조회 한도를 초과했습니다. 범위를 점검해 주세요.');
    };

    const fetchServiceRows = async (includePaidAt: boolean) => {
      const selectColumns = includePaidAt
        ? 'id, order_id, request_id, customer_id, host_id, amount, status, payout_status, payout_paid_at, host_payout_amount, platform_revenue, created_at'
        : 'id, order_id, request_id, customer_id, host_id, amount, status, payout_status, host_payout_amount, platform_revenue, created_at';

      const rows: AdminRawRow[] = [];
      for (let offset = 0; offset < PAYOUT_MAX_ROWS; offset += PAYOUT_PAGE_SIZE) {
        let query = supabaseAdmin
          .from('service_bookings')
          .select(selectColumns)
          .in('status', view === 'pending' ? ['completed'] : ['PAID', 'confirmed', 'completed']);

        if (view === 'pending') query = query.or('payout_status.eq.pending,payout_status.is.null');
        if (view === 'history') query = query.eq('payout_status', 'paid');

        const dateColumn = view === 'history' ? 'payout_paid_at' : 'created_at';
        if (view === 'history' && normalizedStartAt && normalizedEndAt) {
          query = query.or(`payout_paid_at.is.null,and(payout_paid_at.gte.${normalizedStartAt},payout_paid_at.lte.${normalizedEndAt})`);
        } else if (view === 'history' && normalizedStartAt) {
          query = query.or(`payout_paid_at.is.null,payout_paid_at.gte.${normalizedStartAt}`);
        } else if (view === 'history' && normalizedEndAt) {
          query = query.or(`payout_paid_at.is.null,payout_paid_at.lte.${normalizedEndAt}`);
        } else {
          if (view !== 'pending' && normalizedStartAt) query = query.gte(dateColumn, normalizedStartAt);
          if (view !== 'pending' && normalizedEndAt) query = query.lte(dateColumn, normalizedEndAt);
        }

        const result = await executeRowQuery(
          query
            .order(dateColumn, { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + PAYOUT_PAGE_SIZE - 1)
        );
        if (result.error) return { data: rows, error: result.error };
        rows.push(...result.data);
        if (result.data.length < PAYOUT_PAGE_SIZE) return { data: rows, error: null };
      }
      throw new Error('서비스 정산 데이터가 안전 조회 한도를 초과했습니다. 범위를 점검해 주세요.');
    };

    let [{ data: experienceRowsRaw, error: experienceError }, { data: serviceRowsRaw, error: serviceError }] =
      await Promise.all([fetchExperienceRows(true), fetchServiceRows(true)]);

    if (experienceError && isMissingPayoutPaidAtColumnError(experienceError)) {
      const fallbackResult = await fetchExperienceRows(false);
      experienceRowsRaw = attachNullPayoutPaidAt(fallbackResult.data);
      experienceError = fallbackResult.error;
    }

    if (serviceError && isMissingPayoutPaidAtColumnError(serviceError)) {
      const fallbackResult = await fetchServiceRows(false);
      serviceRowsRaw = attachNullPayoutPaidAt(fallbackResult.data);
      serviceError = fallbackResult.error;
    }

    if (experienceError) throw experienceError;
    if (serviceError) throw serviceError;

    const experienceRows = experienceRowsRaw.map(normalizeExperienceQueueRow).filter(isPresent);
    const serviceRows = serviceRowsRaw.map(normalizeServiceQueueRow).filter(isPresent);

    const manualPayoutRows: ManualPayoutRow[] = [];
    if (view === 'history') {
      for (let offset = 0; offset < PAYOUT_MAX_ROWS; offset += PAYOUT_PAGE_SIZE) {
        let manualQuery = supabaseAdmin
          .from('admin_manual_payouts')
          .select(
            'id, request_key, host_id, settlement_type, booking_ids, current_booking_amount, legacy_amount, total_paid_amount, reason, legacy_source_reference, transfer_reference, paid_by_admin_email, paid_at'
          );
        if (normalizedStartAt) manualQuery = manualQuery.gte('paid_at', normalizedStartAt);
        if (normalizedEndAt) manualQuery = manualQuery.lte('paid_at', normalizedEndAt);

        const { data, error } = await manualQuery
          .order('paid_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + PAYOUT_PAGE_SIZE - 1);
        if (error) {
          if (isMissingManualPayoutTableError(error)) {
            manualPayoutsAvailable = false;
            break;
          }
          throw error;
        }
        const page = ((data || []) as unknown) as ManualPayoutRow[];
        manualPayoutRows.push(...page);
        if (page.length < PAYOUT_PAGE_SIZE) break;
        if (offset + PAYOUT_PAGE_SIZE >= PAYOUT_MAX_ROWS) {
          throw new Error('수동 정산 이력이 안전 조회 한도를 초과했습니다. 범위를 좁혀 주세요.');
        }
      }
    }

    const experienceIds = Array.from(
      new Set(experienceRows.map((row) => row.experience_id).filter(isPresent))
    );
    const serviceRequestIds = Array.from(
      new Set(serviceRows.map((row) => row.request_id).filter(isPresent))
    );
    const guestIds = Array.from(
      new Set(
        [...experienceRows.map((row) => row.user_id), ...serviceRows.map((row) => row.customer_id)].filter(
          isPresent
        )
      )
    );

    const [
      { data: experiencesRaw, error: experiencesError },
      { data: serviceRequestsRaw, error: serviceRequestsError },
      { data: guestProfilesRaw, error: guestProfilesError },
    ] = await Promise.all([
      experienceIds.length > 0
        ? executeRowQuery(
            supabaseAdmin.from('experiences').select('id, title, host_id').in('id', experienceIds)
          )
        : Promise.resolve({ data: [], error: null }),
      serviceRequestIds.length > 0
        ? executeRowQuery(
            supabaseAdmin
              .from('service_requests')
              .select('id, title, service_date, start_time, contact_name, status')
              .in('id', serviceRequestIds)
          )
        : Promise.resolve({ data: [], error: null }),
      guestIds.length > 0
        ? executeRowQuery(
            supabaseAdmin.from('profiles').select('id, full_name, email').in('id', guestIds)
          )
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (experiencesError) throw experiencesError;
    if (serviceRequestsError) throw serviceRequestsError;
    if (guestProfilesError) throw guestProfilesError;

    const experienceMap = new Map(
      experiencesRaw.map(normalizeExperienceMetaRow).filter(isPresent).map((row) => [row.id, row])
    );
    const serviceRequestMap = new Map(
      serviceRequestsRaw.map(normalizeServiceRequestRow).filter(isPresent).map((row) => [row.id, row])
    );
    const guestProfileMap = new Map(
      guestProfilesRaw.map(normalizeProfileRow).filter(isPresent).map((row) => [row.id, row])
    );

    const hostIds = Array.from(
      new Set(
        [
          ...Array.from(experienceMap.values()).map((row) => row.host_id),
          ...serviceRows.map((row) => row.host_id),
          ...manualPayoutRows.map((row) => row.host_id),
        ].filter(isPresent)
      )
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

    const hostProfileMap = new Map(
      hostProfilesRaw.map(normalizeProfileRow).filter(isPresent).map((row) => [row.id, row])
    );
    const hostApplicationMap = new Map<string, HostApplicationRow>();

    for (const application of hostApplicationsRaw
      .map(normalizeHostApplicationRow)
      .filter(isPresent)) {
      if (!hostApplicationMap.has(application.user_id)) {
        hostApplicationMap.set(application.user_id, application);
      }
    }

    const experienceGroupsMap = new Map<string, AdminPayoutQueueDomainGroup>();
    for (const booking of experienceRows) {
      const experience = booking.experience_id ? experienceMap.get(booking.experience_id) : null;
      const hostId = experience?.host_id;
      if (!hostId) continue;

      const payoutAmount = getBookingHostPayout(booking);
      if (String(booking.status || '').toLowerCase() === 'cancelled' && payoutAmount <= 0) {
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
        amount: booking.amount,
        payout_amount: payoutAmount,
        platform_revenue: getBookingPlatformRevenue(booking),
        status: booking.status,
        payout_status: booking.payout_status,
        solo_guarantee_refund_status: booking.solo_guarantee_refund_status,
        solo_guarantee_refund_amount: booking.solo_guarantee_refund_amount,
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
        amount: booking.amount,
        payout_amount: booking.host_payout_amount ?? 0,
        platform_revenue: booking.platform_revenue ?? 0,
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

    const experienceGroups: AdminPayoutQueueDomainGroup[] = Array.from(experienceGroupsMap.values())
      .map((group) => {
        const pending_entries = [...group.pending_entries].sort(sortEntriesDesc);
        const paid_entries = [...group.paid_entries].sort(sortEntriesDesc);
        const hasUnresolvedSoloRefund = pending_entries.some((entry) =>
          isSoloGuaranteeRefundUnresolvedStatus(entry.solo_guarantee_refund_status)
        );

        return {
          ...group,
          pending_entries,
          paid_entries,
          settlement_state:
            hasUnresolvedSoloRefund
              ? 'refund_hold'
              : group.pending_count > 0
              ? getExperiencePayoutQueueState({
                  pendingAmount: group.pending_amount,
                  oldestPendingCreatedAt: group.oldest_pending_created_at,
                })
              : 'completed',
        };
      })
      .sort((left, right) => right.pending_amount - left.pending_amount);

    const serviceGroups: AdminPayoutQueueDomainGroup[] = Array.from(serviceGroupsMap.values())
      .map((group) => {
        const settlementState: AdminPayoutQueueDomainGroup['settlement_state'] =
          group.pending_count > 0 ? 'eligible' : 'completed';

        return {
          ...group,
          pending_entries: [...group.pending_entries].sort(sortEntriesDesc),
          paid_entries: [...group.paid_entries].sort(sortEntriesDesc),
          settlement_state: settlementState,
        };
      })
      .sort((left, right) => right.pending_amount - left.pending_amount);

    const experienceGroupMap = new Map(experienceGroups.map((group) => [group.host_id, group]));
    const serviceGroupMap = new Map(serviceGroups.map((group) => [group.host_id, group]));
    const manualPayoutMap = new Map<string, ManualPayoutRow[]>();
    for (const record of manualPayoutRows) {
      const records = manualPayoutMap.get(record.host_id) ?? [];
      records.push(record);
      manualPayoutMap.set(record.host_id, records);
    }

    const allHostIds = Array.from(
      new Set([...experienceGroupMap.keys(), ...serviceGroupMap.keys(), ...manualPayoutMap.keys()])
    );

    const combinedHostTotals: AdminCombinedPayoutQueueRow[] = allHostIds.map((hostId) => {
      const experienceGroup = experienceGroupMap.get(hostId) ?? null;
      const serviceGroup = serviceGroupMap.get(hostId) ?? null;
      const fallbackGroup = experienceGroup ?? serviceGroup;
      const hostProfile = hostProfileMap.get(hostId);
      const hostApplication = hostApplicationMap.get(hostId);

      const pending_amount =
        (experienceGroup?.pending_amount ?? 0) + (serviceGroup?.pending_amount ?? 0);
      const paid_amount = (experienceGroup?.paid_amount ?? 0) + (serviceGroup?.paid_amount ?? 0);
      const pending_count =
        (experienceGroup?.pending_count ?? 0) + (serviceGroup?.pending_count ?? 0);
      const paid_count = (experienceGroup?.paid_count ?? 0) + (serviceGroup?.paid_count ?? 0);
      const manual_payouts = manualPayoutMap.get(hostId) ?? [];
      const legacy_paid_amount = manual_payouts.reduce((sum, record) => sum + record.legacy_amount, 0);

      let settlement_state: AdminCombinedPayoutQueueRow['settlement_state'] = 'completed';
      if ((serviceGroup?.pending_count ?? 0) > 0) {
        settlement_state = 'eligible';
      } else if ((experienceGroup?.pending_count ?? 0) > 0) {
        settlement_state = experienceGroup?.settlement_state ?? 'hold';
      }

      return {
        host_id: hostId,
        host_name: fallbackGroup?.host_name || hostApplication?.name || hostProfile?.full_name || '알 수 없는 호스트',
        bank: fallbackGroup?.bank || hostApplication?.bank_name || '계좌 미등록',
        account_number: fallbackGroup?.account_number || hostApplication?.account_number || '',
        account_holder: fallbackGroup?.account_holder || hostApplication?.account_holder || '-',
        host_nationality: fallbackGroup?.host_nationality || hostApplication?.host_nationality || '-',
        pending_amount,
        paid_amount,
        pending_count,
        paid_count,
        legacy_paid_amount,
        actual_disbursed_amount: paid_amount + legacy_paid_amount,
        manual_payouts,
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
      manualPayoutsAvailable,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/payout-queue error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
