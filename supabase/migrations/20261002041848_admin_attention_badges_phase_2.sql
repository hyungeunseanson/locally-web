-- PREPARED ONLY. Do not apply to Production as part of this PR.
-- Preserve Phase 1 write lockdown, participant receipts and support reopen triggers.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_admin_inquiry_activity(p_inquiry_ids bigint[])
RETURNS TABLE(inquiry_id bigint, status text, updated_at timestamptz, last_message_at timestamptz, last_sender_role text,
  last_message_content text, needs_reply boolean, reply_waiting_since timestamptz,
  support_reopened_at timestamptz, admin_unread_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH messages AS (
    SELECT m.*, i.type AS inquiry_type,
      CASE WHEN private.is_inquiry_admin_sender(m.sender_id) THEN 'admin'
        WHEN i.type IN ('admin', 'admin_support') THEN 'customer'
        WHEN m.sender_id = i.host_id THEN 'host' ELSE 'customer' END AS sender_role
    FROM public.inquiry_messages m JOIN public.inquiries i ON i.id = m.inquiry_id
    WHERE i.id = ANY(p_inquiry_ids) AND m.type IS DISTINCT FROM 'deleted'
  )
  SELECT i.id, i.status, i.updated_at, latest.created_at, latest.sender_role,
    CASE WHEN latest.type = 'image' THEN '📷 사진을 보냈습니다.' ELSE latest.content END,
    coalesce(i.type IN ('admin', 'admin_support') AND i.status IS DISTINCT FROM 'resolved' AND latest.sender_role = 'customer', false),
    CASE WHEN i.status IS DISTINCT FROM 'resolved' AND latest.sender_role = 'customer' THEN waiting.since END,
    i.support_reopened_at, coalesce(unread.cnt, 0)
  FROM public.inquiries i
  LEFT JOIN LATERAL (SELECT * FROM messages m WHERE m.inquiry_id = i.id ORDER BY m.id DESC LIMIT 1) latest ON true
  LEFT JOIN LATERAL (
    SELECT m.created_at AS since FROM messages m WHERE m.inquiry_id = i.id AND m.sender_role = 'customer'
      AND m.id > coalesce((SELECT max(a.id) FROM messages a WHERE a.inquiry_id = i.id AND a.sender_role = 'admin'), 0)
    ORDER BY m.id ASC LIMIT 1
  ) waiting ON true
  LEFT JOIN LATERAL (SELECT count(*) AS cnt FROM messages m WHERE m.inquiry_id = i.id AND m.sender_role <> 'admin' AND m.admin_read_at IS NULL) unread ON true
  WHERE i.id = ANY(p_inquiry_ids);
$$;
REVOKE ALL ON FUNCTION public.get_admin_inquiry_activity(bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_inquiry_activity(bigint[]) TO service_role;

CREATE OR REPLACE FUNCTION public.ack_admin_inquiry_messages(p_inquiry_id bigint, p_through_message_id bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inquiries i JOIN public.inquiry_messages m ON m.inquiry_id = i.id
    WHERE i.id = p_inquiry_id AND m.id = p_through_message_id) THEN
    RAISE EXCEPTION 'Invalid administrative acknowledgement';
  END IF;
  UPDATE public.inquiry_messages m SET admin_read_at = clock_timestamp()
  WHERE m.inquiry_id = p_inquiry_id AND m.id <= p_through_message_id AND m.admin_read_at IS NULL
    AND m.type IS DISTINCT FROM 'deleted' AND NOT private.is_inquiry_admin_sender(m.sender_id);
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.ack_admin_inquiry_messages(bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_admin_inquiry_messages(bigint, bigint) TO service_role;


-- Exact rendered IDs also protect against a lower-ID transaction committing late.
CREATE OR REPLACE FUNCTION public.ack_admin_inquiry_snapshot(p_inquiry_id bigint, p_message_ids bigint[])
RETURNS TABLE(changed bigint, admin_unread_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE affected bigint;
BEGIN
  IF coalesce(cardinality(p_message_ids), 0) = 0 OR cardinality(p_message_ids) > 10000
    OR array_position(p_message_ids, NULL) IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.inquiries WHERE id = p_inquiry_id)
    OR EXISTS (SELECT 1 FROM unnest(p_message_ids) x(id) WHERE NOT EXISTS
      (SELECT 1 FROM public.inquiry_messages m WHERE m.id = x.id AND m.inquiry_id = p_inquiry_id)) THEN
    RAISE EXCEPTION 'Invalid administrative snapshot';
  END IF;
  UPDATE public.inquiry_messages m SET admin_read_at = clock_timestamp()
    WHERE m.inquiry_id = p_inquiry_id AND m.id = ANY(p_message_ids)
      AND m.admin_read_at IS NULL AND m.type IS DISTINCT FROM 'deleted'
      AND NOT private.is_inquiry_admin_sender(m.sender_id);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN QUERY SELECT affected, count(*) FROM public.inquiry_messages m
    WHERE m.inquiry_id = p_inquiry_id AND m.admin_read_at IS NULL
      AND m.type IS DISTINCT FROM 'deleted' AND NOT private.is_inquiry_admin_sender(m.sender_id);
END $$;
REVOKE ALL ON FUNCTION public.ack_admin_inquiry_snapshot(bigint, bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_admin_inquiry_snapshot(bigint, bigint[]) TO service_role;

-- JSON aggregate avoids PostgREST row caps. A delta scans only the requested IDs.
-- Phone classification mirrors validLinkedRequest: exactly one formal row, same
-- customer, support type. Broken/duplicate links remain in support, never both.
CREATE OR REPLACE FUNCTION public.get_admin_attention(p_inquiry_ids bigint[] DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH candidates AS (
    SELECT i.id FROM public.inquiries i
    WHERE (p_inquiry_ids IS NOT NULL AND i.id = ANY(p_inquiry_ids))
      OR (p_inquiry_ids IS NULL AND EXISTS (SELECT 1 FROM public.inquiry_messages m
        WHERE m.inquiry_id = i.id AND m.admin_read_at IS NULL AND m.type IS DISTINCT FROM 'deleted'
          AND NOT private.is_inquiry_admin_sender(m.sender_id)))
  ), activity AS (
    SELECT * FROM public.get_admin_inquiry_activity(ARRAY(SELECT id FROM candidates))
  ), rows AS (
    SELECT a.*, coalesce(latest.id, 0)::text AS last_message_id,
      CASE WHEN i.type IN ('admin', 'admin_support') THEN
        CASE WHEN links.n = 1 AND links.user_id = i.user_id::text THEN 'phone' ELSE 'support' END
        ELSE 'monitor' END AS surface
    FROM activity a JOIN public.inquiries i ON i.id = a.inquiry_id
    LEFT JOIN LATERAL (SELECT max(m.id) AS id FROM public.inquiry_messages m
      WHERE m.inquiry_id = i.id AND m.type IS DISTINCT FROM 'deleted') latest ON true
    LEFT JOIN LATERAL (SELECT count(*) AS n, min(p.user_id::text) AS user_id FROM public.proxy_requests p
      WHERE p.form_data->>'linked_inquiry_id' = i.id::text
        AND p.form_data->>'__proxy_card_anchor' IS DISTINCT FROM 'v1') links ON true
  ) SELECT coalesce(jsonb_agg(to_jsonb(rows) ORDER BY inquiry_id), '[]'::jsonb) FROM rows;
$$;
REVOKE ALL ON FUNCTION public.get_admin_attention(bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_attention(bigint[]) TO service_role;

CREATE INDEX IF NOT EXISTS inquiry_messages_admin_unseen_idx ON public.inquiry_messages(inquiry_id, id)
  WHERE admin_read_at IS NULL AND type IS DISTINCT FROM 'deleted';
COMMIT;
