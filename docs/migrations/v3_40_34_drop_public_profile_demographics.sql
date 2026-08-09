-- v3.40.34
-- Cleanup only: apply after every application consumer has moved to
-- profile_private_demographics and the compatibility release is verified.

BEGIN;

DROP TRIGGER IF EXISTS sync_profile_private_demographics ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_profile_private_demographics_from_profile();

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
      id, email, full_name, avatar_url, phone, nationality
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      NULLIF(NEW.raw_user_meta_data->>'phone', ''),
      NULLIF(NEW.raw_user_meta_data->>'nationality', '')
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
  VALUES (NEW.id, v_birth_date, v_gender)
  ON CONFLICT (user_id) DO UPDATE
  SET birth_date = COALESCE(profile_private_demographics.birth_date, EXCLUDED.birth_date),
      gender = COALESCE(profile_private_demographics.gender, EXCLUDED.gender),
      updated_at = now();

  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS birth_date,
  DROP COLUMN IF EXISTS gender;

NOTIFY pgrst, 'reload schema';

COMMIT;
