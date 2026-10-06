-- Community-only, additive foundation. No backfill/provider write/delete/scheduler.
ALTER TABLE public.media_assets ADD CONSTRAINT community_media_identity CHECK (
 business_scope <> 'community' OR (
  provider='r2' AND bucket='locally-public-community-originals' AND parent_type='community_owner' AND parent_id=owner_id::text
  AND expected_size<=10485760 AND mime IN ('image/jpeg','image/png','image/webp','image/gif','image/avif')
  AND object_key='community/v1/' || pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to('community-media-owner:' || owner_id::text,'UTF8')),'hex') || '/' || id::text || '/image'
  AND public_url='https://community-media.locally-travel.com/' || object_key AND public_url IS NOT NULL AND deleted_at IS NULL
 )
);
CREATE FUNCTION private.guard_community_asset_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (OLD.business_scope='community' OR NEW.business_scope='community') AND ROW(OLD.id,OLD.owner_id,OLD.business_scope,OLD.parent_type,OLD.parent_id,OLD.provider,OLD.bucket,OLD.object_key,OLD.public_url,OLD.expected_sha256,OLD.expected_size,OLD.mime,OLD.idempotency_key) IS DISTINCT FROM ROW(NEW.id,NEW.owner_id,NEW.business_scope,NEW.parent_type,NEW.parent_id,NEW.provider,NEW.bucket,NEW.object_key,NEW.public_url,NEW.expected_sha256,NEW.expected_size,NEW.mime,NEW.idempotency_key) THEN RAISE EXCEPTION 'community_asset_identity_immutable' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_community_asset_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER community_asset_identity_immutable BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION private.guard_community_asset_identity();

CREATE FUNCTION public.begin_community_media_asset(p_id uuid,p_owner_id uuid,p_key text,p_url text,p_sha256 text,p_size bigint,p_mime text,p_idempotency_key text)
RETURNS public.media_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.media_assets;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_owner_id) THEN RAISE EXCEPTION 'community_owner_required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.media_assets(id,owner_id,business_scope,parent_type,parent_id,provider,bucket,object_key,public_url,expected_sha256,expected_size,mime,idempotency_key)
 VALUES(p_id,p_owner_id,'community','community_owner',p_owner_id::text,'r2','locally-public-community-originals',p_key,p_url,p_sha256,p_size,p_mime,p_idempotency_key)
 ON CONFLICT(owner_id,idempotency_key) DO NOTHING;
 SELECT * INTO STRICT result FROM public.media_assets WHERE owner_id=p_owner_id AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF result.id<>p_id OR result.business_scope<>'community' OR result.object_key<>p_key OR result.public_url<>p_url OR result.expected_sha256<>p_sha256 OR result.expected_size<>p_size OR result.mime<>p_mime OR result.state='tombstoned' THEN RAISE EXCEPTION 'community_identity_conflict' USING ERRCODE='23505'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.mark_community_media_uploaded(p_id uuid,p_owner_id uuid,p_sha256 text,p_size bigint,p_mime text)
RETURNS public.media_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.media_assets;
BEGIN
 UPDATE public.media_assets SET uploaded_at=coalesce(uploaded_at,now()) WHERE id=p_id AND owner_id=p_owner_id AND business_scope='community' AND state IN ('pending','committed') AND expected_sha256=p_sha256 AND expected_size=p_size AND mime=p_mime RETURNING * INTO result;
 IF result.id IS NULL THEN RAISE EXCEPTION 'community_upload_conflict' USING ERRCODE='40001'; END IF; RETURN result;
