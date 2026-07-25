-- v3.40.27
-- 체험 예약 완료 전환과 게스트 후기 요청 알림을 예약 단위로 원자 처리한다.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS booking_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_review_request_booking_id
  ON public.notifications (booking_id)
  WHERE type = 'review_request'
    AND booking_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.complete_experience_booking_if_due_atomic(TEXT);

CREATE OR REPLACE FUNCTION public.complete_experience_booking_if_due_atomic(
  p_booking_id TEXT
)
RETURNS TABLE (
  booking_id TEXT,
  order_id TEXT,
  user_id UUID,
  already_processed BOOLEAN,
  not_due BOOLEAN,
  completed BOOLEAN,
  notification_created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_experience_title TEXT;
  v_due_at TIMESTAMPTZ;
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
    SELECT
      v_booking.id,
      COALESCE(v_booking.order_id, v_booking.id),
      v_booking.user_id::UUID,
      TRUE,
      FALSE,
      FALSE,
      FALSE;
    RETURN;
  END IF;

  IF COALESCE(v_booking.status, '') NOT IN ('PAID', 'confirmed') THEN
    RAISE EXCEPTION 'EXP_COMPLETE_INVALID_STATUS: booking status must be PAID, confirmed, or completed';
  END IF;

  IF v_booking.date IS NULL THEN
    RETURN QUERY
    SELECT
      v_booking.id,
      COALESCE(v_booking.order_id, v_booking.id),
      v_booking.user_id::UUID,
      FALSE,
      TRUE,
      FALSE,
      FALSE;
    RETURN;
  END IF;

  v_due_at := (
    (
      v_booking.date::text
      || ' '
      || COALESCE(NULLIF(v_booking.time, ''), '00:00')
    )::timestamp
    AT TIME ZONE 'Asia/Seoul'
  );

  IF v_due_at >= now() THEN
    RETURN QUERY
    SELECT
      v_booking.id,
      COALESCE(v_booking.order_id, v_booking.id),
      v_booking.user_id::UUID,
      FALSE,
      TRUE,
      FALSE,
      FALSE;
    RETURN;
  END IF;

  SELECT COALESCE(e.title, '체험')
  INTO v_experience_title
  FROM public.experiences AS e
  WHERE e.id = v_booking.experience_id;

  UPDATE public.bookings AS b
  SET status = 'completed'
  WHERE b.id = v_booking.id
    AND b.status IN ('PAID', 'confirmed');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXP_COMPLETE_UPDATE_CONFLICT: booking status changed before completion';
  END IF;

  IF v_booking.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      link,
      is_read,
      created_at,
      booking_id
    )
    VALUES (
      v_booking.user_id,
      'review_request',
      '후기를 남겨주세요!',
      format(
        '''%s'' 어떠셨나요? 소중한 후기를 남겨주세요.',
        COALESCE(v_experience_title, '체험')
      ),
      '/guest/trips',
      FALSE,
      now(),
      v_booking.id
    )
    ON CONFLICT DO NOTHING;

    v_notification_created := FOUND;
  END IF;

  RETURN QUERY
  SELECT
    v_booking.id,
    COALESCE(v_booking.order_id, v_booking.id),
    v_booking.user_id::UUID,
    FALSE,
    FALSE,
    TRUE,
    v_notification_created;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_experience_booking_if_due_atomic(TEXT)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_experience_booking_if_due_atomic(TEXT)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_experience_booking_if_due_atomic(TEXT)
FROM anon, authenticated;
