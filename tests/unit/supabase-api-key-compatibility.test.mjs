import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

import {
  createSupabaseApiKeyHeaders,
  fetchSupabase,
  readSupabaseJson,
  validateSupabasePrivilegedKey,
} from '../../app/utils/supabase/apiKeys.mjs';
import { createAdminClient } from '../../app/utils/supabase/admin.ts';
import {
  createCloudflareHomePopularitySnapshotRepository,
  handleHomePopularitySnapshotScheduled,
  HOME_POPULARITY_SNAPSHOT_CRON,
} from '../../app/utils/homePopularitySnapshot.ts';
import {
  createCloudflareNotificationRetentionRepository,
} from '../../app/utils/notificationRetentionCleanup.ts';
import { buildStorageListRequest, fetchAllExperienceRows } from '../../scripts/cloudflare/audit-public-experience-media.mjs';
import { reportNotificationRetentionPreflight } from '../../scripts/cloudflare/report-notification-retention-preflight.mjs';
import {
  LEGACY_SERVICE_KEY,
  LEGACY_ANON_KEY,
  USER_ACCESS_TOKEN,
  MODERN_SECRET_KEY,
  MODERN_PUBLISHABLE_KEY,
  jwtFixture,
} from '../fixtures/supabaseApiKeys.mjs';

const FIXTURE_ORIGIN = 'http://127.0.0.1:54329';
const runtime = (key) => ({
  NEXT_PUBLIC_SUPABASE_URL: FIXTURE_ORIGIN,
  SUPABASE_SERVICE_ROLE_KEY: key,
});

function assertKeyHeaders(headers, key) {
  const observed = new Headers(headers);
  assert.equal(observed.get('apikey'), key);
  assert.equal(observed.get('authorization'),
    key.startsWith('sb_') ? null : 'Bearer ' + key);
}

