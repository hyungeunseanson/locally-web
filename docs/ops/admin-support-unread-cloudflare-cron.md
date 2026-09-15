# Admin Support unread alert scheduler

## Ownership and delivery contract

PostgreSQL remains authoritative for unread waves and delivery progress through
`admin_support_unread_alert_batches` and
`claim_due_admin_support_unread_alert_batches(integer)`. The migration changes
only the scheduler/executor. It does not change the 60-minute delay, channel
copy, recipients, read handling, or database schema.

The audited Production RPC is `SECURITY DEFINER`, owned by `postgres`, fixes
`search_path=public`, and is executable by `postgres` and `service_role` only.
It orders due rows by `alert_due_at, inquiry_id`, excludes claims newer than 15
minutes, and claims with `FOR UPDATE SKIP LOCKED`. Concurrent processors thus do
not receive the same batch from the authoritative claim RPC. Release updates
remain conditional on the claimed wave identity, so a newer unread wave cannot
be overwritten by an older processor.

Channel state is intentionally separate. In-app and email markers advance only
when all current targets for that channel succeed (or the target count is zero),
and processing is released after partial failure. External delivery occurs
before its database marker; a runtime failure in that interval can still cause
a duplicate delivery after stale recovery. This pre-existing boundary is not an
exactly-once guarantee and is not changed by the scheduler migration.

## Execution and Cron routing

- `*/10 * * * *` (UTC): Admin Support unread processor only.
- `17 19 * * *` (UTC): Translation recovery and Home Popularity only.
- Unknown expressions delegate to the generated OpenNext scheduled handler when
  present, otherwise they fail closed.
- Emergency fallback: GitHub `workflow_dispatch` calls the authenticated
  `/api/cron/admin-support-unread-alerts` route, which uses the same processor.

The scheduled runtime receives Supabase and email configuration explicitly from
the Worker environment. It does not require a preceding HTTP request to populate
request-scoped or process-global state. Logs contain only bounded counts,
storage classification, invocation IDs, duration, stage, and diagnostic codes;
guest names, previews, emails, IDs, raw provider bodies, and credentials are not
logged.

## Release profiles and rollback

The raw Wrangler baseline is fail-closed:

`ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED="false"`

The repository-owned canonical Production deployment defaults to the independent
`on` profile after rollout. Translation, Home Popularity, and the approved media
cohort remain controlled by their own profiles.

```sh
npm run cloudflare:deploy:production -- --admin-support-unread-profile=on
```

Admin Support-only emergency disable:

```sh
npm run cloudflare:deploy:production -- --admin-support-unread-profile=off
```

Turning the scheduler OFF does not reset database batches or sent markers and
does not resend or retract external notifications. If the GitHub automatic
schedule has been retired, restore its exact `*/10 * * * *` schedule before
depending on it as an automatic rollback path. Do not reset batch rows manually.

## Production verification

Before the one permitted HTTP canary, record only aggregate active, due, pending
channel, and processing counts plus a digest of the due batch key set. Invoke the
authenticated route once. A zero-due result validates the shared Production
processor boundary without creating data. If legitimate due rows exist, their
normal in-app/email delivery and marker updates are expected operational writes.
Compare claimed, alerted, emailed, skipped, failed, released, remaining due, and
unrelated-batch counts without exposing user or message data.

After ON deployment, verify both exact Cron expressions, the independent flag,
other rollout settings, Worker errors, and the next natural 10-minute invocation
when available. Cloudflare Cron is the primary scheduler only after these checks;
GitHub `workflow_dispatch` and the HTTP route remain the manual fallback.
