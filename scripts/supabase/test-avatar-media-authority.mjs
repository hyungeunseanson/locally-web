import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { avatarKey, AVATAR_BASE_URL } from '../../app/utils/avatarMediaContract.mjs';
const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const legacy = 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/avatars/unrelated-prefix/legacy.jpg';
const sha = 'a'.repeat(64), size = 4;
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA private; CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION private.is_admin_reader() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE TABLE public.experiences(id bigint PRIMARY KEY,host_id uuid,photos text[],image_url text,itinerary jsonb,itinerary_i18n jsonb);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,avatar_url text);
CREATE TABLE storage.buckets(id text,public boolean);
CREATE TABLE storage.objects(name text,owner_id text,metadata jsonb,version text,updated_at timestamptz,bucket_id text);
GRANT USAGE ON SCHEMA public,storage TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profiles TO service_role;
GRANT SELECT ON storage.objects,storage.buckets TO service_role;
INSERT INTO storage.buckets VALUES('avatars',true);`);
await db.query('INSERT INTO public.profiles VALUES($1,$2),($3,$4)', [owner, legacy, other, 'https://lh3.googleusercontent.com/oauth']);
await db.exec(await readFile('supabase/migrations/20261004053224_media_lifecycle_foundation.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261005082309_avatar_media_authority.sql','utf8'));
async function asRole(role, sql, args = [], actor = '') {
  await db.exec('BEGIN; SET LOCAL ROLE ' + role);
  try { await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [actor]); const result = await db.query(sql, args); await db.exec('COMMIT'); return result; }
  catch (error) { await db.exec('ROLLBACK'); throw error; }
}
const args = (id, who = owner) => [id, who, avatarKey(who,id,'image/jpeg'), AVATAR_BASE_URL+'/'+avatarKey(who,id,'image/jpeg'), sha, size, 'image/jpeg', createHash('sha256').update(id).digest('hex')];
const beginSql = 'SELECT * FROM public.begin_avatar_media_asset($1::uuid,$2::uuid,$3,$4,$5,$6::bigint,$7,$8)';
const begin = async(id, who=owner) => (await asRole('service_role',beginSql,args(id,who))).rows[0];
const verify = (id, who=owner) => asRole('service_role','SELECT public.verify_avatar_media_asset($1::uuid,$2::uuid,$3,$4::bigint,$5)',[id,who,sha,size,'image/jpeg']);
const commit = (id, oldUrl, who=owner, byteSha=sha, byteSize=size) => asRole('service_role','SELECT * FROM public.commit_profile_avatar($1::uuid,$2::uuid,$3,$4,$5::bigint)',[who,id,oldUrl,byteSha,byteSize]);
const state = async id => (await db.query('SELECT * FROM public.media_assets WHERE id=$1',[id])).rows[0];
const url = id => AVATAR_BASE_URL+'/'+avatarKey(owner,id,'image/jpeg');
let first, second;
await test('additive SQL creates zero assets and leaves profile/external rows unchanged',async()=>{
  assert.equal((await db.query('SELECT count(*)::int n FROM media_assets')).rows[0].n,0);
  assert.equal((await db.query('SELECT avatar_url FROM profiles WHERE id=$1',[owner])).rows[0].avatar_url,legacy);
  assert.equal((await db.query('SELECT avatar_url FROM profiles WHERE id=$1',[other])).rows[0].avatar_url,'https://lh3.googleusercontent.com/oauth');
});
await test('avatar backend-only RPCs; lifecycle direct CRUD and private trigger denied to browser roles',async()=>{
  for (const role of ['anon','authenticated']) {
    for (const signature of ['begin_avatar_media_asset(uuid,uuid,text,text,text,bigint,text,text)','verify_avatar_media_asset(uuid,uuid,text,bigint,text)','commit_profile_avatar(uuid,uuid,text,text,bigint)','rollback_profile_avatar(uuid,uuid,text,text)','avatar_migration_inventory()']) {
      assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') ok',[role,'public.'+signature])).rows[0].ok,false);
    }
    await assert.rejects(asRole(role,beginSql,args(randomUUID())));
    for(const table of ['media_assets','media_asset_references','media_deletion_journal']) for(const action of ['SELECT','INSERT','UPDATE','DELETE']) {
      assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) ok',[role,'public.'+table,action])).rows[0].ok,false);
    }
  }
  assert.equal((await db.query("SELECT has_function_privilege('service_role','private.sync_profile_avatar_assets()','EXECUTE') ok")).rows[0].ok,false);
  assert((await db.query("SELECT bool_and(relrowsecurity) ok FROM pg_class WHERE relname IN ('media_assets','media_asset_references','media_deletion_journal')")).rows[0].ok);
});
await test('pending identity requires exact opaque owner/key/URL/MIME/size and an existing profile',async()=>{
  const id=randomUUID(); const bad=args(id);bad[2]=bad[2].replace(avatarKey(owner,id,'image/jpeg').split('/')[2],owner);
  await assert.rejects(asRole('service_role',beginSql,bad));
  const tooBig=args(id);tooBig[5]=10485761;await assert.rejects(asRole('service_role',beginSql,tooBig));
  await assert.rejects(begin(randomUUID(),randomUUID()));
  first=randomUUID();assert.equal((await begin(first)).state,'pending');
  assert.equal((await begin(first)).id,first);
  const conflict=args(first);conflict[4]='b'.repeat(64);await assert.rejects(asRole('service_role',beginSql,conflict));
});
await test('unverified/wrong-owner/SHA/size commit cannot mutate profile',async()=>{
  await assert.rejects(commit(first,legacy));await assert.rejects(verify(first,other));await verify(first);
  const verified=await state(first);assert.equal(verified.state,'pending');assert(verified.verified_at);assert(verified.uploaded_at);
  await assert.rejects(commit(first,legacy,other));await assert.rejects(commit(first,legacy,owner,'b'.repeat(64)));
  await assert.rejects(commit(first,legacy,owner,sha,size+1));
});
await test('profile CAS commits owned bytes and reference atomically; legacy gets no fake lifecycle',async()=>{
  const result=await commit(first,legacy);assert.equal(result.rows[0].state,'committed');
  const ref=(await db.query('SELECT * FROM media_asset_references WHERE asset_id=$1',[first])).rows[0];
  assert.equal(ref.parent_id,owner);assert.equal(ref.reference_digest,createHash('sha256').update(url(first)).digest('hex'));
  assert.equal((await db.query('SELECT count(*)::int n FROM media_assets')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM media_deletion_journal')).rows[0].n,0);
});
await test('user-change race fails closed leaving verified pending identity traceable',async()=>{
  second=randomUUID();await begin(second);await verify(second);
  await assert.rejects(commit(second,legacy));assert.equal((await state(second)).state,'pending');
  assert.equal((await db.query('SELECT avatar_url FROM profiles WHERE id=$1',[owner])).rows[0].avatar_url,url(first));
});
await test('replacement tombstones reference-zero old asset and queues only; no physical deletion',async()=>{
  await commit(second,url(first));assert.equal((await state(first)).state,'tombstoned');
  assert.equal((await state(second)).state,'committed');
  const journal=(await db.query('SELECT * FROM media_deletion_journal WHERE asset_id=$1',[first])).rows[0];
  assert.equal(journal.reason,'replaced');assert.equal(journal.state,'queued');assert.equal(journal.object_deleted_at,null);assert.equal(journal.completed_at,null);
});
await test('cross-owner and unregistered R2 locators cannot bypass trusted commit via direct profile update',async()=>{
  await assert.rejects(asRole('service_role','UPDATE profiles SET avatar_url=$1 WHERE id=$2',[url(second),other]));
  await assert.rejects(asRole('service_role','UPDATE profiles SET avatar_url=$1 WHERE id=$2',[url(randomUUID()),owner]));
  await db.exec('GRANT UPDATE,SELECT ON profiles TO authenticated;');
  await assert.rejects(asRole('authenticated','UPDATE profiles SET avatar_url=$1 WHERE id=$2',['https://example.org/new.jpg',other],owner));
});
await test('rollback exact new -> legacy CAS preserves newer user locators and performs no deletion',async()=>{
  const rollback=(expected)=>asRole('service_role','SELECT public.rollback_profile_avatar($1::uuid,$2::uuid,$3,$4) ok',[owner,second,expected,legacy]);
  await assert.rejects(rollback(url(first)));assert.equal((await state(second)).state,'committed');
  assert.equal((await rollback(url(second))).rows[0].ok,true);assert.equal((await state(second)).state,'tombstoned');
  assert.equal((await db.query('SELECT avatar_url FROM profiles WHERE id=$1',[owner])).rows[0].avatar_url,legacy);
});
await test('flag-false legacy/external writes detach managed references without inventing external assets',async()=>{
  const id=randomUUID();await begin(id);await verify(id);await commit(id,legacy);
  await asRole('authenticated','UPDATE profiles SET avatar_url=$1 WHERE id=$2',['https://lh3.googleusercontent.com/new-oauth',owner],owner);
  assert.equal((await state(id)).state,'tombstoned');assert.equal((await db.query('SELECT count(*)::int n FROM media_asset_references')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM media_assets')).rows[0].n,3);
});
await test('profile deletion journals managed asset; durable journal has zero physical completions',async()=>{
  const id=randomUUID();await begin(id);await verify(id);await commit(id,'https://lh3.googleusercontent.com/new-oauth');
  await asRole('service_role','DELETE FROM profiles WHERE id=$1',[owner]);assert.equal((await state(id)).state,'tombstoned');
  assert.equal((await db.query('SELECT count(*)::int n FROM media_deletion_journal WHERE object_deleted_at IS NOT NULL OR completed_at IS NOT NULL')).rows[0].n,0);
});
await test('bounded inventory SELECT-only RPC is backend-readable and excludes unrelated bucket objects',async()=>{
  const result=await asRole('service_role','SELECT avatar_migration_inventory() result');assert.equal(result.rows[0].result.bucketPublic,true);
  assert.equal(result.rows[0].result.profiles.length,1);assert.equal(result.rows[0].result.objects.length,0);
});

await db.close();
