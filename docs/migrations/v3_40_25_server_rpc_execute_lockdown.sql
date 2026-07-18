-- v3.40.25
-- Restrict server-only RPC execution to service_role and harden future defaults.

BEGIN;

DO $$
DECLARE
  target_signature text;
  target_oid oid;
  target_owner text;
BEGIN
  FOREACH target_signature IN ARRAY ARRAY[
    'public.claim_due_admin_support_unread_alert_batches(integer)',
    'public.complete_service_booking_if_due_atomic(text)',
    'public.confirm_service_bank_payment_atomic(text)',
    'public.create_service_request_with_booking_atomic(uuid,text,text,text,text,date,text,integer,text[],integer,text,text)',
    'public.get_experience_completion_due_backlog()',
    'public.lease_experience_translation_task(text,timestamp with time zone,integer,integer)',
    'public.lease_experience_translation_task(text,timestamp with time zone,integer)',
    'public.list_due_experience_completion_candidates(text)',
    'public.prune_notifications_retention(timestamp with time zone,integer)',
    'public.prune_team_workspace_comments(uuid,integer)',
    'public.prune_team_workspace_tasks(integer)',
    'public.record_translation_provider_outcome(text,integer,integer,boolean,integer)',
    'public.record_translation_provider_outcome(text,integer,integer,boolean)',
    'public.select_service_host_atomic(uuid,uuid,uuid)'
  ]
  LOOP
    target_oid := to_regprocedure(target_signature)::oid;

    IF target_oid IS NULL THEN
      RAISE EXCEPTION 'Required server RPC is missing: %', target_signature;
    END IF;

    SELECT pg_get_userbyid(proowner)
    INTO target_owner
    FROM pg_proc
    WHERE oid = target_oid;

    IF target_owner IS DISTINCT FROM 'postgres' THEN
      RAISE EXCEPTION 'Unexpected owner for server RPC %: %', target_signature, target_owner;
    END IF;

    IF NOT has_function_privilege('service_role', target_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role cannot currently execute required server RPC: %', target_signature;
    END IF;
  END LOOP;
END
$$;

REVOKE EXECUTE ON FUNCTION public.claim_due_admin_support_unread_alert_batches(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_service_booking_if_due_atomic(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_service_bank_payment_atomic(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_service_request_with_booking_atomic(uuid,text,text,text,text,date,text,integer,text[],integer,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_experience_completion_due_backlog() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lease_experience_translation_task(text,timestamp with time zone,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lease_experience_translation_task(text,timestamp with time zone,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_due_experience_completion_candidates(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_notifications_retention(timestamp with time zone,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_team_workspace_comments(uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_team_workspace_tasks(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_translation_provider_outcome(text,integer,integer,boolean,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_translation_provider_outcome(text,integer,integer,boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.select_service_host_atomic(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_due_admin_support_unread_alert_batches(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_service_booking_if_due_atomic(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_service_bank_payment_atomic(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_service_request_with_booking_atomic(uuid,text,text,text,text,date,text,integer,text[],integer,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_experience_completion_due_backlog() TO service_role;
GRANT EXECUTE ON FUNCTION public.lease_experience_translation_task(text,timestamp with time zone,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.lease_experience_translation_task(text,timestamp with time zone,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_due_experience_completion_candidates(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_notifications_retention(timestamp with time zone,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_team_workspace_comments(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_team_workspace_tasks(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_translation_provider_outcome(text,integer,integer,boolean,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_translation_provider_outcome(text,integer,integer,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.select_service_host_atomic(uuid,uuid,uuid) TO service_role;

-- PostgreSQL's built-in PUBLIC execute default is global, so it must be
-- revoked globally for functions created by postgres.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

DO $$
DECLARE
  target_signature text;
  target_oid oid;
  target_owner text;
  postgres_role_oid oid;
  public_schema_oid oid;
  anon_role_oid oid;
  authenticated_role_oid oid;
  service_role_oid oid;
BEGIN
  FOREACH target_signature IN ARRAY ARRAY[
    'public.claim_due_admin_support_unread_alert_batches(integer)',
    'public.complete_service_booking_if_due_atomic(text)',
    'public.confirm_service_bank_payment_atomic(text)',
    'public.create_service_request_with_booking_atomic(uuid,text,text,text,text,date,text,integer,text[],integer,text,text)',
    'public.get_experience_completion_due_backlog()',
    'public.lease_experience_translation_task(text,timestamp with time zone,integer,integer)',
    'public.lease_experience_translation_task(text,timestamp with time zone,integer)',
    'public.list_due_experience_completion_candidates(text)',
    'public.prune_notifications_retention(timestamp with time zone,integer)',
    'public.prune_team_workspace_comments(uuid,integer)',
    'public.prune_team_workspace_tasks(integer)',
    'public.record_translation_provider_outcome(text,integer,integer,boolean,integer)',
    'public.record_translation_provider_outcome(text,integer,integer,boolean)',
    'public.select_service_host_atomic(uuid,uuid,uuid)'
  ]
  LOOP
    target_oid := to_regprocedure(target_signature)::oid;

    SELECT pg_get_userbyid(proowner)
    INTO target_owner
    FROM pg_proc
    WHERE oid = target_oid;

    IF target_owner IS DISTINCT FROM 'postgres' THEN
      RAISE EXCEPTION 'Owner changed during server RPC lockdown for %: %', target_signature, target_owner;
    END IF;

    IF has_function_privilege('public', target_oid, 'EXECUTE')
      OR has_function_privilege('anon', target_oid, 'EXECUTE')
      OR has_function_privilege('authenticated', target_oid, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'Public client execution remains enabled for server RPC: %', target_signature;
    END IF;

    IF NOT has_function_privilege('service_role', target_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role execution was lost for server RPC: %', target_signature;
    END IF;
  END LOOP;

  SELECT oid INTO postgres_role_oid FROM pg_roles WHERE rolname = 'postgres';
  SELECT oid INTO public_schema_oid FROM pg_namespace WHERE nspname = 'public';
  SELECT oid INTO anon_role_oid FROM pg_roles WHERE rolname = 'anon';
  SELECT oid INTO authenticated_role_oid FROM pg_roles WHERE rolname = 'authenticated';
  SELECT oid INTO service_role_oid FROM pg_roles WHERE rolname = 'service_role';

  IF postgres_role_oid IS NULL
    OR public_schema_oid IS NULL
    OR anon_role_oid IS NULL
    OR authenticated_role_oid IS NULL
    OR service_role_oid IS NULL
  THEN
    RAISE EXCEPTION 'Required role or public schema is missing while verifying default privileges';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_default_acl
    WHERE defaclrole = postgres_role_oid
      AND defaclnamespace = 0
      AND defaclobjtype = 'f'
  ) THEN
    RAISE EXCEPTION 'Global postgres function default ACL was not created';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_default_acl AS defaults
    CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS privilege
    WHERE defaults.defaclrole = postgres_role_oid
      AND defaults.defaclnamespace = 0
      AND defaults.defaclobjtype = 'f'
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Future postgres functions still grant EXECUTE to PUBLIC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_default_acl AS defaults
    CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS privilege
    WHERE defaults.defaclrole = postgres_role_oid
      AND defaults.defaclnamespace = public_schema_oid
      AND defaults.defaclobjtype = 'f'
      AND privilege.grantee IN (anon_role_oid, authenticated_role_oid)
      AND privilege.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Future public-schema functions still grant EXECUTE to client roles';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_default_acl AS defaults
    CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS privilege
    WHERE defaults.defaclrole = postgres_role_oid
      AND defaults.defaclnamespace = public_schema_oid
      AND defaults.defaclobjtype = 'f'
      AND privilege.grantee = service_role_oid
      AND privilege.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Future public-schema functions do not grant EXECUTE to service_role';
  END IF;
END
$$;

COMMIT;
