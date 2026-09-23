BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.create_experience_review_atomic(text,uuid,bigint,integer,text)') IS NULL
    OR to_regprocedure('public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)') IS NULL
    OR to_regclass('public.uq_notifications_review_request_booking_id') IS NULL
    OR to_regclass('public.uq_notifications_guest_review_request_booking_id') IS NULL
  THEN
    RAISE EXCEPTION 'review reminder prerequisites are missing';
  END IF;
  IF to_regprocedure('public.claim_due_review_request_reminders(integer)') IS NOT NULL
    OR to_regclass('public.uq_notifications_review_request_reminder_booking_id') IS NOT NULL
    OR to_regclass('public.uq_notifications_guest_review_request_reminder_booking_id') IS NOT NULL
  THEN
    RAISE EXCEPTION 'review reminder objects already exist';
  END IF;
END
$preflight$;

-- Separate indexes keep guest and host reminders independent. The conflict
-- target is the booking, not the recipient, so concurrent cron runs cannot
-- produce a second reminder even if the recipient changes.
CREATE UNIQUE INDEX uq_notifications_review_request_reminder_booking_id
  ON public.notifications (booking_id)
  WHERE type = 'review_request_reminder' AND booking_id IS NOT NULL;

CREATE UNIQUE INDEX uq_notifications_guest_review_request_reminder_booking_id
  ON public.notifications (booking_id)
  WHERE type = 'guest_review_request_reminder' AND booking_id IS NOT NULL;

CREATE FUNCTION public.claim_due_review_request_reminders(p_limit integer DEFAULT 50)
RETURNS TABLE (
  notification_id bigint,
  booking_id text,
  recipient_user_id uuid,
  reminder_type text,
  experience_title text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  candidate record;
  inserted_id bigint;
BEGIN
  -- The booking lock is shared with both atomic review creation RPCs. A review
  -- committed before this claim is visible to the separate check below.
  FOR candidate IN
    SELECT
      n.booking_id,
      n.user_id AS recipient_user_id,
      n.type AS original_type,
      n.title,
      n.message,
      n.link,
      COALESCE(e.title, '체험') AS experience_title
    FROM public.notifications AS n
    JOIN public.bookings AS b ON b.id = n.booking_id
    JOIN public.experiences AS e ON e.id = b.experience_id
    WHERE n.type IN ('review_request', 'guest_review_request')
      AND n.booking_id IS NOT NULL
      AND n.created_at <= now() - interval '24 hours'
      AND b.status = 'completed'
      AND b.user_id IS NOT NULL
      AND b.date IS NOT NULL
      AND trim(COALESCE(b.time, '')) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      AND (
        (b.date::text || ' ' || trim(b.time))::timestamp AT TIME ZONE 'Asia/Seoul'
      ) + make_interval(hours => CASE WHEN e.duration > 0 THEN e.duration ELSE 2 END) <= now()
      AND (
        (n.type = 'review_request' AND n.user_id = b.user_id)
        OR (n.type = 'guest_review_request' AND e.host_id IS NOT NULL AND n.user_id = e.host_id)
      )
      AND (
        (n.type = 'review_request' AND NOT EXISTS (
          SELECT 1 FROM public.reviews AS r WHERE r.booking_id = n.booking_id
        ))
        OR (n.type = 'guest_review_request' AND NOT EXISTS (
          SELECT 1 FROM public.guest_reviews AS gr WHERE gr.booking_id = n.booking_id
        ))
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications AS reminder
        WHERE reminder.booking_id = n.booking_id
          AND reminder.type = CASE n.type
            WHEN 'review_request' THEN 'review_request_reminder'
            ELSE 'guest_review_request_reminder'
          END
      )
    ORDER BY n.created_at, n.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50)
    FOR UPDATE OF b SKIP LOCKED
  LOOP
    -- This runs after acquiring the booking lock, in a fresh statement.
    IF candidate.original_type = 'review_request' THEN
      IF EXISTS (SELECT 1 FROM public.reviews AS r WHERE r.booking_id = candidate.booking_id) THEN
        CONTINUE;
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM public.guest_reviews AS gr WHERE gr.booking_id = candidate.booking_id) THEN
        CONTINUE;
      END IF;
    END IF;

    inserted_id := NULL;
    INSERT INTO public.notifications (
      user_id, type, title, message, link, is_read, booking_id
    ) VALUES (
      candidate.recipient_user_id,
      CASE candidate.original_type
        WHEN 'review_request' THEN 'review_request_reminder'
        ELSE 'guest_review_request_reminder'
      END,
      candidate.title,
      candidate.message,
      candidate.link,
      FALSE,
      candidate.booking_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO inserted_id;

    IF inserted_id IS NOT NULL THEN
      notification_id := inserted_id;
      booking_id := candidate.booking_id;
      recipient_user_id := candidate.recipient_user_id;
      reminder_type := CASE candidate.original_type
        WHEN 'review_request' THEN 'review_request_reminder'
        ELSE 'guest_review_request_reminder'
      END;
      experience_title := candidate.experience_title;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_due_review_request_reminders(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_review_request_reminders(integer) TO service_role;

DO $postcondition$
BEGIN
  IF to_regclass('public.uq_notifications_review_request_reminder_booking_id') IS NULL
    OR to_regclass('public.uq_notifications_guest_review_request_reminder_booking_id') IS NULL
    OR has_function_privilege('anon', 'public.claim_due_review_request_reminders(integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.claim_due_review_request_reminders(integer)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.claim_due_review_request_reminders(integer)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'review reminder postcondition failed';
  END IF;
END
$postcondition$;

COMMIT;
