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
const createdWhitelistEmails: string[] = [];
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
    email: `codex.community.content.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Community Content ${prefix} ${timestamp}`,
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

async function createContentPost(userId: string, title: string) {
  const { data, error } = await getAdminClient()
    .from('community_posts')
    .insert({
      user_id: userId,
      category: 'locally_content',
      title,
      content: `${title} 내용입니다.`,
      images: [],
      linked_exp_id: null,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create locally_content fixture.');
  }

  createdPostIds.push(data.id);
  return data.id;
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

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Community content layout and access', () => {
  test('renders portrait content cards and hides content write CTA for non-admins', async ({ page }) => {
    test.setTimeout(90000);

    const author = createUser('author');
    const viewer = createUser('viewer');
    const authorId = await createAuthUser(author);
    await createAuthUser(viewer);
    await createContentPost(authorId, `[Playwright] Community Content Layout ${Date.now()}`);

    await login(page, viewer);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto('/community?category=locally_content', { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: '커뮤니티 글쓰기' })).toHaveCount(0);

    const box = await page.getByTestId('community-content-card').first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(box!.width * 1.15);
  });

  test('shows content write CTA for admins', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createUser('admin');
    await createAuthUser(adminUser, { whitelistAdmin: true });

    await login(page, adminUser);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto('/community?category=locally_content', { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: '커뮤니티 글쓰기' })).toBeVisible();
    await page.getByRole('button', { name: '커뮤니티 글쓰기' }).click();
    await expect.poll(() => page.url()).toContain('/community/write?category=locally_content');
  });
});
