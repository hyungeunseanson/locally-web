-- Read-only post-install gate. This file never installs or repairs anything.
BEGIN TRANSACTION READ ONLY;
DO $contract$
DECLARE p record; n integer:=0;
BEGIN
 FOR p IN SELECT proc.*,ns.nspname,pg_get_userbyid(proc.proowner) AS owner
  FROM pg_proc proc JOIN pg_namespace ns ON ns.oid=proc.pronamespace
  WHERE ns.nspname='public' AND proc.proname IN ('lease_experience_translation_task','finalize_experience_translation_task') LOOP
  n:=n+1;
  IF p.owner<>'postgres' OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']
   OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
   OR NOT has_function_privilege('service_role',p.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'translation RPC security contract mismatch';
  END IF;
 END LOOP;
 IF n<>3 OR to_regprocedure('public.finalize_experience_translation_task(uuid,integer,timestamp with time zone,jsonb)') IS NULL
  OR to_regprocedure('public.lease_experience_translation_task(text,timestamp with time zone,integer)') IS NULL
  OR to_regprocedure('public.lease_experience_translation_task(text,timestamp with time zone,integer,integer)') IS NULL THEN
  RAISE EXCEPTION 'translation RPC overload contract mismatch';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='private.translation_completion_receipts'::regclass AND relrowsecurity AND relowner='postgres'::regrole)
  OR has_table_privilege('anon','private.translation_completion_receipts','SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('authenticated','private.translation_completion_receipts','SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('service_role','private.translation_completion_receipts','SELECT,INSERT,UPDATE,DELETE') THEN
  RAISE EXCEPTION 'translation receipt boundary mismatch';
 END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND
  ((tgrelid='public.experiences'::regclass AND tgname='translation_legacy_finalize_p1') OR
   (tgrelid='public.experience_translation_tasks'::regclass AND tgname='translation_task_terminal_p1') OR
   (tgrelid='public.experience_translation_jobs'::regclass AND tgname='translation_job_terminal_p1')))<>3 THEN
  RAISE EXCEPTION 'translation compatibility triggers missing';
 END IF;
END
$contract$;
ROLLBACK;
