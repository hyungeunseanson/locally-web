# Admin Monitor global canonical recency review

Review-only follow-up to the completed Support/Phone Phase A. Baseline main:
`4ec0d719e1d8f765ab7fa430c5954f2d72ebdc9f`. No Production migration application,
release, business writes, or Pin implementation is part of this PR.

## Problem and resulting behavior

The Monitor API previously selected pages using `inquiries.updated_at DESC, id DESC`.
The client then sorted only loaded rows by `last_message_at || updated_at`. After
50 conversations, an old off-page conversation could receive a visible message
without entering page 1; an administrator message with unread=0 could also fail
to trigger membership recovery.

`list_admin_monitor_recency` now computes each eligible conversation's latest
visible message before global ordering and pagination. Eligibility is type NULL
or type outside `admin`/`admin_support`; visible types are NULL/text/image.
Deleted and workflow messages do not participate. Message selection is
`created_at DESC, id DESC`; no-visible-message fallback is inquiry `created_at`.
Conversation ordering is canonical time DESC then numeric inquiry ID DESC.
ID text and PostgreSQL microsecond timestamps are preserved at the API boundary.

The API restores RPC ID order after unordered IN enrichment. Candidate reads are
bounded at 100 and response pages at 50. Off-page deep-link metadata is returned
as `resolvedInquiry`, separately from page membership and pagination. Support's
operational filters and Phone exclusions are not applied to Monitor.

The client shares only the existing canonical inquiry comparator. Loaded visible
INSERT/send receipts patch canonical time immediately. Unloaded activity triggers
a debounced serialized prefix refresh independently of unread. In-flight stale
responses are invalidated before they can commit; trailing load-more recovery
retains the requested pages. Soft/hard deletion revalidates canonical activity,
including backwards movement; deleted receipts cannot be resurrected by late
INSERTs. Selection, detail request serialization, hidden-tab protection and
existing healthy/disconnected safety intervals are preserved.

## Database and current state

The only new migration is `20261007024725_admin_chat_monitor_canonical_recency`.
SHA-256: `45c0bab11645eddb75edc18f04ab027b9f1e9c253af41f6408855cecfd5a6e26`.
It creates one STABLE SECURITY INVOKER SQL RPC with empty search_path, revokes
PUBLIC/anon/authenticated EXECUTE and grants service_role EXECUTE. It reuses
`admin_chat_visible_message_recency`; no table, column or index is introduced.
Existing RPC definitions and index definition are unchanged in native PG17 tests.

Applied Production evidence stays at 26 migrations. Host, Community, Support/Phone
recency and Community safeupdate hotfix remain applied. Only this Monitor
migration is pending. Fresh-project order includes the already-captured Community
hotfix (which the baseline bootstrap order and assertions omitted) followed by
Monitor. The pending target contract is separate from Production's applied
catalog/ledger contract. The baseline drift-test assertion was also corrected
from 88 to its actual 89 checks; applied evidence and migration bytes were preserved.

## Fresh read-only Production comparison

At `2026-10-07T02:58:41.283564Z`: Monitor count 48; over50=false;
legacy-vs-canonical rank differences 0; independently grouped MAX model vs
lateral canonical model differences 0; first50 membership differences 0; latest
canonical conversation's legacy server rank 1. Ledger: 26; Monitor RPC absent;
Host R2=true; Community legacy_writes_frozen=true. The complete existing
Production current-state SQL contract passed in a read-only transaction.
No IDs, message contents or participant data were exported.

## Performance evidence

Actual baseline/current hook fixtures measure loaded admin INSERT list GETs
0 → 0 and unloaded admin INSERT unread=0 GETs 0 → 1. A 10-event burst during a
list GET produces one trailing GET, list concurrency 1. Selected detail GET
concurrency remains 1. Hidden bursts produce 0 event-driven requests and one
visibility catch-up. Healthy idle safety remains 300000ms, disconnected behavior
is unchanged. There is no browser full-universe fetch or per-message API N+1.

Native PG17 exact RPC-body EXPLAIN with 75 Monitor candidates and 20000 historical
messages uses the existing Index Only Scan for 75 lateral LIMIT 1 probes without
per-conversation history Sort. One global conversation Sort is expected. The
local observed RPC-body execution was 0.184ms; this is fixture evidence, not a
Production latency forecast.

## Required-case coverage

| Request cases | Executable evidence |
| --- | --- |
| 1–2: 48/exact50 | Monitor unit + native API full-page fixtures |
| 3–4: #51 customer/admin unread=0 | Monitor unit membership recovery + native RPC/API |
| 5–6: 75/125 pagination | Unit and native full prefix, no duplicate/gap/order difference |
| 7–11: loaded senders, same-tab, duplicate INSERT | Actual hook INSERT/POST receipt tests |
| 12–14: latest/older soft-delete, hard tombstone | Unit backwards refresh/late INSERT + native deletion fallback |
| 15–17: parent/status/policy, ACK, participant receipt | Distinct unit patches + native actual ACK/read/parent updates |
| 18–21: creation fallback, message/conversation ties, micros | Native ordering/ID selection + common comparator bigint/micro tests |
| 22–24: in-flight ownership, burst, hidden catch-up | Deferred actual hook GET and virtual timer tests |
| 25–26: deep-link, selection | Native separate target + actual hook + Chromium/WebKit Monitor component |
| 27: invalidated load-more retains requested pages | Deferred actual hook 75-row test |
| 28–29: Support/Phone unchanged | Existing canonical unit suites and native regression runner |
| 30: Attention N unchanged | Existing Attention DB/API, shared Sidebar, ACK/browser suites |
| 31: monitoring policy/detail/profile/search boundary | Existing phase1/search/operations suites + Monitor deep-link policy/profile UI |
| 32: no Pin | Single-function migration restriction + native definition/index preservation + diff audit |

Monitor had no Support global-search control on baseline; that UI boundary is
preserved. Existing Support/Phone search suites remain required regression gates.

Local gates: TypeScript, changed-source lint, diff check, 48 canonical unit tests
(28 Monitor + 20 existing), native PG17 32 checks, bootstrap 14 contracts,
current-state drift 89 + static 5, Attention 21 unit + 36 browser cases,
phase1 44 unit, general chat 94 unit + 26 browser contracts + 29 platform contracts,
monitoring UI 16 Chromium/WebKit cases, operations 11 unit + 28 browser cases,
search 1 unit + 30 browser cases. Exact-head Foundation and Chat performance CI
must pass before this review task is complete. The PR remains Draft and unmerged.
