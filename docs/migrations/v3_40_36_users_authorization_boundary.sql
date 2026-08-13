-- v3.40.36
-- Restrict public.users to authenticated self-read and service-role writes.

BEGIN;

DO $$
DECLARE
  select_policies text[];
  insert_policies text[];
  update_policies text[];
  delete_policies text[];
  anon_privileges text[];
  authenticated_privileges text[];
  legacy_state boolean;
  target_state boolean;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Required public.users table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'users'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS must already be enabled on public.users';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'email'
      AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'Required public.users columns are missing or have unexpected types';
  END IF;

  IF to_regprocedure('public.is_admin_reader()') IS NULL THEN
    RAISE EXCEPTION 'Required admin authorization helper is missing';
  END IF;

  IF NOT EXISTS (
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

  IF NOT has_table_privilege('service_role', 'public.users', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.users', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.users', 'UPDATE')
    OR NOT has_table_privilege('service_role', 'public.users', 'DELETE')
  THEN
    RAISE EXCEPTION 'service_role must retain public.users read/write privileges';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.users'::regclass
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Unexpected explicit column privileges exist on public.users';
  END IF;

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO select_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'users'
    AND cmd = 'SELECT';

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO insert_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'users'
    AND cmd = 'INSERT';

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO update_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'users'
    AND cmd = 'UPDATE';

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO delete_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'users'
    AND cmd = 'DELETE';

  SELECT COALESCE(array_agg(privilege_type ORDER BY privilege_type), ARRAY[]::text[])
  INTO anon_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND grantee = 'anon';

  SELECT COALESCE(array_agg(privilege_type ORDER BY privilege_type), ARRAY[]::text[])
  INTO authenticated_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND grantee = 'authenticated';

  legacy_state :=
    select_policies = ARRAY['Public profiles are viewable by everyone']::text[]
    AND insert_policies = ARRAY['Users can insert their own profile']::text[]
    AND update_policies = ARRAY[
      'Admins can update user roles',
      'Users can update own profile'
    ]::text[]
    AND delete_policies = ARRAY[]::text[]
    AND anon_privileges = ARRAY[
      'DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'
    ]::text[]
    AND authenticated_privileges = ARRAY[
      'DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'
    ]::text[];

  target_state :=
    select_policies = ARRAY['users_select_own']::text[]
    AND insert_policies = ARRAY[]::text[]
    AND update_policies = ARRAY[]::text[]
    AND delete_policies = ARRAY[]::text[]
    AND anon_privileges = ARRAY[]::text[]
    AND authenticated_privileges = ARRAY['SELECT']::text[];

  IF NOT legacy_state AND NOT target_state THEN
    RAISE EXCEPTION
      'Unexpected public.users drift. SELECT=%, INSERT=%, UPDATE=%, DELETE=%, anon grants=%, authenticated grants=%',
      select_policies,
      insert_policies,
      update_policies,
      delete_policies,
      anon_privileges,
      authenticated_privileges;
  END IF;

  IF legacy_state AND (
    NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'users'
        AND policyname = 'Public profiles are viewable by everyone'
        AND cmd = 'SELECT'
        AND permissive = 'PERMISSIVE'
        AND roles = ARRAY['public']::name[]
        AND lower(regexp_replace(qual, '\s+', '', 'g')) IN ('true', '(true)')
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'users'
        AND policyname = 'Users can insert their own profile'
        AND cmd = 'INSERT'
        AND permissive = 'PERMISSIVE'
        AND roles = ARRAY['public']::name[]
        AND regexp_replace(with_check, '\s+', '', 'g') = '(auth.uid()=id)'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'users'
        AND policyname = 'Users can update own profile'
        AND cmd = 'UPDATE'
        AND permissive = 'PERMISSIVE'
        AND roles = ARRAY['public']::name[]
        AND regexp_replace(qual, '\s+', '', 'g') = '(auth.uid()=id)'
        AND with_check IS NULL
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'users'
        AND policyname = 'Admins can update user roles'
        AND cmd = 'UPDATE'
        AND permissive = 'PERMISSIVE'
        AND roles = ARRAY['public']::name[]
        AND qual LIKE '%users_1.role%'
        AND qual LIKE '%users_1.id = auth.uid()%'
        AND qual LIKE '%= ''admin''::text%'
        AND with_check IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Known legacy public.users policies have unexpected definitions';
  END IF;

  IF target_state AND NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_select_own'
      AND cmd = 'SELECT'
      AND permissive = 'PERMISSIVE'
      AND roles = ARRAY['authenticated']::name[]
      AND regexp_replace(qual, '\s+', '', 'g') = '(auth.uid()=id)'
      AND with_check IS NULL
  ) THEN
    RAISE EXCEPTION 'Known target public.users policy has an unexpected definition';
  END IF;
END
$$;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS users_select_own ON public.users;

REVOKE ALL PRIVILEGES ON TABLE public.users FROM anon, authenticated;
GRANT SELECT ON TABLE public.users TO authenticated;

CREATE POLICY users_select_own
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DO $$
DECLARE
  policies jsonb;
  anon_privileges text[];
  authenticated_privileges text[];
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', policyname,
        'command', cmd,
        'roles', roles,
        'permissive', permissive,
        'using', qual,
        'check', with_check
      )
      ORDER BY cmd, policyname
    ),
    '[]'::jsonb
  )
  INTO policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'users';

  IF policies <> jsonb_build_array(
    jsonb_build_object(
      'name', 'users_select_own',
      'command', 'SELECT',
      'roles', ARRAY['authenticated']::name[],
      'permissive', 'PERMISSIVE',
      'using', '(auth.uid() = id)',
      'check', NULL
    )
  ) THEN
    RAISE EXCEPTION 'Unexpected final public.users policies: %', policies;
  END IF;

  SELECT COALESCE(array_agg(privilege_type ORDER BY privilege_type), ARRAY[]::text[])
  INTO anon_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND grantee = 'anon';

  SELECT COALESCE(array_agg(privilege_type ORDER BY privilege_type), ARRAY[]::text[])
  INTO authenticated_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND grantee = 'authenticated';

  IF anon_privileges <> ARRAY[]::text[] THEN
    RAISE EXCEPTION 'anon retains unexpected public.users privileges: %', anon_privileges;
  END IF;

  IF authenticated_privileges <> ARRAY['SELECT']::text[] THEN
    RAISE EXCEPTION 'authenticated has unexpected public.users privileges: %', authenticated_privileges;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.users'::regclass
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Explicit column privileges remain on public.users';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.users', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.users', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.users', 'UPDATE')
    OR NOT has_table_privilege('service_role', 'public.users', 'DELETE')
  THEN
    RAISE EXCEPTION 'service_role public.users privileges changed unexpectedly';
  END IF;

  IF to_regprocedure('public.is_admin_reader()') IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM pg_proc AS procedure
      WHERE procedure.oid = to_regprocedure('public.is_admin_reader()')::oid
        AND procedure.prosecdef
        AND procedure.provolatile = 's'
        AND pg_get_userbyid(procedure.proowner) = 'postgres'
    )
  THEN
    RAISE EXCEPTION 'is_admin_reader() changed unexpectedly';
  END IF;
END
$$;

COMMIT;
