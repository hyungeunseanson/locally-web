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
    email: `codex.host.register.submit.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Register Submit ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function buildSubmitPayload(user: TestUser) {
  return {
    hostNationality: 'Korea',
    languageLevels: [{ language: '한국어', level: 5 }],
    languageCert: 'TOPIK 6',
    name: user.fullName,
    phone: user.phone,
    dob: '1990.01.01',
    email: user.email,
    instagram: '@codex_host_submit',
    source: 'playwright',
    profilePhoto: 'https://example.com/profile.png',
    selfIntro: '호스트 등록 submit route 검증용 자기소개입니다.',
    idCardFile: 'id_card/example-path',
    bankName: '국민은행',
    accountNumber: '12345678901234',
    accountHolder: user.fullName,
    motivation: 'route semantics verification',
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

async function createHostApplication(userId: string, user: TestUser, status: string) {
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
      self_intro: 'existing row',
      id_card_file: '',
      bank_name: 'Old Bank',
      account_number: '111122223333',
      account_holder: user.fullName,
      motivation: 'existing',
      status,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error(`Failed to seed host application with status ${status}.`);
  }

  createdApplicationIds.push(String(data.id));
  return String(data.id);
}

async function clearProfileSeedFields(userId: string) {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      avatar_url: null,
      languages: null,
    })
    .eq('id', userId);

  if (error) throw error;
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

test.describe.serial('Host register submit route', () => {
  test('rejects unauthenticated submit attempts', async ({ page }) => {
    const response = await page.request.post('/api/host/register/submit', {
      data: buildSubmitPayload(createUser('unauthenticated')),
    });

    expect(response.status()).toBe(401);
  });

  test('creates a pending application and seeds missing profile fields for a new host', async ({ page }) => {
    test.setTimeout(90000);

    const user = createUser('new');
    const userId = await createAuthUser(user);
    await clearProfileSeedFields(userId);

    await login(page, user);
    const response = await page.request.post('/api/host/register/submit', {
      data: buildSubmitPayload(user),
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      status: 'pending',
      notifyAdmin: true,
    });

    const supabase = getAdminClient();
    const { data: application, error: applicationError } = await supabase
      .from('host_applications')
      .select('id, status, languages, profile_photo')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (applicationError) throw applicationError;

    expect(application).toMatchObject({
      status: 'pending',
      languages: ['한국어'],
      profile_photo: 'https://example.com/profile.png',
    });

    createdApplicationIds.push(String(application?.id));

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url, languages')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    expect(profile).toMatchObject({
      avatar_url: 'https://example.com/profile.png',
      languages: ['한국어'],
    });
  });

  test('re-submits rejected applications as pending on the existing row', async ({ page }) => {
    test.setTimeout(90000);

    const rejectedUser = createUser('rejected');
    const rejectedUserId = await createAuthUser(rejectedUser);
    const rejectedApplicationId = await createHostApplication(rejectedUserId, rejectedUser, 'rejected');

    await login(page, rejectedUser);
    const rejectedResponse = await page.request.post('/api/host/register/submit', {
      data: buildSubmitPayload(rejectedUser),
    });

    expect(rejectedResponse.status()).toBe(200);
    await expect(rejectedResponse.json()).resolves.toMatchObject({
      success: true,
      applicationId: rejectedApplicationId,
      status: 'pending',
      notifyAdmin: true,
    });

    const supabase = getAdminClient();
    const { data: rejectedApplication, error: rejectedApplicationError } = await supabase
      .from('host_applications')
      .select('id, status')
      .eq('id', rejectedApplicationId)
      .single();

    if (rejectedApplicationError) throw rejectedApplicationError;

    expect(rejectedApplication).toMatchObject({
      id: rejectedApplicationId,
      status: 'pending',
    });
  });

  test('keeps approved applications approved when the host re-submits', async ({ page }) => {
    test.setTimeout(90000);

    const approvedUser = createUser('approved');
    const approvedUserId = await createAuthUser(approvedUser);
    const approvedApplicationId = await createHostApplication(approvedUserId, approvedUser, 'approved');
    const supabase = getAdminClient();

    await login(page, approvedUser);
    const approvedResponse = await page.request.post('/api/host/register/submit', {
      data: buildSubmitPayload(approvedUser),
    });

    expect(approvedResponse.status()).toBe(200);
    await expect(approvedResponse.json()).resolves.toMatchObject({
      success: true,
      applicationId: approvedApplicationId,
      status: 'approved',
      notifyAdmin: false,
    });

    const { data: approvedApplication, error: approvedApplicationError } = await supabase
      .from('host_applications')
      .select('id, status')
      .eq('id', approvedApplicationId)
      .single();

    if (approvedApplicationError) throw approvedApplicationError;

    expect(approvedApplication).toMatchObject({
      id: approvedApplicationId,
      status: 'approved',
    });
  });
});
