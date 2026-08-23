-- v3.40.39
-- Atomic, service-role-only manual final payout for sub-threshold experience balances.

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_manual_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key uuid NOT NULL UNIQUE,
  host_id uuid NOT NULL,
  settlement_type text NOT NULL CHECK (settlement_type IN ('host_exit_final', 'legacy_carryover')),
  booking_ids text[] NOT NULL CHECK (cardinality(booking_ids) > 0),
  booking_snapshot jsonb NOT NULL CHECK (jsonb_typeof(booking_snapshot) = 'array'),
  current_booking_amount integer NOT NULL CHECK (current_booking_amount > 0),
  legacy_amount integer NOT NULL DEFAULT 0 CHECK (legacy_amount >= 0),
  total_paid_amount integer NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  legacy_source_reference text,
  transfer_reference text NOT NULL CHECK (length(btrim(transfer_reference)) BETWEEN 1 AND 500),
  bank_name text NOT NULL CHECK (length(btrim(bank_name)) > 0),
  account_number text NOT NULL CHECK (length(btrim(account_number)) > 0),
  account_holder text NOT NULL CHECK (length(btrim(account_holder)) > 0),
  paid_by_admin_id uuid NOT NULL,
  paid_by_admin_email text NOT NULL CHECK (length(btrim(paid_by_admin_email)) > 0),
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_manual_payouts_total_check
    CHECK (total_paid_amount = current_booking_amount + legacy_amount),
  CONSTRAINT admin_manual_payouts_type_check
    CHECK (
      (settlement_type = 'host_exit_final' AND legacy_amount = 0 AND legacy_source_reference IS NULL)
      OR
      (settlement_type = 'legacy_carryover' AND legacy_amount > 0 AND length(btrim(legacy_source_reference)) BETWEEN 1 AND 500)
    )
);

CREATE INDEX IF NOT EXISTS idx_admin_manual_payouts_host_paid_at
  ON public.admin_manual_payouts(host_id, paid_at DESC);

ALTER TABLE public.admin_manual_payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_manual_payouts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_manual_payouts TO service_role;

CREATE OR REPLACE FUNCTION public.complete_admin_manual_experience_payout_atomic(
  p_request_key uuid,
  p_host_id uuid,
  p_settlement_type text,
  p_expected_current_booking_amount integer,
  p_legacy_amount integer,
  p_reason text,
  p_legacy_source_reference text,
  p_transfer_reference text,
  p_paid_by_admin_id uuid,
  p_paid_by_admin_email text
)
RETURNS TABLE (
  manual_payout_id uuid,
  request_key uuid,
  host_id uuid,
  booking_count integer,
  current_booking_amount integer,
  legacy_amount integer,
  total_paid_amount integer,
  paid_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        OR b.host_payout_amount <= 0
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
$$;

REVOKE ALL ON FUNCTION public.complete_admin_manual_experience_payout_atomic(
  uuid, uuid, text, integer, integer, text, text, text, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_admin_manual_experience_payout_atomic(
  uuid, uuid, text, integer, integer, text, text, text, uuid, text
) TO service_role;

COMMIT;
