ALTER TABLE public.bookings
  ADD COLUMN payment_claim_state text,
  ADD COLUMN payment_claim_expires_at timestamp with time zone,
  ADD COLUMN payment_provider text,
  ADD COLUMN payment_provider_reference text,
  ADD COLUMN payment_claim_token uuid;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_claim_state_check
  CHECK (
    payment_claim_state IS NULL
    OR payment_claim_state IN (
      'claimed',
      'processing',
      'reconciliation_required',
      'completed',
      'released'
    )
  );

CREATE UNIQUE INDEX bookings_payment_provider_reference_key
  ON public.bookings (payment_provider, payment_provider_reference)
  WHERE payment_provider_reference IS NOT NULL;

CREATE INDEX bookings_pending_cleanup_candidate_idx
  ON public.bookings (payment_method, created_at, id)
  WHERE lower(status) = 'pending' AND tid IS NULL;

CREATE INDEX bookings_payment_claim_reconciliation_idx
  ON public.bookings (payment_claim_state, payment_claim_expires_at)
  WHERE payment_claim_state IN ('processing', 'reconciliation_required');

CREATE OR REPLACE FUNCTION public.guard_experience_payment_claim_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.payment_claim_state IS NOT NULL
         OR NEW.payment_claim_expires_at IS NOT NULL
         OR NEW.payment_provider IS NOT NULL
         OR NEW.payment_provider_reference IS NOT NULL
         OR NEW.payment_claim_token IS NOT NULL THEN
        RAISE EXCEPTION 'PAYMENT_CLAIM_COLUMNS_FORBIDDEN' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.payment_claim_state IS DISTINCT FROM OLD.payment_claim_state
       OR NEW.payment_claim_expires_at IS DISTINCT FROM OLD.payment_claim_expires_at
       OR NEW.payment_provider IS DISTINCT FROM OLD.payment_provider
       OR NEW.payment_provider_reference IS DISTINCT FROM OLD.payment_provider_reference
       OR NEW.payment_claim_token IS DISTINCT FROM OLD.payment_claim_token THEN
      RAISE EXCEPTION 'PAYMENT_CLAIM_COLUMNS_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER bookings_payment_claim_columns_server_only
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_experience_payment_claim_columns();

