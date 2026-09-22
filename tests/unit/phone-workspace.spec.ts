import '../e2e/helpers/serverOnlyTestShim';
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as server from '@/app/utils/supabase/server';
import * as admin from '@/app/utils/supabase/admin';
import { GET as phoneGet } from '@/app/api/admin/customer-support/route';
import { GET as inquiryGet } from '@/app/api/admin/inquiries/route';
import { filteredPage, FORMAL_PROXY_FILTER } from '@/app/api/admin/customer-support/queries';
import { getPhoneAttentionLabel, matchesPhoneFilter, type PhoneWorkspaceRequest } from '@/app/utils/phoneReservationWorkspace';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

type Row = Record<string, unknown>;
const request = (i: number, patch: Row = {}): Row => ({ id: `request-${i}`, user_id: `guest-${i}`, category: 'RESTAURANT', status: 'PENDING', payment_status: 'COMPLETED', payment_channel: 'LOCALLY', created_at: String(1000 - i), form_data: { restaurant_name: `식당 ${i}`, linked_inquiry_id: String(i), payment_method: 'card' }, ...patch });

function database(rows: Row[], inquiries: Row[]) {
  const calls: URL[] = [];
  const tables: Record<string, Row[]> = {
    proxy_requests: rows, inquiries,
    profiles: rows.map(row => ({ id: row.user_id, full_name: `고객 ${row.id}`, email: `${row.id}@example.test` })),
    users: [{ id: 'admin', role: 'admin' }], admin_whitelist: [], host_applications: [], inquiry_messages: [],
  };
  const client = createClient('http://127.0.0.1:54329', 'fixture-only-key', { global: { fetch: async input => {
    const url = new URL(String(input)); calls.push(url);
    const table = url.pathname.split('/').at(-1)!;
    let result = [...(tables[table] || [])];
    for (const [key, value] of url.searchParams) {
      if (key === 'or') {
        if (value.includes('__proxy_card_anchor')) result = result.filter(row => (row.form_data as Row)?.__proxy_card_anchor !== 'v1');
        if (value.includes('type.not.in')) result = result.filter(row => !['admin', 'admin_support'].includes(String(row.type)));
      } else if (value.startsWith('eq.')) result = result.filter(row => String(row[key]) === value.slice(3));
      else if (value.startsWith('in.') && !key.includes('.')) {
        const values = value.slice(4, -1).split(',').map(v => v.replaceAll('"', ''));
        result = result.filter(row => values.includes(String(key === 'form_data->>linked_inquiry_id' ? (row.form_data as Row)?.linked_inquiry_id : row[key])));
      }
    }
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Number(url.searchParams.get('limit') || result.length);
    result = result.slice(offset, offset + limit);
    // Model the embedded latest *actual*, non-deleted message query.
    if (table === 'inquiries' && url.searchParams.has('inquiry_messages.or')) {
      expect(url.searchParams.get('inquiry_messages.or')).toContain('type.in.(text,image)');
      result = result.map(row => ({ ...row, inquiry_messages: (row.inquiry_messages as Row[] || [])
        .filter(message => message.type == null || ['text', 'image'].includes(String(message.type))).slice(-1) }));
    }
    const accept = (input instanceof Request ? input.headers : null)?.get('accept');
    // Supabase supplies headers in init, handled by maybeSingle's array response coercion.
    void accept;
    return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
  } }, auth: { persistSession: false } });
  return { client, calls };
}

const originalServer = server.createClient;
const originalAdmin = admin.createAdminClient;
test.afterEach(() => {
  (server as { createClient: typeof originalServer }).createClient = originalServer;
  (admin as { createAdminClient: typeof originalAdmin }).createAdminClient = originalAdmin;
});
function install(db: ReturnType<typeof database>, user: { id: string } | null = { id: 'admin' }) {
  (admin as { createAdminClient: typeof originalAdmin }).createAdminClient = () => db.client;
  (server as { createClient: typeof originalServer }).createClient = async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) as Awaited<ReturnType<typeof originalServer>>;
}

