\set ON_ERROR_STOP on

BEGIN READ ONLY;

DO $baseline_contract$
DECLARE
  actual text[];
  expected text[];
  actual_count bigint;
BEGIN
  SELECT array_agg(class.relname ORDER BY class.relname)
    INTO actual
    FROM pg_class AS class
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
   WHERE namespace.nspname = 'public' AND class.relkind IN ('r', 'p');
  expected := ARRAY[
    'admin_audit_logs', 'admin_job_runs', 'admin_manual_payouts',
    'admin_support_unread_alert_batches', 'admin_task_comments', 'admin_tasks',
    'admin_whitelist', 'analytics_events', 'bookings', 'community_comments',
    'community_likes', 'community_posts', 'experience_availability',
    'experience_popularity_snapshot', 'experience_translation_jobs',
    'experience_translation_tasks', 'experiences', 'guest_reviews',
    'host_applications', 'inquiries', 'inquiry_messages', 'likes', 'messages',
    'notifications', 'profile_private_demographics', 'profiles', 'proxy_comments',
    'proxy_requests', 'reviews', 'search_logs', 'service_applications',
    'service_bookings', 'service_requests', 'translation_provider_state', 'users',
    'wishlists'
  ]::text[];
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'public table inventory mismatch: %', actual;
  END IF;

  SELECT array_agg(class.relname ORDER BY class.relname)
    INTO actual
    FROM pg_class AS class
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
   WHERE namespace.nspname = 'public' AND class.relkind = 'v';
  IF actual IS DISTINCT FROM ARRAY['public_host_applications', 'public_profiles']::text[] THEN
    RAISE EXCEPTION 'public view inventory mismatch: %', actual;
  END IF;

  SELECT count(*) INTO actual_count
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = ANY (expected);
  IF actual_count <> 472 THEN RAISE EXCEPTION 'column count %, expected 472', actual_count; END IF;

  SELECT count(*) INTO actual_count
    FROM pg_constraint AS constraint_def
    JOIN pg_class AS class ON class.oid = constraint_def.conrelid
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
   WHERE namespace.nspname = 'public';
  IF actual_count <> 159 THEN RAISE EXCEPTION 'constraint count %, expected 159', actual_count; END IF;

  SELECT count(*) INTO actual_count FROM pg_indexes WHERE schemaname = 'public';
  IF actual_count <> 99 THEN RAISE EXCEPTION 'index count %, expected 99', actual_count; END IF;

  SELECT count(*) INTO actual_count
    FROM pg_class AS class
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
   WHERE namespace.nspname = 'public' AND class.relkind = 'S';
  IF actual_count <> 10 THEN RAISE EXCEPTION 'sequence count %, expected 10', actual_count; END IF;

  SELECT count(*) INTO actual_count
    FROM pg_proc AS procedure_def
    JOIN pg_namespace AS namespace ON namespace.oid = procedure_def.pronamespace
   WHERE namespace.nspname = 'public';
  IF actual_count <> 36 THEN RAISE EXCEPTION 'function overload count %, expected 36', actual_count; END IF;

  SELECT count(*) INTO actual_count
    FROM pg_trigger AS trigger_def
    JOIN pg_class AS class ON class.oid = trigger_def.tgrelid
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
   WHERE NOT trigger_def.tgisinternal AND namespace.nspname IN ('public', 'auth');
  IF actual_count <> 11 THEN RAISE EXCEPTION 'Locally trigger count %, expected 11', actual_count; END IF;

  SELECT count(*) INTO actual_count
    FROM pg_policies
   WHERE schemaname = 'public' OR (schemaname = 'storage' AND tablename = 'objects');
  IF actual_count <> 127 THEN RAISE EXCEPTION 'policy count %, expected 127', actual_count; END IF;

  SELECT count(*) INTO actual_count
    FROM pg_class AS class
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(class.relacl, acldefault('r', class.relowner))) AS acl_entry
   WHERE namespace.nspname = 'public'
     AND class.relkind IN ('r', 'p', 'v', 'm')
     AND acl_entry.grantee <> class.relowner;
  IF actual_count <> 791 THEN
    RAISE EXCEPTION 'non-owner table/view grant count %, expected 791', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
    FROM pg_proc AS procedure_def
    JOIN pg_namespace AS namespace ON namespace.oid = procedure_def.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(procedure_def.proacl, acldefault('f', procedure_def.proowner))) AS acl_entry
   WHERE namespace.nspname = 'public' AND acl_entry.grantee <> procedure_def.proowner;
  IF actual_count <> 74 THEN
    RAISE EXCEPTION 'non-owner function grant count %, expected 74', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
    FROM pg_class AS class
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(class.relacl, acldefault('s', class.relowner))) AS acl_entry
   WHERE namespace.nspname = 'public' AND class.relkind = 'S'
     AND acl_entry.grantee <> class.relowner;
  IF actual_count <> 84 THEN
    RAISE EXCEPTION 'non-owner sequence grant count %, expected 84', actual_count;
  END IF;

  SELECT array_agg(tablename ORDER BY tablename)
    INTO actual
    FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime' AND schemaname = 'public';
  expected := ARRAY[
    'admin_audit_logs', 'admin_task_comments', 'admin_tasks', 'admin_whitelist',
    'inquiry_messages', 'notifications', 'profiles'
  ]::text[];
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'supabase_realtime mismatch: %', actual;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_class AS class
      JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
     WHERE namespace.nspname = 'public' AND class.relkind IN ('r', 'p')
       AND class.relname NOT IN ('admin_job_runs', 'admin_support_unread_alert_batches')
       AND NOT class.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is disabled on a protected public table';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_class AS class
      JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
     WHERE namespace.nspname = 'public' AND class.relkind IN ('r', 'p')
       AND (class.relforcerowsecurity OR class.relreplident <> 'd')
  ) THEN
    RAISE EXCEPTION 'FORCE RLS or replica identity differs from Production';
  END IF;
END
$baseline_contract$;

SELECT 'LOCALLY_PRODUCTION_BASELINE_CATALOG_PASS' AS result;

ROLLBACK;
