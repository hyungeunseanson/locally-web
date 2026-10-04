# Production database backup and recovery

Phase 1 stores a daily logical database backup in the private Cloudflare R2
bucket `locally-production-db-backups`. The production application does not read
from or write to this bucket.

The GitHub Actions schedule runs daily at 18:17 UTC (03:17 KST on the following
calendar day). Manual dispatch remains available for recovery rehearsals.

The pinned Supabase Postgres image starts a socket-only temporary PostgreSQL
server while it runs its initialization scripts, stops that server, and only
then starts the final PostgreSQL process. A successful `pg_isready` against the
default Unix socket is therefore not sufficient readiness evidence. The restore
rehearsal waits for the image's final-initialization marker and then confirms a
query against the final server before copying or restoring the dump.

## Recovery coverage

Included:

- PostgreSQL roles needed by the logical restore.
- A dependency-ordered PostgreSQL custom-format archive (`database.dump`) used
  by the automated isolated restore rehearsal.
- Application schema, data, functions, RPCs, triggers, grants, RLS policies,
  views, and indexes captured by the Supabase CLI logical dump.
- Supabase-managed data, including `auth.users`, `storage.buckets`, and
  `storage.objects` metadata.
- Custom post-data objects in `auth` and `storage`, including custom triggers
  and RLS policies.
- `supabase_migrations` history and the `supabase_realtime` publication table
  list.

Not included:

- Supabase Storage object bytes. Database rows describe the files, but the file
  payloads require a separate Storage backup phase.
- Project-level Auth provider settings, OAuth secrets, SMTP settings, Edge
  Function secrets/code, Supabase project encryption root keys, or dashboard
  configuration.
- Vercel configuration, DNS, or Cloudflare settings outside this R2 bucket.

## Encryption and retention

The workflow makes the logical dump on an ephemeral GitHub-hosted runner,
restores and validates the plaintext there, then creates an internal SHA-256
manifest and encrypts the archive with age to an offline X25519 recipient. Only
the ciphertext and its outer SHA-256 checksum are uploaded to R2.

The private age identity is stored outside the repository at:

`~/.locally-backup/keys/production-r2-backup.agekey`

It must remain mode `0600` and must never be copied to GitHub, Vercel,
Cloudflare, chat, or repository files. Keep at least one encrypted offline copy
in a separately controlled location.

R2 locks objects under `daily/` for 30 days and expires them after 35 days.

## Manual download verification

After downloading a backup object and its adjacent `.sha256` file, ensure the
official `age` binary is installed and run:

```bash
scripts/backup/verify-downloaded-backup.sh \
  locally-supabase-production-YYYY-MM-DDTHH-MM-SSZ-RUN-ATTEMPT.tar.gz.age \
  locally-supabase-production-YYYY-MM-DDTHH-MM-SSZ-RUN-ATTEMPT.tar.gz.age.sha256 \
  ~/.locally-backup/keys/production-r2-backup.agekey
```

Successful output includes both the ciphertext checksum result and
`R2_DOWNLOAD_DECRYPT_AND_INTERNAL_CHECKSUM_PASS`.

To connect that exact downloaded ciphertext to an isolated restore rehearsal,
pass the security assertions as the fourth argument:

```bash
scripts/backup/verify-downloaded-backup.sh \
  locally-supabase-production-YYYY-MM-DDTHH-MM-SSZ-RUN-ATTEMPT.tar.gz.age \
  locally-supabase-production-YYYY-MM-DDTHH-MM-SSZ-RUN-ATTEMPT.tar.gz.age.sha256 \
  ~/.locally-backup/keys/production-r2-backup.agekey \
  scripts/backup/assert-locally-security.sql
```

This verifies the outer checksum, decrypts into a mode-`0700` temporary
directory, rejects unsafe archive members, verifies the internal checksum, and
passes the extracted `database.dump` to the same isolated restore contract. The
plaintext archive and extracted files are removed by the script on exit.

