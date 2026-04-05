import { NextRequest, NextResponse } from 'next/server';

import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplicationsByUser,
} from '@/app/utils/hostVisibility';
import { getSearchableCityAliases } from '@/app/utils/searchLocationCatalog';
import { createClient } from '@/app/utils/supabase/server';
import { normalizeServiceCity } from '@/app/utils/serviceRequestLocation';
import {
  SEARCH_EXPERIENCE_CARD_SELECT,
  SEARCH_EXPERIENCE_SELECT,
  SEARCH_TIME_RANGES,
  SEARCH_TYPE_KEYWORDS,
  type SearchExperience,
  type SearchExperiencesResponse,
  type SearchTimeId,
  type SearchTypeId,
} from '@/app/search/searchContract';

function normalizeSearchInput(value: string) {
  return value
    .replace(/[(),'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenizeSearchInput(value: string) {
  const normalized = normalizeSearchInput(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function asString(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function parseFilterIds<T extends string>(value: string | null, allowed: readonly T[]) {
  if (!value) return [];
  const allowedSet = new Set(allowed);
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is T => allowedSet.has(entry as T));
}

function buildSearchHaystack(item: SearchExperience) {
  const record = item as Record<string, unknown>;
  return [
    item.title,
    record.description,
    item.city,
    ...getSearchableCityAliases(item.city),
    item.country,
    record.meeting_point,
    item.category,
    record.title_ko,
    record.description_ko,
    record.title_en,
    record.description_en,
    record.category_en,
    record.title_ja,
    record.description_ja,
    record.category_ja,
    record.title_zh,
    record.description_zh,
    record.category_zh,
  ]
    .map(asString)
    .join(' ')
    .toLowerCase();
}

function parseSearchDate(iso: string | null) {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toIsoDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTodayIsoDate() {
  return toIsoDateString(new Date());
}

function getAvailabilityLowerBound(startDate: string | null) {
  const today = getTodayIsoDate();
  const parsedStart = parseSearchDate(startDate);
  if (!parsedStart) return today;

  const normalizedStart = toIsoDateString(parsedStart);
  return normalizedStart > today ? normalizedStart : today;
}

function getAvailabilityUpperBound(endDate: string | null) {
  const parsedEnd = parseSearchDate(endDate);
  return parsedEnd ? toIsoDateString(parsedEnd) : null;
}

function getExperienceDates(item: SearchExperience) {
  const record = item as Record<string, unknown>;
  const candidates = [record.available_dates, record.availableDates];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map((value) => asString(value)).filter(Boolean);
    }
  }
  return [];
}

function matchesDateRange(item: SearchExperience, startDate: string | null, endDate: string | null) {
  const start = parseSearchDate(startDate);
  if (!start) return true;

  const end = parseSearchDate(endDate) || start;
  const startBoundary = new Date(start);
  const endBoundary = new Date(end);
  startBoundary.setHours(0, 0, 0, 0);
  endBoundary.setHours(23, 59, 59, 999);

  const availableDates = getExperienceDates(item);
  if (availableDates.length === 0) return false;

  return availableDates.some((dateValue) => {
    const timestamp = new Date(dateValue).getTime();
    return Number.isFinite(timestamp) && timestamp >= startBoundary.getTime() && timestamp <= endBoundary.getTime();
  });
}

function matchesTypeSelection(item: SearchExperience, selectedTypes: SearchTypeId[]) {
  if (selectedTypes.length === 0) return true;

  const haystack = buildSearchHaystack(item);
  return selectedTypes.some((typeId) =>
    SEARCH_TYPE_KEYWORDS[typeId].some((keyword) => haystack.includes(keyword.toLowerCase()))
  );
}

function parseHour(timeValue: string) {
  const normalized = timeValue.trim();
  const match = normalized.match(/^(\d{1,2}):/);
  if (!match) return null;
  const hour = Number(match[1]);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function matchesTimeSelection(item: SearchExperience, selectedTimes: SearchTimeId[]) {
  if (selectedTimes.length === 0) return true;

  const record = item as Record<string, unknown>;
  const rawTimes = Array.isArray(record.available_times) ? record.available_times : [];
  const hours = rawTimes
    .map((value) => asString(value))
    .map((value) => parseHour(value))
    .filter((value): value is number => value !== null);

  if (hours.length === 0) return false;

  return selectedTimes.some((timeId) => {
    const range = SEARCH_TIME_RANGES[timeId];
    return hours.some((hour) =>
      range.endHour === null ? hour >= range.startHour : hour >= range.startHour && hour < range.endHour
    );
  });
}

type AvailabilityRow = {
  experience_id: number;
  date: string | null;
  start_time?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const { data: publicHostApplications, error: visibleHostsError } = await supabase
      .from('public_host_applications')
      .select('id, user_id, status, created_at');

    if (visibleHostsError) throw visibleHostsError;

    const visibleHostIds = Array.from(
      pickLatestPublicHostApplicationsByUser(publicHostApplications || [])
        .values()
    )
      .filter((row) => isPublicHostApplicationStatus(row.status))
      .map((row) => String(row.user_id || ''))
      .filter(Boolean);

    if (visibleHostIds.length === 0) {
      const emptyResponse: SearchExperiencesResponse = { data: [] };
      return NextResponse.json(emptyResponse);
    }

    const location = searchParams.get('location') || '';
    const language = searchParams.get('language') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const city = normalizeServiceCity(searchParams.get('city') || '');
    const selectedTimes = parseFilterIds<SearchTimeId>(searchParams.get('times'), ['morning', 'afternoon', 'evening']);
    const selectedTypes = parseFilterIds<SearchTypeId>(searchParams.get('types'), [
      'food_tour',
      'cafe_dessert',
      'walking_healing',
      'shopping',
      'culture',
      'activity',
      'nightlife',
      'architecture',
      'show_sports',
      'landmark',
      'one_day_class',
    ]);
    const searchTerms = tokenizeSearchInput(location);
    const needsAvailability = Boolean(startDate || endDate || selectedTimes.length > 0);
    const needsTextFilterFields = searchTerms.length > 0 || selectedTypes.length > 0;

    let query = supabase
      .from('experiences')
      .select(needsTextFilterFields ? SEARCH_EXPERIENCE_SELECT : SEARCH_EXPERIENCE_CARD_SELECT)
      .eq('status', 'active')
      .in('host_id', visibleHostIds);

    if (city) {
      query = query.eq('city', city);
    }

    if (searchTerms.length > 0) {
      const searchFields = [
        'title',
        'description',
        'city',
        'country',
        'category',
        'title_ko',
        'description_ko',
        'title_en',
        'description_en',
        'category_en',
        'title_ja',
        'description_ja',
        'category_ja',
        'title_zh',
        'description_zh',
        'category_zh',
      ];

      const seedTerm = searchTerms[0].replace(/[%_]/g, '');
      const canonicalSeedCity = normalizeServiceCity(seedTerm).replace(/[%_]/g, '');
      const seedVariants = Array.from(new Set([seedTerm, canonicalSeedCity].filter(Boolean)));
      if (seedVariants.length > 0) {
        const orQuery = seedVariants
          .flatMap((term) => searchFields.map((field) => `${field}.ilike.%${term}%`))
          .join(',');
        query = query.or(orQuery);
      }
    }

    if (language !== 'all') {
      query = query.contains('languages', [language]);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    let filtered = (data ?? []) as unknown as SearchExperience[];

    if (searchTerms.length > 0) {
      filtered = filtered.filter((item) => {
        const haystack = buildSearchHaystack(item);
        return searchTerms.every((term) => haystack.includes(term));
      });
    }

    filtered = filtered.filter((item) => matchesTypeSelection(item, selectedTypes));

    const experienceIds = filtered
      .map((item) => Number(item.id))
      .filter((value) => Number.isFinite(value));

    let availabilityMap = new Map<number, { dates: string[]; times: string[] }>();

    if (needsAvailability && experienceIds.length > 0) {
      let availabilityQuery = supabase
        .from('experience_availability')
        .select('experience_id, date, start_time')
        .in('experience_id', experienceIds)
        .eq('is_booked', false)
        .gte('date', getAvailabilityLowerBound(startDate));

      const availabilityUpperBound = getAvailabilityUpperBound(endDate);
      if (availabilityUpperBound) {
        availabilityQuery = availabilityQuery.lte('date', availabilityUpperBound);
      }

      const { data: availabilityRows, error: availabilityError } = await availabilityQuery;

      if (availabilityError) throw availabilityError;

      availabilityMap = (availabilityRows as AvailabilityRow[] | null ?? []).reduce((map, row) => {
        const experienceId = Number(row.experience_id);
        if (!map.has(experienceId)) {
          map.set(experienceId, { dates: [], times: [] });
        }

        const current = map.get(experienceId)!;
        if (row.date && !current.dates.includes(row.date)) {
          current.dates.push(row.date);
        }
        if (row.start_time && !current.times.includes(row.start_time)) {
          current.times.push(row.start_time);
        }
        return map;
      }, new Map<number, { dates: string[]; times: string[] }>());
    }

    filtered = filtered.map((item) => {
      const availability = availabilityMap.get(Number(item.id));
      return {
        ...item,
        available_dates: availability?.dates ?? [],
        available_times: availability?.times ?? [],
      };
    });

    filtered = filtered.filter((item) => matchesDateRange(item, startDate, endDate));
    filtered = filtered.filter((item) => matchesTimeSelection(item, selectedTimes));

    const response: SearchExperiencesResponse = {
      data: filtered,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('Search API error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
