import { expect, test } from '@playwright/test';

import {
  canUseLegacyCommunityFeedFallback,
  resolvePublicCommunityFeedState,
} from '../../app/community/queryParams';

test.describe('Community paused runtime contract', () => {
  test('forces public feed state to locally_content while community is paused', () => {
    const state = resolvePublicCommunityFeedState({
      hub: 'tokyo',
      category: 'qna',
      format: 'question',
      q: 'tokyo, brunch',
      sort: 'popular',
    });

    expect(state.hub).toBe('tokyo');
    expect(state.category).toBe('locally_content');
    expect(state.format).toBe('locally_pick');
    expect(state.queryText).toBe('tokyo  brunch');
    expect(state.sort).toBe('popular');
  });

  test('fails closed instead of widening scoped legacy fallback queries', () => {
    expect(canUseLegacyCommunityFeedFallback('all')).toBe(true);
    expect(canUseLegacyCommunityFeedFallback('tokyo')).toBe(false);
    expect(canUseLegacyCommunityFeedFallback('seoul')).toBe(false);
  });
});
