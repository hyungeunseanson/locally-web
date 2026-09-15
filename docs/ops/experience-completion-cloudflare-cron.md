# Experience completion Cloudflare Cron

## Ownership and schedule

- Production schedule: `23 */2 * * *` (UTC), owned by the existing `locally-web-opennext-production` Worker.
- Primary executor after rollout: Cloudflare Cron → `handleExperienceCompletionScheduled()` → `runExperienceCompletionSync()`.
- Manual fallback: GitHub `workflow_dispatch` → authenticated `GET /api/cron/complete-trips` → the same shared processor.
- The GitHub automatic `23 */2 * * *` schedule is retired after the Production rollout; only `workflow_dispatch` remains there.
- PostgreSQL remains authoritative for due selection, run leases, booking completion, notifications, payout/refund state, and all financial truth. No Cloudflare Queue, KV, D1, R2, or Durable Object stores completion state.

The raw Wrangler baseline is fail-closed: `EXPERIENCE_COMPLETION_SCHEDULED_ENABLED="false"`. The repository-owned Production profile defaults to `on` after rollout. Use:

```sh
npm run cloudflare:deploy:production -- --experience-completion-profile=on
npm run cloudflare:deploy:production -- --experience-completion-profile=off
```

The completion profile is independent of the public-media cohort, Translation, Home Popularity, Admin Support, and notification-retention profiles. Production must retain all four exact Cron expressions:

- `17 19 * * *`: Translation recovery + Home Popularity
- `*/10 * * * *`: Admin Support unread alerts
- `31 19 * * *`: notification retention cleanup
- `23 */2 * * *`: Experience completion only

## Database contract

Production catalog verification on 2026-09-15 found:

- `list_due_experience_completion_candidates(text)`: owner `postgres`, `SECURITY DEFINER`, `search_path=public`, EXECUTE only for `postgres` and `service_role`, definition MD5 `bf1c439876f8b46965a12a0fb2356386`.
- `complete_experience_booking_if_due_atomic(text)`: owner `postgres`, `SECURITY DEFINER`, `search_path=public`, EXECUTE only for `postgres` and `service_role`, definition MD5 `950a92fb4afb38417b59da69ff6701ff`.

Due selection remains `PAID`/`confirmed`, uses the booking date/time interpreted in `Asia/Seoul`, requires the due instant to be before PostgreSQL `now()`, and orders oldest first. Atomic completion locks the booking row with `FOR UPDATE`, writes `completed`, and creates keyed guest and host review-request notifications under the existing rules.

`admin_job_runs` remains the batch lease and run-history authority. The configured defaults remain a 120-second renewable lease, 15-minute stale-running threshold, and 120-minute delay warning. Its partial unique index prevents two `experience_completion_sync` runs from being active at once. The per-booking RPC row lock and notification uniqueness constraints remain the second concurrency boundary.

## Financial and external side effects

The scheduled path preserves the existing order:

1. acquire the `admin_job_runs` lease;
2. list due bookings;
3. atomically complete each booking;
4. process the existing solo-guarantee refund path;
5. deliver the existing host/guest review requests and email;
6. renew and finish the job run.

The card cancellation and email adapters receive Worker bindings explicitly in the cold scheduled runtime. Their business rules, provider choice, amounts, status transitions, and failure handling are unchanged. External card/email success followed by a runtime crash before all database markers are committed remains a pre-existing side-effect window; this migration does not claim exactly-once external delivery.

Worker telemetry is aggregate-only: invocation ID, outcome, processed/skipped counts, duration, and bounded diagnostic stage/code. Booking/order/user identifiers, titles, amounts, transaction identifiers, email addresses, provider bodies, and raw exceptions must not be logged.

## Rollout and rollback

Before enabling the schedule, verify read-only that both the due candidate count and active `experience_completion_sync` run count are zero. The controlled HTTP canary is permitted only while both remain zero and must return `success=true`, the existing no-candidate message, `count=0`, and `ids=[]`. A successful zero-work canary may create one successful `admin_job_runs` record; it must not complete a booking, create a notification, send email, or call a payment provider.

If either preflight count is non-zero, leave completion scheduled execution OFF and keep the GitHub automatic schedule. Never create, edit, complete, refund, or reverse a Production booking to manufacture a canary.

Emergency rollback uses only the completion profile:

```sh
npm run cloudflare:deploy:production -- --experience-completion-profile=off
```

That rollback does not alter Translation, Home Popularity, Admin Support, notification retention, or the approved public-media cohort. It also does not reverse already committed booking/notification/refund state. If the GitHub automatic schedule has already been retired, restore its exact `23 */2 * * *` schedule by reviewed PR; the HTTP route and `workflow_dispatch` remain available throughout.
