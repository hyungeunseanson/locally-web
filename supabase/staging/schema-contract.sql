\set ON_ERROR_STOP on

BEGIN READ ONLY;

DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(name ORDER BY name)
  INTO missing
  FROM unnest(ARRAY[
    'bookings', 'experience_availability', 'experiences', 'host_applications',
    'inquiries', 'inquiry_messages', 'notifications',
    'profile_private_demographics', 'profiles', 'service_assignment_history',
    'service_bookings', 'service_refund_operations',
    'service_request_schedule_items', 'service_requests', 'users'
  ]) AS required(name)
  WHERE to_regclass(format('public.%I', name)) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing functional-canary tables: %', missing;
  END IF;

  IF to_regclass('public.public_host_applications') IS NULL
    OR to_regclass('public.public_profiles') IS NULL
  THEN
    RAISE EXCEPTION 'Required privacy-safe public views are missing';
  END IF;

  SELECT array_agg(name ORDER BY name)
  INTO missing
  FROM unnest(ARRAY[
    'assign_service_concierge_host_atomic', 'begin_service_refund_operation_atomic',
    'cancel_pending_service_concierge_atomic',
    'complete_service_concierge_booking_if_due_atomic',
    'confirm_service_concierge_payment_atomic', 'create_booking_atomic',
    'create_service_concierge_request_atomic', 'ensure_profile_demographics_reminder',
    'finalize_proxy_card_intake_atomic', 'finish_service_refund_operation_atomic',
    'handle_new_user', 'is_admin_reader',
    'request_service_cancellation_review_atomic'
  ]) AS required(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE procedure.proname = required.name
      AND namespace.nspname = CASE
        WHEN required.name = 'is_admin_reader' THEN 'private'
        ELSE 'public'
      END
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing functional-canary functions: %', missing;
  END IF;

  IF to_regprocedure('public.is_admin_reader()') IS NOT NULL THEN
    RAISE EXCEPTION 'Exposed public admin reader helper must be absent';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger trigger
    WHERE trigger.tgname = 'on_auth_user_created'
      AND trigger.tgrelid = 'auth.users'::regclass
      AND NOT trigger.tgisinternal
  ) THEN
    RAISE EXCEPTION 'auth.users -> handle_new_user trigger is missing';
  END IF;

  SELECT array_agg(relation.relname ORDER BY relation.relname)
  INTO missing
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = ANY (ARRAY[
      'bookings', 'experience_availability', 'experiences', 'host_applications',
      'inquiries', 'inquiry_messages', 'notifications',
      'profile_private_demographics', 'profiles', 'service_assignment_history',
      'service_bookings', 'service_refund_operations',
      'service_request_schedule_items', 'service_requests', 'users'
    ])
    AND NOT relation.relrowsecurity;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'RLS disabled on protected tables: %', missing;
  END IF;

  SELECT array_agg(difference ORDER BY difference)
  INTO missing
  FROM (
    SELECT 'missing:public.' || required.name AS difference
    FROM unnest(ARRAY[
      'admin_audit_logs', 'admin_task_comments', 'admin_tasks',
      'admin_whitelist', 'inquiries', 'inquiry_messages', 'notifications', 'profiles'
    ]) AS required(name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables publication
      WHERE publication.pubname = 'supabase_realtime'
        AND publication.schemaname = 'public'
        AND publication.tablename = required.name
    )
    UNION ALL
    SELECT 'unexpected:' || publication.schemaname || '.' || publication.tablename
    FROM pg_publication_tables publication
    WHERE publication.pubname = 'supabase_realtime'
      AND NOT (
        publication.schemaname = 'public'
        AND publication.tablename = ANY (ARRAY[
          'admin_audit_logs', 'admin_task_comments', 'admin_tasks',
          'admin_whitelist', 'inquiries', 'inquiry_messages', 'notifications', 'profiles'
        ]::text[])
      )
  ) AS publication_difference;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'supabase_realtime differs from Production parity: %', missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables publication
    WHERE publication.pubname = 'supabase_realtime'
      AND publication.schemaname = 'public'
      AND publication.tablename = 'inquiry_messages'
  ) THEN
    RAISE EXCEPTION 'Functional canary requires Production-published inquiry_messages';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiry_messages'
      AND cmd = 'INSERT'
  ) OR has_table_privilege('authenticated', 'public.inquiry_messages', 'INSERT') THEN
    RAISE EXCEPTION 'inquiry_messages must remain server-write-only';
  END IF;

  IF has_table_privilege('anon', 'public.profiles', 'SELECT')
    OR has_table_privilege('anon', 'public.users', 'SELECT')
  THEN
    RAISE EXCEPTION 'Private profile/user tables are exposed to anon';
  END IF;

  SELECT array_agg(required.name ORDER BY required.name)
  INTO missing
  FROM (VALUES
    ('profiles', 'profiles_select_own'),
    ('profiles', 'profiles_select_admin'),
    ('users', 'users_select_own'),
    ('inquiries', 'inquiries_select_participant'),
    ('inquiries', 'inquiries_select_admin'),
    ('inquiry_messages', 'inquiry_messages_select_participant'),
    ('inquiry_messages', 'inquiry_messages_select_admin'),
    ('notifications', 'notifications_read_own'),
    ('notifications', 'notifications_write_service_role'),
    ('bookings', 'bookings_insert_service_role_only')
  ) AS required(table_name, name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = required.table_name
      AND policy.policyname = required.name
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing critical RLS policies: %', missing;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_private_demographics'
      AND roles && ARRAY['anon', 'authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'Private demographics has a client RLS policy';
  END IF;

  SELECT array_agg(required_table.name ORDER BY required_table.name)
  INTO missing
  FROM unnest(ARRAY[
    'service_assignment_history',
    'service_refund_operations',
    'service_request_schedule_items'
  ]) AS required_table(name)
  WHERE EXISTS (
    SELECT 1 FROM pg_policies AS policy_def
    WHERE policy_def.schemaname = 'public'
      AND policy_def.tablename = required_table.name
  )
  OR EXISTS (
    SELECT 1
    FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS privilege_def(name)
    WHERE has_table_privilege('anon', format('public.%I', required_table.name), privilege_def.name)
       OR has_table_privilege('authenticated', format('public.%I', required_table.name), privilege_def.name)
       OR NOT has_table_privilege('service_role', format('public.%I', required_table.name), privilege_def.name)
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Concierge service-role table security differs: %', missing;
  END IF;

  SELECT array_agg(procedure_def.proname ORDER BY procedure_def.proname)
  INTO missing
  FROM pg_proc AS procedure_def
  JOIN pg_namespace AS namespace_def ON namespace_def.oid = procedure_def.pronamespace
  WHERE namespace_def.nspname = 'public'
    AND procedure_def.proname = ANY (ARRAY[
      'assign_service_concierge_host_atomic',
      'begin_service_refund_operation_atomic',
      'cancel_pending_service_concierge_atomic',
      'complete_service_concierge_booking_if_due_atomic',
      'confirm_service_concierge_payment_atomic',
      'create_service_concierge_request_atomic',
      'finish_service_refund_operation_atomic',
      'request_service_cancellation_review_atomic'
    ])
    AND (
      NOT procedure_def.prosecdef
      OR NOT (COALESCE(procedure_def.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[])
      OR has_function_privilege('anon', procedure_def.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', procedure_def.oid, 'EXECUTE')
      OR NOT has_function_privilege('service_role', procedure_def.oid, 'EXECUTE')
    );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Concierge RPC security differs: %', missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS procedure_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = procedure_def.pronamespace
    WHERE namespace_def.nspname = 'public'
      AND procedure_def.proname = 'finalize_proxy_card_intake_atomic'
      AND pg_get_function_identity_arguments(procedure_def.oid) =
        'p_proxy_request_id uuid, p_verified_amount integer, p_verified_tid text, p_initial_message text'
  ) THEN
    RAISE EXCEPTION 'Proxy card intake RPC is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc AS procedure_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = procedure_def.pronamespace
    WHERE namespace_def.nspname = 'public'
      AND procedure_def.proname = 'finalize_proxy_card_intake_atomic'
      AND (
        procedure_def.prosecdef
        OR NOT (COALESCE(procedure_def.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[])
        OR has_function_privilege('anon', procedure_def.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', procedure_def.oid, 'EXECUTE')
        OR NOT has_function_privilege('service_role', procedure_def.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'Proxy card intake RPC security differs';
  END IF;
END;
$$;

WITH required(name, expected_public) AS (
  VALUES
    ('admin_files', false),
    ('avatars', true),
    ('chat-images', false),
    ('experiences', false),
    ('images', true),
    ('verification-docs', false)
), actual AS (
  SELECT id::text AS name, public
  FROM storage.buckets
)
SELECT required.name, required.expected_public, actual.public AS actual_public,
  actual.name IS NOT NULL AND actual.public = required.expected_public AS matches
FROM required
LEFT JOIN actual USING (name)
ORDER BY required.name;

DO $$
DECLARE
  mismatch text[];
BEGIN
  SELECT array_agg(required.name ORDER BY required.name)
  INTO mismatch
  FROM (
    VALUES
      ('admin_files', false),
      ('avatars', true),
      ('chat-images', false),
      ('experiences', false),
      ('images', true),
      ('verification-docs', false)
  ) AS required(name, expected_public)
  LEFT JOIN storage.buckets bucket ON bucket.id = required.name
  WHERE bucket.id IS NULL OR bucket.public IS DISTINCT FROM required.expected_public;

  IF mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'Missing or misconfigured storage buckets: %', mismatch;
  END IF;

  SELECT array_agg(policy_def.policyname ORDER BY policy_def.policyname)
  INTO mismatch
  FROM pg_policies AS policy_def
  WHERE policy_def.schemaname = 'storage' AND policy_def.tablename = 'objects';

  IF mismatch IS DISTINCT FROM ARRAY[
    'Admins can delete files',
    'Admins can read files',
    'Admins can update files',
    'Avatar images are publicly accessible',
    'Avatar owners can delete',
    'Avatar owners can update',
    'Avatar owners can upload',
    'Image owners can delete',
    'Image owners can read',
    'Image owners can update',
    'Image owners can upload',
    'Only admins can upload files',
    'Verification docs owners can delete',
    'Verification docs owners can read',
    'Verification docs owners can update',
    'Verification docs owners can upload'
  ]::text[] THEN
    RAISE EXCEPTION 'Storage object policy inventory differs: %', mismatch;
  END IF;
END;
$$;

-- Captured from Production catalogs on 2026-10-02. These assertions only read
-- metadata; they never invoke chat RPCs, triggers, or replay applied migrations.
DO $admin_message_monitoring_contract$
DECLARE
  actual text[];
BEGIN
  SELECT array_agg(table_name || '|' || column_name || '|' || data_type || '|' || is_nullable || '|' || coalesce(column_default, '') ORDER BY table_name, column_name)
    INTO actual FROM information_schema.columns
   WHERE table_schema = 'public'
     AND (table_name, column_name) IN (('inquiries', 'support_reopened_at'), ('inquiry_messages', 'admin_read_at'));
  IF actual IS DISTINCT FROM ARRAY[
    'inquiries|support_reopened_at|timestamp with time zone|YES|',
    'inquiry_messages|admin_read_at|timestamp with time zone|YES|'
  ]::text[] THEN
    RAISE EXCEPTION 'admin monitoring column contract mismatch: %', actual;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY['inquiries', 'inquiry_messages']) AS table_def(name)
    CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS role_def(name)
    CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS privilege_def(name)
    WHERE has_table_privilege(role_def.name, 'public.' || table_def.name, privilege_def.name)
  ) OR EXISTS (
    SELECT 1 FROM unnest(ARRAY['inquiries', 'inquiry_messages']) AS table_def(name)
    CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS role_def(name)
    CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'REFERENCES']) AS privilege_def(name)
    WHERE has_any_column_privilege(role_def.name, 'public.' || table_def.name, privilege_def.name)
  ) THEN
    RAISE EXCEPTION 'chat client table or column write grant exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY['inquiries', 'inquiry_messages']) AS table_def(name)
    CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS privilege_def(name)
    WHERE NOT has_table_privilege('service_role', 'public.' || table_def.name, privilege_def.name)
  ) OR EXISTS (
    SELECT 1 FROM unnest(ARRAY['inquiries', 'inquiry_messages']) AS table_def(name)
    CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS role_def(name)
    WHERE NOT has_table_privilege(role_def.name, 'public.' || table_def.name, 'SELECT')
  ) THEN
    RAISE EXCEPTION 'chat server writes or client SELECT grants differ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename IN ('inquiries', 'inquiry_messages') AND cmd IN ('UPDATE', 'ALL')
  ) THEN
    RAISE EXCEPTION 'retired chat UPDATE policy exists';
  END IF;

  SELECT array_agg(index_meta.indexdef ORDER BY index_meta.indexname) INTO actual
    FROM pg_indexes AS index_meta JOIN pg_namespace AS namespace_def ON namespace_def.nspname = index_meta.schemaname
    JOIN pg_class AS class_def ON class_def.relnamespace = namespace_def.oid AND class_def.relname = index_meta.indexname
    JOIN pg_index AS index_def ON index_def.indexrelid = class_def.oid
   WHERE index_meta.schemaname = 'public' AND index_meta.indexname = 'inquiry_messages_admin_activity_idx'
     AND index_def.indisvalid AND index_def.indisready;
  IF actual IS DISTINCT FROM ARRAY[
    'CREATE INDEX inquiry_messages_admin_activity_idx ON public.inquiry_messages USING btree (inquiry_id, id DESC)'
  ]::text[] THEN
    RAISE EXCEPTION 'admin monitoring index contract mismatch: %', actual;
  END IF;

  SELECT array_agg(pg_get_triggerdef(trigger_def.oid, true) ORDER BY class_def.relname, trigger_def.tgname) INTO actual
    FROM pg_trigger AS trigger_def JOIN pg_class AS class_def ON class_def.oid = trigger_def.tgrelid
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
   WHERE namespace_def.nspname = 'public' AND NOT trigger_def.tgisinternal AND trigger_def.tgenabled = 'O'
     AND (class_def.relname, trigger_def.tgname) IN (('inquiries', 'inquiry_support_version'), ('inquiry_messages', 'inquiry_support_message'));
  IF actual IS DISTINCT FROM ARRAY[
    'CREATE TRIGGER inquiry_support_version BEFORE UPDATE ON inquiries FOR EACH ROW EXECUTE FUNCTION private.advance_support_version()',
    'CREATE TRIGGER inquiry_support_message BEFORE INSERT ON inquiry_messages FOR EACH ROW EXECUTE FUNCTION private.prepare_support_message()'
  ]::text[] THEN
    RAISE EXCEPTION 'admin monitoring trigger contract mismatch: %', actual;
  END IF;

  SELECT array_agg(format('%I.%I(%s)', namespace_def.nspname, procedure_def.proname, pg_get_function_identity_arguments(procedure_def.oid)) || '|' ||
      pg_get_userbyid(procedure_def.proowner) || '|' || procedure_def.prosecdef::text || '|' || procedure_def.provolatile::text || '|' ||
      pg_get_function_result(procedure_def.oid) || '|' || array_to_string(procedure_def.proconfig, ',') || '|' || procedure_def.proacl::text || '|' || md5(procedure_def.prosrc)
      ORDER BY namespace_def.nspname, procedure_def.proname, pg_get_function_identity_arguments(procedure_def.oid)) INTO actual
    FROM pg_proc AS procedure_def JOIN pg_namespace AS namespace_def ON namespace_def.oid = procedure_def.pronamespace
   WHERE (namespace_def.nspname = 'private' AND procedure_def.proname IN ('advance_support_version', 'is_inquiry_admin_sender', 'prepare_support_message'))
      OR (namespace_def.nspname = 'public' AND procedure_def.proname IN ('ack_admin_inquiry_messages', 'get_admin_inquiry_activity'));
  IF actual IS DISTINCT FROM ARRAY[
    'private.advance_support_version()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|bc70811ad62c5a9c5d0102b25edcc973',
    'private.is_inquiry_admin_sender(p_sender uuid)|postgres|true|s|boolean|search_path=""|{postgres=X/postgres}|62c7da6bb51d6fc0e972cccfbb65b163',
    'private.prepare_support_message()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|e14b53805c9a60cce33e6d91d80ee903',
    'public.ack_admin_inquiry_messages(p_inquiry_id bigint, p_through_message_id bigint)|postgres|true|v|bigint|search_path=""|{postgres=X/postgres,service_role=X/postgres}|475a832f9d6408b31673d5b26a955254',
    'public.get_admin_inquiry_activity(p_inquiry_ids bigint[])|postgres|true|s|TABLE(inquiry_id bigint, status text, updated_at timestamp with time zone, last_message_at timestamp with time zone, last_sender_role text, last_message_content text, needs_reply boolean, reply_waiting_since timestamp with time zone, support_reopened_at timestamp with time zone, admin_unread_count bigint)|search_path=""|{postgres=X/postgres,service_role=X/postgres}|632f807ffa404e2854db8f272b4db437'
  ]::text[] THEN
    RAISE EXCEPTION 'admin monitoring function definition or execute ACL mismatch: %', actual;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND (schemaname <> 'public' OR rowfilter IS NOT NULL OR attnames IS DISTINCT FROM (
        SELECT array_agg(attribute_def.attname ORDER BY attribute_def.attnum)
          FROM pg_attribute AS attribute_def
         WHERE attribute_def.attrelid = format('%I.%I', schemaname, tablename)::regclass
           AND attribute_def.attnum > 0 AND NOT attribute_def.attisdropped
      ))
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
      AND pg_get_userbyid(pubowner) = 'postgres' AND NOT puballtables
      AND pubinsert AND pubupdate AND pubdelete AND pubtruncate AND NOT pubviaroot
  ) THEN
    RAISE EXCEPTION 'Realtime publication configuration or column/filter contract mismatch';
  END IF;
END
$admin_message_monitoring_contract$;

SELECT 'LOCALLY_STAGING_SCHEMA_CONTRACT_PASS' AS result;

ROLLBACK;
