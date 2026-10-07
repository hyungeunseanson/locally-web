-- PENDING: additive, local-DB-only acceptance of an already-completed refund.
-- Never replace the signed-response reconciliation or settlement authorities.
BEGIN;

DO $existing_authority$
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND (p.proname,md5(p.prosrc)) IN (
        ('apply_solo_refund_settlement_atomic','85eed4f68d0b47673f0abaa98bcd9ce0'),
        ('reconcile_solo_refund_accepted_atomic','7c9901fecfcc9e60ed896b25e52b183d'),
        ('reconcile_solo_refund_rejected_atomic','b0ba239c597dcfef6067dfea7ea9aff3'))
      AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[]
      AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}') <> 3 THEN
    RAISE EXCEPTION 'SOLO_LEDGER_EXISTING_AUTHORITY_DRIFT';
  END IF;
END $existing_authority$;

CREATE TABLE private.solo_refund_provider_ledger_evidence (
  operation_id uuid PRIMARY KEY REFERENCES public.booking_solo_refund_operations(id),
  evidence_sha256 text NOT NULL UNIQUE CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$'),
  cancellation_transaction_id text NOT NULL UNIQUE,
  evidence_source text NOT NULL CHECK(evidence_source='nicepay_merchant_ledger'),
  evidence_payload jsonb NOT NULL,
  verified_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.solo_refund_provider_ledger_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.solo_refund_provider_ledger_evidence FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON private.solo_refund_provider_ledger_evidence TO service_role;

-- Version 1: recursively sorted ASCII object keys, compact UTF-8 JSON;
-- all numbers in the accepted proof schema are canonical integers.
CREATE FUNCTION private.canonical_solo_ledger_json(p_value jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT SET search_path='' AS $canonical$
DECLARE v text;
BEGIN
  CASE jsonb_typeof(p_value)
    WHEN 'object' THEN
      SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||private.canonical_solo_ledger_json(value),',' ORDER BY key COLLATE "C"),'')||'}'
      INTO v FROM jsonb_each(p_value);
    WHEN 'array' THEN
      SELECT '['||coalesce(string_agg(private.canonical_solo_ledger_json(value),',' ORDER BY ord),'')||']'
      INTO v FROM jsonb_array_elements(p_value) WITH ORDINALITY AS a(value,ord);
    ELSE v:=p_value::text;
  END CASE;
  RETURN v;
