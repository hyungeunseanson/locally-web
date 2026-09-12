-- Canonical Locally Production schema-only baseline for a fresh Supabase project.
-- Generated from the read-only PostgreSQL 17 catalog inventory captured on 2026-09-09.
-- No application rows, auth users, Storage objects, credentials, project refs, or
-- environment-owned timestamps are present. Supabase-managed auth/storage tables,
-- system schemas, roles, and platform extensions are prerequisites, not recreated here.
--
-- This is a point-in-time baseline. Do not run the historical patch files before or
-- after it; their final Production effects are already folded into this migration.

begin;
set local check_function_bodies = false;
set local search_path = public, extensions, pg_catalog;

do $baseline_prerequisites$
begin
  if to_regnamespace('auth') is null
     or to_regclass('auth.users') is null
     or to_regnamespace('storage') is null
     or to_regclass('storage.buckets') is null
     or to_regclass('storage.objects') is null then
    raise exception 'Locally baseline requires a fresh Supabase-managed project with auth and storage schemas';
  end if;
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Locally baseline requires the Supabase-managed supabase_realtime publication';
  end if;
end
$baseline_prerequisites$;

create extension if not exists pgcrypto with schema extensions;

-- No application-owned custom types were present in the Production inventory.

-- Application-owned public tables.

create table "public"."admin_audit_logs" (
  "id" uuid default gen_random_uuid() not null,
  "admin_id" uuid,
  "admin_email" text,
  "action_type" text not null,
  "target_type" text,
  "target_id" text,
  "details" jsonb default '{}'::jsonb,
  "ip_address" text,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table "public"."admin_audit_logs" owner to postgres;

create table "public"."admin_job_runs" (
  "id" bigint generated always as identity,
  "job_name" text not null,
  "trigger_source" text not null,
  "scope" text not null,
  "status" text not null,
  "started_at" timestamp with time zone default now() not null,
  "finished_at" timestamp with time zone,
  "duration_ms" integer,
  "initiated_by_admin_id" uuid,
  "target_identifier" text,
  "processed_count" integer default 0 not null,
  "skipped_count" integer default 0 not null,
  "error_message" text,
  "details" jsonb default '{}'::jsonb not null,
  "lease_token" uuid not null,
  "lease_expires_at" timestamp with time zone not null,
  "last_heartbeat_at" timestamp with time zone not null
);
alter table "public"."admin_job_runs" owner to postgres;

create table "public"."admin_manual_payouts" (
  "id" uuid default gen_random_uuid() not null,
  "request_key" uuid not null,
  "host_id" uuid not null,
  "settlement_type" text not null,
  "booking_ids" text[] not null,
  "booking_snapshot" jsonb not null,
  "current_booking_amount" integer not null,
  "legacy_amount" integer default 0 not null,
  "total_paid_amount" integer not null,
  "reason" text not null,
  "legacy_source_reference" text,
  "transfer_reference" text not null,
  "bank_name" text not null,
  "account_number" text not null,
  "account_holder" text not null,
  "paid_by_admin_id" uuid not null,
  "paid_by_admin_email" text not null,
  "paid_at" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null
);
alter table "public"."admin_manual_payouts" owner to postgres;

create table "public"."admin_support_unread_alert_batches" (
  "inquiry_id" bigint not null,
  "is_active" boolean default false not null,
  "first_unread_message_id" bigint,
  "first_unread_message_at" timestamp with time zone,
  "last_unread_message_id" bigint,
  "last_unread_message_at" timestamp with time zone,
  "alert_due_at" timestamp with time zone,
  "in_app_sent_at" timestamp with time zone,
  "email_sent_at" timestamp with time zone,
  "processing_started_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table "public"."admin_support_unread_alert_batches" owner to postgres;

create table "public"."admin_task_comments" (
  "id" uuid default gen_random_uuid() not null,
  "task_id" uuid,
  "created_at" timestamp with time zone default now(),
  "content" text not null,
  "author_id" uuid,
  "author_name" text,
  "metadata" jsonb default '{}'::jsonb,
  "reactions" jsonb default '{}'::jsonb,
  "read_by" text[] default '{}'::text[],
  "client_nonce" text
);
alter table "public"."admin_task_comments" owner to postgres;

create table "public"."admin_tasks" (
  "id" uuid default gen_random_uuid() not null,
  "created_at" timestamp with time zone default now(),
  "type" text not null,
  "content" text not null,
  "is_completed" boolean default false,
  "assignee" text,
  "author_id" uuid,
  "author_name" text,
  "metadata" jsonb default '{}'::jsonb
);
alter table "public"."admin_tasks" owner to postgres;

create table "public"."admin_whitelist" (
  "id" uuid default gen_random_uuid() not null,
  "email" text not null,
  "created_at" timestamp with time zone default now()
);
alter table "public"."admin_whitelist" owner to postgres;

create table "public"."analytics_events" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" text,
  "event_type" text not null,
  "target_id" text,
  "user_id" uuid,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "referrer" text,
  "referrer_host" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "landing_path" text
);
alter table "public"."analytics_events" owner to postgres;

create table "public"."bookings" (
  "id" text not null,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "user_id" uuid,
  "amount" integer not null,
  "order_id" text not null,
  "status" text default 'PAID'::text,
  "experience_id" bigint,
  "is_private" boolean default false,
  "date" date,
  "time" text,
  "type" text,
  "guests" integer,
  "total_price" integer,
  "cancel_reason" text,
  "contact_name" text,
  "contact_phone" text,
  "message" text,
  "tid" text,
  "refund_amount" integer default 0,
  "host_payout_amount" integer default 0,
  "platform_revenue" integer default 0,
  "payout_status" text default 'pending'::text,
  "price_at_booking" numeric default 0,
  "total_experience_price" numeric default 0,
  "payment_method" text default 'card'::text,
  "is_solo_guarantee" boolean default false not null,
  "solo_guarantee_price" integer default 0 not null,
  "payout_paid_at" timestamp with time zone,
  "solo_guarantee_refund_status" text default 'not_applicable'::text not null,
  "solo_guarantee_refund_amount" integer default 0 not null,
  "solo_guarantee_refunded_at" timestamp with time zone,
  "solo_guarantee_refund_error" text,
  "solo_guarantee_refund_trigger_booking_id" text,
  "guest_age_band" text,
  "guest_gender" text
);
alter table "public"."bookings" owner to postgres;

create table "public"."community_comments" (
  "id" uuid default gen_random_uuid() not null,
  "post_id" uuid not null,
  "user_id" uuid not null,
  "content" text not null,
  "is_selected" boolean default false,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table "public"."community_comments" owner to postgres;

create table "public"."community_likes" (
  "id" uuid default gen_random_uuid() not null,
  "post_id" uuid not null,
  "user_id" uuid not null,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table "public"."community_likes" owner to postgres;

create table "public"."community_posts" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "category" text not null,
  "title" text not null,
  "content" text not null,
  "images" text[] default '{}'::text[],
  "companion_date" date,
  "companion_city" text,
  "linked_exp_id" bigint,
  "view_count" integer default 0,
  "like_count" integer default 0,
  "comment_count" integer default 0,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "post_format" text default 'question'::text not null,
  "destination_hub" text,
  "source_locale" text default 'ko'::text not null
);
alter table "public"."community_posts" owner to postgres;

create table "public"."experience_availability" (
  "id" uuid default gen_random_uuid() not null,
  "experience_id" bigint not null,
  "date" date not null,
  "start_time" text not null,
  "is_booked" boolean default false,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table "public"."experience_availability" owner to postgres;

create table "public"."experience_popularity_snapshot" (
  "experience_id" bigint not null,
  "wishlist_count" integer not null,
  "computed_at" timestamp with time zone not null
);
alter table "public"."experience_popularity_snapshot" owner to postgres;

create table "public"."experience_translation_jobs" (
  "id" uuid default gen_random_uuid() not null,
  "experience_id" bigint not null,
  "translation_version" integer not null,
  "source_locale" text not null,
  "status" text default 'queued'::text not null,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone
);
alter table "public"."experience_translation_jobs" owner to postgres;

create table "public"."experience_translation_tasks" (
  "id" uuid default gen_random_uuid() not null,
  "job_id" uuid not null,
  "experience_id" bigint not null,
  "translation_version" integer not null,
  "source_locale" text not null,
  "target_locale" text not null,
  "provider" text not null,
  "status" text default 'queued'::text not null,
  "attempt_count" integer default 0 not null,
  "priority" integer default 100 not null,
  "not_before" timestamp with time zone default timezone('utc'::text, now()) not null,
  "leased_at" timestamp with time zone,
  "lease_expires_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "last_error" text
);
alter table "public"."experience_translation_tasks" owner to postgres;

create table "public"."experiences" (
  "id" bigint generated always as identity,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "title" text not null,
  "description" text,
  "price" numeric not null,
  "image_url" text,
  "location" text,
  "host_id" uuid,
  "category" text,
  "is_active" boolean default true,
  "city" text,
  "country" text,
  "duration" integer,
  "max_guests" integer,
  "spots" text,
  "meeting_point" text,
  "photos" text[],
  "status" text default 'pending'::text,
  "admin_comment" text,
  "inclusions" text[],
  "exclusions" text[],
  "supplies" text,
  "rules" jsonb,
  "itinerary" jsonb,
  "is_private_enabled" boolean default false,
  "private_price" numeric default 0,
  "address" text,
  "languages" text[] default '{}'::text[],
  "title_en" text,
  "description_en" text,
  "category_en" text,
  "title_ja" text,
  "description_ja" text,
  "category_ja" text,
  "title_zh" text,
  "description_zh" text,
  "category_zh" text,
  "rating" numeric default 0,
  "review_count" integer default 0,
  "language_levels" jsonb default '[]'::jsonb not null,
  "title_ko" text,
  "description_ko" text,
  "source_locale" text default 'ko'::text not null,
  "manual_locales" text[] default '{}'::text[] not null,
  "translation_version" integer default 1 not null,
  "translation_meta" jsonb default '{}'::jsonb not null,
  "meeting_point_i18n" jsonb default '{}'::jsonb not null,
  "supplies_i18n" jsonb default '{}'::jsonb not null,
  "inclusions_i18n" jsonb default '{}'::jsonb not null,
  "exclusions_i18n" jsonb default '{}'::jsonb not null,
  "itinerary_i18n" jsonb default '{}'::jsonb not null,
  "rules_i18n" jsonb default '{}'::jsonb not null,
  "solo_guarantee_option_visible" boolean default true not null,
  "solo_guarantee_price" integer default 30000 not null
);
alter table "public"."experiences" owner to postgres;

create table "public"."guest_reviews" (
  "id" bigint generated by default as identity,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "booking_id" text not null,
  "host_id" uuid not null,
  "guest_id" uuid not null,
  "rating" integer not null,
  "content" text
);
alter table "public"."guest_reviews" owner to postgres;

create table "public"."host_applications" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "created_at" timestamp with time zone default now(),
  "status" text default 'pending'::text,
  "name" text,
  "phone" text,
  "birthdate" text,
  "email" text,
  "instagram" text,
  "mbti" text,
  "korean_level" text,
  "korean_cert" text,
  "motivation" text,
  "self_intro" text,
  "tour_location" text,
  "tour_concept" text,
  "tour_course" text,
  "tour_price" text,
  "tour_meeting" text,
  "available_dates" text,
  "bank_name" text,
  "account_number" text,
  "account_holder" text,
  "dob" text,
  "host_nationality" text,
  "target_language" text,
  "language_level" integer,
  "language_cert" text,
  "profile_photo" text,
  "id_card_file" text,
  "source" text,
  "admin_comment" text,
  "languages" text[] default '{}'::text[],
  "language_levels" jsonb default '[]'::jsonb not null,
  "is_superhost" boolean default false not null
);
alter table "public"."host_applications" owner to postgres;

create table "public"."inquiries" (
  "id" bigint generated by default as identity,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "user_id" uuid not null,
  "host_id" uuid,
  "experience_id" bigint,
  "content" text,
  "type" text default 'general'::text,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()),
  "last_email_sent_at" timestamp with time zone,
  "status" text,
  "service_request_id" uuid
);
alter table "public"."inquiries" owner to postgres;

create table "public"."inquiry_messages" (
  "id" bigint generated by default as identity,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "inquiry_id" bigint not null,
  "sender_id" uuid not null,
  "content" text not null,
  "is_read" boolean default false,
  "image_url" text,
  "type" text default 'text'::text,
  "read_at" timestamp with time zone
);
alter table "public"."inquiry_messages" owner to postgres;

create table "public"."likes" (
  "id" bigint generated always as identity,
  "user_id" uuid not null,
  "experience_id" bigint not null,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table "public"."likes" owner to postgres;

create table "public"."messages" (
  "id" bigint generated by default as identity,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "text" text not null,
  "sender" text not null,
  "is_read" boolean default false
);
alter table "public"."messages" owner to postgres;

create table "public"."notifications" (
  "id" bigint generated by default as identity,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "user_id" uuid not null,
  "sender_id" uuid,
  "type" text not null,
  "title" text not null,
  "message" text not null,
  "link" text,
  "is_read" boolean default false,
  "booking_id" text
);
alter table "public"."notifications" owner to postgres;

create table "public"."profile_private_demographics" (
  "user_id" uuid not null,
  "birth_date" date,
  "gender" text,
  "reminder_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table "public"."profile_private_demographics" owner to postgres;

create table "public"."profiles" (
  "id" uuid not null,
  "email" text,
  "full_name" text,
  "avatar_url" text,
  "nationality" text,
  "bio" text,
  "phone" text,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "kakao_id" text,
  "mbti" text,
  "updated_at" timestamp with time zone default now(),
  "last_active_at" timestamp with time zone default now(),
  "languages" text[] default '{}'::text[],
  "job" text,
  "dream_destination" text,
  "favorite_song" text,
  "introduction" text,
  "bank_name" text,
  "account_number" text,
  "account_holder" text,
  "host_nationality" text,
  "motivation" text,
  "dob" text,
  "introduction_en" text,
  "introduction_ja" text,
  "introduction_zh" text,
  "average_rating" numeric(3, 2) default NULL::numeric,
  "total_review_count" integer default 0
);
alter table "public"."profiles" owner to postgres;

create table "public"."proxy_comments" (
  "id" uuid default gen_random_uuid() not null,
  "request_id" uuid not null,
  "author_id" uuid not null,
  "content" text not null,
  "is_admin" boolean default false not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table "public"."proxy_comments" owner to postgres;

create table "public"."proxy_requests" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "category" text not null,
  "status" text default 'PENDING'::text not null,
  "form_data" jsonb default '{}'::jsonb not null,
  "payment_channel" text not null,
  "payment_status" text default 'WAITING'::text not null,
  "naver_buyer_name" text,
  "locally_order_id" text,
  "agreed_to_terms" boolean default false not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "tid" text,
  "paid_at" timestamp with time zone,
  "refunded_at" timestamp with time zone
);
alter table "public"."proxy_requests" owner to postgres;

create table "public"."reviews" (
  "id" bigint generated by default as identity,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "user_id" uuid not null,
  "experience_id" bigint not null,
  "booking_id" text,
  "rating" integer not null,
  "content" text not null,
  "photos" text[] default '{}'::text[],
  "reply" text,
  "reply_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);
alter table "public"."reviews" owner to postgres;

create table "public"."search_logs" (
  "id" uuid default gen_random_uuid() not null,
  "keyword" text not null,
  "user_id" uuid,
  "route" text default 'main'::text,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "session_id" text,
  "referrer" text,
  "referrer_host" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "landing_path" text
);
alter table "public"."search_logs" owner to postgres;

create table "public"."service_applications" (
  "id" uuid default gen_random_uuid() not null,
  "request_id" uuid not null,
  "host_id" uuid not null,
  "appeal_message" text not null,
  "status" text default 'pending'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table "public"."service_applications" owner to postgres;

create table "public"."service_bookings" (
  "id" text not null,
  "order_id" text not null,
  "request_id" uuid not null,
  "application_id" uuid,
  "customer_id" uuid not null,
  "host_id" uuid,
  "amount" integer not null,
  "host_payout_amount" integer,
  "platform_revenue" integer,
  "tid" text,
  "payment_method" text default 'card'::text,
  "status" text default 'PENDING'::text not null,
  "payout_status" text default 'pending'::text,
  "contact_name" text,
  "contact_phone" text,
  "cancel_reason" text,
  "refund_amount" integer,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "payout_paid_at" timestamp with time zone
);
alter table "public"."service_bookings" owner to postgres;

create table "public"."service_requests" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "title" text not null,
  "description" text not null,
  "city" text not null,
  "country" text default 'JP'::text not null,
  "service_date" date not null,
  "start_time" text not null,
  "duration_hours" integer not null,
  "languages" text[] default '{}'::text[] not null,
  "guest_count" integer default 1 not null,
  "hourly_rate_customer" integer default 35000 not null,
  "hourly_rate_host" integer default 20000 not null,
  "total_customer_price" integer generated always as ((hourly_rate_customer * duration_hours)) stored,
  "total_host_payout" integer generated always as ((hourly_rate_host * duration_hours)) stored,
  "status" text default 'open'::text not null,
  "selected_application_id" uuid,
  "selected_host_id" uuid,
  "contact_name" text,
  "contact_phone" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "expires_at" timestamp with time zone
);
alter table "public"."service_requests" owner to postgres;

create table "public"."translation_provider_state" (
  "provider" text not null,
  "model" text not null,
  "rpm_limit" integer not null,
  "tpm_limit" integer,
  "window_seconds" integer default 60 not null,
  "max_concurrency" integer default 1 not null,
  "window_started_at" timestamp with time zone,
  "dispatched_requests" integer default 0 not null,
  "dispatched_tokens" integer default 0 not null,
  "cooldown_until" timestamp with time zone,
  "last_429_at" timestamp with time zone,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table "public"."translation_provider_state" owner to postgres;

create table "public"."users" (
  "id" uuid not null,
  "email" text,
  "full_name" text,
  "avatar_url" text,
  "role" text default 'guest'::text,
  "created_at" timestamp with time zone default timezone('utc'::text, now())
);
alter table "public"."users" owner to postgres;

create table "public"."wishlists" (
  "id" bigint generated by default as identity,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "user_id" uuid not null,
  "experience_id" bigint not null
);
alter table "public"."wishlists" owner to postgres;

-- Primary keys and unique constraints are created before checks and foreign keys.

alter table only "public"."admin_audit_logs" add constraint "admin_audit_logs_pkey" PRIMARY KEY (id);

alter table only "public"."admin_job_runs" add constraint "admin_job_runs_pkey" PRIMARY KEY (id);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_pkey" PRIMARY KEY (id);

alter table only "public"."admin_support_unread_alert_batches" add constraint "admin_support_unread_alert_batches_pkey" PRIMARY KEY (inquiry_id);

alter table only "public"."admin_task_comments" add constraint "admin_task_comments_pkey" PRIMARY KEY (id);

alter table only "public"."admin_tasks" add constraint "admin_tasks_pkey" PRIMARY KEY (id);

alter table only "public"."admin_whitelist" add constraint "admin_whitelist_pkey" PRIMARY KEY (id);

alter table only "public"."analytics_events" add constraint "analytics_events_pkey" PRIMARY KEY (id);

alter table only "public"."bookings" add constraint "bookings_pkey" PRIMARY KEY (id);

alter table only "public"."community_comments" add constraint "community_comments_pkey" PRIMARY KEY (id);

alter table only "public"."community_likes" add constraint "community_likes_pkey" PRIMARY KEY (id);

alter table only "public"."community_posts" add constraint "community_posts_pkey" PRIMARY KEY (id);

alter table only "public"."experience_availability" add constraint "experience_availability_pkey" PRIMARY KEY (id);

alter table only "public"."experience_popularity_snapshot" add constraint "experience_popularity_snapshot_pkey" PRIMARY KEY (experience_id);

alter table only "public"."experience_translation_jobs" add constraint "experience_translation_jobs_pkey" PRIMARY KEY (id);

alter table only "public"."experience_translation_tasks" add constraint "experience_translation_tasks_pkey" PRIMARY KEY (id);

alter table only "public"."experiences" add constraint "experiences_pkey" PRIMARY KEY (id);

alter table only "public"."guest_reviews" add constraint "guest_reviews_pkey" PRIMARY KEY (id);

alter table only "public"."host_applications" add constraint "host_applications_pkey" PRIMARY KEY (id);

alter table only "public"."inquiries" add constraint "inquiries_pkey" PRIMARY KEY (id);

alter table only "public"."inquiry_messages" add constraint "inquiry_messages_pkey" PRIMARY KEY (id);

alter table only "public"."likes" add constraint "likes_pkey" PRIMARY KEY (id);

alter table only "public"."messages" add constraint "messages_pkey" PRIMARY KEY (id);

alter table only "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY (id);

alter table only "public"."profile_private_demographics" add constraint "profile_private_demographics_pkey" PRIMARY KEY (user_id);

alter table only "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);

alter table only "public"."proxy_comments" add constraint "proxy_comments_pkey" PRIMARY KEY (id);

alter table only "public"."proxy_requests" add constraint "proxy_requests_pkey" PRIMARY KEY (id);

alter table only "public"."reviews" add constraint "reviews_pkey" PRIMARY KEY (id);

alter table only "public"."search_logs" add constraint "search_logs_pkey" PRIMARY KEY (id);

alter table only "public"."service_applications" add constraint "service_applications_pkey" PRIMARY KEY (id);

alter table only "public"."service_bookings" add constraint "service_bookings_pkey" PRIMARY KEY (id);

alter table only "public"."service_requests" add constraint "service_requests_pkey" PRIMARY KEY (id);

alter table only "public"."translation_provider_state" add constraint "translation_provider_state_pkey" PRIMARY KEY (provider);

alter table only "public"."users" add constraint "users_pkey" PRIMARY KEY (id);

alter table only "public"."wishlists" add constraint "wishlists_pkey" PRIMARY KEY (id);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_request_key_key" UNIQUE (request_key);

alter table only "public"."admin_whitelist" add constraint "admin_whitelist_email_key" UNIQUE (email);

alter table only "public"."community_likes" add constraint "community_likes_post_id_user_id_key" UNIQUE (post_id, user_id);

alter table only "public"."experience_availability" add constraint "experience_availability_experience_id_date_start_time_key" UNIQUE (experience_id, date, start_time);

alter table only "public"."experience_translation_jobs" add constraint "experience_translation_jobs_experience_version_key" UNIQUE (experience_id, translation_version);

alter table only "public"."experience_translation_tasks" add constraint "experience_translation_tasks_experience_version_locale_key" UNIQUE (experience_id, translation_version, target_locale);

alter table only "public"."guest_reviews" add constraint "guest_reviews_booking_id_key" UNIQUE (booking_id);

alter table only "public"."likes" add constraint "likes_user_id_experience_id_key" UNIQUE (user_id, experience_id);

alter table only "public"."service_applications" add constraint "unique_host_per_request" UNIQUE (request_id, host_id);

alter table only "public"."service_bookings" add constraint "service_bookings_order_id_key" UNIQUE (order_id);

alter table only "public"."wishlists" add constraint "wishlists_user_id_experience_id_key" UNIQUE (user_id, experience_id);

alter table only "public"."admin_job_runs" add constraint "admin_job_runs_scope_check" CHECK (scope = ANY (ARRAY['experience'::text, 'service'::text, 'all'::text]));

alter table only "public"."admin_job_runs" add constraint "admin_job_runs_status_check" CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'failed'::text, 'abandoned'::text]));

alter table only "public"."admin_job_runs" add constraint "admin_job_runs_trigger_source_check" CHECK (trigger_source = ANY (ARRAY['cron'::text, 'manual_run_due'::text, 'manual_force_one'::text]));

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_account_holder_check" CHECK (length(btrim(account_holder)) > 0);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_account_number_check" CHECK (length(btrim(account_number)) > 0);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_bank_name_check" CHECK (length(btrim(bank_name)) > 0);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_booking_ids_check" CHECK (cardinality(booking_ids) > 0);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_booking_snapshot_check" CHECK (jsonb_typeof(booking_snapshot) = 'array'::text);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_current_booking_amount_check" CHECK (current_booking_amount > 0);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_legacy_amount_check" CHECK (legacy_amount >= 0);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_paid_by_admin_email_check" CHECK (length(btrim(paid_by_admin_email)) > 0);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_reason_check" CHECK (length(btrim(reason)) >= 1 AND length(btrim(reason)) <= 1000);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_settlement_type_check" CHECK (settlement_type = ANY (ARRAY['host_exit_final'::text, 'legacy_carryover'::text]));

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_total_check" CHECK (total_paid_amount = (current_booking_amount + legacy_amount));

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_transfer_reference_check" CHECK (length(btrim(transfer_reference)) >= 1 AND length(btrim(transfer_reference)) <= 500);

alter table only "public"."admin_manual_payouts" add constraint "admin_manual_payouts_type_check" CHECK (settlement_type = 'host_exit_final'::text AND legacy_amount = 0 AND legacy_source_reference IS NULL OR settlement_type = 'legacy_carryover'::text AND legacy_amount > 0 AND length(btrim(legacy_source_reference)) >= 1 AND length(btrim(legacy_source_reference)) <= 500);

alter table only "public"."admin_tasks" add constraint "admin_tasks_type_check" CHECK (type = ANY (ARRAY['DAILY_LOG'::text, 'TODO'::text, 'MEMO'::text]));

alter table only "public"."bookings" add constraint "bookings_solo_guarantee_refund_amount_check" CHECK (solo_guarantee_refund_amount >= 0 AND solo_guarantee_refund_amount <= GREATEST(COALESCE(solo_guarantee_price, 0), 0));

alter table only "public"."bookings" add constraint "bookings_solo_guarantee_refund_status_check" CHECK (solo_guarantee_refund_status = ANY (ARRAY['not_applicable'::text, 'processing'::text, 'pending_manual'::text, 'refunded'::text, 'failed'::text]));

alter table only "public"."community_posts" add constraint "community_posts_category_check" CHECK (category = ANY (ARRAY['qna'::text, 'companion'::text, 'info'::text, 'locally_content'::text]));

alter table only "public"."community_posts" add constraint "community_posts_destination_hub_check" CHECK (destination_hub IS NULL OR (destination_hub = ANY (ARRAY['tokyo'::text, 'osaka_kyoto'::text, 'fukuoka'::text, 'jp_other'::text, 'seoul'::text, 'busan'::text, 'jeju'::text])));

alter table only "public"."community_posts" add constraint "community_posts_post_format_check" CHECK (post_format = ANY (ARRAY['question'::text, 'companion'::text, 'live_tip'::text, 'locally_pick'::text]));

alter table only "public"."community_posts" add constraint "community_posts_source_locale_check" CHECK (source_locale = ANY (ARRAY['ko'::text, 'ja'::text, 'en'::text, 'zh'::text]));

alter table only "public"."experience_translation_jobs" add constraint "experience_translation_jobs_source_locale_check" CHECK (source_locale = ANY (ARRAY['ko'::text, 'en'::text, 'ja'::text, 'zh'::text]));

alter table only "public"."experience_translation_jobs" add constraint "experience_translation_jobs_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]));

alter table only "public"."experience_translation_jobs" add constraint "experience_translation_jobs_translation_version_check" CHECK (translation_version >= 1);

alter table only "public"."experience_translation_tasks" add constraint "experience_translation_tasks_attempt_count_check" CHECK (attempt_count >= 0);

alter table only "public"."experience_translation_tasks" add constraint "experience_translation_tasks_priority_check" CHECK (priority >= 0);

alter table only "public"."experience_translation_tasks" add constraint "experience_translation_tasks_provider_check" CHECK (provider = ANY (ARRAY['gemini'::text, 'grok'::text]));

alter table only "public"."experience_translation_tasks" add constraint "experience_translation_tasks_source_locale_check" CHECK (source_locale = ANY (ARRAY['ko'::text, 'en'::text, 'ja'::text, 'zh'::text]));

alter table only "public"."experience_translation_tasks" add constraint "experience_translation_tasks_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'leased'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'retryable'::text, 'cancelled'::text]));

alter table only "public"."experience_translation_tasks" add constraint "experience_translation_tasks_target_locale_check" CHECK (target_locale = ANY (ARRAY['ko'::text, 'en'::text, 'ja'::text, 'zh'::text]));

alter table only "public"."experience_translation_tasks" add constraint "experience_translation_tasks_translation_version_check" CHECK (translation_version >= 1);

alter table only "public"."experiences" add constraint "experiences_solo_guarantee_price_check" CHECK (solo_guarantee_price >= 20000 AND solo_guarantee_price <= 100000 AND (solo_guarantee_price % 1000) = 0);

alter table only "public"."experiences" add constraint "experiences_source_locale_check" CHECK (source_locale = ANY (ARRAY['ko'::text, 'en'::text, 'ja'::text, 'zh'::text]));

alter table only "public"."experiences" add constraint "experiences_translation_version_check" CHECK (translation_version >= 1);

alter table only "public"."guest_reviews" add constraint "guest_reviews_rating_check" CHECK (rating >= 1 AND rating <= 5);

alter table only "public"."proxy_requests" add constraint "proxy_requests_category_check" CHECK (category = ANY (ARRAY['RESTAURANT'::text, 'TRANSPORT'::text, 'HOTEL'::text, 'LOST_AND_FOUND'::text, 'GENERAL'::text]));

alter table only "public"."proxy_requests" add constraint "proxy_requests_payment_channel_check" CHECK (payment_channel = ANY (ARRAY['NAVER'::text, 'LOCALLY'::text]));

alter table only "public"."proxy_requests" add constraint "proxy_requests_payment_status_check" CHECK (payment_status = ANY (ARRAY['WAITING'::text, 'COMPLETED'::text, 'FAILED'::text, 'REFUNDED'::text]));

alter table only "public"."proxy_requests" add constraint "proxy_requests_status_check" CHECK (status = ANY (ARRAY['PENDING'::text, 'IN_PROGRESS'::text, 'COMPLETED'::text, 'CANCELLED'::text]));

alter table only "public"."reviews" add constraint "reviews_rating_check" CHECK (rating >= 1 AND rating <= 5);

alter table only "public"."service_applications" add constraint "service_applications_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'selected'::text, 'rejected'::text, 'withdrawn'::text]));

alter table only "public"."service_bookings" add constraint "service_bookings_payout_status_check" CHECK (payout_status = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text, 'failed'::text]));

