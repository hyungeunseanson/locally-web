# Supabase staging schema baseline

## Decision

`supabase/migrations/20260912034545_production_schema_baseline.sql` is the immutable, schema-only **2026-09-09 checkpoint** and the starting point for a new empty Supabase-managed staging project. It was reconstructed from a read-only PostgreSQL 17 catalog inventory. It contains no Production application rows, Auth users, Storage objects, credentials, project refs, URLs, or owner UUIDs. It is not the current Production contract and must not be rewritten to include later objects.

The root `supabase_*.sql` files and `docs/migrations/*.sql` remain historical evidence. Do not replay them: the baseline already folds in their final Production effects through `docs/migrations/v3_40_41_admin_manual_payout_zero_cancellation.sql`. The ordered post-baseline migration is currently `supabase/migrations/20260912050655_service_concierge_assignment.sql`. Current Production also includes the separately approved removal of the `Authenticated users can upload chat images` policy; that operational delta is not part of the migration ledger.

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

`supabase/staging/production-baseline.manifest.json` is the immutable checkpoint review contract. `supabase/staging/production-current-state.manifest.json` separately describes the current 39-table/44-function Production state. Production contains legacy `likes` and `messages`, and the `check_rate_limit(text, integer)` function. Conversely, the catalog does not contain `community_comment_likes` or its two counter functions/triggers.

## Deliberate exclusions

The migration does not recreate Supabase-managed `auth` or `storage` tables, internal Storage triggers, platform schemas/roles, or managed extensions. It only attaches the Locally Auth trigger, creates Locally's `storage.objects` policies, and upserts bucket configuration into the managed table.

Installed-but-unused or platform-owned extensions (`plpgsql`, `pg_stat_statements`, `supabase_vault`, `uuid-ossp`) are not recreated or version-pinned. The fresh project's supported default version is used for `pgcrypto`.

Bucket `created_at`, `updated_at`, `type`, `versioning_status`, and `avif_autodetection` are excluded because they are environment/platform-owned values. Bucket IDs, names, visibility, file-size limit, MIME restriction, and all Locally `storage.objects` policies are preserved. No Storage object row is included.

## Application order

1. Create a separately approved empty staging project or data-less branch. Its ref must differ from `uhinvcydgzqlpnvieyal`.
2. Run `npm run supabase:staging:baseline:check` and `npm run supabase:staging:current:check` locally.
3. For a **new empty project**, apply the immutable baseline and immediately run `baseline-contract.sql`. This contract is a checkpoint gate and is expected to fail after later migrations.
4. Apply `20260912050655_service_concierge_assignment.sql`.
5. In the same staging-only database session, set `locally.staging_target_ref` to the exact staging ref and apply `supabase/staging/post-baseline-current-state-overlay.sql`. It changes only the old chat-image INSERT policy and rejects the Production ref before its write.
6. Run `current-state-contract.sql` and `schema-contract.sql`, both read-only.
7. For a **branch cloned from current Production**, do not replay the baseline, concierge migration, or Storage overlay. Run only the current-state and staging schema contracts.
8. Configure staging-only Auth/OAuth, then seed synthetic fixtures only after the applicable contracts pass.

The migration fails closed when the expected Supabase-managed schemas/publication are absent or when `supabase_realtime` already has an unexpected member. A non-empty or customized project must be discarded or reconciled explicitly; the baseline does not delete unknown objects.

## Validation boundaries

The repository static gate checks object identity/count parity, exact Realtime membership, bucket presence, and absence of project refs, URLs, emails, credential assignments, customer inserts, managed table DDL, Storage system triggers, and extension version pins.

`baseline-contract.sql` is authoritative only at the immutable baseline checkpoint. `current-state-contract.sql` is the authoritative read-only test for a current Production clone or a fully bootstrapped empty project. This repository change does not create a branch/project, connect staging secrets, or remotely apply SQL.
