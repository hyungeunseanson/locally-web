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
const createdApplicationIds: string[] = [];

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
    email: `codex.host.profile.save.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Profile Save ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function buildProfilePayload(name: string) {
  return {
    fullName: name,
    job: 'Tour Curator',
    dreamDestination: 'Lisbon',
    favoriteSong: 'Ocean Eyes',
    languages: ['한국어', 'English'],
    introduction: '호스트 프로필 저장 route 검증용 자기소개입니다.',
    avatarUrl: 'https://example.com/host-avatar.png',
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

async function createHostApplication(userId: string, user: TestUser) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: 'Korea',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 3 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1990.01.01',
      email: user.email,
      instagram: '@old_value',
      source: 'existing',
      language_cert: '',
      profile_photo: '',
      self_intro: 'old intro',
      id_card_file: '',
      bank_name: 'Old Bank',
      account_number: '111122223333',
      account_holder: user.fullName,
      motivation: 'existing',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to seed host application.');
  }

  createdApplicationIds.push(String(data.id));
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

  for (const applicationId of createdApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Host profile save route', () => {
  test('rejects unauthenticated save attempts', async ({ page }) => {
    const response = await page.request.post('/api/host/profile', {
      data: buildProfilePayload('Unauthenticated Host'),
    });

    expect(response.status()).toBe(401);
  });

  test('returns 404 when the authenticated user has no host application', async ({ page }) => {
    test.setTimeout(90000);

    const user = createUser('noapp');
    await createAuthUser(user);
    await login(page, user);

    const response = await page.request.post('/api/host/profile', {
      data: buildProfilePayload(user.fullName),
    });

    expect(response.status()).toBe(404);
  });

  test('updates profile public fields and latest host intro through the save route', async ({ page }) => {
    test.setTimeout(90000);

    const user = createUser('owner');
    const userId = await createAuthUser(user);
    await createHostApplication(userId, user);

    await login(page, user);

    const nextName = `${user.fullName} Updated`;
    const response = await page.request.post('/api/host/profile', {
      data: buildProfilePayload(nextName),
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });

    const supabase = getAdminClient();
    const [{ data: profile, error: profileError }, { data: application, error: applicationError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, job, dream_destination, favorite_song, languages, avatar_url')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('host_applications')
        .select('self_intro')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileError) throw profileError;
    if (applicationError) throw applicationError;

    expect(profile).toMatchObject({
      full_name: nextName,
      job: 'Tour Curator',
      dream_destination: 'Lisbon',
      favorite_song: 'Ocean Eyes',
      languages: ['한국어', 'English'],
      avatar_url: 'https://example.com/host-avatar.png',
    });

    expect(application).toMatchObject({
      self_intro: '호스트 프로필 저장 route 검증용 자기소개입니다.',
    });
  });
});