alter table only "public"."service_bookings" add constraint "service_bookings_status_check" CHECK (status = ANY (ARRAY['PENDING'::text, 'PAID'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'cancellation_requested'::text]));

alter table only "public"."service_requests" add constraint "service_requests_duration_hours_check" CHECK (duration_hours >= 4);

alter table only "public"."service_requests" add constraint "service_requests_guest_count_check" CHECK (guest_count >= 1);

alter table only "public"."service_requests" add constraint "service_requests_status_check" CHECK (status = ANY (ARRAY['pending_payment'::text, 'open'::text, 'matched'::text, 'paid'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'expired'::text]));

alter table only "public"."translation_provider_state" add constraint "translation_provider_state_dispatched_requests_check" CHECK (dispatched_requests >= 0);

alter table only "public"."translation_provider_state" add constraint "translation_provider_state_dispatched_tokens_check" CHECK (dispatched_tokens >= 0);

alter table only "public"."translation_provider_state" add constraint "translation_provider_state_max_concurrency_check" CHECK (max_concurrency > 0);

alter table only "public"."translation_provider_state" add constraint "translation_provider_state_provider_check" CHECK (provider = ANY (ARRAY['gemini'::text, 'grok'::text]));

alter table only "public"."translation_provider_state" add constraint "translation_provider_state_rpm_limit_check" CHECK (rpm_limit > 0);

alter table only "public"."translation_provider_state" add constraint "translation_provider_state_tpm_limit_check" CHECK (tpm_limit IS NULL OR tpm_limit > 0);

alter table only "public"."translation_provider_state" add constraint "translation_provider_state_window_seconds_check" CHECK (window_seconds > 0);

alter table only "public"."users" add constraint "users_role_check" CHECK (role = ANY (ARRAY['guest'::text, 'host'::text, 'admin'::text]));

alter table only "public"."admin_audit_logs" add constraint "admin_audit_logs_admin_id_fkey" FOREIGN KEY (admin_id) REFERENCES auth.users(id);

alter table only "public"."admin_support_unread_alert_batches" add constraint "admin_support_unread_alert_batches_first_unread_message_id_fkey" FOREIGN KEY (first_unread_message_id) REFERENCES inquiry_messages(id) ON DELETE SET NULL;

alter table only "public"."admin_support_unread_alert_batches" add constraint "admin_support_unread_alert_batches_inquiry_id_fkey" FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE;

alter table only "public"."admin_support_unread_alert_batches" add constraint "admin_support_unread_alert_batches_last_unread_message_id_fkey" FOREIGN KEY (last_unread_message_id) REFERENCES inquiry_messages(id) ON DELETE SET NULL;

alter table only "public"."admin_task_comments" add constraint "admin_task_comments_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id);

alter table only "public"."admin_task_comments" add constraint "admin_task_comments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES admin_tasks(id) ON DELETE CASCADE;

alter table only "public"."admin_tasks" add constraint "admin_tasks_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id);

alter table only "public"."analytics_events" add constraint "analytics_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only "public"."bookings" add constraint "bookings_experience_id_fkey" FOREIGN KEY (experience_id) REFERENCES experiences(id);

alter table only "public"."bookings" add constraint "bookings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);

alter table only "public"."community_comments" add constraint "community_comments_post_id_fkey" FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE;

alter table only "public"."community_comments" add constraint "community_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table only "public"."community_likes" add constraint "community_likes_post_id_fkey" FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE;

alter table only "public"."community_likes" add constraint "community_likes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table only "public"."community_posts" add constraint "community_posts_linked_exp_id_fkey" FOREIGN KEY (linked_exp_id) REFERENCES experiences(id) ON DELETE SET NULL;

alter table only "public"."community_posts" add constraint "community_posts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table only "public"."experience_availability" add constraint "experience_availability_experience_id_fkey" FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE;

alter table only "public"."experience_popularity_snapshot" add constraint "experience_popularity_snapshot_experience_id_fkey" FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE;

alter table only "public"."experience_translation_jobs" add constraint "experience_translation_jobs_experience_id_fkey" FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE;

alter table only "public"."experience_translation_tasks" add constraint "experience_translation_tasks_experience_id_fkey" FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE;

alter table only "public"."experience_translation_tasks" add constraint "experience_translation_tasks_job_id_fkey" FOREIGN KEY (job_id) REFERENCES experience_translation_jobs(id) ON DELETE CASCADE;

alter table only "public"."experiences" add constraint "experiences_host_id_fkey" FOREIGN KEY (host_id) REFERENCES profiles(id);

alter table only "public"."experiences" add constraint "fk_experiences_host" FOREIGN KEY (host_id) REFERENCES profiles(id);

alter table only "public"."guest_reviews" add constraint "guest_reviews_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

alter table only "public"."guest_reviews" add constraint "guest_reviews_guest_id_fkey" FOREIGN KEY (guest_id) REFERENCES profiles(id);

alter table only "public"."guest_reviews" add constraint "guest_reviews_host_id_fkey" FOREIGN KEY (host_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table only "public"."host_applications" add constraint "host_applications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table only "public"."inquiries" add constraint "inquiries_experience_id_fkey" FOREIGN KEY (experience_id) REFERENCES experiences(id);

alter table only "public"."inquiries" add constraint "inquiries_host_id_fkey" FOREIGN KEY (host_id) REFERENCES profiles(id);

alter table only "public"."inquiries" add constraint "inquiries_service_request_id_fkey" FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE SET NULL;

alter table only "public"."inquiries" add constraint "inquiries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);

alter table only "public"."inquiry_messages" add constraint "inquiry_messages_inquiry_id_fkey" FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE;

alter table only "public"."inquiry_messages" add constraint "inquiry_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles(id);

alter table only "public"."likes" add constraint "likes_experience_id_fkey" FOREIGN KEY (experience_id) REFERENCES experiences(id);

alter table only "public"."likes" add constraint "likes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table only "public"."notifications" add constraint "notifications_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table only "public"."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table only "public"."profile_private_demographics" add constraint "profile_private_demographics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table only "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."proxy_comments" add constraint "proxy_comments_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."proxy_comments" add constraint "proxy_comments_request_id_fkey" FOREIGN KEY (request_id) REFERENCES proxy_requests(id) ON DELETE CASCADE;

alter table only "public"."proxy_requests" add constraint "proxy_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."reviews" add constraint "reviews_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id);

alter table only "public"."reviews" add constraint "reviews_experience_id_fkey" FOREIGN KEY (experience_id) REFERENCES experiences(id);

alter table only "public"."reviews" add constraint "reviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);

alter table only "public"."search_logs" add constraint "search_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only "public"."service_applications" add constraint "service_applications_host_id_fkey" FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."service_applications" add constraint "service_applications_request_id_fkey" FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE;

alter table only "public"."service_bookings" add constraint "service_bookings_application_id_fkey" FOREIGN KEY (application_id) REFERENCES service_applications(id);

alter table only "public"."service_bookings" add constraint "service_bookings_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES auth.users(id);

alter table only "public"."service_bookings" add constraint "service_bookings_host_id_fkey" FOREIGN KEY (host_id) REFERENCES auth.users(id);

alter table only "public"."service_bookings" add constraint "service_bookings_request_id_fkey" FOREIGN KEY (request_id) REFERENCES service_requests(id);

alter table only "public"."service_requests" add constraint "service_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."users" add constraint "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id);

alter table only "public"."wishlists" add constraint "wishlists_experience_id_fkey" FOREIGN KEY (experience_id) REFERENCES experiences(id);

alter table only "public"."wishlists" add constraint "wishlists_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Standalone indexes (constraint-backed indexes are created by the constraints above).

CREATE INDEX idx_audit_logs_action_type ON public.admin_audit_logs USING btree (action_type);

CREATE INDEX idx_audit_logs_admin_id ON public.admin_audit_logs USING btree (admin_id);

CREATE INDEX idx_audit_logs_created_at ON public.admin_audit_logs USING btree (created_at DESC);

CREATE INDEX admin_job_runs_job_name_started_at_idx ON public.admin_job_runs USING btree (job_name, started_at DESC);

CREATE UNIQUE INDEX admin_job_runs_running_job_name_idx ON public.admin_job_runs USING btree (job_name) WHERE (status = 'running'::text);

CREATE INDEX idx_admin_manual_payouts_host_paid_at ON public.admin_manual_payouts USING btree (host_id, paid_at DESC);

CREATE INDEX admin_support_unread_alert_batches_active_due_idx ON public.admin_support_unread_alert_batches USING btree (is_active, alert_due_at);

CREATE INDEX admin_support_unread_alert_batches_processing_idx ON public.admin_support_unread_alert_batches USING btree (processing_started_at);

CREATE UNIQUE INDEX admin_task_comments_author_task_nonce_uniq ON public.admin_task_comments USING btree (author_id, task_id, client_nonce) WHERE (client_nonce IS NOT NULL);

CREATE INDEX idx_admin_tasks_created_at ON public.admin_tasks USING btree (created_at DESC);

CREATE INDEX idx_admin_tasks_type ON public.admin_tasks USING btree (type);

CREATE INDEX idx_bookings_payout_status_paid_at ON public.bookings USING btree (payout_status, payout_paid_at);

CREATE UNIQUE INDEX idx_bookings_private_active_slot_unique ON public.bookings USING btree (experience_id, date, "time") WHERE ((type = 'private'::text) AND (lower(status) = ANY (ARRAY['pending'::text, 'paid'::text, 'confirmed'::text])));

