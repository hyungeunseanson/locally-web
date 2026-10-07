# Merchant-ledger reconciliation of an already-completed NICEPAY refund

This foundation records an administrator's verification of an existing merchant-ledger cancellation and settles only local money state. It cannot issue a provider refund. The migration is **pending**; this PR does not authorize Production application, reconciliation, notification delivery, deployment or merge.

## Separate acceptance authority

The existing signed-response `reconcile_solo_refund_accepted_atomic` still requires authentic accepted result code, provider refund reference, original TID, operation order reference and exact amount. Missing fields must remain missing. The existing accepted/rejected RPCs and `apply_solo_refund_settlement_atomic` are byte-for-byte unchanged and the additive migration pins their observed bodies, owner, security-definer setting, search path and execute ACL before creating anything.

`reconcile_solo_refund_provider_ledger_accepted_atomic(uuid,jsonb,text,uuid)` is executable only by `service_role`. It independently requires a confirmed, non-deleted Auth identity that is an admin through `public.users.role` or the existing exact-email admin whitelist. An application profile email alone cannot authorize this path. There is no browser endpoint, automatic job or notification sender in this change.

The proof is an **admin attestation of merchant-ledger evidence**, not a cryptographically signed NICEPAY response. The SHA-256 binds the immutable package and a separately retained export; it does not authenticate NICEPAY by itself. A trusted operator must inspect the legitimate merchant ledger/export and verify the administrator's identity before calling the service-role RPC. Do not expose this authority to a browser or let an untrusted caller supply an admin UUID.

## Evidence contract

Version 1 accepts exactly the fields exported by `LEDGER_PROOF_FIELDS` and `LEDGER_BOOKING_FIELDS` in `scripts/financial/solo-refund-ledger-proof.mjs`:

- Exact operation, booking, attempt and stored operation order reference; NICEPAY/card, MID and original TID.
- Provider-generated cancellation TID, distinct from original TID, unique across accepted ledger proofs. Its original-TID link must be verified in the export.
- Original gross, cancel amount, original approval's remaining balance, one cancellation, approval/cancel timestamps and acquisition date.
- Merchant-ledger source, `후취소` / `취소매입`, merchant verifier account, capture time, original-order/all-states query window.
- SHA-256 of the original private provider export, actual verifying admin UUID, and exact financial booking snapshot.

The stored operation order reference is a **local binding**; it is not a recovered provider CancelMOID. The cancellation row's zero balance is not the original approval's remaining balance. No ResultCode, CancelNum or refund order reference may be inferred from the ledger.

Keep raw exports private, encrypted/offsite according to the existing financial evidence process, with restrictive local permissions. Never commit cardholder details, raw financial snapshots, browser cookies, tokens, passwords, Auth metadata or real proof payloads. Retain the original bytes matching `provider_export_sha256`; download time alone is not a provider transaction time.

Canonical version 1 recursively sorts ASCII object keys and uses compact UTF-8 JSON with canonical safe integer amounts; arrays, ambiguous numbers and unknown fields are rejected by the preparation helper. PostgreSQL recomputes the same digest. `prepareLedgerReconciliationProof(payload)` is pure and returns parameters in `prepare-only` mode: no credential access, database client, mutation mode or network transport.

`proof_reference = nicepay-ledger:<canonical-payload-sha256>` identifies the internal evidence namespace. `result_code` and `provider_refund_reference` stay NULL. The real cancellation TID and sanitized payload reside in the new RLS-enabled private evidence table. Service role can read that table; it cannot directly insert/update/delete it. Public/anon/authenticated have no table or RPC access.

## Bounded operation eligibility

This initial path supports only the first, single-attempt, unreserved-basis, zero-prior-refund NICEPAY/card **partial** cancellation. Broader histories require separate evidence/design approval; do not relax this gate to fit another case.

Under the existing experience-money → booking → operation lock order, first acceptance requires unknown/unsettled, completed booking, pending/unpaid payout, unknown/zero Solo refund, exact unchanged financial snapshot, gross/basis/amount consistency and no existing accepted proof. Cancel time must fall between the request's displayed second and 30 seconds after request start. Approval precedes request; capture follows cancellation; acquisition date follows cancellation and precedes capture; query covers approval and cancellation. The 30-second correlation bound is intentionally conservative, not a general provider latency assumption.

Evidence insert, acceptance update and the existing settlement RPC run in one transaction. A settlement exception rolls back all three. Neither helper nor RPC imports/calls `cancelCardPayment`, transport or notification delivery. The existing settlement formulas and payout/cancellation guards remain authoritative; delivery stays pending with its existing durable eligibility. The NICEPAY ACK application code is unchanged.

Same exact proof replay returns current accepted/settled state without money or timestamp changes. A second proof for the same operation is rejected. A reused digest cannot bind another operation, and a reused cancellation TID is rejected by a unique constraint, rolling back acceptance. Already signed-response accepted/settled operations are read-current only and acquire no ledger proof. Concurrent same-proof callers serialize and settle once. A conflicting concurrent proof cannot replace the winner.

After settlement, an ordinary future booking cancellation remains subject to the existing cancellation authority and uses the reduced basis; do not blanket-disable legitimate future cancellation. Unresolved money continues to block payout and cancellation; claims remain exactly once.

## Future Production preflight (requires separate approval)

1. Fresh-fetch main and review the exact additive migration SHA. Confirm the current-state contract still identifies this migration as pending; never run blanket pending migration apply.
2. Repeat scoped read-only booking/operation/attempt inspection. STOP for changed money state, additional cancellation, inconsistent balance, paid payout, accepted/applied settlement or non-unique evidence. Confirm existing function bodies/ACLs and migration ledger are unchanged.
3. Confirm provider evidence remains exactly one already-completed partial cancellation, original amount and remaining balance. Recover authentic signed-response fields if possible; use that unchanged authority only when its complete contract is met.
4. Verify the actual admin, raw export hash, original/cancellation TID link, local operation binding, capture/query timestamps and all snapshot fields. Canonicalize/hash the sanitized package locally and archive the source bytes privately. Produce exact parameters without executing them.
5. Derive expected monetary state from authoritative operation/booking values and confirm the unchanged settlement authority produces it in an isolated fixture. Assert monetary conservation and payout remains pending. Obtain separate exact Production migration and reconciliation approval.
6. Only after approval may a separately reviewed operator apply the one exact migration and call the local settlement-only RPC. No provider cancellation/retry/webhook replay is part of this runbook. Verify the atomic resulting money state and retained evidence. Notification delivery remains a separate approved workflow.

## Validation

Foundation runs proof unit tests, the full native PostgreSQL 17 Financial P0 suite, NICEPAY ACK regressions and existing backup/current-state gates. Native tests cover prior authority immutability, real-admin binding, digest agreement, private ACLs, amount/MID/TID/gross/booking/attempt/order/time/snapshot/balance rejection, paid payout, replay, conflicts, cross-operation reuse, concurrent acceptance, forced settlement rollback, zero network/notification calls, monetary conservation and existing guards. Current-state fixtures reject pending-entry removal, applied relabeling and altered migration bytes while preserving all currently applied media and Admin Chat contracts.
