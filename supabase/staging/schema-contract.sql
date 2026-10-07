\set ON_ERROR_STOP on

BEGIN READ ONLY;
SET LOCAL search_path = public, extensions;

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
   WHERE index_meta.schemaname = 'public' AND index_meta.indexname IN ('inquiry_messages_admin_activity_idx','inquiry_messages_admin_unseen_idx')
     AND index_def.indisvalid AND index_def.indisready;
  IF actual IS DISTINCT FROM ARRAY[
    'CREATE INDEX inquiry_messages_admin_activity_idx ON public.inquiry_messages USING btree (inquiry_id, id DESC)',
    'CREATE INDEX inquiry_messages_admin_unseen_idx ON public.inquiry_messages USING btree (inquiry_id, id) WHERE ((admin_read_at IS NULL) AND (type IS DISTINCT FROM ''deleted''::text))'
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
      OR (namespace_def.nspname = 'public' AND procedure_def.proname IN ('ack_admin_inquiry_messages', 'ack_admin_inquiry_snapshot', 'get_admin_attention', 'get_admin_inquiry_activity'));
  IF actual IS DISTINCT FROM ARRAY[
    'private.advance_support_version()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|bc70811ad62c5a9c5d0102b25edcc973',
    'private.is_inquiry_admin_sender(p_sender uuid)|postgres|true|s|boolean|search_path=""|{postgres=X/postgres}|62c7da6bb51d6fc0e972cccfbb65b163',
    'private.prepare_support_message()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|e14b53805c9a60cce33e6d91d80ee903',
    'public.ack_admin_inquiry_messages(p_inquiry_id bigint, p_through_message_id bigint)|postgres|true|v|bigint|search_path=""|{postgres=X/postgres,service_role=X/postgres}|bff56ffe887a01755e9d667d7ed5b3e6',
    'public.ack_admin_inquiry_snapshot(p_inquiry_id bigint, p_message_ids bigint[])|postgres|true|v|TABLE(changed bigint, admin_unread_count bigint)|search_path=""|{postgres=X/postgres,service_role=X/postgres}|b1869462839cb831be4eb47e4478d47b',
    'public.get_admin_attention(p_inquiry_ids bigint[])|postgres|true|s|jsonb|search_path=""|{postgres=X/postgres,service_role=X/postgres}|064a8bf9c5db77fe2c2279736d2381cf',
    'public.get_admin_inquiry_activity(p_inquiry_ids bigint[])|postgres|true|s|TABLE(inquiry_id bigint, status text, updated_at timestamp with time zone, last_message_at timestamp with time zone, last_sender_role text, last_message_content text, needs_reply boolean, reply_waiting_since timestamp with time zone, support_reopened_at timestamp with time zone, admin_unread_count bigint)|search_path=""|{postgres=X/postgres,service_role=X/postgres}|9dc6fbc65a6ae8e3208fb0842efe985e'
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

DO $admin_attention_contract$
DECLARE fn text; role_name text; actual text[]; fingerprint text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.get_admin_attention(bigint[])','public.ack_admin_inquiry_snapshot(bigint,bigint[])',
    'public.get_admin_inquiry_activity(bigint[])','public.ack_admin_inquiry_messages(bigint,bigint)'] LOOP
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
  IF to_regclass('private.admin_monitor_cutover') IS NULL THEN RAISE EXCEPTION 'Missing one-time monitor cutover'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'private.admin_monitor_cutover'::regclass AND relrowsecurity
      AND NOT relforcerowsecurity AND relkind = 'r' AND relpersistence = 'p' AND relreplident = 'd'
      AND pg_get_userbyid(relowner) = 'postgres' AND relacl::text = '{postgres=arwdDxtm/postgres,service_role=r/postgres}')
    OR (SELECT count(*) FROM private.admin_monitor_cutover) <> 1
    OR NOT EXISTS (SELECT 1 FROM private.admin_monitor_cutover WHERE singleton AND applied_at <= clock_timestamp()
      AND messages >= conversations AND conversations >= 0) THEN RAISE EXCEPTION 'Invalid monitor cutover record'; END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(role_name,'private.admin_monitor_cutover','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege(role_name,'private.admin_monitor_cutover','SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'Public monitor cutover access %', role_name;
    END IF;
  END LOOP;
  IF NOT has_table_privilege('service_role','private.admin_monitor_cutover','SELECT')
    OR has_table_privilege('service_role','private.admin_monitor_cutover','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') THEN
    RAISE EXCEPTION 'Unsafe server cutover grant';
  END IF;
  IF to_regprocedure('private.prepare_support_message()') IS NULL
    OR to_regprocedure('private.advance_support_version()') IS NULL THEN RAISE EXCEPTION 'Missing Phase 1 safety functions'; END IF;
  SELECT array_agg(relname::text ORDER BY relname) INTO actual FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private' AND relkind IN ('r','p') AND c.relname NOT IN ('phone_followup_tasks','host_profile_auth_cas','host_profile_operation_context','host_profile_source_authority','community_media_authority','community_media_context','community_media_plan_receipts');
  IF actual IS DISTINCT FROM ARRAY['admin_monitor_cutover']::text[] THEN RAISE EXCEPTION 'Private table inventory mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'private' AND tablename IN ('admin_monitor_cutover','phone_followup_tasks')) THEN RAISE EXCEPTION 'Private cutover policy exists'; END IF;
  SELECT array_agg(column_name || '|' || data_type || '|' || is_nullable || '|' || coalesce(column_default,'') ORDER BY ordinal_position)
    INTO actual FROM information_schema.columns WHERE table_schema = 'private' AND table_name = 'admin_monitor_cutover';
  IF actual IS DISTINCT FROM ARRAY['singleton|boolean|NO|true','applied_at|timestamp with time zone|NO|',
    'messages|bigint|NO|','conversations|bigint|NO|']::text[] THEN RAISE EXCEPTION 'Cutover column contract mismatch'; END IF;
  SELECT array_agg(conname || '|' || contype::text || '|' || pg_get_constraintdef(oid,true) ORDER BY conname)
    INTO actual FROM pg_constraint WHERE conrelid = 'private.admin_monitor_cutover'::regclass;
  IF actual IS DISTINCT FROM ARRAY[
    'admin_monitor_cutover_check|c|CHECK (conversations >= 0 AND conversations <= messages)',
    'admin_monitor_cutover_messages_check|c|CHECK (messages >= 0)',
    'admin_monitor_cutover_pkey|p|PRIMARY KEY (singleton)',
    'admin_monitor_cutover_singleton_check|c|CHECK (singleton)']::text[] THEN RAISE EXCEPTION 'Cutover constraint contract mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes x JOIN pg_class c ON c.relname = x.indexname
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = x.schemaname
    JOIN pg_index d ON d.indexrelid = c.oid WHERE x.schemaname = 'private' AND x.indexname = 'admin_monitor_cutover_pkey'
    AND d.indisvalid AND d.indisready AND x.indexdef = 'CREATE UNIQUE INDEX admin_monitor_cutover_pkey ON private.admin_monitor_cutover USING btree (singleton)')
    THEN RAISE EXCEPTION 'Cutover index contract mismatch'; END IF;
  SELECT md5(string_agg(n.nspname || '|' || c.relname || '|' || c.relkind::text || '|' ||
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END || '|' || a.privilege_type || '|' || a.is_grantable::text,
    E'\n' ORDER BY n.nspname,c.relname,c.relkind::text,CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable))
    INTO fingerprint FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname = 'private' AND c.relkind IN ('r','p','v','m','f') AND c.relname NOT IN ('phone_followup_tasks','host_profile_auth_cas','host_profile_operation_context','host_profile_source_authority','community_media_authority','community_media_context','community_media_plan_receipts');
  IF fingerprint IS DISTINCT FROM 'c0c83ee9ce880c47d3d24f3f918b4364' THEN RAISE EXCEPTION 'Private relation grant fingerprint mismatch'; END IF;
