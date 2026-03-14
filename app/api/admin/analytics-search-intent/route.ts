import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

type SearchLogRow = {
  keyword: string | null;
  created_at: string | null;
  session_id: string | null;
};

type ActiveExperienceRow = {
  id: number;
  title: string | null;
  city: string | null;
  description: string | null;
  category: string | null;
};

type SearchIntentItem = {
  keyword: string;
  searches: number;
  recentSearches: number;
  previousSearches: number;
  surge: number;
  matchedActiveExperiences: number;
  trackedSearches: number;
  clickConvertedSearches: number;
  paymentInitConvertedSearches: number;
  clickConversionRate: number;
  paymentInitConversionRate: number;
};

type AnalyticsEventRow = {
  session_id: string | null;
  event_type: string | null;
  created_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  referrer_host: string | null;
  landing_path: string | null;
};

type SearchIntentSourceItem = {
  name: string;
  searches: number;
  uniqueKeywords: number;
  topKeyword: string | null;
  topKeywordSearches: number;
  lowSupplyKeyword: string | null;
  lowSupplySearches: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[·,.!?/\\()[\]{}:;'"`~_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTerms(keyword: string) {
  return normalize(keyword)
    .split(' ')
    .map((term) => term.trim())
    .filter(Boolean);
}

function getSearchHaystack(experience: ActiveExperienceRow) {
  return normalize([
    experience.title,
    experience.city,
    experience.description,
    experience.category,
  ].filter(Boolean).join(' '));
}

function countMatchedActiveExperiences(keyword: string, experiences: ActiveExperienceRow[]) {
  const terms = splitTerms(keyword);
  if (terms.length === 0) return 0;

  let matched = 0;
  for (const experience of experiences) {
    const haystack = getSearchHaystack(experience);
    if (!haystack) continue;
    if (terms.every((term) => haystack.includes(term))) {
      matched += 1;
    }
  }

  return matched;
}

function clampWindowDays(rawDays: number) {
  return Math.max(3, Math.min(14, rawDays));
}

function roundRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function getSourceLabel(event: AnalyticsEventRow) {
  const utmSource = String(event.utm_source || '').trim();
  const utmMedium = String(event.utm_medium || '').trim();
  const referrerHost = String(event.referrer_host || '').trim().replace(/^www\./i, '');
  const landingPath = String(event.landing_path || '').trim();

  if (utmSource) {
    return utmMedium ? `${utmSource} (${utmMedium})` : utmSource;
  }

  if (referrerHost) {
    return referrerHost;
  }

  if (landingPath) {
    return '직접 방문';
  }

  return '';
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

    let searchLogsQuery = supabaseAdmin
      .from('search_logs')
      .select('keyword, created_at, session_id');

    let analyticsEventsQuery = supabaseAdmin
      .from('analytics_events')
      .select('session_id, event_type, created_at, utm_source, utm_medium, referrer_host, landing_path')
      .in('event_type', ['click', 'payment_init']);

    if (startAt) {
      searchLogsQuery = searchLogsQuery.gte('created_at', startAt);
      analyticsEventsQuery = analyticsEventsQuery.gte('created_at', startAt);
    }

    if (endAt) {
      searchLogsQuery = searchLogsQuery.lte('created_at', endAt);
      analyticsEventsQuery = analyticsEventsQuery.lte('created_at', endAt);
    }

    const [
      { data: searchLogs, error: searchLogsError },
      { data: analyticsEvents, error: analyticsEventsError },
      { data: activeExperiences, error: activeExperiencesError },
    ] = await Promise.all([
      searchLogsQuery,
      analyticsEventsQuery,
      supabaseAdmin
        .from('experiences')
        .select('id, title, city, description, category')
        .eq('status', 'active'),
    ]);

    if (searchLogsError) throw searchLogsError;
    if (analyticsEventsError) throw analyticsEventsError;
    if (activeExperiencesError) throw activeExperiencesError;

    const searchRows = (searchLogs || []) as SearchLogRow[];
    const analyticsEventRows = (analyticsEvents || []) as AnalyticsEventRow[];
    const activeExperienceRows = (activeExperiences || []) as ActiveExperienceRow[];

    const totalSearches = searchRows.reduce((count, row) => {
      const keyword = String(row.keyword || '').trim();
      return keyword ? count + 1 : count;
    }, 0);

    const now = endAt ? new Date(endAt) : new Date();
    const startBoundary = startAt ? new Date(startAt) : new Date(now.getTime() - (30 * MS_PER_DAY));
    const totalRangeDays = Math.max(1, Math.ceil((now.getTime() - startBoundary.getTime()) / MS_PER_DAY));
    const comparisonWindowDays = clampWindowDays(Math.floor(totalRangeDays / 2) || 7);
    const recentStartMs = now.getTime() - ((comparisonWindowDays - 1) * MS_PER_DAY);
    const previousEndMs = recentStartMs - 1;
    const previousStartMs = previousEndMs - ((comparisonWindowDays - 1) * MS_PER_DAY);

    const totalCounts: Record<string, number> = {};
    const recentCounts: Record<string, number> = {};
    const previousCounts: Record<string, number> = {};
    const trackedCounts: Record<string, number> = {};
    const clickConvertedCounts: Record<string, number> = {};
    const paymentInitConvertedCounts: Record<string, number> = {};
    const sourceKeywordCounts: Record<string, Record<string, number>> = {};
    const sessionSearchRows = new Map<string, SearchLogRow[]>();
    const sessionEventRows = new Map<string, AnalyticsEventRow[]>();

    for (const row of searchRows) {
      const keyword = String(row.keyword || '').trim();
      if (!keyword || !row.created_at) continue;

      const createdAtMs = new Date(row.created_at).getTime();
      if (Number.isNaN(createdAtMs)) continue;

      totalCounts[keyword] = (totalCounts[keyword] || 0) + 1;

      if (createdAtMs >= recentStartMs && createdAtMs <= now.getTime()) {
        recentCounts[keyword] = (recentCounts[keyword] || 0) + 1;
      } else if (createdAtMs >= previousStartMs && createdAtMs <= previousEndMs) {
        previousCounts[keyword] = (previousCounts[keyword] || 0) + 1;
      }

      if (row.session_id) {
        const rows = sessionSearchRows.get(row.session_id) || [];
        rows.push(row);
        sessionSearchRows.set(row.session_id, rows);
      }
    }

    for (const event of analyticsEventRows) {
      if (!event.session_id || !event.created_at) continue;
      const rows = sessionEventRows.get(event.session_id) || [];
      rows.push(event);
      sessionEventRows.set(event.session_id, rows);
    }

    for (const [sessionId, rows] of sessionSearchRows.entries()) {
      const searchTimeline = rows
        .filter((row) => row.created_at && String(row.keyword || '').trim())
        .sort((left, right) => new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime());

      if (searchTimeline.length === 0) continue;

      const eventTimeline = (sessionEventRows.get(sessionId) || [])
        .filter((event) => event.created_at && event.event_type)
        .sort((left, right) => new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime());

      const sessionSourceLabel = eventTimeline
        .map((event) => getSourceLabel(event))
        .find(Boolean);

      for (let index = 0; index < searchTimeline.length; index += 1) {
        const current = searchTimeline[index];
        const keyword = String(current.keyword || '').trim();
        const windowStart = new Date(current.created_at || 0).getTime();
        const nextSearch = searchTimeline[index + 1];
        const windowEnd = nextSearch?.created_at ? new Date(nextSearch.created_at).getTime() : Number.POSITIVE_INFINITY;

        if (!keyword || Number.isNaN(windowStart)) continue;

        trackedCounts[keyword] = (trackedCounts[keyword] || 0) + 1;

        if (sessionSourceLabel) {
          sourceKeywordCounts[sessionSourceLabel] = sourceKeywordCounts[sessionSourceLabel] || {};
          sourceKeywordCounts[sessionSourceLabel][keyword] =
            (sourceKeywordCounts[sessionSourceLabel][keyword] || 0) + 1;
        }

        let hasClick = false;
        let hasPaymentInit = false;

        for (const event of eventTimeline) {
          const eventTime = new Date(event.created_at || 0).getTime();
          if (Number.isNaN(eventTime) || eventTime < windowStart || eventTime >= windowEnd) continue;
          if (event.event_type === 'click') hasClick = true;
          if (event.event_type === 'payment_init') hasPaymentInit = true;
          if (hasClick && hasPaymentInit) break;
        }

        if (hasClick) {
          clickConvertedCounts[keyword] = (clickConvertedCounts[keyword] || 0) + 1;
        }

        if (hasPaymentInit) {
          paymentInitConvertedCounts[keyword] = (paymentInitConvertedCounts[keyword] || 0) + 1;
        }
      }
    }

    const totalTrackedSearches = Object.values(trackedCounts).reduce((sum, count) => sum + count, 0);
    const totalClickConvertedSearches = Object.values(clickConvertedCounts).reduce((sum, count) => sum + count, 0);
    const totalPaymentInitConvertedSearches = Object.values(paymentInitConvertedCounts).reduce((sum, count) => sum + count, 0);

    const keywordItems = Object.entries(totalCounts)
      .map(([keyword, searches]) => {
        const recentSearches = recentCounts[keyword] || 0;
        const previousSearches = previousCounts[keyword] || 0;
        const trackedSearches = trackedCounts[keyword] || 0;
        const clickConvertedSearches = clickConvertedCounts[keyword] || 0;
        const paymentInitConvertedSearches = paymentInitConvertedCounts[keyword] || 0;
        return {
          keyword,
          searches,
          recentSearches,
          previousSearches,
          surge: recentSearches - previousSearches,
          matchedActiveExperiences: countMatchedActiveExperiences(keyword, activeExperienceRows),
          trackedSearches,
          clickConvertedSearches,
          paymentInitConvertedSearches,
          clickConversionRate: roundRate(clickConvertedSearches, trackedSearches),
          paymentInitConversionRate: roundRate(paymentInitConvertedSearches, trackedSearches),
        } satisfies SearchIntentItem;
      })
      .sort((left, right) => right.searches - left.searches);

    const topKeywords = keywordItems.slice(0, 10);
    const risingKeywords = keywordItems
      .filter((item) => item.recentSearches >= 2 && item.surge > 0)
      .sort((left, right) => {
        if (right.surge !== left.surge) return right.surge - left.surge;
        return right.recentSearches - left.recentSearches;
      })
      .slice(0, 6);

    const lowSupplyKeywords = keywordItems
      .filter((item) => item.searches >= 2 && item.matchedActiveExperiences <= 1)
      .sort((left, right) => {
        if (right.searches !== left.searches) return right.searches - left.searches;
        return left.matchedActiveExperiences - right.matchedActiveExperiences;
      })
      .slice(0, 6);

    const clickConversionKeywords = keywordItems
      .filter((item) => item.trackedSearches >= 2 && item.clickConvertedSearches > 0)
      .sort((left, right) => {
        if (right.clickConversionRate !== left.clickConversionRate) {
          return right.clickConversionRate - left.clickConversionRate;
        }
        return right.trackedSearches - left.trackedSearches;
      })
      .slice(0, 6);

    const paymentInitConversionKeywords = keywordItems
      .filter((item) => item.trackedSearches >= 2 && item.paymentInitConvertedSearches > 0)
      .sort((left, right) => {
        if (right.paymentInitConversionRate !== left.paymentInitConversionRate) {
          return right.paymentInitConversionRate - left.paymentInitConversionRate;
        }
        return right.trackedSearches - left.trackedSearches;
      })
      .slice(0, 6);

    const sourceDemand = Object.entries(sourceKeywordCounts)
      .map(([name, keywordCounts]) => {
        const sortedKeywords = Object.entries(keywordCounts)
          .map(([keyword, searches]) => ({
            keyword,
            searches,
            matchedActiveExperiences: countMatchedActiveExperiences(keyword, activeExperienceRows),
          }))
          .sort((left, right) => {
            if (right.searches !== left.searches) return right.searches - left.searches;
            return left.keyword.localeCompare(right.keyword, 'ko');
          });

        const topKeyword = sortedKeywords[0];
        const lowSupplyKeyword = sortedKeywords
          .filter((item) => item.searches >= 2 && item.matchedActiveExperiences <= 1)
          .sort((left, right) => {
            if (right.searches !== left.searches) return right.searches - left.searches;
            return left.matchedActiveExperiences - right.matchedActiveExperiences;
          })[0];

        return {
          name,
          searches: Object.values(keywordCounts).reduce((sum, count) => sum + count, 0),
          uniqueKeywords: Object.keys(keywordCounts).length,
          topKeyword: topKeyword?.keyword || null,
          topKeywordSearches: topKeyword?.searches || 0,
          lowSupplyKeyword: lowSupplyKeyword?.keyword || null,
          lowSupplySearches: lowSupplyKeyword?.searches || 0,
        } satisfies SearchIntentSourceItem;
      })
      .filter((item) => item.searches > 0)
      .sort((left, right) => right.searches - left.searches)
      .slice(0, 6);

    return NextResponse.json({
      success: true,
      data: {
        totalSearches,
        comparisonWindowDays,
        topKeywords,
        risingKeywords,
        lowSupplyKeywords,
        clickConversionKeywords,
        paymentInitConversionKeywords,
        sourceDemand,
        supplyReference: '현재 활성 체험의 제목/도시/설명/카테고리 기준',
        conversionAvailable: totalTrackedSearches > 0,
        conversionCoverage: {
          trackedSearches: totalTrackedSearches,
          clickConvertedSearches: totalClickConvertedSearches,
          paymentInitConvertedSearches: totalPaymentInitConvertedSearches,
        },
        sourceDemandAvailable: sourceDemand.length > 0,
        sourceTrackedSearches: Object.values(sourceKeywordCounts)
          .reduce((sum, keywordCounts) => sum + Object.values(keywordCounts).reduce((innerSum, count) => innerSum + count, 0), 0),
      },
    });
  } catch (error) {
    console.error('[api/admin/analytics-search-intent] error', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build analytics search intent summary' },
      { status: 500 }
    );
  }
}