## Full recovery requirements

Restore only into a new or disposable project first. Apply `roles.sql`, then
restore `database.dump` with `pg_restore --single-transaction --exit-on-error`.
The split schema/data and managed-schema SQL files are retained as inspection
and selective-recovery aids, not as the automated full-restore path. Run
`scripts/backup/assert-locally-security.sql` before directing any traffic to the
recovered database.

The isolated rehearsal omits only ACL entries for the platform-managed
`extensions` schema because a Supabase target owns those privileges. Grants in
`public`, `auth`, and `storage` remain in the restore and are compared with the
source catalog.

The isolated CI restore is a recovery rehearsal, not authorization to overwrite
Production. A real disaster recovery event also requires manually restoring the
project-level settings and Storage object bytes listed above.

The restore container uses `--network none`, publishes no host port, accepts no
database URL, and runs all restore and assertion commands through its local Unix
socket. On failure it records only bounded container state (`OOMKilled`, exit
code, restart count, lifecycle timestamps) and allowlisted PostgreSQL lifecycle
messages before removing that exact disposable container.

## Storage byte backup and recovery

The database backup covers `storage.buckets` and `storage.objects` metadata, not
the object payloads. The separately approved Storage-byte backup uses the
existing private backup bucket, client-side encryption, and a snapshot manifest.
It must not copy sensitive files into the public media bucket.

| Source bucket | Sensitivity and recovery source | Planned private backup treatment |
| --- | --- | --- |
| `experiences` | Private legacy/residual/operator recovery source; current Experience originals are R2 primary | Preserve all residual Supabase bytes, and separately encrypt the DB-referenced R2 originals/sources |
| `images` | Mixed application media | Encrypt by source object identity and preserve access metadata in the snapshot manifest |
| `avatars` | Public-facing profile media with account linkage | Encrypt; restore only after the matching DB/Auth snapshot is selected |
| `chat-images` | The source bucket is private and conversation media is sensitive recovery data | Encrypt with restricted recovery access; never place in public R2 |
| `admin_files` | The source bucket is private and operational documents are sensitive recovery data | Encrypt with restricted recovery access; never place in public R2 |
| `verification-docs` | Private bucket with highest-sensitivity identity documents | Encrypt separately within the private backup namespace; never place in public R2 |

The snapshot manifest should bind each object key hash, byte size, content type,
source modification evidence, and ciphertext SHA-256 to the database backup ID
and capture time. Initial copy cost is one bounded source read and one encrypted
private-R2 create per object plus manifests; later runs should list metadata and
copy only new or changed source objects. Source metadata is not a substitute for
the ciphertext byte checksum.

Storage backup retention should be explicit and compatible with deletion and
privacy obligations. With the current database-backup policy, immutable daily
objects remain locked for 30 days and expire after 35 days, so a source deletion
may remain in encrypted backup until expiry. Restoration must record the actual time delta between the selected
DB and Storage captures, verify outer and
per-object checksums, restore into a non-production destination first, and
re-check private bucket authorization before any traffic is enabled.

The database workflow still performs no Storage byte copy. The verified v1 baseline uses
the separately invoked `scripts/backup/storage-byte-backup.py` tool.
The provider-aware workflow and v2 contract below extend that implementation. It covers
all objects in the six allowlisted buckets, including inactive, orphaned,
legacy, zero-byte, Unicode-named, and private objects. It never changes the
source buckets.

### Retention and privacy boundary

Storage snapshots use unique keys below `daily/storage-v1/<snapshot-id>/` in
the existing private `locally-production-db-backups` bucket. This placement is
required: the current bucket policy locks `daily/` objects for 30 days and
expires them after 35 days; a sibling top-level prefix would not inherit those
rules. Do not change the prefix or treat the private ciphertext as public just
because some source buckets are public. A deleted user file can remain in an
immutable encrypted snapshot until the 35-day lifecycle expiry.

