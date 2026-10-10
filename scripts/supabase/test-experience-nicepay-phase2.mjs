import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

// Disposable local Postgres only. Never accepts a remote URL or production credentials.
const dir = await mkdtemp(join(tmpdir(), 'locally-nicepay-phase2-'));
let db = new PGlite(dir);
const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const cases = [];
async function asRole(role, sql, params = []) {
  await db.exec('BEGIN');
  try {
    await db.query("SELECT set_config('request.jwt.claim.role', $1, true)", [role]);
    await db.exec(`SET LOCAL ROLE ${role}`);
    const result = await db.query(sql, params);
    await db.exec('COMMIT');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
async function rpc(name, params) {
  const placeholders = params.map((_, i) => `$${i + 1}`).join(',');
  const result = await asRole('service_role', `SELECT public.${name}(${placeholders}) AS result`, params);
  return result.rows[0].result;
}
async function booking(id, state = 'processing', amount = 110000) {
  await db.query(`INSERT INTO public.bookings
    (id, order_id, user_id, experience_id, amount, total_price, status,
     guests, date, time, type, contact_name, contact_phone, message,
     payment_method, payment_claim_state, payment_provider, payment_provider_reference,
     is_solo_guarantee, solo_guarantee_price)
    VALUES ($1,$1,$2,1,$3,100000,'PENDING',1,'2026-12-01','10:00','group',
     'Fixture','01000000000','','card',$4,'nicepay',$1,false,0)`, [id, user, amount, state]);
}
async function prepare(id, amount = 110000) {
  return rpc('prepare_experience_nicepay_attempt_atomic', [id, id, 'testmid00m', amount]);
}
async function observe(id, tid, amount = 110000) {
  return rpc('observe_experience_nicepay_auth_atomic', [id, id, tid, 'testmid00m', amount]);
}
async function record(id, tid, amount = 110000) {
  return rpc('record_experience_nicepay_approval_atomic', [id, id, tid, 'testmid00m', amount]);
}
async function release(id, state) {
  return rpc('release_experience_nicepay_hold_atomic', [id, user, state]);
}
async function check(label, fn) {
  await fn(); cases.push(label); console.log(`PASS ${label}`);
}
try {
  const oldScript = await readFile('scripts/supabase/test-experience-payment-claim.mjs', 'utf8');
  const baseSchemaBody = oldScript.match(/await db\.exec\(`\s*CREATE ROLE anon;([\s\S]*?)`\);/)?.[1];
  const baseSchema = baseSchemaBody && `CREATE ROLE anon;${baseSchemaBody}`;
  assert.ok(baseSchema, 'local baseline fixture available');
  await db.exec(baseSchema);
  await db.exec(await readFile('supabase/migrations/20260922081710_experience_payment_claim_and_pending_cleanup.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261011000100_experience_nicepay_recovery.sql', 'utf8'));

  await check('approval success and DB success, settlement preserved', async () => {
    const id = 'ORD-PHASE2-SUCCESS'; const tid = 'TID-PHASE2-SUCCESS';
    await booking(id);
    assert.equal(await prepare(id), 'claimed');
    assert.equal(await observe(id, tid), 'auth_received');
    assert.equal(await rpc('begin_experience_nicepay_approval_atomic', [id, tid]), 'started');
    assert.equal(await record(id, tid), 'recorded');
    const confirmation = await rpc('confirm_experience_payment_atomic', [id, 'nicepay', id, tid, 110000]);
    assert.equal(confirmation, 'confirmed_now');
    assert.equal(await rpc('confirm_experience_nicepay_recovery_atomic', [id, tid]), 'confirmed');
    const { rows: [row] } = await db.query('SELECT status, tid, host_payout_amount, platform_revenue, payment_claim_state FROM public.bookings WHERE id=$1', [id]);
    assert.equal(row.status, 'PAID'); assert.equal(row.tid, tid);
    assert.equal(row.payment_claim_state, 'completed');
    assert.ok(row.host_payout_amount > 0); assert.ok(row.platform_revenue >= 0);
  });

  await check('approval saved before DB failure and restart recovery', async () => {
    const id = 'ORD-PHASE2-RESTART'; const tid = 'TID-PHASE2-RESTART';
    await booking(id); await prepare(id); await observe(id, tid);
    await rpc('begin_experience_nicepay_approval_atomic', [id, tid]);
    await record(id, tid);
    await db.close(); db = new PGlite(dir);
    const { rows: [proof] } = await db.query('SELECT state, tid, amount, mid FROM public.experience_nicepay_recovery WHERE booking_id=$1', [id]);
    assert.deepEqual([proof.state, proof.tid, proof.amount, proof.mid], ['approved', tid, 110000, 'testmid00m']);
    assert.equal(await rpc('confirm_experience_payment_atomic', [id, 'nicepay', id, tid, 110000]), 'confirmed_now');
    assert.equal(await rpc('confirm_experience_nicepay_recovery_atomic', [id, tid]), 'confirmed');
  });

  await check('unknown network result cannot release an approval in progress', async () => {
    const id = 'ORD-PHASE2-UNKNOWN'; const tid = 'TID-PHASE2-UNKNOWN';
    await booking(id); await prepare(id); await observe(id, tid);
    await rpc('begin_experience_nicepay_approval_atomic', [id, tid]);
    await assert.rejects(release(id, 'missing'), /NICEPAY_RECOVERY_RELEASE_UNSAFE/);
    assert.equal(await rpc('note_experience_nicepay_recovery_atomic', [id, 'provider_query_unavailable', false]), 'retry');
    for (let i = 0; i < 4; i++) await rpc('note_experience_nicepay_recovery_atomic', [id, 'provider_query_unavailable', false]);
    const { rows: [row] } = await db.query('SELECT state, retry_count FROM public.experience_nicepay_recovery WHERE booking_id=$1', [id]);
    assert.deepEqual([row.state, row.retry_count], ['manual_review', 5]);
  });

  await check('duplicate callback and TID uniqueness', async () => {
    const id = 'ORD-PHASE2-DUPLICATE'; const tid = 'TID-PHASE2-DUPLICATE';
    await booking(id); await prepare(id); await observe(id, tid);
    assert.equal(await observe(id, tid), 'auth_received');
    assert.equal(await rpc('begin_experience_nicepay_approval_atomic', [id, tid]), 'started');
    assert.equal(await rpc('begin_experience_nicepay_approval_atomic', [id, tid]), 'approval_started');
    await record(id, tid); await record(id, tid);
    assert.equal(await rpc('confirm_experience_payment_atomic', [id, 'nicepay', id, tid, 110000]), 'confirmed_now');
    assert.equal(await rpc('confirm_experience_payment_atomic', [id, 'nicepay', id, tid, 110000]), 'already_processed');
    await booking('ORD-PHASE2-OTHER'); await prepare('ORD-PHASE2-OTHER');
    await assert.rejects(observe('ORD-PHASE2-OTHER', tid));
  });

  await check('popup close before auth releases exactly once', async () => {
    const id = 'ORD-PHASE2-CLOSE'; await booking(id); await prepare(id);
    await rpc('interrupt_experience_nicepay_attempt_atomic', [id, user]);
    assert.equal(await release(id, 'no_auth'), 'released');
    assert.equal(await release(id, 'no_auth'), 'already_released');
    await assert.rejects(observe(id, 'TID-LATE'), /NICEPAY_RECOVERY_AUTH_CONFLICT/);
  });

  await check('five minute timeout with TID needs provider absence proof', async () => {
    const id = 'ORD-PHASE2-TIMEOUT'; const tid = 'TID-PHASE2-TIMEOUT';
    await booking(id); await prepare(id); await observe(id, tid);
    await assert.rejects(release(id, 'no_auth'), /NICEPAY_RECOVERY_RELEASE_UNSAFE/);
    await rpc('interrupt_experience_nicepay_attempt_atomic', [id, user]);
    assert.equal(await release(id, 'missing'), 'released');
    await assert.rejects(rpc('begin_experience_nicepay_approval_atomic', [id, tid]), /NICEPAY_RECOVERY_APPROVAL_CONFLICT/);
  });

  await check('approval started only releases after provider cancellation', async () => {
    const id = 'ORD-PHASE2-STARTED'; const tid = 'TID-PHASE2-STARTED';
    await booking(id); await prepare(id); await observe(id, tid);
    await rpc('begin_experience_nicepay_approval_atomic', [id, tid]);
    await assert.rejects(release(id, 'missing'), /NICEPAY_RECOVERY_RELEASE_UNSAFE/);
    assert.equal(await release(id, 'cancelled'), 'released');
  });

  await check('customer and cleanup style repeat calls are idempotent', async () => {
    const id = 'ORD-PHASE2-RACE'; await booking(id); await prepare(id);
    const results = await Promise.all([release(id, 'no_auth'), release(id, 'no_auth')]);
    assert.deepEqual(results.sort(), ['already_released', 'released']);
    const { rows: [row] } = await db.query('SELECT status, payment_claim_state FROM public.bookings WHERE id=$1', [id]);
    assert.deepEqual([row.status, row.payment_claim_state], ['cancelled', 'released']);
  });

  await check('mismatched MID, order, TID and amount are rejected', async () => {
    const id = 'ORD-PHASE2-VERIFY'; await booking(id); await prepare(id);
    await assert.rejects(rpc('observe_experience_nicepay_auth_atomic', [id, id, 'TID-X', 'wrongmid', 110000]));
    await assert.rejects(rpc('observe_experience_nicepay_auth_atomic', [id, 'WRONG', 'TID-X', 'testmid00m', 110000]));
    await assert.rejects(rpc('observe_experience_nicepay_auth_atomic', [id, id, 'TID-X', 'testmid00m', 1]));
    await observe(id, 'TID-CORRECT');
    await assert.rejects(rpc('begin_experience_nicepay_approval_atomic', [id, 'TID-WRONG']));
  });

  await check('late approval is logged for manual review without automatic refund', async () => {
    const id = 'ORD-PHASE2-LATE'; const tid = 'TID-PHASE2-LATE';
    await booking(id); await prepare(id); await release(id, 'no_auth');
    assert.equal(await record(id, tid), 'late_approval');
    const { rows: [row] } = await db.query('SELECT state, last_error_code FROM public.experience_nicepay_recovery WHERE booking_id=$1', [id]);
    assert.deepEqual([row.state, row.last_error_code], ['manual_review', 'late_approval_after_release']);
    const { rows: [bookingRow] } = await db.query('SELECT status, refund_amount, host_payout_amount FROM public.bookings WHERE id=$1', [id]);
    assert.deepEqual([bookingRow.status, bookingRow.refund_amount, bookingRow.host_payout_amount], ['cancelled', 0, 0]);
    const { rows: [events] } = await db.query('SELECT count(*)::int AS count FROM public.experience_nicepay_recovery_events WHERE booking_id=$1', [id]);
    assert.ok(events.count >= 3);
  });

  await check('authenticated role cannot write recovery ledger', async () => {
    await assert.rejects(asRole('authenticated', "SELECT public.note_experience_nicepay_recovery_atomic('ORD-PHASE2-LATE','bad',true)"));
    await assert.rejects(asRole('authenticated', 'SELECT * FROM public.experience_nicepay_recovery'));
  });

  console.log(`PASS ${cases.length} local PGlite Phase 2 cases`);
} finally {
  await db.close();
  await rm(dir, { recursive: true, force: true });
}
