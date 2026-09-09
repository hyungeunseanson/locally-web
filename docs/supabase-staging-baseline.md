# Supabase staging schema baseline

## Decision

`supabase/migrations/20260909211131_production_schema_baseline.sql` is the canonical, schema-only starting point for a **new Supabase-managed staging project**. It was reconstructed from the PostgreSQL 17 catalog inventory captured read-only on 2026-09-09. It contains no Production application rows, Auth users, Storage objects, credentials, project refs, URLs, or owner UUIDs.

The root `supabase_*.sql` files and `docs/migrations/*.sql` remain historical evidence. Do not run them before or after the baseline: the baseline already folds in their final Production effects through `docs/migrations/v3_40_41_admin_manual_payout_zero_cancellation.sql`. There are no post-baseline migrations at this point in time.

## What the baseline owns

- 36 `public` tables and 472 table columns;
- 10 identity sequences, 159 constraints, and 99 indexes (47 constraint-backed plus 52 standalone);
- 2 views with their current security options;
- 36 function/RPC overloads (34 names), including owner, `SECURITY DEFINER`/invoker mode, `search_path`, volatility, and final execute ACLs;
- 11 Locally-owned triggers, including `auth.users.on_auth_user_created`;
- RLS enable/FORCE state and 127 policies (111 `public`, 16 `storage.objects`);
- application table/view/sequence/function ACLs and DEFAULT replica identity for all 36 tables;
- the exact seven-table `supabase_realtime` membership: `admin_audit_logs`, `admin_task_comments`, `admin_tasks`, `admin_whitelist`, `inquiry_messages`, `notifications`, and `profiles`;
- six empty bucket configurations, with public/private flags and the `admin_files` size limit;
- `pgcrypto`, the only non-platform extension used by captured defaults/function bodies.

`supabase/staging/production-baseline.manifest.json` is the review contract for names and counts. Production also contains legacy `likes` and `messages`, and the `check_rate_limit(text, integer)` function. Conversely, the catalog does not contain `community_comment_likes` or its two counter functions/triggers. The baseline follows the actual Production catalog; it does not invent the missing historical objects.

## Deliberate exclusions

The migration does not recreate Supabase-managed `auth` or `storage` tables, internal Storage triggers, platform schemas/roles, or managed extensions. It only attaches the Locally Auth trigger, creates Locally's `storage.objects` policies, and upserts bucket configuration into the managed table.

Installed-but-unused or platform-owned extensions (`plpgsql`, `pg_stat_statements`, `supabase_vault`, `uuid-ossp`) are not recreated or version-pinned. The fresh project's supported default version is used for `pgcrypto`.

Bucket `created_at`, `updated_at`, `type`, `versioning_status`, and `avif_autodetection` are excluded because they are environment/platform-owned values. Bucket IDs, names, visibility, file-size limit, MIME restriction, and all Locally `storage.objects` policies are preserved. No Storage object row is included.

## Application order

1. Create a new Supabase staging project through the separately approved platform workflow. The project must not be the Production ref and must start with Supabase-managed Auth, Storage, roles, and `supabase_realtime`.
2. Review `production-baseline.manifest.json` and run `npm run supabase:staging:baseline:check`.
3. Apply **only** `supabase/migrations/20260909211131_production_schema_baseline.sql` to the empty project. Do not apply historical patches.
4. Run both read-only catalog gates:
   - `psql "$SUPABASE_STAGING_DB_URL" -f supabase/staging/baseline-contract.sql`
   - `psql "$SUPABASE_STAGING_DB_URL" -f supabase/staging/schema-contract.sql`
5. Configure staging-only Auth Site URL, redirect allow list, Google/Kakao applications, and email-confirmation behavior as described in `docs/supabase-staging-bootstrap.md`.
6. Only after both contracts pass, run the synthetic fixture seed. Use staging-only runner credentials and clean up by the generated state file.

The migration fails closed when the expected Supabase-managed schemas/publication are absent or when `supabase_realtime` already has an unexpected member. A non-empty or customized project must be discarded or reconciled explicitly; the baseline does not delete unknown objects.

## Validation boundaries

The repository static gate checks object identity/count parity, exact Realtime membership, bucket presence, and absence of project refs, URLs, emails, credential assignments, customer inserts, managed table DDL, Storage system triggers, and extension version pins.

`baseline-contract.sql` is the authoritative post-apply catalog test. It is read-only. Before any staging fixture write, both catalog contracts must pass on the newly created project. This PR does not create a project, connect staging secrets, or remotely apply SQL.
