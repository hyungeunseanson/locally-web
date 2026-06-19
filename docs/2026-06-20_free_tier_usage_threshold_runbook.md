# Free Tier Usage Threshold Runbook

## Purpose

This runbook keeps Locally on the Vercel + Supabase free/minimum-cost path for as long as possible without changing product behavior.

The first assumption for any odd-looking implementation is:

- It may be an intentional free-tier compromise.
- It may be avoiding Vercel Image Optimization transformations.
- It may be reducing Supabase DB reads, egress, or realtime messages.
- It may be preserving a dormant/cutover path for payments or operations.

Do not change storage objects, payment paths, search UX, presence tracking, Cloudflare/R2, or image rendering strategy from this runbook alone.

## Current Console Baseline

Last direct console baseline: 2026-06-18, before public custom-domain cutover.

### Vercel Hobby

| Resource | Baseline | Free threshold | 70% action point | Status |
| --- | ---: | ---: | ---: | --- |
| Fast Data Transfer | 5.29 GB | 100 GB | 70 GB | Safe |
| Function Invocations | 48,250 | 1,000,000 | 700,000 | Safe |
| Fluid Active CPU | 53m 30s | 4h | 2.8h | Watch |
| Image Transformations | 1.3K | 5K | 3.5K | Watch |
| Image Cache Reads | 3.9K | 300K | 210K | Safe |
| Image Cache Writes | 5.6K | 100K | 70K | Safe |

### Supabase Free

| Resource | Baseline | Free threshold | 70% action point | Status |
| --- | ---: | ---: | ---: | --- |
| Cached Egress | 1.708 GB | 5 GB | 3.5 GB | Highest risk |
| Storage Size | 0.241 GB | 1 GB | 700 MB | Watch |
| Database Size | 0.043 GB | 500 MB | 300 MB | Safe |
| Realtime Peak Connections | 5 | 200 | 140 | Safe |
| Realtime Messages | 339 | 2,000,000 | 1,400,000 | Safe |
| Auth MAU | 121 | 50,000 | 35,000 | Safe |

`Grace period is over` means quota exhaustion can become a hard request failure. Treat a resource crossing 70% as an operational stop-and-check, not a nice-to-have alert.

## 70% Response Rules

When any resource crosses its 70% action point:

1. Capture the Vercel/Supabase usage screen and billing-cycle dates.
2. Check whether the increase was caused by a release, admin batch, test run, public traffic spike, or image upload burst.
3. Do not increase Vercel Image Optimization usage as a fix.
4. Do not introduce Cloudflare/R2 as an emergency implementation without a separate migration plan.
5. Do not delete storage objects directly. Produce a candidate list first.
6. If the resource is Supabase Cached Egress or Storage, pause non-essential image uploads until the cause is understood.
7. If the resource is Fluid Active CPU, review function logs and broad admin pages before changing public routes.

## Vercel Image Transformations Investigation

Current rule: do not expand `next/image` usage and do not remove `unoptimized` just to improve LCP. Image Transformations are already a watched resource.

### Likely transformation candidates

These paths include `next/image` usages that may generate transformations because they are not consistently `unoptimized`:

- `app/components/HomeExperienceCard.tsx`
- `app/components/ExperienceCard.tsx`
- `app/search/page.tsx`
- `app/guest/wishlists/page.tsx`
- `app/account/page.tsx`
- Some small avatar/menu/profile surfaces

### Likely intentional free-tier compromises

Treat these as intentional until proven otherwise:

- raw `<img>` for public/remote user images
- `next/image` with `unoptimized`
- direct Supabase Storage public URLs
- decorative or external images that are intentionally not routed through Vercel transforms

### Investigation steps

1. In Vercel Usage, compare Image Transformations day-over-day after each deploy.
2. Check whether increases correlate with home/search/detail image-heavy traffic.
3. Search for `next/image` usage without `unoptimized`.
4. Only after confirming a hot path, consider a pin-point change to raw `<img>` or `unoptimized`.
5. Do not perform a broad image rendering refactor.

## Storage Orphan Cleanup Candidate Investigation