END $admin_attention_contract$;

-- Applied Phone schema: catalog/security only; no historical task rows are asserted.
DO $phone_followup_catalog_contract$
DECLARE actual text[]; role_name text; fingerprint text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass('private.phone_followup_tasks')
    AND relkind='r' AND relrowsecurity AND NOT relforcerowsecurity
    AND pg_get_userbyid(relowner)='postgres' AND relacl::text='{postgres=arwdDxtm/postgres}')
    OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='private' AND tablename='phone_followup_tasks') THEN
    RAISE EXCEPTION 'Phone task table security mismatch';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(role_name,'private.phone_followup_tasks','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege(role_name,'private.phone_followup_tasks','SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'Direct Phone task access: %',role_name;
    END IF;
  END LOOP;
  SELECT array_agg(column_name||'|'||data_type||'|'||is_nullable||'|'||coalesce(column_default,'') ORDER BY ordinal_position)
    INTO actual FROM information_schema.columns WHERE table_schema='private' AND table_name='phone_followup_tasks';
  IF actual IS DISTINCT FROM ARRAY[
    'proxy_request_id|uuid|NO|',
    'inquiry_id|bigint|NO|',
    'message_id|bigint|NO|',
    'handled_at|timestamp with time zone|YES|',
    'handled_by|uuid|YES|'
  ]::text[] THEN
    RAISE EXCEPTION 'Phone task column contract mismatch';
  END IF;
  SELECT array_agg(conname||'|'||contype::text||'|'||pg_get_constraintdef(oid) ORDER BY conname) INTO actual
    FROM pg_constraint WHERE conrelid='private.phone_followup_tasks'::regclass;
  IF actual IS DISTINCT FROM ARRAY[
    'phone_followup_tasks_check|c|CHECK (((handled_at IS NULL) = (handled_by IS NULL)))',
    'phone_followup_tasks_inquiry_id_message_id_key|u|UNIQUE (inquiry_id, message_id)',
    'phone_followup_tasks_pkey|p|PRIMARY KEY (proxy_request_id, message_id)',
    'phone_followup_tasks_proxy_request_id_fkey|f|FOREIGN KEY (proxy_request_id) REFERENCES proxy_requests(id) ON DELETE CASCADE'
  ]::text[] THEN
    RAISE EXCEPTION 'Phone task constraint contract mismatch';
  END IF;
  SELECT array_agg(n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' ||
    pg_get_userbyid(p.proowner) || '|' || p.prosecdef::text || '|' || p.provolatile::text || '|' ||
    pg_get_function_result(p.oid) || '|' || array_to_string(p.proconfig, ',') || '|' || p.proacl::text || '|' || md5(p.prosrc)
    ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) INTO actual
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','private') AND p.proname = ANY (ARRAY[
    'adopt_phone_followup_link',
    'capture_phone_followup',
    'delete_pending_phone_followup',
    'handle_phone_followup',
    'has_phone_followup',
    'complete_phone_request',
    'get_admin_phone_activity',
    'reply_phone_request'
  ]::text[]);
  IF actual IS DISTINCT FROM ARRAY[
    'private.adopt_phone_followup_link()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|0f0846bd82740f86bf756a4d3efdb62a',
    'private.capture_phone_followup()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|8b14875d99f0233491ba8eb1b3529db4',
    'private.delete_pending_phone_followup()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|12ce85f818fcfb042d310e682099ed80',
    'private.handle_phone_followup(p_request uuid, p_inquiry bigint, p_ids bigint[], p_admin uuid, p_complete boolean)|postgres|true|v|jsonb|search_path=""|{postgres=X/postgres}|ad6dfa357618613a3e720bb88ab910ed',
    'private.has_phone_followup(p_request uuid)|postgres|true|s|boolean|search_path=""|{postgres=X/postgres}|406db886025fdbc9a246fb2b7f2de399',
    'public.complete_phone_request(p_request_id uuid, p_inquiry_id bigint, p_message_ids bigint[], p_admin_id uuid)|postgres|true|v|jsonb|search_path=""|{postgres=X/postgres,service_role=X/postgres}|508e40c27519c58cef86371ca083428d',
    'public.get_admin_phone_activity(p_inquiry_ids bigint[])|postgres|true|s|TABLE(inquiry_id bigint, status text, updated_at timestamp with time zone, last_message_at timestamp with time zone, last_sender_role text, last_message_content text, needs_reply boolean, reply_waiting_since timestamp with time zone, support_reopened_at timestamp with time zone, admin_unread_count bigint, phone_needs_reply boolean)|search_path=""|{postgres=X/postgres,service_role=X/postgres}|f8c71d91ff642c0be0844befecc74d80',
    'public.reply_phone_request(p_request_id uuid, p_inquiry_id bigint, p_message_ids bigint[], p_admin_id uuid, p_content text, p_type text, p_image_url text)|postgres|true|v|jsonb|search_path=""|{postgres=X/postgres,service_role=X/postgres}|a3642483ffa73c83cfb9f7273e76c81a'
  ]::text[] THEN
    RAISE EXCEPTION 'Applied Phone/search function body or ACL mismatch: %', actual;
  END IF;
  SELECT array_agg(n.nspname || '.' || c.relname || '|' || pg_get_indexdef(c.oid) ORDER BY n.nspname,c.relname)
    INTO actual FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index i ON i.indexrelid=c.oid
    WHERE n.nspname IN ('public','private') AND c.relname = ANY (ARRAY[
    'phone_followup_pending_idx',
    'phone_followup_tasks_inquiry_id_message_id_key',
    'phone_followup_tasks_pkey',
    'proxy_requests_phone_link_idx'
  ]::text[]) AND i.indisvalid AND i.indisready;
  IF actual IS DISTINCT FROM ARRAY[
    'private.phone_followup_pending_idx|CREATE INDEX phone_followup_pending_idx ON private.phone_followup_tasks USING btree (proxy_request_id, message_id) WHERE (handled_at IS NULL)',
    'private.phone_followup_tasks_inquiry_id_message_id_key|CREATE UNIQUE INDEX phone_followup_tasks_inquiry_id_message_id_key ON private.phone_followup_tasks USING btree (inquiry_id, message_id)',
    'private.phone_followup_tasks_pkey|CREATE UNIQUE INDEX phone_followup_tasks_pkey ON private.phone_followup_tasks USING btree (proxy_request_id, message_id)',
    'public.proxy_requests_phone_link_idx|CREATE INDEX proxy_requests_phone_link_idx ON public.proxy_requests USING btree (btrim((form_data ->> ''linked_inquiry_id''::text))) WHERE ((form_data ->> ''__proxy_card_anchor''::text) IS DISTINCT FROM ''v1''::text)'
  ]::text[] THEN
    RAISE EXCEPTION 'Applied Phone/search index contract mismatch: %', actual;
  END IF;
  SELECT array_agg(c.relname||'|'||t.tgname||'|'||pg_get_triggerdef(t.oid) ORDER BY c.relname,t.tgname) INTO actual
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
    AND t.tgname IN ('phone_followup_capture','phone_followup_delete','phone_followup_link') AND t.tgenabled='O';
  IF actual IS DISTINCT FROM ARRAY[
    'inquiry_messages|phone_followup_capture|CREATE TRIGGER phone_followup_capture AFTER INSERT ON public.inquiry_messages FOR EACH ROW EXECUTE FUNCTION private.capture_phone_followup()',
    'inquiry_messages|phone_followup_delete|CREATE TRIGGER phone_followup_delete AFTER DELETE OR UPDATE OF type ON public.inquiry_messages FOR EACH ROW EXECUTE FUNCTION private.delete_pending_phone_followup()',
    'proxy_requests|phone_followup_link|CREATE TRIGGER phone_followup_link AFTER INSERT OR UPDATE OF form_data, user_id ON public.proxy_requests FOR EACH ROW EXECUTE FUNCTION private.adopt_phone_followup_link()'
  ]::text[] THEN
    RAISE EXCEPTION 'Phone task trigger contract mismatch';
  END IF;
  SELECT md5(string_agg(n.nspname||'|'||c.relname||'|'||c.relkind::text||'|'||
    CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END||'|'||a.privilege_type||'|'||a.is_grantable::text,
    E'\n' ORDER BY n.nspname,c.relname,c.relkind::text,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable))
    INTO fingerprint FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='private' AND c.relkind IN ('r','p','v','m','f') AND c.relname IN ('admin_monitor_cutover','phone_followup_tasks');
  IF fingerprint IS DISTINCT FROM '4c987b9bd1b8fdc56ed01bca38365c7d' THEN RAISE EXCEPTION 'Private relation grant fingerprint mismatch'; END IF;
