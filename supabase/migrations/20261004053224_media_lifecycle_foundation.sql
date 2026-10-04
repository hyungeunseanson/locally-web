-- Additive lifecycle foundation. No source-object deletion or legacy backfill.
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  business_scope text NOT NULL CHECK (business_scope IN ('experience', 'avatar', 'host_profile', 'community', 'chat', 'admin', 'verification')),
  parent_type text NOT NULL,
  parent_id text,
  provider text NOT NULL CHECK (provider IN ('supabase', 'r2')),
  bucket text NOT NULL CHECK (bucket ~ '^[a-zA-Z0-9_-]+$'),
  object_key text NOT NULL CHECK (object_key <> '' AND object_key !~ '(^/|(^|/)[.][.]?(/|$))'),
  public_url text UNIQUE,
  expected_sha256 text NOT NULL CHECK (expected_sha256 ~ '^[a-f0-9]{64}$'),
  expected_size bigint NOT NULL CHECK (expected_size > 0),
  mime text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'committed', 'tombstoned')),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_at timestamptz,
  verified_at timestamptz,
  committed_at timestamptz,
  tombstoned_at timestamptz,
  deleted_at timestamptz,
  backup_pinned boolean NOT NULL DEFAULT false,
  migration_pinned boolean NOT NULL DEFAULT false,
  UNIQUE (provider, bucket, object_key),
  UNIQUE (owner_id, idempotency_key),
  CHECK (state <> 'committed' OR (verified_at IS NOT NULL AND committed_at IS NOT NULL)),
  CHECK (state <> 'tombstoned' OR tombstoned_at IS NOT NULL),
  CHECK (business_scope <> 'experience' OR
    (expected_size <= 10485760 AND provider = 'r2' AND bucket = 'locally-public-experience-canary'
      AND object_key LIKE 'sources/v1/experience/%'
      AND public_url = 'https://media-canary.locally-travel.com/' || object_key))
);
CREATE INDEX media_assets_pending_idx ON public.media_assets (created_at, id) WHERE state = 'pending';
CREATE INDEX media_assets_owner_idx ON public.media_assets (owner_id, business_scope);
CREATE TABLE public.media_asset_references (
  asset_id uuid NOT NULL REFERENCES public.media_assets(id),
  parent_type text NOT NULL,
  parent_id text NOT NULL,
  reference_digest text NOT NULL CHECK (reference_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, parent_type, parent_id)
);
CREATE INDEX media_asset_references_parent_idx ON public.media_asset_references (parent_type, parent_id);
CREATE TABLE public.media_deletion_journal (
  asset_id uuid PRIMARY KEY REFERENCES public.media_assets(id),
  provider text NOT NULL,
  bucket text NOT NULL,
  object_key text NOT NULL,
  expected_sha256 text NOT NULL,
  expected_size bigint NOT NULL,
  reason text NOT NULL CHECK (reason IN ('replaced', 'parent_deleted', 'owner_deleted', 'pending_abandoned')),
  reference_digest text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'blocked', 'deleting', 'failed', 'complete')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_failure text CHECK (last_failure IN ('reference_exists', 'pinned', 'delete_disabled', 'identity_mismatch', 'provider_failed', 'purge_failed')),
  object_deleted_at timestamptz,
  completed_at timestamptz,
  CHECK (state <> 'complete' OR (object_deleted_at IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX media_deletion_journal_state_idx ON public.media_deletion_journal (state, requested_at);
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_asset_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_deletion_journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_assets, public.media_asset_references, public.media_deletion_journal FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.media_assets, public.media_deletion_journal TO service_role;
GRANT SELECT ON public.media_asset_references TO service_role;
COMMENT ON TABLE public.media_assets IS 'New lifecycle-managed assets only; no guessed legacy ownership. Physical deletion is disabled by default in the operator.';
COMMENT ON TABLE public.media_deletion_journal IS 'Durable deletion intent; queued is not physical deletion success. No automatic historical cleanup.';

CREATE FUNCTION public.begin_experience_media_asset(
  p_id uuid, p_owner_id uuid, p_key text, p_url text, p_sha256 text,
  p_size bigint, p_mime text, p_idempotency_key text, p_parent_id text
) RETURNS public.media_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result public.media_assets;
BEGIN
  INSERT INTO public.media_assets (id, owner_id, business_scope, parent_type, parent_id, provider, bucket, object_key, public_url, expected_sha256, expected_size, mime, idempotency_key)
  VALUES (p_id, p_owner_id, 'experience', 'experience', p_parent_id, 'r2', 'locally-public-experience-canary', p_key, p_url, p_sha256, p_size, p_mime, p_idempotency_key)
  ON CONFLICT (owner_id, idempotency_key) DO NOTHING;
  SELECT * INTO STRICT result FROM public.media_assets WHERE owner_id = p_owner_id AND idempotency_key = p_idempotency_key FOR UPDATE;
  IF result.business_scope <> 'experience' OR result.expected_sha256 <> p_sha256 OR result.expected_size <> p_size OR result.mime <> p_mime
    OR (p_parent_id IS NOT NULL AND result.parent_id IS DISTINCT FROM p_parent_id) OR result.state = 'tombstoned'
    OR pg_catalog.regexp_replace(result.object_key, '^.*/', '') <> pg_catalog.regexp_replace(p_key, '^.*/', '') THEN
    RAISE EXCEPTION 'media_idempotency_conflict' USING ERRCODE = '23505';
  END IF;
  RETURN result;
END $$;
CREATE FUNCTION public.verify_experience_media_asset(p_id uuid, p_owner_id uuid, p_sha256 text, p_size bigint, p_mime text)
RETURNS public.media_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result public.media_assets;
BEGIN
  UPDATE public.media_assets SET uploaded_at = coalesce(uploaded_at, now()), verified_at = coalesce(verified_at, now())
  WHERE id = p_id AND owner_id = p_owner_id AND expected_sha256 = p_sha256 AND expected_size = p_size AND mime = p_mime AND state <> 'tombstoned'
  RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'media_verification_conflict' USING ERRCODE = '40001'; END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.begin_experience_media_asset(uuid,uuid,text,text,text,bigint,text,text,text),
  public.verify_experience_media_asset(uuid,uuid,text,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_experience_media_asset(uuid,uuid,text,text,text,bigint,text,text,text),
  public.verify_experience_media_asset(uuid,uuid,text,bigint,text) TO service_role;

-- The revision is a CAS token, not a business locator or provider migration.
ALTER TABLE public.experiences ADD COLUMN media_revision bigint NOT NULL DEFAULT 0;
CREATE FUNCTION private.bump_experience_media_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN NEW.media_revision := OLD.media_revision + 1; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION private.bump_experience_media_revision() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER experience_media_revision BEFORE UPDATE ON public.experiences FOR EACH ROW EXECUTE FUNCTION private.bump_experience_media_revision();

-- Private trigger-only definer: registry access is never granted to browsers.
-- Existing experience RLS still authorizes the parent mutation; this trigger
-- additionally checks Auth UID for non-backend calls and the asset's DB owner.
CREATE FUNCTION private.sync_experience_media_assets() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  parent_id_value text;
  owner_value uuid;
  doc jsonb;
  ref_digest text;
  asset public.media_assets;
  present boolean;
  caller_role text := current_setting('role', true);
BEGIN
  parent_id_value := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
  owner_value := CASE WHEN TG_OP = 'DELETE' THEN OLD.host_id ELSE NEW.host_id END;
  IF caller_role NOT IN ('service_role', 'postgres', 'none') AND (auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM owner_value AND NOT private.is_admin_reader())) THEN
    RAISE EXCEPTION 'media_parent_owner_required' USING ERRCODE = '42501';
  END IF;
  doc := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE pg_catalog.jsonb_build_object('photos',NEW.photos,'image_url',NEW.image_url,'itinerary',NEW.itinerary,'itinerary_i18n',NEW.itinerary_i18n) END;
  ref_digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(doc::text,'UTF8')),'hex');
  FOR asset IN
    SELECT a.* FROM public.media_assets a
    WHERE a.business_scope = 'experience' AND
      ((a.public_url IS NOT NULL AND pg_catalog.jsonb_path_exists(doc, '$.** ? (@ == $url)', pg_catalog.jsonb_build_object('url',a.public_url)))
        OR EXISTS (SELECT 1 FROM public.media_asset_references r WHERE r.asset_id=a.id AND r.parent_type='experience' AND r.parent_id=parent_id_value))
    ORDER BY a.id FOR UPDATE
  LOOP
    present := TG_OP <> 'DELETE' AND pg_catalog.jsonb_path_exists(doc, '$.** ? (@ == $url)', pg_catalog.jsonb_build_object('url',asset.public_url));
    IF present THEN
      IF asset.owner_id IS DISTINCT FROM owner_value OR (asset.state='pending' AND asset.parent_id IS NOT NULL AND asset.parent_id <> parent_id_value) THEN
        RAISE EXCEPTION 'media_asset_owner_mismatch' USING ERRCODE='42501';
      END IF;
      IF asset.state = 'tombstoned' OR asset.verified_at IS NULL OR asset.uploaded_at IS NULL THEN
        RAISE EXCEPTION 'media_asset_not_verified' USING ERRCODE='23514';
      END IF;
      INSERT INTO public.media_asset_references (asset_id,parent_type,parent_id,reference_digest)
      VALUES (asset.id,'experience',parent_id_value,ref_digest)
      ON CONFLICT (asset_id,parent_type,parent_id) DO UPDATE SET reference_digest=EXCLUDED.reference_digest;
      UPDATE public.media_assets SET state='committed', committed_at=coalesce(committed_at,now()), parent_id=coalesce(parent_id,parent_id_value) WHERE id=asset.id;
    ELSE
      DELETE FROM public.media_asset_references WHERE asset_id=asset.id AND parent_type='experience' AND parent_id=parent_id_value;
      IF NOT EXISTS (SELECT 1 FROM public.media_asset_references WHERE asset_id=asset.id) THEN
        UPDATE public.media_assets SET state='tombstoned',tombstoned_at=coalesce(tombstoned_at,now()) WHERE id=asset.id;
        INSERT INTO public.media_deletion_journal (asset_id,provider,bucket,object_key,expected_sha256,expected_size,reason,reference_digest)
        VALUES (asset.id,asset.provider,asset.bucket,asset.object_key,asset.expected_sha256,asset.expected_size,CASE WHEN TG_OP='DELETE' THEN 'parent_deleted' ELSE 'replaced' END,ref_digest)
        ON CONFLICT (asset_id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.sync_experience_media_assets() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER experience_media_finalize AFTER INSERT OR UPDATE ON public.experiences FOR EACH ROW EXECUTE FUNCTION private.sync_experience_media_assets();
CREATE TRIGGER experience_media_delete_plan BEFORE DELETE ON public.experiences FOR EACH ROW EXECUTE FUNCTION private.sync_experience_media_assets();

CREATE FUNCTION public.plan_media_owner_deletion(p_owner_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE affected integer;
BEGIN
  INSERT INTO public.media_deletion_journal (asset_id,provider,bucket,object_key,expected_sha256,expected_size,reason,reference_digest)
  SELECT id,provider,bucket,object_key,expected_sha256,expected_size,'owner_deleted',
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(id::text,'UTF8')),'hex')
  FROM public.media_assets WHERE owner_id=p_owner_id AND deleted_at IS NULL
  ON CONFLICT (asset_id) DO NOTHING;
  GET DIAGNOSTICS affected=ROW_COUNT;
  RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.plan_media_owner_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_media_owner_deletion(uuid) TO service_role;

