import type { SupabaseClient } from '@supabase/supabase-js';

import { BOOKING_CONFIRMED_STATUSES } from '@/app/constants/bookingStatus';
import {
  SERVICE_BOOKING_ACTIVE_STATUSES,
  SERVICE_BOOKING_COMPLETED_STATUSES,
} from '@/app/constants/serviceStatus';

export type LocallyMembershipStatus = 'none' | 'member' | 'circle';

export type LocallyMembershipSummary = {
  status: LocallyMembershipStatus;
  purchaseCount: number;
  experiencePurchaseCount: number;
  servicePurchaseCount: number;
  firstPurchaseAt: string | null;
  remainingToCircle: number;
};

type MembershipSupabaseClient = SupabaseClient;

type FirstPurchaseRow = {
  created_at: string | null;
};

type BatchBookingPurchaseRow = {
  id?: string | number | null;
  user_id?: string | null;
  created_at?: string | null;
};

type BatchServicePurchaseRow = {
  id?: string | number | null;
  customer_id?: string | null;
  created_at?: string | null;
};

type MembershipPurchaseSourceSummary = {
  count: number;
  firstPurchaseAt: string | null;
};

const SUCCESSFUL_SERVICE_BOOKING_STATUSES = [
  ...SERVICE_BOOKING_ACTIVE_STATUSES,
  ...SERVICE_BOOKING_COMPLETED_STATUSES,
] as const;

const MEMBERSHIP_BATCH_PAGE_SIZE = 1000;

export function getLocallyMembershipStatus(purchaseCount: number): LocallyMembershipStatus {
  if (purchaseCount >= 2) return 'circle';
  if (purchaseCount >= 1) return 'member';
  return 'none';
}

export function getLocallyMembershipMilestone(
  purchaseCount: number
): Exclude<LocallyMembershipStatus, 'none'> | null {
  if (purchaseCount === 1) return 'member';
  if (purchaseCount === 2) return 'circle';
  return null;
}

export function createLocallyMembershipSummary(params: {
  experiencePurchaseCount: number;
  servicePurchaseCount: number;
  firstPurchaseAt: string | null;
}): LocallyMembershipSummary {
  const experiencePurchaseCount = Math.max(0, params.experiencePurchaseCount || 0);
  const servicePurchaseCount = Math.max(0, params.servicePurchaseCount || 0);
  const purchaseCount = experiencePurchaseCount + servicePurchaseCount;

  return {
    status: getLocallyMembershipStatus(purchaseCount),
    purchaseCount,
    experiencePurchaseCount,
    servicePurchaseCount,
    firstPurchaseAt: params.firstPurchaseAt,
    remainingToCircle: Math.max(0, 2 - purchaseCount),
  };
}

function getEarlierDate(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() <= new Date(right).getTime() ? left : right;
}

function normalizeMembershipUserIds(userIds: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      userIds
        .map((userId) => (typeof userId === 'string' ? userId.trim() : ''))
        .filter(Boolean)
    )
  );
}

function summarizeMembershipPurchaseSource<RowType>(
  rows: RowType[],
  readUserId: (row: RowType) => string | null | undefined,
  readCreatedAt: (row: RowType) => string | null | undefined
) {
  const summaryByUserId = new Map<string, MembershipPurchaseSourceSummary>();

  for (const row of rows) {
    const userId = readUserId(row)?.trim();
    if (!userId) continue;

    const existing = summaryByUserId.get(userId) ?? {
      count: 0,
      firstPurchaseAt: null,
    };

    existing.count += 1;
    existing.firstPurchaseAt = getEarlierDate(existing.firstPurchaseAt, readCreatedAt(row) ?? null);
    summaryByUserId.set(userId, existing);
  }

  return summaryByUserId;
}

