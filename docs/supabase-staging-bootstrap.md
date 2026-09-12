# Supabase staging bootstrap for the Cloudflare functional canary

This repository does **not** contain a complete historical Supabase migration history. The SQL files are operational patches from different releases, and many assume that the base schema already exists. Do not run every repository SQL file alphabetically against a new project.

This change intentionally does not create a Supabase branch/project, connect to Production, dump Production data, or apply SQL. It provides a machine-readable contract, read-only schema inspection/assertion SQL, and synthetic fixture seed/cleanup tools for an isolated staging backend.

## Reproducibility decision

The repository now has an explicit two-layer contract. The immutable `20260912034545_production_schema_baseline.sql` and `production-baseline.manifest.json` reconstruct the 2026-09-09 checkpoint. The current Production contract is that baseline plus `20260912050655_service_concierge_assignment.sql` and the separately approved chat-image INSERT policy removal. `production-current-state.manifest.json` records the current 39-table/44-function catalog without changing the checkpoint artifacts.

The root `supabase_*.sql` files and `docs/migrations/*.sql` remain historical evidence, not an ordered bootstrap. A new empty project uses only the explicit order below. A branch cloned from current Production receives its parent schema and must not replay any migration SQL.

Required schema-only material:

- table columns, types, defaults, generated/identity properties, primary/foreign/check/unique constraints, sequences, and indexes;
- final view definitions and ownership/security options for `public_profiles` and `public_host_applications`;
- every overload, owner, `SECURITY DEFINER`, `search_path`, volatility, and execute grant for application functions;
- final triggers, RLS enable/force state, policies, and table/sequence/function grants;
- Realtime publication membership and replica identity for subscribed tables;
- Storage bucket names/public flags/file limits/allowed MIME types plus final `storage.objects` policies;
- extensions and types referenced by the above objects.

The baseline folds in historical effects through `docs/migrations/v3_40_41_admin_manual_payout_zero_cancellation.sql`. After that checkpoint, apply only the ordered concierge migration and staging-only current Storage overlay described below. Do not alphabetically replay historical patches.

## Required application objects

`supabase/staging/required-objects.json` is the current application object contract derived from `.from()`, `.rpc()`, trigger, Realtime, and Storage execution paths. It separates active concierge dependencies from legacy marketplace compatibility and from the functional-canary minimum.

The canary minimum is:

- tables: the existing Auth/experience/booking/inquiry set plus `service_requests`, `service_bookings`, `service_request_schedule_items`, `service_assignment_history`, and `service_refund_operations`;
- views: `public_profiles`, `public_host_applications`;
- functions: the existing Auth/booking functions plus all eight active concierge RPCs;
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

1. Obtain separate approval for an empty staging project or a data-less branch. Record its exact ref and branch-specific credentials. Never use `uhinvcydgzqlpnvieyal` as staging.
2. Run the immutable baseline and current-state static checkers. Do not export or copy application rows or Storage objects.
3. **New empty project:** apply the immutable baseline, run `baseline-contract.sql`, apply `20260912050655_service_concierge_assignment.sql`, set `locally.staging_target_ref` to the exact staging ref, then apply `post-baseline-current-state-overlay.sql`.
4. **Branch cloned from current Production:** do not replay the baseline, post-baseline migration, or overlay. Run only the read-only current-state contracts.
5. Run `current-state-contract.sql` and `schema-contract.sql`. The former verifies the exact two-entry migration ledger, 39-table/44-function catalog, security boundaries, Realtime membership, buckets, and 15-policy Storage state.
6. Configure branch/project-specific Auth providers/redirects and verify the six empty Storage buckets and policies.
7. Run `npm run supabase:staging:seed` with explicit staging-only environment variables.
8. Feed the printed guest/host IDs, inquiry ID, and image URL into the functional canary runner. The fixture password remains runner-only and is never written to the state file.
9. After testing, run `npm run supabase:staging:cleanup -- <state-file>` and verify no synthetic artifacts remain.

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
