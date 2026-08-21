import { expect, test } from '@playwright/test';

import {
  TranslationProviderError,
  translateWithGrok,
  type TranslationRequest,
} from '@/app/utils/experienceTranslation/providers';

const translationRequest: TranslationRequest = {
  sourceLocale: 'ja',
  targetLocale: 'en',
  title: '東京ナイトマーケット散策',
  description: '地元ガイドと東京の夜を歩きます。',
  category: 'food',
  meetingPoint: '渋谷駅ハチ公前',
  supplies: '歩きやすい靴',
  inclusions: ['ドリンク', '試食'],
  exclusions: ['交通費'],
  itinerary: [
    {
      title: '渋谷集合',
      description: 'ガイドと参加者にご挨拶します。',
      type: 'spot',
      image_url: 'https://example.com/shibuya.jpg',
    },
    {
      title: '夜市場散策',
      description: 'おすすめの屋台を巡ります。',
      type: 'spot',
      image_url: '',
    },
  ],
  rules: {
    age_limit: '18歳以上',
    activity_level: '軽い散歩',
    refund_policy: '返金不可',
    host_notice: '雨天決行です。',
  },
  model: 'grok-test',
};

function completeProviderResponse() {
  return {
    title: 'Tokyo Night Market Walk',
    description: 'Explore Tokyo after dark with a local guide.',
    // Proper nouns can correctly remain identical to the source text.
    meeting_point: '渋谷駅ハチ公前',
    supplies: 'Comfortable walking shoes',
    inclusions: ['One drink', 'Food tasting'],
    exclusions: ['Transportation costs'],
    itinerary: [
      {
        title: 'Meet in Shibuya',
        description: 'Meet the guide and fellow guests.',
      },
      {
        title: 'Explore the night market',
        description: 'Visit recommended food stalls.',
      },
    ],
    rules: {
      age_limit: 'Ages 18 and over',
      activity_level: 'Light walking',
      refund_policy: 'Non-refundable',
      host_notice: 'The experience runs in light rain.',
    },
  };
}

async function translateGrokResponse(
  payload: Record<string, unknown>,
  request: TranslationRequest = translationRequest
) {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.XAI_API_KEY;
  process.env.XAI_API_KEY = 'test-xai-key';
  global.fetch = (async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(payload) } }],
    usage: { total_tokens: 37 },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;

  try {
    return await translateWithGrok(request);
  } finally {
    global.fetch = originalFetch;

    if (originalApiKey === undefined) {
      delete process.env.XAI_API_KEY;
    } else {
      process.env.XAI_API_KEY = originalApiKey;
    }
  }
}

async function expectIncompleteTranslation(
  payload: Record<string, unknown>,
  expectedFields: string[],
  request?: TranslationRequest
) {
  try {
    await translateGrokResponse(payload, request);
    throw new Error('Expected the incomplete provider response to be rejected');
  } catch (error) {
    expect(error).toBeInstanceOf(TranslationProviderError);

    const providerError = error as TranslationProviderError;
    expect(providerError.provider).toBe('grok');
    expect(providerError.retryable).toBe(true);

    for (const field of expectedFields) {
      expect(providerError.message).toContain(field);
    }
  }
}

test.describe('Experience translation provider completeness', () => {
  test('accepts a complete response and preserves an explicitly returned source-identical proper noun', async () => {
    const translation = await translateGrokResponse(completeProviderResponse());

    expect(translation).toEqual({
      title: 'Tokyo Night Market Walk',
      description: 'Explore Tokyo after dark with a local guide.',
      meetingPoint: '渋谷駅ハチ公前',
      supplies: 'Comfortable walking shoes',
      inclusions: ['One drink', 'Food tasting'],
      exclusions: ['Transportation costs'],
      itinerary: [
        {
          title: 'Meet in Shibuya',
          description: 'Meet the guide and fellow guests.',
          type: 'spot',
          image_url: 'https://example.com/shibuya.jpg',
        },
        {
          title: 'Explore the night market',
          description: 'Visit recommended food stalls.',
          type: 'spot',
          image_url: '',
        },
      ],
      rules: {
        age_limit: 'Ages 18 and over',
        activity_level: 'Light walking',
        refund_policy: 'Non-refundable',
        host_notice: 'The experience runs in light rain.',
      },
      totalTokens: 37,
    });
  });

  test('rejects missing title, description, and populated text fields instead of falling back to source content', async () => {
    const payload = completeProviderResponse();
    payload.title = '';
    payload.description = '';
    payload.meeting_point = '';
    payload.supplies = '';

    await expectIncompleteTranslation(payload, [
      'title',
      'description',
      'meeting_point',
      'supplies',
    ]);
  });

  test('rejects list omissions, list length changes, and blank list items', async () => {
    const payload = completeProviderResponse();
    payload.inclusions = ['One drink', ''];
    payload.exclusions = [];

    await expectIncompleteTranslation(payload, ['inclusions[1]', 'exclusions']);
  });

  test('rejects itinerary omissions and required itinerary item fields', async () => {
    const payload = completeProviderResponse();
    payload.itinerary = [
      {
        title: 'Meet in Shibuya',
        description: '',
      },
    ];

    await expectIncompleteTranslation(payload, [
      'itinerary',
      'itinerary[0].description',
      'itinerary[1].title',
      'itinerary[1].description',
    ]);
  });

  test('rejects every populated rules field that the provider omits', async () => {
    const payload = completeProviderResponse();
    payload.rules = {
      age_limit: 'Ages 18 and over',
      activity_level: 'Light walking',
      refund_policy: '',
      host_notice: '',
    };

    await expectIncompleteTranslation(payload, ['rules.refund_policy', 'rules.host_notice']);
  });

  test('allows omitted target values when the corresponding source content is empty', async () => {
    const request: TranslationRequest = {
      ...translationRequest,
      supplies: '',
      inclusions: [],
      exclusions: [],
      itinerary: [],
      rules: {
        age_limit: '',
        activity_level: '',
        refund_policy: '',
        host_notice: '',
      },
    };
    const payload: Record<string, unknown> = completeProviderResponse();
    delete payload.supplies;
    delete payload.inclusions;
    delete payload.exclusions;
    delete payload.itinerary;
    delete payload.rules;

    await expect(translateGrokResponse(payload, request)).resolves.toMatchObject({
      supplies: '',
      inclusions: [],
      exclusions: [],
      itinerary: [],
      rules: request.rules,
    });
  });
});
