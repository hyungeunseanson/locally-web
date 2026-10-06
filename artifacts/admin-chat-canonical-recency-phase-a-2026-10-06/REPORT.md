# Admin Chat canonical recency Phase A

Implementation prepared for Draft review; migration remains pending and Production behavior has not been changed. Exact-head Foundation CI is reported by the PR checks and task final response. No Pin, merge, deployment, Production DDL, messages, ACK, status, payment or completion mutation.

## Fresh base and authority

Base: `fa6ce5e5bbc27a22bd66623eea2133e9674432b3`, fetched from origin/main. Audit base: `a616af1c393f960b093a3aee7ae4e21fb5601738`. Drift touched Community media and shared repository infrastructure/current-state; none of the audited chat/inquiry/attention/proxy/phone-followup files changed. Existing Community, Host, Avatar and Financial applied/pending entries are preserved. The original dirty checkout was left alone; implementation uses a separate managed worktree.

Design authority: the completed `artifacts/admin-chat-recency-pin-audit-2026-10-06/` REPORT, ORDERING_MATRIX, EVENT_MATRIX, PIN_DESIGN and EVIDENCE in the original checkout. Phase B design was not implemented or edited.

## Canonical authority and pagination

`list_admin_support_recency` and `list_admin_phone_recency` perform indexed LATERAL latest-message lookup over `coalesce(type,'text') IN ('text','image')`, ordered by `created_at DESC, id DESC`. Deleted and workflow/state messages cannot rank a conversation. Fallback is inquiry creation for Support, proxy creation for Phone. Support tie-break is numeric bigint DESC; Phone is PostgreSQL UUID DESC. Null creation dates sort last. Bigint IDs cross the REST/RPC boundary as text; client comparison preserves PostgreSQL microseconds.

Each RPC returns at most 100 ordered IDs plus `canonical_activity_at`. The APIs restore that exact order after batched SQL IN enrichment. Support status restriction is in SQL; valid Phone exclusion and operational predicates are applied by the existing bounded scan. Phone todo/payment/closed/all, operational predicates and search apply to globally ordered candidates. `filteredPage` counts only matching rows before applying the response offset/limit; it continues beyond 100, with no arbitrary universe cap. The RPC candidate offset is not the response pagination offset. Deep-link selection remains independently fetched.

Support removes needs_reply and resolved priority, retaining badges, AND filters and CS state. Phone uses the same canonical timestamp for `latest_created_at`, including creation fallback. Missing/broken/wrong-owner/duplicate links cannot borrow activity and keep the existing attention label. Existing activity RPCs continue operational ID-order semantics independently.

## Realtime and ownership

Loaded Support rows immediately use the max of their canonical timestamp and a visible INSERT's timestamp, for customer, same-tab admin, second-tab admin and other-admin sends. Shared-attention, unfiltered loaded rows need no extra list GET. Unloaded rows, active filters and an in-flight list get canonical revalidation regardless of unread count. Unique receipts are bounded/deduplicated; 250ms debounce coalesces idle bursts. Membership revision changes immediately on invalidation; stale responses cannot commit; one serialized trailing fetch recovers events during a GET. New filter callbacks do not restart the thread subscription.

Phone preserves shared URL flights, list/detail guards, completion snapshots and onSent. Visible message events trigger one bounded 350ms refresh without relying on loaded links or an attention classification arriving first. An unrelated chat burst can therefore cause one Phone refresh while Phone is active; this is the bounded recovery tradeoff. Invalidations supersede pending list/detail responses immediately. Hidden tabs defer event traffic to visibility/online/SUBSCRIBED catch-up. No publication change or new polling.

Canonical deletion fallback may move backwards while preserving newer operational metadata. The existing thread single-flight, serialized trailing GET, A→B→A ownership, ACK, receipt merging and DELETE tombstones remain intact. Monitor keeps loaded recency, with regression coverage for incoming/outgoing and soft-delete fallback. Its global server pagination remains future hardening outside Phase A.

## Database and rollout dependency

