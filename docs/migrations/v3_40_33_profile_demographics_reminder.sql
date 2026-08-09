-- v3.40.33
-- Release B: enable the one-time reminder only after the compatible app is live.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_profile_demographics_required_user
  ON public.notifications (user_id)
  WHERE type = 'profile_demographics_required';

CREATE OR REPLACE FUNCTION public.ensure_profile_demographics_reminder(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT '/account?complete=demographics'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_demographics public.profile_private_demographics%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'DEMOGRAPHICS_REMINDER_FORBIDDEN' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.profile_private_demographics (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO v_demographics
  FROM public.profile_private_demographics
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_demographics.birth_date IS NOT NULL
     AND NULLIF(trim(v_demographics.gender), '') IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  IF v_demographics.reminder_sent_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, title, message, link, is_read, created_at
  ) VALUES (
    p_user_id,
    'profile_demographics_required',
    COALESCE(NULLIF(trim(p_title), ''), '예약 전 필수 정보를 입력해 주세요'),
    COALESCE(NULLIF(trim(p_message), ''), '생년월일과 성별을 입력하면 호스트가 체험을 더 잘 준비할 수 있습니다.'),
    COALESCE(NULLIF(trim(p_link), ''), '/account?complete=demographics'),
    FALSE,
    now()
  )
  ON CONFLICT (user_id) WHERE type = 'profile_demographics_required' DO NOTHING;

  UPDATE public.profile_private_demographics
  SET reminder_sent_at = now(), updated_at = now()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_profile_demographics_reminder(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile_demographics_reminder(UUID, TEXT, TEXT, TEXT)
  TO service_role;

WITH candidates AS (
  SELECT
    d.user_id,
    COALESCE(u.raw_user_meta_data->>'preferred_locale', 'ko') AS locale
  FROM public.profile_private_demographics AS d
  JOIN auth.users AS u ON u.id = d.user_id
  WHERE (d.birth_date IS NULL OR NULLIF(trim(d.gender), '') IS NULL)
    AND d.reminder_sent_at IS NULL
), inserted AS (
  INSERT INTO public.notifications (
    user_id, type, title, message, link, is_read, created_at
  )
  SELECT
    c.user_id,
    'profile_demographics_required',
    CASE c.locale
      WHEN 'en' THEN 'Complete your information before booking'
      WHEN 'ja' THEN '予約前に必須情報を入力してください'
      WHEN 'zh' THEN '请在预订前填写必要信息'
      ELSE '예약 전 필수 정보를 입력해 주세요'
    END,
    CASE c.locale
      WHEN 'en' THEN 'Your birth date and gender help the host prepare the experience appropriately.'
      WHEN 'ja' THEN '生年月日と性別を入力すると、ホストが体験を適切に準備できます。'
      WHEN 'zh' THEN '填写出生日期和性别后，体验达人可以更妥善地准备体验。'
      ELSE '생년월일과 성별을 입력하면 호스트가 체험을 더 잘 준비할 수 있습니다.'
    END,
    '/account?complete=demographics',
    FALSE,
    now()
  FROM candidates AS c
  ON CONFLICT (user_id) WHERE type = 'profile_demographics_required' DO NOTHING
  RETURNING user_id
)
UPDATE public.profile_private_demographics AS d
SET reminder_sent_at = now(), updated_at = now()
WHERE d.user_id IN (SELECT user_id FROM candidates);

CREATE OR REPLACE FUNCTION public.prune_notifications_retention(
  p_cutoff TIMESTAMPTZ,
  p_batch_size INTEGER DEFAULT 1000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_batch_size INTEGER;
  v_deleted_count INTEGER := 0;
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
      AND NOT (type = 'profile_demographics_required' AND is_read = FALSE)
    ORDER BY created_at ASC, id ASC
    LIMIT v_batch_size
  ), deleted_notifications AS (
    DELETE FROM public.notifications AS n
    USING deletion_candidates AS c
    WHERE n.id = c.id
    RETURNING n.id
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_count
  FROM deleted_notifications;

  RETURN COALESCE(v_deleted_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.prune_notifications_retention(TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_notifications_retention(TIMESTAMPTZ, INTEGER)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
