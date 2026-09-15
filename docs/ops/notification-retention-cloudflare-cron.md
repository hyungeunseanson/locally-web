# Notification retention Cloudflare Cron

## Contract

PostgreSQL remains the deletion authority. `public.prune_notifications_retention(timestamptz, integer)` owns the predicate, ordering, batch clamp, and transaction-scoped advisory lock. The application only computes one cutoff (`now - 30 * 24 hours`) and invokes that RPC with batches of 1,000, at most five times. One invocation can therefore delete no more than 5,000 rows.

The protected rule is unchanged: an old notification is not eligible while `type = 'profile_demographics_required'` and `is_read = false`. Old read demographics notifications and other old notification types remain eligible under the database function. Each RPC call is its own transaction; the advisory lock serializes an individual batch, not the entire five-batch application loop. Interleaved cleanup invocations remain safe because every batch re-evaluates the same predicate and deleted rows cannot be selected again.

## Scheduling and rollout

Cloudflare owns the Production schedule `31 19 * * *` (19:31 UTC). `NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED` and `CLOUDFLARE_DEPLOYMENT_ENV=production` must both match exactly before the scheduled handler invokes the RPC. The raw `wrangler.jsonc` value is fail-closed (`false`). The repository-owned deployment profiles are independent of media, translation, Home popularity, and Admin Support:

```sh
# Normal Production state after rollout (retention ON by default)
npm run cloudflare:deploy:production

# Emergency scheduler stop; other Production profiles remain ON
npm run cloudflare:deploy:production -- --notification-retention-profile=off
```

The authenticated `GET /api/cron/notification-retention-cleanup` route and GitHub `workflow_dispatch` remain the manual fallback and call the same processor. After Cloudflare activation, the GitHub automatic schedule is retired. Unknown Cron expressions continue through the existing OpenNext delegation contract.

## Deletion preflight and recovery boundary

Before a manual Production cleanup, run the read-only reporter with the approved Production environment:

```sh
npm run notification:retention:preflight
```

It emits only counts, type/read distributions, timestamps, and a stable SHA-256 aggregate of candidate identities. It never emits notification IDs, users, titles, messages, links, or provider bodies. The controlled migration canary additionally requires a successful encrypted DB backup less than 24 hours old and `eligibleCount <= 100`.

Successful retention deletion is not rolled back. If parity fails, disable only the retention profile and stop; do not reinsert rows automatically. Restore from encrypted backup requires a separate approval. The scheduled handler logs bounded outcome fields only. Natural Cron delivery can be delayed or duplicated, so the PostgreSQL predicate and advisory lock—not the scheduler—provide correctness.
