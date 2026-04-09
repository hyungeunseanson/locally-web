# ADR: Settlement Sync Lease, DB-Side KST Due Checks, and Fail-Closed Infra

- Status: Accepted
- Date: 2026-04-09

## Context

The initial settlement-sync visibility/manual fallback rollout fixed observability, but a
red-team review surfaced four production-grade risks:

1. Experience failure runs could be recorded under the wrong `job_name`.
2. Batch lock ownership was based on `started_at + stale window`, which could allow a
   healthy long-running batch to lose the lock and be overlapped by a second runner.
3. Experience due checks were performed in app-layer JavaScript using the server's local
   timezone, which could mark KST bookings early or late.
4. Pre-migration fail-open fallbacks (`admin_audit_logs`, in-memory locks, service app-layer
   completion fallback) were still present, even after the required DB migrations were live.

For payout completion flows, these risks were no longer acceptable.

## Decision

We applied a hotfix with four architectural changes:

1. Correct worker-specific `job_name` constants for experience `run_due` vs `force_one`
2. Replace stale-by-started-at locking with `lease_token + lease_expires_at + heartbeat`
3. Move experience due candidate and backlog calculation into PostgreSQL using KST
4. Remove fail-open fallbacks and return `503 Service Unavailable` when required infra is missing

## Why Stale-By-Started-At Was Rejected

The old model implicitly assumed:

- every healthy batch finishes before the stale threshold

That assumption is fragile. As data volume grows, candidate scans, updates, or side effects may
legitimately run longer than the threshold. A second cron/manual run could then reclaim the lock
while the first runner is still active.

We rejected that model because it creates two risks:

- overlapping batch execution
- old runners overwriting final run status after a newer runner takes over

## Lease + Heartbeat Model

`admin_job_runs` remains the source of truth for:

- operator visibility
- job-level lock ownership

But `running` ownership is now governed by:

- `lease_token`
- `lease_expires_at`
- `last_heartbeat_at`

Rules:

- start: abandon only expired leases, then insert a new `running` row with a unique token
- renew: extend the lease only if `id + job_name + status + lease_token` still match
- finish: mark success/failure only if the runner still owns the lease

If finish/renew updates zero rows, the worker treats that as `lease lost` and surfaces a `503`
infrastructure failure instead of pretending the run finished safely.

This makes lock loss explicit and prevents stale runners from writing final status over a newer run.

## Why Experience Due Checks Moved to PostgreSQL

Experience bookings store `date` and `time` as local business values. App-layer JavaScript
was previously comparing them against the app server's local timezone, which is unsafe when the
server timezone differs from Korea.

We introduced DB-side RPCs:

- `list_due_experience_completion_candidates`
- `get_experience_completion_due_backlog`

These compute due timestamps with:

- `AT TIME ZONE 'Asia/Seoul'`

This makes both:

- completion eligibility
- backlog / lag health

depend on the same KST definition inside PostgreSQL.

## Why Fail-Open Was Removed

The original rollout tolerated partially migrated environments by falling back to:

- `admin_audit_logs`
- in-memory batch locks
- app-layer service completion fallback

That behavior is acceptable during a short migration window, but once the DB contract is declared
required in production, silent fallback becomes more dangerous than hard failure.

We therefore moved to fail-closed:

- missing `admin_job_runs` access => `503`
- missing service completion RPC => `503`
- missing experience due RPC => `503`

Admin UI now surfaces an infrastructure banner and disables manual triggers instead of pretending
the system is still safe.

## Consequences

Positive:

- healthy long-running batches retain lock ownership
- experience due logic is timezone-stable
- operators see explicit infrastructure failures instead of hidden degraded mode
- distributed correctness no longer depends on undocumented fallback behavior

Tradeoffs:

- required migrations become hard prerequisites
- some previously permissive recovery paths now fail fast
- workers must renew leases at meaningful checkpoints

## Guardrails

- `force_one` still does not override due rules
- cron URLs remain unchanged
- required settlement-sync infra must never silently downgrade in production
- experience and service completion workers must use worker-local `job_name` constants

