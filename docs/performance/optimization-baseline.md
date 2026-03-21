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

## Executed In This Pass
- Converted fixed-size mobile/profile avatar hot paths from raw `<img>` to `next/image`
- Narrowed hot-path `select('*')` queries where the consumed fields are explicit

## Explicitly Deferred
- schema changes
- caching strategy changes
- upload pipeline redesign
- realtime subscription narrowing
- image compression/thumbnail generation policy changes

## Validation Baseline
- `npm run build`
- `npx tsc --noEmit`
- targeted `eslint` on touched files
- targeted Playwright smoke for account / host menu / admin chat
