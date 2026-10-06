import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { setupHostDatabase, roleQuery, owner, other } from './host-profile-media.scenario.mjs';
import { communityKey, COMMUNITY_BASE_URL, COMMUNITY_LEGACY_BASE } from '../../app/utils/communityMediaContract.mjs';
export { owner, other, roleQuery };
export const old1=COMMUNITY_LEGACY_BASE+'community/old-one.jpg',old2=COMMUNITY_LEGACY_BASE+'community/old-two.jpg';
export const post1='33333333-3333-4333-8333-333333333333',post2='44444444-4444-4444-8444-444444444444';
export async function setupCommunityDatabase(db) {
 await setupHostDatabase(db);
 await db.exec(`CREATE TABLE public.community_posts(id uuid PRIMARY KEY,user_id uuid NOT NULL,images text[],content text DEFAULT 'Synthetic content',title text DEFAULT 'Synthetic title',view_count integer DEFAULT 0);
 ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
 CREATE POLICY community_owned_write ON public.community_posts FOR ALL TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
 GRANT SELECT,INSERT,UPDATE,DELETE ON public.community_posts TO service_role,authenticated;
 INSERT INTO public.community_posts(id,user_id,images) VALUES('${post1}','${owner}',ARRAY['${old1}','${old2}']);
 INSERT INTO storage.objects(name,owner_id,metadata,version,bucket_id) VALUES('community/old-one.jpg','${owner}','{"size":4,"mimetype":"image/jpeg"}','v1','images'),('community/old-two.jpg','${owner}','{"size":4,"mimetype":"image/jpeg"}','v1','images'),('community/orphan.jpg','${owner}','{"size":4,"mimetype":"image/jpeg"}','v1','images');`);
 await db.exec(await readFile('supabase/migrations/20261006105322_community_media_authority.sql','utf8'));
}
export async function beginCommunity(db,actor=owner) {
 const id=randomUUID(),key=communityKey(actor,id),url=COMMUNITY_BASE_URL+'/'+key,sha='a'.repeat(64);
 await roleQuery(db,'service_role','SELECT public.begin_community_media_asset($1,$2,$3,$4,$5,$6,$7,$8)',[id,actor,key,url,sha,4,'image/jpeg',createHash('sha256').update(id).digest('hex')]);
 await assert.rejects(roleQuery(db,'service_role','SELECT public.verify_community_media_asset($1,$2,$3,$4,$5)',[id,actor,sha,4,'image/jpeg']));
 await roleQuery(db,'service_role','SELECT public.mark_community_media_uploaded($1,$2,$3,$4,$5)',[id,actor,sha,4,'image/jpeg']);
 await roleQuery(db,'service_role','SELECT public.verify_community_media_asset($1,$2,$3,$4,$5)',[id,actor,sha,4,'image/jpeg']);
 return {id,url,owner:actor,sha};
}
export const commitSet=(db,images,revision,expected,id=post1,actor=owner)=>roleQuery(db,'service_role','SELECT public.commit_community_post_images($1,$2,$3,$4,$5)',[actor,id,revision,expected,images]);
export async function runCommunityScenario(db) {
 const pass=name=>console.log(name+' PASS');
 for(const role of ['anon','authenticated'])for(const fn of ['begin_community_media_asset(uuid,uuid,text,text,text,bigint,text,text)','commit_community_post_images(uuid,uuid,bigint,text[],text[])','community_media_migration_inventory()','community_media_backup_contract()','apply_community_media_locators(text,jsonb,jsonb,boolean)','set_community_legacy_writer_freeze(boolean,uuid,text)'])assert.equal((await db.query('SELECT has_function_privilege($1,$2,$3) allowed',[role,'public.'+fn,'EXECUTE'])).rows[0].allowed,false);
 const a=await beginCommunity(db),b=await beginCommunity(db),foreign=await beginCommunity(db,other);
 for(const role of ['anon','authenticated','service_role'])await assert.rejects(roleQuery(db,role,"INSERT INTO private.community_media_context VALUES(pg_backend_pid(),txid_current(),$1,false)",[post1]));
 await assert.rejects(roleQuery(db,'service_role',"UPDATE media_assets SET business_scope='chat' WHERE id=$1",[a.id]));
 await assert.rejects(roleQuery(db,'service_role',"UPDATE media_assets SET expected_sha256=$1 WHERE id=$2",['b'.repeat(64),a.id]));

 await assert.rejects(commitSet(db,[foreign.url],0,[old1,old2]));
 await assert.rejects(commitSet(db,[a.url],0,[old1,old2],post1,other));
 await assert.rejects(commitSet(db,['https://community-media.locally-travel.com/forged'],0,[old1,old2]));
 pass('COMMUNITY_OWNER_ISOLATION_PASS');
 await commitSet(db,[a.url,b.url],0,[old1,old2]);
 const before=(await db.query('SELECT * FROM community_posts WHERE id=$1',[post1])).rows[0];
 assert.equal(before.media_revision,'1');assert.equal(before.content,'Synthetic content');assert.equal((await db.query('SELECT count(*)::int n FROM media_asset_references WHERE parent_type=$1',['community_post'])).rows[0].n,2);
 await db.query('UPDATE community_posts SET view_count=view_count+1 WHERE id=$1',[post1]);assert.equal((await db.query('SELECT media_revision FROM community_posts WHERE id=$1',[post1])).rows[0].media_revision,'1');
 await assert.rejects(db.query('UPDATE community_posts SET images=$1 WHERE id=$2',[[b.url,a.url],post1]));
 await db.query("SELECT set_config('app.community_media_authorized','true',false)");await assert.rejects(db.query('UPDATE community_posts SET images=$1 WHERE id=$2',[[b.url,a.url],post1]));
 await commitSet(db,[b.url,a.url],1,[a.url,b.url]);
 await assert.rejects(commitSet(db,[a.url],1,[a.url,b.url]));
 assert.deepEqual((await db.query('SELECT images FROM community_posts WHERE id=$1',[post1])).rows[0].images,[b.url,a.url]);
 await assert.rejects(db.query('UPDATE community_posts SET user_id=$1 WHERE id=$2',[other,post1]));
 pass('COMMUNITY_POST_IMAGE_SET_CAS_SAFE');pass('COMMUNITY_NEWER_EDIT_PROTECTED');
 await roleQuery(db,'service_role','INSERT INTO community_posts(id,user_id,images) VALUES($1,$2,$3)',[post2,owner,[a.url]]);
 await commitSet(db,[b.url],2,[b.url,a.url]);
 assert.equal((await db.query('SELECT state FROM media_assets WHERE id=$1',[a.id])).rows[0].state,'committed');
 await roleQuery(db,'service_role','SELECT public.plan_media_owner_deletion($1)',[owner]);assert.equal((await db.query('SELECT count(*)::int n FROM media_deletion_journal WHERE asset_id=$1',[a.id])).rows[0].n,0);
 await roleQuery(db,'service_role','DELETE FROM community_posts WHERE id=$1',[post2]);
 assert.equal((await db.query('SELECT state FROM media_assets WHERE id=$1',[a.id])).rows[0].state,'tombstoned');
 await assert.rejects(commitSet(db,[b.url],0,[a.url],post2));
 await assert.rejects(roleQuery(db,'service_role','SELECT public.claim_media_deletion($1,true,1)',[a.id]));
 pass('COMMUNITY_REFERENCE_DETACH_SAFE');pass('COMMUNITY_PHYSICAL_DELETE_DISABLED');
 await assert.rejects(roleQuery(db,'service_role','SELECT public.set_community_legacy_writer_freeze(true,$1,$2)',[a.id,a.sha]));
 await roleQuery(db,'service_role','SELECT public.set_community_legacy_writer_freeze(true,$1,$2)',[b.id,b.sha]);
 for(const sql of ["INSERT INTO storage.objects(name,bucket_id) VALUES('community/new.jpg','images')","UPDATE storage.objects SET name='community/replaced.jpg' WHERE name='community/old-one.jpg'","DELETE FROM storage.objects WHERE name='community/orphan.jpg'"])await assert.rejects(db.exec(sql));
 // Other prefixes and complete authorities are not part of this freeze.
 await db.exec("INSERT INTO storage.objects(name,bucket_id) VALUES('reviews/retained.jpg','images')");
 assert.equal((await db.query("SELECT count(*)::int n FROM storage.objects WHERE name='community/orphan.jpg'")).rows[0].n,1);pass('COMMUNITY_LEGACY_UNREFERENCED_RETAINED');
 // Add an untouched legacy parent via pre-freeze state, then migrate its entire array.
 await db.exec('UPDATE private.community_media_authority SET legacy_writes_frozen=false');
 const migrationPost=randomUUID();await db.query('INSERT INTO community_posts(id,user_id,images) VALUES($1,$2,$3)',[migrationPost,owner,[old1,old2]]);
 await roleQuery(db,'service_role','SELECT public.set_community_legacy_writer_freeze(true,$1,$2)',[b.id,b.sha]);
 const c=await beginCommunity(db),d=await beginCommunity(db),digest='d'.repeat(64);
 const sourceUpdated=(await db.query("SELECT updated_at FROM storage.objects WHERE name='community/old-one.jpg'")).rows[0].updated_at;
 const assets=[{id:c.id,owner,sourceKey:'community/old-one.jpg',oldUrl:old1,newUrl:c.url,sha256:c.sha,size:4,mime:'image/jpeg',version:'v1',updatedAt:sourceUpdated},{id:d.id,owner,sourceKey:'community/old-two.jpg',oldUrl:old2,newUrl:d.url,sha256:d.sha,size:4,mime:'image/jpeg',version:'v1',updatedAt:sourceUpdated}];
 const posts=[{id:migrationPost,owner,revision:0,oldImages:[old1,old2],newImages:[c.url,d.url]}];
 const apply=rollback=>roleQuery(db,'service_role','SELECT public.apply_community_media_locators($1,$2,$3,$4)',[digest,JSON.stringify(assets),JSON.stringify(posts),rollback]);
 await assert.rejects(apply(true));
 await assert.rejects(roleQuery(db,'service_role','SELECT public.apply_community_media_locators($1,$2,$3,false)',[digest,JSON.stringify([{...assets[0],version:'wrong'},assets[1]]),JSON.stringify(posts)]));
 await assert.rejects(roleQuery(db,'service_role','SELECT public.apply_community_media_locators($1,$2,$3,false)',[digest,JSON.stringify([{...assets[0],updatedAt:'2000-01-01T00:00:00Z'},assets[1]]),JSON.stringify(posts)]));
 await apply(false);await apply(false);
 assert.deepEqual((await db.query('SELECT images FROM community_posts WHERE id=$1',[migrationPost])).rows[0].images,[c.url,d.url]);
 await commitSet(db,[d.url,c.url],1,[c.url,d.url],migrationPost);await assert.rejects(apply(true));
 // Prove rollback using a separate approved plan; no newer edit is overwritten.
 const rollbackPost=randomUUID();await db.exec('UPDATE private.community_media_authority SET legacy_writes_frozen=false');await db.query('DELETE FROM community_posts WHERE id=$1',[migrationPost]);await db.query('INSERT INTO community_posts(id,user_id,images) VALUES($1,$2,$3)',[rollbackPost,owner,[old1,old2]]);await roleQuery(db,'service_role','SELECT public.set_community_legacy_writer_freeze(true,$1,$2)',[b.id,b.sha]);
 const e=await beginCommunity(db),f=await beginCommunity(db),assets2=[{...assets[0],id:e.id,newUrl:e.url},{...assets[1],id:f.id,newUrl:f.url}],posts2=[{...posts[0],id:rollbackPost,newImages:[e.url,f.url]}];
 const rollbackPlan=r=>roleQuery(db,'service_role','SELECT public.apply_community_media_locators($1,$2,$3,$4)',['e'.repeat(64),JSON.stringify(assets2),JSON.stringify(posts2),r]);
 await rollbackPlan(false);await rollbackPlan(true);await rollbackPlan(true);
 assert.deepEqual((await db.query('SELECT images,media_revision FROM community_posts WHERE id=$1',[rollbackPost])).rows[0],{images:[old1,old2],media_revision:'2'});
 assert.equal((await db.query('SELECT state FROM media_assets WHERE id=$1',[e.id])).rows[0].state,'tombstoned');pass('COMMUNITY_ROLLBACK_SAFE');
 assert.equal((await db.query("SELECT count(*)::int n FROM media_assets WHERE business_scope IN ('avatar','host_profile','experience')")).rows[0].n,0);
 assert.equal((await db.query("SELECT avatar_url FROM profiles WHERE id=$1",[owner])).rows[0].avatar_url.includes('/images/profile/'),true);
 const backup=(await roleQuery(db,'service_role','SELECT public.community_media_backup_contract() contract')).rows[0].contract;assert(backup.assets.length>0&&backup.references.length>0);assert(backup.posts.every(p=>!('content' in p)));
 pass('COMMUNITY_COMPLETED_AUTHORITIES_UNCHANGED');
 return {racePost:post1,raceImages:[b.url],raceRevision:3,raceNew:a.url};
}
