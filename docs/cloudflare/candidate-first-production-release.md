# Candidate-first Production release contract

PR #160 is a Draft, code/audit change. The CLI accepts only `--plan` and
`--dry-run`; it installs no live mutation adapters. There is no automatic
promotion, rollback, deployment, or workflow release. Independent review and
separate explicit authorization are required before a live candidate release.

## Refreshed baseline (2026-10-03 KST)

- Main: `4d7ab274d181e1b3245724185473e7842823b757`.
- Production deployment: `fa70c155-cdf7-404e-9dcb-932034460954`.
- Bridge stable: `5942416e-e839-40b9-9ad5-2de61d5abb0d`, single numeric 100%.
- Initial lineage anchor remains `5e010718-4e12-438a-9db9-725289be579e`.
- Compatibility fingerprint remains
  `2fee1dcac25e7158d0225f9d086b33ff14b504002efe10cd77e2699d3e646d6f`.
- Node 24.20.0, Next 16.3.5, OpenNext AWS 3.10.4, OpenNext Cloudflare 1.19.6,
  Wrangler 4.129.1. Lockfile versions are unchanged from the original PR.

The Production version is an operational stable reference, not a replacement
for the initial compatibility lineage anchor. No raw credential belongs in Git,
plans, test fixtures, output, or browser assets.

## Semantic review of the old delta

| File / hunk | Decision | Current treatment |
| --- | --- | --- |
| Foundation workflow | KEEP_AS_IS | Candidate contracts alongside current Bridge/Auth gates |
| release probe utility | REBUILD_FOR_CURRENT_MAIN | Dedicated, bodyless, uncached GET/HEAD endpoint |
| Worker fetch wrapper | CONFLICT_WITH_BRIDGE | Probe first; ordinary requests retain exact bridge translation |
| release documentation | OBSOLETE_AFTER_BRIDGE | Replaced with current provider/toolchain contract |
| package scripts | REBUILD_FOR_CURRENT_MAIN | Preserve #161 auth command, #162 admin chat and #163 bridge scripts |
| candidate release contract | REBUILD_FOR_CURRENT_MAIN | Bridge provenance, compatibility, authorization and race gates |
| candidate tests | REBUILD_FOR_CURRENT_MAIN | Current probe, bridge and failure cases |
| DO fingerprint gate | OBSOLETE_AFTER_BRIDGE | Keep raw fingerprints; add classified structural/runtime proof |
| candidate browser adapter | REBUILD_FOR_CURRENT_MAIN | Dedicated identity; all resource types; anonymous context |
| candidate CLI | REBUILD_FOR_CURRENT_MAIN | Provider-linked official build, fresh proof, real artifact matrix |
| Production browser hooks | KEEP_AS_IS | Preserve #158 policy; narrow probe header, reject authenticated candidate reads |
| deploy contract extraction | REBUILD_FOR_CURRENT_MAIN | Preserve #163 final freshness gate immediately before deploy |
| semantic snapshot binding targets | KEEP_AS_IS | Keep namespace/target identities, add candidate runtime/var digests |
| Production version metadata binding | KEEP_AS_IS | Only intentional candidate config addition |

The existing branch incorporates main with a normal merge, preserving history.
Product/auth/admin chat implementations and bridge patch/rewrite contracts are
not replaced by their old PR copies.

## Current Cloudflare contract

Re-read official documentation on 2026-10-03 KST:

- [Versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)
  and [deployment management](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/):
  `versions upload` stores a version without activating it; staging is a separate deployment mutation.
- [Version Overrides](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/):
  a request header selects an exact version already in the current deployment,
  including 0%. Custom-domain smoke uses this header; no persistent matcher or
  separate override-creation API is needed. An ignored override falls back to
  ordinary traffic allocation, so deterministic identity must pass before smoke.
  The public override header is routing control, not an authorization boundary;
  candidate application authentication must remain identical.
