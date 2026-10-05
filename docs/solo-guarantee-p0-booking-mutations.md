# Booking mutation authority inventory

Baseline: `5fb9c9291c19dba84bcb8358f9a3ba47696d2104`. Inventoried every literal `.from('bookings')` chain using the TypeScript AST, then inspected dynamic table helpers and SQL/RPC callers. There are **18 direct UPDATE call sites, all using service-role server clients; zero legitimate anon/authenticated direct UPDATE callers**. There are no direct application booking INSERT callers; creation uses the server-only booking RPC.

| Baseline caller | UPDATE sites | Legitimate action | P0 boundary |
| --- | ---: | --- | --- |
| `app/api/payment/cancel/route.ts` | 4 | Guest cancellation, host approval, authorized admin cancellation, nonfinancial review request | Review marker remains a service-role write. Cancellation claim/finalization use the common locked RPCs; uncertain outcomes never restore the pre-claim status. |
| `app/api/admin/bookings/force-cancel/route.ts` | 2 | Admin force cancellation | Locked cancellation RPCs with the original settlement calculation. |
| `app/api/admin/bookings/reject-host-unavailable/route.ts` | 1 | Admin rejects a review request | Existing service-role `cancel_reason` update preserved. |
| `app/api/payment/experienceCardConfirmation.ts` | 2 | Verified approval races with explicit pre-approval checkout release | Existing service-role exact-attempt claim preserved; finalization moved to `finalize_released_card_refund_atomic`, checking released state, provider, transaction, order and exact full approved amount. |
| `app/api/payment/release-card/route.ts` | 1 | Owner abandons an unapproved checkout | Existing server authorization and exact pending payment claim filters preserved; no paid booking transition. |
| `app/utils/adminPayouts.ts` | 2 | Regular admin payout and old column fallback | Both replaced by `settle_experience_payouts_atomic`; no direct UPDATE fallback. |
| `app/utils/bookings/soloGuaranteeRefund.ts` | 6 | Claim, manual reservation, failure, rollback, apply, manual completion | All replaced by durable operation RPCs. |

The baseline has three literal DELETE call sites: two in `app/api/admin/delete/route.ts` and one in `scripts/supabase/staging-fixtures.mjs`. Dynamic staging insertion and runtime cleanup deletion also use server/operator clients. Resolved historical admin deletion remains possible; unresolved monetary operations/cancellation claims reject deletion. Operation and attempt evidence remains after resolved booking deletion.

Browser booking readers were checked in payment success/completion, checkout, host availability/reservations/earnings, admin settlement, account and mobile profile screens. They only SELECT bookings. Reservations, cancellation, completion and payment mutations already call authenticated server routes; those routes perform owner/host/admin authorization and use `createAdminClient()`. Profile updates target `profiles`, whose grants and policies are untouched.

The migration revokes table **and existing column** INSERT/UPDATE privileges, plus DELETE, from PUBLIC/anon/authenticated. It retains booking SELECT/RLS and service-role access. A column allowlist is unnecessary and would preserve exploitable paid-status/participant mutation: no client booking writer needs any column. Existing booking creation/payment confirmation and completion RPCs remain server flows. New money RPCs and private helpers revoke PUBLIC/anon/authenticated EXECUTE and grant service_role only.

Native PostgreSQL 17 tests attack every baseline booking column under owner/host/anon roles, inspect RPC ACLs, preserve owner/host reads and an owner profile update, and run actual guest/host/admin cancellation routes plus the verified checkout-release approval recovery against real PostgreSQL. External Auth and provider boundaries use synthetic identities and responses.
