'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { endOfDay, format, startOfDay } from 'date-fns';

import { isCancelledBookingStatus, isConfirmedBookingStatus } from '@/app/constants/bookingStatus';
import { getBookingPlatformRevenue } from '@/app/utils/bookingFinance';
import type {
  AnalyticsBusinessSummary,
  AnalyticsCustomerCompositionSummary,
  AnalyticsHostCandidate,
  AnalyticsHostSummary,
  AnalyticsInquiryMessageInput,
  AnalyticsSearchIntentSummary,
  AnalyticsSummaryDataArgs,
  AnalyticsSummaryDataResult,
  AnalyticsSummarySources,
  AnalyticsStats,
  CustomerCompositionSource,
  SearchIntentSource,
} from '../components/analytics/types';

const DEFAULT_ANALYTICS_STATS: AnalyticsStats = {
  totalUsers: 0,
  activeExpsCount: 0,
  gmv: 0,
  netRevenue: 0,
  hostPayout: 0,
  conversionRate: '0.0',
  retentionRate: '0.0',
  aov: 0,
  cancellationRate: 0,
  topExperiences: [],
  allExperiences: [],
  superHostCandidates: [],
  funnel: { views: 0, clicks: 0, paymentInit: 0, completed: 0 },
  cancelBreakdown: { user: 0, host: 0 },
  priceDistribution: { low: 0, mid: 0, high: 0 },
  demographics: {
    nationalities: [],
    ages: [],
    genders: [],
    allNationalities: [],
  },
  searchTrends: [],
  allSearchTrends: [],
  timeSeries: [],
  riskHosts: [],
  newUsersList: [],
  topRevenueDate: { dateStr: '', amount: 0 },
  hostEcosystem: {
    sources: [],
    languages: [],
    nationalities: [],
    allSources: [],
    allLanguages: [],
    allNationalities: [],
    funnel: { applied: 0, approved: 0, active: 0, booked: 0 },
  },
  avgResponseTime: 0,
  responseRate: 0,
  topRespHosts: [],
  bottomRespHosts: [],
  expsBreakdown: { new: 0, active: 0, pending: 0, rejected: 0 },
  retentionBreakdown: { once: 0, twice: 0, threeOrMore: 0 },
};

type HostStatsAccumulator = {
  bookings: number;
  ratingSum: number;
  reviewCount: number;
  cancelCount: number;
};

type ExperienceStatsAccumulator = {
  count: number;
  revenue: number;
  ratingSum: number;
  reviewCount: number;
};

type HostCommunicationAccumulator = {
  total: number;
  answered: number;
  timeMs: number;
};

