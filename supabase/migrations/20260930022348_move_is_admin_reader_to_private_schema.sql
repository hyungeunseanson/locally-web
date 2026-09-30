-- Move the admin RLS helper outside the Data API schemas (public, graphql_public).
-- This migration deliberately fails if the reviewed Production state has drifted.
BEGIN;

DO $precondition$
DECLARE
  policy_differences integer;
BEGIN
  -- An existing namespace is reusable only when it is empty and owner-only.
  -- Data API exposed schemas must also be checked outside the database.
  IF EXISTS (
    SELECT 1 FROM pg_namespace AS n
    WHERE n.nspname = 'private'
      AND (pg_get_userbyid(n.nspowner) <> 'postgres'
           OR n.nspacl IS NOT NULL)
  ) OR EXISTS (
    SELECT 1 FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private'
  ) OR EXISTS (
    SELECT 1 FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
  ) OR EXISTS (
    SELECT 1 FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = 'private'
  ) THEN
    RAISE EXCEPTION 'is_admin_reader precondition: private schema owner, ACL or contents drifted';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    WHERE p.oid = to_regprocedure('public.is_admin_reader()')
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND p.prosecdef
      AND p.provolatile = 's'
      AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
      AND p.pronargs = 0
      AND p.prorettype = 'boolean'::regtype
      AND p.proconfig = ARRAY['search_path=public, pg_catalog']::text[]
      AND p.proacl::text = '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
      AND md5(p.prosrc) = '66b4339455cbeb7070d383c60f8137ba'
  ) THEN
    RAISE EXCEPTION 'is_admin_reader precondition: public function contract drifted';
  END IF;

  WITH expected(schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check) AS (
    VALUES
      ('public', 'admin_audit_logs', 'admin_audit_logs_admin_read_only', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'is_admin_reader()', NULL::text),
      ('public', 'admin_task_comments', 'admin_task_comments_admin_read_only', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'is_admin_reader()', NULL::text),
      ('public', 'admin_tasks', 'admin_tasks_admin_read_only', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'is_admin_reader()', NULL::text),
      ('public', 'admin_whitelist', 'admin_whitelist_admin_read_only', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'is_admin_reader()', NULL::text),
      ('public', 'inquiries', 'inquiries_select_admin', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'is_admin_reader()', NULL::text),
      ('public', 'inquiry_messages', 'inquiry_messages_select_admin', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'is_admin_reader()', NULL::text),
      ('public', 'profiles', 'profiles_select_admin', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'is_admin_reader()', NULL::text),
      ('storage', 'objects', 'Admins can delete files', 'PERMISSIVE', ARRAY['authenticated']::name[], 'DELETE', '((bucket_id = ''admin_files''::text) AND is_admin_reader())', NULL::text),
      ('storage', 'objects', 'Admins can read files', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', '((bucket_id = ''admin_files''::text) AND is_admin_reader())', NULL::text),
      ('storage', 'objects', 'Admins can update files', 'PERMISSIVE', ARRAY['authenticated']::name[], 'UPDATE', '((bucket_id = ''admin_files''::text) AND is_admin_reader())', '((bucket_id = ''admin_files''::text) AND is_admin_reader())')
  ), actual AS (
    SELECT schemaname::text, tablename::text, policyname::text,
           permissive::text, roles, cmd::text, qual, with_check
    FROM pg_policies
    WHERE (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%is_admin_reader%'
  ), differences AS (
    (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    UNION ALL
    (SELECT * FROM actual EXCEPT SELECT * FROM expected)
  )
  SELECT count(*) INTO policy_differences FROM differences;

  IF policy_differences <> 0 THEN
    RAISE EXCEPTION 'is_admin_reader precondition: policy contract drifted (% differences)', policy_differences;
  END IF;
END;
$precondition$;

CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE FUNCTION private.is_admin_reader()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  current_email text := NULLIF(pg_catalog.btrim(auth.jwt() ->> 'email'), '');
  resolved_user_role text := NULL;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role
  INTO resolved_user_role
  FROM public.users
  WHERE id = current_user_id
  LIMIT 1;

  IF resolved_user_role = 'admin' THEN
    RETURN true;
  END IF;

  IF current_email IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_whitelist
    WHERE email = current_email
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.is_admin_reader() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin_reader() TO authenticated, service_role;

ALTER POLICY admin_audit_logs_admin_read_only ON public.admin_audit_logs USING (private.is_admin_reader());
ALTER POLICY admin_task_comments_admin_read_only ON public.admin_task_comments USING (private.is_admin_reader());
ALTER POLICY admin_tasks_admin_read_only ON public.admin_tasks USING (private.is_admin_reader());
ALTER POLICY admin_whitelist_admin_read_only ON public.admin_whitelist USING (private.is_admin_reader());
ALTER POLICY inquiries_select_admin ON public.inquiries USING (private.is_admin_reader());
ALTER POLICY inquiry_messages_select_admin ON public.inquiry_messages USING (private.is_admin_reader());
ALTER POLICY profiles_select_admin ON public.profiles USING (private.is_admin_reader());

ALTER POLICY "Admins can read files" ON storage.objects
  USING (bucket_id = 'admin_files' AND private.is_admin_reader());
ALTER POLICY "Admins can update files" ON storage.objects
  USING (bucket_id = 'admin_files' AND private.is_admin_reader())
  WITH CHECK (bucket_id = 'admin_files' AND private.is_admin_reader());
ALTER POLICY "Admins can delete files" ON storage.objects
  USING (bucket_id = 'admin_files' AND private.is_admin_reader());

DO $before_drop$
BEGIN
  IF (SELECT count(*) FROM pg_policies
      WHERE (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%private.is_admin_reader%') <> 10
     OR EXISTS (SELECT 1 FROM pg_policies
                WHERE (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%is_admin_reader%'
                  AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%private.is_admin_reader%')
  THEN
    RAISE EXCEPTION 'is_admin_reader migration: policies were not completely rewired';
  END IF;
END;
$before_drop$;

DROP FUNCTION public.is_admin_reader();

DO $postcondition$
BEGIN
  IF to_regprocedure('public.is_admin_reader()') IS NOT NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_proc AS p
      WHERE p.oid = to_regprocedure('private.is_admin_reader()')
        AND pg_get_userbyid(p.proowner) = 'postgres'
        AND p.prosecdef AND p.provolatile = 's'
        AND p.pronargs = 0 AND p.prorettype = 'boolean'::regtype
        AND p.proconfig = ARRAY['search_path=""']::text[]
        AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) WHERE grantee = 0 AND privilege_type = 'EXECUTE')
    )
    OR has_schema_privilege('anon', 'private', 'USAGE')
    OR has_schema_privilege('anon', 'private', 'CREATE')
    OR has_schema_privilege('authenticated', 'private', 'CREATE')
    OR NOT has_schema_privilege('authenticated', 'private', 'USAGE')
    OR NOT has_schema_privilege('service_role', 'private', 'USAGE')
    OR has_schema_privilege('service_role', 'private', 'CREATE')
    OR has_function_privilege('anon', 'private.is_admin_reader()', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'private.is_admin_reader()', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'private.is_admin_reader()', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'is_admin_reader migration: final function or privileges drifted';
  END IF;
END;
$postcondition$;

COMMIT;
