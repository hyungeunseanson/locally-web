# Community public media authority — Production cutover runbook

Status: implementation foundation; **no Production cutover, deployment or provider mutation in this PR**. The ordered actions below require a separate Production approval. Merge is also outside this workstream.

## Scope and fresh baseline

Starting main: `a616af1c393f960b093a3aee7ae4e21fb5601738` (fresh fetched).

Read-only Production observation 2026-10-06 20:19 KST:

| Scope | Objects | Bytes | Live locator occurrences | Unique live objects | Unreferenced |
|---|---:|---:|---:|---:|---:|
| Supabase public `images/community` | 16 | 7,807,773 | 15 | 15 | 1 |
| Referenced originals, full GET/SHA/decode verified | 15 | 7,417,409 | 15 | 15 | — |
| `LEGACY_UNREFERENCED_RETAINED` | 1 | 390,364 | 0 | 0 | 1 |

Cross-owner sharing, shared source, owner mismatch and missing active source: **0**. All current original MIME values are JPEG. Private byte evidence is stored outside Git in a 0700 directory with 0600 files. No owner identifiers, raw plans, capabilities or secrets belong in a PR, console output or application logs. Recheck the graph immediately before cutover; these values are evidence, not a frozen execution plan.

Only live, exact `images/community` references are eligible. No orphan adoption, copy, migration entry or cleanup. Supabase `avatars` legacy 27, Host legacy 127, Experience legacy 415, `images/profile`, `images/experience`, `images/reviews` and other buckets/prefixes remain outside this migration. Avatar/Host/Experience authority, Financial P0, NICEPAY ACK, the intentionally unresolved 38,000 KRW refund, Queue consumers 2, application Crons 5 and backup schedules remain unchanged.

## Current and target contracts

Current writer: `PostEditor` compresses to JPEG, 1280 maximum dimension, approximately 1 MiB target; initial file limit is 10 MiB, compression failure retains the original. The current UI and new-post route allow one image. Historical DB arrays containing multiple images remain supported, preserving ordering and non-target locators.

Flag false: the server's no-store authority selection explicitly chooses the existing authenticated browser Supabase writer, with owned `community/<owner>/...` path and `upsert:false`. Existing cleanup applies only in this transition state, using owner ACL and all-post reference checks.

Flag true: browser → authenticated same-origin `/api/community/images` → owned profile/optional post verification → bounded multipart stream/file → raster MIME/magic/full decode validation → managed pending asset → conditional immutable R2 PUT → exact HEAD and full GET SHA → uploaded/verified pending asset → post INSERT or media-only CAS → committed reference.

The server chooses authority on each request; the client never uses a build-time flag. R2/registry/decoder failure fails closed. A stale flag-false browser cannot insert legacy locators after the DB freeze. GET authority selection and POST responses are no-store. No R2 exception calls a Supabase upload or remove fallback.

| Property | Dedicated Community original |
|---|---|
| Bucket | `locally-public-community-originals` |
| Domain | `community-media.locally-travel.com` |
| Binding | `PUBLIC_COMMUNITY_SOURCE_R2` |
| Flag | `COMMUNITY_R2_SOURCE_ENABLED` (default absent/false) |
| Key | `community/v1/<sha256("community-media-owner:" + owner UUID)>/<fresh asset UUID>/image` |
| URL | exact HTTPS domain + exact key; no query/fragment |
| Cache | `public, max-age=31536000, immutable` |
| Create | R2 `onlyIf.etagDoesNotMatch='*'`; S3 operator `If-None-Match:*` |
| MIME | JPEG, PNG, WebP, GIF, AVIF only; MIME and magic must agree |
| Bounds | file 10 MiB; multipart actual stream 10 MiB + 8192 bytes; decode 100 million pixels maximum |
| Validation | existing IMAGES binding: info + successful tiny PNG full decode, discarded; original bytes unchanged |
| Excluded | SVG, HEIC/HEIF, BMP and other types, empty/truncated/malformed images |
| Original/derivative | original only; no derivative/cache authority or object dedup |

