-- v3.40.06
-- Team Workspace non-chat retention RPCs.

CREATE OR REPLACE FUNCTION public.prune_team_workspace_tasks(
  p_keep_limit integer DEFAULT 100
)
RETURNS TABLE(
  task_id uuid,
  task_type text,
  task_content text,
  comment_image_urls jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('team_workspace_tasks_retention_v1'));

  RETURN QUERY
  WITH overflow AS (
    SELECT id, type, content
    FROM public.admin_tasks
    ORDER BY created_at DESC, id DESC
    OFFSET GREATEST(COALESCE(p_keep_limit, 100), 0)
  ),
  task_assets AS (
    SELECT
      o.id AS task_id,
      o.type::text AS task_type,
      o.content::text AS task_content,
      COALESCE(
        jsonb_agg(c.metadata ->> 'image_url')
          FILTER (
            WHERE c.metadata IS NOT NULL
              AND jsonb_typeof(c.metadata) = 'object'
              AND COALESCE(c.metadata ->> 'image_url', '') <> ''
          ),
        '[]'::jsonb
      ) AS comment_image_urls
    FROM overflow o
    LEFT JOIN public.admin_task_comments c
      ON c.task_id = o.id
    GROUP BY o.id, o.type, o.content
  ),
  deleted_comments AS (
    DELETE FROM public.admin_task_comments c
    USING overflow o
    WHERE c.task_id = o.id
    RETURNING c.id
  ),
  deleted_tasks AS (
    DELETE FROM public.admin_tasks t
    USING overflow o
    WHERE t.id = o.id
    RETURNING t.id
  )
  SELECT
    a.task_id,
    a.task_type,
    a.task_content,
    a.comment_image_urls
  FROM task_assets a
  JOIN deleted_tasks d
    ON d.id = a.task_id;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_team_workspace_tasks(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_team_workspace_tasks(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.prune_team_workspace_comments(
  p_task_id uuid,
  p_keep_limit integer DEFAULT 100
)
RETURNS TABLE(
  comment_id uuid,
  image_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('team_workspace_comments_retention_v1'),
    hashtext(COALESCE(p_task_id::text, ''))
  );

  RETURN QUERY
  WITH overflow AS (
    SELECT id
    FROM public.admin_task_comments
    WHERE task_id = p_task_id
    ORDER BY created_at DESC, id DESC
    OFFSET GREATEST(COALESCE(p_keep_limit, 100), 0)
  ),
  deleted_comments AS (
    DELETE FROM public.admin_task_comments c
    USING overflow o
    WHERE c.id = o.id
    RETURNING c.id, c.metadata
  )
  SELECT
    d.id AS comment_id,
    CASE
      WHEN d.metadata IS NOT NULL
        AND jsonb_typeof(d.metadata) = 'object'
        AND COALESCE(d.metadata ->> 'image_url', '') <> ''
      THEN d.metadata ->> 'image_url'
      ELSE NULL
    END AS image_url
  FROM deleted_comments d;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_team_workspace_comments(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_team_workspace_comments(uuid, integer) TO service_role;
