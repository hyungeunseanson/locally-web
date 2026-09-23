CREATE OR REPLACE FUNCTION public.get_ops_anomaly_snapshot(
  p_observed_at timestamptz DEFAULT now(),
  p_claim_overdue_minutes integer DEFAULT 45,
  p_refund_stale_minutes integer DEFAULT 30,
  p_payout_long_hold_days integer DEFAULT 90,
  p_experience_job_missing_minutes integer DEFAULT 180,
  p_service_job_missing_minutes integer DEFAULT 180,
  p_cancel_pending_job_missing_minutes integer DEFAULT 75
)
RETURNS TABLE (
  diagnostic_code text,
  anomaly_count bigint,
  oldest_observed_at timestamptz,
  aggregate_details jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
WITH
normalized_thresholds AS (
  SELECT
    least(greatest(coalesce(p_claim_overdue_minutes, 45), 15), 1440) AS claim_overdue_minutes,
    least(greatest(coalesce(p_refund_stale_minutes, 30), 15), 1440) AS refund_stale_minutes,
    least(greatest(coalesce(p_payout_long_hold_days, 90), 30), 365) AS payout_long_hold_days,
    least(greatest(coalesce(p_experience_job_missing_minutes, 180), 30), 1440) AS experience_job_missing_minutes,
    least(greatest(coalesce(p_service_job_missing_minutes, 180), 30), 1440) AS service_job_missing_minutes,
    least(greatest(coalesce(p_cancel_pending_job_missing_minutes, 75), 30), 1440) AS cancel_pending_job_missing_minutes
),
payment_reconciliation AS (
  SELECT
    count(*)::bigint AS anomaly_count,
    min(coalesce(b.payment_claim_expires_at, b.created_at)) AS oldest_observed_at
  FROM public.bookings b
  WHERE b.payment_claim_state = 'reconciliation_required'
),
payment_inconsistent_rows AS (
  SELECT
    b.id,
    b.created_at,
    b.payment_claim_expires_at,
    (lower(coalesce(b.status, '')) = 'pending' AND b.tid IS NOT NULL) AS pending_with_tid,
    (
      lower(coalesce(b.status, '')) IN ('paid', 'confirmed', 'completed')
      AND lower(coalesce(b.payment_method, '')) IN ('card', 'paypal')
      AND b.tid IS NULL
    ) AS paid_without_tid,
    (b.payment_claim_state = 'completed' AND b.tid IS NULL) AS completed_claim_without_tid,
    (
      b.payment_claim_state IN ('claimed', 'processing')
      AND b.payment_claim_expires_at < p_observed_at
        - make_interval(mins => (SELECT claim_overdue_minutes FROM normalized_thresholds))
    ) AS overdue_claim
  FROM public.bookings b
),
payment_inconsistent AS (
  SELECT
    count(*)::bigint AS anomaly_count,
    min(coalesce(payment_claim_expires_at, created_at)) AS oldest_observed_at,
    jsonb_build_object(
      'pending_with_tid', count(*) FILTER (WHERE pending_with_tid),
      'paid_without_tid', count(*) FILTER (WHERE paid_without_tid),
      'completed_claim_without_tid', count(*) FILTER (WHERE completed_claim_without_tid),
      'overdue_claim', count(*) FILTER (WHERE overdue_claim)
    ) AS aggregate_details
  FROM payment_inconsistent_rows
  WHERE pending_with_tid
     OR paid_without_tid
     OR completed_claim_without_tid
     OR overdue_claim
),
latest_service_refund AS (
  SELECT DISTINCT ON (operation.booking_id)
    operation.booking_id,
    operation.status,
    operation.created_at,
    operation.updated_at
  FROM public.service_refund_operations operation
  ORDER BY operation.booking_id, operation.created_at DESC
),
refund_attention_rows AS (
  SELECT
    latest.created_at AS observed_at,
    'service_refund_operation'::text AS source
  FROM latest_service_refund latest
  WHERE latest.status <> 'applied'
    AND latest.updated_at < p_observed_at
      - make_interval(mins => (SELECT refund_stale_minutes FROM normalized_thresholds))

  UNION ALL

  SELECT
    booking.created_at AS observed_at,
    'experience_solo_refund'::text AS source
  FROM public.bookings booking
  WHERE booking.solo_guarantee_refund_status IN ('failed', 'pending_manual')
),
refund_attention AS (
  SELECT
    count(*)::bigint AS anomaly_count,
    min(observed_at) AS oldest_observed_at,
    jsonb_build_object(
      'service_refund_operations', count(*) FILTER (WHERE source = 'service_refund_operation'),
      'experience_solo_refunds', count(*) FILTER (WHERE source = 'experience_solo_refund')
    ) AS aggregate_details
  FROM refund_attention_rows
),
experience_payout_attention AS (
  SELECT
    booking.id,
    booking.created_at AS observed_at,
    (
      lower(coalesce(booking.payout_status, '')) = 'pending'
      AND coalesce(booking.host_payout_amount, 0) > 0
      AND booking.created_at < p_observed_at
        - make_interval(days => (SELECT payout_long_hold_days FROM normalized_thresholds))
    ) AS aged,
    (lower(coalesce(booking.payout_status, '')) = 'failed') AS failed,
    (
      lower(coalesce(booking.status, '')) = 'completed'
      AND (booking.host_payout_amount IS NULL OR booking.host_payout_amount <= 0)
    ) AS missing_finance
  FROM public.bookings booking
  WHERE lower(coalesce(booking.status, '')) IN ('completed', 'cancelled')
),
service_payout_attention AS (
  SELECT
    booking.id,
    coalesce(request.service_end_at, booking.created_at) AS observed_at,
    (
      lower(coalesce(booking.payout_status, '')) = 'pending'
      AND CASE
        WHEN lower(coalesce(booking.status, '')) = 'cancelled'
          THEN coalesce(booking.host_compensation_amount, 0)
        ELSE coalesce(booking.host_payout_amount, 0)
      END > 0
      AND coalesce(request.service_end_at, booking.created_at) < p_observed_at
        - make_interval(days => (SELECT payout_long_hold_days FROM normalized_thresholds))
    ) AS aged,
    (lower(coalesce(booking.payout_status, '')) = 'failed') AS failed,
    (
      lower(coalesce(booking.status, '')) = 'completed'
      AND (
        booking.host_id IS NULL
        OR booking.host_payout_amount IS NULL
        OR booking.host_payout_amount <= 0
      )
    ) AS missing_finance
  FROM public.service_bookings booking
  LEFT JOIN public.service_requests request ON request.id = booking.request_id
  WHERE lower(coalesce(booking.status, '')) IN ('completed', 'cancelled')
),
payout_attention_rows AS (
  SELECT observed_at, aged, failed, missing_finance, 'experience'::text AS source
  FROM experience_payout_attention
  WHERE aged OR failed OR missing_finance

  UNION ALL

  SELECT observed_at, aged, failed, missing_finance, 'service'::text AS source
  FROM service_payout_attention
  WHERE aged OR failed OR missing_finance
),
payout_attention AS (
  SELECT
    count(*)::bigint AS anomaly_count,
    min(observed_at) AS oldest_observed_at,
    jsonb_build_object(
      'aged', count(*) FILTER (WHERE aged),
      'failed', count(*) FILTER (WHERE failed),
      'missing_finance', count(*) FILTER (WHERE missing_finance),
      'experience', count(*) FILTER (WHERE source = 'experience'),
      'service', count(*) FILTER (WHERE source = 'service')
    ) AS aggregate_details
  FROM payout_attention_rows
),
latest_job AS (
  SELECT DISTINCT ON (run.job_name)
    run.job_name,
    run.status,
    run.started_at,
    run.lease_expires_at
  FROM public.admin_job_runs run
  WHERE run.job_name <> 'ops_anomaly_monitor'
  ORDER BY run.job_name, run.started_at DESC
),
expected_jobs(job_name, missing_after_minutes) AS (
  VALUES
    ('experience_completion_sync'::text, (SELECT experience_job_missing_minutes FROM normalized_thresholds)),
    ('service_completion_sync'::text, (SELECT service_job_missing_minutes FROM normalized_thresholds)),
    ('cancel_pending_bookings'::text, (SELECT cancel_pending_job_missing_minutes FROM normalized_thresholds))
),
job_attention_rows AS (
  SELECT
    coalesce(latest.started_at, p_observed_at - make_interval(mins => expected.missing_after_minutes)) AS observed_at,
    (latest.job_name IS NULL OR latest.started_at < p_observed_at - make_interval(mins => expected.missing_after_minutes)) AS missing,
    (latest.status IN ('failed', 'abandoned')) AS failed,
    (
      latest.status = 'running'
      AND coalesce(latest.lease_expires_at, latest.started_at) < p_observed_at
    ) AS stale
  FROM expected_jobs expected
  LEFT JOIN latest_job latest ON latest.job_name = expected.job_name
  WHERE latest.job_name IS NULL
     OR latest.started_at < p_observed_at - make_interval(mins => expected.missing_after_minutes)
     OR latest.status IN ('failed', 'abandoned')
     OR (
       latest.status = 'running'
       AND coalesce(latest.lease_expires_at, latest.started_at) < p_observed_at
     )

),
job_attention AS (
  SELECT
    count(*)::bigint AS anomaly_count,
    min(observed_at) AS oldest_observed_at,
    jsonb_build_object(
      'missing', count(*) FILTER (WHERE missing),
      'failed', count(*) FILTER (WHERE failed),
      'stale', count(*) FILTER (WHERE stale)
    ) AS aggregate_details
  FROM job_attention_rows
)
SELECT
  'payment_reconciliation_required'::text,
  anomaly_count,
  oldest_observed_at,
  '{}'::jsonb
FROM payment_reconciliation
WHERE anomaly_count > 0

UNION ALL

SELECT
  'payment_state_inconsistent'::text,
  anomaly_count,
  oldest_observed_at,
  aggregate_details
FROM payment_inconsistent
WHERE anomaly_count > 0

UNION ALL

SELECT
  'refund_attention_required'::text,
  anomaly_count,
  oldest_observed_at,
  aggregate_details
FROM refund_attention
WHERE anomaly_count > 0

UNION ALL

SELECT
  'payout_attention_required'::text,
  anomaly_count,
  oldest_observed_at,
  aggregate_details
FROM payout_attention
WHERE anomaly_count > 0

UNION ALL

SELECT
  'job_stale_or_failed'::text,
  anomaly_count,
  oldest_observed_at,
  aggregate_details
FROM job_attention
WHERE anomaly_count > 0;
$function$;

REVOKE ALL ON FUNCTION public.get_ops_anomaly_snapshot(
  timestamptz, integer, integer, integer, integer, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ops_anomaly_snapshot(
  timestamptz, integer, integer, integer, integer, integer, integer
) TO service_role;
