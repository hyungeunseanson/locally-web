import {
  getCommunityCategoryFromFormat,
  getCommunityFormatFromCategory,
} from './categoryMeta';
import type {
  CommunityCategory,
  CommunityHub,
  CommunityHubFilter,
  CommunityPostFormat,
  CommunityPostFormatFilter,
} from '@/app/types/community';

export type CommunitySort = 'latest' | 'popular';

const HUB_SET = new Set<CommunityHub>(['tokyo', 'osaka_kyoto', 'fukuoka', 'jp_other', 'seoul', 'busan', 'jeju']);
const FORMAT_SET = new Set<CommunityPostFormat>(['question', 'companion', 'live_tip', 'locally_pick']);
const CATEGORY_SET = new Set<CommunityCategory>(['qna', 'companion', 'info', 'locally_content']);

export function resolveCommunityHub(value: string | null | undefined): CommunityHubFilter {
  if (!value) return 'all';
  return HUB_SET.has(value as CommunityHub) ? (value as CommunityHub) : 'all';
}

export function resolveCommunityCategory(value: string | null | undefined): CommunityCategory | 'all' {
  if (!value) return 'all';
  if (value === 'all') return 'all';
  return CATEGORY_SET.has(value as CommunityCategory) ? (value as CommunityCategory) : 'all';
}

export function resolveCommunityFormat(
  formatValue: string | null | undefined,
  categoryValue?: string | null | undefined
): CommunityPostFormatFilter {
  if (formatValue === 'all') return 'all';
  if (formatValue && FORMAT_SET.has(formatValue as CommunityPostFormat)) {
    return formatValue as CommunityPostFormat;
  }

  const category = resolveCommunityCategory(categoryValue);
  if (category !== 'all') {
    return getCommunityFormatFromCategory(category);
  }

  return 'all';
}

export function resolveCommunitySort(value: string | null | undefined): CommunitySort {
  return value === 'popular' ? 'popular' : 'latest';
}

export function buildCommunitySearchParams(input: {
  hub?: CommunityHubFilter;
  format?: CommunityPostFormatFilter;
  category?: CommunityCategory | 'all';
  q?: string;
  sort?: CommunitySort;
}) {
  const params = new URLSearchParams();
  const hub = input.hub ?? 'all';
  const format = input.format ?? (input.category ? resolveCommunityFormat(null, input.category) : 'all');
  const query = input.q?.trim() ?? '';
  const sort = input.sort ?? 'latest';

  if (hub !== 'all') params.set('hub', hub);
  if (format !== 'all') {
    params.set('format', format);
    params.set('category', getCommunityCategoryFromFormat(format));
  } else if (input.category && input.category !== 'all') {
    params.set('category', input.category);
  }
  if (query) params.set('q', query);
  if (sort !== 'latest') params.set('sort', sort);

  return params;
}

export function buildCommunityListHref(input: {
  hub?: CommunityHubFilter;
  format?: CommunityPostFormatFilter;
  category?: CommunityCategory | 'all';
  q?: string;
  sort?: CommunitySort;
}) {
  const params = buildCommunitySearchParams(input);
  const queryString = params.toString();
  return queryString ? `/community?${queryString}` : '/community';
}

export function buildCommunityDetailHref(
  postId: string,
  input: {
    hub?: CommunityHubFilter;
    format?: CommunityPostFormatFilter;
    category?: CommunityCategory | 'all';
    q?: string;
    sort?: CommunitySort;
  }
) {
  const params = buildCommunitySearchParams(input);
  const queryString = params.toString();
  return queryString ? `/community/${postId}?${queryString}` : `/community/${postId}`;
}
