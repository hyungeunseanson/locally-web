-- PHASE 2: service-role-only proof and approval gate for experience NICEPAY cards.
-- Apply before the Worker using these RPCs. No existing booking or settlement rows are changed.
CREATE TABLE public.experience_nicepay_recovery (
  booking_id text PRIMARY KEY REFERENCES public.bookings(id) ON DELETE RESTRICT,
  order_id text NOT NULL UNIQUE,
  mid text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  tid text UNIQUE,
  state text NOT NULL DEFAULT 'claimed' CHECK (state IN (
    'claimed', 'auth_received', 'approval_started', 'approved',
    'confirmed', 'released', 'manual_review'
  )),
  auth_received_at timestamptz,
  approval_started_at timestamptz,
  approved_at timestamptz,
  interrupted_at timestamptz,
  last_checked_at timestamptz,
  next_retry_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_error_code text,
  manual_review_at timestamptz,
  alerted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nicepay_recovery_tid_after_auth CHECK (
    (state = 'claimed' AND tid IS NULL)
    OR (state IN ('released', 'manual_review'))
    OR tid IS NOT NULL
  )
);
CREATE TABLE public.experience_nicepay_recovery_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id text NOT NULL,
  tid text,
  state text NOT NULL,
  retry_count integer NOT NULL,
  error_code text,
  observed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.experience_nicepay_recovery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.experience_nicepay_recovery_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.experience_nicepay_recovery_events TO service_role;
CREATE INDEX experience_nicepay_recovery_events_booking_idx
  ON public.experience_nicepay_recovery_events (booking_id, observed_at DESC);

CREATE FUNCTION public.log_experience_nicepay_recovery_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.state IS DISTINCT FROM OLD.state
     OR NEW.retry_count IS DISTINCT FROM OLD.retry_count
     OR NEW.last_error_code IS DISTINCT FROM OLD.last_error_code THEN
    INSERT INTO public.experience_nicepay_recovery_events
      (booking_id, tid, state, retry_count, error_code)
      VALUES (NEW.booking_id, NEW.tid, NEW.state, NEW.retry_count, NEW.last_error_code);
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.log_experience_nicepay_recovery_event() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER experience_nicepay_recovery_event_log
AFTER INSERT OR UPDATE ON public.experience_nicepay_recovery
FOR EACH ROW EXECUTE FUNCTION public.log_experience_nicepay_recovery_event();

CREATE INDEX experience_nicepay_recovery_due_idx
  ON public.experience_nicepay_recovery (next_retry_at, created_at)
  WHERE state NOT IN ('confirmed', 'released');
ALTER TABLE public.experience_nicepay_recovery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.experience_nicepay_recovery FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.experience_nicepay_recovery TO service_role;

