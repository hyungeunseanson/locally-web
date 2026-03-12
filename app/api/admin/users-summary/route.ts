import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { BOOKING_CONFIRMED_STATUSES } from '@/app/constants/bookingStatus';
import { SERVICE_BOOKING_ACTIVE_STATUSES, SERVICE_BOOKING_COMPLETED_STATUSES } from '@/app/constants/serviceStatus';

type ProfileRow = {
  id: string;
  role?: string | null;
  [key: string]: unknown;
};

type UserRoleRow = {
  id: string;
  role: string | null;
};

type BookingSummaryRow = {
  user_id: string | null;
  amount: number | null;
  created_at: string;
  status: string | null;
};

type ServiceRequestSummaryRow = {
  user_id: string | null;
  created_at: string;
};

type ServiceBookingSummaryRow = {
  customer_id: string | null;
  amount: number | null;
  created_at: string;
  status: string | null;
};

type UserActivityRow = {
  user_id: string | null;
  created_at: string;
};

function addAmount(map: Map<string, number>, userId: string | null, amount: number | null) {
  if (!userId) return;
  map.set(userId, (map.get(userId) || 0) + Number(amount || 0));
}

function increment(map: Map<string, number>, userId: string | null) {
  if (!userId) return;
  map.set(userId, (map.get(userId) || 0) + 1);
}

function updateLatest(map: Map<string, string>, userId: string | null, createdAt: string) {
  if (!userId || !createdAt) return;

  const current = map.get(userId);
  if (!current || new Date(createdAt).getTime() > new Date(current).getTime()) {
    map.set(userId, createdAt);
  }
}

function isConfirmedServiceBookingStatus(status: string | null) {
  if (!status) return false;
  return [...SERVICE_BOOKING_ACTIVE_STATUSES, ...SERVICE_BOOKING_COMPLETED_STATUSES].includes(status as never);
}

export async function GET() {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

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

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (profilesError) {
      throw profilesError;
    }

    const profileRows = (profiles || []) as ProfileRow[];
    const profileIds = profileRows.map((profile) => profile.id).filter(Boolean);

    const roleMap = new Map<string, string | null>();
    const totalSpentMap = new Map<string, number>();
    const experienceBookingCountMap = new Map<string, number>();
    const serviceRequestCountMap = new Map<string, number>();
    const recentActivityMap = new Map<string, string>();

    if (profileIds.length > 0) {
      const [
        { data: userRows, error: usersError },
        { data: bookingRows, error: bookingsError },
        { data: serviceRequestRows, error: serviceRequestsError },
        { data: serviceBookingRows, error: serviceBookingsError },
        { data: reviewRows, error: reviewsError },
        { data: inquiryRows, error: inquiriesError },
      ] = await Promise.all([
        supabaseAdmin
          .from('users')
          .select('id, role')
          .in('id', profileIds),
        supabaseAdmin
          .from('bookings')
          .select('user_id, amount, created_at, status')
          .in('user_id', profileIds),
        supabaseAdmin
          .from('service_requests')
          .select('user_id, created_at')
          .in('user_id', profileIds),
        supabaseAdmin
          .from('service_bookings')
          .select('customer_id, amount, created_at, status')
          .in('customer_id', profileIds),
        supabaseAdmin
          .from('reviews')
          .select('user_id, created_at')
          .in('user_id', profileIds),
        supabaseAdmin
          .from('inquiries')
          .select('user_id, created_at')
          .in('user_id', profileIds),
      ]);

      if (usersError) throw usersError;
      if (bookingsError) throw bookingsError;
      if (serviceRequestsError) throw serviceRequestsError;
      if (serviceBookingsError) throw serviceBookingsError;
      if (reviewsError) throw reviewsError;
      if (inquiriesError) throw inquiriesError;

      ((userRows || []) as UserRoleRow[]).forEach((userRow) => {
        roleMap.set(userRow.id, userRow.role);
      });

      ((bookingRows || []) as BookingSummaryRow[]).forEach((row) => {
        increment(experienceBookingCountMap, row.user_id);
        updateLatest(recentActivityMap, row.user_id, row.created_at);
        if (row.status && BOOKING_CONFIRMED_STATUSES.includes(row.status as never)) {
          addAmount(totalSpentMap, row.user_id, row.amount);
        }
      });

      ((serviceRequestRows || []) as ServiceRequestSummaryRow[]).forEach((row) => {
        increment(serviceRequestCountMap, row.user_id);
        updateLatest(recentActivityMap, row.user_id, row.created_at);
      });

      ((serviceBookingRows || []) as ServiceBookingSummaryRow[]).forEach((row) => {
        updateLatest(recentActivityMap, row.customer_id, row.created_at);
        if (isConfirmedServiceBookingStatus(row.status)) {
          addAmount(totalSpentMap, row.customer_id, row.amount);
        }
      });

      ((reviewRows || []) as UserActivityRow[]).forEach((row) => {
        updateLatest(recentActivityMap, row.user_id, row.created_at);
      });

      ((inquiryRows || []) as UserActivityRow[]).forEach((row) => {
        updateLatest(recentActivityMap, row.user_id, row.created_at);
      });
    }

    const mergedProfiles = profileRows.map((profile) => ({
      ...profile,
      role: roleMap.get(profile.id) ?? null,
      total_spent: totalSpentMap.get(profile.id) ?? 0,
      experience_booking_count: experienceBookingCountMap.get(profile.id) ?? 0,
      service_request_count: serviceRequestCountMap.get(profile.id) ?? 0,
      recent_activity_at: recentActivityMap.get(profile.id) ?? null,
    }));

    return NextResponse.json({ success: true, data: mergedProfiles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/users-summary error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
