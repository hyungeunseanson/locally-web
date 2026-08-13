\set ON_ERROR_STOP on

DO $$
DECLARE
  public_profile_columns text[];
  profile_policies text[];
  user_policies text[];
  inquiry_select_policies text[];
  message_select_policies text[];
BEGIN
  IF to_regclass('public.profiles') IS NULL
    OR to_regclass('public.users') IS NULL
    OR to_regclass('public.inquiries') IS NULL
    OR to_regclass('public.inquiry_messages') IS NULL
    OR to_regclass('auth.users') IS NULL
    OR to_regclass('storage.objects') IS NULL
    OR to_regclass('storage.buckets') IS NULL
  THEN
    RAISE EXCEPTION 'Required Locally tables are missing after restore';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN ('profiles', 'users', 'inquiries', 'inquiry_messages')
      AND NOT relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is disabled on a protected Locally table';
  END IF;

  SELECT array_agg(column_name ORDER BY ordinal_position)
  INTO public_profile_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'public_profiles';

  IF public_profile_columns <> ARRAY[
    'id', 'full_name', 'avatar_url', 'nationality', 'bio', 'created_at', 'mbti',
    'languages', 'job', 'dream_destination', 'favorite_song', 'introduction',
    'host_nationality', 'introduction_en', 'introduction_ja', 'introduction_zh',
    'average_rating', 'total_review_count'
  ]::text[] THEN
    RAISE EXCEPTION 'Unexpected public_profiles projection: %', public_profile_columns;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'public_profiles'
      AND column_name IN (
        'email', 'phone', 'kakao_id', 'last_active_at', 'bank_name',
        'account_number', 'account_holder', 'motivation', 'dob'
      )
  ) THEN
    RAISE EXCEPTION 'Sensitive profile fields leaked into public_profiles';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'public_profiles'
      AND relation.relkind = 'v'
      AND pg_get_userbyid(relation.relowner) = 'postgres'
      AND COALESCE(relation.reloptions, ARRAY[]::text[]) @> ARRAY['security_barrier=true']::text[]
      AND NOT COALESCE(relation.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true']::text[]
  ) THEN
    RAISE EXCEPTION 'public_profiles ownership or security options drifted';
  END IF;

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO profile_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles';

  IF profile_policies <> ARRAY[
    'Users can insert their own profile',
    'Users can update own profile',
    'profiles_select_admin',
    'profiles_select_own',
    '사용자는 자신의 프로필만 수정할 수 있습니다'
  ]::text[] THEN
    RAISE EXCEPTION 'Unexpected profiles policies: %', profile_policies;
  END IF;

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO user_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'users';

  IF user_policies <> ARRAY['users_select_own']::text[] THEN
    RAISE EXCEPTION 'Unexpected users policies: %', user_policies;
  END IF;

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO inquiry_select_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'inquiries' AND cmd = 'SELECT';

  SELECT COALESCE(array_agg(policyname ORDER BY policyname), ARRAY[]::text[])
  INTO message_select_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'inquiry_messages' AND cmd = 'SELECT';

  IF inquiry_select_policies <> ARRAY[
    'inquiries_select_admin', 'inquiries_select_participant'
  ]::text[] OR message_select_policies <> ARRAY[
    'inquiry_messages_select_admin', 'inquiry_messages_select_participant'
  ]::text[] THEN
    RAISE EXCEPTION 'Inquiry read policies drifted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiry_messages' AND cmd = 'INSERT'
  ) OR has_table_privilege('anon', 'public.inquiry_messages', 'INSERT')
    OR has_table_privilege('authenticated', 'public.inquiry_messages', 'INSERT')
  THEN
    RAISE EXCEPTION 'Direct inquiry message INSERT access was restored';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.profiles', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.profiles', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.profiles', 'UPDATE')
    OR NOT has_table_privilege('service_role', 'public.profiles', 'DELETE')
    OR NOT has_table_privilege('service_role', 'public.users', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.users', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.users', 'UPDATE')
    OR NOT has_table_privilege('service_role', 'public.users', 'DELETE')
    OR NOT has_table_privilege('service_role', 'public.inquiry_messages', 'INSERT')
  THEN
    RAISE EXCEPTION 'Required service_role access is missing';
  END IF;

  IF has_table_privilege('anon', 'public.profiles', 'SELECT')
    OR has_table_privilege('anon', 'public.users', 'SELECT')
  THEN
    RAISE EXCEPTION 'Anonymous access to private profile/user tables exists';
  END IF;

  IF to_regprocedure('public.is_admin_reader()') IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = to_regprocedure('public.is_admin_reader()')::oid
      AND prosecdef AND provolatile = 's'
      AND pg_get_userbyid(proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION 'is_admin_reader() security contract drifted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE NOT tgisinternal AND tgrelid = 'auth.users'::regclass
  ) THEN
    RAISE EXCEPTION 'No custom auth.users trigger was restored';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    RAISE EXCEPTION 'profiles is missing from supabase_realtime';
  END IF;
END;
$$;

SELECT 'LOCALLY_SECURITY_ASSERTIONS_PASS' AS result;