- [Version metadata](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/)
  supplies the UUID for the dedicated probe; sampled logs are not an identity gate.
- [DO gradual deployment](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/with-durable-objects/):
  lifecycle changes cannot use version upload; ordinary compatible code can.
  Each DO has one assigned version according to deployment percentages. Worker
  override does not guarantee candidate DO execution at candidate0.
- [Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)
  are unavailable for Workers implementing DOs. Their absence is expected.
- [Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
  create a new deployment; storage state is not reverted. Lifecycle changes or
  missing bound resources can prevent rollback; only recent deployable versions qualify.

### DO update mode discrepancy

The current [CLI documentation](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
mentions `--durable-objects-code-update-mode` (`immediate` / `deferred <duration>`).
Installed, pinned Wrangler **4.129.1 does not expose or implement that argument**,
confirmed from `versions deploy --help` and its installed command source. Do not
emit an unsupported flag or silently upgrade dependencies.

The current plan explicitly acknowledges `provider-default-no-drain-guarantee`, emitting
no unsupported option. DO code reassignment can reset objects/in-flight work;
there is no deferred drain guarantee in this CLI contract. The cache workload's
bidirectional compatibility, retry handling and scoped reset proof are required.
A deferred mode needs a separately reviewed toolchain/API change, not an invented
flag. This plan acknowledgement is not authorization to deploy.

## Bridge-native build and DO evidence

Use the official `cloudflare:build:production` with
`LOCALLY_ISR_BRIDGE_SOURCE=provider`. The provider-linked proof ties the current
single100 deployment/version to exact-version module bytes, version metadata ETag,
artifact SHA256 and the unchanged lineage. Fixture
builds remain useful for CI but cannot satisfy the live upload contract.

Compare exact provider-linked stable and fresh candidate modules. Preserve full
fingerprints and classify each changed AST literal before any structural
comparison. Only the four exact SQL build-ID argument sites in `executeRevalidation`,
`addToFailedState`, and `initState` qualify. Callback credentials, methods, SQL
schema/keys, message shapes, error branches, alarms, concurrency, Next validator,
Worker clients, prelude and runtime dependencies must remain compatible/identical.
Tag Cache must remain unchanged. Unknown/runtime/lifecycle changes block.

The callable local harness executes extracted stable/candidate DOs and Worker-side
clients, real Next authentication, and in-memory SQLite. It checks all four
Worker↔DO combinations, future generation 1↔2, retry/error/alarm behavior, tag
lookup, concurrent deduplication, and rollback across persisted fixture state.
`failed_state`/`sync` build-scoped reset is `BUILD_STATE_RESET_EXPECTED`; unrelated
fixture state and tag data survive. No Production data enters these tests.

## Future execution order (injected contract only)

1. Explicit candidate-upload authorization; fresh provider-linked build.
2. Semantic preflight and new artifact/runtime compatibility proof.
3. Pre-upload exact deployment/config snapshot, then final Bridge freshness GET
   immediately before upload. Reject fixture, lineage drift or baseline changes.
4. Upload only; require post-upload deployment ID, stable UUID and numeric100
   unchanged. Check candidate bindings/runtime metadata; no implicit deploy.
5. Separately stage exact stable100/candidate0; re-read distribution/config.
6. Confirm override propagation through the dedicated identity probe, then run
   candidate browser/API/assets smoke on the Production origin.
7. Obtain explicit approval for the exact candidate promotion, recheck probe
   identity, then final provider snapshot immediately before candidate100.
8. Verify candidate100, browser, natural Cron, queues and unchanged flags.

Semantic comparison protects live managed flags, all plain-variable digests,
secret binding names/types (values remain encrypted), Cron, consumers/producers,
DO namespace targets/lifecycle, R2/service targets, routes/domains, observability,
compatibility date/flags and migration tag. `keep_vars` preserves inherited values.
Only `CF_VERSION_METADATA` is the intentional binding addition.

## Identity, browser and write safety

Only `GET`/`HEAD /.well-known/locally-release`, without query/cookie/authorization,
with exact `X-Locally-Release-Probe: 1`, returns version identity (204, no body,
private/no-store). Ordinary pages expose no new metadata. Probe never calls Next,
ISR or business handlers. Missing/wrong identity stops before page smoke.

The isolated browser gate overrides only same-origin reads; no cookie/auth
candidate reads are accepted. Cross-origin requests lose override/probe headers.
All writes remain blocked, including telemetry and business endpoints. Existing
reviewed harmless telemetry is fulfilled locally; unexpected writes fail closed.
Document/data/API reads and JS/CSS/font/image responses require coverage, correct
HTTP status, no redirect, and HTML-referenced asset completion. Static assets do
not execute the Worker probe: header propagation and HTML asset set are their
proof, not fabricated per-asset version metadata.

#158 remains initial attempt plus at most one fresh-page transport-timeout retry.
HTTP/application/auth/identity/write/assertion errors never get a retry. No third
attempt or timeout enlargement. Candidate contexts are always closed; removing
headers requires no provider operation. A failed staged candidate stays at 0%;
removing it requires a separately authorized stable100 deployment, never automatic
rollback or another upload. No override requests are issued by plan/dry-run.

## Rollback and residual limits

Rollback target is the exact previous Bridge stable UUID at 100%, preserving the
same lineage. Local 1→0 tests cover reset/tag persistence and auth compatibility.
No rollback runs automatically after failed post-verification.

`POST_DEPLOY_SINGLE_TAG_CACHE_EXCEPTION_UNATTRIBUTED`: one exception after the
previous rollout, followed by healthy traffic. No causal evidence links it to
Version Overrides; candidate0 does not assign candidate DO code. Promotion may
reset DOs, so this remains an observation, not an invented root cause.

`NATURAL_ISR_NOT_OBSERVED` and `OBSERVABILITY_ACCESS_403` remain evidence limits.
Local structural/runtime tests do not claim a live natural ISR success or that
candidate0 smoke executes candidate DO code. No live candidate, override,
traffic change, upload, deploy, rollback, or data mutation was performed here.


## Post-upload version scope correction

Observed on 2026-10-03: uploading a candidate left the deployment and exact
stable version unchanged, while `/settings` gained `CF_VERSION_METADATA` and
`/content/v2` returned the uploaded candidate's ETag. This is an observed
projection, not a guarantee about every deployment shape. Neither endpoint is
sufficient to identify the active version after upload.

The reader separates `activeDeployment`, `activeStableVersion`,
`uploadedCandidateVersion`, `scriptGlobalSettings`, and
`triggersAndBindingsOutsideVersionScope`. Exact `/versions/{uuid}` resources
anchor version invariance; `/script-settings` anchors global settings. Dedicated
routes, domains, schedules and Queue consumer reads remain mandatory. Legacy
settings are diagnostic only. Candidate bindings may add only version metadata;
all previous bindings, runtime, lifecycle and global settings must remain equal.

Artifact readers now exclusively GET
`/workers/workers/{name}/versions/{uuid}?include=modules`. They never accept
script-level `/content/v2` as provenance, including when its ETag matches. UUID,
unambiguous main module, strict decoding and before/after exact metadata must
agree. The active reader also brackets the read with identical single100
deployment snapshots. Build proof records `sourceKind: workers-version-modules`
and `artifactSha256`, alongside deployment/version/metadata ETag/bridge lineage.
Final freshness re-reads these exact bytes and verifies the digest. Old receipts
must be regenerated. No raw module or compatibility credential is logged by the
reader. See [source evidence and regression matrix](bridge-version-provenance-2026-10-03.md).

Sources: [version state](https://developers.cloudflare.com/workers/versions-and-deployments/),
[script-global settings](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/settings/methods/get/),
[exact-version modules](https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/get/).
