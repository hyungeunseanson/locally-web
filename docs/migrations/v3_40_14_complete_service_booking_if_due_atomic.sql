-- v3.40.14
-- 서비스 완료 처리 cron/manual force-sync 시
-- service_bookings.status='completed' 와 service_requests.status='completed'
-- 전이를 하나의 트랜잭션 안에서 처리한다.

DROP FUNCTION IF EXISTS public.complete_service_booking_if_due_atomic(TEXT);

CREATE OR REPLACE FUNCTION public.complete_service_booking_if_due_atomic(
  p_booking_id TEXT
)
RETURNS TABLE (
  booking_id TEXT,
  order_id TEXT,
  request_id UUID,
  host_id UUID,
  service_date DATE,
  already_processed BOOLEAN,
  not_due BOOLEAN,
  completed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.service_bookings%ROWTYPE;
  v_request public.service_requests%ROWTYPE;
  v_today_kst DATE := timezone('Asia/Seoul', now())::date;
  v_booking_updated BOOLEAN := FALSE;
  v_request_updated BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_booking
  FROM public.service_bookings AS sb
  WHERE sb.id = trim(p_booking_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_COMPLETE_NOT_FOUND: service booking not found';
  END IF;

  SELECT * INTO v_request
  FROM public.service_requests AS sr
  WHERE sr.id = v_booking.request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_COMPLETE_REQUEST_MISSING: service request not found';
  END IF;

  IF v_request.service_date IS NULL OR v_request.service_date >= v_today_kst THEN
    RETURN QUERY
    SELECT
      v_booking.id,
      COALESCE(v_booking.order_id, v_booking.id),
      v_booking.request_id::UUID,
      v_booking.host_id::UUID,
      v_request.service_date,
      FALSE,
      TRUE,
      FALSE;
    RETURN;
  END IF;

  IF v_booking.status NOT IN ('PAID', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'SVC_COMPLETE_INVALID_BOOKING_STATUS: booking status must be PAID, confirmed, or completed';
  END IF;

  IF v_request.status NOT IN ('matched', 'paid', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'SVC_COMPLETE_INVALID_REQUEST_STATUS: request status must be matched, paid, confirmed, or completed';
  END IF;

  IF v_booking.status IN ('PAID', 'confirmed') THEN
    UPDATE public.service_bookings AS sb
    SET status = 'completed'
    WHERE sb.id = v_booking.id
      AND sb.status IN ('PAID', 'confirmed');

    v_booking_updated := TRUE;
  END IF;

  IF v_request.status IN ('matched', 'paid', 'confirmed') THEN
    UPDATE public.service_requests AS sr
    SET status = 'completed'
    WHERE sr.id = v_request.id
      AND sr.status IN ('matched', 'paid', 'confirmed');

    v_request_updated := TRUE;
  END IF;

  RETURN QUERY
  SELECT
    v_booking.id,
    COALESCE(v_booking.order_id, v_booking.id),
    v_booking.request_id::UUID,
    v_booking.host_id::UUID,
    v_request.service_date,
    NOT (v_booking_updated OR v_request_updated),
    FALSE,
    (v_booking_updated OR v_request_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_service_booking_if_due_atomic(TEXT)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_service_booking_if_due_atomic(TEXT)
FROM anon, authenticated;
