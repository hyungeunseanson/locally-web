# Completed PHASE1 protected source reconciliation

This PR copies the reviewed PHASE1 protection delta onto main `77d0d730fb418d68025585bcab8e08a0671ece87`. It does not repeat the financial incident investigation or its operational actions.

## Source and operating provenance

- Original base: `e4933ce1c00707b792e69911a0791726a6a7e956`.
- Original staged Git tree: `c04ca87d4e3764d9b1abe28700f552e915da927a`; the source worktree has no unstaged tracked changes.
- Completed release evidence records that tree, independently verified uploaded modules and Worker SHA256 `7760ac58843c5f134797c21de2ee1b6874c47ea6475c2a0f55ded6ea475f25a5`.
- Operating protection Worker: `9c181ab0-84db-400f-9121-755970a6bcae`, deployment `01bd5bb4-8706-48f8-94a0-16f8b86353fa`, singleton 100% confirmed read-only on 2026-10-10.
- The unapproved emergency preclaim 503 patch was review-only and is not integrated.

The original 20-path delta is copied byte-for-byte from the Git tree. It fences only the reviewed retired attempts, preserves the protected normal booking, retains signed evidence and idempotent recovery, separates unverified notification inboxes from financial evidence, and preserves administrator-only monitoring and cooldowns. The runtime does not automatically execute the closeout RPC or refund recovery.

## Installed database contracts — no reinstall

`20261009035059_targeted_nicepay_ab_closeout.sql` is the original S source, already applied by PHASE1. Adding its existing filename to Git is source bookkeeping, not authorization to execute it. Do not run `supabase db push`, reinstall it, repair the Production ledger, or replay historical closeout scripts as part of this PR/release.

The completed V2 operation explicitly left the migration ledger at 29 entries; V2 was installed as a separately authorized operation, not a new migration. `phase1-installed-v2-review.sql` preserves its exact approved review original, SHA256 `573bf194564b6c00bb2f57eb0494aaed298be59fc01276a975fc0653f3925f38`. It retains its execution-blocking review guard and ROLLBACK. It is deliberately outside `supabase/migrations/`. Its old UNAPPROVED header describes the historical prototype, not current installation status.

The completed operation evidence attests the installed body/ACL canonical SHA256 `61485ea64c5b47155b6ca8a4991c7561de63bf12f5d83eae5361090a890a6a96`, postgres ownership, SECURITY DEFINER with empty search_path, EXECUTE denied to PUBLIC/anon/authenticated and allowed to service_role. No fresh Production schema assertion or ledger recapture is performed here: this is an explicit handoff of the completed source, not a rerun of PHASE1.

The portable V2 fixture installs only the exact definition/ACL from that guarded archive in a disposable local PostgreSQL database. It exercises expired evidence, contradictory drain claims, non-service roles, pair atomicity, normal-booking preservation, idempotency, late approval and no automatic seat restoration. PostgREST carries synthetic role JWTs on loopback only. Real provider calls are blocked.

## Integration and future release

Keep this PR and F04 #216 Draft. Their application source paths do not overlap; merge simulation must verify the combined tree. After explicit merge approval, merge this protection source first, refresh F04 onto that main, run exact-head Financial/SEO/Foundation/Backup/Chat CI on the combined source, then seek a separate release approval.

A future candidate must preserve all operating protection source and use the current protected Worker as semantic baseline and rollback target. Do not revert to the unprotected F01/F02 versions. Preserve 63 bindings, 32 secret references, 2 Queue consumers, 5 Crons, DO/services/routes, R2 authority flags and F03 rules. Provider-backed module/static identity and build-scoped DO/ISR compatibility must be revalidated for that future artifact. CI's fixture build cannot attest identity to the existing operating artifact.

This PR authorizes no database operation, Worker release, traffic change, Canary secret change, reservation mutation or Cloudflare bot policy change.
