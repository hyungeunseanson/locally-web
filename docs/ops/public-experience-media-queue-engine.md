# Dormant public experience media Queue engine

This repository contains a code-only mirror engine for a future public experience media Queue consumer. It is deliberately dormant: there is no Queue or DLQ resource, producer/consumer binding, public-media R2 binding, Worker handler, or Production deployment in this change.

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
- `permanent_conflict` and `invalid_message` map to a future DLQ decision rather than infinite retry.

No outcome includes a source URL, Storage key, UUID-bearing path, raw provider error, or credential.

## Scheduled safety-net compatibility

The scheduled reconciler keeps byte equality as its strongest fast path. New Sharp objects carry the same logical proof used by the Queue engine: source identity/SHA/size, transform width/quality/format/schema/role, the bounded `sharp-libvips` engine, and a self-consistent output SHA. If a Queue write wins the conditional-create race with different valid bytes, the scheduled path reads the object and accepts it only when the complete current-source proof and `cloudflare-images-binding` engine are exact. Unknown engines or any source/spec/integrity mismatch remain conflicts, and neither path overwrites the winner.

Queue/DLQ creation, bindings, a Queue handler, producer hooks, a controlled Production canary, and deterministic runtime reader activation still require separate approval. The existing scheduled limitation that skips R2 completeness checks when manifest drift is absent also remains a separate safety-net completeness task; this compatibility change does not alter its schedule or manifest workflow.
