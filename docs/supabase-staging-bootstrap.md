# Supabase staging bootstrap for the Cloudflare functional canary

This repository does **not** contain a complete historical Supabase migration history. The SQL files are operational patches from different releases, and many assume that the base schema already exists. Do not run every repository SQL file alphabetically against a new project.

This change intentionally does not create a Supabase branch/project, connect to Production, dump Production data, or apply SQL. It provides a machine-readable contract, read-only schema inspection/assertion SQL, and synthetic fixture seed/cleanup tools for an isolated staging backend.

## Reproducibility decision

Repository migrations alone cannot recreate the current Production schema. No tracked `CREATE TABLE` exists for these application-owned base tables:

`admin_audit_logs`, `admin_task_comments`, `admin_tasks`, `admin_whitelist`, `bookings`, `experience_availability`, `experiences`, `guest_reviews`, `host_applications`, `inquiries`, `inquiry_messages`, `notifications`, `profiles`, `reviews`, `users`, and `wishlists`.

There is also no canonical `supabase/config.toml`, no ordered `supabase/migrations` ledger, and no tracked final definition for most legacy bucket policies. Several functions have multiple historical definitions, so filename order is not a reliable way to select the Production version.

The read-only Production inventory was captured and reconciled on 2026-09-09. The resulting canonical migration is `supabase/migrations/20260912034545_production_schema_baseline.sql`; its review contract and exact counts are in `supabase/staging/production-baseline.manifest.json`. See `docs/supabase-staging-baseline.md` for the application order and exclusions.

Required schema-only material:

- table columns, types, defaults, generated/identity properties, primary/foreign/check/unique constraints, sequences, and indexes;
- final view definitions and ownership/security options for `public_profiles` and `public_host_applications`;
- every overload, owner, `SECURITY DEFINER`, `search_path`, volatility, and execute grant for application functions;
- final triggers, RLS enable/force state, policies, and table/sequence/function grants;
- Realtime publication membership and replica identity for subscribed tables;
- Storage bucket names/public flags/file limits/allowed MIME types plus final `storage.objects` policies;
- extensions and types referenced by the above objects.

The older root SQL files remain evidence and patch history, not a fresh-project bootstrap. Their final effects through `docs/migrations/v3_40_41_admin_manual_payout_zero_cancellation.sql` are folded into the baseline. No historical patch is applied after the baseline.

## Required application objects

`supabase/staging/required-objects.json` is the source of truth generated from current `.from()`, `.rpc()`, trigger, Realtime, and Storage execution paths. It separates the whole application inventory from the functional-canary minimum.

The canary minimum is:

- tables: `profiles`, `profile_private_demographics`, `users`, `host_applications`, `experiences`, `experience_availability`, `bookings`, `inquiries`, `inquiry_messages`, `notifications`;
- views: `public_profiles`, `public_host_applications`;
- functions: `handle_new_user`, `is_admin_reader`, `ensure_profile_demographics_reminder`, `create_booking_atomic`;
- trigger: `on_auth_user_created` on `auth.users`;
- Realtime publication: reproduce the exact Production membership: `admin_audit_logs`, `admin_task_comments`, `admin_tasks`, `admin_whitelist`, `inquiry_messages`, `notifications`, and `profiles`. The functional canary exercises `inquiry_messages`, `notifications`, and `profiles`; it does not add `bookings` or `inquiries` to the publication;
- Storage: public `admin_files`, `avatars`, `chat-images`, `experiences`, `images`; private `verification-docs`.

The public flags above are the current runtime contract, not approval of broad object-listing policies. Preserve final Production RLS semantics. In particular, `profiles`/`users` must not be anon-readable, inquiry reads must be participant/admin scoped, direct client inserts to `inquiry_messages` must remain disabled, and `verification-docs` must remain owner/admin private. Production Storage files are never copied.

The current clients register `postgres_changes` handlers for `inquiries` and `bookings`, but those tables are not members of the Production `supabase_realtime` publication. Chat correctness already treats an `inquiry_messages` event as a signal to refetch inquiry/message state and performs a catch-up refetch after subscribe/reconnect. The canary must validate that Production behavior: create or update a message through the server path, observe the published `inquiry_messages` event, and verify the subsequent inquiry/message refetch. Booking correctness remains request/response based in this canary. Do not change publication membership merely to make the unused handlers fire.