Full decode is an additional server authority check. Current browser compression behavior is preserved. Normal compressed input is JPEG; an original fallback must satisfy the server allowlist. An unsupported fallback receives a visible upload error. The optional post ID is owner-checked, but the browser cannot choose owner, key or asset ID. Owner namespace hashing minimizes raw ID disclosure; it is not encryption or an authorization mechanism.

No actual bucket/domain/credential is created by this foundation. The tracked `wrangler.jsonc` remains unchanged. `prepare-community-cutover-config.mjs` generates a **local-only** overlay against the exact approved deployment baseline, adding only Community binding/flag, and asserts all unrelated configuration unchanged. Experience's existing false producer flag is preserved: canonical R2 references do not imply that dormant upload producers should be enabled.

## Additive DB and lifecycle foundation

Migration: `20261006105322_community_media_authority.sql`, generated with the Supabase CLI. Applied only to disposable local fixtures in this workstream.

Reuses `media_assets`, `media_asset_references`, `media_deletion_journal`; adds only Community functions, constraints, private cutover/receipt/context tables and `community_posts.media_revision`. Community identity requires exact owned key/bucket/domain, raster MIME, size/SHA and `deleted_at IS NULL`.

`pending → uploaded_at → verified_at → committed → tombstoned`: upload/verification timestamps express intermediate stages without modifying the existing shared lifecycle enum. Asset is pending until the business reference commits. SHA equality never merges owners or objects.

`begin_community_media_asset`, `mark_community_media_uploaded`, `verify_community_media_asset` are service-role-only invokers. DB-owned triggers attach/detach one `community_post` parent at a time, lock assets in deterministic order and count **all** asset references before tombstoning/journaling. Two references owned by the same owner are supported. Cross-owner attachment is rejected. The generic owner-account deletion planner cannot prematurely journal a still-referenced Community object.

Community physical deletion is disabled by both asset and journal guards, including generic deletion claims. No Community delete adapter, scheduler, R2 DELETE, COPY, multipart writer or overwrite exists. Ref-zero means tombstone/journal only. Failed/unattached uploads remain retained pending; this PR does not introduce an automatic pending-object cleanup program.

Private SECURITY DEFINER implementations have empty search paths, revoked public/anon/authenticated privileges and service-role-only public invoker wrappers. Their internal transaction context is a revoked private table; caller-set GUCs/JWT metadata do not authorize a transition.

## Whole image-set CAS

`PATCH /api/community/posts/images` accepts only post ID, expected media revision, complete expected image array and replacement array. Actor comes from authenticated `getUser`. Same-origin and actual JSON stream bound 32 KiB apply. No content, visibility, counters or other fields are accepted.

DB `commit_community_post_images` locks the current post, checks existence, current owner, exact revision and ordered complete image set in one transaction. New locators must be exact verified owned Community assets. Existing legacy/external entries may be retained or reordered; arbitrary new legacy/external adoption is rejected. Historical multi-image arrays can reorder/remove/replace without expanding the current one-image product limit.

Revision increases only for an image-set change. Content/counter changes do not increase it. Direct image updates of managed arrays or any image update after freeze require the private CAS context. A stale editor, deleted post, ownership drift, changed ordering, or a newer image set returns a conflict rather than overwriting data.

New-post INSERT remains the existing application save boundary; DB trigger validates and attaches all media atomically with INSERT. A failed INSERT leaves a pending original retained and never physically deletes it.

## Digest-bound migration operator

CLI: `node scripts/cloudflare/community-media-operator.mjs`.

Modes: `plan`, `validate`, `prepare`, `apply`, `rollback`.

