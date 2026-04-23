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
const createdHostApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdPostIds: string[] = [];

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
    email: `codex.community.feed.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Community Feed ${prefix} ${timestamp}`,
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

async function createHostApplication(userId: string, user: TestUser, status: 'approved' | 'revision' = 'approved') {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: 'Korea',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1990.01.01',
      email: user.email,
      instagram: `@${user.fullName.replace(/\s+/g, '').toLowerCase()}`,
      source: 'E2E community feed visibility test',
      language_cert: 'TOPIK 6',
      profile_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=512',
      self_intro: '커뮤니티 연동 체험 공개 노출 테스트용 호스트 지원서입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '커뮤니티 연동 체험 공개 노출 정책 검증용입니다.',
      status,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create community feed host application fixture.');
  }

  createdHostApplicationIds.push(data.id);
  return data.id;
}

async function createExperienceFixture(hostId: string, status: 'active' | 'revision' = 'active') {
  const supabase = getAdminClient();
  const title = `[Playwright] Community Feed Linked ${Date.now()}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '커뮤니티 피드 계약 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '테스트 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: 'Hongdae Entrance Exit 3',
      meeting_point_i18n: { ko: '홍대입구역 3번 출구' },
      location: 'Hongdae Entrance Exit 3',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 30000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: { age_limit: '만 19세 이상', activity_level: '보통' },
      status,
      is_active: true,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id,title,image_url,price')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create community feed experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return data;
}

async function createBoardPost(
  authorId: string,
  board: 'japan' | 'korea',
  linkedExpId: number | null,
  title: string
) {
  const supabase = getAdminClient();
  const basePayload = {
    user_id: authorId,
    category: 'qna',
    post_format: 'question',
    title,
    content: `${title} 내용입니다.`,
    images: [],
    linked_exp_id: linkedExpId,
    source_locale: 'ko',
  };

  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      ...basePayload,
      board_country: board,
      destination_hub: null,
    })
    .select('id,title')
    .single();

  if (!error && data?.id) {
    createdPostIds.push(data.id);
    return data;
  }

  const fallback = await supabase
    .from('community_posts')
    .insert({
      ...basePayload,
      destination_hub: board === 'japan' ? 'tokyo' : 'seoul',
    })
    .select('id,title')
    .single();

  if (fallback.error || !fallback.data?.id) {
    throw fallback.error || error || new Error('Failed to create board community post fixture.');
  }

  createdPostIds.push(fallback.data.id);
  return fallback.data;
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdPostIds.length > 0) {
    await supabase.from('community_posts').delete().in('id', createdPostIds);
  }

  if (createdExperienceIds.length > 0) {
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  if (createdHostApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdHostApplicationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Community board feed response contract', () => {
  test('returns mapped profile and linked experience data for board feed cards', async ({ request }) => {
    const author = createUser('author');
    const authorId = await createAuthUser(author);
    await createHostApplication(authorId, author, 'approved');
    const experience = await createExperienceFixture(authorId);
    const post = await createBoardPost(
      authorId,
      'japan',
      Number(experience.id),
      `[Playwright] Community Board Feed ${Date.now()}`
    );

    const response = await request.get('/api/community');
    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    const matchedPost = Array.isArray(payload.data)
      ? payload.data.find((entry: { id?: string }) => entry.id === post.id)
      : null;

    expect(matchedPost).toMatchObject({
      id: post.id,
      title: post.title,
      linked_experience: {
        id: experience.id,
        title: experience.title,
        price: experience.price,
      },
    });
    expect(matchedPost).toHaveProperty('profiles');
  });

  test('hides linked experience data when the latest host application is not public', async ({ request }) => {
    const author = createUser('hidden-host');
    const authorId = await createAuthUser(author);
    await createHostApplication(authorId, author, 'revision');
    const experience = await createExperienceFixture(authorId);
    const post = await createBoardPost(
      authorId,
      'japan',
      Number(experience.id),
      `[Playwright] Community Hidden Host Linked ${Date.now()}`
    );

    const response = await request.get('/api/community');
    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    const matchedPost = Array.isArray(payload.data)
      ? payload.data.find((entry: { id?: string }) => entry.id === post.id)
      : null;

    expect(matchedPost).toBeTruthy();
    expect(matchedPost.linked_exp_id).toBe(Number(experience.id));
    expect(matchedPost.linked_experience).toBeNull();
  });

  test('hides linked experience data when the linked experience is revision', async ({ request }) => {
    const author = createUser('hidden-experience');
    const authorId = await createAuthUser(author);
    await createHostApplication(authorId, author, 'approved');
    const experience = await createExperienceFixture(authorId, 'revision');
    const post = await createBoardPost(
      authorId,
      'japan',
      Number(experience.id),
      `[Playwright] Community Hidden Experience Linked ${Date.now()}`
    );

    const response = await request.get('/api/community');
    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    const matchedPost = Array.isArray(payload.data)
      ? payload.data.find((entry: { id?: string }) => entry.id === post.id)
      : null;

    expect(matchedPost).toBeTruthy();
    expect(matchedPost.linked_exp_id).toBe(Number(experience.id));
    expect(matchedPost.linked_experience).toBeNull();
  });

  test('scopes board feeds so japan and korea posts do not mix', async ({ request }) => {
    const author = createUser('boards');
    const authorId = await createAuthUser(author);
    const token = `${Date.now()}`;
    const japanPost = await createBoardPost(authorId, 'japan', null, `[Playwright] Community Japan ${token}`);
    const koreaPost = await createBoardPost(authorId, 'korea', null, `[Playwright] Community Korea ${token}`);

    const japanResponse = await request.get('/api/community');
    expect(japanResponse.ok()).toBeTruthy();
    const japanPayload = await japanResponse.json();
    const japanReturnedIds = Array.isArray(japanPayload.data)
      ? japanPayload.data.map((entry: { id?: string }) => entry.id)
      : [];
    expect(japanReturnedIds).toContain(japanPost.id);
    expect(japanReturnedIds).not.toContain(koreaPost.id);

    const koreaResponse = await request.get('/api/community?board=korea');
    expect(koreaResponse.ok()).toBeTruthy();
    const koreaPayload = await koreaResponse.json();
    const koreaReturnedIds = Array.isArray(koreaPayload.data)
      ? koreaPayload.data.map((entry: { id?: string }) => entry.id)
      : [];
    expect(koreaReturnedIds).toContain(koreaPost.id);
    expect(koreaReturnedIds).not.toContain(japanPost.id);
  });

  test('keeps legacy public feed params working without affecting board feed responses', async ({ request }) => {
    const author = createUser('legacy');
    const authorId = await createAuthUser(author);
    const token = `${Date.now()}`;
    const japanPost = await createBoardPost(authorId, 'japan', null, `[Playwright] Legacy Feed Japan ${token}`);
    await createBoardPost(authorId, 'korea', null, `[Playwright] Legacy Feed Korea ${token}`);

    const legacyResponse = await request.get('/api/community?category=qna');
    expect(legacyResponse.ok()).toBeTruthy();
    const legacyPayload = await legacyResponse.json();
    expect(Array.isArray(legacyPayload.data)).toBeTruthy();
    expect(typeof legacyPayload.nextOffset === 'number' || legacyPayload.nextOffset === null).toBeTruthy();

    const boardResponse = await request.get('/api/community');
    expect(boardResponse.ok()).toBeTruthy();
    const boardPayload = await boardResponse.json();
    const boardReturnedIds = Array.isArray(boardPayload.data)
      ? boardPayload.data.map((entry: { id?: string }) => entry.id)
      : [];

    expect(boardReturnedIds).toContain(japanPost.id);
  });
});
