import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { isCancelledBookingStatus, isConfirmedBookingStatus } from '@/app/constants/bookingStatus';

type HostApplicationRow = {
  id: string;
  user_id: string | null;
  created_at: string | null;
  status: string | null;
  source: string | null;
  host_nationality: string | null;
  languages: string[] | string | null;
};

type ExperienceRow = {
  id: number;
  host_id: string | null;
  status: string | null;
};

type BookingRow = {
  created_at: string | null;
  experience_id: number | null;
  status: string | null;
};

type ReviewRow = {
  experience_id: number | null;
  rating: number | null;
  created_at: string | null;
};

type InquiryRow = {
  id: string;
  host_id: string | null;
  created_at: string | null;
};

type InquiryMessageRow = {
  inquiry_id: string | null;
  sender_id: string | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  full_name: string | null;
};

type DistributionStat = {
  name: string;
  count: number;
  percent: number;
};

function toDistributionStats(counts: Record<string, number>, total: number): DistributionStat[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({
      name,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((left, right) => right.count - left.count);
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

    let appsQuery = supabaseAdmin
      .from('host_applications')
      .select('id, user_id, created_at, status, source, host_nationality, languages')
      .order('created_at', { ascending: false });

    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('created_at, experience_id, status')
      .in('status', ['PAID', 'confirmed', 'completed', 'cancelled', 'cancellation_requested', 'declined'])
      .order('created_at', { ascending: false });

    let reviewsQuery = supabaseAdmin
      .from('reviews')
      .select('experience_id, rating, created_at')
      .order('created_at', { ascending: false });

    let inquiriesQuery = supabaseAdmin
      .from('inquiries')
      .select('id, host_id, created_at')
      .order('created_at', { ascending: false });

    if (startAt) {
      appsQuery = appsQuery.gte('created_at', startAt);
      bookingsQuery = bookingsQuery.gte('created_at', startAt);
      reviewsQuery = reviewsQuery.gte('created_at', startAt);
      inquiriesQuery = inquiriesQuery.gte('created_at', startAt);
    }

    if (endAt) {
      appsQuery = appsQuery.lte('created_at', endAt);
      bookingsQuery = bookingsQuery.lte('created_at', endAt);
      reviewsQuery = reviewsQuery.lte('created_at', endAt);
      inquiriesQuery = inquiriesQuery.lte('created_at', endAt);
    }

    const [
      { data: appRows, error: appsError },
      { data: experienceRows, error: expsError },
      { data: bookingRows, error: bookingsError },
      { data: reviewRows, error: reviewsError },
      { data: inquiryRows, error: inquiriesError },
    ] = await Promise.all([
      appsQuery,
      supabaseAdmin.from('experiences').select('id, host_id, status'),
      bookingsQuery,
      reviewsQuery,
      inquiriesQuery,
    ]);

    if (appsError) throw appsError;
    if (expsError) throw expsError;
    if (bookingsError) throw bookingsError;
    if (reviewsError) throw reviewsError;
    if (inquiriesError) throw inquiriesError;

    const apps = (appRows || []) as HostApplicationRow[];
    const exps = (experienceRows || []) as ExperienceRow[];
    const bookings = (bookingRows || []) as BookingRow[];
    const reviews = (reviewRows || []) as ReviewRow[];
    const inquiries = (inquiryRows || []) as InquiryRow[];

    const inquiryIds = inquiries.map((inquiry) => inquiry.id).filter(Boolean);
    let inquiryMessages: InquiryMessageRow[] = [];

    if (inquiryIds.length > 0) {
      const { data: messageRows, error: messagesError } = await supabaseAdmin
        .from('inquiry_messages')
        .select('inquiry_id, sender_id, created_at')
        .in('inquiry_id', inquiryIds)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      inquiryMessages = (messageRows || []) as InquiryMessageRow[];
    }

    const hostIds = Array.from(
      new Set(
        [
          ...apps.map((app) => app.user_id).filter(Boolean),
          ...exps.map((exp) => exp.host_id).filter(Boolean),
          ...inquiries.map((inquiry) => inquiry.host_id).filter(Boolean),
        ] as string[]
      )
    );

    let profiles: ProfileRow[] = [];
    if (hostIds.length > 0) {
      const { data: profileRows, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, name, full_name')
        .in('id', hostIds);

      if (profilesError) throw profilesError;
      profiles = (profileRows || []) as ProfileRow[];
    }

    const expById = new Map<number, ExperienceRow>();
    exps.forEach((exp) => {
      expById.set(exp.id, exp);
    });

    const profileById = new Map<string, ProfileRow>();
    profiles.forEach((profile) => {
      profileById.set(profile.id, profile);
    });

    const hostStats: Record<string, { bookings: number; ratingSum: number; reviewCount: number; cancelCount: number }> = {};

    bookings.forEach((booking) => {
      if (!booking.created_at || !booking.experience_id) return;
      const exp = expById.get(booking.experience_id);
      if (!exp?.host_id) return;

      if (!hostStats[exp.host_id]) {
        hostStats[exp.host_id] = { bookings: 0, ratingSum: 0, reviewCount: 0, cancelCount: 0 };
      }

      hostStats[exp.host_id].bookings += 1;

      if (isCancelledBookingStatus(booking.status || '')) {
        hostStats[exp.host_id].cancelCount += 1;
      }
    });

    reviews.forEach((review) => {
      if (!review.created_at || !review.experience_id) return;
      const exp = expById.get(review.experience_id);
      if (!exp?.host_id || !hostStats[exp.host_id]) return;

      hostStats[exp.host_id].ratingSum += Number(review.rating || 0);
      hostStats[exp.host_id].reviewCount += 1;
    });

    const superHosts: Array<{
      id: string;
      name: string;
      bookings: number;
      cancelCount: number;
      rating: string;
    }> = [];
    const riskHosts: Array<{
      id: string;
      name: string;
      bookings: number;
      cancelCount: number;
      rating: string;
    }> = [];

    Object.entries(hostStats).forEach(([hostId, stat]) => {
      const profile = profileById.get(hostId);
      const ratingNum = stat.reviewCount > 0 ? stat.ratingSum / stat.reviewCount : 0;
      const host = {
        id: hostId,
        name: profile?.name || profile?.full_name || 'Unknown Host',
        bookings: stat.bookings,
        cancelCount: stat.cancelCount,
        rating: ratingNum > 0 ? ratingNum.toFixed(1) : 'New',
      };

      if (host.bookings >= 3 && ratingNum >= 4.0 && host.cancelCount === 0) {
        superHosts.push(host);
      }

      if (host.cancelCount >= 2 || (ratingNum > 0 && ratingNum < 3.5)) {
        riskHosts.push(host);
      }
    });

    const hostSources: Record<string, number> = {};
    const hostLangs: Record<string, number> = {};
    const hostNats: Record<string, number> = {};
    let applied = 0;
    let approved = 0;

    apps.forEach((app) => {
      applied += 1;
      if (app.status === 'approved') approved += 1;

      const source = app.source || '기타/미입력';
      hostSources[source] = (hostSources[source] || 0) + 1;

      const nationality = app.host_nationality || '미입력';
      hostNats[nationality] = (hostNats[nationality] || 0) + 1;

      const languages = Array.isArray(app.languages)
        ? app.languages
        : app.languages
          ? [app.languages]
          : [];

      languages.forEach((language) => {
        hostLangs[language] = (hostLangs[language] || 0) + 1;
      });
    });

    const activeHosts = new Set<string>();
    exps.forEach((exp) => {
      if (exp.status === 'active' && exp.host_id) {
        activeHosts.add(exp.host_id);
      }
    });

    const bookedHosts = new Set<string>();
    bookings.forEach((booking) => {
      if (!booking.experience_id || !isConfirmedBookingStatus(booking.status || '')) return;
      const exp = expById.get(booking.experience_id);
      if (exp?.host_id) {
        bookedHosts.add(exp.host_id);
      }
    });

    const messagesByInquiry: Record<string, InquiryMessageRow[]> = {};
    inquiryMessages.forEach((message) => {
      if (!message.inquiry_id) return;
      if (!messagesByInquiry[message.inquiry_id]) {
        messagesByInquiry[message.inquiry_id] = [];
      }
      messagesByInquiry[message.inquiry_id].push(message);
    });

    const hostCommStats: Record<string, { total: number; answered: number; timeMs: number }> = {};
    let totalHostInquiries = 0;
    let answeredHostInquiries = 0;
    let totalResponseTimeMs = 0;

    inquiries.forEach((inquiry) => {
      if (!inquiry.host_id || !inquiry.created_at) return;

      totalHostInquiries += 1;
      if (!hostCommStats[inquiry.host_id]) {
        hostCommStats[inquiry.host_id] = { total: 0, answered: 0, timeMs: 0 };
      }
      hostCommStats[inquiry.host_id].total += 1;

      const messages = messagesByInquiry[inquiry.id] || [];
      const firstHostMsg = messages.find((message) => message.sender_id === inquiry.host_id);

      if (!firstHostMsg?.created_at) return;

      answeredHostInquiries += 1;
      hostCommStats[inquiry.host_id].answered += 1;

      const guestMsg = messages.find((message) => message.sender_id !== inquiry.host_id);
      const startTime = guestMsg?.created_at
        ? new Date(guestMsg.created_at).getTime()
        : new Date(inquiry.created_at).getTime();
      const responseTimeMs = new Date(firstHostMsg.created_at).getTime() - startTime;

      if (responseTimeMs > 0) {
        totalResponseTimeMs += responseTimeMs;
        hostCommStats[inquiry.host_id].timeMs += responseTimeMs;
      }
    });

    const hostRespArr = Object.entries(hostCommStats)
      .map(([hostId, stat]) => {
        const profile = profileById.get(hostId);
        const rate = stat.total > 0 ? (stat.answered / stat.total) * 100 : 0;
        const timeMins = stat.answered > 0 ? (stat.timeMs / stat.answered) / (1000 * 60) : 0;

        return {
          id: hostId,
          name: profile?.name || profile?.full_name || 'Unknown',
          rate,
          timeMins: Math.round(timeMins),
          total: stat.total,
        };
      })
      .filter((host) => host.total >= 1);

    const avgResponseTime = answeredHostInquiries > 0
      ? Math.round((totalResponseTimeMs / answeredHostInquiries) / (1000 * 60))
      : 0;
    const responseRate = totalHostInquiries > 0
      ? Number(((answeredHostInquiries / totalHostInquiries) * 100).toFixed(1))
      : 0;

    const allSources = toDistributionStats(hostSources, applied);
    const allNationalities = toDistributionStats(hostNats, applied);
    const totalLangs = Object.values(hostLangs).reduce((sum, count) => sum + count, 0);
    const allLanguages = toDistributionStats(hostLangs, totalLangs);

    return NextResponse.json({
      success: true,
      data: {
        superHostCandidates: superHosts.slice(0, 5),
        riskHosts: riskHosts.slice(0, 5),
        avgResponseTime,
        responseRate,
        topRespHosts: [...hostRespArr].sort((a, b) => b.rate - a.rate || a.timeMins - b.timeMins).slice(0, 10),
        bottomRespHosts: [...hostRespArr].sort((a, b) => a.rate - b.rate || b.timeMins - a.timeMins).slice(0, 10),
        hostEcosystem: {
          sources: allSources.slice(0, 4),
          languages: allLanguages.slice(0, 4),
          nationalities: allNationalities.slice(0, 4),
          allSources,
          allLanguages,
          allNationalities,
          funnel: {
            applied,
            approved,
            active: activeHosts.size,
            booked: bookedHosts.size,
          },
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/analytics-host-summary error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