Every source file is encrypted separately with the existing public age
recipient before upload. R2 keys contain only a SHA-256 source identity, never
the bucket path or user identifier. The encrypted manifest retains the exact
bucket, original key, MIME/Storage metadata, source version evidence, plaintext
SHA-256, ciphertext key/SHA/size, and capture boundary required for restore.
The adjacent public-safe summary contains counts, byte totals, plan digest and
hashed R2 locations only.

### Plan, prepare, and apply

The default `plan` mode lists Storage metadata and writes only a mode-`0600`
local plan. It performs no source payload GET, transform, Queue operation, or R2
write. The `prepare` step rechecks the complete inventory, downloads only the
objects that lack reusable unexpired proof, enforces the 5,000-object and 2 GiB
received-byte ceilings, hashes the actual bytes, and produces the prepared
plan. Response-body reads are bounded by the CLI `--timeout`, not only the
initial HTTP connection. An interrupted prepare can reuse completed cache files
only when the private cache is bound to the exact metadata plan digest; the
already received objects and bytes continue to count against the same ceilings.
An unbound, mismatched, incomplete, or symlinked cache fails closed. That plan's
canonical digest binds the source bucket/key, identity, size,
actual SHA, metadata evidence, ciphertext destination, database-backup
relation, retention, scope, and all hard ceilings.

`apply` accepts only a prepared plan plus the exact confirmation digest. Before
the first R2 write it validates the schema, namespace, limits, every cached
file's actual size/SHA, and a fresh complete source inventory. Uploads use S3
`If-None-Match: *`; a concurrent or resumed object is accepted only when its
plan/source proof is exact. The tool never calls overwrite helpers,
CopyObject, or DeleteObject. A final inventory drift prevents a complete
manifest. Partial ciphertext remains immutable and the same approved plan can
resume without recreating already accepted objects.

Hard ceilings for one baseline are 5,000 source objects, 2 GiB of source
payload received (failed attempts included), 12,000 new R2 objects, and 3 GiB
of newly stored ciphertext/checksum/manifest bytes. Provider retries are
disabled for R2 writes so an SDK retry cannot bypass the attempt accounting.
The source client also performs no automatic payload retry. Operators must
record platform billing meters separately from these byte/application counts.

Plans and decrypted manifests contain private paths. Keep them only in a
mode-`0700` operator directory, never in GitHub artifacts or logs. A typical
approved run is:

```bash
umask 077
export SUPABASE_SERVICE_ROLE_KEY='(load from an existing approved local source)'
export R2_ENDPOINT='(existing private R2 S3 endpoint)'
export R2_BUCKET='locally-production-db-backups'
export AWS_ACCESS_KEY_ID='(existing scoped credential)'
export AWS_SECRET_ACCESS_KEY='(existing scoped credential)'

scripts/backup/storage-byte-backup.py plan \
  --output "$RUN_DIR/plan.json" \
  --snapshot-id "$SNAPSHOT_ID" \
  --db-backup-id 34916900214 \
  --db-backup-time 2026-09-15T01:21:29Z

scripts/backup/storage-byte-backup.py prepare \
  --plan "$RUN_DIR/plan.json" \
  --output "$RUN_DIR/prepared.json" \
  --cache-dir "$RUN_DIR/source-cache"

# Review the sanitized counts and exact prepared plan digest first.
scripts/backup/storage-byte-backup.py apply \
  --plan "$RUN_DIR/prepared.json" \
  --confirm-digest "$APPROVED_DIGEST" \
  --cache-dir "$RUN_DIR/source-cache" \
  --work-dir "$RUN_DIR/encrypted-work" \
  --age-recipient "$AGE_RECIPIENT" \
  --summary "$RUN_DIR/public-summary.json"
```

The DB backup identifier and timestamps express association, not an atomic
cross-service snapshot. Compare start/end Storage inventory digests and the
recorded time delta before accepting a pair.

### Incremental snapshots

