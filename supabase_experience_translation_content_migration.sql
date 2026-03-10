-- =============================================================================
-- Experience Translation Content Expansion v1
-- Additive migration for non-title/description translatable experience fields.
-- =============================================================================

ALTER TABLE public.experiences
ADD COLUMN IF NOT EXISTS meeting_point_i18n jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS supplies_i18n jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS inclusions_i18n jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS exclusions_i18n jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS itinerary_i18n jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS rules_i18n jsonb DEFAULT '{}'::jsonb;

UPDATE public.experiences
SET
  meeting_point_i18n = CASE
    WHEN jsonb_typeof(meeting_point_i18n) = 'object' AND meeting_point_i18n <> '{}'::jsonb THEN meeting_point_i18n
    WHEN NULLIF(BTRIM(COALESCE(source_locale, 'ko')), '') IS NOT NULL AND NULLIF(BTRIM(meeting_point), '') IS NOT NULL
      THEN jsonb_build_object(COALESCE(NULLIF(BTRIM(source_locale), ''), 'ko'), to_jsonb(BTRIM(meeting_point)))
    ELSE '{}'::jsonb
  END,
  supplies_i18n = CASE
    WHEN jsonb_typeof(supplies_i18n) = 'object' AND supplies_i18n <> '{}'::jsonb THEN supplies_i18n
    WHEN NULLIF(BTRIM(COALESCE(source_locale, 'ko')), '') IS NOT NULL AND NULLIF(BTRIM(supplies), '') IS NOT NULL
      THEN jsonb_build_object(COALESCE(NULLIF(BTRIM(source_locale), ''), 'ko'), to_jsonb(BTRIM(supplies)))
    ELSE '{}'::jsonb
  END,
  inclusions_i18n = CASE
    WHEN jsonb_typeof(inclusions_i18n) = 'object' AND inclusions_i18n <> '{}'::jsonb THEN inclusions_i18n
    WHEN COALESCE(array_length(inclusions, 1), 0) > 0
      THEN jsonb_build_object(COALESCE(NULLIF(BTRIM(source_locale), ''), 'ko'), to_jsonb(inclusions))
    ELSE '{}'::jsonb
  END,
  exclusions_i18n = CASE
    WHEN jsonb_typeof(exclusions_i18n) = 'object' AND exclusions_i18n <> '{}'::jsonb THEN exclusions_i18n
    WHEN COALESCE(array_length(exclusions, 1), 0) > 0
      THEN jsonb_build_object(COALESCE(NULLIF(BTRIM(source_locale), ''), 'ko'), to_jsonb(exclusions))
    ELSE '{}'::jsonb
  END,
  itinerary_i18n = CASE
    WHEN jsonb_typeof(itinerary_i18n) = 'object' AND itinerary_i18n <> '{}'::jsonb THEN itinerary_i18n
    WHEN jsonb_typeof(itinerary) = 'array' AND jsonb_array_length(itinerary) > 0
      THEN jsonb_build_object(COALESCE(NULLIF(BTRIM(source_locale), ''), 'ko'), itinerary)
    ELSE '{}'::jsonb
  END,
  rules_i18n = CASE
    WHEN jsonb_typeof(rules_i18n) = 'object' AND rules_i18n <> '{}'::jsonb THEN rules_i18n
    WHEN jsonb_typeof(rules) = 'object' AND rules <> '{}'::jsonb
      THEN jsonb_build_object(COALESCE(NULLIF(BTRIM(source_locale), ''), 'ko'), rules)
    ELSE '{}'::jsonb
  END;

ALTER TABLE public.experiences
ALTER COLUMN meeting_point_i18n SET DEFAULT '{}'::jsonb,
ALTER COLUMN meeting_point_i18n SET NOT NULL,
ALTER COLUMN supplies_i18n SET DEFAULT '{}'::jsonb,
ALTER COLUMN supplies_i18n SET NOT NULL,
ALTER COLUMN inclusions_i18n SET DEFAULT '{}'::jsonb,
ALTER COLUMN inclusions_i18n SET NOT NULL,
ALTER COLUMN exclusions_i18n SET DEFAULT '{}'::jsonb,
ALTER COLUMN exclusions_i18n SET NOT NULL,
ALTER COLUMN itinerary_i18n SET DEFAULT '{}'::jsonb,
ALTER COLUMN itinerary_i18n SET NOT NULL,
ALTER COLUMN rules_i18n SET DEFAULT '{}'::jsonb,
ALTER COLUMN rules_i18n SET NOT NULL;
