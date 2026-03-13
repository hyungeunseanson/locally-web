'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Search, Activity, Star, X, TrendingUp, UserCheck, AlertTriangle, Calendar as CalendarIcon, ChevronDown, CheckCircle } from 'lucide-react';
import Skeleton from '@/app/components/ui/Skeleton';
import { useToast } from '@/app/context/ToastContext';
import dynamic from 'next/dynamic';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { Range } from 'react-date-range';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { isCancelledBookingStatus, isConfirmedBookingStatus } from '@/app/constants/bookingStatus';
import ReviewsTab from './ReviewsTab';
import AuditLogTab from './AuditLogTab';
import { getBookingPlatformRevenue } from '@/app/utils/bookingFinance';

const DateRange = dynamic(() => import('react-date-range').then(mod => mod.DateRange), { ssr: false });

interface AnalyticsTabProps {
  bookings?: any[];
  users?: any[];
  exps?: any[];
  apps?: any[];
  reviews?: any[];
  searchLogs?: any[]; // 🟢 추가
  analyticsEvents?: any[]; // 🟢 추가
  inquiries?: any[]; // 🟢 추가
  inquiryMessages?: any[]; // 🟢 추가
}

const EMPTY_ANALYTICS_ITEMS: any[] = [];

type AnalyticsBusinessSummary = {
  totalUsers: number;
  activeExpsCount: number;
  gmv: number;
  netRevenue: number;
  hostPayout: number;
  conversionRate: string;
  retentionRate: string;
  aov: number;
  cancellationRate: number;
  topExperiences: any[];
  allExperiences: any[];
  funnel: { views: number; clicks: number; paymentInit: number; completed: number };
  cancelBreakdown: { user: number; host: number };
  priceDistribution: { low: number; mid: number; high: number };
  demographics: {
    nationalities: { name: string; count: number; percent: number }[];
    ages: { name: string; count: number; percent: number }[];
    genders: { name: string; count: number; percent: number }[];
    allNationalities: { name: string; count: number; percent: number }[];
  };
  searchTrends: { keyword: string; count: number; percent: number }[];
  allSearchTrends: { keyword: string; count: number; percent: number }[];
  timeSeries: { dateStr: string; amount: number; height: number }[];
  newUsersList: any[];
  topRevenueDate: { dateStr: string; amount: number };
  expsBreakdown: { new: number; active: number; pending: number; rejected: number };
  retentionBreakdown: { once: number; twice: number; threeOrMore: number };
};

type AnalyticsHostSummary = {
  superHostCandidates: any[];
  riskHosts: any[];
  hostEcosystem: {
    sources: { name: string; count: number; percent: number }[];
    languages: { name: string; count: number; percent: number }[];
    nationalities: { name: string; count: number; percent: number }[];
    allSources: { name: string; count: number; percent: number }[];
    allLanguages: { name: string; count: number; percent: number }[];
    allNationalities: { name: string; count: number; percent: number }[];
    funnel: { applied: number; approved: number; active: number; booked: number };
  };
  avgResponseTime: number;
  responseRate: number;
  topRespHosts: any[];
  bottomRespHosts: any[];
};

type SummarySource = 'server' | 'cached' | 'fallback';

type SearchIntentItem = {
  keyword: string;
  searches: number;
  recentSearches: number;
  previousSearches: number;
  surge: number;
  matchedActiveExperiences: number;
};

type AnalyticsSearchIntentSummary = {
  totalSearches: number;
  comparisonWindowDays: number;
  topKeywords: SearchIntentItem[];
  risingKeywords: SearchIntentItem[];
  lowSupplyKeywords: SearchIntentItem[];
  supplyReference: string;
  conversionAvailable: boolean;
};

type SearchIntentSource = 'server' | 'cached' | 'unavailable';

type CompositionBucket = {
  name: string;
  customers: number;
  percent: number;
};

type AnalyticsCustomerCompositionSummary = {
  totalPayingCustomers: number;
  nationalityMix: CompositionBucket[];
  languageMix: CompositionBucket[];
  loyaltyMix: CompositionBucket[];
  purchaseMix: CompositionBucket[];
  sourceAvailable: boolean;
};

type CustomerCompositionSource = 'server' | 'cached' | 'unavailable';

