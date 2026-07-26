-- v3.40.30
-- 호스트의 게스트 평가와 게스트 수신 인앱 알림을 같은 트랜잭션에서 처리한다.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE type = 'guest_review_received'
      AND booking_id IS NOT NULL
    GROUP BY booking_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'GUEST_REVIEW_RECEIVED_DUPLICATE: duplicate guest_review_received notifications exist';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_guest_review_received_booking_id
  ON public.notifications (booking_id)
  WHERE type = 'guest_review_received'
    AND booking_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_guest_review_with_notification_atomic(
  p_booking_id TEXT,
  p_host_id UUID,
  p_rating INTEGER,
  p_content TEXT,
  p_notification_title TEXT,
  p_notification_message TEXT
)
RETURNS TABLE (
  outcome TEXT,
  review_id BIGINT,
  guest_id UUID,
  notification_created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_experience_host_id UUID;
  v_review_id BIGINT;
  v_notification_created BOOLEAN := FALSE;
  v_content TEXT := trim(COALESCE(p_content, ''));
BEGIN
  IF
    trim(COALESCE(p_booking_id, '')) = ''
    OR p_host_id IS NULL
    OR p_rating IS NULL
    OR p_rating < 1
    OR p_rating > 5
    OR v_content = ''
  THEN
    RETURN QUERY SELECT 'invalid_payload', NULL::BIGINT, NULL::UUID, FALSE;
    RETURN;
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings AS b
  WHERE b.id = trim(p_booking_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found', NULL::BIGINT, NULL::UUID, FALSE;
    RETURN;
  END IF;

  IF v_booking.user_id IS NULL THEN
    RETURN QUERY SELECT 'invalid_payload', NULL::BIGINT, NULL::UUID, FALSE;
    RETURN;
  END IF;

  SELECT e.host_id
  INTO v_experience_host_id
  FROM public.experiences AS e
  WHERE e.id = v_booking.experience_id;

  IF v_experience_host_id IS NULL OR v_experience_host_id <> p_host_id THEN
    RETURN QUERY SELECT 'forbidden', NULL::BIGINT, v_booking.user_id::UUID, FALSE;
    RETURN;
  END IF;

  IF COALESCE(v_booking.status, '') <> 'completed' THEN
    RETURN QUERY SELECT 'invalid_status', NULL::BIGINT, v_booking.user_id::UUID, FALSE;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.guest_reviews AS gr
    WHERE gr.booking_id = v_booking.id
      AND gr.host_id = p_host_id
  ) THEN
    RETURN QUERY SELECT 'duplicate', NULL::BIGINT, v_booking.user_id::UUID, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.guest_reviews (
    booking_id,
    host_id,
    guest_id,
    rating,
    content
  )
  VALUES (
    v_booking.id,
    p_host_id,
    v_booking.user_id,
    p_rating,
    v_content
  )
  RETURNING id
  INTO v_review_id;

  IF EXISTS (
    SELECT 1
    FROM public.notifications AS n
    WHERE n.type = 'guest_review_received'
      AND n.booking_id = v_booking.id
  ) THEN
    v_notification_created := FALSE;
  ELSE
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
      'guest_review_received',
      COALESCE(NULLIF(trim(p_notification_title), ''), '호스트가 평가를 남겼습니다'),
      COALESCE(
        NULLIF(trim(p_notification_message), ''),
        '호스트가 회원님에 대한 평가를 남겼습니다.'
      ),
      '/account',
      FALSE,
      now(),
      v_booking.id
    );

    v_notification_created := TRUE;
  END IF;

  RETURN QUERY
  SELECT
    'created',
    v_review_id,
    v_booking.user_id::UUID,
    v_notification_created;
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_review_with_notification_atomic(
  TEXT,
  UUID,
  INTEGER,
  TEXT,
  TEXT,
  TEXT
)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_guest_review_with_notification_atomic(
  TEXT,
  UUID,
  INTEGER,
  TEXT,
  TEXT,
  TEXT
)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_guest_review_with_notification_atomic(
  TEXT,
  UUID,
  INTEGER,
  TEXT,
  TEXT,
  TEXT
)
FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