END $$;
CREATE FUNCTION public.verify_community_media_asset(p_id uuid,p_owner_id uuid,p_sha256 text,p_size bigint,p_mime text)
RETURNS public.media_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.media_assets;
BEGIN
 UPDATE public.media_assets SET verified_at=coalesce(verified_at,now()) WHERE id=p_id AND owner_id=p_owner_id AND business_scope='community' AND state IN ('pending','committed') AND uploaded_at IS NOT NULL AND expected_sha256=p_sha256 AND expected_size=p_size AND mime=p_mime RETURNING * INTO result;
 IF result.id IS NULL THEN RAISE EXCEPTION 'community_verification_conflict' USING ERRCODE='40001'; END IF; RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.begin_community_media_asset(uuid,uuid,text,text,text,bigint,text,text),public.mark_community_media_uploaded(uuid,uuid,text,bigint,text),public.verify_community_media_asset(uuid,uuid,text,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_community_media_asset(uuid,uuid,text,text,text,bigint,text,text),public.mark_community_media_uploaded(uuid,uuid,text,bigint,text),public.verify_community_media_asset(uuid,uuid,text,bigint,text) TO service_role;
ALTER TABLE public.community_posts ADD COLUMN media_revision bigint NOT NULL DEFAULT 0;
CREATE TABLE private.community_media_authority(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),legacy_writes_frozen boolean NOT NULL DEFAULT false);
INSERT INTO private.community_media_authority DEFAULT VALUES;
CREATE TABLE private.community_media_context(backend_id integer,transaction_id bigint,post_id uuid,rollback boolean NOT NULL DEFAULT false,PRIMARY KEY(backend_id,transaction_id,post_id));
CREATE TABLE private.community_media_plan_receipts(plan_digest text PRIMARY KEY CHECK(plan_digest ~ '^[a-f0-9]{64}$'),payload jsonb NOT NULL,state text NOT NULL CHECK(state IN ('applied','rolled_back')),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.community_media_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.community_media_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.community_media_plan_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.community_media_authority,private.community_media_context,private.community_media_plan_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.guard_community_media_writer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE frozen boolean; images_value text[]; old_images text[]:=ARRAY[]::text[]; url text; owner_value uuid; authorized boolean:=false; rollback_value boolean:=false;
BEGIN
 IF TG_TABLE_SCHEMA='storage' THEN
  IF NOT ((TG_OP<>'INSERT' AND OLD.bucket_id='images' AND OLD.name LIKE 'community/%') OR (TG_OP<>'DELETE' AND NEW.bucket_id='images' AND NEW.name LIKE 'community/%')) THEN
   IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
 END IF;
 -- Freeze UPDATE waits for in-flight legacy DB writers; later writers observe true.
 SELECT legacy_writes_frozen INTO frozen FROM private.community_media_authority FOR SHARE;
 IF TG_TABLE_SCHEMA='storage' THEN
  IF frozen AND ((TG_OP<>'INSERT' AND OLD.bucket_id='images' AND OLD.name LIKE 'community/%') OR (TG_OP<>'DELETE' AND NEW.bucket_id='images' AND NEW.name LIKE 'community/%')) THEN RAISE EXCEPTION 'community_legacy_storage_write_disabled' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'community_owner_drift' USING ERRCODE='42501'; END IF;
  old_images:=coalesce(OLD.images,ARRAY[]::text[]);
  SELECT true,c.rollback INTO authorized,rollback_value FROM private.community_media_context c WHERE c.backend_id=pg_backend_pid() AND c.transaction_id=txid_current() AND c.post_id=NEW.id;
  IF NEW.images IS DISTINCT FROM OLD.images AND (frozen OR EXISTS(SELECT 1 FROM unnest(coalesce(NEW.images,ARRAY[]::text[])||old_images) u WHERE u LIKE 'https://community-media.locally-travel.com/%')) AND NOT coalesce(authorized,false) THEN RAISE EXCEPTION 'community_image_set_cas_required' USING ERRCODE='40001'; END IF;
  -- Revision is derived from image-set changes, never accepted from a client.
  NEW.media_revision:=OLD.media_revision+CASE WHEN NEW.images IS DISTINCT FROM OLD.images THEN 1 ELSE 0 END;
 ELSE NEW.media_revision:=0;
 END IF;
 owner_value:=NEW.user_id; images_value:=coalesce(NEW.images,ARRAY[]::text[]);
 IF cardinality(images_value)>100 OR EXISTS(SELECT 1 FROM unnest(images_value) u WHERE u IS NULL OR u='') THEN RAISE EXCEPTION 'community_images_invalid' USING ERRCODE='23514'; END IF;
 FOR url IN SELECT DISTINCT unnest(images_value) LOOP
  IF url LIKE 'https://community-media.locally-travel.com/%' AND NOT EXISTS(SELECT 1 FROM public.media_assets WHERE public_url=url AND business_scope='community' AND owner_id=owner_value AND state IN ('pending','committed') AND uploaded_at IS NOT NULL AND verified_at IS NOT NULL) THEN RAISE EXCEPTION 'community_not_verified_or_owned' USING ERRCODE='23514'; END IF;
  IF frozen AND url LIKE 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/images/community/%' AND NOT url=ANY(old_images) AND NOT coalesce(rollback_value,false) THEN RAISE EXCEPTION 'community_legacy_locator_write_disabled' USING ERRCODE='42501'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_community_media_writer() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER a_community_media_writer BEFORE INSERT OR UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION private.guard_community_media_writer();
CREATE TRIGGER community_legacy_storage_writer BEFORE INSERT OR UPDATE OR DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION private.guard_community_media_writer();

CREATE FUNCTION private.sync_community_media_assets() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_value uuid; parent_value text; images_value text[]; digest text; asset public.media_assets; present boolean;
BEGIN
 owner_value:=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
 parent_value:=CASE WHEN TG_OP='DELETE' THEN OLD.id::text ELSE NEW.id::text END;
 images_value:=CASE WHEN TG_OP='DELETE' THEN ARRAY[]::text[] ELSE coalesce(NEW.images,ARRAY[]::text[]) END;
 IF current_setting('role',true) NOT IN ('service_role','postgres','none') AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM owner_value) THEN RAISE EXCEPTION 'community_owner_required' USING ERRCODE='42501'; END IF;
 digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(to_jsonb(images_value)::text,'UTF8')),'hex');
 FOR asset IN SELECT a.* FROM public.media_assets a WHERE a.business_scope='community' AND (a.public_url=ANY(images_value) OR EXISTS(SELECT 1 FROM public.media_asset_references r WHERE r.asset_id=a.id AND r.parent_type='community_post' AND r.parent_id=parent_value)) ORDER BY a.id FOR UPDATE LOOP
  present:=TG_OP<>'DELETE' AND asset.public_url=ANY(images_value);
  IF present THEN
   IF asset.owner_id IS DISTINCT FROM owner_value OR asset.state='tombstoned' OR asset.verified_at IS NULL OR asset.uploaded_at IS NULL THEN RAISE EXCEPTION 'community_not_verified_or_owned' USING ERRCODE='23514'; END IF;
   INSERT INTO public.media_asset_references(asset_id,parent_type,parent_id,reference_digest) VALUES(asset.id,'community_post',parent_value,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(asset.public_url,'UTF8')),'hex')) ON CONFLICT(asset_id,parent_type,parent_id) DO UPDATE SET reference_digest=EXCLUDED.reference_digest;
   UPDATE public.media_assets SET state='committed',committed_at=coalesce(committed_at,now()) WHERE id=asset.id;
  ELSE
   DELETE FROM public.media_asset_references WHERE asset_id=asset.id AND parent_type='community_post' AND parent_id=parent_value;
   IF NOT EXISTS(SELECT 1 FROM public.media_asset_references WHERE asset_id=asset.id) THEN
    UPDATE public.media_assets SET state='tombstoned',tombstoned_at=coalesce(tombstoned_at,now()) WHERE id=asset.id;
    INSERT INTO public.media_deletion_journal(asset_id,provider,bucket,object_key,expected_sha256,expected_size,reason,reference_digest) VALUES(asset.id,asset.provider,asset.bucket,asset.object_key,asset.expected_sha256,asset.expected_size,CASE WHEN TG_OP='DELETE' THEN 'parent_deleted' ELSE 'replaced' END,digest) ON CONFLICT(asset_id) DO NOTHING;
   END IF;
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.sync_community_media_assets() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER community_media_finalize AFTER INSERT OR UPDATE OF images ON public.community_posts FOR EACH ROW EXECUTE FUNCTION private.sync_community_media_assets();
CREATE TRIGGER community_media_delete_plan BEFORE DELETE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION private.sync_community_media_assets();

