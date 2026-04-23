import {
  COMMUNITY_OPEN,
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
import type { CommunitySort } from './queryParams';

export type PublicCommunityFeedState = {
  hub: CommunityHubFilter;
  requestedCategory: CommunityCategory | 'all';
  category: CommunityCategory | 'all';
  format: CommunityPostFormatFilter;
  queryText: string;
  sort: CommunitySort;
};

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

export function resolvePublicCommunityFeedState(input: {
  hub?: string | null | undefined;
  format?: string | null | undefined;
  category?: string | null | undefined;
  q?: string | null | undefined;
  sort?: string | null | undefined;
}): PublicCommunityFeedState {
  const hub = resolveCommunityHub(input.hub);
  const requestedCategory = resolveCommunityCategory(input.category);
  let format = resolveCommunityFormat(input.format, requestedCategory);

  if (!COMMUNITY_OPEN && format !== 'locally_pick') {
    format = 'locally_pick';
  }

  const category = !COMMUNITY_OPEN
    ? 'locally_content'
    : format === 'all'
      ? requestedCategory
      : getCommunityCategoryFromFormat(format);

  return {
    hub,
    requestedCategory,
    category,
    format,
    queryText: (input.q || '').trim().replace(/,/g, ' '),
    sort: input.sort === 'popular' ? 'popular' : 'latest',
  };
}

export function canUseLegacyCommunityFeedFallback(hub: CommunityHubFilter): boolean {
  return hub === 'all';
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
  const normalizedCategory = input.category ? resolveCommunityCategory(input.category) : 'all';
  let format = input.format ?? (normalizedCategory !== 'all' ? getCommunityFormatFromCategory(normalizedCategory) : 'all');
  const query = input.q?.trim() ?? '';
  const sort = input.sort ?? 'latest';

  if (format !== 'all' && normalizedCategory !== 'all') {
    const categoryFromFormat = getCommunityCategoryFromFormat(format);
    if (categoryFromFormat !== normalizedCategory) {
      format = getCommunityFormatFromCategory(normalizedCategory);
    }
  }

  if (hub !== 'all') params.set('hub', hub);
  if (format !== 'all') {
    params.set('format', format);
    params.set('category', getCommunityCategoryFromFormat(format));
  } else if (normalizedCategory !== 'all') {
    params.set('category', normalizedCategory);
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
