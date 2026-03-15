import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

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
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.community.detail.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Community Detail ${prefix} ${timestamp}`,
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
      title: `[Playwright] Community Detail ${Date.now()}`,
      content: '좋아요/댓글 카운트 정합성 검증용 게시글입니다.',
      images: [],
      linked_exp_id: null,
    })
    .select('id, like_count, comment_count')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create community post fixture.');
  }

  createdPostIds.push(data.id);
  return data.id;
}

async function seedLike(postId: string, userId: string) {
  const supabase = getAdminClient();
  const { error } = await supabase.from('community_likes').insert({
    post_id: postId,
    user_id: userId,
  });

  if (error) throw error;

  const { data: post } = await supabase
    .from('community_posts')
    .select('like_count')
    .eq('id', postId)
    .maybeSingle();

  if (!post || post.like_count !== 1) {
    const { error: repairError } = await supabase
      .from('community_posts')
      .update({ like_count: 1 })
      .eq('id', postId);

    if (repairError) throw repairError;
  }
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
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

test.describe.serial('Community detail state consistency', () => {
  test('keeps like state/count aligned and updates comment counts immediately', async ({ page }) => {
    test.setTimeout(90000);

    const author = createUser('author');
    const viewer = createUser('viewer');
    const authorId = await createAuthUser(author);
    const viewerId = await createAuthUser(viewer);
    const postId = await createCommunityPost(authorId);
    const commentMessage = `Playwright comment ${Date.now()}`;

    await seedLike(postId, viewerId);
    await login(page, viewer);
    await page.goto(`/community/${postId}`, { waitUntil: 'networkidle' });

    const likeButton = page.locator('button').filter({
      has: page.locator('svg.lucide-heart'),
    }).first();

    await expect(likeButton).toContainText('1');
    const likeResponsePromise = page.waitForResponse((response) => {
      return response.url().includes('/api/community/likes') && response.request().method() === 'POST';
    });
    await likeButton.click();
    const likeResponse = await likeResponsePromise;
    expect(likeResponse.status()).toBe(200);
    await expect(likeResponse.json()).resolves.toMatchObject({ liked: false, likeCount: 0 });
    await expect(likeButton).toContainText('0');

    const supabase = getAdminClient();
    const { data: remainingLike } = await supabase
      .from('community_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', viewerId)
      .maybeSingle();

    expect(remainingLike).toBeNull();

    await expect(page.getByTestId('community-comment-summary-count')).toHaveText('댓글 0');
    await expect(page.getByTestId('community-comment-heading-count')).toHaveText('댓글 0');

    await page.locator('textarea').fill(commentMessage);
    await page.locator('button').filter({
      has: page.locator('svg.lucide-send'),
    }).click();

    await expect(page.getByTestId('community-comment-summary-count')).toHaveText('댓글 1');
    await expect(page.getByTestId('community-comment-heading-count')).toHaveText('댓글 1');

    const { data: insertedComment } = await supabase
      .from('community_comments')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', viewerId)
      .eq('content', commentMessage)
      .maybeSingle();

    expect(insertedComment?.id).toBeTruthy();
  });
});
