-- v3.39.10
-- 서비스 의뢰 호스트 선택을 하나의 DB 함수로 묶는다.
-- request matched, selected/rejected applications, booking host/application binding을 원자적으로 처리한다.

DROP FUNCTION IF EXISTS public.select_service_host_atomic(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.select_service_host_atomic(
  p_customer_id UUID,
  p_request_id UUID,
  p_application_id UUID
)
RETURNS TABLE (
  selected_host_id UUID,
  selected_application_id UUID,
  rejected_host_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.service_requests%ROWTYPE;
  v_application public.service_applications%ROWTYPE;
  v_booking_count INTEGER;
  v_selected_count INTEGER;
  v_request_count INTEGER;
  v_rejected_host_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  SELECT * INTO v_request
  FROM public.service_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_NOT_FOUND: request not found';
  END IF;

  IF v_request.user_id <> p_customer_id THEN
    RAISE EXCEPTION 'SVC_FORBIDDEN: request owner mismatch';
  END IF;

  IF v_request.status <> 'open' THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: request status must be open';
  END IF;

  SELECT * INTO v_application
  FROM public.service_applications
  WHERE id = p_application_id
    AND request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_NOT_FOUND: application not found';
  END IF;

  IF v_application.status <> 'pending' THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: application status must be pending';
  END IF;

  UPDATE public.service_bookings
  SET
    host_id = v_application.host_id,
    application_id = p_application_id
  WHERE request_id = p_request_id
    AND status IN ('PAID', 'PENDING');

  GET DIAGNOSTICS v_booking_count = ROW_COUNT;
  IF v_booking_count = 0 THEN
    RAISE EXCEPTION 'SVC_BOOKING_MISSING: escrow booking not found';
  END IF;

  UPDATE public.service_applications
  SET status = 'selected'
  WHERE id = p_application_id
    AND status = 'pending';

  GET DIAGNOSTICS v_selected_count = ROW_COUNT;
  IF v_selected_count <> 1 THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: application no longer pending';
  END IF;

  WITH rejected AS (
    UPDATE public.service_applications
    SET status = 'rejected'
    WHERE request_id = p_request_id
      AND id <> p_application_id
      AND status = 'pending'
    RETURNING host_id
  )
  SELECT COALESCE(array_agg(host_id), ARRAY[]::UUID[])
  INTO v_rejected_host_ids
  FROM rejected;

  UPDATE public.service_requests
  SET
    status = 'matched',
    selected_application_id = p_application_id,
    selected_host_id = v_application.host_id
  WHERE id = p_request_id
    AND status = 'open';

  GET DIAGNOSTICS v_request_count = ROW_COUNT;
  IF v_request_count <> 1 THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: request no longer open';
  END IF;

  RETURN QUERY
  SELECT
    v_application.host_id,
    p_application_id,
    v_rejected_host_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.select_service_host_atomic(UUID, UUID, UUID)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.select_service_host_atomic(UUID, UUID, UUID)
FROM anon, authenticated;