CREATE FUNCTION public.prepare_experience_nicepay_attempt_atomic(
  p_booking_id text, p_order_id text, p_mid text, p_amount integer
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_booking public.bookings%ROWTYPE; v_existing public.experience_nicepay_recovery%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_booking_id, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_order_id, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_mid, '')), '') IS NULL
     OR coalesce(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_BAD_REQUEST' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.order_id IS DISTINCT FROM p_order_id
     OR v_booking.amount IS DISTINCT FROM p_amount
     OR lower(coalesce(v_booking.status, '')) <> 'pending'
     OR lower(coalesce(v_booking.payment_method, '')) <> 'card'
     OR v_booking.payment_provider IS DISTINCT FROM 'nicepay'
     OR v_booking.payment_provider_reference IS DISTINCT FROM p_order_id
     OR v_booking.payment_claim_state IS DISTINCT FROM 'processing'
     OR v_booking.tid IS NOT NULL THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_BOOKING_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_existing FROM public.experience_nicepay_recovery WHERE booking_id = p_booking_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.order_id IS DISTINCT FROM p_order_id OR v_existing.mid IS DISTINCT FROM p_mid
       OR v_existing.amount IS DISTINCT FROM p_amount
       OR v_existing.state IN ('released', 'manual_review') THEN
      RAISE EXCEPTION 'NICEPAY_RECOVERY_ATTEMPT_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    RETURN v_existing.state;
  END IF;
  INSERT INTO public.experience_nicepay_recovery (booking_id, order_id, mid, amount)
    VALUES (p_booking_id, p_order_id, p_mid, p_amount);
  RETURN 'claimed';
END;
$function$;

CREATE FUNCTION public.observe_experience_nicepay_auth_atomic(
  p_booking_id text, p_order_id text, p_tid text, p_mid text, p_amount integer
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_booking public.bookings%ROWTYPE; v_attempt public.experience_nicepay_recovery%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_tid, '')), '') IS NULL THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_TID_MISSING' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  SELECT * INTO v_attempt FROM public.experience_nicepay_recovery WHERE booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.order_id IS DISTINCT FROM p_order_id
     OR v_attempt.mid IS DISTINCT FROM p_mid OR v_attempt.amount IS DISTINCT FROM p_amount
     OR (v_attempt.tid IS NOT NULL AND v_attempt.tid IS DISTINCT FROM p_tid)
     OR v_attempt.state IN ('released', 'manual_review')
     OR lower(coalesce(v_booking.status, '')) <> 'pending'
     OR v_booking.payment_claim_state NOT IN ('processing', 'reconciliation_required')
     OR v_booking.order_id IS DISTINCT FROM p_order_id
     OR v_booking.amount IS DISTINCT FROM p_amount THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_AUTH_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.experience_nicepay_recovery
     SET tid = p_tid,
         state = CASE WHEN state = 'claimed' THEN 'auth_received' ELSE state END,
         auth_received_at = coalesce(auth_received_at, now()), updated_at = now()
   WHERE booking_id = p_booking_id;
  RETURN CASE WHEN v_attempt.state = 'claimed' THEN 'auth_received' ELSE v_attempt.state END;
END;
$function$;

