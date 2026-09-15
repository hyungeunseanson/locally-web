# Supabase P0 Storage and RPC hardening

This change narrows the confirmed Production exposure without moving or deleting
Storage objects. Supabase remains the write authority. The immutable historical
baseline remains unchanged; the ordered P0 migration is the current-state
authority for new staging projects and Production.

## Compatibility design

- `chat-images` becomes private. Legacy message images are delivered by
  `/api/inquiries/messages/{messageId}/image`; the caller must be authenticated
  and the existing `inquiry_messages` RLS query must return the message before a
  service-role download occurs. New chat-image uploads remain disabled.
- `admin_files` becomes private. Current `markdown_images/` and legacy
  `chat_images/` objects are delivered by `/api/admin/files/{path}` only after
  the existing admin check. New memo markdown stores the internal route, while
  old public Storage URLs are translated at render time.
- `avatars` stays public for reads. Browser writes require `authenticated`, an
  `owner_id` equal to `auth.uid()`, and a `{uid}/...` key. Existing objects are
  not renamed.
- `images` stays public for reads. New host-profile keys remain
  `profile/{uid}_...`; new community keys are `community/{uid}/...`. Mutation
  policies require the object owner, and owner-only row visibility supports the
  Storage update/delete path without enabling bucket-wide listing.
- `experiences` remains public and keeps its current authenticated upload
  contract. The former global owner update/delete policies are narrowed to the
  `experiences` bucket; a source-authority redesign is intentionally deferred.
- `verification-docs` remains private with its existing owner-path policies.

## Effective Storage role matrix

`service_role` continues to bypass RLS and is used only by trusted server code.
Public-bucket HTTP delivery is shown separately from direct `storage.objects`
policy access.

| Bucket | Anonymous read | Owner write | Other-user write | Admin read | Service role |
| --- | --- | --- | --- | --- | --- |
| `avatars` | public delivery | insert/update/delete in owned namespace | deny | public delivery | allow |
| `images` | public delivery | insert/update/delete in owned namespace | deny | public delivery | allow |
| `chat-images` | deny | no direct policy | deny | only through message authorization | allow |
| `admin_files` | deny | deny unless admin | deny | read/upload/update/delete | allow |
| `verification-docs` | deny | read/insert/update/delete in owner path | deny | unchanged application path | allow |
| `experiences` | public delivery | existing upload plus owned update/delete | deny | public delivery | allow |

## SECURITY DEFINER and public projections

- `check_rate_limit`, trigger-only `handle_new_user`, and unused
  `mark_room_messages_read` are directly executable only by `service_role`.
- `mark_room_messages_read` also receives a fixed `public, pg_catalog`
  `search_path`. No current application callsite exists, so direct end-user RPC
  access is not retained.
- `is_admin_reader` remains executable by `authenticated` because current RLS
  policies call it, and by `service_role`; `anon` and `PUBLIC` are revoked.
- `public_profiles` and `public_host_applications` keep their reviewed public
  projection semantics to avoid breaking the public API. `anon`,
  `authenticated`, and `service_role` receive `SELECT` only; mutation grants are
  removed. Their projected column sets and row filters remain unchanged.

## Rollout and verification

1. Capture bucket visibility, policy/function/view grants, object counts, and
   object bytes read-only.
2. Deploy the application compatibility routes before making private buckets
   authoritative.
3. Apply `20260915141606_p0_storage_rpc_security_hardening.sql` through the
   formal Supabase migration path.
4. Run the read-only current-state contract and Supabase Security Advisor.
5. Verify anonymous direct GET denial for one existing object in each newly
   private bucket without logging its key.
6. Verify authenticated participant/admin delivery through the application,
   and verify public profile projections remain unchanged.
7. Recheck exact object counts and bytes; both must be unchanged.

If an authorized read or current upload flow fails, stop new rollout testing.
Prepare a narrow follow-up migration from the captured pre-change policy/grant
snapshot. Do not restore bucket-wide public writes, delete objects, or modify
application data as a rollback shortcut.

## Source documentation

Supabase documents that public buckets bypass download access controls, while
private-bucket downloads require RLS-authorized download or a signed URL. It
also documents `owner_id` as the supported ownership field and recommends
least-privilege table/function grants. These contracts are encoded in the local
PostgreSQL 17 migration runtime test and the application route integration
tests.
