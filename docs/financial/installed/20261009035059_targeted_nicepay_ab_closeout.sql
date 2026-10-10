-- REVIEW ONLY. Schema installation does not close bookings or send money.
BEGIN;
CREATE TABLE private.targeted_card_closeouts (
  booking_id text PRIMARY KEY REFERENCES public.bookings(id),
  before_snapshot jsonb NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  actor_reference text NOT NULL,
  evidence jsonb NOT NULL,
  CHECK (booking_id IN ('ORD-20261008232253248-691','ORD-20261008232336792-577'))
);
CREATE TABLE private.targeted_card_recovery (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  booking_id text NOT NULL REFERENCES public.bookings(id),
  tid text NOT NULL UNIQUE,
  amount integer NOT NULL CHECK(amount=46200),
  state text NOT NULL DEFAULT 'review_required'
    CHECK(state IN ('review_required','verified','dispatching','accepted','unknown','refunded')),
  approval_proof jsonb,
  refund_proof jsonb,
  refund_reference text,
  diagnostic_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  owner_reference text,
  case_reference text,
  acknowledged_at timestamptz,
  CHECK(booking_id IN ('ORD-20261008232253248-691','ORD-20261008232336792-577'))
);
CREATE TABLE private.targeted_card_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id text NOT NULL REFERENCES public.bookings(id),
  event text NOT NULL,
  payload jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK(booking_id IN ('ORD-20261008232253248-691','ORD-20261008232336792-577'))
);
ALTER TABLE private.targeted_card_closeouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.targeted_card_recovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.targeted_card_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.targeted_card_closeouts, private.targeted_card_recovery,
  private.targeted_card_events FROM PUBLIC, anon, authenticated, service_role;

-- Unauthenticated notifications have no approval/refund/closeout authority.
CREATE TABLE private.targeted_card_notifications (
  booking_id text NOT NULL REFERENCES public.bookings(id),
  fingerprint text NOT NULL,
  notice_version bigint NOT NULL,
  payload jsonb NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  receipt_count bigint NOT NULL DEFAULT 1,
  PRIMARY KEY(booking_id,fingerprint),
  CHECK(booking_id IN ('ORD-20261008232253248-691','ORD-20261008232336792-577'))
);
ALTER TABLE private.targeted_card_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.targeted_card_notifications FROM PUBLIC,anon,authenticated,service_role;

