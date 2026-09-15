# Home popularity snapshot scheduler

## Ownership and data contract

`public.refresh_experience_popularity_snapshot()` and
`public.experience_popularity_snapshot` remain the authoritative business
contract. The scheduler migration does not change their SQL, ACL, RLS, index,
or cache behavior.

The current Production function is `SECURITY DEFINER`, owned by `postgres`,
has a fixed `search_path=public`, and grants execute only to `service_role`.
It takes an `ACCESS EXCLUSIVE` lock by truncating the snapshot, then inserts one
row for each `wishlists.experience_id` group. Experiences with no wishlist are
not included; active state is not filtered by this maintenance function.
Every row in one refresh receives the same `computed_at`, and the integer RPC
result is the number of inserted groups. The primary key is `experience_id` and
the foreign key cascades when its experience is deleted.

The table lock remains held until the RPC transaction ends. Concurrent refresh
calls therefore serialize rather than interleaving truncate/insert phases. A
duplicate Cron execution may repeat work, but does not merge two partial
snapshots. This conclusion depends on the audited function definition; any SQL
change requires a new concurrency review.

## Execution paths

- Primary: Cloudflare Cron `17 19 * * *` (UTC) invokes the Production Worker.
- The Worker starts translation missed-enqueue recovery and the Home snapshot
  refresh independently, then waits for both outcomes. One failure is logged
  separately and does not prevent the other task from starting; any failure
  still makes the owned scheduled invocation fail for observability.
- Emergency fallback: the schedule-retired GitHub `workflow_dispatch` calls the authenticated
  `/api/cron/home-popularity-snapshot` route.
- Both Home paths call the same shared processor and the same PostgreSQL RPC.

Unknown Cron expressions are delegated to the generated OpenNext Worker when it
provides a scheduled handler. Canary, Preview, local, a wrong Cron expression,
or a missing/malformed enable value cannot run the Production refresh.

## Release profiles and rollback

The raw Wrangler baseline is fail-closed:

`HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED="false"`

The repository-owned canonical Production release defaults to the independent
`on` Home profile after rollout. It does not change the translation profile or
the approved public-media cohort.

```sh
npm run cloudflare:deploy:production -- --home-popularity-profile=on
```

Emergency Home-only scheduler disable:

```sh
npm run cloudflare:deploy:production -- --home-popularity-profile=off
```

The OFF command performs a fresh canonical build and leaves Translation Queue,
Translation scheduled recovery, and public-media reader/producer settings at
their own repository-owned defaults. Turning Home OFF does not revert snapshot
rows and must not be paired with another refresh solely for rollback.

Cron configuration changes may take time to propagate globally. Verify the
deployed variable, exact single Cron expression, Worker version/deployment,
and both scheduled-task logs after a release.

## Read path and freshness

`GET /api/home/experiences` reads the snapshot for the visible experience IDs
and joins `wishlist_count`, defaulting a missing snapshot row to zero. A failed
snapshot query is logged and the Home response remains available. The route's
existing `s-maxage=300, stale-while-revalidate=3600` response cache is unchanged;
a successful database refresh does not purge or explicitly revalidate cached
Home responses. Database parity and user-visible cache freshness are therefore
separate checks.

## Production verification

Before a controlled HTTP refresh, derive the expected rows from the audited
function itself: group `public.wishlists` by `experience_id`, count each group,
and compare only aggregate counts and a deterministic key/count digest. Record
snapshot row count, aggregate wishlist count, min/max `computed_at`, function
definition digest, and ACL without exporting row payloads or user identifiers.

Call the authenticated HTTP fallback at most once for the canary, then verify:

- RPC response count equals the expected grouped row count;
- key/count digest and total count match the expected query;
- no missing, unexpected, or duplicate snapshot keys exist;
- `computed_at` advances consistently across all rows;
- the audited function touches only the rebuildable snapshot table.

Do not create test wishlists or experiences, rewrite the SQL, purge application
caches, or repeat a failed Production refresh. The GitHub automatic schedule
was retired only after the dormant deployment, local cold scheduled test, HTTP
canary, and ON deployment passed. Retain `workflow_dispatch` plus the
authenticated HTTP route as the emergency fallback.
