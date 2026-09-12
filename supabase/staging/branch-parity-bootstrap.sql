-- Staging-only parity repair for disposable branch ekfwkplibbqvbgqjumml.
-- This file must never be moved under supabase/migrations or applied to Production.
-- The caller must set the session GUC before execution:
--   SET locally.canary_target_ref = 'ekfwkplibbqvbgqjumml';

BEGIN;

DO $target_guard$
DECLARE
  target_ref text := current_setting('locally.canary_target_ref', true);
BEGIN
  IF target_ref IS NULL OR target_ref <> 'ekfwkplibbqvbgqjumml' THEN
    RAISE EXCEPTION 'Refusing branch parity bootstrap for unexpected target ref: %', target_ref;
  END IF;
  IF target_ref = 'uhinvcydgzqlpnvieyal' THEN
    RAISE EXCEPTION 'Refusing branch parity bootstrap against Production';
  END IF;
END
$target_guard$;

DO $preflight$
DECLARE
  actual_count bigint;
  actual_hash text;
  trigger_definition text;
BEGIN
  SELECT count(*), min(md5(pg_get_functiondef(procedure_def.oid)))
    INTO actual_count, actual_hash
    FROM pg_proc AS procedure_def
    JOIN pg_namespace AS namespace ON namespace.oid = procedure_def.pronamespace
   WHERE namespace.nspname = 'public'
     AND procedure_def.proname = 'handle_new_user'
     AND pg_get_function_identity_arguments(procedure_def.oid) = '';
  IF actual_count <> 1 OR actual_hash <> '8ad838c47b834a9cfeaf0af4500f4774' THEN
    RAISE EXCEPTION 'handle_new_user definition differs from verified Production';
  END IF;

  SELECT pg_get_triggerdef(trigger_def.oid)
    INTO trigger_definition
    FROM pg_trigger AS trigger_def
   WHERE trigger_def.tgrelid = 'auth.users'::regclass
     AND trigger_def.tgname = 'on_auth_user_created'
     AND NOT trigger_def.tgisinternal;
  IF trigger_definition IS NOT NULL
     AND trigger_definition <> 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()' THEN
    RAISE EXCEPTION 'Existing on_auth_user_created trigger differs from verified Production';
  END IF;

  SELECT count(*),
         md5(string_agg(
           concat_ws('|', id, name, public::text, coalesce(file_size_limit::text, ''),
                     coalesce(array_to_string(allowed_mime_types, ','), '')),
           E'\n' ORDER BY id
         ))
    INTO actual_count, actual_hash
    FROM storage.buckets;
  IF actual_count NOT IN (0, 6)
     OR (actual_count = 6 AND actual_hash <> 'c3ff5767c8e4934ae05b3d96550441c8') THEN
    RAISE EXCEPTION 'Storage bucket metadata has an unexpected pre-bootstrap state: count %, hash %', actual_count, actual_hash;
  END IF;

  SELECT count(*),
         md5(string_agg(
           concat_ws('|', schemaname, tablename, policyname, permissive, cmd,
                     array_to_string(roles, ','), coalesce(qual, ''), coalesce(with_check, '')),
           E'\n' ORDER BY schemaname, tablename, policyname, cmd
         ))
    INTO actual_count, actual_hash
    FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects';
  IF actual_count NOT IN (0, 16)
     OR (actual_count = 16 AND actual_hash <> 'd6b381fd629405acfdd615593031de5c') THEN
    RAISE EXCEPTION 'Storage policy catalog has an unexpected pre-bootstrap state: count %, hash %', actual_count, actual_hash;
  END IF;

  SELECT md5(string_agg(
           concat_ws('|', namespace.nspname, class.relname, class.relkind::text,
                     coalesce(grantee_role.rolname, 'PUBLIC'), acl_entry.privilege_type,
                     acl_entry.is_grantable::text),
           E'\n' ORDER BY namespace.nspname, class.relname, class.relkind,
                         coalesce(grantee_role.rolname, 'PUBLIC'), acl_entry.privilege_type,
                         acl_entry.is_grantable
         ))
    INTO actual_hash
    FROM pg_class AS class
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(class.relacl, acldefault('r', class.relowner))) AS acl_entry
    LEFT JOIN pg_roles AS grantee_role ON grantee_role.oid = acl_entry.grantee
   WHERE namespace.nspname = 'public'
     AND class.relkind IN ('r', 'p', 'v', 'm')
     AND acl_entry.grantee <> class.relowner;
  IF actual_hash NOT IN ('187e09746bfa0365859b736dad40fd9f', '42e662640922b11d00ed04eebdb4fc13') THEN
    RAISE EXCEPTION 'Public table/view grants have an unexpected pre-bootstrap hash: %', actual_hash;
  END IF;
