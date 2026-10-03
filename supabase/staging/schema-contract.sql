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
    WHERE n.nspname = 'private' AND relkind IN ('r','p') AND c.relname <> 'phone_followup_tasks';
  IF actual IS DISTINCT FROM ARRAY['admin_monitor_cutover']::text[] THEN RAISE EXCEPTION 'Private table inventory mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'private') THEN RAISE EXCEPTION 'Private cutover policy exists'; END IF;
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
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname = 'private' AND c.relkind IN ('r','p','v','m','f') AND c.relname <> 'phone_followup_tasks';
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
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='private' AND c.relkind IN ('r','p','v','m','f');
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

SELECT 'LOCALLY_STAGING_SCHEMA_CONTRACT_PASS' AS result;

ROLLBACK;
