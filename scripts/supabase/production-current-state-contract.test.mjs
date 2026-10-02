// In-memory PostgreSQL only. No URL, credentials, or network DB client is used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const current = await readFile('supabase/staging/current-state-contract.sql', 'utf8');
const staging = await readFile('supabase/staging/schema-contract.sql', 'utf8');
const chat = current.match(/DO \$admin_message_monitoring_contract\$[\s\S]*?\$admin_message_monitoring_contract\$;/)?.[0];
const ledger = current.match(/DO \$admin_monitoring_ledger_contract\$[\s\S]*?\$admin_monitoring_ledger_contract\$;/)?.[0];
assert.ok(chat && ledger);
assert.ok(staging.includes(chat), 'staging and current-state enforce identical chat assertions');

const db = new PGlite();
let driftChecks = 0;
async function verify(sql) {
  try {
    await db.exec(`BEGIN READ ONLY; ${sql} ROLLBACK;`);
  } finally {
    await db.exec('ROLLBACK;');
  }
}
async function rejectDrift(change, restore, pattern, sql = chat) {
  await db.exec(change);
  try {
    await assert.rejects(verify(sql), pattern);
    driftChecks += 1;
  } finally {
    if (typeof restore === 'function') await restore();
    else await db.exec(restore);
  }
  await verify(sql);
}

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE TABLE public.users(id uuid PRIMARY KEY, role text);
    CREATE TABLE public.admin_whitelist(email text);
    CREATE TABLE public.inquiries(id bigint PRIMARY KEY, user_id uuid, host_id uuid, type text, status text, content text, updated_at timestamptz);
    CREATE TABLE public.inquiry_messages(id bigint PRIMARY KEY, inquiry_id bigint REFERENCES public.inquiries(id), sender_id uuid, content text, type text, created_at timestamptz, is_read boolean, read_at timestamptz);
    GRANT ALL ON public.inquiries, public.inquiry_messages TO anon, authenticated, service_role;
    CREATE PUBLICATION supabase_realtime FOR TABLE public.inquiry_messages;
    CREATE SCHEMA supabase_migrations;
    CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY, name text, statements text[]);
  `);
  const phase = await readFile('supabase/migrations/20261001170718_admin_message_monitoring_phase_1.sql', 'utf8');
  const history = await readFile('supabase/migrations/20261002015110_admin_message_monitoring_historical_reinquiry.sql', 'utf8');
  await db.exec(phase);
  // Catalog fixture records the applied SQL bytes, without executing historical repair.
  await db.query('INSERT INTO supabase_migrations.schema_migrations VALUES ($1,$2,$3),($4,$5,$6)', [
    '20261002024534', 'admin_message_monitoring_phase_1', [phase],
    '20261002024638', 'admin_message_monitoring_historical_reinquiry', [history],
  ]);
  await verify(chat);
  await verify(ledger);
  await rejectDrift('GRANT UPDATE ON inquiries TO authenticated', 'REVOKE UPDATE ON inquiries FROM authenticated', /client table or column write grant/);
  await rejectDrift('GRANT UPDATE(content) ON inquiry_messages TO authenticated', 'REVOKE UPDATE(content) ON inquiry_messages FROM authenticated', /client table or column write grant/);
  await rejectDrift('GRANT INSERT(content) ON inquiry_messages TO PUBLIC', 'REVOKE INSERT(content) ON inquiry_messages FROM PUBLIC', /client table or column write grant/);
  await rejectDrift('REVOKE UPDATE ON inquiries FROM service_role', 'GRANT UPDATE ON inquiries TO service_role', /server writes or client SELECT/);
  await rejectDrift('REVOKE SELECT ON inquiries FROM authenticated', 'GRANT SELECT ON inquiries TO authenticated', /server writes or client SELECT/);
  await rejectDrift('CREATE POLICY reopened_write ON inquiries FOR UPDATE USING (true)', 'DROP POLICY reopened_write ON inquiries', /retired chat UPDATE policy/);
  await rejectDrift('ALTER TABLE inquiries DISABLE TRIGGER inquiry_support_version', 'ALTER TABLE inquiries ENABLE TRIGGER inquiry_support_version', /trigger contract mismatch/);
  await rejectDrift('ALTER TABLE inquiry_messages ALTER COLUMN admin_read_at SET DEFAULT now()', 'ALTER TABLE inquiry_messages ALTER COLUMN admin_read_at DROP DEFAULT', /column contract mismatch/);
  await rejectDrift('ALTER INDEX inquiry_messages_admin_activity_idx RENAME TO missing_activity_index', 'ALTER INDEX missing_activity_index RENAME TO inquiry_messages_admin_activity_idx', /index contract mismatch/);
  await rejectDrift('GRANT EXECUTE ON FUNCTION ack_admin_inquiry_messages(bigint,bigint) TO authenticated', 'REVOKE EXECUTE ON FUNCTION ack_admin_inquiry_messages(bigint,bigint) FROM authenticated', /function definition or execute ACL mismatch/);
  await rejectDrift('GRANT EXECUTE ON FUNCTION private.is_inquiry_admin_sender(uuid) TO PUBLIC', 'REVOKE EXECUTE ON FUNCTION private.is_inquiry_admin_sender(uuid) FROM PUBLIC', /function definition or execute ACL mismatch/);
  await rejectDrift("ALTER FUNCTION get_admin_inquiry_activity(bigint[]) SET search_path = public", "ALTER FUNCTION get_admin_inquiry_activity(bigint[]) SET search_path = ''", /function definition or execute ACL mismatch/);
  const originalVersionFunction = (await db.query("SELECT pg_get_functiondef('private.advance_support_version()'::regprocedure) AS definition")).rows[0].definition;
  const weakenedVersionFunction = originalVersionFunction.replace("OLD.updated_at + interval '1 millisecond'", 'OLD.updated_at');
  assert.notEqual(weakenedVersionFunction, originalVersionFunction);
  await rejectDrift(weakenedVersionFunction, originalVersionFunction, /function definition or execute ACL mismatch/);
  await rejectDrift('ALTER PUBLICATION supabase_realtime SET (publish = \'insert\')', 'ALTER PUBLICATION supabase_realtime SET (publish = \'insert, update, delete, truncate\')', /publication configuration/);
  await rejectDrift('ALTER PUBLICATION supabase_realtime SET TABLE public.inquiries(id), public.inquiry_messages',
    'ALTER PUBLICATION supabase_realtime SET TABLE public.inquiries, public.inquiry_messages', /publication configuration or column\/filter/);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET version='20261001170718' WHERE version='20261002024534'", "UPDATE supabase_migrations.schema_migrations SET version='20261002024534' WHERE version='20261001170718'", /applied ledger SQL mapping mismatch/, ledger);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['-- wrong SQL'] WHERE version='20261002024638'",
    () => db.query('UPDATE supabase_migrations.schema_migrations SET statements=$1 WHERE version=$2', [[history], '20261002024638']),
    /applied ledger SQL mapping mismatch/, ledger);
  console.log(JSON.stringify({ result: 'CURRENT_STATE_CATALOG_DRIFT_TEST_PASS', driftChecks, productionMutation: 0 }));
} finally {
  await db.close();
}
