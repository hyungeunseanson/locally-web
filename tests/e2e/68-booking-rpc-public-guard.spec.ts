import { readFileSync } from 'fs';

import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupAvailability,
  cleanupBookings,
  createAuthUser,
  createTestUser,
  login,
  prepareBookableExperience,
  type AvailabilityKey,
} from './helpers/experienceBooking';

type EnvMap = Record<string, string>;

const createdAuthUserIds: string[] = [];
const createdBookingIds: string[] = [];
const createdAvailabilityKeys: AvailabilityKey[] = [];

function loadEnv(): EnvMap {
  return readFileSync('.env.local', 'utf8')
    .split(/\n/)
    .reduce<EnvMap>((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
}

async function getAuthenticatedUserToken(env: EnvMap, email: string, password: string) {
  const authClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session?.access_token) {
    throw error || new Error(`Failed to acquire test session for ${email}`);
  }

  return data.session.access_token;
}

test.afterAll(async () => {
  await cleanupBookings(createdBookingIds);
  await cleanupAvailability(createdAvailabilityKeys);
  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('booking RPC public guard', () => {
  test('blocks direct browser create_booking_atomic calls but keeps /api/bookings working', async ({ page }) => {
    const env = loadEnv();
    const requester = createTestUser('exp.rpc.guard.requester');
    const requesterId = await createAuthUser(requester, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys);

    await login(page, requester);

    const accessToken = await getAuthenticatedUserToken(env, requester.email, requester.password);

    const directRpcResult = await page.evaluate(
      async ({ supabaseUrl, anonKey, token, payload }) => {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/create_booking_atomic`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const text = await response.text();
        let body: unknown = text;

        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }

        return {
          status: response.status,
          body,
        };
      },
      {
        supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        token: accessToken,
        payload: {
          p_user_id: requesterId,
          p_experience_id: String(experience.experienceId),
          p_date: experience.date,
          p_time: experience.time,
          p_guests: 1,
          p_is_private: false,
          p_customer_name: requester.fullName,
          p_customer_phone: requester.phone,
          p_payment_method: 'bank',
          p_is_solo_guarantee: false,
        },
      }
    );

    expect(directRpcResult.status).toBeGreaterThanOrEqual(400);

    const apiResult = await page.evaluate(
      async (payload) => {
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        experienceId: experience.experienceId,
        date: experience.date,
        time: experience.time,
        guests: 1,
        isPrivate: false,
        isSoloGuarantee: false,
        customerName: requester.fullName,
        customerPhone: requester.phone,
        paymentMethod: 'bank',
      }
    );

    expect(apiResult.status).toBe(200);
    expect(apiResult.body.success).toBe(true);
    expect(typeof apiResult.body.newOrderId).toBe('string');

    createdBookingIds.push(String(apiResult.body.newOrderId));
  });

  test('reports a pending hold when a PENDING booking temporarily blocks the slot', async ({ page }) => {
    const holder = createTestUser('exp.rpc.pending.holder');
    const requester = createTestUser('exp.rpc.pending.requester');
    await createAuthUser(holder, createdAuthUserIds);
    await createAuthUser(requester, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      minimumMaxGuests: 1,
    });

    await login(page, holder);
    const firstBooking = await page.evaluate(
      async ({ experience, holder }) => {
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            experienceId: experience.experienceId,
            date: experience.date,
            time: experience.time,
            guests: experience.maxGuests,
            isPrivate: false,
            isSoloGuarantee: false,
            customerName: holder.fullName,
            customerPhone: holder.phone,
            paymentMethod: 'bank',
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      { experience, holder }
    );

    expect(firstBooking.status).toBe(200);
    expect(firstBooking.body.success).toBe(true);
    createdBookingIds.push(String(firstBooking.body.newOrderId));

    await login(page, requester);
    const blockedBooking = await page.evaluate(
      async ({ experience, requester }) => {
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            experienceId: experience.experienceId,
            date: experience.date,
            time: experience.time,
            guests: 1,
            isPrivate: false,
            isSoloGuarantee: false,
            customerName: requester.fullName,
            customerPhone: requester.phone,
            paymentMethod: 'bank',
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      { experience, requester }
    );

    expect(blockedBooking.status).toBe(409);
    expect(blockedBooking.body.success).toBe(false);
    expect(blockedBooking.body.errorCode).toBe('booking_pending_hold');
  });
});
