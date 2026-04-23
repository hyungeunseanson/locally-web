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

async function createCommunityPost(
  authorId: string,
  options?: {
    title?: string;
    createdAt?: string;
    updatedAt?: string;
    category?: 'qna' | 'locally_content';
    board?: 'japan' | 'korea';
  }
) {
  const supabase = getAdminClient();
  const basePayload = {
    user_id: authorId,
    category: options?.category || 'qna',
    post_format: options?.board ? 'question' : undefined,
    source_locale: 'ko',
    title: options?.title || `[Playwright] Community Detail ${Date.now()}`,
    content: '좋아요/댓글 카운트 정합성 검증용 게시글입니다.',
    images: [],
    linked_exp_id: null,
    created_at: options?.createdAt,
    updated_at: options?.updatedAt,
  };

  const attempt = await supabase
    .from('community_posts')
    .insert({
      ...basePayload,
      board_country: options?.board ?? null,
      destination_hub: options?.board ? null : null,
    })
    .select('id')
    .single();

  if (!attempt.error && attempt.data?.id) {
    createdPostIds.push(attempt.data.id);
    return attempt.data.id;
  }

  const fallback = await supabase
    .from('community_posts')
    .insert({
      ...basePayload,
      destination_hub: options?.board === 'japan' ? 'tokyo' : options?.board === 'korea' ? 'seoul' : null,
    })
    .select('id')
    .single();

  if (fallback.error || !fallback.data?.id) {
    throw fallback.error || attempt.error || new Error('Failed to create community post fixture.');
  }

  createdPostIds.push(fallback.data.id);
  return fallback.data.id;
}

async function createCommunityComment(postId: string, userId: string, content: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('community_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      content,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create community comment fixture.');
  }

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

