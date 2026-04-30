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
const createdApplicationIds: number[] = [];
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
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.search.filters.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Search Filters ${prefix} ${timestamp}`,
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

async function createHostApplication(
  userId: string,
  user: TestUser,
  status: 'approved' | 'revision' | 'pending' | 'active' = 'approved'
) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1992-04-12',
      email: user.email,
      instagram: '@codex_search_filters',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '검색 필터 서버 경로 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '검색 필터 검증',
      status,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error(`Failed to create ${status} host application.`);
  }

  createdApplicationIds.push(Number(data.id));
}

async function createExperienceFixture(
  hostId: string,
  options?: {
    isActive?: boolean;
    title?: string;
  }
) {
  const supabase = getAdminClient();
  const title = options?.title || `[Playwright] Search Evening Food ${Date.now()}`;
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 12);
  const date = futureDate.toISOString().slice(0, 10);
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 12);
  const expiredDate = pastDate.toISOString().slice(0, 10);

  const { data, error } = await supabase
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
      description: '검색 서버 필터 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '테스트 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: 'Hongdae Entrance Exit 3',
      meeting_point_i18n: { ko: '홍대입구역 3번 출구' },
      location: 'Hongdae Entrance Exit 3',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 32000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: { age_limit: '만 19세 이상', activity_level: '보통' },
      status: 'active',
      is_active: options?.isActive ?? true,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id,title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create search experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));

  const { error: availabilityError } = await supabase.from('experience_availability').insert([
    {
      experience_id: data.id,
      date,
      start_time: '18:00',
      is_booked: false,
    },
    {
      experience_id: data.id,
      date: expiredDate,
      start_time: '18:00',
      is_booked: false,
    },
  ]);

  if (availabilityError) throw availabilityError;

  return { id: Number(data.id), title: String(data.title), date, expiredDate };
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdExperienceIds.length > 0) {
    await supabase.from('experience_availability').delete().in('experience_id', createdExperienceIds);
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Public search server filters', () => {
  test('excludes inactive-flagged active experiences from home and search APIs', async ({ request }) => {
    const host = createUser('inactive-experience-host');
    const hostId = await createAuthUser(host);
    await createHostApplication(hostId, host, 'approved');
    const visibleExperience = await createExperienceFixture(hostId, {
      isActive: true,
      title: `[Playwright] Search Active Visible ${Date.now()}`,
    });
    const hiddenExperience = await createExperienceFixture(hostId, {
      isActive: false,
      title: `[Playwright] Search Active Hidden ${Date.now()}`,
    });

    const searchResponse = await request.get(
      `/api/search/experiences?location=${encodeURIComponent('[Playwright] Search Active')}&language=all`
    );
    expect(searchResponse.ok()).toBeTruthy();
    const searchPayload = await searchResponse.json();
    expect(searchPayload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: visibleExperience.id,
          title: visibleExperience.title,
        }),
      ])
    );
    expect(searchPayload.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: hiddenExperience.id,
        }),
      ])
    );

    const homeResponse = await request.get('/api/home/experiences');
    expect(homeResponse.ok()).toBeTruthy();
    const homePayload = await homeResponse.json();
    expect(homePayload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: visibleExperience.id,
          title: visibleExperience.title,
          available_dates: expect.arrayContaining([visibleExperience.date]),
        }),
      ])
    );
    const visibleHomeExperience = homePayload.data.find(
      (experience: { id: number }) => experience.id === visibleExperience.id
    );
    expect(visibleHomeExperience?.available_dates).not.toContain(visibleExperience.expiredDate);
    expect(homePayload.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: hiddenExperience.id,
        }),
      ])
    );
  });

  test('applies type and time filters on the server route while excluding hidden hosts', async ({ request }) => {
    const visibleHost = createUser('visible-host');
    const visibleHostId = await createAuthUser(visibleHost);
    await createHostApplication(visibleHostId, visibleHost, 'approved');
    const visibleExperience = await createExperienceFixture(visibleHostId);

    const hiddenHost = createUser('hidden-host');
    const hiddenHostId = await createAuthUser(hiddenHost);
    await createHostApplication(hiddenHostId, hiddenHost, 'revision');
    const hiddenExperience = await createExperienceFixture(hiddenHostId);

    const matchingResponse = await request.get(
      `/api/search/experiences?location=${encodeURIComponent('서울')}&language=all&types=food_tour&times=evening&startDate=${visibleExperience.date}&endDate=${visibleExperience.date}`
    );
    expect(matchingResponse.ok()).toBeTruthy();
    const matchingPayload = await matchingResponse.json();
    expect(matchingPayload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: visibleExperience.id,
          title: visibleExperience.title,
        }),
      ])
    );
    expect(matchingPayload.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: hiddenExperience.id,
        }),
      ])
    );

    const excludedResponse = await request.get(
      `/api/search/experiences?location=${encodeURIComponent('서울')}&language=all&types=food_tour&times=morning&startDate=${visibleExperience.date}&endDate=${visibleExperience.date}`
    );
    expect(excludedResponse.ok()).toBeTruthy();
    const excludedPayload = await excludedResponse.json();
    expect(excludedPayload.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: visibleExperience.id,
        }),
      ])
    );
  });
});
