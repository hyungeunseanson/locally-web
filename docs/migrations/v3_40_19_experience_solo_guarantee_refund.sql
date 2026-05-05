-- v3.40.19 Experience solo guarantee refund tracking
-- Adds explicit lifecycle fields for the 30,000 KRW solo guarantee add-on refund.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS solo_guarantee_refund_status text NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS solo_guarantee_refund_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS solo_guarantee_refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS solo_guarantee_refund_error text,
  ADD COLUMN IF NOT EXISTS solo_guarantee_refund_trigger_booking_id text;

UPDATE public.bookings
   SET solo_guarantee_refund_status = COALESCE(NULLIF(solo_guarantee_refund_status, ''), 'not_applicable'),
       solo_guarantee_refund_amount = COALESCE(solo_guarantee_refund_amount, 0)
 WHERE solo_guarantee_refund_status IS NULL
    OR solo_guarantee_refund_status = ''
    OR solo_guarantee_refund_amount IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'bookings_solo_guarantee_refund_status_check'
       AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_solo_guarantee_refund_status_check
      CHECK (
        solo_guarantee_refund_status IN (
          'not_applicable',
          'processing',
          'pending_manual',
          'refunded',
          'failed'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'bookings_solo_guarantee_refund_amount_check'
       AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_solo_guarantee_refund_amount_check
      CHECK (
        solo_guarantee_refund_amount >= 0
        AND solo_guarantee_refund_amount <= 30000
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_solo_guarantee_refund_slot
  ON public.bookings(experience_id, date, time, solo_guarantee_refund_status)
  WHERE solo_guarantee_price > 0
    AND status = 'completed'
    AND solo_guarantee_refund_status IN ('not_applicable', 'failed');

CREATE INDEX IF NOT EXISTS idx_bookings_solo_guarantee_refund_ops
  ON public.bookings(solo_guarantee_refund_status, created_at)
  WHERE solo_guarantee_refund_status IN ('processing', 'pending_manual', 'failed');
