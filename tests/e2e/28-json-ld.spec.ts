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

const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdCommunityPostIds: string[] = [];

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
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

async function waitForProfile(userId: string) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Profile was not created for auth user ${userId}.`);
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.jsonld.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `JSON-LD ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
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

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: user.fullName,
      phone: user.phone,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  return { id: data.user.id, ...user };
}

async function createCommunityAuthor() {
  return createAuthUser(createUser('author'));
}

async function createVisibleHostUser() {
  const host = await createAuthUser(createUser('host'));

  const { data, error } = await getAdminClient()
    .from('host_applications')
    .insert({
      user_id: host.id,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: host.fullName,
      phone: host.phone,
      dob: '1991-03-14',
      email: host.email,
      instagram: '@codex_jsonld_host',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: 'JSON-LD 회귀 테스트용 공개 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: host.fullName,
      motivation: 'JSON-LD 회귀 테스트',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create visible JSON-LD host application.');
  }

  createdApplicationIds.push(String(data.id));
  return host.id;
}

async function createActiveExperienceFixture(hostId: string) {
  const supabase = getAdminClient();
  const title = `[Playwright] JSON-LD Experience ${Date.now()}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: 'JSON-LD 검증용 활성 체험입니다.',
      itinerary: [{ title: 'JSON-LD 코스', description: '구조화 데이터 검증용 일정입니다.' }],
      spots: 'SEO TEST SPOT',
      meeting_point: 'SEO TEST STATION',
      location: 'Seoul SEO Test Location',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 55000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'active',
      is_active: true,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create JSON-LD experience fixture.');
  }

  createdExperienceIds.push(data.id);

  return { id: Number(data.id), title };
}

async function createCommunityPostFixture(authorId: string) {
  const supabase = getAdminClient();
  const title = `[Playwright] JSON-LD Community Post ${Date.now()}`;
  const basePayload = {
    user_id: authorId,
    category: 'qna',
    title,
    content: 'JSON-LD 검증용 커뮤니티 게시글입니다. 구조화 데이터가 Article로 내려오는지 확인합니다.',
    images: ['https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200'],
    companion_date: null,
    companion_city: null,
    linked_exp_id: null,
  };

  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      ...basePayload,
      board_country: 'japan',
      destination_hub: null,
      post_format: 'question',
      source_locale: 'ko',
    })
    .select('id')
    .single();

  if (!error && data?.id) {
    createdCommunityPostIds.push(data.id);
    return { id: data.id, title };
  }

  const fallback = await supabase
    .from('community_posts')
    .insert({
      ...basePayload,
      destination_hub: 'tokyo',
    })
    .select('id')
    .single();

  if (fallback.error || !fallback.data?.id) {
    throw fallback.error || error || new Error('Failed to create JSON-LD community post fixture.');
  }

  createdCommunityPostIds.push(fallback.data.id);
  return { id: fallback.data.id, title };
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdCommunityPostIds.length > 0) {
    await supabase.from('community_posts').delete().in('id', createdCommunityPostIds);
  }

  if (createdExperienceIds.length > 0) {
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds.reverse()) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe('JSON-LD smoke', () => {
  test('serves structured data for home, active experience, and community article pages', async ({ page }) => {
    const author = await createCommunityAuthor();
    const hostId = await createVisibleHostUser();
    const experience = await createActiveExperienceFixture(hostId);
    const communityPost = await createCommunityPostFixture(author.id);

    await page.goto('/', { waitUntil: 'networkidle' });

    const homeJsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(homeJsonLd.some((content) => content.includes('"@type":"Organization"'))).toBeTruthy();
    expect(homeJsonLd.some((content) => content.includes('"@type":"WebSite"'))).toBeTruthy();
    expect(homeJsonLd.some((content) => content.includes('instagram.com/locally.official'))).toBeTruthy();
    expect(homeJsonLd.some((content) => content.includes('blog.naver.com/locally-travel'))).toBeTruthy();

    await page.goto(`/experiences/${experience.id}`, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(`${experience.title} | Locally`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/experiences/${experience.id}$`)
    );

    const experienceJsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(experienceJsonLd.some((content) => content.includes('"@type":"Product"'))).toBeTruthy();
    expect(experienceJsonLd.some((content) => content.includes(`"sku":"experience-${experience.id}"`))).toBeTruthy();
    expect(experienceJsonLd.some((content) => content.includes('"additionalType":"https://schema.org/TouristTrip"'))).toBeTruthy();
    expect(experienceJsonLd.some((content) => content.includes('"audienceType":"Travelers"'))).toBeTruthy();

    await page.goto(`/en/experiences/${experience.id}`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/experiences/${experience.id}$`)
    );

    await page.goto(`/community/${communityPost.id}?board=japan`, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(`${communityPost.title} | Locally`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/community/${communityPost.id}$`)
    );

    const articleJsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(articleJsonLd.some((content) => content.includes('"@type":"Article"'))).toBeTruthy();
    expect(articleJsonLd.some((content) => content.includes(communityPost.title))).toBeTruthy();
    expect(articleJsonLd.some((content) => content.includes('"@type":"BreadcrumbList"'))).toBeTruthy();
    expect(articleJsonLd.some((content) => content.includes('"name":"커뮤니티"'))).toBeTruthy();

    await page.goto(`/ja/community/${communityPost.id}?board=japan`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/community/${communityPost.id}$`)
    );

    const localizedArticleJsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(
      localizedArticleJsonLd.some((content) => content.includes(`/community/${communityPost.id}`))
    ).toBeTruthy();
  });
});