- Inventory is a scoped service-role-only read RPC: public flag, freeze flag, `storage.objects` for `images/community`, all post ID/owner/images/revision associations. No post content or unrelated Auth metadata.
- Exact Supabase Community URLs are grouped by object with **all parent IDs and array positions**. Metadata owner must equal every post owner; prefix alone never establishes ownership.
- Bounds: inventory ≤1000 Community objects/10000 posts; execution plan 1–200 referenced objects, 1–500 affected posts, ≤128 MiB total, ≤10 MiB each, ≤100 entries per existing array. Exceeding bounds stops planning and requires explicit safe partition design, never an incomplete shared-reference subset.
- Plan reads every selected source fully; validates metadata size/MIME, raster magic/decode, SHA, owner, complete references, immutable version/updated timestamp and full arrays. Re-reads fresh inventory before accepting the plan.
- Every plan uses fresh UUIDs per owned object. Plans store entire old/new arrays, preserving order and unrelated entries, source proof, parent revision and SHA-256 canonical plan digest.
- Raw plan/progress is 0600; symlinks are rejected, permissions enforced before data write. Console emits aggregate counts/digests/error codes only. Preserve private evidence outside Git.
- `validate` is offline and requires `--confirm-digest=<digest>`. Mutation modes require both `--approved-digest=<digest>` and the same confirm digest, plus a fresh DB freeze proof. A digest is necessary; a separate human Production approval is also mandatory.
- `prepare` registers pending assets, conditional creates only and exact destination full GET verification. It never changes post locators.
- `apply` rechecks source metadata, bytes, owners, complete references and all ordered arrays/revisions, then calls **one bounded DB RPC transaction for the entire plan**. It never commits one source/array slot at a time.
- DB locks all parents and assets, checks exact source identity/version/timestamp and destination registry proof, validates old→new mapping only, records the approved payload/digest privately, and transitions all arrays atomically. Same-digest reapply verifies the complete applied state and is idempotent.
- Progress is private and retained on failure. Provider preparation can be partial; locators cannot be partial within the bounded apply transaction. Resume uses the same approved plan and full fresh verification. Never regenerate a fresh UUID plan to pretend partially prepared originals are already adopted.
- Source reads have 30-second timeouts and an actual 10 MiB bound. Redirects are rejected. Errors do not print provider details.

Future operator environment contract: existing Production project URL and service-role key; R2 endpoint exact account HTTPS host; temporary **Community-only** `COMMUNITY_R2_ACCESS_KEY_ID`/`COMMUNITY_R2_SECRET_ACCESS_KEY`. Existing Avatar/Host/Experience/operator/read/destination credential pairs must never be reused or widened. The binding is bucket/key locked and exposes only HEAD/GET/conditional PUT. Temporary writer creation/revocation needs the separate approved cutover, not this PR.

Example future modes (placeholders only; **not executed in this workstream**):

```sh
node scripts/cloudflare/community-media-operator.mjs --mode=plan --output=/private/community-plan.json
node scripts/cloudflare/community-media-operator.mjs --mode=validate --plan=/private/community-plan.json --confirm-digest=<digest>
node scripts/cloudflare/community-media-operator.mjs --mode=prepare --plan=/private/community-plan.json --approved-digest=<digest> --confirm-digest=<digest> --output=/private/community-prepare.json
node scripts/cloudflare/community-media-operator.mjs --mode=apply --plan=/private/community-plan.json --approved-digest=<digest> --confirm-digest=<digest> --output=/private/community-apply.json
```

## Exact rollback and retained legacy

Rollback requires the exact approved plan digest and stored applied receipt/payload. Every current array/revision must still be the exact migration-produced array and expected revision +1. Source still exists, metadata/bytes, owner and complete reference set must pass. Whole plan rollback is one transaction, restores exact old arrays and bumps revision again; identical rollback resume checks old revision +2. A newer edit/reorder/add/remove/deleted parent produces a conflict; **do not overwrite or force rollback**. Resolve through a new scoped review. Re-applying a rolled-back plan is forbidden; a fresh plan/approval is required.

