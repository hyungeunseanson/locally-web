# OpenNext ISR revalidation bridge

This bridge preserves ISR authentication when a Worker and its cache Durable Object run different builds. It does not change Next authentication or Durable Object lifecycle. PR #160 remains separate and unchanged; this PR does not authorize a release.

## Root cause and contract

OpenNext Cloudflare 1.19.6 compiles the prerender manifest's preview ID into `DOQueueHandler.executeRevalidation`. Its HEAD callback sends that value as `x-prerender-revalidate` with `x-isr: 1`. Next 16.3.5 compares it against the receiving Worker's own preview ID. Different builds can therefore disagree even when the RPC signature is identical.

The bridge uses one compatibility credential: the callback credential already compiled into the deployed stable DO. `config/cloudflare/revalidation-bridge.json` contains only its SHA-256 lineage fingerprint and the initial public version UUID. No credential value belongs in Git, logs, PRs or reports.

Production builds GET the current deployment, require one version at 100%, GET that exact version, and GET current script content. The script ETag must match the version ETag. The callback token is extracted from the exact DO module and AST call site, must match the pinned lineage fingerprint, and is retained only in memory until writing generated server output. A second deployment read rejects concurrent deployment changes. After the bridge becomes stable, the same extraction recovers the same compatibility credential from its DO; it does not adopt the new Worker's preview ID.

## Build and request behavior

`cloudflare:build` now runs the existing OpenNext CLI followed by the artifact patch. Production's wrapper selects provider provenance by default. Ordinary local builds use their own preview ID without a cross-version claim. CI explicitly uses `LOCALLY_ISR_BRIDGE_SOURCE=fixture`; it needs no provider credentials. The official live Production deploy rejects non-provider modes before executing anything. A CI/local artifact must never be uploaded as a Production release; rebuild with the official Production command and inspect its provider proof.

After the OpenNext build, the patch reads `.next/prerender-manifest.json` and checks the generated `.open-next/.build/durable-objects/queue.js` AST. It requires one `DOQueueHandler`, one `this.service.fetch` in async `executeRevalidation`, HEAD, exactly the expected two headers, one literal occurrence, and the current manifest fingerprint. Only that literal span is replaced. The result is parsed and inspected again. Changed contracts throw `OPENNEXT_REVALIDATION_BRIDGE_PATCH_CONTRACT_CHANGED` with no source or parser cause attached.

The ignored `.open-next/locally-revalidation-bridge.js` is a private generated server module (mode 0600). Its closure translates only exact HEAD + `x-isr: 1` + compatibility credential requests to this build's preview ID before calling `openNextWorker.fetch`. Cookie/auth requests, browser fetch metadata and release probes are excluded. All unmatched requests retain the same Request object. Next still performs its original authentication; arbitrary or multiple prior credentials are never accepted.

Both credentials are scanned across `.open-next/assets` and `.next/static`, including non-JS files and maps. Any match or unexpected symlink blocks the build. Only length, digests, public version/deployment IDs and ETag provenance enter the proof JSON. The provider artifact is never written to disk. Build failures remove the private module and proof so incomplete output cannot be bundled successfully.

Build IDs and `deploymentId` are not pinned or rewritten. Only the callback credential is inherited. No node_modules or runtime vendor fork is used.

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