An operator may provide a previously decrypted, still-recoverable manifest to
`prepare --previous-manifest`. Metadata-identical entries reuse their recorded
plaintext SHA and ciphertext references without a source GET or R2 PUT. Their
proof is explicitly `reused-prior-byte-sha256`, not newly byte-verified. The
new snapshot's `recoverableUntil` is the earliest expiry among all referenced
ciphertexts, so an older reference cannot silently expire before the manifest.
Changed or new objects are downloaded and encrypted normally. This mode is not
scheduled automatically.

### Download-based file restore

Restore downloads the encrypted manifest and every referenced ciphertext from
private R2, verifies the outer checksums, decrypts with the existing mode-0600
offline identity, rejects traversal/symlink destinations, and compares every
restored byte SHA/size with the encrypted manifest:

```bash
scripts/backup/storage-byte-backup.py restore \
  --manifest-key "$MANIFEST_KEY" \
  --manifest-checksum-key "$MANIFEST_KEY.sha256" \
  --identity ~/.locally-backup/keys/production-r2-backup.agekey \
  --destination "$DISPOSABLE_LOCAL_DIRECTORY"
```

The destination contains the original bucket/key tree plus private manifest
and verification metadata. It is a disposable local byte restore, not a
Production Storage API restore and not proof that RLS or signed/public URL
behavior was recreated. Delete only the task-created plaintext directory after
verification; preserve the offline identity and remote encrypted snapshot.

### Project settings outside DB and Storage bytes

Auth provider enablement, OAuth client IDs/secrets and redirect allowlists,
SMTP credentials, project URLs/API keys, Edge Function secrets, webhook
destinations, DNS, and Cloudflare/Vercel configuration remain outside both
backup payloads. The recovery operator must take their names and required
values from the private platform consoles/approved secret manager, recreate or
rotate credentials through each provider, and then test in an isolated project.
The repository documents required setting names and ordering only; secret
values and Supabase platform root keys must never be exported into Git.


## Provider-aware operational Storage backup (v2)

Current Experience source/write authority is R2. All six Supabase buckets remain
recoverable sources; avatars, images, chat-images, admin_files and
verification-docs retain their existing authority and policies. A complete
capture includes every object in those six buckets and every live DB-referenced
R2 `originals/` or `sources/` key. Derivatives are not original backup proof.
The enabled managed-assets option also includes registered new uploads that
exist in R2, including pending PUTs whose final DB verification failed. A pending
registry entry with no object is upload intent, not a missing business original.
A missing committed/business-referenced original fails the capture.

`.github/workflows/authoritative-storage-backup.yml` is a separate scheduled and
manually dispatchable workflow. Its intended schedule is daily **18:37 UTC
(03:37 KST)**, twenty minutes after the logical DB backup schedule. Concurrency
prevents overlapping Storage captures. Activation requires all configuration and
the intended additive lifecycle migration; a workflow file alone is not evidence
that Production backup is enabled or successfully protecting current originals.
The implementation report records actual activation and proof status.

Use the existing private `locally-production-db-backups` bucket and the distinct
`daily/storage-v1/` prefix. Version 2 is encoded inside the encrypted manifest;
keeping this prefix preserves the verified 30-day lock / 35-day expiry policy.
Public domains and r2.dev must remain disabled. No new business-file retention
period is introduced. The normal application Worker receives no backup binding
or destination credentials.

