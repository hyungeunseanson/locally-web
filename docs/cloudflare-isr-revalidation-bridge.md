# OpenNext ISR revalidation bridge

This bridge preserves ISR authentication when a Worker and its cache Durable Object run different builds. It does not change Next authentication or Durable Object lifecycle. PR #160 remains separate and unchanged; this PR does not authorize a release.

## Root cause and contract

OpenNext Cloudflare 1.19.6 compiles the prerender manifest's preview ID into `DOQueueHandler.executeRevalidation`. Its HEAD callback sends that value as `x-prerender-revalidate` with `x-isr: 1`. Next 16.3.5 compares it against the receiving Worker's own preview ID. Different builds can therefore disagree even when the RPC signature is identical.

The bridge uses one compatibility credential: the callback credential already compiled into the deployed stable DO. `config/cloudflare/revalidation-bridge.json` contains only its SHA-256 lineage fingerprint and the initial public version UUID. No credential value belongs in Git, logs, PRs or reports.

### One-time initial baseline correction (2026-10-02)

The initial audit used historical version `f3a6fba6-ab9e-4777-a9ea-3e0fd6586136`. Before the first bridge rollout, an authorized **unbridged** Admin Chat release deployed pre-bridge main `688a4ac88b45b66400427930ba392686eda50b66` as version `5e010718-4e12-438a-9db9-725289be579e` at 12:52:55 UTC. That release includes #161 and #162. The bridge rollout correctly failed closed because this intervening build generated another preview credential; no bridge version was deployed.

The proposed first-rollout anchor is now that current unbridged stable. Its deployment is `24d1859a-7851-4305-bac9-b37284af5e24`, single numeric 100%; its content ETag matches version metadata. `baselineVersionId` means the **initial bridge lineage anchor**, not the latest Worker version. Once a bridge is Production stable, ordinary builds must inherit its existing DO callback credential. They must never rotate the pinned fingerprint to the new Worker's build-local preview ID. There is exactly one accepted lineage; historical credentials are not added to an allowlist. No automatic policy update or fallback is implemented. A future mismatch must stop and be investigated.

Provider records attest version/deployment IDs, timestamps, ETags and Wrangler upload/deploy triggers, but contain no Git revision annotation. Source alignment instead uses the operator's explicit release authorization, clean source identity/tree record, official deploy log, and matching provider version readback in the Admin Chat release evidence. The recorded source tree matches `688a4ac8`; its application/config tree is the pre-bridge main baseline. This is operator-attested source alignment, not a Git SHA inferred from timestamps or attested by Cloudflare.

Current artifact inspection finds a direct Worker fetch delegate, no translation module/wrapper, and a DO callback credential equal to the current prerender manifest credential: **CURRENT_STABLE_UNBRIDGED**. The five DOQueueHandler differences from the historical extraction are one revalidation credential and four build-ID literals. These were classified before structural comparison. The remaining AST/API/storage/message behavior is identical; DOShardedTagCache bytes and both namespace targets are unchanged. Application changes from #162 are real, authorized runtime changes, not normalized away as build constants.

The matching operator build log records Next.js 16.3.5, OpenNext AWS 3.10.4, OpenNext Cloudflare 1.19.6 and Wrangler 4.129.1, matching the candidate lockfile/runtime. The provider bundle does not independently attest package versions. Both named handlers, namespace targets and migration tag `opennext-cache-v1` are unchanged; no lifecycle or dependency drift was identified.

Historical version metadata still matches the ETag of the earlier provider-verified extraction. The historical raw bundle was not retained. A content request with `version_id` returned the current ETag, and the version `/content` path returned metadata, so neither was treated as historical source. Historical structural comparison uses the prior ETag-verified synthetic fixture and recorded literal/module fingerprints; current source was fetched anew and retained only in memory. This limitation is distinct from the freshly verified current baseline.

The local rebaseline audit passed 86 bridge/DO/freshness tests, 157 Production build/deploy/browser contracts, 43 Auth cases, and the full Admin Chat regression command (138 unit and 69 browser cases). A fresh provider-linked Production build and `versions upload --dry-run` passed without upload. Its bundled Worker-side client matches the current stable fixture except trailing whitespace; classified DO ASTs also match. Generation 0↔1 and 1↔2 use real Next authentication and local SQLite, including scoped `failed_state`/`sync` reset, preserved unrelated/tag state, and successful subsequent enqueue. Build public/service settings are local synthetic fixtures; no Production business data is used. Client assets and tracked files/logs contain neither private generated credential.

