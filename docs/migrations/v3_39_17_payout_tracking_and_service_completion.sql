-- v3.39.17
-- Add payout completion timestamps and supporting indexes for payout / completion flows.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payout_paid_at TIMESTAMPTZ;

ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS payout_paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_payout_status_paid_at
  ON public.bookings(payout_status, payout_paid_at);

CREATE INDEX IF NOT EXISTS idx_service_bookings_payout_status_paid_at
  ON public.service_bookings(payout_status, payout_paid_at);
