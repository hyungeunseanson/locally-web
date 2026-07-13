-- v3.40.24
-- Enforce one public review per booking, including concurrent review requests.

BEGIN;

-- Keep the duplicate check and index creation atomic with respect to review writes.
LOCK TABLE public.reviews IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  booking_id_attnum SMALLINT;
  has_equivalent_unique_index BOOLEAN;
BEGIN
  SELECT attnum
  INTO booking_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.reviews'::regclass
    AND attname = 'booking_id'
    AND NOT attisdropped;

  IF booking_id_attnum IS NULL THEN
    RAISE EXCEPTION 'public.reviews.booking_id is required before adding the review uniqueness guard';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index AS index_row
    WHERE index_row.indrelid = 'public.reviews'::regclass
      AND index_row.indisunique
      AND index_row.indnkeyatts = 1
      AND index_row.indkey[0] = booking_id_attnum
  )
  INTO has_equivalent_unique_index;

  IF has_equivalent_unique_index THEN
    RETURN;
  END IF;

  IF to_regclass('public.reviews_booking_id_unique_idx') IS NOT NULL THEN
    RAISE EXCEPTION 'public.reviews_booking_id_unique_idx exists but does not enforce unique booking_id values';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reviews
    WHERE booking_id IS NOT NULL
    GROUP BY booking_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one public review per booking while duplicate reviews.booking_id values exist';
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX reviews_booking_id_unique_idx ON public.reviews (booking_id)';
END
$$;

COMMIT;