One additive pending migration: `20261006133015_admin_chat_canonical_recency.sql`. It creates two read-only SECURITY INVOKER functions with empty search_path, revokes PUBLIC/anon/authenticated execution, and grants only service_role execution. Existing authorized Admin API checks remain mandatory. No table privileges, RLS, financial RPC, receipt, trigger, follow-up task or parent timestamp write is added.

Index: `(inquiry_id, created_at DESC, id DESC)` over visible messages only. Native PG17 EXPLAIN on 20,000 history messages uses an index-only scan without a history sort, versus top-N sort/sequence scan without the index; sanitized plan metrics are in VALIDATION.json. Existing ACK/reply/completion/activity function definitions are byte-identical in the native fixture before/after migration.

Production migration apply = 0. The new server APIs require this migration before any future application rollout; no fallback to old ordering is introduced. Current-state captured live objects/ledger remain unchanged; the new migration is added only to pending arrays and their hash checker. No blanket pending migration apply is authorized by this PR.

## Required behavior coverage

Native tests call actual RPCs and actual API route/enrichment/filter code with isolated SQL I/O. The fixture deliberately returns IN rows in the opposite order. Browser and React tests load production components/hooks with external I/O isolated. Invalid historical links are seeded with only the local adoption trigger temporarily disabled, then re-enabled. Production is never used as a write fixture.

| Requirement | Evidence |
|---|---|
| 1–2 recent admin/resolved above needs_reply/unresolved | New React comparator test and native Support 1/2 |
| 3–5 loaded incoming, same-tab outgoing, other admin | New React loaded sender variants and canonical POST test |
| 6–7 page2+ customer/admin promotion | New React 75-row recovery and native Support pagination |
| 8 status filtering | Native Support 8 |
| 9 unseen/needsReply/reopened AND | Existing operations suite and native sparse match after 200 candidates |
| 10–11 ACK/status do not rank | Native Support 10/11 and React receipt/status test |
| 12–13 latest/older soft-delete | Native Support 12/13 |
| 14–15 creation, numeric bigint ties | Native and React exact bigint/microsecond tests |
| 16–17 old Phone incoming/admin | Native 130-request promotion and Phone React sender variants |
| 18 all/todo/payment/closed/search | Native Phone 18 and existing workspace/search suites |
| 19 displayed activity | Native Phone 19 and workspace timestamp test |
| 20–22 metadata cannot rank, no Pin, no updated_at ranking | Native Phone 20/22, ACL/object check and diff scope |
| 23 cancellation boundary | Native Phone 23 and existing cancellation workspace tests |
| 24 completion/additional replies | Native Phone 24 and unchanged native followup 30-group suite |
| 25 invalid links | Native missing/broken/wrong-owner/duplicate creation fallback |
| 26–28 global pagination/UUID/unread=0 | Native Phone promotion/ties/model and Phone React recovery |
| 29–30 stale membership/burst | Support and Phone React gated-flight tests: max concurrent list GET=1, one trailing |
| 31–32 A→B→A/detail single-flight | Existing loading/attention/runtime/browser tests |
| 33 hidden traffic | New Support/Phone React hidden tests and existing hidden ACK tests |
| 34–35 second-tab/duplicate safety | Existing audit plus new sender/dedup/gated burst tests |
| 36 N=unseen conversations | Existing Attention PostgreSQL/store/React/browser suite |
| 37 Monitor | New loaded incoming/outgoing/deletion test and existing Admin Chat phase1 suites |

## Validation

See VALIDATION.json for exact suite counts (the 20 new runtime tests are included in the 104-test unit run; full package runs also overlap those unit tests) and performance metrics. TypeScript, changed-file lint, full lint, diff check and Production current-state static contract pass. Full lint has seven existing warnings outside changed files. New recency tests and native PG17 contract are added to Foundation CI. Exact-head CI and Draft PR identity are finalized in the task response; this report does not claim a Production rollout.

PostgREST text projection (`id::text`) preserves bigint identity through IN enrichment: [official casting contract](https://postgrest.org/en/stable/references/api/tables_views.html#casting-columns).