CREATE INDEX idx_bookings_solo_guarantee_refund_ops ON public.bookings USING btree (solo_guarantee_refund_status, created_at) WHERE (solo_guarantee_refund_status = ANY (ARRAY['processing'::text, 'pending_manual'::text, 'failed'::text]));

CREATE INDEX idx_bookings_solo_guarantee_refund_slot ON public.bookings USING btree (experience_id, date, "time", solo_guarantee_refund_status) WHERE ((solo_guarantee_price > 0) AND (status = 'completed'::text) AND (solo_guarantee_refund_status = ANY (ARRAY['not_applicable'::text, 'failed'::text])));

CREATE INDEX idx_community_comments_post_id ON public.community_comments USING btree (post_id);

CREATE INDEX idx_community_likes_post_id ON public.community_likes USING btree (post_id);

CREATE INDEX idx_community_posts_category ON public.community_posts USING btree (category);

CREATE INDEX idx_community_posts_created_at ON public.community_posts USING btree (created_at DESC);

CREATE INDEX idx_community_posts_destination_hub ON public.community_posts USING btree (destination_hub);

CREATE INDEX idx_community_posts_post_format ON public.community_posts USING btree (post_format);

CREATE INDEX experience_popularity_snapshot_computed_at_idx ON public.experience_popularity_snapshot USING btree (computed_at DESC);

CREATE INDEX experience_popularity_snapshot_wishlist_count_idx ON public.experience_popularity_snapshot USING btree (wishlist_count DESC);

CREATE INDEX idx_experience_translation_jobs_status_created_at ON public.experience_translation_jobs USING btree (status, created_at);

CREATE INDEX idx_experience_translation_tasks_dispatch ON public.experience_translation_tasks USING btree (status, not_before, provider, priority, id);

CREATE INDEX idx_experience_translation_tasks_experience_version ON public.experience_translation_tasks USING btree (experience_id, translation_version);

CREATE INDEX idx_inquiries_service_request_id ON public.inquiries USING btree (service_request_id, updated_at DESC) WHERE (service_request_id IS NOT NULL);

CREATE UNIQUE INDEX uq_inquiries_service_request_scope ON public.inquiries USING btree (user_id, host_id, service_request_id) WHERE ((service_request_id IS NOT NULL) AND (type = 'general'::text));

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);

CREATE UNIQUE INDEX uq_notifications_guest_review_received_booking_id ON public.notifications USING btree (booking_id) WHERE ((type = 'guest_review_received'::text) AND (booking_id IS NOT NULL));

CREATE UNIQUE INDEX uq_notifications_guest_review_request_booking_id ON public.notifications USING btree (booking_id) WHERE ((type = 'guest_review_request'::text) AND (booking_id IS NOT NULL));

CREATE UNIQUE INDEX uq_notifications_profile_demographics_required_user ON public.notifications USING btree (user_id) WHERE (type = 'profile_demographics_required'::text);

CREATE UNIQUE INDEX uq_notifications_review_request_booking_id ON public.notifications USING btree (booking_id) WHERE ((type = 'review_request'::text) AND (booking_id IS NOT NULL));

CREATE INDEX idx_pc_request ON public.proxy_comments USING btree (request_id);

CREATE INDEX idx_pr_category ON public.proxy_requests USING btree (category);

CREATE INDEX idx_pr_status ON public.proxy_requests USING btree (status);

CREATE INDEX idx_pr_user ON public.proxy_requests USING btree (user_id);

CREATE INDEX idx_proxy_requests_locally_order_id ON public.proxy_requests USING btree (locally_order_id) WHERE (locally_order_id IS NOT NULL);

CREATE UNIQUE INDEX reviews_booking_id_unique_idx ON public.reviews USING btree (booking_id);

CREATE INDEX idx_sa_host ON public.service_applications USING btree (host_id);

CREATE INDEX idx_sa_request ON public.service_applications USING btree (request_id);

CREATE INDEX idx_sb_customer ON public.service_bookings USING btree (customer_id);

CREATE INDEX idx_sb_host ON public.service_bookings USING btree (host_id);

CREATE INDEX idx_sb_request ON public.service_bookings USING btree (request_id);

CREATE INDEX idx_sb_status ON public.service_bookings USING btree (status);

CREATE INDEX idx_service_bookings_payout_status_paid_at ON public.service_bookings USING btree (payout_status, payout_paid_at);

CREATE INDEX idx_service_bookings_request ON public.service_bookings USING btree (request_id, status);

CREATE INDEX idx_service_requests_open_city ON public.service_requests USING btree (city, created_at) WHERE (status = 'open'::text);

CREATE INDEX idx_service_requests_pending_payment ON public.service_requests USING btree (user_id, created_at) WHERE (status = 'pending_payment'::text);

CREATE INDEX idx_sr_city_status ON public.service_requests USING btree (city, status);

CREATE INDEX idx_sr_status_date ON public.service_requests USING btree (status, service_date);

CREATE INDEX idx_sr_user ON public.service_requests USING btree (user_id);

-- Identity sequence settings and ownership generated by the table definitions.

alter sequence "public"."admin_job_runs_id_seq" increment by 1 minvalue 1 start with 1 cache 1 no cycle;

alter sequence "public"."admin_job_runs_id_seq" owner to postgres;

alter sequence "public"."experiences_id_seq" increment by 1 minvalue 1 start with 1 cache 1 no cycle;

alter sequence "public"."experiences_id_seq" owner to postgres;

alter sequence "public"."guest_reviews_id_seq" increment by 1 minvalue 1 start with 1 cache 1 no cycle;

alter sequence "public"."guest_reviews_id_seq" owner to postgres;

alter sequence "public"."inquiries_id_seq" increment by 1 minvalue 1 start with 1 cache 1 no cycle;

alter sequence "public"."inquiries_id_seq" owner to postgres;

alter sequence "public"."inquiry_messages_id_seq" increment by 1 minvalue 1 start with 1 cache 1 no cycle;

alter sequence "public"."inquiry_messages_id_seq" owner to postgres;

alter sequence "public"."likes_id_seq" increment by 1 minvalue 1 start with 1 cache 1 no cycle;

alter sequence "public"."likes_id_seq" owner to postgres;

alter sequence "public"."messages_id_seq" increment by 1 minvalue 1 start with 1 cache 1 no cycle;

alter sequence "public"."messages_id_seq" owner to postgres;

alter sequence "public"."notifications_id_seq" increment by 1 minvalue 1 start with 1 cache 1 no cycle;

alter sequence "public"."notifications_id_seq" owner to postgres;

alter sequence "public"."reviews_id_seq" increment by 1 minvalue 1 start with 1 cache 1 no cycle;

alter sequence "public"."reviews_id_seq" owner to postgres;

alter sequence "public"."wishlists_id_seq" increment by 1 minvalue 1 start with 1 cache 1 no cycle;

alter sequence "public"."wishlists_id_seq" owner to postgres;

-- Public functions/RPCs, including every Production overload.

CREATE OR REPLACE FUNCTION public.check_rate_limit(table_name text, seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  record_exists boolean;
begin
  -- inquiry_messages 테이블 검사
  if table_name = 'inquiry_messages' then
    select exists(
      select 1 from public.inquiry_messages
      where sender_id = auth.uid()
      and created_at > (now() - (seconds || ' seconds')::interval)
    ) into record_exists;

  -- bookings(예약) 테이블 검사 (예약은 5초에 1번만 가능하게)
  elsif table_name = 'bookings' then
    select exists(
      select 1 from public.bookings
      where user_id = auth.uid()
      and created_at > (now() - (seconds || ' seconds')::interval)
    ) into record_exists;
  end if;

  -- 기록이 있으면 false(제한 걸림), 없으면 true(통과)
  if record_exists then
    return false;
  else
    return true;
  end if;
end;
$function$;

alter function public.check_rate_limit(table_name text, seconds integer) owner to postgres;

CREATE OR REPLACE FUNCTION public.claim_due_admin_support_unread_alert_batches(p_limit integer DEFAULT 50)
 RETURNS TABLE(inquiry_id bigint, is_active boolean, first_unread_message_id bigint, first_unread_message_at timestamp with time zone, last_unread_message_id bigint, last_unread_message_at timestamp with time zone, alert_due_at timestamp with time zone, in_app_sent_at timestamp with time zone, email_sent_at timestamp with time zone, processing_started_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit INTEGER := GREATEST(COALESCE(p_limit, 50), 1);
BEGIN
  RETURN QUERY
  WITH due_rows AS (
    SELECT batch.inquiry_id
    FROM public.admin_support_unread_alert_batches AS batch
    WHERE batch.is_active = TRUE
      AND batch.alert_due_at IS NOT NULL
      AND batch.alert_due_at <= now()
      AND (batch.in_app_sent_at IS NULL OR batch.email_sent_at IS NULL)
      AND (
        batch.processing_started_at IS NULL
        OR batch.processing_started_at < now() - interval '15 minutes'
      )
    ORDER BY batch.alert_due_at ASC, batch.inquiry_id ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed_rows AS (
    UPDATE public.admin_support_unread_alert_batches AS batch
    SET
      processing_started_at = now(),
      updated_at = now()
    WHERE batch.inquiry_id IN (SELECT due_rows.inquiry_id FROM due_rows)
    RETURNING
      batch.inquiry_id,
      batch.is_active,
      batch.first_unread_message_id,
      batch.first_unread_message_at,
      batch.last_unread_message_id,
      batch.last_unread_message_at,
      batch.alert_due_at,
      batch.in_app_sent_at,
      batch.email_sent_at,
      batch.processing_started_at,
      batch.created_at,
      batch.updated_at
  )
  SELECT
    claimed_rows.inquiry_id,
    claimed_rows.is_active,
    claimed_rows.first_unread_message_id,
    claimed_rows.first_unread_message_at,
    claimed_rows.last_unread_message_id,
    claimed_rows.last_unread_message_at,
    claimed_rows.alert_due_at,
    claimed_rows.in_app_sent_at,
    claimed_rows.email_sent_at,
    claimed_rows.processing_started_at,
    claimed_rows.created_at,
    claimed_rows.updated_at
  FROM claimed_rows
  ORDER BY claimed_rows.alert_due_at ASC, claimed_rows.inquiry_id ASC;
END;
$function$;

alter function public.claim_due_admin_support_unread_alert_batches(p_limit integer) owner to postgres;

CREATE OR REPLACE FUNCTION public.complete_admin_manual_experience_payout_atomic(p_request_key uuid, p_host_id uuid, p_settlement_type text, p_expected_current_booking_amount integer, p_legacy_amount integer, p_reason text, p_legacy_source_reference text, p_transfer_reference text, p_paid_by_admin_id uuid, p_paid_by_admin_email text)
 RETURNS TABLE(manual_payout_id uuid, request_key uuid, host_id uuid, booking_count integer, current_booking_amount integer, legacy_amount integer, total_paid_amount integer, paid_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.admin_manual_payouts%ROWTYPE;
  v_booking_ids text[];
  v_booking_snapshot jsonb;
  v_current_amount integer;
  v_booking_count integer;
  v_updated_count integer;
  v_paid_at timestamptz := clock_timestamp();
  v_manual_payout_id uuid;
  v_bank_name text;
  v_account_number text;
  v_account_holder text;
BEGIN
  IF p_request_key IS NULL OR p_host_id IS NULL OR p_paid_by_admin_id IS NULL THEN
    RAISE EXCEPTION '필수 식별값이 누락되었습니다.';
  END IF;

  IF p_settlement_type NOT IN ('host_exit_final', 'legacy_carryover') THEN
    RAISE EXCEPTION '지원하지 않는 수동 정산 유형입니다.';
  END IF;

  IF length(btrim(COALESCE(p_reason, ''))) = 0
    OR length(btrim(COALESCE(p_transfer_reference, ''))) = 0
    OR length(btrim(COALESCE(p_paid_by_admin_email, ''))) = 0
  THEN
    RAISE EXCEPTION '사유, 이체 참조값, 관리자 정보는 필수입니다.';
  END IF;

  IF length(btrim(p_reason)) > 1000
    OR length(btrim(p_transfer_reference)) > 500
    OR length(btrim(COALESCE(p_legacy_source_reference, ''))) > 500
  THEN
    RAISE EXCEPTION '정산 사유 또는 참조값이 너무 깁니다.';
  END IF;

  IF p_settlement_type = 'host_exit_final' AND COALESCE(p_legacy_amount, 0) <> 0 THEN
    RAISE EXCEPTION '활동 종료 정산에는 legacy 금액을 포함할 수 없습니다.';
  END IF;

  IF p_settlement_type = 'legacy_carryover' AND (
    COALESCE(p_legacy_amount, 0) <= 0
    OR length(btrim(COALESCE(p_legacy_source_reference, ''))) = 0
  ) THEN
    RAISE EXCEPTION '이전 사이트 이월액과 출처는 필수입니다.';
  END IF;

  -- Serialize manual payout attempts for the same host, including different request keys.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_host_id::text, 0));

  SELECT * INTO v_existing
  FROM public.admin_manual_payouts
  WHERE admin_manual_payouts.request_key = p_request_key;

  IF FOUND THEN
    IF v_existing.host_id <> p_host_id
      OR v_existing.settlement_type <> p_settlement_type
      OR v_existing.current_booking_amount <> p_expected_current_booking_amount
      OR v_existing.legacy_amount <> COALESCE(p_legacy_amount, 0)
      OR v_existing.reason <> btrim(p_reason)
      OR COALESCE(v_existing.legacy_source_reference, '') <> COALESCE(NULLIF(btrim(p_legacy_source_reference), ''), '')
      OR v_existing.transfer_reference <> btrim(p_transfer_reference)
    THEN
      RAISE EXCEPTION '같은 request key가 다른 정산 내용으로 재사용되었습니다.' USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT
      v_existing.id,
      v_existing.request_key,
      v_existing.host_id,
      cardinality(v_existing.booking_ids),
      v_existing.current_booking_amount,
      v_existing.legacy_amount,
      v_existing.total_paid_amount,
      v_existing.paid_at;
    RETURN;
  END IF;

  SELECT ha.bank_name, ha.account_number, ha.account_holder
  INTO v_bank_name, v_account_number, v_account_holder
  FROM public.host_applications AS ha
  WHERE ha.user_id = p_host_id
  ORDER BY ha.created_at DESC
  LIMIT 1;

  IF length(btrim(COALESCE(v_bank_name, ''))) = 0
    OR length(btrim(COALESCE(v_account_number, ''))) = 0
    OR length(btrim(COALESCE(v_account_holder, ''))) = 0
  THEN
    RAISE EXCEPTION '호스트 지급 계좌가 등록되어 있지 않습니다.';
  END IF;

  -- Lock every current experience liability for this host before validating or updating it.
  PERFORM b.id
  FROM public.bookings AS b
  JOIN public.experiences AS e ON e.id = b.experience_id
  WHERE e.host_id = p_host_id
    AND b.payout_status IS DISTINCT FROM 'paid'
    AND b.status IN ('completed', 'COMPLETED', 'cancelled', 'CANCELLED')
  ORDER BY b.id
  FOR UPDATE OF b;

  IF EXISTS (
    SELECT 1
    FROM public.bookings AS b
    JOIN public.experiences AS e ON e.id = b.experience_id
    WHERE e.host_id = p_host_id
      AND b.payout_status IS DISTINCT FROM 'paid'
      AND b.status IN ('completed', 'COMPLETED', 'cancelled', 'CANCELLED')
      AND (
        b.payout_status IS DISTINCT FROM 'pending'
        OR b.host_payout_amount IS NULL
        OR b.host_payout_amount < 0
        OR (
          b.host_payout_amount = 0
          AND b.status NOT IN ('cancelled', 'CANCELLED')
        )
        OR b.solo_guarantee_refund_status IN ('processing', 'pending_manual', 'failed')
      )
  ) THEN
    RAISE EXCEPTION '지급액 또는 환불 상태 확인이 필요한 예약이 포함되어 있습니다.';
  END IF;

  SELECT
    array_agg(b.id::text ORDER BY b.id),
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'order_id', b.order_id,
        'experience_id', b.experience_id,
        'status', b.status,
        'payout_status', b.payout_status,
        'host_payout_amount', b.host_payout_amount,
        'date', b.date,
        'time', b.time
      ) ORDER BY b.id
    ),
    COALESCE(sum(b.host_payout_amount), 0)::integer,
    count(*)::integer
  INTO v_booking_ids, v_booking_snapshot, v_current_amount, v_booking_count
  FROM public.bookings AS b
  JOIN public.experiences AS e ON e.id = b.experience_id
  WHERE e.host_id = p_host_id
    AND b.payout_status = 'pending'
    AND b.status IN ('completed', 'COMPLETED', 'cancelled', 'CANCELLED')
    AND b.host_payout_amount > 0;

  IF v_booking_count = 0 OR v_current_amount <= 0 THEN
    RAISE EXCEPTION '정산할 신규 사이트 체험 미정산액이 없습니다.';
  END IF;

  IF v_current_amount >= 100000 THEN
    RAISE EXCEPTION '10만원 이상 금액은 기존 일반 정산을 이용해야 합니다.';
  END IF;

  IF p_expected_current_booking_amount IS NULL OR p_expected_current_booking_amount <> v_current_amount THEN
    RAISE EXCEPTION '미정산 금액이 변경되었습니다. 새로고침 후 다시 확인해 주세요.';
  END IF;

  IF p_settlement_type = 'host_exit_final' THEN
    IF EXISTS (
      SELECT 1
      FROM public.bookings AS b
      JOIN public.experiences AS e ON e.id = b.experience_id
      WHERE e.host_id = p_host_id
        AND b.status IN ('PAID', 'confirmed')
    ) THEN
      RAISE EXCEPTION '미래 또는 진행 중 체험 예약이 있어 활동 종료 정산을 할 수 없습니다.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.service_bookings AS sb
      WHERE sb.host_id = p_host_id
        AND (
          sb.status IN ('PAID', 'confirmed')
          OR (sb.status = 'completed' AND sb.payout_status IS DISTINCT FROM 'paid')
        )
    ) THEN
      RAISE EXCEPTION '진행 중이거나 미정산인 서비스가 있어 활동 종료 정산을 할 수 없습니다.';
    END IF;
  END IF;

  UPDATE public.bookings AS b
  SET payout_status = 'paid', payout_paid_at = v_paid_at
  WHERE b.id::text = ANY(v_booking_ids)
    AND b.payout_status = 'pending'
    AND b.status IN ('completed', 'COMPLETED', 'cancelled', 'CANCELLED');

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> v_booking_count THEN
    RAISE EXCEPTION '정산 대상이 동시에 변경되었습니다. 새로고침 후 다시 시도해 주세요.';
  END IF;

  INSERT INTO public.admin_manual_payouts (
    request_key, host_id, settlement_type, booking_ids, booking_snapshot,
    current_booking_amount, legacy_amount, total_paid_amount, reason,
    legacy_source_reference, transfer_reference, bank_name, account_number,
    account_holder, paid_by_admin_id, paid_by_admin_email, paid_at
  ) VALUES (
    p_request_key, p_host_id, p_settlement_type, v_booking_ids, v_booking_snapshot,
    v_current_amount, COALESCE(p_legacy_amount, 0), v_current_amount + COALESCE(p_legacy_amount, 0),
    btrim(p_reason), NULLIF(btrim(p_legacy_source_reference), ''), btrim(p_transfer_reference),
    btrim(v_bank_name), btrim(v_account_number), btrim(v_account_holder),
    p_paid_by_admin_id, btrim(p_paid_by_admin_email), v_paid_at
  )
  RETURNING id INTO v_manual_payout_id;

  RETURN QUERY SELECT
    v_manual_payout_id,
    p_request_key,
    p_host_id,
    v_booking_count,
    v_current_amount,
    COALESCE(p_legacy_amount, 0),
    v_current_amount + COALESCE(p_legacy_amount, 0),
    v_paid_at;
