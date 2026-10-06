# Current main

Starting main was freshly fetched: `1cbb604b4298e7936e53c5f5a9563dce9a17ecd5`
(PR #192, applied Financial P0 Production contract). Isolated workstream:
`codex/host-profile-media-authority`, in the managed worktree
`/Users/hyungeunseanson/.codex/worktrees/host-profile-media-authority/locally-web`.
The original service-concierge checkout and its uncommitted changes were untouched.

Status: approved non-Production implementation; final CI/review evidence is recorded separately. Production mutations remain **0**. Production cutover, merge, credentials, physical deletion and Vercel actions are not authorized. The completed Avatar Production baseline remains immutable.

# Fresh Production inventory

Read-only Production Supabase, Cloudflare GETs, and public source GETs on
2026-10-06. Historical derivative counts were not used for source selection.

| Metric | Fresh result |
| --- | ---: |
| Supabase `images/profile` objects | 127 |
| Source bytes | 67,835,528 |
| Host application reference edges | 51 |
| Legacy `profiles.avatar_url` edges | 6 |
| Auth metadata `avatar_url` edges | 1 |
| Total live reference edges | 58 |
| Unique live source objects | 52 |
| Live source bytes | 25,664,226 |
| Unreferenced source objects | 75 |
| Unreferenced source bytes | 42,171,302 |
| Shared-reference objects | 5 |
| Cross-owner shared objects | 0 |
| Duplicate locator groups / excess reference edges | 5 / 6 |
| Missing live objects | 0 |
| Live owner mismatches / all source key-owner mismatches | 0 / 0 |
| Noncanonical live Supabase locators | 0 |
| Host managed lifecycle assets | 0 |

All 52 live source objects were fetched and SHA-256 was calculated over actual
bytes. GET size, JPEG MIME/magic and object ownership matched. A final reread exactly matched all source owner/size/MIME/version/update metadata
and the public-table reference arrays after the byte read. This is current
source-byte evidence, not destination parity or a pre-existing checksum comparison.
Private per-object digests and raw locator inventories remain in a mode-0700,
Git-ignored directory with mode-0600 files; no payloads, IDs or raw URLs enter
this report. Sanitized evidence: `host-profile-media-audit-2026-10-06.json`.

All-source MIME: JPEG 122 / 62,293,076 bytes; PNG 3 / 2,025,090 bytes;
HEIC 2 / 3,517,362 bytes. Every live object is JPEG. Both HEIC objects are
unreferenced; all orphan bytes are retained. Other `images` prefixes account for
43 objects / 20,561,850 bytes and remain outside this workstream.

Fresh R2 active mirror: 102 derivative objects / 727,436 bytes. All 102 keys
match the expected 128/256 variants for the current 51 Host source locators;
missing/noncurrent keys = 0. Private stale mirror: 4 objects / 21,616 bytes.
The repository manifest still has 52 historical entries (50 `images/profile`,
2 legacy avatar origins); it is not an inventory of authoritative source bytes.

The public base-table scan found this prefix only in `host_applications` and
`profiles`. Both private base tables had zero matches. A separate Auth metadata
scan found the additional reference above; it matches the same user's current
Host and profile locator, exists, and has the correct Storage owner. It adds a
third reference to an existing shared object, not a 53rd live object.

# Exact meaning of images/profile

`images` is a **public Supabase bucket**; `profile/` is its Host upload prefix,
not a bucket, derivative namespace or R2 original namespace. Current browser
writers use `profile/<authenticated-user UUID>_<timestamp>` without upsert.
The stored upload is the application's canonical source: generally a compressed
JPEG (1MB target, 1280px), with the existing original-file fallback if compression
fails. It is not proof that the original camera file is separately retained.

R2 `hosts/<user>/<URL hash>/avatar-w128|256-q80.webp` objects are generated
public delivery derivatives. They are not authoritative copies of upload bytes.

# Current authority map

| Concern | Current authority / consumer |
| --- | --- |
| Source bytes | Supabase public `images`, `profile/` prefix |
| DB business locator | `host_applications.profile_photo` (51), `profiles.avatar_url` (6) |
| Additional locator | `auth.users.raw_user_meta_data.avatar_url` (1) |
| Public projections | `public_host_applications.profile_photo`, `public_profiles.avatar_url` |
| Host upload writers | `app/host/register/page.tsx`, Host `ProfileEditor.tsx` |
| Commit writers | `/api/host/register/submit`, `/api/host/profile`; current legacy profile callers |
| Public selection | `getHostPublicProfile`: Host photo first, account profile fallback |
| Public delivery | `PublicHostProfileImage`: exact-origin manifest match, otherwise current origin |
| Other consumers | Public hosts/users, Experience host context, admin Host/customer context, community authors, guest trips, Chat |
| Ownership | Auth UID plus `storage.objects.owner_id`; all current source key prefixes corroborate it |
| Browser Storage writes | Existing `images` owner policies; INSERT constrained to own profile/community namespace, UPDATE/DELETE remain owner-authorized |
| Backup source | Existing Supabase byte adapter; records Host/profile associations and captures legacy objects, including unreferenced ones |
| Backup limits | 5,000 / 2GiB source; 12,000 / 3GiB destination; 180-minute workflow |
| Host lifecycle | No managed Host assets/references/hooks in Production |
| Deletion | Host row deletion does not physically delete profile objects; owner Storage DELETE remains possible |
| Mirror lifecycle | Active public bucket has no object-expiry rule; private stale derivatives expire after seven days |

The current `public_host_applications` view selects latest per user before
filtering approved status: 58 rows, 51 profile-prefix references. It does not
expose unapproved applications. Public bucket access still makes individual
source URLs publicly readable independently of view visibility; migration must
preserve this existing distinction.

`AuthContext` prefers the profile locator when hydrating its user object.
`useChat.ts:717,791,940` also reads freshly fetched Auth metadata directly, and
account initialization has metadata fallback. Consequently the Auth reference
cannot be called an orphan or assumed inert.

The current backup reference reader does not record `auth.users` associations.
The one Auth object is nevertheless covered today through its matching Host and
profile references and the Supabase inventory. That coverage would become an
untracked dependency after a two-table-only migration unless explicitly handled.

# Auth/Chat dependency conclusions

A fresh scoped Auth query found 221 users with nonempty avatar metadata: one
Host `images/profile` locator, 74 other HTTPS locators, and 146 other values.
The one scoped user and identity use the email provider; no OAuth identity is
selected. It agrees with that owner's profile and Host application locator.
The migration role (`postgres`) can SELECT and UPDATE Auth metadata; service_role
cannot. No broad Auth table or column grant is introduced.

`handle_new_user` copies initial Auth avatar metadata into `profiles.avatar_url`
on INSERT, with no existing Auth UPDATE trigger. `AuthContext` fetches `getUser`,
reads the current profile, and overlays that locator in its local user metadata.
The previous LanguageContext preference writer spread the entire overlaid
metadata into `auth.updateUser`, so it could echo a profile locator into Auth or
restore a stale session locator. It now sends only `preferred_locale`; Supabase
merges that field. This preserves preference behavior and removes the stale-photo
writer. The retained duplication is supported by these paths; no historical audit
trail proves which event originally wrote the single current duplicate.

Chat optimistic text at `useChat.ts:717`, post-message sender at :791, and image
sender at :940 read freshly fetched Auth avatar metadata. Conversation rebuilding
reads `public_profiles` and Host public selection. Account initialization also
has an Auth fallback. No Chat display precedence or Account Avatar writer changes.
SQL changes only `raw_user_meta_data.avatar_url` within the exact owned reference
group. Other metadata, password, app metadata, identities, sessions, refresh tokens
and timestamps remain unchanged. Old JWT/session snapshots keep their old readable
Supabase URL until refresh; `getUser` / later token refresh observe the new field.
This is proven with disposable DB snapshots and existing Auth runtime regressions,
not a claim of having mutated or exercised a real Production login.

New external/OAuth metadata changes remain legitimate newer changes and detach
only the Auth reference. Browser/Auth metadata cannot attach a managed Host source.
Auth/public or Auth/Host disagreement blocks planning/apply; nothing is reconciled
by automatically overwriting metadata. Rollback protects the stored post-CAS full
metadata digest, so even a newer preference change requires explicit reconciliation.

# Risks found

- The transitional Avatar Host-direct-Supabase test was replaced under the user's
  explicit approval with stronger authority separation. All Account/mobile,
  fail-closed, ownership, byte, CAS and lifecycle assertions remain.
- Auth is an active third parent, not an orphan. Narrow private SECURITY DEFINER
  helpers (empty search_path, backend-only EXECUTE) plus public invoker wrappers
  avoid expanding service_role Auth table authority.
- Older browser writers require a Production write freeze, not only new UI code.
  The reviewed SQL starts with the freeze off; apply/prepare require it on and
  the CAS transaction locks that gate. Host prefix Storage DELETE is disabled
  independently. Community/other Storage prefixes remain unchanged.
- Host acceptance preserves image/* compression fallback, including SVG; SVG
  uses Content-Disposition attachment. Valid raster magic and AVIF brands are
  checked independently; HEIC/HEIF and oversized/empty uploads are rejected.
- Existing account-deletion planning journals assets before parent removal.
  An additive Host-only journal hook suppresses nonzero-reference journal entries;
  no completed Avatar or Experience function is replaced.
- Rollback can fail on a newer locator or Auth metadata change. It never overwrites
  that change, resurrects a tombstoned asset, or deletes any source/destination bytes.

# Target architecture

| Decision | Implemented foundation |
| --- | --- |
| Original authority | Dedicated public R2 `locally-public-host-profile-originals` |
| Public domain | `host-profile-media.locally-travel.com` (proposed, not created) |
| Immutable identity | `host-profiles/v1/<owner scope SHA>/<server asset UUID>/profile` |
| Owner | Exact authenticated profile UUID; asset owner and every parent agree |
| Write authority | Dedicated Host server endpoint and binding; true requires Production runtime; failure never falls back |
| DB authority | Host application locator plus scoped legacy profile/Auth aliases |
| Reference model | Separate Host application, legacy profile and legacy Auth parents |
| CAS | Whole owned source-object reference group in one PG transaction |
| Rollback | Exact new-to-old group CAS, recorded Auth post-digest, retained bytes |
| Backup authority | Separate exact-bucket read-only Host source adapter |
| Compatibility | Legacy/public/external URLs retained; current managed origin bypasses stale derivative manifest |
| Orphans | `legacy_unreferenced_retained`; no adoption, copy or deletion |
| Physical deletion | Disabled; source operator has no delete method |

The existing Host derivative buckets and manifest remain delivery caches. They
are never original-authority fallback. Avatar bucket/binding/keys/RW revocation and
Reader remain unchanged. Experience source and all Queue/Cron/service/DO config
remain unchanged. An offline overlay adds only the Host binding/flag and requires
the completed Avatar true/binding baseline before producing a candidate config.

# Files changed

- Host SQL migration, pending-only current-state manifest/checker bookkeeping.
- Host source contract/core/server runtime, browser endpoint client and upload
  handler; `/api/host/profile-photo`.
- Host registration/editor and photo save CAS; dashboard passes the actual Host
  locator separately from account fallback. Approved registration remains immutable.
- Additive Host origin rendering / Next Image domain; scoped locale metadata fix.
- Source-byte audit, migration plan/prepare/apply/rollback operator, offline release
  overlay; sanitized evidence and runbook.
- Dedicated backup adapter and scoped Auth association RPC, optional workflow
  reader inputs. No secret is written and no schedule is changed.
- Stronger Avatar separation test, Host unit/actual-route/PG/operator/backup tests,
  and additive required Host gates in the existing exact Foundation CI workflow.

# DB/lifecycle model

Additive SQL creates no legacy assets or references. Registry begin/verify are
backend-only; uploads remain verified pending until an owned business save.
Business hooks commit the verified asset and attach individual parent references
in the same transaction as locator changes. Replacement/deletion removes only
that parent; tombstone/journal happens at reference zero. Auth-only remaining
references retain bytes. Journal filtering applies only to Host scope, preserving
existing generic owner-deletion and Avatar/Experience functions.

All parents in a source-object migration group CAS together. Owner/parent/asset
locks, duplicate-parent bounds, complete exact reference count, source gate,
Auth/public/Host agreement and Auth metadata digests are validated. Any mismatch
rolls back the entire group. Partial progress across different object groups is
persisted privately with counts/stage; failure never claims full success.

Production contracts still describe applied Avatar and Financial P0. Host SQL is
hash-pinned as **pending**, never added to the applied ledger or blanket rollout.

# Backup model

Supabase retains all legacy bytes including the 75 unreferenced objects. Host R2
captures registered pending/committed/tombstoned originals plus live locator
associations, including scoped Auth metadata. The private encrypted manifest
records only locator associations, not unrelated Auth metadata/PII. Byte SHA/size
and restored source mapping are verified with real age encryption fixtures.

The Host source reader is a different credential ID from Avatar, Experience and
backup destination. It can LIST/HEAD/GET only its exact original bucket. Missing,
incomplete or reused credentials fail closed; no writer/delete API exists.
Both backup workflows were freshly confirmed active by read-only GitHub API.
Storage remains 03:37 KST; DB remains 03:17 KST. No backup was dispatched and no
existing credential was rotated, expanded, reused or revoked.

# Migration operator

`host-profile-media-operator.mjs` modes:

- `validate`: offline plan digest/identity check; zero network calls.
- `plan`: read-only inventory plus complete live source GET/SHA/size/MIME checks,
  stable final inventory and private mode-0600 plan. Orphans are counted only.
- `prepare`: approved digest, frozen legacy writes, fresh exact source metadata,
  actual byte SHA before/after conditional destination create, registry verification.
- `apply`: repeat those checks; atomic complete group CAS and post-verify all
  locators, lifecycle references, registered identity and destination bytes.
- `rollback`: exact group new-to-old CAS and recorded Auth post-digest; verify
  old locators, zero managed references and retained destination bytes.

Mutation modes require both matching approved/confirmed plan digests before
clients are created. Buckets, immutable keys, owner/byte identities and bounds
are fixed. There is no overwrite, copy, delete, orphan adoption, credentials
management, deployment or backup dispatch command. Provider timeouts/retries
are bounded; sanitized output contains no raw source URLs or user IDs. Private
failure progress retains the last verified stage and requires fresh verification.

Example shapes (do not run before Production approval):

```sh
node scripts/cloudflare/host-profile-media-operator.mjs --mode=plan --output=<private-plan.json>
node scripts/cloudflare/host-profile-media-operator.mjs --mode=validate --plan=<private-plan.json> --confirm-digest=<reviewed-digest>
node scripts/cloudflare/host-profile-media-operator.mjs --mode=prepare --plan=<private-plan.json> --approved-digest=<reviewed-digest> --confirm-digest=<reviewed-digest> --output=<private-progress.json>
# apply / rollback use the same explicit digest arguments and private output.
```

# Compatibility strategy

Host-first public selection and account Avatar fallback keep their existing
semantics. New managed origins render directly, while legacy exact-origin
manifests remain intact. No derivative is mistaken for an upload original.
Older JWTs retain readable sources. External/OAuth URLs and every other source
prefix remain outside the selection. New UI sends the actual prior Host locator
for CAS rather than its account fallback. Missing/stale photo snapshots fail
before photo changes; later saves never overwrite a newer account Avatar.

# Tests and CI

See the final verification evidence for exact head/run URLs. Required checks
include Host unit/operator/actual save routes, PGlite, native PG17 race, real age
backup restore, Avatar, lifecycle, Experience, Auth, Financial P0, TypeScript,
lint, candidate release, build/runtime and the unchanged existing CI steps.
CI adds Host gates; no existing release/security gate is removed or weakened.

# Production mutations

**0**. Read-only Production inspection only. No migration, deployment, remote
object write/delete, credential/secret update, backup dispatch, merge or Vercel
action occurred. Local PG fixture SQL and isolated Foundation CI are non-Production.

# Proposed Production cutover (one consolidated controlled runbook)

After a separate explicit Production approval tied to the reviewed release head:

1. Re-fetch main, require accepted Avatar/Financial baseline and exact green CI.
   Capture fresh catalog, live references/owners/bytes/SHA and provider settings.
   Validate 2 consumers, 5 application crons and both backup schedules. Stop on
   unexplained source/owner/reference drift, degradation or unrelated scope.
2. Provision only the dedicated Host originals bucket and public domain, with
   no object-expiry rule. Create a temporary exact-bucket Host Operator RW and a
   different exact-bucket Host Backup Reader (LIST/HEAD/GET only). Provider policy
   proof must exclude Avatar/Experience/derivative/backup resources. Never expand
   an existing credential. Reviewed secret placement is a separate controlled gate.
3. Apply only the exact hash-pinned Host migration, verify roles/schema and zero
   backfill. No destructive DB operation, blanket pending apply or source deletion.
   Configure the optional reader only after the narrow Auth RPC exists. Validate
   the source adapter and an explicitly approved encrypted backup/isolated restore.
4. Build the offline Host overlay from the actual accepted Avatar-on release config
   (keep_vars true, exact Avatar binding/flag). Review config diff and preserve
   queues/crons/services/DO/routes/Financial flags. The existing candidate gate
   continues to reject binding/flag drift. Provision the Host binding with flag
   false as an explicitly reviewed configuration stage; capture the accepted
   baseline anew. Release Host code against that unchanged baseline using all
   existing candidate gates, then activate only the Host flag in its explicit
   authority stage. The existing CLI provides plan/dry-run only; execution needs
   reviewed live adapters and separate controlled gates, never a gate waiver. Check owned upload,
   pending-to-save reference commit, fail-closed behavior and public/Chat rendering.
5. In an explicitly approved transaction arm only
   `private.host_profile_source_authority.r2_enabled=true`; verify the legacy
   prefix writer freeze. Physical source DELETE remains disabled. Generate a
   new stable private plan from this state; review its complete group digest and
   aggregates (do not assume the historical/current counts must remain identical).
6. Run reviewed-digest prepare, verify every destination byte and lifecycle record,
   then bounded apply. Auth/public/Host aliases CAS atomically per object. On any
   mismatch stop, retain progress/bytes and do not overwrite a newer change.
   Verify zero live legacy Host references across all three tables, source retention,
   unique object/reference/shared counts, Chat/public compatibility, unchanged
   Avatar/Financial/Experience and Queue/Cron/schedule invariants.
7. Run the explicitly approved authoritative byte backup and isolated restore proof,
   including Host/Auth mapping. Revoke only temporary Host Operator RW; retain the
   exact-bucket reader and all legacy/unreferenced/pending/tombstoned bytes. Record
   source/destination digests and current applied-state evidence separately.

Rollback keeps schema, binding/domain and all bytes. With the source freeze
armed, run exact new-to-old group CAS only where locators and recorded Auth digest
still match. A newer change blocks that group and requires explicit reconciliation.
Writes may remain on R2 while read locators roll back. A write-authority rollback
requires separate reviewed gate ordering (unfreeze then server flag false), with
physical source DELETE still disabled. No config reset of the completed Avatar,
no newer-user overwrite, tombstone resurrection, orphan copying or physical delete.

# Minor issues self-remediated

| Issue | Small correction / affected retry | Why safe |
| --- | --- | --- |
| Existing checkout had unrelated edits | Isolated exact-main worktree | No user change overwritten |
| npm10 peer-lock diagnostic | Node24/npm11 npm ci | Dependencies/lock unchanged |
| SQL result wrapper/XPath diagnostic | Correct parsing; repeat read-only scan | No writes or PII output |
| Queue response used script instead of script_name | Correct field; rerun consumer count | Read-only result 2 |
| Wrong React test condition | Run exact Avatar contract | Existing assertions retained |
| Backup prefix syntax typo | Correct syntax; affected regressions | No authority/ceiling change |
| npm shorthand embedded-postgres@17 absent | Pin 17.6.0-beta.15 | Isolated local PG17 dependency |
| Generic trigger record field resolution | Nest table-specific branch | Same criteria pass in PGlite/native PG |
| Python tar filter unavailable | Extract only verified age binaries by exact member | Checksum verified; no path extraction |
| Next ESM harness import resolution | Use supported CJS test bundle | Real handlers and NextResponse tested |
| Miniflare5 options / multipart length | Supported converter; serialize exact multipart body | Real workerd original criteria pass |
| Stale failed route-test bundle | Remove only generated bundle; add failure cleanup; rerun full lint | No ignore/gate weakening |
| Test fixture variable-name mismatch | Match actual upload/query names | Strong separation/CAS assertions retained |

Non-Production scope changes above were explicitly approved. Production approval
is still required for the consolidated cutover, not for further local corrections.
