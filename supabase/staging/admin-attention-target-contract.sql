-- STAGING/LOCAL AFTER the pending Phase 2 migration. Not current Production parity.
BEGIN READ ONLY;
DO $$
DECLARE fn text; role_name text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.get_admin_attention(bigint[])','public.ack_admin_inquiry_snapshot(bigint,bigint[])'] LOOP
    IF to_regprocedure(fn) IS NULL THEN RAISE EXCEPTION 'Missing attention function %', fn; END IF;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_function_privilege(role_name, fn, 'EXECUTE') THEN RAISE EXCEPTION 'Public attention RPC %', fn; END IF;
    END LOOP;
    IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN RAISE EXCEPTION 'Missing server grant %', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure(fn)
      AND prosecdef AND proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'Unsafe attention function definition %', fn;
    END IF;
  END LOOP;
  IF has_any_column_privilege('authenticated','public.inquiry_messages','UPDATE')
    OR has_any_column_privilege('authenticated','public.inquiries','UPDATE') THEN RAISE EXCEPTION 'Participant direct UPDATE restored'; END IF;
  IF to_regclass('public.inquiry_messages_admin_unseen_idx') IS NULL THEN RAISE EXCEPTION 'Missing unseen index'; END IF;
  IF to_regprocedure('private.prepare_support_message()') IS NULL
    OR to_regprocedure('private.advance_support_version()') IS NULL THEN RAISE EXCEPTION 'Missing Phase 1 safety functions'; END IF;
END $$;
SELECT 'ADMIN_ATTENTION_TARGET_CONTRACT_PASS';
ROLLBACK;
