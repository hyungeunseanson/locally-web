-- =============================================================================
-- Experience Translation Queue System v1
-- Additive migration: canonical locale metadata, translation queue, provider
-- rate-limit state. Existing runtime paths remain untouched.
-- =============================================================================

ALTER TABLE public.experiences
ADD COLUMN IF NOT EXISTS title_ko text,
ADD COLUMN IF NOT EXISTS description_ko text,
ADD COLUMN IF NOT EXISTS source_locale text DEFAULT 'ko',
ADD COLUMN IF NOT EXISTS manual_locales text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS translation_version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS translation_meta jsonb DEFAULT '{}'::jsonb;

UPDATE public.experiences
SET
  title_ko = COALESCE(title_ko, title),
  description_ko = COALESCE(description_ko, description),
  source_locale = COALESCE(NULLIF(BTRIM(source_locale), ''), 'ko'),
  translation_version = CASE
    WHEN translation_version IS NULL OR translation_version < 1 THEN 1
    ELSE translation_version
  END,
  manual_locales = COALESCE(manual_locales, '{}'::text[]),
  translation_meta = COALESCE(translation_meta, '{}'::jsonb);

ALTER TABLE public.experiences
ALTER COLUMN source_locale SET DEFAULT 'ko',
ALTER COLUMN source_locale SET NOT NULL,
ALTER COLUMN manual_locales SET DEFAULT '{}'::text[],
ALTER COLUMN manual_locales SET NOT NULL,
ALTER COLUMN translation_version SET DEFAULT 1,
ALTER COLUMN translation_version SET NOT NULL,
ALTER COLUMN translation_meta SET DEFAULT '{}'::jsonb,
ALTER COLUMN translation_meta SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'experiences_source_locale_check'
  ) THEN
    ALTER TABLE public.experiences
    ADD CONSTRAINT experiences_source_locale_check
    CHECK (source_locale IN ('ko', 'en', 'ja', 'zh'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'experiences_translation_version_check'
  ) THEN
    ALTER TABLE public.experiences
    ADD CONSTRAINT experiences_translation_version_check
    CHECK (translation_version >= 1);
  END IF;
END $$;

DO $$
DECLARE
  ko_present_expr text := '(nullif(btrim(title), '''') IS NOT NULL OR nullif(btrim(description), '''') IS NOT NULL)';
  en_present_expr text := 'false';
  ja_present_expr text := 'false';
  zh_present_expr text := 'false';

  has_title_en boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'experiences' AND column_name = 'title_en'
  );
  has_description_en boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'experiences' AND column_name = 'description_en'
  );
  has_title_ja boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'experiences' AND column_name = 'title_ja'
  );
  has_description_ja boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'experiences' AND column_name = 'description_ja'
  );
  has_title_zh boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'experiences' AND column_name = 'title_zh'
  );
  has_description_zh boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'experiences' AND column_name = 'description_zh'
  );

  locale_update_sql text;
BEGIN
  IF has_title_en AND has_description_en THEN
    en_present_expr := '(nullif(btrim(title_en), '''') IS NOT NULL OR nullif(btrim(description_en), '''') IS NOT NULL)';
  ELSIF has_title_en THEN
    en_present_expr := '(nullif(btrim(title_en), '''') IS NOT NULL)';
  ELSIF has_description_en THEN
    en_present_expr := '(nullif(btrim(description_en), '''') IS NOT NULL)';
  END IF;

  IF has_title_ja AND has_description_ja THEN
    ja_present_expr := '(nullif(btrim(title_ja), '''') IS NOT NULL OR nullif(btrim(description_ja), '''') IS NOT NULL)';
  ELSIF has_title_ja THEN
    ja_present_expr := '(nullif(btrim(title_ja), '''') IS NOT NULL)';
  ELSIF has_description_ja THEN
    ja_present_expr := '(nullif(btrim(description_ja), '''') IS NOT NULL)';
  END IF;

  IF has_title_zh AND has_description_zh THEN
    zh_present_expr := '(nullif(btrim(title_zh), '''') IS NOT NULL OR nullif(btrim(description_zh), '''') IS NOT NULL)';
  ELSIF has_title_zh THEN
    zh_present_expr := '(nullif(btrim(title_zh), '''') IS NOT NULL)';
  ELSIF has_description_zh THEN
    zh_present_expr := '(nullif(btrim(description_zh), '''') IS NOT NULL)';
  END IF;

  locale_update_sql := format($sql$
    UPDATE public.experiences
    SET manual_locales = CASE
      WHEN COALESCE(array_length(manual_locales, 1), 0) > 0 THEN manual_locales
      ELSE COALESCE(
        NULLIF(
          array_remove(ARRAY[
            CASE WHEN %1$s THEN 'ko' END,
            CASE WHEN %2$s THEN 'en' END,
            CASE WHEN %3$s THEN 'ja' END,
            CASE WHEN %4$s THEN 'zh' END
          ], NULL),
          '{}'::text[]
        ),
        ARRAY['ko']::text[]
      )
    END
  $sql$, ko_present_expr, en_present_expr, ja_present_expr, zh_present_expr);

  EXECUTE locale_update_sql;
END $$;

