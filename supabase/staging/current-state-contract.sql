\set ON_ERROR_STOP on

BEGIN READ ONLY;
SET LOCAL search_path = public, extensions;

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
    '20261002075149:admin_attention_badges_phase_2',
    '20261003012400:phone_followup_tasks',
    '20261003134417:admin_chat_bounded_search',
    '20261004053224:media_lifecycle_foundation',
    '20261005082309:avatar_media_authority'
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
    'admin_audit_logs',
    'admin_job_runs',
    'admin_manual_payouts',
    'admin_support_unread_alert_batches',
    'admin_task_comments',
    'admin_tasks',
    'admin_whitelist',
    'analytics_events',
    'bookings',
    'community_comments',
    'community_likes',
    'community_posts',
    'experience_availability',
    'experience_popularity_snapshot',
    'experience_translation_jobs',
    'experience_translation_tasks',
    'experiences',
    'guest_reviews',
    'host_applications',
    'inquiries',
    'inquiry_messages',
    'likes',
    'media_asset_references',
    'media_assets',
    'media_deletion_journal',
    'messages',
    'notifications',
    'profile_private_demographics',
    'profiles',
    'proxy_comments',
    'proxy_requests',
    'reviews',
    'search_logs',
    'service_applications',
    'service_assignment_history',
    'service_bookings',
    'service_refund_operations',
    'service_request_schedule_items',
    'service_requests',
    'translation_provider_state',
    'users',
    'wishlists'
  ]::text[];
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'public table inventory mismatch: %', actual;
  END IF;

  SELECT count(*)
    INTO actual_count
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = ANY (expected);
  IF actual_count <> 559 THEN
    RAISE EXCEPTION 'public table column count %, expected 559', actual_count;
  END IF;

  SELECT array_agg(class_def.relname ORDER BY class_def.relname)
    INTO actual
    FROM pg_class AS class_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
   WHERE namespace_def.nspname = 'public' AND class_def.relkind IN ('v', 'm');
  expected := ARRAY[
    'public_host_applications',
    'public_profiles'
  ]::text[];
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
    'public.avatar_migration_inventory()',
    'public.begin_avatar_media_asset(p_id uuid, p_owner_id uuid, p_key text, p_url text, p_sha256 text, p_size bigint, p_mime text, p_idempotency_key text)',
    'public.begin_experience_media_asset(p_id uuid, p_owner_id uuid, p_key text, p_url text, p_sha256 text, p_size bigint, p_mime text, p_idempotency_key text, p_parent_id text)',
    'public.begin_experience_payment_capture_atomic(p_booking_id text, p_user_id uuid, p_provider_reference text)',
    'public.begin_service_refund_operation_atomic(p_admin_id uuid, p_order_id text, p_refund_amount integer, p_host_compensation_amount integer, p_idempotency_key text)',
    'public.cancel_expired_pending_bookings_atomic(p_batch_size integer)',
    'public.cancel_pending_service_concierge_atomic(p_actor_id uuid, p_order_id text, p_cancel_reason text)',
    'public.check_rate_limit(table_name text, seconds integer)',
    'public.claim_due_admin_support_unread_alert_batches(p_limit integer)',
    'public.claim_due_review_request_reminders(p_limit integer)',
    'public.claim_experience_payment_atomic(p_booking_id text, p_user_id uuid, p_provider text, p_provider_reference text)',
    'public.claim_media_deletion(p_asset_id uuid, p_enabled boolean, p_minimum_age_ms bigint)',
    'public.commit_profile_avatar(p_owner_id uuid, p_asset_id uuid, p_expected_url text, p_sha256 text, p_size bigint)',
    'public.complete_admin_manual_experience_payout_atomic(p_request_key uuid, p_host_id uuid, p_settlement_type text, p_expected_current_booking_amount integer, p_legacy_amount integer, p_reason text, p_legacy_source_reference text, p_transfer_reference text, p_paid_by_admin_id uuid, p_paid_by_admin_email text)',
    'public.complete_experience_booking_if_due_atomic(p_booking_id text)',
    'public.complete_phone_request(p_request_id uuid, p_inquiry_id bigint, p_message_ids bigint[], p_admin_id uuid)',
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
    'public.get_admin_phone_activity(p_inquiry_ids bigint[])',
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
    'public.plan_media_owner_deletion(p_owner_id uuid)',
    'public.prune_notifications_retention(p_cutoff timestamp with time zone, p_batch_size integer)',
    'public.prune_team_workspace_comments(p_task_id uuid, p_keep_limit integer)',
    'public.prune_team_workspace_tasks(p_keep_limit integer)',
    'public.record_media_deletion_step(p_asset_id uuid, p_event text, p_code text)',
    'public.record_translation_provider_outcome(p_provider text, p_token_count integer, p_cooldown_seconds integer, p_hit_quota boolean)',
    'public.record_translation_provider_outcome(p_provider text, p_token_count integer, p_cooldown_seconds integer, p_hit_quota boolean, p_reserved_token_count integer)',
    'public.refresh_experience_popularity_snapshot()',
    'public.replace_managed_media_reference(p_owner_id uuid, p_parent_type text, p_parent_id text, p_expected_digest text, p_new_digest text, p_old_asset_id uuid, p_new_asset_id uuid)',
    'public.reply_phone_request(p_request_id uuid, p_inquiry_id bigint, p_message_ids bigint[], p_admin_id uuid, p_content text, p_type text, p_image_url text)',
    'public.request_service_cancellation_review_atomic(p_actor_id uuid, p_order_id text, p_cancel_reason text)',
    'public.rollback_profile_avatar(p_owner_id uuid, p_asset_id uuid, p_expected_url text, p_old_url text)',
    'public.search_admin_chat(p_surface text, p_query text)',
    'public.select_service_host_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid)',
    'public.set_proxy_comments_updated_at()',
    'public.set_proxy_requests_updated_at()',
    'public.set_service_applications_updated_at()',
    'public.set_service_bookings_updated_at()',
    'public.set_service_requests_updated_at()',
    'public.snapshot_booking_guest_demographics()',
    'public.verify_avatar_media_asset(p_id uuid, p_owner_id uuid, p_sha256 text, p_size bigint, p_mime text)',
    'public.verify_experience_media_asset(p_id uuid, p_owner_id uuid, p_sha256 text, p_size bigint, p_mime text)'
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
    'private.admin_chat_phone_title(category text, form_data jsonb)',
    'private.adopt_phone_followup_link()',
    'private.advance_support_version()',
    'private.bump_experience_media_revision()',
    'private.canonical_experience_media_locator(p_url text)',
    'private.capture_phone_followup()',
    'private.delete_pending_phone_followup()',
    'private.handle_phone_followup(p_request uuid, p_inquiry bigint, p_ids bigint[], p_admin uuid, p_complete boolean)',
    'private.has_phone_followup(p_request uuid)',
    'private.is_admin_reader()',
    'private.is_inquiry_admin_sender(p_sender uuid)',
    'private.prepare_support_message()',
    'private.sync_experience_media_assets()',
    'private.sync_profile_avatar_assets()'
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
    'public.experiences.experience_media_delete_plan',
    'public.experiences.experience_media_finalize',
    'public.experiences.experience_media_revision',
    'public.inquiries.inquiry_support_version',
    'public.inquiry_messages.inquiry_support_message',
    'public.inquiry_messages.phone_followup_capture',
    'public.inquiry_messages.phone_followup_delete',
    'public.profiles.profile_avatar_delete_plan',
    'public.profiles.profile_avatar_finalize',
    'public.proxy_comments.trg_pc_updated_at',
    'public.proxy_requests.phone_followup_link',
    'public.proxy_requests.trg_pr_updated_at',
    'public.service_applications.trg_sa_updated_at',
    'public.service_bookings.trg_sb_updated_at',
    'public.service_requests.trg_sr_updated_at'
  ]::text[];
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'application trigger inventory mismatch: %', actual;
  END IF;

  SELECT count(*) INTO actual_count FROM pg_indexes WHERE schemaname = 'public';
  IF actual_count <> 143 THEN
    RAISE EXCEPTION 'public index count %, expected 143', actual_count;
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
  IF actual_count <> 206 OR primary_key_count <> 42 OR foreign_key_count <> 61
     OR unique_count <> 17 OR check_count <> 86 THEN
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
    'admin_audit_logs',
    'admin_manual_payouts',
    'admin_task_comments',
    'admin_tasks',
    'admin_whitelist',
    'analytics_events',
    'bookings',
    'community_comments',
    'community_likes',
    'community_posts',
    'experience_availability',
    'experience_popularity_snapshot',
    'experience_translation_jobs',
    'experience_translation_tasks',
    'experiences',
    'guest_reviews',
    'host_applications',
    'inquiries',
    'inquiry_messages',
    'likes',
    'media_asset_references',
    'media_assets',
    'media_deletion_journal',
    'messages',
    'notifications',
    'profile_private_demographics',
    'profiles',
    'proxy_comments',
    'proxy_requests',
    'reviews',
    'search_logs',
    'service_applications',
    'service_assignment_history',
    'service_bookings',
    'service_refund_operations',
    'service_request_schedule_items',
    'service_requests',
    'translation_provider_state',
    'users',
    'wishlists'
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
  IF actual_fingerprint IS DISTINCT FROM '3b88d65d3e719c850d20d1cbf706516f' THEN
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


