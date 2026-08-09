-- v3.40.31
-- Release A: move birth date and gender behind service-role-only storage.

BEGIN;

CREATE TABLE IF NOT EXISTS public.profile_private_demographics (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  birth_date DATE,
  gender TEXT,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_private_demographics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profile_private_demographics FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.profile_private_demographics TO service_role;

-- Repair auth users whose profile creation previously failed. This keeps the
-- private table foreign key valid and restores their existing account surface.
INSERT INTO public.profiles (
  id, email, full_name, avatar_url, phone, nationality
)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', 'User'),
  NULLIF(u.raw_user_meta_data->>'avatar_url', ''),
  NULLIF(u.raw_user_meta_data->>'phone', ''),
  NULLIF(u.raw_user_meta_data->>'nationality', '')
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profile_private_demographics (user_id, birth_date, gender)
SELECT
  p.id,
  p.birth_date,
  CASE
    WHEN trim(p.gender) IN ('Male', 'Female', 'Other') THEN trim(p.gender)
    ELSE NULL
  END
FROM public.profiles AS p
ON CONFLICT (user_id) DO UPDATE
SET birth_date = COALESCE(profile_private_demographics.birth_date, EXCLUDED.birth_date),
    gender = COALESCE(profile_private_demographics.gender, EXCLUDED.gender),
    updated_at = now();

-- Temporary rollout compatibility: the currently deployed account UI still
-- writes these public columns until the application release is switched.
CREATE OR REPLACE FUNCTION public.sync_profile_private_demographics_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.profile_private_demographics (user_id, birth_date, gender)
  VALUES (
    NEW.id,
    NEW.birth_date,
    CASE
      WHEN trim(NEW.gender) IN ('Male', 'Female', 'Other') THEN trim(NEW.gender)
      ELSE NULL
    END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET birth_date = EXCLUDED.birth_date,
      gender = EXCLUDED.gender,
      updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_private_demographics ON public.profiles;
CREATE TRIGGER sync_profile_private_demographics
  AFTER INSERT OR UPDATE OF birth_date, gender ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_private_demographics_from_profile();

REVOKE ALL ON FUNCTION public.sync_profile_private_demographics_from_profile()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_private_demographics_from_profile()
  TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_birth_date DATE;
  v_gender TEXT;
BEGIN
  BEGIN
    IF COALESCE(NEW.raw_user_meta_data->>'birth_date', '') ~ '^\d{8}$' THEN
      v_birth_date := to_date(NEW.raw_user_meta_data->>'birth_date', 'YYYYMMDD');
    ELSE
      v_birth_date := NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::DATE;
    END IF;
  EXCEPTION WHEN others THEN
    v_birth_date := NULL;
  END;

  v_gender := CASE
    WHEN trim(NEW.raw_user_meta_data->>'gender') IN ('Male', 'Female', 'Other')
      THEN trim(NEW.raw_user_meta_data->>'gender')
    ELSE NULL
  END;

  BEGIN
    INSERT INTO public.profiles (
      id, email, full_name, avatar_url, phone, nationality, birth_date, gender
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      NULLIF(NEW.raw_user_meta_data->>'phone', ''),
      NULLIF(NEW.raw_user_meta_data->>'nationality', ''),
      v_birth_date,
      v_gender
    );
  EXCEPTION WHEN others THEN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
    );
  END;

  INSERT INTO public.profile_private_demographics (user_id, birth_date, gender)
  VALUES (
    NEW.id,
    v_birth_date,
    v_gender
  )
  ON CONFLICT (user_id) DO UPDATE
  SET birth_date = COALESCE(profile_private_demographics.birth_date, EXCLUDED.birth_date),
      gender = COALESCE(profile_private_demographics.gender, EXCLUDED.gender),
      updated_at = now();

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
