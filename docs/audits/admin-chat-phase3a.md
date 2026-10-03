# Admin Chat Phase 3A operations UX

Starting main: `06249e0747fe3542b71f88e0819da58326ea77e3` (fetched before creating the isolated worktree).

## Contracts and implementation

- The three operational checkboxes combine with AND and with the existing status/workspace filter. N uses only `admin_unread_count > 0`; needs reply uses canonical `needs_reply` (including existing phone task enrichment); reopened uses `support_reopened_at` presence. No sender/read-receipt/status inference is added.
- Filtering happens before response pagination. Support reuses one canonical activity RPC per existing 100-row scan batch and caches that result for response enrichment. Unfiltered requests retain their original query path. Phone reuses its existing enrichment RPC, including its reopened timestamp. The browser receives its existing bounded page. No row query, count query, message search, schema or RPC change is introduced.
- A selected conversation outside the operational filter stays open, keeps its draft and URL, and can still be resolved by the existing deep-link path. A ready shared N snapshot treats an absent conversation as zero, overriding stale list metadata.
- The existing conversation menu offers ID and permalink copying through Clipboard API and existing toast feedback. Support links use `tab=CHATS&view=support&inquiryId=…`; phone links use `tab=CHATS&view=phone&proxyRequestId=…`.
- Phone latest activity uses explicit Asia/Seoul formatting. The existing payment detail dialog adds request-created time; payment/refund dates already use Asia/Seoul. Updated time is not added as an extra toolbar item. Storage values remain unchanged.
- Sync visibility observes the existing channel callback, online/offline, visibility and accepted successful canonical GETs. Failed or superseded GETs cannot advance the success timestamp. The observer has no timer, channel or fetch. Existing fallback/catch-up timers remain unchanged.
- Alt+Up/Down and accessible previous/next buttons navigate the current filtered, loaded list through the existing selection/URL path. Boundaries do not wrap or load another page. Textarea/input/select/contenteditable, composition, key repeat, other modifiers and open dialogs/menus are excluded.
- Realtime list invalidation reads the current list function through a ref, so operational filter changes do not rebuild the chat channel or reload the selected thread.

## Before/after requests

Actual starting-main and current component source are bundled into the same local browser fixture. I/O is intercepted; neither production nor staging is contacted. Chromium and WebKit agree. Values below are before → after; ACK=0 in this workload because its selected rows have canonical unread=0. Separate N/ACK regression suites exercise nonzero unread.

L=list, D=phone detail, R=canonical URL resolver, T=thread.

| Workload | Support | Phone |
| --- | --- | --- |
| Initial list | L1 → L1 | L2 → L2 (existing todo then all filter) |
| Select conversation | R1 T1 → R1 T1 | D1 T1 → D1 T1 |
| Connected idle, 10 minutes | L2 T2 → L2 T2 | L2 D2 T2 → L2 D2 T2 |
| Incoming message | L1 T1 → L1 T1 | L1 D1 T1 → L1 D1 T1 |
| Ten-message burst | L1 T2 → L1 T2 | L1 D1 T2 → L1 D1 T2 |
| Existing filter versus new operations filter | L1 T0 → L1 T0 | L1 T0 → L1 T0 |
| Ten row clicks versus ten keyboard next actions | L10 R10 T10 → L10 R10 T10 | D10 T10 → D10 T10 |
| Clipboard | no request | no request |
| Offline indicator | no request | no request |

One-batch real route tests count DB client operations, including the fixture's admin authorization read: Support 7 → 7; Phone 6 → 6. Phone filters add no DB operation. Support's activity RPC moves before pagination only while operations filters are active, and its result is reused rather than fetched again. It may evaluate up to 100 IDs rather than only the returned 50 IDs. Sparse filters can require more existing 100-row scans: the test with its sole match at row 205 performs three activity RPCs, each at most 100 IDs. This is the cost of a complete server-filtered page; no full table reaches the browser. Thread, resolver and ACK query implementations are unchanged, so unchanged request counts retain their DB work.

The selected-thread loading fixture adds one React commit for the visible subscription state (6 → 7 maximum); GET concurrency remains 1 and queued catch-up remains serialized.

## Verification

- `npx tsc --noEmit`
- `npm run lint` (only the seven existing unrelated warnings)
- `npm run test:admin-chat:operations`: exact predicates/combinations, pre-pagination sparse match, shared N zero, clipboard failure, KST day/year/DST boundaries, sync states/no I/O, keyboard filtered order/boundaries/typing/history/A→B→A, desktop/390px layout, workload comparison.
- `PHASE3A_BASELINE=1 npx playwright test -c playwright.admin-chat-operations.config.ts --grep 'performance:'`
- `npm run test:admin-chat:phase1`: existing #155 loading/flight/stale protection, chat performance/platform and admin layout suites.
- `npm run test:admin-attention:phase2`: #157/#162, exact ACK and shared provider, second-tab/deletion/image/profile/URL/retry/accessibility coverage.
- `PHONE_WEBKIT=1 npm run test:phone-followup`: #165 exact snapshot/recomplete/atomic-reply and phone/refund workspace suites.
- `npm run test:e2e:auth-regression`: local auth runtime and session contracts.
- Chat performance regressions CI includes the new operations suite and explicit TypeScript check. Cloudflare Foundation CI remains the existing mandatory gate; no deployment command is requested.

Desktop and 390px screenshots are generated under `.tmp/phase3a/` by the local browser suite. Toolbar wrapping, dropdown bounds, document overflow and composer viewport bounds are asserted, and generated screenshots were visually inspected.

## Production boundary

Production DB mutations: 0. Migrations: 0. Merge: 0. Deploy: 0. Cloudflare/Supabase config changes: 0. Search/locale/experience repair and release operations are outside this change.