### Durable Object assignment evidence and limits

[Cloudflare's assignment contract](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/with-durable-objects/) assigns existing DO identities according to deployment percentages; the documented single-100 destination is the current version. [Code updates are eventually consistent](https://developers.cloudflare.com/durable-objects/platform/known-issues/#code-updates), so old code can transiently overlap during propagation. The documented seconds-to-minutes interval is typical, not a hard deadline. [In-flight work](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/#shutdown-behavior) can finish without further storage access; later storage access enforces uniqueness. The 30-second statement concerns platform runtime updates and is not a universal application-deploy bound.

The installed Wrangler 4.129.1 does not expose the newer DO code-update-mode flag in its CLI help. The newer upstream default deferred/300s is therefore not evidence of the mode or deadline used by this historical deployment. No per-instance version inventory was obtained from the documented object-list API. Repeated unchanged single100 reads establish the configured assignment, not a proof that every historical invocation has finished. Local compatibility tests prove current stable ↔ bridge and bridge ↔ future build, not historical-token acceptance. This Draft neither changes DO rollout mode nor authorizes deployment; the next rollout must recheck the stable baseline and observe natural revalidation.

Production builds GET the current deployment, require one version at 100%, GET that exact version, and GET current script content. The script ETag must match the version ETag. The callback token is extracted from the exact DO module and AST call site, must match the pinned lineage fingerprint, and is retained only in memory until writing generated server output. A second deployment read rejects concurrent deployment changes. After the bridge becomes stable, the same extraction recovers the same compatibility credential from its DO; it does not adopt the new Worker's preview ID.

## Build and request behavior

`cloudflare:build` now runs the existing OpenNext CLI followed by the artifact patch. Production's wrapper selects provider provenance by default. Ordinary local builds use their own preview ID without a cross-version claim. CI explicitly uses `LOCALLY_ISR_BRIDGE_SOURCE=fixture`; it needs no provider credentials. The official live Production deploy rejects non-provider modes before executing anything. A CI/local artifact must never be uploaded as a Production release; rebuild with the official Production command and inspect its provider proof.

After the OpenNext build, the patch reads `.next/prerender-manifest.json` and checks the generated `.open-next/.build/durable-objects/queue.js` AST. It requires one `DOQueueHandler`, one `this.service.fetch` in async `executeRevalidation`, HEAD, exactly the expected two headers, one literal occurrence, and the current manifest fingerprint. Only that literal span is replaced. The result is parsed and inspected again. Changed contracts throw `OPENNEXT_REVALIDATION_BRIDGE_PATCH_CONTRACT_CHANGED` with no source or parser cause attached.

The ignored `.open-next/locally-revalidation-bridge.js` is a private generated server module (mode 0600). Its closure translates only exact HEAD + `x-isr: 1` + compatibility credential requests to this build's preview ID before calling `openNextWorker.fetch`. Cookie/auth requests, browser fetch metadata and release probes are excluded. All unmatched requests retain the same Request object. Next still performs its original authentication; arbitrary or multiple prior credentials are never accepted.

Both credentials are scanned across `.open-next/assets` and `.next/static`, including non-JS files and maps. Any match or unexpected symlink blocks the build. Only length, digests, public version/deployment IDs and ETag provenance enter the proof JSON. The provider artifact is never written to disk. Build failures remove the private module and proof so incomplete output cannot be bundled successfully.

Build IDs and `deploymentId` are not pinned or rewritten. Only the callback credential is inherited. No node_modules or runtime vendor fork is used.

## Final Production baseline freshness gate

The official non-dry Production command runs build → semantic preflight → pre-deploy browser smoke → bridge proof freshness → Wrangler deploy. The freshness await is immediately adjacent to the deploy invocation, with no other asynchronous work between them. Non-dry builds explicitly use provider mode; local/fixture modes cannot deploy. Dry-runs may use fixtures and skip this provider gate.

The gate reads `.open-next/locally-revalidation-bridge-proof.json`, requires provider kind, true ETag match, valid deployment/version UUIDs and ETag/compat SHA-256 digests, and rejects unknown fields or malformed optional evidence fields. It requires the compatibility digest to match `config/cloudflare/revalidation-bridge.json`; mismatch throws `OPENNEXT_REVALIDATION_BRIDGE_LINEAGE_MISMATCH`.

GET-only rechecks require the current deployment to have exactly one version at numeric 100%, with the exact proof deployment/version IDs. The exact version metadata must retain the proof script ETag. Drift, missing/malformed proof or provider errors stop before any deploy call with `OPENNEXT_REVALIDATION_BRIDGE_BASELINE_CHANGED_BEFORE_DEPLOY`. Responses, credentials and exception causes are never logged. Tests simulate drift during pre-smoke and assert zero deploy invocations for every rejection.

This removes the build/smoke-duration freshness gap. The final read and provider deployment are not an atomic compare-and-swap; an independent deployment after the final GET remains a narrow external race, so release operators must still serialize Production releases.

## Compatibility evidence

`npm run cloudflare:isr-bridge:contract` exercises:

| Worker | DO | Credential path |
| --- | --- | --- |
| generation 0 | generation 0 | original credential, original Next check |
| generation 1 | generation 0 | original credential translated to generation 1 |
| generation 0 | generation 1 | bridge DO sends original credential |
| generation 1 | generation 1 | original credential translated to generation 1 |
| generation 2 | generation 1 | same credential translated to generation 2 |
| generation 1 | generation 2 | same credential translated to generation 1 |

Generation 0 uses provider-linked extracted OpenNext modules with synthetic constants and no Production state. New DO generations are compiled in memory from the installed upstream package and patched by the real patcher. The tests use the real Next authentication function, extracted Worker queue/tag clients, in-memory SQLite, local service bindings and a reduced ISR response fixture. They test enqueue, drain, deduplication, metadata, tag reads, 404/500/503 and alarm retry. They are compatibility tests, not evidence that Cloudflare actually routed a Production request or that a live cache object was regenerated. Natural ISR verification remains a rollout gate.

## Build-state reset: BUILD_STATE_RESET_EXPECTED

The upstream `failed_state` table holds serialized queue messages (host, path, modification timestamp, deduplication identity), retry count and next alarm time. `sync` holds route identity and the last successful revalidation time. These are ISR bookkeeping, not booking/user records or cached page bodies; route metadata may identify application paths. No Production rows are read for this audit.

Both tables carry build IDs. The unchanged constructor deletes rows belonging to another build. Thus old failed retry work is not resumed and old successful dedupe markers are not reused. Tests in both rollout directions confirm those rows disappear, unrelated fixture rows and tag state survive, and a subsequent stale request enqueues and successfully revalidates again. There is no cache object delete, R2 binding operation, business database call or user-record operation in these reset statements. Automatic completion of abandoned retries before a new stale request is not promised.

## Upstream check and reproduction summary

As checked on 2026-10-02, the latest published release was [OpenNext Cloudflare 1.20.7](https://github.com/opennextjs/opennextjs-cloudflare/releases/tag/%40opennextjs%2Fcloudflare%401.20.7). Its [queue callback](https://github.com/opennextjs/opennextjs-cloudflare/blob/%40opennextjs%2Fcloudflare%401.20.7/packages/cloudflare/src/api/durable-objects/queue.ts) still uses the build-defined preview ID, and the upstream compiler still reads it from the prerender manifest. Installed Next 16.3.5 still uses exact equality. No package upgrade is included.

Targeted searches for `previewModeId`, `DOQueueHandler`, version skew and `x-prerender-revalidate` did not identify an exact existing issue. [Issue #1236](https://github.com/opennextjs/opennextjs-cloudflare/issues/1236) concerns separating DOs/preview URLs and is related infrastructure, not this specific authentication reproduction. No issue was created.

Non-sensitive upstream reproduction: compile two synthetic preview IDs, invoke each compiled queue against both Worker versions, and use Next's unchanged `checkIsOnDemandRevalidate`. Same-version callbacks pass; opposite-version callbacks fail the equality check and can produce the queue's non-REVALIDATED fatal path. Reuse a single synthetic compatibility credential in both DOs and translate it narrowly at the Worker boundary; all four combinations pass. Use local fixtures, never attach real preview IDs or provider bundles.

## Future rollout (not executed)

1. Review this bridge PR and the generated provider proof.
2. Separately authorize a bridge 100% release; preserve all current credentials, flags and bindings.
3. Observe natural ISR/revalidation and cache/queue/Cron health.
4. Adopt that bridge release as the stable baseline.
5. Rebuild/recheck PR #160, including real DO compatibility and supported explicit DO update mode.
6. Enable candidate-first release only after those gates pass. Candidate0 override smoke does not prove candidate DO execution.
7. Consider the separate Supabase service_role to modern secret cutover under its own approval and regression gates.

This work uploads no candidate, changes no deployment/traffic/secret/queue, and performs no Production DB, Storage, R2, business or Vercel writes.