test('filtered pagination crosses 100 and never sends rejected records to the client', async () => {
  const values = Array.from({ length: 231 }, (_, id) => ({ id }));
  const page = await filteredPage(async offset => values.slice(offset, offset + 100), row => row.id >= 205, 10, 10);
  expect(page.data.map(row => row.id)).toEqual(Array.from({ length: 10 }, (_, i) => 215 + i));
  expect(page.pagination.hasMore).toBe(true);
});

test('phone search reaches old records; excludes anchor before filtering and pagination', async () => {
  const rows = Array.from({ length: 121 }, (_, i) => request(i + 1));
  rows.unshift(request(0, { form_data: { __proxy_card_anchor: 'v1' }, payment_status: 'WAITING' }));
  const db = database(rows, rows.map(row => ({ id: Number(String(row.id).split('-')[1]), user_id: row.user_id, type: 'admin_support', inquiry_messages: [] })));
  install(db);
  const response = await phoneGet(new Request('http://local/api?filter=all&q=request-121'));
  const result = await response.json();
  expect(response.status).toBe(200);
  expect(result.data.map((row: Row) => row.id)).toEqual(['request-121']);
  expect(db.calls.filter(url => url.pathname.endsWith('proxy_requests')).every(url => url.searchParams.get('or') === `(${FORMAL_PROXY_FILTER})`)).toBe(true);
  expect(db.calls.some(url => url.searchParams.get('offset') === '100')).toBe(true);
});

test('valid phone inquiries are excluded from support, broken customer links stay visible', async () => {
  const rows = [request(1), request(2, { user_id: 'wrong-owner' })];
  const inquiries = [1, 2, 3].map(id => ({ id, user_id: `guest-${id}`, type: 'admin_support', inquiry_messages: [] }));
  const db = database(rows, inquiries); install(db);
  const result = await (await inquiryGet(new Request('http://local/api?view=support'))).json();
  expect(result.data.map((row: Row) => row.id)).toEqual([2, 3]);
  const linked = await (await inquiryGet(new Request('http://local/api?inquiryId=1&resolveOnly=true'))).json();
  expect(linked.selection).toEqual({ view: 'phone', proxyRequestId: 'request-1' });
});

test('latest actual sender survives read and deleted messages; invalid links are flagged', async () => {
  const rows = [request(1, { status: 'COMPLETED' }), request(2), request(3, { form_data: {} }), request(4, { payment_status: 'REFUNDED' }), request(5)];
  const db = database(rows, [
    { id: 1, user_id: 'guest-1', type: 'admin_support', inquiry_messages: [{ sender_id: 'guest-1', type: 'text', is_read: true }, { sender_id: 'admin', type: 'deleted' }] },
    { id: 2, user_id: 'other-guest', type: 'admin_support' },
    { id: 4, user_id: 'guest-4', type: 'admin_support' },
  ]); install(db);
  const result = await (await phoneGet(new Request('http://local/api?filter=todo'))).json();
  expect(result.data).toHaveLength(5);
  expect(result.data[0]).toMatchObject({ needs_reply: true, status: 'COMPLETED' });
  expect(result.data[1]).toMatchObject({ needs_attention: true, linked_inquiry_id: null });
  expect(result.data[2]).toMatchObject({ needs_attention: true, linked_inquiry_id: null });
  expect(result.data[3]).toMatchObject({ needs_attention: true });
  expect(result.data[4]).toMatchObject({ needs_attention: true, linked_inquiry_id: null });
  expect(result.data.map(getPhoneAttentionLabel)).toEqual([
    null, '문의 연결 확인 필요', '문의 연결 확인 필요', '환불 후 예약 상태 확인', '문의 연결 확인 필요',
  ]);
});

test('anchor detail is 404 and non-admin reads are denied', async () => {
  const db = database([request(1, { form_data: { __proxy_card_anchor: 'v1' } })], []); install(db);
  expect((await phoneGet(new Request('http://local/api?requestId=request-1'))).status).toBe(404);
  install(db, { id: 'guest' });
  expect((await phoneGet(new Request('http://local/api'))).status).toBe(403);
  install(db, null);
  expect((await phoneGet(new Request('http://local/api'))).status).toBe(401);
});

