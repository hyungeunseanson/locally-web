import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';

const migrationPath = 'supabase/migrations/20260922150728_ops_anomaly_monitor_snapshot.sql';
const signature = 'public.get_ops_anomaly_snapshot(timestamp with time zone,integer,integer,integer,integer,integer,integer)';
const observedAt = '2026-09-22T16:00:00.000Z';
const db = new PGlite();

await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role BYPASSRLS;
  GRANT USAGE ON SCHEMA public TO service_role;

  CREATE TABLE public.bookings (
    id bigint PRIMARY KEY,
    status text,
    tid text,
    payment_method text,
    payment_claim_state text,
    payment_claim_expires_at timestamptz,
    created_at timestamptz NOT NULL,
    solo_guarantee_refund_status text,
    payout_status text,
    host_payout_amount numeric
  );
  CREATE TABLE public.service_refund_operations (
    booking_id bigint NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  );
  CREATE TABLE public.service_requests (
    id bigint PRIMARY KEY,
    service_end_at timestamptz
  );
  CREATE TABLE public.service_bookings (
    id bigint PRIMARY KEY,
    request_id bigint,
    status text,
    payout_status text,
    host_id uuid,
    host_payout_amount numeric,
    host_compensation_amount numeric,
    created_at timestamptz NOT NULL
  );
  CREATE TABLE public.admin_job_runs (
    job_name text NOT NULL,
    status text NOT NULL,
    started_at timestamptz NOT NULL,
    lease_expires_at timestamptz
  );
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
`);

const migration = await readFile(migrationPath, 'utf8');
await db.exec(migration);

for (const role of ['PUBLIC', 'anon', 'authenticated', 'service_role']) {
  const grantee = role === 'PUBLIC' ? 'public' : role;
  const allowed = (await db.query(
    `SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed`,
    [grantee, signature]
  )).rows[0].allowed;
  assert.equal(allowed, role === 'service_role', `${role} execute ACL mismatch`);
}

const contract = (await db.query(`
  SELECT procedure.prosecdef AS security_definer, procedure.provolatile AS volatility,
         procedure.proconfig AS settings
  FROM pg_proc procedure
  JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'get_ops_anomaly_snapshot'
`)).rows[0];
assert.equal(contract.security_definer, false);
assert.equal(contract.volatility, 's');
assert.deepEqual(contract.settings, ['search_path=""']);

async function snapshot() {
  await db.exec('BEGIN');
  try {
    await db.exec('SET LOCAL ROLE service_role');
    const result = await db.query(`
      SELECT * FROM public.get_ops_anomaly_snapshot(
        $1::timestamptz, 45, 30, 90, 180, 180, 75
      ) ORDER BY diagnostic_code
    `, [observedAt]);
    await db.exec('COMMIT');
    return result.rows;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

await db.query(`
  INSERT INTO public.admin_job_runs (job_name, status, started_at, lease_expires_at)
  VALUES
    ('experience_completion_sync', 'success', $1::timestamptz - interval '10 minutes', NULL),
    ('service_completion_sync', 'success', $1::timestamptz - interval '10 minutes', NULL),
    ('cancel_pending_bookings', 'success', $1::timestamptz - interval '10 minutes', NULL)
`, [observedAt]);
assert.deepEqual(await snapshot(), []);

await db.query(`
  INSERT INTO public.bookings (
    id, status, tid, payment_method, payment_claim_state,
    payment_claim_expires_at, created_at, payout_status, host_payout_amount
  ) VALUES
    (1, 'PENDING', NULL, 'card', 'reconciliation_required', $1::timestamptz - interval '1 hour', $1::timestamptz - interval '2 hours', NULL, NULL),
    (2, 'PENDING', 'provider-tid', 'card', 'completed', NULL, $1::timestamptz - interval '3 hours', NULL, NULL),
    (3, 'completed', 'paid-tid', 'card', 'completed', NULL, $1::timestamptz - interval '91 days', 'pending', 100),
    (4, 'PENDING', NULL, 'card', 'processing', $1::timestamptz - interval '45 minutes', $1::timestamptz - interval '1 hour', NULL, NULL)
`, [observedAt]);
await db.query(`
  INSERT INTO public.service_refund_operations (booking_id, status, created_at, updated_at)
  VALUES (10, 'pending', $1::timestamptz - interval '2 hours', $1::timestamptz - interval '31 minutes')
`, [observedAt]);
await db.query(`
  INSERT INTO public.admin_job_runs (job_name, status, started_at, lease_expires_at)
  VALUES ('cancel_pending_bookings', 'failed', $1::timestamptz - interval '5 minutes', NULL)
`, [observedAt]);

const beforeCounts = (await db.query(`
  SELECT
    (SELECT count(*) FROM public.bookings)::int AS bookings,
    (SELECT count(*) FROM public.service_refund_operations)::int AS refunds,
    (SELECT count(*) FROM public.admin_job_runs)::int AS jobs
`)).rows[0];
const rows = await snapshot();
const afterCounts = (await db.query(`
  SELECT
    (SELECT count(*) FROM public.bookings)::int AS bookings,
    (SELECT count(*) FROM public.service_refund_operations)::int AS refunds,
    (SELECT count(*) FROM public.admin_job_runs)::int AS jobs
`)).rows[0];
assert.deepEqual(afterCounts, beforeCounts);

const byCode = new Map(rows.map((row) => [row.diagnostic_code, row]));
assert.equal(Number(byCode.get('payment_reconciliation_required').anomaly_count), 1);
assert.equal(Number(byCode.get('payment_state_inconsistent').anomaly_count), 1);
assert.equal(Number(byCode.get('refund_attention_required').anomaly_count), 1);
assert.equal(Number(byCode.get('payout_attention_required').anomaly_count), 1);
assert.equal(Number(byCode.get('job_stale_or_failed').anomaly_count), 1);
assert.equal(byCode.get('payment_state_inconsistent').aggregate_details.overdue_claim, 0);
assert.equal(
  new Date(byCode.get('payment_state_inconsistent').oldest_observed_at).toISOString(),
  '2026-09-22T13:00:00.000Z'
);

await assert.rejects(async () => {
  await db.exec('BEGIN');
  try {
    await db.exec('SET LOCAL ROLE anon');
    await db.query(`SELECT * FROM public.get_ops_anomaly_snapshot($1::timestamptz)`, [observedAt]);
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}, /permission denied for function/i);

console.log(JSON.stringify({
  result: 'OPS_ANOMALY_MONITOR_POSTGRES_CONTRACT_PASS',
  diagnostics: [...byCode.keys()],
  businessMutation: false,
  serviceRoleOnly: true,
}, null, 2));

await db.close();
