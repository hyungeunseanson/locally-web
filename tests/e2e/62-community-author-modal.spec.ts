import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { resolveConfiguredSiteUrl } from './helpers/siteUrl';

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

async function hasAnonymousColumn() {
  const { error } = await getAdminClient()
    .from('community_posts')
    .select('is_anonymous')
    .limit(1);

  return !error;
}

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
    email: `codex.community.author.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Community Author ${prefix} ${timestamp}`,
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

async function createPost(
  userId: string,
  options: {
    title: string;
    isAnonymous?: boolean;
    createdAt?: string;
    category?: 'qna' | 'locally_content';
  }
) {
  const insertPayload = {
    user_id: userId,
    category: options.category || 'qna',
    title: options.title,
    content: `${options.title} 내용입니다.`,
    images: [],
    linked_exp_id: null,
    is_anonymous: options.isAnonymous ?? false,
    created_at: options.createdAt,
  };

  let { data, error } = await getAdminClient()
    .from('community_posts')
    .insert(insertPayload)
    .select('id, title')
    .single();

  if (error && !(await hasAnonymousColumn())) {
    const legacyPayload: Record<string, unknown> = { ...insertPayload };
    delete legacyPayload.is_anonymous;
    const retryResult = await getAdminClient()
      .from('community_posts')
      .insert(legacyPayload)
      .select('id, title')
      .single();
    data = retryResult.data;
    error = retryResult.error;
  }

  if (error || !data?.id) {
    throw error || new Error('Failed to create community post fixture.');
  }

  createdPostIds.push(data.id);
  return data;
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

test.describe.serial('Community author modal', () => {
  test('opens author modal, shows recent public posts, and keeps anonymous posts hidden', async ({ page }) => {
    test.setTimeout(90000);

    const author = createUser('modal');
    const authorId = await createAuthUser(author);
    const timestamp = Date.now();
    const anonymousSupported = await hasAnonymousColumn();

    const currentPost = await createPost(authorId, {
      title: `[Playwright] Community Modal Current ${timestamp}`,
      createdAt: new Date(timestamp - 2 * 60 * 60 * 1000).toISOString(),
    });
    const recentPost = await createPost(authorId, {
      title: `[Playwright] Community Modal Recent ${timestamp}`,
      createdAt: new Date(timestamp - 60 * 60 * 1000).toISOString(),
    });
    const anonymousPost = await createPost(authorId, {
      title: `[Playwright] Community Modal Anonymous ${timestamp}`,
      isAnonymous: anonymousSupported,
      createdAt: new Date(timestamp).toISOString(),
    });

    await page.goto(`/community/${currentPost.id}?category=qna`, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /프로필 보기/ }).first().click();
    await expect(page.getByTestId('community-author-modal')).toBeVisible();
    await expect(page.getByTestId('community-author-modal')).toContainText('이 사용자가 쓴 글');
    await expect(
      page.getByTestId('community-author-modal-post').filter({ hasText: recentPost.title })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('community-author-modal-post').filter({ hasText: currentPost.title })).toHaveCount(0);
    if (anonymousSupported) {
      await expect(page.getByTestId('community-author-modal-post').filter({ hasText: anonymousPost.title })).toHaveCount(0);
    }

    await page.getByTestId('community-author-modal-post').filter({ hasText: recentPost.title }).click();
    await expect.poll(() => page.url()).toContain(`/community/${recentPost.id}`);

    if (anonymousSupported) {
      await page.goto(`/community/${anonymousPost.id}?category=qna`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('button', { name: /프로필 보기/ })).toHaveCount(0);
      await page.getByText('익명').click();
      await expect(page.getByTestId('community-author-modal')).toHaveCount(0);
    }
  });

  test('adds author url to article json-ld for visible locally_content authors', async ({ request }) => {
    test.setTimeout(90000);
    const expectedSiteUrl = resolveConfiguredSiteUrl();

    const author = createUser('seo');
    const authorId = await createAuthUser(author);
    const timestamp = Date.now();
    const contentPost = await createPost(authorId, {
      title: `[Playwright] Community Author SEO ${timestamp}`,
      category: 'locally_content',
    });

    const response = await request.get(`/community/${contentPost.id}?category=locally_content`);
    expect(response.ok()).toBeTruthy();

    const html = await response.text();

    expect(html).toContain('"@type":"Article"');
    expect(html).toContain(`"url":"${expectedSiteUrl}/users/${authorId}"`);
  });
});
