-- Lock the retired Supabase experience-media source bucket after the verified
-- R2 locator cutover. This migration changes access metadata only; it never
-- removes or rewrites a Storage object or an experience row.

BEGIN;

DO $preflight$
DECLARE
  bucket_fingerprint text;
  policy_fingerprint text;
  legacy_locator_rows bigint;
BEGIN
  SELECT md5(string_agg(
           bucket.id || '|' || bucket.name || '|' || bucket.public::text || '|' ||
           coalesce(bucket.file_size_limit::text, '') || '|' ||
           coalesce(array_to_string(bucket.allowed_mime_types, ','), ''),
           E'\n' ORDER BY bucket.id
         ))
    INTO bucket_fingerprint
    FROM storage.buckets AS bucket;
  IF bucket_fingerprint IS DISTINCT FROM '384007869cd8ffb76874b05397c554da' THEN
    RAISE EXCEPTION 'experience Storage lockdown refused unexpected bucket state: %', bucket_fingerprint;
  END IF;

  SELECT md5(string_agg(
           policy.schemaname || '|' || policy.tablename || '|' ||
           policy.policyname || '|' || policy.permissive || '|' ||
           policy.cmd || '|' || array_to_string(policy.roles, ',') || '|' ||
           coalesce(policy.qual, '') || '|' || coalesce(policy.with_check, ''),
           E'\n' ORDER BY policy.schemaname, policy.tablename, policy.policyname
         ))
    INTO policy_fingerprint
    FROM pg_policies AS policy
   WHERE policy.schemaname = 'storage' AND policy.tablename = 'objects';
  IF policy_fingerprint IS DISTINCT FROM '27b4679aafb896ae579c14510bd9a9d7' THEN
    RAISE EXCEPTION 'experience Storage lockdown refused unexpected policy state: %', policy_fingerprint;
  END IF;

  SELECT count(*)
    INTO legacy_locator_rows
    FROM public.experiences AS experience
   WHERE coalesce(experience.photos::text, '') LIKE '%/storage/v1/object/public/experiences/%'
      OR coalesce(experience.image_url, '') LIKE '%/storage/v1/object/public/experiences/%'
      OR coalesce(experience.itinerary::text, '') LIKE '%/storage/v1/object/public/experiences/%'
      OR coalesce(experience.itinerary_i18n::text, '') LIKE '%/storage/v1/object/public/experiences/%';
  IF legacy_locator_rows <> 0 THEN
    RAISE EXCEPTION 'experience Storage lockdown refused % live legacy locator rows', legacy_locator_rows;
  END IF;
END
$preflight$;

CREATE TEMPORARY TABLE experience_storage_lockdown_baseline ON COMMIT DROP AS
SELECT count(*)::bigint AS object_count,
       coalesce(sum((metadata->>'size')::bigint), 0)::bigint AS object_bytes
  FROM storage.objects
 WHERE bucket_id = 'experiences';

UPDATE storage.buckets
   SET public = false
 WHERE id = 'experiences';

DROP POLICY "Auth Users Upload" ON storage.objects;
DROP POLICY "Experience object owners can delete" ON storage.objects;
DROP POLICY "Experience object owners can update" ON storage.objects;
DROP POLICY "Public Access" ON storage.objects;

DO $postcondition$
DECLARE
  target_object_count bigint;
  target_object_bytes bigint;
  baseline_object_count bigint;
  baseline_object_bytes bigint;
  policy_fingerprint text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets AS bucket
     WHERE bucket.id = 'experiences' AND bucket.public = false
  ) THEN
    RAISE EXCEPTION 'experience Storage lockdown did not make the bucket private';
  END IF;

  SELECT count(*)::bigint,
         coalesce(sum((metadata->>'size')::bigint), 0)::bigint
    INTO target_object_count, target_object_bytes
    FROM storage.objects
   WHERE bucket_id = 'experiences';
  SELECT object_count, object_bytes
    INTO baseline_object_count, baseline_object_bytes
    FROM experience_storage_lockdown_baseline;
  IF target_object_count IS DISTINCT FROM baseline_object_count
     OR target_object_bytes IS DISTINCT FROM baseline_object_bytes THEN
    RAISE EXCEPTION 'experience Storage lockdown changed object bytes';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_policies AS policy
     WHERE policy.schemaname = 'storage'
       AND policy.tablename = 'objects'
       AND (
         coalesce(policy.qual, '') LIKE '%experiences%'
         OR coalesce(policy.with_check, '') LIKE '%experiences%'
       )
  ) THEN
    RAISE EXCEPTION 'experience Storage policy remains after lockdown';
  END IF;

  SELECT md5(string_agg(
           policy.schemaname || '|' || policy.tablename || '|' ||
           policy.policyname || '|' || policy.permissive || '|' ||
           policy.cmd || '|' || array_to_string(policy.roles, ',') || '|' ||
           coalesce(policy.qual, '') || '|' || coalesce(policy.with_check, ''),
           E'\n' ORDER BY policy.schemaname, policy.tablename, policy.policyname
         ))
    INTO policy_fingerprint
    FROM pg_policies AS policy
   WHERE policy.schemaname = 'storage' AND policy.tablename = 'objects';
  IF policy_fingerprint IS DISTINCT FROM '1519cc7c3877bf1389c0e02c63bc223a' THEN
    RAISE EXCEPTION 'experience Storage lockdown target policy state differs: %', policy_fingerprint;
  END IF;
END
$postcondition$;

COMMIT;
