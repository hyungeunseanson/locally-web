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
const COMMUNITY_VIEW_COOKIE_PREFIX = 'community_viewed_';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
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
    email: `codex.community.views.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Community Views ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
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

async function createCommunityPost(authorId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      user_id: authorId,
      category: 'qna',
      title: `[Playwright] Community Views ${Date.now()}`,
      content: '조회수 집계 검증용 게시글입니다.',
      images: [],
      linked_exp_id: null,
      view_count: 0,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create community post fixture.');
  }

  createdPostIds.push(data.id);
  return data.id;
}

async function readViewCount(postId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('community_posts')
    .select('view_count')
    .eq('id', postId)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.view_count || 0);
}

function buildViewCookieName(postId: string) {
  return `${COMMUNITY_VIEW_COOKIE_PREFIX}${postId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdPostIds.length > 0) {
    await supabase.from('community_posts').delete().in('id', createdPostIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Community view count policy', () => {
  test('rejects invalid post ids and missing posts safely', async ({ request }) => {
    const invalidResponse = await request.post('/api/community/views', {
      data: {
        postId: 'not-a-uuid',
      },
    });
    expect(invalidResponse.status()).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      success: false,
      error: 'Invalid postId',
    });

    const missingResponse = await request.post('/api/community/views', {
      data: {
        postId: '11111111-1111-1111-1111-111111111111',
      },
    });
    expect(missingResponse.status()).toBe(404);
    await expect(missingResponse.json()).resolves.toMatchObject({
      success: false,
    });
  });

  test('counts the detail view once per browser within the cookie window', async ({ page }) => {
    test.setTimeout(90000);

    const author = createUser('author');
    const authorId = await createAuthUser(author);
    const postId = await createCommunityPost(authorId);

    await page.goto(`/community/${postId}`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('community-view-summary-count')).toHaveText('조회 1');
    expect(await readViewCount(postId)).toBe(1);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByTestId('community-view-summary-count')).toHaveText('조회 1');
    expect(await readViewCount(postId)).toBe(1);
  });

  test('short-circuits duplicate route calls when the view cookie already exists', async ({ request }) => {
    const author = createUser('route');
    const authorId = await createAuthUser(author);
    const postId = await createCommunityPost(authorId);

    const firstResponse = await request.post('/api/community/views', {
      data: {
        postId,
        knownViewCount: 0,
      },
    });

    expect(firstResponse.status()).toBe(200);
    await expect(firstResponse.json()).resolves.toMatchObject({
      success: true,
      counted: true,
      viewCount: 1,
    });
    expect(await readViewCount(postId)).toBe(1);

    const repeatResponse = await request.post('/api/community/views', {
      headers: {
        Cookie: `${buildViewCookieName(postId)}=1`,
      },
      data: {
        postId,
        knownViewCount: 1,
      },
    });

    expect(repeatResponse.status()).toBe(200);
    await expect(repeatResponse.json()).resolves.toMatchObject({
      success: true,
      counted: false,
      viewCount: 1,
    });
    expect(await readViewCount(postId)).toBe(1);
  });
});
