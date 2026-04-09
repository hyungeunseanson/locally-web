import { NextRequest, NextResponse } from 'next/server';

import { fetchLocallyMembershipSummary, type LocallyMembershipStatus } from '@/app/utils/memberStatus';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type MembershipLookupBody = {
  guestIds?: unknown;
};

type BookingGuestRef = {
  user_id: string;
};

function normalizeBookingGuestRefs(value: unknown): BookingGuestRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<BookingGuestRef[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return acc;
    }

    const userId = typeof entry.user_id === 'string' ? entry.user_id.trim() : '';
    if (userId) {
      acc.push({ user_id: userId });
    }

    return acc;
  }, []);
}

function normalizeGuestIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
  )].slice(0, 50);
}

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as MembershipLookupBody;
    const guestIds = normalizeGuestIds(body.guestIds);

    if (guestIds.length === 0) {
      return NextResponse.json({ success: true, memberships: {} as Record<string, LocallyMembershipStatus> });
    }

    const supabaseAdmin = createAdminClient();
    const { data: bookingRefs, error: bookingRefsError } = await supabaseAdmin
      .from('bookings')
      .select('user_id, experiences!inner(host_id)')
      .eq('experiences.host_id', user.id)
      .in('user_id', guestIds);

    if (bookingRefsError) throw bookingRefsError;

    const allowedGuestIds = [...new Set(
      normalizeBookingGuestRefs(bookingRefs).map((row) => row.user_id).filter(Boolean)
    )];

    if (allowedGuestIds.length === 0) {
      return NextResponse.json({ success: true, memberships: {} as Record<string, LocallyMembershipStatus> });
    }

    const membershipEntries = await Promise.all(
      allowedGuestIds.map(async (guestId) => {
        try {
          const membership = await fetchLocallyMembershipSummary(supabaseAdmin, guestId);
          return [guestId, membership.status] as const;
        } catch (error) {
          console.error('[host guest memberships] failed to resolve membership:', guestId, error);
          return [guestId, 'none' as const] as const;
        }
      })
    );

    return NextResponse.json({
      success: true,
      memberships: Object.fromEntries(membershipEntries) as Record<string, LocallyMembershipStatus>,
    });
  } catch (error) {
    console.error('Host guest memberships route error:', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve guest memberships.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
