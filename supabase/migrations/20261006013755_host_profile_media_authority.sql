-- Additive Host source extension. Completed Avatar authority is unchanged.
-- No legacy backfill, Storage mutation, physical deletion or scheduler.
ALTER TABLE public.media_assets ADD CONSTRAINT host_profile_media_identity CHECK (
 business_scope <> 'host_profile' OR (
  provider='r2' AND bucket='locally-public-host-profile-originals' AND parent_type='host_profile_owner' AND parent_id=owner_id::text
  AND expected_size<=10485760 AND mime ~ '^image/[a-z0-9][a-z0-9.+-]{0,79}$' AND mime NOT IN ('image/heic','image/heif')
  AND object_key='host-profiles/v1/' || pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to('host-profile-media-owner:' || owner_id::text,'UTF8')),'hex') || '/' || id::text || '/profile'
  AND public_url='https://host-profile-media.locally-travel.com/' || object_key AND public_url IS NOT NULL
 )
);
CREATE FUNCTION public.begin_host_profile_media_asset(p_id uuid,p_owner_id uuid,p_key text,p_url text,p_sha256 text,p_size bigint,p_mime text,p_idempotency_key text)
RETURNS public.media_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.media_assets;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_owner_id) THEN RAISE EXCEPTION 'host_profile_owner_required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.media_assets(id,owner_id,business_scope,parent_type,parent_id,provider,bucket,object_key,public_url,expected_sha256,expected_size,mime,idempotency_key)
 VALUES(p_id,p_owner_id,'host_profile','host_profile_owner',p_owner_id::text,'r2','locally-public-host-profile-originals',p_key,p_url,p_sha256,p_size,p_mime,p_idempotency_key)
 ON CONFLICT(owner_id,idempotency_key) DO NOTHING;
 SELECT * INTO STRICT result FROM public.media_assets WHERE owner_id=p_owner_id AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF result.id<>p_id OR result.business_scope<>'host_profile' OR result.object_key<>p_key OR result.public_url<>p_url OR result.expected_sha256<>p_sha256 OR result.expected_size<>p_size OR result.mime<>p_mime OR result.state='tombstoned' THEN
  RAISE EXCEPTION 'host_profile_identity_conflict' USING ERRCODE='23505';
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.verify_host_profile_media_asset(p_id uuid,p_owner_id uuid,p_sha256 text,p_size bigint,p_mime text)
RETURNS public.media_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.media_assets;
BEGIN
 UPDATE public.media_assets SET uploaded_at=coalesce(uploaded_at,now()),verified_at=coalesce(verified_at,now())
 WHERE id=p_id AND owner_id=p_owner_id AND business_scope='host_profile' AND state IN ('pending','committed') AND expected_sha256=p_sha256 AND expected_size=p_size AND mime=p_mime RETURNING * INTO result;
 IF result.id IS NULL THEN RAISE EXCEPTION 'host_profile_verification_conflict' USING ERRCODE='40001'; END IF;
 RETURN result;
