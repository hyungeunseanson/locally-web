-- Additive hotfix: preserve the applied Community migration and existing function ACL.
-- The checked primary-key singleton makes WHERE/FOUND exact and fail closed.
CREATE OR REPLACE FUNCTION private.set_community_legacy_writer_freeze(p_frozen boolean,p_smoke_asset_id uuid,p_sha256 text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_frozen IS NULL OR NOT EXISTS(SELECT 1 FROM public.media_assets a WHERE id=p_smoke_asset_id AND business_scope='community' AND state='committed' AND uploaded_at IS NOT NULL AND verified_at IS NOT NULL AND expected_sha256=p_sha256 AND EXISTS(SELECT 1 FROM public.media_asset_references r WHERE r.asset_id=a.id AND r.parent_type='community_post')) THEN RAISE EXCEPTION 'community_verified_smoke_required' USING ERRCODE='23514'; END IF;
 UPDATE private.community_media_authority SET legacy_writes_frozen=p_frozen WHERE singleton IS TRUE;
 IF NOT FOUND THEN RAISE EXCEPTION 'community_authority_singleton_required' USING ERRCODE='42501'; END IF;
 RETURN p_frozen;
END $$;
