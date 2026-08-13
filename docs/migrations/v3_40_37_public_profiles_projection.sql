-- v3.40.37
-- Add a public, privacy-safe profile projection before restricting the source table.

BEGIN;

DO $$
DECLARE
  existing_kind "char";
  existing_columns text[];
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Required public.profiles table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'full_name'
      AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'average_rating'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'total_review_count'
  ) THEN
    RAISE EXCEPTION 'Required public.profiles columns are missing or have unexpected types';
  END IF;

  SELECT relation.relkind
  INTO existing_kind
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'public_profiles';

  IF existing_kind IS NOT NULL AND existing_kind <> 'v' THEN
    RAISE EXCEPTION 'public.public_profiles exists but is not a view';
  END IF;

  IF existing_kind = 'v' THEN
    SELECT array_agg(column_name ORDER BY ordinal_position)
    INTO existing_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_profiles';

    IF existing_columns <> ARRAY[
      'id',
      'full_name',
      'avatar_url',
      'nationality',
      'bio',
      'created_at',
      'mbti',
      'languages',
      'job',
      'dream_destination',
      'favorite_song',
      'introduction',
      'host_nationality',
      'introduction_en',
      'introduction_ja',
      'introduction_zh',
      'average_rating',
      'total_review_count'
    ]::text[] THEN
      RAISE EXCEPTION 'Unexpected existing public.public_profiles column contract: %', existing_columns;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  id,
  full_name,
  avatar_url,
  nationality,
  bio,
  created_at,
  mbti,
  languages,
  job,
  dream_destination,
  favorite_song,
  introduction,
  host_nationality,
  introduction_en,
  introduction_ja,
  introduction_zh,
  average_rating,
  total_review_count
FROM public.profiles;

ALTER VIEW public.public_profiles OWNER TO postgres;

REVOKE ALL PRIVILEGES ON TABLE public.public_profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated, service_role;

DO $$
DECLARE
  projected_columns text[];
  anon_privileges text[];
  authenticated_privileges text[];
  service_role_privileges text[];
  view_definition text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'public_profiles'
      AND relation.relkind = 'v'
      AND pg_get_userbyid(relation.relowner) = 'postgres'
      AND COALESCE(relation.reloptions, ARRAY[]::text[]) @> ARRAY['security_barrier=true']::text[]
      AND NOT (COALESCE(relation.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true']::text[])
  ) THEN
    RAISE EXCEPTION 'public.public_profiles has unexpected ownership or security options';
  END IF;

  SELECT array_agg(column_name ORDER BY ordinal_position)
  INTO projected_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'public_profiles';

  IF projected_columns <> ARRAY[
    'id',
    'full_name',
    'avatar_url',
    'nationality',
    'bio',
    'created_at',
    'mbti',
    'languages',
    'job',
    'dream_destination',
    'favorite_song',
    'introduction',
    'host_nationality',
    'introduction_en',
    'introduction_ja',
    'introduction_zh',
    'average_rating',
    'total_review_count'
  ]::text[] THEN
    RAISE EXCEPTION 'Unexpected public.public_profiles projection: %', projected_columns;
  END IF;

  SELECT pg_get_viewdef('public.public_profiles'::regclass, true)
  INTO view_definition;

  IF view_definition ~* '\m(email|phone|kakao_id|last_active_at|bank_name|account_number|account_holder|motivation|dob)\M' THEN
    RAISE EXCEPTION 'Sensitive profile columns leaked into public.public_profiles';
  END IF;

  SELECT COALESCE(array_agg(privilege_type ORDER BY privilege_type), ARRAY[]::text[])
  INTO anon_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'public_profiles'
    AND grantee = 'anon';

  SELECT COALESCE(array_agg(privilege_type ORDER BY privilege_type), ARRAY[]::text[])
  INTO authenticated_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'public_profiles'
    AND grantee = 'authenticated';

  SELECT COALESCE(array_agg(privilege_type ORDER BY privilege_type), ARRAY[]::text[])
  INTO service_role_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'public_profiles'
    AND grantee = 'service_role';

  IF anon_privileges <> ARRAY['SELECT']::text[]
    OR authenticated_privileges <> ARRAY['SELECT']::text[]
    OR service_role_privileges <> ARRAY['SELECT']::text[]
  THEN
    RAISE EXCEPTION
      'Unexpected public.public_profiles grants. anon=%, authenticated=%, service_role=%',
      anon_privileges,
      authenticated_privileges,
      service_role_privileges;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = 'public_profiles'
      AND grantee = 'PUBLIC'
  ) THEN
    RAISE EXCEPTION 'PUBLIC unexpectedly retains public.public_profiles SELECT';
  END IF;
END;
$$;

COMMIT;
