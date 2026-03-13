import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { isCancelledBookingStatus, isConfirmedBookingStatus } from '@/app/constants/bookingStatus';
import { isCompletedServiceBooking, isPaidServiceBooking } from '@/app/constants/serviceStatus';
import { getBookingPlatformRevenue } from '@/app/utils/bookingFinance';

type AnalyticsBookingRow = {
  id: string;
  created_at: string;
  experience_id: number | null;
  user_id: string | null;
  amount: number | null;
  status: string | null;
  total_price: number | null;
  total_experience_price: number | null;
  host_payout_amount: number | null;
  platform_revenue: number | null;
  solo_guarantee_price: number | null;
};

type AnalyticsExperienceRow = {
  id: number;
  title: string | null;
  status: string | null;
  created_at: string | null;
};

type AnalyticsReviewRow = {
  experience_id: number | null;
  rating: number | null;
  created_at: string | null;
};

type AnalyticsProfileRow = {
  id: string;
  created_at: string | null;
  full_name: string | null;
  name: string | null;
  nationality: string | null;
  gender: string | null;
  birth_date: string | null;
  dob: string | null;
};

type AnalyticsSearchLogRow = {
  keyword: string | null;
  created_at: string | null;
};

type AnalyticsEventRow = {
  event_type: string | null;
  created_at: string | null;
};

type AnalyticsServiceBookingRow = {
  id: string;
  created_at: string;
  customer_id: string | null;
  amount: number | null;
  status: string | null;
  host_payout_amount: number | null;
  platform_revenue: number | null;
};

type TrendStat = {
  keyword: string;
  count: number;
  percent: number;
};

type DistributionStat = {
  name: string;
  count: number;
  percent: number;
};

const GUEST_GENDER_BUCKETS: Record<string, string> = {
  male: '남성',
  female: '여성',
  other: '기타',
  남성: '남성',
  여성: '여성',
  기타: '기타',
};

function parseBirthYear(rawValue: string | null | undefined) {
  if (!rawValue) return null;

  const trimmed = String(rawValue).trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 4) {
    const year = Number(digits.slice(0, 4));
    if (Number.isFinite(year) && year > 1900 && year <= new Date().getFullYear()) {
      return year;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getFullYear();
  }

  return null;
}

function getAgeBucket(birthYear: number | null) {
  if (!birthYear) return null;

  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  if (age < 20) return '10대';
  if (age < 30) return '20대';
  if (age < 40) return '30대';
  return '40대+';
}

