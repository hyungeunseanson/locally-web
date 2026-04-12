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
    email: `codex.community.sitemap.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Community Sitemap ${prefix} ${timestamp}`,
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

async function createCommunityPost(authorId: string, category: 'locally_content' | 'qna') {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      user_id: authorId,
      category,
      title: `[Playwright] Community Sitemap ${category} ${Date.now()}`,
      content: `${category} sitemap 검증용 게시글입니다.`,
      images: [],
      linked_exp_id: null,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error(`Failed to create ${category} community post fixture.`);
  }

  createdPostIds.push(data.id);
  return data.id;
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

test.describe('Sitemap route', () => {
  test('exposes only live public paths with stable lastmod tags', async ({ request }) => {
    const response = await request.get('/sitemap.xml');

    expect(response.ok()).toBeTruthy();

    const xml = await response.text();

    expect(xml).toContain('<loc>https://locally-web.vercel.app/search</loc>');
    expect(xml).toContain('<loc>https://locally-web.vercel.app/community</loc>');
    expect(xml).toContain('<loc>https://locally-web.vercel.app/services/intro</loc>');
    expect(xml).toContain('<loc>https://locally-web.vercel.app/site-map</loc>');
    expect(xml).not.toContain('/company/community');
    expect(xml).toMatch(/<lastmod>[^<]+<\/lastmod>/);
  });

  test('includes only locally_content community details when community is content-only', async ({ request }) => {
    test.setTimeout(90000);

    const author = createUser('author');
    const authorId = await createAuthUser(author);
    const locallyContentPostId = await createCommunityPost(authorId, 'locally_content');
    const legacyPostId = await createCommunityPost(authorId, 'qna');

    const response = await request.get('/sitemap.xml');

    expect(response.ok()).toBeTruthy();

    const xml = await response.text();

    expect(xml).toContain(`<loc>https://locally-web.vercel.app/community/${locallyContentPostId}</loc>`);
    expect(xml).not.toContain(`/community/${legacyPostId}</loc>`);
  });
});
