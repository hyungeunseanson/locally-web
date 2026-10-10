-- UNAPPROVED LOCAL DESIGN PROTOTYPE. Not included in the 20-file Worker candidate.
-- Existing S function, schema and ledger stay unchanged. No automatic refund or seat restore.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='15s';
DO $review$ BEGIN RAISE EXCEPTION 'REVIEW_ONLY_NO_PRODUCTION_AUTHORIZATION'; END $review$;
CREATE FUNCTION public.close_targeted_card_attempts_risk_acceptance_v2_atomic(p_actor_reference text,p_c_fingerprint text,p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; c public.bookings; v_count integer:=0;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'TARGETED_CARD_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF coalesce(btrim(p_actor_reference),'')='' OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object'
    OR coalesce(p_evidence->>'decision','')<>'operational_incomplete_with_residual_risk'
    OR coalesce(p_evidence->>'runtime_mid_matches_admin','')<>'true'
    OR coalesce(p_evidence->>'approval_fence_deployed','')<>'true'
    OR coalesce(p_evidence->>'old_workers_drained','')<>'false'
    OR coalesce(p_evidence->>'alternate_worker_paths_blocked','')<>'true'
    OR coalesce(p_evidence->>'financial_visibility_verified','')<>'true'
    OR coalesce(p_evidence->>'legacy_rpc_409_commit_verified','')<>'true'
    OR coalesce(p_evidence->>'latest_pg_records_no_approval','')<>'true'
    OR coalesce(p_evidence->>'residual_legacy_risk_accepted','')<>'true'
    OR coalesce(p_evidence->>'closeout_basis','')<>'operational_risk_acceptance_incomplete_drain'
    OR coalesce(p_evidence->>'deployment_reference','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR coalesce(btrim(p_evidence->>'pg_snapshot_reference'),'') IN ('','REPLACE')
    OR coalesce(btrim(p_evidence->>'risk_acceptance_reference'),'') IN ('','REPLACE')
    OR coalesce(btrim(p_evidence->>'incident_oncall_reference'),'') IN ('','REPLACE')
    OR coalesce(p_evidence->>'pg_checked_at','')='' THEN
    RAISE EXCEPTION 'TARGETED_CARD_ALTERNATIVE_EVIDENCE_REQUIRED'; END IF;
  IF (p_evidence->>'pg_checked_at')::timestamptz < clock_timestamp()-interval '15 minutes'
    OR (p_evidence->>'pg_checked_at')::timestamptz > clock_timestamp()+interval '1 minute' THEN
    RAISE EXCEPTION 'TARGETED_CARD_ALTERNATIVE_PG_SNAPSHOT_EXPIRED'; END IF;
  -- Same booking-row -> slot lock order as confirm_experience_payment_atomic.
  PERFORM id FROM public.bookings WHERE id IN
    ('ORD-20261008232253248-691','ORD-20261008232336792-577') ORDER BY id FOR UPDATE;
  SELECT * INTO c FROM public.bookings WHERE id='ORD-20261009014356883-813' FOR SHARE;
  IF c.id IS NULL OR md5(to_jsonb(c)::text) IS DISTINCT FROM p_c_fingerprint
    OR c.status IS DISTINCT FROM 'PAID' OR c.payment_claim_state IS DISTINCT FROM 'completed'
    OR c.tid IS NULL OR c.amount IS DISTINCT FROM 46200 OR c.guests IS DISTINCT FROM 1 OR c.refund_amount IS DISTINCT FROM 0
    OR c.host_payout_amount IS DISTINCT FROM 33600 OR c.platform_revenue IS DISTINCT FROM 12600
    OR c.experience_id IS DISTINCT FROM 4659 OR c.date IS DISTINCT FROM '2026-10-15' OR c.time IS DISTINCT FROM '12:00' THEN
    RAISE EXCEPTION 'TARGETED_CARD_PROTECTED_C_CONFLICT'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('4659|2026-10-15|12:00')::bigint);
  IF (SELECT count(*) FROM private.targeted_card_closeouts)=2 THEN
    IF EXISTS(SELECT 1 FROM public.bookings x WHERE x.id IN
      ('ORD-20261008232253248-691','ORD-20261008232336792-577') AND
      (x.status IS DISTINCT FROM 'cancelled' OR x.payment_claim_state IS DISTINCT FROM 'released')) THEN
      RAISE EXCEPTION 'TARGETED_CARD_CLOSED_STATE_DRIFT'; END IF;
    RETURN jsonb_build_object('closed_count',0,'already_closed',true); END IF;
  IF EXISTS(SELECT 1 FROM private.targeted_card_closeouts) THEN RAISE EXCEPTION 'TARGETED_CARD_PARTIAL_CLOSE_CONFLICT'; END IF;
  IF (SELECT count(*) FROM public.bookings WHERE id IN
    ('ORD-20261008232253248-691','ORD-20261008232336792-577'))<>2 THEN
    RAISE EXCEPTION 'TARGETED_CARD_PAIR_MISSING'; END IF;
  FOR b IN SELECT * FROM public.bookings WHERE id IN
    ('ORD-20261008232253248-691','ORD-20261008232336792-577') ORDER BY id LOOP
    IF b.status IS DISTINCT FROM 'PENDING' OR b.payment_claim_state IS DISTINCT FROM 'reconciliation_required'
      OR b.payment_claim_expires_at IS NOT NULL OR b.payment_claim_token IS NOT NULL
      OR b.payment_provider IS DISTINCT FROM 'nicepay' OR b.payment_method IS DISTINCT FROM 'card'
      OR b.order_id IS DISTINCT FROM b.id OR b.payment_provider_reference IS DISTINCT FROM b.id
      OR b.tid IS NOT NULL OR b.amount IS DISTINCT FROM 46200 OR b.guests IS DISTINCT FROM 1 OR b.refund_amount IS DISTINCT FROM 0
      OR b.host_payout_amount IS DISTINCT FROM 0 OR b.platform_revenue IS DISTINCT FROM 0 OR b.payout_status IS DISTINCT FROM 'pending'
      OR b.payout_paid_at IS NOT NULL OR b.cancellation_claim_id IS NOT NULL
      OR b.user_id IS DISTINCT FROM c.user_id OR b.experience_id IS DISTINCT FROM c.experience_id
      OR b.date IS DISTINCT FROM c.date OR b.time IS DISTINCT FROM c.time
      OR coalesce(b.is_solo_guarantee,false) OR coalesce(b.solo_guarantee_price,0)<>0
      OR EXISTS(SELECT 1 FROM public.booking_solo_refund_operations x WHERE x.booking_id=b.id)
      OR EXISTS(SELECT 1 FROM private.targeted_card_recovery x WHERE x.booking_id=b.id) THEN
      RAISE EXCEPTION 'TARGETED_CARD_SNAPSHOT_CONFLICT'; END IF;
    INSERT INTO private.targeted_card_closeouts(booking_id,before_snapshot,actor_reference,evidence)
      VALUES(b.id,to_jsonb(b),p_actor_reference,p_evidence);
    UPDATE public.bookings SET status='cancelled',payment_claim_state='released',
      payment_claim_expires_at=NULL,payment_claim_token=NULL,
      cancel_reason='운영 미완료 결제 시도 종료 (2026-10-09 A/B 좌석 정리)' WHERE id=b.id;
    INSERT INTO private.targeted_card_events(booking_id,event,payload)
      VALUES(b.id,'hold_closed',jsonb_build_object('actor_reference',p_actor_reference,'evidence',p_evidence));
    v_count=v_count+1;
  END LOOP;
  IF md5((SELECT to_jsonb(x)::text FROM public.bookings x WHERE id=c.id))<>p_c_fingerprint THEN
    RAISE EXCEPTION 'TARGETED_CARD_PROTECTED_C_CONFLICT'; END IF;
  RETURN jsonb_build_object('closed_count',v_count,'already_closed',false);
END $$;

REVOKE ALL ON FUNCTION public.close_targeted_card_attempts_risk_acceptance_v2_atomic(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.close_targeted_card_attempts_risk_acceptance_v2_atomic(text,text,jsonb) TO service_role;

ROLLBACK;
