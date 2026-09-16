-- Backward-compatible database foundation for tour-end review eligibility.
-- This migration intentionally preserves existing reviews/guest_reviews RLS policies
-- and direct Data API grants until the application cutover has been deployed.

BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.complete_experience_booking_if_due_atomic(text)') IS NULL
    OR to_regprocedure('public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)') IS NULL
    OR to_regprocedure('public.list_due_experience_completion_candidates(text)') IS NULL
  THEN
    RAISE EXCEPTION 'review tour-end foundation refused missing prerequisite RPCs';
  END IF;

  IF to_regprocedure('public.create_experience_review_atomic(text,uuid,bigint,integer,text)') IS NOT NULL
    OR to_regprocedure('public.list_due_experience_review_request_candidates(integer)') IS NOT NULL
  THEN
    RAISE EXCEPTION 'review tour-end foundation refused unexpected target RPCs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Users can insert their own reviews' AND cmd = 'INSERT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Hosts can update reviews for their experiences' AND cmd = 'UPDATE'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guest_reviews'
      AND policyname = 'Host can insert reviews' AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'review tour-end foundation refused unexpected direct-write policy state';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.reviews', 'INSERT')
    OR NOT has_table_privilege('authenticated', 'public.reviews', 'UPDATE')
    OR NOT has_table_privilege('authenticated', 'public.guest_reviews', 'INSERT')
  THEN
    RAISE EXCEPTION 'review tour-end foundation refused unexpected direct-write grants';
  END IF;

  IF to_regclass('public.reviews_booking_id_unique_idx') IS NULL
    OR to_regclass('public.uq_notifications_review_request_booking_id') IS NULL
    OR to_regclass('public.uq_notifications_guest_review_request_booking_id') IS NULL
    OR to_regclass('public.uq_notifications_guest_review_received_booking_id') IS NULL
  THEN
    RAISE EXCEPTION 'review tour-end foundation refused missing idempotency indexes';
  END IF;
