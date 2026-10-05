# Account avatar R2 authority and approved cutover

Implementation preparation only. This PR does not provision, apply SQL, deploy,
copy Production payloads, dispatch a backup, or change a profile locator.
Starting main: `3e7b818692c00c72896f8a66e1ae4f9e9ec3a39d`.
The completed Storage Foundation and its restore proof remain valid.

## Verified narrow baseline (2026-10-05 UTC)

Production `uhinvcydgzqlpnvieyal`, public Supabase `avatars`: 27 objects,
11,853,306 bytes. Live: 14 objects, 5,879,073 bytes. Unreferenced: 13 objects,
5,974,233 bytes, classified `legacy_unreferenced_retained`.
`profiles.avatar_url`: 224 nonempty rows, 194 distinct, 14 exact public avatar
references, 210 other/external. `users.avatar_url`: 0 nonempty.
`public_profiles` is a view selecting `avatar_url` from `profiles`.
All 14 referenced objects exist and `storage.objects.owner_id=profiles.id`.
Only 4 keys have a matching owner prefix; that prefix is never an ownership
input. Fresh plans select by DB owner and live locator, never by this count.
No avatar lifecycle assets exist and this avatar migration is not applied.

Cloudflare bucket/custom-domain inventory found no dedicated account-avatar
resource. Approved cutover must create `locally-public-avatars`, attach
`avatars-media.locally-travel.com` (TLS active, public custom-domain access),
and use Worker `PUBLIC_AVATAR_R2`. Canonical base:
`https://avatars-media.locally-travel.com`. Keep r2.dev disabled; no automatic
expiry/deletion rule. Never use the private backup, Experience or host mirror
bucket for avatar authority.

The public host derivative manifest stays at 52 entries: 2 avatar origins and
50 `images/profile`. Both avatar-origin hosts directly render the new public
avatar URL once their old derivative origin no longer matches. Host
`ProfileEditor`, `host_applications.profile_photo` and `images/profile` remain
outside this migration. External OAuth URLs are not rewritten.

## Upload, identity and database contract

Account and mobile keep client validation/compression (1MB/1280px JPEG target,
existing original fallback), then call `POST /api/profile/avatar`. The handler
checks same origin, `auth.getUser()`, owned profile, bounded request/file, raster
MIME, image magic and nonempty bytes. No client key/owner/asset input is accepted.
Server independently limits payload to the existing 10MiB original ceiling;
SVG/HEIC are rejected, AVIF must carry its actual brand.

`AVATAR_R2_SOURCE_ENABLED` is server runtime only; absent or `false` retains
authenticated Supabase upload. Exact `true` requires a Production Cloudflare
runtime and avatar binding; malformed/missing config or an R2 failure is closed
with no Supabase fallback. No public build flag is necessary. Reads of stored
public R2 locators work even after switching new writes back to false.

Every upload receives a fresh server UUID and immutable
`avatars/v1/<SHA256(avatar-media-owner:UUID)>/<asset UUID>/avatar.<extension>`.
Conditional PUT is never overwritten. Exact HEAD/GET compares schema, asset ID,
opaque owner, SHA metadata, MIME, cache metadata, size and actual byte SHA.
Conflict is accepted only after that complete verification.

Apply only `20261005082309_avatar_media_authority.sql` after approval. Reuse
`media_assets`, references and journal. Add no parallel registry or historical
backfill. `begin_avatar_media_asset`/`verify_avatar_media_asset` are backend-only
invoker RPCs. Verification is represented by `uploaded_at`/`verified_at` while
state remains pending, matching Foundation schema. `commit_profile_avatar`
locks profile, CASes exact previous URL and checks owned pending asset SHA/size;
profile-trigger reference finalization is atomic with the locator transaction.
The trigger handles direct legacy writes during write rollback too. It rejects
unregistered/wrong-owner/unverified managed URLs, detaches prior managed
references, and tombstones/journals only at zero references. It never creates a
fake legacy asset. Private trigger execute is denied to browser/backend roles;
existing profile RLS remains in force. Physical deletion stays disabled.

## Operator contract and private evidence

