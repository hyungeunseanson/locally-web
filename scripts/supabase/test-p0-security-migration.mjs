import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const db = new PGlite();

async function initializeReviewedPredecessor() {
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
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT current_user::text
    $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    CREATE TABLE public.users (id uuid, role text);
    CREATE TABLE public.admin_whitelist (email text);
    CREATE TABLE public.admin_task_comments (room_id uuid, read_by uuid[]);
    CREATE TABLE public.profiles (id uuid, name text);
    CREATE TABLE public.host_applications (id uuid, status text);
    GRANT SELECT ON public.users, public.admin_whitelist TO authenticated;
    CREATE VIEW public.public_profiles AS SELECT id, name FROM public.profiles;
    CREATE VIEW public.public_host_applications AS
      SELECT id, status FROM public.host_applications WHERE status = 'approved';
    CREATE FUNCTION public.check_rate_limit(text, integer) RETURNS boolean
      LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_catalog AS $$ SELECT true $$;
    CREATE FUNCTION public.handle_new_user() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$ BEGIN RETURN NEW; END $$;
    CREATE FUNCTION public.is_admin_reader() RETURNS boolean
      LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
        SELECT current_setting('app.is_admin', true) = 'true'
      $$;
    CREATE FUNCTION public.mark_room_messages_read(uuid, uuid) RETURNS void
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT $$;
    GRANT EXECUTE ON FUNCTION public.check_rate_limit(text,integer), public.handle_new_user(),
      public.is_admin_reader(), public.mark_room_messages_read(uuid,uuid)
      TO PUBLIC, anon, authenticated, service_role;
    GRANT ALL ON public.public_profiles, public.public_host_applications
      TO anon, authenticated, service_role;

    CREATE TABLE storage.buckets (
      id text PRIMARY KEY, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
    CREATE TABLE storage.objects (
      id text PRIMARY KEY, bucket_id text, name text,
      owner uuid, owner_id text, metadata jsonb
    );
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;
    INSERT INTO storage.buckets VALUES
      ('admin_files','admin_files',true,10485760,null),
      ('avatars','avatars',true,null,null),
      ('chat-images','chat-images',true,null,null),
      ('experiences','experiences',true,null,null),
      ('images','images',true,null,null),
      ('verification-docs','verification-docs',false,null,null);

    CREATE POLICY "Anyone can update their own avatar" ON storage.objects FOR UPDATE TO PUBLIC USING (bucket_id = 'avatars');
    CREATE POLICY "Anyone can upload an avatar" ON storage.objects FOR INSERT TO PUBLIC WITH CHECK (bucket_id = 'avatars');
    CREATE POLICY "Auth Users Upload" ON storage.objects FOR INSERT TO PUBLIC WITH CHECK (bucket_id = 'experiences' AND auth.role() = 'authenticated');
    CREATE POLICY "Authenticated Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'images');
    CREATE POLICY "Authenticated Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'images');
    CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'images');
    CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT TO PUBLIC USING (bucket_id = 'avatars');
    CREATE POLICY "Only admins can upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
      bucket_id = 'admin_files' AND (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
        OR EXISTS (SELECT 1 FROM admin_whitelist WHERE admin_whitelist.email = auth.jwt()->>'email')
      )
    );
    CREATE POLICY "Owner Delete" ON storage.objects FOR DELETE TO PUBLIC USING (auth.uid() = owner);
    CREATE POLICY "Owner Update" ON storage.objects FOR UPDATE TO PUBLIC USING (auth.uid() = owner);
    CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO PUBLIC USING (bucket_id = 'experiences');
    CREATE POLICY "Verification docs owners can delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id='verification-docs' AND name LIKE 'id_card/' || auth.uid()::text || '\\_%' ESCAPE '\\');
    CREATE POLICY "Verification docs owners can read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id='verification-docs' AND name LIKE 'id_card/' || auth.uid()::text || '\\_%' ESCAPE '\\');
    CREATE POLICY "Verification docs owners can update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id='verification-docs' AND name LIKE 'id_card/' || auth.uid()::text || '\\_%' ESCAPE '\\')
      WITH CHECK (bucket_id='verification-docs' AND name LIKE 'id_card/' || auth.uid()::text || '\\_%' ESCAPE '\\');
    CREATE POLICY "Verification docs owners can upload" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id='verification-docs' AND name LIKE 'id_card/' || auth.uid()::text || '\\_%' ESCAPE '\\');

    INSERT INTO storage.objects VALUES
      ('avatar-a','avatars','${USER_A}/avatar.webp','${USER_A}','${USER_A}','{"size":10}'),
      ('avatar-b','avatars','${USER_B}/avatar.webp','${USER_B}','${USER_B}','{"size":10}'),
      ('image-a','images','community/${USER_A}/post.webp','${USER_A}','${USER_A}','{"size":20}'),
      ('image-b','images','profile/${USER_B}_profile.webp','${USER_B}','${USER_B}','{"size":20}'),
      ('chat-a','chat-images','legacy/chat.webp',null,null,'{"size":30}'),
      ('admin-a','admin_files','markdown_images/memo.webp',null,null,'{"size":40}'),
      ('verification-a','verification-docs','id_card/${USER_A}_front.webp','${USER_A}','${USER_A}','{"size":50}');
    INSERT INTO public.users VALUES ('${USER_A}', 'admin'), ('${USER_B}', 'user');
  `);
}

async function asRole(role, uid, sql, isAdmin = false) {
  await db.exec('BEGIN');
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('app.is_admin', $2, true)`, [uid ?? '', isAdmin ? 'true' : 'false']);
    const result = await db.query(sql);
    await db.exec('ROLLBACK');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

