# Verdict

ADMIN_CHAT_FULL_AUDIT_AND_IMPROVEMENT_COMPLETE

This audit distinguishes executable evidence, source-derived behavior, and remaining product/capacity work. Production was never used for interactive chat tests: opening an unseen thread would ACK it.

The audit identified and fixed 13 concrete issues (A01–A13). Completion means the audit, safe application changes and stated verification are delivered; it does not mean every capacity/product/configuration follow-up has been implemented.

| Operational question | Conclusion |
|---|---|
| A. Can messages be missed? | Same-admin second-tab INSERT and attachment visibility were broken and are fixed. Very long threads still require cursor loading before the server row cap is reached. |
| B. Can N be wrong? | Exact-ID ACK and late-transaction semantics pass; hidden-tab ACK is now prevented and failed ACK is recoverable. Missed events can temporarily leave counts stale until catch-up. |
| C. Are reply need and admin confirmation separate? | Yes in the current RPC/store contract; phone additional-reply rules remain distinct. Moderation no longer changes participant receipts. |
| D. Does disconnect recovery work? | Simulated reconnect/online/visibility tests pass. Production lacks proxy_requests publication, so request-only changes depend on catch-up until separately corrected. |
| E. Are requests excessive? | Same-main fixture shows no request/concurrency/commit regression. Repeated full earlier pages and server phone scan remain growth concerns. |
| F. Can navigation retain stale conversations? | URL removal/back/forward/surface changes are fixed. Deleted or newly unauthorized selections still need explicit terminal-state UX. |
| G. Is mobile operation usable? | Four viewport fixtures in Chromium/WebKit pass after overflow/header/retry/focus fixes. Physical keyboard/safe-area behavior on a real device is not proven. |
| H. Will thousands of conversations scale? | Not yet guaranteed: global ordering/search and thread cursor loading need bounded SQL contracts. Current counts do not justify virtualization first. |
| I. What would improve daily work? | Global search, separate N/reply filters, waiting-time sort and copyable permalinks have clear operational value; ownership/notes need product/schema decisions. |
| J. Is legacy behavior present? | Redundant INSERT timer state and moderation receipt writes were removed. Existing catch-up and compatibility paths are intentional; unrelated badge helper users remain. |

Evidence was cross-checked in six directions: Git history, current dependency/call graph, authorized API/SQL contracts, Production aggregate/schema/RPC/publication reads, simulated Realtime lifecycle/races, and actual React browser fixtures. Only the aggregate/database metadata inspection used Production. Browser events and SQL concurrency tests were isolated fixtures/local databases.

# Starting main

`da69a033cdc9668b16e05eb1c3f52b812efdba68`, independently fetched on 2026-10-02 before creating `codex/admin-chat-full-audit` in an isolated worktree. Fetched again before publication; unchanged. No PR #160 code, merge, rebase, infrastructure change, or working-copy changes from the user's original checkout were included.

History inspected: #151 (`b9e9fb9d`, auth/profile waterfalls), #152 (`c65f2ebb`, canonical send/deltas/post-save tasks), #153 (`93ee42b3`, write lockdown/reopen), #155 (`c7d37dab`, selected-thread flight ownership), #157 (`f68be260`, attention semantics), #159 (`0c08cfa5`, applied DB contracts), plus phone workspace and message moderation history.

# Final head

The Draft PR head is authoritative (`git rev-parse HEAD` in this worktree). The final delivery records the exact SHA and PR URL; no force push or merge is permitted. Report-only follow-up commits do not replace implementation history.

# Architecture map

| Surface | UI / state | Authorized API | DB / RPC | Events |
|---|---|---|---|---|
| Support | CustomerSupportTabs → ChatMonitor → useAdminChatQuery | `/api/admin/inquiries?view=support`; `/:id/messages`, `/:id/ack`, `/:id/status` | inquiries, inquiry_messages; batched profiles/host_applications; get_admin_inquiry_activity; ack_admin_inquiry_snapshot | inquiry INSERT/UPDATE and message INSERT/UPDATE/DELETE through shared attention + selected-thread channels |
| Phone | PhoneReservationTab → conversation-only ChatMonitor | `/api/admin/customer-support`; existing proxy payment/status endpoints; same messages/ACK | formal proxy_requests excluding card anchors; validated JSON linked_inquiry_id; shared activity RPC | admin-phone-workspace + selected thread + shared attention; **Production proxy_requests publication missing** |
| Monitor | ChatMonitor `view=monitor` | same list/detail/ACK; message moderation PATCH | general/NULL-type inquiries; same activity/ACK; private historical cutover marker | guest/host message events; staff messages excluded from N |
| Shared indicators | AdminAttentionProvider → AdminAttentionStore → both Sidebars / tabs / list N | `/api/admin/sidebar-counts`, scoped conversation/alerts deltas | get_admin_attention JSON aggregate + 5 independent operational counts | messages, inquiries, user-scoped notifications; 250ms coalescing; catch-up |
| Send | useAdminChatQuery canonical response → local buffer | `/api/inquiries/message` → thread/shared.ts | resolveInquiryMessageAccess, INSERT; support row-lock/reopen triggers | notification/email/policy/audit work attached to `after`; ACK reconciliation avoids full GET |
| Participant receipts | guest/host useChat | `/api/inquiries/read` → markInquiryMessagesRead | is_read/read_at; administrator rejected | separate from admin_read_at |
| Images | AdminChatImage | `/api/inquiries/messages/:id/image` | authenticated row/RLS check → private storage download, raster MIME allowlist | no public storage URL is exposed |

