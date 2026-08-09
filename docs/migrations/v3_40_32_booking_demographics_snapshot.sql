-- v3.40.32
-- Release C schema compatibility: add host-safe booking snapshots before the
-- application release starts selecting these nullable columns.

BEGIN;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_age_band TEXT,
  ADD COLUMN IF NOT EXISTS guest_gender TEXT;

CREATE OR REPLACE FUNCTION public.snapshot_booking_guest_demographics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_birth_date DATE;
  v_age INTEGER;
  v_gender TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.birth_date, NULLIF(trim(d.gender), '')
  INTO v_birth_date, v_gender
  FROM public.profile_private_demographics AS d
  WHERE d.user_id = NEW.user_id;

  NEW.guest_gender := COALESCE(NEW.guest_gender, v_gender);

  IF NEW.guest_age_band IS NULL
     AND v_birth_date IS NOT NULL
     AND v_birth_date <= COALESCE(NEW.created_at::date, CURRENT_DATE) THEN
    v_age := GREATEST(
      0,
      date_part('year', age(COALESCE(NEW.created_at::date, CURRENT_DATE), v_birth_date))::INTEGER
    );
    NEW.guest_age_band := CASE
      WHEN v_age < 10 THEN 'under_10'
      WHEN v_age >= 80 THEN '80_plus'
      ELSE ((v_age / 10) * 10)::TEXT || 's'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_booking_guest_demographics_snapshot ON public.bookings;
CREATE TRIGGER set_booking_guest_demographics_snapshot
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_booking_guest_demographics();

REVOKE ALL ON FUNCTION public.snapshot_booking_guest_demographics()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_booking_guest_demographics()
  TO service_role;

WITH snapshots AS (
  SELECT
    b.id,
    NULLIF(trim(d.gender), '') AS gender,
    CASE
      WHEN d.birth_date IS NULL OR d.birth_date > COALESCE(b.created_at::date, CURRENT_DATE) THEN NULL
      WHEN date_part('year', age(COALESCE(b.created_at::date, CURRENT_DATE), d.birth_date)) < 10 THEN 'under_10'
      WHEN date_part('year', age(COALESCE(b.created_at::date, CURRENT_DATE), d.birth_date)) >= 80 THEN '80_plus'
      ELSE (
        (date_part('year', age(COALESCE(b.created_at::date, CURRENT_DATE), d.birth_date))::INTEGER / 10) * 10
      )::TEXT || 's'
    END AS age_band
  FROM public.bookings AS b
  JOIN public.profile_private_demographics AS d ON d.user_id = b.user_id
  WHERE b.guest_age_band IS NULL OR b.guest_gender IS NULL
)
UPDATE public.bookings AS b
SET guest_age_band = COALESCE(b.guest_age_band, s.age_band),
    guest_gender = COALESCE(b.guest_gender, s.gender)
FROM snapshots AS s
WHERE s.id = b.id;

NOTIFY pgrst, 'reload schema';

COMMIT;