-- Future consumers can atomically replace one logical reference with a verified
-- owned asset. Their business-row CAS must use the same DB transaction/RPC.
CREATE FUNCTION public.replace_managed_media_reference(
  p_owner_id uuid,p_parent_type text,p_parent_id text,p_expected_digest text,p_new_digest text,p_old_asset_id uuid,p_new_asset_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.media_assets WHERE id IN (p_old_asset_id,p_new_asset_id) ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.media_asset_references r JOIN public.media_assets a ON a.id=r.asset_id
    WHERE r.asset_id=p_new_asset_id AND r.parent_type=p_parent_type AND r.parent_id=p_parent_id
      AND r.reference_digest=p_new_digest AND a.owner_id=p_owner_id AND a.state='committed') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.media_assets WHERE id=p_new_asset_id AND owner_id=p_owner_id AND state IN ('pending','committed') AND verified_at IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM public.media_assets WHERE id=p_old_asset_id AND owner_id=p_owner_id)
    OR NOT EXISTS (SELECT 1 FROM public.media_asset_references WHERE asset_id=p_old_asset_id AND parent_type=p_parent_type AND parent_id=p_parent_id AND reference_digest=p_expected_digest) THEN
    RAISE EXCEPTION 'media_reference_cas_conflict' USING ERRCODE='40001';
  END IF;
  -- Invoke via a trusted future RPC; browser roles cannot call this helper.
  UPDATE public.media_asset_references SET asset_id=p_new_asset_id,reference_digest=p_new_digest WHERE asset_id=p_old_asset_id AND parent_type=p_parent_type AND parent_id=p_parent_id;
  UPDATE public.media_assets SET state='committed',committed_at=coalesce(committed_at,now()) WHERE id=p_new_asset_id;
  IF NOT EXISTS (SELECT 1 FROM public.media_asset_references WHERE asset_id=p_old_asset_id) THEN
    UPDATE public.media_assets SET state='tombstoned',tombstoned_at=coalesce(tombstoned_at,now()) WHERE id=p_old_asset_id;
    INSERT INTO public.media_deletion_journal (asset_id,provider,bucket,object_key,expected_sha256,expected_size,reason,reference_digest)
    SELECT id,provider,bucket,object_key,expected_sha256,expected_size,'replaced',p_expected_digest FROM public.media_assets WHERE id=p_old_asset_id
    ON CONFLICT (asset_id) DO NOTHING;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.replace_managed_media_reference(uuid,text,text,text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_managed_media_reference(uuid,text,text,text,text,uuid,uuid) TO service_role;
-- UPDATE only for the trusted service RPC; no DELETE grant on reference rows.
GRANT UPDATE ON public.media_asset_references TO service_role;

-- A future operator must explicitly supply approved policy. Row locking and
-- tombstoning prevent business finalization from racing physical deletion.
CREATE FUNCTION public.claim_media_deletion(p_asset_id uuid, p_enabled boolean DEFAULT false, p_minimum_age_ms bigint DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE asset public.media_assets;
BEGIN
  SELECT * INTO asset FROM public.media_assets WHERE id=p_asset_id FOR UPDATE;
  IF asset.id IS NULL OR p_enabled IS DISTINCT FROM true OR p_minimum_age_ms IS NULL OR p_minimum_age_ms <= 0
    OR asset.created_at > now() - (p_minimum_age_ms * interval '1 millisecond')
    OR asset.backup_pinned OR asset.migration_pinned OR asset.state='committed' OR asset.deleted_at IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.media_asset_references WHERE asset_id=p_asset_id) THEN RETURN false; END IF;
  UPDATE public.media_assets SET state='tombstoned',tombstoned_at=coalesce(tombstoned_at,now()) WHERE id=p_asset_id;
  INSERT INTO public.media_deletion_journal (asset_id,provider,bucket,object_key,expected_sha256,expected_size,reason,reference_digest)
  VALUES (asset.id,asset.provider,asset.bucket,asset.object_key,asset.expected_sha256,asset.expected_size,'pending_abandoned',
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(asset.id::text,'UTF8')),'hex'))
  ON CONFLICT (asset_id) DO NOTHING;
  UPDATE public.media_deletion_journal SET state='deleting',attempt_count=attempt_count+1,last_failure=NULL
  WHERE asset_id=p_asset_id AND state<>'complete';
  RETURN FOUND;
