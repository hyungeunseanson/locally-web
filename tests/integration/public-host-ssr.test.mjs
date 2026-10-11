import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const compiled = await build({
  entryPoints: ['app/users/[id]/page.tsx'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  plugins: [{
    name: 'public-host-ssr-fixture',
    setup(builder) {
      builder.onResolve({ filter: /^\.\/PublicUserProfileClient$/ }, () => ({ path: 'profile-client', namespace: 'fixture' }));
      builder.onResolve({ filter: /^@\/app\/utils\/supabase\/admin$/ }, () => ({ path: 'admin-client', namespace: 'fixture' }));
      builder.onLoad({ filter: /^profile-client$/, namespace: 'fixture' }, () => ({ contents: 'export default function ProfileClient() {}' }));
      builder.onLoad({ filter: /^admin-client$/, namespace: 'fixture' }, () => ({ contents: 'export const createAdminClient = () => globalThis.__publicHostSsrClient;' }));
    },
  }],
});
const compiledModule = { exports: {} };
new Function('module', 'exports', 'require', compiled.outputFiles[0].text)(compiledModule, compiledModule.exports, require);
const renderPage = compiledModule.exports.default;
const HOST_ID = '00000000-0000-4000-8000-000000000001';

function fixture({ applications, profile = null, experiences = [], applicationError = null }) {
  const calls = [];
  const client = {
    from(table) {
      const call = { table, select: '', filters: [] };
      calls.push(call);
      const query = {
        select(value) { call.select = value; return query; },
        eq(key, value) { call.filters.push([key, value]); return query; },
        or(value) { call.filters.push(['or', value]); return query; },
        order() { return query; },
        maybeSingle() { return Promise.resolve({ data: profile, error: null }); },
        then(resolve, reject) {
          const data = table === 'public_host_applications' ? applications : experiences;
          const error = table === 'public_host_applications' ? applicationError : null;
          return Promise.resolve({ data, error }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  globalThis.__publicHostSsrClient = client;
  return calls;
}

const approved = {
  id: 'latest', status: 'approved', name: 'Public Host', self_intro: 'Public introduction',
  profile_photo: null, languages: ['한국어'], is_superhost: false, created_at: '2026-10-10T00:00:00Z',
  phone: 'PRIVATE_PHONE_NEVER_RENDER',
};

test('approved latest host supplies public initial HTML data and active experience filter', async () => {
  const calls = fixture({ applications: [{ ...approved, id: 'old', status: 'revision', created_at: '2026-10-01T00:00:00Z' }, approved], profile: { avatar_url: '/public-avatar.png' }, experiences: [{ id: 1, title: 'Public experience', status: 'active', is_active: true }] });
  const element = await renderPage({ params: Promise.resolve({ id: HOST_ID }) });
  assert.equal(element.props.initialProfile.full_name, 'Public Host');
  assert.equal(element.props.initialProfile.introduction, 'Public introduction');
  assert.equal(element.props.initialProfile.avatar_url, '/public-avatar.png');
  assert.equal(element.props.initialHostExperiences.length, 1);
  assert.doesNotMatch(JSON.stringify(element.props), /PRIVATE_PHONE_NEVER_RENDER/);
  assert.deepEqual(calls.find(row => row.table === 'experiences').filters, [
    ['host_id', HOST_ID], ['status', 'active'], ['or', 'is_active.is.true,is_active.is.null'],
  ]);
  assert.doesNotMatch(calls.find(row => row.table === 'public_host_applications').select, /phone|email|bank|id_card/);
});

test('latest non-public application yields no server-rendered profile or experience lookup', async () => {
  const calls = fixture({ applications: [approved, { ...approved, id: 'new', status: 'revision', created_at: '2026-10-11T00:00:00Z' }] });
  await assert.rejects(renderPage({ params: Promise.resolve({ id: HOST_ID }) }),
    error => error?.digest === 'NEXT_HTTP_ERROR_FALLBACK;404');
  assert.equal(calls.length, 1);
});

test('host eligibility query failure does not silently render an empty public page', async () => {
  fixture({ applications: [], applicationError: new Error('query failed') });
  await assert.rejects(renderPage({ params: Promise.resolve({ id: HOST_ID }) }), /query failed/);
});

test('malformed host IDs do not make a privileged database query', async () => {
  const calls = fixture({ applications: [] });
  await assert.rejects(renderPage({ params: Promise.resolve({ id: 'not-a-uuid' }) }),
    error => error?.digest === 'NEXT_HTTP_ERROR_FALLBACK;404');
  assert.equal(calls.length, 0);
});