async function withEnvironment(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  try {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    return await callback();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('modern API keys use apikey only and legacy keys preserve Bearer fallback', () => {
  for (const key of [LEGACY_SERVICE_KEY, LEGACY_ANON_KEY, MODERN_SECRET_KEY, MODERN_PUBLISHABLE_KEY]) {
    const headers = createSupabaseApiKeyHeaders(key, { headers: { Range: '0-99', Accept: 'application/json' } });
    assertKeyHeaders(headers, key);
    assert.equal(headers.range, '0-99');
    assert.equal(headers.accept, 'application/json');
  }
});

test('API-key selection never replaces a separately supplied user session JWT', () => {
  for (const key of [LEGACY_ANON_KEY, MODERN_PUBLISHABLE_KEY]) {
    for (const options of [
      { accessToken: USER_ACCESS_TOKEN },
      { headers: new Headers({ Authorization: 'Bearer ' + USER_ACCESS_TOKEN }) },
    ]) {
      const headers = createSupabaseApiKeyHeaders(key, options);
      assert.equal(headers.apikey, key);
      assert.equal(headers.authorization, 'Bearer ' + USER_ACCESS_TOKEN);
    }
  }
  assert.throws(() => createSupabaseApiKeyHeaders(MODERN_PUBLISHABLE_KEY, {
    accessToken: MODERN_SECRET_KEY,
  }), /supabase_request_headers_invalid/);
  assert.throws(() => createSupabaseApiKeyHeaders(MODERN_SECRET_KEY, {
    headers: { authorization: 'Bearer ' + MODERN_SECRET_KEY },
  }), /supabase_request_headers_invalid/);
});

test('offline privileged-binding validation accepts both supported formats and rejects public/session keys', () => {
  assert.equal(validateSupabasePrivilegedKey(LEGACY_SERVICE_KEY), 'legacy_service_role');
  assert.equal(validateSupabasePrivilegedKey(MODERN_SECRET_KEY), 'modern_secret');
  for (const key of ['', ' ', undefined, MODERN_PUBLISHABLE_KEY, LEGACY_ANON_KEY, USER_ACCESS_TOKEN,
    'sb_secret_', 'not-a-key', jwtFixture('public')]) {
    assert.throws(() => validateSupabasePrivilegedKey(key), (error) =>
      error.message === 'supabase_privileged_api_key_invalid'
      && (typeof key !== 'string' || !key || !error.message.includes(key)));
  }
});

test('shared SDK admin client accepts both keys and authenticated SDK requests retain the user JWT', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(new URL(String(input)).origin, FIXTURE_ORIGIN);
    calls.push(new Headers(init?.headers));
    return Response.json([]);
  };
  try {
    for (const key of [LEGACY_SERVICE_KEY, MODERN_SECRET_KEY]) {
      await withEnvironment(runtime(key), async () => {
        const result = await createAdminClient().from('fixture_rows').select('id');
        assert.equal(result.error, null);
        assert.equal(calls.at(-1).get('apikey'), key);
      });
    }
    const userClient = createClient(FIXTURE_ORIGIN, MODERN_PUBLISHABLE_KEY, {
      accessToken: async () => USER_ACCESS_TOKEN,
    });
    await userClient.from('fixture_rows').select('id');
    assert.equal(calls.at(-1).get('apikey'), MODERN_PUBLISHABLE_KEY);
    assert.equal(calls.at(-1).get('authorization'), 'Bearer ' + USER_ACCESS_TOKEN);
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('both direct HTTP Cron adapters preserve RPC, body and redirect contracts with either key', async () => {
  for (const key of [LEGACY_SERVICE_KEY, MODERN_SECRET_KEY]) {
    const calls = [];
    const mockedFetch = async (input, init) => {
      calls.push({ pathname: new URL(String(input)).pathname, init });
      assertKeyHeaders(init.headers, key);
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'manual');
      return Response.json(2);
    };
    assert.equal(await createCloudflareHomePopularitySnapshotRepository(runtime(key), mockedFetch).refresh(), 2);
    assert.equal(await createCloudflareNotificationRetentionRepository(runtime(key), mockedFetch)
      .prune('2026-08-01T00:00:00.000Z', 100), 2);
    assert.deepEqual(calls.map((call) => call.pathname), [
      '/rest/v1/rpc/refresh_experience_popularity_snapshot',
      '/rest/v1/rpc/prune_notifications_retention',
    ]);
    assert.equal(calls[0].init.body, '{}');
    assert.deepEqual(JSON.parse(calls[1].init.body), {
      p_cutoff: '2026-08-01T00:00:00.000Z', p_batch_size: 100,
    });
  }
});

test('Storage/operator adapters accept modern secrets through their actual HTTP request path', async () => {
  for (const key of [LEGACY_SERVICE_KEY, MODERN_SECRET_KEY, MODERN_PUBLISHABLE_KEY]) {
    const request = buildStorageListRequest('https://fixture.example.test', key, 'fixture', 0);
    assertKeyHeaders(request.init.headers, key);
    assert.equal(request.mutation, false);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      assertKeyHeaders(init.headers, key);
      return Response.json([]);
    };
    try {
      assert.deepEqual(await fetchAllExperienceRows('https://fixture.example.test', key), []);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
  await withEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: MODERN_SECRET_KEY,
  }, async () => {
    let calls = 0;
    const result = await reportNotificationRetentionPreflight({
      fetchImplementation: async (_input, init) => {
        calls += 1;
        assertKeyHeaders(init.headers, MODERN_SECRET_KEY);
        assert.equal(init.redirect, 'manual');
        return Response.json([], { headers: { 'content-range': '0-0/0' } });
      },
    });
    assert.equal(result.totalCount, 0);
    assert.equal(calls, 2);
  });
});

test('credential-bearing native exceptions do not escape into errors or Cron logs', async () => {
  for (const key of [LEGACY_SERVICE_KEY, MODERN_SECRET_KEY]) {
    const fail = async () => { throw new Error('provider echoed ' + key); };
    await assert.rejects(() => fetchSupabase(FIXTURE_ORIGIN, {}, fail), (error) =>
      error.message === 'supabase_request_transport_failed' && error.cause === undefined);
    await assert.rejects(() => readSupabaseJson({ json: fail }), (error) =>
      error.message === 'supabase_response_invalid_json' && error.cause === undefined);
    assert.throws(() => createSupabaseApiKeyHeaders(key + '\ninvalid'), (error) =>
      !error.message.includes(key) && error.cause === undefined);
    const logs = [];
    await assert.rejects(() => handleHomePopularitySnapshotScheduled(
      { cron: HOME_POPULARITY_SNAPSHOT_CRON },
      { ...runtime(key), CLOUDFLARE_DEPLOYMENT_ENV: 'production', HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED: 'true' },
      { fetch: fail, log: (entry) => logs.push(entry) }
    ), /rpc_transport_failed/);
    assert.equal(logs[0].diagnosticCode, 'rpc_transport_failed');
    assert.equal(JSON.stringify(logs).includes(key), false);
  }
});
