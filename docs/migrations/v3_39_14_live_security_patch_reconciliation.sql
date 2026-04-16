-- =============================================================================
-- v3.39.14 live security patch reconciliation
-- 목적:
-- 1) live DB에 수동 적용된 PATCH 1~8의 최종 의도를 저장소에 정식 반영
-- 2) 현재 앱 계약(gemini.md / AUDIT_MAP.md)과 충돌하는 회귀를 최소 수정으로 해소
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Admin-only read helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_reader()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.is_admin_reader() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_reader() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- PATCH 1 reconciliation: admin_whitelist / admin_tasks / admin_task_comments
-- write = service_role only, read = admin-only authenticated users
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  table_name text;
  policy_row record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['admin_whitelist', 'admin_tasks', 'admin_task_comments']
  LOOP
    FOR policy_row IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      table_name || '_service_role_only',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_admin_reader())',
      table_name || '_admin_read_only',
      table_name
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- PATCH 2 sync: translation queue tables are service-role only
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  table_name text;
  policy_row record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'experience_translation_tasks',
    'translation_provider_state',
    'experience_translation_jobs'
  ]
  LOOP
    FOR policy_row IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      table_name || '_service_role_only',
      table_name
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- PATCH 3 sync: notifications
-- read = own notifications only, write = service_role only
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', policy_row.policyname);
  END LOOP;
END $$;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_read_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY notifications_write_service_role
  ON public.notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- PATCH 4 reconciliation: keep public safe projection view executable for public
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.public_host_applications
WITH (security_invoker = off) AS
SELECT DISTINCT ON (user_id)
  id,
  user_id,
  status,
  name,
  profile_photo,
  languages,
  self_intro,
  created_at
FROM public.host_applications
ORDER BY user_id, created_at DESC, id DESC;

GRANT SELECT ON public.public_host_applications TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- PATCH 5 sync + reconciliation: direct INSERT stays service-role only and
-- create_booking_atomic becomes service-role execute only.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  policy_row record;
  fn_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bookings'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookings', policy_row.policyname);
  END LOOP;

  EXECUTE 'CREATE POLICY bookings_insert_service_role_only
    ON public.bookings
    FOR INSERT
    TO service_role
    WITH CHECK (true)';

  FOR fn_row IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_booking_atomic'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.create_booking_atomic(%s) FROM anon, authenticated',
      fn_row.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.create_booking_atomic(%s) TO service_role',
      fn_row.args
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_user_id uuid,
  p_experience_id text,
  p_date text,
  p_time text,
  p_guests integer,
  p_is_private boolean,
  p_customer_name text,
  p_customer_phone text,
  p_payment_method text DEFAULT 'card',
  p_is_solo_guarantee boolean DEFAULT false
)
RETURNS TABLE (
  new_order_id text,
  final_amount numeric,
  host_id text,
  experience_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_experience_id public.experiences.id%TYPE;
  v_host_id text;
  v_title text;
  v_price numeric;
  v_private_price numeric;
  v_max_guests integer;
  v_guest_count integer;
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
    COALESCE(e.max_guests, 10)
  INTO
    v_experience_id,
    v_host_id,
    v_title,
    v_price,
    v_private_price,
    v_max_guests
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
    WHEN COALESCE(p_is_solo_guarantee, false) AND NOT p_is_private AND v_guest_count = 1 THEN 30000
    ELSE 0
  END;

  v_host_price := CASE WHEN p_is_private THEN v_private_price ELSE v_price * v_guest_count END;
  v_host_price := v_host_price + v_solo_guarantee_price;
  v_fee := floor(v_host_price * 0.1);
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
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic(
  uuid, text, text, text, integer, boolean, text, text, text, boolean
) TO service_role;

-- -----------------------------------------------------------------------------
-- PATCH 6 reconciliation: audit logs
-- write = service_role only, read = admin-only authenticated users
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_audit_logs', policy_row.policyname);
  END LOOP;
END $$;

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_logs_service_role_only
  ON public.admin_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY admin_audit_logs_admin_read_only
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_reader());

-- -----------------------------------------------------------------------------
-- PATCH 7 sync: lock function search_path
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_catalog;

DO $$
DECLARE
  fn_row record;
BEGIN
  FOR fn_row IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'check_rate_limit'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.check_rate_limit(%s) SET search_path = public, pg_catalog',
      fn_row.args
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- PATCH 8 sync: analytics insert becomes service-role only
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analytics_events'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.analytics_events', policy_row.policyname);
  END LOOP;
END $$;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_events_insert_service_role_only
  ON public.analytics_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'search_logs'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.search_logs', policy_row.policyname);
  END LOOP;
END $$;

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY search_logs_insert_service_role_only
  ON public.search_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);
