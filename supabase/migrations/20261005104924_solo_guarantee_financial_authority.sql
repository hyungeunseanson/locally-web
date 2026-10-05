-- Selective financial migration. Avatar migration 20261005082309 is already
-- applied in Production; never replay it. See docs/solo-guarantee-p0-rollout.md.
BEGIN;

-- Inventory: every production booking writer uses a service-role server path.
-- Retain SELECT/RLS and profile writes; close INSERT/UPDATE/DELETE bypasses.
REVOKE INSERT, UPDATE, DELETE ON public.bookings FROM PUBLIC, anon, authenticated;
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON public.bookings FROM PUBLIC, anon, authenticated', c.column_name, c.column_name);
  END LOOP;
END $$;

ALTER TABLE public.bookings
  ADD COLUMN cancellation_claim_id uuid,
  ADD COLUMN cancellation_claimed_at timestamptz,
  ADD COLUMN cancellation_original_status text;
ALTER TABLE public.bookings DROP CONSTRAINT bookings_solo_guarantee_refund_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_solo_guarantee_refund_status_check
  CHECK (solo_guarantee_refund_status IN ('not_applicable','processing','pending_manual','refunded','failed','accepted','unknown','rejected','reconciliation_required'));

CREATE TABLE public.booking_solo_refund_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Keep monetary evidence if an authorized admin deletes a resolved booking.
  booking_id text NOT NULL UNIQUE,
  attempt_identity uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_number integer NOT NULL DEFAULT 1 CHECK(attempt_number BETWEEN 1 AND 3),
  provider text NOT NULL,
  payment_method text NOT NULL,
  transaction_reference text,
  merchant_reference text CHECK(length(merchant_reference)<=64),
  order_reference text NOT NULL,
  requested_amount integer NOT NULL CHECK(requested_amount > 0),
  original_basis integer NOT NULL CHECK(original_basis >= 0),
  gross_amount integer NOT NULL CHECK(gross_amount >= requested_amount),
  prior_refund_amount integer NOT NULL CHECK(prior_refund_amount >= 0),
  basis_reserved boolean NOT NULL DEFAULT false,
  trigger_booking_id text,
  outcome text NOT NULL CHECK(outcome IN ('claimed','accepted','unknown','rejected','manual_pending')),
  request_started_at timestamptz,
  lease_expires_at timestamptz,
  result_code text CHECK(length(result_code) <= 16),
  provider_refund_reference text CHECK(length(provider_refund_reference) <= 128),
  proof_reference text CHECK(length(proof_reference) <= 128),
  proof_transaction_reference text CHECK(length(proof_transaction_reference) <= 128),
  verified_by uuid,
  diagnostic_code text CHECK(diagnostic_code ~ '^[a-z0-9_]{1,80}$'),
  settlement_applied_at timestamptz,
  delivery_state text NOT NULL DEFAULT 'pending' CHECK(delivery_state IN ('pending','delivered','failed')),
  delivery_attempts integer NOT NULL DEFAULT 0,
  next_delivery_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.booking_solo_refund_attempts (
  attempt_identity uuid PRIMARY KEY, operation_id uuid NOT NULL REFERENCES public.booking_solo_refund_operations(id),
  attempt_number integer NOT NULL, order_reference text NOT NULL, outcome text NOT NULL,
  merchant_reference text, request_started_at timestamptz, result_code text, provider_refund_reference text,
  diagnostic_code text, recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_solo_refund_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_solo_refund_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.booking_solo_refund_attempts TO service_role;
ALTER TABLE public.booking_solo_refund_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_solo_refund_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.booking_solo_refund_operations TO service_role;
CREATE UNIQUE INDEX booking_solo_refund_manual_proof_once ON public.booking_solo_refund_operations(provider,proof_reference) WHERE proof_reference IS NOT NULL;
CREATE INDEX booking_solo_refund_recovery ON public.booking_solo_refund_operations(updated_at)
  WHERE settlement_applied_at IS NULL OR delivery_state <> 'delivered';
ALTER TABLE public.notifications ADD COLUMN solo_refund_operation_id uuid, ADD COLUMN solo_refund_delivery_phase text;
CREATE UNIQUE INDEX notifications_solo_refund_once ON public.notifications(solo_refund_operation_id,user_id,type,solo_refund_delivery_phase)
  WHERE solo_refund_operation_id IS NOT NULL;

-- Quarantine ambiguous legacy outcomes, without changing historical finance.
-- Legacy bank/PayPal reservations already reduced the host basis. Preserve that.
INSERT INTO public.booking_solo_refund_operations
  (booking_id,provider,payment_method,transaction_reference,order_reference,
   requested_amount,original_basis,gross_amount,prior_refund_amount,basis_reserved,
   trigger_booking_id,outcome,diagnostic_code)
SELECT b.id,COALESCE(b.payment_provider,CASE WHEN b.payment_method='card' THEN 'nicepay' ELSE b.payment_method END,'legacy'),
  COALESCE(b.payment_method,'legacy'),b.tid,COALESCE(b.order_id,b.id),b.solo_guarantee_price,
  COALESCE(NULLIF(b.total_experience_price,0),NULLIF(b.total_price,0),b.amount),
  b.amount,COALESCE(b.refund_amount,0),b.solo_guarantee_refund_status='pending_manual',
  b.solo_guarantee_refund_trigger_booking_id,
  CASE WHEN b.solo_guarantee_refund_status='pending_manual' AND b.payment_method IN ('bank','paypal')
    THEN 'manual_pending' ELSE 'unknown' END,'legacy_outcome_requires_reconciliation'
FROM public.bookings b
WHERE b.solo_guarantee_refund_status IN ('processing','failed','pending_manual','unknown','accepted','reconciliation_required')
  AND b.solo_guarantee_price > 0 AND b.amount >= b.solo_guarantee_price;

CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.journal_solo_refund_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF TG_OP='UPDATE' AND OLD.attempt_identity<>NEW.attempt_identity THEN
    INSERT INTO public.booking_solo_refund_attempts(attempt_identity,operation_id,attempt_number,order_reference,outcome,merchant_reference,request_started_at,result_code,provider_refund_reference,diagnostic_code)
      VALUES(OLD.attempt_identity,OLD.id,OLD.attempt_number,OLD.order_reference,OLD.outcome,OLD.merchant_reference,OLD.request_started_at,OLD.result_code,OLD.provider_refund_reference,OLD.diagnostic_code)
      ON CONFLICT(attempt_identity) DO UPDATE SET outcome=EXCLUDED.outcome,result_code=EXCLUDED.result_code,provider_refund_reference=EXCLUDED.provider_refund_reference,diagnostic_code=EXCLUDED.diagnostic_code;
  END IF;
  INSERT INTO public.booking_solo_refund_attempts(attempt_identity,operation_id,attempt_number,order_reference,outcome,merchant_reference,request_started_at,result_code,provider_refund_reference,diagnostic_code)
    VALUES(NEW.attempt_identity,NEW.id,NEW.attempt_number,NEW.order_reference,NEW.outcome,NEW.merchant_reference,NEW.request_started_at,NEW.result_code,NEW.provider_refund_reference,NEW.diagnostic_code)
    ON CONFLICT(attempt_identity) DO UPDATE SET outcome=EXCLUDED.outcome,merchant_reference=EXCLUDED.merchant_reference,request_started_at=EXCLUDED.request_started_at,result_code=EXCLUDED.result_code,provider_refund_reference=EXCLUDED.provider_refund_reference,diagnostic_code=EXCLUDED.diagnostic_code;
  RETURN NEW;
END $$;
CREATE TRIGGER solo_refund_attempt_journal AFTER INSERT OR UPDATE ON public.booking_solo_refund_operations
  FOR EACH ROW EXECUTE FUNCTION private.journal_solo_refund_attempt();
INSERT INTO public.booking_solo_refund_attempts(attempt_identity,operation_id,attempt_number,order_reference,outcome,diagnostic_code)
  SELECT attempt_identity,id,attempt_number,order_reference,outcome,diagnostic_code FROM public.booking_solo_refund_operations;

-- One lock per experience covers all its slots. Acquire before any booking row
-- lock; batches acquire sorted experience IDs. No lock survives the RPC commit.
CREATE OR REPLACE FUNCTION private.lock_booking_money(p_experience_id bigint)
RETURNS void LANGUAGE sql VOLATILE SET search_path='' AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('booking-money:'||p_experience_id::text,0));
$$;

