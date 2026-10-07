// In-memory PostgreSQL only. No URL, credentials, or network DB client is used.
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const current = await readFile('supabase/staging/current-state-contract.sql', 'utf8');
const staging = await readFile('supabase/staging/schema-contract.sql', 'utf8');
const chat = current.match(/DO \$admin_message_monitoring_contract\$[\s\S]*?\$admin_message_monitoring_contract\$;/)?.[0];
const ledger = current.match(/DO \$admin_monitoring_ledger_contract\$[\s\S]*?\$admin_monitoring_ledger_contract\$;/)?.[0];
const attention = current.match(/DO \$admin_attention_contract\$[\s\S]*?\$admin_attention_contract\$;/)?.[0];
const marker = current.match(/DO \$admin_attention_production_marker\$[\s\S]*?\$admin_attention_production_marker\$;/)?.[0];
const phone = current.match(/DO \$phone_followup_catalog_contract\$[\s\S]*?\$phone_followup_catalog_contract\$;/)?.[0];
const search = current.match(/DO \$admin_chat_search_contract\$[\s\S]*?\$admin_chat_search_contract\$;/)?.[0];
const phoneSearchLedger = current.match(/DO \$phone_search_ledger_contract\$[\s\S]*?\$phone_search_ledger_contract\$;/)?.[0];
const mediaLedger = current.match(/DO \$media_authority_ledger_contract\$[\s\S]*?\$media_authority_ledger_contract\$;/)?.[0];
const mediaCatalog = current.match(/DO \$applied_media_catalog_contract\$[\s\S]*?\$applied_media_catalog_contract\$;/)?.[0];
const financialLedger = current.match(/DO \$solo_financial_ledger_contract\$[\s\S]*?\$solo_financial_ledger_contract\$;/)?.[0];
const financialCatalog = current.match(/DO \$solo_financial_catalog_contract\$[\s\S]*?\$solo_financial_catalog_contract\$;/)?.[0];
const hostCatalog = current.match(/DO \$host_authority_catalog_contract\$[\s\S]*?\$host_authority_catalog_contract\$;/)?.[0];
const hostProduction = current.match(/DO \$host_authority_production_contract\$[\s\S]*?\$host_authority_production_contract\$;/)?.[0];
const recencyCatalog = current.match(/DO \$admin_chat_recency_catalog_contract\$[\s\S]*?\$admin_chat_recency_catalog_contract\$;/)?.[0];
const recencyLedger = current.match(/DO \$admin_chat_recency_ledger_contract\$[\s\S]*?\$admin_chat_recency_ledger_contract\$;/)?.[0];
assert.ok(recencyCatalog && recencyLedger && staging.includes(recencyCatalog));
assert.ok(!staging.includes(recencyLedger));
const communityCatalog = current.match(/DO \$community_authority_catalog_contract\$[\s\S]*?\$community_authority_catalog_contract\$;/)?.[0];
const communityProduction = current.match(/DO \$community_authority_production_contract\$[\s\S]*?\$community_authority_production_contract\$;/)?.[0];
assert.ok(communityCatalog && communityProduction && staging.includes(communityCatalog) && !staging.includes(communityProduction));
const monitorCatalog = current.match(/DO \$admin_monitor_recency_catalog_contract\$[\s\S]*?\$admin_monitor_recency_catalog_contract\$;/)?.[0];
const monitorLedger = current.match(/DO \$admin_monitor_recency_ledger_contract\$[\s\S]*?\$admin_monitor_recency_ledger_contract\$;/)?.[0];
assert.ok(monitorCatalog && monitorLedger && staging.includes(monitorCatalog) && !staging.includes(monitorLedger));
const productionLedger = current.match(/DO \$current_state_contract\$[\s\S]*?RAISE EXCEPTION 'migration ledger mismatch:[\s\S]*?END IF;/)?.[0]
  + '\nEND\n$current_state_contract$;';
assert.ok(chat && ledger && attention && marker && financialLedger && financialCatalog);
assert.ok(phone && search && phoneSearchLedger);
assert.ok(mediaLedger && mediaCatalog && productionLedger.includes('20261005082309:avatar_media_authority'));
assert.ok(hostCatalog && hostProduction && staging.includes(hostCatalog));
assert.ok(!staging.includes(hostProduction), 'fresh staging does not activate the live Host marker');
assert.ok(staging.includes(phone) && staging.includes(search), 'staging shares applied Phone/search security');
assert.ok(staging.includes(chat), 'staging and current-state enforce identical chat assertions');
assert.ok(staging.includes(attention), 'staging and current-state enforce identical attention security');
assert.ok(!staging.includes(marker), 'fresh staging counters must not pretend to be Production rollout counters');

// A disposable repository fixture proves the static gate does not simply
// ignore extra files, authorize blanket pending applies, or relabel P0 applied.
const repoFixture = await mkdtemp(join(tmpdir(), 'locally-current-contract-'));
let staticDriftChecks = 0;
try {
  for (const directory of ['supabase/migrations','supabase/staging','scripts/supabase']) {
    await cp(directory, join(repoFixture,directory), { recursive:true });
  }
  await symlink(resolve('app'), join(repoFixture,'app'));
  const check = () => spawnSync(process.execPath, ['scripts/supabase/check-production-current-state.mjs'],
    { cwd:repoFixture, encoding:'utf8', timeout:10_000 });
  const valid = check(); assert.equal(valid.status,0,valid.stdout+valid.stderr);
  const requiredPath = join(repoFixture,'supabase/staging/required-objects.json');
  const manifestPath = join(repoFixture,'supabase/staging/production-current-state.manifest.json');
  const originalRequired = await readFile(requiredPath,'utf8');
  const originalManifest = await readFile(manifestPath,'utf8');
  const drift = async (path,value,pattern,restore) => {
    await writeFile(path,typeof value==='string'?value:JSON.stringify(value));
    const result=check(); assert.notEqual(result.status,0); assert.match(result.stderr,pattern);
    staticDriftChecks++;
    if (restore === null) await rm(path); else await writeFile(path,restore);
  };
  const pendingP0 = JSON.parse(originalManifest);
  pendingP0.pendingProductionMigrations=[pendingP0.migrationLedger.pop()];
  await drift(manifestPath,pendingP0,/migration versions differs/,originalManifest);
  const unpinned = JSON.parse(originalManifest);
  unpinned.migrationLedger.at(-1).repositorySha256='0'.repeat(64);
  await drift(manifestPath,unpinned,/repository migration hash differs/,originalManifest);
  const alteredEvidence = JSON.parse(originalManifest);
  alteredEvidence.appliedFinancialAuthority.functions[0].bodyMd5='0'.repeat(32);
  await drift(manifestPath,alteredEvidence,/financial function evidence missing/,originalManifest);
  const blanket = JSON.parse(originalRequired);
  blanket.selectiveProductionRollout.blanketPendingMigrationApply=true;
  await drift(requiredPath,blanket,/selective Production rollout rule differs/,originalRequired);
  await drift(join(repoFixture,'supabase/migrations/20990101000000_unreviewed.sql'),
    '-- synthetic fixture only',/repository migration files differs/,null);
} finally {
  await rm(repoFixture,{recursive:true,force:true});
}

const db = new PGlite({ extensions: { pg_trgm } });
let driftChecks = 0;
async function verify(sql) {
  try {
    await db.exec(`BEGIN READ ONLY; SET LOCAL search_path = public, extensions; ${sql} ROLLBACK;`);
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
    CREATE TABLE public.proxy_requests(id text PRIMARY KEY, user_id uuid, form_data jsonb);
    CREATE TABLE public.inquiries(id bigint PRIMARY KEY, user_id uuid, host_id uuid, type text, status text, content text, updated_at timestamptz);
    CREATE TABLE public.inquiry_messages(id bigint PRIMARY KEY, inquiry_id bigint REFERENCES public.inquiries(id), sender_id uuid, content text, type text, created_at timestamptz, is_read boolean, read_at timestamptz);
    GRANT ALL ON public.inquiries, public.inquiry_messages TO anon, authenticated, service_role;
    CREATE PUBLICATION supabase_realtime FOR TABLE public.inquiry_messages;
    CREATE SCHEMA supabase_migrations;
    CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY, name text, statements text[]);
  `);
  const phase = await readFile('supabase/migrations/20261001170718_admin_message_monitoring_phase_1.sql', 'utf8');
  const history = await readFile('supabase/migrations/20261002015110_admin_message_monitoring_historical_reinquiry.sql', 'utf8');
  const phase2 = await readFile('supabase/migrations/20261002041848_admin_attention_badges_phase_2.sql', 'utf8');
  await db.exec(phase);
  await db.exec(phase2);
  // Local control metadata models the observed immutable Production marker.
  // A new empty staging bootstrap legitimately has 0/0 and passes attention.
  await verify(attention);
  await assert.rejects(verify(marker), /Production cutover marker mismatch/);
  await db.exec("UPDATE private.admin_monitor_cutover SET messages=410,conversations=40,applied_at='2026-10-02T07:51:49.802096Z'");
  // Catalog fixture records the applied SQL bytes, without executing historical repair.
  await db.query('INSERT INTO supabase_migrations.schema_migrations VALUES ($1,$2,$3),($4,$5,$6),($7,$8,$9)', [
    '20261002024534', 'admin_message_monitoring_phase_1', [phase],
    '20261002024638', 'admin_message_monitoring_historical_reinquiry', [history],
    '20261002075149', 'admin_attention_badges_phase_2', [phase2],
  ]);
  await verify(chat);
  await verify(ledger);
  await verify(marker);
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
  await rejectDrift('ALTER INDEX inquiry_messages_admin_unseen_idx RENAME TO missing_unseen_index',
    'ALTER INDEX missing_unseen_index RENAME TO inquiry_messages_admin_unseen_idx', /index contract mismatch/);
  await rejectDrift('GRANT EXECUTE ON FUNCTION get_admin_attention(bigint[]) TO anon',
    'REVOKE EXECUTE ON FUNCTION get_admin_attention(bigint[]) FROM anon', /function definition or execute ACL mismatch/);
  await rejectDrift('REVOKE EXECUTE ON FUNCTION ack_admin_inquiry_snapshot(bigint,bigint[]) FROM service_role',
    'GRANT EXECUTE ON FUNCTION ack_admin_inquiry_snapshot(bigint,bigint[]) TO service_role', /function definition or execute ACL mismatch/);
  await rejectDrift("ALTER FUNCTION get_admin_attention(bigint[]) SET search_path = public",
    "ALTER FUNCTION get_admin_attention(bigint[]) SET search_path = ''", /function definition or execute ACL mismatch/);
  const originalAttention = (await db.query("SELECT pg_get_functiondef('get_admin_attention(bigint[])'::regprocedure) definition")).rows[0].definition;
  await rejectDrift(originalAttention.replace("THEN 'phone' ELSE 'support'", "THEN 'support' ELSE 'support'"),
    originalAttention, /function definition or execute ACL mismatch/);
  await rejectDrift('GRANT UPDATE ON private.admin_monitor_cutover TO authenticated',
    'REVOKE UPDATE ON private.admin_monitor_cutover FROM authenticated', /Invalid monitor cutover record|Public monitor cutover access/, attention);
  await rejectDrift('ALTER TABLE private.admin_monitor_cutover DISABLE ROW LEVEL SECURITY',
    'ALTER TABLE private.admin_monitor_cutover ENABLE ROW LEVEL SECURITY', /Invalid monitor cutover record/, attention);
  await rejectDrift('CREATE POLICY opened_cutover ON private.admin_monitor_cutover FOR SELECT USING (true)',
    'DROP POLICY opened_cutover ON private.admin_monitor_cutover', /Private cutover policy exists/, attention);
  await rejectDrift('ALTER TABLE private.admin_monitor_cutover ALTER COLUMN messages DROP NOT NULL',
    'ALTER TABLE private.admin_monitor_cutover ALTER COLUMN messages SET NOT NULL', /Cutover column contract mismatch/, attention);
  await rejectDrift('ALTER TABLE private.admin_monitor_cutover DROP CONSTRAINT admin_monitor_cutover_singleton_check',
    'ALTER TABLE private.admin_monitor_cutover ADD CONSTRAINT admin_monitor_cutover_singleton_check CHECK(singleton)', /Cutover constraint contract mismatch/, attention);
  await rejectDrift('UPDATE private.admin_monitor_cutover SET messages=411',
    'UPDATE private.admin_monitor_cutover SET messages=410', /Production cutover marker mismatch/, marker);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET version='20261002041848' WHERE version='20261002075149'",
    "UPDATE supabase_migrations.schema_migrations SET version='20261002075149' WHERE version='20261002041848'", /applied ledger SQL mapping mismatch/, ledger);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['-- altered Phase 2'] WHERE version='20261002075149'",
    () => db.query('UPDATE supabase_migrations.schema_migrations SET statements=$1 WHERE version=$2', [[phase2], '20261002075149']),
    /applied ledger SQL mapping mismatch/, ledger);
  // Extend the isolated fixture to the two observed releases. Production is
  // never connected: historical seeding here operates on empty local tables.
  await db.exec(`CREATE SCHEMA extensions;
    ALTER TABLE proxy_requests ALTER COLUMN id TYPE uuid USING id::uuid;
    ALTER TABLE proxy_requests ADD COLUMN status text, ADD COLUMN payment_status text,
      ADD COLUMN category text, ADD COLUMN locally_order_id text;
    ALTER TABLE inquiries ADD COLUMN experience_id bigint;
    ALTER TABLE inquiry_messages ADD COLUMN image_url text;
    CREATE TABLE profiles(id uuid PRIMARY KEY, full_name text, email text);
    CREATE TABLE experiences(id bigint PRIMARY KEY, title text);`);
  const phoneMigration = await readFile('supabase/migrations/20261002140902_phone_followup_tasks.sql', 'utf8');
  const searchMigration = await readFile('supabase/migrations/20261003122803_admin_chat_bounded_search.sql', 'utf8');
  await db.exec(phoneMigration);
  await db.exec(searchMigration);
  await db.query('INSERT INTO supabase_migrations.schema_migrations VALUES ($1,$2,$3),($4,$5,$6)', [
    '20261003012400', 'phone_followup_tasks', [phoneMigration],
    '20261003134417', 'admin_chat_bounded_search', [searchMigration],
  ]);
  await verify(phone); await verify(search); await verify(phoneSearchLedger); await verify(attention);
  await rejectDrift('GRANT EXECUTE ON FUNCTION search_admin_chat(text,text) TO PUBLIC',
    'REVOKE EXECUTE ON FUNCTION search_admin_chat(text,text) FROM PUBLIC', /function body or ACL mismatch/, search);
  await rejectDrift('REVOKE EXECUTE ON FUNCTION private.admin_chat_phone_title(text,jsonb) FROM authenticated',
    'REVOKE EXECUTE ON FUNCTION private.admin_chat_phone_title(text,jsonb) FROM anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.admin_chat_phone_title(text,jsonb) TO anon, authenticated, service_role',
    /function body or ACL mismatch/, search);
  const originalSearch = (await db.query("SELECT pg_get_functiondef('search_admin_chat(text,text)'::regprocedure) definition")).rows[0].definition;
  await rejectDrift(originalSearch.replaceAll('LIMIT 25', 'LIMIT 26'), originalSearch, /function body or ACL mismatch/, search);
  await rejectDrift('ALTER INDEX admin_chat_phone_title_search RENAME TO missing_search_index',
    'ALTER INDEX missing_search_index RENAME TO admin_chat_phone_title_search', /index contract mismatch/, search);
  await rejectDrift('GRANT SELECT ON private.phone_followup_tasks TO service_role',
    'REVOKE SELECT ON private.phone_followup_tasks FROM service_role', /Phone task table security mismatch|Direct Phone task access/, phone);
  await rejectDrift('ALTER TABLE private.phone_followup_tasks DISABLE ROW LEVEL SECURITY',
    'ALTER TABLE private.phone_followup_tasks ENABLE ROW LEVEL SECURITY', /Phone task table security mismatch/, phone);
  await rejectDrift('GRANT EXECUTE ON FUNCTION get_admin_phone_activity(bigint[]) TO anon',
    'REVOKE EXECUTE ON FUNCTION get_admin_phone_activity(bigint[]) FROM anon', /function body or ACL mismatch/, phone);
  await rejectDrift('ALTER INDEX private.phone_followup_pending_idx RENAME TO missing_phone_index',
    'ALTER INDEX private.missing_phone_index RENAME TO phone_followup_pending_idx', /index contract mismatch/, phone);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['-- wrong search SQL'] WHERE version='20261003134417'",
    () => db.query('UPDATE supabase_migrations.schema_migrations SET statements=$1 WHERE version=$2', [[searchMigration], '20261003134417']),
    /applied ledger SQL mapping mismatch/, phoneSearchLedger);
  // Apply unchanged media SQL to empty local fixtures only, then validate the
  // read-only catalog evidence. No asset/upload/Storage/provider API is called.
  await db.exec(`CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    ALTER TABLE experiences ADD COLUMN host_id uuid, ADD COLUMN photos text[], ADD COLUMN image_url text,
      ADD COLUMN itinerary jsonb, ADD COLUMN itinerary_i18n jsonb;
    ALTER TABLE profiles ADD COLUMN avatar_url text;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text,public boolean);
    CREATE TABLE storage.objects(name text,owner_id text,metadata jsonb,version text,updated_at timestamptz,bucket_id text);`);
  const mediaMigration = await readFile('supabase/migrations/20261004053224_media_lifecycle_foundation.sql', 'utf8');
  const avatarMigration = await readFile('supabase/migrations/20261005082309_avatar_media_authority.sql', 'utf8');
  await db.exec(mediaMigration); await db.exec(avatarMigration);
  const manifest = JSON.parse(await readFile('supabase/staging/production-current-state.manifest.json', 'utf8'));
  for (const entry of manifest.migrationLedger) {
    const sql = await readFile(entry.repositoryFile, 'utf8');
    await db.query('INSERT INTO supabase_migrations.schema_migrations VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [entry.version,entry.name,[sql]]);
  }
  // Apply the unchanged reviewed P0 SQL to disposable empty financial tables.
  // This extends the catalog fixture; it never calls a money RPC/provider.
  const financialFixture = JSON.parse(await readFile('tests/integration/fixtures/solo-pre-p0-schema.json','utf8'));
  const type = column => column.data_type === 'ARRAY' ? 'text[]' : column.data_type === 'USER-DEFINED' ? 'text' : column.data_type;
  const bookingColumns = financialFixture.columns.filter(c => c.table_name === 'bookings')
    .map(c => `"${c.column_name}" ${type(c)}${c.column_name === 'id' ? ' PRIMARY KEY' : ''}`);
  await db.exec(`CREATE TABLE public.bookings (${bookingColumns.join(',')});
    ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.bookings TO anon,authenticated,service_role;
    ALTER TABLE public.experiences ADD COLUMN duration integer;
    CREATE TABLE public.notifications(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,user_id uuid,type text,title text,message text,link text,is_read boolean,created_at timestamptz,booking_id text);
    CREATE TABLE public.admin_manual_payouts(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,request_key uuid UNIQUE,host_id uuid,settlement_type text,booking_ids text[],booking_snapshot jsonb,current_booking_amount integer,legacy_amount integer,total_paid_amount integer,reason text,legacy_source_reference text,transfer_reference text,bank_name text,account_number text,account_holder text,paid_by_admin_id uuid,paid_by_admin_email text,paid_at timestamptz,created_at timestamptz DEFAULT now());
    GRANT USAGE ON SCHEMA private TO service_role;`);
  const statusConstraint=financialFixture.constraints.find(c => c.name === 'bookings_solo_guarantee_refund_status_check');
  await db.exec('ALTER TABLE bookings ADD CONSTRAINT '+statusConstraint.name+' '+statusConstraint.definition);
  await db.exec(financialFixture.trigger.function_definition);
  await db.exec(financialFixture.trigger.definition);
  const financialMigration = await readFile('supabase/migrations/20261005104924_solo_guarantee_financial_authority.sql','utf8');
  await db.exec(financialMigration);
  // Empty disposable Host parents only. The applied SQL bytes stay unchanged.
  await db.exec(`CREATE ROLE supabase_auth_admin;
    ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb;
    CREATE TABLE public.host_applications(id uuid PRIMARY KEY,user_id uuid,profile_photo text);`);
  const hostMigration = await readFile('supabase/migrations/20261006013755_host_profile_media_authority.sql','utf8');
  await db.exec(hostMigration);
  // Unchanged applied Community SQL on empty, disposable local parents only.
  await db.exec('CREATE TABLE public.community_posts(id uuid PRIMARY KEY,user_id uuid,images text[])');
  const communityMigration = await readFile('supabase/migrations/20261006105322_community_media_authority.sql','utf8');
  await db.exec(communityMigration);
  const freezeHotfix = await readFile('supabase/migrations/20261006173453_community_freeze_safeupdate.sql','utf8');
  await db.exec(freezeHotfix);
  await db.exec('UPDATE private.community_media_authority SET legacy_writes_frozen=true WHERE singleton IS TRUE');
  await verify(communityCatalog); await verify(communityProduction);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['-- altered hotfix'] WHERE version='20261006180321'", () => db.query('UPDATE supabase_migrations.schema_migrations SET statements=$1 WHERE version=$2', [[freezeHotfix],'20261006180321']), /Community hotfix applied ledger SQL mismatch/, communityProduction);
  await rejectDrift('GRANT SELECT ON private.community_media_authority TO service_role', 'REVOKE SELECT ON private.community_media_authority FROM service_role', /Community catalog security or definition mismatch/, communityCatalog);
  await rejectDrift('ALTER TABLE private.community_media_context DISABLE ROW LEVEL SECURITY', 'ALTER TABLE private.community_media_context ENABLE ROW LEVEL SECURITY', /Community catalog security or definition mismatch/, communityCatalog);
  await rejectDrift('ALTER TABLE community_posts ALTER COLUMN media_revision DROP NOT NULL', 'ALTER TABLE community_posts ALTER COLUMN media_revision SET NOT NULL', /Community catalog security or definition mismatch/, communityCatalog);
  await rejectDrift('ALTER TABLE storage.objects DISABLE TRIGGER community_legacy_storage_writer', 'ALTER TABLE storage.objects ENABLE TRIGGER community_legacy_storage_writer', /Community catalog security or definition mismatch/, communityCatalog);
  await rejectDrift('UPDATE private.community_media_authority SET legacy_writes_frozen=false WHERE singleton IS TRUE', 'UPDATE private.community_media_authority SET legacy_writes_frozen=true WHERE singleton IS TRUE', /Production Community authority marker mismatch/, communityProduction);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['-- altered Community'] WHERE version='20261006105322'", () => db.query('UPDATE supabase_migrations.schema_migrations SET statements=$1 WHERE version=$2', [[communityMigration],'20261006105322']), /Community applied ledger SQL mismatch/, communityProduction);
  await verify(hostCatalog);
  await assert.rejects(verify(hostProduction), /Production Host authority marker mismatch/);
  await db.exec('UPDATE private.host_profile_source_authority SET r2_enabled=true');
  await verify(hostProduction);
  await rejectDrift('GRANT EXECUTE ON FUNCTION begin_host_profile_media_asset(uuid,uuid,text,text,text,bigint,text,text) TO anon',
    'REVOKE EXECUTE ON FUNCTION begin_host_profile_media_asset(uuid,uuid,text,text,text,bigint,text,text) FROM anon', /Host function body or ACL mismatch/, hostCatalog);
  await rejectDrift('ALTER FUNCTION host_profile_auth_backup_references() SECURITY DEFINER',
    'ALTER FUNCTION host_profile_auth_backup_references() SECURITY INVOKER', /Host function body or ACL mismatch/, hostCatalog);
  await rejectDrift('GRANT SELECT ON private.host_profile_auth_cas TO service_role',
    'REVOKE SELECT ON private.host_profile_auth_cas FROM service_role', /Host private table security mismatch/, hostCatalog);
  await rejectDrift('ALTER TABLE private.host_profile_auth_cas ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE private.host_profile_auth_cas DISABLE ROW LEVEL SECURITY', /Host private table security mismatch/, hostCatalog);
  await rejectDrift('ALTER TABLE private.host_profile_source_authority ALTER COLUMN r2_enabled DROP DEFAULT',
    'ALTER TABLE private.host_profile_source_authority ALTER COLUMN r2_enabled SET DEFAULT false', /Host column mismatch/, hostCatalog);
  const hostConstraint = manifest.appliedHostAuthority.constraints.find(x => x.name === 'host_profile_media_identity');
  await rejectDrift('ALTER TABLE media_assets DROP CONSTRAINT host_profile_media_identity',
    'ALTER TABLE media_assets ADD CONSTRAINT host_profile_media_identity '+hostConstraint.definition, /Host constraint mismatch/, hostCatalog);
  await rejectDrift('ALTER INDEX private.host_profile_auth_cas_pkey RENAME TO missing_host_index',
    'ALTER INDEX private.missing_host_index RENAME TO host_profile_auth_cas_pkey', /Host (?:index|constraint) mismatch/, hostCatalog);
  await rejectDrift('ALTER TABLE storage.objects DISABLE TRIGGER host_profile_legacy_storage_writer',
    'ALTER TABLE storage.objects ENABLE TRIGGER host_profile_legacy_storage_writer', /Host trigger mismatch/, hostCatalog);
  await rejectDrift('UPDATE private.host_profile_source_authority SET r2_enabled=false',
    'UPDATE private.host_profile_source_authority SET r2_enabled=true', /Production Host authority marker mismatch/, hostProduction);
  await rejectDrift("DELETE FROM supabase_migrations.schema_migrations WHERE version='20261006013755'",
    () => db.query('INSERT INTO supabase_migrations.schema_migrations VALUES ($1,$2,$3)', ['20261006013755','host_profile_media_authority',[hostMigration]]), /Host applied ledger SQL mismatch/, hostProduction);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['-- altered Host'] WHERE version='20261006013755'",
    () => db.query('UPDATE supabase_migrations.schema_migrations SET statements=$1 WHERE version=$2', [[hostMigration],'20261006013755']), /Host applied ledger SQL mismatch/, hostProduction);
  await rejectDrift('CREATE TABLE private.unreviewed_host_table(id integer)',
    'DROP TABLE private.unreviewed_host_table', /Private table inventory mismatch/, hostProduction);
  await verify(financialLedger); await verify(financialCatalog);
  await rejectDrift("DELETE FROM supabase_migrations.schema_migrations WHERE version='20261005104924'",
    () => db.query('INSERT INTO supabase_migrations.schema_migrations VALUES ($1,$2,$3)',['20261005104924','solo_guarantee_financial_authority',[financialMigration]]),
    /applied financial P0 ledger SQL mismatch/, financialLedger);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['-- altered financial SQL'] WHERE version='20261005104924'",
    () => db.query('UPDATE supabase_migrations.schema_migrations SET statements=$1 WHERE version=$2',[[financialMigration],'20261005104924']),
    /applied financial P0 ledger SQL mismatch/, financialLedger);
  for (const [change,restore] of [
    ['GRANT UPDATE ON bookings TO authenticated','REVOKE UPDATE ON bookings FROM authenticated'],
    ['GRANT UPDATE(amount) ON bookings TO PUBLIC','REVOKE UPDATE(amount) ON bookings FROM PUBLIC'],
    ['GRANT INSERT ON bookings TO anon','REVOKE INSERT ON bookings FROM anon'],
    ['GRANT DELETE ON bookings TO authenticated','REVOKE DELETE ON bookings FROM authenticated'],
    ['REVOKE SELECT ON bookings FROM authenticated','GRANT SELECT ON bookings TO authenticated'],
    ['GRANT SELECT ON booking_solo_refund_operations TO anon','REVOKE SELECT ON booking_solo_refund_operations FROM anon'],
    ['GRANT UPDATE ON booking_solo_refund_attempts TO authenticated','REVOKE UPDATE ON booking_solo_refund_attempts FROM authenticated'],
  ]) await rejectDrift(change,restore,/financial client authority mismatch/,financialCatalog);
  await rejectDrift('ALTER TABLE booking_solo_refund_operations DISABLE ROW LEVEL SECURITY',
    'ALTER TABLE booking_solo_refund_operations ENABLE ROW LEVEL SECURITY',/financial server table authority or RLS mismatch/,financialCatalog);
  await rejectDrift('GRANT EXECUTE ON FUNCTION claim_solo_refund_atomic(text) TO authenticated',
    'REVOKE EXECUTE ON FUNCTION claim_solo_refund_atomic(text) FROM authenticated',/financial function body or ACL mismatch/,financialCatalog);
  await rejectDrift('ALTER TABLE bookings DISABLE TRIGGER bookings_money_transition_authority',
    'ALTER TABLE bookings ENABLE TRIGGER bookings_money_transition_authority',/financial trigger mismatch/,financialCatalog);
  await rejectDrift('ALTER INDEX booking_solo_refund_manual_proof_once RENAME TO missing_financial_index',
    'ALTER INDEX missing_financial_index RENAME TO booking_solo_refund_manual_proof_once',/financial index mismatch/,financialCatalog);
  const amountConstraint=manifest.appliedFinancialAuthority.constraints.find(c => c.name === 'booking_solo_refund_operations_requested_amount_check');
  await rejectDrift('ALTER TABLE booking_solo_refund_operations DROP CONSTRAINT '+amountConstraint.name,
    'ALTER TABLE booking_solo_refund_operations ADD CONSTRAINT '+amountConstraint.name+' '+amountConstraint.definition,
    /financial constraint mismatch/,financialCatalog);
  await rejectDrift('ALTER TABLE booking_solo_refund_operations ALTER COLUMN requested_amount DROP NOT NULL',
    'ALTER TABLE booking_solo_refund_operations ALTER COLUMN requested_amount SET NOT NULL',/financial column mismatch/,financialCatalog);
  const completionDefinition=(await db.query("SELECT pg_get_functiondef('complete_experience_booking_if_due_atomic(text)'::regprocedure) definition")).rows[0].definition;
  await rejectDrift(completionDefinition.replaceAll('((notification_target.booking_id))','(booking_id)'),
    completionDefinition,/financial function body or ACL mismatch/,financialCatalog);
  // Exact reviewed Recency SQL on empty local parents; never connect Production.
  await db.exec('ALTER TABLE inquiries ADD COLUMN created_at timestamptz; ALTER TABLE proxy_requests ADD COLUMN created_at timestamptz');
  const recencyMigration = await readFile('supabase/migrations/20261006133015_admin_chat_canonical_recency.sql','utf8');
  await db.exec(recencyMigration);
  await verify(recencyCatalog); await verify(recencyLedger);
  await rejectDrift('GRANT EXECUTE ON FUNCTION list_admin_phone_recency(integer,integer) TO anon',
    'REVOKE EXECUTE ON FUNCTION list_admin_phone_recency(integer,integer) FROM anon', /Recency function body or ACL mismatch/, recencyCatalog);
  await rejectDrift('ALTER FUNCTION list_admin_support_recency(integer,integer,text,bigint[]) SECURITY DEFINER',
    'ALTER FUNCTION list_admin_support_recency(integer,integer,text,bigint[]) SECURITY INVOKER', /Recency function body or ACL mismatch/, recencyCatalog);
  await rejectDrift('ALTER FUNCTION list_admin_phone_recency(integer,integer) SET search_path=public',
    "ALTER FUNCTION list_admin_phone_recency(integer,integer) SET search_path=''", /Recency function body or ACL mismatch/, recencyCatalog);
  await rejectDrift('ALTER INDEX admin_chat_visible_message_recency RENAME TO missing_recency_index',
    'ALTER INDEX missing_recency_index RENAME TO admin_chat_visible_message_recency', /Recency index mismatch/, recencyCatalog);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['-- altered Recency'] WHERE version='20261006133015'",
    () => db.query('UPDATE supabase_migrations.schema_migrations SET statements=$1 WHERE version=$2', [[recencyMigration],'20261006133015']), /Recency applied ledger SQL mismatch/, recencyLedger);
  await rejectDrift("DELETE FROM supabase_migrations.schema_migrations WHERE version='20261006133015'",
    () => db.query('INSERT INTO supabase_migrations.schema_migrations VALUES ($1,$2,$3)', ['20261006133015','admin_chat_canonical_recency',[recencyMigration]]), /Recency applied ledger SQL mismatch/, recencyLedger);
  const monitorMigration = await readFile('supabase/migrations/20261007024725_admin_chat_monitor_canonical_recency.sql','utf8');
  await db.exec(monitorMigration); await verify(monitorCatalog); await verify(monitorLedger);
  await rejectDrift('GRANT EXECUTE ON FUNCTION list_admin_monitor_recency(integer,integer,bigint[]) TO authenticated',
    'REVOKE EXECUTE ON FUNCTION list_admin_monitor_recency(integer,integer,bigint[]) FROM authenticated', /Monitor function body or ACL mismatch/, monitorCatalog);
  await rejectDrift('ALTER FUNCTION list_admin_monitor_recency(integer,integer,bigint[]) SECURITY DEFINER',
    'ALTER FUNCTION list_admin_monitor_recency(integer,integer,bigint[]) SECURITY INVOKER', /Monitor function body or ACL mismatch/, monitorCatalog);
  await rejectDrift('ALTER FUNCTION list_admin_monitor_recency(integer,integer,bigint[]) SET search_path=public',
    "ALTER FUNCTION list_admin_monitor_recency(integer,integer,bigint[]) SET search_path=''", /Monitor function body or ACL mismatch/, monitorCatalog);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['-- changed Monitor'] WHERE version='20261007024725'",
    () => db.query('UPDATE supabase_migrations.schema_migrations SET statements=$1 WHERE version=$2', [[monitorMigration],'20261007024725']), /Monitor applied ledger SQL mismatch/, monitorLedger);
  await rejectDrift("DELETE FROM supabase_migrations.schema_migrations WHERE version='20261007024725'",
    () => db.query('INSERT INTO supabase_migrations.schema_migrations VALUES ($1,$2,$3)', ['20261007024725','admin_chat_monitor_canonical_recency',[monitorMigration]]), /Monitor applied ledger SQL mismatch/, monitorLedger);
  await verify(mediaLedger); await verify(mediaCatalog); await verify(productionLedger);
  await rejectDrift("DELETE FROM supabase_migrations.schema_migrations WHERE version='20261005082309'",
    () => db.query('INSERT INTO supabase_migrations.schema_migrations VALUES ($1,$2,$3)', ['20261005082309','avatar_media_authority',[avatarMigration]]),
    /applied media\/avatar ledger SQL mismatch/, mediaLedger);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['-- changed avatar'] WHERE version='20261005082309'",
    () => db.query('UPDATE supabase_migrations.schema_migrations SET statements=$1 WHERE version=$2', [[avatarMigration],'20261005082309']),
    /applied media\/avatar ledger SQL mismatch/, mediaLedger);
  await rejectDrift("UPDATE supabase_migrations.schema_migrations SET version='20261004053225' WHERE version='20261004053224'",
    "UPDATE supabase_migrations.schema_migrations SET version='20261004053224' WHERE version='20261004053225'",
    /applied media\/avatar ledger SQL mismatch/, mediaLedger);
  await rejectDrift('GRANT EXECUTE ON FUNCTION begin_avatar_media_asset(uuid,uuid,text,text,text,bigint,text,text) TO anon',
    'REVOKE EXECUTE ON FUNCTION begin_avatar_media_asset(uuid,uuid,text,text,text,bigint,text,text) FROM anon', /function body or ACL mismatch/, mediaCatalog);
  await rejectDrift('GRANT EXECUTE ON FUNCTION private.sync_experience_media_assets() TO service_role',
    'REVOKE EXECUTE ON FUNCTION private.sync_experience_media_assets() FROM service_role', /function body or ACL mismatch/, mediaCatalog);
  await rejectDrift('ALTER INDEX media_assets_owner_idx RENAME TO missing_media_index',
    'ALTER INDEX missing_media_index RENAME TO media_assets_owner_idx', /applied media index mismatch/, mediaCatalog);
  const avatarConstraint = manifest.appliedMediaAuthority.constraints.find(c => c.name === 'avatar_media_identity').definition;
  await rejectDrift('ALTER TABLE media_assets DROP CONSTRAINT avatar_media_identity',
    'ALTER TABLE media_assets ADD CONSTRAINT avatar_media_identity '+avatarConstraint, /applied media constraint mismatch/, mediaCatalog);
  await rejectDrift('ALTER TABLE profiles DISABLE TRIGGER profile_avatar_finalize',
    'ALTER TABLE profiles ENABLE TRIGGER profile_avatar_finalize', /applied media trigger mismatch/, mediaCatalog);
  await rejectDrift("INSERT INTO supabase_migrations.schema_migrations VALUES ('20990101000000','unreviewed',ARRAY['-- synthetic'])",
    "DELETE FROM supabase_migrations.schema_migrations WHERE version='20990101000000'", /migration ledger mismatch/, productionLedger);
  console.log(JSON.stringify({ result: 'CURRENT_STATE_CATALOG_DRIFT_TEST_PASS', driftChecks, staticDriftChecks, productionMutation: 0 }));
} finally {
  await db.close();
}
