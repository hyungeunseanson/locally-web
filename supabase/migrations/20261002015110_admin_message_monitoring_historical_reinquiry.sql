-- Reviewed repair only; never infer a completion time from updated_at.
-- Apply after Phase 1. This file is intentionally not applied to Production.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $repair$
DECLARE
  candidate record;
  evidence record;
BEGIN
  -- Use the same parent lock as the future customer-message trigger. Recheck
  -- evidence after acquiring it, so sends/completions cannot race this repair.
  FOR candidate IN
    SELECT i.id FROM public.inquiries i
    WHERE i.status = 'resolved' AND i.type IN ('admin', 'admin_support')
    ORDER BY i.id FOR UPDATE
  LOOP
    SELECT a.id AS resolved_audit_id, a.created_at AS resolved_at,
           m.id AS last_customer_message_id, m.created_at AS last_customer_at,
           first_customer.id AS first_customer_message_id,
           first_customer.created_at AS reopened_at
    INTO evidence
    FROM public.inquiries i
    JOIN LATERAL (
      -- Latest status decision must itself be a dated completion. A later
      -- open/in-progress decision or undated record makes the evidence unsafe.
      SELECT l.id, l.created_at, l.details
      FROM public.admin_audit_logs l
      WHERE l.action_type = 'ADMIN_INQUIRY_STATUS_UPDATE'
        AND l.target_type = 'inquiries' AND l.target_id = i.id::text
      ORDER BY l.created_at DESC NULLS FIRST, l.id DESC LIMIT 1
    ) a ON a.created_at IS NOT NULL AND a.details->>'after_status' = 'resolved'
    JOIN LATERAL (
      SELECT msg.id, msg.sender_id, msg.created_at
      FROM public.inquiry_messages msg
      WHERE msg.inquiry_id = i.id AND msg.type IS DISTINCT FROM 'deleted'
      ORDER BY msg.id DESC LIMIT 1
    ) m ON m.created_at > a.created_at AND m.created_at <= statement_timestamp()
      AND m.sender_id IN (i.user_id, i.host_id)
      AND NOT private.is_inquiry_admin_sender(m.sender_id)
    JOIN LATERAL (
      SELECT msg.id, msg.created_at
      FROM public.inquiry_messages msg
      WHERE msg.inquiry_id = i.id AND msg.type IS DISTINCT FROM 'deleted'
        AND msg.created_at > a.created_at AND msg.created_at <= m.created_at
        AND msg.sender_id IN (i.user_id, i.host_id)
        AND NOT private.is_inquiry_admin_sender(msg.sender_id)
      ORDER BY msg.created_at, msg.id LIMIT 1
    ) first_customer ON true
    WHERE i.id = candidate.id AND i.status = 'resolved'
      AND i.type IN ('admin', 'admin_support')
      -- Exclude an unlogged later completion and inconsistent message ordering.
      AND i.updated_at IS NOT NULL AND i.updated_at <= m.created_at
      AND NOT EXISTS (
        SELECT 1 FROM public.inquiry_messages msg
        WHERE msg.inquiry_id = i.id AND msg.type IS DISTINCT FROM 'deleted'
          AND (msg.created_at IS NULL OR msg.created_at > m.created_at)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.admin_audit_logs l
        WHERE l.action_type = 'ADMIN_INQUIRY_STATUS_UPDATE'
          AND l.target_type = 'inquiries' AND l.target_id = i.id::text
          AND l.created_at = a.created_at
          AND l.details->>'after_status' IS DISTINCT FROM 'resolved'
      );

    IF FOUND THEN
      UPDATE public.inquiries
      SET status = 'open', support_reopened_at = evidence.reopened_at,
          updated_at = clock_timestamp()
      WHERE id = candidate.id AND status = 'resolved';
      -- Record the evidence atomically; do not invent an admin actor. Reruns
      -- skip the now-open row, so neither data nor audit records are duplicated.
      INSERT INTO public.admin_audit_logs(action_type, target_type, target_id, details)
      VALUES ('ADMIN_INQUIRY_HISTORICAL_REOPEN', 'inquiries', candidate.id::text,
        jsonb_build_object(
          'migration', '20261002015110_admin_message_monitoring_historical_reinquiry',
          'before_status', 'resolved', 'after_status', 'open',
          'resolved_audit_id', evidence.resolved_audit_id,
          'resolved_at', evidence.resolved_at,
          'first_customer_message_id', evidence.first_customer_message_id,
          'support_reopened_at', evidence.reopened_at,
          'last_customer_message_id', evidence.last_customer_message_id,
          'last_customer_at', evidence.last_customer_at
        ));
    END IF;
  END LOOP;
END
$repair$;
COMMIT;
