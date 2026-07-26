-- v3.40.29
-- 체험 완료와 호스트의 게스트 평가 요청 인앱 알림을 같은 트랜잭션에서 처리한다.
-- 기존 완료 RPC의 입력/반환 계약과 시작 시각 기준은 변경하지 않는다.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE type = 'guest_review_request'
      AND booking_id IS NOT NULL
    GROUP BY booking_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'EXP_HOST_REVIEW_REQUEST_DUPLICATE: duplicate guest_review_request notifications exist';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_guest_review_request_booking_id
  ON public.notifications (booking_id)
  WHERE type = 'guest_review_request'
    AND booking_id IS NOT NULL;

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
  v_experience_host_id UUID;
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

  SELECT
    COALESCE(e.title, '체험'),
    e.host_id
  INTO
    v_experience_title,
    v_experience_host_id
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
    IF EXISTS (
      SELECT 1
      FROM public.notifications AS n
      WHERE n.type = 'review_request'
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
      );

      v_notification_created := TRUE;
    END IF;
  END IF;

  IF
    v_booking.user_id IS NOT NULL
    AND v_experience_host_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.guest_reviews AS gr
      WHERE gr.booking_id = v_booking.id
        AND gr.host_id = v_experience_host_id
    )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications AS n
      WHERE n.type = 'guest_review_request'
        AND n.booking_id = v_booking.id
    ) THEN
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
        v_experience_host_id,
        'guest_review_request',
        '게스트 평가를 남겨주세요',
        format(
          '''%s'' 체험의 게스트 평가를 남겨주세요.',
          COALESCE(v_experience_title, '체험')
        ),
        '/host/dashboard?tab=reservations',
        FALSE,
        now(),
        v_booking.id
      );
    END IF;
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

NOTIFY pgrst, 'reload schema';
