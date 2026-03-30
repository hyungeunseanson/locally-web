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

type SupabaseLike = {
  from: (table: string) => {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        in: (...args: unknown[]) => PromiseLike<{
          count: number | null;
          error: { message?: string } | null;
        }> & {
          order: (...args: unknown[]) => {
            limit: (...args: unknown[]) => {
              maybeSingle: () => Promise<{
                data: { created_at?: string | null } | null;
                error: { message?: string } | null;
              }>;
            };
          };
        };
      };
    };
  };
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

export async function fetchLocallyMembershipSummary(
  supabase: SupabaseLike,
  userId: string
): Promise<LocallyMembershipSummary> {
  const [
    { count: experiencePurchaseCount, error: bookingCountError },
    { count: servicePurchaseCount, error: serviceCountError },
    { data: firstBooking, error: firstBookingError },
    { data: firstServiceBooking, error: firstServiceBookingError },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', [...BOOKING_CONFIRMED_STATUSES]),
    supabase
      .from('service_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', userId)
      .in('status', [...SUCCESSFUL_SERVICE_BOOKING_STATUSES]),
    supabase
      .from('bookings')
      .select('created_at')
      .eq('user_id', userId)
      .in('status', [...BOOKING_CONFIRMED_STATUSES])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('service_bookings')
      .select('created_at')
      .eq('customer_id', userId)
      .in('status', [...SUCCESSFUL_SERVICE_BOOKING_STATUSES])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (bookingCountError) throw new Error(bookingCountError.message || 'Failed to count confirmed bookings.');
  if (serviceCountError) throw new Error(serviceCountError.message || 'Failed to count service bookings.');
  if (firstBookingError) throw new Error(firstBookingError.message || 'Failed to resolve first booking date.');
  if (firstServiceBookingError) throw new Error(firstServiceBookingError.message || 'Failed to resolve first service booking date.');

  return createLocallyMembershipSummary({
    experiencePurchaseCount: experiencePurchaseCount || 0,
    servicePurchaseCount: servicePurchaseCount || 0,
    firstPurchaseAt: getEarlierDate(firstBooking?.created_at || null, firstServiceBooking?.created_at || null),
  });
}
