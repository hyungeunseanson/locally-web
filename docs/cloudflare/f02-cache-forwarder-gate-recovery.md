# F02 cache and forwarding Gate recovery

This changes release validation only. Application code, deployed Workers, traffic,
provider configuration and Production data are unchanged. The PR must remain Draft;
this read-only result does not authorize promotion.

## Proven boundaries and limits

The historical q27 `ERR_FAILED` and initial `ERR_ABORTED` lack sufficient original
exception/lifecycle records. Their historical root causes remain unresolved.

New end-to-end instrumentation captured the same failure type on the current
Candidate: Node fetch failed with `ENOTFOUND` before HTTP headers, followed by
`route.abort('failed')` and browser `ERR_FAILED`. The scoped read transport now
coalesces DNS A resolutions using their minimum positive TTL. Resolver errors and
expired answers still fail. Hostname, certificate verification, stateless headers,
version override, manual redirect handling and the existing deadline remain intact.
No hardcoded address, custom DNS server, stale fallback or application retry is used.

A later pre-header `ECONNRESET` occurred on established transport. Its remote close
reason is unknown. A deterministic local peer-close comparison demonstrates why
reuse can fail; fresh read connections avoid that race without replaying a request.
A reset on a fresh connection still fails exactly once. Actual HTTP 503 and a font
body timeout remain recorded as failed attempts, not reclassified as successes.

For an intercepted first200 during SPA resource reuse, post-load body retrieval
returned zero bytes despite decoded data and executed source matching the artifact.
Waiting for decoded-byte/terminal ordering and durable storage individually failed
to fix it. The collector now starts native CDP streaming before fulfill, and checks
actual browser buffered/data-event bytes against Node bytes and the exact artifact.
It does not substitute Node or artifact bytes for browser evidence. Cached304 still
requires the browser's native cached representation, validators, Vary, exact hashes,
terminal completion and executed source. Arbitrary304, cold304, redirects and errors
remain failures.

Five valid late304 receipts exposed a separate ownership bug: they completed after
the checkpoint, while the final Single Owner snapshot contained execution evidence
that had not been propagated. Cache now subscribes to that same accumulated/final
snapshot, bound to page, target, generation, source hash and positive coverage ranges.
There is no second Profiler consumer. Missing execution evidence remains a failure.

The Home notice fixture now dismisses its reviewed informational overlay through
its actual close control if it mounts between menu clicks. The original deadline,
real interaction, Auth dialogs and business-write protection are preserved. Synthetic
401 documents contain valid JSON while retaining401 status; an empty401 document
had incompatible navigation behavior in CfT157. The additional public-profile
fixture waits for normal load within its original30s timeout instead of accepting
visible SSR body while async scripts are still loading.

## Evidence and current read-only result

Base main: `e4933ce1c00707b792e69911a0791726a6a7e956`.
Candidate: `b24b84c9-00f0-4db6-b96c-0b929c7d347e` (0%).
Artifact SHA256: `f8f59854ac6bc2e15692663136045696dddaf78ed223bdec2b3da31328a4eda1`.
Live F01: `7e708856-9cf7-41f4-9b99-6401a516c7d2` (100%).
Deployment: `dea68194-360d-4b1b-9bfb-aeff35c9d338`.

The final source manifest in read-only attempt17 passed the full Candidate Gate:
49 referenced/requested static assets matched exact bytes/hashes; conditional304
receipts had cached-body and execution proof; native RSC terminal/reader evidence,
Host/Account anonymous login boundaries, Community and public Host profile checks
passed. Unexpected pre-teardown request, console and page errors were zero. The
known401 console message of the intentionally unauthenticated API probe is retained
separately, tied to that exact observed401 response. Gate protections are unchanged.

All16 preceding failed runs and rejected hypotheses are preserved in the local
`.wrangler/f02-autonomous-remediation/evidence/ledger.json`, `attempt-*.json`, and
transport evidence. Raw cookies, Authorization, session tokens, query values and
RSC bodies are not published. Those local files are intentionally excluded from Git.

The browser is the already verified native ARM64 CfT157.0.8091.0, revision
`6532fdea9c01b64cea9c3d3d9f10c241bc3dfb42`, using Playwright1.59.1. Existing pinned
binary/hash checks run before application requests. No browser bytes were replaced.

## Verification contract

Cache, Coverage and DNS/connection contracts pass58/58 on the pinned browser,
including real cold200/warm304, wrong bytes/artifact/UUID, unsafe Vary, missing cache,
truncated bytes, late snapshot propagation, peer close and fresh-socket reset.
Forwarding diagnostics distinguish fetch/body/observer/fulfill failure; the actual
truncation control receives35 decoded bytes before explicit truncation/socket failure,
then browser `ERR_FAILED`, with one request, no fulfill and no JS execution.

CI runs existing bundled contracts plus37 pure Cache controls, and8 native304
integrations only on the verified pinned ARM64 release browser. No tests are skipped
or removed; both CI jobs are required. The bundled renderer can reuse a same-document
script without emitting a conditional request, so it cannot establish native304
integration evidence. All controls are still executed separately,
including normal/Next Flight integration and negative controls. SEO, Foundation,
backup/restore and Chat retain their existing workflows. The final exact-head CI
result belongs to the PR checks; local read-only success is not a CI success claim.

R2 authority/flags, Queue2, Cron5, Durable Objects, Services, Routes, Secrets,
Financial/NICEPAY, Admin Chat, Auth/RLS and Backup contracts are preserved.
Observability configuration is preserved; runtime access remains NOT_VERIFIED due
to the existing403 restriction, without credential expansion. Production mutations,
Worker uploads, deployments, traffic changes, migrations and cache purges are zero.
