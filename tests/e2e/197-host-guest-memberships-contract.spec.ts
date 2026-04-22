import { expect, test } from '@playwright/test';

import {
  fetchLocallyMembershipSummaries,
  fetchLocallyMembershipSummary,
} from '@/app/utils/memberStatus';

import {
  cleanupAuthUsers,
  createAuthUser,
  createTestUser,
  getAdminClient,
  login,
  type TestUser,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
const createdServiceRequestIds: string[] = [];
const createdServiceApplicationIds: string[] = [];
const createdServiceBookingIds: string[] = [];

type MembershipFixture = {
  host: TestUser;
  hostId: string;
  outsiderId: string;
  guestIds: {
    none: string;
    memberExperience: string;
    memberService: string;
    circle: string;
  };
};

let fixture: MembershipFixture | null = null;

function getFixture() {
  if (!fixture) {
    throw new Error('Membership fixture has not been created yet.');
  }

  return fixture;
}

function isoMinutesAgo(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function futureDate(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

async function createExperienceFixture(hostId: string) {
  const supabase = getAdminClient();
  const title = `[Playwright] Host Guest Membership ${Date.now()}`;

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
      description: '호스트 게스트 멤버십 route 계약 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역 3번 출구', description: '테스트 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: 'Hongdae Entrance Exit 3',
      meeting_point_i18n: {
        ko: '홍대입구역 3번 출구',
        en: 'Hongdae Entrance Exit 3',
      },
      location: 'Hongdae Entrance Exit 3',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 30000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'approved',
      is_active: true,
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
    throw error || new Error('Failed to create membership fixture experience.');
  }

  const experienceId = Number(data.id);
  createdExperienceIds.push(experienceId);
  return experienceId;
}

async function createHostBooking(params: {
  guestId: string;
  experienceId: number;
  status: string;
  createdAt: string;
}) {
  const supabase = getAdminClient();
  const bookingId = `HOST-GUEST-MEMBERSHIP-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 33000,
    total_price: 30000,
    total_experience_price: 30000,
    status: params.status,
    guests: 1,
    date: futureDate(10),
    time: '10:00',
    type: 'group',
    contact_name: 'Membership Guest',
    contact_phone: '01000000000',
    message: '',
    created_at: params.createdAt,
    payment_method: 'card',
    host_payout_amount: 24000,
    platform_revenue: 9000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
}

async function createServiceBookingFixture(params: {
  customerId: string;
  customer: TestUser;
  hostId: string;
  createdAt: string;
}) {
  const supabase = getAdminClient();
  const timestamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title: `[Playwright] Membership Service ${timestamp}`,
      description: 'Locally membership batch helper contract fixture.',
      city: 'Seoul',
      country: 'KR',
      service_date: futureDate(14),
      start_time: '09:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: params.customer.fullName,
      contact_phone: params.customer.phone,
      status: 'paid',
      created_at: params.createdAt,
      updated_at: params.createdAt,
    })
    .select('id')
    .single();

  if (requestError || !requestRow?.id) {
    throw requestError || new Error('Failed to create membership fixture service request.');
  }
  createdServiceRequestIds.push(requestRow.id);

  const { data: applicationRow, error: applicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: requestRow.id,
      host_id: params.hostId,
      appeal_message: 'Locally membership batch helper contract fixture.',
      status: 'selected',
    })
    .select('id')
    .single();

  if (applicationError || !applicationRow?.id) {
    throw applicationError || new Error('Failed to create membership fixture service application.');
  }
  createdServiceApplicationIds.push(applicationRow.id);

  const bookingId = `SVC-MEMBERSHIP-${timestamp}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: bookingId,
    request_id: requestRow.id,
    application_id: applicationRow.id,
    customer_id: params.customerId,
    host_id: params.hostId,
    amount: 180000,
    host_payout_amount: 110000,
    platform_revenue: 70000,
    status: 'PAID',
    payout_status: 'pending',
    payment_method: 'card',
    contact_name: params.customer.fullName,
    contact_phone: params.customer.phone,
    created_at: params.createdAt,
    updated_at: params.createdAt,
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);
}

async function postMembershipLookup(page: Parameters<typeof login>[0], guestIds: string[]) {
  const response = await page.request.post('/api/host/reservations/guest-memberships', {
    data: { guestIds },
  });

  return {
    response,
    body: await response.json() as {
      success?: boolean;
      error?: string;
      memberships?: Record<string, 'none' | 'member' | 'circle'>;
    },
  };
}

test.beforeAll(async () => {
  const host = createTestUser('membership.host');
  const guestNone = createTestUser('membership.none');
  const guestMemberExperience = createTestUser('membership.exp');
  const guestMemberService = createTestUser('membership.service');
  const guestCircle = createTestUser('membership.circle');
  const outsider = createTestUser('membership.outsider');

  const hostId = await createAuthUser(host, createdAuthUserIds);
  const guestNoneId = await createAuthUser(guestNone, createdAuthUserIds);
  const guestMemberExperienceId = await createAuthUser(guestMemberExperience, createdAuthUserIds);
  const guestMemberServiceId = await createAuthUser(guestMemberService, createdAuthUserIds);
  const guestCircleId = await createAuthUser(guestCircle, createdAuthUserIds);
  const outsiderId = await createAuthUser(outsider, createdAuthUserIds);

  const experienceId = await createExperienceFixture(hostId);

  await createHostBooking({
    guestId: guestNoneId,
    experienceId,
    status: 'cancelled',
    createdAt: isoMinutesAgo(40),
  });
  await createHostBooking({
    guestId: guestMemberExperienceId,
    experienceId,
    status: 'PAID',
    createdAt: isoMinutesAgo(30),
  });
  await createHostBooking({
    guestId: guestMemberServiceId,
    experienceId,
    status: 'cancelled',
    createdAt: isoMinutesAgo(20),
  });
  await createHostBooking({
    guestId: guestCircleId,
    experienceId,
    status: 'PAID',
    createdAt: isoMinutesAgo(10),
  });

  await createServiceBookingFixture({
    customerId: guestMemberServiceId,
    customer: guestMemberService,
    hostId,
    createdAt: isoMinutesAgo(5),
  });
  await createServiceBookingFixture({
    customerId: guestCircleId,
    customer: guestCircle,
    hostId,
    createdAt: isoMinutesAgo(2),
  });

  fixture = {
    host,
    hostId,
    outsiderId,
    guestIds: {
      none: guestNoneId,
      memberExperience: guestMemberExperienceId,
      memberService: guestMemberServiceId,
      circle: guestCircleId,
    },
  };
});

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdServiceBookingIds.length > 0) {
    await supabase.from('service_bookings').delete().in('id', createdServiceBookingIds);
  }

  if (createdServiceApplicationIds.length > 0) {
    await supabase.from('service_applications').delete().in('id', createdServiceApplicationIds);
  }

  if (createdServiceRequestIds.length > 0) {
    await supabase.from('service_requests').delete().in('id', createdServiceRequestIds);
  }

  if (createdBookingIds.length > 0) {
    await supabase.from('bookings').delete().in('id', createdBookingIds);
  }

  if (createdExperienceIds.length > 0) {
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Host guest memberships route', () => {
  test('single-user and batch membership helpers stay equivalent for mixed fixtures', async () => {
    const currentFixture = getFixture();
    const supabase = getAdminClient();
    const targetUserIds = [
      currentFixture.guestIds.none,
      currentFixture.guestIds.memberExperience,
      currentFixture.guestIds.memberService,
      currentFixture.guestIds.circle,
      currentFixture.outsiderId,
    ];

    const batchSummaries = await fetchLocallyMembershipSummaries(supabase, targetUserIds);

    for (const userId of targetUserIds) {
      const singleSummary = await fetchLocallyMembershipSummary(supabase, userId);
      expect(batchSummaries[userId]).toEqual(singleSummary);
    }
  });

  test('rejects unauthorized callers', async ({ request }) => {
    const response = await request.post('/api/host/reservations/guest-memberships', {
      data: { guestIds: [] },
    });

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Unauthorized',
    });
  });

  test('returns an empty membership map for empty guest ids', async ({ page }) => {
    const currentFixture = getFixture();
    await login(page, currentFixture.host);

    const { response, body } = await postMembershipLookup(page, []);

    expect(response.status()).toBe(200);
    expect(body).toMatchObject({
      success: true,
      memberships: {},
    });
  });

  test('returns an empty membership map for guests not booked with the host', async ({ page }) => {
    const currentFixture = getFixture();
    await login(page, currentFixture.host);

    const { response, body } = await postMembershipLookup(page, [currentFixture.outsiderId]);

    expect(response.status()).toBe(200);
    expect(body).toMatchObject({
      success: true,
      memberships: {},
    });
  });

  test('returns stable membership statuses for mixed host guests and ignores outsiders', async ({ page }) => {
    const currentFixture = getFixture();
    await login(page, currentFixture.host);

    const { response, body } = await postMembershipLookup(page, [
      currentFixture.guestIds.none,
      currentFixture.guestIds.memberExperience,
      currentFixture.guestIds.memberService,
      currentFixture.guestIds.circle,
      currentFixture.outsiderId,
    ]);

    expect(response.status()).toBe(200);
    expect(body).toMatchObject({
      success: true,
      memberships: {
        [currentFixture.guestIds.none]: 'none',
        [currentFixture.guestIds.memberExperience]: 'member',
        [currentFixture.guestIds.memberService]: 'member',
        [currentFixture.guestIds.circle]: 'circle',
      },
    });
    expect(body.memberships).not.toHaveProperty(currentFixture.outsiderId);
  });
});
