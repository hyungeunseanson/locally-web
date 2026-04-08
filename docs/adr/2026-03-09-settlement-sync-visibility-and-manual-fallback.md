# ADR: Settlement Sync Visibility and Manual Fallback

- Status: Accepted
- Date: 2026-03-09

## Context

Completion sync for payouts was split across two cron routes:

- `GET /api/cron/complete-trips`
- `GET /api/cron/complete-services`

They updated booking state correctly, but operations had three gaps:

1. Admins could not see whether the last run succeeded, failed, or silently lagged.
2. There was no safe admin fallback to sync one overdue booking/order immediately.
3. Cron and manual recovery could touch the same target concurrently without an explicit
   shared architecture for locking and observability.

## Decision

We introduced a shared settlement-sync architecture with three layers:

1. Shared completion workers for experience and service
2. Admin visibility/trigger BFF
3. Sales-tab operational UI

The cron URLs stay unchanged, but they now delegate to the same workers as admin manual
actions.

## Why the UI Lives in SalesTab

We placed the operational panel at the top of `Billing & Revenue (SALES)` instead of adding
another sidebar tab.

Reasons:

- Completion sync directly affects payout queue visibility and settlement timing.
- Operators already use `SALES` to inspect payout readiness.
- `Master Ledger` is transaction detail oriented, not batch-health oriented.

This keeps the recovery tool close to the settlement surface that depends on it.

## Visibility Model

We introduced:

- `GET /api/admin/settlement-sync`

This BFF returns health for:

- `experience_completion_sync`
- `service_completion_sync`

Each job reports:

- last success
- last failure
- backlog count
- oldest due timestamp
- lag minutes
- running / stale-running state

Health is backlog-first, not scheduler-config-first. We do not assume a hardcoded cron
frequency from code. Instead, we consider a job delayed when overdue backlog exists past
the warning threshold.

## Locking and Run History

We introduced `admin_job_runs` as the primary source of truth for both:

- visibility
- batch job lock ownership

Reasons:

1. The same data can explain what happened and prevent duplicate batch execution.
2. `running` rows are easy to reclaim as `abandoned` after a stale threshold.
3. Operators can reason about the current lock holder from the same health data they see.

Fallback policy:

- if `admin_job_runs` is not yet migrated, visibility falls back to `admin_audit_logs`
- batch lock falls back to an in-memory map for single-process dev/test safety

This fallback is intentionally fail-open for migration rollout, but distributed lock
guarantees require the `admin_job_runs` table.

## Manual Fallback Design

We introduced:

- `POST /api/admin/settlement-sync`

Supported modes:

- `run_due`
- `force_one`

`force_one` is not a business-rule override. It is only a scheduler fallback.

That means:

- overdue targets can be completed immediately
- future bookings/orders return `not_due`
- already completed targets return `already_processed`

We explicitly rejected a "force complete anything now" design because it would blur the
difference between scheduler recovery and manual state corruption.

## Race Condition Guard

We use a mixed strategy:

### Batch vs batch

- job-level lock via `admin_job_runs` running row

This prevents:

- cron + manual `run_due`
- manual `run_due` + manual `run_due`

from scanning the same backlog at the same time.

### Batch vs single target

- row-level idempotency

Experience:

- compare-and-set `UPDATE ... WHERE status IN active AND due`
- review-request notification is sent only for rows actually updated

Service:

- atomic RPC `complete_service_booking_if_due_atomic`
- fallback compare-and-set with rollback if request completion cannot be committed

This allows `force_one` to stay available even if a batch run is in progress, without
corrupting state or duplicating completion semantics.

## Loading and Frontend Contract

The admin panel uses a single BFF fetch for status and a single trigger route for actions.

Rules:

- status cards are rendered from `/api/admin/settlement-sync`
- manual actions are executed only through the admin trigger route
- frontend does not infer health state locally
- frontend does not perform direct completion writes

This keeps the UI "dumb" and makes cron/manual behavior explainable from server state alone.

## Consequences

Positive:

- Operators can see lag, stale runs, and failure history in one place.
- Manual recovery is explicit and safe.
- Cron and admin fallback now share one business-logic path.

Tradeoffs:

- Service batch completion is heavier because atomic single-booking RPC is invoked per
  candidate booking.
- Full distributed lock behavior depends on the `admin_job_runs` migration being applied.

## Guardrails

- Cron URLs must stay stable.
- `force_one` must never complete future targets.
- Batch lock and single-target idempotency must remain separate concerns.
- Review-request notifications must only be created for rows that actually transitioned.

## Validation

The implementation is protected by:

- cron secret regression tests
- service completion / payout eligibility regressions
- admin health panel tests
- manual force-sync tests
- cron/manual race and overlapping batch lock tests
