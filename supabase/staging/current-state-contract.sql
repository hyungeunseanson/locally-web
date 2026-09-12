\set ON_ERROR_STOP on

BEGIN READ ONLY;

DO $current_state_contract$
DECLARE
  actual text[];
  expected text[];
  actual_count bigint;
  primary_key_count bigint;
  foreign_key_count bigint;
  unique_count bigint;
  check_count bigint;
  actual_fingerprint text;
BEGIN
  SELECT array_agg(version || ':' || name ORDER BY version)
    INTO actual
    FROM supabase_migrations.schema_migrations;
  expected := ARRAY[
    '20260912034545:remote_schema',
    '20260912050655:service_concierge_assignment'
  ]::text[];
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'migration ledger mismatch: %', actual;
  END IF;

  SELECT array_agg(class_def.relname ORDER BY class_def.relname)
    INTO actual
    FROM pg_class AS class_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
   WHERE namespace_def.nspname = 'public' AND class_def.relkind IN ('r', 'p');
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
    'service_assignment_history', 'service_bookings', 'service_refund_operations',
    'service_request_schedule_items', 'service_requests', 'translation_provider_state',
    'users', 'wishlists'
  ]::text[];
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'public table inventory mismatch: %', actual;
  END IF;

  SELECT count(*)
    INTO actual_count
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = ANY (expected);
  IF actual_count <> 510 THEN
    RAISE EXCEPTION 'public table column count %, expected 510', actual_count;
  END IF;

  SELECT array_agg(class_def.relname ORDER BY class_def.relname)
    INTO actual
    FROM pg_class AS class_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
   WHERE namespace_def.nspname = 'public' AND class_def.relkind IN ('v', 'm');
  expected := ARRAY['public_host_applications', 'public_profiles']::text[];
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'public view inventory mismatch: %', actual;
  END IF;

  SELECT count(*)
    INTO actual_count
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = ANY (expected);
  IF actual_count <> 27 THEN
    RAISE EXCEPTION 'public view column count %, expected 27', actual_count;
  END IF;

  SELECT array_agg(
           format('public.%I(%s)', procedure_def.proname,
                  pg_get_function_identity_arguments(procedure_def.oid))
           ORDER BY procedure_def.proname,
                    pg_get_function_identity_arguments(procedure_def.oid)
         )
    INTO actual
    FROM pg_proc AS procedure_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = procedure_def.pronamespace
   WHERE namespace_def.nspname = 'public';
  expected := ARRAY[
    'public.assign_service_concierge_host_atomic(p_admin_id uuid, p_request_id uuid, p_host_id uuid, p_host_hourly_rate integer, p_host_agreement_confirmed boolean)',
    'public.begin_service_refund_operation_atomic(p_admin_id uuid, p_order_id text, p_refund_amount integer, p_host_compensation_amount integer, p_idempotency_key text)',
    'public.cancel_pending_service_concierge_atomic(p_actor_id uuid, p_order_id text, p_cancel_reason text)',
    'public.check_rate_limit(table_name text, seconds integer)',
    'public.claim_due_admin_support_unread_alert_batches(p_limit integer)',
    'public.complete_admin_manual_experience_payout_atomic(p_request_key uuid, p_host_id uuid, p_settlement_type text, p_expected_current_booking_amount integer, p_legacy_amount integer, p_reason text, p_legacy_source_reference text, p_transfer_reference text, p_paid_by_admin_id uuid, p_paid_by_admin_email text)',
    'public.complete_experience_booking_if_due_atomic(p_booking_id text)',
    'public.complete_service_booking_if_due_atomic(p_booking_id text)',
    'public.complete_service_concierge_booking_if_due_atomic(p_booking_id text)',
    'public.confirm_service_bank_payment_atomic(p_order_id text)',
    'public.confirm_service_concierge_payment_atomic(p_order_id text, p_payment_method text, p_tid text)',
    'public.create_booking_atomic(p_user_id uuid, p_experience_id text, p_date text, p_time text, p_guests integer, p_is_private boolean, p_customer_name text, p_customer_phone text, p_payment_method text, p_is_solo_guarantee boolean)',
    'public.create_guest_review_with_notification_atomic(p_booking_id text, p_host_id uuid, p_rating integer, p_content text, p_notification_title text, p_notification_message text)',
    'public.create_service_booking_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid, p_contact_name text, p_contact_phone text)',
    'public.create_service_concierge_request_atomic(p_user_id uuid, p_service_type text, p_description text, p_city text, p_schedule jsonb, p_languages text[], p_guest_count integer, p_contact_name text, p_contact_phone text, p_client_request_key text)',
    'public.create_service_request_with_booking_atomic(p_user_id uuid, p_title text, p_description text, p_city text, p_country text, p_service_date date, p_start_time text, p_duration_hours integer, p_languages text[], p_guest_count integer, p_contact_name text, p_contact_phone text)',
    'public.decrement_comment_count()',
    'public.decrement_like_count()',
    'public.ensure_profile_demographics_reminder(p_user_id uuid, p_title text, p_message text, p_link text)',
    'public.finish_service_refund_operation_atomic(p_operation_id uuid, p_outcome text, p_provider_reference text, p_error_message text)',
    'public.get_experience_completion_due_backlog()',
    'public.handle_new_user()',
    'public.increment_comment_count()',
    'public.increment_community_post_view_count(p_post_id uuid)',
    'public.increment_like_count()',
    'public.is_admin_reader()',
    'public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone, p_lease_seconds integer)',
    'public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone, p_lease_seconds integer, p_reserved_tokens integer)',
    'public.list_due_experience_completion_candidates(p_booking_id text)',
    'public.mark_room_messages_read(p_room_id uuid, p_user_id uuid)',
    'public.prune_notifications_retention(p_cutoff timestamp with time zone, p_batch_size integer)',
    'public.prune_team_workspace_comments(p_task_id uuid, p_keep_limit integer)',
    'public.prune_team_workspace_tasks(p_keep_limit integer)',
    'public.record_translation_provider_outcome(p_provider text, p_token_count integer, p_cooldown_seconds integer, p_hit_quota boolean)',
    'public.record_translation_provider_outcome(p_provider text, p_token_count integer, p_cooldown_seconds integer, p_hit_quota boolean, p_reserved_token_count integer)',
    'public.refresh_experience_popularity_snapshot()',
    'public.request_service_cancellation_review_atomic(p_actor_id uuid, p_order_id text, p_cancel_reason text)',
    'public.select_service_host_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid)',
    'public.set_proxy_comments_updated_at()',
    'public.set_proxy_requests_updated_at()',
    'public.set_service_applications_updated_at()',
    'public.set_service_bookings_updated_at()',
    'public.set_service_requests_updated_at()',
    'public.snapshot_booking_guest_demographics()'
  ]::text[];
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'public function overload inventory mismatch: %', actual;
  END IF;

  SELECT array_agg(
           format('%I.%I.%I', namespace_def.nspname, class_def.relname, trigger_def.tgname)
           ORDER BY namespace_def.nspname, class_def.relname, trigger_def.tgname
         )
    INTO actual
    FROM pg_trigger AS trigger_def
    JOIN pg_class AS class_def ON class_def.oid = trigger_def.tgrelid
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
   WHERE NOT trigger_def.tgisinternal AND namespace_def.nspname IN ('public', 'auth');
  expected := ARRAY[
    'auth.users.on_auth_user_created',
    'public.bookings.set_booking_guest_demographics_snapshot',
    'public.community_comments.on_comment_added',
    'public.community_comments.on_comment_removed',
    'public.community_likes.on_like_added',
    'public.community_likes.on_like_removed',
    'public.proxy_comments.trg_pc_updated_at',
    'public.proxy_requests.trg_pr_updated_at',
    'public.service_applications.trg_sa_updated_at',
    'public.service_bookings.trg_sb_updated_at',
    'public.service_requests.trg_sr_updated_at'
  ]::text[];
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'application trigger inventory mismatch: %', actual;
  END IF;

  SELECT count(*) INTO actual_count FROM pg_indexes WHERE schemaname = 'public';
  IF actual_count <> 113 THEN
    RAISE EXCEPTION 'public index count %, expected 113', actual_count;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE constraint_def.contype = 'p'),
         count(*) FILTER (WHERE constraint_def.contype = 'f'),
         count(*) FILTER (WHERE constraint_def.contype = 'u'),
         count(*) FILTER (WHERE constraint_def.contype = 'c')
    INTO actual_count, primary_key_count, foreign_key_count, unique_count, check_count
    FROM pg_constraint AS constraint_def
    JOIN pg_class AS class_def ON class_def.oid = constraint_def.conrelid
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
   WHERE namespace_def.nspname = 'public';
  IF actual_count <> 179 OR primary_key_count <> 39 OR foreign_key_count <> 59
     OR unique_count <> 14 OR check_count <> 67 THEN
    RAISE EXCEPTION 'constraint counts differ: total %, PK %, FK %, UNIQUE %, CHECK %',
      actual_count, primary_key_count, foreign_key_count, unique_count, check_count;
  END IF;

  SELECT array_agg(class_def.relname ORDER BY class_def.relname)
    INTO actual
    FROM pg_class AS class_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
   WHERE namespace_def.nspname = 'public'
     AND class_def.relkind IN ('r', 'p')
     AND class_def.relrowsecurity;
  expected := ARRAY[
    'admin_audit_logs', 'admin_manual_payouts', 'admin_task_comments', 'admin_tasks',
    'admin_whitelist', 'analytics_events', 'bookings', 'community_comments',
    'community_likes', 'community_posts', 'experience_availability',
    'experience_popularity_snapshot', 'experience_translation_jobs',
    'experience_translation_tasks', 'experiences', 'guest_reviews',
    'host_applications', 'inquiries', 'inquiry_messages', 'likes', 'messages',
    'notifications', 'profile_private_demographics', 'profiles', 'proxy_comments',
    'proxy_requests', 'reviews', 'search_logs', 'service_applications',
    'service_assignment_history', 'service_bookings', 'service_refund_operations',
    'service_request_schedule_items', 'service_requests', 'translation_provider_state',
    'users', 'wishlists'
  ]::text[];
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'RLS-enabled table inventory mismatch: %', actual;
  END IF;

  SELECT array_agg(class_def.relname ORDER BY class_def.relname)
    INTO actual
    FROM pg_class AS class_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
   WHERE namespace_def.nspname = 'public'
     AND class_def.relkind IN ('r', 'p')
     AND NOT class_def.relrowsecurity;
  IF actual IS DISTINCT FROM ARRAY[
    'admin_job_runs', 'admin_support_unread_alert_batches'
  ]::text[] THEN
    RAISE EXCEPTION 'RLS-disabled table inventory mismatch: %', actual;
  END IF;

  SELECT count(*) INTO actual_count
    FROM pg_class AS class_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
   WHERE namespace_def.nspname = 'public'
     AND class_def.relkind IN ('r', 'p')
     AND class_def.relforcerowsecurity;
  IF actual_count <> 0 THEN
    RAISE EXCEPTION 'FORCE RLS enabled on % public tables, expected 0', actual_count;
  END IF;

  SELECT count(*) INTO actual_count FROM pg_policies WHERE schemaname = 'public';
  IF actual_count <> 111 THEN
    RAISE EXCEPTION 'public RLS policy count %, expected 111', actual_count;
  END IF;

  SELECT md5(string_agg(
           policy_def.schemaname || '|' || policy_def.tablename || '|' ||
           policy_def.policyname || '|' || policy_def.permissive || '|' ||
           policy_def.cmd || '|' || array_to_string(policy_def.roles, ',') || '|' ||
           coalesce(policy_def.qual, '') || '|' || coalesce(policy_def.with_check, ''),
           E'\n' ORDER BY policy_def.schemaname, policy_def.tablename, policy_def.policyname
         ))
    INTO actual_fingerprint
    FROM pg_policies AS policy_def
   WHERE policy_def.schemaname = 'public';
  IF actual_fingerprint IS DISTINCT FROM '8e2720ce969cfa4252ec20069000fc4c' THEN
    RAISE EXCEPTION 'public RLS policy fingerprint mismatch: %', actual_fingerprint;
  END IF;

  SELECT md5(string_agg(
           namespace_def.nspname || '|' || class_def.relname || '|' ||
           class_def.relkind::text || '|' ||
           CASE WHEN acl_entry.grantee = 0
             THEN 'PUBLIC' ELSE pg_get_userbyid(acl_entry.grantee)
           END || '|' || acl_entry.privilege_type || '|' || acl_entry.is_grantable::text,
           E'\n' ORDER BY namespace_def.nspname, class_def.relname,
             class_def.relkind::text,
             CASE WHEN acl_entry.grantee = 0
               THEN 'PUBLIC' ELSE pg_get_userbyid(acl_entry.grantee)
             END,
             acl_entry.privilege_type, acl_entry.is_grantable
         ))
    INTO actual_fingerprint
    FROM pg_class AS class_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(
      class_def.relacl,
      acldefault('r', class_def.relowner)
    )) AS acl_entry
   WHERE namespace_def.nspname = 'public'
     AND class_def.relkind IN ('r', 'p', 'v', 'm', 'f');
  IF actual_fingerprint IS DISTINCT FROM '21aa717aae9fd797e1e51053688ddac3' THEN
    RAISE EXCEPTION 'public relation grant fingerprint mismatch: %', actual_fingerprint;
  END IF;

  SELECT array_agg(publication_def.tablename ORDER BY publication_def.tablename)
    INTO actual
    FROM pg_publication_tables AS publication_def
   WHERE publication_def.pubname = 'supabase_realtime'
     AND publication_def.schemaname = 'public';
  IF actual IS DISTINCT FROM ARRAY[
    'admin_audit_logs', 'admin_task_comments', 'admin_tasks', 'admin_whitelist',
    'inquiry_messages', 'notifications', 'profiles'
  ]::text[] THEN
    RAISE EXCEPTION 'supabase_realtime membership mismatch: %', actual;
  END IF;

  SELECT array_agg(
           bucket_def.id || '|' || bucket_def.public::text || '|' ||
             coalesce(bucket_def.file_size_limit::text, '')
           ORDER BY bucket_def.id
         )
    INTO actual
    FROM storage.buckets AS bucket_def;
  IF actual IS DISTINCT FROM ARRAY[
    'admin_files|true|10485760', 'avatars|true|', 'chat-images|true|',
    'experiences|true|', 'images|true|', 'verification-docs|false|'
  ]::text[] THEN
    RAISE EXCEPTION 'Storage bucket contract mismatch: %', actual;
  END IF;

  SELECT md5(string_agg(
           bucket_def.id || '|' || bucket_def.name || '|' || bucket_def.public::text || '|' ||
           coalesce(bucket_def.file_size_limit::text, '') || '|' ||
           coalesce(array_to_string(bucket_def.allowed_mime_types, ','), ''),
           E'\n' ORDER BY bucket_def.id
         ))
    INTO actual_fingerprint
    FROM storage.buckets AS bucket_def;
  IF actual_fingerprint IS DISTINCT FROM 'c3ff5767c8e4934ae05b3d96550441c8' THEN
    RAISE EXCEPTION 'Storage bucket fingerprint mismatch: %', actual_fingerprint;
  END IF;

  SELECT array_agg(policy_def.policyname ORDER BY policy_def.policyname)
    INTO actual
    FROM pg_policies AS policy_def
   WHERE policy_def.schemaname = 'storage' AND policy_def.tablename = 'objects';
  expected := ARRAY[
    'Anyone can update their own avatar',
    'Anyone can upload an avatar',
    'Auth Users Upload',
    'Authenticated Delete',
    'Authenticated Update',
    'Authenticated Upload',
    'Avatar images are publicly accessible',
    'Only admins can upload files',
    'Owner Delete',
    'Owner Update',
    'Public Access',
    'Verification docs owners can delete',
    'Verification docs owners can read',
    'Verification docs owners can update',
    'Verification docs owners can upload'
  ]::text[];
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Storage object policy inventory mismatch: %', actual;
  END IF;

  SELECT md5(string_agg(
           policy_def.schemaname || '|' || policy_def.tablename || '|' ||
           policy_def.policyname || '|' || policy_def.permissive || '|' ||
           policy_def.cmd || '|' || array_to_string(policy_def.roles, ',') || '|' ||
           coalesce(policy_def.qual, '') || '|' || coalesce(policy_def.with_check, ''),
           E'\n' ORDER BY policy_def.schemaname, policy_def.tablename, policy_def.policyname
         ))
    INTO actual_fingerprint
    FROM pg_policies AS policy_def
   WHERE policy_def.schemaname = 'storage' AND policy_def.tablename = 'objects';
  IF actual_fingerprint IS DISTINCT FROM '38c973a52a0bebe8fa78b3f53089e427' THEN
    RAISE EXCEPTION 'Storage policy fingerprint mismatch: %', actual_fingerprint;
  END IF;

  IF to_regclass('public.community_comment_likes') IS NOT NULL
     OR EXISTS (
       SELECT 1
         FROM pg_proc AS procedure_def
         JOIN pg_namespace AS namespace_def ON namespace_def.oid = procedure_def.pronamespace
        WHERE namespace_def.nspname = 'public'
          AND procedure_def.proname IN ('increment_comment_like_count', 'decrement_comment_like_count')
     )
     OR EXISTS (
       SELECT 1 FROM pg_trigger AS trigger_def
        WHERE NOT trigger_def.tgisinternal
          AND trigger_def.tgname IN ('on_comment_like_added', 'on_comment_like_removed')
     )
  THEN
    RAISE EXCEPTION 'retired community comment-like objects unexpectedly exist';
  END IF;
