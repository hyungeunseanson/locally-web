-- v3.40.16
-- 체험 완료 due 계산을 앱 서버 로컬 시간 의존성에서 제거하고
-- PostgreSQL KST 기준으로 일관되게 계산한다.

DROP FUNCTION IF EXISTS public.list_due_experience_completion_candidates(TEXT);

CREATE OR REPLACE FUNCTION public.list_due_experience_completion_candidates(
  p_booking_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  booking_id TEXT,
  order_id TEXT,
  user_id UUID,
  "date" DATE,
  "time" TEXT,
  status TEXT,
  experience_title TEXT,
  due_at_kst_utc TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidate_rows AS (
    SELECT
      b.id AS booking_id,
      COALESCE(b.order_id, b.id) AS order_id,
      b.user_id,
      b.date,
      b.time,
      b.status,
      COALESCE(e.title, '체험') AS experience_title,
      (
        (b.date::text || ' ' || COALESCE(NULLIF(b.time, ''), '00:00'))::timestamp
        AT TIME ZONE 'Asia/Seoul'
      ) AS due_at_kst_utc
    FROM public.bookings AS b
    LEFT JOIN public.experiences AS e
      ON e.id = b.experience_id
    WHERE b.status IN ('PAID', 'confirmed')
      AND b.date IS NOT NULL
      AND (
        p_booking_id IS NULL
        OR b.id = trim(p_booking_id)
      )
  )
  SELECT
    booking_id,
    order_id,
    user_id::UUID,
    date::DATE,
    time,
    status,
    experience_title,
    due_at_kst_utc
  FROM candidate_rows
  WHERE due_at_kst_utc < now()
  ORDER BY due_at_kst_utc ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_due_experience_completion_candidates(TEXT)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.list_due_experience_completion_candidates(TEXT)
FROM anon, authenticated;

DROP FUNCTION IF EXISTS public.get_experience_completion_due_backlog();

CREATE OR REPLACE FUNCTION public.get_experience_completion_due_backlog()
RETURNS TABLE (
  due_count BIGINT,
  oldest_due_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH due_rows AS (
    SELECT
      (
        (b.date::text || ' ' || COALESCE(NULLIF(b.time, ''), '00:00'))::timestamp
        AT TIME ZONE 'Asia/Seoul'
      ) AS due_at_kst_utc
    FROM public.bookings AS b
    WHERE b.status IN ('PAID', 'confirmed')
      AND b.date IS NOT NULL
  )
  SELECT
    COUNT(*)::BIGINT AS due_count,
    MIN(due_at_kst_utc) AS oldest_due_at
  FROM due_rows
  WHERE due_at_kst_utc < now();
$$;

GRANT EXECUTE ON FUNCTION public.get_experience_completion_due_backlog()
TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_experience_completion_due_backlog()
FROM anon, authenticated;