END $$;
-- Separate hooks track Host source URLs in both parents; Avatar hooks are neither
-- replaced nor extended. Profile hook only attaches host_profile-scope assets.
CREATE FUNCTION private.sync_host_profile_assets() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_value uuid; parent_value text; kind text; locator text; digest text; asset public.media_assets; present boolean;
BEGIN
 IF TG_TABLE_SCHEMA='auth' THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.raw_user_meta_data->>'avatar_url' IS NOT DISTINCT FROM OLD.raw_user_meta_data->>'avatar_url' THEN RETURN NEW; END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='host_applications' THEN
  owner_value:=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  parent_value:=CASE WHEN TG_OP='DELETE' THEN OLD.id::text ELSE NEW.id::text END;
  locator:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.profile_photo END;
  kind:='host_application_profile';
  IF TG_OP='UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.id IS DISTINCT FROM OLD.id) THEN RAISE EXCEPTION 'host_profile_owner_required' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_SCHEMA='auth' THEN
  owner_value:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  parent_value:=owner_value::text;
  locator:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.raw_user_meta_data->>'avatar_url' END;
  kind:='auth_legacy_host';
  IF TG_OP='UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'host_profile_owner_required' USING ERRCODE='42501'; END IF;
  -- Auth preference/token writes preserve Host locators. External/OAuth changes
  -- can detach an edge, but browser/Auth metadata can never attach Host authority.
  IF TG_OP='UPDATE' AND NEW.raw_user_meta_data->>'avatar_url' IS DISTINCT FROM OLD.raw_user_meta_data->>'avatar_url'
   AND current_setting('role',true) NOT IN ('service_role','postgres','none')
   AND coalesce(NEW.raw_user_meta_data->>'avatar_url','') LIKE 'https://host-profile-media.locally-travel.com/%'
  THEN RAISE EXCEPTION 'host_profile_auth_backend_required' USING ERRCODE='42501'; END IF;
 ELSE
  owner_value:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  parent_value:=owner_value::text;
  locator:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.avatar_url END;
  kind:='profile_legacy_host';
  IF TG_OP='UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'host_profile_owner_required' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_TABLE_SCHEMA<>'auth' AND current_setting('role',true) NOT IN ('service_role','postgres','none') AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM owner_value) THEN RAISE EXCEPTION 'host_profile_owner_required' USING ERRCODE='42501'; END IF;
 digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(locator,''),'UTF8')),'hex');
 IF locator LIKE 'https://host-profile-media.locally-travel.com/%' AND NOT EXISTS (
  SELECT 1 FROM public.media_assets WHERE public_url=locator AND business_scope='host_profile' AND owner_id=owner_value AND state IN ('pending','committed') AND uploaded_at IS NOT NULL AND verified_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'host_profile_not_verified_or_owned' USING ERRCODE='23514'; END IF;
 FOR asset IN SELECT a.* FROM public.media_assets a WHERE a.business_scope='host_profile' AND (
  a.public_url=locator OR EXISTS(SELECT 1 FROM public.media_asset_references r WHERE r.asset_id=a.id AND r.parent_type=kind AND r.parent_id=parent_value)
 ) ORDER BY a.id FOR UPDATE LOOP
  present:=TG_OP<>'DELETE' AND asset.public_url=locator;
  IF present THEN
   IF asset.owner_id IS DISTINCT FROM owner_value OR asset.state='tombstoned' OR asset.verified_at IS NULL OR asset.uploaded_at IS NULL THEN RAISE EXCEPTION 'host_profile_not_verified_or_owned' USING ERRCODE='23514'; END IF;
   INSERT INTO public.media_asset_references(asset_id,parent_type,parent_id,reference_digest) VALUES(asset.id,kind,parent_value,digest)
   ON CONFLICT(asset_id,parent_type,parent_id) DO UPDATE SET reference_digest=EXCLUDED.reference_digest;
   UPDATE public.media_assets SET state='committed',committed_at=coalesce(committed_at,now()) WHERE id=asset.id;
  ELSE
   DELETE FROM public.media_asset_references WHERE asset_id=asset.id AND parent_type=kind AND parent_id=parent_value;
   IF NOT EXISTS(SELECT 1 FROM public.media_asset_references WHERE asset_id=asset.id) THEN
    UPDATE public.media_assets SET state='tombstoned',tombstoned_at=coalesce(tombstoned_at,now()) WHERE id=asset.id;
    INSERT INTO public.media_deletion_journal(asset_id,provider,bucket,object_key,expected_sha256,expected_size,reason,reference_digest)
    VALUES(asset.id,asset.provider,asset.bucket,asset.object_key,asset.expected_sha256,asset.expected_size,CASE WHEN TG_OP='DELETE' THEN 'parent_deleted' ELSE 'replaced' END,digest) ON CONFLICT(asset_id) DO NOTHING;
   END IF;
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.sync_host_profile_assets() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER host_profile_finalize AFTER INSERT OR UPDATE OF profile_photo,user_id,id ON public.host_applications FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets();
CREATE TRIGGER host_profile_delete_plan BEFORE DELETE ON public.host_applications FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets();
CREATE TRIGGER legacy_host_profile_finalize AFTER INSERT OR UPDATE OF avatar_url,id ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets();
CREATE TRIGGER legacy_host_profile_delete_plan BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets();

CREATE TRIGGER auth_host_profile_finalize AFTER UPDATE OF raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets();
CREATE TRIGGER auth_host_profile_delete_plan BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets();
-- Digests only: never store PII or rewrite unrelated Auth metadata/session fields.
CREATE TABLE private.host_profile_auth_cas (
 asset_id uuid PRIMARY KEY REFERENCES public.media_assets(id), owner_id uuid NOT NULL,
 before_digest text NOT NULL CHECK(before_digest ~ '^[a-f0-9]{64}$'),
 after_digest text NOT NULL CHECK(after_digest ~ '^[a-f0-9]{64}$')
);
REVOKE ALL ON private.host_profile_auth_cas FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.host_profile_auth_inventory() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('kind','auth_legacy_host','id',id::text,'owner',id::text,'locator',raw_user_meta_data->>'avatar_url',
 'metadataDigest',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(raw_user_meta_data::text,'UTF8')),'hex')) ORDER BY id),'[]'::jsonb)
 FROM (SELECT id,raw_user_meta_data FROM auth.users WHERE raw_user_meta_data->>'avatar_url' LIKE 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/images/profile/%'
 OR raw_user_meta_data->>'avatar_url' LIKE 'https://host-profile-media.locally-travel.com/%' ORDER BY id LIMIT 5001) u
