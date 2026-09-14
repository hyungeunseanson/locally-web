# Public experience media R2 parity

## Scope and authority

Wave 1.1 is observation-only. Supabase Storage bucket `experiences` remains the authoritative source and write destination. `locally-public-experience-canary` remains a derivative-only R2 mirror. The audit never applies manifests, uploads originals or derivatives, deletes objects, updates the database, or changes application delivery.

The existing scheduled `Public Experience Image Reconciliation` workflow is intentionally independent. Its missing-derivative upload and manifest-PR behavior is not gated by this stricter audit, so historical metadata gaps cannot stop reconciliation.

## Audit levels

Run metadata audit for the normal repeatable check:

```bash
npm run cloudflare:experience-media:audit:metadata -- --output=.tmp/public-experience-media-audit
```

It reads all `experiences` rows with the public anon credential, recursively calls the public bucket's read-only Storage LIST operation, and performs R2 metadata reads. The S3 transport uses LIST plus HEAD; the Cloudflare REST transport uses its enriched GET-list response, which already includes size, ETag, HTTP metadata, and custom metadata. Supabase's Storage list endpoint uses HTTP POST for a logical list operation; the request is fixed to `/storage/v1/object/list/experiences` and cannot select an upload, move, copy, or delete operation. No service-role credential is used.

Full audit must be invoked explicitly and is not scheduled:

```bash
npm run cloudflare:experience-media:audit:full -- --output=.tmp/public-experience-media-audit-full
```

It additionally GETs public-active Supabase source bytes and all R2 object bytes. It compares downloaded R2 SHA-256 with stored `sha256` custom metadata when present. Missing SHA metadata is `unverifiable-metadata`; a stored/downloaded SHA difference is `mismatch`. The audit does not regenerate derivatives, so macOS versus Linux Sharp/libvips output differences are never treated as corruption.

Both commands produce sanitized `report.json` and `summary.md`. They contain aggregate counts and domain-separated key-set digests only—never full source URLs, object paths containing user UUIDs, credentials, or secrets. The digests make normalized source, Storage, expected, actual, and missing sets comparable between runs without publishing their members.

## Credentials and fixed targets

Required Supabase values:

- `NEXT_PUBLIC_SUPABASE_URL=https://uhinvcydgzqlpnvieyal.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

R2 may use either:

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `R2_BUCKET`; or
- read-scoped `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, and `R2_BUCKET`.

The account, endpoint, and bucket are fail-closed to the existing Locally resources. Use a read-only credential where available. The code exposes only list/head/get methods; tests assert zero put/upload/delete/copy calls.

## Source scopes

- `publicActive`: references from active, enabled experiences. This scope defines the current derivative expectation.
- `allDbReferenced`: every normalized reference found in `photos`, `itinerary[].image_url`, and legacy `image_url`, including inactive records.
- `storageAll`: every object discovered in the `experiences` bucket, including unreferenced objects.

Counts are always calculated from the live source. Prior counts are evidence, not hardcoded acceptance values.

## R2 taxonomy

Every actual R2 object is classified exactly once:

- expected card derivative
- expected detail derivative
- stale known derivative (present in the repository manifests but no longer expected from the live public-active inventory)
- unclassified extra
- original (`originals/` namespace, reserved for Wave 1.2)

An original count of zero is reported as current state, never encoded as the desired contract.

## Transform provenance for Wave 1.2

New immutable objects should carry these custom metadata fields:

- `source_key_sha256`
- `source_byte_sha256`
- `output_byte_sha256`
- `transform_width`
- `transform_quality`
- `transform_format`
- `sharp_version`
- `libvips_version`
- `runtime_id`
- `generated_at`

Wave 1.1 only measures coverage. It does not alter existing object metadata.

## Wave 1.2 controlled repair tooling

Wave 1.2 keeps the same authority boundary: Supabase Storage is the sole source and writer, while the existing `locally-public-experience-canary` bucket is a mirror. It does not update application manifests, database URLs, host upload behavior, runtime flags, or Cloudflare Workers. Stale derivatives, unclassified extras, Supabase orphans, Supabase originals, and R2 originals are never removed by this tooling.

