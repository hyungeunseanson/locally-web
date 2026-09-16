import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  getTestAdminClient,
  loadTestEnv,
  TEST_PASSWORD,
} from './helpers/testSupabase';

const createdUserIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];

function getKstSlot(offsetHours: number) {
  const instant = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}:${part('second')}`,
  };
}

async function createAuthenticatedClient(email: string) {
  const env = loadTestEnv();
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw error;
  return client;
}

async function createUser(prefix: string) {
  const user = createTestUser(`review.foundation.${prefix}`);
  const id = await createAuthUser(user);
  createdUserIds.push(id);
  return { ...user, id };
}

async function createExperience(hostId: string, suffix: string, duration: number | null = 2) {
  const { data, error } = await getTestAdminClient().from('experiences').insert({
    host_id: hostId,
    country: '대한민국',
    city: '서울',
    title: `[Playwright] Review Foundation ${suffix} ${Date.now()}`,
    category: '도보 투어',
    languages: ['한국어'],
    language_levels: [{ language: '한국어', level: 5 }],
    duration,
    max_guests: 8,
    description: 'review tour-end DB foundation contract',
    itinerary: [{ title: '서울역', description: 'contract' }],
    spots: '서울역',
    meeting_point: '서울역 1번 출구',
    location: '서울역',
    photos: ['/images/logo.png'],
    price: 30000,
    inclusions: [],
    exclusions: [],
    supplies: '',
    rules: {},
    status: 'approved',
    is_active: true,
    rating: 0,
    review_count: 0,
  }).select('id').single();
  if (error || !data?.id) throw error || new Error('Failed to create experience.');
  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function createBooking(params: {
  id: string;
  guestId: string;
  experienceId: number;
  date: string;
  time: string | null;
  status?: string;
}) {
  const { error } = await getTestAdminClient().from('bookings').insert({
    id: params.id,
    order_id: params.id,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 30000,
    total_price: 30000,
    total_experience_price: 30000,
    status: params.status || 'completed',
    guests: 1,
    date: params.date,
    time: params.time,
    type: 'group',
    contact_name: 'Review Guest',
    contact_phone: '01012345678',
    message: '',
    payment_method: 'card',
    host_payout_amount: 24000,
    platform_revenue: 6000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });
  if (error) throw error;
  createdBookingIds.push(params.id);
}

function rpcRow(data: unknown) {
  return (Array.isArray(data) ? data[0] : data) as {
    outcome?: string;
    completed?: boolean;
  } | null;
}

async function notificationTypes(bookingId: string) {
  const { data, error } = await getTestAdminClient()
    .from('notifications')
    .select('type')
    .eq('booking_id', bookingId)
    .in('type', ['review_request', 'guest_review_request']);
  if (error) throw error;
  return (data || []).map((row) => row.type).sort();
}

test.afterAll(async () => {
  const admin = getTestAdminClient();
  if (createdBookingIds.length > 0) {
    await admin.from('notifications').delete().in('booking_id', createdBookingIds);
    await admin.from('guest_reviews').delete().in('booking_id', createdBookingIds);
    await admin.from('reviews').delete().in('booking_id', createdBookingIds);
    await admin.from('bookings').delete().in('id', createdBookingIds);
  }
  if (createdExperienceIds.length > 0) {
    await admin.from('experience_availability').delete().in('experience_id', createdExperienceIds);
    await admin.from('experiences').delete().in('id', createdExperienceIds);
  }
  for (const userId of createdUserIds) {
    await admin.from('profiles').delete().eq('id', userId);
    await admin.from('users').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Review tour-end DB foundation integration', () => {
  test('keeps start-time completion and independently gates both request notifications', async () => {
    const host = await createUser('completion.host');
    const guest = await createUser('completion.guest');
    const durationThree = await createExperience(host.id, 'duration-three', 3);
    const durationFallback = await createExperience(host.id, 'duration-fallback', null);
    const admin = getTestAdminClient();

    const started = getKstSlot(-1);
    const ended = getKstSlot(-4);
    const fallbackEnded = getKstSlot(-3);
    const prefix = Date.now();
    const beforeEndId = `REVIEW-FOUNDATION-BEFORE-${prefix}`;
    const afterEndId = `REVIEW-FOUNDATION-AFTER-${prefix}`;
    const customerDoneId = `REVIEW-FOUNDATION-CUSTOMER-DONE-${prefix}`;
    const hostDoneId = `REVIEW-FOUNDATION-HOST-DONE-${prefix}`;
    const invalidTimeId = `REVIEW-FOUNDATION-INVALID-TIME-${prefix}`;
    const fallbackBeforeId = `REVIEW-FOUNDATION-FALLBACK-BEFORE-${prefix}`;
    const fallbackAfterId = `REVIEW-FOUNDATION-FALLBACK-AFTER-${prefix}`;

    await createBooking({ id: beforeEndId, guestId: guest.id, experienceId: durationThree, ...started, status: 'PAID' });
    await createBooking({ id: afterEndId, guestId: guest.id, experienceId: durationThree, ...ended, status: 'PAID' });
    await createBooking({ id: customerDoneId, guestId: guest.id, experienceId: durationThree, ...ended, status: 'PAID' });
    await createBooking({ id: hostDoneId, guestId: guest.id, experienceId: durationThree, ...ended, status: 'PAID' });
    await createBooking({ id: invalidTimeId, guestId: guest.id, experienceId: durationThree, date: ended.date, time: null, status: 'PAID' });
    await createBooking({ id: fallbackBeforeId, guestId: guest.id, experienceId: durationFallback, ...started, status: 'PAID' });
    await createBooking({ id: fallbackAfterId, guestId: guest.id, experienceId: durationFallback, ...fallbackEnded, status: 'PAID' });

    const customerSeed = await admin.from('reviews').insert({
      user_id: guest.id,
      experience_id: durationThree,
      booking_id: customerDoneId,
      rating: 5,
      content: 'existing customer review prevents request',
      photos: [],
    });
    if (customerSeed.error) throw customerSeed.error;
    const hostSeed = await admin.from('guest_reviews').insert({
      booking_id: hostDoneId,
      host_id: host.id,
      guest_id: guest.id,
      rating: 5,
      content: 'existing host guest review prevents request',
    });
    if (hostSeed.error) throw hostSeed.error;

    for (const bookingId of [
      beforeEndId,
      afterEndId,
      customerDoneId,
      hostDoneId,
      invalidTimeId,
      fallbackBeforeId,
      fallbackAfterId,
    ]) {
      const result = await admin.rpc('complete_experience_booking_if_due_atomic', {
        p_booking_id: bookingId,
      });
      if (result.error) throw result.error;
      expect(rpcRow(result.data)?.completed).toBe(true);
    }

    expect(await notificationTypes(beforeEndId)).toEqual([]);
    expect(await notificationTypes(afterEndId)).toEqual(['guest_review_request', 'review_request']);
    expect(await notificationTypes(customerDoneId)).toEqual(['guest_review_request']);
    expect(await notificationTypes(hostDoneId)).toEqual(['review_request']);
    expect(await notificationTypes(invalidTimeId)).toEqual([]);
    expect(await notificationTypes(fallbackBeforeId)).toEqual([]);
    expect(await notificationTypes(fallbackAfterId)).toEqual(['guest_review_request', 'review_request']);
  });

  test('guards atomic writers and serializes aggregates for one host across experiences', async () => {
    const host = await createUser('atomic.host');
    const guestA = await createUser('atomic.guest.a');
    const guestB = await createUser('atomic.guest.b');
    const experienceA = await createExperience(host.id, 'atomic-a', 3);
    const experienceB = await createExperience(host.id, 'atomic-b', 3);
    const ended = getKstSlot(-4);
    const future = getKstSlot(1);
    const suffix = Date.now();
    const bookingA = `REVIEW-FOUNDATION-ATOMIC-A-${suffix}`;
    const bookingB = `REVIEW-FOUNDATION-ATOMIC-B-${suffix}`;
    const futureBooking = `REVIEW-FOUNDATION-ATOMIC-FUTURE-${suffix}`;
    await createBooking({ id: bookingA, guestId: guestA.id, experienceId: experienceA, ...ended });
    await createBooking({ id: bookingB, guestId: guestB.id, experienceId: experienceB, ...ended });
    await createBooking({ id: futureBooking, guestId: guestA.id, experienceId: experienceA, ...future });

    const admin = getTestAdminClient();
    const futureCustomer = await admin.rpc('create_experience_review_atomic', {
      p_booking_id: futureBooking,
      p_user_id: guestA.id,
      p_experience_id: experienceA,
      p_rating: 5,
      p_content: 'future customer review must be denied',
    });
    expect(futureCustomer.error).toBeNull();
    expect(rpcRow(futureCustomer.data)?.outcome).toBe('not_eligible');

    const futureHost = await admin.rpc('create_guest_review_with_notification_atomic', {
      p_booking_id: futureBooking,
      p_host_id: host.id,
      p_rating: 5,
      p_content: 'future host review must be denied',
      p_notification_title: 'title',
      p_notification_message: 'message',
    });
    expect(futureHost.error).toBeNull();
    expect(rpcRow(futureHost.data)?.outcome).toBe('invalid_status');

    const [createdA, createdB] = await Promise.all([
      admin.rpc('create_experience_review_atomic', {
        p_booking_id: bookingA,
        p_user_id: guestA.id,
        p_experience_id: experienceA,
        p_rating: 5,
        p_content: 'first concurrent aggregate review',
      }),
      admin.rpc('create_experience_review_atomic', {
        p_booking_id: bookingB,
        p_user_id: guestB.id,
        p_experience_id: experienceB,
        p_rating: 1,
        p_content: 'second concurrent aggregate review',
      }),
    ]);
    expect(createdA.error).toBeNull();
    expect(createdB.error).toBeNull();
    expect(rpcRow(createdA.data)?.outcome).toBe('created');
    expect(rpcRow(createdB.data)?.outcome).toBe('created');

    const duplicate = await admin.rpc('create_experience_review_atomic', {
      p_booking_id: bookingA,
      p_user_id: guestA.id,
      p_experience_id: experienceA,
      p_rating: 5,
      p_content: 'duplicate aggregate review must be denied',
    });
    expect(duplicate.error).toBeNull();
    expect(rpcRow(duplicate.data)?.outcome).toBe('duplicate');

    const [experiences, profile] = await Promise.all([
      admin.from('experiences').select('id, rating, review_count').in('id', [experienceA, experienceB]).order('id'),
      admin.from('profiles').select('average_rating, total_review_count').eq('id', host.id).single(),
    ]);
    expect(experiences.error).toBeNull();
    expect(experiences.data).toEqual([
      { id: experienceA, rating: 5, review_count: 1 },
      { id: experienceB, rating: 1, review_count: 1 },
    ]);
    expect(profile.error).toBeNull();
    expect(profile.data).toMatchObject({ average_rating: 3, total_review_count: 2 });

    const guestReviewSeeds = await admin.from('guest_reviews').insert([
      { booking_id: bookingA, host_id: host.id, guest_id: guestA.id, rating: 5, content: 'candidate suppressed' },
      { booking_id: bookingB, host_id: host.id, guest_id: guestB.id, rating: 5, content: 'candidate suppressed' },
    ]);
    if (guestReviewSeeds.error) throw guestReviewSeeds.error;

    const authenticated = await createAuthenticatedClient(guestA.email);
    const directRpc = await authenticated.rpc('create_experience_review_atomic', {
      p_booking_id: bookingA,
      p_user_id: guestA.id,
      p_experience_id: experienceA,
      p_rating: 5,
      p_content: 'authenticated role must not execute RPC',
    });
    expect(directRpc.error).toBeTruthy();
  });

  test('drains 51 post-cutoff candidates in stable batches and excludes historical backlog', async () => {
    const host = await createUser('candidate.host');
    const guest = await createUser('candidate.guest');
    const experienceId = await createExperience(host.id, 'candidate', 2);
    const due = getKstSlot(-3);
    const suffix = Date.now();
    const recentIds = Array.from({ length: 51 }, (_, index) =>
      `REVIEW-FOUNDATION-CANDIDATE-${String(index).padStart(2, '0')}-${suffix}`
    );
    const historicalId = `REVIEW-FOUNDATION-HISTORICAL-${suffix}`;

    for (const bookingId of recentIds) {
      await createBooking({ id: bookingId, guestId: guest.id, experienceId, ...due });
    }
    await createBooking({
      id: historicalId,
      guestId: guest.id,
      experienceId,
      date: '2026-07-01',
      time: '10:00:00',
    });

    const admin = getTestAdminClient();
    const first = await admin.rpc('list_due_experience_review_request_candidates', { p_limit: 50 });
    if (first.error) throw first.error;
    const firstRows = (first.data || []) as Array<{
      booking_id: string;
      customer_request_needed: boolean;
      host_request_needed: boolean;
    }>;
    expect(firstRows.map((row) => row.booking_id)).toEqual(recentIds.slice(0, 50));
    expect(firstRows.some((row) => row.booking_id === historicalId)).toBe(false);
    expect(firstRows.every((row) => row.customer_request_needed && row.host_request_needed)).toBe(true);

    const notifications = firstRows.flatMap((row) => [
      {
        user_id: guest.id,
        type: 'review_request',
        title: 'review',
        message: 'review',
        link: '/guest/trips',
        is_read: false,
        booking_id: row.booking_id,
      },
      {
        user_id: host.id,
        type: 'guest_review_request',
        title: 'host review',
        message: 'host review',
        link: '/host/dashboard?tab=reservations',
        is_read: false,
        booking_id: row.booking_id,
      },
    ]);
    const inserted = await admin.from('notifications').insert(notifications);
    if (inserted.error) throw inserted.error;

    const second = await admin.rpc('list_due_experience_review_request_candidates', { p_limit: 50 });
    if (second.error) throw second.error;
    expect((second.data || []).map((row: { booking_id: string }) => row.booking_id)).toEqual([recentIds[50]]);
  });
});