-- The financial P0 migration is reviewed but not applied. Never replay media/avatar.
DO $media_authority_ledger_contract$
DECLARE actual text[];
BEGIN
  SELECT array_agg(version||':'||name||':'||cardinality(statements)||':'||md5(array_to_string(statements,E'\n'))||':'||encode(sha256(convert_to(array_to_string(statements,E'\n'),'UTF8')),'hex') ORDER BY version)
  INTO actual FROM supabase_migrations.schema_migrations
  WHERE version IN ('20261004053224','20261005082309');
  IF actual IS DISTINCT FROM ARRAY[
    '20261004053224:media_lifecycle_foundation:1:7b753190dec37819fc120e86e088b5b6:c8cd123855ba600070fd22ddaef6b6a37591110f18cec92829de37ff0fdb3cfd',
    '20261005082309:avatar_media_authority:1:6297922f1e25f9b2a2fb21b1675d7976:b8a749115d2e279ea8b0e37d17ef6c373d3eec5e5f51b555c7fd62b1e58d774f'
  ]::text[] THEN
    RAISE EXCEPTION 'applied media/avatar ledger SQL mismatch: %', actual;
  END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261005104924')
     OR to_regclass('public.booking_solo_refund_operations') IS NOT NULL THEN
    RAISE EXCEPTION 'financial P0 is pending, current-state evidence must be recaptured after authorized rollout';
  END IF;
