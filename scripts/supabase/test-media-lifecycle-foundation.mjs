import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const assetA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const assetB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const key = id => 'sources/v1/experience/' + 'f'.repeat(64) + '/' + id + '/hero.jpg';
const url = id => 'https://media-canary.locally-travel.com/' + key(id);
await db.exec([
  "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
  "CREATE SCHEMA private; CREATE SCHEMA auth;",
  "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  "CREATE FUNCTION private.is_admin_reader() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;",
  "CREATE TABLE public.experiences (id bigint PRIMARY KEY,host_id uuid,photos text[],image_url text,itinerary jsonb,itinerary_i18n jsonb);",
  "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;",
  "GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiences TO service_role, authenticated;",
  "INSERT INTO public.experiences VALUES (99,'11111111-1111-4111-8111-111111111111',ARRAY['legacy-url'],null,null,null);",
].join('\n'));
await db.exec(await readFile('supabase/migrations/20261004053224_media_lifecycle_foundation.sql', 'utf8'));
assert.equal((await db.query('SELECT count(*)::int n FROM public.experiences')).rows[0].n, 1);
for (const role of ['anon', 'authenticated']) {
  for (const table of ['media_assets', 'media_asset_references', 'media_deletion_journal']) {
    for (const action of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) allowed', [role,'public.'+table,action])).rows[0].allowed, false);
    }
  }
}
const permissions = (await db.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('media_assets','media_asset_references','media_deletion_journal')")).rows;
assert.equal(permissions.length,3);assert(permissions.every(row=>row.relrowsecurity));
async function asRole(role, sql, args = []) {
  await db.exec('BEGIN; SET LOCAL ROLE ' + role);
  try { const result = await db.query(sql,args); await db.exec('COMMIT'); return result; }
  catch (error) { await db.exec('ROLLBACK'); throw error; }
}
const argsFor = (id, token, who = owner) => [id,who,key(id),url(id),'a'.repeat(64),4,'image/jpeg',token,null];
const beginSql = 'SELECT (public.begin_experience_media_asset($1::uuid,$2::uuid,$3,$4,$5,$6::bigint,$7,$8,$9)).*';
const begin = async (id,token,who=owner) => (await asRole('service_role',beginSql,argsFor(id,token,who))).rows[0];
const verify = (id, who=owner) => asRole('service_role','SELECT public.verify_experience_media_asset($1::uuid,$2::uuid,$3,$4::bigint,$5)',[id,who,'a'.repeat(64),4,'image/jpeg']);
const state = async id => (await db.query('SELECT * FROM public.media_assets WHERE id=$1',[id])).rows[0];
const count = async table => (await db.query('SELECT count(*)::int n FROM public.'+table)).rows[0].n;
await assert.rejects(asRole('authenticated',beginSql,argsFor(assetA,'1'.repeat(64))));
const pending = await begin(assetA,'1'.repeat(64));assert.equal(pending.state,'pending');
assert.equal((await begin(crypto.randomUUID(),'1'.repeat(64))).id,assetA);
const wrong = argsFor(assetB,'1'.repeat(64));wrong[4]='b'.repeat(64);
await assert.rejects(asRole('service_role',beginSql,wrong));
assert.equal(await count('media_assets'),1);
await assert.rejects(verify(assetA,other));
await assert.rejects(asRole('service_role','INSERT INTO public.experiences(id,host_id,photos) VALUES (1,$1::uuid,$2::text[])',[owner,[url(assetA)]]));
assert.equal(await count('experiences'),1);assert.equal((await state(assetA)).state,'pending');
await verify(assetA);
await assert.rejects(asRole('service_role','INSERT INTO public.experiences(id,host_id,photos) VALUES (1,$1::uuid,$2::text[])',[other,[url(assetA)]]));
await asRole('service_role','INSERT INTO public.experiences(id,host_id,photos) VALUES (1,$1::uuid,$2::text[])',[owner,[url(assetA)]]);
assert.equal((await state(assetA)).state,'committed');assert.equal(await count('media_asset_references'),1);
const committedAt=(await state(assetA)).committed_at;
await asRole('service_role','UPDATE public.experiences SET photos=$1::text[] WHERE id=1 AND media_revision=0',[ [url(assetA)] ]);
assert.equal((await state(assetA)).committed_at.toISOString(),committedAt.toISOString());
assert.equal(await count('media_asset_references'),1);
assert.equal((await asRole('service_role','UPDATE public.experiences SET photos=$1::text[] WHERE id=1 AND media_revision=0 RETURNING id',[[url(assetA)]])).rows.length,0);
assert.equal((await begin(crypto.randomUUID(),'1'.repeat(64))).id,assetA);
await begin(assetB,'2'.repeat(64));await verify(assetB);
await asRole('service_role','INSERT INTO public.experiences(id,host_id,photos) VALUES (2,$1::uuid,$2::text[])',[owner,[url(assetA)]]);
await asRole('service_role','UPDATE public.experiences SET photos=$1::text[] WHERE id=1',[[url(assetB)]]);
assert.equal((await state(assetA)).state,'committed');assert.equal(await count('media_deletion_journal'),0);
await asRole('service_role','UPDATE public.experiences SET photos=$1::text[] WHERE id=2',[[url(assetB)]]);
assert.equal((await state(assetA)).state,'tombstoned');assert.equal(await count('media_deletion_journal'),1);
await assert.rejects(asRole('service_role','UPDATE public.experiences SET photos=$1::text[] WHERE id=1',[[url(assetA)]]));
assert.equal((await db.query('SELECT photos FROM public.experiences WHERE id=1')).rows[0].photos[0],url(assetB));
await asRole('service_role','SELECT public.plan_media_owner_deletion($1::uuid)',[owner]);
await asRole('service_role','DELETE FROM public.experiences WHERE id=1');
assert.equal((await state(assetB)).state,'committed');
await asRole('service_role','DELETE FROM public.experiences WHERE id=2');
assert.equal((await state(assetB)).state,'tombstoned');
assert.equal(await count('media_asset_references'),0);assert.equal(await count('media_deletion_journal'),2);
assert.equal((await db.query('SELECT count(*)::int n FROM public.media_deletion_journal WHERE completed_at IS NOT NULL OR object_deleted_at IS NOT NULL')).rows[0].n,0);
await assert.rejects(asRole('service_role','DELETE FROM public.media_assets WHERE id=$1',[assetA]));
for (const role of ['anon','authenticated','service_role']) {
  assert.equal((await db.query("SELECT has_function_privilege($1,'private.sync_experience_media_assets()','EXECUTE') allowed",[role])).rows[0].allowed,false);
}

const assetC=crypto.randomUUID();await begin(assetC,'3'.repeat(64));
await db.query("UPDATE public.media_assets SET created_at=now()-interval '1 day' WHERE id=$1",[assetC]);
const claim=(enabled,age)=>asRole('service_role','SELECT public.claim_media_deletion($1::uuid,$2::boolean,$3::bigint) ok',[assetC,enabled,age]);
for(const [enabled,age] of [[false,1],[null,1],[true,null],[true,0],[true,172800000]]) assert.equal((await claim(enabled,age)).rows[0].ok,false);
await db.query('UPDATE public.media_assets SET backup_pinned=true WHERE id=$1',[assetC]);assert.equal((await claim(true,1)).rows[0].ok,false);
await db.query('UPDATE public.media_assets SET backup_pinned=false,migration_pinned=true WHERE id=$1',[assetC]);assert.equal((await claim(true,1)).rows[0].ok,false);
await db.query('UPDATE public.media_assets SET migration_pinned=false WHERE id=$1',[assetC]);
await assert.rejects(asRole('authenticated','SELECT public.claim_media_deletion($1::uuid,true,1)',[assetC]));
assert.equal((await claim(true,1)).rows[0].ok,true);assert.equal((await state(assetC)).state,'tombstoned');
const step=(event,code=null)=>asRole('service_role','SELECT public.record_media_deletion_step($1::uuid,$2,$3)',[assetC,event,code]);
await assert.rejects(step('complete'));await step('failed','provider_failed');assert.equal((await claim(true,1)).rows[0].ok,true);
assert.equal((await db.query('SELECT attempt_count FROM public.media_deletion_journal WHERE asset_id=$1',[assetC])).rows[0].attempt_count,2);
await step('object-deleted');await step('failed','purge_failed');await step('complete');await step('complete');
assert((await state(assetC)).deleted_at);assert.equal((await claim(true,1)).rows[0].ok,false);
await assert.rejects(step('failed','private URL must not be logged'));

// Future replacement helper: permission, ownership, verification, CAS and rollback.
const oldD=crypto.randomUUID(),newE=crypto.randomUUID();await begin(oldD,'4'.repeat(64));await verify(oldD);await begin(newE,'5'.repeat(64));
await db.query("UPDATE public.media_assets SET state='committed',committed_at=now() WHERE id=$1",[oldD]);
await db.query("INSERT INTO public.media_asset_references(asset_id,parent_type,parent_id,reference_digest) VALUES ($1,'future-profile','fixture',$2)",[oldD,'6'.repeat(64)]);
const replaceSql='SELECT public.replace_managed_media_reference($1::uuid,$2,$3,$4,$5,$6::uuid,$7::uuid)';
const replaceArgs=[owner,'future-profile','fixture','6'.repeat(64),'7'.repeat(64),oldD,newE];
await assert.rejects(asRole('authenticated',replaceSql,replaceArgs));await assert.rejects(asRole('service_role',replaceSql,replaceArgs));
assert.equal((await state(oldD)).state,'committed');await verify(newE);
const wrongOwner=[...replaceArgs];wrongOwner[0]=other;await assert.rejects(asRole('service_role',replaceSql,wrongOwner));
const badCas=[...replaceArgs];badCas[3]='8'.repeat(64);
await db.exec('BEGIN;SET LOCAL ROLE service_role');
await db.query("UPDATE public.experiences SET photos=ARRAY['uncommitted-fixture'] WHERE id=99");
await assert.rejects(db.query(replaceSql,badCas));await db.exec('ROLLBACK');
assert.equal((await db.query('SELECT photos FROM public.experiences WHERE id=99')).rows[0].photos[0],'legacy-url');
await asRole('service_role',replaceSql,replaceArgs);await asRole('service_role',replaceSql,replaceArgs);
assert.equal((await state(newE)).state,'committed');assert.equal((await state(oldD)).state,'tombstoned');
assert.equal((await db.query("SELECT count(*)::int n FROM public.media_asset_references WHERE parent_type='future-profile' AND asset_id=$1",[newE])).rows[0].n,1);
await db.close();console.log('MEDIA_LIFECYCLE_SCHEMA_TRANSACTION_ACL_CAS_PASS');