test('filters distinguish payment waiting, completed replies, closed, anomalies and anchors', () => {
  const row = { ...request(1), needs_reply: false, needs_attention: false } as unknown as PhoneWorkspaceRequest;
  expect(matchesPhoneFilter(row, 'todo')).toBe(true);
  expect(matchesPhoneFilter({ ...row, payment_status: 'WAITING' }, 'payment')).toBe(true);
  expect(matchesPhoneFilter({ ...row, status: 'CANCELLED', payment_status: 'WAITING' }, 'payment')).toBe(false);
  expect(matchesPhoneFilter({ ...row, status: 'COMPLETED', needs_reply: true }, 'closed')).toBe(false);
  expect(matchesPhoneFilter({ ...row, status: 'COMPLETED', needs_reply: true }, 'todo')).toBe(true);
  expect(matchesPhoneFilter({ ...row, form_data: { __proxy_card_anchor: 'v1', payment_method: 'card' } }, 'all')).toBe(false);
});

test('legacy TEAM phone redirects without mounting Team bootstrap; sidebar and alerts use new destination', () => {
  const dashboard = readFileSync('app/admin/dashboard/page.tsx', 'utf8');
  expect(dashboard).toContain("legacyPhone ? 'CHATS'");
  expect(dashboard).toContain("next.set('view', 'phone')");
  expect(readFileSync('app/admin/dashboard/components/TeamTab.tsx', 'utf8')).not.toContain('PhoneReservationTab');
  expect(readFileSync('app/admin/dashboard/components/Sidebar.tsx', 'utf8')).toContain('label="Customer Support"');
  expect(readFileSync('app/utils/proxyBookingNotifications.ts', 'utf8')).toContain('tab=CHATS&view=phone&proxyRequestId=');
});

test('support pagination excludes linked requests before slicing and direct links find older inquiries', async () => {
  const rows = Array.from({ length: 110 }, (_, index) => request(index + 1));
  const inquiries = Array.from({ length: 125 }, (_, index) => ({ id: index + 1, user_id: `guest-${index + 1}`, type: 'admin_support', inquiry_messages: [] }));
  install(database(rows, inquiries));
  const first = await (await inquiryGet(new Request('http://local/api?view=support&limit=10'))).json();
  expect(first.data.map((row: Row) => row.id)).toEqual(Array.from({ length: 10 }, (_, index) => index + 111));
  expect(first.pagination.hasMore).toBe(true);
  const last = await (await inquiryGet(new Request('http://local/api?view=support&limit=10&offset=10'))).json();
  expect(last.data.map((row: Row) => row.id)).toEqual([121, 122, 123, 124, 125]);
  const deepLink = await (await inquiryGet(new Request('http://local/api?view=support&limit=10&inquiryId=125'))).json();
  expect(deepLink.data.some((row: Row) => row.id === 125)).toBe(true);
});

for (const scenario of [
  { name: 'normal paid active', status: 'PENDING', payment_status: 'COMPLETED', linked_inquiry_id: '1', needs_attention: false, label: null },
  { name: 'missing inquiry', status: 'PENDING', payment_status: 'COMPLETED', linked_inquiry_id: null, needs_attention: true, label: '문의 연결 확인 필요' },
  { name: 'pending refunded', status: 'PENDING', payment_status: 'REFUNDED', linked_inquiry_id: '1', needs_attention: true, label: '환불 후 예약 상태 확인' },
  { name: 'in progress refunded', status: 'IN_PROGRESS', payment_status: 'REFUNDED', linked_inquiry_id: '1', needs_attention: true, label: '환불 후 예약 상태 확인' },
  { name: 'pending failed', status: 'PENDING', payment_status: 'FAILED', linked_inquiry_id: '1', needs_attention: true, label: '결제 취소 후 예약 상태 확인' },
  { name: 'completed refunded', status: 'COMPLETED', payment_status: 'REFUNDED', linked_inquiry_id: '1', needs_attention: false, label: null },
  { name: 'missing inquiry takes priority over refund', status: 'PENDING', payment_status: 'REFUNDED', linked_inquiry_id: null, needs_attention: true, label: '문의 연결 확인 필요' },
  { name: 'missing inquiry takes priority over failed payment', status: 'PENDING', payment_status: 'FAILED', linked_inquiry_id: null, needs_attention: true, label: '문의 연결 확인 필요' },
] as const) test(`attention label: ${scenario.name}`, () => {
  const row = { ...request(1), needs_reply: false, ...scenario } as unknown as PhoneWorkspaceRequest;
  const before = structuredClone(row);
  expect(getPhoneAttentionLabel(row)).toBe(scenario.label);
  if (scenario.needs_attention) {
    expect(matchesPhoneFilter(row, 'todo')).toBe(true);
    expect(matchesPhoneFilter(row, 'closed')).toBe(false);
  }
  expect(row).toEqual(before);
});