END;
$function$;

alter function public.complete_admin_manual_experience_payout_atomic(p_request_key uuid, p_host_id uuid, p_settlement_type text, p_expected_current_booking_amount integer, p_legacy_amount integer, p_reason text, p_legacy_source_reference text, p_transfer_reference text, p_paid_by_admin_id uuid, p_paid_by_admin_email text) owner to postgres;

CREATE OR REPLACE FUNCTION public.complete_experience_booking_if_due_atomic(p_booking_id text)
 RETURNS TABLE(booking_id text, order_id text, user_id uuid, already_processed boolean, not_due boolean, completed boolean, notification_created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_experience_title TEXT;
  v_experience_host_id UUID;
  v_due_at TIMESTAMPTZ;
  v_notification_created BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO v_booking
  FROM public.bookings AS b
  WHERE b.id = trim(p_booking_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXP_COMPLETE_NOT_FOUND: experience booking not found';
  END IF;

  IF lower(COALESCE(v_booking.status, '')) = 'completed' THEN
    RETURN QUERY
    SELECT
      v_booking.id,
      COALESCE(v_booking.order_id, v_booking.id),
      v_booking.user_id::UUID,
      TRUE,
      FALSE,
      FALSE,
      FALSE;
    RETURN;
  END IF;

  IF COALESCE(v_booking.status, '') NOT IN ('PAID', 'confirmed') THEN
    RAISE EXCEPTION 'EXP_COMPLETE_INVALID_STATUS: booking status must be PAID, confirmed, or completed';
  END IF;

  IF v_booking.date IS NULL THEN
    RETURN QUERY
    SELECT
      v_booking.id,
      COALESCE(v_booking.order_id, v_booking.id),
      v_booking.user_id::UUID,
      FALSE,
      TRUE,
      FALSE,
      FALSE;
    RETURN;
  END IF;

  v_due_at := (
    (
      v_booking.date::text
      || ' '
      || COALESCE(NULLIF(v_booking.time, ''), '00:00')
    )::timestamp
    AT TIME ZONE 'Asia/Seoul'
  );

  IF v_due_at >= now() THEN
    RETURN QUERY
    SELECT
      v_booking.id,
      COALESCE(v_booking.order_id, v_booking.id),
      v_booking.user_id::UUID,
      FALSE,
      TRUE,
      FALSE,
      FALSE;
    RETURN;
  END IF;

  SELECT
    COALESCE(e.title, '체험'),
    e.host_id
  INTO
    v_experience_title,
    v_experience_host_id
  FROM public.experiences AS e
  WHERE e.id = v_booking.experience_id;

  UPDATE public.bookings AS b
  SET status = 'completed'
  WHERE b.id = v_booking.id
    AND b.status IN ('PAID', 'confirmed');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXP_COMPLETE_UPDATE_CONFLICT: booking status changed before completion';
  END IF;

  IF v_booking.user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.notifications AS n
      WHERE n.type = 'review_request'
        AND n.booking_id = v_booking.id
    ) THEN
      v_notification_created := FALSE;
    ELSE
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        link,
        is_read,
        created_at,
        booking_id
      )
      VALUES (
        v_booking.user_id,
        'review_request',
        '후기를 남겨주세요!',
        format(
          '''%s'' 어떠셨나요? 소중한 후기를 남겨주세요.',
          COALESCE(v_experience_title, '체험')
        ),
        '/guest/trips',
        FALSE,
        now(),
        v_booking.id
      );

      v_notification_created := TRUE;
    END IF;
  END IF;

  IF
    v_booking.user_id IS NOT NULL
    AND v_experience_host_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.guest_reviews AS gr
      WHERE gr.booking_id = v_booking.id
        AND gr.host_id = v_experience_host_id
    )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications AS n
      WHERE n.type = 'guest_review_request'
        AND n.booking_id = v_booking.id
    ) THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        link,
        is_read,
        created_at,
        booking_id
      )
      VALUES (
        v_experience_host_id,
        'guest_review_request',
        '게스트 평가를 남겨주세요',
        format(
          '''%s'' 체험의 게스트 평가를 남겨주세요.',
          COALESCE(v_experience_title, '체험')
        ),
        '/host/dashboard?tab=reservations',
        FALSE,
        now(),
        v_booking.id
      );
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    v_booking.id,
    COALESCE(v_booking.order_id, v_booking.id),
    v_booking.user_id::UUID,
    FALSE,
    FALSE,
    TRUE,
    v_notification_created;
END;
$function$;

alter function public.complete_experience_booking_if_due_atomic(p_booking_id text) owner to postgres;

