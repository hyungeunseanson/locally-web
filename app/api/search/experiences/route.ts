import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/app/utils/supabase/server';
import {
  SEARCH_EXPERIENCE_SELECT,
  type SearchExperience,
  type SearchExperiencesResponse,
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

function buildSearchHaystack(item: SearchExperience) {
  const record = item as Record<string, unknown>;
  return [
    item.title,
    record.description,
    item.city,
    item.country,
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

type AvailabilityRow = {
  experience_id: number;
  date: string | null;
  start_time?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const location = searchParams.get('location') || '';
    const language = searchParams.get('language') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('experiences')
      .select(SEARCH_EXPERIENCE_SELECT)
      .eq('status', 'active');

    const searchTerms = tokenizeSearchInput(location);
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
      if (seedTerm) {
        const orQuery = searchFields.map((field) => `${field}.ilike.%${seedTerm}%`).join(',');
        query = query.or(orQuery);
      }
    }

    if (language !== 'all') {
      query = query.contains('languages', [language]);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    const experiences = (data ?? []) as unknown as SearchExperience[];
    const experienceIds = experiences
      .map((item) => Number(item.id))
      .filter((value) => Number.isFinite(value));

    let availabilityMap = new Map<number, { dates: string[]; times: string[] }>();

    if (experienceIds.length > 0) {
      const { data: availabilityRows, error: availabilityError } = await supabase
        .from('experience_availability')
        .select('experience_id, date, start_time')
        .in('experience_id', experienceIds)
        .eq('is_booked', false);

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

    let filtered = experiences.map((item) => {
      const availability = availabilityMap.get(Number(item.id));
      return {
        ...item,
        available_dates: availability?.dates ?? [],
        available_times: availability?.times ?? [],
      };
    });

    if (searchTerms.length > 0) {
      filtered = filtered.filter((item) => {
        const haystack = buildSearchHaystack(item);
        return searchTerms.every((term) => haystack.includes(term));
      });
    }

    filtered = filtered.filter((item) => matchesDateRange(item, startDate, endDate));

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