UPDATE public.experiences
SET translation_meta = CASE
  WHEN translation_meta IS NOT NULL
    AND jsonb_typeof(translation_meta) = 'object'
    AND translation_meta <> '{}'::jsonb
  THEN translation_meta
  ELSE jsonb_strip_nulls(
    jsonb_build_object(
      'ko', CASE
        WHEN manual_locales @> ARRAY['ko']::text[] THEN
          jsonb_build_object('mode', 'manual', 'status', 'ready', 'version', translation_version)
      END,
      'en', CASE
        WHEN manual_locales @> ARRAY['en']::text[] THEN
          jsonb_build_object('mode', 'manual', 'status', 'ready', 'version', translation_version)
      END,
      'ja', CASE
        WHEN manual_locales @> ARRAY['ja']::text[] THEN
          jsonb_build_object('mode', 'manual', 'status', 'ready', 'version', translation_version)
      END,
      'zh', CASE
        WHEN manual_locales @> ARRAY['zh']::text[] THEN
          jsonb_build_object('mode', 'manual', 'status', 'ready', 'version', translation_version)
      END
    )
  )
END;

CREATE TABLE IF NOT EXISTS public.experience_translation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id bigint NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  translation_version integer NOT NULL,
  source_locale text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  CONSTRAINT experience_translation_jobs_source_locale_check
    CHECK (source_locale IN ('ko', 'en', 'ja', 'zh')),
  CONSTRAINT experience_translation_jobs_status_check
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT experience_translation_jobs_translation_version_check
    CHECK (translation_version >= 1),
  CONSTRAINT experience_translation_jobs_experience_version_key
    UNIQUE (experience_id, translation_version)
);

CREATE TABLE IF NOT EXISTS public.experience_translation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.experience_translation_jobs(id) ON DELETE CASCADE,
  experience_id bigint NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  translation_version integer NOT NULL,
  source_locale text NOT NULL,
  target_locale text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 100,
  not_before timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  leased_at timestamp with time zone,
  lease_expires_at timestamp with time zone,
  completed_at timestamp with time zone,
  last_error text,
  CONSTRAINT experience_translation_tasks_source_locale_check
    CHECK (source_locale IN ('ko', 'en', 'ja', 'zh')),
  CONSTRAINT experience_translation_tasks_target_locale_check
    CHECK (target_locale IN ('ko', 'en', 'ja', 'zh')),
  CONSTRAINT experience_translation_tasks_provider_check
    CHECK (provider IN ('gemini', 'grok')),
  CONSTRAINT experience_translation_tasks_status_check
    CHECK (status IN ('queued', 'leased', 'processing', 'completed', 'failed', 'retryable', 'cancelled')),
  CONSTRAINT experience_translation_tasks_attempt_count_check
    CHECK (attempt_count >= 0),
  CONSTRAINT experience_translation_tasks_priority_check
    CHECK (priority >= 0),
  CONSTRAINT experience_translation_tasks_translation_version_check
    CHECK (translation_version >= 1),
  CONSTRAINT experience_translation_tasks_experience_version_locale_key
    UNIQUE (experience_id, translation_version, target_locale)
);

CREATE TABLE IF NOT EXISTS public.translation_provider_state (
  provider text PRIMARY KEY,
  model text NOT NULL,
  rpm_limit integer NOT NULL,
  tpm_limit integer,
  window_seconds integer NOT NULL DEFAULT 60,
  max_concurrency integer NOT NULL DEFAULT 1,
  window_started_at timestamp with time zone,
  dispatched_requests integer NOT NULL DEFAULT 0,
  dispatched_tokens integer NOT NULL DEFAULT 0,
  cooldown_until timestamp with time zone,
  last_429_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT translation_provider_state_provider_check
    CHECK (provider IN ('gemini', 'grok')),
  CONSTRAINT translation_provider_state_rpm_limit_check
    CHECK (rpm_limit > 0),
  CONSTRAINT translation_provider_state_tpm_limit_check
    CHECK (tpm_limit IS NULL OR tpm_limit > 0),
  CONSTRAINT translation_provider_state_window_seconds_check
    CHECK (window_seconds > 0),
  CONSTRAINT translation_provider_state_max_concurrency_check
    CHECK (max_concurrency > 0),
  CONSTRAINT translation_provider_state_dispatched_requests_check
    CHECK (dispatched_requests >= 0),
  CONSTRAINT translation_provider_state_dispatched_tokens_check
    CHECK (dispatched_tokens >= 0)
);

CREATE INDEX IF NOT EXISTS idx_experience_translation_jobs_status_created_at
  ON public.experience_translation_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_experience_translation_tasks_dispatch
  ON public.experience_translation_tasks(status, not_before, provider, priority, id);

CREATE INDEX IF NOT EXISTS idx_experience_translation_tasks_experience_version
  ON public.experience_translation_tasks(experience_id, translation_version);

INSERT INTO public.translation_provider_state (
  provider,
  model,
  rpm_limit,
  tpm_limit,
  window_seconds,
  max_concurrency
)
VALUES
  ('gemini', 'gemini-2.5-flash', 8, 200000, 60, 1),
  ('grok', 'grok-3-fast', 60, NULL, 60, 2)
ON CONFLICT (provider) DO NOTHING;