export default function AnalyticsTab(props: AnalyticsTabProps = {}) {
  const bookings = props.bookings ?? EMPTY_ANALYTICS_ITEMS;
  const users = props.users ?? EMPTY_ANALYTICS_ITEMS;
  const exps = props.exps ?? EMPTY_ANALYTICS_ITEMS;
  const apps = props.apps ?? EMPTY_ANALYTICS_ITEMS;
  const reviews = props.reviews ?? EMPTY_ANALYTICS_ITEMS;
  const searchLogs = props.searchLogs ?? EMPTY_ANALYTICS_ITEMS;
  const analyticsEvents = props.analyticsEvents ?? EMPTY_ANALYTICS_ITEMS;
  const inquiries = props.inquiries ?? EMPTY_ANALYTICS_ITEMS;
  const inquiryMessages = props.inquiryMessages ?? EMPTY_ANALYTICS_ITEMS;
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'business' | 'host' | 'reviews' | 'logs'>('business'); // 🟢 서브탭 구분
  const [summarySource, setSummarySource] = useState<{ business: SummarySource; host: SummarySource }>({
    business: 'server',
    host: 'server',
  });
  const [searchIntentSource, setSearchIntentSource] = useState<SearchIntentSource>('server');
  const [searchIntent, setSearchIntent] = useState<AnalyticsSearchIntentSummary | null>(null);
  const [customerCompositionSource, setCustomerCompositionSource] = useState<CustomerCompositionSource>('server');
  const [customerComposition, setCustomerComposition] = useState<AnalyticsCustomerCompositionSummary | null>(null);
  const summaryCacheRef = useRef<{
    business: Record<string, AnalyticsBusinessSummary>;
    host: Record<string, AnalyticsHostSummary>;
  }>({
    business: {},
    host: {},
  });
  const searchIntentCacheRef = useRef<Record<string, AnalyticsSearchIntentSummary>>({});
  const customerCompositionCacheRef = useRef<Record<string, AnalyticsCustomerCompositionSummary>>({});

  // 날짜 필터 상태 추가
  const [dateRange, setDateRange] = useState<Range[]>([{
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    key: 'selection'
  }]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('30D');
  const datePickerRef = useRef<HTMLDivElement>(null);

  // 달력 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePresetClick = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === '1D') setDateRange([{ startDate: subDays(now, 1), endDate: now, key: 'selection' }]);
    else if (preset === '7D') setDateRange([{ startDate: subDays(now, 7), endDate: now, key: 'selection' }]);
    else if (preset === '30D') setDateRange([{ startDate: subDays(now, 30), endDate: now, key: 'selection' }]);
    else if (preset === '3M') setDateRange([{ startDate: subDays(now, 90), endDate: now, key: 'selection' }]);
    else if (preset === '1Y') setDateRange([{ startDate: subDays(now, 365), endDate: now, key: 'selection' }]);
    else if (preset === 'ALL') setDateRange([{ startDate: new Date('2020-01-01'), endDate: now, key: 'selection' }]);
  };

  const isWithinDateRange = (dateString: string) => {
    if (!dateRange[0].startDate || !dateRange[0].endDate) return true;
    const target = new Date(dateString);
    const sd = startOfDay(dateRange[0].startDate);
    const ed = endOfDay(dateRange[0].endDate);
    return target >= sd && target <= ed;
  };

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeExpsCount: 0,
    gmv: 0,
    netRevenue: 0,
    hostPayout: 0,
    conversionRate: '0.0',
    retentionRate: '0.0',
    aov: 0,
    cancellationRate: 0,
    topExperiences: [] as any[],
    allExperiences: [] as any[],
    superHostCandidates: [] as any[], // 🟢 복구: 슈퍼호스트 후보
    funnel: { views: 0, clicks: 0, paymentInit: 0, completed: 0 },
    cancelBreakdown: { user: 0, host: 0 },
    priceDistribution: { low: 0, mid: 0, high: 0 },
    demographics: {
      nationalities: [] as { name: string, count: number, percent: number }[],
      ages: [] as { name: string, count: number, percent: number }[],
      genders: [] as { name: string, count: number, percent: number }[], // 🟢 추가
      allNationalities: [] as { name: string, count: number, percent: number }[]
    },
    searchTrends: [] as { keyword: string, count: number, percent: number }[], // 🟢 추가
    allSearchTrends: [] as { keyword: string, count: number, percent: number }[],
    timeSeries: [] as { dateStr: string, amount: number, height: number }[],
    riskHosts: [] as any[],
    newUsersList: [] as any[], // 모달용
    topRevenueDate: { dateStr: '', amount: 0 }, // 모달용
    hostEcosystem: {
      sources: [] as { name: string, count: number, percent: number }[],
      languages: [] as { name: string, count: number, percent: number }[],
      nationalities: [] as { name: string, count: number, percent: number }[],
      allSources: [] as { name: string, count: number, percent: number }[],
      allLanguages: [] as { name: string, count: number, percent: number }[],
      allNationalities: [] as { name: string, count: number, percent: number }[],
      funnel: { applied: 0, approved: 0, active: 0, booked: 0 }
    },
    avgResponseTime: 0,
    responseRate: 0,
    topRespHosts: [] as any[],
    bottomRespHosts: [] as any[],
    expsBreakdown: { new: 0, active: 0, pending: 0, rejected: 0 },
    retentionBreakdown: { once: 0, twice: 0, threeOrMore: 0 }
  });

  useEffect(() => {
    let cancelled = false;

    const loadAnalyticsData = async () => {
      setLoading(true);

      let localStats: typeof stats | null = null;
      const getLocalStats = () => {
        if (!localStats) {
          localStats = buildLocalStats();
        }
        return localStats;
      };

      const params = new URLSearchParams();
      if (dateRange[0].startDate) {
        params.set('startAt', startOfDay(dateRange[0].startDate).toISOString());
      }
      if (dateRange[0].endDate) {
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

      const nextSummarySource: { business: SummarySource; host: SummarySource } = {
        business: 'fallback',
        host: 'fallback',
      };
      let nextStats = stats;

      if (businessResult.status === 'fulfilled') {
        summaryCacheRef.current.business[cacheKey] = businessResult.value;
        nextStats = {
          ...nextStats,
          ...businessResult.value,
        };
        nextSummarySource.business = 'server';
      } else if (cachedBusinessSummary) {
        nextStats = {
          ...nextStats,
          ...cachedBusinessSummary,
        };
        nextSummarySource.business = 'cached';
      } else {
        nextStats = {
          ...nextStats,
          ...getLocalStats(),
        };
        console.error('[AnalyticsTab] analytics-summary fallback:', businessResult.reason);
      }

      if (hostResult.status === 'fulfilled') {
        summaryCacheRef.current.host[cacheKey] = hostResult.value;
        nextStats = {
          ...nextStats,
          ...hostResult.value,
        };
        nextSummarySource.host = 'server';
      } else if (cachedHostSummary) {
        nextStats = {
          ...nextStats,
          ...cachedHostSummary,
        };
        nextSummarySource.host = 'cached';
      } else {
        nextStats = {
          ...nextStats,
          ...getLocalStats(),
        };
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
  }, [bookings, users, exps, reviews, apps, searchLogs, analyticsEvents, inquiries, inquiryMessages, dateRange]);

  const buildLocalStats = () => {
    try {
      let gmv = 0, netRevenue = 0, cancelledCount = 0, completedCount = 0;
      let userCancel = 0, hostCancel = 0;
      const userBookingCounts: Record<string, number> = {};
      const expStats: Record<string, any> = {};
      const hostStats: Record<string, any> = {};
      const priceDist = { low: 0, mid: 0, high: 0 };

      const nationalityCount: Record<string, number> = {};
      const ageCount: Record<string, number> = { '10s': 0, '20s': 0, '30s': 0, '40s+': 0 };
      const genderCount: Record<string, number> = { '남성': 0, '여성': 0, '기타': 0 }; // 🟢 추가
      const timeSeriesMap: Record<string, number> = {};

      const searchKeywordCount: Record<string, number> = {}; // 🟢 추가

      bookings?.forEach((b: any) => {
        if (!b.created_at || !isWithinDateRange(b.created_at)) return;
        // 호스트 통계 집계 (체험 ID -> 호스트 ID 매핑)
        const exp = exps?.find(e => e.id === b.experience_id);
        if (exp?.host_id) {
          if (!hostStats[exp.host_id]) hostStats[exp.host_id] = { bookings: 0, ratingSum: 0, reviewCount: 0, cancelCount: 0 };
          hostStats[exp.host_id].bookings += 1;
        }

        // 완료된 건 (매출 발생)
        if (isConfirmedBookingStatus(b.status || '')) {
          completedCount++;
          const amount = Number(b.amount || 0);
          gmv += amount;

          const revenue = getBookingPlatformRevenue(b);
          netRevenue += revenue;

          // 가격대 분포
          if (amount < 30000) priceDist.low++;
          else if (amount < 100000) priceDist.mid++;
          else priceDist.high++;

          // 시계열 데이터 집계 (날짜별 매출액)
          const dateStr = format(new Date(b.created_at), 'MM.dd');
          timeSeriesMap[dateStr] = (timeSeriesMap[dateStr] || 0) + amount;

          // 유저 재구매율 분석
          if (b.user_id) userBookingCounts[b.user_id] = (userBookingCounts[b.user_id] || 0) + 1;

          // 인기 체험 집계
          if (!expStats[b.experience_id]) expStats[b.experience_id] = { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
          expStats[b.experience_id].count++;
          expStats[b.experience_id].revenue += amount;
        }

        // 취소된 건 (사유 분석)
        if (isCancelledBookingStatus(b.status || '')) {
          cancelledCount++;
          if ((b.status || '').toLowerCase() === 'cancelled') userCancel++; else hostCancel++;

          // 호스트 취소율 반영
          if (exp?.host_id && hostStats[exp.host_id]) {
            hostStats[exp.host_id].cancelCount++;
          }
        }
      });

      // 리뷰 데이터 통합 (기간 내 리뷰만)
      reviews?.forEach((r: any) => {
        if (!r.created_at || !isWithinDateRange(r.created_at)) return;
        // 체험별 평점
        if (expStats[r.experience_id]) {
          expStats[r.experience_id].ratingSum += r.rating;
          expStats[r.experience_id].reviewCount++;
        }
        // 호스트별 평점
        const exp = exps?.find(e => e.id === r.experience_id);
        if (exp?.host_id && hostStats[exp.host_id]) {
          hostStats[exp.host_id].ratingSum += r.rating;
          hostStats[exp.host_id].reviewCount++;
        }
      });

      // 인기 체험 정렬 (Top 5 & All)
      const allExps = exps?.map((e: any) => {
        const s = expStats[e.id] || { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
        return {
          ...e,
          bookingCount: s.count,
          totalRevenue: s.revenue,
          rating: s.reviewCount > 0 ? (s.ratingSum / s.reviewCount).toFixed(1) : 'New',
          reviewCount: s.reviewCount
        };
      })
        .filter((e: any) => e.bookingCount > 0)
        .sort((a: any, b: any) => b.bookingCount - a.bookingCount) || [];
      const topExps = allExps.slice(0, 5);

      // 🟢 복구: 슈퍼 호스트 후보 선정
      // 조건: 예약 3건 이상, 평점 4.0 이상, 취소 0건
      const superHosts: any[] = [];
      const riskHosts: any[] = [];

      Object.entries(hostStats).forEach(([id, s]: any) => {
        const hostInfo = users?.find(u => u.id === id);
        const ratingNum = s.reviewCount > 0 ? (s.ratingSum / s.reviewCount) : 0;
        const hostObj = {
          id,
          name: hostInfo?.name || 'Unknown Host',
          email: hostInfo?.email,
          bookings: s.bookings,
          cancelCount: s.cancelCount,
          rating: ratingNum > 0 ? ratingNum.toFixed(1) : 'New'
        };

        if (hostObj.bookings >= 3 && ratingNum >= 4.0 && hostObj.cancelCount === 0) {
          superHosts.push(hostObj);
        }
        // 주의 필요 조건: 취소 2건 이상 이거나, 리뷰가 있는데 평점 3.5 미만일 때.
        if (hostObj.cancelCount >= 2 || (ratingNum > 0 && ratingNum < 3.5)) {
          riskHosts.push(hostObj);
        }
      });

      const topSuperHosts = superHosts.slice(0, 5);
      const topRiskHosts = riskHosts.slice(0, 5);

      // 필터된 기간 내 가입한 신규 유저
      const newUsersList = users?.filter(u => u.created_at && isWithinDateRange(u.created_at)) || [];
      const newUsersCount = newUsersList.length;
      const returnUsers = Object.values(userBookingCounts).filter(c => c > 1).length;

      // 체험 상세 등급
      const expsBreakdown = { new: 0, active: 0, pending: 0, rejected: 0 };
      exps?.forEach((e: any) => {
        if (e.created_at && isWithinDateRange(e.created_at)) expsBreakdown.new++;
        if (e.status === 'active') expsBreakdown.active++;
        else if (e.status === 'pending') expsBreakdown.pending++;
        else if (e.status === 'rejected') expsBreakdown.rejected++;
      });

      // 리텐션(재구매율) 상세 집계
      const retentionBreakdown = { once: 0, twice: 0, threeOrMore: 0 };
      Object.values(userBookingCounts).forEach(c => {
        if (c === 1) retentionBreakdown.once++;
        else if (c === 2) retentionBreakdown.twice++;
        else if (c >= 3) retentionBreakdown.threeOrMore++;
      });

      // 인구통계학 데이터 정제
      const totalUniqueGuests = Object.keys(userBookingCounts).length;
      const allNationalitiesSorted = Object.entries(nationalityCount)
        .map(([name, count]) => ({ name, count, percent: totalUniqueGuests ? (count / totalUniqueGuests) * 100 : 0 }))
        .sort((a, b) => b.count - a.count);
      const topNationalities = allNationalitiesSorted.slice(0, 4); // 상위 4개국

      const agesArr = Object.entries(ageCount)
        .map(([name, count]) => ({ name: name.replace('s', '대'), count, percent: totalUniqueGuests ? (count / totalUniqueGuests) * 100 : 0 }));

      // 🟢 성별 통계 계산
      const totalGenders = Object.values(genderCount).reduce((a, b) => a + b, 0);
      const genderArr = Object.entries(genderCount)
        .filter(v => v[1] > 0)
        .map(([name, count]) => ({ name, count, percent: totalGenders ? (count / totalGenders) * 100 : 0 }));

      // 🟢 검색 로그 취합 (Top 10)
      let totalSearches = 0;
      searchLogs?.forEach((log: any) => {
        if (!isWithinDateRange(log.created_at)) return;
        totalSearches++;
        searchKeywordCount[log.keyword] = (searchKeywordCount[log.keyword] || 0) + 1;
      });
      const allKeywordsSorted = Object.entries(searchKeywordCount)
        .map(([keyword, count]) => ({ keyword, count, percent: totalSearches ? (count / totalSearches) * 100 : 0 }))
        .sort((a, b) => b.count - a.count);
      const topKeywords = allKeywordsSorted.slice(0, 10);

      // 🟢 실제 퍼널 데이터 취합
      let realViews = 0, realClicks = 0, realInit = 0;
      analyticsEvents?.forEach((ev: any) => {
        if (!isWithinDateRange(ev.created_at)) return;
        if (ev.event_type === 'view') realViews++;
        else if (ev.event_type === 'click') realClicks++;
        else if (ev.event_type === 'payment_init') realInit++;
      });

      // 시계열 데이터 정제 (최근 7일치로 압축 또는 있는 날짜만. 여기선 단순 정렬 후 상위값 기준 퍼센트 계산)
      const sortedKeys = Object.keys(timeSeriesMap).sort();
      const recentDates = sortedKeys.slice(-7); // 차트 UI 제약상 최대 7개 봉투만 표시
      const maxSeriesAmount = Math.max(...recentDates.map(k => timeSeriesMap[k]), 1); // 0 방지
      const timeSeries = recentDates.map(k => ({
        dateStr: k,
        amount: timeSeriesMap[k],
        height: (timeSeriesMap[k] / maxSeriesAmount) * 100
      }));

      // 가장 매출이 높았던 날
      let topRevDate = { dateStr: '-', amount: 0 };
      Object.entries(timeSeriesMap).forEach(([d, a]) => {
        if (a > topRevDate.amount) topRevDate = { dateStr: d, amount: a };
      });

      // 🟢 호스트 생태계 (Host Ecosystem) 데이터 정제
      const hostSources: Record<string, number> = {};
      const hostLangs: Record<string, number> = {};
      const hostNats: Record<string, number> = {};
      let applied = 0;
      let approved = 0;
      const activeHosts = new Set<string>();
      const bookedHosts = new Set<string>();

      apps?.forEach((a: any) => {
        if (!a.created_at || !isWithinDateRange(a.created_at)) return;
        applied++;
        if (a.status === 'approved') approved++;

        const src = a.source || '기타/미입력';
        hostSources[src] = (hostSources[src] || 0) + 1;

        const nat = a.host_nationality || '미입력';
        hostNats[nat] = (hostNats[nat] || 0) + 1;

        const langs = Array.isArray(a.languages) ? a.languages : (a.languages ? [a.languages] : []);
        langs.forEach((l: string) => {
          hostLangs[l] = (hostLangs[l] || 0) + 1;
        });
      });

      // 🟢 호스트 응답률 및 응답 시간 계산
      const hostCommStats: Record<string, { total: number, answered: number, timeMs: number }> = {};
      let totalHostInquiries = 0;
      let answeredHostInquiries = 0;
      let totalResponseTimeMs = 0;

      const messagesByInquiry: Record<string, any[]> = {};
      inquiryMessages?.forEach(m => {
        if (!messagesByInquiry[m.inquiry_id]) messagesByInquiry[m.inquiry_id] = [];
        messagesByInquiry[m.inquiry_id].push(m);
      });
      Object.keys(messagesByInquiry).forEach(id => {
        messagesByInquiry[id].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });

      inquiries?.forEach(inq => {
        if (!inq.host_id || !isWithinDateRange(inq.created_at)) return;
        totalHostInquiries++;
        if (!hostCommStats[inq.host_id]) hostCommStats[inq.host_id] = { total: 0, answered: 0, timeMs: 0 };
        hostCommStats[inq.host_id].total++;

        const msgs = messagesByInquiry[inq.id] || [];

        // 첫 호스트 응답 탐색
        const firstHostMsg = msgs.find(m => m.sender_id === inq.host_id);
        if (firstHostMsg) {
          answeredHostInquiries++;
          hostCommStats[inq.host_id].answered++;

          const guestMsg = msgs.find(m => m.sender_id !== inq.host_id);
          const startTime = guestMsg ? new Date(guestMsg.created_at).getTime() : new Date(inq.created_at).getTime();
          const responseTimeMs = new Date(firstHostMsg.created_at).getTime() - startTime;
          if (responseTimeMs > 0) {
            totalResponseTimeMs += responseTimeMs;
            hostCommStats[inq.host_id].timeMs += responseTimeMs;
          }
        }
      });

      const avgRespMins = answeredHostInquiries > 0 ? (totalResponseTimeMs / answeredHostInquiries) / (1000 * 60) : 0;
      const respRatePct = totalHostInquiries > 0 ? (answeredHostInquiries / totalHostInquiries) * 100 : 0;

      // 호스트 개별 순위 계산
      const hostRespArr = Object.entries(hostCommStats).map(([id, s]) => {
        const hostInfo = users?.find(u => u.id === id);
        const rate = s.total > 0 ? (s.answered / s.total) * 100 : 0;
        const timeMins = s.answered > 0 ? (s.timeMs / s.answered) / (1000 * 60) : 0;
        return {
          id,
          name: hostInfo?.name || hostInfo?.full_name || 'Unknown',
          rate,
          timeMins: Math.round(timeMins),
          total: s.total
        };
      }).filter(h => h.total >= 1);

      const topRespHosts = [...hostRespArr].sort((a, b) => b.rate - a.rate || a.timeMins - b.timeMins).slice(0, 10);
      const bottomRespHosts = [...hostRespArr].sort((a, b) => a.rate - b.rate || b.timeMins - a.timeMins).slice(0, 10);

      // 등록된 Active 체험을 보유한 호스트 수 계산
      exps?.forEach((e: any) => {
        if (e.status === 'active' && e.host_id) activeHosts.add(e.host_id);
      });
      // 기간 내 예약을 1건이라도 받은 호스트
      bookings?.forEach((b: any) => {
        if (b.created_at && isWithinDateRange(b.created_at) && isConfirmedBookingStatus(b.status || '')) {
          const exp = exps?.find(e => e.id === b.experience_id);
          if (exp?.host_id) bookedHosts.add(exp.host_id);
        }
      });

      const allHostSources = Object.entries(hostSources).map(([name, count]) => ({ name, count, percent: applied ? (count / applied) * 100 : 0 })).sort((a, b) => b.count - a.count);
      const allHostNats = Object.entries(hostNats).map(([name, count]) => ({ name, count, percent: applied ? (count / applied) * 100 : 0 })).sort((a, b) => b.count - a.count);

      const topSources = allHostSources.slice(0, 4);
      const topNats = allHostNats.slice(0, 4);

      const totalLangs = Object.values(hostLangs).reduce((acc, c) => acc + c, 0);
      const allHostLangs = Object.entries(hostLangs).map(([name, count]) => ({ name, count, percent: totalLangs ? (count / totalLangs) * 100 : 0 })).sort((a, b) => b.count - a.count);
      const topLangs = allHostLangs.slice(0, 4);

      return {
        totalUsers: newUsersCount,
        activeExpsCount: exps?.filter((e: any) => e.status === 'active').length || 0,
        gmv,
        netRevenue,
        hostPayout: gmv - netRevenue,
        conversionRate: newUsersCount > 0 ? ((completedCount / newUsersCount) * 100).toFixed(1) : '0.0',
        retentionRate: Object.keys(userBookingCounts).length ? ((returnUsers / Object.keys(userBookingCounts).length) * 100).toFixed(1) : '0.0',
        aov: completedCount > 0 ? Math.floor(gmv / completedCount) : 0,
        cancellationRate: (cancelledCount + completedCount) > 0 ? Math.floor((cancelledCount / (cancelledCount + completedCount)) * 100) : 0,
        topExperiences: topExps || [],
        superHostCandidates: topSuperHosts, // 데이터 연결
        funnel: {
          views: realViews, // 🟢 리얼 퍼널 적용
          clicks: realClicks,
          paymentInit: realInit,
          completed: completedCount
        },
        cancelBreakdown: { user: userCancel, host: hostCancel }, // 데이터 연결
        priceDistribution: priceDist,
        demographics: { nationalities: topNationalities, ages: agesArr, genders: genderArr, allNationalities: allNationalitiesSorted }, // 🟢 추가
        searchTrends: topKeywords, // 🟢 추가
        allSearchTrends: allKeywordsSorted,
        // (add all experiences to root)
        allExperiences: allExps,
        timeSeries,
        riskHosts: topRiskHosts,
        newUsersList: newUsersList.slice(0, 5), // 상위 5명만 모달에 표시
        topRevenueDate: topRevDate,
        hostEcosystem: {
          sources: topSources,
          languages: topLangs,
          nationalities: topNats,
          allSources: allHostSources,
          allNationalities: allHostNats,
          allLanguages: allHostLangs,
          funnel: { applied, approved, active: activeHosts.size, booked: bookedHosts.size }
        },
        avgResponseTime: avgRespMins > 0 ? Math.round(avgRespMins) : 0, // 🟢 리얼 응답 시간(분)
        responseRate: respRatePct > 0 ? Number(respRatePct.toFixed(1)) : 0, // 🟢 리얼 응답률(%)
        topRespHosts,
        bottomRespHosts,
        expsBreakdown,
        retentionBreakdown
      };
    } catch (err) {
      console.error(err);
      return {
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
    }
  };

  // 🟢 복구: 인기 검색어 클릭 핸들러
  const handleKeywordClick = (keyword: string) => {
    showToast(`'${keyword}' 검색 결과 트렌드 분석을 시작합니다. (Demo)`, 'success');
  };

  if (loading) return <div className="p-8"><Skeleton className="w-full h-96 rounded-xl" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* 헤더 & 필터 구간 추가 */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 md:mb-6 gap-3 md:gap-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-rose-500 w-5 h-5 md:w-6 md:h-6" />
          <h2 className="text-xl md:text-2xl font-black text-slate-900">데이터 심층 분석</h2>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 relative">
          <div className="bg-slate-100 p-1 rounded-lg flex text-[10px] md:text-xs font-bold overflow-x-auto scrollbar-hide shrink-0">
            {['1D', '7D', '30D', '3M', '1Y', 'ALL'].map(f => (
              <button
                key={f} onClick={() => handlePresetClick(f)}
                className={`flex-1 md:flex-none px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-all whitespace-nowrap ${activePreset === f ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-auto" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center justify-center gap-2 w-full px-3 md:px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs md:text-sm font-medium hover:bg-slate-50 transition-colors shrink-0"
            >
              <CalendarIcon size={14} className="text-slate-400 md:w-4 md:h-4" />
              <span className="text-slate-700 md:min-w-[170px] text-center">
                {dateRange[0].startDate && dateRange[0].endDate
                  ? `${format(dateRange[0].startDate, 'yyyy.MM.dd')} ~ ${format(dateRange[0].endDate, 'yyyy.MM.dd')}`
                  : '기간 선택'}
              </span>
              <ChevronDown size={14} className="text-slate-400 ml-1 md:w-4 md:h-4" />
            </button>

            {showDatePicker && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <span className="text-xs font-bold text-slate-500 uppercase px-2">Custom Range</span>
                  <button onClick={() => setShowDatePicker(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2 font-medium">Close</button>
                </div>
                <DateRange
                  editableDateInputs={true}
                  onChange={(item: any) => { setDateRange([item.selection]); setActivePreset('CUSTOM'); }}
                  moveRangeOnFirstSelection={false}
                  ranges={dateRange}
                  months={1}
                  direction="horizontal"
                  className="!border-0 text-xs md:text-sm"
                  rangeColors={['#0f172a']}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🟢 수정: 메인 탭 전환 (Business / Host / Reviews / Logs) */}
      <div className="flex flex-nowrap md:flex-wrap bg-slate-100 p-1 rounded-xl w-full md:w-fit mb-6 md:mb-8 overflow-x-auto scrollbar-hide gap-1">
        {[
          { id: 'business', label: 'Business & Guest' },
          { id: 'host', label: 'Host Ecosystem' },
          { id: 'reviews', label: 'Review Quality' },
          { id: 'logs', label: '운영 감사 로그' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveMainTab(tab.id as any)}
            className={`flex-none px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeMainTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
          >
            <span>{tab.label}</span>
            {tab.id === 'business' && summarySource.business !== 'server' && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                임시
              </span>
            )}
            {tab.id === 'host' && summarySource.host !== 'server' && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                임시
              </span>
            )}
          </button>
        ))}
      </div>

      {activeMainTab === 'business' && (
        <>
          {summarySource.business === 'cached' && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <div className="font-semibold">최근 정상 서버 집계값을 유지 중입니다.</div>
                <div className="text-xs text-amber-700">현재 구간의 최신 서버 응답을 다시 받지 못해, 마지막 정상 집계값을 임시로 표시하고 있습니다.</div>
              </div>
            </div>
          )}
          {summarySource.business === 'fallback' && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <div className="font-semibold">일부 수치는 임시 집계값입니다.</div>
                <div className="text-xs text-amber-700">서버 집계를 불러오지 못해 현재 화면 계산값을 대신 표시 중입니다.</div>
              </div>
            </div>
          )}
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <CheckCircle size={16} className="mt-0.5 shrink-0 text-slate-500" />
            <div>
              <div className="font-semibold">상단 지표와 결제 고객 인구통계는 플랫폼 전체 기준입니다.</div>
              <div className="text-xs text-slate-500">체험 예약과 서비스 결제를 합친 전체 결제 데이터를 기준으로 집계합니다.</div>
            </div>
          </div>
          {/* 1. 핵심 지표 (KPI) - 원본 순서 및 기능 100% 복구 */}
          <section>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {/* 1. 신규 유저 (원복) */}
              <SimpleKpi label="신규 가입 유저" value={stats.totalUsers} unit="명" sub="(기간 내)" onClick={() => setSelectedMetric('users')} />

              {/* 2. 활성 체험 (원복) */}
              <SimpleKpi label="활성 체험" value={stats.activeExpsCount} unit="개" onClick={() => setSelectedMetric('exps')} />

              {/* 3. 총 거래액 (원복) */}
              <SimpleKpi label="총 거래액 (GMV)" value={`₩${(stats.gmv / 10000).toFixed(0)}`} unit="만" sub="체험 + 서비스 결제" onClick={() => setSelectedMetric('gmv')} />

              {/* 4. 플랫폼 순수익 (원복) */}
              <SimpleKpi label="플랫폼 순수익" value={`₩${stats.netRevenue.toLocaleString()}`} unit="" className="text-blue-600" sub="플랫폼 전체 기준" onClick={() => setSelectedMetric('revenue')} />

              {/* 5. 객단가 (AOV) */}
              <SimpleKpi label="객단가 (AOV)" value={`₩${stats.aov.toLocaleString()}`} sub="전체 결제 건 기준" onClick={() => setSelectedMetric('aov')} />

              {/* 6. 취소율 */}
              <SimpleKpi label="취소율" value={`${stats.cancellationRate}%`} sub="체험 예약 기준" onClick={() => setSelectedMetric('cancel')} />

              {/* 7. 가입 대비 결제건 비율 */}
              <SimpleKpi label="가입 대비 결제건 비율" value={`${stats.conversionRate}%`} sub="신규 가입자 대비" onClick={() => setSelectedMetric('conversion')} />

              {/* 8. 반복 결제 고객 비율 */}
              <SimpleKpi label="반복 결제 고객 비율" value={`${stats.retentionRate}%`} sub="체험 + 서비스 결제 고객" onClick={() => setSelectedMetric('retention')} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <div className="font-semibold text-slate-800">가입 대비 결제건 비율</div>
                <div className="mt-1">선택 기간 내 신규 가입자 수 대비 결제 완료 건수 비율입니다.</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <div className="font-semibold text-slate-800">반복 결제 고객 비율</div>
                <div className="mt-1">체험과 서비스를 합친 전체 결제 고객 중 2회 이상 결제한 고객 비율입니다.</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <div className="font-semibold text-slate-800">객단가 (AOV)</div>
                <div className="mt-1">선택 기간 총 거래액을 전체 결제 건수로 나눈 평균 결제 금액입니다.</div>
              </div>
            </div>
          </section>

          <div className="w-full h-px bg-slate-100 my-6 md:my-8"></div>

          {/* 🟢 신규: Demographics (인구통계학) - PURE TAILWIND */}
          <section>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                🌍 결제 고객 인구통계 <span className="text-[10px] md:text-xs font-normal text-slate-400">체험 + 서비스 결제 고객 기준</span>
              </h2>
              <div onClick={() => setSelectedMetric('demographics')} className="text-[10px] md:text-xs font-bold text-blue-500 bg-blue-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                상세보기
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {/* 국적 차트 */}
              <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span>🌍 게스트 국적 비중</span> <span className="text-[10px] md:text-xs font-normal text-slate-400 sm:ml-auto">체험 + 서비스 결제 고객 기준</span>
                </h3>
                <div className="space-y-4">
                  {stats.demographics.nationalities.length > 0 ? stats.demographics.nationalities.map((nat) => (
                    <div key={nat.name} className="flex items-center gap-4">
                      <div className="w-8 text-sm font-bold text-slate-600">{nat.name}</div>
                      <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden flex">
                        <div className="h-full bg-blue-500 rounded-lg transition-all duration-1000" style={{ width: `${nat.percent}%` }}></div>
                      </div>
                      <div className="w-16 text-right text-sm font-mono text-slate-500">{nat.percent.toFixed(1)}%</div>
                    </div>
                  )) : (
                    <div className="py-8 text-center text-slate-400 text-sm">데이터가 부족합니다.</div>
                  )}
                </div>
              </div>

              {/* 연령대 차트 */}
              <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span>👤 게스트 주요 연령대</span> <span className="text-[10px] md:text-xs font-normal text-slate-400 sm:ml-auto">체험 + 서비스 결제 고객 기준</span>
                </h3>
                <div className="flex items-end justify-around h-32 md:h-40 mt-4 pb-2 border-b border-slate-100 relative">
                  {/* 눈금선 */}
                  <div className="absolute top-0 w-full border-t border-slate-50 border-dashed"></div>
                  <div className="absolute top-1/2 w-full border-t border-slate-50 border-dashed"></div>

                  {stats.demographics.ages.map(age => (
                    <div key={age.name} className="flex flex-col items-center gap-1 md:gap-2 group w-1/5">
                      <span className="text-[9px] md:text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {age.percent.toFixed(1)}%
                      </span>
                      {/* Column Bar */}
                      <div className="w-full bg-slate-100 rounded-t-sm md:rounded-t-lg relative flex items-end justify-center h-20 md:h-28">
                        <div
                          className="w-full bg-rose-400 rounded-t-sm md:rounded-t-lg transition-all duration-1000 hover:bg-rose-500 shadow-inner"
                          style={{ height: `${age.percent}%`, minHeight: age.percent > 0 ? '4px' : '0' }}
                        ></div>
                      </div>
                      <span className="text-[10px] md:text-xs font-bold text-slate-600 truncate w-full text-center">{age.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 🟢 성별 바 차트 (새로 추가) */}
              <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span>🚻 게스트 성별 비율</span> <span className="text-[10px] md:text-xs font-normal text-slate-400 sm:ml-auto">전체 결제 기준</span>
                </h3>
                <div className="flex-1 flex flex-col justify-center space-y-5">
                  {stats.demographics.genders.length > 0 ? stats.demographics.genders.map((gen) => (
                    <div key={gen.name} className="flex items-center gap-4">
                      <div className="w-10 text-sm font-bold text-slate-600">{gen.name}</div>
                      <div className="flex-1 h-8 bg-slate-100 rounded-full overflow-hidden flex relative shadow-inner">
                        <div
                          className={`h-full opacity-90 rounded-full transition-all duration-1000 ${gen.name === '남성' ? 'bg-blue-400' : gen.name === '여성' ? 'bg-rose-400' : 'bg-green-400'}`}
                          style={{ width: `${gen.percent}%` }}
                        ></div>
                        <span className="absolute inset-0 flex items-center justify-end pr-4 text-xs font-bold text-slate-700/80 drop-shadow-sm">
                          {gen.percent.toFixed(1)}% ({gen.count}명)
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center text-slate-400 text-sm">데이터가 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="pt-4 md:pt-6">
            <div className="flex flex-col gap-3 mb-3 md:mb-4">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="md:w-[18px] md:h-[18px] text-slate-700" />
                <h2 className="text-base md:text-lg font-bold">고객 구성 분석</h2>
                {customerCompositionSource === 'cached' && (
                  <span className="text-[10px] md:text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                    최근 집계 재사용
                  </span>
                )}
                {customerCompositionSource === 'unavailable' && (
                  <span className="text-[10px] md:text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                    일시 불가
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs md:text-sm text-slate-600">
                <div className="font-semibold text-slate-800">체험 + 서비스 결제 고객 기준으로 고객 구성을 봅니다.</div>
                <div className="mt-1">누가 결제하고, 누가 다시 결제하는지 고객 구성을 먼저 보고 유입 분석은 source 정합성을 확인한 뒤 추가합니다.</div>
                <div className="mt-1">언어는 복수 응답 기준이라 한 고객이 여러 언어에 함께 집계될 수 있습니다.</div>
                {customerComposition && !customerComposition.sourceAvailable && (
                  <div className="mt-1 text-[11px] md:text-xs text-slate-500">유입 분석은 고객 source 정합성 확인 후 추가 예정입니다.</div>
                )}
              </div>
            </div>

            {customerComposition ? (
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm md:text-base font-bold text-slate-800">국적별 결제 고객</h3>
                    <span className="text-[10px] md:text-xs text-slate-400">총 {customerComposition.totalPayingCustomers}명</span>
                  </div>
                  <div className="space-y-2">
                    {customerComposition.nationalityMix.length > 0 ? customerComposition.nationalityMix.map((item) => (
                      <div key={`customer-composition-nationality-${item.name}`} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                        <span className="text-xs font-mono text-slate-500">{item.percent.toFixed(1)}%</span>
                      </div>
                    )) : (
                      <div className="py-6 text-center text-sm text-slate-400">국적 데이터가 부족합니다.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm md:text-base font-bold text-slate-800">주요 언어권</h3>
                    <span className="text-[10px] md:text-xs text-slate-400">복수 선택 허용</span>
                  </div>
                  <div className="space-y-2">
                    {customerComposition.languageMix.length > 0 ? customerComposition.languageMix.map((item) => (
                      <div key={`customer-composition-language-${item.name}`} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                        <span className="text-xs font-mono text-slate-500">{item.customers}명</span>
                      </div>
                    )) : (
                      <div className="py-6 text-center text-sm text-slate-400">언어 데이터가 부족합니다.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm md:text-base font-bold text-slate-800">신규 vs 반복 고객</h3>
                    <span className="text-[10px] md:text-xs text-slate-400">전체 결제 고객</span>
                  </div>
                  <div className="space-y-2">
                    {customerComposition.loyaltyMix.length > 0 ? customerComposition.loyaltyMix.map((item) => (
                      <div key={`customer-composition-loyalty-${item.name}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                          <span className="text-xs font-mono text-slate-500">{item.percent.toFixed(1)}%</span>
                        </div>
                        <div className="mt-1 text-[11px] md:text-xs text-slate-500">{item.customers}명</div>
                      </div>
                    )) : (
                      <div className="py-6 text-center text-sm text-slate-400">반복 결제 데이터가 부족합니다.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm md:text-base font-bold text-slate-800">체험/서비스 선호</h3>
                    <span className="text-[10px] md:text-xs text-slate-400">결제 고객 분포</span>
                  </div>
                  <div className="space-y-2">
                    {customerComposition.purchaseMix.length > 0 ? customerComposition.purchaseMix.map((item) => (
                      <div key={`customer-composition-purchase-${item.name}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                          <span className="text-xs font-mono text-slate-500">{item.percent.toFixed(1)}%</span>
                        </div>
                        <div className="mt-1 text-[11px] md:text-xs text-slate-500">{item.customers}명</div>
                      </div>
                    )) : (
                      <div className="py-6 text-center text-sm text-slate-400">구성 데이터가 부족합니다.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
                고객 구성 분석 데이터를 불러오지 못했습니다.
              </div>
            )}
          </section>

          <div className="mt-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" />
            <div>
              <div className="font-semibold">아래 구간은 체험 예약 전용 분석입니다.</div>
              <div className="text-xs text-rose-700">취소율, 체험 검색 트렌드, 매출 견인 Top 체험, 예약 퍼널은 서비스 의뢰가 아닌 체험 예약 흐름만 기준으로 표시합니다.</div>
            </div>
          </div>

          {/* 2. 인기 검색어 (트렌드) */}
          <section className="pt-4 md:pt-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
                <Search size={16} className="md:w-[18px] md:h-[18px]" /> 체험 검색 인기 트렌드
              </h2>
              <div onClick={() => setSelectedMetric('searchTrends')} className="text-[10px] md:text-xs font-bold text-blue-500 bg-blue-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                상세보기
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3">
              {stats.searchTrends.length > 0 ? stats.searchTrends.map((trend, i) => (
                <button
                  key={trend.keyword}
                  onClick={() => setSelectedMetric('searchTrends')}
                  className="px-3 md:px-4 py-1.5 md:py-2 bg-white border border-gray-200 rounded-full text-xs md:text-sm font-medium text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all duration-200 shadow-sm active:scale-95 flex items-center gap-1 md:gap-2"
                >
                  <span className="text-rose-500 font-bold">{i + 1}.</span> {trend.keyword}
                  <span className="text-[9px] md:text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">{trend.count}건</span>
                </button>
              )) : (
                <span className="text-sm text-slate-400">데이터를 수집 중입니다.</span>
              )}
            </div>
          </section>

          <section className="pt-4 md:pt-6">
            <div className="flex flex-col gap-3 mb-3 md:mb-4">
              <div className="flex items-center gap-2">
                <Search size={16} className="md:w-[18px] md:h-[18px] text-slate-700" />
                <h2 className="text-base md:text-lg font-bold">고객 검색 수요 분석</h2>
                {searchIntentSource === 'cached' && (
                  <span className="text-[10px] md:text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                    최근 집계 재사용
                  </span>
                )}
                {searchIntentSource === 'unavailable' && (
                  <span className="text-[10px] md:text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                    일시 불가
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs md:text-sm text-slate-600">
                <div className="font-semibold text-slate-800">고객이 찾는 수요와 현재 공급 부족 신호를 함께 봅니다.</div>
                <div className="mt-1">검색 로그 기준이며, 공급 부족은 현재 활성 체험의 제목/도시/설명/카테고리/태그 기준 참고용입니다.</div>
                {searchIntent && !searchIntent.conversionAvailable && (
                  <div className="mt-1 text-[11px] md:text-xs text-slate-500">검색 후 클릭/결제 전환 분석은 검색 로그와 이벤트 연결 키를 정리한 뒤 추가할 예정입니다.</div>
                )}
              </div>
            </div>

            {searchIntent ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm md:text-base font-bold text-slate-800">많이 찾는 키워드</h3>
                    <span className="text-[10px] md:text-xs text-slate-400">총 {searchIntent.totalSearches}회</span>
                  </div>
                  <div className="space-y-2">
                    {searchIntent.topKeywords.length > 0 ? searchIntent.topKeywords.slice(0, 5).map((item, index) => (
                      <div key={`search-demand-top-${item.keyword}`} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-black text-rose-500">{index + 1}</span>
                          <span className="truncate text-sm font-semibold text-slate-800">{item.keyword}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">{item.searches}회</span>
                      </div>
                    )) : (
                      <div className="py-6 text-center text-sm text-slate-400">검색 데이터가 부족합니다.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm md:text-base font-bold text-slate-800">급상승 키워드</h3>
                    <span className="text-[10px] md:text-xs text-slate-400">최근 {searchIntent.comparisonWindowDays}일 비교</span>
                  </div>
                  <div className="space-y-2">
                    {searchIntent.risingKeywords.length > 0 ? searchIntent.risingKeywords.map((item) => (
                      <div key={`search-demand-rising-${item.keyword}`} className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-slate-800">{item.keyword}</span>
                          <span className="text-xs font-black text-emerald-700">+{item.surge}</span>
                        </div>
                        <div className="mt-1 text-[11px] md:text-xs text-slate-500">
                          최근 {item.recentSearches}회 · 이전 {item.previousSearches}회
                        </div>
                      </div>
                    )) : (
                      <div className="py-6 text-center text-sm text-slate-400">최근 급상승 키워드가 없습니다.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm md:text-base font-bold text-slate-800">공급 부족 키워드</h3>
                    <span className="text-[10px] md:text-xs text-slate-400">현재 활성 체험 기준</span>
                  </div>
                  <div className="space-y-2">
                    {searchIntent.lowSupplyKeywords.length > 0 ? searchIntent.lowSupplyKeywords.map((item) => (
                      <div key={`search-demand-low-supply-${item.keyword}`} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-slate-800">{item.keyword}</span>
                          <span className="text-xs font-mono text-amber-700">{item.searches}회</span>
                        </div>
                        <div className="mt-1 text-[11px] md:text-xs text-slate-500">
                          연결 가능한 활성 체험 {item.matchedActiveExperiences}개
                        </div>
                      </div>
                    )) : (
                      <div className="py-6 text-center text-sm text-slate-400">공급 부족 신호가 강한 키워드가 없습니다.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
                검색 수요 분석 데이터를 불러오지 못했습니다.
              </div>
            )}
          </section>

          {/* 시계열 및 퍼널 차트 섹션 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 pt-4 md:pt-6">
            {/* 🟢 신규: 시계열 차트 (Time-Series) */}
            <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between mb-6 md:mb-8">
                <h3 className="text-base md:text-lg font-bold text-slate-800 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span>📈 구간별 매출 트렌드</span> <span className="text-[10px] md:text-xs font-normal text-slate-400">최근 발생일자 기준 (최대 7일)</span>
                </h3>
                <Activity size={16} className="text-blue-500 md:w-[18px] md:h-[18px] shrink-0" />
              </div>

              <div className="flex items-end justify-between h-36 md:h-48 w-full relative px-1 md:px-2">
                {/* 100% 가이드 라인 */}
                <div className="absolute top-0 left-0 w-full border-t border-slate-100 border-dashed"></div>
                <div className="absolute top-1/2 left-0 w-full border-t border-slate-100 border-dashed"></div>
                <div className="absolute bottom-0 left-0 w-full border-t border-slate-100"></div>

                {stats.timeSeries.length > 0 ? stats.timeSeries.map((ts, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1 md:gap-2 group w-8 md:w-12 z-10">
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-500 bg-white px-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 md:-top-6 whitespace-nowrap">
                      ₩{(ts.amount / 10000).toFixed(0)}만
                    </span>
                    <div className="w-full h-28 md:h-40 flex items-end justify-center pb-0">
                      <div
                        className="w-6 md:w-10 bg-slate-800 rounded-t-sm md:rounded-t-md transition-all duration-1000 hover:bg-blue-600 shadow-sm"
                        style={{ height: `${Math.max(ts.height, 5)}%` }}
                      ></div>
                    </div>
                    <span className="text-[9px] md:text-xs font-medium text-slate-500 mt-1 md:mt-2">{ts.dateStr}</span>
                  </div>
                )) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs md:text-sm">
                    선택된 구간에 매출 데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* 퍼널 차트 */}
            <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h3 className="text-base md:text-lg font-bold text-slate-800 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span>🎯 예약 퍼널 분석</span> <span className="text-[10px] md:text-xs font-normal text-slate-400">유입 대비 결제 전환률</span>
                </h3>
                <Activity size={16} className="text-slate-400 md:w-[18px] md:h-[18px]" />
              </div>
              <div className="space-y-4 md:space-y-5 mt-2 md:mt-4">
                <FunnelBar label="상품 노출" value={stats.funnel.views} max={stats.funnel.views} color="bg-slate-200" />
                <FunnelBar label="예약 클릭" value={stats.funnel.clicks} max={stats.funnel.views} color="bg-slate-300" />
                <FunnelBar label="결제 시도" value={stats.funnel.paymentInit} max={stats.funnel.views} color="bg-slate-400" />
                <FunnelBar label="결제 완료" value={stats.funnel.completed} max={stats.funnel.views} isFinal color="bg-rose-500" />
              </div>
            </div>
          </div>


          {/* 3. 매출 견인 Top 5 인기 체험 */}
          <section className="pt-4 md:pt-6">
            <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h3 className="text-base md:text-lg font-bold text-slate-800 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span>🏆 매출 견인 Top 5 인기 체험</span> <span className="text-[10px] md:text-xs font-normal text-slate-400">체험 예약 결제 완료 건수 기준</span>
                </h3>
                <div onClick={() => setSelectedMetric('topExps')} className="text-[10px] md:text-xs font-bold text-blue-500 bg-blue-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors shrink-0">
                  상세보기
                </div>
              </div>
              <div className="space-y-3 md:space-y-4">
                {stats.topExperiences.length > 0 ? stats.topExperiences.map((exp: any, idx: number) => (
                  <div key={exp.id} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 border border-slate-200 text-sm md:text-base shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs md:text-sm font-bold text-slate-900 truncate">{exp.title}</div>
                      <div className="text-[10px] md:text-xs font-medium text-slate-500 flex gap-2">
                        <span>예약 {exp.bookingCount}건</span>
                        <span>매출 ₩{(exp.totalRevenue / 10000).toFixed(0)}만</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end shrink-0">
                      <div className="text-[9px] md:text-xs font-bold text-slate-700 bg-slate-100 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md md:rounded-lg whitespace-nowrap">
                        ★ {exp.rating} ({exp.reviewCount})
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-6 md:py-8 text-slate-400 text-xs md:text-sm">기간 내 체험 예약 데이터가 없습니다.</div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {activeMainTab === 'host' && (
        <div className="space-y-12 animate-in slide-in-from-bottom-[50px] duration-500">
          {summarySource.host === 'cached' && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <div className="font-semibold">최근 정상 호스트 집계값을 유지 중입니다.</div>
                <div className="text-xs text-amber-700">현재 구간의 최신 서버 응답을 다시 받지 못해, 마지막 정상 호스트 집계값을 임시로 표시하고 있습니다.</div>
              </div>
            </div>
          )}
          {summarySource.host === 'fallback' && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <div className="font-semibold">호스트 통계 일부가 임시 집계값입니다.</div>
                <div className="text-xs text-amber-700">호스트 서버 집계를 불러오지 못해 현재 화면 계산값을 대신 표시 중입니다.</div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-800">호스트 퍼널 / 유망주 / 집중 관리 기준</div>
              <div className="mt-1">퍼널은 지원부터 첫 결제 창출까지의 흐름이며, 유망주는 평점 4.0 이상·취소 0건, 집중 관리는 취소 누적 또는 저평점 호스트 기준입니다.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-800">응답시간 / 응답률 기준</div>
              <div className="mt-1">평균 응답 시간은 문의 접수 후 첫 답변까지 걸린 시간이며, 응답률은 전체 문의 중 답변이 남은 비율입니다.</div>
            </div>
          </div>
          {/* 1. 호스트 활성화 퍼널 (Health Funnel) */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                🎯 호스트 활성화 퍼널 <span className="text-xs font-normal text-slate-400">지원부터 첫 결제 창출까지</span>
              </h2>
              <Activity size={20} className="text-emerald-500" />
            </div>
            <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-emerald-50 rounded-full translate-x-16 md:translate-x-32 -translate-y-16 md:-translate-y-32 blur-2xl md:blur-3xl"></div>

              {[
                { label: "지원서 접수", val: stats.hostEcosystem.funnel.applied, color: "bg-slate-200 text-slate-600" },
                { label: "승인 완료", val: stats.hostEcosystem.funnel.approved, color: "bg-emerald-100 text-emerald-700" },
                { label: "상품 등록 (Active)", val: stats.hostEcosystem.funnel.active, color: "bg-emerald-300 text-emerald-900" },
                { label: "첫 예약 달성", val: stats.hostEcosystem.funnel.booked, color: "bg-emerald-500 text-white" }
              ].map((step, i, arr) => (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center w-full md:w-auto">
                    <div className={`w-full md:w-28 h-16 md:h-28 rounded-xl md:rounded-2xl flex md:flex-col items-center justify-between md:justify-center px-4 md:px-0 font-black text-xl md:text-2xl shadow-sm border border-white/50 ${step.color} relative z-10`}>
                      <span className="text-xs md:text-[10px] font-bold opacity-80 md:mt-1 order-1 md:order-2">{step.label}</span>
                      <span className="order-2 md:order-1">{step.val.toLocaleString()}</span>
                    </div>
                    {i > 0 && stats.hostEcosystem.funnel.applied > 0 && (
                      <div className="mt-4 text-xs font-bold text-slate-400">
                        전환율 {((step.val / stats.hostEcosystem.funnel.applied) * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="hidden md:block text-slate-200">
                      <TrendingUp size={32} />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </section>

          {/* 🟢 이동 배치됨: 호스트 리스크 모니터링 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 mt-8">
            {/* 우수 호스트 후보 리스트 */}
            <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h3 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-1 md:gap-2">
                  <Star size={16} className="text-emerald-500 hidden md:block" />
                  <span className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span>⭐ 슈퍼 호스트 유망주</span> <span className="text-[10px] md:text-xs font-normal text-slate-400">평점 4.0↑ 취소 0</span>
                  </span>
                </h3>
                <UserCheck size={16} className="text-emerald-500 md:w-[18px] md:h-[18px]" />
              </div>
              <div className="space-y-4">
                {stats.superHostCandidates.length > 0 ? stats.superHostCandidates.map((host: any, idx: number) => (
                  <div key={host.id} onClick={() => { window.location.href = `/users/${host.id}`; }} className="flex items-center gap-4 p-3 hover:bg-emerald-50/50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-emerald-100">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                      {host.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{host.name}</div>
                      <div className="text-xs text-slate-500">예약 {host.bookings}건 • 취소율 0%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-600 px-2 py-1 bg-emerald-100 rounded-lg">
                        평점 {host.rating}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                    <UserCheck size={24} className="text-slate-300" />
                    <p> 조건에 맞는 유망주가 아직 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 집중 관리 호스트 리스트 */}
            <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-rose-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-rose-50 rounded-full translate-x-12 md:translate-x-16 -translate-y-12 md:-translate-y-16 blur-xl md:blur-2xl"></div>
              <div className="flex items-center justify-between mb-4 md:mb-6 relative z-10">
                <h3 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-1 md:gap-2">
                  <AlertTriangle size={16} className="text-rose-500 hidden md:block" />
                  <span className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span>🚨 집중 관리 호스트</span> <span className="text-[10px] md:text-xs font-normal text-rose-400">예의/평점 주의</span>
                  </span>
                </h3>
                <AlertTriangle size={16} className="text-rose-500 animate-pulse md:w-[18px] md:h-[18px]" />
              </div>
              <div className="space-y-4 relative z-10">
                {stats.riskHosts.length > 0 ? stats.riskHosts.map((host: any, idx: number) => (
                  <div key={host.id} onClick={() => { window.location.href = `/users/${host.id}`; }} className="flex items-center gap-4 p-3 bg-white hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-slate-100 hover:border-rose-200">
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                      {host.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{host.name}</div>
                      <div className="text-xs font-medium text-rose-500">주의: 취소 {host.cancelCount}건 • 예약 {host.bookings}건</div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      {host.rating !== 'New' && Number(host.rating) < 3.5 && (
                        <div className="text-[10px] font-bold text-white px-1.5 py-0.5 bg-rose-500 rounded flex items-center gap-1 mb-1">
                          <AlertTriangle size={10} /> 저평점
                        </div>
                      )}
                      <div className="text-xs font-bold text-slate-700">
                        평점 {host.rating}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                    <CheckCircle size={24} className="text-emerald-300" />
                    <p>현재 감지된 불량 평점 호스트가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 1.5. 호스트 활동 및 응답 (Host Activity) */}
          <section>
            <div className="flex items-center justify-between mb-3 md:mb-4 mt-6 md:mt-8">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                💬 커뮤니케이션 현황 <span className="text-[10px] md:text-xs font-normal text-slate-400">문의 대비 응답 시간</span>
              </h2>
              <div onClick={() => setSelectedMetric('response')} className="text-[10px] md:text-xs font-bold text-blue-500 bg-blue-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                상세보기
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SimpleKpi
                label="평균 응답 시간 (Average Response Time)"
                value={stats.avgResponseTime}
                unit="분"
                sub="문의 접수 후"
                className={stats.avgResponseTime < 60 ? "text-emerald-500" : "text-rose-500"}
                onClick={() => setSelectedMetric('response')}
              />
              <SimpleKpi
                label="호스트 응답률 (Response Rate)"
                value={stats.responseRate}
                unit="%"
                sub="전체 문의 대비"
                className={stats.responseRate >= 90 ? "text-emerald-500" : "text-amber-500"}
                onClick={() => setSelectedMetric('response')}
              />
            </div>
          </section>

          {/* 2. 공급자 인구통계 및 유입 채널 */}
          <section>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                👥 호스트 생태계 통계
              </h2>
              <div onClick={() => setSelectedMetric('hostDemographics')} className="text-[10px] md:text-xs font-bold text-blue-500 bg-blue-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                상세보기
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {/* 유입 채널 (Acquisition) */}
              <div className="bg-slate-900 text-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-indigo-500/20 rounded-full translate-x-8 md:translate-x-12 -translate-y-8 md:-translate-y-12 blur-xl md:blur-2xl"></div>
                <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 flex items-center gap-2 relative z-10"><Search size={16} className="text-indigo-400 md:w-[18px] md:h-[18px]" /> 주요 유입 경로</h3>
                <div className="space-y-5 relative z-10">
                  {stats.hostEcosystem.sources.map((src, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-300">{src.name}</span>
                        <span className="font-bold">{src.percent.toFixed(1)}% ({src.count}명)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${src.percent}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 국적 및 언어 (Demographics) */}
              <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 md:gap-8">
                <div className="flex-1">
                  <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2"><UserCheck size={16} className="text-blue-500 md:w-[18px] md:h-[18px]" /> 호스트 국적 비율</h3>
                  <div className="flex h-24 md:h-32 items-end gap-2 border-b border-slate-100 pb-2">
                    {stats.hostEcosystem.nationalities.map((nat, i) => (
                      <div key={i} className="flex-1 flex flex-col justify-end group cursor-pointer relative">
                        <div className="absolute -top-6 md:-top-8 w-full text-center text-[10px] md:text-xs font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          {nat.count}명
                        </div>
                        <div className="w-full bg-blue-100 group-hover:bg-blue-300 rounded-t-sm md:rounded-t-md transition-all duration-300" style={{ height: `${Math.max(nat.percent, 5)}%` }}></div>
                        <div className="text-center mt-1 md:mt-2 text-[10px] md:text-xs font-bold text-slate-600 truncate">{nat.name}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-8">
                  <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2"><Star size={16} className="text-yellow-500 md:w-[18px] md:h-[18px]" /> 보유 언어 역량</h3>
                  <div className="space-y-4">
                    {stats.hostEcosystem.languages.map((lang, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-20 text-xs font-bold text-slate-600">{lang.name}</div>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full">
                          <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${lang.percent}%` }}></div>
                        </div>
                        <div className="w-8 text-right text-xs font-mono text-slate-500">{lang.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeMainTab === 'reviews' && (
        <div className="animate-in slide-in-from-bottom-[50px] duration-500">
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">Review Quality는 리뷰 품질과 이상 징후를 보는 운영 구간입니다.</div>
            <div className="mt-1">리뷰 삭제, 미응답 상태, 후기 내용 확인처럼 품질 관리에 필요한 작업만 집중해서 봅니다.</div>
          </div>
          <ReviewsTab />
        </div>
      )}

      {activeMainTab === 'logs' && (
        <div className="animate-in slide-in-from-bottom-[50px] duration-500">
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">운영 감사 로그는 관리자 작업 추적용 구간입니다.</div>
            <div className="mt-1">누가 어떤 운영 액션을 언제 수행했는지 확인하는 감사 이력만 보여주며, 일반 분석 숫자와는 분리해서 읽어야 합니다.</div>
          </div>
          <AuditLogTab />
        </div>
      )}

      {/* 🟢 복구: 상세 모달 (Drill-down) */}
      {
        selectedMetric && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedMetric(null)}>
            <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl p-8 relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedMetric(null)} className="absolute top-6 right-6 text-gray-400 hover:text-black"><X size={20} /></button>

              {selectedMetric === 'aov' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">가격대별 결제 비중</h3>
                  <div className="space-y-4">
                    <SimpleBar label="Low (<3만)" val={stats.priceDistribution.low} max={stats.funnel.completed} />
                    <SimpleBar label="Mid (3~10만)" val={stats.priceDistribution.mid} max={stats.funnel.completed} />
                    <SimpleBar label="High (>10만)" val={stats.priceDistribution.high} max={stats.funnel.completed} />
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">체험 예약과 서비스 결제를 합친 전체 결제 건 기준 가격대 비중입니다.</p>
                </div>
              )}

              {selectedMetric === 'users' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">최근 가입 유저 (기간 내)</h3>
                  <div className="space-y-3">
                    {stats.newUsersList.length > 0 ? stats.newUsersList.map((u: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs">
                            {u.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">{u.name || 'Unknown'}</div>
                            <div className="text-xs text-slate-500">{format(new Date(u.created_at), 'yyyy-MM-dd')} 가입</div>
                          </div>
                        </div>
                        <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded">
                          {u.nationality || 'KR'}
                        </span>
                      </div>
                    )) : (
                      <div className="text-center py-4 text-slate-400 text-sm">기간 내 신규 유저가 없습니다.</div>
                    )}
                  </div>
                </div>
              )}

              {selectedMetric === 'gmv' && (
                <div className="space-y-6 text-center">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">🔥 최고 매출 기록일</h3>
                  <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100">
                    <div className="text-4xl font-black text-rose-500 tracking-tighter mb-2">₩{stats.topRevenueDate.amount.toLocaleString()}</div>
                    <div className="text-sm font-bold text-slate-600">발생일자: {stats.topRevenueDate.dateStr}</div>
                    <p className="text-xs text-slate-500 mt-2">선택하신 기간 내 체험 예약과 서비스 결제를 합친 하루 기준 최고 거래액입니다.</p>
                  </div>
                </div>
              )}

              {selectedMetric === 'cancel' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">체험 예약 취소 사유 분석</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-red-50 rounded-xl text-center">
                      <div className="text-sm text-red-500 font-bold mb-1">유저 취소</div>
                      <div className="text-2xl font-black text-slate-900">{stats.cancelBreakdown.user}건</div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-xl text-center">
                      <div className="text-sm text-orange-500 font-bold mb-1">호스트 거절</div>
                      <div className="text-2xl font-black text-slate-900">{stats.cancelBreakdown.host}건</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">이 구간은 서비스 의뢰가 아닌 체험 예약 취소 기준입니다. 호스트 거절이 많다면 달력 관리를 독려해야 합니다.</p>
                </div>
              )}

              {selectedMetric === 'response' && (
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    🏆 응답시간 상위 10명 <span className="text-xs font-normal text-emerald-500">최단 시간 기준</span>
                  </h3>
                  <div className="space-y-3 mb-6">
                    {stats.topRespHosts.length > 0 ? stats.topRespHosts.map((h: any, idx: number) => (
                      <div key={h.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black">{idx + 1}</div>
                          <div className="text-sm font-bold text-slate-800">{h.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-emerald-600">{h.timeMins}분</div>
                          <div className="text-[10px] text-slate-400">응답률 {h.rate.toFixed(0)}%</div>
                        </div>
                      </div>
                    )) : <div className="text-sm text-slate-400">데이터 없음</div>}
                  </div>

                  <h3 className="text-xl font-bold flex items-center gap-2 pt-4 border-t border-slate-100">
                    🐢 응답시간 하위 10명 <span className="text-xs font-normal text-rose-500">최장 시간 기준</span>
                  </h3>
                  <div className="space-y-3">
                    {stats.bottomRespHosts.length > 0 ? stats.bottomRespHosts.map((h: any, idx: number) => (
                      <div key={h.id} className="flex justify-between items-center bg-rose-50/30 p-3 rounded-lg border border-rose-100">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-black">{idx + 1}</div>
                          <div className="text-sm font-bold text-slate-800">{h.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-rose-600">{h.timeMins}분</div>
                          <div className="text-[10px] text-slate-400">응답률 {h.rate.toFixed(0)}%</div>
                        </div>
                      </div>
                    )) : <div className="text-sm text-slate-400">데이터 없음</div>}
                  </div>
                </div>
              )}

              {selectedMetric === 'exps' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">활성 체험 현황</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-xl text-center">
                      <div className="text-sm text-emerald-600 font-bold mb-1">운영 중 (Active)</div>
                      <div className="text-2xl font-black text-slate-900">{stats.expsBreakdown.active}개</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl text-center">
                      <div className="text-sm text-blue-500 font-bold mb-1">기간 내 신규 등록</div>
                      <div className="text-2xl font-black text-slate-900">{stats.expsBreakdown.new}개</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-4 opacity-70">
                    <div className="text-xs text-slate-500 font-medium">검수 대기: {stats.expsBreakdown.pending}개</div>
                    <div className="text-xs text-slate-500 font-medium">반려: {stats.expsBreakdown.rejected}개</div>
                  </div>
                </div>
              )}

              {selectedMetric === 'demographics' && (
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                  <h3 className="text-xl font-bold">결제 고객 인구통계 상세</h3>
                  <p className="text-xs text-slate-400 -mt-3">체험 예약과 서비스 결제를 합친 플랫폼 전체 결제 고객 기준</p>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">국적 분포 (전체)</h4>
                    <div className="space-y-3">
                      {stats.demographics.allNationalities.map((nat, i) => (
                        <div key={`nat-${i}`} className="flex items-center gap-3">
                          <span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span>
                          <div className="w-16 text-sm font-bold text-slate-700">{nat.name}</div>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${nat.percent}%` }}></div>
                          </div>
                          <div className="w-16 text-right text-xs font-mono text-slate-500">{nat.count}명 ({nat.percent.toFixed(1)}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">연령대 분포</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {stats.demographics.ages.map((age, i) => (
                        <div key={`age-${i}`} className="bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-100">
                          <span className="text-sm font-bold text-slate-700">{age.name}</span>
                          <span className="text-xs font-mono text-slate-500">{age.count}명 ({age.percent.toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">성별 분포</h4>
                    <div className="flex gap-4">
                      {stats.demographics.genders.map((gen, i) => (
                        <div key={`gen-${i}`} className="flex-1 bg-slate-50 p-3 rounded-xl text-center border border-slate-100">
                          <div className="text-sm font-bold text-slate-700 mb-1">{gen.name}</div>
                          <div className="text-xs font-mono text-slate-500">{gen.count}명 ({gen.percent.toFixed(1)}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedMetric === 'searchTrends' && (
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                  <h3 className="text-xl font-bold">체험 검색어 전체 순위</h3>
                  <p className="text-xs text-slate-400 -mt-3">체험 검색 로그 기준</p>
                  <div className="space-y-2">
                    {stats.allSearchTrends.length > 0 ? stats.allSearchTrends.map((trend, i) => (
                      <div key={`trend-${i}`} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center text-xs font-black">{i + 1}</div>
                          <div className="text-sm font-bold text-slate-800">{trend.keyword}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-700">{trend.count}회</div>
                          <div className="text-[10px] text-slate-400">검색 비중 {trend.percent.toFixed(1)}%</div>
                        </div>
                      </div>
                    )) : <div className="text-center py-8 text-slate-400 text-sm">검색 데이터가 없습니다.</div>}
                  </div>
                </div>
              )}

              {selectedMetric === 'topExps' && (
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                  <h3 className="text-xl font-bold">전체 체험 판매 랭킹</h3>
                  <p className="text-xs text-slate-400 -mt-3">체험 예약 결제 완료 건수 기준</p>
                  <div className="space-y-3">
                    {stats.allExperiences.length > 0 ? stats.allExperiences.map((exp: any, i: number) => (
                      <div key={exp.id} className="flex gap-4 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-colors">
                        <div className="w-8 flex flex-col items-center justify-center">
                          <span className={`text-lg font-black ${i < 3 ? 'text-amber-500' : 'text-slate-400'}`}>{i + 1}</span>
                        </div>
                        <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                          {exp.image_url ? (
                            <img src={exp.image_url} alt={exp.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300"><Star size={20} /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="text-sm font-bold text-slate-900 truncate">{exp.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span className="flex items-center gap-0.5 text-amber-500 font-medium"><Star size={12} fill="currentColor" /> {exp.rating}</span>
                            <span>결제 {exp.bookingCount}건</span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col justify-center">
                          <div className="text-sm font-black text-slate-800 group-hover:text-amber-600 transition-colors">₩{exp.totalRevenue.toLocaleString()}</div>
                        </div>
                      </div>
                    )) : <div className="text-center py-8 text-slate-400 text-sm">판매된 체험이 없습니다.</div>}
                  </div>
                </div>
              )}

              {selectedMetric === 'hostDemographics' && (
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                  <h3 className="text-xl font-bold">호스트 생태계 전체 통계</h3>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">주요 유입 경로</h4>
                    <div className="space-y-3">
                      {stats.hostEcosystem.allSources.map((src, i) => (
                        <div key={`src-${i}`} className="flex items-center gap-3">
                          <span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span>
                          <div className="w-24 text-sm font-bold text-slate-700 truncate">{src.name}</div>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${src.percent}%` }}></div>
                          </div>
                          <div className="w-16 text-right text-xs font-mono text-slate-500">{src.count}명 ({src.percent.toFixed(1)}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">호스트 국적 비율</h4>
                    <div className="space-y-3">
                      {stats.hostEcosystem.allNationalities.map((nat, i) => (
                        <div key={`hnat-${i}`} className="flex items-center gap-3">
                          <span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span>
                          <div className="w-20 text-sm font-bold text-slate-700">{nat.name}</div>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${nat.percent}%` }}></div>
                          </div>
                          <div className="w-16 text-right text-xs font-mono text-slate-500">{nat.count}명 ({nat.percent.toFixed(1)}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">보유 언어 비율</h4>
                    <div className="space-y-3">
                      {stats.hostEcosystem.allLanguages.map((lang, i) => (
                        <div key={`hlang-${i}`} className="flex items-center gap-3">
                          <span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span>
                          <div className="w-20 text-sm font-bold text-slate-700">{lang.name}</div>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${lang.percent}%` }}></div>
                          </div>
                          <div className="w-16 text-right text-xs font-mono text-slate-500">{lang.count}명 ({lang.percent.toFixed(1)}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedMetric === 'revenue' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">플랫폼 순수익 구조</h3>
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-bold text-slate-500">총 거래액 (GMV)</span>
                      <span className="text-lg font-black text-slate-800">₩{stats.gmv.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-8 bg-slate-200 rounded-full flex overflow-hidden">
                      <div className="h-full bg-blue-500 flex items-center px-3" style={{ width: `${stats.gmv ? (stats.netRevenue / stats.gmv) * 100 : 0}%` }}>
                        <span className="text-[10px] text-white font-bold opacity-0 md:opacity-100">플랫폼 수익</span>
                      </div>
                      <div className="h-full bg-slate-400 flex items-center justify-end px-3 flex-1">
                        <span className="text-[10px] text-white font-bold opacity-0 md:opacity-100">호스트 정산</span>
                      </div>
                    </div>
                    <div className="flex justify-between mt-4">
                      <div>
                        <div className="text-xs font-bold text-blue-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 플랫폼 순수익</div>
                        <div className="text-sm font-black text-slate-700 mt-1">₩{stats.netRevenue.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-500 flex items-center gap-1 justify-end"><span className="w-2 h-2 rounded-full bg-slate-400"></span> 호스트 정산금</div>
                        <div className="text-sm font-black text-slate-700 mt-1">₩{stats.hostPayout.toLocaleString()}</div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-4 text-center">체험 예약과 서비스 결제를 합친 플랫폼 전체 수익 구조입니다.</p>
                  </div>
                </div>
              )}

              {selectedMetric === 'conversion' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">가입 대비 결제건 비율</h3>
                  <div className="space-y-4">
                    <FunnelBar label="상품 노출" value={stats.funnel.views} max={stats.funnel.views} color="bg-slate-200" />
                    <FunnelBar label="상세 클릭" value={stats.funnel.clicks} max={stats.funnel.views} color="bg-slate-300" />
                    <FunnelBar label="결제 시도" value={stats.funnel.paymentInit} max={stats.funnel.views} color="bg-slate-400" />
                    <FunnelBar label="결제 완료" value={stats.funnel.completed} max={stats.funnel.views} isFinal color="bg-emerald-500" />
                  </div>
                  <p className="text-xs text-slate-400 mt-4 text-center">기간 내 신규 가입자 수 대비 결제 완료 건수 비율은 <strong className="text-emerald-500">{stats.conversionRate}%</strong> 입니다. 동일 고객의 중복 결제 건도 포함됩니다.</p>
                </div>
              )}

              {selectedMetric === 'retention' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">기간 내 반복 결제 고객 비율</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                      <div className="text-[10px] text-slate-500 font-bold mb-1">1회 결제</div>
                      <div className="text-xl font-black text-slate-700">{stats.retentionBreakdown.once}명</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl text-center border border-blue-100">
                      <div className="text-[10px] text-blue-500 font-bold mb-1">2회 재구매</div>
                      <div className="text-xl font-black text-blue-700">{stats.retentionBreakdown.twice}명</div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl text-center border border-emerald-100">
                      <div className="text-[10px] text-emerald-600 font-bold mb-1">3회 이상 (단골)</div>
                      <div className="text-xl font-black text-emerald-700">{stats.retentionBreakdown.threeOrMore}명</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">해당 기간 내 체험 예약과 서비스 결제를 합친 전체 결제 고객 중 2회 이상 결제한 고객 비율은 {stats.retentionRate}% 입니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}

// 작은 컴포넌트들
function SimpleKpi({ label, value, unit, className, sub, onClick }: any) {
  return (
    <div onClick={onClick} className={`p-4 md:p-5 bg-white border border-slate-200 rounded-xl md:rounded-2xl shadow-sm transition-all flex flex-col justify-between h-28 md:h-32 ${onClick ? 'cursor-pointer hover:border-slate-400 hover:shadow-md' : ''}`}>
      <div className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center justify-between gap-1">
        <span className="truncate">{label}</span>
        {sub && <span className="text-[8px] md:text-[10px] text-slate-300 normal-case bg-slate-50 px-1 md:px-1.5 py-0.5 rounded whitespace-nowrap">{sub}</span>}
      </div>
      <div className={`text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-auto truncate ${className}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        <span className="text-xs md:text-sm font-medium text-slate-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}

function FunnelBar({ label, value, max, isFinal, color }: any) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 md:gap-4 group">
      <div className="w-16 md:w-20 text-[10px] md:text-xs font-bold text-slate-500 text-right">{label}</div>
      <div className="flex-1 h-8 md:h-10 bg-slate-50 rounded-lg md:rounded-xl overflow-hidden relative">
        <div className={`h-full absolute top-0 left-0 transition-all duration-1000 ${color}`} style={{ width: `${Math.max(percent, 2)}%` }}></div>
        <div className={`absolute top-0 left-2 md:left-3 h-full flex items-center text-xs md:text-sm font-bold ${isFinal && percent > 20 ? 'text-white' : 'text-slate-700'}`}>
          {value.toLocaleString()}
        </div>
      </div>
      <div className="w-10 md:w-14 text-right text-xs md:text-sm font-mono text-slate-400 group-hover:text-slate-900 transition-colors">
        {percent.toFixed(1)}%
      </div>
    </div>
  );
}

function SimpleBar({ label, val, max }: any) {
  const percent = max > 0 ? (val / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold w-24 text-slate-600">{label}</span>
      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-slate-800 rounded-full" style={{ width: `${percent}%` }}></div>
      </div>
      <span className="text-xs font-mono w-10 text-right">{val}건</span>
    </div>
  )
}
