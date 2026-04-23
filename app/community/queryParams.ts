import {
  COMMUNITY_OPEN,
  getCommunityCategoryFromFormat,
  getCommunityFormatFromCategory,
} from './categoryMeta';
import { resolveCommunityBoard } from './boardMeta';
import type {
  CommunityBoard,
  CommunityCategory,
  CommunityHub,
  CommunityHubFilter,
  CommunityPostFormat,
  CommunityPostFormatFilter,
} from '@/app/types/community';

export type CommunitySort = 'latest' | 'popular';
export type PublicCommunityBoardState = {
  board: CommunityBoard;
  sort: CommunitySort;
};
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

export function resolveCommunitySort(value: string | null | undefined): CommunitySort {
  return value === 'popular' ? 'popular' : 'latest';
}

export function resolvePublicCommunityBoardState(input: {
  board?: string | null | undefined;
  sort?: string | null | undefined;
}): PublicCommunityBoardState {
  return {
    board: resolveCommunityBoard(input.board),
    sort: resolveCommunitySort(input.sort),
  };
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
    sort: resolveCommunitySort(input.sort),
  };
}

export function canUseLegacyCommunityFeedFallback(hub: CommunityHubFilter): boolean {
  return hub === 'all';
}

export function buildCommunityBoardSearchParams(input: {
  board?: CommunityBoard;
  sort?: CommunitySort;
}) {
  const params = new URLSearchParams();
  const board = resolveCommunityBoard(input.board);
  const sort = input.sort ?? 'latest';

  if (board !== 'japan') params.set('board', board);
  if (sort !== 'latest') params.set('sort', sort);

  return params;
}

export function buildCommunityBoardListHref(input: {
  board?: CommunityBoard;
  sort?: CommunitySort;
}) {
  const params = buildCommunityBoardSearchParams(input);
  const queryString = params.toString();
  return queryString ? `/community?${queryString}` : '/community';
}

export function buildCommunityBoardDetailHref(
  postId: string,
  input: {
    board?: CommunityBoard;
    sort?: CommunitySort;
  }
) {
  const params = buildCommunityBoardSearchParams(input);
  const queryString = params.toString();
  return queryString ? `/community/${postId}?${queryString}` : `/community/${postId}`;
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

  // category와 format이 어긋난 legacy/stale 링크는 category truth 기준으로 fail-closed 한다.
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