END
$current_state_contract$;

DO $concierge_security_contract$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(required_table.name ORDER BY required_table.name)
    INTO missing
    FROM unnest(ARRAY[
      'service_assignment_history',
      'service_refund_operations',
      'service_request_schedule_items'
    ]) AS required_table(name)
   WHERE NOT EXISTS (
     SELECT 1
       FROM pg_class AS class_def
       JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
      WHERE namespace_def.nspname = 'public'
        AND class_def.relname = required_table.name
        AND class_def.relkind IN ('r', 'p')
        AND class_def.relrowsecurity
        AND NOT class_def.relforcerowsecurity
   )
   OR EXISTS (
     SELECT 1 FROM pg_policies AS policy_def
      WHERE policy_def.schemaname = 'public' AND policy_def.tablename = required_table.name
   )
   OR EXISTS (
     SELECT 1
       FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS privilege_def(name)
      WHERE has_table_privilege('anon', format('public.%I', required_table.name), privilege_def.name)
         OR has_table_privilege('authenticated', format('public.%I', required_table.name), privilege_def.name)
   )
   OR EXISTS (
     SELECT 1
       FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS privilege_def(name)
      WHERE NOT has_table_privilege('service_role', format('public.%I', required_table.name), privilege_def.name)
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'concierge table RLS/grant contract mismatch: %', missing;
  END IF;

  SELECT array_agg(
           format('public.%I(%s)', procedure_def.proname,
                  pg_get_function_identity_arguments(procedure_def.oid))
           ORDER BY procedure_def.proname,
                    pg_get_function_identity_arguments(procedure_def.oid)
         )
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
     ]::text[])
     AND (
       NOT procedure_def.prosecdef
       OR NOT (coalesce(procedure_def.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[])
       OR has_function_privilege('anon', procedure_def.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', procedure_def.oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', procedure_def.oid, 'EXECUTE')
       OR EXISTS (
         SELECT 1
           FROM aclexplode(coalesce(
             procedure_def.proacl,
             acldefault('f', procedure_def.proowner)
           )) AS acl_entry
          WHERE acl_entry.grantee = 0 AND acl_entry.privilege_type = 'EXECUTE'
       )
     );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'concierge RPC security contract mismatch: %', missing;
  END IF;
END
$concierge_security_contract$;

SELECT 'LOCALLY_PRODUCTION_CURRENT_STATE_CONTRACT_PASS' AS result;

ROLLBACK;
