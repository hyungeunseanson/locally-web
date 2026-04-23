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
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.community.board.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Community Board ${prefix} ${timestamp}`,
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

async function createBoardPost(authorId: string, board: 'japan' | 'korea', title: string) {
  const supabase = getAdminClient();
  const basePayload = {
    user_id: authorId,
    category: 'qna',
    post_format: 'question',
    source_locale: 'ko',
    title,
    content: `${title} 내용입니다.`,
    images: [],
    linked_exp_id: null,
  };

  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      ...basePayload,
      board_country: board,
      destination_hub: null,
    })
    .select('id')
    .single();

  if (!error && data?.id) {
    createdPostIds.push(data.id);
    return data.id;
  }

  const fallback = await supabase
    .from('community_posts')
    .insert({
      ...basePayload,
      destination_hub: board === 'japan' ? 'tokyo' : 'seoul',
    })
    .select('id')
    .single();

  if (fallback.error || !fallback.data?.id) {
    throw fallback.error || error || new Error('Failed to create board post fixture.');
  }

  createdPostIds.push(fallback.data.id);
  return fallback.data.id;
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

test.describe.serial('Community board layout and access', () => {
  test('renders only two board tabs and keeps only the inline list ad on desktop', async ({ page }) => {
    test.setTimeout(90000);

    const author = createUser('author');
    const viewer = createUser('viewer');
    const authorId = await createAuthUser(author);
    await createAuthUser(viewer);
    const token = `${Date.now()}`;
    await createBoardPost(authorId, 'japan', `[Playwright] Community Board Japan ${token}`);
    await createBoardPost(authorId, 'korea', `[Playwright] Community Board Korea ${token}`);

    await login(page, viewer);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto('/community', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('community-board-tab-japan')).toBeVisible();
    await expect(page.getByTestId('community-board-tab-korea')).toBeVisible();
    await expect(page.getByPlaceholder('로컬리 콘텐츠 검색')).toHaveCount(0);
    await expect(page.getByTestId('community-list-sidebar-ad')).toHaveCount(0);
    await expect(page.getByTestId('community-list-bottom-ad')).toBeVisible();
    await expect(page.getByTestId('community-write-cta-desktop')).toBeVisible();
    await expect(page.getByText(`[Playwright] Community Board Japan ${token}`)).toBeVisible();
    await expect(page.getByText(`[Playwright] Community Board Korea ${token}`)).toHaveCount(0);

    await page.getByTestId('community-board-tab-korea').click();
    await expect.poll(() => page.url()).toContain('board=korea');
    await expect(page.getByText(`[Playwright] Community Board Korea ${token}`)).toBeVisible();
  });

  test('hides write CTA for unauthenticated visitors while keeping the board feed public', async ({ page }) => {
    test.setTimeout(90000);

    const author = createUser('public');
    const authorId = await createAuthUser(author);
    const token = `${Date.now()}`;
    await createBoardPost(authorId, 'japan', `[Playwright] Community Board Public ${token}`);

    await page.goto('/community', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('community-board-tab-japan')).toBeVisible();
    await expect(page.getByText(`[Playwright] Community Board Public ${token}`)).toBeVisible();
    await expect(page.getByTestId('community-write-cta-desktop')).toHaveCount(0);
    await expect(page.getByTestId('community-write-cta-mobile')).toHaveCount(0);
    await expect(page.getByTestId('community-write-cta-empty')).toHaveCount(0);
  });

  test('lets logged-in users open the simplified write page and publish a board post', async ({ page }) => {
    test.setTimeout(90000);

    const writer = createUser('writer');
    await createAuthUser(writer);

    await login(page, writer);
    await page.goto('/community/write?board=korea', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: '커뮤니티 글쓰기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '질문' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '동행' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '여행 꿀팁' })).toHaveCount(0);
    await expect(page.getByTestId('community-write-board-japan')).toBeVisible();
    await expect(page.getByTestId('community-write-board-korea')).toBeVisible();
    await expect(page.getByText('최대 1장까지 첨부할 수 있어요.')).toBeVisible();

    const imageInput = page.locator('input[type="file"]');
    const hasMultiple = await imageInput.evaluate((element) => element.hasAttribute('multiple'));
    expect(hasMultiple).toBe(false);

    await imageInput.setInputFiles({
      name: 'community-write-single.png',
      mimeType: 'image/png',
      buffer: Buffer.from('community-write-single-image'),
    });

    await expect(page.getByAltText('업로드 이미지 1')).toBeVisible();
    await expect(page.getByText('사진 추가')).toHaveCount(0);
    await expect(page.getByText('1/1')).toBeVisible();

    await page.getByRole('button', { name: '이미지 1 삭제' }).click();
    await expect(page.getByText('사진 추가')).toBeVisible();
    await expect(page.getByText('0/1')).toBeVisible();

    const title = `[Playwright] Community Board Write ${Date.now()}`;
    await page.getByPlaceholder('게시글 제목을 입력해 주세요').fill(title);
    await page.getByPlaceholder('질문, 추천, 후기 등 자유롭게 남겨주세요.').fill('한국여행 게시판 글쓰기 검증용 본문입니다.');
    await page.getByRole('button', { name: '게시하기' }).click();

    await page.waitForURL((url) => url.pathname.startsWith('/community/') && url.searchParams.get('board') === 'korea', {
      timeout: 15000,
    });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByTestId('community-detail-bottom-ad')).toBeVisible();
  });

  test('redirects unauthenticated write access to login with returnUrl', async ({ page }) => {
    await page.goto('/community/write?board=korea', { waitUntil: 'networkidle' });
    await expect.poll(() => page.url()).toContain('/login?returnUrl=');
    await expect.poll(() => page.url()).toContain(encodeURIComponent('/community/write?board=korea'));
  });
});
