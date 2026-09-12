# Temporary chat attachment OFF — manual Storage step

Status: **applied to Production on 2026-09-12**. The SQL file is retained only as
the immutable operator record of that separately approved action. Do not rerun it
and do not turn it into an automatic migration.

The application policy is hard-coded OFF in `app/utils/chatAttachmentPolicy.ts`.
Guest/host controls are not rendered; `useChat.sendMessage` rejects File input
before auth/compression/upload; message and first-thread writes reject image
payloads. Proxy-booking comments also reject attachment fields before adapting
the body into a text inquiry message. Legacy `imageUrl: null` text clients work.
Existing message reads, guest/host image rendering and admin rendering are unchanged.

## Production catalog audited 2026-09-12 04:50 UTC

Project: `uhinvcydgzqlpnvieyal` (`locally-web`). `storage.objects` RLS is enabled;
`chat-images` is public, with no bucket-specific size/MIME limits.
All six INSERT policies are permissive; there are **no ALL policies**:

| Policy | Roles | INSERT scope |
| --- | --- | --- |
| Anyone can upload an avatar | public | avatars only |
| Auth Users Upload | public | experiences + authenticated |
| Authenticated Upload | authenticated | images only |
| Authenticated users can upload chat images | public | chat-images + authenticated |
| Only admins can upload files | authenticated | admin_files + admin checks |
| Verification docs owners can upload | authenticated | verification-docs + owner path |

Only the fourth policy permits new chat-images objects. UPDATE/DELETE policies
(including Owner Update/Delete), SELECT policies and other buckets are not changed.
This removes client INSERT permission, not a trusted service_role's RLS bypass.
No current application service-role path uploads chat images; keep privileged keys
server-only. Existing-object UPDATE/DELETE is intentionally outside this OFF step.

## Historical operator procedure — already completed, do not repeat

The following steps document what was executed. They are not an active runbook.

1. The separately approved operator confirmed the target was locally-web Production,
   not a Supabase canary.
2. In that project's SQL editor, run **only these read-only preflight queries**:

```sql
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY cmd, policyname;

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'chat-images';

SELECT count(*) AS object_count,
       COALESCE(sum((metadata->>'size')::bigint), 0) AS bytes
FROM storage.objects WHERE bucket_id = 'chat-images';
```

3. Review every INSERT and ALL policy, including policies whose names do not mention
   chat. If the catalog differs, stop and review updated SQL; do not bypass the
   fingerprint check. Save the preflight output privately. Do not expose image URLs.
4. The operator executed `disable-chat-image-inserts.sql` as one transaction. Its
   **only persistent change** was:

```sql
DROP POLICY "Authenticated users can upload chat images" ON storage.objects;
```

5. Re-run the preflight queries. All other policies and the public bucket must be
   identical; the named policy must be absent. This action does not touch objects,
   although concurrent legitimate activity could change object counts. Verify the
   remaining INSERT/ALL fingerprint using this read-only query:

```sql
SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY policyname), '[]'::jsonb)::text)
FROM (
  SELECT policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND cmd IN ('INSERT', 'ALL')
) p;
-- Expected: 5eadd895fe87f7ec58fdc0c71e8af3d9
```

6. Read an existing image through its existing URL and check existing text chat.
   Do not create Production test uploads/messages. The release is fully OFF for
   ordinary client INSERTs only after both the application deployment and this
   separately approved Storage step are complete. Before that, old clients can
   still upload directly to Storage even though the new application rejects them.

Do not rely on the fingerprint guard as permission to rerun this already-applied SQL.
The original transaction was rollback-safe. Application rollback alone does not
restore Storage uploads.
Do not automatically recreate the old permissive policy: any restoration needs a
separate review/approval and is not the future R2 launch procedure.

## Deferred architecture

After the Cloudflare migration, replace the legacy upload path with private R2:
1280px maximum, roughly 500KB hard limit, participant authorization, per-user/global
quotas, short-lived upload/download authorization, default 7-day retention and
optional 24-hour temporary attachments. No Cloudflare Images transformations for
chat images. That implementation, retention cleanup and orphan deletion are not
part of this temporary OFF PR.

## Offline validation

Run `npx playwright test -c playwright.chat-attachments.config.ts`.
The dedicated config has no global setup, Next server or Production credentials.
API/hook dependencies are in-memory fakes; browser rendering uses fixture messages
with external network requests aborted. Do not run the legacy live-fixture chat
suites with `.env.local` pointing to Production.
