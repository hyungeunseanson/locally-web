BEGIN;

-- Close only legacy active requests whose full refund is already recorded.
UPDATE public.proxy_requests
SET status = 'CANCELLED'
WHERE payment_status = 'REFUNDED'
  AND status IN ('PENDING', 'IN_PROGRESS');

COMMIT;