$$;
REVOKE ALL ON FUNCTION private.host_profile_auth_inventory() FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.host_profile_auth_inventory() TO service_role;

-- Each shared source object's entire reference group CASes atomically. No account
-- Avatar R2 or external locator can be selected as the old source.
CREATE FUNCTION private.apply_host_profile_media_locators(p_owner_id uuid,p_asset_id uuid,p_old_url text,p_references jsonb,p_rollback boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset public.media_assets; ref jsonb; actual text; expected text; replacement text; n integer; metadata jsonb; before_digest text; after_digest text; expected_digest text;
BEGIN
 IF p_old_url IS NULL OR p_old_url !~ ('^https://uhinvcydgzqlpnvieyal[.]supabase[.]co/storage/v1/object/public/images/profile/' || p_owner_id::text || '_[0-9]+$') OR jsonb_typeof(p_references) IS DISTINCT FROM 'array' OR jsonb_array_length(p_references) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'host_profile_plan_invalid' USING ERRCODE='23514'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_references))<>(SELECT count(DISTINCT (r->>'kind') || ':' || (r->>'id')) FROM jsonb_array_elements(p_references) r) THEN RAISE EXCEPTION 'host_profile_duplicate_parent' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_owner_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'host_profile_owner_required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_owner_id AND u.raw_user_meta_data->>'avatar_url'=p_old_url AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_owner_id AND p.avatar_url=CASE WHEN p_rollback THEN (SELECT public_url FROM public.media_assets WHERE id=p_asset_id) ELSE p_old_url END)) THEN RAISE EXCEPTION 'host_profile_auth_public_disagreement' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_references) r WHERE r->>'kind'='auth_legacy_host') AND NOT EXISTS(SELECT 1 FROM public.host_applications h WHERE h.user_id=p_owner_id AND h.profile_photo=CASE WHEN p_rollback THEN (SELECT public_url FROM public.media_assets WHERE id=p_asset_id) ELSE p_old_url END) THEN RAISE EXCEPTION 'host_profile_auth_host_disagreement' USING ERRCODE='40001'; END IF;
 IF NOT p_rollback AND (
  (SELECT count(*) FROM public.host_applications WHERE profile_photo=p_old_url)+(SELECT count(*) FROM public.profiles WHERE avatar_url=p_old_url)+(SELECT count(*) FROM auth.users WHERE raw_user_meta_data->>'avatar_url'=p_old_url)
 )<>jsonb_array_length(p_references) THEN RAISE EXCEPTION 'host_profile_reference_set_drift' USING ERRCODE='40001'; END IF;
 PERFORM 1 FROM private.host_profile_source_authority WHERE singleton AND r2_enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'host_profile_legacy_writer_not_frozen' USING ERRCODE='40001'; END IF;
 -- Lock all business parents before managed assets, in deterministic order.
 FOR ref IN SELECT value FROM jsonb_array_elements(p_references) ORDER BY value->>'kind',value->>'id' LOOP
  IF ref->>'kind'='host_application' THEN
   PERFORM 1 FROM public.host_applications WHERE id=(ref->>'id')::uuid AND user_id=p_owner_id FOR UPDATE;
  ELSIF ref->>'kind'='auth_legacy_host' AND ref->>'id'=p_owner_id::text THEN
   PERFORM 1 FROM auth.users WHERE id=p_owner_id FOR UPDATE;
  ELSIF ref->>'kind'='profile_legacy_host' AND ref->>'id'=p_owner_id::text THEN
   PERFORM 1 FROM public.profiles WHERE id=p_owner_id FOR UPDATE;
  ELSE RAISE EXCEPTION 'host_profile_parent_invalid' USING ERRCODE='23514'; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'host_profile_parent_invalid' USING ERRCODE='23514'; END IF;
 END LOOP;
 SELECT * INTO asset FROM public.media_assets WHERE id=p_asset_id FOR UPDATE;
 IF asset.id IS NULL OR asset.business_scope<>'host_profile' OR asset.owner_id IS DISTINCT FROM p_owner_id OR asset.state NOT IN ('pending','committed') OR asset.uploaded_at IS NULL OR asset.verified_at IS NULL THEN RAISE EXCEPTION 'host_profile_not_verified_or_owned' USING ERRCODE='23514'; END IF;
 expected:=CASE WHEN p_rollback THEN asset.public_url ELSE p_old_url END;
 replacement:=CASE WHEN p_rollback THEN p_old_url ELSE asset.public_url END;
 IF p_rollback THEN INSERT INTO private.host_profile_operation_context VALUES(pg_backend_pid(),txid_current(),p_owner_id,p_old_url); END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(p_references) ORDER BY value->>'kind',value->>'id' LOOP
  IF ref->>'kind'='host_application' THEN
   UPDATE public.host_applications SET profile_photo=replacement WHERE id=(ref->>'id')::uuid AND user_id=p_owner_id AND profile_photo IS NOT DISTINCT FROM expected;
  ELSIF ref->>'kind'='auth_legacy_host' THEN
   SELECT raw_user_meta_data INTO metadata FROM auth.users WHERE id=p_owner_id;
   before_digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(metadata::text,'UTF8')),'hex');
   IF p_rollback THEN SELECT c.after_digest INTO expected_digest FROM private.host_profile_auth_cas c WHERE c.asset_id=p_asset_id AND c.owner_id=p_owner_id;
   ELSE expected_digest:=ref->>'metadataDigest'; END IF;
   IF expected_digest IS NULL OR before_digest IS DISTINCT FROM expected_digest THEN RAISE EXCEPTION 'host_profile_auth_metadata_drift' USING ERRCODE='40001'; END IF;
   UPDATE auth.users SET raw_user_meta_data=pg_catalog.jsonb_set(raw_user_meta_data,'{avatar_url}',pg_catalog.to_jsonb(replacement)) WHERE id=p_owner_id AND raw_user_meta_data->>'avatar_url' IS NOT DISTINCT FROM expected;
   GET DIAGNOSTICS n=ROW_COUNT;
   IF n<>1 THEN RAISE EXCEPTION 'host_profile_cas_conflict' USING ERRCODE='40001'; END IF;
   IF NOT p_rollback THEN
    SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(raw_user_meta_data::text,'UTF8')),'hex') INTO after_digest FROM auth.users WHERE id=p_owner_id;
    INSERT INTO private.host_profile_auth_cas VALUES(p_asset_id,p_owner_id,before_digest,after_digest);
   END IF;
  ELSE
   UPDATE public.profiles SET avatar_url=replacement WHERE id=p_owner_id AND avatar_url IS NOT DISTINCT FROM expected;
  END IF;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'host_profile_cas_conflict' USING ERRCODE='40001'; END IF;
 END LOOP;
 DELETE FROM private.host_profile_operation_context WHERE backend_id=pg_backend_pid() AND transaction_id=txid_current();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.apply_host_profile_media_locators(uuid,uuid,text,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.apply_host_profile_media_locators(uuid,uuid,text,jsonb,boolean) TO service_role;
CREATE FUNCTION public.apply_host_profile_media_locators(p_owner_id uuid,p_asset_id uuid,p_old_url text,p_references jsonb,p_rollback boolean DEFAULT false)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.apply_host_profile_media_locators(p_owner_id,p_asset_id,p_old_url,p_references,p_rollback)
$$;
CREATE FUNCTION private.host_profile_legacy_writes_frozen() RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN (SELECT r2_enabled FROM private.host_profile_source_authority WHERE singleton); END $$;
REVOKE ALL ON FUNCTION private.host_profile_legacy_writes_frozen() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.host_profile_legacy_writes_frozen() TO service_role;
CREATE FUNCTION public.host_profile_migration_inventory() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'bucketPublic',(SELECT public FROM storage.buckets WHERE id='images'),
  'legacyWritesFrozen',private.host_profile_legacy_writes_frozen(),
  'references',(SELECT coalesce(jsonb_agg(t ORDER BY kind,id),'[]'::jsonb) FROM (
   SELECT 'host_application' kind,id::text,user_id::text owner,profile_photo locator FROM (SELECT * FROM public.host_applications ORDER BY id LIMIT 5001) h
   UNION ALL SELECT 'profile_legacy_host',id::text,id::text,avatar_url FROM (SELECT id,avatar_url FROM public.profiles WHERE coalesce(avatar_url,'')<>'' ORDER BY id LIMIT 5001) p
  )t) || private.host_profile_auth_inventory(),
  'objects',(SELECT coalesce(jsonb_agg(jsonb_build_object('key',name,'owner',owner_id,'size',(metadata->>'size')::bigint,'mime',metadata->>'mimetype','version',version,'updatedAt',updated_at) ORDER BY name),'[]'::jsonb) FROM (SELECT name,owner_id,metadata,version,updated_at FROM storage.objects WHERE bucket_id='images' AND name LIKE 'profile/%' ORDER BY name LIMIT 1001)o)
 )
