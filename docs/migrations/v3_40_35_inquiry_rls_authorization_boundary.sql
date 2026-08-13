-- v3.40.35
-- Restrict inquiry reads to participants/admins and make message writes server-only.

BEGIN;

DO $$
DECLARE
  inquiry_select_policies text[];
  message_select_policies text[];
  message_insert_policies text[];
  legacy_state boolean;
  target_state boolean;
BEGIN
  IF to_regclass('public.inquiries') IS NULL
    OR to_regclass('public.inquiry_messages') IS NULL
  THEN
    RAISE EXCEPTION 'Required inquiry tables are missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN ('inquiries', 'inquiry_messages')
      AND NOT relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS must already be enabled on inquiry tables';
  END IF;

  IF to_regprocedure('public.is_admin_reader()') IS NULL THEN
    RAISE EXCEPTION 'Required admin authorization helper is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = to_regprocedure('public.is_admin_reader()')::oid
      AND prosecdef
      AND provolatile = 's'
  ) THEN
    RAISE EXCEPTION 'is_admin_reader() must remain STABLE SECURITY DEFINER';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    to_regprocedure('public.is_admin_reader()')::oid,
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated cannot execute is_admin_reader()';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.inquiry_messages', 'INSERT') THEN
    RAISE EXCEPTION 'service_role must retain inquiry_messages INSERT';
  END IF;

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO inquiry_select_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'inquiries'
    AND cmd = 'SELECT';

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO message_select_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'inquiry_messages'
    AND cmd = 'SELECT';

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO message_insert_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'inquiry_messages'
    AND cmd = 'INSERT';

  legacy_state :=
    inquiry_select_policies = ARRAY[
      'Users can view all inquiries',
      'View own inquiries'
    ]::text[]
    AND message_select_policies = ARRAY[
      'Users can view all messages',
      'Users can view own inquiry messages',
      'View messages'
    ]::text[]
    AND message_insert_policies = ARRAY[
      'Send messages',
      'Users can insert inquiry messages'
    ]::text[];

  target_state :=
    inquiry_select_policies = ARRAY[
      'inquiries_select_admin',
      'inquiries_select_participant'
    ]::text[]
    AND message_select_policies = ARRAY[
      'inquiry_messages_select_admin',
      'inquiry_messages_select_participant'
    ]::text[]
    AND message_insert_policies = ARRAY[]::text[];

  IF NOT legacy_state AND NOT target_state THEN
    RAISE EXCEPTION
      'Unexpected inquiry policy drift. inquiries SELECT=%, messages SELECT=%, messages INSERT=%',
      inquiry_select_policies,
      message_select_policies,
      message_insert_policies;
  END IF;

  IF legacy_state AND (
    EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND (
          (tablename = 'inquiries' AND cmd = 'SELECT')
          OR (tablename = 'inquiry_messages' AND cmd IN ('SELECT', 'INSERT'))
        )
        AND (
          permissive <> 'PERMISSIVE'
          OR roles <> ARRAY['public']::name[]
        )
    )
    OR
    NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inquiries'
        AND policyname = 'Users can view all inquiries'
        AND permissive = 'PERMISSIVE'
        AND roles = ARRAY['public']::name[]
        AND regexp_replace(qual, '\s+', '', 'g') = '(auth.uid()ISNOTNULL)'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inquiries'
        AND policyname = 'View own inquiries'
        AND permissive = 'PERMISSIVE'
        AND roles = ARRAY['public']::name[]
        AND qual LIKE '%auth.uid() = user_id%'
        AND qual LIKE '%auth.uid() = host_id%'
        AND qual LIKE '%type = ''admin''%'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inquiry_messages'
        AND policyname = 'Users can view all messages'
        AND permissive = 'PERMISSIVE'
        AND roles = ARRAY['public']::name[]
        AND regexp_replace(qual, '\s+', '', 'g') = '(auth.uid()ISNOTNULL)'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inquiry_messages'
        AND policyname = 'Users can view own inquiry messages'
        AND qual LIKE '%sender_id = auth.uid()%'
        AND qual LIKE '%i.id = inquiry_messages.inquiry_id%'
        AND qual LIKE '%i.user_id = auth.uid()%'
        AND qual LIKE '%i.host_id = auth.uid()%'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inquiry_messages'
        AND policyname = 'View messages'
        AND qual LIKE '%type = ''admin''%'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inquiry_messages'
        AND policyname = 'Send messages'
        AND regexp_replace(with_check, '\s+', '', 'g') = '(auth.uid()=sender_id)'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inquiry_messages'
        AND policyname = 'Users can insert inquiry messages'
        AND with_check LIKE '%auth.uid() = sender_id%'
        AND with_check LIKE '%check_rate_limit(''inquiry_messages''::text, 1) = true%'
    )
  ) THEN
    RAISE EXCEPTION 'Known legacy policy names exist with unexpected definitions';
  END IF;

  IF target_state AND (
    EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('inquiries', 'inquiry_messages')
        AND cmd = 'SELECT'
        AND (
          permissive <> 'PERMISSIVE'
          OR roles <> ARRAY['authenticated']::name[]
        )
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inquiries'
        AND policyname = 'inquiries_select_participant'
        AND qual LIKE '%auth.uid() = user_id%'
        AND qual LIKE '%auth.uid() = host_id%'
        AND qual NOT LIKE '%type%'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inquiries'
        AND policyname = 'inquiries_select_admin'
        AND qual LIKE '%is_admin_reader()%'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inquiry_messages'
        AND policyname = 'inquiry_messages_select_participant'
        AND qual LIKE '%inquiry_id%'
        AND qual LIKE '%user_id = auth.uid()%'
        AND qual LIKE '%host_id = auth.uid()%'
        AND qual NOT LIKE '%sender_id%'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inquiry_messages'
        AND policyname = 'inquiry_messages_select_admin'
        AND qual LIKE '%is_admin_reader()%'
    )
    OR has_table_privilege('anon', 'public.inquiry_messages', 'INSERT')
    OR has_table_privilege('authenticated', 'public.inquiry_messages', 'INSERT')
  ) THEN
    RAISE EXCEPTION 'Known target policy names exist with unexpected definitions or grants';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiries'
      AND policyname = 'Create inquiries'
      AND cmd = 'INSERT'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiries'
      AND policyname = 'Users can update own inquiries'
      AND cmd = 'UPDATE'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiry_messages'
      AND policyname = 'Users can update messages in their inquiries'
      AND cmd = 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'An intentionally preserved inquiry policy is missing';
  END IF;