Additional call graph inspected: adminAccess/adminAccessClient, privateStorageDelivery, inquiry.ts, chatPolicySignals, profile.ts, officialSender, adminInquiryActivity, adminChatTime, adminSupportUnreadAlerts, proxyBooking, phoneReservationWorkspace, customer-support/queries, AdminAlertsTab, admin layout/tabRouting, send notification helpers and migrations. Infrastructure adapters were read only as necessary to verify deferred send contracts.

# Existing feature inventory

Statuses describe the starting main. “Fixed” identifies this PR's action, not a claim that every possible future scenario is guaranteed.

| Feature | Current status | Evidence | Problem | Action |
|---|---|---|---|---|
| Support customer identity/title/experience/preview/time | EXISTS | ChatMonitor; inquiries GET enrichment | No dedicated conversation title in list payload; experience or generic label | Preserve; search proposal below |
| Support N | EXISTS | AttentionBadge; get_admin_attention | Conversation count, independent of reply/status | Preserve |
| Needs reply / elapsed wait / last sender / reopened | EXISTS | get_admin_inquiry_activity; adminChatTime | Prioritization is only within loaded pages | Capacity follow-up |
| Open/in-progress/resolved filter | PARTIAL | ChatMonitor filteredInquiries | Filter ran after first 50 fetched rows | Fixed: server status predicate before pagination, NULL treated as open |
| Policy indicators | PARTIAL | latest list preview detector; per-message API detector | List preview and thread history represent different scopes; stale flags possible after a new preview | Clear deleted message signal on delta; broader policy consistency follow-up |
| Guest/host/staff message identity | EXISTS | inquiry.ts + messages route | Client classification uses participant IDs; DB attention uses staff lookup | Preserve; no identity-policy redesign |
| Deleted messages | PARTIAL | moderation PATCH; UPDATE handler | Moderation wrote participant receipts; PK-only hard DELETE ignored | Both fixed; tombstone prevents stale GET resurrection |
| Image receive/display | BROKEN | messages API returned private URL; ChatMonitor only rendered content | Operators could not inspect submitted image | Fixed: bounded image, authenticated link, failure retry |
| Image send | MISSING | admin text-only composer; attachment-off contracts | Product-wide attachment send restriction | Preserve; no new upload policy |
| Message timestamps/date divider/KST | EXISTS | adminChatTime; browser timezone tests | Phone list uses browser timezone | Phone timezone standardization follow-up |
| Send / draft retention / IME guard | EXISTS | canonical send + draftsByInquiryId | One component-wide send lock; unknown outcome has no idempotency key | Preserve; retry/idempotency design follow-up |
| Same administrator sends in second tab | BROKEN | INSERT ignored currentUser sender | First tab missed a legitimate reply | Fixed: canonical own INSERT delta; no full GET |
| Status transition/CAS/reopen | EXISTS | status route + private support triggers | UI still refreshes list after explicit status action | Preserve concurrency contract |
| Participant profile modal | BROKEN | closing state persisted across openings | Reopening could remain invisible; no focus containment | Fixed: scoped mount, focus trap/return, named close button |
| Exact ACK / error recovery | PARTIAL | successful rendered snapshot → exact IDs | Failure silently retained N; hidden tab could ACK | Fixed: visible retry, per-attempt guard, no hidden-tab ACK |
| Phone payment/status/menu | EXISTS | PhoneReservationTab, PhonePaymentDetails | External request updates not published in Production | Configuration follow-up; no production write |
| Phone valid linked inquiry / anomaly handling | EXISTS | validLinkedRequest/enrichPhoneRequests | Exactly one same-customer support link required | Preserve; production anomalies counted read-only |
| Phone needs_reply / needs_attention | EXISTS | phoneReservationWorkspace | Additional replies for completed/cancelled have special time boundary; not equivalent to generic support needs_reply | Preserve |
| Phone search/filter/pagination | EXISTS | customer-support GET/filteredPage | Server scans batches; poor worst-case scaling | SQL search/paging proposal |
| Phone metadata refresh | BROKEN | requestFlights shares GET | Invalidation while GET pending reused stale snapshot without trailing read | Fixed: serialized coalesced revalidation |
| Phone detail failure | PARTIAL | toolbar error branch | Mobile list hidden; no retry in visible detail | Fixed |
| Monitor baseline/current N | EXISTS | private.admin_monitor_cutover; exact snapshot RPC | No historical rebaseline allowed | Read-only verified 40/410 unchanged |
| Customer Support tabs / Sidebar counts | EXISTS | shared provider/store, aria-current | Counts can be stale until bounded fallback on missed events | Preserve; no new polling |
| Direct inquiry/phone links | PARTIAL | resolver + selection query | Resolver unbounded; invalid IDs yielded database errors | Fixed: timeout/retry and numeric inquiry validation |
| Browser back/forward / URL removal | BROKEN | replace navigation; no clearing when inquiryId removed | URL could show list while previous conversation remained selected | Fixed: push history + clear on URL/surface transition |
| Selected detail across list refresh | EXISTS | mergeMonitorInquiry and selected ref | Deleted inquiries not explicitly dismissed until detail fails | Follow-up listed below |
| Mobile list/detail/back | EXISTS | fixed mobile detail; phone responsive split | 768px minimum list width/long URLs could overflow | Fixed: flexible widths, min-width containment, wrapping, safe-area composer |
| Keyboard list navigation | BROKEN | clickable div rows | Not keyboard-focusable | Fixed: native buttons and current selection |
| Loading/error announcements | PARTIAL | ChatMonitor | Missing status/alert semantics | Fixed on thread/error/filter/composer controls |
| Assignment/internal notes/tags/bulk actions | MISSING | no related model/UI | Product and permission decisions required | No schema introduced |
| Legacy badge utilities | LEGACY | adminBadgeState.ts callers | Team/ledger still use localStorage helpers; no longer chat N source | Retain unrelated callers; do not delete blindly |