for (const status of ['CANCELLED', 'COMPLETED'] as const) test(`${status} customer reply reopens todo; admin reply returns to closed`, async () => {
  for (const sender of ['guest-1', 'admin']) {
    install(database([request(1, { status, payment_status: 'REFUNDED', updated_at: '2026-09-22T10:00:00Z' })], [{ id: 1, user_id: 'guest-1', type: 'admin_support', inquiry_messages: [{ sender_id: sender, type: 'text', created_at: '2026-09-22T10:05:00Z' }] }]));
    const result = await (await phoneGet(new Request('http://local/api?requestId=request-1'))).json();
    const row = result.data;
    expect(row).toMatchObject({ status, payment_status: 'REFUNDED', needs_attention: false, needs_reply: sender === 'guest-1' });
    expect(matchesPhoneFilter(row, 'todo')).toBe(sender === 'guest-1');
    expect(matchesPhoneFilter(row, 'closed')).toBe(sender === 'admin');
  }
});

test('payment metadata is selected only for authorized detail requests', async () => {
  const db = database([request(1)], [{ id: 1, user_id: 'guest-1', type: 'admin_support' }]); install(db);
  await phoneGet(new Request('http://local/api?filter=all'));
  expect(db.calls.filter(url => url.pathname.endsWith('proxy_requests')).every(url => !url.searchParams.get('select')?.includes('refunded_at'))).toBe(true);
  db.calls.length = 0;
  await phoneGet(new Request('http://local/api?requestId=request-1'));
  expect(db.calls.some(url => url.searchParams.get('select')?.endsWith(',tid,paid_at,refunded_at'))).toBe(true);
});

for (const scenario of [
  { name: 'pre-cancel customer', message: '2026-09-22T09:55:00Z', boundary: '2026-09-22T10:00:00Z', reply: false },
  { name: 'equal timestamp', message: '2026-09-22T10:00:00Z', boundary: '2026-09-22T10:00:00Z', reply: false },
  { name: 'post-cancel customer', message: '2026-09-22T10:05:00Z', boundary: '2026-09-22T10:00:00Z', reply: true },
  { name: 'invalid message', message: 'invalid', boundary: '2026-09-22T10:00:00Z', reply: false },
  { name: 'missing message time', message: null, boundary: '2026-09-22T10:00:00Z', reply: false },
  { name: 'invalid boundary', message: '2026-09-22T10:05:00Z', boundary: 'invalid', reply: false },
  { name: 'missing boundary', message: '2026-09-22T10:05:00Z', boundary: null, reply: false },
  { name: 'admin after follow-up', message: '2026-09-22T10:10:00Z', boundary: '2026-09-22T10:00:00Z', reply: false, admin: true },
]) test(`CANCELLED boundary: ${scenario.name}`, async () => {
  install(database([request(1, { status: 'CANCELLED', payment_status: 'REFUNDED', updated_at: scenario.boundary })], [{
    id: 1, user_id: 'guest-1', type: 'admin_support', inquiry_messages: [
      ...(scenario.admin ? [{ sender_id: 'guest-1', type: 'text', created_at: '2026-09-22T10:05:00Z' }] : []),
      { sender_id: scenario.admin ? 'admin' : 'guest-1', type: 'text', created_at: scenario.message },
    ],
  }]));
  const row = (await (await phoneGet(new Request('http://local/api?requestId=request-1'))).json()).data;
  expect(row.needs_reply).toBe(scenario.reply);
  expect(matchesPhoneFilter(row, 'todo')).toBe(scenario.reply);
  expect(matchesPhoneFilter(row, 'closed')).toBe(!scenario.reply);
});

