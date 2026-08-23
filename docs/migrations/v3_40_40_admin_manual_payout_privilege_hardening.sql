-- v3.40.40
-- Remove Supabase default table privileges not needed by the manual payout API.

BEGIN;

REVOKE ALL ON TABLE public.admin_manual_payouts FROM service_role;
GRANT SELECT, INSERT ON TABLE public.admin_manual_payouts TO service_role;

COMMIT;