# Bugs found

| Severity / ID | Exact reproduction | Root cause / user impact | Affected files | Disposition |
|---|---|---|---|---|
| P1 A01 | Same admin signs in to two tabs; send from tab B while A has thread open | Current-user INSERT was ignored; A misses reply and may answer twice | useAdminChatQuery | Fixed, duplicate INSERT test |
| P1 A02 | Load monitor message with is_read=false/read_at=NULL; moderate it | PATCH set participant receipts to read even without participant viewing | messages/[messageId]/route.ts | Fixed; exact outbound write assertion and native receipt checks |
| P2 A03 | PK-only DELETE arrives during delayed selected GET | No DELETE listener; old GET could restore removed content | useAdminChatQuery | Fixed; local tombstone + stale response regression |
| P2 A04 | Open image message | API provides image URL but UI prints text placeholder | ChatMonitor/AdminChatImage | Fixed; 4 viewports, image failure/retry |
| P2 A05 | Open/close/reopen profile, then Tab/Escape | Persisted closing=true; focus outside modal | ChatMonitor/profile modal | Fixed, Chromium/WebKit reopening and focus |
| P2 A06 | Open A, browser back to no inquiryId; phone/support switch | URL and selected React state diverged | ChatMonitor | Fixed; push/back/forward/UI tests; drafts retained in same component |
| P2 A07 | Offline/hung inquiry resolver or 500; phone detail 500 at 390px | No resolver deadline/retry; hidden phone list leaves no retry | CustomerSupportTabs/PhoneReservationTab | Fixed |
| P2 A08 | Desired support status exists only beyond the loaded first page | Browser filter ran after API pagination | inquiries GET/hook/ChatMonitor | Fixed: DB predicate; invalid input 400 |
| P2 A09 | Initial phone metadata GET captures pending; status changes before response; online/Realtime invalidation shares that GET | No trailing metadata request; old status remains until next event | PhoneReservationTab | Fixed; delayed-response browser test asserts exactly 2 serial GETs |
| P2 A10 | ACK returns 500; unrelated list metadata rerenders | Silent failure and opportunistic duplicate attempts; no direct recovery | hook/ChatMonitor | Fixed: retry control, one attempt per snapshot-load/explicit retry; late A failure cannot erase B retry; N retained |
| P2 A11 | Selected hidden browser tab receives unseen message | Successful render in hidden document qualified for ACK | useAdminChatQuery | Fixed: visible-document guard; resume loads and ACKs |
| P2 A13 | Leave Alerts while initial GET is pending, then resolve it | Init resumed after unmount and created an orphan channel | AdminAlertsTab | Fixed; delayed GET/unmount browser test |
| P3 A12 | Tab through list, inspect state buttons; 768px long URL | Div rows; no filter pressed state; fixed list min width | ChatMonitor | Fixed; button/current/pressed/label/status semantics and wrapping |
| P2 F01 | Change only proxy_requests in Production from another session | Table absent from supabase_realtime; subscribed socket is not evidence of delivery | Production publication + phone listener | Follow-up; configuration mutation forbidden |
| P2 F02 | Thread grows past PostgREST row cap | Messages query has no explicit pagination; oldest ascending slice can hide newest content | messages GET + hook | Follow-up: thread cursor/loading contract; current max=43, not currently triggered |
| P2 F03 | Thousands of inquiries, matching phone query near end | filteredPage rescans/enriches 100-row batches; support attention-first sort only local page | list APIs / filteredPage | Follow-up SQL reader/cursor/index contract |
| P2 F04 | Network request never settles for send/status/payment | Mutation fetches lack application deadlines; blindly retrying can duplicate send/payment | send and phone action paths | Follow-up: explicit unknown-outcome/idempotency contract; no automatic retry added |
| P3 F05 | New preview has different policy signal or sender; old list flag remains | Attention activity patches content but does not recompute list policy flag | hook/list enrichment | Follow-up: canonical policy summary contract; deleted message flags corrected |
| P3 F06 | Phone admin outside Korea | Phone toLocaleString lacks fixed timeZone while support uses KST | PhoneReservationTab | Follow-up formatting consolidation |
| P3 F07 | Selected inquiry deleted, or permanently unauthorized during background refresh | List missing row preserves selected object; background failure mostly toast | hook | Follow-up explicit tombstoned/unauthorized selection UX |

