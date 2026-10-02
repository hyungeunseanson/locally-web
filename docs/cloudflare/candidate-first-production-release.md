# Candidate override-only Production release contract

This Draft replaces the Version URL prerequisite with exact-zero deployment and
Version Override smoke. Workers implementing Durable Objects have no Version
URL; `preview_urls=false` and DO presence do not block this architecture.
A candidate in the current deployment at exactly 0% can be selected on the
Production custom domain with a Version Override.

Sources: [Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/),
[Version Overrides](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/).

## Commands and authorization boundary

```sh
npm run cloudflare:release:production -- --plan
npm run cloudflare:release:production -- --dry-run
npm run cloudflare:candidate-release:contract
```

Fetch/recheck `origin/main` first. The CLI supports only read-only planning and
local build/package dry-run. It installs no live mutation adapters and accepts
no execute, force or bypass option. The existing `cloudflare:deploy:production`
command retains its gates and behavior. PR #160 remains Draft; merge is forbidden
until the Admin Attention Production rollout has completed and merge is authorized.

`--plan` requires fresh DO artifact evidence to report release readiness; without
it the verdict is `DO_IMPLEMENTATION_UNKNOWN`. `--dry-run` builds Production
locally, packages with `wrangler versions upload --dry-run`, compares DO artifacts
and checks the provider baseline again. Child output stays captured because it
can contain variable values. Public fixture credentials validate local packaging
only and do not produce a deployable Production artifact. No Production secret
values are fetched or printed.

An actual `versions upload` creates a version without assigning active traffic.
`stable@100% + candidate@0%` **changes Production deployment metadata**, although
ordinary candidate traffic remains 0%. That staging requires separate user
approval. This code/contract task performs neither operation.

## Release sequence, tested with fixture adapters

1. Capture the exact single stable version at 100%, deployment ID and sanitized
   config. Build and semantic preflight must pass. Validate fresh DO proof.
2. Recheck config and deployment immediately before upload. Upload once with
   pinned Wrangler and `--keep-vars --strict`; capture exactly one candidate UUID.
   Verify its encrypted binding names/types and targets, allowing only the new
   `CF_VERSION_METADATA` binding. Version URL is optional capability data.
3. Verify upload left the exact active deployment ID and stable100 distribution
   unchanged. No isolated Version URL smoke is attempted.
4. Stage exactly:

   ```sh
   wrangler versions deploy <stable>@100% <candidate>@0% \
     --config ./wrangler.jsonc --env production --yes
   ```

   Read back exactly those two versions with numeric 100 and 0. Reject epsilon
   traffic, an unknown percentage, a missing candidate or any third version.
5. Smoke `https://www.locally-travel.com` with both headers on first-party reads:

   ```text
   Cloudflare-Workers-Version-Overrides: locally-web-opennext-production="<candidate UUID>"
   X-Locally-Release-Probe: 1
   ```

   This includes documents, RSC/data GET, JS, CSS, fonts, images and API GET.
   Preserve the existing context write gate and PR #158's maximum two attempts,
   readiness timeouts, HTTP status assertions and browser error checks.
6. Require exact deterministic candidate identity, Home/login/detail/API401 PASS,
   assets matched to the candidate HTML, no redirect/404/5xx/generic error,
   pageerror, first-party console error or unexpected write. Recheck the exact
   zero deployment ID, distribution and config before promotion.
7. Only after all gates pass, deploy candidate100, read back single100 and verify
   browser, natural Cron and Queue health plus unchanged scheduled flags.
   Live upload/stage/promote and health adapters are intentionally absent here.

No automatic mutation retry or rollback is installed. A rollback argument helper
retains the captured stable UUID; executing it is a separately approved action.

## Durable Object gates

Preserve Production `DOQueueHandler` and `DOShardedTagCache` bindings, namespace
IDs, exported handlers and migration declarations **including array order**.
Creation, deletion, rename, transfer, tag, binding or export lifecycle changes
block with `DURABLE_OBJECT_LIFECYCLE_CHANGE_REQUIRES_ATOMIC_DEPLOY`.

Implementation proof compares the complete generated named DO module bytes,
bundler prelude and dependency versions. Stable Worker content comes from a
read-only provider GET and is linked to the exact stable version by matching
content ETag to that version's script ETag. Missing provenance/modules/dependencies
is `DO_IMPLEMENTATION_UNKNOWN`. A different module or dependency is
`DO_IMPLEMENTATION_CHANGED`. Only `DO_IMPLEMENTATION_UNCHANGED` permits the
fixture execution/promotion contract.

