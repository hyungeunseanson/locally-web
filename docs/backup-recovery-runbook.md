# Production database backup and recovery

Phase 1 stores a daily logical database backup in the private Cloudflare R2
bucket `locally-production-db-backups`. The production application does not read
from or write to this bucket.

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

## Full recovery requirements

Restore only into a new or disposable project first. Apply `roles.sql`, then
restore `database.dump` with `pg_restore --single-transaction --exit-on-error`.
The split schema/data and managed-schema SQL files are retained as inspection
and selective-recovery aids, not as the automated full-restore path. Run
`scripts/backup/assert-locally-security.sql` before directing any traffic to the
recovered database.

The isolated CI restore is a recovery rehearsal, not authorization to overwrite
Production. A real disaster recovery event also requires manually restoring the
project-level settings and Storage object bytes listed above.
