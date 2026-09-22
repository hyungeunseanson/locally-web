import '../e2e/helpers/serverOnlyTestShim';
import { test, expect } from '@playwright/test';
import * as shared from '@/app/api/admin/proxy-bookings/shared';
import * as card from '@/app/utils/payments/card/server';
import * as notifications from '@/app/utils/proxyBookingNotifications';
import * as admin from '@/app/utils/supabase/admin';
import { POST } from '@/app/api/admin/proxy-bookings/refund-payment/route';
import { getProxyRequestFeeKrw } from '@/app/utils/proxyBooking';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const original = { access: shared.requireAdminProxyBooking, cancel: card.cancelCardPayment, notify: notifications.notifyProxyPaymentEvent, audit: admin.recordAuditLog };
test.afterEach(() => { Object.assign(shared, { requireAdminProxyBooking: original.access }); Object.assign(card, { cancelCardPayment: original.cancel }); Object.assign(notifications, { notifyProxyPaymentEvent: original.notify }); Object.assign(admin, { recordAuditLog: original.audit }); });

for (const status of ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const) {
  for (const mode of ['bank', 'card', 'provider-failure', 'concurrent-update'] as const) test(`refund ${status}/${mode} preserves provider and atomic state contracts`, async () => {
    const request = { id: 'request', status, payment_status: 'COMPLETED', category: 'RESTAURANT', payment_channel: 'LOCALLY', form_data: { payment_method: mode === 'bank' ? 'bank' : 'card' }, locally_order_id: 'order', tid: 'transaction' };
    const updates: Record<string, unknown>[] = [], guards: unknown[] = [], events: unknown[] = [], audits: unknown[] = [], refunds: unknown[] = [];
    const chain = { eq: (...args: unknown[]) => { guards.push(args); return chain; }, select: () => chain, maybeSingle: async () => ({ data: mode === 'concurrent-update' ? null : { id: 'request' }, error: null }) };
    const db = { from: () => ({ update: (payload: Record<string, unknown>) => { updates.push(payload); return chain; } }) };
    Object.assign(shared, { requireAdminProxyBooking: async () => ({ user: { id: 'admin', email: 'admin@example.test' }, supabaseAdmin: db, proxyRequest: request }) });
    Object.assign(card, { cancelCardPayment: async (args: unknown) => { refunds.push(args); if (mode === 'provider-failure') throw new Error('fixture provider failure'); } });
    Object.assign(notifications, { notifyProxyPaymentEvent: async (args: unknown) => { events.push(args); } });
    Object.assign(admin, { recordAuditLog: async (args: unknown) => { audits.push(args); } });
    const result = await POST(new Request('http://local/api', { method: 'POST', body: JSON.stringify({ requestId: 'request' }) }));
    expect(result.status).toBe(mode === 'provider-failure' ? 500 : mode === 'concurrent-update' ? 409 : 200);
    if (mode !== 'bank') expect(refunds).toEqual([{ providerTransactionId: 'transaction', orderId: 'order', cancelAmount: getProxyRequestFeeKrw('RESTAURANT', request.form_data), totalAmount: getProxyRequestFeeKrw('RESTAURANT', request.form_data), cancelReason: '전화 예약 환불 처리', requireMerchantKey: true, acceptedResultCodes: ['2001', '2030'] }]);
    if (mode === 'provider-failure') { expect(updates).toHaveLength(0); expect(events).toHaveLength(0); expect(audits).toHaveLength(0); return; }
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ payment_status: 'REFUNDED', refunded_at: expect.any(String), ...(['PENDING', 'IN_PROGRESS'].includes(status) ? { status: 'CANCELLED' } : {}) });
    expect(guards).toEqual([['id', 'request'], ['payment_status', 'COMPLETED']]);
    expect(events).toHaveLength(mode === 'concurrent-update' ? 0 : 1);
    expect(audits).toHaveLength(mode === 'concurrent-update' ? 0 : 1);
    if (events.length) expect(events[0]).toEqual({ event: 'refunded', request });
    if (audits.length) expect(audits[0]).toMatchObject({ action_type: 'ADMIN_REFUND_PROXY_PAYMENT', target_id: 'request' });
  });
}

test('data correction changes only active refunded status and is idempotent', async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE proxy_requests(id int, status text, payment_status text, form_data jsonb); CREATE TABLE inquiry_messages(content text); INSERT INTO inquiry_messages VALUES ('unchanged');");
    let id = 0;
    for (const status of ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']) for (const payment of ['REFUNDED', 'WAITING', 'COMPLETED', 'FAILED']) await db.query('INSERT INTO proxy_requests VALUES ($1,$2,$3,$4)', [++id, status, payment, { linked_inquiry_id: '1' }]);
    const before = (await db.query<{id: number;status:string;payment_status:string;form_data:unknown}>('SELECT * FROM proxy_requests ORDER BY id')).rows;
    const sql = readFileSync('supabase/migrations/20260922125140_close_refunded_phone_proxy_requests.sql', 'utf8');
    const first = await db.exec(sql);
    expect(first[1].affectedRows).toBe(2);
    const after = (await db.query('SELECT * FROM proxy_requests ORDER BY id')).rows;
    expect(after).toEqual(before.map(row => row.payment_status === 'REFUNDED' && ['PENDING', 'IN_PROGRESS'].includes(row.status) ? { ...row, status: 'CANCELLED' } : row));
    const second = await db.exec(sql);
    expect(second[1].affectedRows).toBe(0);
    expect((await db.query('SELECT * FROM inquiry_messages')).rows).toEqual([{ content: 'unchanged' }]);
  } finally { await db.close(); }
});