The manual `Public Experience Media Controlled Repair` workflow shares the `public-experience-image-reconciliation` concurrency group with the existing scheduled reconciliation. The scheduled workflow itself is unchanged. A run must progress through separate approvals:

1. `plan`: perform live Supabase source GET/SHA and R2 LIST/HEAD/GET, produce an exact state-bound plan digest, and perform no mutations.
2. `canary`: supply the plan run ID, exact digest, and a fresh quota observation. The workflow executes exactly one conditional derivative metadata copy and one conditional original put.
3. Run a new `plan` after the canary. The canary changed R2 state, so its earlier plan is intentionally stale.
4. `full`: supply the new plan run ID/digest and the successful canary run ID. A receipt tied to the same source snapshot is mandatory.
5. `rollback`: restores derivative metadata only when the current object ETag and byte SHA still match its completed journal. Immutable originals are retained; removal is outside this Wave.

Both before and after an apply, the workflow re-downloads the public-active Supabase source and requires the source snapshot digest to remain exact. The apply command independently requires the fixed Cloudflare account, R2 bucket, Production Supabase ref, source-plan digest, current R2 state digest, exact plan confirmation, no missing derivative/source, no stored/downloaded SHA mismatch, and a quota observation no more than two hours old. Any drift fails before writes. Drift discovered after a write prevents that batch from being reported successful and leaves it for the next reconciliation.

The default Python mode is `--plan`. A write path exists only with `--apply --confirm-digest=<exact-plan-digest>`. Canary and full apply are never invoked by CI or a schedule.

### Immutable original layout

Only public-active source objects enter the plan. Source URLs and UUID-bearing source paths are kept in runner-local encrypted material, not reports or logs. Each byte-identical original uses:

```text
originals/v1/{source_key_hash_prefix}/{source_key_sha256}/{source_byte_sha256}.{mime_extension}
```

HTTP metadata preserves the source `Content-Type` and sets `Cache-Control: public, max-age=31536000, immutable`. Custom metadata records `source_key_sha256`, `source_byte_sha256`, `output_byte_sha256`, `source_size`, and `copied_at`. Creation uses `If-None-Match: *`; an existing exact key is GET/SHA verified and skipped, while different bytes or metadata fail closed.

### Existing derivative metadata repair

Every expected derivative is downloaded before planning. The resulting SHA-256 and size are compared with HEAD metadata and any existing stored SHA. The repair never regenerates derivative bytes. It records only facts that can be proved from the existing object and its immutable key: source identity/SHA, output SHA, width, quality, format, and `provenance_status=legacy-observed`. It does not invent Sharp, libvips, runtime, or generation-time provenance.

Cloudflare R2 supports the `MERGE` metadata directive, but the pinned boto3 S3 model accepts the portable `COPY`/`REPLACE` values. This tooling therefore uses `REPLACE` and captures all supported system metadata (`Content-Type`, `Cache-Control`, `Content-Disposition`, `Content-Encoding`, `Content-Language`, `Expires`, storage class) plus all custom metadata before copying. The desired fields are merged locally, every unrelated field is round-tripped, and a post-copy HEAD/GET verifies metadata and unchanged bytes.

Same-key CopyObject always uses `x-amz-copy-source-if-match` through `CopySourceIfMatch`. R2's beta destination condition is not used as a correctness dependency because Cloudflare documents that it is not atomic with the source condition. Exact whole-bucket state validation immediately before apply, the source ETag condition, immediate byte verification, unrelated-object diffing, and conditional rollback form the safety boundary.

### Plan cost and quota gate

The live plan calculates its actions instead of embedding historical counts. It reports planned original PUTs, derivative CopyObjects, cache-control repairs, plan/apply and combined Class A operations, plan/apply and combined Class B LIST/HEAD/GET operations, R2 storage growth, and Supabase source egress for plan plus pre/post source verification. The estimate includes the planning reads as well as every immediate precondition and post-write verification read in apply. A fresh account-wide observation for current-month Class A, Class B, and storage usage is required for both plan and apply.

The apply guard reserves ten percent of the current R2 Standard free allocation and refuses projected totals above 900,000 Class A requests, 9,000,000 Class B requests, or 9 GiB. This is deliberately stricter than the documented 10 GiB / 1 million / 10 million free allowances. It does not purchase or enable an add-on.