Four focused tests were executed against `git show da69a033` before changes and failed on the original implementation (own INSERT, DELETE/stale GET, empty-thread failure, moderation receipts), then passed after the fix. The later visibility test also guards the hidden-tab case. No P0 found within the tested paths; that is not a claim of exhaustive security proof.

# Race-condition audit

| Required case | Evidence / result |
|---|---|
| 1. N1 → render → exact ACK → N0 | actual React/Chromium/WebKit + actual route fixture + local PostgreSQL; passes |
| 2. GET fails, N retained | Phase 1/loading tests; no rendered snapshot → no ACK |
| 3. ACK fails, N retained | Phase 2 browser test; new explicit retry does not GET thread |
| 4. higher ID during ACK | independent native transaction remains unseen after commit |
| 5. lower ID late commit | independent native transaction absent from exact IDs remains unseen |
| 6. same snapshot reload | successful snapshot cache suppresses duplicate ACK; failed attempt can retry on fresh GET |
| 7. delete during ACK | native soft-delete lock contention; exact receipts unchanged; PK-only deletion/stale GET unit test |
| 8. admin own INSERT | PostgreSQL excludes staff from N; new second-tab delta test |
| 9–10. another admin / two tabs | two concurrently open Chromium/WebKit pages share delayed canonical ACK responses; independent native concurrent ACKs serialize safely; store revision tests reject stale counts |
| 11. ACK UPDATE burst | existing real provider tests and benchmark: no additional thread/list GET |
| 12. missed event + visibility | browser and provider tests re-read canonical state |
| 13. offline arrival → online | no socket arrival simulated; online event fetches state in browser/provider tests |
| 14. sleeping/resume | visibility/online/reconnect ordering simulated; no physical OS sleep or real mobile suspension claimed |
| 15–16. A→B→A; delayed A after B | #155 tests retain owner identity/flight sharing/trailing refresh; no requestVersion-only replacement |
| 17. resolved/reopened concurrently | native row-lock both orders, stale CAS rejected, historical repair tests |

Production concurrency writes were **not** performed. Browser Realtime tests deliver realistic INSERT/UPDATE/PK-only DELETE/status events through an isolated client boundary; they do not prove network/socket delivery in Production. Local PostgreSQL tests use independent native connections, whereas PGlite tests cover schema/permissions and sequential state invariants.

# N / ACK correctness

N counts distinct conversations with non-staff, non-deleted messages whose admin_read_at is NULL. It is not a message count, needs_reply, payment state or notification count. Support + phone + monitor partition by exactly one valid same-customer formal phone link. Sidebar and tabs derive counts from one user-scoped store; no chat ACK state is written to localStorage.

The current client sends exact rendered message IDs plus throughMessageId. The exact-ID RPC handles late lower IDs; the old through-ID compatibility RPC remains for rolling clients and is **not** the current client path. A successful GET is read-only. React must commit the matching selected snapshot, without error/loading and in a visible document, before ACK. Failed ACK leaves the canonical count unchanged. Captured store revisions reject stale ACK results after newer Realtime observations. Soft deletion now leaves both participant receipt columns unchanged.

READ ONLY Production verification: exact RPC definitions match the Phase 2 contracts; anon/authenticated cannot execute the privileged activity/attention/ACK RPCs; receipt and reopened columns exist. Cutover marker remains 40 conversations/410 messages at `2026-10-02T07:51:49.802096Z`. No migration or baseline reapplied.