END $$;
CREATE FUNCTION public.record_media_deletion_step(p_asset_id uuid,p_event text,p_code text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_event NOT IN ('object-deleted','complete','failed','blocked') THEN RAISE EXCEPTION 'invalid_deletion_step'; END IF;
  IF p_event IN ('failed','blocked') AND (p_code IS NULL OR p_code NOT IN ('reference_exists','pinned','delete_disabled','identity_mismatch','provider_failed','purge_failed')) THEN
    RAISE EXCEPTION 'invalid_deletion_failure';
  END IF;
  IF p_event='complete' AND NOT EXISTS (SELECT 1 FROM public.media_deletion_journal WHERE asset_id=p_asset_id AND object_deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'physical_deletion_unconfirmed';
  END IF;
  UPDATE public.media_deletion_journal SET
    object_deleted_at=CASE WHEN p_event='object-deleted' THEN coalesce(object_deleted_at,now()) ELSE object_deleted_at END,
    completed_at=CASE WHEN p_event='complete' THEN coalesce(completed_at,now()) ELSE completed_at END,
    state=CASE WHEN p_event='object-deleted' THEN 'deleting' WHEN p_event='complete' THEN 'complete' ELSE p_event END,
    last_failure=CASE WHEN p_event IN ('failed','blocked') THEN p_code ELSE NULL END
  WHERE asset_id=p_asset_id AND state<>'complete';
  IF p_event='complete' THEN UPDATE public.media_assets SET deleted_at=coalesce(deleted_at,now()) WHERE id=p_asset_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.claim_media_deletion(uuid,boolean,bigint),public.record_media_deletion_step(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_media_deletion(uuid,boolean,bigint),public.record_media_deletion_step(uuid,text,text) TO service_role;
