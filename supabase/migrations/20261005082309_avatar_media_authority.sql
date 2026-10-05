-- Avatar extension only. No legacy backfill, Storage mutation or deletion executor.
ALTER TABLE public.media_assets ADD CONSTRAINT avatar_media_identity CHECK (
  business_scope <> 'avatar' OR (
    provider='r2' AND bucket='locally-public-avatars' AND parent_type='profile_avatar' AND parent_id IS NOT NULL AND parent_id=owner_id::text AND public_url IS NOT NULL
    AND expected_size <= 10485760 AND mime IN ('image/jpeg','image/png','image/webp','image/gif','image/avif')
    AND object_key = 'avatars/v1/' || pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to('avatar-media-owner:' || owner_id::text,'UTF8')),'hex')
      || '/' || id::text || '/avatar.' || CASE mime WHEN 'image/jpeg' THEN 'jpg' ELSE pg_catalog.substr(mime,7) END
    AND public_url='https://avatars-media.locally-travel.com/' || object_key
  )
);

CREATE FUNCTION public.begin_avatar_media_asset(
  p_id uuid,p_owner_id uuid,p_key text,p_url text,p_sha256 text,p_size bigint,p_mime text,p_idempotency_key text
) RETURNS public.media_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.media_assets;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_owner_id) THEN
    RAISE EXCEPTION 'avatar_owner_required' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.media_assets(id,owner_id,business_scope,parent_type,parent_id,provider,bucket,object_key,public_url,expected_sha256,expected_size,mime,idempotency_key)
  VALUES(p_id,p_owner_id,'avatar','profile_avatar',p_owner_id::text,'r2','locally-public-avatars',p_key,p_url,p_sha256,p_size,p_mime,p_idempotency_key)
  ON CONFLICT(owner_id,idempotency_key) DO NOTHING;
  SELECT * INTO STRICT result FROM public.media_assets WHERE owner_id=p_owner_id AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF result.id<>p_id OR result.object_key<>p_key OR result.public_url<>p_url OR result.business_scope<>'avatar'
    OR result.expected_sha256<>p_sha256 OR result.expected_size<>p_size OR result.mime<>p_mime OR result.state='tombstoned' THEN
    RAISE EXCEPTION 'avatar_idempotency_conflict' USING ERRCODE='23505';
  END IF;
  RETURN result;
END $$;

CREATE FUNCTION public.verify_avatar_media_asset(p_id uuid,p_owner_id uuid,p_sha256 text,p_size bigint,p_mime text)
RETURNS public.media_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.media_assets;
BEGIN
  UPDATE public.media_assets SET uploaded_at=coalesce(uploaded_at,now()),verified_at=coalesce(verified_at,now())
  WHERE id=p_id AND owner_id=p_owner_id AND business_scope='avatar' AND state IN ('pending','committed')
    AND expected_sha256=p_sha256 AND expected_size=p_size AND mime=p_mime RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'avatar_verification_conflict' USING ERRCODE='40001'; END IF;
  RETURN result;
END $$;

