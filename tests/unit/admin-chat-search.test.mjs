import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceLoader, response } from './helpers/chatRuntime.mjs';

function fixture() {
  let user = { id: 'admin' }, admin = true, rpcError = null;
  const calls = [];
  const authCalls = [];
  const db = { from(table) {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => { authCalls.push(table); return { data: { role: admin ? 'admin' : 'guest' } }; } };
    return query;
  }, rpc(name, args) {
    calls.push({ name, args });
    return { abortSignal(signal) { assert.equal(signal.aborted, false); return Promise.resolve({ data: Array.from({ length: 40 }, (_, n) => ({ id: String(n) })), error: rpcError }); } };
  } };
  const load = sourceLoader({
    'next/server': { NextResponse: { json: (body, init) => response(body, init?.status || 200) } },
    '@/app/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/app/utils/supabase/admin': { createAdminClient: () => db },
  });
  return { calls, authCalls, setUser: value => { user = value; }, setAdmin: value => { admin = value; }, fail: () => { rpcError = { message: 'secret DB error' }; },
    get: query => load('app/api/admin/chat-search/route.ts').GET(new Request(`https://local.test/api?${query}`)) };
}
test('search route authorizes, validates, bounds and never enriches rows or exposes DB errors', async () => {
  const f = fixture();
  for (const surface of ['support','phone']) {
    const result = await (await f.get(`surface=${surface}&q=%20AbC%20&limit=1000`)).json();
    assert.equal(result.data.length,25);
    assert.deepEqual(f.calls.at(-1), { name: 'search_admin_chat', args: { p_surface: surface, p_query: 'AbC' } });
  }
  assert.equal(f.calls.length,2);
  assert.equal(f.authCalls.length,2); // real resolveAdminAccess: one users lookup + one RPC per search
  console.log('PHASE3B_API_DB', JSON.stringify({searches:2,operations: f.calls.length + f.authCalls.length,perSearch:2,enrichment:0}));
  for (const q of ['','a','%20%20']) assert.deepEqual((await (await f.get(`surface=support&q=${q}`)).json()).data,[]);
  assert.equal(f.calls.length,2);
  assert.equal((await f.get('surface=monitor&q=hello')).status,400);
  assert.equal((await f.get(`surface=support&q=${'a'.repeat(101)}`)).status,400);
  f.setUser(null); assert.equal((await f.get('surface=support&q=hello')).status,401);
  f.setUser({ id:'outsider' }); f.setAdmin(false); assert.equal((await f.get('surface=support&q=hello')).status,403);
  assert.equal(f.calls.length,2);
  f.setAdmin(true); f.fail(); const error = await f.get('surface=support&q=hello');
  assert.equal(error.status,500); assert.doesNotMatch(JSON.stringify(await error.json()),/secret/);
});