## Auth and OAuth configuration

The application requires email/password Auth, Google, and Kakao. Email signup currently supports both session-immediate and verification-required responses, but the current UX and regression suite expect staging to mirror Production's confirm-email choice. Anonymous sign-in is not used. Auth user metadata must accept `full_name`, `phone`, `birth_date`, `gender`, `nationality`, and `preferred_locale`; `on_auth_user_created` must create the profile/private-demographics rows.

For an exact canary origin `https://<canary-host>`:

- set the staging Supabase Site URL to that canary origin and add `https://<canary-host>/auth/callback` to the Supabase redirect allow list;
- configure Google and Kakao only with staging OAuth applications/credentials;
- set each provider console callback to `https://<staging-project-ref>.supabase.co/auth/v1/callback`;
- keep the application callback `https://<canary-host>/auth/callback` behind the already-required Cloudflare Access policy and validate the full browser round trip manually;
- do not reuse Production provider credentials or add a Production callback wildcard.

References: [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase Kakao login](https://supabase.com/docs/guides/auth/social-login/auth-kakao), and [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Provisioning handoff and execution order

Platform work remains separate and requires explicit approval:

1. Prefer a persistent branch of the Production Supabase project with **Include data disabled**, or create a separate staging project. Record its branch/project ref and branch-specific credentials. Never use `uhinvcydgzqlpnvieyal` as staging.
2. Review the canonical schema-only baseline and manifest. Do not export or copy application rows or Storage objects.
3. A Supabase branch already clones its parent application schema, so do not manually replay the non-idempotent baseline over that non-empty branch. Managed Auth/Storage objects and default ACLs can still differ. For the disposable branch `ekfwkplibbqvbgqjumml` only, `supabase/staging/branch-parity-bootstrap.sql` restores the live-verified Production trigger, empty bucket metadata, Storage policies, and exact non-owner grants. It requires an explicit session target-ref marker and denies the Production ref before any write. It is staging-only operational SQL and must never move into `supabase/migrations` or be merged back through Supabase Branching.
4. Configure branch/project-specific Auth providers/redirects and verify the six empty Storage buckets and policies.
5. Keep both schema contracts as read-only gates after any staging configuration change.
6. Run `npm run supabase:staging:seed` with explicit staging-only environment variables.
7. Feed the printed guest/host IDs, inquiry ID, and image URL into the PR-2 functional canary runner. The fixture password remains runner-only and is never written to the state file.
8. After all provider sandbox journeys, run `npm run supabase:staging:cleanup -- <state-file>` and verify no `locally.staging.*@example.com`, `STAGING-*`, or `staging-canary/<run-id>/` artifacts remain.

Seed and cleanup require all of:

- `SUPABASE_STAGING_URL=https://<staging-project-ref>.supabase.co`
- `SUPABASE_STAGING_SERVICE_ROLE_KEY` (runner-only)
- `SUPABASE_STAGING_PROJECT_REF`
- `SUPABASE_STAGING_PROJECT_VERIFIED=true`
- `SUPABASE_STAGING_ALLOW_WRITES=true`
- `LOCALLY_STAGING_FIXTURE_PASSWORD` for seed only
- optional `LOCALLY_STAGING_FIXTURE_RUN_ID` and `LOCALLY_STAGING_FIXTURE_STATE`

The helper does not load `.env.local`. It rejects a URL/ref mismatch and the known Production project ref before constructing a client. The state file contains IDs and synthetic addresses but no password or key and is written under `.tmp` with owner-only permissions by default.

## Synthetic-only fixture

The seed creates two `example.com` Auth users (guest/host), trigger-generated profiles/private demographics, one approved host application, one public experience and availability slot, one inquiry/thread message, one notification, one pending provider-neutral sandbox booking, and one 1×1 synthetic PNG in the staging `experiences` bucket. The pending booking is only a starting fixture; PortOne, NICEPAY, and PayPal gates must still use their own sandbox/test merchant callbacks and must never accept Production merchant credentials.

Every created identifier is persisted after each step so a partial seed can be cleaned. Cleanup is scoped to the exact state file/project ref and deletes dependent rows, the synthetic object, profiles, and Auth users in reverse order.