# Realtime audit

| Owner/channel | Inputs | Reconciliation | Lifecycle / limitations |
|---|---|---|---|
| AdminAttentionProvider `admin-attention-{userId}` | all inquiry_messages/inquiries; user-filtered notifications | 250ms scoped batch (100 IDs max); PK-only unknown delete triggers catch-up | cleanup removes channel/listeners/timer; SUBSCRIBED/online/visible + existing 5-minute fallback |
| useAdminChatQuery `admin-chat-monitor-{view}-{conversation/list}` | message INSERT/UPDATE/DELETE; inquiry UPDATE | current-admin INSERT and existing-row UPDATE deltas; selected other-sender INSERT coalesces one thread GET; deletion tombstone | enabled/currentUser controls subscription; cleanup removes timers/channel; current health status drives existing 60s disconnected/300s healthy catch-up |
| Phone `admin-phone-workspace` | proxy_requests all; relevant message INSERT / deleted UPDATE | 350ms schedule; shared GET + new serialized trailing metadata catch-up | inactive removes channel/listeners; stable refresh callback avoids resubscribe on every query; existing 5-minute safety catch-up |
| AdminAlertsTab | own admin notifications | insert/update/delete list deltas; shared attention alerts refresh | initial auth/load + subscription; 5-minute/online/visible catch-up; channel cleanup |
| Participant useChat / notification context | participant channels | independent participant delivery/receipt behavior | inspected and covered by existing chat regression; not rewritten |

CHANNEL_ERROR/TIMED_OUT/CLOSED set selected-thread health false; provider/phone rely on retrying SDK + existing slow fallback and visibility/online, with no explicit degraded-connection UI. No new cron or polling was added. The old insert de-duplication Set and per-event 1.5s timers were removed: canonical Map upsert and burst timer already coalesce duplicates, without unowned timer tails. Continuous high-volume events can postpone trailing-edge debounce; consider bounded max-wait and broadcast summaries at significantly larger volumes.

# Phone audit

Production: 87 formal requests, zero missing links, zero nonexistent inquiry links, zero wrong-user links, zero duplicate link groups at inspection time. This does not replace fail-closed code: duplicate/wrong-user/missing links remain support-visible and phone attention-labelled; no per-row database lookup was introduced.

Phone workspace action needs_reply intentionally differs from the generic activity RPC: completed customer follow-up, or cancelled customer message later than cancellation, produces “추가 답장.” Cancellation boundaries with missing/old timestamps fail closed as existing tests specify. Payment waiting/paid/refunded/failed and complete/cancel/refund menus are unchanged. Explicit payment/status changes still use existing authorization endpoints and confirmations. No live payment action was invoked.

Phone list/detail request sharing is preserved and now revalidates after invalidations that overlap an old response. Linked message #155 loading/ACK lifecycles remain independent. Metadata failure now offers a visible mobile retry. Missing proxy publication is a deployment/configuration follow-up, not disguised with more frequent polling.

# Monitor audit

43 current monitor conversations; one unseen during inspection. Guest and host messages are eligible; staff/deleted rows are excluded. Historical rows stay baselined, including rerun/backdated cases covered by Phase 2 tests. Admin viewing never calls participant read API. Moderation preserves receipts; soft deleted placeholders and private image removal remain in place. Hard DELETE handles PK-only payloads and prevents in-flight resurrection. Message deletion retains N for unacknowledged surviving messages.

High-volume limitations: full selected-thread GET on incoming non-own burst, no message cursor, one global message subscription per active hook plus shared provider. These are deliberate existing contracts at the observed scale, not limitless throughput guarantees.

# Navigation / deep-link audit

Direct inquiryId resolves support/phone/monitor through authorized lookup; old phone links become proxyRequestId. Invalid numeric IDs now return 400, absent inquiries 404, unauthenticated/non-admin 401/403. Phone detail filters card anchors and uses validated links. The resolver now expires after 15s and exposes retry. Aborted old resolution cannot change a newer route.

Conversation selection pushes history; browser back/forward and removing inquiryId clear/restore selected state. Surface changes clear selection without remounting the entire chat and losing drafts. A→B→A request ownership remains from #155. Filter changes clear an incompatible selected support conversation; canonical list refresh preserves the selected object until a replacement arrives. A selected inquiry deleted server-side still needs dedicated removal UX (F07). Phone back preserves its draft/search/filter per existing browser test.

# Search / filter / sort audit

