# Dormant public experience media Queue engine

This repository contains the mirror engine, deployed dormant Production consumer wiring, and fail-closed post-write producer hooks. The repository declares the exact Production-only Queue producer binding, but its committed server defaults are `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED=false` and an empty `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS` allowlist. Canary declares neither the Production producer binding nor those variables, and this code/config change does not deploy or send a message.

## Authority and processing contract

- Supabase remains the source and write authority.
- A versioned message contains only an experience ID, a bounded reason, and an opaque event ID. It never carries a Storage URL/path, database payload, user identifier, or credential.
- Every delivery reloads the latest `experiences` row. The message is only a wake-up signal, which makes at-least-once duplicate delivery safe.
- Only `status === "active" && is_active === true` rows are eligible. Deleted or ineligible rows are acknowledged without an R2 write.
- The canonical inventory mirrors every valid public `photos`, `itinerary[].image_url`, and legacy `image_url` source as an immutable original. Card derivatives use the first current hero source; detail derivatives use the same hero/fallback and itinerary rules as scheduled reconciliation.
- Source URLs must pass the exact Production Supabase `experiences` public namespace contract. Query strings, fragments, alternate hosts/buckets, invalid encodings, and ambiguous normalized identities fail closed.
- The existing 10 MiB upload ceiling is enforced before Images processing, below the current Images binding 20 MB input limit.

## Create-only R2 contract

The store abstraction exposes only `head`, `getBytes`, and `createIfAbsent`. Its Workers R2 adapter uses `put(..., { onlyIf: { etagDoesNotMatch: "*" } })`; it has no overwrite, copy, or delete operation.

Original keys remain `originals/v1/<source-key-sha256>/<source-byte-sha256>.<ext>`. Derivative keys remain the established deterministic card/detail keys. Existing objects are read and verified:

- Wave 1.2 `legacy-observed` Sharp derivatives are accepted only when their own downloaded SHA, current source identity/SHA, and transform width/quality/format are internally consistent.
- Verified derivatives additionally prove the transform schema, a bounded engine value (`cloudflare-images-binding` or `sharp-libvips`), derivative role, source size, and output SHA.
- Additional metadata is preserved because exact objects are never rewritten.
- Missing objects are conditionally created. A conditional loser is re-read and accepted only if the winner supplies valid current-source provenance; otherwise processing returns a permanent conflict.

The engine does not assume that a deterministic key implies deterministic bytes. Cloudflare Images and Sharp/Linux may produce different valid WebP bytes for the same source and transform specification. The key identifies the logical source/spec; provenance and the stored object's own output SHA prove integrity.

## Drift, retry, and logging

The media-relevant row snapshot is recomputed immediately before success. Drift returns `source_drift` with a retry disposition. Already-created immutable objects remain in place and are safely reused or left stale on the next attempt; the engine never deletes them.

Outcomes are deliberately small and sanitized:

- `success`, `already_exact`, and `ineligible_noop` map to acknowledgement.
- `source_drift` and `transient_failure` map to retry.
- `permanent_conflict` and `invalid_message` are retried without acknowledgement so the configured platform retry limit preserves them in the DLQ. There is no direct DLQ producer.

No outcome includes a source URL, Storage key, UUID-bearing path, raw provider error, or credential.

## Scheduled safety-net compatibility

The scheduled reconciler keeps byte equality as its strongest fast path. New Sharp objects carry the same logical proof used by the Queue engine: source identity/SHA/size, transform width/quality/format/schema/role, the bounded `sharp-libvips` engine, and a self-consistent output SHA. If a Queue write wins the conditional-create race with different valid bytes, the scheduled path reads the object and accepts it only when the complete current-source proof and `cloudflare-images-binding` engine are exact. Unknown engines or any source/spec/integrity mismatch remain conflicts, and neither path overwrites the winner.

The Production-only consumer contract uses batch size 1, concurrency 1, five retries, a 60-second retry delay, and the pre-provisioned DLQ. Its runtime adapter reloads only `id,status,is_active,photos,itinerary,image_url` through the anon/RLS REST boundary, fetches public source bytes without credentials, and uses the existing `IMAGES` and `PUBLIC_EXPERIENCE_MEDIA_R2` bindings. The OpenNext fetch handler and cache Durable Object exports remain delegated unchanged.

Root `keep_vars=true` retains remotely managed variables not declared in Wrangler config; it does not supersede the explicit committed producer defaults. A controlled Production canary must therefore use a separately reviewed config/deploy change for `true` plus one exact experience ID and must restore the repository-owned OFF/empty defaults afterward. Queue delivery after acceptance is covered by retry/DLQ, but a DB commit followed by a failed or interrupted enqueue can still be absent from both queues. The existing scheduled limitation that skips R2 completeness checks when manifest drift is absent, immutable-original completeness, and static-manifest deployment dependency remain separate recovery/read-cutover tasks. Producer activation, messages, a controlled Production canary, broader allowlisting, and deterministic runtime reader activation still require separate approval.
