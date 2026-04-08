-- v3.40.10
-- 관리자 서비스 무통장 입금 확인 시
-- service_bookings.status='PAID' 와 service_requests.status='open' 전이를
-- 하나의 트랜잭션 안에서 처리한다.

DROP FUNCTION IF EXISTS public.confirm_service_bank_payment_atomic(TEXT);

CREATE OR REPLACE FUNCTION public.confirm_service_bank_payment_atomic(
  p_order_id TEXT
)
RETURNS TABLE (
  booking_id TEXT,
  order_id TEXT,
  request_id UUID,
  customer_id UUID,
  amount INTEGER,
  request_title TEXT,
  request_city TEXT,
  request_country TEXT,
  request_duration_hours INTEGER,
  request_guest_count INTEGER,
  already_processed BOOLEAN,
  request_was_opened BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.service_bookings%ROWTYPE;
  v_request public.service_requests%ROWTYPE;
  v_request_was_opened BOOLEAN := FALSE;
  v_booking_count INTEGER := 0;
  v_request_count INTEGER := 0;
  v_order_id TEXT := trim(p_order_id);
BEGIN
  SELECT * INTO v_booking
  FROM public.service_bookings
  WHERE order_id = v_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_NOT_FOUND: service booking not found';
  END IF;

  IF COALESCE(lower(v_booking.payment_method), '') <> 'bank' THEN
    RAISE EXCEPTION 'SVC_INVALID_PAYMENT_METHOD: service booking is not bank payment';
  END IF;

  SELECT * INTO v_request
  FROM public.service_requests
  WHERE id = v_booking.request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_REQUEST_MISSING: service request not found';
  END IF;

  IF v_booking.status IN ('PAID', 'confirmed', 'completed') THEN
    RETURN QUERY
    SELECT
      v_booking.id,
      v_booking.order_id,
      v_booking.request_id,
      v_booking.customer_id,
      v_booking.amount,
      v_request.title,
      v_request.city,
      v_request.country,
      v_request.duration_hours,
      v_request.guest_count,
      TRUE,
      v_request.status = 'open';
    RETURN;
  END IF;

  IF v_booking.status <> 'PENDING' THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: booking status must be PENDING';
  END IF;

  IF v_request.status NOT IN ('pending_payment', 'open') THEN
    RAISE EXCEPTION 'SVC_REQUEST_INVALID_STATUS: request status must be pending_payment or open';
  END IF;

  UPDATE public.service_bookings
  SET status = 'PAID'
  WHERE id = v_booking.id
    AND status = 'PENDING'
    AND COALESCE(lower(payment_method), '') = 'bank';

  GET DIAGNOSTICS v_booking_count = ROW_COUNT;
  IF v_booking_count <> 1 THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: booking no longer pending';
  END IF;

  IF v_request.status = 'pending_payment' THEN
    UPDATE public.service_requests
    SET status = 'open'
    WHERE id = v_request.id
      AND status = 'pending_payment';

    GET DIAGNOSTICS v_request_count = ROW_COUNT;
    IF v_request_count <> 1 THEN
      RAISE EXCEPTION 'SVC_REQUEST_INVALID_STATUS: request no longer pending_payment';
    END IF;

    v_request_was_opened := TRUE;
  END IF;

  RETURN QUERY
  SELECT
    v_booking.id,
    v_booking.order_id,
    v_booking.request_id,
    v_booking.customer_id,
    v_booking.amount,
    v_request.title,
    v_request.city,
    v_request.country,
    v_request.duration_hours,
    v_request.guest_count,
    FALSE,
    v_request_was_opened;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_service_bank_payment_atomic(TEXT)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_service_bank_payment_atomic(TEXT)
FROM anon, authenticated;
