import './helpers/serverOnlyTestShim';

import { expect, test } from '@playwright/test';

import {
  buildExperienceTranslationUpdateFields,
  getQueuedTranslationLocales,
} from '@/app/api/host/experiences/shared';
import {
  buildExperienceTranslationState,
  buildSourceTranslationContent,
  didSourceTranslationContentChange,
  type ExperienceLocale,
  type ExperienceSourceTranslationContent,
} from '@/app/utils/experienceTranslation';

const bodyI18nColumns = [
  'meeting_point_i18n',
  'supplies_i18n',
  'inclusions_i18n',
  'exclusions_i18n',
  'itinerary_i18n',
  'rules_i18n',
];

const sourceContent = buildSourceTranslationContent({
  category: 'food_tour',
  meetingPoint: '서울역 1번 출구',
  supplies: '편한 신발',
  inclusions: ['현지 가이드', '시식'],
  exclusions: ['개인 경비'],
  itinerary: [
    {
      title: '서울역 집합',
      description: '가이드와 인사를 나눕니다.',
      type: 'meet',
      image_url: 'https://example.com/meeting.jpg',
    },
  ],
  rules: {
    age_limit: '만 12세 이상',
    activity_level: '보통',
    refund_policy: '체험 24시간 전까지 무료 취소',
    host_notice: '우천 시에도 진행합니다.',
  },
});

function cloneSourceContent(content: ExperienceSourceTranslationContent) {
  return {
    ...content,
    inclusions: [...content.inclusions],
    exclusions: [...content.exclusions],
    itinerary: content.itinerary.map((item) => ({ ...item })),
    rules: { ...content.rules },
  };
}

function buildTranslationState(params?: {
  sourceContent?: ExperienceSourceTranslationContent;
  queuedLocales?: ExperienceLocale[];
  japaneseTitle?: string;
  japaneseDescription?: string;
}) {
  return buildExperienceTranslationState({
    sourceLocale: 'ko',
    manualLocales: ['ko', 'ja'],
    manualContent: {
      ko: {
        title: '서울 야시장 산책',
        description: '현지 가이드와 함께 서울의 야시장을 둘러보는 체험입니다.',
      },
      ja: {
        title: params?.japaneseTitle ?? 'ソウル夜市場さんぽ',
        description: params?.japaneseDescription ?? '現地ガイドと一緒にソウルの夜市場を巡る体験です。',
      },
    },
    sourceContent: params?.sourceContent ?? sourceContent,
    translationVersion: 8,
    queuedLocales: params?.queuedLocales ?? ['en', 'zh'],
  });
}

test.describe('Experience translation update boundary', () => {
  test('preserves existing body locale maps for a manual-only title or description update', () => {
    const state = buildTranslationState({
      japaneseTitle: 'ソウル夜市場の特別さんぽ',
      japaneseDescription: '現地ガイドと一緒にソウルの夜市場をゆっくり巡る特別な体験です。',
    });

    expect(didSourceTranslationContentChange(sourceContent, cloneSourceContent(sourceContent))).toBe(false);
    expect(getQueuedTranslationLocales({
      sourceLocale: 'ko',
      manualLocales: ['ko', 'ja'],
      existingManualLocales: ['ko', 'ja'],
      sourceContentDirty: false,
    })).toEqual(['en', 'zh']);

    const fields = buildExperienceTranslationUpdateFields({
      sourceLocale: 'ko',
      translationVersion: 8,
      translationState: state,
      sourceContentDirty: false,
    });

    for (const column of bodyI18nColumns) {
      expect(fields).not.toHaveProperty(column);
    }

    expect(fields).toMatchObject({
      title_ja: 'ソウル夜市場の特別さんぽ',
      description_ja: '現地ガイドと一緒にソウルの夜市場をゆっくり巡る特別な体験です。',
      translation_meta: {
        ja: { mode: 'manual', status: 'ready', version: 8 },
        en: { mode: 'ai', status: 'queued', version: 8 },
        zh: { mode: 'ai', status: 'queued', version: 8 },
      },
    });
  });

  test('detects every source body leaf and keeps the reset and requeue path for real source changes', () => {
    const [itineraryItem] = sourceContent.itinerary;
    const changes: Array<[string, ExperienceSourceTranslationContent]> = [
      ['category', { ...sourceContent, category: 'walking_tour' }],
      ['meeting point', { ...sourceContent, meetingPoint: '서울역 2번 출구' }],
      ['supplies', { ...sourceContent, supplies: '물과 편한 신발' }],
      ['inclusions', { ...sourceContent, inclusions: ['현지 가이드', '시식', '음료'] }],
      ['exclusions', { ...sourceContent, exclusions: ['개인 경비', '교통비'] }],
      ['itinerary title', { ...sourceContent, itinerary: [{ ...itineraryItem, title: '서울역 출발' }] }],
      ['itinerary description', { ...sourceContent, itinerary: [{ ...itineraryItem, description: '출발 전에 안내를 듣습니다.' }] }],
      ['itinerary type', { ...sourceContent, itinerary: [{ ...itineraryItem, type: 'spot' }] }],
      ['itinerary image', { ...sourceContent, itinerary: [{ ...itineraryItem, image_url: 'https://example.com/updated.jpg' }] }],
      ['age limit', { ...sourceContent, rules: { ...sourceContent.rules, age_limit: '만 15세 이상' } }],
      ['activity level', { ...sourceContent, rules: { ...sourceContent.rules, activity_level: '가벼움' } }],
      ['refund policy', { ...sourceContent, rules: { ...sourceContent.rules, refund_policy: '체험 48시간 전까지 무료 취소' } }],
      ['host notice', { ...sourceContent, rules: { ...sourceContent.rules, host_notice: '날씨에 따라 일정이 달라질 수 있습니다.' } }],
    ];

    for (const [field, changedContent] of changes) {
      expect(didSourceTranslationContentChange(sourceContent, changedContent), field).toBe(true);
    }

    const changedContent = changes[1][1];
    const queuedLocales = getQueuedTranslationLocales({
      sourceLocale: 'ko',
      manualLocales: ['ko', 'ja'],
      existingManualLocales: ['ko', 'ja'],
      sourceContentDirty: true,
    });
    const state = buildTranslationState({
      sourceContent: changedContent,
      queuedLocales,
    });
    const fields = buildExperienceTranslationUpdateFields({
      sourceLocale: 'ko',
      translationVersion: 8,
      translationState: state,
      sourceContentDirty: true,
    });

    expect(queuedLocales).toEqual(['en', 'ja', 'zh']);
    expect(fields).toMatchObject({
      meeting_point_i18n: { ko: '서울역 2번 출구' },
      supplies_i18n: { ko: '편한 신발' },
      inclusions_i18n: { ko: ['현지 가이드', '시식'] },
      exclusions_i18n: { ko: ['개인 경비'] },
      itinerary_i18n: { ko: sourceContent.itinerary },
      rules_i18n: { ko: sourceContent.rules },
      translation_meta: {
        ja: { mode: 'manual', status: 'queued', version: 8 },
      },
    });
  });
});
