# Solo guarantee P0 selective rollout runbook

**Draft review only. No migration, payment, payout, notification, secret/config, Cloudflare, Vercel, deployment or merge operation was executed in Production for this work.** This is a design for a separately authorized automated rollout; it is not a request for the user to run SQL or dashboard steps.

## Reviewed state and exact migration order

Starting/freshly fetched main: `5fb9c9291c19dba84bcb8358f9a3ba47696d2104` (2026-10-05). The read-only Production precheck and full current migration ledger are in [solo-guarantee-p0-production-precheck.json](solo-guarantee-p0-production-precheck.json).

Production's verified latest ledger entry is **`20261005082309 avatar_media_authority`**. It is already applied. It is not a pending predecessor and must never be replayed. Ledger presence proves only the SQL stage, not any other Avatar cutover stage. Avatar R2 resources, bindings, payload copying, flags, credentials and locator/upload stages are outside this PR. Backup schedules and modern-secret remediation are also outside scope.

The only new reviewed financial migration is:

1. **`20261005104924_solo_guarantee_financial_authority.sql`**, ledger version **`20261005104924`**, name **`solo_guarantee_financial_authority`**.

Reviewed file SHA-256: `df95be49a1df1e5b1fbc1e89afa0ff589b8041c4d9ed54e5d39945eaeee09c11`.

There are no other new migrations in this PR. Do not use `supabase db push`, a pending-migration sweep, migration repair, or a filename-based reconstruction of the Production ledger. Existing repository/Production version naming differences are not a reason to replay or rename historical migrations.

A future automated executor must re-fetch the selected reviewed commit and the **then-current Production ledger**, catalog/function signatures and anomaly counts. Match each baseline ledger version/name against the saved ledger and review any additions or drift. Verify the six baseline function hashes saved in the precheck, PostgreSQL 17 compatibility, the status constraint, required financial columns and the exact reviewed migration SHA-256. If the financial version already exists, verify its schema and stop without replay. If the financial version is absent, the execution allowlist contains that one version/file only. Any other unreviewed pending file requires a separate authorization and is excluded.

## Future coordinated execution

Before the separately authorized rollout, the executor must prevent old financial workers/admin money actions from starting, drain in-flight provider requests, and establish the fresh precheck. This is a financial maintenance boundary; Avatar/backup schedules, bindings and credentials must remain untouched. An unresolved old provider request must enter conservative reconciliation, never a replay.

Apply the exact reviewed financial SQL as one transaction and register **only version `20261005104924`** in the migration ledger in the same transaction through the approved selective migration executor. The file's outer BEGIN/COMMIT must be handled by that executor so schema changes and that exact ledger record are committed together. Do not assume a connector that automatically chooses a timestamp registers the reviewed file version. No arbitrary pending-migration command is part of the design.

Then release the matching reviewed application code. DB-first ordering deliberately makes old direct solo-refund/payout/cancellation transitions fail closed until compatible callers run; they cannot bypass the new RPC authority. Validate the role/grant boundary, completion regression, bank/manual proof, diagnostics and bounded recovery before allowing financial workers/admin actions again. No remote provider request is necessary for those validation steps. A separately authorized synthetic payment/refund check belongs to that later rollout, not this Draft PR.

If application rollout fails after SQL installation, keep the restrictive grants, triggers and unresolved operation holds. Do not roll back authority or erase evidence to restore an old financial writer. Resolve forward with a reviewed compatible application build; other booking reads/profile actions remain available. A rejected old writer is visible as an operational failure, not a successful money operation.

## Atomic financial boundary

Every refund/cancellation/payout money RPC first locks a common per-experience advisory transaction key, then booking rows. Payout batches acquire experience keys in sorted order. Refund claims additionally lock a qualifying same-slot participant and revalidate booking state, exact booking-time S, tour end and pending payout. The experience-wide lock also covers the same slot, while avoiding different row-lock orders for A and B. No transaction remains open across provider HTTP.

B cancellation committed before the claim removes eligibility. B cancellation after the claim does not revoke the already-valid obligation. A cancellation claimed first prevents a refund claim; a refund claim first blocks A cancellation until its money outcome is resolved. Completion timing remains compatible with existing start-time completion; review requests and solo refunds remain end-gated. Positive solo payout waits for end and freshly checks refund eligibility even when the old label is `not_applicable`.

## Durable outcome and recovery