`scripts/cloudflare/avatar-media-operator.mjs` defaults to validate-only.
`--mode=plan` reads the bounded backend-only `avatar_migration_inventory` RPC
and actual live source payloads, checks MIME/magic/size/SHA and final metadata
drift, and writes a private 0600 digest-bound plan. No registry/destination/DB
write occurs in plan mode. **Do not run Production plan payload preparation in
this preparation task.** Current proof consists of read-only metadata counts.

The plan persists exact old locator, DB owner, source metadata/version/SHA/size,
deterministic migration asset UUID, bucket/key/new URL and idempotency digest.
Same inventory/bytes produce the same plan and identity. Bounds: 100 live
objects, 128MiB aggregate, 10MiB per object, 5,000 nonempty profiles and 1,000
avatar Storage metadata rows; reject the limit+1 sentinel. No hardcoded 14.
Keep raw plans/journals in an approved local private directory, not PR/artifacts.
Sanitized reports contain only counts/digests/codes. Network requests have 30s
deadlines and no redirects. S3 writes use the dedicated avatar bucket,
If-None-Match `*`, no automatic SDK retry, no DELETE/COPY/multipart interface.

`--mode=prepare` registers/copies/verifies only; profile locator remains old.
`--mode=apply` fresh-checks owner/version/old URL and actual source SHA/size,
creates or verifies exact immutable bytes, then uses the backend profile CAS RPC
and independently checks profile, asset, reference digest and destination bytes.
Source/locator drift or user race stops with managed pending identity retained;
never overwrite the user's newer avatar. Both mutation modes require exact
`--confirm-digest` and `--approved-digest`. A resumed already-committed row still
requires lifecycle and actual-byte verification. Source writes/deletes are zero.

Future local operator environment: exact `NEXT_PUBLIC_SUPABASE_URL`, existing
modern backend `SUPABASE_SERVICE_ROLE_KEY`, `R2_ENDPOINT`, and a separate
avatar-bucket-only `AVATAR_R2_ACCESS_KEY_ID`/`AVATAR_R2_SECRET_ACCESS_KEY`. Pass
secrets through the approved local secret mechanism, never command arguments,
logs, screenshots, artifacts or Worker/browser variables. Existing credentials
must not be rotated or repurposed. The application writes through its binding.

## Preserve authoritative backup coverage at cutover

The existing Foundation originally recognized only Experience R2 source bucket.
The bounded avatar extension adds only the dedicated avatar bucket/key mapping
and an optional separate read-only adapter. It preserves encryption/manifest
format, fail-closed/drift behavior, 5,000/2GiB source and 12,000/3GiB destination
ceilings, 180-minute timeout and both schedules. A referenced avatar without its
reader configuration fails closed rather than silently losing coverage.

Before any managed avatar registration, future approved setup needs a separate
Object Read Only credential for **only `locally-public-avatars`**, stored solely
in GitHub `production-backup` as `R2_AVATAR_SOURCE_READ_ACCESS_KEY_ID` and
`R2_AVATAR_SOURCE_READ_SECRET_ACCESS_KEY`. These are optional before cutover;
existing Experience reader and private destination credentials stay untouched.
Avatar reader identity must differ from both. No AGE private identity or backup
credential enters the Worker. No new backup/restore dispatch is authorized by
this implementation task; deterministic real AGE fixture verifies new mapping.

## Exact future approved cutover: A–L

Record exact merged main and fresh stable Worker version/traffic, schema state,
business/Auth counts, avatar inventory/locator digests, external locator digest,
unreferenced identity digests and Queue/Cron/settings before operations. Preserve
the latest COMPLETE encrypted snapshot and Foundation evidence. One explicit
Production cutover approval must precede all steps below.

A. Create/verify the dedicated bucket/custom domain and TLS/public GET. Keep
   r2.dev off and no expiry rules. Set up the two separate bucket-scoped operator
   write and backup read-only authorities described above without changing any
   existing credential. Verify bucket scope and backup environment completeness.
B. Fresh-list migrations; apply **only** the avatar SQL above. Check constraint,
   RPC grants/private trigger ACL/RLS, zero backfill/physical deletes, unchanged
   business/Auth/Storage counts; inspect Supabase Security Advisor findings.
C. Preserve the repository's current Production release profile/remote vars.
   Run `prepare-avatar-cutover-config.mjs` on that verified existing generated
   config, adding only avatar binding and `AVATAR_R2_SOURCE_ENABLED=false`.
   Compare every Queue/Cron/service/other-binding/flag/settings field with baseline.