async function readPostLikeCount(postId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('community_posts')
    .select('like_count')
    .eq('id', postId)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.like_count || 0);
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
  test('keeps like/comment state aligned and preserves board-based list navigation', async ({ page }) => {
    test.setTimeout(90000);

    const author = createUser('author');
    const viewer = createUser('viewer');
    const authorId = await createAuthUser(author);
    const viewerId = await createAuthUser(viewer);
    const baseTime = Date.now();

    await createCommunityPost(authorId, {
      board: 'japan',
      title: `[Playwright] Community Detail Previous ${baseTime}`,
      createdAt: new Date(baseTime - 2 * 60 * 60 * 1000).toISOString(),
    });
    const postId = await createCommunityPost(authorId, {
      board: 'japan',
      title: `[Playwright] Community Detail Current ${baseTime}`,
      createdAt: new Date(baseTime - 60 * 60 * 1000).toISOString(),
    });
    await createCommunityPost(authorId, {
      board: 'japan',
      title: `[Playwright] Community Detail Next ${baseTime}`,
      createdAt: new Date(baseTime).toISOString(),
    });
    const commentMessage = `Playwright comment ${Date.now()}`;

    await seedLike(postId, viewerId);
    await login(page, viewer);
    await page.goto(`/community/${postId}?board=japan&sort=popular`, {
      waitUntil: 'networkidle',
    });

    const likeButton = page.getByTestId('community-like-button');
    await expect(likeButton).toContainText('1');

    const likeResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/community/likes') && response.request().method() === 'POST'
    );
    await likeButton.click();
    const likeResponse = await likeResponsePromise;
    expect(likeResponse.status()).toBe(200);
    await expect(likeResponse.json()).resolves.toMatchObject({ liked: false, likeCount: 0 });
    await expect(likeButton).toContainText('0');
    expect(await readPostLikeCount(postId)).toBe(0);

    await expect(page.getByTestId('community-comment-summary-count')).toHaveText('댓글 0');
    await expect(page.getByTestId('community-comment-heading-count')).toHaveText('댓글 0');
    await expect(page.getByText('첫 번째 댓글을 남겨보세요! 💬')).toHaveCount(0);

    const commentsPanel = page.getByTestId('community-comments-panel');
    await expect(commentsPanel.getByTestId('community-comment-heading-count')).toBeVisible();
    await expect(commentsPanel.getByTestId('community-comment-composer')).toBeVisible();
    await expect(commentsPanel.locator('.w-full.h-2.bg-slate-50.border-y.border-slate-100')).toHaveCount(0);

    await page.locator('textarea').fill(commentMessage);
    await page.locator('button').filter({
      has: page.locator('svg.lucide-send'),
    }).click();

    await expect(page.getByTestId('community-comment-summary-count')).toHaveText('댓글 1');
    await expect(page.getByTestId('community-comment-heading-count')).toHaveText('댓글 1');
    await expect(page.getByTestId('community-comment-list')).toContainText(commentMessage);
    await expect(commentsPanel.getByRole('button', { name: /좋아요/i })).toHaveCount(0);
    await expect(page.getByTestId('community-detail-bottom-ad')).toBeVisible();
    await expect(page.getByTestId('community-detail-sidebar-ad')).toHaveCount(0);

    const nextHref = await page.getByTestId('community-detail-next-link').getAttribute('href');
    expect(nextHref).toContain('sort=popular');

    await page.getByTestId('community-detail-list-button').click();
    await expect.poll(() => page.url()).toContain('/community?sort=popular');
  });

  test('keeps board details indexable and legacy qna details noindex', async ({ page, request }) => {
    test.setTimeout(90000);

    const author = createUser('seo');
    const authorId = await createAuthUser(author);
    const baseTime = Date.now();
    const createdAt = new Date(baseTime - 2 * 60 * 60 * 1000).toISOString();
    const updatedAt = new Date(baseTime - 60 * 60 * 1000).toISOString();

    const boardPostId = await createCommunityPost(authorId, {
      title: `[Playwright] Community SEO Board ${baseTime}`,
      board: 'korea',
      createdAt,
      updatedAt,
    });
    const locallyContentPostId = await createCommunityPost(authorId, {
      title: `[Playwright] Community SEO Content ${baseTime}`,
      category: 'locally_content',
      createdAt,
      updatedAt,
    });
    const legacyPostId = await createCommunityPost(authorId, {
      title: `[Playwright] Community SEO Legacy ${baseTime}`,
      category: 'qna',
      createdAt,
      updatedAt: createdAt,
    });

    const boardResponse = await request.get(`/community/${boardPostId}?board=korea`);
    expect(boardResponse.ok()).toBeTruthy();
    const boardHtml = await boardResponse.text();
    expect(boardHtml).not.toMatch(/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i);

    const legacyResponse = await request.get(`/community/${legacyPostId}`);
    expect(legacyResponse.ok()).toBeTruthy();
    const legacyHtml = await legacyResponse.text();
    expect(legacyHtml).toMatch(/<meta[^>]+name="robots"[^>]+content="[^"]*noindex[^"]*nofollow/i);

    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto(`/community/${boardPostId}?board=korea`, {
      waitUntil: 'networkidle',
    });
    await expect(page.getByTestId('community-detail-updated-at')).toContainText('수정됨');
    await expect(page.getByTestId('community-detail-bottom-ad')).toBeVisible();
    await expect(page.getByTestId('community-detail-sidebar-ad')).toHaveCount(0);

    await page.goto(`/community/${locallyContentPostId}`, {
      waitUntil: 'networkidle',
    });
    await expect(page.getByTestId('community-detail-bottom-ad')).toBeVisible();
    await expect(page.getByTestId('community-detail-sidebar-ad')).toHaveCount(0);

    await page.goto(`/community/${legacyPostId}`, {
      waitUntil: 'networkidle',
    });
    await expect(page.getByTestId('community-detail-bottom-ad')).toHaveCount(0);
    await expect(page.getByTestId('community-detail-sidebar-ad')).toHaveCount(0);
  });

  test('omits comment-like metadata from comments payload and disables the comment-like route', async ({ request }) => {
    const author = createUser('comments-api');
    const authorId = await createAuthUser(author);
    const postId = await createCommunityPost(authorId, {
      board: 'japan',
      title: `[Playwright] Community Comment API ${Date.now()}`,
    });
    const commentId = await createCommunityComment(postId, authorId, `Comment payload ${Date.now()}`);

    const commentsResponse = await request.get(`/api/community/comments?post_id=${postId}`);
    expect(commentsResponse.ok()).toBeTruthy();
    const commentsPayload = await commentsResponse.json();
    expect(Array.isArray(commentsPayload.data)).toBeTruthy();
    expect(commentsPayload.totalCount).toBe(1);
    expect(commentsPayload.data[0]).toMatchObject({
      id: commentId,
      post_id: postId,
      user_id: authorId,
    });
    expect(commentsPayload.data[0]).not.toHaveProperty('like_count');
    expect(commentsPayload.data[0]).not.toHaveProperty('is_liked');

    const likeRouteResponse = await request.post('/api/community/comment-likes', {
      data: {
        comment_id: commentId,
      },
    });
    expect(likeRouteResponse.status()).toBe(410);
    await expect(likeRouteResponse.json()).resolves.toMatchObject({
      error: '댓글 좋아요 기능이 종료되었습니다.',
    });
  });
});
