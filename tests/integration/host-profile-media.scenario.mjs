import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {avatarKey,AVATAR_BASE_URL} from '../../app/utils/avatarMediaContract.mjs';
import {hostProfileKey,HOST_PROFILE_BASE_URL} from '../../app/utils/hostProfileMediaContract.mjs';
export const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
export const oldUrl=`https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/images/profile/${owner}_123`;
export async function setupHostDatabase(db){
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE supabase_auth_admin;
 CREATE SCHEMA private; CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION private.is_admin_reader() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE TABLE public.experiences(id bigint PRIMARY KEY,host_id uuid,photos text[],image_url text,itinerary jsonb,itinerary_i18n jsonb);
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,avatar_url text);
 CREATE TABLE public.host_applications(id uuid PRIMARY KEY,user_id uuid,profile_photo text);
 CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb,raw_app_meta_data jsonb DEFAULT '{"provider":"email"}',encrypted_password text DEFAULT 'fixture',updated_at timestamptz DEFAULT now());
 CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,refresh_token text);
 CREATE TABLE storage.buckets(id text,public boolean);
 CREATE TABLE storage.objects(name text,owner_id text,metadata jsonb,version text,updated_at timestamptz,bucket_id text);
 GRANT USAGE ON SCHEMA public,storage TO service_role;
 GRANT SELECT,INSERT,UPDATE,DELETE ON profiles,host_applications TO service_role,authenticated;
 GRANT SELECT ON storage.objects,storage.buckets TO service_role;
 GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
 GRANT SELECT,UPDATE ON auth.users TO supabase_auth_admin;
 INSERT INTO storage.buckets VALUES('images',true);
 INSERT INTO profiles VALUES('${owner}','${oldUrl}'),('${other}','https://lh3.googleusercontent.com/oauth');
 INSERT INTO host_applications VALUES('${owner}','${owner}','${oldUrl}'),('${other}','${owner}','${oldUrl}');
 INSERT INTO auth.users(id,raw_user_meta_data) VALUES('${owner}',jsonb_build_object('avatar_url','${oldUrl}','preferred_locale','ko','name','Synthetic')),('${other}','{"avatar_url":"https://lh3.googleusercontent.com/oauth"}');
 INSERT INTO auth.sessions VALUES('${owner}','${owner}','fixture-session-stable');
 INSERT INTO storage.objects VALUES('profile/${owner}_123','${owner}','{"size":4,"mimetype":"image/jpeg"}','fixture',now(),'images');`);
 for(const file of ['20261004053224_media_lifecycle_foundation.sql','20261005082309_avatar_media_authority.sql','20261006013755_host_profile_media_authority.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
}
export async function roleQuery(db,role,sql,args=[]){await db.exec('BEGIN; SET LOCAL ROLE '+role);try{const r=await db.query(sql,args);await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
export async function beginHost(db){const id=randomUUID(),key=hostProfileKey(owner,id),url=HOST_PROFILE_BASE_URL+'/'+key;
 await roleQuery(db,'service_role','SELECT public.begin_host_profile_media_asset($1,$2,$3,$4,$5,$6,$7,$8)',[id,owner,key,url,'a'.repeat(64),4,'image/jpeg',createHash('sha256').update(id).digest('hex')]);
 await roleQuery(db,'service_role','SELECT public.verify_host_profile_media_asset($1,$2,$3,$4,$5)',[id,owner,'a'.repeat(64),4,'image/jpeg']);return {id,url};}
export async function groupRefs(db){const {rows}=await roleQuery(db,'service_role','SELECT public.host_profile_migration_inventory() inventory');return rows[0].inventory.references.filter(r=>r.locator===oldUrl).map(({kind,id,metadataDigest})=>({kind,id,...(metadataDigest?{metadataDigest}:{})}));}
export const cas=(db,asset,refs,rollback=false)=>roleQuery(db,'service_role','SELECT public.apply_host_profile_media_locators($1,$2,$3,$4,$5)',[owner,asset.id,oldUrl,JSON.stringify(refs),rollback]);
export async function runHostScenario(db){
 const report=[];const pass=n=>{report.push(n);console.log(n+' PASS');};
 assert.equal((await db.query('SELECT count(*)::int n FROM media_assets')).rows[0].n,0);
 for(const role of ['anon','authenticated'])for(const fn of ['host_profile_migration_inventory()','host_profile_auth_backup_references()','apply_host_profile_media_locators(uuid,uuid,text,jsonb,boolean)'])assert.equal((await db.query('SELECT has_function_privilege($1,$2,$3) allowed',[role,'public.'+fn,'EXECUTE'])).rows[0].allowed,false);
 assert.equal((await db.query("SELECT has_table_privilege('service_role','auth.users','SELECT') allowed")).rows[0].allowed,false);
 assert.equal((await db.query("SELECT has_column_privilege('service_role','auth.users','raw_user_meta_data','UPDATE') allowed")).rows[0].allowed,false);
 const beforeAuth=(await db.query('SELECT * FROM auth.users WHERE id=$1',[owner])).rows[0],beforeSession=(await db.query('SELECT * FROM auth.sessions')).rows;
 assert.equal((await db.query('SELECT r2_enabled FROM private.host_profile_source_authority')).rows[0].r2_enabled,false);await db.exec('UPDATE private.host_profile_source_authority SET r2_enabled=true');
 const a=await beginHost(db),refs=await groupRefs(db);assert.equal(refs.length,4);
 await assert.rejects(cas(db,a,refs.slice(1)));assert.equal((await db.query('SELECT state FROM media_assets WHERE id=$1',[a.id])).rows[0].state,'pending');
 await assert.rejects(roleQuery(db,'service_role','INSERT INTO host_applications VALUES($1,$2,$3)',[randomUUID(),other,a.url]));
 const stale=structuredClone(refs);stale.find(r=>r.kind==='auth_legacy_host').metadataDigest='b'.repeat(64);await assert.rejects(cas(db,a,stale));
 assert((await groupRefs(db)).every(r=>refs.some(p=>p.kind===r.kind&&p.id===r.id)));
 await cas(db,a,refs);
 const updated=(await db.query('SELECT * FROM auth.users WHERE id=$1',[owner])).rows[0];assert.deepEqual(updated,{...beforeAuth,raw_user_meta_data:{...beforeAuth.raw_user_meta_data,avatar_url:a.url}});assert.deepEqual((await db.query('SELECT * FROM auth.sessions')).rows,beforeSession);
 assert.equal((await db.query('SELECT count(*)::int n FROM media_asset_references WHERE asset_id=$1',[a.id])).rows[0].n,4);pass('HOST_AUTH_CHAT_REFERENCE_PRESERVED');
 await roleQuery(db,'supabase_auth_admin',"UPDATE auth.users SET raw_user_meta_data=jsonb_set(raw_user_meta_data,'{preferred_locale}','\"en\"') WHERE id=$1",[owner]);
 await assert.rejects(cas(db,a,refs,true));
 await assert.rejects(roleQuery(db,'supabase_auth_admin',"UPDATE auth.users SET raw_user_meta_data=jsonb_set(raw_user_meta_data,'{avatar_url}','\"https://host-profile-media.locally-travel.com/forged\"') WHERE id=$1",[owner]));
 await roleQuery(db,'supabase_auth_admin',"UPDATE auth.users SET raw_user_meta_data=jsonb_set(raw_user_meta_data,'{avatar_url}','\"https://lh3.googleusercontent.com/newer\"') WHERE id=$1",[owner]);
 await assert.rejects(cas(db,a,refs,true));
 await db.query("UPDATE auth.users SET raw_user_meta_data=jsonb_set(raw_user_meta_data,'{avatar_url}',to_jsonb($1::text)) WHERE id=$2",[a.url,owner]);
 // Restore synthetic preference to the exact post-CAS digest, then prove rollback.
 await roleQuery(db,'supabase_auth_admin',"UPDATE auth.users SET raw_user_meta_data=jsonb_set(raw_user_meta_data,'{preferred_locale}','\"ko\"') WHERE id=$1",[owner]);
 await db.exec('UPDATE private.host_profile_source_authority SET r2_enabled=true');
 await assert.rejects(roleQuery(db,'service_role',"INSERT INTO storage.objects(name,bucket_id) VALUES('profile/new','images')"));
 await cas(db,a,refs,true);assert.equal((await db.query('SELECT state FROM media_assets WHERE id=$1',[a.id])).rows[0].state,'tombstoned');assert.equal((await db.query('SELECT count(*)::int n FROM media_asset_references WHERE asset_id=$1',[a.id])).rows[0].n,0);assert.equal((await db.query('SELECT raw_user_meta_data FROM auth.users WHERE id=$1',[owner])).rows[0].raw_user_meta_data.avatar_url,oldUrl);pass('HOST_ROLLBACK_SAFE');
 const b=await beginHost(db),fresh=await groupRefs(db);await cas(db,b,fresh);
 await roleQuery(db,'service_role','UPDATE host_applications SET profile_photo=null WHERE id=$1',[other]);
 await roleQuery(db,'service_role','UPDATE profiles SET avatar_url=null WHERE id=$1',[owner]);
 await roleQuery(db,'service_role','UPDATE host_applications SET profile_photo=null WHERE id=$1',[owner]);
 assert.equal((await db.query('SELECT state FROM media_assets WHERE id=$1',[b.id])).rows[0].state,'committed');assert.equal((await db.query('SELECT count(*)::int n FROM media_deletion_journal WHERE asset_id=$1',[b.id])).rows[0].n,0);
 // Last Auth edge is authoritative even when all public edges disappear.
 await db.query("UPDATE auth.users SET raw_user_meta_data=jsonb_set(raw_user_meta_data,'{avatar_url}','null') WHERE id=$1",[owner]);
 assert.equal((await db.query('SELECT state FROM media_assets WHERE id=$1',[b.id])).rows[0].state,'tombstoned');assert.equal((await db.query('SELECT count(*)::int n FROM media_deletion_journal WHERE asset_id=$1',[b.id])).rows[0].n,1);pass('HOST_SHARED_REFERENCE_SAFE');
 assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n,1);await assert.rejects(db.query("DELETE FROM storage.objects WHERE bucket_id='images' AND name LIKE 'profile/%'"));pass('LEGACY_HOST_UNREFERENCED_RETAINED');
 await assert.rejects(roleQuery(db,'service_role','UPDATE profiles SET avatar_url=$1 WHERE id=$2',[oldUrl,owner]));
 assert.equal((await db.query('SELECT avatar_url FROM profiles WHERE id=$1',[other])).rows[0].avatar_url,'https://lh3.googleusercontent.com/oauth');
 assert.equal((await db.query("SELECT count(*)::int n FROM media_assets WHERE business_scope='avatar'")).rows[0].n,0);pass('HOST_EXTERNAL_OAUTH_UNCHANGED');
 const c=await beginHost(db);await roleQuery(db,'service_role','UPDATE host_applications SET profile_photo=$1 WHERE id=$2',[c.url,owner]);
 await assert.rejects(cas(db,c,refs));assert.equal((await db.query('SELECT profile_photo FROM host_applications WHERE id=$1',[owner])).rows[0].profile_photo,c.url);pass('HOST_NEWER_CHANGE_CAS_PROTECTED');
 const avatarId=randomUUID(),avatarObjectKey=avatarKey(owner,avatarId,'image/jpeg');
 await roleQuery(db,'service_role','SELECT public.begin_avatar_media_asset($1,$2,$3,$4,$5,$6,$7,$8)',[avatarId,owner,avatarObjectKey,AVATAR_BASE_URL+'/'+avatarObjectKey,'b'.repeat(64),4,'image/jpeg',createHash('sha256').update(avatarId).digest('hex')]);
 await roleQuery(db,'service_role','SELECT public.verify_avatar_media_asset($1,$2,$3,$4,$5)',[avatarId,owner,'b'.repeat(64),4,'image/jpeg']);
 await roleQuery(db,'service_role','SELECT public.commit_profile_avatar($1,$2,$3,$4,$5)',[owner,avatarId,null,'b'.repeat(64),4]);
 const avatarBefore=(await db.query('SELECT * FROM media_assets WHERE id=$1',[avatarId])).rows[0],avatarRefsBefore=(await db.query('SELECT * FROM media_asset_references WHERE asset_id=$1',[avatarId])).rows;
 const d=await beginHost(db);await roleQuery(db,'service_role','UPDATE host_applications SET profile_photo=$1 WHERE id=$2',[d.url,owner]);
 assert.deepEqual((await db.query('SELECT * FROM media_assets WHERE id=$1',[avatarId])).rows[0],avatarBefore);assert.deepEqual((await db.query('SELECT * FROM media_asset_references WHERE asset_id=$1',[avatarId])).rows,avatarRefsBefore);assert.equal(avatarBefore.state,'committed');pass('ACCOUNT_AVATAR_AUTHORITY_UNCHANGED');
 await roleQuery(db,'service_role','SELECT public.plan_media_owner_deletion($1)',[owner]);
 assert.equal((await db.query('SELECT count(*)::int n FROM media_deletion_journal WHERE asset_id=$1',[d.id])).rows[0].n,0);
 await roleQuery(db,'service_role','DELETE FROM host_applications WHERE id=$1',[owner]);
 assert.equal((await db.query('SELECT count(*)::int n FROM media_deletion_journal WHERE asset_id=$1',[d.id])).rows[0].n,1);pass('HOST_OWNER_DELETION_REFERENCE_ZERO_SAFE');
 return report;
}