-- Two fixed budget rows serialize only inbox writes, never financial locks.
-- No automatic deletion or rollover: all accepted envelopes stay auditable.
CREATE TABLE private.targeted_card_notification_budgets (
  booking_id text PRIMARY KEY REFERENCES public.bookings(id),
  distinct_count integer NOT NULL DEFAULT 0 CHECK(distinct_count BETWEEN 0 AND 512),
  notice_version bigint NOT NULL DEFAULT 0,
  reviewed_version bigint NOT NULL DEFAULT 0 CHECK(reviewed_version<=notice_version),
  overflow_at timestamptz,
  last_overflow_at timestamptz,
  overflow_windows bigint NOT NULL DEFAULT 0,
  last_overflow_fingerprint text,
  owner_reference text,
  case_reference text,
  reviewed_at timestamptz,
  CHECK(booking_id IN ('ORD-20261008232253248-691','ORD-20261008232336792-577'))
);
ALTER TABLE private.targeted_card_notification_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.targeted_card_notification_budgets FROM PUBLIC,anon,authenticated,service_role;
-- Budget rows are initialized lazily, because schema application must not
-- depend on target bookings being present in a non-production environment.
CREATE FUNCTION public.record_targeted_card_notification_atomic(p_booking_id text,p_tid text,p_amount integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_payload jsonb; v_fingerprint text; g private.targeted_card_notification_budgets;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'TARGETED_CARD_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_booking_id NOT IN ('ORD-20261008232253248-691','ORD-20261008232336792-577')
    OR coalesce(btrim(p_tid),'')='' OR length(p_tid)>128 OR p_amount IS DISTINCT FROM 46200
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=p_booking_id AND b.order_id=p_booking_id
      AND b.payment_provider='nicepay' AND b.payment_provider_reference=p_booking_id AND b.amount=p_amount) THEN
    RAISE EXCEPTION 'TARGETED_CARD_NOTIFICATION_ANCHOR_CONFLICT'; END IF;
  SELECT jsonb_object_agg(k,left(coalesce(p_payload->>k,''),128)) INTO v_payload
    FROM unnest(ARRAY['Moid','TID','Amt','MID','PayMethod','StateCd','ResultCode','Signature']) k;
  v_payload=v_payload||jsonb_build_object('Moid',p_booking_id,'TID',p_tid,'Amt',p_amount::text,'verified',false);
  v_fingerprint=md5(v_payload::text);
  INSERT INTO private.targeted_card_notification_budgets(booking_id) VALUES(p_booking_id) ON CONFLICT DO NOTHING;
  SELECT * INTO g FROM private.targeted_card_notification_budgets WHERE booking_id=p_booking_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM private.targeted_card_notifications WHERE booking_id=p_booking_id AND fingerprint=v_fingerprint) THEN
    -- Exact retries still ACK even at capacity. Cap write amplification from
    -- a replay flood; receipt_count is a lower bound, never an exact total.
    UPDATE private.targeted_card_notifications SET last_seen_at=now(),receipt_count=least(receipt_count+1,9223372036854775806)
      WHERE booking_id=p_booking_id AND fingerprint=v_fingerprint
        AND (receipt_count<32 OR last_seen_at<now()-interval '1 minute');
    RETURN jsonb_build_object('state','unverified_notification','financial_authority',false,'stored',true);
  END IF;
  IF g.distinct_count>=512 THEN
    -- One bounded summary, at most one write/minute. Do NOT return PG OK for
    -- an envelope that was not stored; delivery/retry configuration is a gate.
    IF g.last_overflow_at IS NULL OR g.last_overflow_at<now()-interval '1 minute' THEN
      UPDATE private.targeted_card_notification_budgets SET overflow_at=coalesce(overflow_at,now()),
        last_overflow_at=now(),overflow_windows=least(overflow_windows+1,9223372036854775806),
        last_overflow_fingerprint=v_fingerprint,notice_version=notice_version+CASE WHEN overflow_at IS NULL THEN 1 ELSE 0 END
        WHERE booking_id=p_booking_id;
    END IF;
    RETURN jsonb_build_object('state','inbox_capacity_exhausted','financial_authority',false,'stored',false);
  END IF;
  UPDATE private.targeted_card_notification_budgets SET distinct_count=distinct_count+1,notice_version=notice_version+1
    WHERE booking_id=p_booking_id RETURNING * INTO g;
  INSERT INTO private.targeted_card_notifications(booking_id,fingerprint,notice_version,payload)
    VALUES(p_booking_id,v_fingerprint,g.notice_version,v_payload);
  RETURN jsonb_build_object('state','unverified_notification','financial_authority',false,'stored',true);
END $$;