END
$$;

DROP POLICY IF EXISTS "Users can view all inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "View own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS inquiries_select_participant ON public.inquiries;
DROP POLICY IF EXISTS inquiries_select_admin ON public.inquiries;

DROP POLICY IF EXISTS "Users can view all messages" ON public.inquiry_messages;
DROP POLICY IF EXISTS "Users can view own inquiry messages" ON public.inquiry_messages;
DROP POLICY IF EXISTS "View messages" ON public.inquiry_messages;
DROP POLICY IF EXISTS inquiry_messages_select_participant ON public.inquiry_messages;
DROP POLICY IF EXISTS inquiry_messages_select_admin ON public.inquiry_messages;

DROP POLICY IF EXISTS "Send messages" ON public.inquiry_messages;
DROP POLICY IF EXISTS "Users can insert inquiry messages" ON public.inquiry_messages;

CREATE POLICY inquiries_select_participant
  ON public.inquiries
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = host_id
  );

CREATE POLICY inquiries_select_admin
  ON public.inquiries
  FOR SELECT
  TO authenticated
  USING (public.is_admin_reader());

CREATE POLICY inquiry_messages_select_participant
  ON public.inquiry_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inquiries AS inquiry
      WHERE inquiry.id = inquiry_messages.inquiry_id
        AND (
          inquiry.user_id = auth.uid()
          OR inquiry.host_id = auth.uid()
        )
    )
  );

CREATE POLICY inquiry_messages_select_admin
  ON public.inquiry_messages
  FOR SELECT
  TO authenticated
  USING (public.is_admin_reader());

REVOKE INSERT ON TABLE public.inquiry_messages FROM anon, authenticated;

DO $$
DECLARE
  inquiry_select_policies text[];
  message_select_policies text[];
BEGIN
  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO inquiry_select_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'inquiries'
    AND cmd = 'SELECT';

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO message_select_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'inquiry_messages'
    AND cmd = 'SELECT';

  IF inquiry_select_policies IS DISTINCT FROM ARRAY[
    'inquiries_select_admin',
    'inquiries_select_participant'
  ]::text[] THEN
    RAISE EXCEPTION 'Unexpected final inquiries SELECT policies: %', inquiry_select_policies;
  END IF;

  IF message_select_policies IS DISTINCT FROM ARRAY[
    'inquiry_messages_select_admin',
    'inquiry_messages_select_participant'
  ]::text[] THEN
    RAISE EXCEPTION 'Unexpected final inquiry_messages SELECT policies: %', message_select_policies;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiry_messages'
      AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'A direct inquiry_messages INSERT policy remains';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('inquiries', 'inquiry_messages')
      AND cmd = 'SELECT'
      AND (
        permissive <> 'PERMISSIVE'
        OR roles <> ARRAY['authenticated']::name[]
      )
  ) THEN
    RAISE EXCEPTION 'Final inquiry SELECT policies have unexpected role or mode';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('inquiries', 'inquiry_messages')
      AND cmd = 'SELECT'
      AND (
        qual LIKE '%auth.uid() IS NOT NULL%'
        OR qual LIKE '%type = ''admin''%'
      )
  ) THEN
    RAISE EXCEPTION 'A broad authenticated/admin-type SELECT condition remains';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiries'
      AND policyname = 'inquiries_select_participant'
      AND qual LIKE '%auth.uid() = user_id%'
      AND qual LIKE '%auth.uid() = host_id%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiry_messages'
      AND policyname = 'inquiry_messages_select_participant'
      AND qual LIKE '%inquiry.id = inquiry_messages.inquiry_id%'
      AND qual LIKE '%inquiry.user_id = auth.uid()%'
      AND qual LIKE '%inquiry.host_id = auth.uid()%'
      AND qual NOT LIKE '%sender_id%'
  ) THEN
    RAISE EXCEPTION 'Participant-only SELECT policy contract is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiries'
      AND policyname = 'inquiries_select_admin'
      AND qual LIKE '%is_admin_reader()%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiry_messages'
      AND policyname = 'inquiry_messages_select_admin'
      AND qual LIKE '%is_admin_reader()%'
  ) THEN
    RAISE EXCEPTION 'Admin SELECT policy contract is incomplete';
  END IF;

  IF has_table_privilege('anon', 'public.inquiry_messages', 'INSERT')
    OR has_table_privilege('authenticated', 'public.inquiry_messages', 'INSERT')
  THEN
    RAISE EXCEPTION 'Direct client inquiry_messages INSERT privilege remains';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.inquiry_messages', 'INSERT') THEN
    RAISE EXCEPTION 'service_role inquiry_messages INSERT was lost';
  END IF;
END
$$;

COMMIT;