$$;
REVOKE ALL ON FUNCTION public.begin_host_profile_media_asset(uuid,uuid,text,text,text,bigint,text,text),public.verify_host_profile_media_asset(uuid,uuid,text,bigint,text),public.apply_host_profile_media_locators(uuid,uuid,text,jsonb,boolean),public.host_profile_migration_inventory() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_host_profile_media_asset(uuid,uuid,text,text,text,bigint,text,text),public.verify_host_profile_media_asset(uuid,uuid,text,bigint,text),public.apply_host_profile_media_locators(uuid,uuid,text,jsonb,boolean),public.host_profile_migration_inventory() TO service_role;

CREATE FUNCTION private.lock_host_profile_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_SCHEMA='auth' THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.raw_user_meta_data->>'avatar_url' IS NOT DISTINCT FROM OLD.raw_user_meta_data->>'avatar_url' THEN RETURN NEW; END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='host_applications' THEN PERFORM 1 FROM public.profiles WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END FOR UPDATE;
 ELSE PERFORM 1 FROM public.profiles WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END FOR UPDATE; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.lock_host_profile_owner() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER a_host_profile_owner_lock BEFORE INSERT OR UPDATE OF profile_photo,user_id,id OR DELETE ON public.host_applications FOR EACH ROW EXECUTE FUNCTION private.lock_host_profile_owner();
