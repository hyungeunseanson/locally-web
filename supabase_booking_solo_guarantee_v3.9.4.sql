-- =============================================================================
-- Migration: Add solo guarantee fields to bookings and update create_booking_atomic
-- =============================================================================

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS is_solo_guarantee boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS solo_guarantee_price integer DEFAULT 0;

UPDATE public.bookings
SET
  is_solo_guarantee = COALESCE(is_solo_guarantee, false),
  solo_guarantee_price = COALESCE(solo_guarantee_price, 0)
WHERE is_solo_guarantee IS NULL
   OR solo_guarantee_price IS NULL;

ALTER TABLE public.bookings
ALTER COLUMN is_solo_guarantee SET DEFAULT false,
ALTER COLUMN is_solo_guarantee SET NOT NULL,
ALTER COLUMN solo_guarantee_price SET DEFAULT 0,
ALTER COLUMN solo_guarantee_price SET NOT NULL;

DROP FUNCTION IF EXISTS public.create_booking_atomic(uuid, text, text, text, integer, boolean, text, text);
DROP FUNCTION IF EXISTS public.create_booking_atomic(uuid, text, text, text, integer, boolean, text, text, text);
DROP FUNCTION IF EXISTS public.create_booking_atomic(uuid, text, text, text, integer, boolean, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_user_id uuid,
  p_experience_id text,
  p_date text,
  p_time text,
  p_guests integer,
  p_is_private boolean,
  p_customer_name text,
  p_customer_phone text,
  p_payment_method text default 'card',
  p_is_solo_guarantee boolean default false
)
RETURNS TABLE (
  new_order_id text,
  final_amount numeric,
  host_id text,
  experience_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_experience_id public.experiences.id%type;
  v_host_id text;
  v_title text;
  v_price numeric;
  v_private_price numeric;
  v_max_guests integer;
  v_guest_count integer;
  v_host_price numeric;
  v_fee numeric;
  v_final_amount numeric;
  v_current_booked integer;
  v_has_private_booking boolean;
  v_slot_key text;
  v_new_order_id text;
  v_booking_date date;
  v_booking_time_text text;
  v_solo_guarantee_price numeric;
BEGIN
  IF p_user_id IS NULL
     OR COALESCE(trim(p_experience_id), '') = ''
     OR COALESCE(trim(p_date), '') = ''
     OR COALESCE(trim(p_time), '') = ''
     OR COALESCE(trim(p_customer_name), '') = ''
     OR COALESCE(trim(p_customer_phone), '') = '' THEN
    RAISE EXCEPTION 'BOOKING_BAD_REQUEST:Missing required fields' USING errcode = 'P0001';
  END IF;

  BEGIN
    v_booking_date := p_date::date;
    v_booking_time_text := to_char(p_time::time, 'HH24:MI');
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'BOOKING_BAD_REQUEST:Invalid date/time format' USING errcode = 'P0001';
  END;

  SELECT
    e.id,
    e.host_id::text,
    e.title,
    COALESCE(e.price, 0),
    COALESCE(e.private_price, 0),
    COALESCE(e.max_guests, 10)
  INTO
    v_experience_id,
    v_host_id,
    v_title,
    v_price,
    v_private_price,
    v_max_guests
  FROM public.experiences e
  WHERE e.id::text = p_experience_id
  LIMIT 1;

  IF v_experience_id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND:Experience not found' USING errcode = 'P0001';
  END IF;

  v_guest_count := GREATEST(COALESCE(p_guests, 0), 1);
  v_slot_key := format('%s|%s|%s', v_experience_id::text, v_booking_date::text, v_booking_time_text);

  PERFORM pg_advisory_xact_lock(hashtext(v_slot_key)::bigint);

  SELECT
    COALESCE(SUM(b.guests), 0)::int,
    COALESCE(BOOL_OR(b.type = 'private'), false)
  INTO
    v_current_booked,
    v_has_private_booking
  FROM public.bookings b
  WHERE b.experience_id = v_experience_id
    AND b.date = v_booking_date
    AND b.time = v_booking_time_text
    AND lower(b.status::text) IN ('pending', 'paid', 'confirmed');

  IF v_has_private_booking
     OR (p_is_private AND v_current_booked > 0)
     OR ((NOT p_is_private) AND (v_current_booked + v_guest_count > v_max_guests)) THEN
    RAISE EXCEPTION 'BOOKING_CONFLICT:해당 시간대에 남은 좌석이 부족합니다.' USING errcode = 'P0001';
  END IF;

  IF COALESCE(p_is_solo_guarantee, false) AND (p_is_private OR v_guest_count <> 1) THEN
    RAISE EXCEPTION 'BOOKING_BAD_REQUEST:Solo guarantee is only available for shared solo bookings' USING errcode = 'P0001';
  END IF;

  v_solo_guarantee_price := CASE
    WHEN COALESCE(p_is_solo_guarantee, false) AND NOT p_is_private AND v_guest_count = 1 THEN 30000
    ELSE 0
  END;

  v_host_price := CASE WHEN p_is_private THEN v_private_price ELSE v_price * v_guest_count END;
  v_host_price := v_host_price + v_solo_guarantee_price;
  v_fee := floor(v_host_price * 0.1);
  v_final_amount := v_host_price + v_fee;

  LOOP
    v_new_order_id := format(
      'ORD-%s-%s',
      to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
      lpad((floor(random() * 1000))::int::text, 3, '0')
    );

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.order_id = v_new_order_id
         OR b.id::text = v_new_order_id
    );
  END LOOP;

  INSERT INTO public.bookings (
    id,
    order_id,
    user_id,
    experience_id,
    amount,
    total_price,
    status,
    guests,
    date,
    time,
    type,
    contact_name,
    contact_phone,
    message,
    created_at,
    payment_method,
    is_solo_guarantee,
    solo_guarantee_price
  ) VALUES (
    v_new_order_id,
    v_new_order_id,
    p_user_id,
    v_experience_id,
    v_final_amount,
    v_host_price,
    'PENDING',
    v_guest_count,
    v_booking_date,
    v_booking_time_text,
    CASE WHEN p_is_private THEN 'private' ELSE 'group' END,
    p_customer_name,
    p_customer_phone,
    '',
    now(),
    COALESCE(p_payment_method, 'card'),
    v_solo_guarantee_price > 0,
    v_solo_guarantee_price::integer
  );

  RETURN QUERY
  SELECT
    v_new_order_id,
    v_final_amount,
    v_host_id,
    COALESCE(v_title, 'Locally 체험');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic(
  uuid, text, text, text, integer, boolean, text, text, text, boolean
) TO anon, authenticated, service_role;