-- Trigger-only definer owns reference INSERT/DELETE, which remain denied to the
-- backend role and browsers. Existing profiles RLS still authorizes row writes.
CREATE FUNCTION private.sync_profile_avatar_assets() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_value uuid; locator text; digest text; asset public.media_assets; present boolean;
BEGIN
  owner_value:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  IF current_setting('role',true) NOT IN ('service_role','postgres','none') AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM owner_value) THEN
    RAISE EXCEPTION 'avatar_owner_required' USING ERRCODE='42501';
  END IF;
  IF TG_OP<>'DELETE' AND TG_OP<>'INSERT' AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'avatar_owner_required' USING ERRCODE='42501';
  END IF;
  locator:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.avatar_url END;
  digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(locator,''),'UTF8')),'hex');
  IF locator LIKE 'https://avatars-media.locally-travel.com/%' AND NOT EXISTS (
    SELECT 1 FROM public.media_assets WHERE public_url=locator AND business_scope='avatar' AND owner_id=owner_value
      AND state IN ('pending','committed') AND uploaded_at IS NOT NULL AND verified_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'avatar_not_verified_or_owned' USING ERRCODE='23514'; END IF;
  FOR asset IN SELECT a.* FROM public.media_assets a WHERE a.business_scope='avatar' AND (
    a.public_url=locator OR EXISTS(SELECT 1 FROM public.media_asset_references r WHERE r.asset_id=a.id AND r.parent_type='profile_avatar' AND r.parent_id=owner_value::text)
  ) ORDER BY a.id FOR UPDATE LOOP
    present:=TG_OP<>'DELETE' AND asset.public_url=locator;
    IF present THEN
      IF asset.owner_id IS DISTINCT FROM owner_value OR asset.state='tombstoned' OR asset.verified_at IS NULL OR asset.uploaded_at IS NULL THEN
        RAISE EXCEPTION 'avatar_not_verified_or_owned' USING ERRCODE='23514';
      END IF;
      INSERT INTO public.media_asset_references(asset_id,parent_type,parent_id,reference_digest)
      VALUES(asset.id,'profile_avatar',owner_value::text,digest)
      ON CONFLICT(asset_id,parent_type,parent_id) DO UPDATE SET reference_digest=EXCLUDED.reference_digest;
      UPDATE public.media_assets SET state='committed',committed_at=coalesce(committed_at,now()) WHERE id=asset.id;
    ELSE
      DELETE FROM public.media_asset_references WHERE asset_id=asset.id AND parent_type='profile_avatar' AND parent_id=owner_value::text;
      IF NOT EXISTS(SELECT 1 FROM public.media_asset_references WHERE asset_id=asset.id) THEN
        UPDATE public.media_assets SET state='tombstoned',tombstoned_at=coalesce(tombstoned_at,now()) WHERE id=asset.id;
        INSERT INTO public.media_deletion_journal(asset_id,provider,bucket,object_key,expected_sha256,expected_size,reason,reference_digest)
        VALUES(asset.id,asset.provider,asset.bucket,asset.object_key,asset.expected_sha256,asset.expected_size,CASE WHEN TG_OP='DELETE' THEN 'parent_deleted' ELSE 'replaced' END,digest)
        ON CONFLICT(asset_id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.sync_profile_avatar_assets() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER profile_avatar_finalize AFTER INSERT OR UPDATE OF avatar_url ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.sync_profile_avatar_assets();
CREATE TRIGGER profile_avatar_delete_plan BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.sync_profile_avatar_assets();

CREATE FUNCTION public.commit_profile_avatar(p_owner_id uuid,p_asset_id uuid,p_expected_url text,p_sha256 text,p_size bigint)
RETURNS public.media_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE current_url text; asset public.media_assets;
BEGIN
  SELECT avatar_url INTO current_url FROM public.profiles WHERE id=p_owner_id FOR UPDATE;
  IF NOT FOUND OR current_url IS DISTINCT FROM p_expected_url THEN RAISE EXCEPTION 'avatar_cas_conflict' USING ERRCODE='40001'; END IF;
  SELECT * INTO asset FROM public.media_assets WHERE id=p_asset_id FOR UPDATE;
  IF asset.id IS NULL OR asset.owner_id IS DISTINCT FROM p_owner_id OR asset.business_scope<>'avatar' OR asset.state<>'pending'
    OR asset.verified_at IS NULL OR asset.uploaded_at IS NULL OR asset.expected_sha256 IS DISTINCT FROM p_sha256 OR asset.expected_size IS DISTINCT FROM p_size THEN
    RAISE EXCEPTION 'avatar_not_verified_or_owned' USING ERRCODE='23514';
  END IF;
  UPDATE public.profiles SET avatar_url=asset.public_url WHERE id=p_owner_id;
  SELECT * INTO asset FROM public.media_assets WHERE id=p_asset_id;
  RETURN asset;
END $$;

-- Digest-bound journal selection is enforced by the operator. This RPC enforces
-- the corresponding exact new -> old CAS under the same profile lock.
CREATE FUNCTION public.rollback_profile_avatar(p_owner_id uuid,p_asset_id uuid,p_expected_url text,p_old_url text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE current_url text;
BEGIN
  IF p_old_url IS NULL OR p_old_url NOT LIKE 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/avatars/%' THEN
    RAISE EXCEPTION 'avatar_invalid_rollback_locator' USING ERRCODE='23514';
  END IF;
  SELECT avatar_url INTO current_url FROM public.profiles WHERE id=p_owner_id FOR UPDATE;
  IF NOT FOUND OR current_url IS DISTINCT FROM p_expected_url THEN RAISE EXCEPTION 'avatar_cas_conflict' USING ERRCODE='40001'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.media_assets WHERE id=p_asset_id AND owner_id=p_owner_id AND business_scope='avatar' AND state='committed' AND public_url=p_expected_url) THEN
    RAISE EXCEPTION 'avatar_invalid_rollback_asset' USING ERRCODE='23514';
  END IF;
  UPDATE public.profiles SET avatar_url=p_old_url WHERE id=p_owner_id;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.begin_avatar_media_asset(uuid,uuid,text,text,text,bigint,text,text),
  public.verify_avatar_media_asset(uuid,uuid,text,bigint,text),public.commit_profile_avatar(uuid,uuid,text,text,bigint),
  public.rollback_profile_avatar(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_avatar_media_asset(uuid,uuid,text,text,text,bigint,text,text),
  public.verify_avatar_media_asset(uuid,uuid,text,bigint,text),public.commit_profile_avatar(uuid,uuid,text,text,bigint),
  public.rollback_profile_avatar(uuid,uuid,text,text) TO service_role;

-- Bounded operator inventory, SELECT only. Supabase backend already has Storage
-- metadata read access; browser roles cannot execute this function.
CREATE FUNCTION public.avatar_migration_inventory() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT pg_catalog.jsonb_build_object(
    'bucketPublic',(SELECT public FROM storage.buckets WHERE id='avatars'),
    'profiles',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'avatar_url',avatar_url) ORDER BY id),'[]'::jsonb)
      FROM (SELECT id,avatar_url FROM public.profiles WHERE coalesce(avatar_url,'')<>'' ORDER BY id LIMIT 5001) p),
    'objects',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key',name,'ownerId',owner_id,'size',(metadata->>'size')::bigint,'mime',metadata->>'mimetype','version',version,'updatedAt',updated_at) ORDER BY name),'[]'::jsonb)
      FROM (SELECT name,owner_id,metadata,version,updated_at FROM storage.objects WHERE bucket_id='avatars' ORDER BY name LIMIT 1001) o)
  )
$$;
REVOKE ALL ON FUNCTION public.avatar_migration_inventory() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.avatar_migration_inventory() TO service_role;
