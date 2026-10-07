-- Monitor read authority only. Reuse the applied visible-message recency index.
BEGIN;
SET LOCAL lock_timeout = '2s';

CREATE FUNCTION public.list_admin_monitor_recency(
  p_offset integer DEFAULT 0, p_limit integer DEFAULT 100,
  p_inquiry_ids bigint[] DEFAULT NULL
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
  WHERE (i.type IS NULL OR i.type NOT IN ('admin', 'admin_support'))
    AND (p_inquiry_ids IS NULL OR i.id = ANY(p_inquiry_ids))
  ORDER BY activity_at DESC NULLS LAST, i.id DESC
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.list_admin_monitor_recency(integer,integer,bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_monitor_recency(integer,integer,bigint[]) TO service_role;
COMMIT;
