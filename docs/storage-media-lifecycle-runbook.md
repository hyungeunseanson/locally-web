# Media lifecycle operations

The registry is additive and starts with new Experience originals in the existing
R2 bucket. Avatars, host profile originals, community, chat, admin and verification
files keep their current providers, locators and access controls.

| State | Meaning | Next safe action |
| --- | --- | --- |
| pending | Backend registered immutable identity before PUT; business commit has not succeeded | Verify existing bytes and retry upload/finalize; include present uploaded bytes in backup |
| committed | A verified owned asset is referenced by a successfully committed business transaction | Keep immutable bytes; replace through a business CAS |
| tombstoned | Deletion intent is durable and business finalization cannot reattach the asset | Recheck references/pins/policy before any physical operation |

The asset registry records owner, business scope, provider, bucket/key, expected
SHA/size/MIME, idempotency and verification/commit timestamps. Reference rows
track every managed parent link and its digest. Browser roles have no direct
registry/journal CRUD or lifecycle RPC execution. RLS defaults deny. Backend
functions use empty search paths; the trigger-only definer is private and cannot
be called directly even by service_role. Authorization uses authenticated UID
and the database admin helper, never user-editable role metadata.

Experience upload registers pending before conditional R2 create, HEADs and
GETs actual bytes, and returns asset ID plus the existing public URL. Retrying
the same idempotency header with matching bytes uses the same identity. The
browser keeps a per-File/folder/parent token for retries. A failed PUT, HEAD,
request or DB verification leaves a visible pending record. R2 failure returns
an error; it never activates a Supabase fallback writer.

Experience create/edit commits references and managed asset state in the same
DB transaction. Edit uses `media_revision` CAS; stale writers receive a conflict.
URI query/fragment, percent encoding, host casing/default port and dot-segment
aliases are compared by canonical object identity without rewriting locators.
Every managed locator must be owned by the parent's host, match an optional
pending parent, and already have uploaded/verified evidence. Duplicate finalize
keeps the original committed timestamp. Existing unregistered locators remain
readable without being guessed into the registry. Public rendering, immutable
URL/key contract, derivative Queue and media delivery remain unchanged.

Replacement commits the verified new reference before the old asset becomes
eligible. Shared old assets stay committed until their last managed reference
is gone. The reusable `replace_managed_media_reference` RPC validates owner,
expected reference digest, locks asset IDs in order, and supports duplicate
retry. A future avatar/profile/community integration must execute its business
row CAS and this helper in **one database transaction**; invoking it as a
separate network request is not atomic replacement.

Before an Experience parent disappears, a DB trigger removes its managed
references and journals reference-zero assets. The account deletion backend
journals owner intent before dependency/Auth deletion. Partial account deletion
can leave intent while references still exist; references continue to block
physical deletion. Current host-application deletion handles legacy Supabase
locators and does not delete files; no managed host-profile/verification writer
is introduced. Their future consumers must add a matching transactional parent
hook before activation. Verification-document retention has no approved new
policy here, so physical deletion stays disabled.

The journal retains asset/provider/key, expected bytes, reason, reference
evidence, request time, state, attempts, sanitized failure and completion.
`queued` means intent, not deletion success. The reusable executor orders:
authorization/reference check → atomic claim/tombstone → reference-zero check →
GET and actual SHA/size check → physical delete → CDN purge → completion.
`claim_media_deletion` locks the managed row and denies refs, pins, committed
state, missing explicit age/policy or already deleted assets. A failed delete
or purge remains journaled and retryable. The durable adapter records physical
delete before completion; retries can purge an already absent object. Completion
without physical-delete evidence fails. No scheduler or public API invokes
physical deletion in this foundation.

## Operator visibility and pending planning

Run `python3 scripts/backup/media_lifecycle_plan.py` with the backend source
credential in the environment. This only reads managed tables and prints
counts by provider/scope/state, journal state, exclusions and opaque candidate
asset IDs. It has **no apply mode** and never reads a historical object inventory.
Without an approved age, pending objects are observable but none become age
eligible. An explicitly approved `--minimum-age-seconds` produces a dry-run plan;
it still performs no delete. Backup and migration pins exclude assets. Reference
check uncertainty fails closed. No retention duration is invented by the code.

The community fix validates `community/<authenticated Auth UUID>/<sanitized
filename>` before cleanup. Another owner's key, encoded input, traversal or wrong
namespace is denied. Committed/shared URLs are checked across community posts.
DB check failure blocks cleanup. Physical cleanup uses the caller's Storage
session and existing object owner policy, with no privileged backend remove.

## Activation and rollback

Restore destination GETs allow at most one retry of the same immutable key for
429, 5xx, timeouts, connection closure/reset, or endpoint connection failures.
The partial local download is removed before retry. Auth failures, missing
objects, validation, checksum, identity and decryption failures stop immediately.
All ciphertext and plaintext SHA/size checks remain mandatory after retry.

The restore CLI accepts `--summary` for a private sanitized checkpoint outside
the restored plaintext directory. It records the snapshot, opaque object hash,
ordinal, verified object/byte counts, remaining count, missing/SHA counts and
total read retries. Failures preserve allowlisted SDK class, HTTP status,
provider code and retryability; keys, URLs, headers, provider bodies and AGE
identity paths are excluded. Ordinary plaintext cleanup preserves this file.
Storage's daily trigger stays paused until the existing COMPLETE snapshot has
passed a full isolated restore and current authoritative R2 coverage is zero-gap.
Restore hardening does not authorize a new capture or destination probe.

Apply only migration `20261004053224_media_lifecycle_foundation.sql` after the
exact PR head is green and merged. Verify table/RPC ACLs, RLS, business counts and
source inventories. Then build exact main and use the existing candidate0
release process, verify identity/browser/auth and Queue/Cron/settings invariants,
and promote once only after all required checks pass. Configure and activate the
multi-source backup job, run one controlled capture and prove a complete isolated
restore. The implementation report records whether these steps actually passed.

Rollback uses the previous proven Worker version and keeps the additive schema.
Do not remove registry, references or journal records, undo live locator writes,
or turn off existing backup retention. An older Worker can leave new uploads
unregistered again, so record that limitation and resolve before declaring the
foundation active. A failed candidate is not promoted. Historical source
objects are never removed by release or rollback.
