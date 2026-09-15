-- P0 hardening for private operational media, user-owned public uploads,
-- callable SECURITY DEFINER routines, and public projection grants.
-- This migration changes access metadata only. It never moves or deletes objects.

BEGIN;

DO $preflight$
DECLARE
  bucket_fingerprint text;
  policy_fingerprint text;
BEGIN
  SELECT md5(string_agg(
           bucket.id || '|' || bucket.name || '|' || bucket.public::text || '|' ||
           coalesce(bucket.file_size_limit::text, '') || '|' ||
           coalesce(array_to_string(bucket.allowed_mime_types, ','), ''),
           E'\n' ORDER BY bucket.id
         ))
    INTO bucket_fingerprint
    FROM storage.buckets AS bucket;

  IF bucket_fingerprint IS DISTINCT FROM 'c3ff5767c8e4934ae05b3d96550441c8' THEN
    RAISE EXCEPTION 'P0 hardening refused unexpected Storage bucket state: %', bucket_fingerprint;
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

  -- Fresh projects reach this migration directly from the immutable baseline,
  -- while Production already has the reviewed one-policy chat upload overlay.
  -- Accept only those two exact predecessors and converge both to one state.
  IF policy_fingerprint IS DISTINCT FROM '38c973a52a0bebe8fa78b3f53089e427'
     AND policy_fingerprint IS DISTINCT FROM 'd6b381fd629405acfdd615593031de5c' THEN
    RAISE EXCEPTION 'P0 hardening refused unexpected Storage policy state: %', policy_fingerprint;
  END IF;

  IF to_regprocedure('public.check_rate_limit(text,integer)') IS NULL
     OR to_regprocedure('public.handle_new_user()') IS NULL
     OR to_regprocedure('public.is_admin_reader()') IS NULL
     OR to_regprocedure('public.mark_room_messages_read(uuid,uuid)') IS NULL
     OR to_regclass('public.public_profiles') IS NULL
     OR to_regclass('public.public_host_applications') IS NULL THEN
    RAISE EXCEPTION 'P0 hardening required routines or public projections are missing';
  END IF;
END
$preflight$;

CREATE TEMPORARY TABLE p0_storage_object_baseline ON COMMIT DROP AS
SELECT bucket_id, count(*)::bigint AS object_count,
       coalesce(sum((metadata->>'size')::bigint), 0)::bigint AS object_bytes
  FROM storage.objects
 GROUP BY bucket_id;

UPDATE storage.buckets
   SET public = false
 WHERE id IN ('chat-images', 'admin_files');

DROP POLICY "Anyone can update their own avatar" ON storage.objects;
DROP POLICY "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;
DROP POLICY "Authenticated Delete" ON storage.objects;
DROP POLICY "Authenticated Update" ON storage.objects;
DROP POLICY "Authenticated Upload" ON storage.objects;
DROP POLICY "Owner Delete" ON storage.objects;
DROP POLICY "Owner Update" ON storage.objects;

CREATE POLICY "Avatar owners can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND owner_id = auth.uid()::text
    AND split_part(name, '/', 1) = auth.uid()::text
    AND split_part(name, '/', 2) <> ''
  );

CREATE POLICY "Avatar owners can update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND owner_id = auth.uid()::text
    AND split_part(name, '/', 1) = auth.uid()::text
    AND split_part(name, '/', 2) <> ''
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND owner_id = auth.uid()::text
    AND split_part(name, '/', 1) = auth.uid()::text
    AND split_part(name, '/', 2) <> ''
  );

CREATE POLICY "Avatar owners can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND owner_id = auth.uid()::text
    AND split_part(name, '/', 1) = auth.uid()::text
    AND split_part(name, '/', 2) <> ''
  );

CREATE POLICY "Image owners can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'images'
    AND owner_id = auth.uid()::text
    AND (
      (
        split_part(name, '/', 1) = 'profile'
        AND split_part(name, '/', 2) LIKE auth.uid()::text || '\_%' ESCAPE '\'
      )
      OR (
        split_part(name, '/', 1) = 'community'
        AND split_part(name, '/', 2) = auth.uid()::text
        AND split_part(name, '/', 3) <> ''
      )
    )
  );

CREATE POLICY "Image owners can update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'images' AND owner_id = auth.uid()::text)
  WITH CHECK (
    bucket_id = 'images'
    AND owner_id = auth.uid()::text
    AND (
      (
        split_part(name, '/', 1) = 'profile'
        AND split_part(name, '/', 2) LIKE auth.uid()::text || '\_%' ESCAPE '\'
      )
      OR (
        split_part(name, '/', 1) = 'community'
        AND split_part(name, '/', 2) = auth.uid()::text
        AND split_part(name, '/', 3) <> ''
      )
    )
  );

