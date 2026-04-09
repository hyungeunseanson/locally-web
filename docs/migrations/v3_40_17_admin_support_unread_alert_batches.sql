-- v3.40.17
-- 고객센터 1:1 문의(admin_support/admin)에서
-- 고객 unread 배치를 10분 기준으로 1회만 관리자 ALERTS/팀 메일로 올리기 위한 상태 테이블.

CREATE TABLE IF NOT EXISTS public.admin_support_unread_alert_batches (
  inquiry_id BIGINT PRIMARY KEY REFERENCES public.inquiries(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  first_unread_message_id BIGINT NULL REFERENCES public.inquiry_messages(id) ON DELETE SET NULL,
  first_unread_message_at TIMESTAMPTZ NULL,
  last_unread_message_id BIGINT NULL REFERENCES public.inquiry_messages(id) ON DELETE SET NULL,
  last_unread_message_at TIMESTAMPTZ NULL,
  alert_due_at TIMESTAMPTZ NULL,
  in_app_sent_at TIMESTAMPTZ NULL,
  email_sent_at TIMESTAMPTZ NULL,
  processing_started_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_support_unread_alert_batches_active_due_idx
  ON public.admin_support_unread_alert_batches (is_active, alert_due_at);

CREATE INDEX IF NOT EXISTS admin_support_unread_alert_batches_processing_idx
  ON public.admin_support_unread_alert_batches (processing_started_at);

DROP FUNCTION IF EXISTS public.claim_due_admin_support_unread_alert_batches(INTEGER);

CREATE OR REPLACE FUNCTION public.claim_due_admin_support_unread_alert_batches(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  inquiry_id BIGINT,
  is_active BOOLEAN,
  first_unread_message_id BIGINT,
  first_unread_message_at TIMESTAMPTZ,
  last_unread_message_id BIGINT,
  last_unread_message_at TIMESTAMPTZ,
  alert_due_at TIMESTAMPTZ,
  in_app_sent_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := GREATEST(COALESCE(p_limit, 50), 1);
BEGIN
  RETURN QUERY
  WITH due_rows AS (
    SELECT batch.inquiry_id
    FROM public.admin_support_unread_alert_batches AS batch
    WHERE batch.is_active = TRUE
      AND batch.alert_due_at IS NOT NULL
      AND batch.alert_due_at <= now()
      AND (batch.in_app_sent_at IS NULL OR batch.email_sent_at IS NULL)
      AND (
        batch.processing_started_at IS NULL
        OR batch.processing_started_at < now() - interval '15 minutes'
      )
    ORDER BY batch.alert_due_at ASC, batch.inquiry_id ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed_rows AS (
    UPDATE public.admin_support_unread_alert_batches AS batch
    SET
      processing_started_at = now(),
      updated_at = now()
    WHERE batch.inquiry_id IN (SELECT due_rows.inquiry_id FROM due_rows)
    RETURNING
      batch.inquiry_id,
      batch.is_active,
      batch.first_unread_message_id,
      batch.first_unread_message_at,
      batch.last_unread_message_id,
      batch.last_unread_message_at,
      batch.alert_due_at,
      batch.in_app_sent_at,
      batch.email_sent_at,
      batch.processing_started_at,
      batch.created_at,
      batch.updated_at
  )
  SELECT
    claimed_rows.inquiry_id,
    claimed_rows.is_active,
    claimed_rows.first_unread_message_id,
    claimed_rows.first_unread_message_at,
    claimed_rows.last_unread_message_id,
    claimed_rows.last_unread_message_at,
    claimed_rows.alert_due_at,
    claimed_rows.in_app_sent_at,
    claimed_rows.email_sent_at,
    claimed_rows.processing_started_at,
    claimed_rows.created_at,
    claimed_rows.updated_at
  FROM claimed_rows
  ORDER BY claimed_rows.alert_due_at ASC, claimed_rows.inquiry_id ASC;
END;
$$;

GRANT ALL ON TABLE public.admin_support_unread_alert_batches TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_admin_support_unread_alert_batches(INTEGER) TO service_role;

REVOKE ALL ON TABLE public.admin_support_unread_alert_batches FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_due_admin_support_unread_alert_batches(INTEGER) FROM anon, authenticated;