END
$media_authority_ledger_contract$;

DO $applied_media_catalog_contract$
DECLARE actual text[];
BEGIN
  SELECT array_agg(format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))||'|'||pg_get_userbyid(p.proowner)||'|'||p.prosecdef||'|'||p.provolatile::text||'|'||pg_get_function_result(p.oid)||'|'||coalesce(array_to_string(p.proconfig,','),'')||'|'||coalesce(p.proacl::text,'')||'|'||md5(p.prosrc) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
  INTO actual FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) = ANY (ARRAY[
    'private.bump_experience_media_revision()',
    'private.canonical_experience_media_locator(p_url text)',
    'private.sync_experience_media_assets()',
    'private.sync_profile_avatar_assets()',
    'public.avatar_migration_inventory()',
    'public.begin_avatar_media_asset(p_id uuid, p_owner_id uuid, p_key text, p_url text, p_sha256 text, p_size bigint, p_mime text, p_idempotency_key text)',
    'public.begin_experience_media_asset(p_id uuid, p_owner_id uuid, p_key text, p_url text, p_sha256 text, p_size bigint, p_mime text, p_idempotency_key text, p_parent_id text)',
    'public.claim_media_deletion(p_asset_id uuid, p_enabled boolean, p_minimum_age_ms bigint)',
    'public.commit_profile_avatar(p_owner_id uuid, p_asset_id uuid, p_expected_url text, p_sha256 text, p_size bigint)',
    'public.plan_media_owner_deletion(p_owner_id uuid)',
    'public.record_media_deletion_step(p_asset_id uuid, p_event text, p_code text)',
    'public.replace_managed_media_reference(p_owner_id uuid, p_parent_type text, p_parent_id text, p_expected_digest text, p_new_digest text, p_old_asset_id uuid, p_new_asset_id uuid)',
    'public.rollback_profile_avatar(p_owner_id uuid, p_asset_id uuid, p_expected_url text, p_old_url text)',
    'public.verify_avatar_media_asset(p_id uuid, p_owner_id uuid, p_sha256 text, p_size bigint, p_mime text)',
    'public.verify_experience_media_asset(p_id uuid, p_owner_id uuid, p_sha256 text, p_size bigint, p_mime text)'
  ]::text[] );
  IF actual IS DISTINCT FROM ARRAY[
    'private.bump_experience_media_revision()|postgres|false|v|trigger|search_path=""|{postgres=X/postgres}|cdea8ca76a14af9f1acf520f5f3eb1df',
    'private.canonical_experience_media_locator(p_url text)|postgres|false|i|text|search_path=""|{postgres=X/postgres}|af146baa063876f07dc3a60c195a0f98',
    'private.sync_experience_media_assets()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|fb047c74bf5b66e62a8c3fc801d975ee',
    'private.sync_profile_avatar_assets()|postgres|true|v|trigger|search_path=""|{postgres=X/postgres}|762aca4c44be1021f8a8711a7955eb46',
    'public.avatar_migration_inventory()|postgres|false|s|jsonb|search_path=""|{postgres=X/postgres,service_role=X/postgres}|67223aa9ded354e5b66cbc8af39488c2',
    'public.begin_avatar_media_asset(p_id uuid, p_owner_id uuid, p_key text, p_url text, p_sha256 text, p_size bigint, p_mime text, p_idempotency_key text)|postgres|false|v|media_assets|search_path=""|{postgres=X/postgres,service_role=X/postgres}|23daf0b3ece0cb7dcb2ce08a0280d58d',
    'public.begin_experience_media_asset(p_id uuid, p_owner_id uuid, p_key text, p_url text, p_sha256 text, p_size bigint, p_mime text, p_idempotency_key text, p_parent_id text)|postgres|false|v|media_assets|search_path=""|{postgres=X/postgres,service_role=X/postgres}|e6b8d8c78f0e435949c63de97a5182d4',
    'public.claim_media_deletion(p_asset_id uuid, p_enabled boolean, p_minimum_age_ms bigint)|postgres|false|v|boolean|search_path=""|{postgres=X/postgres,service_role=X/postgres}|54a6e20ba2224fc1aaf30a722a3f4a9f',
    'public.commit_profile_avatar(p_owner_id uuid, p_asset_id uuid, p_expected_url text, p_sha256 text, p_size bigint)|postgres|false|v|media_assets|search_path=""|{postgres=X/postgres,service_role=X/postgres}|0231f457894c7b7e683a2e301ada0b54',
    'public.plan_media_owner_deletion(p_owner_id uuid)|postgres|false|v|integer|search_path=""|{postgres=X/postgres,service_role=X/postgres}|ac568071f0533cb850cf6d2970cded19',
    'public.record_media_deletion_step(p_asset_id uuid, p_event text, p_code text)|postgres|false|v|void|search_path=""|{postgres=X/postgres,service_role=X/postgres}|9c57b2a53ba014b26bca56528f17dd2d',
    'public.replace_managed_media_reference(p_owner_id uuid, p_parent_type text, p_parent_id text, p_expected_digest text, p_new_digest text, p_old_asset_id uuid, p_new_asset_id uuid)|postgres|false|v|void|search_path=""|{postgres=X/postgres,service_role=X/postgres}|670e43b8096a583208ff6f66ab1c03c9',
    'public.rollback_profile_avatar(p_owner_id uuid, p_asset_id uuid, p_expected_url text, p_old_url text)|postgres|false|v|boolean|search_path=""|{postgres=X/postgres,service_role=X/postgres}|00979ed226da2993efe20e85be9f21f6',
    'public.verify_avatar_media_asset(p_id uuid, p_owner_id uuid, p_sha256 text, p_size bigint, p_mime text)|postgres|false|v|media_assets|search_path=""|{postgres=X/postgres,service_role=X/postgres}|bf39eefc4fe80351afe01e3fe1081cea',
    'public.verify_experience_media_asset(p_id uuid, p_owner_id uuid, p_sha256 text, p_size bigint, p_mime text)|postgres|false|v|media_assets|search_path=""|{postgres=X/postgres,service_role=X/postgres}|03ca290bcdae18b33b584a1da2ee78e5'
  ]::text[] THEN
    RAISE EXCEPTION 'applied media function body or ACL mismatch';
  END IF;
  SELECT array_agg(indexdef ORDER BY indexname) INTO actual FROM pg_indexes WHERE schemaname='public' AND tablename IN ('media_assets','media_asset_references','media_deletion_journal');
  IF actual IS DISTINCT FROM ARRAY[
    'CREATE INDEX media_asset_references_parent_idx ON public.media_asset_references USING btree (parent_type, parent_id)',
    'CREATE UNIQUE INDEX media_asset_references_pkey ON public.media_asset_references USING btree (asset_id, parent_type, parent_id)',
    'CREATE UNIQUE INDEX media_assets_owner_id_idempotency_key_key ON public.media_assets USING btree (owner_id, idempotency_key)',
    'CREATE INDEX media_assets_owner_idx ON public.media_assets USING btree (owner_id, business_scope)',
    'CREATE INDEX media_assets_pending_idx ON public.media_assets USING btree (created_at, id) WHERE (state = ''pending''::text)',
    'CREATE UNIQUE INDEX media_assets_pkey ON public.media_assets USING btree (id)',
    'CREATE UNIQUE INDEX media_assets_provider_bucket_object_key_key ON public.media_assets USING btree (provider, bucket, object_key)',
    'CREATE UNIQUE INDEX media_assets_public_url_key ON public.media_assets USING btree (public_url)',
    'CREATE UNIQUE INDEX media_deletion_journal_pkey ON public.media_deletion_journal USING btree (asset_id)',
    'CREATE INDEX media_deletion_journal_state_idx ON public.media_deletion_journal USING btree (state, requested_at)'
  ]::text[] THEN
    RAISE EXCEPTION 'applied media index mismatch';
  END IF;
  SELECT array_agg(c.relname||'|'||k.conname||'|'||pg_get_constraintdef(k.oid,true) ORDER BY c.relname,k.conname) INTO actual FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('media_assets','media_asset_references','media_deletion_journal');
  IF actual IS DISTINCT FROM ARRAY[
    'media_asset_references|media_asset_references_asset_id_fkey|FOREIGN KEY (asset_id) REFERENCES media_assets(id)',
    'media_asset_references|media_asset_references_pkey|PRIMARY KEY (asset_id, parent_type, parent_id)',
    'media_asset_references|media_asset_references_reference_digest_check|CHECK (reference_digest ~ ''^[a-f0-9]{64}$''::text)',
    'media_assets|avatar_media_identity|CHECK (business_scope <> ''avatar''::text OR provider = ''r2''::text AND bucket = ''locally-public-avatars''::text AND parent_type = ''profile_avatar''::text AND parent_id IS NOT NULL AND parent_id = owner_id::text AND public_url IS NOT NULL AND expected_size <= 10485760 AND (mime = ANY (ARRAY[''image/jpeg''::text, ''image/png''::text, ''image/webp''::text, ''image/gif''::text, ''image/avif''::text])) AND object_key = (((((''avatars/v1/''::text || encode(sha256(convert_to(''avatar-media-owner:''::text || owner_id::text, ''UTF8''::name)), ''hex''::text)) || ''/''::text) || id::text) || ''/avatar.''::text) ||
CASE mime
    WHEN ''image/jpeg''::text THEN ''jpg''::text
    ELSE substr(mime, 7)
END) AND public_url = (''https://avatars-media.locally-travel.com/''::text || object_key))',
    'media_assets|media_assets_bucket_check|CHECK (bucket ~ ''^[a-zA-Z0-9_-]+$''::text)',
    'media_assets|media_assets_business_scope_check|CHECK (business_scope = ANY (ARRAY[''experience''::text, ''avatar''::text, ''host_profile''::text, ''community''::text, ''chat''::text, ''admin''::text, ''verification''::text]))',
    'media_assets|media_assets_check|CHECK (state <> ''committed''::text OR verified_at IS NOT NULL AND committed_at IS NOT NULL)',
    'media_assets|media_assets_check1|CHECK (state <> ''tombstoned''::text OR tombstoned_at IS NOT NULL)',
    'media_assets|media_assets_check2|CHECK (business_scope <> ''experience''::text OR expected_size <= 10485760 AND provider = ''r2''::text AND bucket = ''locally-public-experience-canary''::text AND object_key ~~ ''sources/v1/experience/%''::text AND public_url = (''https://media-canary.locally-travel.com/''::text || object_key))',
    'media_assets|media_assets_expected_sha256_check|CHECK (expected_sha256 ~ ''^[a-f0-9]{64}$''::text)',
    'media_assets|media_assets_expected_size_check|CHECK (expected_size > 0)',
    'media_assets|media_assets_idempotency_key_check|CHECK (idempotency_key ~ ''^[a-f0-9]{64}$''::text)',
    'media_assets|media_assets_object_key_check|CHECK (object_key <> ''''::text AND object_key !~ ''(^/|(^|/)[.][.]?(/|$))''::text)',
    'media_assets|media_assets_owner_id_idempotency_key_key|UNIQUE (owner_id, idempotency_key)',
    'media_assets|media_assets_pkey|PRIMARY KEY (id)',
    'media_assets|media_assets_provider_bucket_object_key_key|UNIQUE (provider, bucket, object_key)',
    'media_assets|media_assets_provider_check|CHECK (provider = ANY (ARRAY[''supabase''::text, ''r2''::text]))',
    'media_assets|media_assets_public_url_key|UNIQUE (public_url)',
    'media_assets|media_assets_state_check|CHECK (state = ANY (ARRAY[''pending''::text, ''committed''::text, ''tombstoned''::text]))',
    'media_deletion_journal|media_deletion_journal_asset_id_fkey|FOREIGN KEY (asset_id) REFERENCES media_assets(id)',
    'media_deletion_journal|media_deletion_journal_attempt_count_check|CHECK (attempt_count >= 0)',
    'media_deletion_journal|media_deletion_journal_check|CHECK (state <> ''complete''::text OR object_deleted_at IS NOT NULL AND completed_at IS NOT NULL)',
    'media_deletion_journal|media_deletion_journal_last_failure_check|CHECK (last_failure = ANY (ARRAY[''reference_exists''::text, ''pinned''::text, ''delete_disabled''::text, ''identity_mismatch''::text, ''provider_failed''::text, ''purge_failed''::text]))',
    'media_deletion_journal|media_deletion_journal_pkey|PRIMARY KEY (asset_id)',
    'media_deletion_journal|media_deletion_journal_reason_check|CHECK (reason = ANY (ARRAY[''replaced''::text, ''parent_deleted''::text, ''owner_deleted''::text, ''pending_abandoned''::text]))',
    'media_deletion_journal|media_deletion_journal_state_check|CHECK (state = ANY (ARRAY[''queued''::text, ''blocked''::text, ''deleting''::text, ''failed''::text, ''complete''::text]))'
  ]::text[] THEN
    RAISE EXCEPTION 'applied media constraint mismatch';
  END IF;
  SELECT array_agg(c.relname||'|'||t.tgname||'|'||pg_get_triggerdef(t.oid,true)||'|'||t.tgenabled::text ORDER BY c.relname,t.tgname) INTO actual FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND t.tgname IN ('experience_media_revision','experience_media_finalize','experience_media_delete_plan','profile_avatar_finalize','profile_avatar_delete_plan');
  IF actual IS DISTINCT FROM ARRAY[
    'experiences|experience_media_delete_plan|CREATE TRIGGER experience_media_delete_plan BEFORE DELETE ON experiences FOR EACH ROW EXECUTE FUNCTION private.sync_experience_media_assets()|O',
    'experiences|experience_media_finalize|CREATE TRIGGER experience_media_finalize AFTER INSERT OR UPDATE ON experiences FOR EACH ROW EXECUTE FUNCTION private.sync_experience_media_assets()|O',
    'experiences|experience_media_revision|CREATE TRIGGER experience_media_revision BEFORE UPDATE ON experiences FOR EACH ROW EXECUTE FUNCTION private.bump_experience_media_revision()|O',
    'profiles|profile_avatar_delete_plan|CREATE TRIGGER profile_avatar_delete_plan BEFORE DELETE ON profiles FOR EACH ROW EXECUTE FUNCTION private.sync_profile_avatar_assets()|O',
    'profiles|profile_avatar_finalize|CREATE TRIGGER profile_avatar_finalize AFTER INSERT OR UPDATE OF avatar_url ON profiles FOR EACH ROW EXECUTE FUNCTION private.sync_profile_avatar_assets()|O'
  ]::text[] THEN
    RAISE EXCEPTION 'applied media trigger mismatch';
  END IF;
END
$applied_media_catalog_contract$;

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

-- Immutable Production rollout record, not a fresh-staging seed expectation.
DO $admin_attention_production_marker$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.admin_monitor_cutover WHERE singleton
    AND conversations = 40 AND messages = 410
    AND applied_at = '2026-10-02T07:51:49.802096Z'::timestamptz) THEN
    RAISE EXCEPTION 'Production cutover marker mismatch';
  END IF;
END $admin_attention_production_marker$;

-- Applied Phone schema: catalog/security only; no historical task rows are asserted.
DO $phone_search_ledger_contract$
DECLARE actual text[];
BEGIN
  SELECT array_agg(version||':'||name||':'||cardinality(statements)||':'||md5(statements[1])||':'||encode(sha256(convert_to(statements[1],'UTF8')),'hex') ORDER BY version)
    INTO actual FROM supabase_migrations.schema_migrations WHERE version IN ('20261003012400','20261003134417');
  IF actual IS DISTINCT FROM ARRAY[
    '20261003012400:phone_followup_tasks:1:6146c5011c4b1644e96a917f0a4f907c:88769a249dca3d7b2f0cbd2dc6a8cf2197960213a357bac71353978a5ae0e396',
    '20261003134417:admin_chat_bounded_search:1:e70e0d43d008331211f614635d9e629d:0e9776caab4c826924eade21baa229ec73a27857d9c1c9bb75a97b25b1b31724'
  ]::text[] THEN
    RAISE EXCEPTION 'Phone/search applied ledger SQL mapping mismatch: %',actual;
  END IF;
END $phone_search_ledger_contract$;

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

SELECT 'LOCALLY_PRODUCTION_CURRENT_STATE_CONTRACT_PASS' AS result;

ROLLBACK;
