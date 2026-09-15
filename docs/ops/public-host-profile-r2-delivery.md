# Public host profile media delivery

Supabase remains the source and write authority. The public R2 bucket `locally-public-host-profiles` is a delivery mirror exposed through `https://profiles-media.locally-travel.com`. The application database continues to store the current Supabase URL, and `PublicHostProfileImage` falls back to that exact current URL after an R2 load failure.

## Public inventory boundary

The reconciliation inventory selects the latest `public_host_applications` row per user and then admits only `approved` or `active` rows. It uses `profile_photo` when that value is an exact public `images/profile` URL. Only when the latest public application has no photo does it use the matching `public_profiles.avatar_url`, and then only for an exact public `avatars` or legacy `images/profile` URL. External OAuth images, missing images, exclusions, private review documents, chat/admin files, community attachments, and all other profile rows are outside this mirror.

Each admitted source has two immutable keys under its host namespace: 128px and 256px square WebP at quality 80. The URL hash in the key changes when the authoritative origin changes. A same-URL byte change is not treated as safe: source SHA/provenance checks can report a conflict, but the writer never overwrites the existing key.

The current upload callsites avoid supported same-key replacement: host application photos use timestamped `images/profile` keys, account avatars use a user directory plus sanitized filename with Storage `upsert` left disabled, and the mobile avatar path uses a new random suffix. A future write path that deliberately permits same-key replacement must add current-byte verification before it can use this mirror contract.

## Scheduled and controlled operations

The existing 14:47 UTC GitHub schedule keeps its legacy manifest-PR flow. It discovers new or changed public sources by regenerating the current inventory, creates missing variants, verifies the source snapshot, and requires a human to merge the static manifest PR before a fresh Production build can select the new URL. It does not provide immediate post-upload delivery.

Manual `audit` is metadata-only and loads no R2 credentials. Manual `plan` lists R2, checks metadata, and performs bounded GET/SHA verification of each existing expected derivative; legacy objects may omit newer provenance fields, but their stored SHA must match their actual bytes and any provenance that is present must match the current source/spec. The plan emits only a sanitized digest/count summary. `apply-create-only` requires the exact digest from a fresh plan and may create only the approved missing keys. It never restores from the stale bucket, quarantines, copies, deletes, or repairs metadata. Every create uses `If-None-Match: *`; a racing writer is accepted only after exact byte, header, and provenance verification.

The bounded create-only limits are 256 source objects, 256 MiB of source payload including retry bytes and both verification passes, 512 transform attempts, 512 new derivative keys, and 256 MiB of new bodies. Each missing source download is reused for both sizes, then its SHA/size are checked immediately before mutation and again after mutation under the same cumulative read budget. Existing exact objects are skipped. Conflicts, snapshot drift, R2-state/proof drift, budget exhaustion, pagination/read failures, or unexpected/cross-host URL namespaces fail closed.

The default Production build wrapper owns the exact host profile public base URL and verifies it in generated client JavaScript. Local, Preview, and Canary builds are not connected to the Production profile-media writer by this contract.

## Privacy and removal

The existing exclusion and exact-host purge procedure remains separate. This rollout does not invoke stale quarantine or purge, and the new `avatars` source kind still writes into the same exact `hosts/<public-host-id>/...` namespace, so an approved privacy purge covers both source kinds. Purge, stale retention, and public-cache invalidation require their existing separate authorization.

## Migration status

- **Complete:** public host profile/app-approved source selection; 128/256 R2 reader with current-origin fallback; Production build persistence; conditional-create race protection.
- **Next execution:** the scheduled job generates a manifest PR for later public-host image changes; an operator reviews and merges it, then uses the canonical Production deploy.
- **Parallel observation:** daily reconciliation results, R2 conflicts, unexpected fallbacks, and Supabase egress.
- **Optional review:** a future missed-enqueue or immediate mirror mechanism if manifest latency becomes unacceptable; no Queue is introduced here.
- **Intentionally retained:** Supabase write/source authority, static manifest, manual privacy purge, PostgreSQL Auth/Realtime/booking/payment paths.
- **Later evaluation:** Neon proof of concept after public-media work. D1 is not the first database candidate. Non-financial translation/background work remains a separate execution bundle.