CREATE OR REPLACE FUNCTION public.complete_service_booking_if_due_atomic(p_booking_id text)
 RETURNS TABLE(booking_id text, order_id text, request_id uuid, host_id uuid, service_date date, already_processed boolean, not_due boolean, completed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking public.service_bookings%ROWTYPE;
  v_request public.service_requests%ROWTYPE;
  v_today_kst DATE := timezone('Asia/Seoul', now())::date;
  v_booking_updated BOOLEAN := FALSE;
  v_request_updated BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_booking
  FROM public.service_bookings AS sb
  WHERE sb.id = trim(p_booking_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_COMPLETE_NOT_FOUND: service booking not found';
  END IF;

  SELECT * INTO v_request
  FROM public.service_requests AS sr
  WHERE sr.id = v_booking.request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_COMPLETE_REQUEST_MISSING: service request not found';
  END IF;

  IF v_request.service_date IS NULL OR v_request.service_date >= v_today_kst THEN
    RETURN QUERY
    SELECT
      v_booking.id,
      COALESCE(v_booking.order_id, v_booking.id),
      v_booking.request_id::UUID,
      v_booking.host_id::UUID,
      v_request.service_date,
      FALSE,
      TRUE,
      FALSE;
    RETURN;
  END IF;

  IF v_booking.status NOT IN ('PAID', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'SVC_COMPLETE_INVALID_BOOKING_STATUS: booking status must be PAID, confirmed, or completed';
  END IF;

  IF v_request.status NOT IN ('matched', 'paid', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'SVC_COMPLETE_INVALID_REQUEST_STATUS: request status must be matched, paid, confirmed, or completed';
  END IF;

  IF v_booking.status IN ('PAID', 'confirmed') THEN
    UPDATE public.service_bookings AS sb
    SET status = 'completed'
    WHERE sb.id = v_booking.id
      AND sb.status IN ('PAID', 'confirmed');

    v_booking_updated := TRUE;
  END IF;

  IF v_request.status IN ('matched', 'paid', 'confirmed') THEN
    UPDATE public.service_requests AS sr
    SET status = 'completed'
    WHERE sr.id = v_request.id
      AND sr.status IN ('matched', 'paid', 'confirmed');

    v_request_updated := TRUE;
  END IF;

  RETURN QUERY
  SELECT
    v_booking.id,
    COALESCE(v_booking.order_id, v_booking.id),
    v_booking.request_id::UUID,
    v_booking.host_id::UUID,
    v_request.service_date,
    NOT (v_booking_updated OR v_request_updated),
    FALSE,
    (v_booking_updated OR v_request_updated);
END;
$function$;

alter function public.complete_service_booking_if_due_atomic(p_booking_id text) owner to postgres;

CREATE OR REPLACE FUNCTION public.confirm_service_bank_payment_atomic(p_order_id text)
 RETURNS TABLE(booking_id text, order_id text, request_id uuid, customer_id uuid, amount integer, request_title text, request_city text, request_country text, request_duration_hours integer, request_guest_count integer, already_processed boolean, request_was_opened boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking public.service_bookings%ROWTYPE;
  v_request public.service_requests%ROWTYPE;
  v_request_was_opened BOOLEAN := FALSE;
  v_booking_count INTEGER := 0;
  v_request_count INTEGER := 0;
  v_order_id TEXT := trim(p_order_id);
BEGIN
  SELECT * INTO v_booking
  FROM public.service_bookings AS sb
  WHERE sb.order_id = v_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_NOT_FOUND: service booking not found';
  END IF;

  IF COALESCE(lower(v_booking.payment_method), '') <> 'bank' THEN
    RAISE EXCEPTION 'SVC_INVALID_PAYMENT_METHOD: service booking is not bank payment';
  END IF;

  SELECT * INTO v_request
  FROM public.service_requests AS sr
  WHERE sr.id = v_booking.request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_REQUEST_MISSING: service request not found';
  END IF;

  IF v_booking.status IN ('PAID', 'confirmed', 'completed') THEN
    RETURN QUERY
    SELECT
      v_booking.id,
      v_booking.order_id,
      v_booking.request_id::UUID,
      v_booking.customer_id::UUID,
      v_booking.amount::INTEGER,
      v_request.title,
      v_request.city,
      v_request.country,
      v_request.duration_hours::INTEGER,
      v_request.guest_count::INTEGER,
      TRUE,
      v_request.status = 'open';
    RETURN;
  END IF;

  IF v_booking.status <> 'PENDING' THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: booking status must be PENDING';
  END IF;

  IF v_request.status NOT IN ('pending_payment', 'open') THEN
    RAISE EXCEPTION 'SVC_REQUEST_INVALID_STATUS: request status must be pending_payment or open';
  END IF;

  UPDATE public.service_bookings AS sb
  SET status = 'PAID'
  WHERE sb.id = v_booking.id
    AND sb.status = 'PENDING'
    AND COALESCE(lower(sb.payment_method), '') = 'bank';

  GET DIAGNOSTICS v_booking_count = ROW_COUNT;
  IF v_booking_count <> 1 THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: booking no longer pending';
  END IF;

  IF v_request.status = 'pending_payment' THEN
    UPDATE public.service_requests AS sr
    SET status = 'open'
    WHERE sr.id = v_request.id
      AND sr.status = 'pending_payment';

    GET DIAGNOSTICS v_request_count = ROW_COUNT;
    IF v_request_count <> 1 THEN
      RAISE EXCEPTION 'SVC_REQUEST_INVALID_STATUS: request no longer pending_payment';
    END IF;

    v_request_was_opened := TRUE;
  END IF;

  RETURN QUERY
  SELECT
    v_booking.id,
    v_booking.order_id,
    v_booking.request_id::UUID,
    v_booking.customer_id::UUID,
    v_booking.amount::INTEGER,
    v_request.title,
    v_request.city,
    v_request.country,
    v_request.duration_hours::INTEGER,
    v_request.guest_count::INTEGER,
    FALSE,
    v_request_was_opened;
END;
$function$;

alter function public.confirm_service_bank_payment_atomic(p_order_id text) owner to postgres;

CREATE OR REPLACE FUNCTION public.create_booking_atomic(p_user_id uuid, p_experience_id text, p_date text, p_time text, p_guests integer, p_is_private boolean, p_customer_name text, p_customer_phone text, p_payment_method text DEFAULT 'card'::text, p_is_solo_guarantee boolean DEFAULT false)
 RETURNS TABLE(new_order_id text, final_amount numeric, host_id text, experience_title text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_experience_id public.experiences.id%TYPE;
  v_host_id text;
  v_title text;
  v_price numeric;
  v_private_price numeric;
  v_max_guests integer;
  v_solo_guarantee_unit_price numeric;
  v_guest_count integer;
  v_base_host_price numeric;
  v_host_price numeric;
  v_fee numeric;
  v_final_amount numeric;
  v_current_booked integer;
  v_has_private_booking boolean;
  v_confirmed_booked integer;
  v_has_confirmed_private_booking boolean;
  v_slot_key text;
  v_new_order_id text;
  v_booking_date date;
  v_booking_time_text text;
  v_solo_guarantee_price numeric;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'BOOKING_FORBIDDEN:Server-only function' USING errcode = 'P0001';
  END IF;

  IF p_user_id IS NULL
     OR COALESCE(trim(p_experience_id), '') = ''
     OR COALESCE(trim(p_date), '') = ''
     OR COALESCE(trim(p_time), '') = ''
     OR COALESCE(trim(p_customer_name), '') = ''
     OR COALESCE(trim(p_customer_phone), '') = '' THEN
    RAISE EXCEPTION 'BOOKING_BAD_REQUEST:Missing required fields' USING errcode = 'P0001';
  END IF;

  BEGIN
    v_booking_date := p_date::date;
    v_booking_time_text := to_char(p_time::time, 'HH24:MI');
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'BOOKING_BAD_REQUEST:Invalid date/time format' USING errcode = 'P0001';
  END;

  SELECT
    e.id,
    e.host_id::text,
    e.title,
    COALESCE(e.price, 0),
    COALESCE(e.private_price, 0),
    COALESCE(e.max_guests, 10),
    COALESCE(e.solo_guarantee_price, 30000)
  INTO
    v_experience_id,
    v_host_id,
    v_title,
    v_price,
    v_private_price,
    v_max_guests,
    v_solo_guarantee_unit_price
  FROM public.experiences e
  WHERE e.id::text = p_experience_id
  LIMIT 1;

  IF v_experience_id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND:Experience not found' USING errcode = 'P0001';
  END IF;

  v_guest_count := GREATEST(COALESCE(p_guests, 0), 1);
  v_slot_key := format('%s|%s|%s', v_experience_id::text, v_booking_date::text, v_booking_time_text);

  PERFORM pg_advisory_xact_lock(hashtext(v_slot_key)::bigint);

  SELECT
    COALESCE(SUM(b.guests), 0)::int,
    COALESCE(BOOL_OR(b.type = 'private'), false)
  INTO
    v_current_booked,
    v_has_private_booking
  FROM public.bookings b
  WHERE b.experience_id = v_experience_id
    AND b.date = v_booking_date
    AND b.time = v_booking_time_text
    AND lower(b.status::text) IN ('pending', 'paid', 'confirmed');

  IF v_has_private_booking
     OR (p_is_private AND v_current_booked > 0)
     OR ((NOT p_is_private) AND (v_current_booked + v_guest_count > v_max_guests)) THEN
    RAISE EXCEPTION 'BOOKING_CONFLICT:해당 시간대에 남은 좌석이 부족합니다.' USING errcode = 'P0001';
  END IF;

  IF COALESCE(p_is_solo_guarantee, false) AND (p_is_private OR v_guest_count <> 1) THEN
    RAISE EXCEPTION 'BOOKING_BAD_REQUEST:Solo guarantee is only available for shared solo bookings' USING errcode = 'P0001';
  END IF;

  SELECT
    COALESCE(SUM(b.guests), 0)::int,
    COALESCE(BOOL_OR(b.type = 'private'), false)
  INTO
    v_confirmed_booked,
    v_has_confirmed_private_booking
  FROM public.bookings b
  WHERE b.experience_id = v_experience_id
    AND b.date = v_booking_date
    AND b.time = v_booking_time_text
    AND lower(b.status::text) IN ('paid', 'confirmed');

  IF COALESCE(p_is_solo_guarantee, false)
     AND (v_confirmed_booked > 0 OR v_has_confirmed_private_booking) THEN
    RAISE EXCEPTION 'BOOKING_BAD_REQUEST:Solo guarantee is unavailable when confirmed bookings already exist' USING errcode = 'P0001';
  END IF;

  v_solo_guarantee_price := CASE
    WHEN COALESCE(p_is_solo_guarantee, false) AND NOT p_is_private AND v_guest_count = 1
      THEN v_solo_guarantee_unit_price
    ELSE 0
  END;

  v_base_host_price := CASE WHEN p_is_private THEN v_private_price ELSE v_price * v_guest_count END;
  v_host_price := v_base_host_price + v_solo_guarantee_price;
  v_fee := floor(v_base_host_price * 0.1);
  v_final_amount := v_host_price + v_fee;

  LOOP
    v_new_order_id := format(
      'ORD-%s-%s',
      to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
      lpad((floor(random() * 1000))::int::text, 3, '0')
    );

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.order_id = v_new_order_id
         OR b.id::text = v_new_order_id
    );
  END LOOP;

  INSERT INTO public.bookings (
    id,
    order_id,
    user_id,
    experience_id,
    amount,
    total_price,
    status,
    guests,
    date,
    time,
    type,
    contact_name,
    contact_phone,
    message,
    created_at,
    payment_method,
    is_solo_guarantee,
    solo_guarantee_price
  ) VALUES (
    v_new_order_id,
    v_new_order_id,
    p_user_id,
    v_experience_id,
    v_final_amount,
    v_host_price,
    'PENDING',
    v_guest_count,
    v_booking_date,
    v_booking_time_text,
    CASE WHEN p_is_private THEN 'private' ELSE 'group' END,
    p_customer_name,
    p_customer_phone,
    '',
    now(),
    COALESCE(p_payment_method, 'card'),
    v_solo_guarantee_price > 0,
    v_solo_guarantee_price::integer
  );

  RETURN QUERY
  SELECT
    v_new_order_id,
    v_final_amount,
    v_host_id,
    COALESCE(v_title, 'Locally 체험');
END;
$function$;

alter function public.create_booking_atomic(p_user_id uuid, p_experience_id text, p_date text, p_time text, p_guests integer, p_is_private boolean, p_customer_name text, p_customer_phone text, p_payment_method text, p_is_solo_guarantee boolean) owner to postgres;

CREATE OR REPLACE FUNCTION public.create_guest_review_with_notification_atomic(p_booking_id text, p_host_id uuid, p_rating integer, p_content text, p_notification_title text, p_notification_message text)
 RETURNS TABLE(outcome text, review_id bigint, guest_id uuid, notification_created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_experience_host_id UUID;
  v_review_id BIGINT;
  v_notification_created BOOLEAN := FALSE;
  v_content TEXT := trim(COALESCE(p_content, ''));
BEGIN
  IF
    trim(COALESCE(p_booking_id, '')) = ''
    OR p_host_id IS NULL
    OR p_rating IS NULL
    OR p_rating < 1
    OR p_rating > 5
    OR v_content = ''
  THEN
    RETURN QUERY SELECT 'invalid_payload', NULL::BIGINT, NULL::UUID, FALSE;
    RETURN;
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings AS b
  WHERE b.id = trim(p_booking_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found', NULL::BIGINT, NULL::UUID, FALSE;
    RETURN;
  END IF;

  IF v_booking.user_id IS NULL THEN
    RETURN QUERY SELECT 'invalid_payload', NULL::BIGINT, NULL::UUID, FALSE;
    RETURN;
  END IF;

  SELECT e.host_id
  INTO v_experience_host_id
  FROM public.experiences AS e
  WHERE e.id = v_booking.experience_id;

  IF v_experience_host_id IS NULL OR v_experience_host_id <> p_host_id THEN
    RETURN QUERY SELECT 'forbidden', NULL::BIGINT, v_booking.user_id::UUID, FALSE;
    RETURN;
  END IF;

  IF COALESCE(v_booking.status, '') <> 'completed' THEN
    RETURN QUERY SELECT 'invalid_status', NULL::BIGINT, v_booking.user_id::UUID, FALSE;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.guest_reviews AS gr
    WHERE gr.booking_id = v_booking.id
      AND gr.host_id = p_host_id
  ) THEN
    RETURN QUERY SELECT 'duplicate', NULL::BIGINT, v_booking.user_id::UUID, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.guest_reviews (
    booking_id,
    host_id,
    guest_id,
    rating,
    content
  )
  VALUES (
    v_booking.id,
    p_host_id,
    v_booking.user_id,
    p_rating,
    v_content
  )
  RETURNING id
  INTO v_review_id;

  IF EXISTS (
    SELECT 1
    FROM public.notifications AS n
    WHERE n.type = 'guest_review_received'
      AND n.booking_id = v_booking.id
  ) THEN
    v_notification_created := FALSE;
  ELSE
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      link,
      is_read,
      created_at,
      booking_id
    )
    VALUES (
      v_booking.user_id,
      'guest_review_received',
      COALESCE(NULLIF(trim(p_notification_title), ''), '호스트가 평가를 남겼습니다'),
      COALESCE(
        NULLIF(trim(p_notification_message), ''),
        '호스트가 회원님에 대한 평가를 남겼습니다.'
      ),
      '/account',
      FALSE,
      now(),
      v_booking.id
    );

    v_notification_created := TRUE;
  END IF;

  RETURN QUERY
  SELECT
    'created',
    v_review_id,
    v_booking.user_id::UUID,
    v_notification_created;
END;
$function$;

alter function public.create_guest_review_with_notification_atomic(p_booking_id text, p_host_id uuid, p_rating integer, p_content text, p_notification_title text, p_notification_message text) owner to postgres;

CREATE OR REPLACE FUNCTION public.create_service_booking_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid, p_contact_name text, p_contact_phone text)
 RETURNS TABLE(new_order_id text, final_amount integer, host_payout integer, platform_margin integer, host_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request         public.service_requests%ROWTYPE;
  v_application     public.service_applications%ROWTYPE;
  v_order_id        TEXT;
  v_amount          INTEGER;
  v_host_payout     INTEGER;
  v_platform_margin INTEGER;
BEGIN
  -- [1] service_requests 행 잠금 (경쟁 예약 방지)
  SELECT * INTO v_request
  FROM public.service_requests
  WHERE id = p_request_id
  FOR UPDATE;

  -- [2] 존재 여부 검증
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_NOT_FOUND: 의뢰를 찾을 수 없습니다. request_id=%', p_request_id;
  END IF;

  -- [3] 상태 검증 — 반드시 'matched' 상태여야 결제 가능
  IF v_request.status != 'matched' THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: 결제 가능한 상태가 아닙니다. 현재 status=%', v_request.status;
  END IF;

  -- [4] 고객 소유권 검증
  IF v_request.user_id != p_customer_id THEN
    RAISE EXCEPTION 'SVC_FORBIDDEN: 해당 의뢰의 소유자가 아닙니다.';
  END IF;

  -- [5] 선택된 지원서 일치 검증
  IF v_request.selected_application_id IS NULL OR v_request.selected_application_id != p_application_id THEN
    RAISE EXCEPTION 'SVC_BAD_REQUEST: 선택된 지원서가 일치하지 않습니다.';
  END IF;

  -- [6] service_applications 조회 및 상태 검증
  SELECT * INTO v_application
  FROM public.service_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_NOT_FOUND: 지원서를 찾을 수 없습니다. application_id=%', p_application_id;
  END IF;

  IF v_application.status != 'selected' THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: 지원서 상태가 selected가 아닙니다. 현재 status=%', v_application.status;
  END IF;

  -- [7] 금액 계산 (generated column 값 사용)
  v_amount          := v_request.total_customer_price;  -- 35,000 × hours
  v_host_payout     := v_request.total_host_payout;     -- 20,000 × hours
  v_platform_margin := v_amount - v_host_payout;        -- 15,000 × hours (내부용)

  -- [8] SVC- 접두사 주문번호 생성 (기존 예약과 명확히 구분)
  v_order_id := 'SVC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::TEXT, 1, 8));

  -- [9] service_bookings 삽입
  INSERT INTO public.service_bookings (
    id,
    order_id,
    request_id,
    application_id,
    customer_id,
    host_id,
    amount,
    host_payout_amount,
    platform_revenue,
    status,
    contact_name,
    contact_phone
  ) VALUES (
    v_order_id,
    v_order_id,
    p_request_id,
    p_application_id,
    p_customer_id,
    v_application.host_id,
    v_amount,
    v_host_payout,
    v_platform_margin,
    'PENDING',
    p_contact_name,
    p_contact_phone
  );

  -- [10] service_requests 상태 유지 (결제 완료는 callback에서 'paid'로 변경)
  -- 여기서는 상태 변경 없음 — callback API가 검증 후 변경

  -- [11] 결과 반환
  RETURN QUERY SELECT
    v_order_id,
    v_amount,
    v_host_payout,
    v_platform_margin,
    v_application.host_id;

END;
$function$;

alter function public.create_service_booking_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid, p_contact_name text, p_contact_phone text) owner to postgres;

CREATE OR REPLACE FUNCTION public.create_service_request_with_booking_atomic(p_user_id uuid, p_title text, p_description text, p_city text, p_country text, p_service_date date, p_start_time text, p_duration_hours integer, p_languages text[], p_guest_count integer, p_contact_name text, p_contact_phone text)
 RETURNS TABLE(request_id uuid, booking_id text, order_id text, amount integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.service_requests%ROWTYPE;
  v_booking_id TEXT;
  v_order_id TEXT;
BEGIN
  INSERT INTO public.service_requests (
    user_id,
    title,
    description,
    city,
    country,
    service_date,
    start_time,
    duration_hours,
    languages,
    guest_count,
    contact_name,
    contact_phone,
    status
  )
  VALUES (
    p_user_id,
    trim(p_title),
    trim(p_description),
    p_city,
    p_country,
    p_service_date,
    p_start_time,
    p_duration_hours,
    COALESCE(p_languages, ARRAY[]::TEXT[]),
    p_guest_count,
    trim(p_contact_name),
    trim(p_contact_phone),
    'pending_payment'
  )
  RETURNING * INTO v_request;

  v_order_id := 'SVC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::TEXT, 1, 8));
  v_booking_id := v_order_id;

  INSERT INTO public.service_bookings (
    id,
    order_id,
    request_id,
    application_id,
    customer_id,
    host_id,
    amount,
    host_payout_amount,
    platform_revenue,
    status,
    contact_name,
    contact_phone,
    payment_method,
    payout_status
  )
  VALUES (
    v_booking_id,
    v_order_id,
    v_request.id,
    NULL,
    p_user_id,
    NULL,
    v_request.total_customer_price,
    v_request.total_host_payout,
    v_request.total_customer_price - v_request.total_host_payout,
    'PENDING',
    trim(p_contact_name),
    trim(p_contact_phone),
    'card',
    'pending'
  );

  RETURN QUERY
  SELECT
    v_request.id,
    v_booking_id,
    v_order_id,
    v_request.total_customer_price;
END;
$function$;

alter function public.create_service_request_with_booking_atomic(p_user_id uuid, p_title text, p_description text, p_city text, p_country text, p_service_date date, p_start_time text, p_duration_hours integer, p_languages text[], p_guest_count integer, p_contact_name text, p_contact_phone text) owner to postgres;

CREATE OR REPLACE FUNCTION public.decrement_comment_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.community_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
  RETURN OLD;
END;
$function$;

alter function public.decrement_comment_count() owner to postgres;

CREATE OR REPLACE FUNCTION public.decrement_like_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.community_posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
  RETURN OLD;
END;
$function$;

alter function public.decrement_like_count() owner to postgres;

CREATE OR REPLACE FUNCTION public.ensure_profile_demographics_reminder(p_user_id uuid, p_title text, p_message text, p_link text DEFAULT '/account?complete=demographics'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_demographics public.profile_private_demographics%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'DEMOGRAPHICS_REMINDER_FORBIDDEN' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.profile_private_demographics (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO v_demographics
  FROM public.profile_private_demographics
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_demographics.birth_date IS NOT NULL
     AND NULLIF(trim(v_demographics.gender), '') IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  IF v_demographics.reminder_sent_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, title, message, link, is_read, created_at
  ) VALUES (
    p_user_id,
    'profile_demographics_required',
    COALESCE(NULLIF(trim(p_title), ''), '예약 전 필수 정보를 입력해 주세요'),
    COALESCE(NULLIF(trim(p_message), ''), '생년월일과 성별을 입력하면 호스트가 체험을 더 잘 준비할 수 있습니다.'),
    COALESCE(NULLIF(trim(p_link), ''), '/account?complete=demographics'),
    FALSE,
    now()
  )
  ON CONFLICT (user_id) WHERE type = 'profile_demographics_required' DO NOTHING;

  UPDATE public.profile_private_demographics
  SET reminder_sent_at = now(), updated_at = now()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$function$;

alter function public.ensure_profile_demographics_reminder(p_user_id uuid, p_title text, p_message text, p_link text) owner to postgres;

CREATE OR REPLACE FUNCTION public.get_experience_completion_due_backlog()
 RETURNS TABLE(due_count bigint, oldest_due_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH due_rows AS (
    SELECT
      (
        (b.date::text || ' ' || COALESCE(NULLIF(b.time, ''), '00:00'))::timestamp
        AT TIME ZONE 'Asia/Seoul'
      ) AS due_at_kst_utc
    FROM public.bookings AS b
    WHERE b.status IN ('PAID', 'confirmed')
      AND b.date IS NOT NULL
  )
  SELECT
    COUNT(*)::BIGINT AS due_count,
    MIN(due_at_kst_utc) AS oldest_due_at
  FROM due_rows
  WHERE due_at_kst_utc < now();
$function$;

alter function public.get_experience_completion_due_backlog() owner to postgres;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_birth_date DATE;
  v_gender TEXT;
BEGIN
  BEGIN
    IF COALESCE(NEW.raw_user_meta_data->>'birth_date', '') ~ '^\d{8}$' THEN
      v_birth_date := to_date(NEW.raw_user_meta_data->>'birth_date', 'YYYYMMDD');
    ELSE
      v_birth_date := NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::DATE;
    END IF;
  EXCEPTION WHEN others THEN
    v_birth_date := NULL;
  END;

  v_gender := CASE
    WHEN trim(NEW.raw_user_meta_data->>'gender') IN ('Male', 'Female', 'Other')
      THEN trim(NEW.raw_user_meta_data->>'gender')
    ELSE NULL
  END;

  BEGIN
    INSERT INTO public.profiles (
      id, email, full_name, avatar_url, phone, nationality
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      NULLIF(NEW.raw_user_meta_data->>'phone', ''),
      NULLIF(NEW.raw_user_meta_data->>'nationality', '')
    );
  EXCEPTION WHEN others THEN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
    );
  END;

  INSERT INTO public.profile_private_demographics (user_id, birth_date, gender)
  VALUES (NEW.id, v_birth_date, v_gender)
  ON CONFLICT (user_id) DO UPDATE
  SET birth_date = COALESCE(profile_private_demographics.birth_date, EXCLUDED.birth_date),
      gender = COALESCE(profile_private_demographics.gender, EXCLUDED.gender),
      updated_at = now();

  RETURN NEW;
END;
$function$;

alter function public.handle_new_user() owner to postgres;

CREATE OR REPLACE FUNCTION public.increment_comment_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$function$;

alter function public.increment_comment_count() owner to postgres;

CREATE OR REPLACE FUNCTION public.increment_community_post_view_count(p_post_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_next_view_count bigint;
begin
  update public.community_posts
  set view_count = coalesce(view_count, 0) + 1
  where id = p_post_id
  returning view_count into v_next_view_count;

  return v_next_view_count;
end;
$function$;

alter function public.increment_community_post_view_count(p_post_id uuid) owner to postgres;

CREATE OR REPLACE FUNCTION public.increment_like_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.community_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$function$;

alter function public.increment_like_count() owner to postgres;

CREATE OR REPLACE FUNCTION public.is_admin_reader()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  current_email text := NULLIF(trim(auth.jwt() ->> 'email'), '');
  current_role text := NULL;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role
  INTO current_role
  FROM public.users
  WHERE id = current_user_id
  LIMIT 1;

  IF current_role = 'admin' THEN
    RETURN true;
  END IF;

  IF current_email IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_whitelist
    WHERE email = current_email
  );
END;
$function$;

alter function public.is_admin_reader() owner to postgres;

CREATE OR REPLACE FUNCTION public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone DEFAULT timezone('utc'::text, now()), p_lease_seconds integer DEFAULT 180, p_reserved_tokens integer DEFAULT 0)
 RETURNS TABLE(id uuid, job_id uuid, experience_id bigint, translation_version integer, source_locale text, target_locale text, provider text, attempt_count integer, priority integer, lease_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  provider_state public.translation_provider_state%ROWTYPE;
  leased_task public.experience_translation_tasks%ROWTYPE;
  active_leases integer := 0;
  effective_lease_seconds integer := GREATEST(COALESCE(p_lease_seconds, 180), 30);
  reserved_tokens integer := GREATEST(COALESCE(p_reserved_tokens, 0), 0);
BEGIN
  IF p_provider NOT IN ('gemini', 'grok') THEN
    RETURN;
  END IF;

  SELECT *
  INTO provider_state
  FROM public.translation_provider_state
  WHERE translation_provider_state.provider = p_provider
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF provider_state.cooldown_until IS NOT NULL AND provider_state.cooldown_until > p_now THEN
    RETURN;
  END IF;

  IF provider_state.window_started_at IS NULL
    OR provider_state.window_started_at + make_interval(secs => provider_state.window_seconds) <= p_now
  THEN
    UPDATE public.translation_provider_state
    SET
      window_started_at = p_now,
      dispatched_requests = 0,
      dispatched_tokens = 0,
      updated_at = p_now
    WHERE translation_provider_state.provider = p_provider;

    provider_state.window_started_at := p_now;
    provider_state.dispatched_requests := 0;
    provider_state.dispatched_tokens := 0;
  END IF;

  SELECT COUNT(*)
  INTO active_leases
  FROM public.experience_translation_tasks
  WHERE experience_translation_tasks.provider = p_provider
    AND experience_translation_tasks.status IN ('leased', 'processing')
    AND experience_translation_tasks.lease_expires_at IS NOT NULL
    AND experience_translation_tasks.lease_expires_at > p_now;

  IF active_leases >= provider_state.max_concurrency THEN
    RETURN;
  END IF;

  IF provider_state.dispatched_requests >= provider_state.rpm_limit THEN
    RETURN;
  END IF;

  IF provider_state.tpm_limit IS NOT NULL
    AND provider_state.dispatched_tokens + reserved_tokens > provider_state.tpm_limit
  THEN
    RETURN;
  END IF;

  SELECT *
  INTO leased_task
  FROM public.experience_translation_tasks
  WHERE experience_translation_tasks.provider = p_provider
    AND experience_translation_tasks.status IN ('queued', 'retryable')
    AND experience_translation_tasks.not_before <= p_now
  ORDER BY experience_translation_tasks.priority ASC, experience_translation_tasks.id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.experience_translation_tasks
  SET
    status = 'leased',
    leased_at = p_now,
    lease_expires_at = p_now + make_interval(secs => effective_lease_seconds)
  WHERE experience_translation_tasks.id = leased_task.id;

  UPDATE public.translation_provider_state
  SET
    dispatched_requests = provider_state.dispatched_requests + 1,
    dispatched_tokens = provider_state.dispatched_tokens + reserved_tokens,
    updated_at = p_now
  WHERE translation_provider_state.provider = p_provider;

  RETURN QUERY
  SELECT
    leased_task.id,
    leased_task.job_id,
    leased_task.experience_id,
    leased_task.translation_version,
    leased_task.source_locale,
    leased_task.target_locale,
    leased_task.provider,
    leased_task.attempt_count,
    leased_task.priority,
    p_now + make_interval(secs => effective_lease_seconds);
END;
$function$;

alter function public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone, p_lease_seconds integer, p_reserved_tokens integer) owner to postgres;

CREATE OR REPLACE FUNCTION public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone DEFAULT timezone('utc'::text, now()), p_lease_seconds integer DEFAULT 180)
 RETURNS TABLE(id uuid, job_id uuid, experience_id bigint, translation_version integer, source_locale text, target_locale text, provider text, attempt_count integer, priority integer, lease_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  provider_state public.translation_provider_state%ROWTYPE;
  leased_task public.experience_translation_tasks%ROWTYPE;
  active_leases integer := 0;
  effective_lease_seconds integer := GREATEST(COALESCE(p_lease_seconds, 180), 30);
BEGIN
  IF p_provider NOT IN ('gemini', 'grok') THEN
    RETURN;
  END IF;

  SELECT *
  INTO provider_state
  FROM public.translation_provider_state
  WHERE translation_provider_state.provider = p_provider
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF provider_state.cooldown_until IS NOT NULL AND provider_state.cooldown_until > p_now THEN
    RETURN;
  END IF;

  IF provider_state.window_started_at IS NULL
    OR provider_state.window_started_at + make_interval(secs => provider_state.window_seconds) <= p_now
  THEN
    UPDATE public.translation_provider_state
    SET
      window_started_at = p_now,
      dispatched_requests = 0,
      dispatched_tokens = 0,
      updated_at = p_now
    WHERE translation_provider_state.provider = p_provider;

    provider_state.window_started_at := p_now;
    provider_state.dispatched_requests := 0;
    provider_state.dispatched_tokens := 0;
  END IF;

  SELECT COUNT(*)
  INTO active_leases
  FROM public.experience_translation_tasks
  WHERE experience_translation_tasks.provider = p_provider
    AND experience_translation_tasks.status IN ('leased', 'processing')
    AND experience_translation_tasks.lease_expires_at IS NOT NULL
    AND experience_translation_tasks.lease_expires_at > p_now;

  IF active_leases >= provider_state.max_concurrency THEN
    RETURN;
  END IF;

  IF provider_state.dispatched_requests >= provider_state.rpm_limit THEN
    RETURN;
  END IF;

  SELECT *
  INTO leased_task
  FROM public.experience_translation_tasks
  WHERE experience_translation_tasks.provider = p_provider
    AND experience_translation_tasks.status IN ('queued', 'retryable')
    AND experience_translation_tasks.not_before <= p_now
  ORDER BY experience_translation_tasks.priority ASC, experience_translation_tasks.id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.experience_translation_tasks
  SET
    status = 'leased',
    leased_at = p_now,
    lease_expires_at = p_now + make_interval(secs => effective_lease_seconds)
  WHERE experience_translation_tasks.id = leased_task.id;

  UPDATE public.translation_provider_state
  SET
    dispatched_requests = provider_state.dispatched_requests + 1,
    updated_at = p_now
  WHERE translation_provider_state.provider = p_provider;

  RETURN QUERY
  SELECT
    leased_task.id,
    leased_task.job_id,
    leased_task.experience_id,
    leased_task.translation_version,
    leased_task.source_locale,
    leased_task.target_locale,
    leased_task.provider,
    leased_task.attempt_count,
    leased_task.priority,
    p_now + make_interval(secs => effective_lease_seconds);
END;
$function$;

alter function public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone, p_lease_seconds integer) owner to postgres;

CREATE OR REPLACE FUNCTION public.list_due_experience_completion_candidates(p_booking_id text DEFAULT NULL::text)
 RETURNS TABLE(booking_id text, order_id text, user_id uuid, date date, "time" text, status text, experience_title text, due_at_kst_utc timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH candidate_rows AS (
    SELECT
      b.id AS booking_id,
      COALESCE(b.order_id, b.id) AS order_id,
      b.user_id,
      b.date,
      b.time,
      b.status,
      COALESCE(e.title, '체험') AS experience_title,
      (
        (b.date::text || ' ' || COALESCE(NULLIF(b.time, ''), '00:00'))::timestamp
        AT TIME ZONE 'Asia/Seoul'
      ) AS due_at_kst_utc
    FROM public.bookings AS b
    LEFT JOIN public.experiences AS e
      ON e.id = b.experience_id
    WHERE b.status IN ('PAID', 'confirmed')
      AND b.date IS NOT NULL
      AND (
        p_booking_id IS NULL
        OR b.id = trim(p_booking_id)
      )
  )
  SELECT
    booking_id,
    order_id,
    user_id::UUID,
    date::DATE,
    time,
    status,
    experience_title,
    due_at_kst_utc
  FROM candidate_rows
  WHERE due_at_kst_utc < now()
  ORDER BY due_at_kst_utc ASC;
$function$;

alter function public.list_due_experience_completion_candidates(p_booking_id text) owner to postgres;

CREATE OR REPLACE FUNCTION public.mark_room_messages_read(p_room_id uuid, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  UPDATE public.admin_task_comments
  SET read_by = CASE
    WHEN read_by IS NULL THEN ARRAY[p_user_id::TEXT]
    WHEN NOT (p_user_id::TEXT = ANY(read_by)) THEN array_append(read_by, p_user_id::TEXT)
    ELSE read_by
  END
  WHERE task_id = p_room_id
    AND author_id <> p_user_id
    AND (read_by IS NULL OR NOT (p_user_id::TEXT = ANY(read_by)));

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$function$;

alter function public.mark_room_messages_read(p_room_id uuid, p_user_id uuid) owner to postgres;

CREATE OR REPLACE FUNCTION public.prune_notifications_retention(p_cutoff timestamp with time zone, p_batch_size integer DEFAULT 1000)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_batch_size INTEGER;
  v_deleted_count INTEGER := 0;
BEGIN
  IF p_cutoff IS NULL THEN
    RAISE EXCEPTION 'p_cutoff is required';
  END IF;

  v_batch_size := LEAST(GREATEST(COALESCE(p_batch_size, 1000), 1), 5000);
  PERFORM pg_advisory_xact_lock(hashtext('notifications_retention_cleanup_v1'));

  WITH deletion_candidates AS (
    SELECT id
    FROM public.notifications
    WHERE created_at < p_cutoff
      AND NOT (type = 'profile_demographics_required' AND is_read = FALSE)
    ORDER BY created_at ASC, id ASC
    LIMIT v_batch_size
  ), deleted_notifications AS (
    DELETE FROM public.notifications AS n
    USING deletion_candidates AS c
    WHERE n.id = c.id
    RETURNING n.id
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_count
  FROM deleted_notifications;

  RETURN COALESCE(v_deleted_count, 0);
END;
$function$;

alter function public.prune_notifications_retention(p_cutoff timestamp with time zone, p_batch_size integer) owner to postgres;

CREATE OR REPLACE FUNCTION public.prune_team_workspace_comments(p_task_id uuid, p_keep_limit integer DEFAULT 100)
 RETURNS TABLE(comment_id uuid, image_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('team_workspace_comments_retention_v1'),
    hashtext(COALESCE(p_task_id::text, ''))
  );

  RETURN QUERY
  WITH overflow AS (
    SELECT id
    FROM public.admin_task_comments
    WHERE task_id = p_task_id
    ORDER BY created_at DESC, id DESC
    OFFSET GREATEST(COALESCE(p_keep_limit, 100), 0)
  ),
  deleted_comments AS (
    DELETE FROM public.admin_task_comments c
    USING overflow o
    WHERE c.id = o.id
    RETURNING c.id, c.metadata
  )
  SELECT
    d.id AS comment_id,
    CASE
      WHEN d.metadata IS NOT NULL
        AND jsonb_typeof(d.metadata) = 'object'
        AND COALESCE(d.metadata ->> 'image_url', '') <> ''
      THEN d.metadata ->> 'image_url'
      ELSE NULL
    END AS image_url
  FROM deleted_comments d;
END;
$function$;

alter function public.prune_team_workspace_comments(p_task_id uuid, p_keep_limit integer) owner to postgres;

CREATE OR REPLACE FUNCTION public.prune_team_workspace_tasks(p_keep_limit integer DEFAULT 100)
 RETURNS TABLE(task_id uuid, task_type text, task_content text, comment_image_urls jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('team_workspace_tasks_retention_v1'));

  RETURN QUERY
  WITH overflow AS (
    SELECT id, type, content
    FROM public.admin_tasks
    ORDER BY created_at DESC, id DESC
    OFFSET GREATEST(COALESCE(p_keep_limit, 100), 0)
  ),
  task_assets AS (
    SELECT
      o.id AS task_id,
      o.type::text AS task_type,
      o.content::text AS task_content,
      COALESCE(
        jsonb_agg(c.metadata ->> 'image_url')
          FILTER (
            WHERE c.metadata IS NOT NULL
              AND jsonb_typeof(c.metadata) = 'object'
              AND COALESCE(c.metadata ->> 'image_url', '') <> ''
          ),
        '[]'::jsonb
      ) AS comment_image_urls
    FROM overflow o
    LEFT JOIN public.admin_task_comments c
      ON c.task_id = o.id
    GROUP BY o.id, o.type, o.content
  ),
  deleted_comments AS (
    DELETE FROM public.admin_task_comments c
    USING overflow o
    WHERE c.task_id = o.id
    RETURNING c.id
  ),
  deleted_tasks AS (
    DELETE FROM public.admin_tasks t
    USING overflow o
    WHERE t.id = o.id
    RETURNING t.id
  )
  SELECT
    a.task_id,
    a.task_type,
    a.task_content,
    a.comment_image_urls
  FROM task_assets a
  JOIN deleted_tasks d
    ON d.id = a.task_id;
END;
$function$;

alter function public.prune_team_workspace_tasks(p_keep_limit integer) owner to postgres;

CREATE OR REPLACE FUNCTION public.record_translation_provider_outcome(p_provider text, p_token_count integer DEFAULT 0, p_cooldown_seconds integer DEFAULT NULL::integer, p_hit_quota boolean DEFAULT false, p_reserved_token_count integer DEFAULT 0)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.translation_provider_state
  SET
    dispatched_tokens = GREATEST(
      dispatched_tokens
      - GREATEST(COALESCE(p_reserved_token_count, 0), 0)
      + GREATEST(COALESCE(p_token_count, 0), 0),
      0
    ),
    cooldown_until = CASE
      WHEN p_cooldown_seconds IS NULL OR p_cooldown_seconds <= 0 THEN cooldown_until
      ELSE timezone('utc'::text, now()) + make_interval(secs => p_cooldown_seconds)
    END,
    last_429_at = CASE
      WHEN p_hit_quota THEN timezone('utc'::text, now())
      ELSE last_429_at
    END,
    updated_at = timezone('utc'::text, now())
  WHERE translation_provider_state.provider = p_provider;
$function$;

alter function public.record_translation_provider_outcome(p_provider text, p_token_count integer, p_cooldown_seconds integer, p_hit_quota boolean, p_reserved_token_count integer) owner to postgres;

CREATE OR REPLACE FUNCTION public.record_translation_provider_outcome(p_provider text, p_token_count integer DEFAULT 0, p_cooldown_seconds integer DEFAULT NULL::integer, p_hit_quota boolean DEFAULT false)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.translation_provider_state
  SET
    dispatched_tokens = dispatched_tokens + GREATEST(COALESCE(p_token_count, 0), 0),
    cooldown_until = CASE
      WHEN p_cooldown_seconds IS NULL OR p_cooldown_seconds <= 0 THEN cooldown_until
      ELSE timezone('utc'::text, now()) + make_interval(secs => p_cooldown_seconds)
    END,
    last_429_at = CASE
      WHEN p_hit_quota THEN timezone('utc'::text, now())
      ELSE last_429_at
    END,
    updated_at = timezone('utc'::text, now())
  WHERE translation_provider_state.provider = p_provider;
$function$;

alter function public.record_translation_provider_outcome(p_provider text, p_token_count integer, p_cooldown_seconds integer, p_hit_quota boolean) owner to postgres;

CREATE OR REPLACE FUNCTION public.refresh_experience_popularity_snapshot()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  snapshot_now timestamptz := now();
  inserted_count integer := 0;
begin
  truncate table public.experience_popularity_snapshot;

  insert into public.experience_popularity_snapshot (
    experience_id,
    wishlist_count,
    computed_at
  )
  select
    w.experience_id,
    count(*)::integer as wishlist_count,
    snapshot_now
  from public.wishlists w
  group by w.experience_id;

  get diagnostics inserted_count = row_count;
  return coalesce(inserted_count, 0);
end;
$function$;

alter function public.refresh_experience_popularity_snapshot() owner to postgres;

CREATE OR REPLACE FUNCTION public.select_service_host_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid)
 RETURNS TABLE(selected_host_id uuid, selected_application_id uuid, rejected_host_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.service_requests%ROWTYPE;
  v_application public.service_applications%ROWTYPE;
  v_booking_count INTEGER;
  v_selected_count INTEGER;
  v_request_count INTEGER;
  v_rejected_host_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  SELECT * INTO v_request
  FROM public.service_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_NOT_FOUND: request not found';
  END IF;

  IF v_request.user_id <> p_customer_id THEN
    RAISE EXCEPTION 'SVC_FORBIDDEN: request owner mismatch';
  END IF;

  IF v_request.status <> 'open' THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: request status must be open';
  END IF;

  SELECT * INTO v_application
  FROM public.service_applications
  WHERE id = p_application_id
    AND request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_NOT_FOUND: application not found';
  END IF;

  IF v_application.status <> 'pending' THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: application status must be pending';
  END IF;

  UPDATE public.service_bookings
  SET
    host_id = v_application.host_id,
    application_id = p_application_id
  WHERE request_id = p_request_id
    AND status IN ('PAID', 'PENDING');

  GET DIAGNOSTICS v_booking_count = ROW_COUNT;
  IF v_booking_count = 0 THEN
    RAISE EXCEPTION 'SVC_BOOKING_MISSING: escrow booking not found';
  END IF;

  UPDATE public.service_applications
  SET status = 'selected'
  WHERE id = p_application_id
    AND status = 'pending';

  GET DIAGNOSTICS v_selected_count = ROW_COUNT;
  IF v_selected_count <> 1 THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: application no longer pending';
  END IF;

  WITH rejected AS (
    UPDATE public.service_applications
    SET status = 'rejected'
    WHERE request_id = p_request_id
      AND id <> p_application_id
      AND status = 'pending'
    RETURNING host_id
  )
  SELECT COALESCE(array_agg(host_id), ARRAY[]::UUID[])
  INTO v_rejected_host_ids
  FROM rejected;

  UPDATE public.service_requests
  SET
    status = 'matched',
    selected_application_id = p_application_id,
    selected_host_id = v_application.host_id
  WHERE id = p_request_id
    AND status = 'open';

  GET DIAGNOSTICS v_request_count = ROW_COUNT;
  IF v_request_count <> 1 THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: request no longer open';
  END IF;

  RETURN QUERY
  SELECT
    v_application.host_id,
    p_application_id,
    v_rejected_host_ids;
END;
$function$;

alter function public.select_service_host_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid) owner to postgres;

CREATE OR REPLACE FUNCTION public.set_proxy_comments_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

alter function public.set_proxy_comments_updated_at() owner to postgres;

CREATE OR REPLACE FUNCTION public.set_proxy_requests_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

alter function public.set_proxy_requests_updated_at() owner to postgres;

CREATE OR REPLACE FUNCTION public.set_service_applications_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

alter function public.set_service_applications_updated_at() owner to postgres;

CREATE OR REPLACE FUNCTION public.set_service_bookings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

alter function public.set_service_bookings_updated_at() owner to postgres;

CREATE OR REPLACE FUNCTION public.set_service_requests_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

alter function public.set_service_requests_updated_at() owner to postgres;

CREATE OR REPLACE FUNCTION public.snapshot_booking_guest_demographics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_birth_date DATE;
  v_age INTEGER;
  v_gender TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.birth_date, NULLIF(trim(d.gender), '')
  INTO v_birth_date, v_gender
  FROM public.profile_private_demographics AS d
  WHERE d.user_id = NEW.user_id;

  NEW.guest_gender := COALESCE(NEW.guest_gender, v_gender);

  IF NEW.guest_age_band IS NULL
     AND v_birth_date IS NOT NULL
     AND v_birth_date <= COALESCE(NEW.created_at::date, CURRENT_DATE) THEN
    v_age := GREATEST(
      0,
      date_part('year', age(COALESCE(NEW.created_at::date, CURRENT_DATE), v_birth_date))::INTEGER
    );
    NEW.guest_age_band := CASE
      WHEN v_age < 10 THEN 'under_10'
      WHEN v_age >= 80 THEN '80_plus'
      ELSE ((v_age / 10) * 10)::TEXT || 's'
    END;
  END IF;

  RETURN NEW;
END;
$function$;

alter function public.snapshot_booking_guest_demographics() owner to postgres;

-- Public views and their security options.

create view "public"."public_host_applications" with (security_invoker=false) as
WITH latest_per_user AS (
         SELECT DISTINCT ON (host_applications.user_id) host_applications.id,
            host_applications.user_id,
            host_applications.status,
            host_applications.name,
            host_applications.profile_photo,
            host_applications.languages,
            host_applications.self_intro,
            host_applications.created_at,
            host_applications.is_superhost
           FROM host_applications
          ORDER BY host_applications.user_id, host_applications.created_at DESC, host_applications.id DESC
        )
 SELECT id,
    user_id,
    status,
    name,
    profile_photo,
    languages,
    self_intro,
    created_at,
    is_superhost
   FROM latest_per_user
  WHERE (status = 'approved'::text);

alter view "public"."public_host_applications" owner to postgres;

create view "public"."public_profiles" with (security_barrier=true, security_invoker=false) as
SELECT id,
    full_name,
    avatar_url,
    nationality,
    bio,
    created_at,
    mbti,
    languages,
    job,
    dream_destination,
    favorite_song,
    introduction,
    host_nationality,
    introduction_en,
    introduction_ja,
    introduction_zh,
    average_rating,
    total_review_count
   FROM profiles;

alter view "public"."public_profiles" owner to postgres;

-- Locally-owned triggers. Supabase-managed Storage triggers are intentionally excluded.

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER set_booking_guest_demographics_snapshot BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION snapshot_booking_guest_demographics();

CREATE TRIGGER on_comment_added AFTER INSERT ON community_comments FOR EACH ROW EXECUTE FUNCTION increment_comment_count();

CREATE TRIGGER on_comment_removed AFTER DELETE ON community_comments FOR EACH ROW EXECUTE FUNCTION decrement_comment_count();

CREATE TRIGGER on_like_added AFTER INSERT ON community_likes FOR EACH ROW EXECUTE FUNCTION increment_like_count();

CREATE TRIGGER on_like_removed AFTER DELETE ON community_likes FOR EACH ROW EXECUTE FUNCTION decrement_like_count();

CREATE TRIGGER trg_pc_updated_at BEFORE UPDATE ON proxy_comments FOR EACH ROW EXECUTE FUNCTION set_proxy_comments_updated_at();

CREATE TRIGGER trg_pr_updated_at BEFORE UPDATE ON proxy_requests FOR EACH ROW EXECUTE FUNCTION set_proxy_requests_updated_at();

CREATE TRIGGER trg_sa_updated_at BEFORE UPDATE ON service_applications FOR EACH ROW EXECUTE FUNCTION set_service_applications_updated_at();

CREATE TRIGGER trg_sb_updated_at BEFORE UPDATE ON service_bookings FOR EACH ROW EXECUTE FUNCTION set_service_bookings_updated_at();

CREATE TRIGGER trg_sr_updated_at BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION set_service_requests_updated_at();

-- Explicit row-level-security state for every application table.

alter table "public"."admin_audit_logs" enable row level security;

alter table "public"."admin_audit_logs" no force row level security;

alter table "public"."admin_job_runs" disable row level security;

alter table "public"."admin_job_runs" no force row level security;

alter table "public"."admin_manual_payouts" enable row level security;

alter table "public"."admin_manual_payouts" no force row level security;

alter table "public"."admin_support_unread_alert_batches" disable row level security;

alter table "public"."admin_support_unread_alert_batches" no force row level security;

alter table "public"."admin_task_comments" enable row level security;

alter table "public"."admin_task_comments" no force row level security;

alter table "public"."admin_tasks" enable row level security;

alter table "public"."admin_tasks" no force row level security;

alter table "public"."admin_whitelist" enable row level security;

alter table "public"."admin_whitelist" no force row level security;

alter table "public"."analytics_events" enable row level security;

alter table "public"."analytics_events" no force row level security;

alter table "public"."bookings" enable row level security;

alter table "public"."bookings" no force row level security;

alter table "public"."community_comments" enable row level security;

alter table "public"."community_comments" no force row level security;

alter table "public"."community_likes" enable row level security;

alter table "public"."community_likes" no force row level security;

alter table "public"."community_posts" enable row level security;

alter table "public"."community_posts" no force row level security;

alter table "public"."experience_availability" enable row level security;

alter table "public"."experience_availability" no force row level security;

alter table "public"."experience_popularity_snapshot" enable row level security;

alter table "public"."experience_popularity_snapshot" no force row level security;

alter table "public"."experience_translation_jobs" enable row level security;

alter table "public"."experience_translation_jobs" no force row level security;

alter table "public"."experience_translation_tasks" enable row level security;

alter table "public"."experience_translation_tasks" no force row level security;

alter table "public"."experiences" enable row level security;

alter table "public"."experiences" no force row level security;

alter table "public"."guest_reviews" enable row level security;

alter table "public"."guest_reviews" no force row level security;

alter table "public"."host_applications" enable row level security;

alter table "public"."host_applications" no force row level security;

alter table "public"."inquiries" enable row level security;

alter table "public"."inquiries" no force row level security;

alter table "public"."inquiry_messages" enable row level security;

alter table "public"."inquiry_messages" no force row level security;

alter table "public"."likes" enable row level security;

alter table "public"."likes" no force row level security;

alter table "public"."messages" enable row level security;

alter table "public"."messages" no force row level security;

alter table "public"."notifications" enable row level security;

alter table "public"."notifications" no force row level security;

alter table "public"."profile_private_demographics" enable row level security;

alter table "public"."profile_private_demographics" no force row level security;

alter table "public"."profiles" enable row level security;

alter table "public"."profiles" no force row level security;

alter table "public"."proxy_comments" enable row level security;

alter table "public"."proxy_comments" no force row level security;

alter table "public"."proxy_requests" enable row level security;

alter table "public"."proxy_requests" no force row level security;

alter table "public"."reviews" enable row level security;

alter table "public"."reviews" no force row level security;

alter table "public"."search_logs" enable row level security;

alter table "public"."search_logs" no force row level security;

alter table "public"."service_applications" enable row level security;

alter table "public"."service_applications" no force row level security;

alter table "public"."service_bookings" enable row level security;

alter table "public"."service_bookings" no force row level security;

alter table "public"."service_requests" enable row level security;

alter table "public"."service_requests" no force row level security;

alter table "public"."translation_provider_state" enable row level security;

alter table "public"."translation_provider_state" no force row level security;

alter table "public"."users" enable row level security;

alter table "public"."users" no force row level security;

alter table "public"."wishlists" enable row level security;

alter table "public"."wishlists" no force row level security;

-- Production RLS policies for application tables and storage.objects.

create policy "admin_audit_logs_admin_read_only" on "public"."admin_audit_logs" as PERMISSIVE for SELECT to "authenticated" using (is_admin_reader());

create policy "admin_audit_logs_service_role_only" on "public"."admin_audit_logs" as PERMISSIVE for ALL to "service_role" using (true) with check (true);

create policy "admin_task_comments_admin_read_only" on "public"."admin_task_comments" as PERMISSIVE for SELECT to "authenticated" using (is_admin_reader());

create policy "admin_task_comments_service_role_only" on "public"."admin_task_comments" as PERMISSIVE for ALL to "service_role" using (true) with check (true);

create policy "admin_tasks_admin_read_only" on "public"."admin_tasks" as PERMISSIVE for SELECT to "authenticated" using (is_admin_reader());

create policy "admin_tasks_service_role_only" on "public"."admin_tasks" as PERMISSIVE for ALL to "service_role" using (true) with check (true);

create policy "admin_whitelist_admin_read_only" on "public"."admin_whitelist" as PERMISSIVE for SELECT to "authenticated" using (is_admin_reader());

create policy "admin_whitelist_service_role_only" on "public"."admin_whitelist" as PERMISSIVE for ALL to "service_role" using (true) with check (true);

create policy "analytics_events_insert_service_role_only" on "public"."analytics_events" as PERMISSIVE for INSERT to "service_role" with check (true);

create policy "Enable read for admin" on "public"."analytics_events" as PERMISSIVE for SELECT to PUBLIC using (true);

create policy "bookings_insert_service_role_only" on "public"."bookings" as PERMISSIVE for INSERT to "service_role" with check (true);

create policy "Enable read access for own bookings" on "public"."bookings" as PERMISSIVE for SELECT to PUBLIC using ((auth.uid() = user_id));

create policy "Host view bookings" on "public"."bookings" as PERMISSIVE for SELECT to PUBLIC using (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM experiences
  WHERE ((experiences.id = bookings.experience_id) AND (experiences.host_id = auth.uid()))))));

create policy "Hosts can view bookings for their experiences" on "public"."bookings" as PERMISSIVE for SELECT to PUBLIC using ((experience_id IN ( SELECT experiences.id
   FROM experiences
  WHERE (experiences.host_id = auth.uid()))));

create policy "Hosts can view bookings for their own experiences" on "public"."bookings" as PERMISSIVE for SELECT to PUBLIC using ((EXISTS ( SELECT 1
   FROM experiences
  WHERE ((experiences.id = bookings.experience_id) AND (experiences.host_id = auth.uid())))));

create policy "Users can update their own bookings" on "public"."bookings" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = user_id));

create policy "Users can view own bookings" on "public"."bookings" as PERMISSIVE for SELECT to PUBLIC using ((auth.uid() = user_id));

create policy "Users can view their own bookings" on "public"."bookings" as PERMISSIVE for SELECT to "authenticated" using ((auth.uid() = user_id));

create policy "게스트는 자신의 예약만 볼 수 있습니다" on "public"."bookings" as PERMISSIVE for SELECT to PUBLIC using ((auth.uid() = user_id));

create policy "관계자(게스트/호스트)만 예약을 업데이트할 수" on "public"."bookings" as PERMISSIVE for UPDATE to PUBLIC using (((auth.uid() = user_id) OR (experience_id IN ( SELECT experiences.id
   FROM experiences
  WHERE (experiences.host_id = auth.uid())))));

create policy "내 예약만 보기" on "public"."bookings" as PERMISSIVE for SELECT to PUBLIC using ((auth.uid() = user_id));

create policy "호스트는 자신의 체험 예약만 볼 수 있습니다" on "public"."bookings" as PERMISSIVE for SELECT to PUBLIC using ((experience_id IN ( SELECT experiences.id
   FROM experiences
  WHERE (experiences.host_id = auth.uid()))));

create policy "Anyone can view comments" on "public"."community_comments" as PERMISSIVE for SELECT to PUBLIC using (true);

create policy "Authenticated users can create comments" on "public"."community_comments" as PERMISSIVE for INSERT to "authenticated" with check ((auth.uid() = user_id));

create policy "Users can delete their own comments" on "public"."community_comments" as PERMISSIVE for DELETE to "authenticated" using ((auth.uid() = user_id));

create policy "Users can update their own comments" on "public"."community_comments" as PERMISSIVE for UPDATE to "authenticated" using ((auth.uid() = user_id));

create policy "Anyone can view likes" on "public"."community_likes" as PERMISSIVE for SELECT to PUBLIC using (true);

create policy "Authenticated users can like posts" on "public"."community_likes" as PERMISSIVE for INSERT to "authenticated" with check ((auth.uid() = user_id));

create policy "Users can unlike posts" on "public"."community_likes" as PERMISSIVE for DELETE to "authenticated" using ((auth.uid() = user_id));

create policy "Anyone can view community posts" on "public"."community_posts" as PERMISSIVE for SELECT to PUBLIC using (true);

create policy "Authenticated users can create posts" on "public"."community_posts" as PERMISSIVE for INSERT to "authenticated" with check ((auth.uid() = user_id));

create policy "Users can delete their own posts" on "public"."community_posts" as PERMISSIVE for DELETE to "authenticated" using ((auth.uid() = user_id));

create policy "Users can update their own posts" on "public"."community_posts" as PERMISSIVE for UPDATE to "authenticated" using ((auth.uid() = user_id));

create policy "Enable public read access" on "public"."experience_availability" as PERMISSIVE for SELECT to PUBLIC using (true);

create policy "Hosts can delete their own availability" on "public"."experience_availability" as PERMISSIVE for DELETE to PUBLIC using ((auth.uid() = ( SELECT experiences.host_id
   FROM experiences
  WHERE (experiences.id = experience_availability.experience_id))));

create policy "Hosts can insert their own availability" on "public"."experience_availability" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = ( SELECT experiences.host_id
   FROM experiences
  WHERE (experiences.id = experience_availability.experience_id))));

