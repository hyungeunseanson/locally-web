-- v3.40.20
-- Admin-only visibility switch for the guest-facing solo-guarantee option.
-- Default true preserves existing behavior for all current and future experiences.

ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS solo_guarantee_option_visible boolean;

UPDATE public.experiences
SET solo_guarantee_option_visible = true
WHERE solo_guarantee_option_visible IS NULL;

ALTER TABLE public.experiences
  ALTER COLUMN solo_guarantee_option_visible SET DEFAULT true,
  ALTER COLUMN solo_guarantee_option_visible SET NOT NULL;