-- Explicit operational review of an exact watermark. Reading an alert alone
-- changes nothing. This cannot acknowledge/resolve ANY financial operation.
CREATE FUNCTION public.review_targeted_card_notifications_atomic(p_booking_id text,p_through_version bigint,p_owner_reference text,p_case_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g private.targeted_card_notification_budgets;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'TARGETED_CARD_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF coalesce(btrim(p_owner_reference),'')='' OR length(p_owner_reference)>128
    OR coalesce(btrim(p_case_reference),'')='' OR length(p_case_reference)>128 THEN RAISE EXCEPTION 'TARGETED_CARD_OWNER_REQUIRED'; END IF;
  SELECT * INTO g FROM private.targeted_card_notification_budgets WHERE booking_id=p_booking_id FOR UPDATE;
  IF g.booking_id IS NULL OR p_through_version IS NULL OR p_through_version<g.reviewed_version
    OR p_through_version>g.notice_version THEN RAISE EXCEPTION 'TARGETED_CARD_NOTIFICATION_VERSION_CONFLICT'; END IF;
  UPDATE private.targeted_card_notification_budgets SET reviewed_version=p_through_version,
    owner_reference=p_owner_reference,case_reference=p_case_reference,reviewed_at=now() WHERE booking_id=p_booking_id;
  RETURN jsonb_build_object('reviewed_version',p_through_version,'financial_authority',false,'overflow_resolved',false);
END $$;
REVOKE ALL ON FUNCTION public.review_targeted_card_notifications_atomic(text,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_targeted_card_notifications_atomic(text,bigint,text,text) TO service_role;

-- Only a new incident or a state transition advances the alert version.
-- Duplicate receipts and acknowledgements never count as a new financial event.
CREATE FUNCTION private.journal_targeted_card_state() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF TG_OP='INSERT' OR NEW.state IS DISTINCT FROM OLD.state THEN
    INSERT INTO private.targeted_card_events(booking_id,event,payload) VALUES(NEW.booking_id,'recovery_state_changed',
      jsonb_build_object('operation_id',NEW.id,'state',NEW.state));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER targeted_card_recovery_state_journal AFTER INSERT OR UPDATE ON private.targeted_card_recovery
  FOR EACH ROW EXECUTE FUNCTION private.journal_targeted_card_state();
REVOKE ALL ON FUNCTION private.journal_targeted_card_state() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.get_targeted_card_ops_snapshot()
RETURNS TABLE(diagnostic_code text,anomaly_count bigint,oldest_observed_at timestamptz,aggregate_details jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'TARGETED_CARD_FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT CASE WHEN a.booking_id='ORD-20261008232253248-691' THEN 'targeted_card_recovery_a' ELSE 'targeted_card_recovery_b' END,
    count(*)::bigint,min(a.created_at),jsonb_build_object(
      'review_required',count(*) FILTER(WHERE a.state='review_required'),
      'verified',count(*) FILTER(WHERE a.state='verified'),
      'dispatching',count(*) FILTER(WHERE a.state='dispatching'),
      'unknown',count(*) FILTER(WHERE a.state='unknown'),
      'accepted',count(*) FILTER(WHERE a.state='accepted'),
      'unassigned',count(*) FILTER(WHERE a.owner_reference IS NULL),
      'incident_version',coalesce((SELECT max(e.id) FROM private.targeted_card_events e
        WHERE e.booking_id=a.booking_id AND e.event='recovery_state_changed'),0))
  FROM private.targeted_card_recovery a WHERE a.state<>'refunded' GROUP BY a.booking_id;
  RETURN QUERY SELECT CASE WHEN g.booking_id='ORD-20261008232253248-691' THEN 'targeted_card_notification_a' ELSE 'targeted_card_notification_b' END,
    count(n.fingerprint)::bigint+CASE WHEN g.overflow_at IS NULL THEN 0 ELSE 1 END,
    least(min(n.first_seen_at),g.overflow_at),jsonb_build_object('unreviewed',count(n.fingerprint),
      'stored',g.distinct_count,'capacity',512,'capacity_exhausted',CASE WHEN g.overflow_at IS NULL THEN 0 ELSE 1 END,
      'notice_version',g.notice_version,'reviewed_version',g.reviewed_version)
  FROM private.targeted_card_notification_budgets g LEFT JOIN private.targeted_card_notifications n
    ON n.booking_id=g.booking_id AND n.notice_version>g.reviewed_version
  GROUP BY g.booking_id HAVING count(n.fingerprint)>0 OR g.overflow_at IS NOT NULL;
END $$;

-- Secure operator review only. No public dashboard route or financial dispatch.
CREATE FUNCTION public.get_targeted_card_recovery_review()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'TARGETED_CARD_FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'operations',coalesce((SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('resolved',a.state='refunded') ORDER BY a.created_at,a.id)
      FROM private.targeted_card_recovery a),'[]'::jsonb),
    'unverified_notifications',coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.first_seen_at,n.fingerprint)
      FROM private.targeted_card_notifications n),'[]'::jsonb),
    'notification_budgets',coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM private.targeted_card_notification_budgets g),'[]'::jsonb),
    'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM private.targeted_card_events e),'[]'::jsonb));
END $$;