function toDistributionStats(
  counts: Record<string, number>,
  total: number,
  mapLabel?: (key: string) => string
): DistributionStat[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({
      name: mapLabel ? mapLabel(key) : key,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((left, right) => right.count - left.count);
}

function toTrendStats(counts: Record<string, number>, total: number): TrendStat[] {
  return Object.entries(counts)
    .filter(([keyword, count]) => Boolean(keyword) && count > 0)
    .map(([keyword, count]) => ({
      keyword,
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

    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('id, created_at, experience_id, user_id, amount, status, total_price, total_experience_price, host_payout_amount, platform_revenue, solo_guarantee_price')
      .in('status', ['PAID', 'confirmed', 'completed', 'cancelled', 'declined', 'cancellation_requested'])
      .order('created_at', { ascending: false });

    let reviewsQuery = supabaseAdmin
      .from('reviews')
      .select('experience_id, rating, created_at')
      .order('created_at', { ascending: false });

    let newUsersQuery = supabaseAdmin
      .from('profiles')
      .select('id, created_at, full_name, name, nationality, gender, birth_date, dob')
      .order('created_at', { ascending: false });

    let searchLogsQuery = supabaseAdmin
      .from('search_logs')
      .select('keyword, created_at')
      .order('created_at', { ascending: false });

    let analyticsEventsQuery = supabaseAdmin
      .from('analytics_events')
      .select('event_type, created_at')
      .order('created_at', { ascending: false });

    let serviceBookingsQuery = supabaseAdmin
      .from('service_bookings')
      .select('id, created_at, customer_id, amount, status, host_payout_amount, platform_revenue')
      .in('status', ['PAID', 'confirmed', 'completed'])
      .order('created_at', { ascending: false });

    if (startAt) {
      bookingsQuery = bookingsQuery.gte('created_at', startAt);
      reviewsQuery = reviewsQuery.gte('created_at', startAt);
      newUsersQuery = newUsersQuery.gte('created_at', startAt);
      searchLogsQuery = searchLogsQuery.gte('created_at', startAt);
      analyticsEventsQuery = analyticsEventsQuery.gte('created_at', startAt);
      serviceBookingsQuery = serviceBookingsQuery.gte('created_at', startAt);
    }

    if (endAt) {
      bookingsQuery = bookingsQuery.lte('created_at', endAt);
      reviewsQuery = reviewsQuery.lte('created_at', endAt);
      newUsersQuery = newUsersQuery.lte('created_at', endAt);
      searchLogsQuery = searchLogsQuery.lte('created_at', endAt);
      analyticsEventsQuery = analyticsEventsQuery.lte('created_at', endAt);
      serviceBookingsQuery = serviceBookingsQuery.lte('created_at', endAt);
    }

    const [
      { data: bookingRows, error: bookingsError },
      { data: experienceRows, error: experiencesError },
      { data: reviewRows, error: reviewsError },
      { data: newUserRows, error: newUsersError },
      { data: searchLogRows, error: searchLogsError },
      { data: analyticsEventRows, error: analyticsEventsError },
      { data: serviceBookingRows, error: serviceBookingsError },
    ] = await Promise.all([
      bookingsQuery,
      supabaseAdmin.from('experiences').select('id, title, status, created_at').order('created_at', { ascending: false }),
      reviewsQuery,
      newUsersQuery,
      searchLogsQuery,
      analyticsEventsQuery,
      serviceBookingsQuery,
    ]);

    if (bookingsError) throw bookingsError;
    if (experiencesError) throw experiencesError;
    if (reviewsError) throw reviewsError;
    if (newUsersError) throw newUsersError;
    if (searchLogsError) throw searchLogsError;
    if (analyticsEventsError) throw analyticsEventsError;
    if (serviceBookingsError) throw serviceBookingsError;

    const bookings = (bookingRows || []) as AnalyticsBookingRow[];
    const experiences = (experienceRows || []) as AnalyticsExperienceRow[];
    const reviews = (reviewRows || []) as AnalyticsReviewRow[];
    const newUsers = (newUserRows || []) as AnalyticsProfileRow[];
    const searchLogs = (searchLogRows || []) as AnalyticsSearchLogRow[];
    const analyticsEvents = (analyticsEventRows || []) as AnalyticsEventRow[];
    const serviceBookings = (serviceBookingRows || []) as AnalyticsServiceBookingRow[];

    const paidCustomerIds = Array.from(
      new Set(
        [
          ...bookings
            .filter((booking) => isConfirmedBookingStatus(booking.status || '') && booking.user_id)
            .map((booking) => booking.user_id as string),
          ...serviceBookings
            .filter((booking) => isPaidServiceBooking(booking.status || '') || isCompletedServiceBooking(booking.status || ''))
            .map((booking) => booking.customer_id)
            .filter(Boolean) as string[],
        ]
      )
    );

    let guestProfiles: AnalyticsProfileRow[] = [];
    if (paidCustomerIds.length > 0) {
      const { data: guestProfileRows, error: guestProfilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, nationality, gender, birth_date, dob')
        .in('id', paidCustomerIds);

      if (guestProfilesError) throw guestProfilesError;
      guestProfiles = (guestProfileRows || []) as AnalyticsProfileRow[];
    }

    let gmv = 0;
    let netRevenue = 0;
    let cancelledCount = 0;
    let completedCount = 0;
    let userCancel = 0;
    let hostCancel = 0;

    const userBookingCounts: Record<string, number> = {};
    const experienceStats: Record<string, { count: number; revenue: number; ratingSum: number; reviewCount: number }> = {};
    const priceDistribution = { low: 0, mid: 0, high: 0 };
    const timeSeriesMap: Record<string, { label: string; amount: number }> = {};

    for (const booking of bookings) {
      if (isConfirmedBookingStatus(booking.status || '')) {
        completedCount += 1;
        const amount = Number(booking.amount || 0);
        gmv += amount;
        netRevenue += getBookingPlatformRevenue(booking);

        if (amount < 30000) priceDistribution.low += 1;
        else if (amount < 100000) priceDistribution.mid += 1;
        else priceDistribution.high += 1;

        const dateKey = format(new Date(booking.created_at), 'yyyy-MM-dd');
        const currentSeries = timeSeriesMap[dateKey] || { label: format(new Date(booking.created_at), 'MM.dd'), amount: 0 };
        currentSeries.amount += amount;
        timeSeriesMap[dateKey] = currentSeries;

        if (booking.user_id) {
          userBookingCounts[booking.user_id] = (userBookingCounts[booking.user_id] || 0) + 1;
        }

        if (booking.experience_id != null) {
          const experienceKey = String(booking.experience_id);
          if (!experienceStats[experienceKey]) {
            experienceStats[experienceKey] = { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
          }
          experienceStats[experienceKey].count += 1;
          experienceStats[experienceKey].revenue += amount;
        }
      }

      if (isCancelledBookingStatus(booking.status || '')) {
        cancelledCount += 1;
        if ((booking.status || '').toLowerCase() === 'cancelled') userCancel += 1;
        else hostCancel += 1;
      }
    }

    for (const booking of serviceBookings) {
      if (!isPaidServiceBooking(booking.status || '') && !isCompletedServiceBooking(booking.status || '')) {
        continue;
      }

      completedCount += 1;
      const amount = Number(booking.amount || 0);
      const hostPayoutAmount = Number(booking.host_payout_amount || 0);
      const platformRevenue = booking.platform_revenue != null
        ? Number(booking.platform_revenue || 0)
        : Math.max(amount - hostPayoutAmount, 0);

      gmv += amount;
      netRevenue += platformRevenue;

      if (amount < 30000) priceDistribution.low += 1;
      else if (amount < 100000) priceDistribution.mid += 1;
      else priceDistribution.high += 1;

      const dateKey = format(new Date(booking.created_at), 'yyyy-MM-dd');
      const currentSeries = timeSeriesMap[dateKey] || { label: format(new Date(booking.created_at), 'MM.dd'), amount: 0 };
      currentSeries.amount += amount;
      timeSeriesMap[dateKey] = currentSeries;

      if (booking.customer_id) {
        userBookingCounts[booking.customer_id] = (userBookingCounts[booking.customer_id] || 0) + 1;
      }

    }

    for (const review of reviews) {
      if (review.experience_id == null) continue;
      const experienceKey = String(review.experience_id);
      if (!experienceStats[experienceKey]) continue;
      experienceStats[experienceKey].ratingSum += Number(review.rating || 0);
      experienceStats[experienceKey].reviewCount += 1;
    }

    const allExperiences = experiences
      .map((experience) => {
        const stat = experienceStats[String(experience.id)] || { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
        return {
          ...experience,
          bookingCount: stat.count,
          totalRevenue: stat.revenue,
          rating: stat.reviewCount > 0 ? (stat.ratingSum / stat.reviewCount).toFixed(1) : 'New',
          reviewCount: stat.reviewCount,
        };
      })
      .filter((experience) => experience.bookingCount > 0)
      .sort((left, right) => right.bookingCount - left.bookingCount);

    const topExperiences = allExperiences.slice(0, 5);

    const expsBreakdown = experiences.reduce(
      (acc, experience) => {
        if (experience.created_at) {
          const createdAt = new Date(experience.created_at);
          const createdAtMs = createdAt.getTime();
          const startMs = startAt ? new Date(startAt).getTime() : null;
          const endMs = endAt ? new Date(endAt).getTime() : null;
          const withinRange = (!startMs || createdAtMs >= startMs) && (!endMs || createdAtMs <= endMs);
          if (withinRange) acc.new += 1;
        }

        if (experience.status === 'active') acc.active += 1;
        else if (experience.status === 'pending') acc.pending += 1;
        else if (experience.status === 'rejected') acc.rejected += 1;

        return acc;
      },
      { new: 0, active: 0, pending: 0, rejected: 0 }
    );

    const returnUsers = Object.values(userBookingCounts).filter((count) => count > 1).length;
    const retentionBreakdown = Object.values(userBookingCounts).reduce(
      (acc, count) => {
        if (count === 1) acc.once += 1;
        else if (count === 2) acc.twice += 1;
        else if (count >= 3) acc.threeOrMore += 1;
        return acc;
      },
      { once: 0, twice: 0, threeOrMore: 0 }
    );

    const guestProfileMap = new Map(guestProfiles.map((profile) => [profile.id, profile]));
    const nationalityCounts: Record<string, number> = {};
    const ageCounts: Record<string, number> = { '10대': 0, '20대': 0, '30대': 0, '40대+': 0 };
    const genderCounts: Record<string, number> = { 남성: 0, 여성: 0, 기타: 0 };

    for (const guestId of Object.keys(userBookingCounts)) {
      const profile = guestProfileMap.get(guestId);
      if (!profile) continue;

      const nationality = String(profile.nationality || '미입력').trim() || '미입력';
      nationalityCounts[nationality] = (nationalityCounts[nationality] || 0) + 1;

      const genderKey = GUEST_GENDER_BUCKETS[String(profile.gender || '').trim().toLowerCase()] || null;
      if (genderKey) {
        genderCounts[genderKey] = (genderCounts[genderKey] || 0) + 1;
      }

      const ageBucket = getAgeBucket(parseBirthYear(profile.birth_date || profile.dob));
      if (ageBucket) {
        ageCounts[ageBucket] = (ageCounts[ageBucket] || 0) + 1;
      }
    }

    const totalUniqueGuests = Object.keys(userBookingCounts).length;
    const allNationalities = toDistributionStats(nationalityCounts, totalUniqueGuests);
    const topNationalities = allNationalities.slice(0, 4);
    const ageDistribution = toDistributionStats(ageCounts, totalUniqueGuests);
    const genderDistribution = toDistributionStats(genderCounts, Object.values(genderCounts).reduce((sum, count) => sum + count, 0));

    const searchKeywordCounts: Record<string, number> = {};
    let totalSearches = 0;
    for (const searchLog of searchLogs) {
      const keyword = String(searchLog.keyword || '').trim();
      if (!keyword) continue;
      totalSearches += 1;
      searchKeywordCounts[keyword] = (searchKeywordCounts[keyword] || 0) + 1;
    }
    const allSearchTrends = toTrendStats(searchKeywordCounts, totalSearches);
    const topSearchTrends = allSearchTrends.slice(0, 10);

    let views = 0;
    let clicks = 0;
    let paymentInit = 0;
    for (const event of analyticsEvents) {
      if (event.event_type === 'view') views += 1;
      else if (event.event_type === 'click') clicks += 1;
      else if (event.event_type === 'payment_init') paymentInit += 1;
    }

    const timeSeriesKeys = Object.keys(timeSeriesMap).sort();
    const recentTimeSeriesKeys = timeSeriesKeys.slice(-7);
    const maxTimeSeriesAmount = Math.max(...recentTimeSeriesKeys.map((key) => timeSeriesMap[key]?.amount || 0), 1);
    const timeSeries = recentTimeSeriesKeys.map((key) => ({
      dateStr: timeSeriesMap[key].label,
      amount: timeSeriesMap[key].amount,
      height: (timeSeriesMap[key].amount / maxTimeSeriesAmount) * 100,
    }));

    let topRevenueDate = { dateStr: '-', amount: 0 };
    for (const key of timeSeriesKeys) {
      const series = timeSeriesMap[key];
      if (series.amount > topRevenueDate.amount) {
        topRevenueDate = { dateStr: series.label, amount: series.amount };
      }
    }

    const newUsersList = newUsers.slice(0, 5).map((profile) => ({
      id: profile.id,
      name: profile.full_name || profile.name || 'Unknown',
      created_at: profile.created_at,
      nationality: profile.nationality || null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: newUsers.length,
        activeExpsCount: experiences.filter((experience) => experience.status === 'active').length,
        gmv,
        netRevenue,
        hostPayout: Math.max(0, gmv - netRevenue),
        conversionRate: newUsers.length > 0 ? ((completedCount / newUsers.length) * 100).toFixed(1) : '0.0',
        retentionRate: Object.keys(userBookingCounts).length > 0
          ? ((returnUsers / Object.keys(userBookingCounts).length) * 100).toFixed(1)
          : '0.0',
        aov: completedCount > 0 ? Math.floor(gmv / completedCount) : 0,
        cancellationRate: (cancelledCount + completedCount) > 0
          ? Math.floor((cancelledCount / (cancelledCount + completedCount)) * 100)
          : 0,
        topExperiences,
        allExperiences,
        funnel: {
          views,
          clicks,
          paymentInit,
          completed: completedCount,
        },
        cancelBreakdown: { user: userCancel, host: hostCancel },
        priceDistribution,
        demographics: {
          nationalities: topNationalities,
          ages: ageDistribution,
          genders: genderDistribution,
          allNationalities,
        },
        searchTrends: topSearchTrends,
        allSearchTrends,
        timeSeries,
        newUsersList,
        topRevenueDate,
        expsBreakdown,
        retentionBreakdown,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/analytics-summary error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
