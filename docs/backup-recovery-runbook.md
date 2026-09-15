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

## Storage byte recovery policy (not yet executed)

The database backup covers `storage.buckets` and `storage.objects` metadata, not
the object payloads. A future separately approved Storage backup should use the
existing private backup bucket, client-side encryption, and a snapshot manifest.
It must not copy private files into the public media bucket.

| Source bucket | Sensitivity and recovery source | Planned private backup treatment |
| --- | --- | --- |
| `experiences` | Public and inactive experience source media; the public R2 mirror covers only a subset | Encrypt every authoritative Supabase object; use public R2 only as secondary evidence |
| `images` | Mixed application media | Encrypt by source object identity and preserve access metadata in the snapshot manifest |
| `avatars` | Public-facing profile media with account linkage | Encrypt; restore only after the matching DB/Auth snapshot is selected |
| `chat-images` | Private conversation data | Encrypt with restricted recovery access; never place in public R2 |
| `admin_files` | Operational/private documents | Encrypt with restricted recovery access; never place in public R2 |
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

No Storage byte copy is performed by the database backup workflow. Adding that
phase, changing retention, or restoring files remains a separately approved
operation.
