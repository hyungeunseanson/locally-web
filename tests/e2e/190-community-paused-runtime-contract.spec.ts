import { expect, test } from '@playwright/test';

import {
  buildCommunityBoardDetailHref,
  buildCommunityBoardListHref,
  resolvePublicCommunityBoardState,
} from '../../app/community/queryParams';

test.describe('Community board runtime contract', () => {
  test('normalizes board feed state with safe defaults', () => {
    const defaultState = resolvePublicCommunityBoardState({});
    expect(defaultState.board).toBe('japan');
    expect(defaultState.sort).toBe('latest');

    const koreaState = resolvePublicCommunityBoardState({
      board: 'korea',
      sort: 'popular',
    });
    expect(koreaState.board).toBe('korea');
    expect(koreaState.sort).toBe('popular');
  });

  test('builds stable board list/detail hrefs', () => {
    expect(buildCommunityBoardListHref({ board: 'japan', sort: 'latest' })).toBe('/community');
    expect(buildCommunityBoardListHref({ board: 'korea', sort: 'latest' })).toBe('/community?board=korea');
    expect(buildCommunityBoardListHref({ board: 'korea', sort: 'popular' })).toBe('/community?board=korea&sort=popular');

    expect(buildCommunityBoardDetailHref('post-1', { board: 'japan', sort: 'latest' })).toBe('/community/post-1');
    expect(buildCommunityBoardDetailHref('post-1', { board: 'korea', sort: 'popular' })).toBe('/community/post-1?board=korea&sort=popular');
  });
});
