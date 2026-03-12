import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';

type ServiceRequestLedgerRow = {
  id: string;
  title: string | null;
  service_date: string | null;
  start_time: string | null;
  guest_count: number | null;
  contact_name: string | null;
  contact_phone: string | null;
};

type ServiceBookingLedgerRow = {
  id: string;
  order_id: string | null;
  request_id: string | null;
  application_id: string | null;
  customer_id: string | null;
  host_id: string | null;
  amount: number;
  created_at: string;
  status: string;
  [key: string]: unknown;
};

function normalizeDateParam(value: string | null) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = normalizeDateParam(searchParams.get('startDate'));
    const endDate = normalizeDateParam(searchParams.get('endDate'));
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const [userEntry, whitelist] = await Promise.all([
      supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabaseAdmin.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle(),
    ]);

    const isAdmin = userEntry.data?.role === 'admin' || !!whitelist.data;
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    let bookingsQuery = supabaseAdmin.from('bookings').select('*').order('created_at', { ascending: false });
    if (startDate) {
      bookingsQuery = bookingsQuery.gte('date', startDate);
    }
    if (endDate) {
      bookingsQuery = bookingsQuery.lte('date', endDate);
    }

    let filteredServiceRequestsPromise: Promise<{ data: ServiceRequestLedgerRow[] | null; error: unknown }> = Promise.resolve({ data: null, error: null });
    if (startDate || endDate) {
      let serviceRequestsQuery = supabaseAdmin
        .from('service_requests')
        .select('id, title, service_date, start_time, guest_count, contact_name, contact_phone');

      if (startDate) {
        serviceRequestsQuery = serviceRequestsQuery.gte('service_date', startDate);
      }
      if (endDate) {
        serviceRequestsQuery = serviceRequestsQuery.lte('service_date', endDate);
      }

      filteredServiceRequestsPromise = (async () => {
        const result = await serviceRequestsQuery;
        return {
          data: result.data ?? [],
          error: result.error,
        };
      })();
    }

    const [{ data: bookings, error: bookingsError }, filteredServiceRequestsResult] = await Promise.all([
      bookingsQuery,
      filteredServiceRequestsPromise,
    ]);

    if (filteredServiceRequestsResult.error) throw filteredServiceRequestsResult.error;

    const filteredServiceRequests = filteredServiceRequestsResult.data;
    const filteredServiceRequestIds = Array.from(new Set((filteredServiceRequests || []).map((request) => request.id).filter(Boolean)));

    let serviceBookingsPromise: Promise<{ data: ServiceBookingLedgerRow[] | null; error: unknown }>;
    if ((startDate || endDate) && filteredServiceRequests && filteredServiceRequestIds.length === 0) {
      serviceBookingsPromise = Promise.resolve({ data: [], error: null });
    } else {
      let serviceBookingsQuery = supabaseAdmin.from('service_bookings').select('*').order('created_at', { ascending: false });
      if ((startDate || endDate) && filteredServiceRequests && filteredServiceRequestIds.length > 0) {
        serviceBookingsQuery = serviceBookingsQuery.in('request_id', filteredServiceRequestIds);
      }
      serviceBookingsPromise = (async () => {
        const result = await serviceBookingsQuery;
        return {
          data: result.data ?? [],
          error: result.error,
        };
      })();
    }

    const { data: serviceBookings, error: serviceBookingsError } = await serviceBookingsPromise;

    if (bookingsError) throw bookingsError;
    if (serviceBookingsError) throw serviceBookingsError;

    const bookingRows = bookings || [];
    const serviceBookingRows = serviceBookings || [];

    const experienceIds = Array.from(new Set(bookingRows.map((booking) => booking.experience_id).filter(Boolean)));
    const guestIds = Array.from(new Set(bookingRows.map((booking) => booking.user_id).filter(Boolean)));

    const [{ data: experiences, error: experiencesError }, { data: bookingProfiles, error: bookingProfilesError }] = await Promise.all([
      experienceIds.length > 0
        ? supabaseAdmin.from('experiences').select('id, title, host_id').in('id', experienceIds)
        : Promise.resolve({ data: [], error: null }),
      guestIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, full_name, email').in('id', guestIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (experiencesError) throw experiencesError;
    if (bookingProfilesError) throw bookingProfilesError;

    const hostIds = Array.from(new Set((experiences || []).map((experience) => experience.host_id).filter(Boolean)));
    const [{ data: hostProfiles, error: hostProfilesError }, { data: hostApplications, error: hostApplicationsError }] = await Promise.all([
      hostIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, full_name').in('id', hostIds)
        : Promise.resolve({ data: [], error: null }),
      hostIds.length > 0
        ? supabaseAdmin
            .from('host_applications')
            .select('user_id, name, created_at')
            .in('user_id', hostIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (hostProfilesError) throw hostProfilesError;
    if (hostApplicationsError) throw hostApplicationsError;

    const experienceMap = new Map((experiences || []).map((experience) => [experience.id, experience]));
    const bookingProfileMap = new Map((bookingProfiles || []).map((profile) => [profile.id, profile]));
    const hostProfileMap = new Map((hostProfiles || []).map((profile) => [profile.id, profile]));
    const hostAppNameMap = new Map<string, string>();

    for (const application of hostApplications || []) {
      if (application.user_id && !hostAppNameMap.has(application.user_id)) {
        hostAppNameMap.set(application.user_id, application.name || '');
      }
    }

    const normalizedBookings = bookingRows.map((booking) => {
      const experience = experienceMap.get(booking.experience_id);
      const guestProfile = bookingProfileMap.get(booking.user_id);
      const hostProfile = experience?.host_id ? hostProfileMap.get(experience.host_id) : null;
      const hostName = (experience?.host_id && hostAppNameMap.get(experience.host_id)) || hostProfile?.full_name || 'Unknown Host';

      return {
        ...booking,
        _type: 'experience' as const,
        order_id: booking.order_id ?? booking.id,
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
      };
    });

    const requestIds = Array.from(new Set(serviceBookingRows.map((booking) => booking.request_id).filter(Boolean)));
    const serviceUserIds = Array.from(new Set(serviceBookingRows.flatMap((booking) => [booking.customer_id, booking.host_id]).filter(Boolean)));
    const applicationIds = Array.from(new Set(serviceBookingRows.map((booking) => booking.application_id).filter(Boolean)));

    const [serviceRequestsRes, serviceProfilesRes, serviceApplicationsRes] = await Promise.all([
      filteredServiceRequests
        ? Promise.resolve({ data: filteredServiceRequests, error: null })
        : requestIds.length > 0
          ? supabaseAdmin
              .from('service_requests')
              .select('id, title, service_date, start_time, guest_count, contact_name, contact_phone')
              .in('id', requestIds)
          : Promise.resolve({ data: [], error: null }),
      serviceUserIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, full_name, email').in('id', serviceUserIds)
        : Promise.resolve({ data: [], error: null }),
      applicationIds.length > 0
        ? supabaseAdmin.from('service_applications').select('id, request_id, host_id, appeal_message').in('id', applicationIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (serviceRequestsRes.error) throw serviceRequestsRes.error;
    if (serviceProfilesRes.error) throw serviceProfilesRes.error;
    if (serviceApplicationsRes.error) throw serviceApplicationsRes.error;

    const requestMap = new Map((serviceRequestsRes.data || []).map((request) => [request.id, request]));
    const serviceProfileMap = new Map((serviceProfilesRes.data || []).map((profile) => [profile.id, profile]));
    const serviceApplicationMap = new Map((serviceApplicationsRes.data || []).map((application) => [application.id, application]));

    const normalizedServiceBookings = serviceBookingRows.map((booking) => {
      const request = requestMap.get(booking.request_id);
      const customer = serviceProfileMap.get(booking.customer_id);
      const host = booking.host_id ? serviceProfileMap.get(booking.host_id) : null;
      const application = booking.application_id ? serviceApplicationMap.get(booking.application_id) : null;

      return {
        ...booking,
        _type: 'service' as const,
        order_id: booking.order_id ?? booking.id,
        date: request?.service_date ?? booking.created_at?.slice(0, 10) ?? '',
        time: request?.start_time ?? '',
        guests: request?.guest_count ?? '-',
        contact_name: customer?.full_name ?? request?.contact_name ?? '-',
        contact_phone: request?.contact_phone ?? null,
        price_at_booking: null,
        total_experience_price: booking.amount,
        experiences: {
          title: request?.title ?? '-',
          host_id: booking.host_id ?? application?.host_id ?? null,
          profiles: {
            name: host?.full_name ?? '-',
          },
        },
        profiles: {
          email: customer?.email ?? null,
          name: customer?.full_name ?? null,
        },
      };
    });

    const data = [...normalizedBookings, ...normalizedServiceBookings].sort((left, right) =>
      left.created_at < right.created_at ? 1 : -1
    );

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('[ADMIN] /api/admin/master-ledger error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
