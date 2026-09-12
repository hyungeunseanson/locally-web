-- STAGING ONLY. Reproduces the current Production Storage contract after the
-- immutable baseline and every ordered post-baseline migration have run.
-- The caller must set the exact non-Production target ref in the same session:
--   SET locally.staging_target_ref = '<staging-project-ref>';
-- Never place this file under supabase/migrations and never run it on Production.

BEGIN;

DO $target_guard$
DECLARE
  target_ref text := current_setting('locally.staging_target_ref', true);
BEGIN
  IF target_ref IS NULL OR target_ref !~ '^[a-z]{20}$' THEN
    RAISE EXCEPTION 'A valid staging target ref is required before applying the current-state overlay';
  END IF;
  IF target_ref = 'uhinvcydgzqlpnvieyal' THEN
    RAISE EXCEPTION 'Refusing to apply the staging overlay to Production';
  END IF;
END
$target_guard$;

DO $policy_precondition$
DECLARE
  bucket_fingerprint text;
  policy_count bigint;
  policy_fingerprint text;
BEGIN
  SELECT md5(string_agg(
           bucket_def.id || '|' || bucket_def.name || '|' || bucket_def.public::text || '|' ||
           coalesce(bucket_def.file_size_limit::text, '') || '|' ||
           coalesce(array_to_string(bucket_def.allowed_mime_types, ','), ''),
           E'\n' ORDER BY bucket_def.id
         ))
    INTO bucket_fingerprint
    FROM storage.buckets AS bucket_def;
  IF bucket_fingerprint IS DISTINCT FROM 'c3ff5767c8e4934ae05b3d96550441c8' THEN
    RAISE EXCEPTION 'Storage buckets differ from the immutable baseline: %', bucket_fingerprint;
  END IF;

  SELECT count(*), md5(string_agg(
           policy_def.schemaname || '|' || policy_def.tablename || '|' ||
           policy_def.policyname || '|' || policy_def.permissive || '|' ||
           policy_def.cmd || '|' || array_to_string(policy_def.roles, ',') || '|' ||
           coalesce(policy_def.qual, '') || '|' || coalesce(policy_def.with_check, ''),
           E'\n' ORDER BY policy_def.schemaname, policy_def.tablename, policy_def.policyname
         ))
    INTO policy_count, policy_fingerprint
    FROM pg_policies AS policy_def
   WHERE policy_def.schemaname = 'storage' AND policy_def.tablename = 'objects';
  IF policy_count <> 16
     OR policy_fingerprint IS DISTINCT FROM 'd6b381fd629405acfdd615593031de5c' THEN
    RAISE EXCEPTION 'Storage policies differ from the immutable 16-policy baseline: count %, fingerprint %',
      policy_count, policy_fingerprint;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies AS policy_def
     WHERE policy_def.schemaname = 'storage'
       AND policy_def.tablename = 'objects'
       AND policy_def.policyname = 'Authenticated users can upload chat images'
       AND policy_def.permissive = 'PERMISSIVE'
       AND policy_def.roles = ARRAY['public']::name[]
       AND policy_def.cmd = 'INSERT'
       AND policy_def.qual IS NULL
       AND policy_def.with_check =
         '((bucket_id = ''chat-images''::text) AND (auth.role() = ''authenticated''::text))'
  ) THEN
    RAISE EXCEPTION 'The exact baseline chat-image INSERT policy is required';
  END IF;
END
$policy_precondition$;

DROP POLICY "Authenticated users can upload chat images" ON storage.objects;

DO $policy_postcondition$
DECLARE
  bucket_fingerprint text;
  policy_count bigint;
  policy_fingerprint text;
BEGIN
  SELECT md5(string_agg(
           bucket_def.id || '|' || bucket_def.name || '|' || bucket_def.public::text || '|' ||
           coalesce(bucket_def.file_size_limit::text, '') || '|' ||
           coalesce(array_to_string(bucket_def.allowed_mime_types, ','), ''),
           E'\n' ORDER BY bucket_def.id
         ))
    INTO bucket_fingerprint
    FROM storage.buckets AS bucket_def;
  IF bucket_fingerprint IS DISTINCT FROM 'c3ff5767c8e4934ae05b3d96550441c8' THEN
    RAISE EXCEPTION 'Storage bucket fingerprint changed during overlay: %', bucket_fingerprint;
  END IF;

  SELECT count(*), md5(string_agg(
           policy_def.schemaname || '|' || policy_def.tablename || '|' ||
           policy_def.policyname || '|' || policy_def.permissive || '|' ||
           policy_def.cmd || '|' || array_to_string(policy_def.roles, ',') || '|' ||
           coalesce(policy_def.qual, '') || '|' || coalesce(policy_def.with_check, ''),
           E'\n' ORDER BY policy_def.schemaname, policy_def.tablename, policy_def.policyname
         ))
    INTO policy_count, policy_fingerprint
    FROM pg_policies AS policy_def
   WHERE policy_def.schemaname = 'storage' AND policy_def.tablename = 'objects';
  IF policy_count <> 15
     OR policy_fingerprint IS DISTINCT FROM '38c973a52a0bebe8fa78b3f53089e427' THEN
    RAISE EXCEPTION 'Storage policies do not match current Production after overlay: count %, fingerprint %',
      policy_count, policy_fingerprint;
  END IF;
END
$policy_postcondition$;

COMMIT;

SELECT 'LOCALLY_STAGING_CURRENT_STATE_OVERLAY_PASS' AS result;
