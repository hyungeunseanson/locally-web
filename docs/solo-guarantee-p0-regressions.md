# Solo guarantee P0 regression evidence

Fresh starting main: `5fb9c9291c19dba84bcb8358f9a3ba47696d2104`. Audit baseline `3e7b818692c00c72896f8a66e1ae4f9e9ec3a39d` is authoritative input, not the implementation base. All final regressions live under repository test locations.

## Completed validation

- Native **PostgreSQL 17.6**, four independent connections: **84 checks passed**. Assertions: `FINANCIAL_AUTHORITY_BYPASS_IMPOSSIBLE`, `PAYOUT_REFUND_RACE_SAFE`, `DOUBLE_REFUND_PROTECTED`.
- Actual component/page loopback Chromium fixture: **5 checks passed**, no page errors. Refund event refreshes guest trips/open receipt/host summary/chart; KO/EN/JA/ZH show original 79,800, refund 38,000, net 41,800.
- Relevant existing policy/finance/manual-payout/cron contracts: **48 passed**.
- Relevant existing NICEPAY provider/approval/notification/cancel contracts: **7 passed**, including the exact cancel SignData request.
- Existing notification delivery contracts: **6 passed**.
- TypeScript `tsc --noEmit`, full repository ESLint and `git diff --check`: passed.
- Fresh Production read-only precheck: all four primary anomaly counts and processing/pending_manual/failed counts **0**. P0 states N/A because this migration is not applied. Production ledger confirms Avatar authority already applied; no replay.

Existing full browser cancellation/notification suites require local Supabase Auth. The attempted local run encountered `ECONNREFUSED` at loopback Auth; no Production fallback was used. Critical owner/host/admin cancellation behavior and checkout-release approval recovery were instead validated by the actual route/helper plus real PG17 suite. The dedicated browser fixture independently verifies the adjacent UI regressions. No remote payment/deployment test ran.

## Regression matrix

| Required invariant / audit race | Independent local evidence |
| --- | --- |
| Owner/host/anon financial tamper | Actual roles, grants and RLS reject UPDATE of all 40 baseline booking columns; INSERT denied. All new RPC ACLs exclude public roles. Owner/host reads and profile update remain functional. |
| Cron vs cron, cron vs force-one | Concurrent independent DB claims yield one winner; concurrent actual processors share one dispatch and one external call. |
| R07 refund vs regular payout | Pending provider outcome blocks payout; settlement then pays only the reduced 30,400 host snapshot. |
| R08 stale not_applicable payout first | Fresh ended eligibility blocks pre-refund payout before a refund label is claimed. |
| R09 common transaction authority | A real advisory-lock barrier proves a different backend waits before claim authorization. |
| R10 refund vs manual payout | Exact live manual payout RPC rejects due/unresolved refund, then accepts only reduced host amount. |
| R11 bank manual vs payout | Due/manual pending blocks payout; concurrent manual completion vs stale amount yields completion and payout conflict; no new bank obligation after a valid old payout. |
| R12 B cancels after candidate read | B cancellation commits before claim; claim revalidation creates no refund. |
| R13 A cancellation vs refund | Opposite claim orders each produce one compatible winner; later B cancellation cannot revoke a previously valid claim. |
| Provider accepted / DB save definite failure | One provider call; durable lease/UNKNOWN or accepted accounting recovery; manual second refund denied. |
| Provider accepted / DB commit reply lost | Idempotent outcome/application RPC retry; exact S applied once, no external replay. |
| Notification throw after accepted | Accepted money stays settled; missing delivery is tracked and retried separately. SQL notification failure also recovers without money change. |
| Provider timeout / connection / mismatch | UNKNOWN; wrong merchant/amount/TID/order/signature or missing cancellation identity and uncertain provider result codes cannot settle or authorize retry/manual completion. |
| Provider rejection | Signed correlated allowlisted rejection; explicit bounded retry gets a new journaled attempt/order/MID. |
| Card reconciliation | Exact signed accepted evidence settles UNKNOWN once. Late signed definite rejection records rejection before a separate explicit retry; mismatched proof and accepted downgrades fail. Unproven retry is rejected. |
| Concurrent manual admins | Exact S/proof: one success, one conflict; 20,000 vs 38,000 and missing proof rejected; PayPal capture/refund proof required. |
| Manual proof commit/application failures | Accepted external proof survives reply loss/apply failure; ordinary manual UI guard closes; accounting recovery only. |
| Completion 42702 | First confirmed-to-completed after end commits, one review notification, idempotent retry. |
| No early money movement | Start-time completion does not claim a solo refund or authorize a positive solo payout before end. |
| Dynamic booking-time S | Experience setting changes 38k to 42k do not change existing S; both snapshot values and later full/partial cancellation balance correctly. |
| Legacy/migration | Representative pre-migration finance unchanged; bank reserved basis, NULL provider, cancelled, normal/completed/refunded/processing/failed rows covered. Invalid slot times create no refund. |
| Approved existing server actions | Actual create/confirm bank/card RPCs; guest/host/admin cancel, review request/reject, force-cancel; configuration failure leaves finance untouched; verified checkout-release approval race refunds once. |
| Observability | Bounded counts and admin job failure record expose unresolved money; no ordinary log provider payload/TID/PII. |
| History deletion | Unresolved deletion fails; resolved deletion retains operation/attempt evidence. |

NICEPAY contract sources: [cancel API](https://developers.nicepay.co.kr/docs/pg/auth/payment-cancel/), [cancel result codes](https://developers.nicepay.co.kr/docs/pg/result-code/cancel-result-code/), [transaction inquiry](https://developers.nicepay.co.kr/docs/pg/inquiry/trans-inquiry/). The supported WebStd cancel protocol uses merchant-key correlation; the current status query alone does not establish exact partial-refund evidence.

## Production impact of this Draft PR

Production DB writes, payment/refund/cancel/payout/notification mutations, Cloudflare changes, secret/config changes, deployment, Vercel actions and merge: **all 0**. Only read-only DB transactions were executed. Git branch publication and Draft PR creation are review artifacts, not a Production rollout.
