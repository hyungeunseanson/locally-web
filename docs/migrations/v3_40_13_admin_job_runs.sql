-- v3.40.13
-- 정산 완료 동기화(cron/manual) 실행 이력 및 lock 상태를 기록한다.

CREATE TABLE IF NOT EXISTS public.admin_job_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_name TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NULL,
  duration_ms INTEGER NULL,
  initiated_by_admin_id UUID NULL,
  target_identifier TEXT NULL,
  processed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT admin_job_runs_status_check
    CHECK (status IN ('running', 'success', 'failed', 'abandoned')),
  CONSTRAINT admin_job_runs_trigger_source_check
    CHECK (trigger_source IN ('cron', 'manual_run_due', 'manual_force_one')),
  CONSTRAINT admin_job_runs_scope_check
    CHECK (scope IN ('experience', 'service', 'all'))
);

CREATE INDEX IF NOT EXISTS admin_job_runs_job_name_started_at_idx
  ON public.admin_job_runs (job_name, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS admin_job_runs_running_job_name_idx
  ON public.admin_job_runs (job_name)
  WHERE status = 'running';

GRANT ALL ON TABLE public.admin_job_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_job_runs_id_seq TO service_role;

REVOKE ALL ON TABLE public.admin_job_runs FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.admin_job_runs_id_seq FROM anon, authenticated;
