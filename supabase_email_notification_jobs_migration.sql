-- =============================================================================
-- Email Notification Jobs Queue
-- Team digest + inquiry unread delayed email queue
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.email_notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('team_digest', 'inquiry_unread')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'cancelled', 'failed')),
  recipient_user_id uuid,
  recipient_email text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  send_after timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_notification_jobs_status_send_after
  ON public.email_notification_jobs(status, send_after);

CREATE INDEX IF NOT EXISTS idx_email_notification_jobs_kind_status
  ON public.email_notification_jobs(kind, status);

CREATE OR REPLACE FUNCTION public.set_email_notification_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_notification_jobs_updated_at ON public.email_notification_jobs;

CREATE TRIGGER trg_email_notification_jobs_updated_at
BEFORE UPDATE ON public.email_notification_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_email_notification_jobs_updated_at();