| Operation state | Meaning | Allowed next money action |
| --- | --- | --- |
| `claimed` | Durable exact obligation, attempt UUID and dispatch lease | Consume the dispatch token once, then call provider once. Lost token response permits no external call/replay. |
| `accepted`, unapplied | Signed correlated provider success, or verified bank/PayPal proof | Apply DB settlement idempotently; payout and cancellation remain blocked. |
| `unknown` | Timeout/transport uncertainty, unmatched response, expired claim, legacy ambiguous result | Reconcile exact signed provider evidence. Success applies once; a definite signed rejection records REJECTED before a separate explicit retry. No ordinary manual completion or unproven external retry. |
| `rejected` | Signed correlated definite validation rejection in the narrow allowlist | Explicit authorized retry only, with a fresh UUID/order, journaled prior attempt and maximum three attempts. Payout remains held. |
| `manual_pending` | Exact bank/PayPal obligation reserved; external refund pending | Save external proof and exact S once. No payout while pending. |
| accepted + `settlement_applied_at` | External success and accounting applied | Ordinary payout/cancellation calculation may use the reduced basis; external refund cannot run again. |

The operation records booking/provider, immutable transaction/merchant/order references, booking-time amount/basis/gross/prior refund, attempt identity, result classification/code, provider refund identity, proof/verifying admin, timestamps and bounded diagnostic codes. The attempt journal retains each dispatched order/MID/outcome. Secrets and raw sensitive provider responses are never persisted. Normal logs contain fixed aggregate counts only.

NICEPAY success requires exact MID/TID/Moid/CancelAmt, merchant-key signature, `2001` or **`2211`**, and a cancellation identity. `2211` is success, never an already-refunded marker. Signed validation codes `2010`, `2011`, `2024`, `2025`, `2217`, `2218` alone establish definite rejection. Other result codes, HTTP/connection failures and the bounded 15-second default timeout remain UNKNOWN. The adapter timeout caps at 30 seconds.

Existing two-hour completion processing recovers at most 50 operations per pass. Expired claims become UNKNOWN; accepted unapplied operations retry only their DB application; notification delivery retries separately with an eight-attempt budget and delay. No recovery pass invokes a new refund for UNKNOWN. Admin ledger diagnostics and the paged privileged operations route expose unresolved opaque booking/operation IDs; ordinary logs expose no TID or PII. Exhausted notification delivery can be explicitly reset independently of money. Completion `admin_job_runs` records a failed/attention state and aggregate diagnostics while reconciliation or missing delivery exists.

The current NICEPAY status query cannot prove the amount/identity of a partial refund. UNKNOWN reconciliation therefore accepts only a server-verified exact signed cancellation response. A success applies settlement; an allowlisted definite rejection first records REJECTED, and a later explicit retry uses a new attempt. Accepted/applied outcomes can never become rejected. The raw evidence lives in request memory, then is discarded. A valid success can apply once; a status-only observation never authorizes a second refund. A merchant change requires verification with the original merchant configuration; this PR changes no credentials/config.

## Manual evidence

Bank proof is an external transfer/proof identifier; PayPal proof is a refund reference plus the matching stored capture/transaction reference. Exact amount must equal both the operation obligation and booking-time S; altered 20,000 against 38,000 fails. Booking must be completed, payout pending and operation/booking in the manual pending state. A unique provider/proof constraint prevents proof reuse across obligations. Card UNKNOWN/legacy generic failed states never enter this manual path.

Proof acceptance commits before accounting application. If proof commit response or DB application fails, the operation remains accepted/unresolved and a second admin gets a conflict; recover accounting only. Notification failures cannot downgrade accepted/applied money.

## Forward migration and historical rows

The migration changes authority and introduces evidence/state transitions. It does not bulk rewrite existing booking finance/status values. Legacy processing/failed outcomes seed UNKNOWN operations; legacy bank/PayPal pending-manual rows retain their already-reserved basis. Refunded, normal, cancelled, completed and NULL-provider rows remain readable. Unresolved deletion is blocked; resolved historical deletion preserves refund operation evidence. Native pre-migration representative rows prove finance snapshots remain identical after SQL application.

## Validation and remaining operational follow-ups

See [solo-guarantee-p0-regressions.md](solo-guarantee-p0-regressions.md), [booking mutation inventory](solo-guarantee-p0-booking-mutations.md) and [test instructions](../tests/integration/README.md).

Optional follow-up: integrate a provider reconciliation feed only after its contract proves exact partial-refund amount/order/cancellation identity. Until then, UNKNOWN stays visible and blocked, with the signed evidence reconciliation path available. Existing ordinary cancellation provider uncertainty remains locked and requires operator reconciliation; automatic recovery for that separate general-cancellation saga is not introduced here. Richer receipt/export layouts and broader admin localization can follow separately.
