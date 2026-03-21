# Optimization Baseline

## Scope
- Phase 0 baseline for low-risk performance work
- Phase 1 image/render wins
- Phase 2 query payload wins
- Realtime and storage changes are intentionally deferred

## Current High-Signal Candidates

### Image / Render
- `app/account/page.tsx`
- `app/components/mobile/BottomTabNavigation.tsx`
- `app/components/mobile/MobileHostMenu.tsx`
- repeated avatar/card images in guest/host/admin chat surfaces

### Query Payload
- `app/account/page.tsx`
- `app/components/mobile/MobileHostMenu.tsx`
- `app/hooks/useChat.ts`
- `app/api/admin/inquiries/route.ts`
- `app/api/admin/inquiries/[id]/messages/route.ts`

### Realtime / Refetch
- `app/hooks/useChat.ts`
- `app/context/NotificationContext.tsx`
- `app/admin/dashboard/hooks/useAdminChatQuery.ts`
- `app/admin/dashboard/components/Sidebar.tsx`
- `app/host/dashboard/components/ReservationManager.tsx`

### Upload / Storage
- chat image uploads
- profile/host/community uploads
- large original image reuse paths

#### Current Upload Findings
- `app/components/mobile/MobileProfileView.tsx`
  - guest mobile avatar upload was sending the original file while desktop account/profile flows already compress before upload
- `app/host/create/page.tsx`
  - experience hero/itinerary uploads already pass compressed files via preview state and are lower-risk to leave unchanged for now
- `app/host/register/page.tsx`
  - profile/id-card uploads already compress before storage upload
- `app/components/ReviewModal.tsx`
  - review photos already compress before upload
- `app/community/write/PostEditor.tsx`
  - post images already compress before upload
- `app/admin/dashboard/components/GlobalTeamChat.tsx`
  - admin team chat attachments now compress before upload; message/preview flow remains unchanged

#### Next Low-Risk Storage Candidates
- narrow raw image upload on admin/internal tools before touching user-facing experience flows
- audit repeated public original-image rendering paths before introducing thumbnail/derivative policy
- keep storage bucket/layout unchanged until low-risk upload wins are exhausted

## Executed In This Pass
- Converted fixed-size mobile/profile avatar hot paths from raw `<img>` to `next/image`
- Converted additional fixed-size admin/host avatar surfaces to `next/image`
- Optimized fixed-size admin dashboard list thumbnails in `ListPanel` for supported image hosts
- Converted fixed-size admin experience gallery thumbnails in `DetailsPanel` to `next/image`
- Converted the signed admin host-application ID preview in `DetailsPanel` to `next/image`
- Converted the public host profile avatar in `app/users/[id]/page.tsx` to `next/image`
- Converted the guest profile modal avatar in host reservations to `next/image`
- Converted the guest profile modal review-host avatar in host reservations to `next/image`
- Converted fixed-size admin sidebar logos to `next/image`
- Narrowed hot-path `select('*')` queries where the consumed fields are explicit
- Narrowed admin chat, notification, sidebar, and alerts realtime refetch paths without changing user-visible behavior
- Aligned guest mobile avatar upload with desktop flows by compressing before `avatars` bucket upload
- Compressed admin team chat image attachments before `admin_files` bucket upload

## Explicitly Deferred
- schema changes
- caching strategy changes
- upload pipeline redesign
- remaining broader realtime subscription narrowing outside the already-patched chat/notification/admin alert surfaces
- image compression/thumbnail generation policy changes

## Validation Baseline
- `npm run build`
- `npx tsc --noEmit`
- targeted `eslint` on touched files
- targeted Playwright smoke for account / host menu / admin chat