create policy "Hosts can view their own availability" on "public"."experience_availability" as PERMISSIVE for SELECT to PUBLIC using ((auth.uid() = ( SELECT experiences.host_id
   FROM experiences
  WHERE (experiences.id = experience_availability.experience_id))));

create policy "Public can read experience popularity snapshot" on "public"."experience_popularity_snapshot" as PERMISSIVE for SELECT to "anon", "authenticated" using (true);

create policy "experience_translation_jobs_service_role_only" on "public"."experience_translation_jobs" as PERMISSIVE for ALL to "service_role" using (true) with check (true);

create policy "experience_translation_tasks_service_role_only" on "public"."experience_translation_tasks" as PERMISSIVE for ALL to "service_role" using (true) with check (true);

create policy "Enable insert for authenticated users" on "public"."experiences" as PERMISSIVE for INSERT to PUBLIC with check ((auth.role() = 'authenticated'::text));

create policy "Enable update for owners" on "public"."experiences" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = host_id));

create policy "Experiences are viewable by everyone" on "public"."experiences" as PERMISSIVE for SELECT to PUBLIC using (true);

create policy "Hosts can delete own experiences" on "public"."experiences" as PERMISSIVE for DELETE to PUBLIC using ((auth.uid() = host_id));

create policy "Hosts can insert experiences" on "public"."experiences" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() IN ( SELECT users.id
   FROM users
  WHERE (users.role = ANY (ARRAY['host'::text, 'admin'::text])))));

