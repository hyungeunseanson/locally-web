-- v3.39.09
-- service_requests + pending service_bookings 사전 생성을 하나의 DB 함수로 묶는다.
-- v2 에스크로 구조(host_id/application_id nullable, status='pending_payment') 기준.

DROP FUNCTION IF EXISTS public.create_service_request_with_booking_atomic(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DATE,
  TEXT,
  INTEGER,
  TEXT[],
  INTEGER,
  TEXT,
  TEXT
);

CREATE OR REPLACE FUNCTION public.create_service_request_with_booking_atomic(
  p_user_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_city TEXT,
  p_country TEXT,
  p_service_date DATE,
  p_start_time TEXT,
  p_duration_hours INTEGER,
  p_languages TEXT[],
  p_guest_count INTEGER,
  p_contact_name TEXT,
  p_contact_phone TEXT
)
RETURNS TABLE (
  request_id UUID,
  booking_id TEXT,
  order_id TEXT,
  amount INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.service_requests%ROWTYPE;
  v_booking_id TEXT;
  v_order_id TEXT;
BEGIN
  INSERT INTO public.service_requests (
    user_id,
    title,
    description,
    city,
    country,
    service_date,
    start_time,
    duration_hours,
    languages,
    guest_count,
    contact_name,
    contact_phone,
    status
  )
  VALUES (
    p_user_id,
    trim(p_title),
    trim(p_description),
    p_city,
    p_country,
    p_service_date,
    p_start_time,
    p_duration_hours,
    COALESCE(p_languages, ARRAY[]::TEXT[]),
    p_guest_count,
    trim(p_contact_name),
    trim(p_contact_phone),
    'pending_payment'
  )
  RETURNING * INTO v_request;

  v_order_id := 'SVC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::TEXT, 1, 8));
  v_booking_id := v_order_id;

  INSERT INTO public.service_bookings (
    id,
    order_id,
    request_id,
    application_id,
    customer_id,
    host_id,
    amount,
    host_payout_amount,
    platform_revenue,
    status,
    contact_name,
    contact_phone,
    payment_method,
    payout_status
  )
  VALUES (
    v_booking_id,
    v_order_id,
    v_request.id,
    NULL,
    p_user_id,
    NULL,
    v_request.total_customer_price,
    v_request.total_host_payout,
    v_request.total_customer_price - v_request.total_host_payout,
    'PENDING',
    trim(p_contact_name),
    trim(p_contact_phone),
    NULL,
    'pending'
  );

  RETURN QUERY
  SELECT
    v_request.id,
    v_booking_id,
    v_order_id,
    v_request.total_customer_price;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_service_request_with_booking_atomic(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DATE,
  TEXT,
  INTEGER,
  TEXT[],
  INTEGER,
  TEXT,
  TEXT
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_service_request_with_booking_atomic(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DATE,
  TEXT,
  INTEGER,
  TEXT[],
  INTEGER,
  TEXT,
  TEXT
) FROM anon, authenticated;