D. Build exact merged main; upload a 0% candidate with that false config. Run
   existing corrected candidate gates plus avatar read/upload/auth/owner fixture
   checks. Promote only a passing exact candidate using current safe procedures.
   No Vercel action. Record candidate/version/artifact/main identity.
E. Smoke old avatar/OAuth/public host reads and existing account/mobile behavior.
F. Fresh `--mode=plan`; save private plan, inventory SHA and external/orphan
   witness. Review counts/bytes/owner proof, digest and all source-byte checks.
G. `--mode=prepare` with that exact approved digest: copy only live referenced
   avatar payloads, registry pending + verified, conditional create, exact GET SHA.
   Profile locators still old; orphan records/bytes remain untouched.
H. Enable new writes with the **same artifact** and config overlay true; verify
   binding/flag and Production version/traffic, all existing Queue/Cron/settings.
   Record flag activation time. R2 error must never select Supabase fallback.
I. `--mode=apply` against the same plan digest. Fresh source verification and
   CAS each exact old locator. Any user race stops without overwriting it. Retain
   exact old→new journal for rollback and sanitized per-object mapping proof.
J. Authenticated desktop and mobile upload tests: fresh UUID, pending→verified→
   committed, owned reference, prior managed tombstone journal, no physical delete.
K. All migrated/new avatar public GET byte/MIME/size checks, Next/Image rendering,
   both existing avatar-origin public hosts, external/OAuth reads, existing app smoke.
L. Fresh live dependency-zero proof and baseline comparison. Do not declare
   cutover complete on a partial copy, pending-only state, race or stale inventory.

Operator commands (after approval, from exact merged checkout; all private paths):

```sh
node scripts/cloudflare/prepare-avatar-cutover-config.mjs --input=<verified-production-config> --output=<private-off-config> --enabled=false
node scripts/cloudflare/avatar-media-operator.mjs --mode=plan --output=<private-plan>
node scripts/cloudflare/avatar-media-operator.mjs --mode=prepare --plan=<private-plan> --confirm-digest=<digest> --approved-digest=<same-approved-digest> --output=<private-progress>
node scripts/cloudflare/prepare-avatar-cutover-config.mjs --input=<private-off-config> --output=<private-on-config> --enabled=true
node scripts/cloudflare/avatar-media-operator.mjs --mode=apply --plan=<private-plan> --confirm-digest=<digest> --approved-digest=<same-approved-digest> --output=<private-progress>
```

## Required final cutover proof and rollback

Live profiles pointing to exact Supabase avatars = 0; new Production Supabase
avatar writes after H = 0; new desktop/mobile R2 uploads PASS. All migrated live
objects: missing R2/SHA mismatch/size mismatch/owner mismatch/DB locator mismatch/
lifecycle mismatch = 0. External/OAuth locator witness unchanged by this operator.
All 13 baseline orphans retained by identity/byte metadata (fresh changes reported,
no hardcoded cleanup), no guessed ownership/lifecycle records. Both host mirrors
compatible. Source writes/deletes and physical deletions = 0. Application Queue/
Cron/settings unchanged; Storage 03:37 KST, DB 03:17 KST remain enabled.

Rollback new writes by overlaying `AVATAR_R2_SOURCE_ENABLED=false` while retaining
the avatar binding and public domain. Stored R2 reads keep working. Retain the
additive SQL. Controlled locator rollback uses the **same digest-bound plan**:
`--mode=rollback --plan=... --confirm-digest=... --approved-digest=... --output=...`.
Recheck original owner/metadata; backend rollback RPC locks and CASes only the
exact migration-produced current URL. Any newer avatar causes drift rejection.
Never delete either source, destination, orphan, backup or pending asset. Keep
the read-only backup reader until all preserved avatar lifecycle objects no
longer require it. No automated physical deletion scheduler is introduced.

Implementation approval boundary remains:
`READY_FOR_AVATAR_PRODUCTION_CUTOVER_APPROVAL`.

References: [Supabase functions and permissions](https://supabase.com/docs/guides/database/functions),
[Cloudflare R2 conditional binding operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
