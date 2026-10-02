# Candidate-first Production release contract

## Current decision: BLOCKED

This Draft adds a separately tested release contract, a candidate browser adapter,
and a read-only/local dry-run command. It does **not** install live upload,
deployment, telemetry-query or post-deployment health adapters. The existing
`cloudflare:deploy:production` command retains its current gates and behavior.

Production implements `DOQueueHandler` and `DOShardedTagCache`, and both its
config and the provider snapshot disable Version URLs. Cloudflare does not
generate Version URLs for Workers implementing Durable Objects. Enabling
`preview_urls` alone would not resolve that limitation. Creating a separate
Preview would provision separate DO resources/settings and would require a
separately reviewed design; it cannot silently replace testing the uploaded
Production version with the existing bindings.

Consequently this path blocks before an actual upload. No preview flag, DO
binding, migration, route, consumer or secret is changed to make it pass. Missing
isolation must be resolved before enabling live execution.

See [Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)
and [workflow comparison](https://developers.cloudflare.com/workers/previews/compare-workflows/).

## Commands available in this Draft

```sh
npm run cloudflare:release:production -- --plan
npm run cloudflare:release:production -- --dry-run
npm run cloudflare:candidate-release:contract
```

The default is `--plan`. It reads Production metadata, checks the local Wrangler
config against fetched `origin/main`, and runs the existing semantic preflight
with no allowed config/Cron changes. On current Production it reports BLOCKED
and exits nonzero. Fetch/recheck `origin/main` before running it.

`--dry-run` additionally runs the existing Production build and
`wrangler versions upload --dry-run`. Wrangler 4.129.1 skips provider assets and
version uploads in that mode. Public build variables are supplied exactly as
for the existing build; Production secret values are never fetched. Fixture
public variables are acceptable for local build validation only, and cannot
produce a Production-ready release artifact. Child output is captured instead
of logged because it can contain variable values. There is no `--execute`,
force or bypass option.

## Future sequence, exercised with injected fixture adapters

1. Capture the current single stable version at 100% and sanitize the provider
   configuration snapshot. Build, then semantic preflight must pass.
2. Recheck stable traffic/config immediately before `versions upload`. Keep
   encrypted secrets and managed flag values; capture exactly one uploaded UUID
   and its provider Version URL. Check candidate metadata/binding targets and
   verify upload left the deployment unchanged.
3. Run isolated candidate smoke on its immutable Version URL. Require that same
   origin, no redirects, HTML asset references returning 200, Home, public detail,
   login input readiness and unauthenticated API 401.
4. Add the candidate to the active deployment at **exactly 0%**, stable at 100%.
   This is a deployment mutation even though ordinary traffic remains stable.
   Read the provider distribution back; epsilon traffic is rejected.
5. Smoke `https://www.locally-travel.com` with
   `Cloudflare-Workers-Version-Overrides: locally-web-opennext-production="<UUID>"`
   on first-party read requests, including HTML, JS, font and API. Reuse the
   existing context mutation gate and maximum two attempts per page.
6. Require request-level execution identity, both full candidate smoke passes,
   no hard failure and a fresh unchanged-config/distribution precheck. Then
   `versions deploy <candidate>@100%` removes stable from the distribution.
7. Require the resulting single candidate at 100%, unchanged scheduled flags,
   natural Cron health, Queue health and post-deploy browser smoke. The Draft's
   fixture adapter checks these obligations; live health readers remain absent.

Upload never substitutes for deployment. Trigger changes are an independent
provider operation and are absent from the plan. Pinned Wrangler may synchronize
non-versioned settings during `versions deploy`; snapshots before/after staging
and promotion must therefore remain identical.

See [versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/),
[deployment management](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/)
and [version overrides](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/).

## Identity and transport evidence

Version existence or a configured override header does not prove execution.
For override smoke, correlate response Ray IDs and bounded request timestamps
with existing Workers Observability invocation fields: script name, exact
`scriptVersion.id`, `requestId`, fetch event and successful outcome. Require
receipts for Home, login, public detail and API. Keep only pathname, timestamp,
status and Ray receipts; do not collect bodies, cookies, auth, query strings,
HAR or raw provider events. Static responses need the same override and 200
asset evidence; they need not generate Worker invocation logs.

The provider API describes `requestId` as the triggering request's Cloudflare
Ray ID. Missing or sampled-out identity evidence blocks promotion. Current 10%
Observability sampling is preserved and may cause that block; no debug header
or sampling/config change is introduced. Version URLs cannot be inspected with
Workers Logs, tail or Logpush; their isolated identity contract relies on the
provider-issued immutable URL, matching UUID/metadata and absence of redirects.

Only a recorded timeout with pending JS/font assets and explicit absence of
HTTP hard errors, 5xx, generic error, page/console errors, writes, asset 404 or
version mismatch is `TRANSPORT_ONLY_TIMEOUT`. A subsequent full PASS within
two attempts is required. An unclassified timeout, missing evidence or third
attempt blocks. The classifier does not widen timeouts, change QUIC settings
or bypass the existing browser safety checks.

See [Workers API telemetry fields](https://developers.cloudflare.com/api/resources/workers/)
and [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

## Preservation and recovery

Snapshot comparisons cover routes, custom domains, preview settings,
Observability, Cron expressions, Queue consumers/settings, managed flags and
binding names/types/targets including DO namespace IDs. Local config comparison
includes DO migrations. `plannedTriggerChanges` is always empty. Secret values
and public API-key values are excluded; only encrypted binding names/types are
retained. `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must
remain encrypted bindings. `keep_vars: true`, `--keep-vars` and Wrangler's
existing secret inheritance preserve provider state. Managed runtime overrides
must already equal the snapshot, including all scheduled flags.

Before release, retain the captured stable UUID. The rollback contract generates
`wrangler versions deploy <stable>@100% --config ./wrangler.jsonc --env production --yes`.
Check config and read back single-version 100% after an approved recovery; do
not assume rollback reverses DB, R2, Queue or DO data changes. There is no
automatic rollback or mutation retry in this Draft.

See [rollback support and limitations](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).
