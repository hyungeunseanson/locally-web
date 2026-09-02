-- v3.40.41
-- Treat an explicit zero-payout cancellation as a resolved non-liability while
-- preserving every existing manual payout guard and the atomic write path.

BEGIN;

DO $migration$
DECLARE
  target_signature regprocedure := to_regprocedure(
    'public.complete_admin_manual_experience_payout_atomic(uuid,uuid,text,integer,integer,text,text,text,uuid,text)'
  );
  prior_definition text;
  next_definition text;
  expected_guard text := $old$
        OR b.host_payout_amount IS NULL
        OR b.host_payout_amount <= 0
        OR b.solo_guarantee_refund_status IN ('processing', 'pending_manual', 'failed')
$old$;
  replacement_guard text := $new$
        OR b.host_payout_amount IS NULL
        OR b.host_payout_amount < 0
        OR (
          b.host_payout_amount = 0
          AND b.status NOT IN ('cancelled', 'CANCELLED')
        )
        OR b.solo_guarantee_refund_status IN ('processing', 'pending_manual', 'failed')
$new$;
BEGIN
  IF target_signature IS NULL THEN
    RAISE EXCEPTION 'Required manual payout RPC is missing';
  END IF;

  SELECT pg_get_functiondef(target_signature)
  INTO prior_definition;

  IF strpos(prior_definition, expected_guard) = 0 THEN
    RAISE EXCEPTION 'Manual payout RPC guard differs from the expected v3.40.39 definition';
  END IF;

  next_definition := replace(prior_definition, expected_guard, replacement_guard);
  IF next_definition = prior_definition THEN
    RAISE EXCEPTION 'Manual payout RPC guard replacement did not run';
  END IF;

  EXECUTE next_definition;

  IF strpos(pg_get_functiondef(target_signature), replacement_guard) = 0 THEN
    RAISE EXCEPTION 'Manual payout RPC guard replacement could not be verified';
  END IF;
END;
$migration$;

REVOKE ALL ON FUNCTION public.complete_admin_manual_experience_payout_atomic(
  uuid, uuid, text, integer, integer, text, text, text, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_admin_manual_experience_payout_atomic(
  uuid, uuid, text, integer, integer, text, text, text, uuid, text
) TO service_role;

COMMIT;
