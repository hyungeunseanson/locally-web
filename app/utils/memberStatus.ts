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

const SUCCESSFUL_SERVICE_BOOKING_STATUSES = [
  ...SERVICE_BOOKING_ACTIVE_STATUSES,
  ...SERVICE_BOOKING_COMPLETED_STATUSES,
] as const;

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
