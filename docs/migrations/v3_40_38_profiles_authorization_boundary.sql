-- v3.40.38
-- Restrict public.profiles after every public consumer uses public.public_profiles.

BEGIN;

DO $$
DECLARE
  select_policies text[];
  insert_policies text[];
  update_policies text[];
  delete_policies text[];
  anon_privileges text[];
  authenticated_privileges text[];
  projected_columns text[];
  legacy_state boolean;
  target_state boolean;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Required public.profiles table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'profiles'
      AND relation.relkind = 'r'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS must already be enabled on public.profiles';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'email'
      AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'phone'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'Required public.profiles columns are missing or have unexpected types';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'public_profiles'
      AND relation.relkind = 'v'
      AND pg_get_userbyid(relation.relowner) = 'postgres'
      AND COALESCE(relation.reloptions, ARRAY[]::text[]) @> ARRAY['security_barrier=true']::text[]
      AND NOT (COALESCE(relation.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true']::text[])
  ) THEN
    RAISE EXCEPTION 'Required privacy-safe public.public_profiles view is missing or unsafe';
  END IF;

  SELECT array_agg(column_name ORDER BY ordinal_position)
  INTO projected_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'public_profiles';

  IF projected_columns <> ARRAY[
    'id', 'full_name', 'avatar_url', 'nationality', 'bio', 'created_at', 'mbti',
    'languages', 'job', 'dream_destination', 'favorite_song', 'introduction',
    'host_nationality', 'introduction_en', 'introduction_ja', 'introduction_zh',
    'average_rating', 'total_review_count'
  ]::text[] THEN
    RAISE EXCEPTION 'Unexpected public.public_profiles projection: %', projected_columns;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_profiles'
      AND column_name IN (
        'email', 'phone', 'kakao_id', 'last_active_at', 'bank_name',
        'account_number', 'account_holder', 'motivation', 'dob'
      )
  ) THEN
    RAISE EXCEPTION 'Sensitive profile columns exist in public.public_profiles';
  END IF;

  IF to_regprocedure('public.is_admin_reader()') IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_proc AS procedure
    WHERE procedure.oid = to_regprocedure('public.is_admin_reader()')::oid
      AND procedure.prosecdef
      AND procedure.provolatile = 's'
      AND pg_get_userbyid(procedure.proowner) = 'postgres'
      AND pg_get_functiondef(procedure.oid) LIKE '%FROM public.users%'
  ) THEN
    RAISE EXCEPTION 'is_admin_reader() has unexpected ownership or behavior';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    to_regprocedure('public.is_admin_reader()')::oid,
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated cannot execute is_admin_reader()';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.profiles', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.profiles', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.profiles', 'UPDATE')
    OR NOT has_table_privilege('service_role', 'public.profiles', 'DELETE')
  THEN
    RAISE EXCEPTION 'service_role must retain public.profiles read/write privileges';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.profiles'::regclass
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Unexpected explicit column privileges exist on public.profiles';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    RAISE EXCEPTION 'public.profiles unexpectedly missing from Realtime publication';
  END IF;

  IF to_regclass('public.public_host_applications') IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'public_host_applications'
      AND relation.relkind = 'v'
  ) THEN
    RAISE EXCEPTION 'Required public_host_applications view is missing';
  END IF;

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO select_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT';

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO insert_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'INSERT';

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO update_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'UPDATE';

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO delete_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'DELETE';

  SELECT COALESCE(array_agg(privilege_type ORDER BY privilege_type), ARRAY[]::text[])
  INTO anon_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'anon';

  SELECT COALESCE(array_agg(privilege_type ORDER BY privilege_type), ARRAY[]::text[])
  INTO authenticated_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'authenticated';

  legacy_state :=
    select_policies = ARRAY[
      'Public profiles are viewable by everyone',
      '프로필은 누구나 조회 가능합니다'
    ]::text[]
    AND insert_policies = ARRAY['Users can insert their own profile']::text[]
    AND update_policies = ARRAY[
      'Users can update own profile',
      '사용자는 자신의 프로필만 수정할 수 있습니다'
    ]::text[]
    AND delete_policies = ARRAY[]::text[]
    AND anon_privileges = ARRAY[
      'DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'
    ]::text[]
    AND authenticated_privileges = ARRAY[
      'DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'
    ]::text[];

  target_state :=
    select_policies = ARRAY['profiles_select_admin', 'profiles_select_own']::text[]
    AND insert_policies = ARRAY['Users can insert their own profile']::text[]
    AND update_policies = ARRAY[
      'Users can update own profile',
      '사용자는 자신의 프로필만 수정할 수 있습니다'
    ]::text[]
    AND delete_policies = ARRAY[]::text[]
    AND anon_privileges = ARRAY[]::text[]
    AND authenticated_privileges = ARRAY['INSERT', 'SELECT', 'UPDATE']::text[];

  IF NOT legacy_state AND NOT target_state THEN
    RAISE EXCEPTION
      'Unexpected public.profiles drift. SELECT=%, INSERT=%, UPDATE=%, DELETE=%, anon grants=%, authenticated grants=%',
      select_policies,
      insert_policies,
      update_policies,
      delete_policies,
      anon_privileges,
      authenticated_privileges;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Users can insert their own profile'
      AND cmd = 'INSERT' AND permissive = 'PERMISSIVE'
      AND roles = ARRAY['public']::name[]
      AND regexp_replace(with_check, '\s+', '', 'g') = '(auth.uid()=id)'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Users can update own profile'
      AND cmd = 'UPDATE' AND permissive = 'PERMISSIVE'
      AND roles = ARRAY['public']::name[]
      AND regexp_replace(qual, '\s+', '', 'g') = '(auth.uid()=id)'
      AND with_check IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = '사용자는 자신의 프로필만 수정할 수 있습니다'
      AND cmd = 'UPDATE' AND permissive = 'PERMISSIVE'
      AND roles = ARRAY['public']::name[]
      AND regexp_replace(qual, '\s+', '', 'g') = '(auth.uid()=id)'
      AND with_check IS NULL
  ) THEN
    RAISE EXCEPTION 'Preserved public.profiles write policies have unexpected definitions';
  END IF;

  IF legacy_state AND (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND cmd = 'SELECT' AND permissive = 'PERMISSIVE'
      AND roles = ARRAY['public']::name[]
      AND lower(regexp_replace(qual, '\s+', '', 'g')) IN ('true', '(true)')
  ) <> 2 THEN
    RAISE EXCEPTION 'Known legacy public.profiles SELECT policies have unexpected definitions';
  END IF;

  IF target_state AND (
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'profiles'
        AND policyname = 'profiles_select_own' AND cmd = 'SELECT'
        AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
        AND regexp_replace(qual, '\s+', '', 'g') = '(auth.uid()=id)'
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'profiles'
        AND policyname = 'profiles_select_admin' AND cmd = 'SELECT'
        AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
        AND regexp_replace(qual, '\s+', '', 'g') IN ('is_admin_reader()', '(is_admin_reader())')
    )
  ) THEN
    RAISE EXCEPTION 'Known target public.profiles SELECT policies have unexpected definitions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
      AND policyname = 'users_select_own' AND cmd = 'SELECT'
  ) OR EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
      AND policyname <> 'users_select_own'
  ) THEN
    RAISE EXCEPTION 'Completed #2 users authorization boundary drifted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiries'
      AND policyname = 'inquiries_select_participant' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiries'
      AND policyname = 'inquiries_select_admin' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiry_messages'
      AND policyname = 'inquiry_messages_select_participant' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiry_messages'
      AND policyname = 'inquiry_messages_select_admin' AND cmd = 'SELECT'
  ) OR EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiry_messages' AND cmd = 'INSERT'
  ) OR has_table_privilege('authenticated', 'public.inquiry_messages', 'INSERT') THEN
    RAISE EXCEPTION 'Completed #3/#4 inquiry authorization boundaries drifted';
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "프로필은 누구나 조회 가능합니다" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;

CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY profiles_select_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin_reader());

REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

DO $$
DECLARE
  policy_names text[];
  anon_privileges text[];
  authenticated_privileges text[];
BEGIN
  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO policy_names
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles';

  IF policy_names <> ARRAY[
    'Users can insert their own profile',
    'Users can update own profile',
    'profiles_select_admin',
    'profiles_select_own',
    '사용자는 자신의 프로필만 수정할 수 있습니다'
  ]::text[] THEN
    RAISE EXCEPTION 'Unexpected final public.profiles policies: %', policy_names;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_select_own' AND cmd = 'SELECT'
      AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
      AND regexp_replace(qual, '\s+', '', 'g') = '(auth.uid()=id)'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_select_admin' AND cmd = 'SELECT'
      AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
      AND regexp_replace(qual, '\s+', '', 'g') IN ('is_admin_reader()', '(is_admin_reader())')
  ) THEN
    RAISE EXCEPTION 'Unexpected final public.profiles SELECT definitions';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND cmd = 'SELECT'
      AND (
        roles @> ARRAY['public']::name[]
        OR lower(regexp_replace(qual, '\s+', '', 'g')) IN ('true', '(true)')
      )
  ) THEN
    RAISE EXCEPTION 'A broad public.profiles SELECT policy remains';
  END IF;

  SELECT COALESCE(array_agg(privilege_type ORDER BY privilege_type), ARRAY[]::text[])
  INTO anon_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'anon';

  SELECT COALESCE(array_agg(privilege_type ORDER BY privilege_type), ARRAY[]::text[])
  INTO authenticated_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'authenticated';

  IF anon_privileges <> ARRAY[]::text[] THEN
    RAISE EXCEPTION 'anon retains unexpected public.profiles privileges: %', anon_privileges;
  END IF;

  IF authenticated_privileges <> ARRAY['INSERT', 'SELECT', 'UPDATE']::text[] THEN
    RAISE EXCEPTION 'authenticated has unexpected public.profiles privileges: %', authenticated_privileges;
  END IF;

  IF NOT has_table_privilege('service_role', 'public.profiles', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.profiles', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.profiles', 'UPDATE')
    OR NOT has_table_privilege('service_role', 'public.profiles', 'DELETE')
  THEN
    RAISE EXCEPTION 'service_role public.profiles privileges changed unexpectedly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
      AND policyname = 'users_select_own' AND cmd = 'SELECT'
  ) OR EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
      AND policyname <> 'users_select_own'
  ) THEN
    RAISE EXCEPTION 'Completed #2 users authorization boundary changed during migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiries'
      AND policyname = 'inquiries_select_participant' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiries'
      AND policyname = 'inquiries_select_admin' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiry_messages'
      AND policyname = 'inquiry_messages_select_participant' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiry_messages'
      AND policyname = 'inquiry_messages_select_admin' AND cmd = 'SELECT'
  ) OR EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiry_messages' AND cmd = 'INSERT'
  ) OR has_table_privilege('authenticated', 'public.inquiry_messages', 'INSERT') THEN
    RAISE EXCEPTION 'Completed #3/#4 inquiry authorization boundaries changed during migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    RAISE EXCEPTION 'public.profiles Realtime publication changed unexpectedly';
  END IF;
END;
$$;

COMMIT;