END
$preflight$;

DO $create_auth_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger AS trigger_def
     WHERE trigger_def.tgrelid = 'auth.users'::regclass
       AND trigger_def.tgname = 'on_auth_user_created'
       AND NOT trigger_def.tgisinternal
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END
$create_auth_trigger$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('admin_files', 'admin_files', true, 10485760, null),
  ('avatars', 'avatars', true, null, null),
  ('chat-images', 'chat-images', true, null, null),
  ('experiences', 'experiences', true, null, null),
  ('images', 'images', true, null, null),
  ('verification-docs', 'verification-docs', false, null, null)
ON CONFLICT (id) DO NOTHING;

DO $create_storage_policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  ) THEN
    EXECUTE $policy_1$CREATE POLICY "Anyone can update their own avatar" ON storage.objects AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((bucket_id = 'avatars'::text));$policy_1$;
    EXECUTE $policy_2$CREATE POLICY "Anyone can upload an avatar" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((bucket_id = 'avatars'::text));$policy_2$;
    EXECUTE $policy_3$CREATE POLICY "Auth Users Upload" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = 'experiences'::text) AND (auth.role() = 'authenticated'::text)));$policy_3$;
    EXECUTE $policy_4$CREATE POLICY "Authenticated Delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated" USING ((bucket_id = 'images'::text));$policy_4$;
    EXECUTE $policy_5$CREATE POLICY "Authenticated Update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((bucket_id = 'images'::text));$policy_5$;
    EXECUTE $policy_6$CREATE POLICY "Authenticated Upload" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((bucket_id = 'images'::text));$policy_6$;
    EXECUTE $policy_7$CREATE POLICY "Authenticated users can upload chat images" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((bucket_id = 'chat-images'::text) AND (auth.role() = 'authenticated'::text)));$policy_7$;
    EXECUTE $policy_8$CREATE POLICY "Avatar images are publicly accessible" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = 'avatars'::text));$policy_8$;
    EXECUTE $policy_9$CREATE POLICY "Only admins can upload files" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'admin_files'::text) AND ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_whitelist
  WHERE (admin_whitelist.email = (auth.jwt() ->> 'email'::text)))))));$policy_9$;
    EXECUTE $policy_10$CREATE POLICY "Owner Delete" ON storage.objects AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = owner));$policy_10$;
    EXECUTE $policy_11$CREATE POLICY "Owner Update" ON storage.objects AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = owner));$policy_11$;
    EXECUTE $policy_12$CREATE POLICY "Public Access" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = 'experiences'::text));$policy_12$;
    EXECUTE $policy_13$CREATE POLICY "Verification docs owners can delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'verification-docs'::text) AND (name ~~ like_escape((('id_card/'::text || (auth.uid())::text) || '\_%'::text), '\'::text))));$policy_13$;
    EXECUTE $policy_14$CREATE POLICY "Verification docs owners can read" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'verification-docs'::text) AND (name ~~ like_escape((('id_card/'::text || (auth.uid())::text) || '\_%'::text), '\'::text))));$policy_14$;
    EXECUTE $policy_15$CREATE POLICY "Verification docs owners can update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'verification-docs'::text) AND (name ~~ like_escape((('id_card/'::text || (auth.uid())::text) || '\_%'::text), '\'::text)))) WITH CHECK (((bucket_id = 'verification-docs'::text) AND (name ~~ like_escape((('id_card/'::text || (auth.uid())::text) || '\_%'::text), '\'::text))));$policy_15$;
    EXECUTE $policy_16$CREATE POLICY "Verification docs owners can upload" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'verification-docs'::text) AND (name ~~ like_escape((('id_card/'::text || (auth.uid())::text) || '\_%'::text), '\'::text))));$policy_16$;
  END IF;
END
$create_storage_policies$;

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.admin_job_runs FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.admin_manual_payouts FROM anon, authenticated, service_role;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.admin_support_unread_alert_batches FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.profile_private_demographics FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.profiles FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.public_profiles FROM anon, authenticated, service_role;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.users FROM anon, authenticated;

DO $postcondition$
DECLARE
  actual_count bigint;
  actual_hash text;
  trigger_definition text;
BEGIN
  SELECT pg_get_triggerdef(trigger_def.oid)
    INTO trigger_definition
    FROM pg_trigger AS trigger_def
   WHERE trigger_def.tgrelid = 'auth.users'::regclass
     AND trigger_def.tgname = 'on_auth_user_created'
     AND NOT trigger_def.tgisinternal;
  IF trigger_definition <> 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()' THEN
    RAISE EXCEPTION 'Auth trigger parity postcondition failed';
  END IF;

  SELECT count(*),
         md5(string_agg(
           concat_ws('|', id, name, public::text, coalesce(file_size_limit::text, ''),
                     coalesce(array_to_string(allowed_mime_types, ','), '')),
           E'\n' ORDER BY id
         ))
    INTO actual_count, actual_hash
    FROM storage.buckets;
  IF actual_count <> 6 OR actual_hash <> 'c3ff5767c8e4934ae05b3d96550441c8' THEN
    RAISE EXCEPTION 'Storage bucket parity postcondition failed: count %, hash %', actual_count, actual_hash;
  END IF;

  SELECT count(*),
         md5(string_agg(
           concat_ws('|', schemaname, tablename, policyname, permissive, cmd,
                     array_to_string(roles, ','), coalesce(qual, ''), coalesce(with_check, '')),
           E'\n' ORDER BY schemaname, tablename, policyname, cmd
         ))
    INTO actual_count, actual_hash
    FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects';
  IF actual_count <> 16 OR actual_hash <> 'd6b381fd629405acfdd615593031de5c' THEN
    RAISE EXCEPTION 'Storage policy parity postcondition failed: count %, hash %', actual_count, actual_hash;
  END IF;

  SELECT count(*),
         md5(string_agg(
           concat_ws('|', namespace.nspname, class.relname, class.relkind::text,
                     coalesce(grantee_role.rolname, 'PUBLIC'), acl_entry.privilege_type,
                     acl_entry.is_grantable::text),
           E'\n' ORDER BY namespace.nspname, class.relname, class.relkind,
                         coalesce(grantee_role.rolname, 'PUBLIC'), acl_entry.privilege_type,
                         acl_entry.is_grantable
         ))
    INTO actual_count, actual_hash
    FROM pg_class AS class
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(class.relacl, acldefault('r', class.relowner))) AS acl_entry
    LEFT JOIN pg_roles AS grantee_role ON grantee_role.oid = acl_entry.grantee
   WHERE namespace.nspname = 'public'
     AND class.relkind IN ('r', 'p', 'v', 'm')
     AND acl_entry.grantee <> class.relowner;
  IF actual_count <> 791 OR actual_hash <> '42e662640922b11d00ed04eebdb4fc13' THEN
    RAISE EXCEPTION 'Table/view grant parity postcondition failed: count %, hash %', actual_count, actual_hash;
  END IF;
END
$postcondition$;

COMMIT;

SELECT 'LOCALLY_STAGING_BRANCH_PARITY_BOOTSTRAP_PASS' AS result;