The comparison includes build IDs and private revalidation constants. It never
normalizes those values away or prints them. Source changes alone cannot prove
that generated DO code stayed the same. Dependency evidence separates embedded
Next/OpenNext runtime versions from bundled declared Node/OpenNext Cloudflare/
Wrangler release pins; those declarations do not attest the original builder.
If the provider has no source revision annotation, report the revision unknown.
Only digests, byte counts, public class/version IDs and version numbers enter the
report. Keep downloaded source outside Git.

Cloudflare assigns DO instances to versions separately from fetch routing.
Override smoke verifies candidate fetch/runtime paths; it does not prove execution
of a new DO implementation. Releases that change DO code need a separate DO
release process. Lifecycle changes require atomic deployment.

Sources: [deployment management](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/),
[gradual deployments with Durable Objects](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/with-durable-objects/).

## Deterministic identity and asset evidence

The sole intentional Wrangler config addition is:

```json
"version_metadata": { "binding": "CF_VERSION_METADATA" }
```

The Worker adds `X-Locally-Worker-Version: env.CF_VERSION_METADATA.id` only for
GET/HEAD with the exact probe value `1`. Ordinary requests retain their response;
the probe does not change status, body, existing headers, cookies, auth or business
behavior. Probe responses missing the exact candidate UUID block, including an
override ignored by the provider and served by stable.

Sampled Observability remains 10% and is optional secondary evidence. Sampling
cannot randomly block candidate identity. Static assets need no runtime version
header. Candidate HTML references and the received static asset set must match;
all referenced assets must return 200 with override propagation and no redirect.
Evidence collection stores no bodies, cookie/auth headers, query strings or PII.
Release headers are stripped from external reads, including redirect destinations.

Source: [Version Metadata binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/).

## Preserved Production configuration

Check routes, custom domains, preview settings, Observability, all five Crons,
two Queue consumers/settings, R2 bindings, DO namespace targets, managed flags
and encrypted secret names/types. Only `CF_VERSION_METADATA` may be added.
Local config comparison includes all settings and ordered migrations. Runtime
managed overrides must equal provider values; `plannedTriggerChanges` stays
empty. `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` remain
encrypted and inherit existing values. No provider config/secret change occurs
in this task. PR #161's resolved-anonymous login SSR behavior, auth tests and
package auth command remain intact.

## Before a live candidate

Require a fresh `DO_IMPLEMENTATION_UNCHANGED` proof for the exact current stable
and actual candidate artifact, Production build variables, approved mutation
adapters, complete post-deploy health readers and explicit staging/promotion
approval. Do not treat a fixture contract PASS as permission to stage or deploy.

## Read-only artifact audit — 2026-10-02

The refreshed Production baseline was stable version
`f3a6fba6-ab9e-4777-a9ea-3e0fd6586136` at 100%, deployment
`e6cf3dc1-8ad6-4ae2-85e3-d35011897358`. Its content ETag matched version script
ETag `0efcf951bcfe625bb12e98b146b415c618964da817ad6ef01944ddb648f99863`.
The provider exposed the two expected named class handlers, but no attested Git
source revision. Local comparison used the new Production build and versions
upload **dry-run**, with fixture public build variables.

| Artifact | Stable SHA-256 | Candidate dry-run SHA-256 | Result |
| --- | --- | --- | --- |
| DOQueueHandler (12,383 bytes) | `ee400ce13b7587de8dd1b9b309d121be554a223e184cf3627a0895f2bcf944a7` | `233a6428ef66ce750e0dd9971c7ac9dcb4a4aa6ee76e99590ee62ca93c49c92d` | changed |
| DOShardedTagCache (4,149 bytes) | `42f2d9d625bf35b9d32b057355b83ba087edd834c3a35e9030c079ac5f368947` | `42f2d9d625bf35b9d32b057355b83ba087edd834c3a35e9030c079ac5f368947` | identical |

Bundler prelude matched. Both artifacts reported Next 16.3.5 and OpenNext AWS
3.10.4, with declared release pins Node 24.20.0, OpenNext Cloudflare 1.19.6 and
Wrangler 4.129.1. Production bindings/migrations and named export lifecycle were
preserved. The semantic preflight passed and the provider baseline remained
unchanged during this comparison.

Verdict: **DO_IMPLEMENTATION_CHANGED**. The corrected architecture is tested,
but this actual artifact cannot use override-only promotion. Generated build and
revalidation constants remain part of the safety comparison. A new Production
baseline or actual build requires a new proof; this audit is not durable release
authorization. No candidate upload, staging, promotion or other provider mutation
was performed by this task.