| Capability | Support / monitor | Phone | Decision |
|---|---|---|---|
| Customer name / email | MISSING | EXISTS server-side literal includes | Extend via authorized SQL search contract; no browser full download |
| Message content | MISSING | PARTIAL latest preview displayed, not searched | Full-history search needs scoped SQL result/pagination semantics |
| Inquiry title / experience | MISSING | request title EXISTS | Support has no dedicated title in current payload; define search fields |
| Inquiry ID / request ID | deep link only | request/order ID search EXISTS | ID quick lookup/permalink has clear value |
| N-only / needs-reply / reopened | MISSING | todo combines workflow conditions, not N | Separate predicates, never overload N |
| Open/resolved | PARTIAL → fixed server predicate | todo/payment/closed/all EXISTS | Existing support control now searches all matching rows |
| Guest/host/experience/date/policy/image filters | MISSING | MISSING except payment/status groups | Operational filter design + SQL pushdown |
| Newest activity | PARTIAL: loaded rows sorted after reply/resolved priority | request created_at descending, latest activity only displayed | Preserve existing meaning; explicit sort selector follow-up |
| Oldest waiting/longest unanswered/newest unseen/reopened-first | MISSING | MISSING | Needs a global DB ordering contract before pagination |

Phone search trims/lowercases and limits q to 200 characters; literal includes treats `%`, `_`, quotes and punctuation literally. Existing 121-row fixture verifies old matches beyond the first batch. No browser-side full dataset search was added. Status filter query validation is allowlisted. Status filter state is local, not encoded in URLs; back/forward restores conversation navigation, not an arbitrary history of filter changes.

# Mobile audit

Actual React/CSS fixture in Chromium and WebKit at 390×844, 430×932, 768×1024 and 1280×900. Keyboard selection, long Korean/Japanese/English URLs, private images, profile reopening/focus, visible composer and document horizontal overflow are asserted; screenshots are generated. Existing 375/390/767/768/1280 chat-layer tests cover mobile sidebar stacking. Phone layouts also retain 390/2048 coverage.

Changed: list width no longer forces 400px at tablet; detail has min-w-0; long message tokens wrap anywhere; composer accounts for bottom safe area. Native on-screen keyboard/VisualViewport and a real iOS device were not exercised. Small operational font sizes, touch target density and maintaining previous scroll position across arbitrary selection remain usability follow-ups. Existing near-bottom guard avoids jumping while reading older messages; selection scrolls to latest.

# Accessibility audit

Fixed native list buttons, selected aria-current, status aria-pressed, composer name, thread loading/error announcements, profile focus containment/return, named modal close, and repeat opening. N retains explicit “관리자 미확인 새 메시지” label and is not color-only; current sidebar/tab controls already use aria-current. These are navigation buttons inside labelled nav, not incomplete role=tab widgets.

Remaining: mobile sidebar focus containment/Escape behavior and AdminAlerts clickable-card keyboard design are broader shared navigation issues; automated tests do not substitute for screen-reader user testing. No claim of WCAG certification.

# Error/loading audit

| Failure | Current result |
|---|---|
| List/selected GET 400/401/403/404/500/network/15s timeout | bounded read errors; selected loading settles; failed snapshot not ACKed; retry available |
| Deep-link resolver stalled/500 | fixed 15s deadline and retry; wrong response cannot reroute after abort |
| Empty selected thread catch-up fails | now persists error + retry instead of empty silent view |
| ACK fails | N retained, warning + explicit retry; no success inferred from rendering |
| Phone detail fails | visible detail retry at mobile widths |
| Profile enrichment fails | detail route fails as a whole for participant metadata; list/sender secondary enrichment can fall back to unknown; partial availability not surfaced separately |
| Image missing/unauthorized/unavailable | accessible failure and retry; private URL remains authorization-gated |
| Realtime disconnected/missing publication | existing reconnect/visibility/online/fallback; no dedicated connection health UI |
| Count read fails | store preserves previous snapshot and Sidebar reports error; initial counts may be unavailable rather than known zero |
| Mutation send/status/payment never settles | F04 remains; needs unknown-outcome/idempotency design rather than automatic retry |

Read loading lifecycle is bounded; **not every async path is proven unable to hang**. Mutations without deadlines and auth transport delays remain explicitly recorded. Full HTTP failure combinations were not exhaustively replayed for every route: route guards, representative network/500/timeout paths and existing contract suites provide the stated coverage.

# Performance

Production READ ONLY observations on 2026-10-02 (live counts, not expected constants): 143 inquiries / 1,381 messages. Nonempty thread length max 43, p50 7, p90 21, p95 31. Support 13, phone 87, monitor 43. N: support 0, phone 10, monitor 1, total 11. Generic support needs_reply among phone-linked inquiries is **not** the phone workspace's additional-reply count. Status: support-type resolved 59, NULL 18, in_progress 3, open 20; general NULL 43.

`EXPLAIN (ANALYZE, BUFFERS)` on read-only get_admin_attention(NULL): 15.421ms execution, 2,800 shared hit blocks, zero shared read/dirtied/written blocks for that execution. This single warm read is not a latency percentile or load test.

