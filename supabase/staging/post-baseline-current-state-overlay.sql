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
  policy_record record;
BEGIN
  SELECT permissive, roles, cmd, qual, with_check
    INTO policy_record
    FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname = 'Authenticated users can upload chat images';

  IF FOUND AND (
    policy_record.permissive <> 'PERMISSIVE'
    OR policy_record.roles IS DISTINCT FROM ARRAY['public']::name[]
    OR policy_record.cmd <> 'INSERT'
    OR policy_record.qual IS NOT NULL
    OR policy_record.with_check IS DISTINCT FROM
      '((bucket_id = ''chat-images''::text) AND (auth.role() = ''authenticated''::text))'
  ) THEN
    RAISE EXCEPTION 'The chat-image INSERT policy differs from the reviewed baseline definition';
  END IF;
END
$policy_precondition$;

DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;

DO $policy_postcondition$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename = 'objects'
       AND policyname = 'Authenticated users can upload chat images'
  ) THEN
    RAISE EXCEPTION 'The chat-image INSERT policy is still present';
  END IF;
END
$policy_postcondition$;

COMMIT;

SELECT 'LOCALLY_STAGING_CURRENT_STATE_OVERLAY_PASS' AS result;
