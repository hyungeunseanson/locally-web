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
const createdApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];

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

function createHostUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.host.visibility.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Visibility ${timestamp}`,
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

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: user.fullName,
      bio: '호스트 공개 상태 회귀 테스트용 소개입니다.',
      introduction: '호스트 공개 상태 회귀 테스트용 소개입니다.',
      phone: user.phone,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  return data.user.id;
}

async function createHostApplication(userId: string, user: TestUser, status: 'approved' | 'revision') {
  const { data, error } = await getAdminClient()
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어', 'English'],
      language_levels: [
        { language: '한국어', level: 5 },
        { language: 'English', level: 4 },
      ],
      name: user.fullName,
      phone: user.phone,
      dob: '1991-03-14',
      email: user.email,
      instagram: '@codex_host_visibility',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: `호스트 공개 상태 ${status} 테스트용 지원서입니다.`,
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '공개 상태 회귀 테스트',
      status,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error(`Failed to create ${status} host application.`);
  }

  createdApplicationIds.push(String(data.id));
  return String(data.id);
}

async function createActiveExperience(hostId: string) {
  const title = `[Playwright] Host Visibility ${Date.now()}`;
  const { data, error } = await getAdminClient()
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
      description: '호스트 공개 상태 회귀 테스트용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '공개 상태 회귀 테스트 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 49000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'active',
      is_active: true,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id, title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create active visibility test experience.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    title: String(data.title),
  };
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const applicationId of createdApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Host public visibility', () => {
  test('uses the latest host status to hide active experiences from public surfaces', async ({ request }) => {
    const host = createHostUser();
    const hostId = await createAuthUser(host);

    await createHostApplication(hostId, host, 'approved');
    await new Promise((resolve) => setTimeout(resolve, 20));
    await createHostApplication(hostId, host, 'revision');

    const experience = await createActiveExperience(hostId);

    const searchResponse = await request.get(
      `/api/search/experiences?location=${encodeURIComponent(experience.title)}&language=all`
    );
    expect(searchResponse.ok()).toBeTruthy();
    const searchPayload = await searchResponse.json();
    expect(searchPayload.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: experience.id,
        }),
      ])
    );

    const detailResponse = await request.get(`/experiences/${experience.id}`);
    const detailHtml = await detailResponse.text();
    expect(detailHtml).toMatch(/This page could not be found|404/);

    const sitemapResponse = await request.get('/sitemap.xml');
    expect(sitemapResponse.ok()).toBeTruthy();
    const sitemapXml = await sitemapResponse.text();
    expect(sitemapXml).not.toContain(`/experiences/${experience.id}`);
  });
});
