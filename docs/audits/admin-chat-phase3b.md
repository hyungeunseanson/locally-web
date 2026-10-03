# Admin Chat Phase 3B bounded search

Starting main: `3dfb32870c14223649abbc9dd86e9471b3a4faa5`, verified after fresh fetch.

## Architecture decision (before implementation)

A. Per-surface finder in the existing Support and Phone list headers. The repo already separates support inquiries and phone requests and owns their canonical navigation independently. Search spans the current surface regardless of list status/operations filters; this is explicit in the UI. Search results are locator summaries, never a second conversation store. Support result clicks set the existing status filter to ALL before calling `handleSelectInquiry`, so the existing status guard cannot immediately dismiss a result outside that filter. Operations filters are retained. Phone clicks call the existing `select`, retaining inquiryId/proxyRequestId, resolver, thread loading, draft, ACK and realtime ownership.

B. Dedicated authenticated GET `/api/admin/chat-search?surface=support|phone&q=…`. Extending the existing list paths would mix search with their scan/filter/enrichment pagination and realtime refresh dependencies. In particular Phone's old `q` scans 100 requests and enriches each batch before matching; sparse matches can scan the whole database. The new finder never invokes those paths, and removes the UI dependency on old Phone q.

C. One service-role-only, SECURITY INVOKER RPC `search_admin_chat`. Candidate UNIONs search literal case-insensitive substrings of IDs, profile names/emails, experience titles and Phone's existing title/name/order fields. Index-backed relation joins collect IDs, deduplicate, then order exact field matches first and stable ID order (finder only), limit 25 and return only locator summaries. Support uses the same formal-card exclusion, unique request link, customer/type validation as the canonical resolver. No message tables, operational enrichment, counts, row queries, browser downloads, cursor or global list sorting changes. RPC execute is revoked from PUBLIC/anon/authenticated; existing server admin authorization precedes it. New indexes/functions are schema-only; no business data changes.

400ms debounce; minimum 2 trimmed characters (short Korean names and short inquiry IDs; `#1` also supports a single-digit exact ID); maximum 100 characters; fixed 25 results. Every input/surface/active change cancels the previous request immediately, clears old results and invalidates its generation. A version check also rejects responses when a transport ignores abort. Search has no idle timer, realtime channel or automatic retry. Clearing returns to the unchanged list. Two-character substring searches can require scans where trigram selectivity is insufficient; result size and DB round trips are fixed, not a promise of constant SQL CPU independent of data size. Validate representative fixture plans and timings before merge.

## Verification and measured costs

Actual starting-main source and current source run in the same browser fixture, with all I/O intercepted. Both Chromium and WebKit agree:

| Workload | Support before → after | Phone before → after |
| --- | --- | --- |
| Initial list (Phone todo then all) | L1 → L1 | L2 → L2 |
| Select | R1 T1 → R1 T1 | D1 T1 → D1 T1 |
| Connected idle, 10 minutes | L2 T2 → L2 T2 | L2 D2 T2 → L2 D2 T2 |
| Type / query / clear | extra T0 | extra T0 |
| Search result selection | R1 T1, existing path | D1 T1, existing path |

L=list, R=canonical URL resolver, D=Phone detail, T=thread. Idle **additional** requests=0; existing five-minute fallback is preserved. Phone omits its former empty q parameter. Both list route sources are byte-for-byte unchanged from starting main; the Phase 3A real route fixture still measures Support 7→7 and Phone 6→6 DB client operations including authorization. Existing incoming-message/burst/filter/next10 workloads also remain equal to the Phase 3A audit. Search input is never a dependency of the list/detail/thread or realtime effects. A Support result click resets a non-ALL status filter through the existing list path; that list can refresh, while the canonical thread GET remains one.

Search: one API request after 400ms quiet, one SQL RPC, no per-row calls or operational enrichment. The real authorization helper fixture measures one users lookup + one RPC = 2 DB operations when email is absent; normal email-bearing admin sessions also check the existing whitelist, giving 3 operations. RPC returns ≤25 locator summaries with no messages, avatars, form_data or receipts. Tests exercise cancellation immediately on input and clear, ignored-abort late responses, minimum query/no request, rapid queries, empty/error/manual retry and a defensive client cap for oversized responses.

Native isolated PostgreSQL 17 fixture: 20,000 inquiries, 20,000 profiles/experiences, 20,001 requests. Actual migration executes; business inquiry snapshots stay identical. Authenticated and anonymous roles cannot execute the RPC. The service role can. Authorized customer INSERT/UPDATE also remains valid with the new expression index: its pure input-only private title helper grants EXECUTE to table writer roles without adding private-schema/table access. Exact/partial ID, #1, Korean name, case-insensitive email, experience/title, phone UUID/order ID, contact/reservation names, literal %, _ and backslash, stable cap and unique/mismatched/duplicate/anchor link rules pass. Indexed email/experience/phone-title predicates are verified with EXPLAIN. Representative warmed runtimes: Support broad two-character name 114ms, title 2ms, partial numeric ID 35ms; Phone broad title 310ms, email 3ms, UUID 3ms. These are local fixture evidence, not production latency promises. Common/short matches can scan; indexes do not imply constant CPU. API's DB HTTP wait is capped at 10 seconds and browser wait at 15 seconds; abort does not promise instantaneous PostgreSQL query cancellation.

Verification:

- `npx tsc --noEmit`; `npm run lint` (seven existing unrelated warnings); changed-file ESLint has no warnings; `git diff --check`.
- `npm run test:admin-chat:search`: route test + 30 browser tests, including canonical selection/deep-link/draft A→B→A, stale prior A/loading ownership, no duplicate thread GET, desktop/390px scroll and composer bounds. Four search screenshots visually inspected.
- `PHASE3B_BASELINE=1 npx playwright test -c playwright.admin-chat-search.config.ts --grep 'performance idle'`: four starting-main workloads. Parsed before/after request arrays match exactly after removing old empty q.
- `PHONE_NATIVE_MODULES=… npm run test:admin-chat:search:native`: isolated SQL/query/index/privilege tests, no remote credentials.
- Existing `test:admin-chat:operations` (28 browser tests), `test:admin-chat:phase1` (chat performance/platform/loading and 14 admin UI tests), `test:admin-attention:phase2` (36 browser tests), `PHONE_WEBKIT=1 test:phone-followup` (192 browser/route tests), `test:phone-followup:native`, `cloudflare:production-build:contract`.
- Current-state and staging bootstrap contracts register the migration/hash as `prepared_not_applied`; the applied Production ledger/catalog remain untouched. CI runs the new browser/route tests and native SQL test alongside the existing suites. Changed-file review checks auth, literal escaping, summary-only projection, SQL permissions, link classification, stable ordering, abort/generation ownership and unchanged navigation/thread hooks. No unresolved local finding.

The old Phone list endpoint q parameter remains compatible for external callers; the Admin UI no longer uses that batch-scanning search. Removing that API parameter is outside scope.

## Production boundary

No deploy, Cloudflare traffic change, remote DB write or migration application is authorized by this implementation. The migration must be applied through a later release before the search API is deployed. It creates indexes transactionally with a two-second lock-acquisition timeout; index builds take locks and should be scheduled with the normal schema release procedure. No remote migration was applied here.