create policy "Hosts can update own experiences" on "public"."experiences" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = host_id));

create policy "Hosts can update their own experiences" on "public"."experiences" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = host_id));

create policy "Public read access" on "public"."experiences" as PERMISSIVE for SELECT to PUBLIC using (true);

create policy "Users can update own experiences or Admins can update all" on "public"."experiences" as PERMISSIVE for UPDATE to PUBLIC using (((auth.uid() = host_id) OR (( SELECT users.role
   FROM users
  WHERE (users.id = auth.uid())) = 'admin'::text)));

create policy "호스트는 자신의 모든 체험을 볼 수 있습니다" on "public"."experiences" as PERMISSIVE for SELECT to PUBLIC using ((auth.uid() = host_id));

create policy "호스트는 자신의 체험만 등록/수정할 수 있습니" on "public"."experiences" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = host_id));

create policy "호스트는 자신의 체험만 수정할 수 있습니다" on "public"."experiences" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = host_id));

create policy "활성화된 체험은 누구나 볼 수 있습니다" on "public"."experiences" as PERMISSIVE for SELECT to PUBLIC using ((status = 'active'::text));

create policy "Host can insert reviews" on "public"."guest_reviews" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = host_id));

create policy "Users can view reviews" on "public"."guest_reviews" as PERMISSIVE for SELECT to PUBLIC using (true);

create policy "ha_delete_own" on "public"."host_applications" as PERMISSIVE for DELETE to PUBLIC using ((auth.uid() = user_id));

create policy "ha_insert_own" on "public"."host_applications" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = user_id));

create policy "ha_select_own" on "public"."host_applications" as PERMISSIVE for SELECT to PUBLIC using ((auth.uid() = user_id));

create policy "ha_update_own" on "public"."host_applications" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

create policy "Create inquiries" on "public"."inquiries" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = user_id));

create policy "inquiries_select_admin" on "public"."inquiries" as PERMISSIVE for SELECT to "authenticated" using (is_admin_reader());

create policy "inquiries_select_participant" on "public"."inquiries" as PERMISSIVE for SELECT to "authenticated" using (((auth.uid() = user_id) OR (auth.uid() = host_id)));

create policy "Users can update own inquiries" on "public"."inquiries" as PERMISSIVE for UPDATE to PUBLIC using (((auth.uid() = user_id) OR (auth.uid() = host_id)));

create policy "inquiry_messages_select_admin" on "public"."inquiry_messages" as PERMISSIVE for SELECT to "authenticated" using (is_admin_reader());

create policy "inquiry_messages_select_participant" on "public"."inquiry_messages" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM inquiries inquiry
  WHERE ((inquiry.id = inquiry_messages.inquiry_id) AND ((inquiry.user_id = auth.uid()) OR (inquiry.host_id = auth.uid()))))));

create policy "Users can update messages in their inquiries" on "public"."inquiry_messages" as PERMISSIVE for UPDATE to PUBLIC using ((EXISTS ( SELECT 1
   FROM inquiries i
  WHERE ((i.id = inquiry_messages.inquiry_id) AND ((i.user_id = auth.uid()) OR (i.host_id = auth.uid()))))));

create policy "Enable delete for users" on "public"."likes" as PERMISSIVE for DELETE to PUBLIC using ((auth.uid() = user_id));

create policy "Enable insert for authenticated users" on "public"."likes" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = user_id));

create policy "Enable read access for own likes" on "public"."likes" as PERMISSIVE for SELECT to PUBLIC using ((auth.uid() = user_id));

create policy "Likes access" on "public"."likes" as PERMISSIVE for ALL to PUBLIC using ((auth.uid() = user_id));

create policy "Public messages access" on "public"."messages" as PERMISSIVE for ALL to PUBLIC using (true);

create policy "누구나 볼 수 있음" on "public"."messages" as PERMISSIVE for SELECT to PUBLIC using (true);

create policy "누구나 쓸 수 있음" on "public"."messages" as PERMISSIVE for INSERT to PUBLIC with check (true);

create policy "notifications_read_own" on "public"."notifications" as PERMISSIVE for SELECT to "authenticated" using ((auth.uid() = user_id));

create policy "notifications_write_service_role" on "public"."notifications" as PERMISSIVE for ALL to "service_role" using (true) with check (true);

create policy "profiles_select_admin" on "public"."profiles" as PERMISSIVE for SELECT to "authenticated" using (is_admin_reader());

create policy "profiles_select_own" on "public"."profiles" as PERMISSIVE for SELECT to "authenticated" using ((auth.uid() = id));

create policy "Users can insert their own profile" on "public"."profiles" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = id));

create policy "Users can update own profile" on "public"."profiles" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = id));

create policy "사용자는 자신의 프로필만 수정할 수 있습니다" on "public"."profiles" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = id));

create policy "pc_delete" on "public"."proxy_comments" as PERMISSIVE for DELETE to PUBLIC using (((auth.uid() = author_id) OR (EXISTS ( SELECT 1
   FROM admin_whitelist
  WHERE (admin_whitelist.email = (auth.jwt() ->> 'email'::text))))));

create policy "pc_insert" on "public"."proxy_comments" as PERMISSIVE for INSERT to PUBLIC with check (((auth.uid() = author_id) AND ((EXISTS ( SELECT 1
   FROM proxy_requests
  WHERE ((proxy_requests.id = proxy_comments.request_id) AND (proxy_requests.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM admin_whitelist
  WHERE (admin_whitelist.email = (auth.jwt() ->> 'email'::text)))))));

create policy "pc_select" on "public"."proxy_comments" as PERMISSIVE for SELECT to PUBLIC using (((EXISTS ( SELECT 1
   FROM proxy_requests
  WHERE ((proxy_requests.id = proxy_comments.request_id) AND (proxy_requests.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM admin_whitelist
  WHERE (admin_whitelist.email = (auth.jwt() ->> 'email'::text))))));

create policy "pc_update" on "public"."proxy_comments" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = author_id)) with check ((auth.uid() = author_id));

create policy "pr_delete" on "public"."proxy_requests" as PERMISSIVE for DELETE to PUBLIC using ((EXISTS ( SELECT 1
   FROM admin_whitelist
  WHERE (admin_whitelist.email = (auth.jwt() ->> 'email'::text)))));

create policy "pr_insert" on "public"."proxy_requests" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = user_id));

create policy "pr_select" on "public"."proxy_requests" as PERMISSIVE for SELECT to PUBLIC using (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM admin_whitelist
  WHERE (admin_whitelist.email = (auth.jwt() ->> 'email'::text))))));

create policy "pr_update" on "public"."proxy_requests" as PERMISSIVE for UPDATE to PUBLIC using (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM admin_whitelist
  WHERE (admin_whitelist.email = (auth.jwt() ->> 'email'::text)))))) with check (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM admin_whitelist
  WHERE (admin_whitelist.email = (auth.jwt() ->> 'email'::text))))));

create policy "Hosts can update reviews for their experiences" on "public"."reviews" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() IN ( SELECT experiences.host_id
   FROM experiences
  WHERE (experiences.id = reviews.experience_id)))) with check ((auth.uid() IN ( SELECT experiences.host_id
   FROM experiences
  WHERE (experiences.id = reviews.experience_id))));

create policy "Reviews are viewable by everyone" on "public"."reviews" as PERMISSIVE for SELECT to PUBLIC using (true);

create policy "Users can delete their own reviews" on "public"."reviews" as PERMISSIVE for DELETE to PUBLIC using ((auth.uid() = user_id));

create policy "Users can insert their own reviews" on "public"."reviews" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = user_id));

create policy "Enable read for admin" on "public"."search_logs" as PERMISSIVE for SELECT to PUBLIC using (true);

create policy "search_logs_insert_service_role_only" on "public"."search_logs" as PERMISSIVE for INSERT to "service_role" with check (true);

create policy "sa_delete" on "public"."service_applications" as PERMISSIVE for DELETE to PUBLIC using ((auth.uid() = host_id));

create policy "sa_insert" on "public"."service_applications" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = host_id));

create policy "sa_select" on "public"."service_applications" as PERMISSIVE for SELECT to PUBLIC using (((auth.uid() = host_id) OR (EXISTS ( SELECT 1
   FROM service_requests sr
  WHERE ((sr.id = service_applications.request_id) AND (sr.user_id = auth.uid()))))));

create policy "sa_update" on "public"."service_applications" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = host_id)) with check ((auth.uid() = host_id));

create policy "sb_delete_deny" on "public"."service_bookings" as PERMISSIVE for DELETE to PUBLIC using (false);

create policy "sb_insert_deny" on "public"."service_bookings" as PERMISSIVE for INSERT to PUBLIC with check (false);

create policy "sb_select" on "public"."service_bookings" as PERMISSIVE for SELECT to PUBLIC using (((auth.uid() = customer_id) OR (auth.uid() = host_id)));

create policy "sb_update_deny" on "public"."service_bookings" as PERMISSIVE for UPDATE to PUBLIC using (false) with check (false);

create policy "sr_delete" on "public"."service_requests" as PERMISSIVE for DELETE to PUBLIC using ((auth.uid() = user_id));

create policy "sr_insert" on "public"."service_requests" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = user_id));

create policy "sr_select" on "public"."service_requests" as PERMISSIVE for SELECT to PUBLIC using (((auth.uid() = user_id) OR (status = 'open'::text) OR (auth.uid() = selected_host_id)));

create policy "sr_update" on "public"."service_requests" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

create policy "translation_provider_state_service_role_only" on "public"."translation_provider_state" as PERMISSIVE for ALL to "service_role" using (true) with check (true);

create policy "users_select_own" on "public"."users" as PERMISSIVE for SELECT to "authenticated" using ((auth.uid() = id));

create policy "Users can delete their own wishlists" on "public"."wishlists" as PERMISSIVE for DELETE to PUBLIC using ((auth.uid() = user_id));

create policy "Users can insert their own wishlists" on "public"."wishlists" as PERMISSIVE for INSERT to PUBLIC with check ((auth.uid() = user_id));

create policy "Users can view their own wishlists" on "public"."wishlists" as PERMISSIVE for SELECT to PUBLIC using ((auth.uid() = user_id));

create policy "Anyone can update their own avatar" on "storage"."objects" as PERMISSIVE for UPDATE to PUBLIC using ((bucket_id = 'avatars'::text));

create policy "Anyone can upload an avatar" on "storage"."objects" as PERMISSIVE for INSERT to PUBLIC with check ((bucket_id = 'avatars'::text));

create policy "Auth Users Upload" on "storage"."objects" as PERMISSIVE for INSERT to PUBLIC with check (((bucket_id = 'experiences'::text) AND (auth.role() = 'authenticated'::text)));

create policy "Authenticated Delete" on "storage"."objects" as PERMISSIVE for DELETE to "authenticated" using ((bucket_id = 'images'::text));

create policy "Authenticated Update" on "storage"."objects" as PERMISSIVE for UPDATE to "authenticated" using ((bucket_id = 'images'::text));

create policy "Authenticated Upload" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check ((bucket_id = 'images'::text));

create policy "Authenticated users can upload chat images" on "storage"."objects" as PERMISSIVE for INSERT to PUBLIC with check (((bucket_id = 'chat-images'::text) AND (auth.role() = 'authenticated'::text)));

create policy "Avatar images are publicly accessible" on "storage"."objects" as PERMISSIVE for SELECT to PUBLIC using ((bucket_id = 'avatars'::text));

create policy "Only admins can upload files" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'admin_files'::text) AND ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_whitelist
  WHERE (admin_whitelist.email = (auth.jwt() ->> 'email'::text)))))));

create policy "Owner Delete" on "storage"."objects" as PERMISSIVE for DELETE to PUBLIC using ((auth.uid() = owner));

create policy "Owner Update" on "storage"."objects" as PERMISSIVE for UPDATE to PUBLIC using ((auth.uid() = owner));

create policy "Public Access" on "storage"."objects" as PERMISSIVE for SELECT to PUBLIC using ((bucket_id = 'experiences'::text));