Same actual-route fixture compares pinned starting main to final source, including shared provider, ACK updates and DB/RPC call counters. Idle is deterministic **10 minutes of virtual timers**, not a 10-minute live Production observation. Baseline legacy/hotfix measurements remain alongside the new starting-main baseline.

| Scenario | API before/after | List GET | Thread GET | Attention GET | ACK | Internal DB/RPC | Max concurrent API | React commits |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Idle 10 min | 6 / 6 | 2 / 2 | 2 / 2 | 2 / 2 | 0 / 0 | 44 / 44 | 3 / 3 | 4 / 4 |
| 1 incoming message | 4 / 4 | 0 / 0 | 1 / 1 | 2 / 2 | 1 / 1 | 18 / 18 | 2 / 2 | 4 / 4 |
| 10-message burst | 4 / 4 | 0 / 0 | 1 / 1 | 2 / 2 | 1 / 1 | 18 / 18 | 2 / 2 | 4 / 4 |

Own canonical INSERT/duplicate INSERT adds zero thread GETs. Phone invalidation during an old GET now deliberately performs **one serialized trailing GET**; this corrects stale state, not an unconditional request increase. ACK retry performs no thread GET. Image viewing naturally adds one authorized image request per image.

Growth assessment: no virtualization warranted for current max 43 messages / 50-row list pages. Existing `(inquiry_id,id DESC)` and partial unseen indexes support activity/ACK. Thousands of rows justify SQL-side search/status/activity order and cursor paging before virtualization. Phone/server batch scan is bounded per query but unbounded in total scanned batches. List “load more” reloads earlier pages; global waiting-order guarantee and thread cap must be solved before promising thousand-conversation performance. Detail route also repeats participant/sender profile batch queries; avoid another invasive optimization in this correctness patch.

# Dead code / legacy findings

Removed redundant INSERT event Set and 1.5s expiry timers; the actual Map/coalesced refresh paths are idempotent without them. Removed moderation's obsolete read-receipt write. No active 30-second chat polling found. The existing 60s disconnected / 300s catch-up timers are intentional safety nets and remain.

`adminBadgeState.ts` is not safe to delete wholesale: TeamTab and MasterLedger still write/read scoped browser state; obsolete count helper exports have no chat callsite. Sidebar `admin_active_tab` is a navigation preference, not shared admin N. Compatibility fallback after old send response and through-ID ACK remain intentional deployment compatibility, not removed speculatively. No Vercel deploy/secret/runtime migration work performed.

# Implemented improvements

- ChatMonitor: keyboard list buttons, URL navigation/deselection, server status filter wiring, image view/retry, ACK retry, error/status labels, tablet/wrapping/safe-area fixes, profile lifecycle/focus.
- AdminChatImage: isolated authenticated attachment presentation/failure retry.
- ChatParticipantProfileModal: contained keyboard focus, restored trigger, named close.
- CustomerSupportTabs: bounded abortable resolution and retry; abort guards.
- PhoneReservationTab: serialized metadata catch-up and visible detail retry.
- AdminAlertsTab: do not create a subscription after unmount during initial load.
- useAdminChatQuery: canonical own INSERT; PK-only DELETE/tombstone; empty-thread error recovery; bounded attempt tracking/explicit ACK retry/visible-only ACK; status query; remove redundant timer state. #155 flight logic unchanged.
- inquiries route: validated ID/status query and database-side status predicate.
- message moderation route: preserve participant receipts.
- Tests: audit unit/browser cases; same-main performance counters; native independent-connection ACK races; future isolated moderation E2E receipt expectation; audit tests included in existing Phase 2 CI command.

# Recommended next features

These are categories, not formal scores or rankings.

| Category / feature | Impact | Complexity | Schema requirement | Risk | Performance impact |
|---|---|---|---|---|---|
| Low effort / clear operational value: copy ID/permalink | Faster handoff | Low | None | Low | None |
| Low effort: fixed phone KST / better empty wording | Fewer timezone mistakes | Low | None | Low | None |
| Low effort: visible refresh/connection age | Operators know when stale | Low–medium | None | Low | No extra polling required |
| Medium product work: global search name/email/title/experience/ID | Find old conversations | Medium | Authorized SQL reader/index likely; no new business entity | Query scope/privacy, paging | Reduces scans when indexed |
| Medium: N-only/needs-reply/reopened/policy/date/image filters | Triage backlog | Medium | RPC query contract; existing columns mostly enough | Must preserve distinct meanings | Push predicates before paging |
| Medium: newest/longest waiting sort | SLA workflow | Medium | Global SQL order/cursor | Avoid moving/losing selected thread | Better bounded pages |
| Medium: canned responses | Faster common replies | Medium | None for static approved copy; shared editable templates need persistence | Customer-visible wording/locale | Negligible |
| Medium: shortcuts/next-unseen navigation | Keyboard operation | Medium | None | Focus/unsent drafts | No preloading all threads |
| Requires product/schema decision: assignment | Ownership clarity | Medium–high | Assignee/history/permissions | Reassignment races | Indexed queue reads |
| Requires decision: internal notes/tags | Context without customer disclosure | Medium–high | Separate private tables/access | High leakage risk if mixed with messages | Batched detail reads |
| Requires decision: bulk actions | Backlog operations | High | Audit/idempotency/permission contract | Destructive/hidden ACK semantics | Bounded jobs, not per-row browser calls |