CREATE FUNCTION public.begin_experience_nicepay_approval_atomic(
  p_booking_id text, p_tid text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_booking public.bookings%ROWTYPE; v_attempt public.experience_nicepay_recovery%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  SELECT * INTO v_attempt FROM public.experience_nicepay_recovery WHERE booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.tid IS DISTINCT FROM p_tid
     OR v_attempt.order_id IS DISTINCT FROM v_booking.order_id
     OR v_attempt.amount IS DISTINCT FROM v_booking.amount
     OR v_attempt.state IN ('released', 'manual_review') THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_APPROVAL_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  IF v_attempt.state IN ('approved', 'confirmed', 'approval_started') THEN RETURN v_attempt.state; END IF;
  IF v_attempt.state <> 'auth_received'
     OR lower(coalesce(v_booking.status, '')) <> 'pending'
     OR v_booking.tid IS NOT NULL
     OR v_booking.payment_claim_state NOT IN ('processing', 'reconciliation_required') THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_APPROVAL_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.experience_nicepay_recovery
     SET state = 'approval_started', approval_started_at = now(),
         next_retry_at = now() + interval '2 minutes', updated_at = now()
   WHERE booking_id = p_booking_id;
  RETURN 'started';
END;
$function$;

CREATE FUNCTION public.record_experience_nicepay_approval_atomic(
  p_booking_id text, p_order_id text, p_tid text, p_mid text, p_amount integer
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_booking public.bookings%ROWTYPE; v_attempt public.experience_nicepay_recovery%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_tid, '')), '') IS NULL OR nullif(btrim(coalesce(p_mid, '')), '') IS NULL
     OR coalesce(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_PROOF_MISSING' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.order_id IS DISTINCT FROM p_order_id
     OR v_booking.amount IS DISTINCT FROM p_amount
     OR lower(coalesce(v_booking.payment_method, '')) <> 'card'
     OR v_booking.payment_provider IS DISTINCT FROM 'nicepay'
     OR v_booking.payment_provider_reference IS DISTINCT FROM p_order_id
     OR (v_booking.tid IS NOT NULL AND v_booking.tid IS DISTINCT FROM p_tid) THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_PROOF_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_attempt FROM public.experience_nicepay_recovery WHERE booking_id = p_booking_id FOR UPDATE;
  IF FOUND THEN
    IF v_attempt.order_id IS DISTINCT FROM p_order_id OR v_attempt.mid IS DISTINCT FROM p_mid
       OR v_attempt.amount IS DISTINCT FROM p_amount
       OR (v_attempt.tid IS NOT NULL AND v_attempt.tid IS DISTINCT FROM p_tid) THEN
      RAISE EXCEPTION 'NICEPAY_RECOVERY_PROOF_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.state IN ('released', 'manual_review') THEN
      UPDATE public.experience_nicepay_recovery
         SET tid = p_tid, state = 'manual_review', approved_at = coalesce(approved_at, now()),
             manual_review_at = coalesce(manual_review_at, now()),
             last_error_code = 'late_approval_after_release', updated_at = now()
       WHERE booking_id = p_booking_id;
      RETURN 'late_approval';
    END IF;
    UPDATE public.experience_nicepay_recovery
       SET tid = p_tid,
           state = CASE WHEN state = 'confirmed' THEN 'confirmed' ELSE 'approved' END,
           approved_at = coalesce(approved_at, now()), next_retry_at = now() + interval '2 minutes',
           updated_at = now()
     WHERE booking_id = p_booking_id;
  ELSE
    -- A notification may arrive for a pre-deployment in-flight claim.
    INSERT INTO public.experience_nicepay_recovery
      (booking_id, order_id, mid, amount, tid, state, approved_at, next_retry_at)
      VALUES (p_booking_id, p_order_id, p_mid, p_amount, p_tid, 'approved', now(), now() + interval '2 minutes');
  END IF;
  RETURN 'recorded';
END;
$function$;

CREATE FUNCTION public.confirm_experience_nicepay_recovery_atomic(
  p_booking_id text, p_tid text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_booking public.bookings%ROWTYPE; v_attempt public.experience_nicepay_recovery%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  SELECT * INTO v_attempt FROM public.experience_nicepay_recovery WHERE booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.tid IS DISTINCT FROM p_tid
     OR v_attempt.order_id IS DISTINCT FROM v_booking.order_id
     OR v_attempt.amount IS DISTINCT FROM v_booking.amount
     OR lower(coalesce(v_booking.status, '')) NOT IN ('paid', 'confirmed', 'completed')
     OR v_booking.tid IS DISTINCT FROM p_tid
     OR v_booking.payment_claim_state IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_CONFIRM_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.experience_nicepay_recovery
     SET state = 'confirmed', approved_at = coalesce(approved_at, now()),
         next_retry_at = NULL, last_error_code = NULL, updated_at = now()
   WHERE booking_id = p_booking_id;
  RETURN 'confirmed';
END;
$function$;

CREATE FUNCTION public.release_experience_nicepay_hold_atomic(
  p_booking_id text, p_user_id uuid, p_provider_status text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_booking public.bookings%ROWTYPE; v_attempt public.experience_nicepay_recovery%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  SELECT * INTO v_attempt FROM public.experience_nicepay_recovery WHERE booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NICEPAY_RECOVERY_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF p_user_id IS NOT NULL AND v_booking.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_OWNER_CONFLICT' USING ERRCODE = '42501';
  END IF;
  IF v_attempt.state = 'released' AND lower(coalesce(v_booking.status, '')) = 'cancelled' THEN
    RETURN 'already_released';
  END IF;
  IF v_attempt.order_id IS DISTINCT FROM v_booking.order_id
     OR v_attempt.amount IS DISTINCT FROM v_booking.amount
     OR lower(coalesce(v_booking.status, '')) <> 'pending'
     OR lower(coalesce(v_booking.payment_method, '')) <> 'card'
     OR v_booking.payment_provider IS DISTINCT FROM 'nicepay'
     OR v_booking.payment_provider_reference IS DISTINCT FROM v_attempt.order_id
     OR v_booking.payment_claim_state NOT IN ('processing', 'reconciliation_required')
     OR v_booking.tid IS NOT NULL THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_RELEASE_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  IF v_attempt.state = 'claimed' AND v_attempt.tid IS NULL AND p_provider_status = 'no_auth' THEN
    NULL;
  ELSIF v_attempt.state = 'auth_received' AND v_attempt.tid IS NOT NULL
        AND p_provider_status IN ('missing', 'cancelled') THEN
    NULL;
  ELSIF v_attempt.state = 'approval_started' AND v_attempt.tid IS NOT NULL
        AND p_provider_status = 'cancelled' THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'NICEPAY_RECOVERY_RELEASE_UNSAFE' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.bookings SET status = 'cancelled',
    cancel_reason = 'NICEPAY 승인 전 확인된 결제 중단 (PHASE2)',
    refund_amount = 0, payment_claim_state = 'released',
    payment_claim_expires_at = NULL, payment_claim_token = NULL
   WHERE id = p_booking_id;
  UPDATE public.experience_nicepay_recovery SET state = 'released',
    next_retry_at = NULL, last_checked_at = now(), updated_at = now()
   WHERE booking_id = p_booking_id;
  RETURN 'released';
END;
$function$;

CREATE FUNCTION public.note_experience_nicepay_recovery_atomic(
  p_booking_id text, p_error_code text, p_manual boolean DEFAULT false
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_attempt public.experience_nicepay_recovery%ROWTYPE; v_count integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_attempt FROM public.experience_nicepay_recovery
   WHERE booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NICEPAY_RECOVERY_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_attempt.state IN ('confirmed', 'released') THEN RETURN v_attempt.state; END IF;
  v_count := v_attempt.retry_count + 1;
  UPDATE public.experience_nicepay_recovery
     SET state = CASE WHEN p_manual OR v_count >= 5 THEN 'manual_review' ELSE state END,
         retry_count = v_count,
         last_error_code = left(coalesce(p_error_code, 'unknown'), 80),
         manual_review_at = CASE WHEN p_manual OR v_count >= 5 THEN coalesce(manual_review_at, now()) ELSE manual_review_at END,
         last_checked_at = now(),
         next_retry_at = CASE WHEN p_manual OR v_count >= 5 THEN NULL
           ELSE now() + make_interval(mins => least(2 * (2 ^ (v_count - 1))::integer, 16)) END,
         updated_at = now()
   WHERE booking_id = p_booking_id;
  RETURN CASE WHEN p_manual OR v_count >= 5 THEN 'manual_review' ELSE 'retry' END;
END;
$function$;

CREATE FUNCTION public.interrupt_experience_nicepay_attempt_atomic(p_booking_id text, p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_booking public.bookings%ROWTYPE; v_attempt public.experience_nicepay_recovery%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  SELECT * INTO v_attempt FROM public.experience_nicepay_recovery WHERE booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'NICEPAY_RECOVERY_OWNER_CONFLICT' USING ERRCODE = '42501';
  END IF;
  IF v_attempt.state IN ('confirmed', 'released') THEN RETURN v_attempt.state; END IF;
  UPDATE public.experience_nicepay_recovery SET interrupted_at = coalesce(interrupted_at, now()),
    next_retry_at = now(), updated_at = now() WHERE booking_id = p_booking_id;
  RETURN v_attempt.state;
END;
$function$;

REVOKE ALL ON FUNCTION public.prepare_experience_nicepay_attempt_atomic(text,text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.observe_experience_nicepay_auth_atomic(text,text,text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_experience_nicepay_approval_atomic(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_experience_nicepay_approval_atomic(text,text,text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_experience_nicepay_recovery_atomic(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_experience_nicepay_hold_atomic(text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.note_experience_nicepay_recovery_atomic(text,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.interrupt_experience_nicepay_attempt_atomic(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_experience_nicepay_attempt_atomic(text,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.observe_experience_nicepay_auth_atomic(text,text,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_experience_nicepay_approval_atomic(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_experience_nicepay_approval_atomic(text,text,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_experience_nicepay_recovery_atomic(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_experience_nicepay_hold_atomic(text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.note_experience_nicepay_recovery_atomic(text,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.interrupt_experience_nicepay_attempt_atomic(text,uuid) TO service_role;