async function denied(action) {
  await assert.rejects(action, /row-level security policy|permission denied/i);
}

await initializeReviewedPredecessor();
const before = await db.query(`SELECT count(*)::int AS count,
  sum((metadata->>'size')::bigint)::bigint AS bytes FROM storage.objects`);
const migration = await readFile('supabase/migrations/20260915141606_p0_storage_rpc_security_hardening.sql', 'utf8');
await db.exec(migration);

const after = await db.query(`SELECT count(*)::int AS count,
  sum((metadata->>'size')::bigint)::bigint AS bytes FROM storage.objects`);
assert.deepEqual(after.rows, before.rows);

const buckets = await db.query(`SELECT id, public FROM storage.buckets ORDER BY id`);
assert.deepEqual(buckets.rows, [
  { id: 'admin_files', public: false },
  { id: 'avatars', public: true },
  { id: 'chat-images', public: false },
  { id: 'experiences', public: true },
  { id: 'images', public: true },
  { id: 'verification-docs', public: false },
]);

assert.equal((await asRole('anon', null, `SELECT count(*)::int count FROM storage.objects WHERE bucket_id='chat-images'`)).rows[0].count, 0);
assert.equal((await asRole('authenticated', USER_A, `SELECT count(*)::int count FROM storage.objects WHERE bucket_id='chat-images'`)).rows[0].count, 0);
assert.equal((await asRole('authenticated', USER_A, `SELECT count(*)::int count FROM storage.objects WHERE bucket_id='admin_files'`)).rows[0].count, 0);
assert.equal((await asRole('authenticated', USER_A, `SELECT count(*)::int count FROM storage.objects WHERE bucket_id='admin_files'`, true)).rows[0].count, 1);
await asRole('authenticated', USER_A, `INSERT INTO storage.objects VALUES ('admin-own','admin_files','markdown_images/new.webp',null,null,'{"size":1}')`, true);
assert.equal((await asRole('authenticated', USER_A, `UPDATE storage.objects SET metadata='{"size":41}' WHERE id='admin-a' RETURNING id`, true)).rows.length, 1);
assert.equal((await asRole('authenticated', USER_A, `DELETE FROM storage.objects WHERE id='admin-a' RETURNING id`, true)).rows.length, 1);
assert.equal((await asRole('authenticated', USER_B, `UPDATE storage.objects SET metadata='{"size":99}' WHERE id='admin-a' RETURNING id`)).rows.length, 0);