The `production-backup` environment needs the existing destination-only
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET` and public
`AGE_RECIPIENT`, plus a dedicated backup-source Supabase backend API credential named
`STORAGE_SUPABASE_SERVICE_ROLE_KEY` (separate from the application runtime key;
its value must be a dedicated named modern `sb_secret_...` key, never a legacy
JWT service_role key; the secret name is retained for transport compatibility)
and a **separate,
source-bucket Object Read Only** pair named `R2_SOURCE_READ_ACCESS_KEY_ID` and
`R2_SOURCE_READ_SECRET_ACCESS_KEY`. Verify that the R2 source credential is scoped
only to the Experience source bucket, and the destination credential only to the
private backup bucket. Never supply a combined source/destination credential.
The Supabase adapter only lists, reads info, reads locator associations and GETs
object bytes; it has no source mutation operation. The Storage job never loads
`SUPABASE_DB_URL`. No AGE private identity is stored in GitHub or a Worker.

The source plan binds provider, exact bucket/key, source/version evidence, size,
MIME, cache/custom metadata, locator associations and actual plaintext SHA-256.
Supabase custom metadata is captured through object info, including quarantine
provenance. R2 GET uses the planned eTag precondition and calculates SHA from the
actual body. Required managed registry SHA/size must agree with those bytes.
Object identities keep the v1 Supabase hash stable and put R2 in a disjoint
provider namespace. Unicode and zero-byte legacy objects remain supported.

Each object and the sensitive manifest are encrypted with age X25519 before any
remote write. The destination receives ciphertext and checksum records only.
Conditional creates, plan/identity proofs and re-downloaded ciphertext SHA/size
checks make interrupted same-plan retries safe. The complete manifest is
published after all object proofs and the end inventory match. A failed capture
leaves only incomplete encrypted objects under its own snapshot prefix; it
cannot replace an earlier good manifest or shorten that snapshot's retention.
Scheduled captures perform fresh byte reads rather than depending on older
expiring ciphertext. Optional manual reuse checks prior byte proof, exact
metadata/association identity, ciphertext bytes and remaining expiry.

The operator `scripts/backup/run_storage_backup.py` defaults to byte preparation
without destination writes. `--apply` publishes the encrypted snapshot. Both
modes require separated credentials. Hard ceilings are 5,000 source objects/
GET attempts, 2 GiB cumulative source bytes, 12,000 destination create attempts
and 3 GiB new encrypted destination bytes. The 2026-10-04 input of 1,031 objects /
422,843,988 bytes uses about 21% / 20% of source capacity, leaving meaningful
growth room while keeping every run finite. A maximum-size 5,000-object snapshot
needs 10,002 destination objects (ciphertext/checksum per source plus the
manifest/checksum pair), below 12,000. The extra 1 GiB above the source byte
ceiling covers age framing, per-object headers/checksums and encrypted manifest
overhead. Failed attempts count toward the same limits; actual usage remains in
the sanitized source-preparation and destination budget ledgers. Reads have
deadlines and at most one bounded source-timeout
retry. Exceeding a ceiling fails visibly; do not silently omit a provider.
Private temporary plans, plaintext payloads and intermediates are removed after
the run; only sanitized aggregate evidence is uploaded as a GitHub artifact.

### Capture association and isolated restore

The operator selects the nearest prior logical DB backup whose GitHub run on
main succeeded, then re-downloads and verifies its ciphertext checksum. Its ID,
time and workflow evidence accompany the Storage capture. The encrypted
manifest records Storage start/end, DB backup time, and `atomic=false`.
Storage end is the end of source byte preparation; destination verification
happens after this boundary. DB and Storage are not one atomic point in time.
Recover business references from the selected DB backup and use the encrypted
manifest's `dbReferences` to map a locator at capture time to provider/bucket/key
and ciphertext. Assets created in the intervening delta can be recoverable as
files while their newer business rows require a later DB snapshot; never invent
missing rows or attach an ownerless document to a user by guess.

Run restore outside the application runtime, using the offline private identity
and a new, private local directory. The existing restore CLI accepts v1 and v2:

```sh
python3 scripts/backup/storage-byte-backup.py restore \
  --manifest-key '<snapshot manifest key from sanitized summary>' \
  --manifest-checksum-key '<same key>.sha256' \
  --identity '<offline identity path>' \
  --destination '<new isolated private directory>'
