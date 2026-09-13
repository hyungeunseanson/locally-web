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

## Readiness and rollback

`NO_GO_SOURCE_PARITY` means a public-active source reference is invalid or missing. `NO_GO_R2_SHA_MISMATCH` means stored SHA metadata disagrees with downloaded R2 bytes. `GO_WAVE_1_2_REPAIR_REQUIRED` is expected when objects, cache metadata, SHA metadata, or originals still need a controlled mirror repair.

There is no runtime rollback for Wave 1.1 because no runtime or remote state changes. Delete the generated local report directory to remove local audit artifacts.