### Private artifacts and rollback journal

This repository is public, so raw plans and journals are never uploaded as plaintext. Before any manual run, configure the protected `production-media-sync` environment with a high-entropy `R2_REPAIR_ARTIFACT_KEY`. The workflow creates plaintext only under `RUNNER_TEMP` with mode `0600`, packages it, encrypts it with AES-256-CBC/PBKDF2, uploads only the encrypted artifact for three days, and removes local plaintext.

The journal is persisted before each CopyObject and receives a new digest on every durable update. It contains the safe R2 object key/identity, pre-copy ETag, full pre-copy HTTP/custom metadata, storage class, pre-copy SHA, intended post-copy metadata, and post-copy ETag when observed. It contains no Supabase URL, UUID-bearing source key, or credential. If an apply fails after a partial write, the `always()` artifact step still preserves the encrypted journal. Rollback requires the exact latest journal digest and refuses a derivative whose current byte SHA or metadata state differs; this also permits recovery when the copy committed immediately before the process could record its post-copy ETag.

The workflow must not be dispatched in canary, full, or rollback mode until the plan artifact, cost projection, and digest have been reviewed. This PR adds tooling only; it does not run the remote canary.

## Readiness and rollback

`NO_GO_SOURCE_PARITY` means a public-active source reference is invalid or missing. `NO_GO_R2_SHA_MISMATCH` means stored SHA metadata disagrees with downloaded R2 bytes. `NO_GO_R2_READ_CUTOVER_PARITY` means an expected derivative, its metadata, or a public-active original identity is incomplete. `GO_WAVE_1_3B_READ_CUTOVER_READY` requires every public-active original identity and expected derivative SHA metadata entry to be present; unrelated preserved R2 objects are reported separately and are not deleted.

There is no runtime rollback for Wave 1.1 because no runtime or remote state changes. Delete the generated local report directory to remove local audit artifacts.

## Wave 1.4 default-OFF producer hooks

Supabase Storage and the `experiences` row remain the authoritative write source. After an authenticated, authorized database write returns an affected row, the host create/edit, admin status, and admin photo-reorder paths evaluate the same public eligibility and canonical media snapshot used by the Queue mirror engine. Pending, rejected, revision, inactive, deleted, malformed, and media-unchanged rows do not send. A public activation or public media change schedules one bounded version-1 Queue message; no source URL, object path, user identifier, row payload, or image byte is included.

The producer is fail-closed and dormant. It requires all of the following server-side runtime values: exact `CLOUDFLARE_DEPLOYMENT_ENV=production`, exact `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED=true`, a valid comma-separated `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS` allowlist containing the saved experience ID, and the exact Production `PUBLIC_EXPERIENCE_MEDIA_QUEUE` binding. The repository declares that Production-only binding, but commits the server defaults as `false` and an empty allowlist; Canary declares neither the producer binding nor those variables. Browser input, `NODE_ENV`, and `NEXT_PUBLIC_*` values cannot enable the producer.

`wrangler.jsonc` is the deployment source of truth for the two non-secret producer controls. Root `keep_vars=true` preserves remotely managed values that are absent from the config, but it does not override values explicitly declared for Production. A future controlled canary therefore requires a separately reviewed config/deploy change that supplies `true` and one exact experience ID, followed by a separately verified revert to the committed OFF/empty defaults. Dashboard-only drift is not an activation mechanism.

Queue send is registered with the OpenNext execution context's `waitUntil`. The database response does not wait for mirror processing and is not converted to a failure by context lookup, Queue send, or logging failures. `scheduled` means only that runtime tracking was registered; `enqueued` is emitted only after `Queue.send()` resolves. Logs contain only the event ID, public experience ID, bounded reason/status, and a sanitized diagnostic code.

