-- Application submission, resubmission, and moderation write through the
-- authenticated server route/action using service_role. Browser roles only
-- need the existing own-row SELECT policy.
BEGIN;

DO $precondition$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.host_applications'::regclass
      AND relkind = 'r' AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'host_applications RLS contract drifted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.host_applications'::regclass
      AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'host_applications column grants require separate review';
  END IF;
END
$precondition$;

REVOKE ALL PRIVILEGES ON TABLE public.host_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.host_applications TO anon, authenticated;

-- Keep ha_select_own. No client role can create, edit, or remove an
-- application; the service_role path used by existing workflows is unchanged.
DROP POLICY IF EXISTS ha_insert_own ON public.host_applications;
DROP POLICY IF EXISTS ha_update_own ON public.host_applications;
DROP POLICY IF EXISTS ha_delete_own ON public.host_applications;

DO $postcondition$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT has_table_privilege(role_name, 'public.host_applications', 'SELECT')
       OR has_table_privilege(role_name, 'public.host_applications', 'INSERT')
       OR has_table_privilege(role_name, 'public.host_applications', 'UPDATE')
       OR has_table_privilege(role_name, 'public.host_applications', 'DELETE')
       OR has_table_privilege(role_name, 'public.host_applications', 'TRUNCATE')
       OR has_column_privilege(role_name, 'public.host_applications', 'status', 'INSERT')
       OR has_column_privilege(role_name, 'public.host_applications', 'status', 'UPDATE') THEN
      RAISE EXCEPTION 'host_applications client privilege lockdown failed for %', role_name;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('service_role', 'public.host_applications', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.host_applications', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.host_applications', 'DELETE')
     OR NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'host_applications'
         AND policyname = 'ha_select_own'
     ) THEN
    RAISE EXCEPTION 'host_applications server/own-read contract drifted';
  END IF;
END
$postcondition$;

COMMIT;