CREATE POLICY "Image owners can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND owner_id = auth.uid()::text);

-- UPDATE/DELETE statements need row visibility as well as their command policy.
-- The public bucket still serves reads publicly; this policy only exposes an
-- authenticated owner's own rows to Storage mutation queries.
CREATE POLICY "Image owners can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'images' AND owner_id = auth.uid()::text);

CREATE POLICY "Experience object owners can update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'experiences' AND owner_id = auth.uid()::text)
  WITH CHECK (bucket_id = 'experiences' AND owner_id = auth.uid()::text);

CREATE POLICY "Experience object owners can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'experiences' AND owner_id = auth.uid()::text);

CREATE POLICY "Admins can read files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'admin_files' AND public.is_admin_reader());

CREATE POLICY "Admins can update files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'admin_files' AND public.is_admin_reader())
  WITH CHECK (bucket_id = 'admin_files' AND public.is_admin_reader());

CREATE POLICY "Admins can delete files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'admin_files' AND public.is_admin_reader());

ALTER FUNCTION public.mark_room_messages_read(uuid, uuid)
  SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_reader() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_room_messages_read(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_reader() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_room_messages_read(uuid, uuid) TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.public_profiles
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.public_host_applications
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.public_host_applications TO anon, authenticated, service_role;

DO $postcondition$
DECLARE
  changed_buckets text[];
  changed_objects text[];
  unexpected_policy text[];
BEGIN
  SELECT array_agg(bucket.id ORDER BY bucket.id)
    INTO changed_buckets
    FROM storage.buckets AS bucket
   WHERE (bucket.id IN ('admin_files', 'chat-images') AND bucket.public)
      OR (bucket.id IN ('avatars', 'experiences', 'images') AND NOT bucket.public)
      OR (bucket.id = 'verification-docs' AND bucket.public);
  IF changed_buckets IS NOT NULL THEN
    RAISE EXCEPTION 'P0 hardening bucket visibility mismatch: %', changed_buckets;
  END IF;

  SELECT array_agg(coalesce(before.bucket_id, after.bucket_id) ORDER BY coalesce(before.bucket_id, after.bucket_id))
    INTO changed_objects
    FROM p0_storage_object_baseline AS before
    FULL JOIN (
      SELECT bucket_id, count(*)::bigint AS object_count,
             coalesce(sum((metadata->>'size')::bigint), 0)::bigint AS object_bytes
        FROM storage.objects GROUP BY bucket_id
    ) AS after USING (bucket_id)
   WHERE before.object_count IS DISTINCT FROM after.object_count
      OR before.object_bytes IS DISTINCT FROM after.object_bytes;
  IF changed_objects IS NOT NULL THEN
    RAISE EXCEPTION 'P0 hardening changed Storage objects: %', changed_objects;
  END IF;

  SELECT array_agg(policy.policyname ORDER BY policy.policyname)
    INTO unexpected_policy
    FROM pg_policies AS policy
   WHERE policy.schemaname = 'storage'
     AND policy.tablename = 'objects'
     AND policy.policyname NOT IN (
       'Admins can delete files', 'Admins can read files', 'Admins can update files',
       'Avatar images are publicly accessible', 'Avatar owners can delete',
       'Avatar owners can update', 'Avatar owners can upload', 'Auth Users Upload',
       'Experience object owners can delete', 'Experience object owners can update',
       'Image owners can delete', 'Image owners can read', 'Image owners can update', 'Image owners can upload',
       'Only admins can upload files', 'Public Access',
       'Verification docs owners can delete', 'Verification docs owners can read',
       'Verification docs owners can update', 'Verification docs owners can upload'
     );
  IF unexpected_policy IS NOT NULL OR (
    SELECT count(*) FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
  ) <> 20 THEN
    RAISE EXCEPTION 'P0 hardening Storage policy inventory mismatch: %', unexpected_policy;
  END IF;

  IF has_function_privilege('anon', 'public.mark_room_messages_read(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.mark_room_messages_read(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.check_rate_limit(text,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.check_rate_limit(text,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.is_admin_reader()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_admin_reader()', 'EXECUTE') THEN
    RAISE EXCEPTION 'P0 hardening function execute contract mismatch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name IN ('public_profiles', 'public_host_applications')
       AND grantee IN ('anon', 'authenticated', 'service_role')
       AND privilege_type <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'P0 hardening public projection grants are not SELECT-only';
  END IF;
END
$postcondition$;

COMMIT;