-- Private authority boundary, public RPC is invoker + service-role-only wrapper.
CREATE FUNCTION private.commit_community_post_images(p_actor_id uuid,p_post_id uuid,p_expected_revision bigint,p_expected_images text[],p_images text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE post public.community_posts;
BEGIN
 SELECT * INTO post FROM public.community_posts WHERE id=p_post_id FOR UPDATE;
 IF post.id IS NULL OR post.user_id IS DISTINCT FROM p_actor_id OR post.media_revision IS DISTINCT FROM p_expected_revision OR coalesce(post.images,ARRAY[]::text[]) IS DISTINCT FROM p_expected_images OR p_images IS NULL THEN RAISE EXCEPTION 'community_image_set_conflict' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_images) url WHERE NOT url=ANY(p_expected_images) AND url NOT LIKE 'https://community-media.locally-travel.com/community/v1/%') THEN RAISE EXCEPTION 'community_managed_image_required' USING ERRCODE='42501'; END IF;
 INSERT INTO private.community_media_context(backend_id,transaction_id,post_id) VALUES(pg_backend_pid(),txid_current(),p_post_id);
 UPDATE public.community_posts SET images=p_images WHERE id=p_post_id RETURNING * INTO post;
 DELETE FROM private.community_media_context WHERE backend_id=pg_backend_pid() AND transaction_id=txid_current() AND post_id=p_post_id;
 RETURN jsonb_build_object('id',post.id,'images',post.images,'media_revision',post.media_revision);