Rollback restores locators only. Schema, domain, bucket, originals, journal and source objects remain. Physical delete 0. The old public Supabase Community source remains readable during migration, observation and rollback windows. The orphan stays `LEGACY_UNREFERENCED_RETAINED`; successfully migrated sources become `COMPLETED_MIGRATION_LEGACY_RETAINED`, never automatic deletion candidates.

## Reader and cleanup compatibility

Existing Community feed/detail `PostImages` and `InstagramSlider` use native images, passing the canonical URL unchanged. New exact domain/path is additive in Next/Image remotePatterns. Existing Supabase URLs, Account Avatar, Host, external Google/OAuth avatars and their readers remain unchanged. Mobile 390px and desktop 1440px browser fixtures render actual current components for managed + legacy media, slider, Next/Image direct delivery and OAuth avatar; no Production page interaction is used.

The only reachable Community automatic Supabase remove caller is post-save error cleanup in `app/api/community/posts/route.ts`. It returns before any remove when the active runtime/process flag is true. DB freeze independently prevents Community Storage INSERT/UPDATE/DELETE, including stale browser writes and service-role/manual paths. Thus canonical detach uses DB references/tombstones/journal, never the old remove route. Freeze is prefix-scoped and does not affect other `images` domains.

## Backup source contract and hard gates

Separate exact-bucket Object Read Only contract:

- `R2_COMMUNITY_SOURCE_READ_ACCESS_KEY_ID`
- `R2_COMMUNITY_SOURCE_READ_SECRET_ACCESS_KEY`
- exact bucket `locally-public-community-originals`; no other bucket or write/delete permission.

These optional workflow environment references do not create secrets or credentials and do not change schedules. Existing Experience, Avatar, Host and destination credentials remain unchanged. An incomplete/reused Community pair fails closed. If DB contains managed Community locators without its dedicated reader, backup fails closed.

`storage_byte_backup.py` adds the exact Community URL/key/provider locator, separate adapter and `community/v1/` listing. Source API supports list/HEAD/GET only and immutable-version bounded download. Existing encrypted private destination, manifest/restore format and existing authority readers remain.

When the Community reader is configured, backup additionally requires managed asset associations and `community_media_backup_contract`: scoped Community asset lifecycle timestamps/state/SHA, all asset parent references, journal, post revision/owner association and freeze state. It rejects missing/invalid lifecycle contract. No post content or unrelated Auth dump. Full DB/Auth/schema dump remains mandatory to restore private receipts, post contents, policies and other mappings; the Storage manifest alone is not a database backup.

Synthetic isolated age-encrypted backup/restore proves exact Community bytes, DB associations and unchanged Avatar format. It is not a Production restore proof.

**Before Production cutover:**

A. Fresh COMPLETE authoritative Storage backup includes the Host original created after the previously observed snapshot; all current authoritative originals/bytes must be covered.

B. Current DB/Auth/schema/lifecycle mappings and that snapshot have an isolated restore consistency proof. Existing DB 03:17 KST / Storage 03:37 KST captures are non-atomic; timestamps alone do not prove a consistent restore point. Verify changes between captures and exact recovered references, owner/version/SHA and lifecycle state. Record exact run IDs, dump/snapshot digests and restore evidence; retain the existing backup foundation/schedules.

C. Community live sources are covered before locator migration; after smoke/prepare/apply, all new Community committed originals, references/revisions/lifecycle are captured and restored consistently. A manifest flag, registered secret or successful synthetic test is insufficient.

Independent provider/account **offsite sealed archive** with restore proof is a hard prerequisite for final Supabase Storage retirement. This PR implements no new offsite provider and does not claim that gap is resolved.

## Consolidated separately approved Production sequence

