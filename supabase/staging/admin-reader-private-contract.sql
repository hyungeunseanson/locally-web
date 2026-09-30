\set ON_ERROR_STOP on

-- Read-only target-state check after the pending 1-B2 migration is applied.
BEGIN READ ONLY;

DO $contract$
DECLARE
  differences integer;
BEGIN
  IF to_regprocedure('public.is_admin_reader()') IS NOT NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_proc AS p
      WHERE p.oid = to_regprocedure('private.is_admin_reader()')
        AND pg_get_userbyid(p.proowner) = 'postgres'
        AND p.prosecdef AND p.provolatile = 's'
        AND p.pronargs = 0 AND p.prorettype = 'boolean'::regtype
        AND p.proconfig = ARRAY['search_path=""']::text[]
        AND p.prosrc LIKE '%resolved_user_role%'
        AND p.prosrc NOT LIKE '%current_role%'
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
    RAISE EXCEPTION 'admin reader target function or privileges drifted';
  END IF;

  WITH expected(schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check) AS (
    VALUES
      ('public', 'admin_audit_logs', 'admin_audit_logs_admin_read_only', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'private.is_admin_reader()', NULL::text),
      ('public', 'admin_task_comments', 'admin_task_comments_admin_read_only', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'private.is_admin_reader()', NULL::text),
      ('public', 'admin_tasks', 'admin_tasks_admin_read_only', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'private.is_admin_reader()', NULL::text),
      ('public', 'admin_whitelist', 'admin_whitelist_admin_read_only', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'private.is_admin_reader()', NULL::text),
      ('public', 'inquiries', 'inquiries_select_admin', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'private.is_admin_reader()', NULL::text),
      ('public', 'inquiry_messages', 'inquiry_messages_select_admin', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'private.is_admin_reader()', NULL::text),
      ('public', 'profiles', 'profiles_select_admin', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', 'private.is_admin_reader()', NULL::text),
      ('storage', 'objects', 'Admins can delete files', 'PERMISSIVE', ARRAY['authenticated']::name[], 'DELETE', '((bucket_id = ''admin_files''::text) AND private.is_admin_reader())', NULL::text),
      ('storage', 'objects', 'Admins can read files', 'PERMISSIVE', ARRAY['authenticated']::name[], 'SELECT', '((bucket_id = ''admin_files''::text) AND private.is_admin_reader())', NULL::text),
      ('storage', 'objects', 'Admins can update files', 'PERMISSIVE', ARRAY['authenticated']::name[], 'UPDATE', '((bucket_id = ''admin_files''::text) AND private.is_admin_reader())', '((bucket_id = ''admin_files''::text) AND private.is_admin_reader())')
  ), actual AS (
    SELECT schemaname::text, tablename::text, policyname::text,
           permissive::text, roles, cmd::text, qual, with_check
    FROM pg_policies
    WHERE (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%is_admin_reader%'
  ), delta AS (
    (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    UNION ALL
    (SELECT * FROM actual EXCEPT SELECT * FROM expected)
  )
  SELECT count(*) INTO differences FROM delta;

  IF differences <> 0 THEN
    RAISE EXCEPTION 'admin reader target policies drifted (% differences)', differences;
  END IF;
END;
$contract$;

ROLLBACK;