CREATE OR REPLACE FUNCTION private.solo_refund_due(p_booking public.bookings)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT COALESCE(
    lower(p_booking.status)='completed' AND p_booking.solo_guarantee_price>0
    AND p_booking.solo_guarantee_refund_status='not_applicable'
    AND CASE WHEN p_booking.date IS NOT NULL AND trim(p_booking.time) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      THEN ((p_booking.date::text||' '||trim(p_booking.time))::timestamp AT TIME ZONE 'Asia/Seoul')
        + pg_catalog.make_interval(hours=>CASE WHEN e.duration>0 THEN e.duration ELSE 2 END) <= now()
      ELSE false END
    AND EXISTS (SELECT 1 FROM public.bookings other
      WHERE other.experience_id=p_booking.experience_id AND other.date=p_booking.date
      AND other.time IS NOT DISTINCT FROM p_booking.time AND other.id<>p_booking.id
      AND lower(other.status) IN ('paid','confirmed','completed') AND other.guests>0)
  ,false) FROM public.experiences e WHERE e.id=p_booking.experience_id;
$$;

CREATE OR REPLACE FUNCTION private.assert_booking_payout_safe(p_booking public.bookings)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  IF p_booking.solo_guarantee_refund_status NOT IN ('not_applicable','refunded')
    OR COALESCE(private.solo_refund_due(p_booking),false)
    OR EXISTS (SELECT 1 FROM public.booking_solo_refund_operations o
      WHERE o.booking_id=p_booking.id AND o.settlement_applied_at IS NULL)
    OR p_booking.cancellation_claim_id IS NOT NULL THEN
    RAISE EXCEPTION 'BOOKING_MONEY_UNRESOLVED' USING ERRCODE='P0001';
  END IF;
  -- Start-time completion is retained, but positive solo liability must wait for
  -- the end boundary even when no other participant has joined yet.
  IF lower(p_booking.status)='completed' AND p_booking.solo_guarantee_price>0
    AND p_booking.solo_guarantee_refund_status='not_applicable' AND NOT EXISTS (
      SELECT 1 FROM public.experiences e WHERE e.id=p_booking.experience_id
      AND trim(p_booking.time) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      AND ((p_booking.date::text||' '||trim(p_booking.time))::timestamp AT TIME ZONE 'Asia/Seoul')
        + make_interval(hours=>CASE WHEN e.duration>0 THEN e.duration ELSE 2 END) <= now()
    ) THEN RAISE EXCEPTION 'BOOKING_TOUR_NOT_ENDED'; END IF;
END $$;