1. Confirm reviewed exact merged head and fresh main/current deployed baseline. Review read-only bucket/credential/domain inventory, Community owner/reference graph and byte proof. Any unexpected sharing/cross-owner mismatch/missing live source/security issue stops the cutover.
2. Satisfy A/B/current Community legacy source coverage. Preserve the intentionally unresolved financial case and all completed authority baselines.
3. Under separate approval, apply only the additive Community DB foundation; prepare dedicated public original bucket/domain and exact separate credentials. Physical deletion remains disabled; no new scheduler/Queue/Cron.
4. Generate/review the offline Community overlay with **flag=false**. Candidate checks require all existing Avatar/Host/Experience bindings/config, Queue2/Cron5, reader/OAuth and backup boundaries unchanged. Do not deploy this PR automatically.
5. Candidate smoke: exercise authenticated Community upload in a controlled candidate runtime with the new R2 contract, validate real owned byte SHA, pending→post commit reference, readers, wrong owner rejection and failure closed. A candidate-only fixture is not proof of live Production upload authority.
6. With approval, set Production **R2 write flag=true** and prove a real authenticated Production Community upload+post attach+read and source-byte/lifecycle proof. Verify runtime flag/binding/domain/cache/MIME; R2 failures must not write Supabase. Do not freeze legacy first.
7. Only after that verified committed smoke asset, call service-only `set_community_legacy_writer_freeze(true, smoke asset, exact SHA)`. The DB gate requires committed/uploaded/verified asset and a post reference. Record runtime smoke evidence alongside the DB gate; DB alone cannot prove the deployed flag. Stale browser/cleanup/manual writes must be rejected.
8. Fresh scoped plan after freeze. Validate full source GET/SHA/decode/owner/reference arrays, digest, 0600 raw evidence, bounds and orphan exclusion. Approve that exact digest. Old pre-freeze inventory is not executable.
9. Prepare immutable R2 originals under the approved digest. Verify all full destination GET SHAs and dedicated reader/backup coverage; preserve partial progress if interrupted.
10. Apply all approved parent arrays atomically. Verify zero live Supabase Community locators for the planned complete graph; retained source counts must remain, no orphan adoption/deletion. Verify future same-owner sharing, detach and journal behavior; all completed authorities and schedules unchanged.
11. Capture fresh authoritative Storage + DB/Auth/schema/lifecycle mappings and prove isolated restore consistency for newly committed originals. Record new backup run/digests. Retain legacy through the reviewed observation/rollback window; no physical cleanup in this program.
12. On exact eligible failure, use approved `rollback` mode (same plan/digest, full source/current-array/revision proof). Conflicting newer edits stop rollback. Keep flag/freeze operational decisions under a separate reviewed rollback approval; do not silently re-enable browser writes. Never delete provider objects or revert unrelated schema.
13. Revoke only the temporary Community operator writer after final verification; retain exact read-only backup reader. Future legacy retirement additionally requires observation, no remaining consumers, dedicated offsite sealed archive and a separately approved cleanup program.

## Verification and non-Production accounting

Required explicit verdicts are in Community unit/operator tests, native PG17 scenario/row-lock race, real workerd + R2 + Images full decode and backup tests. Existing Avatar/Host/Experience, Financial P0/NICEPAY ACK, Auth, lifecycle, backup/restore, candidate and Queue/Cron gates remain in the full Foundation workflow. New tests are additive; no existing gate is bypassed.

Local checks use Node 24.20.0, pinned repo dependencies, external disposable PG17.6, local R2/workerd, synthetic users and loopback APIs. The full CI also runs the existing pinned-image cold DB restore job, builds Next/OpenNext, generates Wrangler types, performs dry-runs and checks generated Worker runtime/bundle limits. `--dry-run` is never a provider deployment.

Production DB/provider/application writes: **0**. Physical source/provider deletes: **0**. Credential create/rotate/delete: **0**. GitHub secret writes: **0**. Manual backup dispatch: **0**. Merge: **0**. Vercel: out of scope.
