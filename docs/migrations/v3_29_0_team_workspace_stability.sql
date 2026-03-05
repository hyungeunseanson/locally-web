-- ============================================================
-- v3.29.0 Team Workspace Stability & Performance
-- ============================================================
-- 실행: Supabase SQL Editor
-- 내용:
-- 1) 댓글 중복 방지용 client_nonce + unique index
-- 2) 팀 채팅 읽음 일괄 처리 RPC(mark_room_messages_read)
-- ============================================================

-- 1) 댓글 중복 방지 키
ALTER TABLE public.admin_task_comments
ADD COLUMN IF NOT EXISTS client_nonce TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS admin_task_comments_author_task_nonce_uniq
ON public.admin_task_comments (author_id, task_id, client_nonce)
WHERE client_nonce IS NOT NULL;

-- 2) 읽음 처리 일괄 RPC
CREATE OR REPLACE FUNCTION public.mark_room_messages_read(
  p_room_id UUID,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  UPDATE public.admin_task_comments
  SET read_by = CASE
    WHEN read_by IS NULL THEN ARRAY[p_user_id::TEXT]
    WHEN NOT (p_user_id::TEXT = ANY(read_by)) THEN array_append(read_by, p_user_id::TEXT)
    ELSE read_by
  END
  WHERE task_id = p_room_id
    AND author_id <> p_user_id
    AND (read_by IS NULL OR NOT (p_user_id::TEXT = ANY(read_by)));

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_room_messages_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_room_messages_read(UUID, UUID) TO service_role;