```

Selectors `--provider`, `--bucket` and `--object-identity` support subsets or one
object; `--manifest-only` validates mappings without restoring payloads. Even a
subset first validates the whole manifest's summary, duplicate identity set and
approved source/metadata contract. Full restore validates every ciphertext,
decrypts, checks plaintext SHA/size and reconstructs `provider/bucket/key` under
the private destination. The private restored manifest retains MIME, cache,
custom metadata and locator associations. No Production upload/overwrite is
implemented by rehearsal tooling. A future Production restore needs its own
explicit authorization and provider/RLS validation.

The encrypted object set, checksum records and manifest are portable. They can
be exported intact to any independent destination and restored without the
application Worker. Until an existing independent destination is verified and
copied, report **INDEPENDENT_OFFSITE_TIER_PENDING**. Operational R2 protection
and offline restore can still complete; final Supabase Storage retirement
cannot pass the independent offsite gate.

## Lifecycle-managed assets and deletion safety

See [media lifecycle operations](storage-media-lifecycle-runbook.md). The new
registry does not assign guessed owners to the 747 historical Supabase objects
or historical unregistered R2 originals. Their recovery manifest preserves
locator/provenance evidence; active lifecycle management starts with new
Experience uploads. Verification-document ownership/quarantine and retention
remain fail-closed. No historical physical deletion is authorized by a backup,
matching SHA, zero reference count, or this runbook.

## Bounded failure diagnostics and controlled retry

The operator writes an atomic, sanitized progress summary before remote work
and each operation, then writes a final summary on caught failure. Both the
step summary and capture-evidence artifact are preserved on failure. Stages
identify configuration, DB association, each provider inventory, source
revalidation, provider downloads, preapply inventory, encryption, destination
create/byte verification, final inventory and manifest publication. Object
context is only a SHA-256 identity hash. Exception messages, provider bodies,
source paths/URLs and credentials never enter this output.

Source GET attempts/retries and all received bytes include failed attempts;
completed objects/bytes count fully downloaded and identity-checked payloads.
Inventory attempts/retries are separate metadata call counters. Destination
counters record create attempts and acknowledged creates/bytes; a transport
failure can leave an unacknowledged partial create in the unique snapshot
prefix. Such a prefix is not a successful snapshot. Always require workflow
success, COMPLETE manifest and byte verification before restore/coverage proof.
Failure diagnostics retain actual budget usage even before apply starts.

R2 connect/read timeout, closed/reset connection, endpoint failure, throttling
and provider 5xx receive at most one retry per read operation. The SDK's hidden
retry count remains one total attempt. 401/403, credential/scope errors, 412,
identity drift and validation errors never retry. Partial local GET files are
removed before retry, and failed network bytes still consume the hard budget.
Supabase payload ETag must match the planned ETag when one was captured; exposed
version headers are compared when available. Missing planned ETag evidence in
the payload response fails closed.

The existing five detailed inventory checkpoints remain: planning, prepare
precheck, post-download revalidation, apply precheck and final drift check.
Supabase object-info supplies custom/cache metadata and identity fields which
are not all present with the same representation in list results. Replacing
those passes with cached metadata would require a separate, proven digest
contract. This bounded hardening retains the full metadata/locator drift gates
and raises only the Storage workflow wall-clock limit from 45 to 90 minutes.
Request deadlines, source 5,000 attempts / 2 GiB and destination 12,000 creates /
3 GiB ceilings remain unchanged. No source-write/delete API is introduced.

For the approved controlled retry, dispatch once after exact-head CI and merge.
If it fails, retain the sanitized stage/provider/operation/code and counters,
stop, and report FOUNDATION BLOCKED. Do not automatically dispatch another run.
On success, perform the full isolated offline-AGE restore and fresh current-R2
coverage proof; inventory alone cannot establish recoverability.

Provider contracts checked against [Boto3 error handling](https://docs.aws.amazon.com/boto3/latest/guide/error-handling.html),
[botocore exception types](https://github.com/boto/botocore/blob/develop/botocore/exceptions.py),
and [Supabase Storage response headers](https://github.com/supabase/storage/blob/master/src/storage/renderer/renderer.ts).
