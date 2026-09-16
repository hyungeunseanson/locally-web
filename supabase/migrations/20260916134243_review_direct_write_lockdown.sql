-- Remove obsolete direct Data API write access after the review app cutover.
-- Review creation and host guest-review creation remain available only through
-- the service-role RPC paths established by the Foundation migration.

BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.create_experience_review_atomic(text,uuid,bigint,integer,text)') IS NULL
    OR to_regprocedure('public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)') IS NULL
    OR to_regprocedure('public.list_due_experience_review_request_candidates(integer)') IS NULL
  THEN
    RAISE EXCEPTION 'review direct-write lockdown refused missing Foundation RPCs';
  END IF;

  IF has_function_privilege('anon', 'public.create_experience_review_atomic(text,uuid,bigint,integer,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.create_experience_review_atomic(text,uuid,bigint,integer,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.create_experience_review_atomic(text,uuid,bigint,integer,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.list_due_experience_review_request_candidates(integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.list_due_experience_review_request_candidates(integer)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.list_due_experience_review_request_candidates(integer)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'review direct-write lockdown refused Foundation RPC execute mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Users can insert their own reviews' AND cmd = 'INSERT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Hosts can update reviews for their experiences' AND cmd = 'UPDATE'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guest_reviews'
      AND policyname = 'Host can insert reviews' AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'review direct-write lockdown refused unexpected target policy state';
  END IF;

  IF NOT has_table_privilege('anon', 'public.reviews', 'INSERT')
    OR NOT has_table_privilege('authenticated', 'public.reviews', 'INSERT')
    OR NOT has_table_privilege('anon', 'public.reviews', 'UPDATE')
    OR NOT has_table_privilege('authenticated', 'public.reviews', 'UPDATE')
    OR NOT has_table_privilege('anon', 'public.guest_reviews', 'INSERT')
    OR NOT has_table_privilege('authenticated', 'public.guest_reviews', 'INSERT')
  THEN
    RAISE EXCEPTION 'review direct-write lockdown refused unexpected target grant state';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Reviews are viewable by everyone' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Users can delete their own reviews' AND cmd = 'DELETE'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guest_reviews'
      AND policyname = 'Users can view reviews' AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'review direct-write lockdown refused missing preserved policies';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.reviews', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.reviews', 'DELETE')
    OR NOT has_table_privilege('authenticated', 'public.guest_reviews', 'SELECT')
  THEN
    RAISE EXCEPTION 'review direct-write lockdown refused missing preserved grants';
  END IF;
END
$preflight$;

DROP POLICY "Users can insert their own reviews" ON public.reviews;
DROP POLICY "Hosts can update reviews for their experiences" ON public.reviews;
DROP POLICY "Host can insert reviews" ON public.guest_reviews;

REVOKE INSERT, UPDATE ON TABLE public.reviews FROM anon, authenticated;
REVOKE INSERT ON TABLE public.guest_reviews FROM anon, authenticated;

DO $postcondition$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Users can insert their own reviews'
  ) OR EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Hosts can update reviews for their experiences'
  ) OR EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guest_reviews'
      AND policyname = 'Host can insert reviews'
  ) THEN
    RAISE EXCEPTION 'review direct-write lockdown failed to remove target policies';
  END IF;

  IF has_table_privilege('anon', 'public.reviews', 'INSERT')
    OR has_table_privilege('authenticated', 'public.reviews', 'INSERT')
    OR has_table_privilege('anon', 'public.reviews', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.reviews', 'UPDATE')
    OR has_table_privilege('anon', 'public.guest_reviews', 'INSERT')
    OR has_table_privilege('authenticated', 'public.guest_reviews', 'INSERT')
  THEN
    RAISE EXCEPTION 'review direct-write lockdown failed to revoke target grants';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Reviews are viewable by everyone' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'Users can delete their own reviews' AND cmd = 'DELETE'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guest_reviews'
      AND policyname = 'Users can view reviews' AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'review direct-write lockdown changed preserved policies';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.reviews', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.reviews', 'DELETE')
    OR NOT has_table_privilege('authenticated', 'public.guest_reviews', 'SELECT')
  THEN
    RAISE EXCEPTION 'review direct-write lockdown changed preserved grants';
  END IF;

  IF has_function_privilege('anon', 'public.create_experience_review_atomic(text,uuid,bigint,integer,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.create_experience_review_atomic(text,uuid,bigint,integer,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.create_experience_review_atomic(text,uuid,bigint,integer,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.list_due_experience_review_request_candidates(integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.list_due_experience_review_request_candidates(integer)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.list_due_experience_review_request_candidates(integer)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'review direct-write lockdown changed Foundation RPC privileges';
  END IF;
END
$postcondition$;

COMMIT;