CREATE OR REPLACE FUNCTION public.claim_experience_payment_atomic(
  p_booking_id text,
  p_user_id uuid,
  p_provider text,
  p_provider_reference text DEFAULT NULL
)
RETURNS TABLE (
  outcome text,
  provider text,
  provider_reference text,
  claim_expires_at timestamp with time zone,
  claim_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_reference text := nullif(btrim(coalesce(p_provider_reference, '')), '');
  v_method text;
  v_expiry_interval interval;
  v_claim_token uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'PAYMENT_CLAIM_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF nullif(btrim(coalesce(p_booking_id, '')), '') IS NULL
     OR p_user_id IS NULL
     OR v_provider = '' THEN
    RAISE EXCEPTION 'PAYMENT_CLAIM_BAD_REQUEST' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_CLAIM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'PAYMENT_CLAIM_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  v_method := lower(coalesce(v_booking.payment_method, ''));
  IF (v_method = 'card' AND v_provider NOT IN ('nicepay', 'portone'))
     OR (v_method = 'paypal' AND v_provider <> 'paypal')
     OR v_method NOT IN ('card', 'paypal') THEN
    RAISE EXCEPTION 'PAYMENT_CLAIM_METHOD_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF lower(coalesce(v_booking.status, '')) <> 'pending'
     OR v_booking.tid IS NOT NULL THEN
    RAISE EXCEPTION 'PAYMENT_CLAIM_STATUS_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  v_expiry_interval := interval '30 minutes';
  IF v_booking.created_at < now() - v_expiry_interval THEN
    RAISE EXCEPTION 'PAYMENT_CLAIM_BOOKING_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  IF v_method = 'card' THEN
    IF v_reference IS NULL OR v_reference <> coalesce(v_booking.order_id, v_booking.id) THEN
      RAISE EXCEPTION 'PAYMENT_CLAIM_REFERENCE_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_reference IS NOT NULL THEN
    RAISE EXCEPTION 'PAYMENT_CLAIM_REFERENCE_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.payment_claim_state IS NOT NULL THEN
    IF v_booking.payment_provider IS DISTINCT FROM v_provider THEN
      RAISE EXCEPTION 'PAYMENT_CLAIM_PROVIDER_CONFLICT' USING ERRCODE = 'P0001';
    END IF;

    IF v_booking.payment_claim_state IN ('completed', 'released', 'reconciliation_required') THEN
      RAISE EXCEPTION 'PAYMENT_CLAIM_TERMINAL_CONFLICT' USING ERRCODE = 'P0001';
    END IF;

    IF v_method = 'card' THEN
      IF v_booking.payment_claim_state <> 'processing'
         OR v_booking.payment_provider_reference IS DISTINCT FROM v_reference THEN
        RAISE EXCEPTION 'PAYMENT_CLAIM_ATTEMPT_CONFLICT' USING ERRCODE = 'P0001';
      END IF;

      IF v_booking.payment_claim_expires_at IS NULL
         OR v_booking.payment_claim_expires_at <= now() THEN
        UPDATE public.bookings
           SET payment_claim_state = 'reconciliation_required',
               payment_claim_expires_at = NULL,
               payment_claim_token = NULL
         WHERE id = v_booking.id;
        RETURN QUERY SELECT
          'reconciliation_required'::text,
          v_provider,
          v_reference,
          NULL::timestamp with time zone,
          NULL::uuid;
        RETURN;
      END IF;

      RETURN QUERY SELECT
        'already_claimed'::text,
        v_provider,
        v_reference,
        v_booking.payment_claim_expires_at,
        NULL::uuid;
      RETURN;
    END IF;

    IF v_booking.payment_claim_state <> 'claimed' THEN
      RAISE EXCEPTION 'PAYMENT_CLAIM_ATTEMPT_CONFLICT' USING ERRCODE = 'P0001';
    END IF;

    IF v_booking.payment_provider_reference IS NOT NULL THEN
      RETURN QUERY SELECT
        'already_claimed'::text,
        v_provider,
        v_booking.payment_provider_reference,
        v_booking.payment_claim_expires_at,
        NULL::uuid;
      RETURN;
    END IF;

    IF v_booking.payment_claim_expires_at IS NOT NULL
       AND v_booking.payment_claim_expires_at > now() THEN
      RETURN QUERY SELECT
        'claim_in_progress'::text,
        v_provider,
        NULL::text,
        v_booking.payment_claim_expires_at,
        NULL::uuid;
      RETURN;
    END IF;
  END IF;

  v_claim_token := CASE WHEN v_method = 'paypal' THEN extensions.gen_random_uuid() ELSE NULL END;

  UPDATE public.bookings
     SET payment_claim_state = CASE WHEN v_method = 'card' THEN 'processing' ELSE 'claimed' END,
         payment_claim_expires_at = now() + interval '10 minutes',
         payment_provider = v_provider,
         payment_provider_reference = v_reference,
         payment_claim_token = v_claim_token
   WHERE id = v_booking.id;

  RETURN QUERY
  SELECT
    'claimed'::text,
    v_provider,
    v_reference,
    now() + interval '10 minutes',
    v_claim_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.attach_experience_payment_provider_reference_atomic(
  p_booking_id text,
  p_user_id uuid,
  p_provider_reference text,
  p_claim_token uuid
)
RETURNS TABLE (outcome text, provider_reference text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_reference text := nullif(btrim(coalesce(p_provider_reference, '')), '');
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'PAYMENT_REFERENCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_reference IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_REFERENCE_BAD_REQUEST' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_REFERENCE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'PAYMENT_REFERENCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF lower(coalesce(v_booking.status, '')) <> 'pending'
     OR v_booking.tid IS NOT NULL
     OR lower(coalesce(v_booking.payment_method, '')) <> 'paypal'
     OR v_booking.payment_provider <> 'paypal'
     OR v_booking.payment_claim_state <> 'claimed' THEN
    RAISE EXCEPTION 'PAYMENT_REFERENCE_STATE_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.payment_provider_reference IS NOT NULL THEN
    IF v_booking.payment_provider_reference = v_reference THEN
      RETURN QUERY SELECT 'already_attached'::text, v_reference;
      RETURN;
    END IF;
    RAISE EXCEPTION 'PAYMENT_REFERENCE_REPLACEMENT_FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.payment_claim_expires_at IS NULL
     OR v_booking.payment_claim_expires_at <= now()
     OR v_booking.payment_claim_token IS DISTINCT FROM p_claim_token THEN
    RAISE EXCEPTION 'PAYMENT_REFERENCE_CLAIM_LOST' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bookings
     SET payment_provider_reference = v_reference,
         payment_claim_token = NULL
   WHERE id = v_booking.id;

  RETURN QUERY SELECT 'attached'::text, v_reference;
END;
$function$;

CREATE OR REPLACE FUNCTION public.begin_experience_payment_capture_atomic(
  p_booking_id text,
  p_user_id uuid,
  p_provider_reference text
)
RETURNS TABLE (outcome text, provider_reference text, claim_expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_reference text := nullif(btrim(coalesce(p_provider_reference, '')), '');
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'PAYMENT_CAPTURE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_reference IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_CAPTURE_BAD_REQUEST' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_CAPTURE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'PAYMENT_CAPTURE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF lower(coalesce(v_booking.status, '')) IN ('paid', 'confirmed', 'completed') THEN
    IF v_booking.payment_provider = 'paypal'
       AND v_booking.payment_provider_reference = v_reference
       AND v_booking.payment_claim_state = 'completed' THEN
      RETURN QUERY SELECT 'already_completed'::text, v_reference, NULL::timestamp with time zone;
      RETURN;
    END IF;
    RAISE EXCEPTION 'PAYMENT_CAPTURE_STATUS_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF lower(coalesce(v_booking.status, '')) <> 'pending'
     OR v_booking.tid IS NOT NULL
     OR lower(coalesce(v_booking.payment_method, '')) <> 'paypal'
     OR v_booking.payment_provider <> 'paypal'
     OR v_booking.payment_provider_reference IS DISTINCT FROM v_reference THEN
    RAISE EXCEPTION 'PAYMENT_CAPTURE_STATE_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.payment_claim_state = 'processing' THEN
    RETURN QUERY SELECT
      'already_processing'::text,
      v_reference,
      v_booking.payment_claim_expires_at;
    RETURN;
  END IF;

  IF v_booking.payment_claim_state <> 'claimed'
     OR v_booking.payment_claim_expires_at IS NULL
     OR v_booking.payment_claim_expires_at <= now() THEN
    RAISE EXCEPTION 'PAYMENT_CAPTURE_CLAIM_INVALID' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bookings
     SET payment_claim_state = 'processing',
         payment_claim_expires_at = now() + interval '10 minutes',
         payment_claim_token = NULL
   WHERE id = v_booking.id;

  RETURN QUERY SELECT 'capture_started'::text, v_reference, now() + interval '10 minutes';
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_experience_payment_atomic(
  p_booking_id text,
  p_provider text,
  p_provider_reference text,
  p_provider_transaction_id text,
  p_verified_amount integer
)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_reference text := nullif(btrim(coalesce(p_provider_reference, '')), '');
  v_tid text := nullif(btrim(coalesce(p_provider_transaction_id, '')), '');
  v_max_guests integer;
  v_current_booked integer;
  v_has_private boolean;
  v_total_experience numeric;
  v_base_price numeric;
  v_host_payout integer;
  v_platform_revenue integer;
  v_refund_liability integer;
  v_solo_net integer;
  v_slot_key text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'PAYMENT_CONFIRM_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_provider = '' OR v_reference IS NULL OR v_tid IS NULL
     OR p_verified_amount IS NULL OR p_verified_amount <= 0 THEN
    RAISE EXCEPTION 'PAYMENT_CONFIRM_BAD_REQUEST' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_CONFIRM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF lower(coalesce(v_booking.status, '')) IN ('paid', 'confirmed', 'completed') THEN
    IF v_booking.payment_claim_state = 'completed'
       AND v_booking.payment_provider = v_provider
       AND v_booking.payment_provider_reference = v_reference
       AND v_booking.tid = v_tid THEN
      RETURN QUERY SELECT 'already_processed'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'PAYMENT_CONFIRM_ALREADY_PROCESSED_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF lower(coalesce(v_booking.status, '')) <> 'pending'
     OR v_booking.tid IS NOT NULL THEN
    RAISE EXCEPTION 'PAYMENT_CONFIRM_STATUS_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF (lower(coalesce(v_booking.payment_method, '')) = 'paypal' AND v_provider <> 'paypal')
     OR (lower(coalesce(v_booking.payment_method, '')) = 'card' AND v_provider NOT IN ('nicepay', 'portone'))
     OR lower(coalesce(v_booking.payment_method, '')) NOT IN ('card', 'paypal') THEN
    RAISE EXCEPTION 'PAYMENT_CONFIRM_METHOD_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.payment_provider IS DISTINCT FROM v_provider
     OR v_booking.payment_provider_reference IS DISTINCT FROM v_reference
     OR v_booking.payment_claim_state NOT IN ('processing', 'reconciliation_required') THEN
    RAISE EXCEPTION 'PAYMENT_CONFIRM_ATTEMPT_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.amount IS DISTINCT FROM p_verified_amount THEN
    RAISE EXCEPTION 'PAYMENT_CONFIRM_AMOUNT_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  v_slot_key := format('%s|%s|%s', v_booking.experience_id, v_booking.date, v_booking.time);
  PERFORM pg_advisory_xact_lock(hashtext(v_slot_key)::bigint);

  SELECT coalesce(e.max_guests, 10)
    INTO v_max_guests
    FROM public.experiences e
   WHERE e.id = v_booking.experience_id;

  IF v_max_guests IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_CONFIRM_EXPERIENCE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    coalesce(sum(b.guests), 0)::integer,
    coalesce(bool_or(b.type = 'private'), false)
  INTO v_current_booked, v_has_private
  FROM public.bookings b
  WHERE b.experience_id = v_booking.experience_id
    AND b.date = v_booking.date
    AND b.time = v_booking.time
    AND b.id <> v_booking.id
    AND lower(b.status) IN ('paid', 'confirmed');

  IF v_has_private
     OR (v_booking.type = 'private' AND v_current_booked > 0)
     OR (v_booking.type <> 'private' AND v_current_booked + coalesce(v_booking.guests, 0) > v_max_guests) THEN
    RAISE EXCEPTION 'PAYMENT_CONFIRM_CAPACITY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  v_solo_net := greatest(
    0,
    coalesce(v_booking.solo_guarantee_price, 0)
      - coalesce(v_booking.solo_guarantee_refund_amount, 0)
  );
  v_refund_liability := greatest(
    coalesce(v_booking.refund_amount, 0),
    coalesce(v_booking.solo_guarantee_refund_amount, 0)
  );
  v_total_experience := CASE
    WHEN coalesce(v_booking.total_experience_price, 0) > 0
      THEN v_booking.total_experience_price
    WHEN coalesce(v_booking.total_price, 0) > 0
      THEN v_booking.total_price
    ELSE v_booking.amount
  END;
  v_base_price := CASE
    WHEN coalesce(v_booking.price_at_booking, 0) > 0
      THEN v_booking.price_at_booking
    ELSE greatest(0, v_total_experience - v_solo_net)
  END;
  v_host_payout := CASE
    WHEN coalesce(v_booking.host_payout_amount, 0) > 0
      THEN v_booking.host_payout_amount
    ELSE floor(v_total_experience * 0.8)::integer
  END;
  v_platform_revenue := CASE
    WHEN coalesce(v_booking.platform_revenue, 0) > 0
      THEN v_booking.platform_revenue
    ELSE greatest(0, v_booking.amount - v_refund_liability - v_host_payout)
  END;

  UPDATE public.bookings
     SET status = 'PAID',
         tid = v_tid,
         price_at_booking = v_base_price,
         total_experience_price = v_total_experience,
         host_payout_amount = v_host_payout,
         platform_revenue = v_platform_revenue,
         payout_status = 'pending',
         payment_claim_state = 'completed',
         payment_claim_expires_at = NULL,
         payment_claim_token = NULL
   WHERE id = v_booking.id;

  RETURN QUERY SELECT 'confirmed_now'::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_experience_bank_payment_atomic(p_booking_id text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_total_experience numeric;
  v_base_price numeric;
  v_host_payout integer;
  v_platform_revenue integer;
  v_refund_liability integer;
  v_solo_net integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'BANK_CONFIRM_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BANK_CONFIRM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF lower(coalesce(v_booking.payment_method, '')) <> 'bank' THEN
    RAISE EXCEPTION 'BANK_CONFIRM_METHOD_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF lower(coalesce(v_booking.status, '')) = 'confirmed' THEN
    IF v_booking.payout_status = 'pending'
       AND v_booking.host_payout_amount IS NOT NULL
       AND v_booking.platform_revenue IS NOT NULL THEN
      RETURN QUERY SELECT 'already_processed'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'BANK_CONFIRM_STORED_RESULT_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF lower(coalesce(v_booking.status, '')) <> 'pending' THEN
    RAISE EXCEPTION 'BANK_CONFIRM_STATUS_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  v_solo_net := greatest(
    0,
    coalesce(v_booking.solo_guarantee_price, 0)
      - coalesce(v_booking.solo_guarantee_refund_amount, 0)
  );
  v_refund_liability := greatest(
    coalesce(v_booking.refund_amount, 0),
    coalesce(v_booking.solo_guarantee_refund_amount, 0)
  );
  v_total_experience := CASE
    WHEN coalesce(v_booking.total_experience_price, 0) > 0
      THEN v_booking.total_experience_price
    WHEN coalesce(v_booking.total_price, 0) > 0
      THEN v_booking.total_price
    ELSE v_booking.amount
  END;
  v_base_price := CASE
    WHEN coalesce(v_booking.price_at_booking, 0) > 0
      THEN v_booking.price_at_booking
    ELSE greatest(0, v_total_experience - v_solo_net)
  END;
  v_host_payout := CASE
    WHEN coalesce(v_booking.host_payout_amount, 0) > 0
      THEN v_booking.host_payout_amount
    ELSE floor(v_total_experience * 0.8)::integer
  END;
  v_platform_revenue := CASE
    WHEN coalesce(v_booking.platform_revenue, 0) > 0
      THEN v_booking.platform_revenue
    ELSE greatest(0, v_booking.amount - v_refund_liability - v_host_payout)
  END;

  UPDATE public.bookings
     SET status = 'confirmed',
         price_at_booking = v_base_price,
         total_experience_price = v_total_experience,
         host_payout_amount = v_host_payout,
         platform_revenue = v_platform_revenue,
         payout_status = 'pending'
   WHERE id = v_booking.id;

  RETURN QUERY SELECT 'confirmed_now'::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_expired_pending_bookings_atomic(
  p_batch_size integer DEFAULT 100
)
RETURNS TABLE (
  cancelled_count integer,
  active_skipped_count integer,
  reconciliation_required_count integer,
  already_terminal_count integer,
  has_more boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_batch_size integer := least(greatest(coalesce(p_batch_size, 100), 1), 100);
  v_booking public.bookings%ROWTYPE;
  v_cancelled integer := 0;
  v_active_skipped integer := 0;
  v_reconciliation integer := 0;
  v_terminal integer := 0;
  v_reason text;
  v_has_more boolean := false;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'PENDING_CLEANUP_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  FOR v_booking IN
    SELECT b.*
      FROM public.bookings b
     WHERE lower(b.status) = 'pending'
       AND b.tid IS NULL
       AND b.created_at < now() - CASE lower(coalesce(b.payment_method, ''))
         WHEN 'card' THEN interval '30 minutes'
         WHEN 'paypal' THEN interval '30 minutes'
         WHEN 'bank' THEN interval '12 hours'
         ELSE interval '2 hours'
       END
     ORDER BY
       CASE
         WHEN b.payment_claim_state IS NULL THEN 0
         WHEN b.payment_claim_state = 'claimed'
              AND (b.payment_claim_expires_at IS NULL OR b.payment_claim_expires_at <= now()) THEN 0
         WHEN b.payment_claim_state = 'processing'
              AND (b.payment_claim_expires_at IS NULL OR b.payment_claim_expires_at <= now()) THEN 0
         ELSE 1
       END,
       b.created_at,
       b.id
     FOR UPDATE SKIP LOCKED
     LIMIT v_batch_size
  LOOP
    IF v_booking.payment_claim_state IN ('completed', 'released') THEN
      v_terminal := v_terminal + 1;
      CONTINUE;
    END IF;

    IF v_booking.payment_claim_state = 'reconciliation_required' THEN
      v_active_skipped := v_active_skipped + 1;
      CONTINUE;
    END IF;

    IF v_booking.payment_claim_state IN ('claimed', 'processing')
       AND v_booking.payment_claim_expires_at IS NOT NULL
       AND v_booking.payment_claim_expires_at > now() THEN
      v_active_skipped := v_active_skipped + 1;
      CONTINUE;
    END IF;

    IF v_booking.payment_claim_state = 'processing'
       OR (
         v_booking.payment_claim_state = 'claimed'
         AND (
           v_booking.payment_claim_expires_at IS NULL
           OR
           v_booking.payment_provider <> 'paypal'
           OR v_booking.payment_provider_reference IS NOT NULL
         )
       ) THEN
      UPDATE public.bookings
         SET payment_claim_state = 'reconciliation_required',
             payment_claim_expires_at = NULL,
             payment_claim_token = NULL
       WHERE id = v_booking.id;
      v_reconciliation := v_reconciliation + 1;
      CONTINUE;
    END IF;

    v_reason := CASE lower(coalesce(v_booking.payment_method, ''))
      WHEN 'card' THEN '카드 결제 미완료 (30분 경과 자동 취소)'
      WHEN 'paypal' THEN 'PayPal 결제 미완료 (30분 경과 자동 취소)'
      WHEN 'bank' THEN '입금 기한 만료 (12시간 경과 자동 취소)'
      ELSE '결제 미완료 (2시간 경과 자동 취소)'
    END;

    UPDATE public.bookings
       SET status = 'cancelled',
           cancel_reason = v_reason,
           refund_amount = 0,
           payment_claim_state = CASE
             WHEN payment_claim_state = 'claimed' THEN 'released'
             ELSE payment_claim_state
           END,
           payment_claim_expires_at = NULL,
           payment_claim_token = NULL
     WHERE id = v_booking.id;
    v_cancelled := v_cancelled + 1;
  END LOOP;

  SELECT EXISTS (
    SELECT 1
      FROM public.bookings b
     WHERE lower(b.status) = 'pending'
       AND b.tid IS NULL
       AND b.created_at < now() - CASE lower(coalesce(b.payment_method, ''))
         WHEN 'card' THEN interval '30 minutes'
         WHEN 'paypal' THEN interval '30 minutes'
         WHEN 'bank' THEN interval '12 hours'
         ELSE interval '2 hours'
       END
       AND (
         b.payment_claim_state IS NULL
         OR (
           b.payment_claim_state = 'claimed'
           AND (b.payment_claim_expires_at IS NULL OR b.payment_claim_expires_at <= now())
         )
         OR (
           b.payment_claim_state = 'processing'
           AND (b.payment_claim_expires_at IS NULL OR b.payment_claim_expires_at <= now())
         )
       )
  ) INTO v_has_more;

  RETURN QUERY SELECT
    v_cancelled,
    v_active_skipped,
    v_reconciliation,
    v_terminal,
    v_has_more;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_user_id uuid,
  p_experience_id text,
  p_date text,
  p_time text,
  p_guests integer,
  p_is_private boolean,
  p_customer_name text,
  p_customer_phone text,
  p_payment_method text DEFAULT 'card'::text,
  p_is_solo_guarantee boolean DEFAULT false
)
RETURNS TABLE(new_order_id text, final_amount numeric, host_id text, experience_title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'BOOKING_FORBIDDEN:Server-only function' USING ERRCODE = 'P0001';
  END IF;

  IF p_user_id IS NULL
     OR coalesce(btrim(p_experience_id), '') = ''
     OR coalesce(btrim(p_date), '') = ''
     OR coalesce(btrim(p_time), '') = ''
     OR coalesce(btrim(p_customer_name), '') = ''
     OR coalesce(btrim(p_customer_phone), '') = '' THEN
    RAISE EXCEPTION 'BOOKING_BAD_REQUEST:Missing required fields' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    v_booking_date := p_date::date;
    v_booking_time_text := to_char(p_time::time, 'HH24:MI');
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'BOOKING_BAD_REQUEST:Invalid date/time format' USING ERRCODE = 'P0001';
  END;

  SELECT e.id, e.host_id::text, e.title, coalesce(e.price, 0),
         coalesce(e.private_price, 0), coalesce(e.max_guests, 10),
         coalesce(e.solo_guarantee_price, 30000)
    INTO v_experience_id, v_host_id, v_title, v_price, v_private_price,
         v_max_guests, v_solo_guarantee_unit_price
    FROM public.experiences e
   WHERE e.id::text = p_experience_id
   LIMIT 1;

  IF v_experience_id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND:Experience not found' USING ERRCODE = 'P0001';
  END IF;

  v_guest_count := greatest(coalesce(p_guests, 0), 1);
  v_slot_key := format('%s|%s|%s', v_experience_id, v_booking_date, v_booking_time_text);
  PERFORM pg_advisory_xact_lock(hashtext(v_slot_key)::bigint);

  UPDATE public.bookings b
     SET status = 'cancelled',
         cancel_reason = '카드 결제 미완료 (30분 경과 자동 취소)',
         refund_amount = 0
   WHERE b.experience_id = v_experience_id
     AND b.date = v_booking_date
     AND b.time = v_booking_time_text
     AND lower(b.status) = 'pending'
     AND lower(coalesce(b.payment_method, '')) = 'card'
     AND b.tid IS NULL
     AND b.created_at < now() - interval '30 minutes'
     AND b.payment_claim_state IS NULL;

  SELECT coalesce(sum(b.guests), 0)::integer,
         coalesce(bool_or(b.type = 'private'), false)
    INTO v_current_booked, v_has_private_booking
    FROM public.bookings b
   WHERE b.experience_id = v_experience_id
     AND b.date = v_booking_date
     AND b.time = v_booking_time_text
     AND lower(b.status) IN ('pending', 'paid', 'confirmed');

  IF v_has_private_booking
     OR (p_is_private AND v_current_booked > 0)
     OR ((NOT p_is_private) AND (v_current_booked + v_guest_count > v_max_guests)) THEN
    RAISE EXCEPTION 'BOOKING_CONFLICT:해당 시간대에 남은 좌석이 부족합니다.' USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(p_is_solo_guarantee, false) AND (p_is_private OR v_guest_count <> 1) THEN
    RAISE EXCEPTION 'BOOKING_BAD_REQUEST:Solo guarantee is only available for shared solo bookings' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(sum(b.guests), 0)::integer,
         coalesce(bool_or(b.type = 'private'), false)
    INTO v_confirmed_booked, v_has_confirmed_private_booking
    FROM public.bookings b
   WHERE b.experience_id = v_experience_id
     AND b.date = v_booking_date
     AND b.time = v_booking_time_text
     AND lower(b.status) IN ('paid', 'confirmed');

  IF coalesce(p_is_solo_guarantee, false)
     AND (v_confirmed_booked > 0 OR v_has_confirmed_private_booking) THEN
    RAISE EXCEPTION 'BOOKING_BAD_REQUEST:Solo guarantee is unavailable when confirmed bookings already exist' USING ERRCODE = 'P0001';
  END IF;

  v_solo_guarantee_price := CASE
    WHEN coalesce(p_is_solo_guarantee, false) AND NOT p_is_private AND v_guest_count = 1
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
      lpad((floor(random() * 1000))::integer::text, 3, '0')
    );
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.bookings b
       WHERE b.order_id = v_new_order_id OR b.id = v_new_order_id
    );
  END LOOP;

  INSERT INTO public.bookings (
    id, order_id, user_id, experience_id, amount, total_price, status,
    guests, date, time, type, contact_name, contact_phone, message,
    created_at, payment_method, is_solo_guarantee, solo_guarantee_price
  ) VALUES (
    v_new_order_id, v_new_order_id, p_user_id, v_experience_id,
    v_final_amount, v_host_price, 'PENDING', v_guest_count, v_booking_date,
    v_booking_time_text, CASE WHEN p_is_private THEN 'private' ELSE 'group' END,
    p_customer_name, p_customer_phone, '', now(), coalesce(p_payment_method, 'card'),
    v_solo_guarantee_price > 0, v_solo_guarantee_price::integer
  );

  RETURN QUERY SELECT v_new_order_id, v_final_amount, v_host_id, coalesce(v_title, 'Locally 체험');
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_experience_payment_atomic(text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_experience_payment_provider_reference_atomic(text, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_experience_payment_capture_atomic(text, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_experience_payment_atomic(text, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_experience_bank_payment_atomic(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_expired_pending_bookings_atomic(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_booking_atomic(uuid, text, text, text, integer, boolean, text, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_experience_payment_claim_columns()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_experience_payment_atomic(text, uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_experience_payment_provider_reference_atomic(text, uuid, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_experience_payment_capture_atomic(text, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_experience_payment_atomic(text, text, text, text, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_experience_bank_payment_atomic(text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_expired_pending_bookings_atomic(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.create_booking_atomic(uuid, text, text, text, integer, boolean, text, text, text, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_experience_payment_claim_columns()
  TO service_role;
