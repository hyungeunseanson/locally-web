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
const createdAnalyticsEventIds: string[] = [];
const createdSearchLogIds: string[] = [];

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
    email: `codex.analytics.ingest.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Analytics Ingest ${prefix} ${timestamp}`,
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

  return data.user.id;
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

  if (createdAnalyticsEventIds.length > 0) {
    await supabase.from('analytics_events').delete().in('id', createdAnalyticsEventIds);
  }

  if (createdSearchLogIds.length > 0) {
    await supabase.from('search_logs').delete().in('id', createdSearchLogIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('analytics ingest routes', () => {
  test('record search logs and analytics events through server ingest routes', async ({ page }) => {
    const user = createUser('owner');
    const userId = await createAuthUser(user);
    const uniqueSuffix = `${Date.now()}`;
    const keyword = `analytics ingest keyword ${uniqueSuffix}`;
    const eventPayloads = [
      {
        event_type: 'view',
        target_id: `analytics-view-${uniqueSuffix}`,
        landing_path: '/experiences/1',
      },
      {
        event_type: 'click',
        target_id: `analytics-click-${uniqueSuffix}`,
        landing_path: '/experiences/1',
      },
      {
        event_type: 'payment_init',
        target_id: `analytics-payment-init-${uniqueSuffix}`,
        landing_path: '/experiences/1/payment',
      },
      {
        event_type: 'booking_confirmed',
        target_id: `analytics-booking-confirmed-${uniqueSuffix}`,
        landing_path: '/experiences/1/payment/complete',
      },
    ] as const;

    await login(page, user);

    const ingestResult = await page.evaluate(async ({ keyword: inputKeyword, events }) => {
      const searchResponse = await fetch('/api/analytics/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: inputKeyword,
          route: 'main',
          session_id: 'session-e2e-analytics',
          referrer: 'https://example.com/ref',
          referrer_host: 'example.com',
          utm_source: 'newsletter',
          utm_medium: 'email',
          utm_campaign: 'spring-launch',
          landing_path: '/search',
        }),
      });

      const eventResults = [];
      for (const event of events) {
        const eventResponse = await fetch('/api/analytics/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...event,
            session_id: 'session-e2e-analytics',
            referrer: 'https://example.com/ref',
            referrer_host: 'example.com',
            utm_source: 'newsletter',
            utm_medium: 'email',
            utm_campaign: 'spring-launch',
          }),
        });

        eventResults.push({
          target_id: event.target_id,
          event_type: event.event_type,
          status: eventResponse.status,
          body: await eventResponse.json(),
        });
      }

      return {
        search: {
          status: searchResponse.status,
          body: await searchResponse.json(),
        },
        events: eventResults,
      };
    }, { keyword, events: eventPayloads });

    expect(ingestResult.search.status).toBe(200);
    expect(ingestResult.search.body.success).toBe(true);
    expect(ingestResult.events).toHaveLength(eventPayloads.length);
    for (const eventResult of ingestResult.events) {
      expect(eventResult.status).toBe(200);
      expect(eventResult.body.success).toBe(true);
    }

    const supabase = getAdminClient();
    const { data: searchRow, error: searchError } = await supabase
      .from('search_logs')
      .select('id, keyword, route, user_id')
      .eq('keyword', keyword)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (searchError) throw searchError;

    const { data: eventRows, error: eventError } = await supabase
      .from('analytics_events')
      .select('id, event_type, target_id, user_id')
      .eq('user_id', userId)
      .in('target_id', eventPayloads.map((event) => event.target_id))
      .order('created_at', { ascending: false })
      .limit(eventPayloads.length);

    if (eventError) throw eventError;

    expect(searchRow?.keyword).toBe(keyword);
    expect(searchRow?.route).toBe('main');
    expect(searchRow?.user_id).toBe(userId);

    const eventMap = new Map((eventRows || []).map((row) => [String(row.target_id), row]));
    for (const expectedEvent of eventPayloads) {
      const row = eventMap.get(expectedEvent.target_id);
      expect(row?.event_type).toBe(expectedEvent.event_type);
      expect(row?.target_id).toBe(expectedEvent.target_id);
      expect(row?.user_id).toBe(userId);
      if (row?.id) createdAnalyticsEventIds.push(String(row.id));
    }

    if (searchRow?.id) createdSearchLogIds.push(String(searchRow.id));
  });

  test('fails closed with 400 for malformed search analytics payloads', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(async () => {
      const response = await fetch('/api/analytics/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    });

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      success: false,
      error: 'Invalid JSON body',
    });
  });
});
