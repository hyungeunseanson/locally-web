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

type AtomicBookingResult = {
  new_order_id: string;
  final_amount: number;
};

type BookableExperience = {
  experienceId: number;
  date: string;
  time: string;
};

const TEST_PASSWORD = 'LocallyTest!2026';
const HOST_USER_ID = 'cc84b331-7e78-4818-b9ba-f1a960017473';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdBookingIds: string[] = [];

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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createCustomerUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.exp.card.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Experience Card Customer ${timestamp}`,
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
      phone: user.phone,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  return data.user.id;
}

async function prepareBookableExperience(): Promise<BookableExperience> {
  const supabase = getAdminClient();
  const { data: experience, error: experienceError } = await supabase
    .from('experiences')
    .select('id, status, host_id')
    .eq('host_id', HOST_USER_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (experienceError) throw experienceError;
  if (!experience) {
    throw new Error('No host experience found for the approved test host.');
  }

  if (experience.status !== 'approved' && experience.status !== 'active') {
    const { error: updateError } = await supabase
      .from('experiences')
      .update({ status: 'approved' })
      .eq('id', experience.id);

    if (updateError) throw updateError;
  }

  let date = '';
  const time = '10:00';

  for (let offset = 14; offset <= 45; offset += 1) {
    const candidateDate = new Date();
    candidateDate.setDate(candidateDate.getDate() + offset);
    const candidate = formatDate(candidateDate);

    const { count, error: bookingCountError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('experience_id', experience.id)
      .eq('date', candidate)
      .eq('time', time)
      .in('status', ['PENDING', 'PAID', 'confirmed', 'pending', 'paid']);

    if (bookingCountError) throw bookingCountError;

    if (!count || count === 0) {
      date = candidate;
      break;
    }
  }

  if (!date) {
    throw new Error('Could not find an empty future booking slot for the test experience.');
  }

  const { data: existingSlots, error: slotFetchError } = await supabase
    .from('experience_availability')
    .select('experience_id')
    .eq('experience_id', experience.id)
    .eq('date', date)
    .eq('start_time', time)
    .limit(1);

  if (slotFetchError) throw slotFetchError;

  if (!existingSlots || existingSlots.length === 0) {
    const { error: slotInsertError } = await supabase
      .from('experience_availability')
      .insert({
        experience_id: experience.id,
        date,
        start_time: time,
        is_booked: false,
      });

    if (slotInsertError) throw slotInsertError;
  }

  return {
    experienceId: Number(experience.id),
    date,
    time,
  };
}

async function createPendingCardBookingFixture(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const experience = await prepareBookableExperience();

  const { data, error } = await supabase
    .rpc('create_booking_atomic', {
      p_user_id: customerId,
      p_experience_id: String(experience.experienceId),
      p_date: experience.date,
      p_time: experience.time,
      p_guests: 1,
      p_is_private: false,
      p_customer_name: customer.fullName,
      p_customer_phone: customer.phone,
      p_payment_method: 'card',
      p_is_solo_guarantee: false,
    })
    .maybeSingle<AtomicBookingResult>();

  if (error || !data?.new_order_id) {
    throw error || new Error('Failed to create pending card booking fixture.');
  }

  createdBookingIds.push(data.new_order_id);

  return {
    bookingId: data.new_order_id,
    orderId: data.new_order_id,
    amount: Number(data.final_amount || 0),
  };
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

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Experience card verification hardening', () => {
  test('rejects unauthenticated card callback attempts', async ({ request }) => {
    const response = await request.post('/api/payment/nicepay-callback', {
      data: {
        orderId: 'ORD-UNAUTH-TEST',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('does not confirm a pending booking from a fabricated success payload', async ({ page }) => {
    test.setTimeout(90000);

    const customerUser = createCustomerUser();
    const customerId = await createAuthUser(customerUser);
    const fixture = await createPendingCardBookingFixture(customerId, customerUser);

    await login(page, customerUser);

    const response = await page.request.post('/api/payment/nicepay-callback', {
      data: {
        merchant_uid: fixture.orderId,
        orderId: fixture.orderId,
        resCode: '0000',
        signData: '',
        ediDate: '',
        amount: fixture.amount,
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });

    await expect
      .poll(async () => {
        const { data: booking, error } = await getAdminClient()
          .from('bookings')
          .select('status')
          .eq('id', fixture.bookingId)
          .maybeSingle();

        if (error) throw error;
        return booking?.status || null;
      })
      .toBe('PENDING');
  });
});
