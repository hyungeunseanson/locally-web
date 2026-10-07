-- Fresh-project target only: Production has NOT applied the Monitor migration.
BEGIN READ ONLY;
DO $admin_monitor_recency_target_contract$
DECLARE
  fn oid := to_regprocedure('public.list_admin_monitor_recency(integer,integer,bigint[])');
  role_name text;
BEGIN
  IF fn IS NULL THEN RAISE EXCEPTION 'Monitor canonical RPC missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE oid = fn AND provolatile = 's' AND NOT prosecdef
      AND proconfig = ARRAY['search_path=""']
      AND pg_get_function_result(oid) = 'TABLE(id text, canonical_activity_at timestamp with time zone)'
  ) THEN RAISE EXCEPTION 'Monitor canonical RPC security/result differs'; END IF;
  IF EXISTS (SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid = fn)) WHERE grantee = 0 AND privilege_type = 'EXECUTE') THEN
    RAISE EXCEPTION 'Monitor canonical RPC exposes PUBLIC EXECUTE';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_function_privilege(role_name, fn, 'EXECUTE') THEN RAISE EXCEPTION 'Monitor canonical RPC exposes %', role_name; END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN RAISE EXCEPTION 'Monitor canonical RPC service_role missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index WHERE indexrelid = to_regclass('public.admin_chat_visible_message_recency') AND indisvalid AND indisready) THEN
    RAISE EXCEPTION 'Monitor canonical RPC requires applied visible-message index';
  END IF;
END;
$admin_monitor_recency_target_contract$;
SELECT 'ADMIN_MONITOR_RECENCY_TARGET_CONTRACT_PASS' AS result;
ROLLBACK;
