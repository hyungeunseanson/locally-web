import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

type SalesBookingRow = {
  id: string;
  order_id: string | null;
  created_at: string;
  experience_id: number | null;
  user_id: string | null;
  amount: number;
  status: string;
  date: string;
  time: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  guests: number | null;
  payout_status: string | null;
  host_payout_amount: number | null;
  platform_revenue: number | null;
  refund_amount: number | null;
  payment_method: string | null;
  total_price: number | null;
  total_experience_price: number | null;
  price_at_booking: number | null;
  solo_guarantee_price: number | null;
};

type SalesExperienceRow = {
  id: number;
  title: string | null;
  host_id: string | null;
};

type SalesProfileRow = {
  id: string;
  full_name: string | null;
  email?: string | null;
};

type SalesHostApplicationRow = {
  user_id: string;
  name: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  host_nationality: string | null;
  created_at: string;
};

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

    const { data: salesBookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, order_id, created_at, experience_id, user_id, amount, status, date, time, contact_name, contact_phone, guests, payout_status, host_payout_amount, platform_revenue, refund_amount, payment_method, total_price, total_experience_price, price_at_booking, solo_guarantee_price'
      )
      .in('status', ['completed', 'cancelled'])
      .order('created_at', { ascending: false });

    if (bookingsError) throw bookingsError;

    const bookingRows = (salesBookings || []) as SalesBookingRow[];
    if (bookingRows.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const experienceIds = Array.from(new Set(bookingRows.map((booking) => booking.experience_id).filter(Boolean)));
    const guestIds = Array.from(new Set(bookingRows.map((booking) => booking.user_id).filter(Boolean)));

    const [{ data: experiences, error: experiencesError }, { data: guestProfiles, error: guestProfilesError }] = await Promise.all([
      experienceIds.length > 0
        ? supabaseAdmin.from('experiences').select('id, title, host_id').in('id', experienceIds)
        : Promise.resolve({ data: [], error: null }),
      guestIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, full_name, email').in('id', guestIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (experiencesError) throw experiencesError;
    if (guestProfilesError) throw guestProfilesError;

    const hostIds = Array.from(new Set(((experiences || []) as SalesExperienceRow[]).map((experience) => experience.host_id).filter(Boolean)));
    const [{ data: hostProfiles, error: hostProfilesError }, { data: hostApplications, error: hostApplicationsError }] = await Promise.all([
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

    const experienceMap = new Map(((experiences || []) as SalesExperienceRow[]).map((experience) => [experience.id, experience]));
    const guestProfileMap = new Map(((guestProfiles || []) as SalesProfileRow[]).map((profile) => [profile.id, profile]));
    const hostProfileMap = new Map(((hostProfiles || []) as SalesProfileRow[]).map((profile) => [profile.id, profile]));
    const hostApplicationMap = new Map<string, SalesHostApplicationRow>();

    for (const application of (hostApplications || []) as SalesHostApplicationRow[]) {
      if (application.user_id && !hostApplicationMap.has(application.user_id)) {
        hostApplicationMap.set(application.user_id, application);
      }
    }

    const enriched = bookingRows.map((booking) => {
      const experience = booking.experience_id ? experienceMap.get(booking.experience_id) : null;
      const guestProfile = booking.user_id ? guestProfileMap.get(booking.user_id) : null;
      const hostProfile = experience?.host_id ? hostProfileMap.get(experience.host_id) : null;
      const hostApplication = experience?.host_id ? hostApplicationMap.get(experience.host_id) ?? null : null;
      const hostName = hostApplication?.name || hostProfile?.full_name || 'Unknown Host';

      return {
        ...booking,
        experiences: {
          title: experience?.title || 'Unknown Experience',
          host_id: experience?.host_id || null,
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

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/sales-summary error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