END $phone_followup_catalog_contract$;

DO $admin_chat_search_contract$
DECLARE actual text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname='pg_trgm' AND e.extversion='1.6' AND n.nspname='extensions') THEN
    RAISE EXCEPTION 'Search extension contract mismatch';
  END IF;
  SELECT array_agg(n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' ||
    pg_get_userbyid(p.proowner) || '|' || p.prosecdef::text || '|' || p.provolatile::text || '|' ||
    pg_get_function_result(p.oid) || '|' || array_to_string(p.proconfig, ',') || '|' || p.proacl::text || '|' || md5(p.prosrc)
    ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) INTO actual
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','private') AND p.proname = ANY (ARRAY[
    'search_admin_chat',
    'admin_chat_phone_title'
  ]::text[]);
  IF actual IS DISTINCT FROM ARRAY[
    'private.admin_chat_phone_title(category text, form_data jsonb)|postgres|false|i|text|search_path=""|{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}|748c55d7ba0447eadf460de422f96c6c',
    'public.search_admin_chat(p_surface text, p_query text)|postgres|false|s|TABLE(id text, customer_name text, customer_email text, title text)|search_path=""|{postgres=X/postgres,service_role=X/postgres}|aa39a4e250b5cb71b26ad7340f2e7166'
  ]::text[] THEN
    RAISE EXCEPTION 'Applied Phone/search function body or ACL mismatch: %', actual;
  END IF;
  SELECT array_agg(n.nspname || '.' || c.relname || '|' || pg_get_indexdef(c.oid) ORDER BY n.nspname,c.relname)
    INTO actual FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index i ON i.indexrelid=c.oid
    WHERE n.nspname IN ('public','private') AND c.relname = ANY (ARRAY[
    'admin_chat_experience_title_search',
    'admin_chat_inquiry_customer',
    'admin_chat_inquiry_experience',
    'admin_chat_inquiry_id_search',
    'admin_chat_phone_contact_search',
    'admin_chat_phone_id_search',
    'admin_chat_phone_link',
    'admin_chat_phone_order_search',
    'admin_chat_phone_reservation_search',
    'admin_chat_phone_title_search',
    'admin_chat_profile_email_search',
    'admin_chat_profile_name_search'
  ]::text[]) AND i.indisvalid AND i.indisready;
  IF actual IS DISTINCT FROM ARRAY[
    'public.admin_chat_experience_title_search|CREATE INDEX admin_chat_experience_title_search ON public.experiences USING gin (title gin_trgm_ops)',
    'public.admin_chat_inquiry_customer|CREATE INDEX admin_chat_inquiry_customer ON public.inquiries USING btree (user_id) WHERE (type = ANY (ARRAY[''admin''::text, ''admin_support''::text]))',
    'public.admin_chat_inquiry_experience|CREATE INDEX admin_chat_inquiry_experience ON public.inquiries USING btree (experience_id) WHERE (type = ANY (ARRAY[''admin''::text, ''admin_support''::text]))',
    'public.admin_chat_inquiry_id_search|CREATE INDEX admin_chat_inquiry_id_search ON public.inquiries USING gin (((id)::text) gin_trgm_ops) WHERE (type = ANY (ARRAY[''admin''::text, ''admin_support''::text]))',
    'public.admin_chat_phone_contact_search|CREATE INDEX admin_chat_phone_contact_search ON public.proxy_requests USING gin (((form_data ->> ''contact_name''::text)) gin_trgm_ops)',
    'public.admin_chat_phone_id_search|CREATE INDEX admin_chat_phone_id_search ON public.proxy_requests USING gin (((id)::text) gin_trgm_ops)',
    'public.admin_chat_phone_link|CREATE INDEX admin_chat_phone_link ON public.proxy_requests USING btree (((form_data ->> ''linked_inquiry_id''::text))) WHERE ((form_data ->> ''__proxy_card_anchor''::text) IS DISTINCT FROM ''v1''::text)',
    'public.admin_chat_phone_order_search|CREATE INDEX admin_chat_phone_order_search ON public.proxy_requests USING gin (locally_order_id gin_trgm_ops)',
    'public.admin_chat_phone_reservation_search|CREATE INDEX admin_chat_phone_reservation_search ON public.proxy_requests USING gin (((form_data ->> ''reservation_name''::text)) gin_trgm_ops)',
    'public.admin_chat_phone_title_search|CREATE INDEX admin_chat_phone_title_search ON public.proxy_requests USING gin (private.admin_chat_phone_title(category, form_data) gin_trgm_ops)',
    'public.admin_chat_profile_email_search|CREATE INDEX admin_chat_profile_email_search ON public.profiles USING gin (email gin_trgm_ops)',
    'public.admin_chat_profile_name_search|CREATE INDEX admin_chat_profile_name_search ON public.profiles USING gin (full_name gin_trgm_ops)'
  ]::text[] THEN
    RAISE EXCEPTION 'Applied Phone/search index contract mismatch: %', actual;
  END IF;
  IF has_function_privilege('anon','public.search_admin_chat(text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.search_admin_chat(text,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.search_admin_chat(text,text)','EXECUTE')
    OR NOT has_schema_privilege('service_role','private','USAGE') THEN
    RAISE EXCEPTION 'Search RPC access mismatch';
  END IF;