The current hook points are the confirmed insert/update result inside `createExperienceFromBody` and `updateExperienceFromBody`, the confirmed experience result in `updateAdminStatus`, and the compare-and-update result of the admin photo reorder route. The create path always saves `pending` and therefore does not send. In `useAdminApprovalsData`, an experience approval request expressed as `approved` is converted to `active` before `updateAdminStatus` is called, so its confirmed saved `active` + `is_active=true` result is an enqueue candidate. A row that is actually stored as `approved` remains ineligible. No separate active runtime UI/API callsite directly toggles `experiences.is_active`; the before/after producer contract supports a future false-to-true transition without claiming that such a control exists today. Deletes never enqueue and never delete mirror objects.

This is best-effort post-commit delivery, not a transactional outbox. Consumer failures after acceptance use the configured Queue retry and DLQ. A process interruption or send failure after the database commit can occur before the message reaches either Queue, so it is not guaranteed delivery. The scheduled reconciliation remains the recovery path, but it currently has three relevant limits: it can skip R2 completeness work when repository manifest drift is absent, it does not provide immediate immutable-original recovery for every missed producer event, and static manifests still require a repository update and Production deployment. The controlled C2 canary proved Queue send, consume, conditional R2 create, and exact-skip behavior for one allowlisted experience. Before broad producer activation, the scheduled safety net must still detect missing originals/derivatives independently of manifest drift and provide bounded recovery for the pre-Queue acceptance gap.

### Controlled-canary consumer failure contract

The first allowlisted canary reached the Production Queue but failed before inventory construction on every captured attempt and moved to the configured DLQ. Exact generated-Worker reproduction under local workerd identified the boundary: Cloudflare Workers rejects Fetch `redirect: "error"` before issuing the Supabase latest-row request. The runtime now uses `redirect: "manual"` and rejects every 3xx response explicitly, preserving the same fail-closed redirect policy without relying on an unsupported Fetch mode.

Consumer failure outcomes expose only a bounded `diagnosticStage`, bounded `diagnosticCode`, an HTTP status when an actual response exists, and aggregate progress counts. They never include provider response bodies, URLs, object paths, request headers, credentials, database rows, raw exception messages, stacks, or causes. Latest-row transport rejection, HTTP authorization/client/rate-limit/server responses, redirect, content-type, JSON parse, and response-shape failures are distinct. Later source, original, derivative, and final-row stages retain inventory and completed create/skip counts when available.

The repository defaults remain producer OFF with an empty allowlist. The failed event is intentionally preserved in the existing DLQ and is not replayed by this change. Merging this code does not repair Production: a separately reviewed producer-OFF deployment is required before any new controlled canary can be considered, and replaying the old event after the photo order was restored would not re-prove the failed new-hero path.

### Controlled canary C2 completion

The separately approved second controlled canary completed the authenticated photo-reorder write, producer, Queue consumer, and conditional R2-create path. Forward event `5eed7e5c-a3d7-45e0-986f-cee5a1403525` created two card derivatives; restore event `99067b30-f77e-4409-ac41-652ebec0fad4` completed as `already_exact`. The two new objects add 42,236 bytes. The original photo order and producer OFF/empty configuration were restored, while the earlier failed event remains preserved in the DLQ. The original HTTP response was not retained, and Images/R2 call counts were not independently metered, so those evidence limits remain explicit.

## Default-OFF deterministic public reader

Static card and detail manifests remain the default read authority. A separate build-time rollout requires both `NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED=true` and an exact numeric `NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS` allowlist. Repository-owned Production build defaults are `false` and an empty list; malformed, partial, wildcard, and non-allowlisted configurations cannot enter the deterministic path. This is a build-time flag-and-allowlist boundary, not an environment-name gate: a local or Preview build can enter the path only when both public values are explicitly compiled into that build. A future Production rollout must provide both values to the canonical Production build environment before `npm run cloudflare:deploy:production`; changing Worker runtime `--var` alone cannot change values already compiled into client components. Disabling the rollout also requires a fresh build.

For an allowlisted ID, deterministic delivery additionally requires the latest projected database state to satisfy exact `status === "active" && is_active === true`. Home and search responses expose only the derived `public_image_r2_eligible` boolean after applying their existing visibility rules. Wishlist and public-host-profile cards calculate it from their existing minimal status projection, and detail pages use their existing public detail projection. No full database row or private field is added to client props. An allowlisted row that is inactive, pending, rejected, approved, or missing either eligibility value stays on its current Supabase origin even when an older static mapping exists.

