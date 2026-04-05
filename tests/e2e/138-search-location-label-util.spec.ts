import { expect, test } from '@playwright/test';

import {
  getLocalizedSearchLocationLabel,
  getSearchableCityAliases,
  matchSearchPreset,
} from '@/app/utils/searchLocationCatalog';

const translationDictionary = {
  ko: {
    search_place_tokyo: '도쿄',
    search_place_osaka: '오사카',
    search_place_izakaya: '이자카야',
    search_place_seoul: '서울',
  },
  en: {
    search_place_tokyo: 'Tokyo',
    search_place_osaka: 'Osaka',
    search_place_izakaya: 'Izakaya',
    search_place_seoul: 'Seoul',
  },
  ja: {
    search_place_tokyo: '東京',
    search_place_osaka: '大阪',
    search_place_izakaya: '居酒屋',
    search_place_seoul: 'ソウル',
  },
  zh: {
    search_place_tokyo: '东京',
    search_place_osaka: '大阪',
    search_place_izakaya: '居酒屋',
    search_place_seoul: '首尔',
  },
} as const;

function createTranslator(locale: keyof typeof translationDictionary) {
  return (key: string) => translationDictionary[locale][key as keyof (typeof translationDictionary)[typeof locale]] || key;
}

test.describe('Search location catalog', () => {
  test('matches preset aliases conservatively', () => {
    expect(matchSearchPreset('Tokyo', 'en', createTranslator('en'))?.id).toBe('tokyo');
    expect(matchSearchPreset('Seoul', 'ja', createTranslator('ja'))?.id).toBe('seoul');
    expect(matchSearchPreset('居酒屋', 'zh', createTranslator('zh'))?.id).toBe('izakaya');
    expect(matchSearchPreset('Tokyo Tower', 'en', createTranslator('en'))).toBeNull();
  });

  test('localizes city and keyword labels across locales', () => {
    expect(getLocalizedSearchLocationLabel('후쿠오카', 'ja', createTranslator('ja'))).toBe('福岡');
    expect(getLocalizedSearchLocationLabel('Tokyo', 'zh', createTranslator('zh'))).toBe('东京');
    expect(getLocalizedSearchLocationLabel('이자카야', 'en', createTranslator('en'))).toBe('Izakaya');
    expect(getSearchableCityAliases('도쿄')).toEqual(expect.arrayContaining(['도쿄', 'Tokyo', '東京', '东京']));
  });
});
