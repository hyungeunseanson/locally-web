import { expect, test } from '@playwright/test';

import {
  buildSearchHaystack,
  normalizeSearchInput,
  tokenizeSearchInput,
} from '@/app/search/searchText';

test.describe('Search text helpers', () => {
  test('builds a localized haystack with translated fields and city aliases', () => {
    const haystack = buildSearchHaystack({
      title: '도쿄 야시장 투어',
      title_en: 'Tokyo Night Market Tour',
      title_ja: '東京ナイトマーケットツアー',
      description_zh: '东京夜市漫步体验',
      category_ja: 'グルメツアー',
      city: '도쿄',
      country: 'Japan',
      meeting_point: 'Shibuya Scramble',
      tags: ['food', 'night'],
    });

    expect(haystack).toContain('tokyo night market tour');
    expect(haystack).toContain('グルメツアー');
    expect(haystack).toContain('东京夜市漫步体验');
    expect(haystack).toContain('도쿄');
    expect(haystack).toContain('tokyo');
    expect(haystack).toContain('東京');
    expect(haystack).toContain('东京');
    expect(haystack).toContain('food');
  });

  test('normalizes and tokenizes punctuation-heavy search input conservatively', () => {
    expect(normalizeSearchInput(`  Tokyo, "Night" · Tour  `)).toBe('tokyo night tour');
    expect(tokenizeSearchInput(`東京·ナイト, 투어`)).toEqual(['東京', 'ナイト', '투어']);
  });
});