await asRole('authenticated', USER_A, `INSERT INTO storage.objects VALUES ('avatar-own','avatars','${USER_A}/new.webp','${USER_A}','${USER_A}','{"size":1}')`);
await denied(() => asRole('authenticated', USER_A, `INSERT INTO storage.objects VALUES ('avatar-other','avatars','${USER_B}/new.webp','${USER_A}','${USER_A}','{"size":1}')`));
assert.equal((await asRole('authenticated', USER_A, `UPDATE storage.objects SET metadata='{"size":99}' WHERE id='avatar-b' RETURNING id`)).rows.length, 0);
assert.equal((await asRole('authenticated', USER_A, `DELETE FROM storage.objects WHERE id='avatar-b' RETURNING id`)).rows.length, 0);
assert.equal((await asRole('authenticated', USER_A, `UPDATE storage.objects SET metadata='{"size":11}' WHERE id='avatar-a' RETURNING id`)).rows.length, 1);

await asRole('authenticated', USER_A, `INSERT INTO storage.objects VALUES ('image-own','images','community/${USER_A}/new.webp','${USER_A}','${USER_A}','{"size":1}')`);
await denied(() => asRole('authenticated', USER_A, `INSERT INTO storage.objects VALUES ('image-old-path','images','community/new.webp','${USER_A}','${USER_A}','{"size":1}')`));
assert.equal((await asRole('authenticated', USER_A, `UPDATE storage.objects SET metadata='{"size":99}' WHERE id='image-b'`)).affectedRows, 0);
assert.equal((await asRole('authenticated', USER_A, `DELETE FROM storage.objects WHERE id='image-b'`)).affectedRows, 0);
assert.equal((await asRole('authenticated', USER_A, `DELETE FROM storage.objects WHERE id='image-a'`)).affectedRows, 1);

assert.equal((await asRole('authenticated', USER_A, `SELECT count(*)::int count FROM storage.objects WHERE bucket_id='verification-docs'`)).rows[0].count, 1);
assert.equal((await asRole('authenticated', USER_B, `SELECT count(*)::int count FROM storage.objects WHERE bucket_id='verification-docs'`)).rows[0].count, 0);

await asRole('service_role', null, `INSERT INTO storage.objects VALUES ('service-chat','chat-images','service.webp',null,null,'{"size":1}')`);
assert.equal((await asRole('service_role', null, `UPDATE storage.objects SET metadata='{"size":31}' WHERE id='chat-a' RETURNING id`)).rows.length, 1);
assert.equal((await asRole('service_role', null, `DELETE FROM storage.objects WHERE id='chat-a' RETURNING id`)).rows.length, 1);

for (const signature of [
  'public.check_rate_limit(text,integer)',
  'public.handle_new_user()',
  'public.mark_room_messages_read(uuid,uuid)',
]) {
  assert.equal((await db.query(`SELECT has_function_privilege('anon', $1, 'EXECUTE') allowed`, [signature])).rows[0].allowed, false);
  assert.equal((await db.query(`SELECT has_function_privilege('authenticated', $1, 'EXECUTE') allowed`, [signature])).rows[0].allowed, false);
  assert.equal((await db.query(`SELECT has_function_privilege('service_role', $1, 'EXECUTE') allowed`, [signature])).rows[0].allowed, true);
}
assert.equal((await db.query(`SELECT has_function_privilege('anon', 'public.is_admin_reader()', 'EXECUTE') allowed`)).rows[0].allowed, false);
assert.equal((await db.query(`SELECT has_function_privilege('authenticated', 'public.is_admin_reader()', 'EXECUTE') allowed`)).rows[0].allowed, true);

const nonSelectViewGrants = await db.query(`SELECT count(*)::int count
  FROM information_schema.role_table_grants
  WHERE table_schema='public'
    AND table_name IN ('public_profiles','public_host_applications')
    AND grantee IN ('anon','authenticated','service_role')
    AND privilege_type <> 'SELECT'`);
assert.equal(nonSelectViewGrants.rows[0].count, 0);

console.log(JSON.stringify({
  result: 'LOCALLY_P0_SECURITY_MIGRATION_RUNTIME_PASS',
  objectCountPreserved: after.rows[0].count,
  objectBytesPreserved: Number(after.rows[0].bytes),
  bucketsPrivate: ['admin_files', 'chat-images'],
  ownershipMatrices: ['avatars', 'images', 'verification-docs'],
  directSecurityDefinerRoles: { serviceRoleOnly: 3, authenticatedAdminHelper: 1 },
}, null, 2));

await db.close();
