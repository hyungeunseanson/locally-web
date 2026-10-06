-- Read-only list authority. No parent timestamps, receipts, tasks or business writes.
BEGIN;
SET LOCAL lock_timeout = '2s';

CREATE INDEX admin_chat_visible_message_recency
  ON public.inquiry_messages (inquiry_id, created_at DESC, id DESC)
  WHERE coalesce(type, 'text') IN ('text', 'image');

-- API scans bounded, globally ordered candidates, then applies the existing
-- phone-link/operational filters BEFORE its response offset/limit.
-- Text IDs preserve bigint precision across the JSON boundary.
CREATE FUNCTION public.list_admin_support_recency(
  p_offset integer DEFAULT 0, p_limit integer DEFAULT 100,
  p_status text DEFAULT NULL, p_inquiry_ids bigint[] DEFAULT NULL
)
RETURNS TABLE(id text, canonical_activity_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT i.id::text, coalesce(m.created_at, i.created_at) AS activity_at
  FROM public.inquiries i
  LEFT JOIN LATERAL (
    SELECT im.created_at FROM public.inquiry_messages im
    WHERE im.inquiry_id = i.id AND coalesce(im.type, 'text') IN ('text', 'image')
    ORDER BY im.created_at DESC, im.id DESC LIMIT 1
  ) m ON true
  WHERE i.type IN ('admin', 'admin_support')
    AND (p_inquiry_ids IS NULL OR i.id = ANY(p_inquiry_ids))
    AND (p_status IS NULL OR (p_status = 'open' AND coalesce(i.status, 'open') = 'open') OR i.status = p_status)
  ORDER BY activity_at DESC NULLS LAST, i.id DESC
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

CREATE FUNCTION public.list_admin_phone_recency(p_offset integer DEFAULT 0, p_limit integer DEFAULT 100)
RETURNS TABLE(id text, canonical_activity_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT p.id::text, coalesce(m.created_at, p.created_at) AS activity_at
  FROM public.proxy_requests p
  LEFT JOIN public.inquiries i ON i.id::text = p.form_data->>'linked_inquiry_id'
    AND i.user_id = p.user_id AND i.type IN ('admin', 'admin_support')
    AND (SELECT count(*) FROM public.proxy_requests other
      WHERE (other.form_data->>'__proxy_card_anchor') IS DISTINCT FROM 'v1'
        AND other.form_data->>'linked_inquiry_id' = i.id::text) = 1
  LEFT JOIN LATERAL (
    SELECT im.created_at FROM public.inquiry_messages im
    WHERE im.inquiry_id = i.id AND coalesce(im.type, 'text') IN ('text', 'image')
    ORDER BY im.created_at DESC, im.id DESC LIMIT 1
  ) m ON true
  WHERE (p.form_data->>'__proxy_card_anchor') IS DISTINCT FROM 'v1'
  ORDER BY activity_at DESC NULLS LAST, p.id DESC
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.list_admin_support_recency(integer,integer,text,bigint[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_admin_phone_recency(integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_support_recency(integer,integer,text,bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_admin_phone_recency(integer,integer) TO service_role;
COMMIT;