CREATE FUNCTION public.acknowledge_targeted_card_recovery_atomic(p_operation_id uuid,p_owner_reference text,p_case_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a private.targeted_card_recovery;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'TARGETED_CARD_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF coalesce(btrim(p_owner_reference),'')='' OR length(p_owner_reference)>128
    OR coalesce(btrim(p_case_reference),'')='' OR length(p_case_reference)>128 THEN RAISE EXCEPTION 'TARGETED_CARD_OWNER_REQUIRED'; END IF;
  SELECT * INTO a FROM private.targeted_card_recovery WHERE id=p_operation_id;
  PERFORM id FROM public.bookings WHERE id=a.booking_id FOR UPDATE;
  SELECT * INTO a FROM private.targeted_card_recovery WHERE id=p_operation_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'TARGETED_CARD_OPERATION_MISSING'; END IF;
  UPDATE private.targeted_card_recovery SET owner_reference=p_owner_reference,case_reference=p_case_reference,
    acknowledged_at=now() WHERE id=a.id RETURNING * INTO a;
  INSERT INTO private.targeted_card_events(booking_id,event,payload) VALUES(a.booking_id,'operator_acknowledged',
    jsonb_build_object('operation_id',a.id,'owner_reference',p_owner_reference,'case_reference',p_case_reference));
  -- Reading/acknowledging does not resolve the event or suppress recurring alerts.
  RETURN jsonb_build_object('id',a.id,'state',a.state,'resolved',a.state='refunded');
END $$;

REVOKE ALL ON FUNCTION public.record_targeted_card_notification_atomic(text,text,integer,jsonb),
  public.get_targeted_card_ops_snapshot(),public.get_targeted_card_recovery_review(),
  public.acknowledge_targeted_card_recovery_atomic(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_targeted_card_notification_atomic(text,text,integer,jsonb),
  public.get_targeted_card_ops_snapshot(),public.get_targeted_card_recovery_review(),
  public.acknowledge_targeted_card_recovery_atomic(uuid,text,text) TO service_role;

CREATE FUNCTION private.record_targeted_card_approval(p_booking_id text,p_tid text,p_amount integer,p_proof jsonb DEFAULT NULL,p_kind text DEFAULT 'approval')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; a private.targeted_card_recovery; v_proof jsonb;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF p_booking_id NOT IN ('ORD-20261008232253248-691','ORD-20261008232336792-577')
    OR b.id IS NULL OR b.payment_method IS DISTINCT FROM 'card'
    OR b.payment_provider IS DISTINCT FROM 'nicepay'
    OR b.payment_provider_reference IS DISTINCT FROM p_booking_id
    OR p_amount IS DISTINCT FROM b.amount OR p_amount IS DISTINCT FROM 46200
    OR p_tid IS NULL OR btrim(p_tid)='' THEN RAISE EXCEPTION 'TARGETED_CARD_ANCHOR_CONFLICT'; END IF;
  -- Never cancel a TID belonging to C, another booking, service or proxy.
  IF EXISTS(SELECT 1 FROM public.bookings x WHERE x.tid=p_tid AND x.id<>b.id)
    OR EXISTS(SELECT 1 FROM public.service_bookings x WHERE x.tid=p_tid)
    OR EXISTS(SELECT 1 FROM public.proxy_requests x WHERE x.tid=p_tid) THEN
    RAISE EXCEPTION 'TARGETED_CARD_TID_CONFLICT'; END IF;
  IF p_kind='cancellation_notification' THEN
    -- Cancellation notifications may have a different TID. Preserve their
    -- untrusted evidence without creating another approval/refund authority.
    INSERT INTO private.targeted_card_events(booking_id,event,payload) VALUES(b.id,'cancellation_notification_observed',
      jsonb_build_object('tid',p_tid,'amount',p_amount,'trusted',false));
    RETURN jsonb_build_object('state','review_required');
  END IF;
  IF p_kind IS DISTINCT FROM 'approval' THEN RAISE EXCEPTION 'TARGETED_CARD_EVENT_KIND_CONFLICT'; END IF;
  IF p_proof IS NOT NULL THEN
    IF p_proof->>'ResultCode' IS DISTINCT FROM '3001'
      OR p_proof->>'Moid' IS DISTINCT FROM b.id OR p_proof->>'TID' IS DISTINCT FROM p_tid
      OR p_proof->>'PayMethod' IS DISTINCT FROM 'CARD'
      OR coalesce(p_proof->>'Amt','') !~ '^[0-9]+$'
      OR (p_proof->>'Amt')::numeric<>p_amount
      OR coalesce(p_proof->>'MID','')='' OR coalesce(p_proof->>'Signature','')='' THEN
      RAISE EXCEPTION 'TARGETED_CARD_APPROVAL_PROOF_CONFLICT'; END IF;
    -- Server verifies the provider signature before this service-only call.
    v_proof=jsonb_build_object('ResultCode',p_proof->>'ResultCode','Moid',b.id,
      'TID',p_tid,'MID',p_proof->>'MID','Amt',p_proof->>'Amt',
      'PayMethod','CARD','Signature',p_proof->>'Signature','AuthDate',p_proof->>'AuthDate');
  END IF;
  INSERT INTO private.targeted_card_recovery(booking_id,tid,amount,approval_proof,state)
    VALUES(b.id,p_tid,p_amount,v_proof,CASE WHEN v_proof IS NULL THEN 'review_required' ELSE 'verified' END)
    ON CONFLICT(tid) DO NOTHING;
  SELECT * INTO a FROM private.targeted_card_recovery WHERE tid=p_tid FOR UPDATE;
  IF a.booking_id<>b.id OR a.amount<>p_amount THEN RAISE EXCEPTION 'TARGETED_CARD_TID_CONFLICT'; END IF;
  IF v_proof IS NOT NULL AND a.state='review_required' THEN
    UPDATE private.targeted_card_recovery SET approval_proof=v_proof,state='verified' WHERE id=a.id RETURNING * INTO a;
  END IF;
  INSERT INTO private.targeted_card_events(booking_id,event,payload) VALUES(b.id,'approval_observed',
    jsonb_build_object('operation_id',a.id,'tid',p_tid,'state',a.state,'signed_proof',v_proof IS NOT NULL));
  RETURN to_jsonb(a);
END $$;

CREATE FUNCTION public.record_targeted_card_approval_atomic(p_booking_id text,p_tid text,p_amount integer,p_proof jsonb DEFAULT NULL,p_kind text DEFAULT 'approval')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'TARGETED_CARD_FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN private.record_targeted_card_approval(p_booking_id,p_tid,p_amount,p_proof,p_kind);
END $$;

CREATE FUNCTION public.close_targeted_card_attempts_atomic(p_actor_reference text,p_c_fingerprint text,p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; c public.bookings; v_count integer:=0;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'TARGETED_CARD_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF coalesce(btrim(p_actor_reference),'')='' OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object'
    OR coalesce(p_evidence->>'decision','')<>'operational_incomplete'
    OR coalesce(p_evidence->>'runtime_mid_matches_admin','')<>'true'
    OR coalesce(p_evidence->>'approval_fence_deployed','')<>'true'
    OR coalesce(p_evidence->>'old_workers_drained','')<>'true'
    OR coalesce(p_evidence->>'alternate_worker_paths_blocked','')<>'true'
    OR coalesce(p_evidence->>'financial_visibility_verified','')<>'true'
    OR coalesce(p_evidence->>'legacy_rpc_409_commit_verified','')<>'true'
    OR coalesce(btrim(p_evidence->>'deployment_reference'),'') IN ('','REPLACE_WITH_VERIFIED_PRODUCTION_VERSION') THEN
    RAISE EXCEPTION 'TARGETED_CARD_EVIDENCE_REQUIRED'; END IF;
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

CREATE FUNCTION public.begin_targeted_card_refund_atomic(p_operation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a private.targeted_card_recovery; b public.bookings;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'TARGETED_CARD_FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT x.* INTO a FROM private.targeted_card_recovery x WHERE x.id=p_operation_id;
  SELECT * INTO b FROM public.bookings WHERE id=a.booking_id FOR UPDATE;
  SELECT x.* INTO a FROM private.targeted_card_recovery x WHERE x.id=p_operation_id FOR UPDATE;
  IF a.id IS NULL OR a.state<>'verified' THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM private.targeted_card_closeouts x WHERE x.booking_id=b.id)
    OR b.status IS DISTINCT FROM 'cancelled' OR b.payment_claim_state IS DISTINCT FROM 'released'
    OR b.tid IS NOT NULL OR b.refund_amount IS DISTINCT FROM 0 OR b.host_payout_amount IS DISTINCT FROM 0 OR b.platform_revenue IS DISTINCT FROM 0
    OR b.payout_status IS DISTINCT FROM 'pending' OR b.payout_paid_at IS NOT NULL OR b.cancellation_claim_id IS NOT NULL
    OR EXISTS(SELECT 1 FROM private.targeted_card_recovery x WHERE x.booking_id=b.id AND x.id<>a.id)
    OR EXISTS(SELECT 1 FROM public.bookings x WHERE x.id<>b.id AND x.tid=a.tid)
    OR EXISTS(SELECT 1 FROM public.service_bookings x WHERE x.tid=a.tid)
    OR EXISTS(SELECT 1 FROM public.proxy_requests x WHERE x.tid=a.tid) THEN
    RAISE EXCEPTION 'TARGETED_CARD_REFUND_CONFLICT'; END IF;
  UPDATE private.targeted_card_recovery SET state='dispatching',dispatched_at=now() WHERE id=a.id;
  INSERT INTO private.targeted_card_events(booking_id,event,payload)
    VALUES(b.id,'refund_dispatching',jsonb_build_object('operation_id',a.id,'tid',a.tid,'amount',a.amount));
  RETURN true;
END $$;

CREATE FUNCTION public.record_targeted_card_refund_result_atomic(p_operation_id uuid,p_outcome text,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a private.targeted_card_recovery; v_proof jsonb;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'TARGETED_CARD_FORBIDDEN' USING ERRCODE='42501'; END IF;
  -- Match begin/finalize/approval lock order. Inserting an event also checks
  -- its booking FK; operation-first would deadlock with a booking-first caller.
  SELECT * INTO a FROM private.targeted_card_recovery WHERE id=p_operation_id;
  PERFORM id FROM public.bookings WHERE id=a.booking_id FOR UPDATE;
  SELECT * INTO a FROM private.targeted_card_recovery WHERE id=p_operation_id FOR UPDATE;
  IF a.id IS NULL OR p_outcome NOT IN ('accepted','unknown') THEN RAISE EXCEPTION 'TARGETED_CARD_REFUND_RESULT_CONFLICT'; END IF;
  IF a.state IN ('accepted','refunded') THEN RETURN to_jsonb(a); END IF;
  IF a.state NOT IN ('dispatching','unknown') THEN RAISE EXCEPTION 'TARGETED_CARD_REFUND_RESULT_CONFLICT'; END IF;
  IF p_outcome='accepted' AND (
    coalesce(p_proof->>'ResultCode','') NOT IN ('2001','2211')
    OR p_proof->>'TID' IS DISTINCT FROM a.tid OR p_proof->>'Moid' IS DISTINCT FROM a.booking_id
    OR coalesce(p_proof->>'CancelAmt','') !~ '^[0-9]+$'
    OR (p_proof->>'CancelAmt')::numeric<>a.amount OR coalesce(p_proof->>'CancelNum','')=''
    OR p_proof->>'MID' IS DISTINCT FROM a.approval_proof->>'MID'
    OR coalesce(p_proof->>'Signature','')='') THEN RAISE EXCEPTION 'TARGETED_CARD_REFUND_PROOF_CONFLICT'; END IF;
  v_proof=CASE WHEN p_outcome='accepted' THEN jsonb_build_object(
    'ResultCode',p_proof->>'ResultCode','TID',p_proof->>'TID','Moid',p_proof->>'Moid',
    'MID',p_proof->>'MID','CancelAmt',p_proof->>'CancelAmt',
    'CancelNum',p_proof->>'CancelNum','Signature',p_proof->>'Signature')
    ELSE jsonb_build_object('diagnosticCode','provider_outcome_uncertain') END;
  UPDATE private.targeted_card_recovery SET state=p_outcome,refund_proof=v_proof,
    refund_reference=CASE WHEN p_outcome='accepted' THEN p_proof->>'CancelNum' ELSE NULL END,
    diagnostic_code=CASE WHEN p_outcome='unknown' THEN 'provider_outcome_uncertain' ELSE NULL END
    WHERE id=a.id RETURNING * INTO a;
  INSERT INTO private.targeted_card_events(booking_id,event,payload)
    VALUES(a.booking_id,'refund_'||p_outcome,jsonb_build_object('operation_id',a.id,'proof',v_proof));
  RETURN to_jsonb(a);
END $$;

CREATE FUNCTION public.finalize_targeted_card_refund_atomic(p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a private.targeted_card_recovery; b public.bookings;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'TARGETED_CARD_FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM private.targeted_card_recovery WHERE id=p_operation_id;
  SELECT * INTO b FROM public.bookings WHERE id=a.booking_id FOR UPDATE;
  SELECT * INTO a FROM private.targeted_card_recovery WHERE id=p_operation_id FOR UPDATE;
  IF a.state='refunded' THEN RETURN to_jsonb(a); END IF;
  IF a.id IS NULL OR a.state IS DISTINCT FROM 'accepted'
    OR b.status IS DISTINCT FROM 'cancelled' OR b.payment_claim_state IS DISTINCT FROM 'released'
    OR (b.tid IS NOT NULL AND b.tid<>a.tid) OR b.refund_amount IS DISTINCT FROM 0
    OR b.host_payout_amount IS DISTINCT FROM 0 OR b.platform_revenue IS DISTINCT FROM 0 OR b.payout_status IS DISTINCT FROM 'pending'
    OR b.payout_paid_at IS NOT NULL OR b.cancellation_claim_id IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.booking_solo_refund_operations x WHERE x.booking_id=b.id)
    OR EXISTS(SELECT 1 FROM public.bookings x WHERE x.id<>b.id AND x.tid=a.tid)
    OR EXISTS(SELECT 1 FROM public.service_bookings x WHERE x.tid=a.tid)
    OR EXISTS(SELECT 1 FROM public.proxy_requests x WHERE x.tid=a.tid) THEN
    RAISE EXCEPTION 'TARGETED_CARD_REFUND_FINALIZE_CONFLICT'; END IF;
  UPDATE public.bookings SET tid=a.tid,refund_amount=a.amount,
    cancel_reason='운영 미완료 결제 시도 종료 후 승인취소 완료' WHERE id=b.id;
  UPDATE private.targeted_card_recovery SET state='refunded' WHERE id=a.id RETURNING * INTO a;
  INSERT INTO private.targeted_card_events(booking_id,event,payload)
    VALUES(b.id,'refund_applied',jsonb_build_object('operation_id',a.id,'tid',a.tid,'amount',a.amount));
  RETURN to_jsonb(a);
END $$;

REVOKE ALL ON FUNCTION private.record_targeted_card_approval(text,text,integer,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.record_targeted_card_approval_atomic(text,text,integer,jsonb,text),
 public.close_targeted_card_attempts_atomic(text,text,jsonb),public.begin_targeted_card_refund_atomic(uuid),
 public.record_targeted_card_refund_result_atomic(uuid,text,jsonb),public.finalize_targeted_card_refund_atomic(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_targeted_card_approval_atomic(text,text,integer,jsonb,text),
 public.close_targeted_card_attempts_atomic(text,text,jsonb),public.begin_targeted_card_refund_atomic(uuid),
 public.record_targeted_card_refund_result_atomic(uuid,text,jsonb),public.finalize_targeted_card_refund_atomic(uuid)
 TO service_role;

DO $drift$ BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.confirm_experience_payment_atomic(text,text,text,text,integer)'::regprocedure) IS DISTINCT FROM '7059cf6402cd302147da76031b265561' THEN
    RAISE EXCEPTION 'TARGETED_CARD_CONFIRM_AUTHORITY_DRIFT'; END IF;
END $drift$;

CREATE OR REPLACE FUNCTION public.confirm_experience_payment_atomic(p_booking_id text, p_provider text, p_provider_reference text, p_provider_transaction_id text, p_verified_amount integer)
 RETURNS TABLE(outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

  -- Capture a legacy in-flight approval after this pair has been closed.
  -- One result row avoids PostgREST's singular-response rollback. Override
  -- HTTP status without raising, so evidence commits but unchanged legacy
  -- Supabase callers receive an error and never announce a confirmed booking.
  IF EXISTS (SELECT 1 FROM private.targeted_card_closeouts c WHERE c.booking_id=v_booking.id) THEN
    IF v_provider IS DISTINCT FROM 'nicepay' OR v_reference IS DISTINCT FROM v_booking.id THEN
      RAISE EXCEPTION 'TARGETED_CARD_ANCHOR_CONFLICT'; END IF;
    PERFORM private.record_targeted_card_approval(v_booking.id,v_tid,p_verified_amount,NULL);
    PERFORM pg_catalog.set_config('response.status','409',true);
    RETURN QUERY SELECT 'targeted_closeout_review_required'::text;
    RETURN;
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
$function$
;
NOTIFY pgrst, 'reload schema';
COMMIT;
