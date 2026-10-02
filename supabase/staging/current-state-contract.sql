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
    '20260912050655:service_concierge_assignment',
    '20260915141606:p0_storage_rpc_security_hardening',
    '20260916024355:experience_media_locator_cas',
    '20260916032730:experience_storage_lockdown',
    '20260916111416:review_tour_end_db_foundation',
    '20260916134243:review_direct_write_lockdown',
    '20260918000000:proxy_card_intake_atomic',
    '20260922081710:experience_payment_claim_and_pending_cleanup',
    '20260922125140:close_refunded_phone_proxy_requests',
    '20260923013312:ops_anomaly_monitor_snapshot',
    '20260923084232:one_time_review_request_reminders',
    '20260929144521:harden_public_host_applications_security_barrier',
    '20260930022348:move_is_admin_reader_to_private_schema',
    '20261002024534:admin_message_monitoring_phase_1',
    '20261002024638:admin_message_monitoring_historical_reinquiry',
    '20261002075149:admin_attention_badges_phase_2'
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
  IF actual_count <> 517 THEN
    RAISE EXCEPTION 'public table column count %, expected 517', actual_count;
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
    'public.ack_admin_inquiry_messages(p_inquiry_id bigint, p_through_message_id bigint)',
    'public.ack_admin_inquiry_snapshot(p_inquiry_id bigint, p_message_ids bigint[])',
    'public.apply_experience_media_locator_cas(p_experience_id bigint, p_before_photos text[], p_before_image_url text, p_before_itinerary jsonb, p_before_itinerary_i18n jsonb, p_after_photos text[], p_after_image_url text, p_after_itinerary jsonb, p_after_itinerary_i18n jsonb)',
    'public.assign_service_concierge_host_atomic(p_admin_id uuid, p_request_id uuid, p_host_id uuid, p_host_hourly_rate integer, p_host_agreement_confirmed boolean)',
    'public.attach_experience_payment_provider_reference_atomic(p_booking_id text, p_user_id uuid, p_provider_reference text, p_claim_token uuid)',
    'public.begin_experience_payment_capture_atomic(p_booking_id text, p_user_id uuid, p_provider_reference text)',
    'public.begin_service_refund_operation_atomic(p_admin_id uuid, p_order_id text, p_refund_amount integer, p_host_compensation_amount integer, p_idempotency_key text)',
    'public.cancel_expired_pending_bookings_atomic(p_batch_size integer)',
    'public.cancel_pending_service_concierge_atomic(p_actor_id uuid, p_order_id text, p_cancel_reason text)',
    'public.check_rate_limit(table_name text, seconds integer)',
    'public.claim_due_admin_support_unread_alert_batches(p_limit integer)',
    'public.claim_due_review_request_reminders(p_limit integer)',
    'public.claim_experience_payment_atomic(p_booking_id text, p_user_id uuid, p_provider text, p_provider_reference text)',
    'public.complete_admin_manual_experience_payout_atomic(p_request_key uuid, p_host_id uuid, p_settlement_type text, p_expected_current_booking_amount integer, p_legacy_amount integer, p_reason text, p_legacy_source_reference text, p_transfer_reference text, p_paid_by_admin_id uuid, p_paid_by_admin_email text)',
    'public.complete_experience_booking_if_due_atomic(p_booking_id text)',
    'public.complete_service_booking_if_due_atomic(p_booking_id text)',
    'public.complete_service_concierge_booking_if_due_atomic(p_booking_id text)',
    'public.confirm_experience_bank_payment_atomic(p_booking_id text)',
    'public.confirm_experience_payment_atomic(p_booking_id text, p_provider text, p_provider_reference text, p_provider_transaction_id text, p_verified_amount integer)',
    'public.confirm_service_bank_payment_atomic(p_order_id text)',
    'public.confirm_service_concierge_payment_atomic(p_order_id text, p_payment_method text, p_tid text)',
    'public.create_booking_atomic(p_user_id uuid, p_experience_id text, p_date text, p_time text, p_guests integer, p_is_private boolean, p_customer_name text, p_customer_phone text, p_payment_method text, p_is_solo_guarantee boolean)',
    'public.create_experience_review_atomic(p_booking_id text, p_user_id uuid, p_experience_id bigint, p_rating integer, p_content text)',
    'public.create_guest_review_with_notification_atomic(p_booking_id text, p_host_id uuid, p_rating integer, p_content text, p_notification_title text, p_notification_message text)',
    'public.create_service_booking_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid, p_contact_name text, p_contact_phone text)',
    'public.create_service_concierge_request_atomic(p_user_id uuid, p_service_type text, p_description text, p_city text, p_schedule jsonb, p_languages text[], p_guest_count integer, p_contact_name text, p_contact_phone text, p_client_request_key text)',
    'public.create_service_request_with_booking_atomic(p_user_id uuid, p_title text, p_description text, p_city text, p_country text, p_service_date date, p_start_time text, p_duration_hours integer, p_languages text[], p_guest_count integer, p_contact_name text, p_contact_phone text)',
    'public.decrement_comment_count()',
    'public.decrement_like_count()',
    'public.ensure_profile_demographics_reminder(p_user_id uuid, p_title text, p_message text, p_link text)',
    'public.finalize_proxy_card_intake_atomic(p_proxy_request_id uuid, p_verified_amount integer, p_verified_tid text, p_initial_message text)',
    'public.finish_service_refund_operation_atomic(p_operation_id uuid, p_outcome text, p_provider_reference text, p_error_message text)',
    'public.get_admin_attention(p_inquiry_ids bigint[])',
    'public.get_admin_inquiry_activity(p_inquiry_ids bigint[])',
    'public.get_experience_completion_due_backlog()',
    'public.get_ops_anomaly_snapshot(p_observed_at timestamp with time zone, p_claim_overdue_minutes integer, p_refund_stale_minutes integer, p_payout_long_hold_days integer, p_experience_job_missing_minutes integer, p_service_job_missing_minutes integer, p_cancel_pending_job_missing_minutes integer)',
    'public.guard_experience_payment_claim_columns()',
    'public.handle_new_user()',
    'public.increment_comment_count()',
    'public.increment_community_post_view_count(p_post_id uuid)',
    'public.increment_like_count()',
    'public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone, p_lease_seconds integer)',
    'public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone, p_lease_seconds integer, p_reserved_tokens integer)',
    'public.list_due_experience_completion_candidates(p_booking_id text)',
    'public.list_due_experience_review_request_candidates(p_limit integer)',
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
           format('private.%I(%s)', procedure_def.proname,
                  pg_get_function_identity_arguments(procedure_def.oid))
           ORDER BY procedure_def.proname,
                    pg_get_function_identity_arguments(procedure_def.oid)
         )
    INTO actual
    FROM pg_proc AS procedure_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = procedure_def.pronamespace
   WHERE namespace_def.nspname = 'private';
  IF actual IS DISTINCT FROM ARRAY[
    'private.advance_support_version()',
    'private.is_admin_reader()',
    'private.is_inquiry_admin_sender(p_sender uuid)',
    'private.prepare_support_message()'
  ]::text[] THEN
    RAISE EXCEPTION 'private function overload inventory mismatch: %', actual;
  END IF;

  IF to_regprocedure('public.is_admin_reader()') IS NOT NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_namespace AS namespace_def
      WHERE namespace_def.nspname = 'private'
        AND pg_get_userbyid(namespace_def.nspowner) = 'postgres'
        AND namespace_def.nspacl::text =
          '{postgres=UC/postgres,authenticated=U/postgres,service_role=U/postgres}'
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_proc AS procedure_def
      WHERE procedure_def.oid = to_regprocedure('private.is_admin_reader()')
        AND pg_get_userbyid(procedure_def.proowner) = 'postgres'
        AND procedure_def.prosecdef
        AND procedure_def.provolatile = 's'
        AND procedure_def.pronargs = 0
        AND procedure_def.prorettype = 'boolean'::regtype
        AND procedure_def.proconfig = ARRAY['search_path=""']::text[]
        AND procedure_def.prosrc LIKE '%resolved_user_role%'
        AND procedure_def.prosrc NOT LIKE '%current_role%'
        AND procedure_def.proacl::text =
          '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
    )
    OR has_schema_privilege('anon', 'private', 'USAGE')
    OR has_schema_privilege('anon', 'private', 'CREATE')
    OR has_schema_privilege('authenticated', 'private', 'CREATE')
    OR NOT has_schema_privilege('authenticated', 'private', 'USAGE')
    OR has_schema_privilege('service_role', 'private', 'CREATE')
    OR NOT has_schema_privilege('service_role', 'private', 'USAGE')
    OR has_function_privilege('anon', 'private.is_admin_reader()', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'private.is_admin_reader()', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'private.is_admin_reader()', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'private admin reader function contract mismatch';
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
    'public.bookings.bookings_payment_claim_columns_server_only',
    'public.bookings.set_booking_guest_demographics_snapshot',
    'public.community_comments.on_comment_added',
    'public.community_comments.on_comment_removed',
    'public.community_likes.on_like_added',
    'public.community_likes.on_like_removed',
    'public.inquiries.inquiry_support_version',
    'public.inquiry_messages.inquiry_support_message',
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
  IF actual_count <> 120 THEN
    RAISE EXCEPTION 'public index count %, expected 120', actual_count;
  END IF;
  IF to_regclass('public.uq_notifications_review_request_reminder_booking_id') IS NULL
    OR to_regclass('public.uq_notifications_guest_review_request_reminder_booking_id') IS NULL
    OR NOT has_function_privilege('service_role', 'public.claim_due_review_request_reminders(integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.claim_due_review_request_reminders(integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.claim_due_review_request_reminders(integer)', 'EXECUTE')
    OR (SELECT p.prosecdef FROM pg_proc AS p
        WHERE p.oid = to_regprocedure('public.claim_due_review_request_reminders(integer)'))
  THEN
    RAISE EXCEPTION 'review reminder index or RPC security mismatch';
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
  IF actual_count <> 180 OR primary_key_count <> 39 OR foreign_key_count <> 59
     OR unique_count <> 14 OR check_count <> 68 THEN
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
  IF actual_count <> 106 THEN
    RAISE EXCEPTION 'public RLS policy count %, expected 106', actual_count;
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
  IF actual_fingerprint IS DISTINCT FROM 'e5a16a4215c569060fbf895453a5cd00' THEN
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
  IF actual_fingerprint IS DISTINCT FROM 'a9c644ba2ab5c795f29aff57092aa002' THEN
    RAISE EXCEPTION 'public relation grant fingerprint mismatch: %', actual_fingerprint;
  END IF;

  SELECT array_agg(publication_def.tablename ORDER BY publication_def.tablename)
    INTO actual
    FROM pg_publication_tables AS publication_def
   WHERE publication_def.pubname = 'supabase_realtime'
     AND publication_def.schemaname = 'public';
  IF actual IS DISTINCT FROM ARRAY[
    'admin_audit_logs', 'admin_task_comments', 'admin_tasks', 'admin_whitelist',
    'inquiries', 'inquiry_messages', 'notifications', 'profiles'
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
    'admin_files|false|10485760', 'avatars|true|', 'chat-images|false|',
    'experiences|false|', 'images|true|', 'verification-docs|false|'
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
  IF actual_fingerprint IS DISTINCT FROM '7419cabe695cd50a522314a749216c05' THEN
    RAISE EXCEPTION 'Storage bucket fingerprint mismatch: %', actual_fingerprint;
  END IF;

  SELECT array_agg(policy_def.policyname ORDER BY policy_def.policyname)
    INTO actual
    FROM pg_policies AS policy_def
   WHERE policy_def.schemaname = 'storage' AND policy_def.tablename = 'objects';
  expected := ARRAY[
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
  IF actual_fingerprint IS DISTINCT FROM '898e8b7f917fd0f4530ef30c9b61961e' THEN
    RAISE EXCEPTION 'Storage policy fingerprint mismatch: %', actual_fingerprint;
  END IF;

  IF has_function_privilege('anon', 'public.check_rate_limit(text,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.check_rate_limit(text,integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.check_rate_limit(text,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.handle_new_user()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.mark_room_messages_read(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.mark_room_messages_read(uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.mark_room_messages_read(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.apply_experience_media_locator_cas(bigint,text[],text,jsonb,jsonb,text[],text,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.apply_experience_media_locator_cas(bigint,text[],text,jsonb,jsonb,text[],text,jsonb,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.apply_experience_media_locator_cas(bigint,text[],text,jsonb,jsonb,text[],text,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileged function execute contract mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc AS procedure_def
      JOIN pg_namespace AS namespace_def ON namespace_def.oid = procedure_def.pronamespace
     WHERE namespace_def.nspname = 'public'
       AND procedure_def.proname = 'mark_room_messages_read'
       AND NOT (coalesce(procedure_def.proconfig, ARRAY[]::text[])
         @> ARRAY['search_path=public, pg_catalog']::text[])
  ) THEN
    RAISE EXCEPTION 'mark_room_messages_read search_path contract mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc AS procedure_def
      JOIN pg_namespace AS namespace_def ON namespace_def.oid = procedure_def.pronamespace
     WHERE namespace_def.nspname = 'public'
       AND procedure_def.proname = 'apply_experience_media_locator_cas'
       AND (
         procedure_def.prosecdef
         OR pg_get_userbyid(procedure_def.proowner) <> 'postgres'
         OR NOT (coalesce(procedure_def.proconfig, ARRAY[]::text[])
           @> ARRAY['search_path=""']::text[])
       )
  ) THEN
    RAISE EXCEPTION 'experience media locator CAS security contract mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name IN ('public_profiles', 'public_host_applications')
       AND grantee IN ('anon', 'authenticated', 'service_role')
       AND privilege_type <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'public projection grants are not SELECT-only';
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

DO $proxy_card_rpc_security_contract$
DECLARE
  function_oid oid;
BEGIN
  SELECT procedure_def.oid
    INTO function_oid
    FROM pg_proc AS procedure_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = procedure_def.pronamespace
   WHERE namespace_def.nspname = 'public'
     AND procedure_def.proname = 'finalize_proxy_card_intake_atomic'
     AND pg_get_function_identity_arguments(procedure_def.oid) =
       'p_proxy_request_id uuid, p_verified_amount integer, p_verified_tid text, p_initial_message text';

  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'proxy card intake RPC is missing';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc AS procedure_def
     WHERE procedure_def.oid = function_oid
       AND (
         procedure_def.prosecdef
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
       )
  ) THEN
    RAISE EXCEPTION 'proxy card intake RPC security contract mismatch';
  END IF;
END
$proxy_card_rpc_security_contract$;

-- Captured via schema-only-inventory.sql on 2026-09-22; no schema/data writes.
DO $payment_claim_contract$
DECLARE
  actual text[];
  actual_definition text;
BEGIN
  SELECT array_agg(column_name || '|' || data_type || '|' || is_nullable || '|' || coalesce(column_default, '') ORDER BY column_name)
    INTO actual
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'bookings'
     AND column_name = ANY (ARRAY[
    'payment_claim_state',
    'payment_claim_expires_at',
    'payment_provider',
    'payment_provider_reference',
    'payment_claim_token'
  ]::text[]);
  IF actual IS DISTINCT FROM ARRAY[
    'payment_claim_expires_at|timestamp with time zone|YES|',
    'payment_claim_state|text|YES|',
    'payment_claim_token|uuid|YES|',
    'payment_provider|text|YES|',
    'payment_provider_reference|text|YES|'
  ]::text[] THEN
    RAISE EXCEPTION 'payment claim column contract mismatch: %', actual;
  END IF;

  SELECT array_agg(indexdef ORDER BY indexname)
    INTO actual
    FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'bookings'
     AND indexname = ANY (ARRAY[
    'bookings_payment_claim_reconciliation_idx',
    'bookings_payment_provider_reference_key',
    'bookings_pending_cleanup_candidate_idx'
  ]::text[]);
  IF actual IS DISTINCT FROM ARRAY[
    'CREATE INDEX bookings_payment_claim_reconciliation_idx ON public.bookings USING btree (payment_claim_state, payment_claim_expires_at) WHERE (payment_claim_state = ANY (ARRAY[''processing''::text, ''reconciliation_required''::text]))',
    'CREATE UNIQUE INDEX bookings_payment_provider_reference_key ON public.bookings USING btree (payment_provider, payment_provider_reference) WHERE (payment_provider_reference IS NOT NULL)',
    'CREATE INDEX bookings_pending_cleanup_candidate_idx ON public.bookings USING btree (payment_method, created_at, id) WHERE ((lower(status) = ''pending''::text) AND (tid IS NULL))'
  ]::text[] THEN
    RAISE EXCEPTION 'payment claim index contract mismatch: %', actual;
  END IF;

  SELECT pg_get_constraintdef(oid, true)
    INTO actual_definition
    FROM pg_constraint
   WHERE conrelid = 'public.bookings'::regclass
     AND conname = 'bookings_payment_claim_state_check';
  IF actual_definition IS DISTINCT FROM 'CHECK (payment_claim_state IS NULL OR (payment_claim_state = ANY (ARRAY[''claimed''::text, ''processing''::text, ''reconciliation_required''::text, ''completed''::text, ''released''::text])))' THEN
    RAISE EXCEPTION 'payment claim CHECK contract mismatch: %', actual_definition;
  END IF;

  SELECT pg_get_triggerdef(oid, true)
    INTO actual_definition
    FROM pg_trigger
   WHERE tgrelid = 'public.bookings'::regclass AND NOT tgisinternal
     AND tgenabled = 'O'
     AND tgname = 'bookings_payment_claim_columns_server_only';
  IF actual_definition IS DISTINCT FROM 'CREATE TRIGGER bookings_payment_claim_columns_server_only BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION guard_experience_payment_claim_columns()' THEN
    RAISE EXCEPTION 'payment claim trigger contract mismatch: %', actual_definition;
  END IF;

  SELECT array_agg(procedure_def.proname ORDER BY procedure_def.proname)
    INTO actual
    FROM pg_proc AS procedure_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = procedure_def.pronamespace
   WHERE namespace_def.nspname = 'public'
     AND procedure_def.proname = ANY (ARRAY[
    'attach_experience_payment_provider_reference_atomic',
    'begin_experience_payment_capture_atomic',
    'cancel_expired_pending_bookings_atomic',
    'claim_experience_payment_atomic',
    'confirm_experience_bank_payment_atomic',
    'confirm_experience_payment_atomic',
    'create_booking_atomic',
    'guard_experience_payment_claim_columns'
  ]::text[])
     AND (
       procedure_def.prosecdef <> (procedure_def.proname <> 'guard_experience_payment_claim_columns')
       OR pg_get_userbyid(procedure_def.proowner) <> 'postgres'
       OR coalesce(procedure_def.proconfig, ARRAY[]::text[]) <> ARRAY['search_path=""']::text[]
       OR has_function_privilege('anon', procedure_def.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', procedure_def.oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', procedure_def.oid, 'EXECUTE')
       OR EXISTS (
         SELECT 1
           FROM aclexplode(coalesce(procedure_def.proacl, acldefault('f', procedure_def.proowner))) AS acl_entry
          WHERE acl_entry.grantee = 0 AND acl_entry.privilege_type = 'EXECUTE'
       )
     );
  IF actual IS NOT NULL THEN
    RAISE EXCEPTION 'payment claim function security contract mismatch: %', actual;
  END IF;
END
$payment_claim_contract$;

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

-- Production ledger versions differ from repository filename versions. The
-- single stored statement was verified byte-for-byte against each unchanged SQL.
DO $admin_monitoring_ledger_contract$
DECLARE
  actual text[];
BEGIN
  SELECT array_agg(version || ':' || name || ':' || cardinality(statements) || ':' || md5(statements[1]) || ':' || encode(sha256(convert_to(statements[1], 'UTF8')), 'hex') ORDER BY version)
    INTO actual FROM supabase_migrations.schema_migrations
   WHERE version IN ('20261002024534', '20261002024638', '20261002075149');
  IF actual IS DISTINCT FROM ARRAY[
    '20261002024534:admin_message_monitoring_phase_1:1:502c4fc1f7413543896685476ab0e17e:aee6d14e1a897579e5dc6454221cb52d4bab822952096425e0b110eeb907ae95',
    '20261002024638:admin_message_monitoring_historical_reinquiry:1:1670660673237da481adb1419b5a3042:80f34eea7ad6e2405aa38962a886c97e8713bfa1fefe72f0d9647686489747a1',
    '20261002075149:admin_attention_badges_phase_2:1:e25bb954e25f2a19965c88d77df447e5:d20d5774318f8fe52dc41d13a533728b13c98a20fab812cd693737dba0de51a2'
  ]::text[] THEN
    RAISE EXCEPTION 'admin monitoring applied ledger SQL mapping mismatch: %', actual;
  END IF;
END
$admin_monitoring_ledger_contract$;

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
    WHERE n.nspname = 'private' AND relkind IN ('r','p');
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
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname = 'private' AND c.relkind IN ('r','p','v','m','f');
  IF fingerprint IS DISTINCT FROM 'c0c83ee9ce880c47d3d24f3f918b4364' THEN RAISE EXCEPTION 'Private relation grant fingerprint mismatch'; END IF;
END $admin_attention_contract$;

-- Immutable Production rollout record, not a fresh-staging seed expectation.
DO $admin_attention_production_marker$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.admin_monitor_cutover WHERE singleton
    AND conversations = 40 AND messages = 410
    AND applied_at = '2026-10-02T07:51:49.802096Z'::timestamptz) THEN
    RAISE EXCEPTION 'Production cutover marker mismatch';
  END IF;
END $admin_attention_production_marker$;

SELECT 'LOCALLY_PRODUCTION_CURRENT_STATE_CONTRACT_PASS' AS result;

ROLLBACK;
