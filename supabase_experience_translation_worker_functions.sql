-- =============================================================================
-- Experience Translation Queue Worker RPC
-- Safe leasing helpers for provider-aware dispatch and quota bookkeeping.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.lease_experience_translation_task(
  p_provider text,
  p_now timestamp with time zone DEFAULT timezone('utc'::text, now()),
  p_lease_seconds integer DEFAULT 180,
  p_reserved_tokens integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  experience_id bigint,
  translation_version integer,
  source_locale text,
  target_locale text,
  provider text,
  attempt_count integer,
  priority integer,
  lease_expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provider_state public.translation_provider_state%ROWTYPE;
  leased_task public.experience_translation_tasks%ROWTYPE;
  active_leases integer := 0;
  effective_lease_seconds integer := GREATEST(COALESCE(p_lease_seconds, 180), 30);
  reserved_tokens integer := GREATEST(COALESCE(p_reserved_tokens, 0), 0);
BEGIN
  IF p_provider NOT IN ('gemini', 'grok') THEN
    RETURN;
  END IF;

  SELECT *
  INTO provider_state
  FROM public.translation_provider_state
  WHERE translation_provider_state.provider = p_provider
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF provider_state.cooldown_until IS NOT NULL AND provider_state.cooldown_until > p_now THEN
    RETURN;
  END IF;

  IF provider_state.window_started_at IS NULL
    OR provider_state.window_started_at + make_interval(secs => provider_state.window_seconds) <= p_now
  THEN
    UPDATE public.translation_provider_state
    SET
      window_started_at = p_now,
      dispatched_requests = 0,
      dispatched_tokens = 0,
      updated_at = p_now
    WHERE translation_provider_state.provider = p_provider;

    provider_state.window_started_at := p_now;
    provider_state.dispatched_requests := 0;
    provider_state.dispatched_tokens := 0;
  END IF;

  SELECT COUNT(*)
  INTO active_leases
  FROM public.experience_translation_tasks
  WHERE experience_translation_tasks.provider = p_provider
    AND experience_translation_tasks.status IN ('leased', 'processing')
    AND experience_translation_tasks.lease_expires_at IS NOT NULL
    AND experience_translation_tasks.lease_expires_at > p_now;

  IF active_leases >= provider_state.max_concurrency THEN
    RETURN;
  END IF;

  IF provider_state.dispatched_requests >= provider_state.rpm_limit THEN
    RETURN;
  END IF;

  IF provider_state.tpm_limit IS NOT NULL
    AND provider_state.dispatched_tokens + reserved_tokens > provider_state.tpm_limit
  THEN
    RETURN;
  END IF;

  SELECT *
  INTO leased_task
  FROM public.experience_translation_tasks
  WHERE experience_translation_tasks.provider = p_provider
    AND experience_translation_tasks.status IN ('queued', 'retryable')
    AND experience_translation_tasks.not_before <= p_now
  ORDER BY experience_translation_tasks.priority ASC, experience_translation_tasks.id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.experience_translation_tasks
  SET
    status = 'leased',
    leased_at = p_now,
    lease_expires_at = p_now + make_interval(secs => effective_lease_seconds)
  WHERE experience_translation_tasks.id = leased_task.id;

  UPDATE public.translation_provider_state
  SET
    dispatched_requests = provider_state.dispatched_requests + 1,
    dispatched_tokens = provider_state.dispatched_tokens + reserved_tokens,
    updated_at = p_now
  WHERE translation_provider_state.provider = p_provider;

  RETURN QUERY
  SELECT
    leased_task.id,
    leased_task.job_id,
    leased_task.experience_id,
    leased_task.translation_version,
    leased_task.source_locale,
    leased_task.target_locale,
    leased_task.provider,
    leased_task.attempt_count,
    leased_task.priority,
    p_now + make_interval(secs => effective_lease_seconds);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_translation_provider_outcome(
  p_provider text,
  p_token_count integer DEFAULT 0,
  p_cooldown_seconds integer DEFAULT NULL,
  p_hit_quota boolean DEFAULT false,
  p_reserved_token_count integer DEFAULT 0
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.translation_provider_state
  SET
    dispatched_tokens = GREATEST(
      dispatched_tokens
      - GREATEST(COALESCE(p_reserved_token_count, 0), 0)
      + GREATEST(COALESCE(p_token_count, 0), 0),
      0
    ),
    cooldown_until = CASE
      WHEN p_cooldown_seconds IS NULL OR p_cooldown_seconds <= 0 THEN cooldown_until
      ELSE timezone('utc'::text, now()) + make_interval(secs => p_cooldown_seconds)
    END,
    last_429_at = CASE
      WHEN p_hit_quota THEN timezone('utc'::text, now())
      ELSE last_429_at
    END,
    updated_at = timezone('utc'::text, now())
  WHERE translation_provider_state.provider = p_provider;
$$;

GRANT EXECUTE ON FUNCTION public.lease_experience_translation_task(text, timestamp with time zone, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_translation_provider_outcome(text, integer, integer, boolean, integer) TO service_role;
