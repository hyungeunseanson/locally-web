-- v3.40.15
-- admin_job_runs running lock을 started_at 기반 stale 판정에서
-- lease_token / lease_expires_at / last_heartbeat_at 기반 lease 방식으로 전환한다.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.admin_job_runs
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

UPDATE public.admin_job_runs
SET
  status = 'abandoned',
  finished_at = COALESCE(finished_at, now()),
  error_message = COALESCE(
    error_message,
    'Pre-lease running settlement sync abandoned during lease migration.'
  )
WHERE status = 'running';

UPDATE public.admin_job_runs
SET
  lease_token = COALESCE(lease_token, gen_random_uuid()),
  lease_expires_at = COALESCE(
    lease_expires_at,
    COALESCE(finished_at, started_at, now())
  ),
  last_heartbeat_at = COALESCE(
    last_heartbeat_at,
    COALESCE(finished_at, started_at, now())
  );

ALTER TABLE public.admin_job_runs
  ALTER COLUMN lease_token SET NOT NULL,
  ALTER COLUMN lease_expires_at SET NOT NULL,
  ALTER COLUMN last_heartbeat_at SET NOT NULL;
