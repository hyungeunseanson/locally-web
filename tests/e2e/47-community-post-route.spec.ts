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

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Community post write boundary', () => {
  test('ships locally_content in the schema contract and keeps write validation stable', async ({ page }) => {
    test.setTimeout(90000);

    const user = createUser('content');
    const userId = await createAuthUser(user);
    await login(page, user);

    const qnaResponse = await page.request.post('/api/community/posts', {
      data: {
        category: 'qna',
        title: `QnA Contract ${Date.now()}`,
        content: '커뮤니티 글쓰기 route 성공 경로 검증용 글입니다.',
        images: [],
        image_paths: [],
      },
    });

    expect(qnaResponse.status()).toBe(200);
    const qnaPayload = await qnaResponse.json();
    expect(qnaPayload.id).toBeTruthy();
    createdPostIds.push(qnaPayload.id);

    const supabase = getAdminClient();
    const { data: insertedPost } = await supabase
      .from('community_posts')
      .select('id, category, user_id')
      .eq('id', qnaPayload.id)
      .maybeSingle();

    expect(insertedPost?.category).toBe('qna');
    expect(insertedPost?.user_id).toBe(userId);

    const bootstrapMigration = readFileSync('supabase_community_migration.sql', 'utf8');
    const alterMigration = readFileSync(
      'docs/migrations/v3_39_08_community_locally_content_constraint.sql',
      'utf8'
    );

    expect(bootstrapMigration).toContain("'locally_content'");
    expect(alterMigration).toContain("'locally_content'");

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

  test('cleans up uploaded image paths when the DB insert fails', async ({ page }) => {
    test.setTimeout(90000);

    const user = createUser('rollback');
    await createAuthUser(user);
    await login(page, user);

    const supabase = getAdminClient();
    const timestamp = Date.now();
    const imagePath = `community/playwright/community-post-rollback-${timestamp}.png`;
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

    const { data: publicImage } = supabase.storage.from('images').getPublicUrl(imagePath);

    const response = await page.request.post('/api/community/posts', {
      data: {
        category: 'qna',
        title: `Rollback ${timestamp}`,
        content: 'DB insert 실패 시 업로드 이미지 cleanup 검증용 글입니다.',
        images: [publicImage.publicUrl],
        image_paths: [imagePath],
        linked_exp_id: INVALID_LINKED_EXP_ID,
      },
    });

    expect(response.status()).toBe(500);

    const { error: downloadError } = await supabase.storage.from('images').download(imagePath);
    expect(downloadError).toBeTruthy();
  });
});
