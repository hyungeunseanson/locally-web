import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  createAuthUser,
  createTestUser,
  getAdminClient,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdPostIds: string[] = [];
const createdAvailabilityKeys: Array<{ experienceId: number; date: string; time: string }> = [];

async function createApprovedHostApplication(userId: string, email: string, fullName: string, phone: string) {
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
      name: fullName,
      phone,
      dob: '1991-03-14',
      email,
      instagram: '@codex_public_contract',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: 'public contract route 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: fullName,
      motivation: 'public route contract 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(String(data.id));
}

async function createExperience(hostId: string) {
  const { data, error } = await getAdminClient()
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title: `[Playwright] Public Contract ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: 'public contract route 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: 'public contract 검증용 코스입니다.' }],
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
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create public contract experience.');
  }

  const experienceId = Number(data.id);
  createdExperienceIds.push(experienceId);
  return experienceId;
}

async function createAvailabilitySlot(experienceId: number) {
  const date = new Date();
  date.setDate(date.getDate() + 12);
  const isoDate = date.toISOString().slice(0, 10);
  const time = '09:00';

  const { error } = await getAdminClient()
    .from('experience_availability')
    .insert({
      experience_id: experienceId,
      date: isoDate,
      start_time: time,
      is_booked: false,
    });

  if (error) throw error;

  createdAvailabilityKeys.push({ experienceId, date: isoDate, time });
}

async function createCommunityPost(userId: string, title: string, isAnonymous: boolean) {
  const baseRow = {
    user_id: userId,
    category: 'qna',
    title,
    content: 'public contract route 검증용 커뮤니티 글입니다.',
    images: [],
    linked_exp_id: null,
    view_count: 0,
  };

  const insertWithAnonymous = await getAdminClient()
    .from('community_posts')
    .insert({
      ...baseRow,
      is_anonymous: isAnonymous,
    })
    .select('id')
    .single();

  if (!insertWithAnonymous.error && insertWithAnonymous.data?.id) {
    createdPostIds.push(String(insertWithAnonymous.data.id));
    return { supportsAnonymousColumn: true };
  }

  if (insertWithAnonymous.error?.code !== 'PGRST204') {
    throw insertWithAnonymous.error;
  }

  const fallbackInsert = await getAdminClient()
    .from('community_posts')
    .insert(baseRow)
    .select('id')
    .single();

  if (fallbackInsert.error || !fallbackInsert.data?.id) {
    throw fallbackInsert.error || new Error('Failed to create community post.');
  }

  createdPostIds.push(String(fallbackInsert.data.id));
  return { supportsAnonymousColumn: false };
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdPostIds.length > 0) {
    await supabase.from('community_posts').delete().in('id', createdPostIds);
  }

  for (const slot of createdAvailabilityKeys) {
    await supabase
      .from('experience_availability')
      .delete()
      .eq('experience_id', slot.experienceId)
      .eq('date', slot.date)
      .eq('start_time', slot.time);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const applicationId of createdApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Public service-role route contracts', () => {
  test('keeps community author projection public-only and excludes anonymous posts', async ({ request }) => {
    const host = createTestUser('public.contract.host');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    await createApprovedHostApplication(hostId, host.email, host.fullName, host.phone);
    const visiblePostTitle = `[Playwright] Visible Post ${Date.now()}`;
    const anonymousPostTitle = `[Playwright] Anonymous Post ${Date.now()}`;
    await createCommunityPost(hostId, visiblePostTitle, false);
    const { supportsAnonymousColumn } = await createCommunityPost(hostId, anonymousPostTitle, true);

    const response = await request.get(`/api/community/authors/${hostId}`);
    expect(response.status()).toBe(200);

    const body = await response.json() as {
      profile?: Record<string, unknown> | null;
      recentPosts?: Array<{ title?: string }>;
    };

    expect(body.profile).toMatchObject({
      displayName: host.fullName,
    });
    expect(['host', 'guest']).toContain(body.profile?.role);
    expect(body.profile).not.toHaveProperty('email');
    expect(body.profile).not.toHaveProperty('phone');
    expect(body.profile).not.toHaveProperty('bank_name');
    expect(body.profile).not.toHaveProperty('account_number');

    const recentTitles = (body.recentPosts || []).map((post) => post.title);
    expect(recentTitles).toContain(visiblePostTitle);
    if (supportsAnonymousColumn) {
      expect(recentTitles).not.toContain(anonymousPostTitle);
    }
  });

  test('keeps availability summary no-store and limited to summary fields', async ({ request }) => {
    const host = createTestUser('public.contract.availability');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const experienceId = await createExperience(hostId);
    await createAvailabilitySlot(experienceId);

    const response = await request.get(`/api/experiences/${experienceId}/availability-summary`);
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');

    const body = await response.json() as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual(
      ['availableDates', 'calendarDayStatusMap', 'dateToTimeMap', 'slotSummaryMap'].sort()
    );
    expect(Array.isArray(body.availableDates)).toBe(true);
    expect(typeof body.dateToTimeMap).toBe('object');
    expect(typeof body.calendarDayStatusMap).toBe('object');
    expect(typeof body.slotSummaryMap).toBe('object');
    expect(body).not.toHaveProperty('max_guests');
    expect(body).not.toHaveProperty('host_id');
  });
});