END $admin_chat_search_contract$;

-- Fresh read-only Host catalog capture. No Host RPC is invoked.
DO $host_authority_catalog_contract$
DECLARE actual text[]; fingerprint text;
BEGIN
  SELECT array_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')|'||pg_get_userbyid(p.proowner)||'|'||p.prosecdef::text||'|'||p.provolatile::text||'|'||pg_get_function_result(p.oid)||'|'||array_to_string(p.proconfig,',')||'|'||p.proacl::text||'|'||md5(p.prosrc) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) INTO actual FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.proname=ANY(ARRAY[
    'apply_host_profile_media_locators',
    'begin_host_profile_media_asset',
    'guard_host_profile_legacy_writer',
    'guard_host_profile_reference_zero_journal',
    'host_profile_auth_backup_references',
    'host_profile_auth_inventory',
    'host_profile_legacy_writes_frozen',
    'host_profile_migration_inventory',
    'lock_host_profile_owner',
    'sync_host_profile_assets',
    'verify_host_profile_media_asset'
  ]::text[]);
  IF actual IS DISTINCT FROM ARRAY[
    'private.apply_host_profile_media_locators(p_owner_id uuid, p_asset_id uuid, p_old_url text, p_references jsonb, p_rollback boolean)|postgres|true|v|boolean|search_path=""|{postgres=X/postgres,service_role=X/postgres}|7bddc050b8e1d1c0540826a6c2447e78',
    'private.guard_host_profile_legacy_writer()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|a3176ab9ae4815de66cdf233aa761873',
    'private.guard_host_profile_reference_zero_journal()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|b0f932b28c54d089481b34ea042bba32',
    'private.host_profile_auth_inventory()|postgres|true|s|jsonb|search_path=""|{postgres=X/postgres,service_role=X/postgres}|d26300dcd9398edf95085b24651f974c',
    'private.host_profile_legacy_writes_frozen()|postgres|true|s|boolean|search_path=""|{postgres=X/postgres,service_role=X/postgres}|2914a3f459392cb57fcdbc13d60ebd4c',
    'private.lock_host_profile_owner()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|4896928f1c3a68f56077a74e69c5b4db',
    'private.sync_host_profile_assets()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|37f1b19ef488d481795bf78114578849',
    'public.apply_host_profile_media_locators(p_owner_id uuid, p_asset_id uuid, p_old_url text, p_references jsonb, p_rollback boolean)|postgres|false|v|boolean|search_path=""|{postgres=X/postgres,service_role=X/postgres}|0b4adfa947f3528b61d02f01f38d5d4e',
    'public.begin_host_profile_media_asset(p_id uuid, p_owner_id uuid, p_key text, p_url text, p_sha256 text, p_size bigint, p_mime text, p_idempotency_key text)|postgres|false|v|media_assets|search_path=""|{postgres=X/postgres,service_role=X/postgres}|ef99f4c6e62e03bf4f75bd4545cb7c5c',
    'public.host_profile_auth_backup_references()|postgres|false|s|jsonb|search_path=""|{postgres=X/postgres,service_role=X/postgres}|80ff8e6c33dc9d5e9e371f6754c27979',
    'public.host_profile_migration_inventory()|postgres|false|s|jsonb|search_path=""|{postgres=X/postgres,service_role=X/postgres}|15801981a0fbc87d7dbeeb1eb95bcf92',
    'public.verify_host_profile_media_asset(p_id uuid, p_owner_id uuid, p_sha256 text, p_size bigint, p_mime text)|postgres|false|v|media_assets|search_path=""|{postgres=X/postgres,service_role=X/postgres}|d5c1d6a913d1af3f3868abf49cd7987a'
  ]::text[] THEN
    RAISE EXCEPTION 'Host function body or ACL mismatch: %', actual;
  END IF;
  SELECT array_agg(n.nspname||'.'||c.relname||'|'||pg_get_userbyid(c.relowner)||'|'||c.relrowsecurity::text||'|'||c.relforcerowsecurity::text||'|'||c.relacl::text ORDER BY c.relname) INTO actual FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relkind='r' AND c.relname LIKE 'host_profile%';
  IF actual IS DISTINCT FROM ARRAY[
    'private.host_profile_auth_cas|postgres|false|false|{postgres=arwdDxtm/postgres}',
    'private.host_profile_operation_context|postgres|false|false|{postgres=arwdDxtm/postgres}',
    'private.host_profile_source_authority|postgres|false|false|{postgres=arwdDxtm/postgres}'
  ]::text[] THEN
    RAISE EXCEPTION 'Host private table security mismatch: %', actual;
  END IF;
  SELECT array_agg(c.relname||'|'||a.attname||'|'||format_type(a.atttypid,a.atttypmod)||'|'||a.attnotnull::text||'|'||coalesce(pg_get_expr(d.adbin,d.adrelid),'') ORDER BY c.relname,a.attnum) INTO actual FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='private' AND c.relkind='r' AND c.relname LIKE 'host_profile%' AND a.attnum>0 AND NOT a.attisdropped;
  IF actual IS DISTINCT FROM ARRAY[
    'host_profile_auth_cas|asset_id|uuid|true|',
    'host_profile_auth_cas|owner_id|uuid|true|',
    'host_profile_auth_cas|before_digest|text|true|',
    'host_profile_auth_cas|after_digest|text|true|',
    'host_profile_operation_context|backend_id|integer|true|',
    'host_profile_operation_context|transaction_id|bigint|true|',
    'host_profile_operation_context|owner_id|uuid|false|',
    'host_profile_operation_context|legacy_url|text|false|',
    'host_profile_source_authority|singleton|boolean|true|',
    'host_profile_source_authority|r2_enabled|boolean|true|false'
  ]::text[] THEN
    RAISE EXCEPTION 'Host column mismatch: %', actual;
  END IF;
  SELECT array_agg(n.nspname||'.'||c.relname||'|'||k.conname||'|'||pg_get_constraintdef(k.oid,true) ORDER BY n.nspname,c.relname,k.conname) INTO actual FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='private' AND c.relname LIKE 'host_profile%') OR k.conname='host_profile_media_identity';
  IF actual IS DISTINCT FROM ARRAY[
    'private.host_profile_auth_cas|host_profile_auth_cas_after_digest_check|CHECK (after_digest ~ ''^[a-f0-9]{64}$''::text)',
    'private.host_profile_auth_cas|host_profile_auth_cas_asset_id_fkey|FOREIGN KEY (asset_id) REFERENCES media_assets(id)',
    'private.host_profile_auth_cas|host_profile_auth_cas_before_digest_check|CHECK (before_digest ~ ''^[a-f0-9]{64}$''::text)',
    'private.host_profile_auth_cas|host_profile_auth_cas_pkey|PRIMARY KEY (asset_id)',
    'private.host_profile_operation_context|host_profile_operation_context_pkey|PRIMARY KEY (backend_id, transaction_id)',
    'private.host_profile_source_authority|host_profile_source_authority_pkey|PRIMARY KEY (singleton)',
    'private.host_profile_source_authority|host_profile_source_authority_singleton_check|CHECK (singleton)',
    'public.media_assets|host_profile_media_identity|CHECK (business_scope <> ''host_profile''::text OR provider = ''r2''::text AND bucket = ''locally-public-host-profile-originals''::text AND parent_type = ''host_profile_owner''::text AND parent_id = owner_id::text AND expected_size <= 10485760 AND mime ~ ''^image/[a-z0-9][a-z0-9.+-]{0,79}$''::text AND (mime <> ALL (ARRAY[''image/heic''::text, ''image/heif''::text])) AND object_key = ((((''host-profiles/v1/''::text || encode(sha256(convert_to(''host-profile-media-owner:''::text || owner_id::text, ''UTF8''::name)), ''hex''::text)) || ''/''::text) || id::text) || ''/profile''::text) AND public_url = (''https://host-profile-media.locally-travel.com/''::text || object_key) AND public_url IS NOT NULL)'
  ]::text[] THEN
    RAISE EXCEPTION 'Host constraint mismatch: %', actual;
  END IF;
  SELECT array_agg(x.schemaname||'.'||x.indexname||'|'||x.indexdef ORDER BY x.schemaname,x.indexname) INTO actual FROM pg_indexes x JOIN pg_namespace n ON n.nspname=x.schemaname JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=x.indexname JOIN pg_index i ON i.indexrelid=c.oid WHERE x.schemaname='private' AND x.tablename LIKE 'host_profile%' AND i.indisvalid AND i.indisready;
  IF actual IS DISTINCT FROM ARRAY[
    'private.host_profile_auth_cas_pkey|CREATE UNIQUE INDEX host_profile_auth_cas_pkey ON private.host_profile_auth_cas USING btree (asset_id)',
    'private.host_profile_operation_context_pkey|CREATE UNIQUE INDEX host_profile_operation_context_pkey ON private.host_profile_operation_context USING btree (backend_id, transaction_id)',
    'private.host_profile_source_authority_pkey|CREATE UNIQUE INDEX host_profile_source_authority_pkey ON private.host_profile_source_authority USING btree (singleton)'
  ]::text[] THEN
    RAISE EXCEPTION 'Host index mismatch: %', actual;
  END IF;
  SELECT array_agg(n.nspname||'.'||c.relname||'|'||t.tgname||'|'||pg_get_triggerdef(t.oid,true)||'|'||t.tgenabled::text ORDER BY n.nspname,c.relname,t.tgname) INTO actual FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal AND p.proname=ANY(ARRAY[
    'apply_host_profile_media_locators',
    'begin_host_profile_media_asset',
    'guard_host_profile_legacy_writer',
    'guard_host_profile_reference_zero_journal',
    'host_profile_auth_backup_references',
    'host_profile_auth_inventory',
    'host_profile_legacy_writes_frozen',
    'host_profile_migration_inventory',
    'lock_host_profile_owner',
    'sync_host_profile_assets',
    'verify_host_profile_media_asset'
  ]::text[]);
  IF actual IS DISTINCT FROM ARRAY[
    'auth.users|a_auth_host_profile_owner_lock|CREATE TRIGGER a_auth_host_profile_owner_lock BEFORE DELETE OR UPDATE OF raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION private.lock_host_profile_owner()|O',
    'auth.users|auth_host_profile_delete_plan|CREATE TRIGGER auth_host_profile_delete_plan BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets()|O',
    'auth.users|auth_host_profile_finalize|CREATE TRIGGER auth_host_profile_finalize AFTER UPDATE OF raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets()|O',
    'auth.users|b_auth_legacy_host_writer|CREATE TRIGGER b_auth_legacy_host_writer BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION private.guard_host_profile_legacy_writer()|O',
    'public.host_applications|a_host_profile_owner_lock|CREATE TRIGGER a_host_profile_owner_lock BEFORE INSERT OR DELETE OR UPDATE OF profile_photo, user_id, id ON host_applications FOR EACH ROW EXECUTE FUNCTION private.lock_host_profile_owner()|O',
    'public.host_applications|b_host_profile_legacy_writer|CREATE TRIGGER b_host_profile_legacy_writer BEFORE INSERT OR UPDATE OF profile_photo ON host_applications FOR EACH ROW EXECUTE FUNCTION private.guard_host_profile_legacy_writer()|O',
    'public.host_applications|host_profile_delete_plan|CREATE TRIGGER host_profile_delete_plan BEFORE DELETE ON host_applications FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets()|O',
    'public.host_applications|host_profile_finalize|CREATE TRIGGER host_profile_finalize AFTER INSERT OR UPDATE OF profile_photo, user_id, id ON host_applications FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets()|O',
    'public.media_deletion_journal|host_profile_reference_zero_journal|CREATE TRIGGER host_profile_reference_zero_journal BEFORE INSERT ON media_deletion_journal FOR EACH ROW EXECUTE FUNCTION private.guard_host_profile_reference_zero_journal()|O',
    'public.profiles|b_profile_legacy_host_writer|CREATE TRIGGER b_profile_legacy_host_writer BEFORE INSERT OR UPDATE OF avatar_url ON profiles FOR EACH ROW EXECUTE FUNCTION private.guard_host_profile_legacy_writer()|O',
    'public.profiles|legacy_host_profile_delete_plan|CREATE TRIGGER legacy_host_profile_delete_plan BEFORE DELETE ON profiles FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets()|O',
    'public.profiles|legacy_host_profile_finalize|CREATE TRIGGER legacy_host_profile_finalize AFTER INSERT OR UPDATE OF avatar_url, id ON profiles FOR EACH ROW EXECUTE FUNCTION private.sync_host_profile_assets()|O',
    'storage.objects|host_profile_legacy_storage_writer|CREATE TRIGGER host_profile_legacy_storage_writer BEFORE INSERT OR DELETE OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION private.guard_host_profile_legacy_writer()|O'
  ]::text[] THEN
    RAISE EXCEPTION 'Host trigger mismatch: %', actual;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='private' AND tablename LIKE 'host_profile%') THEN RAISE EXCEPTION 'Host private policy mismatch'; END IF;