END
$preflight$;

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
  v_experience_duration INTEGER;
  v_due_at TIMESTAMPTZ;
  v_tour_end_at TIMESTAMPTZ;
  v_review_requests_due BOOLEAN := FALSE;
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
    SELECT v_booking.id, COALESCE(v_booking.order_id, v_booking.id),
      v_booking.user_id::UUID, TRUE, FALSE, FALSE, FALSE;
    RETURN;
  END IF;

  IF COALESCE(v_booking.status, '') NOT IN ('PAID', 'confirmed') THEN
    RAISE EXCEPTION 'EXP_COMPLETE_INVALID_STATUS: booking status must be PAID, confirmed, or completed';
  END IF;

  IF v_booking.date IS NULL THEN
    RETURN QUERY
    SELECT v_booking.id, COALESCE(v_booking.order_id, v_booking.id),
      v_booking.user_id::UUID, FALSE, TRUE, FALSE, FALSE;
    RETURN;
  END IF;

  -- Preserve the existing start-time completion contract, including its
  -- missing-time 00:00 fallback. Only review notifications use strict time.
  v_due_at := (
    (v_booking.date::text || ' ' || COALESCE(NULLIF(v_booking.time, ''), '00:00'))::timestamp
    AT TIME ZONE 'Asia/Seoul'
  );

  IF v_due_at >= now() THEN
    RETURN QUERY
    SELECT v_booking.id, COALESCE(v_booking.order_id, v_booking.id),
      v_booking.user_id::UUID, FALSE, TRUE, FALSE, FALSE;
    RETURN;
  END IF;

  SELECT COALESCE(e.title, '체험'), e.host_id, e.duration
  INTO v_experience_title, v_experience_host_id, v_experience_duration
  FROM public.experiences AS e
  WHERE e.id = v_booking.experience_id;

  IF trim(COALESCE(v_booking.time, '')) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
    v_tour_end_at := (
      (v_booking.date::text || ' ' || trim(v_booking.time))::timestamp
      AT TIME ZONE 'Asia/Seoul'
    ) + make_interval(hours => CASE WHEN v_experience_duration > 0 THEN v_experience_duration ELSE 2 END);
    v_review_requests_due := v_tour_end_at <= now();
  END IF;

  UPDATE public.bookings AS b
  SET status = 'completed'
  WHERE b.id = v_booking.id
    AND b.status IN ('PAID', 'confirmed');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXP_COMPLETE_UPDATE_CONFLICT: booking status changed before completion';
  END IF;

  IF
    v_review_requests_due
    AND v_booking.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.reviews AS r
      WHERE r.booking_id = v_booking.id
    )
  THEN
    INSERT INTO public.notifications (
      user_id, type, title, message, link, is_read, created_at, booking_id
    )
    VALUES (
      v_booking.user_id,
      'review_request',
      '후기를 남겨주세요!',
      format('''%s'' 어떠셨나요? 소중한 후기를 남겨주세요.', COALESCE(v_experience_title, '체험')),
      '/guest/trips',
      FALSE,
      now(),
      v_booking.id
    )
    ON CONFLICT (booking_id) WHERE type = 'review_request' AND booking_id IS NOT NULL
    DO NOTHING;

    v_notification_created := FOUND;
  END IF;

  IF
    v_review_requests_due
    AND v_booking.user_id IS NOT NULL
    AND v_experience_host_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.guest_reviews AS gr
      WHERE gr.booking_id = v_booking.id
        AND gr.host_id = v_experience_host_id
    )
  THEN
    INSERT INTO public.notifications (
      user_id, type, title, message, link, is_read, created_at, booking_id
    )
    VALUES (
      v_experience_host_id,
      'guest_review_request',
      '게스트 평가를 남겨주세요',
      format('''%s'' 체험의 게스트 평가를 남겨주세요.', COALESCE(v_experience_title, '체험')),
      '/host/dashboard?tab=reservations',
      FALSE,
      now(),
      v_booking.id
    )
    ON CONFLICT (booking_id) WHERE type = 'guest_review_request' AND booking_id IS NOT NULL
    DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT v_booking.id, COALESCE(v_booking.order_id, v_booking.id),
    v_booking.user_id::UUID, FALSE, FALSE, TRUE, v_notification_created;
END;
$function$;

ALTER FUNCTION public.complete_experience_booking_if_due_atomic(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_experience_booking_if_due_atomic(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_experience_booking_if_due_atomic(text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_guest_review_with_notification_atomic(
  p_booking_id text,
  p_host_id uuid,
  p_rating integer,
  p_content text,
  p_notification_title text,
  p_notification_message text
)
 RETURNS TABLE(outcome text, review_id bigint, guest_id uuid, notification_created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_experience_host_id UUID;
  v_experience_duration INTEGER;
  v_tour_end_at TIMESTAMPTZ;
  v_review_id BIGINT;
  v_notification_created BOOLEAN := FALSE;
  v_content TEXT := trim(COALESCE(p_content, ''));
BEGIN
  IF trim(COALESCE(p_booking_id, '')) = ''
    OR p_host_id IS NULL
    OR p_rating IS NULL
    OR p_rating < 1
    OR p_rating > 5
    OR v_content = ''
  THEN
    RETURN QUERY SELECT 'invalid_payload', NULL::BIGINT, NULL::UUID, FALSE;
    RETURN;
  END IF;

  SELECT * INTO v_booking
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

  SELECT e.host_id, e.duration
  INTO v_experience_host_id, v_experience_duration
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

  -- Preserve the outcome vocabulary understood by the currently deployed API.
  IF v_booking.date IS NULL
    OR trim(COALESCE(v_booking.time, '')) !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
  THEN
    RETURN QUERY SELECT 'invalid_status', NULL::BIGINT, v_booking.user_id::UUID, FALSE;
    RETURN;
  END IF;

  v_tour_end_at := (
    (v_booking.date::text || ' ' || trim(v_booking.time))::timestamp
    AT TIME ZONE 'Asia/Seoul'
  ) + make_interval(hours => CASE WHEN v_experience_duration > 0 THEN v_experience_duration ELSE 2 END);

  IF v_tour_end_at > now() THEN
    RETURN QUERY SELECT 'invalid_status', NULL::BIGINT, v_booking.user_id::UUID, FALSE;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.guest_reviews AS gr
    WHERE gr.booking_id = v_booking.id
      AND gr.host_id = p_host_id
  ) THEN
    RETURN QUERY SELECT 'duplicate', NULL::BIGINT, v_booking.user_id::UUID, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.guest_reviews (booking_id, host_id, guest_id, rating, content)
  VALUES (v_booking.id, p_host_id, v_booking.user_id, p_rating, v_content)
  ON CONFLICT (booking_id) DO NOTHING
  RETURNING id INTO v_review_id;

  IF v_review_id IS NULL THEN
    RETURN QUERY SELECT 'duplicate', NULL::BIGINT, v_booking.user_id::UUID, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, title, message, link, is_read, created_at, booking_id
  )
  VALUES (
    v_booking.user_id,
    'guest_review_received',
    COALESCE(NULLIF(trim(p_notification_title), ''), '호스트가 평가를 남겼습니다'),
    COALESCE(NULLIF(trim(p_notification_message), ''), '호스트가 회원님에 대한 평가를 남겼습니다.'),
    '/account',
    FALSE,
    now(),
    v_booking.id
  )
  ON CONFLICT (booking_id) WHERE type = 'guest_review_received' AND booking_id IS NOT NULL
  DO NOTHING;

  v_notification_created := FOUND;

  RETURN QUERY SELECT 'created', v_review_id, v_booking.user_id::UUID, v_notification_created;
END;
$function$;

ALTER FUNCTION public.create_guest_review_with_notification_atomic(text, uuid, integer, text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_guest_review_with_notification_atomic(text, uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_guest_review_with_notification_atomic(text, uuid, integer, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_experience_review_atomic(
  p_booking_id text,
  p_user_id uuid,
  p_experience_id bigint,
  p_rating integer,
  p_content text
)
 RETURNS TABLE(outcome text, review_id bigint, experience_id bigint, host_id uuid, experience_title text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_experience_title TEXT;
  v_host_id UUID;
  v_experience_duration INTEGER;
  v_tour_end_at TIMESTAMPTZ;
  v_review_id BIGINT;
  v_content TEXT := trim(COALESCE(p_content, ''));
  v_experience_review_count INTEGER;
  v_experience_average NUMERIC;
  v_host_review_count INTEGER;
  v_host_average NUMERIC;
BEGIN
  IF trim(COALESCE(p_booking_id, '')) = ''
    OR p_user_id IS NULL
    OR p_experience_id IS NULL
    OR p_rating IS NULL
    OR p_rating < 1
    OR p_rating > 5
    OR length(v_content) < 10
  THEN
    RETURN QUERY SELECT 'invalid_payload', NULL::BIGINT, NULL::BIGINT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings AS b
  WHERE b.id = trim(p_booking_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found', NULL::BIGINT, NULL::BIGINT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  IF v_booking.user_id IS DISTINCT FROM p_user_id THEN
    RETURN QUERY SELECT 'forbidden', NULL::BIGINT, v_booking.experience_id, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  IF v_booking.experience_id IS DISTINCT FROM p_experience_id THEN
    RETURN QUERY SELECT 'invalid_payload', NULL::BIGINT, v_booking.experience_id, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  SELECT e.title, e.host_id, e.duration
  INTO v_experience_title, v_host_id, v_experience_duration
  FROM public.experiences AS e
  WHERE e.id = v_booking.experience_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found', NULL::BIGINT, v_booking.experience_id, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  IF v_host_id IS NOT NULL THEN
    PERFORM 1 FROM public.profiles AS p WHERE p.id = v_host_id FOR UPDATE;
  END IF;

  IF COALESCE(v_booking.status, '') <> 'completed' THEN
    RETURN QUERY SELECT 'invalid_status', NULL::BIGINT, v_booking.experience_id, v_host_id, v_experience_title;
    RETURN;
  END IF;

  IF v_booking.date IS NULL
    OR trim(COALESCE(v_booking.time, '')) !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
  THEN
    RETURN QUERY SELECT 'not_eligible', NULL::BIGINT, v_booking.experience_id, v_host_id, v_experience_title;
    RETURN;
  END IF;

  v_tour_end_at := (
    (v_booking.date::text || ' ' || trim(v_booking.time))::timestamp
    AT TIME ZONE 'Asia/Seoul'
  ) + make_interval(hours => CASE WHEN v_experience_duration > 0 THEN v_experience_duration ELSE 2 END);

  IF v_tour_end_at > now() THEN
    RETURN QUERY SELECT 'not_eligible', NULL::BIGINT, v_booking.experience_id, v_host_id, v_experience_title;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.reviews AS r WHERE r.booking_id = v_booking.id) THEN
    RETURN QUERY SELECT 'duplicate', NULL::BIGINT, v_booking.experience_id, v_host_id, v_experience_title;
    RETURN;
  END IF;

  INSERT INTO public.reviews (
    user_id, experience_id, booking_id, rating, content, photos, created_at
  )
  VALUES (
    p_user_id, v_booking.experience_id, v_booking.id, p_rating, v_content, ARRAY[]::TEXT[], now()
  )
  ON CONFLICT (booking_id) DO NOTHING
  RETURNING id INTO v_review_id;

  IF v_review_id IS NULL THEN
    RETURN QUERY SELECT 'duplicate', NULL::BIGINT, v_booking.experience_id, v_host_id, v_experience_title;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER, ROUND(AVG(r.rating)::NUMERIC, 2)
  INTO v_experience_review_count, v_experience_average
  FROM public.reviews AS r
  WHERE r.experience_id = v_booking.experience_id;

  UPDATE public.experiences AS e
  SET rating = COALESCE(v_experience_average, 0),
      review_count = v_experience_review_count
  WHERE e.id = v_booking.experience_id;

  IF v_host_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER, ROUND(AVG(r.rating)::NUMERIC, 2)
    INTO v_host_review_count, v_host_average
    FROM public.reviews AS r
    INNER JOIN public.experiences AS e ON e.id = r.experience_id
    WHERE e.host_id = v_host_id;

    UPDATE public.profiles AS p
    SET average_rating = CASE WHEN v_host_review_count = 0 THEN NULL ELSE v_host_average END,
        total_review_count = v_host_review_count
    WHERE p.id = v_host_id;
  END IF;

  RETURN QUERY SELECT 'created', v_review_id, v_booking.experience_id, v_host_id, v_experience_title;
END;
$function$;

ALTER FUNCTION public.create_experience_review_atomic(text, uuid, bigint, integer, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_experience_review_atomic(text, uuid, bigint, integer, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_experience_review_atomic(text, uuid, bigint, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.list_due_experience_review_request_candidates(p_limit integer DEFAULT 50)
 RETURNS TABLE(
   booking_id text,
   user_id uuid,
   host_id uuid,
   experience_title text,
   tour_end_at timestamp with time zone,
   customer_request_needed boolean,
   host_request_needed boolean
 )
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH eligible AS (
    SELECT
      b.id AS booking_id,
      b.user_id,
      e.host_id,
      COALESCE(e.title, '체험') AS experience_title,
      CASE
        WHEN b.date IS NOT NULL
          AND trim(COALESCE(b.time, '')) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
        THEN (
          (b.date::text || ' ' || trim(b.time))::timestamp AT TIME ZONE 'Asia/Seoul'
        ) + make_interval(hours => CASE WHEN e.duration > 0 THEN e.duration ELSE 2 END)
        ELSE NULL
      END AS tour_end_at
    FROM public.bookings AS b
    INNER JOIN public.experiences AS e ON e.id = b.experience_id
    WHERE lower(COALESCE(b.status, '')) = 'completed'
      AND b.date IS NOT NULL
      AND trim(COALESCE(b.time, '')) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
  ), needs AS (
    SELECT
      eligible.*,
      (
        eligible.user_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.reviews AS r WHERE r.booking_id = eligible.booking_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications AS n
          WHERE n.booking_id = eligible.booking_id AND n.type = 'review_request'
        )
      ) AS customer_request_needed,
      (
        eligible.user_id IS NOT NULL
        AND eligible.host_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.guest_reviews AS gr WHERE gr.booking_id = eligible.booking_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications AS n
          WHERE n.booking_id = eligible.booking_id AND n.type = 'guest_review_request'
        )
      ) AS host_request_needed
    FROM eligible
    WHERE eligible.tour_end_at <= now()
      AND eligible.tour_end_at >= TIMESTAMPTZ '2026-09-16 00:00:00+09'
  )
  SELECT
    needs.booking_id,
    needs.user_id::UUID,
    needs.host_id,
    needs.experience_title,
    needs.tour_end_at,
    needs.customer_request_needed,
    needs.host_request_needed
  FROM needs
  WHERE needs.customer_request_needed OR needs.host_request_needed
  ORDER BY needs.tour_end_at ASC, needs.booking_id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50);
$function$;

ALTER FUNCTION public.list_due_experience_review_request_candidates(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.list_due_experience_review_request_candidates(integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_due_experience_review_request_candidates(integer) TO service_role;

DO $postcondition$
BEGIN
  IF to_regprocedure('public.create_experience_review_atomic(text,uuid,bigint,integer,text)') IS NULL
    OR to_regprocedure('public.list_due_experience_review_request_candidates(integer)') IS NULL
  THEN
    RAISE EXCEPTION 'review tour-end foundation target RPCs are missing';
  END IF;

  IF has_function_privilege('anon', 'public.create_experience_review_atomic(text,uuid,bigint,integer,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.create_experience_review_atomic(text,uuid,bigint,integer,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.create_experience_review_atomic(text,uuid,bigint,integer,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.list_due_experience_review_request_candidates(integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.list_due_experience_review_request_candidates(integer)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.list_due_experience_review_request_candidates(integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.complete_experience_booking_if_due_atomic(text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.complete_experience_booking_if_due_atomic(text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.complete_experience_booking_if_due_atomic(text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'review tour-end foundation RPC execute contract mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Users can insert their own reviews' AND cmd = 'INSERT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Hosts can update reviews for their experiences' AND cmd = 'UPDATE'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guest_reviews'
      AND policyname = 'Host can insert reviews' AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'review tour-end foundation changed direct-write policies';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.reviews', 'INSERT')
    OR NOT has_table_privilege('authenticated', 'public.reviews', 'UPDATE')
    OR NOT has_table_privilege('authenticated', 'public.guest_reviews', 'INSERT')
  THEN
    RAISE EXCEPTION 'review tour-end foundation changed direct-write grants';
  END IF;
END
$postcondition$;

COMMIT;