create policy "Verification docs owners can delete" on "storage"."objects" as PERMISSIVE for DELETE to "authenticated" using (((bucket_id = 'verification-docs'::text) AND (name ~~ like_escape((('id_card/'::text || (auth.uid())::text) || '\_%'::text), '\'::text))));

create policy "Verification docs owners can read" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'verification-docs'::text) AND (name ~~ like_escape((('id_card/'::text || (auth.uid())::text) || '\_%'::text), '\'::text))));

create policy "Verification docs owners can update" on "storage"."objects" as PERMISSIVE for UPDATE to "authenticated" using (((bucket_id = 'verification-docs'::text) AND (name ~~ like_escape((('id_card/'::text || (auth.uid())::text) || '\_%'::text), '\'::text)))) with check (((bucket_id = 'verification-docs'::text) AND (name ~~ like_escape((('id_card/'::text || (auth.uid())::text) || '\_%'::text), '\'::text))));

create policy "Verification docs owners can upload" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'verification-docs'::text) AND (name ~~ like_escape((('id_card/'::text || (auth.uid())::text) || '\_%'::text), '\'::text))));

-- Exact non-owner ACLs for application relations.

revoke all privileges on table "public"."admin_audit_logs" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."admin_job_runs" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."admin_manual_payouts" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."admin_support_unread_alert_batches" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."admin_task_comments" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."admin_tasks" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."admin_whitelist" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."analytics_events" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."bookings" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."community_comments" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."community_likes" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."community_posts" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."experience_availability" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."experience_popularity_snapshot" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."experience_translation_jobs" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."experience_translation_tasks" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."experiences" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."guest_reviews" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."host_applications" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."inquiries" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."inquiry_messages" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."likes" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."messages" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."notifications" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."profile_private_demographics" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."profiles" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."proxy_comments" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."proxy_requests" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."public_host_applications" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."public_profiles" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."reviews" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."search_logs" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."service_applications" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."service_bookings" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."service_requests" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."translation_provider_state" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."users" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on table "public"."wishlists" from PUBLIC, anon, authenticated, service_role;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_audit_logs" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_audit_logs" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_audit_logs" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_job_runs" to "service_role";

grant INSERT, SELECT on table "public"."admin_manual_payouts" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_support_unread_alert_batches" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_task_comments" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_task_comments" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_task_comments" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_tasks" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_tasks" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_tasks" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_whitelist" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_whitelist" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."admin_whitelist" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."analytics_events" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."analytics_events" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."analytics_events" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."bookings" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."bookings" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."bookings" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."community_comments" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."community_comments" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."community_comments" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."community_likes" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."community_likes" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."community_likes" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."community_posts" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."community_posts" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."community_posts" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_availability" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_availability" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_availability" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_popularity_snapshot" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_popularity_snapshot" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_popularity_snapshot" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_translation_jobs" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_translation_jobs" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_translation_jobs" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_translation_tasks" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_translation_tasks" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experience_translation_tasks" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experiences" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experiences" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."experiences" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."guest_reviews" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."guest_reviews" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."guest_reviews" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."host_applications" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."host_applications" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."host_applications" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."inquiries" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."inquiries" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."inquiries" to "service_role";

grant DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."inquiry_messages" to "anon";

grant DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."inquiry_messages" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."inquiry_messages" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."likes" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."likes" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."likes" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."messages" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."messages" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."messages" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."notifications" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."notifications" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."notifications" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."profile_private_demographics" to "service_role";

grant INSERT, SELECT, UPDATE on table "public"."profiles" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."profiles" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."proxy_comments" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."proxy_comments" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."proxy_comments" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."proxy_requests" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."proxy_requests" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."proxy_requests" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."public_host_applications" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."public_host_applications" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."public_host_applications" to "service_role";

grant SELECT on table "public"."public_profiles" to "anon";

grant SELECT on table "public"."public_profiles" to "authenticated";

grant SELECT on table "public"."public_profiles" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."reviews" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."reviews" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."reviews" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."search_logs" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."search_logs" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."search_logs" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."service_applications" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."service_applications" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."service_applications" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."service_bookings" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."service_bookings" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."service_bookings" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."service_requests" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."service_requests" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."service_requests" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."translation_provider_state" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."translation_provider_state" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."translation_provider_state" to "service_role";

grant SELECT on table "public"."users" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."users" to "service_role";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."wishlists" to "anon";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."wishlists" to "authenticated";

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table "public"."wishlists" to "service_role";

-- Exact non-owner ACLs for public functions.

revoke all privileges on function public.check_rate_limit(table_name text, seconds integer) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.claim_due_admin_support_unread_alert_batches(p_limit integer) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.complete_admin_manual_experience_payout_atomic(p_request_key uuid, p_host_id uuid, p_settlement_type text, p_expected_current_booking_amount integer, p_legacy_amount integer, p_reason text, p_legacy_source_reference text, p_transfer_reference text, p_paid_by_admin_id uuid, p_paid_by_admin_email text) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.complete_experience_booking_if_due_atomic(p_booking_id text) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.complete_service_booking_if_due_atomic(p_booking_id text) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.confirm_service_bank_payment_atomic(p_order_id text) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.create_booking_atomic(p_user_id uuid, p_experience_id text, p_date text, p_time text, p_guests integer, p_is_private boolean, p_customer_name text, p_customer_phone text, p_payment_method text, p_is_solo_guarantee boolean) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.create_guest_review_with_notification_atomic(p_booking_id text, p_host_id uuid, p_rating integer, p_content text, p_notification_title text, p_notification_message text) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.create_service_booking_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid, p_contact_name text, p_contact_phone text) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.create_service_request_with_booking_atomic(p_user_id uuid, p_title text, p_description text, p_city text, p_country text, p_service_date date, p_start_time text, p_duration_hours integer, p_languages text[], p_guest_count integer, p_contact_name text, p_contact_phone text) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.decrement_comment_count() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.decrement_like_count() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.ensure_profile_demographics_reminder(p_user_id uuid, p_title text, p_message text, p_link text) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.get_experience_completion_due_backlog() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.handle_new_user() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.increment_comment_count() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.increment_community_post_view_count(p_post_id uuid) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.increment_like_count() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.is_admin_reader() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone, p_lease_seconds integer, p_reserved_tokens integer) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone, p_lease_seconds integer) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.list_due_experience_completion_candidates(p_booking_id text) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.mark_room_messages_read(p_room_id uuid, p_user_id uuid) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.prune_notifications_retention(p_cutoff timestamp with time zone, p_batch_size integer) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.prune_team_workspace_comments(p_task_id uuid, p_keep_limit integer) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.prune_team_workspace_tasks(p_keep_limit integer) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.record_translation_provider_outcome(p_provider text, p_token_count integer, p_cooldown_seconds integer, p_hit_quota boolean, p_reserved_token_count integer) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.record_translation_provider_outcome(p_provider text, p_token_count integer, p_cooldown_seconds integer, p_hit_quota boolean) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.refresh_experience_popularity_snapshot() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.select_service_host_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid) from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.set_proxy_comments_updated_at() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.set_proxy_requests_updated_at() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.set_service_applications_updated_at() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.set_service_bookings_updated_at() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.set_service_requests_updated_at() from PUBLIC, anon, authenticated, service_role;

revoke all privileges on function public.snapshot_booking_guest_demographics() from PUBLIC, anon, authenticated, service_role;

grant EXECUTE on function public.check_rate_limit(table_name text, seconds integer) to "anon";

grant EXECUTE on function public.check_rate_limit(table_name text, seconds integer) to "authenticated";

grant EXECUTE on function public.check_rate_limit(table_name text, seconds integer) to PUBLIC;

grant EXECUTE on function public.check_rate_limit(table_name text, seconds integer) to "service_role";

grant EXECUTE on function public.claim_due_admin_support_unread_alert_batches(p_limit integer) to "service_role";

grant EXECUTE on function public.complete_admin_manual_experience_payout_atomic(p_request_key uuid, p_host_id uuid, p_settlement_type text, p_expected_current_booking_amount integer, p_legacy_amount integer, p_reason text, p_legacy_source_reference text, p_transfer_reference text, p_paid_by_admin_id uuid, p_paid_by_admin_email text) to "service_role";

grant EXECUTE on function public.complete_experience_booking_if_due_atomic(p_booking_id text) to "service_role";

grant EXECUTE on function public.complete_service_booking_if_due_atomic(p_booking_id text) to "service_role";

grant EXECUTE on function public.confirm_service_bank_payment_atomic(p_order_id text) to "service_role";

grant EXECUTE on function public.create_booking_atomic(p_user_id uuid, p_experience_id text, p_date text, p_time text, p_guests integer, p_is_private boolean, p_customer_name text, p_customer_phone text, p_payment_method text, p_is_solo_guarantee boolean) to "service_role";

grant EXECUTE on function public.create_guest_review_with_notification_atomic(p_booking_id text, p_host_id uuid, p_rating integer, p_content text, p_notification_title text, p_notification_message text) to "service_role";

grant EXECUTE on function public.create_service_booking_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid, p_contact_name text, p_contact_phone text) to "service_role";

grant EXECUTE on function public.create_service_request_with_booking_atomic(p_user_id uuid, p_title text, p_description text, p_city text, p_country text, p_service_date date, p_start_time text, p_duration_hours integer, p_languages text[], p_guest_count integer, p_contact_name text, p_contact_phone text) to "service_role";

grant EXECUTE on function public.decrement_comment_count() to "anon";

grant EXECUTE on function public.decrement_comment_count() to "authenticated";

grant EXECUTE on function public.decrement_comment_count() to PUBLIC;

grant EXECUTE on function public.decrement_comment_count() to "service_role";

grant EXECUTE on function public.decrement_like_count() to "anon";

grant EXECUTE on function public.decrement_like_count() to "authenticated";

grant EXECUTE on function public.decrement_like_count() to PUBLIC;

grant EXECUTE on function public.decrement_like_count() to "service_role";

grant EXECUTE on function public.ensure_profile_demographics_reminder(p_user_id uuid, p_title text, p_message text, p_link text) to "service_role";

grant EXECUTE on function public.get_experience_completion_due_backlog() to "service_role";

grant EXECUTE on function public.handle_new_user() to "anon";

grant EXECUTE on function public.handle_new_user() to "authenticated";

grant EXECUTE on function public.handle_new_user() to PUBLIC;

grant EXECUTE on function public.handle_new_user() to "service_role";

grant EXECUTE on function public.increment_comment_count() to "anon";

grant EXECUTE on function public.increment_comment_count() to "authenticated";

grant EXECUTE on function public.increment_comment_count() to PUBLIC;

grant EXECUTE on function public.increment_comment_count() to "service_role";

grant EXECUTE on function public.increment_community_post_view_count(p_post_id uuid) to "service_role";

grant EXECUTE on function public.increment_like_count() to "anon";

grant EXECUTE on function public.increment_like_count() to "authenticated";

grant EXECUTE on function public.increment_like_count() to PUBLIC;

grant EXECUTE on function public.increment_like_count() to "service_role";

grant EXECUTE on function public.is_admin_reader() to "anon";

grant EXECUTE on function public.is_admin_reader() to "authenticated";

grant EXECUTE on function public.is_admin_reader() to "service_role";

grant EXECUTE on function public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone, p_lease_seconds integer, p_reserved_tokens integer) to "service_role";

grant EXECUTE on function public.lease_experience_translation_task(p_provider text, p_now timestamp with time zone, p_lease_seconds integer) to "service_role";

grant EXECUTE on function public.list_due_experience_completion_candidates(p_booking_id text) to "service_role";

grant EXECUTE on function public.mark_room_messages_read(p_room_id uuid, p_user_id uuid) to "anon";

grant EXECUTE on function public.mark_room_messages_read(p_room_id uuid, p_user_id uuid) to "authenticated";

grant EXECUTE on function public.mark_room_messages_read(p_room_id uuid, p_user_id uuid) to PUBLIC;

grant EXECUTE on function public.mark_room_messages_read(p_room_id uuid, p_user_id uuid) to "service_role";

grant EXECUTE on function public.prune_notifications_retention(p_cutoff timestamp with time zone, p_batch_size integer) to "service_role";

grant EXECUTE on function public.prune_team_workspace_comments(p_task_id uuid, p_keep_limit integer) to "service_role";

grant EXECUTE on function public.prune_team_workspace_tasks(p_keep_limit integer) to "service_role";

grant EXECUTE on function public.record_translation_provider_outcome(p_provider text, p_token_count integer, p_cooldown_seconds integer, p_hit_quota boolean, p_reserved_token_count integer) to "service_role";

grant EXECUTE on function public.record_translation_provider_outcome(p_provider text, p_token_count integer, p_cooldown_seconds integer, p_hit_quota boolean) to "service_role";

grant EXECUTE on function public.refresh_experience_popularity_snapshot() to "service_role";

grant EXECUTE on function public.select_service_host_atomic(p_customer_id uuid, p_request_id uuid, p_application_id uuid) to "service_role";

grant EXECUTE on function public.set_proxy_comments_updated_at() to "anon";

grant EXECUTE on function public.set_proxy_comments_updated_at() to "authenticated";

grant EXECUTE on function public.set_proxy_comments_updated_at() to PUBLIC;

grant EXECUTE on function public.set_proxy_comments_updated_at() to "service_role";

grant EXECUTE on function public.set_proxy_requests_updated_at() to "anon";

grant EXECUTE on function public.set_proxy_requests_updated_at() to "authenticated";

grant EXECUTE on function public.set_proxy_requests_updated_at() to PUBLIC;

grant EXECUTE on function public.set_proxy_requests_updated_at() to "service_role";

grant EXECUTE on function public.set_service_applications_updated_at() to "anon";

grant EXECUTE on function public.set_service_applications_updated_at() to "authenticated";

grant EXECUTE on function public.set_service_applications_updated_at() to PUBLIC;

grant EXECUTE on function public.set_service_applications_updated_at() to "service_role";

grant EXECUTE on function public.set_service_bookings_updated_at() to "anon";

grant EXECUTE on function public.set_service_bookings_updated_at() to "authenticated";

grant EXECUTE on function public.set_service_bookings_updated_at() to PUBLIC;

grant EXECUTE on function public.set_service_bookings_updated_at() to "service_role";

grant EXECUTE on function public.set_service_requests_updated_at() to "anon";

grant EXECUTE on function public.set_service_requests_updated_at() to "authenticated";

grant EXECUTE on function public.set_service_requests_updated_at() to PUBLIC;

grant EXECUTE on function public.set_service_requests_updated_at() to "service_role";

grant EXECUTE on function public.snapshot_booking_guest_demographics() to "service_role";

-- Exact non-owner ACLs for identity sequences.

revoke all privileges on sequence "public"."admin_job_runs_id_seq" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on sequence "public"."experiences_id_seq" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on sequence "public"."guest_reviews_id_seq" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on sequence "public"."inquiries_id_seq" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on sequence "public"."inquiry_messages_id_seq" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on sequence "public"."likes_id_seq" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on sequence "public"."messages_id_seq" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on sequence "public"."notifications_id_seq" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on sequence "public"."reviews_id_seq" from PUBLIC, anon, authenticated, service_role;

revoke all privileges on sequence "public"."wishlists_id_seq" from PUBLIC, anon, authenticated, service_role;

grant SELECT, UPDATE, USAGE on sequence "public"."admin_job_runs_id_seq" to "service_role";

grant SELECT, UPDATE, USAGE on sequence "public"."experiences_id_seq" to "anon";

grant SELECT, UPDATE, USAGE on sequence "public"."experiences_id_seq" to "authenticated";

grant SELECT, UPDATE, USAGE on sequence "public"."experiences_id_seq" to "service_role";

grant SELECT, UPDATE, USAGE on sequence "public"."guest_reviews_id_seq" to "anon";

grant SELECT, UPDATE, USAGE on sequence "public"."guest_reviews_id_seq" to "authenticated";

grant SELECT, UPDATE, USAGE on sequence "public"."guest_reviews_id_seq" to "service_role";

grant SELECT, UPDATE, USAGE on sequence "public"."inquiries_id_seq" to "anon";

grant SELECT, UPDATE, USAGE on sequence "public"."inquiries_id_seq" to "authenticated";

grant SELECT, UPDATE, USAGE on sequence "public"."inquiries_id_seq" to "service_role";

grant SELECT, UPDATE, USAGE on sequence "public"."inquiry_messages_id_seq" to "anon";

grant SELECT, UPDATE, USAGE on sequence "public"."inquiry_messages_id_seq" to "authenticated";

grant SELECT, UPDATE, USAGE on sequence "public"."inquiry_messages_id_seq" to "service_role";

grant SELECT, UPDATE, USAGE on sequence "public"."likes_id_seq" to "anon";

grant SELECT, UPDATE, USAGE on sequence "public"."likes_id_seq" to "authenticated";

grant SELECT, UPDATE, USAGE on sequence "public"."likes_id_seq" to "service_role";

grant SELECT, UPDATE, USAGE on sequence "public"."messages_id_seq" to "anon";

grant SELECT, UPDATE, USAGE on sequence "public"."messages_id_seq" to "authenticated";

grant SELECT, UPDATE, USAGE on sequence "public"."messages_id_seq" to "service_role";

grant SELECT, UPDATE, USAGE on sequence "public"."notifications_id_seq" to "anon";

grant SELECT, UPDATE, USAGE on sequence "public"."notifications_id_seq" to "authenticated";

grant SELECT, UPDATE, USAGE on sequence "public"."notifications_id_seq" to "service_role";

grant SELECT, UPDATE, USAGE on sequence "public"."reviews_id_seq" to "anon";

grant SELECT, UPDATE, USAGE on sequence "public"."reviews_id_seq" to "authenticated";

grant SELECT, UPDATE, USAGE on sequence "public"."reviews_id_seq" to "service_role";

grant SELECT, UPDATE, USAGE on sequence "public"."wishlists_id_seq" to "anon";

grant SELECT, UPDATE, USAGE on sequence "public"."wishlists_id_seq" to "authenticated";

grant SELECT, UPDATE, USAGE on sequence "public"."wishlists_id_seq" to "service_role";

-- Replica identity parity (all Production application tables use DEFAULT).

alter table "public"."admin_audit_logs" replica identity default;

alter table "public"."admin_job_runs" replica identity default;

alter table "public"."admin_manual_payouts" replica identity default;

alter table "public"."admin_support_unread_alert_batches" replica identity default;

alter table "public"."admin_task_comments" replica identity default;

alter table "public"."admin_tasks" replica identity default;

alter table "public"."admin_whitelist" replica identity default;

alter table "public"."analytics_events" replica identity default;

alter table "public"."bookings" replica identity default;

alter table "public"."community_comments" replica identity default;

alter table "public"."community_likes" replica identity default;

alter table "public"."community_posts" replica identity default;

alter table "public"."experience_availability" replica identity default;

alter table "public"."experience_popularity_snapshot" replica identity default;

alter table "public"."experience_translation_jobs" replica identity default;

alter table "public"."experience_translation_tasks" replica identity default;

alter table "public"."experiences" replica identity default;

alter table "public"."guest_reviews" replica identity default;

alter table "public"."host_applications" replica identity default;

alter table "public"."inquiries" replica identity default;

alter table "public"."inquiry_messages" replica identity default;

alter table "public"."likes" replica identity default;

alter table "public"."messages" replica identity default;

alter table "public"."notifications" replica identity default;

alter table "public"."profile_private_demographics" replica identity default;

alter table "public"."profiles" replica identity default;

alter table "public"."proxy_comments" replica identity default;

alter table "public"."proxy_requests" replica identity default;

alter table "public"."reviews" replica identity default;

alter table "public"."search_logs" replica identity default;

alter table "public"."service_applications" replica identity default;

alter table "public"."service_bookings" replica identity default;

alter table "public"."service_requests" replica identity default;

alter table "public"."translation_provider_state" replica identity default;

alter table "public"."users" replica identity default;

alter table "public"."wishlists" replica identity default;

-- Locally bucket configuration only; Storage schema/tables and object rows are managed externally.
insert into storage.buckets ("id", "name", "public", "file_size_limit", "allowed_mime_types")
values
  ('admin_files', 'admin_files', true, 10485760, null),
  ('avatars', 'avatars', true, null, null),
  ('chat-images', 'chat-images', true, null, null),
  ('experiences', 'experiences', true, null, null),
  ('images', 'images', true, null, null),
  ('verification-docs', 'verification-docs', false, null, null)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Exact Production supabase_realtime membership. Fail closed on unexpected pre-existing members.
do $realtime_parity$
declare unexpected text[];
begin
  select array_agg(format('%I.%I', schemaname, tablename) order by schemaname, tablename)
    into unexpected
    from pg_publication_tables
   where pubname = 'supabase_realtime'
     and (schemaname <> 'public' or tablename <> all (array['admin_audit_logs', 'admin_task_comments', 'admin_tasks', 'admin_whitelist', 'inquiry_messages', 'notifications', 'profiles']::text[]));
  if unexpected is not null then
    raise exception 'Unexpected pre-existing supabase_realtime members: %', unexpected;
  end if;
end
$realtime_parity$;

alter publication supabase_realtime set (
  publish = 'insert, update, delete, truncate',
  publish_via_partition_root = false
);

do $add_admin_audit_logs$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_audit_logs'
  ) then
    alter publication supabase_realtime add table "public"."admin_audit_logs";
  end if;
end
$add_admin_audit_logs$;

do $add_admin_task_comments$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_task_comments'
  ) then
    alter publication supabase_realtime add table "public"."admin_task_comments";
  end if;
end
$add_admin_task_comments$;

do $add_admin_tasks$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_tasks'
  ) then
    alter publication supabase_realtime add table "public"."admin_tasks";
  end if;
end
$add_admin_tasks$;

do $add_admin_whitelist$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_whitelist'
  ) then
    alter publication supabase_realtime add table "public"."admin_whitelist";
  end if;
end
$add_admin_whitelist$;

do $add_inquiry_messages$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inquiry_messages'
  ) then
    alter publication supabase_realtime add table "public"."inquiry_messages";
  end if;
end
$add_inquiry_messages$;

do $add_notifications$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table "public"."notifications";
  end if;
end
$add_notifications$;

do $add_profiles$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table "public"."profiles";
  end if;
end
$add_profiles$;

commit;
