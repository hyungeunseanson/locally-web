import { resolveCommunityBoard } from './boardMeta';
import type { CommunityBoard } from '@/app/types/community';

export type CommunitySort = 'latest' | 'popular';
export type PublicCommunityBoardState = {
  board: CommunityBoard;
  sort: CommunitySort;
};

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