END $host_authority_catalog_contract$;

-- Recency catalog only: never call conversation/business mutation RPCs.
DO $admin_chat_recency_catalog_contract$
DECLARE actual text[]; index_evidence text;
BEGIN
  SELECT array_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')|'||pg_get_userbyid(p.proowner)||'|'||p.prosecdef::text||'|'||p.provolatile::text||'|'||pg_get_function_result(p.oid)||'|'||array_to_string(p.proconfig,',')||'|'||p.proacl::text||'|'||md5(p.prosrc) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) INTO actual FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('list_admin_phone_recency','list_admin_support_recency');
  IF actual IS DISTINCT FROM ARRAY[
    'public.list_admin_phone_recency(p_offset integer, p_limit integer)|postgres|false|s|TABLE(id text, canonical_activity_at timestamp with time zone)|search_path=""|{postgres=X/postgres,service_role=X/postgres}|6a9eab43297fba3cd0e7fc2ead26a81b',
    'public.list_admin_support_recency(p_offset integer, p_limit integer, p_status text, p_inquiry_ids bigint[])|postgres|false|s|TABLE(id text, canonical_activity_at timestamp with time zone)|search_path=""|{postgres=X/postgres,service_role=X/postgres}|3308789e8be20187e8cd7215daf33f6d'
  ]::text[] THEN RAISE EXCEPTION 'Recency function body or ACL mismatch: %', actual; END IF;
  SELECT pg_get_indexdef(c.oid)||'|'||pg_get_expr(i.indpred,i.indrelid)||'|'||i.indisvalid::text||'|'||i.indisready::text||'|'||i.indisunique::text||'|'||i.indisprimary::text INTO index_evidence FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index i ON i.indexrelid=c.oid WHERE n.nspname='public' AND c.relname='admin_chat_visible_message_recency';
  IF index_evidence IS DISTINCT FROM 'CREATE INDEX admin_chat_visible_message_recency ON public.inquiry_messages USING btree (inquiry_id, created_at DESC, id DESC) WHERE (COALESCE(type, ''text''::text) = ANY (ARRAY[''text''::text, ''image''::text]))|(COALESCE(type, ''text''::text) = ANY (ARRAY[''text''::text, ''image''::text]))|true|true|false|false' THEN RAISE EXCEPTION 'Recency index mismatch: %', index_evidence; END IF;
