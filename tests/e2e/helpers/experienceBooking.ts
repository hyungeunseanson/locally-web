import { readFileSync } from 'fs';

import { expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getVisiblePublicHostIdSet } from '@/app/utils/hostVisibility';

type EnvMap = Record<string, string>;

export type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

export type AvailabilityKey = {
  experienceId: number;
  date: string;
  time: string;
};

export type BookableExperience = {
  experienceId: number;
  title: string;
  hostId: string;
  date: string;
  time: string;
  maxGuests: number;
  price: number;
  privatePrice: number;
  isPrivateEnabled: boolean;
};

type PrepareBookableExperienceOptions = {
  hostUserId?: string;
  time?: string;
  daysFromNowStart?: number;
  daysFromNowEnd?: number;
  requirePrivateEnabled?: boolean;
  minimumMaxGuests?: number;
  searchAnyHost?: boolean;
};

type InsertTestBookingInput = {
  userId: string;
  experienceId: number;
  date: string;
  time: string;
  guests: number;
  status: string;
  type?: 'group' | 'private';
  paymentMethod?: 'card' | 'bank' | 'paypal';
  amount?: number;
  totalPrice?: number;
  contactName?: string;
  contactPhone?: string;
};

type PublicHostApplicationRow = {
  id?: string | number | null;
  user_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type ExperienceFixtureRow = {
  id: number | string | null;
  title: string | null;
  status: string | null;
  host_id: string | null;
  max_guests: number | null;
  price: number | null;
  private_price: number | null;
  is_private_enabled: boolean | null;
};

const TEST_PASSWORD = 'LocallyTest!2026';
export const HOST_USER_ID = 'cc84b331-7e78-4818-b9ba-f1a960017473';

let adminClient: SupabaseClient | null = null;

function loadEnv(): EnvMap {
  return readFileSync('.env.local', 'utf8')
    .split(/\n/)
    .reduce<EnvMap>((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
}

export function getAdminClient() {
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

export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function createTestUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `${prefix.replace(/\./g, ' ')} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

export async function waitForProfile(userId: string) {
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

export async function createAuthUser(user: TestUser, createdAuthUserIds: string[]) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      phone: user.phone,
      birth_date: '1990-01-01',
      gender: 'Other',
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
      phone: user.phone,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  return data.user.id;
}

export async function cleanupAuthUsers(createdAuthUserIds: string[]) {
  const supabase = getAdminClient();

  for (const userId of createdAuthUserIds) {
    await supabase.from('bookings').delete().eq('user_id', userId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
}

export async function cleanupAvailability(createdAvailabilityKeys: AvailabilityKey[]) {
  const supabase = getAdminClient();

  for (const slot of createdAvailabilityKeys) {
    await supabase
      .from('experience_availability')
      .delete()
      .eq('experience_id', slot.experienceId)
      .eq('date', slot.date)
      .eq('start_time', slot.time);
  }
}

export async function cleanupBookings(bookingIds: string[]) {
  const supabase = getAdminClient();

  for (const bookingId of bookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }
}

export async function login(page: Page, user: TestUser) {
  await page.context().clearCookies();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');
}

export async function reviewExperiencePaymentAgreement(
  page: Page,
  testId: 'exp-payment-agree-off-platform' | 'exp-payment-agree-safety' | 'exp-payment-agree-terms',
  closeWith: 'button' | 'overlay' = 'button'
) {
  const row = page.getByTestId(testId);
  let state: 'modal' | 'checked' | 'pending' = 'pending';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await row.click({ force: attempt > 0 });

    try {
      await expect
        .poll(
          async () => {
            const checked = await row.getAttribute('aria-checked');
            const modalVisible = await page.getByTestId('exp-payment-agreement-modal').isVisible().catch(() => false);
            if (modalVisible) return 'modal';
            if (checked === 'true') return 'checked';
            return 'pending';
          },
          { timeout: 1500 }
        )
        .not.toBe('pending');

      state = await page.getByTestId('exp-payment-agreement-modal').isVisible().catch(() => false)
        ? 'modal'
        : 'checked';
      break;
    } catch {
      state = 'pending';
    }
  }

  expect(state).not.toBe('pending');

  if (state === 'modal') {
    if (closeWith === 'overlay') {
      await page.getByTestId('exp-payment-agreement-modal-overlay').click({ position: { x: 10, y: 10 } });
    } else {
      await page.getByTestId('exp-payment-agreement-modal-close').click();
    }

    await expect(page.getByTestId('exp-payment-agreement-modal')).toHaveCount(0);
  }

  await expect(row).toHaveAttribute('aria-checked', 'true');
}

export async function reviewAllExperiencePaymentAgreements(page: Page) {
  await reviewExperiencePaymentAgreement(page, 'exp-payment-agree-off-platform');
  await reviewExperiencePaymentAgreement(page, 'exp-payment-agree-safety');
  await reviewExperiencePaymentAgreement(page, 'exp-payment-agree-terms');
}

export function getVisibleReservationCard(page: Page) {
  return page.locator('#reservation-card:visible').last();
}

export function getVisibleReservationByTestId(page: Page, testId: string) {
  return getVisibleReservationCard(page).locator(`[data-testid="${testId}"]:visible`).first();
}

export async function selectReservationDate(page: Page, isoDate: string) {
  const targetDay = getVisibleReservationByTestId(page, `reservation-day-${isoDate}`);
  const nextMonthButton = getVisibleReservationByTestId(page, 'reservation-next-month');
  const prevMonthButton = getVisibleReservationByTestId(page, 'reservation-prev-month');

  await nextMonthButton.waitFor({ state: 'visible', timeout: 30000 });

  if ((await targetDay.count()) === 0) {
    for (let index = 0; index < 18; index += 1) {
      await nextMonthButton.click();
      if ((await targetDay.count()) > 0) {
        break;
      }
    }
  }

  if ((await targetDay.count()) === 0) {
    for (let index = 0; index < 18; index += 1) {
      await prevMonthButton.click();
      if ((await targetDay.count()) > 0) {
        break;
      }
    }
  }

  await targetDay.waitFor({ state: 'visible', timeout: 30000 });
  await targetDay.click();
}

export async function selectReservationTime(page: Page, time: string) {
  await getVisibleReservationByTestId(page, `reservation-time-${time.slice(0, 5)}`).click();
}

export async function getLatestHostExperience(hostUserId = HOST_USER_ID) {
  return getLatestHostExperienceWithOptions({ hostUserId });
}

export async function getLatestHostExperienceWithOptions({
  hostUserId = HOST_USER_ID,
  requirePrivateEnabled = false,
  minimumMaxGuests = 1,
  searchAnyHost = false,
}: {
  hostUserId?: string;
  requirePrivateEnabled?: boolean;
  minimumMaxGuests?: number;
  searchAnyHost?: boolean;
}) {
  const supabase = getAdminClient();

  const buildExperienceQuery = () => {
    let query = supabase
      .from('experiences')
      .select('id, title, status, host_id, max_guests, price, private_price, is_private_enabled')
      .gte('max_guests', minimumMaxGuests);

    if (!searchAnyHost) {
      query = query.eq('host_id', hostUserId);
    } else {
      query = query.in('status', ['approved', 'active']);
    }

    if (requirePrivateEnabled) {
      query = query.eq('is_private_enabled', true).gt('private_price', 0);
    }

    return query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<ExperienceFixtureRow>();
  };

  let { data: experience, error } = await buildExperienceQuery();

  if (error) throw error;

  if (!experience && !searchAnyHost) {
    const { data: visibleHostRows, error: visibleHostError } = await supabase
      .from('public_host_applications')
      .select('id, user_id, status, created_at');

    if (visibleHostError) throw visibleHostError;

    const visibleHostIds = getVisiblePublicHostIdSet(
      (visibleHostRows ?? []) as PublicHostApplicationRow[]
    );

    if (visibleHostIds.size > 0) {
      let fallbackQuery = supabase
        .from('experiences')
        .select('id, title, status, host_id, max_guests, price, private_price, is_private_enabled')
        .in('status', ['approved', 'active'])
        .gte('max_guests', minimumMaxGuests);

      if (requirePrivateEnabled) {
        fallbackQuery = fallbackQuery.eq('is_private_enabled', true).gt('private_price', 0);
      }

      const fallbackResult = await fallbackQuery.order('created_at', { ascending: false });
      if (fallbackResult.error) {
        throw fallbackResult.error;
      }

      experience =
        ((fallbackResult.data || []) as ExperienceFixtureRow[]).find((row) =>
          visibleHostIds.has(String(row.host_id || ''))
        ) ?? null;
      error = null;
    }
  }

  if (error) throw error;
  if (!experience) {
    throw new Error(
      requirePrivateEnabled
        ? searchAnyHost
          ? 'No private-enabled public experience found for the test suite.'
          : 'No private-enabled host experience found for the approved test host.'
        : searchAnyHost
          ? 'No public experience found for the test suite.'
          : 'No host experience found for the approved test host.'
    );
  }

  if (!searchAnyHost && experience.status !== 'approved' && experience.status !== 'active') {
    const { error: updateError } = await supabase
      .from('experiences')
      .update({ status: 'approved' })
      .eq('id', experience.id);

    if (updateError) throw updateError;
  }

  return {
    experienceId: Number(experience.id),
    title: String(experience.title || 'Locally 체험'),
    hostId: String(experience.host_id || ''),
    maxGuests: Number(experience.max_guests || 10),
    price: Number(experience.price || 0),
    privatePrice: Number(experience.private_price || 0),
    isPrivateEnabled: Boolean(experience.is_private_enabled),
  };
}

export async function findEmptyFutureDate(
  experienceId: number,
  time: string,
  daysFromNowStart = 14,
  daysFromNowEnd = 45
) {
  const supabase = getAdminClient();

  for (let offset = daysFromNowStart; offset <= daysFromNowEnd; offset += 1) {
    const candidateDate = new Date();
    candidateDate.setDate(candidateDate.getDate() + offset);
    const candidate = formatDate(candidateDate);

    const { count, error } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('experience_id', experienceId)
      .eq('date', candidate)
      .eq('time', time)
      .in('status', ['PENDING', 'PAID', 'confirmed', 'pending', 'paid']);

    if (error) throw error;

    if (!count || count === 0) {
      return candidate;
    }
  }

  throw new Error('Could not find an empty future booking slot for the test experience.');
}

export async function ensureAvailabilitySlot(
  slot: AvailabilityKey,
  createdAvailabilityKeys: AvailabilityKey[]
) {
  const supabase = getAdminClient();
  const { data: existingSlots, error: slotFetchError } = await supabase
    .from('experience_availability')
    .select('experience_id')
    .eq('experience_id', slot.experienceId)
    .eq('date', slot.date)
    .eq('start_time', slot.time)
    .limit(1);

  if (slotFetchError) throw slotFetchError;

  if (!existingSlots || existingSlots.length === 0) {
    const { error: slotInsertError } = await supabase
      .from('experience_availability')
      .insert({
        experience_id: slot.experienceId,
        date: slot.date,
        start_time: slot.time,
        is_booked: false,
      });

    if (slotInsertError) throw slotInsertError;
    createdAvailabilityKeys.push(slot);
  }
}

export async function prepareBookableExperience(
  createdAvailabilityKeys: AvailabilityKey[],
  options: PrepareBookableExperienceOptions = {}
): Promise<BookableExperience> {
  const {
    hostUserId = HOST_USER_ID,
    time = '10:00',
    daysFromNowStart = 14,
    daysFromNowEnd = 45,
    requirePrivateEnabled = false,
    minimumMaxGuests = 1,
    searchAnyHost = false,
  } = options;
  const experience = await getLatestHostExperienceWithOptions({
    hostUserId,
    requirePrivateEnabled,
    minimumMaxGuests,
    searchAnyHost,
  });
  const date = await findEmptyFutureDate(experience.experienceId, time, daysFromNowStart, daysFromNowEnd);

  await ensureAvailabilitySlot(
    {
      experienceId: experience.experienceId,
      date,
      time,
    },
    createdAvailabilityKeys
  );

  return {
    experienceId: experience.experienceId,
    title: experience.title,
    hostId: experience.hostId,
    date,
    time,
    maxGuests: experience.maxGuests,
    price: experience.price,
    privatePrice: experience.privatePrice,
    isPrivateEnabled: experience.isPrivateEnabled,
  };
}

export async function insertTestBooking(input: InsertTestBookingInput) {
  const supabase = getAdminClient();
  const bookingId = `TEST-BOOKING-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const normalizedTime = input.time.slice(0, 5);
  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: input.userId,
    experience_id: input.experienceId,
    amount: input.amount ?? 10000,
    total_price: input.totalPrice ?? 10000,
    status: input.status,
    guests: input.guests,
    date: input.date,
    time: normalizedTime,
    type: input.type || 'group',
    contact_name: input.contactName || 'Test Guest',
    contact_phone: input.contactPhone || '01000000000',
    message: '',
    created_at: new Date().toISOString(),
    payment_method: input.paymentMethod || 'card',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;

  return bookingId;
}