for (const created_at of [undefined, '2026-09-22T09:55:00Z']) test(`COMPLETED preserves customer follow-up without a cancellation boundary: ${created_at}`, async () => {
  install(database([request(1, { status: 'COMPLETED', updated_at: '2026-09-22T10:00:00Z' })], [{ id: 1, user_id: 'guest-1', type: 'admin_support', inquiry_messages: [{ sender_id: 'guest-1', type: 'text', created_at }] }]));
  const row = (await (await phoneGet(new Request('http://local/api?requestId=request-1'))).json()).data;
  expect(row.needs_reply).toBe(true);
  expect(matchesPhoneFilter(row, 'todo')).toBe(true);
});

test('legacy refund migration closes old customer messages using the update trigger boundary', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE proxy_requests (status text, payment_status text, updated_at timestamptz);
      CREATE FUNCTION set_proxy_requests_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
      CREATE TRIGGER update_timestamp BEFORE UPDATE ON proxy_requests FOR EACH ROW EXECUTE FUNCTION set_proxy_requests_updated_at();
      INSERT INTO proxy_requests VALUES ('PENDING', 'REFUNDED', '2020-01-01T00:00:00Z');`);
    await db.exec(readFileSync('supabase/migrations/20260922125140_close_refunded_phone_proxy_requests.sql', 'utf8'));
    const { rows: [migrated] } = await db.query<{ status: string; payment_status: string; updated_at: Date }>('SELECT * FROM proxy_requests');
    expect(migrated.status).toBe('CANCELLED');
    expect(migrated.updated_at.getTime()).toBeGreaterThan(Date.parse('2020-01-01T09:55:00Z'));
    install(database([request(1, { ...migrated, updated_at: migrated.updated_at.toISOString() })], [{ id: 1, user_id: 'guest-1', type: 'admin_support', inquiry_messages: [{ sender_id: 'guest-1', type: 'text', created_at: '2020-01-01T09:55:00Z' }] }]));
    const row = (await (await phoneGet(new Request('http://local/api?requestId=request-1'))).json()).data;
    expect(row).toMatchObject({ status: 'CANCELLED', payment_status: 'REFUNDED', needs_reply: false });
    expect(matchesPhoneFilter(row, 'todo')).toBe(false);
    expect(matchesPhoneFilter(row, 'closed')).toBe(true);
  } finally { await db.close(); }
});

test('phone timestamps reuse latest actual message and fall back only for display', async () => {
  const created = '2026-09-20T00:00:00Z';
  const updated = '2026-09-21T00:00:00Z';
  const latest = '2026-09-22T15:21:00Z';
  const rows = [request(1, { created_at: created, updated_at: updated }), request(2, { created_at: created, updated_at: updated }), request(3, { created_at: created }), request(4, { created_at: null }), request(5, { updated_at: updated, form_data: {} })];
  const inquiries = rows.slice(0, 4).map((row, i) => ({ id: i + 1, user_id: row.user_id, type: 'admin_support', inquiry_messages: i === 0 ? [{ sender_id: 'guest-1', type: 'text', created_at: latest }] : [] }));
  const db = database(rows, inquiries); install(db);
  const read = async () => (await (await phoneGet(new Request('http://local/api?filter=all'))).json()).data;
  expect((await read()).map((row: PhoneWorkspaceRequest) => row.latest_created_at)).toEqual([latest, updated, created, null, updated]);
  inquiries[0].inquiry_messages.push({ sender_id: 'guest-1', type: 'text', created_at: '2026-09-22T15:25:00Z' });
  expect((await read())[0].latest_created_at).toBe('2026-09-22T15:25:00Z');
  expect(db.calls.filter(url => url.pathname.endsWith('inquiries')).every(url => url.searchParams.get('inquiry_messages.limit') === '1')).toBe(true);
});