END $$;
CREATE FUNCTION public.commit_community_post_images(p_actor_id uuid,p_post_id uuid,p_expected_revision bigint,p_expected_images text[],p_images text[])
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.commit_community_post_images(p_actor_id,p_post_id,p_expected_revision,p_expected_images,p_images) $$;
REVOKE ALL ON FUNCTION private.commit_community_post_images(uuid,uuid,bigint,text[],text[]),public.commit_community_post_images(uuid,uuid,bigint,text[],text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.commit_community_post_images(uuid,uuid,bigint,text[],text[]),public.commit_community_post_images(uuid,uuid,bigint,text[],text[]) TO service_role;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE FUNCTION private.set_community_legacy_writer_freeze(p_frozen boolean,p_smoke_asset_id uuid,p_sha256 text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_frozen IS NULL OR NOT EXISTS(SELECT 1 FROM public.media_assets a WHERE id=p_smoke_asset_id AND business_scope='community' AND state='committed' AND uploaded_at IS NOT NULL AND verified_at IS NOT NULL AND expected_sha256=p_sha256 AND EXISTS(SELECT 1 FROM public.media_asset_references r WHERE r.asset_id=a.id AND r.parent_type='community_post')) THEN RAISE EXCEPTION 'community_verified_smoke_required' USING ERRCODE='23514'; END IF;
 UPDATE private.community_media_authority SET legacy_writes_frozen=p_frozen; RETURN p_frozen;
END $$;
CREATE FUNCTION public.set_community_legacy_writer_freeze(p_frozen boolean,p_smoke_asset_id uuid,p_sha256 text) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.set_community_legacy_writer_freeze(p_frozen,p_smoke_asset_id,p_sha256) $$;
REVOKE ALL ON FUNCTION private.set_community_legacy_writer_freeze(boolean,uuid,text),public.set_community_legacy_writer_freeze(boolean,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.set_community_legacy_writer_freeze(boolean,uuid,text),public.set_community_legacy_writer_freeze(boolean,uuid,text) TO service_role;

CREATE FUNCTION private.community_media_migration_inventory() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('bucketPublic',(SELECT public FROM storage.buckets WHERE id='images'),'legacyWritesFrozen',(SELECT legacy_writes_frozen FROM private.community_media_authority),
  'objects',coalesce((SELECT jsonb_agg(jsonb_build_object('key',name,'owner',owner_id,'size',(metadata->>'size')::bigint,'mime',metadata->>'mimetype','version',version,'updatedAt',updated_at) ORDER BY name) FROM storage.objects WHERE bucket_id='images' AND name LIKE 'community/%'),'[]'::jsonb),
  'posts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'owner',user_id,'images',coalesce(images,ARRAY[]::text[]),'revision',media_revision) ORDER BY id) FROM public.community_posts),'[]'::jsonb))
$$;
CREATE FUNCTION public.community_media_migration_inventory() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.community_media_migration_inventory() $$;
REVOKE ALL ON FUNCTION private.community_media_migration_inventory(),public.community_media_migration_inventory() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.community_media_migration_inventory(),public.community_media_migration_inventory() TO service_role;

-- One bounded plan = one transaction. Whole image sets and all references are checked.
CREATE FUNCTION private.apply_community_media_locators(p_plan_digest text,p_assets jsonb,p_posts jsonb,p_rollback boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry jsonb; row_plan jsonb; post public.community_posts; receipt private.community_media_plan_receipts; payload jsonb; source storage.objects; asset public.media_assets; expected_images text[]; next_images text[]; original_images text[]; approved_images text[]; ref_ids text[]; actual_ids text[]; expected_revision bigint;
BEGIN
 IF p_plan_digest IS NULL OR p_plan_digest !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_assets) IS DISTINCT FROM 'array' OR jsonb_typeof(p_posts) IS DISTINCT FROM 'array' OR jsonb_array_length(p_assets)<1 OR jsonb_array_length(p_assets)>200 OR jsonb_array_length(p_posts)<1 OR jsonb_array_length(p_posts)>500 OR p_rollback IS NULL THEN RAISE EXCEPTION 'community_plan_bounds' USING ERRCODE='23514'; END IF;
 IF NOT (SELECT legacy_writes_frozen FROM private.community_media_authority) THEN RAISE EXCEPTION 'community_legacy_writer_not_frozen' USING ERRCODE='42501'; END IF;
 payload:=jsonb_build_object('assets',p_assets,'posts',p_posts);
 -- Serialize concurrent apply/rollback of this approved plan without caller GUC trust.
 PERFORM pg_advisory_xact_lock(hashtextextended('community-plan:'||p_plan_digest,0));
 SELECT * INTO receipt FROM private.community_media_plan_receipts WHERE plan_digest=p_plan_digest FOR UPDATE;
 IF receipt.plan_digest IS NOT NULL AND receipt.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'community_plan_receipt_conflict' USING ERRCODE='40001'; END IF;
 IF p_rollback AND receipt.plan_digest IS NULL THEN RAISE EXCEPTION 'community_rollback_receipt_required' USING ERRCODE='40001'; END IF;
 IF (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(p_assets) e)<>jsonb_array_length(p_assets) OR (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(p_posts) e)<>jsonb_array_length(p_posts) THEN RAISE EXCEPTION 'community_duplicate_plan_identity' USING ERRCODE='23514'; END IF;
 -- Lock every parent before checking the exact complete locator reference set.
 PERFORM 1 FROM public.community_posts WHERE id::text IN (SELECT e->>'id' FROM jsonb_array_elements(p_posts) e) ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM public.community_posts WHERE id::text IN (SELECT e->>'id' FROM jsonb_array_elements(p_posts) e))<>jsonb_array_length(p_posts) THEN RAISE EXCEPTION 'community_post_missing' USING ERRCODE='40001'; END IF;
 FOR entry IN SELECT e FROM jsonb_array_elements(p_assets) e ORDER BY e->>'id' LOOP
  SELECT * INTO asset FROM public.media_assets WHERE id=(entry->>'id')::uuid FOR UPDATE;
  SELECT * INTO source FROM storage.objects WHERE bucket_id='images' AND name=entry->>'sourceKey';
  IF source.name IS NULL OR source.owner_id::text IS DISTINCT FROM entry->>'owner' OR (source.metadata->>'size')::bigint IS DISTINCT FROM (entry->>'size')::bigint OR source.metadata->>'mimetype' IS DISTINCT FROM entry->>'mime' OR source.version IS DISTINCT FROM entry->>'version' OR source.updated_at IS DISTINCT FROM (entry->>'updatedAt')::timestamptz OR source.name NOT LIKE 'community/%' OR entry->>'oldUrl'<>'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/images/'||source.name THEN RAISE EXCEPTION 'community_source_identity_drift' USING ERRCODE='40001'; END IF;
  IF asset.id IS NULL OR asset.owner_id::text IS DISTINCT FROM entry->>'owner' OR asset.business_scope<>'community' OR asset.public_url IS DISTINCT FROM entry->>'newUrl' OR asset.expected_sha256 IS DISTINCT FROM entry->>'sha256' OR asset.expected_size IS DISTINCT FROM (entry->>'size')::bigint OR asset.mime IS DISTINCT FROM entry->>'mime' OR asset.verified_at IS NULL OR asset.uploaded_at IS NULL THEN RAISE EXCEPTION 'community_destination_not_verified' USING ERRCODE='23514'; END IF;
  SELECT array_agg(e->>'id' ORDER BY e->>'id') INTO ref_ids FROM jsonb_array_elements(p_posts) e WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(e->'oldImages') u WHERE u=entry->>'oldUrl');
  SELECT array_agg(id::text ORDER BY id::text) INTO actual_ids FROM public.community_posts WHERE (entry->>'oldUrl')=ANY(coalesce(images,ARRAY[]::text[])) OR (entry->>'newUrl')=ANY(coalesce(images,ARRAY[]::text[]));
  IF ref_ids IS NULL OR ref_ids IS DISTINCT FROM actual_ids OR EXISTS(SELECT 1 FROM public.community_posts WHERE id::text=ANY(actual_ids) AND user_id::text<>entry->>'owner') THEN RAISE EXCEPTION 'community_reference_set_drift' USING ERRCODE='40001'; END IF;
 END LOOP;
 FOR row_plan IN SELECT e FROM jsonb_array_elements(p_posts) e ORDER BY e->>'id' LOOP
  SELECT * INTO post FROM public.community_posts WHERE id=(row_plan->>'id')::uuid;
  SELECT coalesce(array_agg(v ORDER BY n),ARRAY[]::text[]) INTO original_images FROM jsonb_array_elements_text(row_plan->'oldImages') WITH ORDINALITY a(v,n);
  SELECT coalesce(array_agg(v ORDER BY n),ARRAY[]::text[]) INTO approved_images FROM jsonb_array_elements_text(row_plan->'newImages') WITH ORDINALITY a(v,n);
  -- Validate the new set is only an exact replacement of approved Community sources.
  SELECT coalesce(array_agg(coalesce((SELECT e->>'newUrl' FROM jsonb_array_elements(p_assets) e WHERE e->>'oldUrl'=v),v) ORDER BY n),ARRAY[]::text[]) INTO next_images FROM unnest(original_images) WITH ORDINALITY a(v,n);
  IF next_images IS DISTINCT FROM approved_images OR original_images=approved_images OR post.user_id::text IS DISTINCT FROM row_plan->>'owner' THEN RAISE EXCEPTION 'community_post_plan_identity' USING ERRCODE='23514'; END IF;
  expected_revision:=(row_plan->>'revision')::bigint;
  IF p_rollback THEN
   expected_images:=CASE WHEN receipt.state='rolled_back' THEN original_images ELSE approved_images END;
   expected_revision:=expected_revision+CASE WHEN receipt.state='rolled_back' THEN 2 ELSE 1 END;
   next_images:=original_images;
  ELSIF receipt.state='applied' THEN expected_images:=approved_images; expected_revision:=expected_revision+1;
  ELSIF receipt.state='rolled_back' THEN RAISE EXCEPTION 'community_fresh_plan_required' USING ERRCODE='40001';
  ELSE expected_images:=original_images;
  END IF;
  IF post.media_revision IS DISTINCT FROM expected_revision OR coalesce(post.images,ARRAY[]::text[]) IS DISTINCT FROM expected_images THEN RAISE EXCEPTION 'community_newer_edit_conflict' USING ERRCODE='40001'; END IF;
  IF (p_rollback AND receipt.state='rolled_back') OR (NOT p_rollback AND receipt.state='applied') THEN CONTINUE; END IF;
  INSERT INTO private.community_media_context(backend_id,transaction_id,post_id,rollback) VALUES(pg_backend_pid(),txid_current(),post.id,p_rollback);
  UPDATE public.community_posts SET images=next_images WHERE id=post.id;
  DELETE FROM private.community_media_context WHERE backend_id=pg_backend_pid() AND transaction_id=txid_current() AND post_id=post.id;
 END LOOP;
 INSERT INTO private.community_media_plan_receipts(plan_digest,payload,state) VALUES(p_plan_digest,payload,CASE WHEN p_rollback THEN 'rolled_back' ELSE 'applied' END) ON CONFLICT(plan_digest) DO UPDATE SET state=EXCLUDED.state;
 RETURN true;
END $$;
CREATE FUNCTION public.apply_community_media_locators(p_plan_digest text,p_assets jsonb,p_posts jsonb,p_rollback boolean)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.apply_community_media_locators(p_plan_digest,p_assets,p_posts,p_rollback) $$;
REVOKE ALL ON FUNCTION private.apply_community_media_locators(text,jsonb,jsonb,boolean),public.apply_community_media_locators(text,jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.apply_community_media_locators(text,jsonb,jsonb,boolean),public.apply_community_media_locators(text,jsonb,jsonb,boolean) TO service_role;

-- Owner-account planning cannot prematurely journal still-referenced Community bytes.
CREATE FUNCTION private.guard_community_reference_zero_journal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.media_assets WHERE id=NEW.asset_id AND business_scope='community') THEN
  PERFORM 1 FROM public.media_assets WHERE id=NEW.asset_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.media_asset_references WHERE asset_id=NEW.asset_id) THEN RETURN NULL; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_community_reference_zero_journal() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER community_reference_zero_journal BEFORE INSERT ON public.media_deletion_journal FOR EACH ROW EXECUTE FUNCTION private.guard_community_reference_zero_journal();
COMMENT ON COLUMN public.community_posts.media_revision IS 'Community image-set CAS revision; counters/content do not bump it. Physical source deletion remains disabled.';

CREATE FUNCTION private.guard_community_physical_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.media_assets WHERE id=NEW.asset_id AND business_scope='community') AND (NEW.state IN ('deleting','complete') OR NEW.object_deleted_at IS NOT NULL OR NEW.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'community_physical_delete_disabled' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_community_physical_delete() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER community_physical_delete_disabled BEFORE INSERT OR UPDATE ON public.media_deletion_journal FOR EACH ROW EXECUTE FUNCTION private.guard_community_physical_delete();

-- Scoped backup association: no post content, unrelated Auth or other authority data.
-- Full DB/schema backup remains mandatory for private plan receipts and restore.
CREATE FUNCTION private.community_media_backup_contract() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'assets',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.media_assets a WHERE business_scope='community'),'[]'::jsonb),
  'references',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.asset_id,r.parent_id) FROM public.media_asset_references r JOIN public.media_assets a ON a.id=r.asset_id WHERE a.business_scope='community'),'[]'::jsonb),
  'journal',coalesce((SELECT jsonb_agg(to_jsonb(j) ORDER BY j.asset_id) FROM public.media_deletion_journal j JOIN public.media_assets a ON a.id=j.asset_id WHERE a.business_scope='community'),'[]'::jsonb),
  'posts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'owner',p.user_id,'revision',p.media_revision) ORDER BY p.id) FROM public.community_posts p WHERE EXISTS(SELECT 1 FROM public.media_asset_references r JOIN public.media_assets a ON a.id=r.asset_id WHERE r.parent_type='community_post' AND r.parent_id=p.id::text AND a.business_scope='community')),'[]'::jsonb),
  'legacyWritesFrozen',(SELECT legacy_writes_frozen FROM private.community_media_authority))
$$;
CREATE FUNCTION public.community_media_backup_contract() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.community_media_backup_contract() $$;
REVOKE ALL ON FUNCTION private.community_media_backup_contract(),public.community_media_backup_contract() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.community_media_backup_contract(),public.community_media_backup_contract() TO service_role;