# FOLLOW-UP CANDIDATES

1. Production owner review of missing proxy_requests publication; proposal only, verify RLS/event payloads and staging before any approved change. No SQL applied here.
2. Cursor-based newest-thread window + older-message load, exact ACK of displayed IDs, retained selected-thread flight ownership. Test >1,000 messages before release.
3. SQL list/search reader: allowlisted status/N/reply filters, stable tie-break ID, global activity/wait sort before pagination, literal escaped search; cancellation/stale-response and 10k fixture tests. No full browser download.
4. Mutation deadlines with explicit unknown outcome, request idempotency keys, canonical reconciliation before retry; particularly payment and send.
5. Canonical policy summary freshness, partial profile error handling, deleted/unauthorized selected inquiry UX, sidebar/Alerts keyboard improvements.
6. Assignment, private internal notes, tags, bulk actions require separate product/schema decisions and threat/permission review. No new business workflow assumed.

# Tests

Local Node 24.20.0; dependencies installed with repository CI's `--legacy-peer-deps` lockfile mode. Initial default npm ci under Node 22/npm10 reported existing peer lock mismatch; switched to the pinned runtime/mode without editing the lockfile.

- Starting-main focused bug reproduction: 4 failures expected; fixed tests pass.
- `npm run test:admin-chat:phase1`: 44 Phase 1/#155 + 94 chat unit tests, 26 chat contracts, 29 platform contracts and 14 Chromium/WebKit layout tests passed.
- `npm run test:admin-attention:phase2`: 21 unit/contract/performance tests and 36 Chromium/WebKit real-component tests passed, including simultaneous browser tabs and unmount during initial Alerts loading.
- Phone workspace: final 87 tests passed, including after trailing-metadata changes.
- Native local PostgreSQL: historical repair, row-lock status races, late-ID and dual-admin ACK, concurrent deletion, receipt invariance pass.
- Local Cloudflare production-build/smoke/deploy **contracts**: 157 passed; these use fixtures, not Production deployment.
- Full ESLint: 0 errors, 7 existing unrelated warnings. `tsc --noEmit`: pass; final validation also recorded in PR.
- Implementation head `bdcf5da9d477169b32b985db2e48002322fa1399`: [Chat regression CI passed](https://github.com/hyungeunseanson/locally-web/actions/runs/37001368364) and [Cloudflare Foundation CI passed](https://github.com/hyungeunseanson/locally-web/actions/runs/37001368385), including Auth, phone workspace, Next/OpenNext builds and local Worker dry-runs. A final selected-conversation guard for late ACK failure was subsequently reproduced failing, fixed, and covered by the 21-test local suite. Final-head CI results are recorded in the Draft PR and final delivery. No live write-enabled E2E, account creation, production browser chat opening, or payment tests run.

# Production impact

Production DB mutation = 0
Production deploy = 0
Cloudflare mutation = 0
Supabase configuration mutation = 0
credential mutation = 0
business writes = 0
Vercel operations = 0

Only allowlisted Supabase metadata/function definitions, aggregate counts/link anomaly counts and a read-only query plan were fetched. No sensitive message body/customer profile was printed. All fixtures/migrations/races ran in local isolated test databases, never Production.

# Draft PR

[Draft PR #162](https://github.com/hyungeunseanson/locally-web/pull/162), branch `codex/admin-chat-full-audit`. Initial implementation commit `048606ea7d6a2413d2800bbf72e586bca7e67fc0`; subsequent commits preserve history and are listed in the PR. Full CI also passed on implementation head `bdcf5da9d477169b32b985db2e48002322fa1399` before the final late-ACK guard and report commit. Exact final head is recorded at final delivery. Sixteen changed files are enumerated in the PR Files changed view. No merge authorized or attempted.

The first Foundation run found a lint issue in the new test probe (assignment during render). The probe now records the hook result in an effect; application code was not affected. The first Chat run also exposed a fixture timing issue: an Alerts event was injected before the subscription existed. The test now waits for channel readiness; a separate regression covers unmount during initial load. Final CI results supersede those runs.

ADMIN_CHAT_FULL_AUDIT_AND_IMPROVEMENT_COMPLETE
