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
const INVALID_LINKED_EXP_ID = 999999999999;

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdPostIds: string[] = [];
const createdStoragePaths: string[] = [];
const createdWhitelistEmails: string[] = [];

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
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.community.posts.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Community Post ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

async function uploadCommunityImageFixture(suffix: string) {
  const supabase = getAdminClient();
  const imagePath = `community/playwright/${suffix}-${Date.now()}.png`;
  createdStoragePaths.push(imagePath);

  const uploadResult = await supabase.storage.from('images').upload(
    imagePath,
    Buffer.from('not-a-real-png-but-good-enough-for-storage'),
    {
      contentType: 'image/png',
      upsert: false,
    }
  );

  if (uploadResult.error) throw uploadResult.error;

  const { data } = supabase.storage.from('images').getPublicUrl(imagePath);
  return {
    imagePath,
    publicUrl: data.publicUrl,
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

async function createAuthUser(user: TestUser, options?: { whitelistAdmin?: boolean }) {
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

  if (options?.whitelistAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
    createdWhitelistEmails.push(user.email);
  }

  return data.user.id;
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

  if (createdStoragePaths.length > 0) {
    await supabase.storage.from('images').remove(createdStoragePaths);
  }

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Community post write boundary', () => {
  test('rejects non-admin locally_content writes and stores anonymous general posts', async ({ page }) => {
    test.setTimeout(90000);

    const user = createUser('content');
    const userId = await createAuthUser(user);
    await login(page, user);

    const locallyContentResponse = await page.request.post('/api/community/posts', {
      data: {
        category: 'locally_content',
        title: `Locally Content ${Date.now()}`,
        content: '비관리자 locally_content 차단 검증용 글입니다.',
        images: [],
        image_paths: [],
      },
    });

    expect(locallyContentResponse.status()).toBe(403);
    await expect(locallyContentResponse.json()).resolves.toMatchObject({
      error: 'Forbidden',
    });

    const bootstrapMigration = readFileSync('supabase_community_migration.sql', 'utf8');
    const alterMigration = readFileSync(
      'docs/migrations/v3_39_08_community_locally_content_constraint.sql',
      'utf8'
    );
    const anonymousMigration = readFileSync(
      'docs/migrations/v3_39_11_community_author_access_and_anonymous.sql',
      'utf8'
    );

    expect(bootstrapMigration).toContain("'locally_content'");
    expect(alterMigration).toContain("'locally_content'");
    expect(anonymousMigration).toContain('is_anonymous');

    const anonymousResponse = await page.request.post('/api/community/posts', {
      data: {
        category: 'qna',
        title: `Anonymous General ${Date.now()}`,
        content: '일반 카테고리 익명 저장 검증용 글입니다.',
        images: [],
        image_paths: [],
        is_anonymous: true,
      },
    });

    expect(anonymousResponse.status()).toBe(200);
    const anonymousPayload = await anonymousResponse.json();
    expect(anonymousPayload.id).toBeTruthy();
    createdPostIds.push(anonymousPayload.id);

    const supabase = getAdminClient();
    if (await hasAnonymousColumn()) {
      const { data: anonymousPost } = await supabase
        .from('community_posts')
        .select('id, user_id, category, is_anonymous')
        .eq('id', anonymousPayload.id)
        .maybeSingle();

      expect(anonymousPost).toMatchObject({
        id: anonymousPayload.id,
        user_id: userId,
        category: 'qna',
        is_anonymous: true,
      });
    } else {
      const { data: anonymousPost } = await supabase
        .from('community_posts')
        .select('id, user_id, category')
        .eq('id', anonymousPayload.id)
        .maybeSingle();

      expect(anonymousPost).toMatchObject({
        id: anonymousPayload.id,
        user_id: userId,
        category: 'qna',
      });
    }

    const invalidCompanionResponse = await page.request.post('/api/community/posts', {
      data: {
        category: 'companion',
        title: `Companion Validation ${Date.now()}`,
        content: '동행 필수값 검증용 글입니다.',
        images: [],
        image_paths: [],
      },
    });

    expect(invalidCompanionResponse.status()).toBe(400);
    await expect(invalidCompanionResponse.json()).resolves.toMatchObject({
      error: 'Companion posts require date and city',
    });
  });

  test('allows locally_content writes only for admins', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createUser('content-admin');
    const adminUserId = await createAuthUser(adminUser, { whitelistAdmin: true });
    await login(page, adminUser);

    const adminResponse = await page.request.post('/api/community/posts', {
      data: {
        category: 'locally_content',
        title: `Admin Locally Content ${Date.now()}`,
        content: '관리자 전용 locally_content 등록 검증용 글입니다.',
        images: [],
        image_paths: [],
        is_anonymous: true,
      },
    });

    expect(adminResponse.status()).toBe(200);
    const payload = await adminResponse.json();
    expect(payload.id).toBeTruthy();
    createdPostIds.push(payload.id);

    if (await hasAnonymousColumn()) {
      const { data: insertedPost } = await getAdminClient()
        .from('community_posts')
        .select('id, user_id, category, is_anonymous')
        .eq('id', payload.id)
        .maybeSingle();

      expect(insertedPost).toMatchObject({
        id: payload.id,
        user_id: adminUserId,
        category: 'locally_content',
        is_anonymous: false,
      });
    } else {
      const { data: insertedPost } = await getAdminClient()
        .from('community_posts')
        .select('id, user_id, category')
        .eq('id', payload.id)
        .maybeSingle();

      expect(insertedPost).toMatchObject({
        id: payload.id,
        user_id: adminUserId,
        category: 'locally_content',
      });
    }
  });

  test('accepts a single uploaded image and rejects malformed image payloads', async ({ page }) => {
    test.setTimeout(90000);

    const user = createUser('single-image');
    const userId = await createAuthUser(user);
    await login(page, user);

    const { imagePath, publicUrl } = await uploadCommunityImageFixture('community-post-single');

    const successResponse = await page.request.post('/api/community/posts', {
      data: {
        category: 'qna',
        title: `Single Image ${Date.now()}`,
        content: '단일 이미지 저장 검증용 글입니다.',
        images: [publicUrl],
        image_paths: [imagePath],
      },
    });

    expect(successResponse.status()).toBe(200);
    const successPayload = await successResponse.json();
    expect(successPayload.id).toBeTruthy();
    createdPostIds.push(successPayload.id);

    const { data: insertedPost } = await getAdminClient()
      .from('community_posts')
      .select('id, user_id, images')
      .eq('id', successPayload.id)
      .maybeSingle();

    expect(insertedPost).toMatchObject({
      id: successPayload.id,
      user_id: userId,
      images: [publicUrl],
    });

    const mismatchResponse = await page.request.post('/api/community/posts', {
      data: {
        category: 'qna',
        title: `Image Mismatch ${Date.now()}`,
        content: '이미지 개수 불일치 검증용 글입니다.',
        images: [publicUrl],
        image_paths: [],
      },
    });

    expect(mismatchResponse.status()).toBe(400);
    await expect(mismatchResponse.json()).resolves.toMatchObject({
      error: '이미지 정보가 올바르지 않습니다.',
    });

    const tooManyResponse = await page.request.post('/api/community/posts', {
      data: {
        category: 'qna',
        title: `Too Many Images ${Date.now()}`,
        content: '다중 이미지 차단 검증용 글입니다.',
        images: [publicUrl, publicUrl],
        image_paths: ['community/playwright/first.png', 'community/playwright/second.png'],
      },
    });

    expect(tooManyResponse.status()).toBe(400);
    await expect(tooManyResponse.json()).resolves.toMatchObject({
      error: '이미지는 최대 1장까지만 첨부할 수 있습니다.',
    });

    const invalidPathResponse = await page.request.post('/api/community/posts', {
      data: {
        category: 'qna',
        title: `Invalid Image Path ${Date.now()}`,
        content: '이미지 경로 차단 검증용 글입니다.',
        images: [publicUrl],
        image_paths: ['avatars/playwright-invalid.png'],
      },
    });

    expect(invalidPathResponse.status()).toBe(400);
    await expect(invalidPathResponse.json()).resolves.toMatchObject({
      error: '이미지 경로가 올바르지 않습니다.',
    });

    const invalidUrlResponse = await page.request.post('/api/community/posts', {
      data: {
        category: 'qna',
        title: `Invalid Image Url ${Date.now()}`,
        content: '외부 이미지 URL 차단 검증용 글입니다.',
        images: ['https://example.com/not-allowed.png'],
        image_paths: [imagePath],
      },
    });

    expect(invalidUrlResponse.status()).toBe(400);
    await expect(invalidUrlResponse.json()).resolves.toMatchObject({
      error: '이미지 URL이 올바르지 않습니다.',
    });
  });

  test('cleans up uploaded image paths when the DB insert fails', async ({ page }) => {
    test.setTimeout(90000);

    const user = createUser('rollback');
    await createAuthUser(user);
    await login(page, user);

    const supabase = getAdminClient();
    const { imagePath, publicUrl } = await uploadCommunityImageFixture('community-post-rollback');

    const response = await page.request.post('/api/community/posts', {
      data: {
        category: 'qna',
        title: `Rollback ${Date.now()}`,
        content: 'DB insert 실패 시 업로드 이미지 cleanup 검증용 글입니다.',
        images: [publicUrl],
        image_paths: [imagePath],
        linked_exp_id: INVALID_LINKED_EXP_ID,
      },
    });

    expect(response.status()).toBe(500);

    const { error: downloadError } = await supabase.storage.from('images').download(imagePath);
    expect(downloadError).toBeTruthy();
  });
});