export function useAnalyticsSummaryData({
  bookings,
  users,
  exps,
  apps,
  reviews,
  searchLogs,
  analyticsEvents,
  inquiries,
  inquiryMessages,
  dateRange,
}: AnalyticsSummaryDataArgs): AnalyticsSummaryDataResult {
  const [loading, setLoading] = useState(true);
  const [summarySource, setSummarySource] = useState<AnalyticsSummarySources>({
    business: 'server',
    host: 'server',
  });
  const [searchIntentSource, setSearchIntentSource] = useState<SearchIntentSource>('server');
  const [searchIntent, setSearchIntent] = useState<AnalyticsSearchIntentSummary | null>(null);
  const [customerCompositionSource, setCustomerCompositionSource] = useState<CustomerCompositionSource>('server');
  const [customerComposition, setCustomerComposition] = useState<AnalyticsCustomerCompositionSummary | null>(null);
  const [stats, setStats] = useState<AnalyticsStats>(DEFAULT_ANALYTICS_STATS);

  const statsRef = useRef<AnalyticsStats>(DEFAULT_ANALYTICS_STATS);
  const summaryCacheRef = useRef<{
    business: Record<string, AnalyticsBusinessSummary>;
    host: Record<string, AnalyticsHostSummary>;
  }>({
    business: {},
    host: {},
  });
  const searchIntentCacheRef = useRef<Record<string, AnalyticsSearchIntentSummary>>({});
  const customerCompositionCacheRef = useRef<Record<string, AnalyticsCustomerCompositionSummary>>({});

  const isWithinDateRange = useCallback((dateString?: string | null) => {
    if (!dateString || !dateRange[0]?.startDate || !dateRange[0]?.endDate) {
      return true;
    }

    const target = new Date(dateString);
    const start = startOfDay(dateRange[0].startDate);
    const end = endOfDay(dateRange[0].endDate);
    return target >= start && target <= end;
  }, [dateRange]);

  const buildLocalStats = useCallback((): AnalyticsStats => {
    try {
      let gmv = 0;
      let netRevenue = 0;
      let cancelledCount = 0;
      let completedCount = 0;
      let userCancel = 0;
      let hostCancel = 0;

      const userBookingCounts: Record<string, number> = {};
      const expStats: Record<string, ExperienceStatsAccumulator> = {};
      const hostStats: Record<string, HostStatsAccumulator> = {};
      const priceDist = { low: 0, mid: 0, high: 0 };

      const nationalityCount: Record<string, number> = {};
      const ageCount: Record<string, number> = { '10s': 0, '20s': 0, '30s': 0, '40s+': 0 };
      const genderCount: Record<string, number> = { '남성': 0, '여성': 0, '기타': 0 };
      const timeSeriesMap: Record<string, number> = {};
      const searchKeywordCount: Record<string, number> = {};

      bookings.forEach((booking) => {
        if (!booking.created_at || !isWithinDateRange(booking.created_at)) return;

        const experience = exps.find((item) => item.id === booking.experience_id);
        if (experience?.host_id) {
          if (!hostStats[experience.host_id]) {
            hostStats[experience.host_id] = { bookings: 0, ratingSum: 0, reviewCount: 0, cancelCount: 0 };
          }
          hostStats[experience.host_id].bookings += 1;
        }

        if (isConfirmedBookingStatus(booking.status || '')) {
          completedCount += 1;
          const amount = Number(booking.amount || 0);
          gmv += amount;
          netRevenue += getBookingPlatformRevenue(booking);

          if (amount < 30000) priceDist.low += 1;
          else if (amount < 100000) priceDist.mid += 1;
          else priceDist.high += 1;

          const dateStr = format(new Date(booking.created_at), 'MM.dd');
          timeSeriesMap[dateStr] = (timeSeriesMap[dateStr] || 0) + amount;

          if (booking.user_id) {
            userBookingCounts[booking.user_id] = (userBookingCounts[booking.user_id] || 0) + 1;
          }

          if (booking.experience_id) {
            if (!expStats[booking.experience_id]) {
              expStats[booking.experience_id] = { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
            }
            expStats[booking.experience_id].count += 1;
            expStats[booking.experience_id].revenue += amount;
          }
        }

        if (isCancelledBookingStatus(booking.status || '')) {
          cancelledCount += 1;
          if ((booking.status || '').toLowerCase() === 'cancelled') userCancel += 1;
          else hostCancel += 1;

          if (experience?.host_id && hostStats[experience.host_id]) {
            hostStats[experience.host_id].cancelCount += 1;
          }
        }
      });

      reviews.forEach((review) => {
        if (!review.created_at || !isWithinDateRange(review.created_at)) return;
        if (review.experience_id && expStats[review.experience_id]) {
          expStats[review.experience_id].ratingSum += Number(review.rating || 0);
          expStats[review.experience_id].reviewCount += 1;
        }

        const experience = exps.find((item) => item.id === review.experience_id);
        if (experience?.host_id && hostStats[experience.host_id]) {
          hostStats[experience.host_id].ratingSum += Number(review.rating || 0);
          hostStats[experience.host_id].reviewCount += 1;
        }
      });

      const allExps = exps
        .map((experience) => {
          const summary = expStats[experience.id || ''] || { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
          return {
            ...experience,
            bookingCount: summary.count,
            totalRevenue: summary.revenue,
            rating: summary.reviewCount > 0 ? (summary.ratingSum / summary.reviewCount).toFixed(1) : 'New',
            reviewCount: summary.reviewCount,
          };
        })
        .filter((experience) => experience.bookingCount > 0)
        .sort((left, right) => right.bookingCount - left.bookingCount);

      const superHosts: AnalyticsHostCandidate[] = [];
      const riskHosts: AnalyticsHostCandidate[] = [];

      Object.entries(hostStats).forEach(([id, summary]) => {
        const hostInfo = users.find((user) => user.id === id);
        const ratingNum = summary.reviewCount > 0 ? summary.ratingSum / summary.reviewCount : 0;
        const host = {
          id,
          name: hostInfo?.name || 'Unknown Host',
          email: hostInfo?.email,
          bookings: summary.bookings,
          cancelCount: summary.cancelCount,
          rating: ratingNum > 0 ? ratingNum.toFixed(1) : 'New',
        };

        if (host.bookings >= 3 && ratingNum >= 4.0 && host.cancelCount === 0) {
          superHosts.push(host);
        }

        if (host.cancelCount >= 2 || (ratingNum > 0 && ratingNum < 3.5)) {
          riskHosts.push(host);
        }
      });

      const newUsersList = users.filter((user) => user.created_at && isWithinDateRange(user.created_at));
      const newUsersCount = newUsersList.length;
      const returnUsers = Object.values(userBookingCounts).filter((count) => count > 1).length;

      const expsBreakdown = { new: 0, active: 0, pending: 0, rejected: 0 };
      exps.forEach((experience) => {
        if (experience.created_at && isWithinDateRange(experience.created_at)) expsBreakdown.new += 1;
        if (experience.status === 'active') expsBreakdown.active += 1;
        else if (experience.status === 'pending') expsBreakdown.pending += 1;
        else if (experience.status === 'rejected') expsBreakdown.rejected += 1;
      });

      const retentionBreakdown = { once: 0, twice: 0, threeOrMore: 0 };
      Object.values(userBookingCounts).forEach((count) => {
        if (count === 1) retentionBreakdown.once += 1;
        else if (count === 2) retentionBreakdown.twice += 1;
        else if (count >= 3) retentionBreakdown.threeOrMore += 1;
      });

      const totalUniqueGuests = Object.keys(userBookingCounts).length;
      const allNationalitiesSorted = Object.entries(nationalityCount)
        .map(([name, count]) => ({ name, count, percent: totalUniqueGuests ? (count / totalUniqueGuests) * 100 : 0 }))
        .sort((left, right) => right.count - left.count);
      const topNationalities = allNationalitiesSorted.slice(0, 4);

      const agesArr = Object.entries(ageCount)
        .map(([name, count]) => ({ name: name.replace('s', '대'), count, percent: totalUniqueGuests ? (count / totalUniqueGuests) * 100 : 0 }));

      const totalGenders = Object.values(genderCount).reduce((sum, count) => sum + count, 0);
      const genderArr = Object.entries(genderCount)
        .filter(([, count]) => count > 0)
        .map(([name, count]) => ({ name, count, percent: totalGenders ? (count / totalGenders) * 100 : 0 }));

      let totalSearches = 0;
      searchLogs.forEach((log) => {
        if (!log.created_at || !isWithinDateRange(log.created_at) || !log.keyword) return;
        totalSearches += 1;
        searchKeywordCount[log.keyword] = (searchKeywordCount[log.keyword] || 0) + 1;
      });

      const allKeywordsSorted = Object.entries(searchKeywordCount)
        .map(([keyword, count]) => ({ keyword, count, percent: totalSearches ? (count / totalSearches) * 100 : 0 }))
        .sort((left, right) => right.count - left.count);

      let realViews = 0;
      let realClicks = 0;
      let realInit = 0;
      analyticsEvents.forEach((event) => {
        if (!event.created_at || !isWithinDateRange(event.created_at)) return;
        if (event.event_type === 'view') realViews += 1;
        else if (event.event_type === 'click') realClicks += 1;
        else if (event.event_type === 'payment_init') realInit += 1;
      });

      const sortedKeys = Object.keys(timeSeriesMap).sort();
      const recentDates = sortedKeys.slice(-7);
      const maxSeriesAmount = Math.max(...recentDates.map((key) => timeSeriesMap[key]), 1);
      const timeSeries = recentDates.map((key) => ({
        dateStr: key,
        amount: timeSeriesMap[key],
        height: (timeSeriesMap[key] / maxSeriesAmount) * 100,
      }));

      let topRevenueDate = { dateStr: '-', amount: 0 };
      Object.entries(timeSeriesMap).forEach(([dateStr, amount]) => {
        if (amount > topRevenueDate.amount) {
          topRevenueDate = { dateStr, amount };
        }
      });

      const hostSources: Record<string, number> = {};
      const hostLangs: Record<string, number> = {};
      const hostNats: Record<string, number> = {};
      let applied = 0;
      let approved = 0;
      const activeHosts = new Set<string>();
      const bookedHosts = new Set<string>();

      apps.forEach((application) => {
        if (!application.created_at || !isWithinDateRange(application.created_at)) return;
        applied += 1;
        if (application.status === 'approved') approved += 1;

        const source = application.source || '기타/미입력';
        hostSources[source] = (hostSources[source] || 0) + 1;

        const nationality = application.host_nationality || '미입력';
        hostNats[nationality] = (hostNats[nationality] || 0) + 1;

        const languages = Array.isArray(application.languages)
          ? application.languages
          : application.languages
            ? [application.languages]
            : [];

        languages.forEach((language) => {
          hostLangs[language] = (hostLangs[language] || 0) + 1;
        });
      });

      const hostCommStats: Record<string, HostCommunicationAccumulator> = {};
      let totalHostInquiries = 0;
      let answeredHostInquiries = 0;
      let totalResponseTimeMs = 0;

      const messagesByInquiry: Record<string, AnalyticsInquiryMessageInput[]> = {};
      inquiryMessages.forEach((message) => {
        if (!message.inquiry_id) return;
        if (!messagesByInquiry[message.inquiry_id]) {
          messagesByInquiry[message.inquiry_id] = [];
        }
        messagesByInquiry[message.inquiry_id].push(message);
      });

      Object.keys(messagesByInquiry).forEach((id) => {
        messagesByInquiry[id].sort((left, right) => new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime());
      });

      inquiries.forEach((inquiry) => {
        if (!inquiry.host_id || !inquiry.created_at || !isWithinDateRange(inquiry.created_at)) return;
        totalHostInquiries += 1;

        if (!hostCommStats[inquiry.host_id]) {
          hostCommStats[inquiry.host_id] = { total: 0, answered: 0, timeMs: 0 };
        }
        hostCommStats[inquiry.host_id].total += 1;

        const messages = messagesByInquiry[inquiry.id || ''] || [];
        const firstHostMessage = messages.find((message) => message.sender_id === inquiry.host_id);
        if (!firstHostMessage?.created_at) return;

        answeredHostInquiries += 1;
        hostCommStats[inquiry.host_id].answered += 1;

        const guestMessage = messages.find((message) => message.sender_id !== inquiry.host_id);
        const startTime = guestMessage?.created_at
          ? new Date(guestMessage.created_at).getTime()
          : new Date(inquiry.created_at).getTime();
        const responseTimeMs = new Date(firstHostMessage.created_at).getTime() - startTime;
        if (responseTimeMs > 0) {
          totalResponseTimeMs += responseTimeMs;
          hostCommStats[inquiry.host_id].timeMs += responseTimeMs;
        }
      });

      const avgResponseTime = answeredHostInquiries > 0 ? (totalResponseTimeMs / answeredHostInquiries) / (1000 * 60) : 0;
      const responseRate = totalHostInquiries > 0 ? (answeredHostInquiries / totalHostInquiries) * 100 : 0;

      const topRespHosts = Object.entries(hostCommStats)
        .map(([id, summary]) => {
          const hostInfo = users.find((user) => user.id === id);
          const rate = summary.total > 0 ? (summary.answered / summary.total) * 100 : 0;
          const timeMins = summary.answered > 0 ? (summary.timeMs / summary.answered) / (1000 * 60) : 0;
          return {
            id,
            name: hostInfo?.name || hostInfo?.full_name || 'Unknown',
            rate,
            timeMins: Math.round(timeMins),
            total: summary.total,
          };
        })
        .filter((host) => host.total >= 1);

      exps.forEach((experience) => {
        if (experience.status === 'active' && experience.host_id) {
          activeHosts.add(experience.host_id);
        }
      });

      bookings.forEach((booking) => {
        if (!booking.created_at || !isWithinDateRange(booking.created_at) || !isConfirmedBookingStatus(booking.status || '')) return;
        const experience = exps.find((item) => item.id === booking.experience_id);
        if (experience?.host_id) {
          bookedHosts.add(experience.host_id);
        }
      });

      const allHostSources = Object.entries(hostSources)
        .map(([name, count]) => ({ name, count, percent: applied ? (count / applied) * 100 : 0 }))
        .sort((left, right) => right.count - left.count);
      const allHostNats = Object.entries(hostNats)
        .map(([name, count]) => ({ name, count, percent: applied ? (count / applied) * 100 : 0 }))
        .sort((left, right) => right.count - left.count);
      const totalLangs = Object.values(hostLangs).reduce((sum, count) => sum + count, 0);
      const allHostLangs = Object.entries(hostLangs)
        .map(([name, count]) => ({ name, count, percent: totalLangs ? (count / totalLangs) * 100 : 0 }))
        .sort((left, right) => right.count - left.count);

      return {
        totalUsers: newUsersCount,
        activeExpsCount: exps.filter((experience) => experience.status === 'active').length,
        gmv,
        netRevenue,
        hostPayout: gmv - netRevenue,
        conversionRate: newUsersCount > 0 ? ((completedCount / newUsersCount) * 100).toFixed(1) : '0.0',
        retentionRate: Object.keys(userBookingCounts).length
          ? ((returnUsers / Object.keys(userBookingCounts).length) * 100).toFixed(1)
          : '0.0',
        aov: completedCount > 0 ? Math.floor(gmv / completedCount) : 0,
        cancellationRate: cancelledCount + completedCount > 0 ? Math.floor((cancelledCount / (cancelledCount + completedCount)) * 100) : 0,
        topExperiences: allExps.slice(0, 5),
        allExperiences: allExps,
        superHostCandidates: superHosts.slice(0, 5),
        funnel: {
          views: realViews,
          clicks: realClicks,
          paymentInit: realInit,
          completed: completedCount,
        },
        cancelBreakdown: { user: userCancel, host: hostCancel },
        priceDistribution: priceDist,
        demographics: {
          nationalities: topNationalities,
          ages: agesArr,
          genders: genderArr,
          allNationalities: allNationalitiesSorted,
        },
        searchTrends: allKeywordsSorted.slice(0, 10),
        allSearchTrends: allKeywordsSorted,
        timeSeries,
        riskHosts: riskHosts.slice(0, 5),
        newUsersList: newUsersList.slice(0, 5),
        topRevenueDate,
        hostEcosystem: {
          sources: allHostSources.slice(0, 4),
          languages: allHostLangs.slice(0, 4),
          nationalities: allHostNats.slice(0, 4),
          allSources: allHostSources,
          allLanguages: allHostLangs,
          allNationalities: allHostNats,
          funnel: { applied, approved, active: activeHosts.size, booked: bookedHosts.size },
        },
        avgResponseTime: avgResponseTime > 0 ? Math.round(avgResponseTime) : 0,
        responseRate: responseRate > 0 ? Number(responseRate.toFixed(1)) : 0,
        topRespHosts: [...topRespHosts].sort((left, right) => right.rate - left.rate || left.timeMins - right.timeMins).slice(0, 10),
        bottomRespHosts: [...topRespHosts].sort((left, right) => left.rate - right.rate || right.timeMins - left.timeMins).slice(0, 10),
        expsBreakdown,
        retentionBreakdown,
      };
    } catch (error) {
      console.error(error);
      return DEFAULT_ANALYTICS_STATS;
    }
  }, [analyticsEvents, apps, bookings, exps, inquiries, inquiryMessages, isWithinDateRange, reviews, searchLogs, users]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    let cancelled = false;

    const loadAnalyticsData = async () => {
      setLoading(true);

      let localStats: AnalyticsStats | null = null;
      const getLocalStats = () => {
        if (!localStats) {
          localStats = buildLocalStats();
        }
        return localStats;
      };

      const params = new URLSearchParams();
      if (dateRange[0]?.startDate) {
        params.set('startAt', startOfDay(dateRange[0].startDate).toISOString());
      }
      if (dateRange[0]?.endDate) {
        params.set('endAt', endOfDay(dateRange[0].endDate).toISOString());
      }

      const queryString = params.toString();
      const analyticsSummaryUrl = queryString ? `/api/admin/analytics-summary?${queryString}` : '/api/admin/analytics-summary';
      const analyticsHostUrl = queryString ? `/api/admin/analytics-host-summary?${queryString}` : '/api/admin/analytics-host-summary';
      const analyticsSearchIntentUrl = queryString ? `/api/admin/analytics-search-intent?${queryString}` : '/api/admin/analytics-search-intent';
      const analyticsCustomerCompositionUrl = queryString ? `/api/admin/analytics-customer-composition?${queryString}` : '/api/admin/analytics-customer-composition';
      const cacheKey = queryString || 'default';
      const cachedBusinessSummary = summaryCacheRef.current.business[cacheKey];
      const cachedHostSummary = summaryCacheRef.current.host[cacheKey];
      const cachedSearchIntent = searchIntentCacheRef.current[cacheKey];
      const cachedCustomerComposition = customerCompositionCacheRef.current[cacheKey];

      const [businessResult, hostResult, searchIntentResult, customerCompositionResult] = await Promise.allSettled([
        fetch(analyticsSummaryUrl).then(async (response) => {
          if (!response.ok) {
            throw new Error('Analytics summary fetch failed');
          }
          const result = await response.json();
          if (!result?.success) {
            throw new Error(result?.error || 'Analytics summary fetch failed');
          }
          return result.data as AnalyticsBusinessSummary;
        }),
        fetch(analyticsHostUrl).then(async (response) => {
          if (!response.ok) {
            throw new Error('Analytics host summary fetch failed');
          }
          const result = await response.json();
          if (!result?.success) {
            throw new Error(result?.error || 'Analytics host summary fetch failed');
          }
          return result.data as AnalyticsHostSummary;
        }),
        fetch(analyticsSearchIntentUrl).then(async (response) => {
          if (!response.ok) {
            throw new Error('Analytics search intent fetch failed');
          }
          const result = await response.json();
          if (!result?.success) {
            throw new Error(result?.error || 'Analytics search intent fetch failed');
          }
          return result.data as AnalyticsSearchIntentSummary;
        }),
        fetch(analyticsCustomerCompositionUrl).then(async (response) => {
          if (!response.ok) {
            throw new Error('Analytics customer composition fetch failed');
          }
          const result = await response.json();
          if (!result?.success) {
            throw new Error(result?.error || 'Analytics customer composition fetch failed');
          }
          return result.data as AnalyticsCustomerCompositionSummary;
        }),
      ]);

      const nextSummarySource: AnalyticsSummarySources = {
        business: 'fallback',
        host: 'fallback',
      };
      let nextStats = statsRef.current;

      if (businessResult.status === 'fulfilled') {
        summaryCacheRef.current.business[cacheKey] = businessResult.value;
        nextStats = { ...nextStats, ...businessResult.value };
        nextSummarySource.business = 'server';
      } else if (cachedBusinessSummary) {
        nextStats = { ...nextStats, ...cachedBusinessSummary };
        nextSummarySource.business = 'cached';
      } else {
        nextStats = { ...nextStats, ...getLocalStats() };
        console.error('[AnalyticsTab] analytics-summary fallback:', businessResult.reason);
      }

      if (hostResult.status === 'fulfilled') {
        summaryCacheRef.current.host[cacheKey] = hostResult.value;
        nextStats = { ...nextStats, ...hostResult.value };
        nextSummarySource.host = 'server';
      } else if (cachedHostSummary) {
        nextStats = { ...nextStats, ...cachedHostSummary };
        nextSummarySource.host = 'cached';
      } else {
        nextStats = { ...nextStats, ...getLocalStats() };
        console.error('[AnalyticsTab] analytics-host-summary fallback:', hostResult.reason);
      }

      let nextSearchIntent: AnalyticsSearchIntentSummary | null = null;
      let nextSearchIntentSource: SearchIntentSource = 'unavailable';
      let nextCustomerComposition: AnalyticsCustomerCompositionSummary | null = null;
      let nextCustomerCompositionSource: CustomerCompositionSource = 'unavailable';

      if (searchIntentResult.status === 'fulfilled') {
        searchIntentCacheRef.current[cacheKey] = searchIntentResult.value;
        nextSearchIntent = searchIntentResult.value;
        nextSearchIntentSource = 'server';
      } else if (cachedSearchIntent) {
        nextSearchIntent = cachedSearchIntent;
        nextSearchIntentSource = 'cached';
      } else {
        console.error('[AnalyticsTab] analytics-search-intent unavailable:', searchIntentResult.reason);
      }

      if (customerCompositionResult.status === 'fulfilled') {
        customerCompositionCacheRef.current[cacheKey] = customerCompositionResult.value;
        nextCustomerComposition = customerCompositionResult.value;
        nextCustomerCompositionSource = 'server';
      } else if (cachedCustomerComposition) {
        nextCustomerComposition = cachedCustomerComposition;
        nextCustomerCompositionSource = 'cached';
      } else {
        console.error('[AnalyticsTab] analytics-customer-composition unavailable:', customerCompositionResult.reason);
      }

      if (!cancelled) {
        statsRef.current = nextStats;
        setStats(nextStats);
        setSummarySource(nextSummarySource);
        setSearchIntent(nextSearchIntent);
        setSearchIntentSource(nextSearchIntentSource);
        setCustomerComposition(nextCustomerComposition);
        setCustomerCompositionSource(nextCustomerCompositionSource);
        setLoading(false);
      }
    };

    void loadAnalyticsData();

    return () => {
      cancelled = true;
    };
  }, [buildLocalStats, dateRange]);

  return {
    loading,
    stats,
    summarySource,
    searchIntent,
    searchIntentSource,
    customerComposition,
    customerCompositionSource,
  };
}
