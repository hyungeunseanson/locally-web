# Experience media R2 source authority

## Release contract

The raw Wrangler baseline is fail-closed:

- `EXPERIENCE_MEDIA_R2_SOURCE_ENABLED=false`
- local, Preview, and canary requests never select the Production R2 write path
- the existing 33-ID public reader/producer profile is independent

Production uses the repository-owned deploy wrapper. During the dormant phase use:

```sh
npm run cloudflare:deploy:production -- --experience-media-source-profile=off
```

The approved Production source-authority profile is repository-owned and defaults to `on`. The explicit emergency profile is:

```sh
npm run cloudflare:deploy:production -- --experience-media-source-profile=off
```

That option changes only new experience-media uploads. It does not turn off the public media cohort, Translation, Home, Admin Support, Notification Retention, or Experience Completion.

## Write and locator contract

The browser sends authenticated multipart data to `/api/host/experience-images/upload`. The route reuses the existing session/admin checks and binds edits to the current experience owner. Anonymous callers and other hosts are denied. The server enforces a 10 MiB limit, an allowlisted MIME type, and a matching byte signature before storage.

New R2 sources use:

```text
sources/v1/experience/<sha256-owner-scope>/<uuid>/<hero|itinerary>.<validated-extension>
```

The key is server-generated, immutable, owner-bound, and written with a conditional create. A same-key winner is a conflict; it is never overwritten. The database receives the public R2 locator only after the object and its SHA/size/HTTP metadata are verified. If the later database save fails, the immutable object is retained for bounded orphan reconciliation.

Vercel remains able to read public R2 media. It has no R2 binding, so once the Production source profile is ON its upload route fails closed with 503 instead of silently returning to Supabase Storage. Operational rollback therefore preserves public reads but temporarily pauses experience image upload unless the Cloudflare Worker is restored.

## Legacy transition

Legacy Supabase locators remain readable while migration is in progress. A verified legacy object is promoted to its existing immutable R2 original without duplicating bytes:

```text
https://media-canary.locally-travel.com/originals/v1/.../<source-sha>.<ext>?legacy=<old-url-sha-prefix>
```

The bounded `legacy` identity preserves the reviewed derivative keys. The Queue reads R2-authored sources directly through the binding, validates byte/provenance metadata, and never creates an original-of-original.

## Migration and deletion gates

`scripts/cloudflare/experience-media-source-migration.mjs` owns the canonical locator and destructive-plan contracts. Generated timestamps are excluded from approval digests; target locators, row snapshots, object paths, byte SHA/size, proof flags, refcounts, classifications, and ceilings are included.

Deletion is permitted only for the exact `experiences` bucket, at most 700 objects and 300 MiB, when every listed object has current refcount zero and exact R2 or encrypted-backup proof. Apply must revalidate the digest and live SHA/size/refcount before the first deletion. Partial failure stops the batch and requires a fresh inventory; blind replay is prohibited.

The point of no return begins after a Supabase source object is deleted. The source flag can no longer restore that byte. Recovery then requires a separately approved restore from the encrypted Storage backup. The bucket is made private and write policies are removed only after new R2 upload is live, active code has no legacy writer, live locator references are zero, and every residual object is explicitly classified.

The existing `Public Experience Image Reconciliation` manual workflow has two separate source-authority actions. `source-copy-plan` performs a fresh all-current-reference inventory and source-byte proof with no write. `source-copy-apply` requires both the apply checkbox and that fresh digest, then creates only missing immutable originals with `If-None-Match: *`. The private plan and source paths never leave runner temporary storage; only count/byte/digest summaries are uploaded. This path does not migrate database locators, delete Supabase objects, or send Queue messages.

Locator and deletion operations are separate proof-gated steps. `apply-experience-media-locator-plan.mjs` defaults to read-only, validates the full approved plan and every selected current row before its first write, and accepts only the approved before state or an already-exact approved after state. Pending rows call the service-role-only `apply_experience_media_locator_cas` RPC. That `SECURITY INVOKER` function locks the row, compares all four media fields with NULL-safe PostgreSQL equality, and changes only those fields. `conflict`, `not_found`, or an unknown result stops the run; large JSONB values are sent in the request body instead of a PostgREST filter URL. This makes the canary-then-full sequence resumable without weakening stale-plan detection. Use `--experience-id` for the one-row canary; omit it only for the approved full plan. `plan-experience-media-source-delete.mjs` will not plan while any live Supabase locator remains and excludes a private list of historical references. It selects only previously referenced objects with exact current-R2 and encrypted-baseline proof; zero-reference objects are retained unless independently proven safe.

`apply-experience-media-source-delete.mjs` also defaults to read-only. With `--apply` and the exact digest, it reloads all live media rows, downloads and hashes every selected source before the first deletion, enforces the 700-object/300-MiB ceiling, then deletes in bounded batches through the official Supabase Storage API and verifies absence. It never deletes the bucket or any other bucket. A partial result stops the run and requires a fresh inventory and plan; do not blindly replay it.