END $admin_chat_recency_catalog_contract$;

DO $community_authority_catalog_contract$
DECLARE actual jsonb;
BEGIN
SELECT jsonb_build_object('observedAt',now(),'functions',(SELECT jsonb_agg(jsonb_build_object('identity',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'volatility',p.provolatile,'result',pg_get_function_result(p.oid),'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5',md5(p.prosrc)) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.proname LIKE '%community%' AND p.proname <> 'increment_community_post_view_count'),
'constraints',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid,true)) ORDER BY n.nspname,c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='private' AND c.relname LIKE 'community_media%') OR k.conname='community_media_identity'),
'triggers',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal AND p.proname LIKE '%community%' AND p.proname <> 'increment_community_post_view_count'),
'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forced',c.relforcerowsecurity,'acl',c.relacl::text) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relname LIKE 'community_media%' AND c.relkind='r'),
'columns',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',coalesce(pg_get_expr(d.adbin,d.adrelid),'')) ORDER BY n.nspname,c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE ((n.nspname='private' AND c.relname LIKE 'community_media%') OR (n.nspname='public' AND c.relname='community_posts' AND a.attname='media_revision')) AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),
'indexes',(SELECT jsonb_agg(jsonb_build_object('schema',schemaname,'name',indexname,'definition',indexdef) ORDER BY schemaname,indexname) FROM pg_indexes WHERE schemaname='private' AND tablename LIKE 'community_media%'),
'publicFunctionOverloads',(SELECT jsonb_agg(format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'),
'privateFunctionOverloads',(SELECT jsonb_agg(format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.prokind='f'),
'counts',jsonb_build_object('publicColumns',(SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),'privateColumns',(SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),'publicConstraints',(SELECT count(*) FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname='public'),'privateConstraints',(SELECT count(*) FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname='private'),'publicIndexes',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i'),'privateIndexes',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relkind='i')),
'privateGrantsFingerprint',(SELECT md5(string_agg(n.nspname||'|'||c.relname||'|'||c.relkind::text||'|'||CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END||'|'||a.privilege_type||'|'||a.is_grantable::text,E'\n' ORDER BY n.nspname,c.relname,c.relkind::text,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='private' AND c.relkind IN ('r','p','v','m','f'))) INTO actual;
  actual := actual - ARRAY['observedAt','ledger','authority','publicFunctionOverloads','privateFunctionOverloads','counts','privateGrantsFingerprint'];
  IF actual IS DISTINCT FROM '{"functions":[{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"boolean","bodyMd5":"b10a9930dda2b12286313ee3253df729","identity":"private.apply_community_media_locators(p_plan_digest text, p_assets jsonb, p_posts jsonb, p_rollback boolean)","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"jsonb","bodyMd5":"0c826dfc1f07f7030c87bbedd6cfa6c1","identity":"private.commit_community_post_images(p_actor_id uuid, p_post_id uuid, p_expected_revision bigint, p_expected_images text[], p_images text[])","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"jsonb","bodyMd5":"31e3ce94bb542850fa8497455b3b66e8","identity":"private.community_media_backup_contract()","volatility":"s","configuration":["search_path=\"\""],"securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"jsonb","bodyMd5":"ded8e352ea1fa10818b2056989623db1","identity":"private.community_media_migration_inventory()","volatility":"s","configuration":["search_path=\"\""],"securityDefiner":true},{"acl":"{postgres=X/postgres}","owner":"postgres","result":"trigger","bodyMd5":"fe7c590322943e625a11a41ca1651eee","identity":"private.guard_community_asset_identity()","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":true},{"acl":"{postgres=X/postgres}","owner":"postgres","result":"trigger","bodyMd5":"6000e9486a951caa7ea77c8e18c1ee50","identity":"private.guard_community_media_writer()","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":true},{"acl":"{postgres=X/postgres}","owner":"postgres","result":"trigger","bodyMd5":"e2b9ee3c13d2f7b04780f72415209ded","identity":"private.guard_community_physical_delete()","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":true},{"acl":"{postgres=X/postgres}","owner":"postgres","result":"trigger","bodyMd5":"c2dab573dca332131e2f28afdd6ae99c","identity":"private.guard_community_reference_zero_journal()","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"boolean","bodyMd5":"e9f05193e92e93b2804969dd52641e63","identity":"private.set_community_legacy_writer_freeze(p_frozen boolean, p_smoke_asset_id uuid, p_sha256 text)","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":true},{"acl":"{postgres=X/postgres}","owner":"postgres","result":"trigger","bodyMd5":"f3e9080a1b6efc3aba4008bc2f18cc6b","identity":"private.sync_community_media_assets()","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"boolean","bodyMd5":"d15ee5cbbf09013f6f7cdac684c6b9cf","identity":"public.apply_community_media_locators(p_plan_digest text, p_assets jsonb, p_posts jsonb, p_rollback boolean)","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":false},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"media_assets","bodyMd5":"fad0aef82c25fdd1b02d5b90067def77","identity":"public.begin_community_media_asset(p_id uuid, p_owner_id uuid, p_key text, p_url text, p_sha256 text, p_size bigint, p_mime text, p_idempotency_key text)","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":false},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"jsonb","bodyMd5":"d43440ceb88aad5f42214ebce11d0f27","identity":"public.commit_community_post_images(p_actor_id uuid, p_post_id uuid, p_expected_revision bigint, p_expected_images text[], p_images text[])","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":false},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"jsonb","bodyMd5":"297e5d7f6e79ac13457906b60710a6cf","identity":"public.community_media_backup_contract()","volatility":"s","configuration":["search_path=\"\""],"securityDefiner":false},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"jsonb","bodyMd5":"17459653a37630c9c4e9960546be2aa2","identity":"public.community_media_migration_inventory()","volatility":"s","configuration":["search_path=\"\""],"securityDefiner":false},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"media_assets","bodyMd5":"18f96bb18e88c707f154021e4eaf8701","identity":"public.mark_community_media_uploaded(p_id uuid, p_owner_id uuid, p_sha256 text, p_size bigint, p_mime text)","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":false},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"boolean","bodyMd5":"24cdde0fff781c1bca4bee566216b9b9","identity":"public.set_community_legacy_writer_freeze(p_frozen boolean, p_smoke_asset_id uuid, p_sha256 text)","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":false},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","result":"media_assets","bodyMd5":"ea2fc4f39dbb90497a7335d228e9e773","identity":"public.verify_community_media_asset(p_id uuid, p_owner_id uuid, p_sha256 text, p_size bigint, p_mime text)","volatility":"v","configuration":["search_path=\"\""],"securityDefiner":false}],"constraints":[{"name":"community_media_authority_pkey","table":"community_media_authority","schema":"private","definition":"PRIMARY KEY (singleton)"},{"name":"community_media_authority_singleton_check","table":"community_media_authority","schema":"private","definition":"CHECK (singleton)"},{"name":"community_media_context_pkey","table":"community_media_context","schema":"private","definition":"PRIMARY KEY (backend_id, transaction_id, post_id)"},{"name":"community_media_plan_receipts_pkey","table":"community_media_plan_receipts","schema":"private","definition":"PRIMARY KEY (plan_digest)"},{"name":"community_media_plan_receipts_plan_digest_check","table":"community_media_plan_receipts","schema":"private","definition":"CHECK (plan_digest ~ ''^[a-f0-9]{64}$''::text)"},{"name":"community_media_plan_receipts_state_check","table":"community_media_plan_receipts","schema":"private","definition":"CHECK (state = ANY (ARRAY[''applied''::text, ''rolled_back''::text]))"},{"name":"community_media_identity","table":"media_assets","schema":"public","definition":"CHECK (business_scope <> ''community''::text OR provider = ''r2''::text AND bucket = ''locally-public-community-originals''::text AND parent_type = ''community_owner''::text AND parent_id = owner_id::text AND expected_size <= 10485760 AND (mime = ANY (ARRAY[''image/jpeg''::text, ''image/png''::text, ''image/webp''::text, ''image/gif''::text, ''image/avif''::text])) AND object_key = ((((''community/v1/''::text || encode(sha256(convert_to(''community-media-owner:''::text || owner_id::text, ''UTF8''::name)), ''hex''::text)) || ''/''::text) || id::text) || ''/image''::text) AND public_url = (''https://community-media.locally-travel.com/''::text || object_key) AND public_url IS NOT NULL AND deleted_at IS NULL)"}],"triggers":[{"name":"a_community_media_writer","table":"community_posts","schema":"public","enabled":"O","definition":"CREATE TRIGGER a_community_media_writer BEFORE INSERT OR UPDATE ON community_posts FOR EACH ROW EXECUTE FUNCTION private.guard_community_media_writer()"},{"name":"community_media_delete_plan","table":"community_posts","schema":"public","enabled":"O","definition":"CREATE TRIGGER community_media_delete_plan BEFORE DELETE ON community_posts FOR EACH ROW EXECUTE FUNCTION private.sync_community_media_assets()"},{"name":"community_media_finalize","table":"community_posts","schema":"public","enabled":"O","definition":"CREATE TRIGGER community_media_finalize AFTER INSERT OR UPDATE OF images ON community_posts FOR EACH ROW EXECUTE FUNCTION private.sync_community_media_assets()"},{"name":"community_asset_identity_immutable","table":"media_assets","schema":"public","enabled":"O","definition":"CREATE TRIGGER community_asset_identity_immutable BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION private.guard_community_asset_identity()"},{"name":"community_physical_delete_disabled","table":"media_deletion_journal","schema":"public","enabled":"O","definition":"CREATE TRIGGER community_physical_delete_disabled BEFORE INSERT OR UPDATE ON media_deletion_journal FOR EACH ROW EXECUTE FUNCTION private.guard_community_physical_delete()"},{"name":"community_reference_zero_journal","table":"media_deletion_journal","schema":"public","enabled":"O","definition":"CREATE TRIGGER community_reference_zero_journal BEFORE INSERT ON media_deletion_journal FOR EACH ROW EXECUTE FUNCTION private.guard_community_reference_zero_journal()"},{"name":"community_legacy_storage_writer","table":"objects","schema":"storage","enabled":"O","definition":"CREATE TRIGGER community_legacy_storage_writer BEFORE INSERT OR DELETE OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION private.guard_community_media_writer()"}],"tables":[{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"community_media_authority","owner":"postgres","forced":false,"schema":"private"},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"community_media_context","owner":"postgres","forced":false,"schema":"private"},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"community_media_plan_receipts","owner":"postgres","forced":false,"schema":"private"}],"columns":[{"name":"singleton","type":"boolean","table":"community_media_authority","schema":"private","default":"true","notNull":true},{"name":"legacy_writes_frozen","type":"boolean","table":"community_media_authority","schema":"private","default":"false","notNull":true},{"name":"backend_id","type":"integer","table":"community_media_context","schema":"private","default":"","notNull":true},{"name":"transaction_id","type":"bigint","table":"community_media_context","schema":"private","default":"","notNull":true},{"name":"post_id","type":"uuid","table":"community_media_context","schema":"private","default":"","notNull":true},{"name":"rollback","type":"boolean","table":"community_media_context","schema":"private","default":"false","notNull":true},{"name":"plan_digest","type":"text","table":"community_media_plan_receipts","schema":"private","default":"","notNull":true},{"name":"payload","type":"jsonb","table":"community_media_plan_receipts","schema":"private","default":"","notNull":true},{"name":"state","type":"text","table":"community_media_plan_receipts","schema":"private","default":"","notNull":true},{"name":"created_at","type":"timestamp with time zone","table":"community_media_plan_receipts","schema":"private","default":"now()","notNull":true},{"name":"media_revision","type":"bigint","table":"community_posts","schema":"public","default":"0","notNull":true}],"indexes":[{"name":"community_media_authority_pkey","schema":"private","definition":"CREATE UNIQUE INDEX community_media_authority_pkey ON private.community_media_authority USING btree (singleton)"},{"name":"community_media_context_pkey","schema":"private","definition":"CREATE UNIQUE INDEX community_media_context_pkey ON private.community_media_context USING btree (backend_id, transaction_id, post_id)"},{"name":"community_media_plan_receipts_pkey","schema":"private","definition":"CREATE UNIQUE INDEX community_media_plan_receipts_pkey ON private.community_media_plan_receipts USING btree (plan_digest)"}]}'::jsonb THEN RAISE EXCEPTION 'Community catalog security or definition mismatch'; END IF;
END $community_authority_catalog_contract$;

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

-- Applied Monitor catalog only; no business mutation RPC calls.
DO $admin_monitor_recency_catalog_contract$
DECLARE actual text[];
BEGIN
  SELECT array_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')|'||pg_get_userbyid(p.proowner)||'|'||p.prosecdef::text||'|'||p.provolatile::text||'|'||pg_get_function_result(p.oid)||'|'||array_to_string(p.proconfig,',')||'|'||p.proacl::text||'|'||md5(p.prosrc) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) INTO actual FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='list_admin_monitor_recency';
  IF actual IS DISTINCT FROM ARRAY['public.list_admin_monitor_recency(p_offset integer, p_limit integer, p_inquiry_ids bigint[])|postgres|false|s|TABLE(id text, canonical_activity_at timestamp with time zone)|search_path=""|{postgres=X/postgres,service_role=X/postgres}|caea0b27c619d17e52f6feccf22cbfa2']::text[] THEN RAISE EXCEPTION 'Monitor function body or ACL mismatch'; END IF;
END $admin_monitor_recency_catalog_contract$;

SELECT 'LOCALLY_STAGING_SCHEMA_CONTRACT_PASS' AS result;

ROLLBACK;
