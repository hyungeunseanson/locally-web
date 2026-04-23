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

async function createCommunityPost(
  authorId: string,
  options: { category: 'locally_content' | 'qna'; board?: 'japan' | 'korea' }
) {
  const supabase = getAdminClient();
  const basePayload = {
    user_id: authorId,
    category: options.category,
    post_format: options.board ? 'question' : undefined,
    source_locale: 'ko',
    title: `[Playwright] Community Sitemap ${options.category} ${Date.now()}`,
    content: `${options.category} sitemap 검증용 게시글입니다.`,
    images: [],
    linked_exp_id: null,
  };

  const attempt = await supabase
    .from('community_posts')
    .insert({
      ...basePayload,
      board_country: options.board ?? null,
      destination_hub: options.board ? null : null,
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
      destination_hub: options.board === 'japan' ? 'tokyo' : options.board === 'korea' ? 'seoul' : null,
    })
    .select('id')
    .single();

  if (fallback.error || !fallback.data?.id) {
    throw fallback.error || attempt.error || new Error(`Failed to create ${options.category} community post fixture.`);
  }

  createdPostIds.push(fallback.data.id);
  return fallback.data.id;
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
    const expectedSiteUrl = resolveConfiguredSiteUrl();
    const response = await request.get('/sitemap.xml');

    expect(response.ok()).toBeTruthy();

    const xml = await response.text();

    expect(xml).toContain(`<loc>${expectedSiteUrl}/search</loc>`);
    expect(xml).toContain(`<loc>${expectedSiteUrl}/community</loc>`);
    expect(xml).toContain(`<loc>${expectedSiteUrl}/services/intro</loc>`);
    expect(xml).toContain(`<loc>${expectedSiteUrl}/site-map</loc>`);
    expect(xml).not.toContain('/company/community');
    expect(xml).toMatch(/<lastmod>[^<]+<\/lastmod>/);
  });

  test('includes board posts and locally_content, but excludes legacy qna details', async ({ request }) => {
    test.setTimeout(90000);
    const expectedSiteUrl = resolveConfiguredSiteUrl();

    const author = createUser('author');
    const authorId = await createAuthUser(author);
    const boardPostId = await createCommunityPost(authorId, { category: 'qna', board: 'japan' });
    const locallyContentPostId = await createCommunityPost(authorId, { category: 'locally_content' });
    const legacyPostId = await createCommunityPost(authorId, { category: 'qna' });

    const response = await request.get('/sitemap.xml');
    expect(response.ok()).toBeTruthy();

    const xml = await response.text();

    expect(xml).toContain(`<loc>${expectedSiteUrl}/community/${boardPostId}</loc>`);
    expect(xml).toContain(`<loc>${expectedSiteUrl}/community/${locallyContentPostId}</loc>`);
    expect(xml).not.toContain(`/community/${legacyPostId}</loc>`);
  });
});
