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
      source: 'E2E community detail visibility test',
      language_cert: 'TOPIK 6',
      profile_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=512',
      self_intro: '커뮤니티 상세 연동 체험 공개 노출 테스트용 호스트 지원서입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '커뮤니티 상세 연동 체험 공개 노출 정책 검증용입니다.',
      status,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create community detail host application fixture.');
  }

  createdHostApplicationIds.push(data.id);
  return data.id;
}

async function createExperienceFixture(hostId: string, status: 'active' | 'revision' = 'active') {
  const supabase = getAdminClient();
  const title = `[Playwright] Community Detail Linked ${Date.now()}`;

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
      description: '커뮤니티 상세 연동 체험 공개 노출 검증용 체험입니다.',
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
    .select('id,title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create community detail experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    title: String(data.title),
  };
}

async function createCommunityPost(
  authorId: string,
  options?: {
    title?: string;
    createdAt?: string;
    updatedAt?: string;
    category?: 'qna' | 'locally_content';
    board?: 'japan' | 'korea';
    linkedExpId?: number | null;
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
    linked_exp_id: options?.linkedExpId ?? null,
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

test.describe.serial('Community detail state consistency', () => {
  test('hides a linked experience chip when the linked experience is not publicly visible', async ({ page }) => {
    const author = createUser('hidden-chip');
    const authorId = await createAuthUser(author);
    await createHostApplication(authorId, author, 'approved');
    const experience = await createExperienceFixture(authorId, 'revision');
    const postTitle = `[Playwright] Community Hidden Detail Chip ${Date.now()}`;
    const postId = await createCommunityPost(authorId, {
      board: 'japan',
      title: postTitle,
      linkedExpId: experience.id,
    });

    await page.goto(`/community/${postId}?board=japan`, {
      waitUntil: 'networkidle',
    });

    await expect(page.getByRole('heading', { name: postTitle })).toBeVisible();
    await expect(page.getByText('언급된 로컬리 체험')).toHaveCount(0);
    await expect(page.getByText('연동 체험')).toHaveCount(0);
    await expect(page.getByText(experience.title)).toHaveCount(0);
  });

  test('keeps like/comment state aligned and preserves board-based list navigation', async ({ page, request }) => {
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

    const unauthenticatedLikeState = await request.get(`/api/community/likes?post_id=${postId}`);
    expect(unauthenticatedLikeState.ok()).toBeTruthy();
    await expect(unauthenticatedLikeState.json()).resolves.toMatchObject({
      liked: false,
      authenticated: false,
    });

    await login(page, viewer);
    await page.goto(`/community/${postId}?board=japan&sort=popular`, {
      waitUntil: 'networkidle',
    });

    const likeButton = page.getByTestId('community-like-button');
    await expect(likeButton).toContainText('1');

    await expect
      .poll(async () => {
        return page.evaluate(async (currentPostId) => {
          const response = await fetch(`/api/community/likes?post_id=${currentPostId}`, {
            credentials: 'same-origin',
            cache: 'no-store',
          });
          return response.json();
        }, postId);
      })
      .toMatchObject({
        liked: true,
        authenticated: true,
      });

    const likeResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/community/likes') && response.request().method() === 'POST'
    );
    await likeButton.click();
    const likeResponse = await likeResponsePromise;
    expect(likeResponse.status()).toBe(200);
    await expect(likeResponse.json()).resolves.toMatchObject({ liked: false, likeCount: 0 });
    await expect(likeButton).toContainText('0');
    expect(await readPostLikeCount(postId)).toBe(0);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByTestId('community-like-button')).toContainText('0');

    await expect
      .poll(async () => {
        return page.evaluate(async (currentPostId) => {
          const response = await fetch(`/api/community/likes?post_id=${currentPostId}`, {
            credentials: 'same-origin',
            cache: 'no-store',
          });
          return response.json();
        }, postId);
      })
      .toMatchObject({
        liked: false,
        authenticated: true,
      });

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
    await expect(page.getByTestId('community-detail-bottom-ad')).toHaveCount(0);
    await expect(page.getByTestId('community-detail-sidebar-ad')).toHaveCount(0);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByTestId('community-comment-summary-count')).toHaveText('댓글 1');
    await expect(page.getByTestId('community-comment-heading-count')).toHaveText('댓글 1');
    await expect(page.getByTestId('community-comment-list')).toContainText(commentMessage);

    const nextHref = await page.getByTestId('community-detail-next-link').getAttribute('href');
    expect(nextHref).toContain('sort=popular');

    await page.getByTestId('community-detail-list-button').click();
    await expect.poll(() => page.url()).toContain('/community?sort=popular');
  });

  test('shows comment post errors without clearing the composer', async ({ page }) => {
    const author = createUser('comment-post-fail-author');
    const viewer = createUser('comment-post-fail-viewer');
    const authorId = await createAuthUser(author);
    await createAuthUser(viewer);
    const postId = await createCommunityPost(authorId, {
      board: 'japan',
      title: `[Playwright] Community Comment Failure ${Date.now()}`,
    });
    const failedComment = `Playwright failed comment ${Date.now()}`;

    await login(page, viewer);
    await page.goto(`/community/${postId}?board=japan`, {
      waitUntil: 'networkidle',
    });
    await page.route('**/api/community/comments', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: '테스트 댓글 실패' }),
        });
        return;
      }

      await route.continue();
    });

    await page.locator('textarea').first().fill(failedComment);
    await page.locator('button').filter({
      has: page.locator('svg.lucide-send'),
    }).click();

    await expect(page.getByText('테스트 댓글 실패')).toBeVisible();
    await expect(page.locator('textarea').first()).toHaveValue(failedComment);
    await expect(page.getByTestId('community-comment-summary-count')).toHaveText('댓글 0');
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
    await expect(page.getByTestId('community-detail-bottom-ad')).toHaveCount(0);
    await expect(page.getByTestId('community-detail-sidebar-ad')).toHaveCount(0);

    await page.goto(`/community/${locallyContentPostId}`, {
      waitUntil: 'networkidle',
    });
    await expect(page.getByTestId('community-detail-bottom-ad')).toHaveCount(0);
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