Eligible targets reuse `buildPublicExperienceCardKeys` for 384/640 q65 WebP and `buildPublicExperienceDetailKeys` for 480/960/1440 q75 WebP. The exact current Supabase public `experiences` origin is validated before any R2 URL is produced, so a stale manifest origin does not control an allowlisted target. Invalid IDs, another host/bucket/path, query strings, fragments, or malformed encoding fail closed. Outside the rollout, the unchanged exact-origin manifest lookup remains in use, and neither manifest file is modified by this reader.

An R2 image load error removes the entire failed `<picture>` candidate set and renders the unchanged, unoptimized Supabase origin. Failure state is keyed to the selected experience, origin, and R2 URL, so another photo or experience does not inherit it; an unchanged failed target does not loop or gain a cache-busting query. A newly created object can still be hidden by an intermediary cached 404 until that cache expires. Reader code performs no HEAD preflight, Queue send, transform, R2 write, cache purge, or manifest update.

Broad reader/producer activation remains blocked on recovery independent of manifest drift: missing-original and missing-derivative detection, bounded scheduled recovery with source-drift protection, and a defined repair path for a database commit that never reached Queue acceptance. The static-manifest deployment dependency remains for non-allowlisted traffic, and the preserved DLQ event still requires a separate disposition decision.

## Manifest-independent completeness and bounded recovery

The existing `Public Experience Image Reconciliation` schedule remains at 05:48 UTC and retains its established manifest drift → derivative reconciliation → manifest PR path. A second job now evaluates actual public-active R2 completeness on every schedule, independently of whether the repository manifests drift. Manual dispatch defaults to `audit`; an audit or plan cannot enter the legacy upload/PR job. `legacy-reconcile` is the explicit manual path for the established manifest flow.

The metadata audit paginates the live public-active database inventory and Supabase Storage listing, then uses R2 LIST/HEAD. It separately reports expected/missing derivatives, original source-identity coverage, metadata-consistent objects, conflicts, and objects whose current source bytes remain unverifiable. Storage size, ETag, or modification metadata is not treated as a source-byte SHA. The default scheduled audit downloads no source bytes, performs no transform, and exposes no write API.

A manual `plan` performs a bounded rotating verification pass. The default ceiling is 12 source GETs, 64 MiB of source bytes, 12 original creates, 40 derivative creates, and 40 Sharp transforms; hard ceilings are 50 source GETs, 256 MiB, 50 originals, 200 derivatives, and 200 transforms. The caller supplies the next cursor from the prior report so repeated runs do not always examine the same prefix. Exhausted budgets produce `partial=true` with remaining metadata-only coverage; they never become “missing zero.” GitHub Actions scheduling is best effort, so this is neither guaranteed delivery nor a promise of recovery within 24 hours.

`apply` is default-OFF and requires the explicit apply checkbox, the same scope/budget/cursor, and the exact fresh plan digest. It rechecks the canonical public-active source snapshot and every selected source byte before writes, and rechecks the source again after writes. The R2 whole-state digest must still match immediately before apply. Any public/private transition, changed source, target conflict, pagination/read failure, or digest mismatch fails closed.

Recovery creates only missing immutable originals and missing card/detail derivatives. Every PUT uses `If-None-Match: *`; a racing Queue writer is read and verified, then classified as an exact skip or a conflict. Existing objects are never overwritten, copied, deleted, or metadata-repaired. Cloudflare Images and scheduled Sharp bytes may differ: exactness is established by current source identity/SHA, transform spec, allowed engine provenance, and the object’s own output SHA. Partial successes are persisted after each object and retained for a safe fresh rerun; successful objects are not rolled back.

Reports contain aggregate counts, domain-separated digests, bounded budgets, actual read volume, planned writes, conflicts, and partial progress. Raw Supabase URLs, UUID-bearing paths, credentials, and full database rows stay in runner-temporary mode-0600 files and are never uploaded. The existing Queue producer and deterministic reader repository defaults remain OFF with empty allowlists. The preserved historical DLQ event is not replayed, received, acknowledged, purged, or deleted by this workflow.
