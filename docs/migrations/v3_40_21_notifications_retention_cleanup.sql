-- v3.40.21
-- Notification retention cleanup RPC.

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications (created_at);

CREATE OR REPLACE FUNCTION public.prune_notifications_retention(
  p_cutoff timestamptz,
  p_batch_size integer DEFAULT 1000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_size integer;
  v_deleted_count integer := 0;
BEGIN
  IF p_cutoff IS NULL THEN
    RAISE EXCEPTION 'p_cutoff is required';
  END IF;

  v_batch_size := LEAST(GREATEST(COALESCE(p_batch_size, 1000), 1), 5000);

  PERFORM pg_advisory_xact_lock(hashtext('notifications_retention_cleanup_v1'));

  WITH deletion_candidates AS (
    SELECT id
    FROM public.notifications
    WHERE created_at < p_cutoff
    ORDER BY created_at ASC, id ASC
    LIMIT v_batch_size
  ),
  deleted_notifications AS (
    DELETE FROM public.notifications n
    USING deletion_candidates c
    WHERE n.id = c.id
    RETURNING n.id
  )
  SELECT COUNT(*)::integer
  INTO v_deleted_count
  FROM deleted_notifications;

  RETURN COALESCE(v_deleted_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.prune_notifications_retention(timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_notifications_retention(timestamptz, integer) TO service_role;
