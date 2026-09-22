import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const db = new PGlite();

async function asRole(role, sql, params = []) {
  await db.exec('BEGIN');
  try {
    await db.query(`SELECT set_config('request.jwt.claim.role', $1, true)`, [role]);
    await db.exec(`SET LOCAL ROLE ${role}`);
    const result = await db.query(sql, params);
    await db.exec('COMMIT');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

async function initialize() {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE SCHEMA extensions;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT current_setting('request.jwt.claim.role', true)
    $$;
    CREATE FUNCTION extensions.gen_random_uuid() RETURNS uuid LANGUAGE sql VOLATILE AS $$
      SELECT md5(random()::text || clock_timestamp()::text)::uuid
    $$;

    CREATE TABLE public.experiences (
      id bigint PRIMARY KEY,
      host_id uuid,
      title text,
      price numeric,
      private_price numeric,
      max_guests integer,
      solo_guarantee_price numeric
    );

    CREATE TABLE public.bookings (
      id text PRIMARY KEY,
      created_at timestamptz DEFAULT now() NOT NULL,
      user_id uuid,
      amount integer NOT NULL,
      order_id text NOT NULL UNIQUE,
      status text DEFAULT 'PAID',
      experience_id bigint,
      is_private boolean DEFAULT false,
      date date,
      time text,
      type text,
      guests integer,
      total_price integer,
      cancel_reason text,
      contact_name text,
      contact_phone text,
      message text,
      tid text,
      refund_amount integer DEFAULT 0,
      host_payout_amount integer DEFAULT 0,
      platform_revenue integer DEFAULT 0,
      payout_status text DEFAULT 'pending',
      price_at_booking numeric DEFAULT 0,
      total_experience_price numeric DEFAULT 0,
      payment_method text DEFAULT 'card',
      is_solo_guarantee boolean DEFAULT false NOT NULL,
      solo_guarantee_price integer DEFAULT 0 NOT NULL,
      payout_paid_at timestamptz,
      solo_guarantee_refund_status text DEFAULT 'not_applicable' NOT NULL,
      solo_guarantee_refund_amount integer DEFAULT 0 NOT NULL,
      solo_guarantee_refunded_at timestamptz,
      solo_guarantee_refund_error text,
      solo_guarantee_refund_trigger_booking_id text,
      guest_age_band text,
      guest_gender text
    );

    GRANT SELECT, INSERT, UPDATE ON public.bookings TO anon, authenticated;

    INSERT INTO public.experiences (
      id, host_id, title, price, private_price, max_guests, solo_guarantee_price
    ) VALUES (
      1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Atomic payment fixture',
      100000, 300000, 10, 30000
    );
  `);

  const migration = await readFile(
    'supabase/migrations/20260922081710_experience_payment_claim_and_pending_cleanup.sql',
    'utf8'
  );
  await db.exec(migration);
}

async function insertBooking({
  id,
  method,
  status = 'PENDING',
  createdAt = new Date().toISOString(),
  time = '10:00',
  amount = 110000,
  claimState = null,
  claimExpiresAt = null,
  provider = null,
  providerReference = null,
}) {
  await db.query(`
    INSERT INTO public.bookings (
      id, order_id, user_id, experience_id, amount, total_price, status,
      guests, date, time, type, contact_name, contact_phone, message,
      created_at, payment_method, is_solo_guarantee, solo_guarantee_price,
      payment_claim_state, payment_claim_expires_at, payment_provider,
      payment_provider_reference
    ) VALUES (
      $1, $1, $2, 1, $3, 100000, $4,
      1, '2026-12-01', $5, 'group', 'Fixture', '01000000000', '',
      $6, $7, false, 0, $8, $9, $10, $11
    )
  `, [
    id,
    USER_ID,
    amount,
    status,
    time,
    createdAt,
    method,
    claimState,
    claimExpiresAt,
    provider,
    providerReference,
  ]);
}

await initialize();

await insertBooking({ id: 'CLIENT-COLUMN-GUARD', method: 'card', time: '09:00' });
await assert.rejects(
  () => asRole(
    'authenticated',
    `UPDATE public.bookings SET payment_claim_state = 'processing' WHERE id = 'CLIENT-COLUMN-GUARD'`
  ),
  /PAYMENT_CLAIM_COLUMNS_FORBIDDEN/
);

const signatures = [
  'public.claim_experience_payment_atomic(text,uuid,text,text)',
  'public.attach_experience_payment_provider_reference_atomic(text,uuid,text,uuid)',
  'public.begin_experience_payment_capture_atomic(text,uuid,text)',
  'public.confirm_experience_payment_atomic(text,text,text,text,integer)',
  'public.confirm_experience_bank_payment_atomic(text)',
  'public.cancel_expired_pending_bookings_atomic(integer)',
];

for (const signature of signatures) {
  for (const role of ['anon', 'authenticated']) {
    const privilege = await db.query(
      `SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed`,
      [role, signature]
    );
    assert.equal(privilege.rows[0].allowed, false, `${role} must not execute ${signature}`);
  }
  const servicePrivilege = await db.query(
    `SELECT has_function_privilege('service_role', $1, 'EXECUTE') AS allowed`,
    [signature]
  );
  assert.equal(servicePrivilege.rows[0].allowed, true);
}

await insertBooking({ id: 'CARD-A', method: 'card' });
const cardClaim = await asRole(
  'service_role',
  `SELECT * FROM public.claim_experience_payment_atomic($1, $2, 'nicepay', $1)`,
  ['CARD-A', USER_ID]
);
assert.equal(cardClaim.rows[0].outcome, 'claimed');
assert.equal(cardClaim.rows[0].provider, 'nicepay');

const cardReplay = await asRole(
  'service_role',
  `SELECT * FROM public.claim_experience_payment_atomic($1, $2, 'nicepay', $1)`,
  ['CARD-A', USER_ID]
);
assert.equal(cardReplay.rows[0].outcome, 'already_claimed');
await assert.rejects(
  () => asRole(
    'service_role',
    `SELECT * FROM public.claim_experience_payment_atomic($1, $2, 'portone', $1)`,
    ['CARD-A', USER_ID]
  ),
  /PAYMENT_CLAIM_PROVIDER_CONFLICT/
);

await db.query(`UPDATE public.bookings SET created_at = now() - interval '31 minutes' WHERE id = 'CARD-A'`);
const activeCleanup = await asRole(
  'service_role',
  `SELECT * FROM public.cancel_expired_pending_bookings_atomic(100)`
);
assert.equal(activeCleanup.rows[0].cancelled_count, 0);
assert.equal(activeCleanup.rows[0].active_skipped_count, 1);

await db.query(`UPDATE public.bookings SET payment_claim_expires_at = now() - interval '1 second' WHERE id = 'CARD-A'`);
const reconcileCleanup = await asRole(
  'service_role',
  `SELECT * FROM public.cancel_expired_pending_bookings_atomic(100)`
);
assert.equal(reconcileCleanup.rows[0].reconciliation_required_count, 1);
assert.equal((await db.query(`SELECT payment_claim_state FROM public.bookings WHERE id='CARD-A'`)).rows[0].payment_claim_state, 'reconciliation_required');

const cardConfirmed = await asRole(
  'service_role',
  `SELECT * FROM public.confirm_experience_payment_atomic($1, 'nicepay', $1, 'CARD-TID-A', 110000)`,
  ['CARD-A']
);
assert.equal(cardConfirmed.rows[0].outcome, 'confirmed_now');
const cardConfirmedAgain = await asRole(
  'service_role',
  `SELECT * FROM public.confirm_experience_payment_atomic($1, 'nicepay', $1, 'CARD-TID-A', 110000)`,
  ['CARD-A']
);
assert.equal(cardConfirmedAgain.rows[0].outcome, 'already_processed');
await assert.rejects(
  () => asRole(
    'service_role',
    `SELECT * FROM public.claim_experience_payment_atomic($1, $2, 'nicepay', $1)`,
    ['CARD-A', USER_ID]
  ),
  /PAYMENT_CLAIM_STATUS_CONFLICT/
);
await assert.rejects(
  () => asRole(
    'service_role',
    `SELECT * FROM public.confirm_experience_payment_atomic($1, 'nicepay', $1, 'WRONG-TID', 110000)`,
    ['CARD-A']
  ),
  /PAYMENT_CONFIRM_ALREADY_PROCESSED_CONFLICT/
);

await insertBooking({ id: 'PAYPAL-A', method: 'paypal', time: '11:00' });
const paypalClaim = await asRole(
  'service_role',
  `SELECT * FROM public.claim_experience_payment_atomic($1, $2, 'paypal', NULL)`,
  ['PAYPAL-A', USER_ID]
);
assert.equal(paypalClaim.rows[0].outcome, 'claimed');
assert.ok(paypalClaim.rows[0].claim_token);
const concurrentClaim = await asRole(
  'service_role',
  `SELECT * FROM public.claim_experience_payment_atomic($1, $2, 'paypal', NULL)`,
  ['PAYPAL-A', USER_ID]
);
assert.equal(concurrentClaim.rows[0].outcome, 'claim_in_progress');

const attached = await asRole(
  'service_role',
  `SELECT * FROM public.attach_experience_payment_provider_reference_atomic($1, $2, 'PAYPAL-ORDER-A', $3)`,
  ['PAYPAL-A', USER_ID, paypalClaim.rows[0].claim_token]
);
assert.equal(attached.rows[0].outcome, 'attached');
const paypalReused = await asRole(
  'service_role',
  `SELECT * FROM public.claim_experience_payment_atomic($1, $2, 'paypal', NULL)`,
  ['PAYPAL-A', USER_ID]
);
assert.equal(paypalReused.rows[0].provider_reference, 'PAYPAL-ORDER-A');
await assert.rejects(
  () => asRole(
    'service_role',
    `SELECT * FROM public.attach_experience_payment_provider_reference_atomic($1, $2, 'PAYPAL-ORDER-B', $3)`,
    ['PAYPAL-A', USER_ID, paypalClaim.rows[0].claim_token]
  ),
  /PAYMENT_REFERENCE_REPLACEMENT_FORBIDDEN/
);

const captureStarted = await asRole(
  'service_role',
  `SELECT * FROM public.begin_experience_payment_capture_atomic($1, $2, 'PAYPAL-ORDER-A')`,
  ['PAYPAL-A', USER_ID]
);
assert.equal(captureStarted.rows[0].outcome, 'capture_started');
const captureReplay = await asRole(
  'service_role',
  `SELECT * FROM public.begin_experience_payment_capture_atomic($1, $2, 'PAYPAL-ORDER-A')`,
  ['PAYPAL-A', USER_ID]
);
assert.equal(captureReplay.rows[0].outcome, 'already_processing');
const paypalConfirmed = await asRole(
  'service_role',
  `SELECT * FROM public.confirm_experience_payment_atomic($1, 'paypal', 'PAYPAL-ORDER-A', 'PAYPAL-CAPTURE-A', 110000)`,
  ['PAYPAL-A']
);
assert.equal(paypalConfirmed.rows[0].outcome, 'confirmed_now');

await insertBooking({
  id: 'PAYPAL-UNCERTAIN',
  method: 'paypal',
  createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
  time: '12:00',
  claimState: 'claimed',
  claimExpiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
  provider: 'paypal',
  providerReference: 'PAYPAL-ORDER-UNCERTAIN',
});
const uncertainCleanup = await asRole(
  'service_role',
  `SELECT * FROM public.cancel_expired_pending_bookings_atomic(100)`
);
assert.equal(uncertainCleanup.rows[0].reconciliation_required_count, 1);

for (const fixture of [
  ['BOUNDARY-CARD-SAFE', 'card', "now() - interval '30 minutes' + interval '1 second'"],
  ['BOUNDARY-PAYPAL-SAFE', 'paypal', "now() - interval '30 minutes' + interval '1 second'"],
  ['BOUNDARY-OTHER-SAFE', 'other', "now() - interval '2 hours' + interval '1 second'"],
  ['BOUNDARY-BANK-SAFE', 'bank', "now() - interval '12 hours' + interval '1 second'"],
  ['BOUNDARY-CARD-EXPIRED', 'card', "now() - interval '30 minutes' - interval '1 second'"],
  ['BOUNDARY-PAYPAL-EXPIRED', 'paypal', "now() - interval '30 minutes' - interval '1 second'"],
  ['BOUNDARY-OTHER-EXPIRED', 'other', "now() - interval '2 hours' - interval '1 second'"],
  ['BOUNDARY-BANK-EXPIRED', 'bank', "now() - interval '12 hours' - interval '1 second'"],
]) {
  await insertBooking({ id: fixture[0], method: fixture[1], time: `17:${fixture[0].slice(-2)}` });
  await db.exec(`UPDATE public.bookings SET created_at = ${fixture[2]} WHERE id = '${fixture[0]}'`);
}
const boundaryCleanup = await asRole(
  'service_role',
  `SELECT * FROM public.cancel_expired_pending_bookings_atomic(100)`
);
assert.equal(boundaryCleanup.rows[0].cancelled_count, 4);
for (const id of [
  'BOUNDARY-CARD-SAFE',
  'BOUNDARY-PAYPAL-SAFE',
  'BOUNDARY-OTHER-SAFE',
  'BOUNDARY-BANK-SAFE',
]) {
  assert.equal((await db.query(`SELECT status FROM public.bookings WHERE id = $1`, [id])).rows[0].status, 'PENDING');
}

await insertBooking({
  id: 'CARD-TOMBSTONE',
  method: 'card',
  createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
  time: '13:00',
});
const tombstoneCleanup = await asRole(
  'service_role',
  `SELECT * FROM public.cancel_expired_pending_bookings_atomic(100)`
);
assert.equal(tombstoneCleanup.rows[0].cancelled_count, 1);
const tombstone = await db.query(`SELECT status, cancel_reason FROM public.bookings WHERE id='CARD-TOMBSTONE'`);
assert.equal(tombstone.rows[0].status, 'cancelled');
assert.equal(tombstone.rows[0].cancel_reason, '카드 결제 미완료 (30분 경과 자동 취소)');

await insertBooking({
  id: 'BANK-CANCELLED-FIRST',
  method: 'bank',
  createdAt: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
  time: '14:00',
});
await asRole('service_role', `SELECT * FROM public.cancel_expired_pending_bookings_atomic(100)`);
await assert.rejects(
  () => asRole(
    'service_role',
    `SELECT * FROM public.confirm_experience_bank_payment_atomic('BANK-CANCELLED-FIRST')`
  ),
  /BANK_CONFIRM_STATUS_CONFLICT/
);

await insertBooking({ id: 'BANK-CONFIRMED-FIRST', method: 'bank', time: '15:00' });
const bankConfirmed = await asRole(
  'service_role',
  `SELECT * FROM public.confirm_experience_bank_payment_atomic('BANK-CONFIRMED-FIRST')`
);
assert.equal(bankConfirmed.rows[0].outcome, 'confirmed_now');
const bankReplay = await asRole(
  'service_role',
  `SELECT * FROM public.confirm_experience_bank_payment_atomic('BANK-CONFIRMED-FIRST')`
);
assert.equal(bankReplay.rows[0].outcome, 'already_processed');

for (let index = 0; index < 101; index += 1) {
  await insertBooking({
    id: `CAP-${String(index).padStart(3, '0')}`,
    method: 'card',
    createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    time: `16:${String(index % 60).padStart(2, '0')}`,
  });
}
const hardCap = await asRole(
  'service_role',
  `SELECT * FROM public.cancel_expired_pending_bookings_atomic(1000)`
);
assert.equal(hardCap.rows[0].cancelled_count, 100);
assert.equal(hardCap.rows[0].has_more, true);
const hardCapRemainder = await asRole(
  'service_role',
  `SELECT * FROM public.cancel_expired_pending_bookings_atomic(100)`
);
assert.equal(hardCapRemainder.rows[0].cancelled_count, 1);

await insertBooking({
  id: 'CREATE-STALE',
  method: 'card',
  createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
  time: '18:00',
});
const created = await asRole(
  'service_role',
  `SELECT * FROM public.create_booking_atomic(
    $1, '1', '2026-12-01', '18:00', 1, false, 'Fixture', '01000000000', 'card', false
  )`,
  [USER_ID]
);
assert.ok(created.rows[0].new_order_id);
assert.equal(
  (await db.query(`SELECT status FROM public.bookings WHERE id='CREATE-STALE'`)).rows[0].status,
  'cancelled'
);

await insertBooking({
  id: 'CREATE-ACTIVE-CLAIM',
  method: 'card',
  createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
  time: '19:00',
  claimState: 'processing',
  claimExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  provider: 'nicepay',
  providerReference: 'CREATE-ACTIVE-CLAIM',
});
await assert.rejects(
  () => asRole(
    'service_role',
    `SELECT * FROM public.create_booking_atomic(
      $1, '1', '2026-12-01', '19:00', 10, false, 'Fixture', '01000000000', 'card', false
    )`,
    [USER_ID]
  ),
  /BOOKING_CONFLICT/
);
assert.equal(
  (await db.query(`SELECT status FROM public.bookings WHERE id='CREATE-ACTIVE-CLAIM'`)).rows[0].status,
  'PENDING'
);

await insertBooking({
  id: 'CREATE-RECONCILIATION',
  method: 'card',
  createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
  time: '20:00',
  claimState: 'reconciliation_required',
  provider: 'nicepay',
  providerReference: 'CREATE-RECONCILIATION',
});
await assert.rejects(
  () => asRole(
    'service_role',
    `SELECT * FROM public.create_booking_atomic(
      $1, '1', '2026-12-01', '20:00', 10, false, 'Fixture', '01000000000', 'card', false
    )`,
    [USER_ID]
  ),
  /BOOKING_CONFLICT/
);
assert.equal(
  (await db.query(`SELECT status FROM public.bookings WHERE id='CREATE-RECONCILIATION'`)).rows[0].status,
  'PENDING'
);

const migration = await readFile(
  'supabase/migrations/20260922081710_experience_payment_claim_and_pending_cleanup.sql',
  'utf8'
);
assert.match(migration, /FOR UPDATE SKIP LOCKED/);
assert.match(migration, /created_at < now\(\) - CASE/);
assert.doesNotMatch(migration, /DELETE\s+FROM\s+public\.bookings/i);

console.log(JSON.stringify({
  result: 'EXPERIENCE_PAYMENT_CLAIM_RUNTIME_PASS',
  serviceRoleOnlyRpcCount: signatures.length,
  cardClaimAndConfirmation: 'pass',
  paypalSingleOrderAndCapture: 'pass',
  bankConfirmationRace: 'pass',
  cleanupHardCap: 100,
  cardTombstonePreserved: true,
}, null, 2));

await db.close();
