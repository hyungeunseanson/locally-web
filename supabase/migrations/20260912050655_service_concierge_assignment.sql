-- Locally concierge service flow: additive schema and versioned atomic RPCs.
-- Apply before the application cutover. Public table lockdown is a separate migration.

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS pricing_tier TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS pricing_reason TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS service_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_request_key TEXT;

ALTER TABLE public.service_requests
  ALTER COLUMN hourly_rate_host DROP NOT NULL;

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_service_type_check,
  DROP CONSTRAINT IF EXISTS service_requests_pricing_tier_check,
  DROP CONSTRAINT IF EXISTS service_requests_pricing_reason_check,
  DROP CONSTRAINT IF EXISTS service_requests_duration_hours_check,
  DROP CONSTRAINT IF EXISTS service_requests_guest_count_check,
  DROP CONSTRAINT IF EXISTS service_requests_status_check;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_service_type_check
    CHECK (service_type IN ('general', 'business')),
  ADD CONSTRAINT service_requests_pricing_tier_check
    CHECK (pricing_tier IN ('standard', 'premium')),
  ADD CONSTRAINT service_requests_pricing_reason_check
    CHECK (pricing_reason IN ('standard', 'business', 'group_6_plus', 'business_and_group_6_plus')),
  ADD CONSTRAINT service_requests_duration_hours_check
    CHECK (duration_hours BETWEEN 3 AND 168),
  ADD CONSTRAINT service_requests_guest_count_check
    CHECK (guest_count BETWEEN 1 AND 100),
  ADD CONSTRAINT service_requests_status_check
    CHECK (status IN (
      'pending_payment', 'assigning', 'open', 'matched', 'paid', 'confirmed',
      'completed', 'cancellation_requested', 'cancelled', 'expired'
    ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_requests_client_request_key
  ON public.service_requests (user_id, client_request_key)
  WHERE client_request_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_requests_assignment_queue
  ON public.service_requests (created_at)
  WHERE status = 'assigning';

CREATE INDEX IF NOT EXISTS idx_service_requests_service_end_at
  ON public.service_requests (service_end_at)
  WHERE status IN ('matched', 'paid', 'confirmed');

ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS host_compensation_amount INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.service_bookings
  DROP CONSTRAINT IF EXISTS service_bookings_host_compensation_amount_check;

ALTER TABLE public.service_bookings
  ADD CONSTRAINT service_bookings_host_compensation_amount_check
    CHECK (host_compensation_amount >= 0);

CREATE TABLE IF NOT EXISTS public.service_request_schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_hours INTEGER NOT NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  legacy_imported BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_request_schedule_duration_check CHECK (
    (legacy_imported AND duration_hours BETWEEN 3 AND 168)
    OR (NOT legacy_imported AND duration_hours BETWEEN 3 AND 24)
  ),
  CONSTRAINT uq_service_request_schedule_date UNIQUE (request_id, service_date),
  CONSTRAINT uq_service_request_schedule_order UNIQUE (request_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_service_schedule_request_time
  ON public.service_request_schedule_items (request_id, service_date, start_time);

ALTER TABLE public.service_request_schedule_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.service_request_schedule_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_request_schedule_items TO service_role;

CREATE TABLE IF NOT EXISTS public.service_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  host_id UUID NOT NULL,
  assigned_by UUID NOT NULL,
  hourly_rate_host INTEGER NOT NULL CHECK (hourly_rate_host > 0),
  total_host_payout INTEGER NOT NULL CHECK (total_host_payout > 0),
  host_agreement_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  end_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_service_assignment_history_request
  ON public.service_assignment_history (request_id, assigned_at DESC);

ALTER TABLE public.service_assignment_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.service_assignment_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_assignment_history TO service_role;

COMMENT ON COLUMN public.service_assignment_history.host_id IS
  'Historical audit snapshot UUID; intentionally no foreign key so account deletion does not erase the recorded identifier.';
COMMENT ON COLUMN public.service_assignment_history.assigned_by IS
  'Historical audit snapshot UUID; intentionally no foreign key so account deletion does not erase the recorded identifier.';

CREATE TABLE IF NOT EXISTS public.service_refund_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  initiated_by UUID NOT NULL,
  previous_booking_status TEXT NOT NULL,
  refund_amount INTEGER NOT NULL CHECK (refund_amount >= 0),
  host_compensation_amount INTEGER NOT NULL DEFAULT 0 CHECK (host_compensation_amount >= 0),
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'succeeded', 'failed', 'unknown', 'applied')),
  provider_reference TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT uq_service_refund_operation_key UNIQUE (booking_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_service_refund_operations_review
  ON public.service_refund_operations (created_at)
  WHERE status IN ('started', 'unknown');

ALTER TABLE public.service_refund_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.service_refund_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_refund_operations TO service_role;

COMMENT ON COLUMN public.service_refund_operations.initiated_by IS
  'Historical audit snapshot UUID; intentionally no foreign key so account deletion does not erase the recorded identifier.';

ALTER TABLE public.inquiry_messages
  ADD COLUMN IF NOT EXISTS workflow_event_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inquiry_messages_workflow_event
  ON public.inquiry_messages (inquiry_id, workflow_event_key)
  WHERE workflow_event_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inquiries_service_admin_support
  ON public.inquiries (user_id, service_request_id)
  WHERE service_request_id IS NOT NULL
    AND type = 'admin_support'
    AND host_id IS NULL;

-- Preserve any rows created between planning and release without repricing them.
INSERT INTO public.service_request_schedule_items (
  request_id, service_date, start_time, duration_hours, sort_order, legacy_imported
)
SELECT
  sr.id,
  sr.service_date,
  CASE
    WHEN sr.start_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN sr.start_time::TIME
    ELSE TIME '09:00'
  END,
  LEAST(168, GREATEST(3, sr.duration_hours)),
  0,
  TRUE
FROM public.service_requests sr
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_request_schedule_items si WHERE si.request_id = sr.id
)
ON CONFLICT (request_id, service_date) DO NOTHING;

UPDATE public.service_requests sr
SET service_end_at = (
  (si.service_date + si.start_time) AT TIME ZONE 'Asia/Tokyo'
) + make_interval(hours => CASE WHEN si.legacy_imported THEN sr.duration_hours ELSE si.duration_hours END)
FROM public.service_request_schedule_items si
WHERE si.request_id = sr.id
  AND si.sort_order = (
    SELECT max(si2.sort_order)
    FROM public.service_request_schedule_items si2
    WHERE si2.request_id = sr.id
  )
  AND sr.service_end_at IS NULL;

-- Expand-phase compatibility: the currently deployed application still calls
-- this RPC until the concierge application cutover. Keep its signature and
-- response contract while atomically populating the new schedule projection.
CREATE OR REPLACE FUNCTION public.create_service_request_with_booking_atomic(
  p_user_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_city TEXT,
  p_country TEXT,
  p_service_date DATE,
  p_start_time TEXT,
  p_duration_hours INTEGER,
  p_languages TEXT[],
  p_guest_count INTEGER,
  p_contact_name TEXT,
  p_contact_phone TEXT
)
RETURNS TABLE (request_id UUID, booking_id TEXT, order_id TEXT, amount INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.service_requests%ROWTYPE;
  v_booking_id TEXT;
  v_order_id TEXT;
  v_legacy_start_time TIME;
BEGIN
  v_legacy_start_time := CASE
    WHEN p_start_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN p_start_time::TIME
    ELSE TIME '09:00'
  END;

  INSERT INTO public.service_requests (
    user_id, title, description, city, country, service_date, start_time,
    duration_hours, languages, guest_count, contact_name, contact_phone,
    service_end_at, status
  ) VALUES (
    p_user_id, trim(p_title), trim(p_description), p_city, p_country,
    p_service_date, p_start_time, p_duration_hours,
    COALESCE(p_languages, ARRAY[]::TEXT[]), p_guest_count,
    trim(p_contact_name), trim(p_contact_phone),
    ((p_service_date + v_legacy_start_time) AT TIME ZONE 'Asia/Tokyo')
      + make_interval(hours => p_duration_hours),
    'pending_payment'
  )
  RETURNING * INTO v_request;

  INSERT INTO public.service_request_schedule_items (
    request_id, service_date, start_time, duration_hours, sort_order, legacy_imported
  ) VALUES (
    v_request.id, p_service_date, v_legacy_start_time,
    p_duration_hours, 0, TRUE
  );

  v_order_id := 'SVC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::TEXT, 1, 8));
  v_booking_id := v_order_id;

  INSERT INTO public.service_bookings (
    id, order_id, request_id, application_id, customer_id, host_id, amount,
    host_payout_amount, platform_revenue, status, contact_name, contact_phone,
    payment_method, payout_status
  ) VALUES (
    v_booking_id, v_order_id, v_request.id, NULL, p_user_id, NULL,
    v_request.total_customer_price, v_request.total_host_payout,
    v_request.total_customer_price - v_request.total_host_payout,
    'PENDING', trim(p_contact_name), trim(p_contact_phone), 'card', 'pending'
  );

  RETURN QUERY SELECT v_request.id, v_booking_id, v_order_id, v_request.total_customer_price;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_service_concierge_request_atomic(
  p_user_id UUID,
  p_service_type TEXT,
  p_description TEXT,
  p_city TEXT,
  p_schedule JSONB,
  p_languages TEXT[],
  p_guest_count INTEGER,
  p_contact_name TEXT,
  p_contact_phone TEXT,
  p_client_request_key TEXT
)
RETURNS TABLE (
  request_id UUID,
  booking_id TEXT,
  order_id TEXT,
  amount INTEGER,
  hourly_rate INTEGER,
  pricing_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.service_requests%ROWTYPE;
  v_existing_booking public.service_bookings%ROWTYPE;
  v_first_service_date DATE;
  v_first_start_time TIME;
  v_last_service_date DATE;
  v_last_start_time TIME;
  v_last_duration_hours INTEGER;
  v_parsed_schedule JSONB;
  v_total_hours INTEGER;
  v_schedule_count INTEGER;
  v_order_id TEXT;
  v_hourly_rate INTEGER;
  v_host_hourly_rate INTEGER;
  v_pricing_tier TEXT;
  v_pricing_reason TEXT;
BEGIN
  IF p_service_type NOT IN ('general', 'business') THEN
    RAISE EXCEPTION 'SVC_INVALID_SERVICE_TYPE';
  END IF;
  IF p_guest_count NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'SVC_INVALID_GUEST_COUNT';
  END IF;
  IF COALESCE(array_length(p_languages, 1), 0) NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'SVC_INVALID_LANGUAGES';
  END IF;
  IF jsonb_typeof(p_schedule) <> 'array' OR jsonb_array_length(p_schedule) NOT BETWEEN 1 AND 56 THEN
    RAISE EXCEPTION 'SVC_INVALID_SCHEDULE';
  END IF;
  IF nullif(trim(p_client_request_key), '') IS NULL THEN
    RAISE EXCEPTION 'SVC_IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT || ':' || trim(p_client_request_key), 0));

  SELECT sr.* INTO v_request
  FROM public.service_requests sr
  WHERE sr.user_id = p_user_id
    AND sr.client_request_key = trim(p_client_request_key);

  IF FOUND THEN
    SELECT sb.* INTO v_existing_booking
    FROM public.service_bookings sb
    WHERE sb.request_id = v_request.id
    ORDER BY sb.created_at ASC
    LIMIT 1;

    RETURN QUERY SELECT
      v_request.id,
      v_existing_booking.id,
      v_existing_booking.order_id,
      v_existing_booking.amount,
      v_request.hourly_rate_customer,
      v_request.pricing_reason;
    RETURN;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'service_date', (entry.value->>'serviceDate')::DATE,
        'start_time', (entry.value->>'startTime')::TIME,
        'duration_hours', (entry.value->>'durationHours')::INTEGER,
        'sort_order', (entry.ordinality - 1)::INTEGER
      )
      ORDER BY entry.ordinality
    ),
    '[]'::JSONB
  )
  INTO v_parsed_schedule
  FROM jsonb_array_elements(p_schedule) WITH ORDINALITY AS entry(value, ordinality);

  SELECT count(*), sum(ts.duration_hours) INTO v_schedule_count, v_total_hours
  FROM jsonb_to_recordset(v_parsed_schedule) AS ts(
    service_date DATE,
    start_time TIME,
    duration_hours INTEGER,
    sort_order INTEGER
  );

  IF v_schedule_count <> jsonb_array_length(p_schedule)
     OR v_total_hours NOT BETWEEN 3 AND 168
     OR EXISTS (
       SELECT 1
       FROM jsonb_to_recordset(v_parsed_schedule) AS ts(
         service_date DATE,
         start_time TIME,
         duration_hours INTEGER,
         sort_order INTEGER
       )
       WHERE ts.duration_hours NOT BETWEEN 3 AND 24
          OR extract(minute FROM ts.start_time) NOT IN (0, 30)
          OR ts.service_date < timezone('Asia/Tokyo', now())::DATE
     )
     OR EXISTS (
       SELECT 1
       FROM jsonb_to_recordset(v_parsed_schedule) AS ts(
         service_date DATE,
         start_time TIME,
         duration_hours INTEGER,
         sort_order INTEGER
       )
       GROUP BY ts.service_date
       HAVING count(*) > 1
     )
     OR EXISTS (
       SELECT 1
       FROM jsonb_to_recordset(v_parsed_schedule) AS earlier(
         service_date DATE,
         start_time TIME,
         duration_hours INTEGER,
         sort_order INTEGER
       )
       JOIN jsonb_to_recordset(v_parsed_schedule) AS later(
         service_date DATE,
         start_time TIME,
         duration_hours INTEGER,
         sort_order INTEGER
       )
         ON (earlier.service_date, earlier.start_time) < (later.service_date, later.start_time)
       WHERE (earlier.service_date + earlier.start_time) + make_interval(hours => earlier.duration_hours)
             > (later.service_date + later.start_time)
     ) THEN
    RAISE EXCEPTION 'SVC_INVALID_SCHEDULE';
  END IF;

  SELECT service_date, start_time
  INTO v_first_service_date, v_first_start_time
  FROM jsonb_to_recordset(v_parsed_schedule) AS parsed_schedule(
    service_date DATE,
    start_time TIME,
    duration_hours INTEGER,
    sort_order INTEGER
  )
  ORDER BY service_date, start_time
  LIMIT 1;

  SELECT service_date, start_time, duration_hours
  INTO v_last_service_date, v_last_start_time, v_last_duration_hours
  FROM jsonb_to_recordset(v_parsed_schedule) AS parsed_schedule(
    service_date DATE,
    start_time TIME,
    duration_hours INTEGER,
    sort_order INTEGER
  )
  ORDER BY service_date DESC, start_time DESC
  LIMIT 1;

  v_pricing_tier := CASE WHEN p_service_type = 'business' OR p_guest_count >= 6 THEN 'premium' ELSE 'standard' END;
  v_pricing_reason := CASE
    WHEN p_service_type = 'business' AND p_guest_count >= 6 THEN 'business_and_group_6_plus'
    WHEN p_service_type = 'business' THEN 'business'
    WHEN p_guest_count >= 6 THEN 'group_6_plus'
    ELSE 'standard'
  END;
  v_hourly_rate := CASE WHEN v_pricing_tier = 'premium' THEN 55000 ELSE 35000 END;
  v_host_hourly_rate := CASE WHEN v_pricing_tier = 'standard' THEN 20000 ELSE NULL END;

  INSERT INTO public.service_requests (
    user_id, title, description, city, country, service_date, start_time,
    duration_hours, languages, guest_count, service_type, pricing_tier,
    pricing_reason, hourly_rate_customer, hourly_rate_host, service_end_at,
    contact_name, contact_phone, client_request_key, status
  ) VALUES (
    p_user_id,
    trim(p_city) || ' · ' || v_first_service_date::TEXT,
    trim(p_description), trim(p_city), 'Japan', v_first_service_date,
    to_char(v_first_start_time, 'HH24:MI'), v_total_hours, COALESCE(p_languages, ARRAY[]::TEXT[]),
    p_guest_count, p_service_type, v_pricing_tier, v_pricing_reason,
    v_hourly_rate, v_host_hourly_rate,
    ((v_last_service_date + v_last_start_time) AT TIME ZONE 'Asia/Tokyo') + make_interval(hours => v_last_duration_hours),
    trim(p_contact_name), trim(p_contact_phone), trim(p_client_request_key), 'pending_payment'
  ) RETURNING * INTO v_request;

  INSERT INTO public.service_request_schedule_items (
    request_id, service_date, start_time, duration_hours, sort_order
  )
  SELECT v_request.id, ts.service_date, ts.start_time, ts.duration_hours,
         row_number() OVER (ORDER BY ts.service_date, ts.start_time)::INTEGER - 1
  FROM jsonb_to_recordset(v_parsed_schedule) AS ts(
    service_date DATE,
    start_time TIME,
    duration_hours INTEGER,
    sort_order INTEGER
  )
  ORDER BY ts.service_date, ts.start_time;

  v_order_id := 'SVC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::TEXT, 1, 8));

  INSERT INTO public.service_bookings (
    id, order_id, request_id, application_id, customer_id, host_id, amount,
    host_payout_amount, platform_revenue, status, contact_name, contact_phone,
    payment_method, payout_status, host_compensation_amount
  ) VALUES (
    v_order_id, v_order_id, v_request.id, NULL, p_user_id, NULL,
    v_request.total_customer_price, v_request.total_host_payout,
    CASE WHEN v_request.total_host_payout IS NULL THEN NULL ELSE v_request.total_customer_price - v_request.total_host_payout END,
    'PENDING', trim(p_contact_name), trim(p_contact_phone), NULL, 'pending', 0
  ) RETURNING * INTO v_existing_booking;

  RETURN QUERY SELECT
    v_request.id, v_existing_booking.id, v_existing_booking.order_id,
    v_existing_booking.amount, v_request.hourly_rate_customer, v_request.pricing_reason;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_service_concierge_payment_atomic(
  p_order_id TEXT,
  p_payment_method TEXT,
  p_tid TEXT DEFAULT NULL
)
RETURNS TABLE (
  booking_id TEXT,
  request_id UUID,
  customer_id UUID,
  amount INTEGER,
  already_processed BOOLEAN,
  support_inquiry_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.service_bookings%ROWTYPE;
  v_request public.service_requests%ROWTYPE;
  v_inquiry_id public.inquiries.id%TYPE;
  v_schedule_text TEXT;
  v_summary TEXT;
  v_was_processed BOOLEAN;
BEGIN
  IF lower(trim(p_payment_method)) NOT IN ('card', 'bank', 'paypal') THEN
    RAISE EXCEPTION 'SVC_INVALID_PAYMENT_METHOD';
  END IF;
  SELECT * INTO v_booking
  FROM public.service_bookings sb
  WHERE sb.order_id = trim(p_order_id)
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'SVC_NOT_FOUND'; END IF;
  IF (
    lower(trim(p_payment_method)) = 'bank'
    AND lower(trim(COALESCE(v_booking.payment_method, ''))) <> 'bank'
  ) OR (
    nullif(lower(trim(COALESCE(v_booking.payment_method, ''))), '') IS NOT NULL
    AND lower(trim(v_booking.payment_method)) <> lower(trim(p_payment_method))
  ) THEN
    RAISE EXCEPTION 'SVC_INVALID_PAYMENT_METHOD';
  END IF;
  IF v_booking.status IN ('cancelled', 'cancellation_requested') THEN
    RAISE EXCEPTION 'SVC_PAYMENT_INVALID_STATUS';
  END IF;

  SELECT * INTO v_request
  FROM public.service_requests sr
  WHERE sr.id = v_booking.request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'SVC_REQUEST_MISSING'; END IF;
  v_was_processed := v_booking.status IN ('PAID', 'confirmed', 'completed');

  IF v_booking.status = 'PENDING' THEN
    UPDATE public.service_bookings
    SET status = 'PAID', payment_method = lower(trim(p_payment_method)), tid = COALESCE(nullif(trim(p_tid), ''), tid)
    WHERE id = v_booking.id AND status = 'PENDING';
  ELSIF NOT v_was_processed THEN
    RAISE EXCEPTION 'SVC_PAYMENT_INVALID_STATUS';
  END IF;

  IF v_request.status IN ('pending_payment', 'open') THEN
    UPDATE public.service_requests SET status = 'assigning' WHERE id = v_request.id;
    v_request.status := 'assigning';
  END IF;

  SELECT string_agg(
    to_char(si.service_date, 'YYYY-MM-DD') || ' ' || to_char(si.start_time, 'HH24:MI') || ' / ' || si.duration_hours || '시간',
    E'\n' ORDER BY si.sort_order
  ) INTO v_schedule_text
  FROM public.service_request_schedule_items si
  WHERE si.request_id = v_request.id;

  v_summary := format(
    E'[맞춤 동행·통역 신청서]\n주문번호: %s\n유형: %s\n요금 기준: %s\n지역: 일본 / %s\n일정:\n%s\n총 이용시간: %s시간\n인원: %s명\n언어: %s\n요청 내용: %s\n연락처: %s / %s\n결제: %s / %s원',
    v_booking.order_id,
    CASE WHEN v_request.service_type = 'business' THEN '비즈니스 통역' ELSE '일반 동행·생활 통역' END,
    v_request.pricing_reason,
    v_request.city,
    COALESCE(v_schedule_text, v_request.service_date::TEXT || ' ' || v_request.start_time),
    v_request.duration_hours,
    v_request.guest_count,
    COALESCE(array_to_string(v_request.languages, ', '), '-'),
    v_request.description,
    COALESCE(v_request.contact_name, '-'),
    COALESCE(v_request.contact_phone, '-'),
    lower(trim(p_payment_method)),
    v_booking.amount
  );

  INSERT INTO public.inquiries (
    user_id, host_id, experience_id, service_request_id, content, type
  ) VALUES (
    v_booking.customer_id, NULL, NULL, v_request.id, v_summary, 'admin_support'
  )
  ON CONFLICT (user_id, service_request_id)
    WHERE service_request_id IS NOT NULL AND type = 'admin_support' AND host_id IS NULL
  DO UPDATE SET updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_inquiry_id;

  INSERT INTO public.inquiry_messages (
    inquiry_id, sender_id, content, type, is_read, workflow_event_key
  ) VALUES (
    v_inquiry_id, v_booking.customer_id, v_summary, 'text', FALSE,
    'service:' || v_request.id::TEXT || ':payment-summary'
  ) ON CONFLICT (inquiry_id, workflow_event_key)
    WHERE workflow_event_key IS NOT NULL DO NOTHING;

  UPDATE public.inquiries SET content = v_summary, updated_at = now() WHERE id = v_inquiry_id;

  RETURN QUERY SELECT
    v_booking.id, v_request.id, v_booking.customer_id, v_booking.amount,
    v_was_processed, v_inquiry_id::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_service_concierge_host_atomic(
  p_admin_id UUID,
  p_request_id UUID,
  p_host_id UUID,
  p_host_hourly_rate INTEGER,
  p_host_agreement_confirmed BOOLEAN
)
RETURNS TABLE (
  request_id UUID,
  host_id UUID,
  host_hourly_rate INTEGER,
  host_payout_amount INTEGER,
  host_inquiry_id TEXT,
  already_assigned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.service_requests%ROWTYPE;
  v_booking public.service_bookings%ROWTYPE;
  v_rate INTEGER;
  v_payout INTEGER;
  v_inquiry_id public.inquiries.id%TYPE;
  v_summary TEXT;
BEGIN
  IF p_host_agreement_confirmed IS NOT TRUE THEN RAISE EXCEPTION 'SVC_HOST_AGREEMENT_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = p_admin_id AND u.role = 'admin'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.admin_whitelist aw JOIN auth.users au ON lower(au.email) = lower(aw.email)
    WHERE au.id = p_admin_id
  ) THEN RAISE EXCEPTION 'SVC_ASSIGN_FORBIDDEN'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.host_applications ha
    WHERE ha.user_id = p_host_id AND ha.status = 'approved'
  ) THEN RAISE EXCEPTION 'SVC_HOST_NOT_APPROVED'; END IF;

  SELECT * INTO v_request FROM public.service_requests sr WHERE sr.id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SVC_NOT_FOUND'; END IF;
  IF v_request.status NOT IN ('assigning', 'matched') THEN RAISE EXCEPTION 'SVC_ASSIGN_INVALID_STATUS'; END IF;
  IF v_request.user_id = p_host_id THEN RAISE EXCEPTION 'SVC_HOST_IS_CUSTOMER'; END IF;

  SELECT * INTO v_booking
  FROM public.service_bookings sb
  WHERE sb.request_id = p_request_id AND sb.status IN ('PAID', 'confirmed')
  ORDER BY sb.created_at ASC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SVC_BOOKING_MISSING'; END IF;

  v_rate := CASE WHEN v_request.pricing_tier = 'standard' THEN 20000 ELSE p_host_hourly_rate END;
  IF v_rate IS NULL OR v_rate <= 0 OR v_rate > v_request.hourly_rate_customer THEN
    RAISE EXCEPTION 'SVC_INVALID_HOST_RATE';
  END IF;

  IF v_request.selected_host_id = p_host_id AND v_booking.host_id = p_host_id AND v_booking.status = 'confirmed' THEN
    SELECT i.id INTO v_inquiry_id
    FROM public.inquiries i
    WHERE i.service_request_id = p_request_id AND i.host_id = p_host_id AND i.type = 'general'
    LIMIT 1;
    IF v_inquiry_id IS NULL THEN RAISE EXCEPTION 'SVC_HOST_INQUIRY_MISSING'; END IF;
    RETURN QUERY SELECT p_request_id, p_host_id, COALESCE(v_request.hourly_rate_host, v_rate),
      COALESCE(v_booking.host_payout_amount, v_rate * v_request.duration_hours), v_inquiry_id::TEXT, TRUE;
    RETURN;
  END IF;

  IF v_request.selected_host_id IS NOT NULL OR v_booking.host_id IS NOT NULL THEN
    RAISE EXCEPTION 'SVC_ALREADY_ASSIGNED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.service_request_schedule_items candidate
    JOIN public.service_requests other_request
      ON other_request.selected_host_id = p_host_id
     AND other_request.id <> p_request_id
     AND other_request.status IN ('matched', 'paid', 'confirmed')
    JOIN public.service_request_schedule_items other_item
      ON other_item.request_id = other_request.id
    WHERE ((candidate.service_date + candidate.start_time) AT TIME ZONE 'Asia/Tokyo')
            < ((other_item.service_date + other_item.start_time) AT TIME ZONE 'Asia/Tokyo') + make_interval(hours => other_item.duration_hours)
      AND ((other_item.service_date + other_item.start_time) AT TIME ZONE 'Asia/Tokyo')
            < ((candidate.service_date + candidate.start_time) AT TIME ZONE 'Asia/Tokyo') + make_interval(hours => candidate.duration_hours)
      AND candidate.request_id = p_request_id
  ) THEN RAISE EXCEPTION 'SVC_HOST_SCHEDULE_CONFLICT'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.service_request_schedule_items candidate
    JOIN public.bookings b
      ON b.status IN ('PAID', 'paid', 'confirmed')
     AND b.date = candidate.service_date
     AND b.time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
    JOIN public.experiences e ON e.id = b.experience_id AND e.host_id = p_host_id
    WHERE candidate.request_id = p_request_id
      AND ((candidate.service_date + candidate.start_time) AT TIME ZONE 'Asia/Tokyo')
            < ((b.date + b.time::TIME) AT TIME ZONE 'Asia/Tokyo') + make_interval(hours => GREATEST(1, COALESCE(e.duration, 1)::INTEGER))
      AND ((b.date + b.time::TIME) AT TIME ZONE 'Asia/Tokyo')
            < ((candidate.service_date + candidate.start_time) AT TIME ZONE 'Asia/Tokyo') + make_interval(hours => candidate.duration_hours)
  ) THEN RAISE EXCEPTION 'SVC_HOST_SCHEDULE_CONFLICT'; END IF;

  v_payout := v_rate * v_request.duration_hours;

  UPDATE public.service_requests
  SET status = 'matched', selected_host_id = p_host_id, selected_application_id = NULL,
      hourly_rate_host = v_rate
  WHERE id = p_request_id;

  UPDATE public.service_bookings
  SET status = 'confirmed', host_id = p_host_id, application_id = NULL,
      host_payout_amount = v_payout, platform_revenue = amount - v_payout
  WHERE id = v_booking.id;

  INSERT INTO public.service_assignment_history (
    request_id, host_id, assigned_by, hourly_rate_host, total_host_payout, host_agreement_confirmed
  ) VALUES (p_request_id, p_host_id, p_admin_id, v_rate, v_payout, TRUE);

  v_summary := format(
    E'[맞춤 동행·통역 배정 안내]\n%s\n지역: %s\n총 %s시간 / %s명\n요청 내용: %s',
    v_request.title, v_request.city, v_request.duration_hours, v_request.guest_count, v_request.description
  );

  INSERT INTO public.inquiries AS target_inquiry (
    user_id, host_id, experience_id, service_request_id, content, type
  ) VALUES (
    v_request.user_id, p_host_id, NULL, p_request_id, v_summary, 'general'
  )
  ON CONFLICT (
    (target_inquiry.user_id),
    (target_inquiry.host_id),
    (target_inquiry.service_request_id)
  )
    WHERE target_inquiry.service_request_id IS NOT NULL AND target_inquiry.type = 'general'
  DO UPDATE SET status = 'open', updated_at = now()
  RETURNING target_inquiry.id INTO v_inquiry_id;

  INSERT INTO public.inquiry_messages (
    inquiry_id, sender_id, content, type, is_read, workflow_event_key
  ) VALUES (
    v_inquiry_id, v_request.user_id, v_summary, 'text', FALSE,
    'service:' || p_request_id::TEXT || ':host-assigned:' || p_host_id::TEXT
  ) ON CONFLICT (inquiry_id, workflow_event_key)
    WHERE workflow_event_key IS NOT NULL DO NOTHING;

  UPDATE public.inquiries SET content = v_summary, updated_at = now() WHERE id = v_inquiry_id;

  RETURN QUERY SELECT p_request_id, p_host_id, v_rate, v_payout, v_inquiry_id::TEXT, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_service_concierge_booking_if_due_atomic(
  p_booking_id TEXT
)
RETURNS TABLE (
  booking_id TEXT,
  order_id TEXT,
  request_id UUID,
  host_id UUID,
  service_end_at TIMESTAMPTZ,
  already_processed BOOLEAN,
  not_due BOOLEAN,
  completed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.service_bookings%ROWTYPE;
  v_request public.service_requests%ROWTYPE;
  v_changed BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_booking FROM public.service_bookings sb WHERE sb.id = trim(p_booking_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SVC_COMPLETE_NOT_FOUND'; END IF;
  SELECT * INTO v_request FROM public.service_requests sr WHERE sr.id = v_booking.request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SVC_COMPLETE_REQUEST_MISSING'; END IF;

  IF v_request.service_end_at IS NULL OR now() < v_request.service_end_at THEN
    RETURN QUERY SELECT v_booking.id, v_booking.order_id, v_request.id, v_booking.host_id,
      v_request.service_end_at, FALSE, TRUE, FALSE;
    RETURN;
  END IF;
  IF v_booking.host_id IS NULL OR v_booking.host_payout_amount IS NULL THEN
    RAISE EXCEPTION 'SVC_COMPLETE_ASSIGNMENT_MISSING';
  END IF;
  IF v_booking.status NOT IN ('confirmed', 'completed') OR v_request.status NOT IN ('matched', 'completed') THEN
    RAISE EXCEPTION 'SVC_COMPLETE_INVALID_STATUS';
  END IF;

  IF v_booking.status = 'confirmed' THEN
    UPDATE public.service_bookings SET status = 'completed' WHERE id = v_booking.id AND status = 'confirmed';
    v_changed := TRUE;
  END IF;
  IF v_request.status = 'matched' THEN
    UPDATE public.service_requests SET status = 'completed' WHERE id = v_request.id AND status = 'matched';
    v_changed := TRUE;
  END IF;

  RETURN QUERY SELECT v_booking.id, v_booking.order_id, v_request.id, v_booking.host_id,
    v_request.service_end_at, NOT v_changed, FALSE, v_changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_service_refund_operation_atomic(
  p_admin_id UUID,
  p_order_id TEXT,
  p_refund_amount INTEGER,
  p_host_compensation_amount INTEGER,
  p_idempotency_key TEXT
)
RETURNS TABLE (operation_id UUID, booking_id TEXT, previous_status TEXT, already_started BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.service_bookings%ROWTYPE;
  v_operation public.service_refund_operations%ROWTYPE;
  v_previous_status TEXT;
BEGIN
  SELECT * INTO v_booking FROM public.service_bookings sb WHERE sb.order_id = trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SVC_NOT_FOUND'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = p_admin_id
  ) OR (
    v_booking.customer_id IS DISTINCT FROM p_admin_id
    AND NOT EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = v_booking.request_id AND sr.user_id = p_admin_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = p_admin_id AND u.role = 'admin'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.admin_whitelist aw
      JOIN auth.users au ON lower(au.email) = lower(aw.email)
      WHERE au.id = p_admin_id
    )
  ) THEN RAISE EXCEPTION 'SVC_REFUND_FORBIDDEN'; END IF;
  IF p_refund_amount < 0 OR p_refund_amount > v_booking.amount THEN RAISE EXCEPTION 'SVC_INVALID_REFUND'; END IF;
  IF p_host_compensation_amount < 0 OR p_host_compensation_amount > COALESCE(v_booking.host_payout_amount, 0) THEN
    RAISE EXCEPTION 'SVC_INVALID_HOST_COMPENSATION';
  END IF;
  IF nullif(trim(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'SVC_IDEMPOTENCY_KEY_REQUIRED'; END IF;

  SELECT * INTO v_operation
  FROM public.service_refund_operations ro
  WHERE ro.booking_id = v_booking.id AND ro.idempotency_key = trim(p_idempotency_key);
  IF FOUND THEN
    RETURN QUERY SELECT v_operation.id, v_booking.id, v_operation.previous_booking_status, TRUE;
    RETURN;
  END IF;

  IF v_booking.status = 'cancelled' THEN RAISE EXCEPTION 'SVC_ALREADY_CANCELLED'; END IF;
  IF v_booking.status NOT IN ('PENDING', 'PAID', 'confirmed', 'cancellation_requested') THEN
    RAISE EXCEPTION 'SVC_REFUND_INVALID_STATUS';
  END IF;
  IF v_booking.status = 'cancellation_requested' AND EXISTS (
    SELECT 1 FROM public.service_refund_operations ro
    WHERE ro.booking_id = v_booking.id AND ro.status IN ('started', 'unknown')
  ) THEN RAISE EXCEPTION 'SVC_REFUND_IN_PROGRESS'; END IF;

  v_previous_status := CASE
    WHEN v_booking.status <> 'cancellation_requested' THEN v_booking.status
    WHEN v_booking.host_id IS NULL THEN 'PAID'
    ELSE 'confirmed'
  END;

  INSERT INTO public.service_refund_operations (
    booking_id, idempotency_key, initiated_by, previous_booking_status,
    refund_amount, host_compensation_amount
  ) VALUES (
    v_booking.id, trim(p_idempotency_key), p_admin_id, v_previous_status,
    p_refund_amount, p_host_compensation_amount
  ) RETURNING * INTO v_operation;

  UPDATE public.service_bookings SET status = 'cancellation_requested' WHERE id = v_booking.id;
  UPDATE public.service_requests SET status = 'cancellation_requested' WHERE id = v_booking.request_id;

  RETURN QUERY SELECT v_operation.id, v_booking.id, v_operation.previous_booking_status, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pending_service_concierge_atomic(
  p_actor_id UUID,
  p_order_id TEXT,
  p_cancel_reason TEXT
)
RETURNS TABLE (booking_id TEXT, request_id UUID, already_cancelled BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.service_bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM public.service_bookings sb WHERE sb.order_id = trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SVC_NOT_FOUND'; END IF;
  IF v_booking.customer_id <> p_actor_id AND NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = p_actor_id AND u.role = 'admin'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.admin_whitelist aw JOIN auth.users au ON lower(au.email) = lower(aw.email)
    WHERE au.id = p_actor_id
  ) THEN RAISE EXCEPTION 'SVC_CANCEL_FORBIDDEN'; END IF;
  IF v_booking.status = 'cancelled' THEN
    RETURN QUERY SELECT v_booking.id, v_booking.request_id, TRUE;
    RETURN;
  END IF;
  IF v_booking.status <> 'PENDING' THEN RAISE EXCEPTION 'SVC_CANCEL_NOT_PENDING'; END IF;

  UPDATE public.service_bookings
  SET status = 'cancelled', cancel_reason = left(COALESCE(NULLIF(trim(p_cancel_reason), ''), '취소'), 500), refund_amount = 0
  WHERE id = v_booking.id;
  UPDATE public.service_requests SET status = 'cancelled' WHERE id = v_booking.request_id;
  RETURN QUERY SELECT v_booking.id, v_booking.request_id, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_service_cancellation_review_atomic(
  p_actor_id UUID,
  p_order_id TEXT,
  p_cancel_reason TEXT
)
RETURNS TABLE (booking_id TEXT, request_id UUID, already_requested BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.service_bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM public.service_bookings sb WHERE sb.order_id = trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SVC_NOT_FOUND'; END IF;
  IF v_booking.customer_id <> p_actor_id AND v_booking.host_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'SVC_CANCEL_FORBIDDEN';
  END IF;
  IF v_booking.status = 'cancellation_requested' THEN
    RETURN QUERY SELECT v_booking.id, v_booking.request_id, TRUE;
    RETURN;
  END IF;
  IF v_booking.status NOT IN ('PAID', 'confirmed') THEN
    RAISE EXCEPTION 'SVC_CANCEL_REVIEW_INVALID_STATUS';
  END IF;

  UPDATE public.service_bookings
  SET status = 'cancellation_requested', cancel_reason = left(COALESCE(NULLIF(trim(p_cancel_reason), ''), '취소 요청'), 500)
  WHERE id = v_booking.id;
  UPDATE public.service_requests SET status = 'cancellation_requested' WHERE id = v_booking.request_id;
  RETURN QUERY SELECT v_booking.id, v_booking.request_id, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_service_refund_operation_atomic(
  p_operation_id UUID,
  p_outcome TEXT,
  p_provider_reference TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE (booking_id TEXT, request_id UUID, operation_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_operation public.service_refund_operations%ROWTYPE;
  v_booking public.service_bookings%ROWTYPE;
BEGIN
  IF p_outcome NOT IN ('succeeded', 'failed', 'unknown') THEN RAISE EXCEPTION 'SVC_INVALID_REFUND_OUTCOME'; END IF;
  SELECT * INTO v_operation FROM public.service_refund_operations ro WHERE ro.id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SVC_REFUND_NOT_FOUND'; END IF;
  SELECT * INTO v_booking FROM public.service_bookings sb WHERE sb.id = v_operation.booking_id FOR UPDATE;

  IF v_operation.status = 'applied' THEN
    RETURN QUERY SELECT v_booking.id, v_booking.request_id, v_operation.status;
    RETURN;
  END IF;

  UPDATE public.service_refund_operations
  SET status = p_outcome, provider_reference = p_provider_reference,
      error_message = p_error_message, updated_at = now(),
      completed_at = CASE WHEN p_outcome <> 'unknown' THEN now() ELSE NULL END
  WHERE id = p_operation_id;

  IF p_outcome = 'failed' THEN
    UPDATE public.service_bookings SET status = v_operation.previous_booking_status WHERE id = v_booking.id;
    UPDATE public.service_requests
    SET status = CASE
      WHEN v_operation.previous_booking_status = 'PENDING' THEN 'pending_payment'
      WHEN v_operation.previous_booking_status = 'PAID' THEN 'assigning'
      ELSE 'matched'
    END
    WHERE id = v_booking.request_id;
  ELSIF p_outcome = 'succeeded' THEN
    UPDATE public.service_bookings
    SET status = 'cancelled', refund_amount = v_operation.refund_amount,
        host_compensation_amount = v_operation.host_compensation_amount,
        platform_revenue = amount - v_operation.refund_amount - v_operation.host_compensation_amount,
        payout_status = CASE WHEN v_operation.host_compensation_amount > 0 THEN 'pending' ELSE payout_status END
    WHERE id = v_booking.id;
    UPDATE public.service_requests SET status = 'cancelled' WHERE id = v_booking.request_id;
    UPDATE public.service_refund_operations
    SET status = 'applied', updated_at = now(), completed_at = now()
    WHERE id = p_operation_id;
  END IF;

  RETURN QUERY SELECT v_booking.id, v_booking.request_id,
    CASE WHEN p_outcome = 'succeeded' THEN 'applied' ELSE p_outcome END;
END;
$$;

REVOKE ALL ON FUNCTION public.create_service_concierge_request_atomic(UUID, TEXT, TEXT, TEXT, JSONB, TEXT[], INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_service_concierge_payment_atomic(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_service_concierge_host_atomic(UUID, UUID, UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_service_concierge_booking_if_due_atomic(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_service_refund_operation_atomic(UUID, TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_service_refund_operation_atomic(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_pending_service_concierge_atomic(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_service_cancellation_review_atomic(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_service_concierge_request_atomic(UUID, TEXT, TEXT, TEXT, JSONB, TEXT[], INTEGER, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_service_concierge_payment_atomic(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_service_concierge_host_atomic(UUID, UUID, UUID, INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_service_concierge_booking_if_due_atomic(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_service_refund_operation_atomic(UUID, TEXT, INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_service_refund_operation_atomic(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_pending_service_concierge_atomic(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_service_cancellation_review_atomic(UUID, TEXT, TEXT) TO service_role;