-- Defense against old server read/update paths. Their monetary transitions fail
-- closed until the compatible RPC caller has been deployed.
CREATE OR REPLACE FUNCTION private.guard_booking_money_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.booking_solo_refund_operations o WHERE o.booking_id=OLD.id) AND
    (NEW.id,NEW.user_id,NEW.order_id,NEW.experience_id,NEW.date,NEW.time,NEW.guests,NEW.amount,NEW.solo_guarantee_price,NEW.tid,NEW.payment_method,NEW.payment_provider,NEW.payment_provider_reference)
    IS DISTINCT FROM
    (OLD.id,OLD.user_id,OLD.order_id,OLD.experience_id,OLD.date,OLD.time,OLD.guests,OLD.amount,OLD.solo_guarantee_price,OLD.tid,OLD.payment_method,OLD.payment_provider,OLD.payment_provider_reference) THEN
    RAISE EXCEPTION 'SOLO_REFUND_SNAPSHOT_IMMUTABLE';
  END IF;
  IF EXISTS(SELECT 1 FROM public.booking_solo_refund_operations o WHERE o.booking_id=OLD.id AND o.settlement_applied_at IS NULL)
    AND (NEW.total_price,NEW.total_experience_price,NEW.refund_amount,NEW.host_payout_amount,NEW.platform_revenue)
      IS DISTINCT FROM (OLD.total_price,OLD.total_experience_price,OLD.refund_amount,OLD.host_payout_amount,OLD.platform_revenue)
    AND current_setting('locally.solo_refund_rpc',true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'SOLO_REFUND_RPC_REQUIRED'; END IF;
  IF NEW.payout_status='paid' AND OLD.payout_status IS DISTINCT FROM 'paid' THEN
    IF current_setting('locally.payout_rpc',true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'PAYOUT_RPC_REQUIRED';
    END IF;
    PERFORM private.assert_booking_payout_safe(OLD);
  END IF;
  IF (NEW.solo_guarantee_refund_status,NEW.solo_guarantee_refund_amount,NEW.solo_guarantee_refunded_at)
     IS DISTINCT FROM (OLD.solo_guarantee_refund_status,OLD.solo_guarantee_refund_amount,OLD.solo_guarantee_refunded_at)
     AND current_setting('locally.solo_refund_rpc',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'SOLO_REFUND_RPC_REQUIRED';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND lower(OLD.status) IN ('paid','confirmed','completed','cancellation_requested')
     AND lower(NEW.status) IN ('cancellation_requested','cancelled')
     AND current_setting('locally.cancellation_rpc',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'CANCELLATION_RPC_REQUIRED';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND EXISTS (
      SELECT 1 FROM public.booking_solo_refund_operations o WHERE o.booking_id=OLD.id
      AND o.settlement_applied_at IS NULL) THEN
    RAISE EXCEPTION 'BOOKING_MONEY_UNRESOLVED';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_money_transition_authority BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION private.guard_booking_money_transition();

CREATE OR REPLACE FUNCTION private.guard_unresolved_booking_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.booking_solo_refund_operations o WHERE o.booking_id=OLD.id AND o.settlement_applied_at IS NULL)
    OR OLD.cancellation_claim_id IS NOT NULL THEN RAISE EXCEPTION 'BOOKING_MONEY_UNRESOLVED'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER bookings_unresolved_money_delete BEFORE DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.guard_unresolved_booking_delete();

CREATE OR REPLACE FUNCTION public.claim_solo_refund_atomic(p_booking_id text)
RETURNS SETOF public.booking_solo_refund_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; v_experience bigint; v_trigger text; v_basis integer; v_manual boolean; v_attempt uuid:=gen_random_uuid(); BEGIN
  SELECT experience_id INTO v_experience FROM public.bookings WHERE id=p_booking_id;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM private.lock_booking_money(v_experience);
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF b.payout_status IS DISTINCT FROM 'pending' OR b.cancellation_claim_id IS NOT NULL
    OR NOT COALESCE(private.solo_refund_due(b),false)
    OR EXISTS(SELECT 1 FROM public.booking_solo_refund_operations o WHERE o.booking_id=b.id)
    THEN RETURN; END IF;
  -- Lock the participant at the defined eligibility boundary. Later cancellation
  -- does not revoke an obligation that was already validly claimed.
  SELECT other.id INTO v_trigger FROM public.bookings other
    WHERE other.experience_id=b.experience_id AND other.date=b.date
    AND other.time IS NOT DISTINCT FROM b.time AND other.id<>b.id
    AND lower(other.status) IN ('paid','confirmed','completed') AND other.guests>0
    ORDER BY other.id LIMIT 1 FOR UPDATE;
  IF v_trigger IS NULL THEN RETURN; END IF;
  v_basis := COALESCE(NULLIF(b.total_experience_price,0),NULLIF(b.total_price,0),b.amount);
  IF v_basis<b.solo_guarantee_price OR b.amount-COALESCE(b.refund_amount,0)<b.solo_guarantee_price THEN
    RAISE EXCEPTION 'SOLO_REFUND_SNAPSHOT_INVALID'; END IF;
  v_manual := b.payment_method IN ('bank','paypal');
  PERFORM set_config('locally.solo_refund_rpc','on',true);
  INSERT INTO public.booking_solo_refund_operations
    (booking_id,attempt_identity,provider,payment_method,transaction_reference,order_reference,requested_amount,
     original_basis,gross_amount,prior_refund_amount,basis_reserved,trigger_booking_id,outcome,lease_expires_at,diagnostic_code)
  VALUES (b.id,v_attempt,COALESCE(b.payment_provider,CASE WHEN b.payment_method='card' THEN 'nicepay' ELSE b.payment_method END,'legacy'),
    COALESCE(b.payment_method,'legacy'),b.tid,'solo-'||v_attempt::text,b.solo_guarantee_price,
    v_basis,b.amount,COALESCE(b.refund_amount,0),false,v_trigger,
    CASE WHEN v_manual THEN 'manual_pending' WHEN b.payment_method='card' AND NULLIF(trim(b.tid),'') IS NOT NULL AND COALESCE(b.payment_provider,'nicepay')='nicepay' THEN 'claimed' ELSE 'unknown' END,
    now()+interval '2 minutes',CASE WHEN NOT v_manual AND (NULLIF(trim(b.tid),'') IS NULL OR COALESCE(b.payment_provider,'nicepay')<>'nicepay') THEN 'provider_reference_requires_reconciliation' END);
  UPDATE public.bookings SET solo_guarantee_refund_status=CASE WHEN v_manual THEN 'pending_manual'
      WHEN b.payment_method='card' AND NULLIF(trim(b.tid),'') IS NOT NULL AND COALESCE(b.payment_provider,'nicepay')='nicepay' THEN 'processing' ELSE 'unknown' END,
    solo_guarantee_refund_amount=CASE WHEN v_manual THEN b.solo_guarantee_price ELSE 0 END,
    solo_guarantee_refund_trigger_booking_id=v_trigger,solo_guarantee_refund_error=NULL,
    total_price=CASE WHEN v_manual THEN v_basis-b.solo_guarantee_price ELSE b.total_price END,
    total_experience_price=CASE WHEN v_manual THEN v_basis-b.solo_guarantee_price ELSE b.total_experience_price END,
    host_payout_amount=CASE WHEN v_manual THEN floor((v_basis-b.solo_guarantee_price)*0.8)::integer ELSE b.host_payout_amount END,
    platform_revenue=CASE WHEN v_manual THEN b.amount-COALESCE(b.refund_amount,0)-b.solo_guarantee_price-floor((v_basis-b.solo_guarantee_price)*0.8)::integer ELSE b.platform_revenue END
    WHERE id=b.id;
  RETURN QUERY SELECT * FROM public.booking_solo_refund_operations o WHERE o.booking_id=b.id;
END $$;

-- A dispatch token can be consumed only once. A lost reply never permits replay.
CREATE OR REPLACE FUNCTION public.begin_solo_refund_request_atomic(p_operation_id uuid,p_attempt_identity uuid,p_merchant_reference text)
RETURNS SETOF public.booking_solo_refund_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF p_merchant_reference IS NULL OR p_merchant_reference !~ '^[A-Za-z0-9_-]{1,64}$' THEN RAISE EXCEPTION 'PROVIDER_MERCHANT_REQUIRED'; END IF;
  RETURN QUERY UPDATE public.booking_solo_refund_operations o SET merchant_reference=p_merchant_reference,request_started_at=now(),updated_at=now()
    WHERE o.id=p_operation_id AND o.attempt_identity=p_attempt_identity AND o.outcome='claimed' AND o.request_started_at IS NULL
    AND o.lease_expires_at>now() RETURNING o.*;
END $$;

CREATE OR REPLACE FUNCTION public.record_solo_refund_outcome_atomic(
  p_operation_id uuid,p_attempt_identity uuid,p_outcome text,p_result_code text DEFAULT NULL,
  p_refund_reference text DEFAULT NULL,p_diagnostic_code text DEFAULT NULL)
RETURNS SETOF public.booking_solo_refund_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; o public.booking_solo_refund_operations; v_booking_id text; BEGIN
  SELECT booking_id INTO v_booking_id FROM public.booking_solo_refund_operations WHERE id=p_operation_id;
  SELECT * INTO b FROM public.bookings WHERE id=v_booking_id;
  PERFORM private.lock_booking_money(b.experience_id);
  SELECT * INTO b FROM public.bookings WHERE id=v_booking_id FOR UPDATE;
  SELECT * INTO o FROM public.booking_solo_refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF o.id IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('accepted','unknown','rejected') THEN RAISE EXCEPTION 'SOLO_REFUND_OUTCOME_INVALID'; END IF;
  IF o.attempt_identity IS DISTINCT FROM p_attempt_identity OR o.settlement_applied_at IS NOT NULL OR o.outcome='accepted' THEN
    RETURN QUERY SELECT * FROM public.booking_solo_refund_operations x WHERE x.id=o.id; RETURN;
  END IF;
  -- UNKNOWN -> definite evidence is handled only by the reconciliation RPC.
  IF o.outcome<>'claimed' AND NOT(o.outcome='unknown' AND p_outcome='accepted') THEN
    RETURN QUERY SELECT * FROM public.booking_solo_refund_operations x WHERE x.id=o.id; RETURN;
  END IF;
  IF o.request_started_at IS NULL THEN RAISE EXCEPTION 'SOLO_REFUND_NOT_DISPATCHED'; END IF;
  IF p_outcome='accepted' AND ((p_result_code IS NULL OR p_result_code NOT IN ('2001','2211')) OR COALESCE(length(p_refund_reference),0)=0) THEN
    RAISE EXCEPTION 'SOLO_REFUND_ACCEPTANCE_PROOF_REQUIRED'; END IF;
  IF p_outcome='rejected' AND (p_result_code IS NULL OR p_result_code NOT IN ('2010','2011','2024','2025','2217','2218')) THEN RAISE EXCEPTION 'SOLO_REFUND_REJECTION_NOT_DEFINITE'; END IF;
  UPDATE public.booking_solo_refund_operations SET outcome=p_outcome,result_code=p_result_code,
    provider_refund_reference=p_refund_reference,diagnostic_code=p_diagnostic_code,updated_at=now() WHERE id=o.id;
  PERFORM set_config('locally.solo_refund_rpc','on',true);
  UPDATE public.bookings SET solo_guarantee_refund_status=p_outcome,solo_guarantee_refund_error=p_diagnostic_code WHERE id=b.id;
  RETURN QUERY SELECT * FROM public.booking_solo_refund_operations x WHERE x.id=o.id;
END $$;

CREATE OR REPLACE FUNCTION public.apply_solo_refund_settlement_atomic(p_operation_id uuid)
RETURNS SETOF public.booking_solo_refund_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; o public.booking_solo_refund_operations; v_booking_id text; v_basis integer; v_host integer; BEGIN
  SELECT booking_id INTO v_booking_id FROM public.booking_solo_refund_operations WHERE id=p_operation_id;
  SELECT * INTO b FROM public.bookings WHERE id=v_booking_id;
  PERFORM private.lock_booking_money(b.experience_id);
  SELECT * INTO b FROM public.bookings WHERE id=v_booking_id FOR UPDATE;
  SELECT * INTO o FROM public.booking_solo_refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF o.settlement_applied_at IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.booking_solo_refund_operations x WHERE x.id=o.id; RETURN;
  END IF;
  IF o.id IS NULL OR o.outcome<>'accepted' OR b.payout_status IS DISTINCT FROM 'pending' OR lower(b.status) IS DISTINCT FROM 'completed'
    OR b.solo_guarantee_price<>o.requested_amount OR b.amount<>o.gross_amount
    OR COALESCE(b.refund_amount,0)<>o.prior_refund_amount THEN RAISE EXCEPTION 'SOLO_REFUND_APPLY_CONFLICT'; END IF;
  v_basis:=o.original_basis-CASE WHEN o.basis_reserved THEN 0 ELSE o.requested_amount END;
  v_host:=floor(v_basis*0.8);
  PERFORM set_config('locally.solo_refund_rpc','on',true);
  UPDATE public.bookings SET solo_guarantee_refund_status='refunded',solo_guarantee_refund_amount=o.requested_amount,
    solo_guarantee_refunded_at=now(),solo_guarantee_refund_error=NULL,
    refund_amount=o.prior_refund_amount+o.requested_amount,total_price=v_basis,total_experience_price=v_basis,
    host_payout_amount=v_host,platform_revenue=o.gross_amount-o.prior_refund_amount-o.requested_amount-v_host WHERE id=b.id;
  UPDATE public.booking_solo_refund_operations SET settlement_applied_at=now(),updated_at=now(),diagnostic_code=NULL,
    delivery_state='pending',delivery_attempts=0,next_delivery_at=now() WHERE id=o.id;
  RETURN QUERY SELECT * FROM public.booking_solo_refund_operations x WHERE x.id=o.id;
END $$;

CREATE OR REPLACE FUNCTION public.complete_manual_solo_refund_atomic(
  p_booking_id text,p_amount integer,p_proof_reference text,p_transaction_reference text,p_admin_id uuid)
RETURNS SETOF public.booking_solo_refund_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; o public.booking_solo_refund_operations; BEGIN
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id;
  PERFORM private.lock_booking_money(b.experience_id);
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  SELECT * INTO o FROM public.booking_solo_refund_operations WHERE booking_id=p_booking_id FOR UPDATE;
  IF o.id IS NULL OR o.outcome<>'manual_pending' OR o.settlement_applied_at IS NOT NULL
    OR b.payment_method NOT IN ('bank','paypal') OR o.payment_method<>b.payment_method
    OR b.solo_guarantee_refund_status<>'pending_manual' OR lower(b.status) IS DISTINCT FROM 'completed'
    OR b.payout_status IS DISTINCT FROM 'pending' OR p_amount IS NULL OR p_amount<>o.requested_amount OR p_amount<>b.solo_guarantee_price
    OR b.solo_guarantee_refund_amount<>p_amount OR p_admin_id IS NULL
    OR p_proof_reference IS NULL OR p_proof_reference !~ '^[A-Za-z0-9][A-Za-z0-9_.:/-]{2,127}$'
    OR (b.payment_method='paypal' AND (p_transaction_reference IS NULL
        OR p_transaction_reference IS DISTINCT FROM o.transaction_reference)) THEN
    RAISE EXCEPTION 'SOLO_MANUAL_PROOF_OR_STATE_INVALID'; END IF;
  UPDATE public.booking_solo_refund_operations SET outcome='accepted',proof_reference=p_proof_reference,
    proof_transaction_reference=p_transaction_reference,verified_by=p_admin_id,
    provider_refund_reference=p_proof_reference,result_code='manual_verified',updated_at=now() WHERE id=o.id;
  PERFORM set_config('locally.solo_refund_rpc','on',true);
  UPDATE public.bookings SET solo_guarantee_refund_status='accepted' WHERE id=b.id;
  RETURN QUERY SELECT * FROM public.booking_solo_refund_operations target WHERE target.id=o.id;
END $$;

-- Called only after the server verifies a signed success against the immutable
-- operation snapshot. A status-only transaction inquiry is never sufficient.
CREATE OR REPLACE FUNCTION public.reconcile_solo_refund_accepted_atomic(
  p_operation_id uuid,p_result_code text,p_refund_reference text,p_amount integer,p_transaction_reference text,p_order_reference text,p_admin_id uuid)
RETURNS SETOF public.booking_solo_refund_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; o public.booking_solo_refund_operations; BEGIN
  SELECT booking_id INTO b.id FROM public.booking_solo_refund_operations WHERE id=p_operation_id;
  SELECT * INTO b FROM public.bookings WHERE id=b.id;
  PERFORM private.lock_booking_money(b.experience_id);
  SELECT * INTO b FROM public.bookings WHERE id=b.id FOR UPDATE;
  SELECT * INTO o FROM public.booking_solo_refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF o.id IS NULL OR o.payment_method<>'card' OR o.provider<>'nicepay'
    OR (p_result_code IS NULL OR p_result_code NOT IN ('2001','2211')) OR COALESCE(length(p_refund_reference),0)=0
    OR p_amount<>o.requested_amount OR p_transaction_reference IS DISTINCT FROM o.transaction_reference
    OR p_order_reference IS DISTINCT FROM o.order_reference OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'SOLO_RECONCILIATION_PROOF_INVALID'; END IF;
  UPDATE public.booking_solo_refund_operations SET outcome='accepted',result_code=p_result_code,
    provider_refund_reference=p_refund_reference,verified_by=p_admin_id,updated_at=now() WHERE id=o.id;
  RETURN QUERY SELECT * FROM public.apply_solo_refund_settlement_atomic(o.id);
END $$;

CREATE OR REPLACE FUNCTION public.recover_solo_refunds_atomic(p_limit integer DEFAULT 50)
RETURNS SETOF public.booking_solo_refund_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v record; BEGIN
  FOR v IN SELECT o.id,o.booking_id FROM public.booking_solo_refund_operations o
    WHERE o.outcome='claimed' AND o.lease_expires_at<=now() ORDER BY o.updated_at LIMIT LEAST(GREATEST(p_limit,1),50) LOOP
    -- Update operations only: legacy booking labels remain readable; all payout
    -- and cancellation guards also inspect the authoritative operation table.
    UPDATE public.booking_solo_refund_operations SET outcome='unknown',diagnostic_code='claim_lease_expired',updated_at=now()
      WHERE id=v.id AND outcome='claimed' AND lease_expires_at<=now();
  END LOOP;
  RETURN QUERY SELECT o.* FROM public.booking_solo_refund_operations o
    WHERE (o.outcome='accepted' AND o.settlement_applied_at IS NULL)
      OR ((o.settlement_applied_at IS NOT NULL OR o.outcome='manual_pending') AND o.delivery_state<>'delivered'
          AND o.next_delivery_at<=now() AND o.delivery_attempts<8)
    ORDER BY o.updated_at,o.id LIMIT LEAST(GREATEST(p_limit,1),50);
END $$;

-- Late signed validation rejection can resolve UNKNOWN, but never downgrades
-- accepted/applied money. Server verifies exact merchant/TID/order/amount first.
CREATE OR REPLACE FUNCTION public.reconcile_solo_refund_rejected_atomic(
  p_operation_id uuid,p_result_code text,p_amount integer,p_transaction_reference text,p_order_reference text,p_admin_id uuid)
RETURNS SETOF public.booking_solo_refund_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; o public.booking_solo_refund_operations; v_booking_id text; BEGIN
  SELECT booking_id INTO v_booking_id FROM public.booking_solo_refund_operations WHERE id=p_operation_id;
  SELECT * INTO b FROM public.bookings WHERE id=v_booking_id;
  PERFORM private.lock_booking_money(b.experience_id);
  SELECT * INTO b FROM public.bookings WHERE id=v_booking_id FOR UPDATE;
  SELECT * INTO o FROM public.booking_solo_refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF o.id IS NULL OR o.payment_method<>'card' OR o.provider<>'nicepay' OR o.outcome NOT IN ('claimed','unknown','rejected')
    OR o.settlement_applied_at IS NOT NULL OR b.payout_status IS DISTINCT FROM 'pending' OR lower(b.status) IS DISTINCT FROM 'completed'
    OR p_result_code IS NULL OR p_result_code NOT IN ('2010','2011','2024','2025','2217','2218')
    OR p_amount IS NULL OR p_amount<>o.requested_amount OR p_transaction_reference IS DISTINCT FROM o.transaction_reference
    OR p_order_reference IS DISTINCT FROM o.order_reference OR p_admin_id IS NULL THEN RAISE EXCEPTION 'SOLO_RECONCILIATION_PROOF_INVALID'; END IF;
  UPDATE public.booking_solo_refund_operations SET outcome='rejected',result_code=p_result_code,verified_by=p_admin_id,
    diagnostic_code='provider_rejected',updated_at=now() WHERE id=o.id;
  PERFORM set_config('locally.solo_refund_rpc','on',true);
  UPDATE public.bookings SET solo_guarantee_refund_status='rejected',solo_guarantee_refund_error='provider_rejected' WHERE id=b.id;
  RETURN QUERY SELECT * FROM public.booking_solo_refund_operations target WHERE target.id=o.id;
END $$;

CREATE OR REPLACE FUNCTION public.deliver_solo_refund_notification_atomic(p_operation_id uuid,p_expected_phase text,p_notifications jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.booking_solo_refund_operations; n jsonb; b public.bookings; v_host uuid; BEGIN
  SELECT * INTO o FROM public.booking_solo_refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF o.id IS NULL THEN RETURN false; END IF;
  IF p_expected_phase IS DISTINCT FROM (CASE WHEN o.settlement_applied_at IS NOT NULL THEN 'applied' ELSE 'manual_pending' END) THEN RETURN false; END IF;
  IF o.delivery_state='delivered' THEN RETURN true; END IF;
  IF o.settlement_applied_at IS NULL AND o.outcome<>'manual_pending' THEN RETURN false; END IF;
  SELECT * INTO b FROM public.bookings WHERE id=o.booking_id;
  SELECT host_id INTO v_host FROM public.experiences WHERE id=b.experience_id;
  BEGIN
    IF jsonb_array_length(p_notifications)>2 OR jsonb_array_length(p_notifications)<1 THEN RAISE EXCEPTION 'INVALID_DELIVERY'; END IF;
    FOR n IN SELECT value FROM jsonb_array_elements(p_notifications) LOOP
      IF (n->>'user_id')::uuid IS DISTINCT FROM b.user_id AND (n->>'user_id')::uuid IS DISTINCT FROM v_host THEN
        RAISE EXCEPTION 'INVALID_DELIVERY_RECIPIENT'; END IF;
      INSERT INTO public.notifications(user_id,type,title,message,link,is_read,booking_id,solo_refund_operation_id,solo_refund_delivery_phase)
        VALUES((n->>'user_id')::uuid,'refund',left(n->>'title',200),left(n->>'message',1000),
          CASE WHEN (n->>'user_id')::uuid=b.user_id THEN '/guest/trips' ELSE '/host/dashboard?tab=earnings' END,
          false,o.booking_id,o.id,CASE WHEN o.settlement_applied_at IS NOT NULL THEN 'applied' ELSE 'manual_pending' END)
        ON CONFLICT (solo_refund_operation_id,user_id,type,solo_refund_delivery_phase) WHERE solo_refund_operation_id IS NOT NULL
        DO NOTHING;
    END LOOP;
    UPDATE public.booking_solo_refund_operations SET delivery_state='delivered',delivery_attempts=delivery_attempts+1 WHERE id=o.id;
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.booking_solo_refund_operations SET delivery_state='failed',delivery_attempts=delivery_attempts+1,
      next_delivery_at=now()+interval '2 hours',diagnostic_code='notification_delivery_failed' WHERE id=o.id;
    RETURN false;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.mark_solo_refund_delivery_failed_atomic(p_operation_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  UPDATE public.booking_solo_refund_operations SET delivery_state='failed',delivery_attempts=delivery_attempts+1,
    next_delivery_at=now()+interval '2 hours',diagnostic_code='notification_delivery_failed'
  WHERE id=p_operation_id AND delivery_state<>'delivered' AND delivery_attempts<8;
$$;

CREATE OR REPLACE FUNCTION public.retry_solo_refund_delivery_atomic(p_operation_id uuid,p_admin_id uuid)
RETURNS SETOF public.booking_solo_refund_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF p_admin_id IS NULL THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  RETURN QUERY UPDATE public.booking_solo_refund_operations o SET delivery_state='pending',delivery_attempts=0,next_delivery_at=now()
    WHERE o.id=p_operation_id AND o.delivery_state<>'delivered' AND (o.settlement_applied_at IS NOT NULL OR o.outcome='manual_pending') RETURNING o.*;
END $$;

CREATE OR REPLACE FUNCTION public.solo_refund_diagnostics()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('claimed',count(*) FILTER(WHERE outcome='claimed' AND settlement_applied_at IS NULL),
    'accepted',count(*) FILTER(WHERE outcome='accepted'), 'unknown',count(*) FILTER(WHERE outcome='unknown'),
    'rejected',count(*) FILTER(WHERE outcome='rejected'), 'settlement_applied',count(*) FILTER(WHERE settlement_applied_at IS NOT NULL),
    'manual_pending',count(*) FILTER(WHERE outcome='manual_pending'),
    'reconciliation_required',count(*) FILTER(WHERE outcome IN ('claimed','unknown','rejected') OR (outcome='accepted' AND settlement_applied_at IS NULL)),
    'delivery_failed',count(*) FILTER(WHERE delivery_state<>'delivered' AND (settlement_applied_at IS NOT NULL OR outcome='manual_pending'))) FROM public.booking_solo_refund_operations;
$$;

CREATE OR REPLACE FUNCTION public.claim_booking_cancellation_atomic(p_booking_id text,p_expected_snapshot jsonb)
RETURNS SETOF public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; v_experience bigint; BEGIN
  SELECT experience_id INTO v_experience FROM public.bookings WHERE id=p_booking_id;
  PERFORM private.lock_booking_money(v_experience);
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF p_expected_snapshot IS NULL OR jsonb_typeof(p_expected_snapshot)<>'object' OR NOT(p_expected_snapshot ? 'status') OR b.id IS NULL OR b.cancellation_claim_id IS NOT NULL OR lower(b.status) IN ('cancelled','rejected')
    OR NOT (to_jsonb(b) @> p_expected_snapshot)
    OR b.solo_guarantee_refund_status NOT IN ('not_applicable','refunded')
    OR EXISTS(SELECT 1 FROM public.booking_solo_refund_operations o WHERE o.booking_id=b.id AND o.settlement_applied_at IS NULL) THEN RETURN; END IF;
  PERFORM set_config('locally.cancellation_rpc','on',true);
  RETURN QUERY UPDATE public.bookings SET status='cancellation_requested',cancellation_original_status=b.status,cancellation_claim_id=gen_random_uuid(),
    cancellation_claimed_at=now() WHERE id=b.id RETURNING *;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_booking_cancellation_atomic(
  p_booking_id text,p_claim_id uuid,p_reason text,p_refund_amount integer,p_host_payout integer,p_platform_revenue integer)
RETURNS SETOF public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; BEGIN
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id;
  PERFORM private.lock_booking_money(b.experience_id);
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF b.cancellation_claim_id IS DISTINCT FROM p_claim_id OR p_claim_id IS NULL OR b.status<>'cancellation_requested'
    OR b.solo_guarantee_refund_status NOT IN ('not_applicable','refunded') THEN RAISE EXCEPTION 'CANCELLATION_CLAIM_CONFLICT'; END IF;
  IF p_refund_amount IS NULL OR p_host_payout IS NULL OR p_platform_revenue IS NULL OR p_refund_amount<COALESCE(b.refund_amount,0) OR p_refund_amount>b.amount
    OR p_host_payout<0 OR p_platform_revenue<0
    OR (p_refund_amount+p_host_payout+p_platform_revenue<>b.amount AND NOT(lower(b.cancellation_original_status)='pending' AND p_refund_amount=0 AND p_host_payout=0 AND p_platform_revenue=0)) THEN
    RAISE EXCEPTION 'CANCELLATION_SETTLEMENT_INVALID'; END IF;
  PERFORM set_config('locally.cancellation_rpc','on',true);
  RETURN QUERY UPDATE public.bookings SET status='cancelled',cancel_reason=p_reason,refund_amount=p_refund_amount,
    host_payout_amount=p_host_payout,platform_revenue=p_platform_revenue,cancellation_claim_id=NULL,cancellation_claimed_at=NULL,cancellation_original_status=NULL
    WHERE id=b.id RETURNING *;
END $$;

CREATE OR REPLACE FUNCTION public.settle_experience_payouts_atomic(p_booking_ids text[],p_expected_amounts jsonb)
RETURNS TABLE(id text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v record; b public.bookings; BEGIN
  IF cardinality(p_booking_ids)<1 OR cardinality(p_booking_ids)>500 THEN RAISE EXCEPTION 'PAYOUT_BATCH_INVALID'; END IF;
  FOR v IN SELECT DISTINCT experience_id FROM public.bookings WHERE bookings.id=ANY(p_booking_ids) ORDER BY experience_id LOOP
    PERFORM private.lock_booking_money(v.experience_id); END LOOP;
  IF (SELECT count(*) FROM public.bookings WHERE bookings.id=ANY(p_booking_ids))<>cardinality(p_booking_ids) THEN
    RAISE EXCEPTION 'PAYOUT_BOOKING_NOT_FOUND'; END IF;
  FOR b IN SELECT * FROM public.bookings WHERE bookings.id=ANY(p_booking_ids) ORDER BY bookings.id FOR UPDATE LOOP
    PERFORM private.assert_booking_payout_safe(b);
    IF b.payout_status IS DISTINCT FROM 'pending' OR lower(b.status) NOT IN ('completed','cancelled') OR b.host_payout_amount<=0
      OR b.host_payout_amount IS DISTINCT FROM (p_expected_amounts->>b.id)::integer THEN RAISE EXCEPTION 'PAYOUT_SNAPSHOT_CONFLICT'; END IF;
  END LOOP;
  PERFORM set_config('locally.payout_rpc','on',true);
  RETURN QUERY UPDATE public.bookings target SET payout_status='paid',payout_paid_at=now() WHERE target.id=ANY(p_booking_ids) RETURNING target.id;
END $$;

-- Preserve the existing verified approval / explicit checkout-release recovery.
-- The unpaid released booking is not a qualifying participant or payout row.
CREATE OR REPLACE FUNCTION public.finalize_released_card_refund_atomic(
  p_booking_id text,p_transaction_reference text,p_order_reference text,p_amount integer)
RETURNS SETOF public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; BEGIN
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id;
  PERFORM private.lock_booking_money(b.experience_id);
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF b.id IS NULL OR b.payment_method IS DISTINCT FROM 'card' OR b.payment_provider IS DISTINCT FROM 'nicepay'
    OR b.payment_claim_state IS DISTINCT FROM 'released' OR b.tid IS DISTINCT FROM p_transaction_reference
    OR b.payment_provider_reference IS DISTINCT FROM p_order_reference OR p_amount IS NULL OR p_amount<>b.amount
    OR b.payout_status IS DISTINCT FROM 'pending' OR b.cancellation_claim_id IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.booking_solo_refund_operations o WHERE o.booking_id=b.id) THEN
    RAISE EXCEPTION 'RELEASED_CARD_REFUND_CONFLICT'; END IF;
  IF b.status='cancelled' AND b.cancel_reason='카드 결제창 취소와 승인 응답이 겹쳐 자동 승인취소 완료' AND b.refund_amount=p_amount THEN
    RETURN QUERY SELECT * FROM public.bookings target WHERE target.id=b.id; RETURN; END IF;
  IF b.status IS DISTINCT FROM 'cancellation_requested' OR b.cancel_reason IS DISTINCT FROM '카드 결제창 취소와 승인 응답 경합 처리 중'
    OR COALESCE(b.refund_amount,0)<>0 OR b.host_payout_amount<>0 OR b.platform_revenue<>0 THEN
    RAISE EXCEPTION 'RELEASED_CARD_REFUND_CONFLICT'; END IF;
  PERFORM set_config('locally.cancellation_rpc','on',true);
  RETURN QUERY UPDATE public.bookings target SET status='cancelled',cancel_reason='카드 결제창 취소와 승인 응답이 겹쳐 자동 승인취소 완료',
    refund_amount=p_amount,host_payout_amount=0,platform_revenue=0 WHERE target.id=b.id RETURNING target.*;
END $$;

CREATE OR REPLACE FUNCTION public.retry_rejected_solo_refund_atomic(p_operation_id uuid,p_admin_id uuid)
RETURNS SETOF public.booking_solo_refund_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; o public.booking_solo_refund_operations; v_booking_id text; v_attempt uuid:=gen_random_uuid(); BEGIN
  SELECT booking_id INTO v_booking_id FROM public.booking_solo_refund_operations WHERE id=p_operation_id;
  SELECT * INTO b FROM public.bookings WHERE id=v_booking_id;
  PERFORM private.lock_booking_money(b.experience_id);
  SELECT * INTO b FROM public.bookings WHERE id=v_booking_id FOR UPDATE;
  SELECT * INTO o FROM public.booking_solo_refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF o.id IS NULL OR o.outcome<>'rejected' OR o.result_code IS NULL OR (o.request_started_at IS NULL AND o.verified_by IS NULL)
    OR o.settlement_applied_at IS NOT NULL OR o.attempt_number>=3 OR p_admin_id IS NULL
    OR lower(b.status) IS DISTINCT FROM 'completed' OR b.payout_status IS DISTINCT FROM 'pending' OR b.cancellation_claim_id IS NOT NULL
    OR b.solo_guarantee_price<>o.requested_amount OR b.amount<>o.gross_amount
    OR COALESCE(b.refund_amount,0)<>o.prior_refund_amount THEN RAISE EXCEPTION 'SOLO_REFUND_RETRY_UNSAFE'; END IF;
  UPDATE public.booking_solo_refund_operations SET attempt_identity=v_attempt,attempt_number=attempt_number+1,
    order_reference='solo-'||v_attempt::text,outcome='claimed',request_started_at=NULL,lease_expires_at=now()+interval '2 minutes',
    merchant_reference=NULL,result_code=NULL,provider_refund_reference=NULL,diagnostic_code=NULL,verified_by=p_admin_id,updated_at=now() WHERE id=o.id;
  PERFORM set_config('locally.solo_refund_rpc','on',true);
  UPDATE public.bookings SET solo_guarantee_refund_status='processing',solo_guarantee_refund_error=NULL WHERE id=b.id;
  RETURN QUERY SELECT * FROM public.booking_solo_refund_operations x WHERE x.id=o.id;
END $$;

-- Definitions for manual payout and completion follow below.

CREATE OR REPLACE FUNCTION public.complete_admin_manual_experience_payout_atomic(p_request_key uuid, p_host_id uuid, p_settlement_type text, p_expected_current_booking_amount integer, p_legacy_amount integer, p_reason text, p_legacy_source_reference text, p_transfer_reference text, p_paid_by_admin_id uuid, p_paid_by_admin_email text)
 RETURNS TABLE(manual_payout_id uuid, request_key uuid, host_id uuid, booking_count integer, current_booking_amount integer, legacy_amount integer, total_paid_amount integer, paid_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
  v_lock record;
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

  FOR v_lock IN SELECT e.id FROM public.experiences e WHERE e.host_id=p_host_id ORDER BY e.id LOOP
    PERFORM private.lock_booking_money(v_lock.id);
  END LOOP;
  PERFORM set_config('locally.payout_rpc','on',true);

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
        OR b.solo_guarantee_refund_status NOT IN ('not_applicable','refunded')
        OR COALESCE(private.solo_refund_due(b),false)
        OR EXISTS (SELECT 1 FROM public.booking_solo_refund_operations o WHERE o.booking_id=b.id AND o.settlement_applied_at IS NULL)
        OR b.cancellation_claim_id IS NOT NULL
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


CREATE OR REPLACE FUNCTION public.complete_experience_booking_if_due_atomic(p_booking_id text)
 RETURNS TABLE(booking_id text, order_id text, user_id uuid, already_processed boolean, not_due boolean, completed boolean, notification_created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
    INSERT INTO public.notifications AS notification_target (
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
    ON CONFLICT ((notification_target.booking_id)) WHERE type = 'review_request' AND notification_target.booking_id IS NOT NULL
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
    INSERT INTO public.notifications AS notification_target (
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
    ON CONFLICT ((notification_target.booking_id)) WHERE type = 'guest_review_request' AND notification_target.booking_id IS NOT NULL
    DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT v_booking.id, COALESCE(v_booking.order_id, v_booking.id),
    v_booking.user_id::UUID, FALSE, FALSE, TRUE, v_notification_created;
END;
$function$;


-- All functions in this migration are server-only, including private helpers.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='public' AND p.proname IN (
      'retry_rejected_solo_refund_atomic','claim_solo_refund_atomic','begin_solo_refund_request_atomic','record_solo_refund_outcome_atomic',
      'apply_solo_refund_settlement_atomic','complete_manual_solo_refund_atomic','reconcile_solo_refund_accepted_atomic','reconcile_solo_refund_rejected_atomic',
      'retry_solo_refund_delivery_atomic','mark_solo_refund_delivery_failed_atomic','recover_solo_refunds_atomic','deliver_solo_refund_notification_atomic','solo_refund_diagnostics',
      'claim_booking_cancellation_atomic','finalize_booking_cancellation_atomic','finalize_released_card_refund_atomic','settle_experience_payouts_atomic',
      'complete_admin_manual_experience_payout_atomic','complete_experience_booking_if_due_atomic'))
      OR (n.nspname='private' AND p.proname IN ('guard_unresolved_booking_delete','journal_solo_refund_attempt','lock_booking_money','solo_refund_due','assert_booking_payout_safe','guard_booking_money_transition'))
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA private TO service_role;
COMMIT;
