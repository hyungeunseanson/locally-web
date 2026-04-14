import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

type SearchRouteFixture = {
  id: number;
  title: string;
  titleEn: string;
  titleJa: string;
  categoryJa: string;
};

const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdApplicationIds: number[] = [];
const createdExperienceIds: number[] = [];

function loadEnv(): EnvMap {
  return readFileSync('.env.local', 'utf8')
    .split(/\n/)
    .reduce<EnvMap>((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
}

function getAdminClient() {
  if (adminClient) return adminClient;

  const env = loadEnv();
  adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.search.route.contract.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Search Route Contract ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

async function waitForProfile(userId: string) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (data?.id) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Profile was not created for auth user ${userId}.`);
}

async function createAuthUser(user: TestUser) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      phone: user.phone,
    },
  });

  if (error || !data.user?.id) {
    throw error || new Error(`Failed to create auth user for ${user.email}`);
  }

  createdAuthUserIds.push(data.user.id);
  await waitForProfile(data.user.id);
  return data.user.id;
}

async function createApprovedHostApplication(userId: string, user: TestUser) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어', 'English', '日本語'],
      language_levels: [
        { language: '한국어', level: 5 },
        { language: 'English', level: 4 },
        { language: '日本語', level: 4 },
      ],
      name: user.fullName,
      phone: user.phone,
      dob: '1992-04-12',
      email: user.email,
      instagram: '@codex_search_route_contract',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '검색 route contract 회귀 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '검색 route contract 회귀 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(Number(data.id));
}

async function createLocalizedExperience(hostId: string): Promise<SearchRouteFixture> {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const title = `[Playwright] 도쿄 야시장 투어 ${timestamp}`;
  const titleEn = `Tokyo Night Market Tour ${timestamp}`;
  const titleJa = `東京ナイトマーケットツアー ${timestamp}`;
  const categoryJa = `グルメツアー ${timestamp}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: 'Japan',
      city: '도쿄',
      title,
      title_ko: title,
      title_en: titleEn,
      title_ja: titleJa,
      title_zh: `东京夜市之旅 ${timestamp}`,
      category: '맛집 탐방',
      category_en: `Food Tour ${timestamp}`,
      category_ja: categoryJa,
      category_zh: `美食之旅 ${timestamp}`,
      languages: ['한국어', 'English', '日本語'],
      language_levels: [
        { language: '한국어', level: 5 },
        { language: 'English', level: 4 },
        { language: '日本語', level: 4 },
      ],
      duration: 3,
      max_guests: 6,
      description: '검색 route contract 회귀 검증용 체험입니다.',
      description_ko: '검색 route contract 회귀 검증용 체험입니다.',
      description_en: `Tokyo night market walk ${timestamp}`,
      description_ja: `東京の夜市を歩く体験 ${timestamp}`,
      description_zh: `东京夜市漫步体验 ${timestamp}`,
      itinerary: [{ title: 'Shibuya Scramble', description: '테스트 코스입니다.' }],
      spots: 'Shibuya Scramble',
      meeting_point: 'Shibuya Scramble',
      meeting_point_i18n: {
        ko: '시부야 스크램블',
        en: 'Shibuya Scramble',
        ja: '渋谷スクランブル',
        zh: '涩谷十字路口',
      },
      location: 'Shibuya Scramble',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 89000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: { age_limit: '만 19세 이상', activity_level: '보통' },
      status: 'active',
      is_active: true,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko', 'en', 'ja', 'zh'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id, title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create localized search experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));

  return {
    id: Number(data.id),
    title: String(data.title),
    titleEn,
    titleJa,
    categoryJa,
  };
}

function expectPublicSearchShape(rows: Array<Record<string, unknown>>, expectedId: number) {
  expect(rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: expectedId,
      }),
    ])
  );

  const matched = rows.find((row) => Number(row.id) === expectedId);
  expect(matched).toBeTruthy();
  expect(matched).not.toHaveProperty('host_id');
  expect(matched).not.toHaveProperty('tags');
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdExperienceIds.length > 0) {
    await supabase.from('experience_availability').delete().in('experience_id', createdExperienceIds);
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Search route contract', () => {
  test('keeps alias and localized searches public while stripping internal fields', async ({ request }) => {
    const host = createUser('visible-host');
    const hostId = await createAuthUser(host);
    await createApprovedHostApplication(hostId, host);
    const experience = await createLocalizedExperience(hostId);

    const aliasResponse = await request.get(
      `/api/search/experiences?location=${encodeURIComponent('Tokyo')}&language=all`
    );
    expect(aliasResponse.ok()).toBeTruthy();
    const aliasPayload = await aliasResponse.json();
    expectPublicSearchShape(aliasPayload.data, experience.id);

    const localizedTitleResponse = await request.get(
      `/api/search/experiences?location=${encodeURIComponent(experience.titleJa)}&language=all`
    );
    expect(localizedTitleResponse.ok()).toBeTruthy();
    const localizedTitlePayload = await localizedTitleResponse.json();
    expectPublicSearchShape(localizedTitlePayload.data, experience.id);

    const localizedCategoryResponse = await request.get(
      `/api/search/experiences?location=${encodeURIComponent(experience.categoryJa)}&language=all`
    );
    expect(localizedCategoryResponse.ok()).toBeTruthy();
    const localizedCategoryPayload = await localizedCategoryResponse.json();
    expectPublicSearchShape(localizedCategoryPayload.data, experience.id);
  });
});
