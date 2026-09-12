-- MANUAL ONLY. Not applied. Requires separate Production approval after review.
-- Target: locally-web (uhinvcydgzqlpnvieyal). Never run against a canary branch.
-- Re-audit the complete INSERT/ALL catalog using README.md before execution.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  fingerprint text;
BEGIN
  SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY policyname), '[]'::jsonb)::text)
    INTO fingerprint
  FROM (
    SELECT policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd IN ('INSERT', 'ALL')
  ) p;

  -- Entire INSERT/ALL catalog, including other buckets: stop on any drift.
  IF fingerprint <> '2310b5aacacb289713be360a7f249a1f' THEN
    RAISE EXCEPTION 'Storage INSERT/ALL policies changed; re-audit before proceeding';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'storage.objects'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Storage RLS is not enabled';
  END IF;
END $$;

DROP POLICY "Authenticated users can upload chat images" ON storage.objects;

-- No bucket, object, SELECT, UPDATE, DELETE, grants or other policy changes.
COMMIT;