CREATE TRIGGER a_auth_host_profile_owner_lock BEFORE UPDATE OF raw_user_meta_data OR DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION private.lock_host_profile_owner();

CREATE FUNCTION public.host_profile_auth_backup_references() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT private.host_profile_auth_inventory()
$$;
REVOKE ALL ON FUNCTION public.host_profile_auth_backup_references() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.host_profile_auth_backup_references() TO service_role;
-- Explicit, separately approved Production gate. Migration starts disabled.
CREATE TABLE private.host_profile_source_authority(singleton boolean PRIMARY KEY CHECK(singleton),r2_enabled boolean NOT NULL DEFAULT false);
INSERT INTO private.host_profile_source_authority VALUES(true,false);
CREATE TABLE private.host_profile_operation_context(backend_id integer,transaction_id bigint,owner_id uuid,legacy_url text,PRIMARY KEY(backend_id,transaction_id));
REVOKE ALL ON private.host_profile_source_authority,private.host_profile_operation_context FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.guard_host_profile_legacy_writer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE locator text; previous text; owner_value uuid;
BEGIN
 IF TG_TABLE_SCHEMA='storage' THEN
  IF TG_OP='DELETE' THEN
   IF OLD.bucket_id='images' AND OLD.name LIKE 'profile/%' THEN RAISE EXCEPTION 'host_profile_legacy_physical_delete_disabled' USING ERRCODE='42501'; END IF;
  END IF;
 END IF;
 IF NOT (SELECT r2_enabled FROM private.host_profile_source_authority WHERE singleton) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 IF TG_TABLE_SCHEMA='storage' THEN
  IF (TG_OP<>'INSERT' AND OLD.bucket_id='images' AND OLD.name LIKE 'profile/%') OR (TG_OP<>'DELETE' AND NEW.bucket_id='images' AND NEW.name LIKE 'profile/%') THEN RAISE EXCEPTION 'host_profile_legacy_storage_write_disabled' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='host_applications' THEN locator:=NEW.profile_photo; owner_value:=NEW.user_id; IF TG_OP='UPDATE' THEN previous:=OLD.profile_photo; END IF;
 ELSIF TG_TABLE_SCHEMA='auth' THEN locator:=NEW.raw_user_meta_data->>'avatar_url'; owner_value:=NEW.id; IF TG_OP='UPDATE' THEN previous:=OLD.raw_user_meta_data->>'avatar_url'; END IF;
 ELSE locator:=NEW.avatar_url; owner_value:=NEW.id; IF TG_OP='UPDATE' THEN previous:=OLD.avatar_url; END IF; END IF;
 IF locator LIKE 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/images/profile/%' AND locator IS DISTINCT FROM previous
 AND NOT EXISTS(SELECT 1 FROM private.host_profile_operation_context c WHERE c.backend_id=pg_backend_pid() AND c.transaction_id=txid_current() AND c.owner_id=owner_value AND c.legacy_url=locator) THEN RAISE EXCEPTION 'host_profile_legacy_locator_write_disabled' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_host_profile_legacy_writer() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER b_host_profile_legacy_writer BEFORE INSERT OR UPDATE OF profile_photo ON public.host_applications FOR EACH ROW EXECUTE FUNCTION private.guard_host_profile_legacy_writer();
