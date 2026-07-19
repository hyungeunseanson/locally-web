-- v3.40.26
-- Restrict the legacy service-booking RPC to the server service role only.

BEGIN;

DO $$
DECLARE
  target_signature constant text := 'public.create_service_booking_atomic(uuid,uuid,uuid,text,text)';
  target_oid oid;
  target_owner text;
  target_security_definer boolean;
BEGIN
  target_oid := to_regprocedure(target_signature)::oid;

  IF target_oid IS NULL THEN
    RAISE EXCEPTION 'Required legacy service-booking RPC is missing: %', target_signature;
  END IF;

  SELECT pg_get_userbyid(proowner), prosecdef
  INTO target_owner, target_security_definer
  FROM pg_proc
  WHERE oid = target_oid;

  IF target_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'Unexpected owner for legacy service-booking RPC %: %', target_signature, target_owner;
  END IF;

  IF target_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Legacy service-booking RPC is not SECURITY DEFINER: %', target_signature;
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.create_service_booking_atomic(uuid,uuid,uuid,text,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_service_booking_atomic(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  target_signature constant text := 'public.create_service_booking_atomic(uuid,uuid,uuid,text,text)';
  target_oid oid;
  target_owner text;
  target_security_definer boolean;
BEGIN
  target_oid := to_regprocedure(target_signature)::oid;

  SELECT pg_get_userbyid(proowner), prosecdef
  INTO target_owner, target_security_definer
  FROM pg_proc
  WHERE oid = target_oid;

  IF target_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'Owner changed during legacy service-booking RPC lockdown for %: %', target_signature, target_owner;
  END IF;

  IF target_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SECURITY DEFINER changed during legacy service-booking RPC lockdown: %', target_signature;
  END IF;

  IF has_function_privilege('public', target_oid, 'EXECUTE')
    OR has_function_privilege('anon', target_oid, 'EXECUTE')
    OR has_function_privilege('authenticated', target_oid, 'EXECUTE')
  THEN
    RAISE EXCEPTION 'Public client execution remains enabled for legacy service-booking RPC: %', target_signature;
  END IF;

  IF NOT has_function_privilege('service_role', target_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role execution was lost for legacy service-booking RPC: %', target_signature;
  END IF;
END
$$;

COMMIT;
