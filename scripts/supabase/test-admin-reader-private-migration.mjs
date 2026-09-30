import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';
import { resolveAdminAccess } from '../../app/utils/adminAccess.ts';

const migrationPath = 'supabase/migrations/20260930022348_move_is_admin_reader_to_private_schema.sql';
const migration = await readFile(migrationPath, 'utf8');
const targetContract = await readFile('supabase/staging/admin-reader-private-contract.sql', 'utf8');
assert.match(targetContract, /^\\set ON_ERROR_STOP on\n/);
const targetSql = targetContract.replace(/^\\set ON_ERROR_STOP on\n/, '');
const baseline = await readFile('supabase/migrations/20260912034545_production_schema_baseline.sql', 'utf8');
const originalFunction = baseline.match(/CREATE OR REPLACE FUNCTION public\.is_admin_reader\(\)[\s\S]*?\$function\$;/)?.[0];
assert.ok(originalFunction, 'immutable baseline must contain the reviewed helper definition');

const NORMAL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WHITELIST = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const publicPolicies = [
  ['admin_audit_logs', 'admin_audit_logs_admin_read_only'],
  ['admin_task_comments', 'admin_task_comments_admin_read_only'],
  ['admin_tasks', 'admin_tasks_admin_read_only'],
  ['admin_whitelist', 'admin_whitelist_admin_read_only'],
  ['inquiries', 'inquiries_select_admin'],
  ['inquiry_messages', 'inquiry_messages_select_admin'],
  ['profiles', 'profiles_select_admin'],
];

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE SCHEMA storage;
    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO authenticated, anon;
    CREATE TABLE public.users (id uuid PRIMARY KEY, role text);
    CREATE TABLE public.admin_whitelist (email text PRIMARY KEY);
    CREATE TABLE public.admin_audit_logs (id text PRIMARY KEY);
    CREATE TABLE public.admin_task_comments (id text PRIMARY KEY);
    CREATE TABLE public.admin_tasks (id text PRIMARY KEY);
    CREATE TABLE public.inquiries (id text PRIMARY KEY);
    CREATE TABLE public.inquiry_messages (id text PRIMARY KEY);
    CREATE TABLE public.profiles (id text PRIMARY KEY);
    CREATE TABLE storage.objects (id text PRIMARY KEY, bucket_id text, payload text);
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    CREATE POLICY users_select_own ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
    INSERT INTO public.users VALUES
      ('${NORMAL}', 'user'), ('${ADMIN}', 'admin'), ('${WHITELIST}', 'user');
    INSERT INTO public.admin_whitelist VALUES ('white@example.test');
    INSERT INTO public.admin_audit_logs VALUES ('row');
    INSERT INTO public.admin_task_comments VALUES ('row');
    INSERT INTO public.admin_tasks VALUES ('row');
    INSERT INTO public.inquiries VALUES ('row');
    INSERT INTO public.inquiry_messages VALUES ('row');
    INSERT INTO public.profiles VALUES ('row');
    INSERT INTO storage.objects VALUES ('admin-file', 'admin_files', 'original'), ('other-file', 'avatars', 'original');
    GRANT SELECT ON public.users, public.admin_whitelist TO authenticated;
    GRANT SELECT, UPDATE ON public.users TO service_role;
  `);
  await db.exec(originalFunction);
  await db.exec(`
    REVOKE ALL ON FUNCTION public.is_admin_reader() FROM PUBLIC, anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.is_admin_reader() TO authenticated, service_role;
  `);
  for (const [table, name] of publicPolicies) {
    await db.exec(`
      ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON public.${table} TO authenticated, anon;
      CREATE POLICY ${name} ON public.${table} FOR SELECT TO authenticated USING (is_admin_reader());
    `);
  }
  await db.exec(`
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, UPDATE, DELETE ON storage.objects TO authenticated, anon;
    CREATE POLICY "Admins can read files" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'admin_files' AND public.is_admin_reader());
    CREATE POLICY "Admins can update files" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'admin_files' AND public.is_admin_reader())
      WITH CHECK (bucket_id = 'admin_files' AND public.is_admin_reader());
    CREATE POLICY "Admins can delete files" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'admin_files' AND public.is_admin_reader());
  `);
  return db;
}

async function asRole(db, role, uid, email, sql) {
  await db.exec('BEGIN');
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [
      uid ?? '', JSON.stringify(email ? { email } : {}),
    ]);
    const result = await db.query(sql);
    await db.exec('ROLLBACK');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

async function appAdminFor(db, uid, email) {
  const user = (await db.query('SELECT role FROM public.users WHERE id=$1', [uid])).rows[0] ?? null;
  const whitelist = email
    ? (await db.query('SELECT email FROM public.admin_whitelist WHERE email=$1', [email])).rows[0] ?? null
    : null;
  const client = {
    from(table) {
      assert.ok(table === 'users' || table === 'admin_whitelist');
      return {
        select() {
          return {
            eq(column, value) {
              assert.equal(column, table === 'users' ? 'id' : 'email');
              assert.equal(value, table === 'users' ? uid : email);
              return {
                async maybeSingle() {
                  return { data: table === 'users' ? user : whitelist && { id: whitelist.email }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return resolveAdminAccess(client, { userId: uid, email });
}

const db = await fixture();
const bodyHash = await db.query("SELECT md5(prosrc) AS hash FROM pg_proc WHERE oid=to_regprocedure('public.is_admin_reader()')");
assert.equal(bodyHash.rows[0].hash, '66b4339455cbeb7070d383c60f8137ba');
const before = (await db.query(`SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies WHERE (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%is_admin_reader%'
  ORDER BY schemaname, tablename, policyname`)).rows;
assert.equal(before.length, 10);
const predecessorRoleAdmin = (await asRole(db, 'authenticated', ADMIN, 'admin@example.test',
  'SELECT public.is_admin_reader() AS allowed')).rows[0].allowed;
assert.equal(predecessorRoleAdmin, false,
  'the predecessor must reproduce the current_role collision for a role-admin-only account');

await db.exec(migration);
await db.exec(targetSql);

const after = (await db.query(`SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies WHERE (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%is_admin_reader%'
  ORDER BY schemaname, tablename, policyname`)).rows;
assert.equal(after.length, 10);
for (let i = 0; i < 10; i++) {
  const normalized = {
    ...after[i],
    qual: after[i].qual?.replaceAll('private.is_admin_reader()', 'is_admin_reader()'),
    with_check: after[i].with_check?.replaceAll('private.is_admin_reader()', 'is_admin_reader()') ?? null,
  };
  assert.deepEqual(normalized, before[i], `only helper schema may change in policy ${before[i].policyname}`);
}

const functionContract = (await db.query(`SELECT pg_get_userbyid(proowner) AS owner, prosecdef, provolatile,
  pronargs, prorettype='boolean'::regtype AS boolean_return, proconfig, prosrc,
  NOT EXISTS (SELECT 1 FROM aclexplode(proacl) WHERE grantee=0 AND privilege_type='EXECUTE') AS no_public_execute
  FROM pg_proc WHERE oid=to_regprocedure('private.is_admin_reader()')`)).rows[0];
assert.equal(functionContract.owner, 'postgres');
assert.equal(functionContract.prosecdef, true);
assert.equal(functionContract.provolatile, 's');
assert.equal(functionContract.pronargs, 0);
assert.equal(functionContract.boolean_return, true);
assert.deepEqual(functionContract.proconfig, ['search_path=""']);
assert.match(functionContract.prosrc, /resolved_user_role/);
assert.doesNotMatch(functionContract.prosrc, /\b(?:EXECUTE|INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i);
for (const qualifiedObject of ['auth.uid()', 'auth.jwt()', 'public.users', 'public.admin_whitelist']) {
  assert.ok(functionContract.prosrc.includes(qualifiedObject), `${qualifiedObject} must be schema-qualified`);
}
assert.equal(functionContract.no_public_execute, true);
assert.equal((await db.query("SELECT to_regprocedure('public.is_admin_reader()') IS NULL AS gone")).rows[0].gone, true);

const privileges = (await db.query(`SELECT
  has_schema_privilege('authenticated','private','USAGE') AS auth_usage,
  has_schema_privilege('authenticated','private','CREATE') AS auth_create,
  has_schema_privilege('anon','private','USAGE') AS anon_usage,
  has_schema_privilege('anon','private','CREATE') AS anon_create,
  has_schema_privilege('service_role','private','CREATE') AS service_create,
  has_function_privilege('authenticated','private.is_admin_reader()','EXECUTE') AS auth_execute,
  has_function_privilege('service_role','private.is_admin_reader()','EXECUTE') AS service_execute,
  has_function_privilege('anon','private.is_admin_reader()','EXECUTE') AS anon_execute`)).rows[0];
assert.deepEqual(privileges, {
  auth_usage: true, auth_create: false, anon_usage: false, anon_create: false, service_create: false,
  auth_execute: true, service_execute: true, anon_execute: false,
});

const cases = [
  ['normal', 'authenticated', NORMAL, 'normal@example.test', false, 0],
  ['role admin', 'authenticated', ADMIN, 'admin@example.test', true, 1],
  ['whitelist admin', 'authenticated', WHITELIST, 'white@example.test', true, 1],
  ['anon', 'anon', null, null, null, 0],
];
for (const [name, role, uid, email, expectedAdmin, expectedRows] of cases) {
  if (role === 'authenticated') {
    const dbAdmin = (await asRole(db, role, uid, email, 'SELECT private.is_admin_reader() AS allowed')).rows[0].allowed;
    assert.equal(dbAdmin, expectedAdmin, name);
    assert.equal((await appAdminFor(db, uid, email)).isAdmin, dbAdmin, `${name}: application and DB parity`);
  } else {
    await assert.rejects(() => asRole(db, role, uid, email, 'SELECT private.is_admin_reader()'), /permission denied/i);
  }
  for (const [table] of publicPolicies) {
    assert.equal((await asRole(db, role, uid, email, `SELECT count(*)::int AS count FROM public.${table}`)).rows[0].count,
      expectedRows, `${name}: ${table} RLS`);
  }
  assert.equal((await asRole(db, role, uid, email,
    "SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id='admin_files'")).rows[0].count,
  expectedRows, `${name}: Storage SELECT`);
  assert.equal((await asRole(db, role, uid, email,
    "UPDATE storage.objects SET payload='changed' WHERE id='admin-file' RETURNING id")).rows.length,
  expectedRows, `${name}: Storage UPDATE`);
  assert.equal((await asRole(db, role, uid, email,
    "DELETE FROM storage.objects WHERE id='admin-file' RETURNING id")).rows.length,
  expectedRows, `${name}: Storage DELETE`);
}
const appAccessRoute = await readFile('app/api/admin/access/route.ts', 'utf8');
assert.match(appAccessRoute, /if \(authError \|\| !user\) \{\s*return NextResponse\.json\(\{ success: false, error: 'Unauthorized' \}, \{ status: 401 \}\)/);
assert.equal((await asRole(db, 'authenticated', ADMIN, 'admin@example.test',
  "SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id='avatars'")).rows[0].count, 0);
assert.equal((await asRole(db, 'authenticated', null, null,
  'SELECT private.is_admin_reader() AS allowed')).rows[0].allowed, false);
assert.equal((await asRole(db, 'authenticated', NORMAL, null,
  'SELECT private.is_admin_reader() AS allowed')).rows[0].allowed, false);
assert.equal((await db.query("SELECT has_table_privilege('authenticated','public.users','UPDATE') AS allowed")).rows[0].allowed, false);
await assert.rejects(() => asRole(db, 'authenticated', NORMAL, 'normal@example.test',
  `UPDATE public.users SET role='admin' WHERE id='${NORMAL}' RETURNING id`), /permission denied/i);
assert.equal((await asRole(db, 'authenticated', NORMAL, 'normal@example.test',
  'SELECT private.is_admin_reader() AS allowed')).rows[0].allowed, false);
assert.ok((await asRole(db, 'authenticated', WHITELIST, 'white@example.test',
  "EXPLAIN SELECT id FROM storage.objects WHERE bucket_id='admin_files'")).rows.length > 0);

// PostgREST's exposed schemas are public and graphql_public in the Production setting.
// Its RPC catalog cannot discover either a removed public routine or a private routine.
const exposedSchemas = ['graphql_public', 'public'];
const rpcCatalog = (await db.query(`SELECT n.nspname AS schema, p.proname AS name
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.proname='is_admin_reader'`)).rows;
assert.deepEqual(rpcCatalog, [{ schema: 'private', name: 'is_admin_reader' }]);
assert.equal(rpcCatalog.some(({ schema }) => exposedSchemas.includes(schema)), false);
console.log('DIRECT_RPC_RUNTIME_TEST = NOT AVAILABLE; deterministic catalog/exposed-schema check passed');

// An empty owner-only private namespace is safe to reuse; an expanded ACL is not.
const reusable = await fixture();
await reusable.exec('CREATE SCHEMA private AUTHORIZATION postgres');
await reusable.exec(migration);
await reusable.exec(targetSql);
assert.equal((await reusable.query("SELECT to_regprocedure('private.is_admin_reader()') IS NOT NULL AS present")).rows[0].present, true);
await reusable.close();
const collision = await fixture();
await collision.exec('CREATE SCHEMA private AUTHORIZATION postgres; GRANT CREATE ON SCHEMA private TO authenticated');
await assert.rejects(() => collision.exec(migration), /private schema owner, ACL or contents drifted/);
await collision.exec('ROLLBACK');
assert.equal((await collision.query("SELECT to_regprocedure('public.is_admin_reader()') IS NOT NULL AS present")).rows[0].present, true);
await collision.close();
const drift = await fixture();
await drift.exec('ALTER POLICY admin_tasks_admin_read_only ON public.admin_tasks USING (true)');
await assert.rejects(() => drift.exec(migration), /policy contract drifted/);
await drift.exec('ROLLBACK');
assert.equal((await drift.query("SELECT to_regnamespace('private') IS NULL AS absent")).rows[0].absent, true);
await drift.close();
await db.close();
console.log('IS_ADMIN_READER_PRIVATE_SCHEMA_ISOLATED_PASS');
