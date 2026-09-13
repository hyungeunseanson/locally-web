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

`NO_GO_SOURCE_PARITY` means a public-active source reference is invalid or missing. `NO_GO_R2_SHA_MISMATCH` means stored SHA metadata disagrees with downloaded R2 bytes. `GO_WAVE_1_2_REPAIR_REQUIRED` is expected when objects, cache metadata, SHA metadata, or originals still need a controlled mirror repair.

There is no runtime rollback for Wave 1.1 because no runtime or remote state changes. Delete the generated local report directory to remove local audit artifacts.