async function fetchBatchExperiencePurchaseRows(
  supabase: MembershipSupabaseClient,
  userIds: string[]
) {
  const rows: BatchBookingPurchaseRow[] = [];

  for (let offset = 0; ; offset += MEMBERSHIP_BATCH_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, user_id, created_at')
      .in('user_id', userIds)
      .in('status', [...BOOKING_CONFIRMED_STATUSES])
      .order('user_id', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + MEMBERSHIP_BATCH_PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message || 'Failed to load confirmed booking activity.');
    }

    const page = (data || []) as BatchBookingPurchaseRow[];
    rows.push(...page);

    if (page.length < MEMBERSHIP_BATCH_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchBatchServicePurchaseRows(
  supabase: MembershipSupabaseClient,
  userIds: string[]
) {
  const rows: BatchServicePurchaseRow[] = [];

  for (let offset = 0; ; offset += MEMBERSHIP_BATCH_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('service_bookings')
      .select('id, customer_id, created_at')
      .in('customer_id', userIds)
      .in('status', [...SUCCESSFUL_SERVICE_BOOKING_STATUSES])
      .order('customer_id', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + MEMBERSHIP_BATCH_PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message || 'Failed to load service booking activity.');
    }

    const page = (data || []) as BatchServicePurchaseRow[];
    rows.push(...page);

    if (page.length < MEMBERSHIP_BATCH_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchExperiencePurchaseCount(
  supabase: MembershipSupabaseClient,
  userId: string
) {
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', [...BOOKING_CONFIRMED_STATUSES]);

  if (error) {
    throw new Error(error.message || 'Failed to count confirmed bookings.');
  }

  return count ?? 0;
}

async function fetchServicePurchaseCount(
  supabase: MembershipSupabaseClient,
  userId: string
) {
  const { count, error } = await supabase
    .from('service_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', userId)
    .in('status', [...SUCCESSFUL_SERVICE_BOOKING_STATUSES]);

  if (error) {
    throw new Error(error.message || 'Failed to count service bookings.');
  }

  return count ?? 0;
}

async function fetchFirstExperiencePurchaseAt(
  supabase: MembershipSupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('bookings')
    .select('created_at')
    .eq('user_id', userId)
    .in('status', [...BOOKING_CONFIRMED_STATUSES])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<FirstPurchaseRow>();

  if (error) {
    throw new Error(error.message || 'Failed to resolve first booking date.');
  }

  return data?.created_at || null;
}

async function fetchFirstServicePurchaseAt(
  supabase: MembershipSupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('service_bookings')
    .select('created_at')
    .eq('customer_id', userId)
    .in('status', [...SUCCESSFUL_SERVICE_BOOKING_STATUSES])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<FirstPurchaseRow>();

  if (error) {
    throw new Error(error.message || 'Failed to resolve first service booking date.');
  }

  return data?.created_at || null;
}

export async function fetchLocallyMembershipSummary(
  supabase: MembershipSupabaseClient,
  userId: string
): Promise<LocallyMembershipSummary> {
  const [
    experiencePurchaseCount,
    servicePurchaseCount,
    firstBookingAt,
    firstServiceBookingAt,
  ] = await Promise.all([
    fetchExperiencePurchaseCount(supabase, userId),
    fetchServicePurchaseCount(supabase, userId),
    fetchFirstExperiencePurchaseAt(supabase, userId),
    fetchFirstServicePurchaseAt(supabase, userId),
  ]);

  return createLocallyMembershipSummary({
    experiencePurchaseCount,
    servicePurchaseCount,
    firstPurchaseAt: getEarlierDate(firstBookingAt, firstServiceBookingAt),
  });
}

export async function fetchLocallyMembershipSummaries(
  supabase: MembershipSupabaseClient,
  userIds: Array<string | null | undefined>
): Promise<Record<string, LocallyMembershipSummary>> {
  const normalizedUserIds = normalizeMembershipUserIds(userIds);

  if (normalizedUserIds.length === 0) {
    return {};
  }

  const [experienceRows, serviceRows] = await Promise.all([
    fetchBatchExperiencePurchaseRows(supabase, normalizedUserIds),
    fetchBatchServicePurchaseRows(supabase, normalizedUserIds),
  ]);

  const experienceSummaryByUserId = summarizeMembershipPurchaseSource(
    experienceRows,
    (row) => row.user_id,
    (row) => row.created_at
  );
  const serviceSummaryByUserId = summarizeMembershipPurchaseSource(
    serviceRows,
    (row) => row.customer_id,
    (row) => row.created_at
  );

  return Object.fromEntries(
    normalizedUserIds.map((userId) => {
      const experienceSummary = experienceSummaryByUserId.get(userId);
      const serviceSummary = serviceSummaryByUserId.get(userId);

      return [userId, createLocallyMembershipSummary({
        experiencePurchaseCount: experienceSummary?.count ?? 0,
        servicePurchaseCount: serviceSummary?.count ?? 0,
        firstPurchaseAt: getEarlierDate(
          experienceSummary?.firstPurchaseAt ?? null,
          serviceSummary?.firstPurchaseAt ?? null
        ),
      })];
    })
  );
}