CREATE TRIGGER b_profile_legacy_host_writer BEFORE INSERT OR UPDATE OF avatar_url ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.guard_host_profile_legacy_writer();
CREATE TRIGGER b_auth_legacy_host_writer BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION private.guard_host_profile_legacy_writer();
CREATE TRIGGER host_profile_legacy_storage_writer BEFORE INSERT OR UPDATE OR DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION private.guard_host_profile_legacy_writer();

-- Existing account deletion plans every owned asset before deleting parents.
-- Preserve that function and all other scopes; Host journals require ref-zero.
CREATE FUNCTION private.guard_host_profile_reference_zero_journal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset_owner uuid; scope text;
BEGIN
 SELECT owner_id,business_scope INTO asset_owner,scope FROM public.media_assets WHERE id=NEW.asset_id;
 IF scope='host_profile' THEN
  PERFORM 1 FROM public.profiles WHERE id=asset_owner FOR UPDATE;
  PERFORM 1 FROM public.media_assets WHERE id=NEW.asset_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.media_asset_references WHERE asset_id=NEW.asset_id) THEN RETURN NULL; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_host_profile_reference_zero_journal() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER host_profile_reference_zero_journal BEFORE INSERT ON public.media_deletion_journal FOR EACH ROW EXECUTE FUNCTION private.guard_host_profile_reference_zero_journal();
