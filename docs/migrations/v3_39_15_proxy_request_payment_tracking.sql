-- v3.39.15
-- Phone reservation payment tracking fields for card refund / payment audit

ALTER TABLE public.proxy_requests
  ADD COLUMN IF NOT EXISTS tid TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_proxy_requests_locally_order_id
  ON public.proxy_requests(locally_order_id)
  WHERE locally_order_id IS NOT NULL;
