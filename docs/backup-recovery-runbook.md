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
| `experiences` | Public and inactive experience source media; the public R2 mirror covers only a subset | Encrypt every authoritative Supabase object; use public R2 only as secondary evidence |
| `images` | Mixed application media | Encrypt by source object identity and preserve access metadata in the snapshot manifest |
| `avatars` | Public-facing profile media with account linkage | Encrypt; restore only after the matching DB/Auth snapshot is selected |
| `chat-images` | The source bucket is public, but conversation media remains sensitive recovery data | Encrypt with restricted recovery access; never place in public R2 |
| `admin_files` | The source bucket is public, but operational documents remain sensitive recovery data | Encrypt with restricted recovery access; never place in public R2 |
| `verification-docs` | Highest-sensitivity identity documents | Encrypt separately within the private backup namespace; never place in public R2 |

The snapshot manifest should bind each object key hash, byte size, content type,
source modification evidence, and ciphertext SHA-256 to the database backup ID
and capture time. Initial copy cost is one bounded source read and one encrypted
private-R2 create per object plus manifests; later runs should list metadata and
copy only new or changed source objects. Source metadata is not a substitute for
the ciphertext byte checksum.

Storage backup retention should be explicit and compatible with deletion and
privacy obligations. With the current database-backup policy, immutable daily
objects remain locked for 30 days and expire after 35 days, so a source deletion
may remain in encrypted backup until expiry. Restoration must prove the selected
DB and Storage manifests share the same snapshot boundary, verify outer and
per-object checksums, restore into a non-production destination first, and
re-check private bucket authorization before any traffic is enabled.

The database workflow still performs no Storage byte copy. Storage bytes use
the separately invoked `scripts/backup/storage-byte-backup.py` tool. It covers
all objects in the six allowlisted buckets, including inactive, orphaned,
legacy, zero-byte, Unicode-named, and private objects. It never changes the
source buckets.

### Retention and privacy boundary

Storage snapshots use unique keys below `daily/storage-v1/<snapshot-id>/` in
the existing private `locally-production-db-backups` bucket. This placement is
required: the current bucket policy locks `daily/` objects for 30 days and
expires them after 35 days; a sibling top-level prefix would not inherit those
rules. Do not change the prefix or treat the private ciphertext as public just
because five source buckets are public. A deleted user file can remain in an
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
objects that lack reusable unexpired proof, enforces the 1,200-object and 512
MiB received-byte ceilings, hashes the actual bytes, and produces the prepared
plan. That plan's canonical digest binds the source bucket/key, identity, size,
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

Hard ceilings for one baseline are 1,200 source objects, 512 MiB of source
payload received (failed attempts included), 2,500 new R2 objects, and 640 MiB
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