END $canonical$;
REVOKE ALL ON FUNCTION private.canonical_solo_ledger_json(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.reconcile_solo_refund_provider_ledger_accepted_atomic(
  p_operation_id uuid,p_evidence jsonb,p_evidence_sha256 text,p_admin_id uuid)
RETURNS SETOF public.booking_solo_refund_operations
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $ledger$
DECLARE
  b public.bookings; o public.booking_solo_refund_operations;
  prior private.solo_refund_provider_ledger_evidence;
  v_booking_id text; v_digest text; v_snapshot jsonb; v_keys text[]; k text;
  v_cancelled timestamptz; v_approved timestamptz; v_captured timestamptz;
  v_from timestamptz; v_to timestamptz; v_acquired date;
  top_keys constant text[]:=ARRAY[
    'acquired_on','acquisition_state','attempt_identity','booking_id','booking_snapshot',
    'cancel_amount','cancellation_count','cancellation_transaction_id','cancelled_at','captured_at',
    'evidence_source','merchant_id','operation_id','operation_order_reference','original_amount',
    'original_approved_at','original_transaction_id','payment_method','provider','provider_export_sha256','provider_verifier_account',
    'query_from','query_scope','query_to','remaining_amount','schema_version','transaction_state','verifying_admin_id'];
  snapshot_keys constant text[]:=ARRAY[
    'amount','host_payout_amount','id','order_id','payment_method','payment_provider',
    'payment_provider_reference','payout_paid_at','payout_status','platform_revenue','price_at_booking',
    'refund_amount','solo_guarantee_price','solo_guarantee_refund_amount','solo_guarantee_refund_error',
    'solo_guarantee_refund_status','solo_guarantee_refund_trigger_booking_id','solo_guarantee_refunded_at',
    'status','tid','total_experience_price','total_price'];
BEGIN
  -- RPC EXECUTE is service-role-only; additionally bind the attestation to an
  -- existing, confirmed, non-deleted Auth admin using the current admin model.
  IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id=p_admin_id AND u.deleted_at IS NULL
      AND u.email_confirmed_at IS NOT NULL AND (
        EXISTS(SELECT 1 FROM public.users a WHERE a.id=u.id AND a.role='admin')
        OR EXISTS(SELECT 1 FROM public.admin_whitelist a WHERE a.email=u.email AND length(btrim(a.email))>0))) THEN
    RAISE EXCEPTION 'SOLO_LEDGER_ADMIN_REQUIRED';
  END IF;
  IF jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' OR octet_length(p_evidence::text)>8192 THEN
    RAISE EXCEPTION 'SOLO_LEDGER_PROOF_INVALID';
  END IF;
  SELECT array_agg(key ORDER BY key COLLATE "C") INTO v_keys FROM jsonb_object_keys(p_evidence) AS x(key);
  IF v_keys IS DISTINCT FROM top_keys OR jsonb_typeof(p_evidence->'booking_snapshot') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'SOLO_LEDGER_PROOF_INVALID';
  END IF;
  SELECT array_agg(key ORDER BY key COLLATE "C") INTO v_keys FROM jsonb_object_keys(p_evidence->'booking_snapshot') AS x(key);
  IF v_keys IS DISTINCT FROM snapshot_keys THEN RAISE EXCEPTION 'SOLO_LEDGER_PROOF_INVALID'; END IF;
  FOREACH k IN ARRAY ARRAY['schema_version','original_amount','cancel_amount','remaining_amount','cancellation_count'] LOOP
    IF jsonb_typeof(p_evidence->k) IS DISTINCT FROM 'number' OR (p_evidence->>k) !~ '^(0|[1-9][0-9]{0,8})$' THEN
      RAISE EXCEPTION 'SOLO_LEDGER_PROOF_INVALID';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['operation_id','attempt_identity','verifying_admin_id'] LOOP
    IF jsonb_typeof(p_evidence->k) IS DISTINCT FROM 'string' OR (p_evidence->>k) !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' THEN
      RAISE EXCEPTION 'SOLO_LEDGER_PROOF_INVALID';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['booking_id','operation_order_reference','merchant_id','original_transaction_id','cancellation_transaction_id','provider_verifier_account'] LOOP
    IF jsonb_typeof(p_evidence->k) IS DISTINCT FROM 'string' OR (p_evidence->>k) !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' THEN
      RAISE EXCEPTION 'SOLO_LEDGER_PROOF_INVALID';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['cancelled_at','original_approved_at','captured_at','query_from','query_to'] LOOP
    IF jsonb_typeof(p_evidence->k) IS DISTINCT FROM 'string' OR (p_evidence->>k) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' THEN
      RAISE EXCEPTION 'SOLO_LEDGER_PROOF_INVALID';
    END IF;
  END LOOP;
  IF p_evidence->>'schema_version' <> '1' OR p_evidence->>'provider' IS DISTINCT FROM 'nicepay'
    OR p_evidence->>'payment_method' IS DISTINCT FROM 'card'
    OR p_evidence->>'evidence_source' IS DISTINCT FROM 'nicepay_merchant_ledger'
    OR jsonb_typeof(p_evidence->'provider_export_sha256') IS DISTINCT FROM 'string'
    OR p_evidence->>'provider_export_sha256' !~ '^[a-f0-9]{64}$'
    OR p_evidence->>'query_scope' IS DISTINCT FROM 'original_order_all_states'
    OR p_evidence->>'transaction_state' IS DISTINCT FROM '후취소'
    OR p_evidence->>'acquisition_state' IS DISTINCT FROM '취소매입'
    OR jsonb_typeof(p_evidence->'acquired_on') IS DISTINCT FROM 'string'
    OR p_evidence->>'acquired_on' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR p_evidence->>'verifying_admin_id' IS DISTINCT FROM p_admin_id::text
    OR p_evidence->>'operation_id' IS DISTINCT FROM p_operation_id::text THEN
    RAISE EXCEPTION 'SOLO_LEDGER_PROOF_INVALID';
  END IF;
  v_digest:=encode(sha256(convert_to(private.canonical_solo_ledger_json(p_evidence),'UTF8')),'hex');
  IF p_evidence_sha256 IS DISTINCT FROM v_digest THEN RAISE EXCEPTION 'SOLO_LEDGER_DIGEST_MISMATCH'; END IF;

  SELECT booking_id INTO v_booking_id FROM public.booking_solo_refund_operations WHERE id=p_operation_id;
  SELECT * INTO b FROM public.bookings WHERE id=v_booking_id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'SOLO_LEDGER_OPERATION_MISMATCH'; END IF;
  PERFORM private.lock_booking_money(b.experience_id);
  SELECT * INTO b FROM public.bookings WHERE id=v_booking_id FOR UPDATE;
  SELECT * INTO o FROM public.booking_solo_refund_operations WHERE id=p_operation_id FOR UPDATE;
  IF o.id IS NULL OR o.provider IS DISTINCT FROM 'nicepay' OR o.payment_method IS DISTINCT FROM 'card'
    OR p_evidence->>'booking_id' IS DISTINCT FROM o.booking_id
    OR p_evidence->>'attempt_identity' IS DISTINCT FROM o.attempt_identity::text
    OR p_evidence->>'operation_order_reference' IS DISTINCT FROM o.order_reference
    OR p_evidence->>'merchant_id' IS DISTINCT FROM o.merchant_reference
    OR p_evidence->>'original_transaction_id' IS DISTINCT FROM o.transaction_reference
    OR p_evidence->>'original_transaction_id' IS DISTINCT FROM b.tid
    OR (p_evidence->>'original_amount')::integer IS DISTINCT FROM o.gross_amount
    OR (p_evidence->>'cancel_amount')::integer IS DISTINCT FROM o.requested_amount
    OR (p_evidence->>'remaining_amount')::integer IS DISTINCT FROM o.gross_amount-o.prior_refund_amount-o.requested_amount
    OR p_evidence->>'cancellation_count' <> '1'
    OR o.prior_refund_amount<>0 OR o.attempt_number<>1 OR o.basis_reserved
    OR (SELECT count(*) FROM public.booking_solo_refund_attempts WHERE operation_id=o.id)<>1
    OR o.request_started_at IS NULL
    OR p_evidence->>'cancellation_transaction_id'=o.transaction_reference
    OR left(p_evidence->>'cancellation_transaction_id',length(o.merchant_reference)) IS DISTINCT FROM o.merchant_reference
    OR o.requested_amount>=o.gross_amount THEN
    RAISE EXCEPTION 'SOLO_LEDGER_OPERATION_MISMATCH';
  END IF;
  v_cancelled:=(p_evidence->>'cancelled_at')::timestamptz;
  v_approved:=(p_evidence->>'original_approved_at')::timestamptz;
  v_captured:=(p_evidence->>'captured_at')::timestamptz;
  v_from:=(p_evidence->>'query_from')::timestamptz; v_to:=(p_evidence->>'query_to')::timestamptz;
  v_acquired:=(p_evidence->>'acquired_on')::date;
  IF v_cancelled<date_trunc('second',o.request_started_at) OR v_cancelled>o.request_started_at+interval '30 seconds'
    OR v_approved>o.request_started_at OR v_captured<v_cancelled OR v_captured>now()+interval '5 minutes'
    OR v_from>v_approved OR v_to<v_cancelled OR v_from>v_to
    OR v_acquired<(v_cancelled AT TIME ZONE 'Asia/Seoul')::date
    OR v_acquired>(v_captured AT TIME ZONE 'Asia/Seoul')::date THEN
    RAISE EXCEPTION 'SOLO_LEDGER_TIME_MISMATCH';
  END IF;

  SELECT * INTO prior FROM private.solo_refund_provider_ledger_evidence WHERE operation_id=o.id;
  IF prior.operation_id IS NOT NULL THEN
    IF prior.evidence_sha256<>v_digest OR prior.evidence_payload IS DISTINCT FROM p_evidence
      OR o.proof_reference IS DISTINCT FROM 'nicepay-ledger:'||v_digest
      OR o.outcome IS DISTINCT FROM 'accepted' OR o.settlement_applied_at IS NULL THEN
      RAISE EXCEPTION 'SOLO_LEDGER_EVIDENCE_CONFLICT';
    END IF;
    RETURN QUERY SELECT * FROM public.booking_solo_refund_operations x WHERE x.id=o.id; RETURN;
  END IF;
  -- Already settled through another authority: return current without adding
  -- ledger proof, changing acceptance, or applying money a second time.
  IF o.outcome='accepted' AND o.settlement_applied_at IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.booking_solo_refund_operations x WHERE x.id=o.id; RETURN;
  END IF;
  SELECT jsonb_object_agg(key,to_jsonb(b)->key) INTO v_snapshot FROM unnest(snapshot_keys) AS x(key);
  IF o.outcome IS DISTINCT FROM 'unknown' OR o.settlement_applied_at IS NOT NULL
    OR b.status IS DISTINCT FROM 'completed' OR b.payout_status IS DISTINCT FROM 'pending' OR b.payout_paid_at IS NOT NULL
    OR b.payment_method IS DISTINCT FROM 'card' OR b.payment_provider IS DISTINCT FROM 'nicepay'
    OR b.solo_guarantee_refund_status IS DISTINCT FROM 'unknown' OR b.solo_guarantee_refund_amount IS DISTINCT FROM 0
    OR b.solo_guarantee_refunded_at IS NOT NULL OR b.solo_guarantee_price IS DISTINCT FROM o.requested_amount
    OR b.amount IS DISTINCT FROM o.gross_amount OR coalesce(b.refund_amount,0)<>o.prior_refund_amount
    OR b.total_price IS DISTINCT FROM o.original_basis OR b.total_experience_price IS DISTINCT FROM o.original_basis::numeric
    OR o.original_basis<o.requested_amount
    OR o.proof_reference IS NOT NULL OR o.provider_refund_reference IS NOT NULL OR o.result_code IS NOT NULL
    OR p_evidence->'booking_snapshot' IS DISTINCT FROM v_snapshot THEN
    RAISE EXCEPTION 'SOLO_LEDGER_SNAPSHOT_CONFLICT';
  END IF;
  INSERT INTO private.solo_refund_provider_ledger_evidence(
    operation_id,evidence_sha256,cancellation_transaction_id,evidence_source,evidence_payload,verified_by)
  VALUES(o.id,v_digest,p_evidence->>'cancellation_transaction_id','nicepay_merchant_ledger',p_evidence,p_admin_id);
  UPDATE public.booking_solo_refund_operations SET outcome='accepted',proof_reference='nicepay-ledger:'||v_digest,
    proof_transaction_reference=o.transaction_reference,verified_by=p_admin_id,updated_at=now() WHERE id=o.id;
  -- Existing formulas, guards and durable delivery eligibility; no notification.
  RETURN QUERY SELECT * FROM public.apply_solo_refund_settlement_atomic(o.id);
END $ledger$;
REVOKE ALL ON FUNCTION public.reconcile_solo_refund_provider_ledger_accepted_atomic(uuid,jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_solo_refund_provider_ledger_accepted_atomic(uuid,jsonb,text,uuid) TO service_role;
COMMIT;