This section is for candidate discovery only. Actual deletion is prohibited without a separate approval.

### Buckets to inspect

| Bucket | Expected purpose | Orphan candidate source |
| --- | --- | --- |
| `experiences` | Experience photos and itinerary images | deleted/replaced experience photos |
| `avatars` | Guest/host profile avatars | replaced profile photos |
| `chat-images` | Guest/host inquiry image messages | deleted or soft-deleted inquiry messages |
| `admin_files` | Team workspace memo/comment files | pruned team workspace content |
| `images` | Legacy/general uploads | old profile/host registration uploads |
| `verification-docs` | Host verification docs | private compliance files; do not delete casually |

### Read-only comparison procedure

1. List storage objects by bucket and prefix.
2. Extract referenced public URLs or storage paths from DB columns.
3. Compare object paths against referenced paths.
4. Mark candidates as `candidate_only`, `protected`, or `unknown_owner`.
5. Do not call `storage.remove`, SQL `delete`, or dashboard Delete during this investigation.

### Reference areas to compare

- `experiences.photos`
- `experiences.image_url`
- itinerary image fields in experience content
- `profiles.avatar_url`
- `host_applications.profile_photo`
- `host_applications.id_card_file`
- `inquiry_messages.image_url`
- community post image arrays
- admin team memo/comment metadata

## Retention Status

### Confirmed in code

- Notification retention route exists at `app/api/cron/notification-retention-cleanup/route.ts`.
- Notification retention RPC exists in `docs/migrations/v3_40_21_notifications_retention_cleanup.sql`.
- Team workspace task/comment retention exists through `app/utils/teamWorkspaceRetention.ts`.
- Team workspace retention RPCs exist in `docs/migrations/v3_40_06_team_workspace_retention.sql`.
- Audit log API is bounded to the latest 100 rows.

### Still needs read-only console confirmation

- Vercel Cron Jobs registration for notification retention.
- Vercel Cron Jobs registration for completion and support alert jobs.
- Supabase logs for retention RPC failures.
- Whether `admin_audit_logs` has a separate retention/prune policy beyond the UI/API list cap.

Audit logs are compliance/operations data. Do not prune them from this runbook unless a separate retention policy is approved.

## Stale Test Update Plan

Do not change these tests as part of this runbook unless explicitly approved. The current goal is to document why they are stale and what the intended update should be.

### `80-public-service-role-contract`

Observed issue: the test still expects the community author route to expose recent `qna` posts.

Current product policy can differ when `COMMUNITY_OPEN=false` or community is content-only/paused. If public author projection is still required but `recentPosts` is no longer part of the active community contract, update the test expectation to assert:

- public profile projection still excludes sensitive fields
- latest-row `public_host_applications` semantics still hold
- community recent-post behavior follows the current paused/content-only policy

Do not treat this as a product blocker until it is compared against the current community policy.

### `145-home-load-error-state`

Observed issue: the test stubs the old Supabase REST path for `public_host_applications`.

Current home loading path goes through `/api/home/experiences`, which uses a server route and cache headers. Update the test plan to stub the current server route failure instead of the old direct REST request.

Expected future test behavior:

- force `/api/home/experiences` to fail
- assert `home-load-error-state` is visible
- keep the retry and `/search` fallback assertions
- avoid relying on direct Supabase REST calls from the browser

## Explicitly Deferred

- Storage actual deletion
- `next/image` expansion
- Cloudflare/R2 implementation
- PayPal or NICEPAY structure changes
- search pagination/limit before 300+ experiences
- search UX redesign
- presence tracker reduction before 100+ concurrent users
- admin/team `select('*')` reduction
- admin bookings `select('*')` reduction
- broad refactors

## Safe Low-Risk Code Change Allowed

Only the admin audit logs API may narrow its selected fields after consumer verification.

Allowed field list:

```text
id, created_at, admin_email, action_type, target_type, target_id, details
```

Consumer verified:

- `app/admin/dashboard/components/AuditLogTab.tsx`
- `tests/e2e/70-admin-audit-logs.spec.ts`

Do not alter realtime subscription payload shape in `AuditLogTab`.
