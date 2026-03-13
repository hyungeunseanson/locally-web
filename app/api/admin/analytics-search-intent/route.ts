import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

type SearchLogRow = {
  keyword: string | null;
  created_at: string | null;
};

type ActiveExperienceRow = {
  id: number;
  title: string | null;
  city: string | null;
  description: string | null;
  category: string | null;
  tags: string[] | null;
};

type SearchIntentItem = {
  keyword: string;
  searches: number;
  recentSearches: number;
  previousSearches: number;
  surge: number;
  matchedActiveExperiences: number;
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
    ...(Array.isArray(experience.tags) ? experience.tags : []),
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
      .select('keyword, created_at');

    if (startAt) {
      searchLogsQuery = searchLogsQuery.gte('created_at', startAt);
    }

    if (endAt) {
      searchLogsQuery = searchLogsQuery.lte('created_at', endAt);
    }

    const [
      { data: searchLogs, error: searchLogsError },
      { data: activeExperiences, error: activeExperiencesError },
    ] = await Promise.all([
      searchLogsQuery,
      supabaseAdmin
        .from('experiences')
        .select('id, title, city, description, category, tags')
        .eq('status', 'active'),
    ]);

    if (searchLogsError) throw searchLogsError;
    if (activeExperiencesError) throw activeExperiencesError;

    const searchRows = (searchLogs || []) as SearchLogRow[];
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
    }

    const keywordItems = Object.entries(totalCounts)
      .map(([keyword, searches]) => {
        const recentSearches = recentCounts[keyword] || 0;
        const previousSearches = previousCounts[keyword] || 0;
        return {
          keyword,
          searches,
          recentSearches,
          previousSearches,
          surge: recentSearches - previousSearches,
          matchedActiveExperiences: countMatchedActiveExperiences(keyword, activeExperienceRows),
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

    return NextResponse.json({
      success: true,
      data: {
        totalSearches,
        comparisonWindowDays,
        topKeywords,
        risingKeywords,
        lowSupplyKeywords,
        supplyReference: '현재 활성 체험의 제목/도시/설명/카테고리/태그 기준',
        conversionAvailable: false,
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
