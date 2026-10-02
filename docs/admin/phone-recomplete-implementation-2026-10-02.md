# Phone reservation re-complete implementation

Prepared for Draft PR review from main `e870f8c71029298b9deede3aba53fd65a435d979`. No Production migration, deployment, business write, configuration change, credential change, or Vercel operation was performed.

## Contract and architecture

The existing **••• → 처리 완료** action uses `POST /api/admin/proxy-bookings/[id]/complete` with `{ inquiryId: "42", seenCustomerMessageIds: ["100", "101"] }`. A verified admin session supplies the actor. One service-only RPC locks inquiry → request → selected messages → tasks. Initial completion requires paid PENDING/IN_PROGRESS; re-completion does not update the request, payment, or request timestamp. The response supplies `status`, `handledMessageIds`, `needsReply`, and `hasMoreUnhandled`. A successful response can still need a reply.

The phone conversation commits a rendered customer-message snapshot to its parent. Loading, failure, invalid selection/link, and empty snapshots disable completion. The confirmation freezes its request, inquiry, and exact IDs; later messages are not added. The bounded request timeout does not automatically retry. All outcomes use the existing serialized workspace refresh; the response never blindly overwrites needs_reply or the currently selected row.

For COMPLETED requests the confirmation reads: “현재 확인한 메시지까지 처리 완료할까요? 고객에게 메시지는 전송되지 않습니다.” If pending remains: “확인한 메시지는 처리했습니다. 새 메시지가 남아 있습니다.” The existing menu label remains unchanged.

Phone replies pass the same rendered snapshot in `phoneFollowup`. `reply_phone_request` handles exactly those tasks and inserts the admin message in one transaction. An INSERT failure rolls handling back. Existing canonical send reconciliation and post-save notification delivery remain in place. Generic support/monitor sends retain their path. Older clients can send but cannot implicitly handle private tasks; the old COMPLETED PATCH returns 409 rather than bypassing the snapshot contract.

Snapshots are bounded at 200 distinct decimal-string bigint IDs. The UI selects the last 200 eligible rendered customer messages. If older pending tasks remain, the server keeps needs_reply true. There is no max-ID/time watermark and no “handle all in DB” fallback.

## Intake and locking proof

Inspected creation paths: bank/NAVER POST creates inquiry + first message, then inserts linked request; card confirmation calls the existing `finalize_proxy_card_intake_atomic`, including its existing-inquiry branch. No separate admin/self-service formal-request writer was found. General admin-support creation explicitly does not reuse an inquiry.

The application and payment-provider intake order is unchanged. Two narrow triggers close the gap:

1. Link adoption locks the inquiry and captures existing eligible customer messages when a formal linked request first appears. It rejects duplicate/wrong-user links and subsequent formal relinking/owner changes. Unrelated form-data edits do not acquire the inquiry lock.
2. Later customer INSERTs already hold the inquiry lock from Phase 1. An AFTER INSERT trigger adds exactly one private task in the same transaction, regardless of request status. General support, monitor, admin and non-message event types do not create tasks.

A new request or inactive card anchor may hold its request row before acquiring the inquiry lock. This is safe only because that row is invisible or excluded from capture until activation commits. A message that wins first commits without referencing that request; adoption then sees and captures it. If adoption wins, the waiting INSERT sees the committed formal link. Existing formal requests do not use this reverse order. Independent PostgreSQL 17 connections test both orders, actual unchanged card RPC branches, and concurrent duplicate adoption.

## Migration and baseline

`20261002140902_phone_followup_tasks.sql` is **prepared only**. It requires the existing Phase 1/Phase 2 migrations. It is a one-time forward migration; it deliberately does not re-baseline an existing task table.

The transaction first acquires NOWAIT exclusive locks on requests, messages, and inquiries. If a writer is active, the whole migration fails immediately with no partial cutover. Operators must schedule a quiet application window; there is no automatic migration retry. Locks cover trigger installation, baseline computation, and the old/new COMPLETED set assertion. A writer waiting behind cutover is captured after commit.

The baseline computes valid unique same-customer support links and seeds each historical unanswered customer segment using the existing created_at/id latest-visible-message ordering. This ordering is **only** historical baseline logic. It compares the exact old COMPLETED needs_reply request set with the new pending EXISTS set and aborts on any difference. Historical tasks have null handled_by/handled_at. The temporary seed helper is dropped afterward. No reference production counts are hardcoded.

Native simulation compares public rows and receipts before/after baseline, tests concurrent old completion and message writers, and verifies the new INSERT capture after cutover. Production data was not migrated or copied into the fixture; the live assertion must still pass during a separately approved rollout.

A rollback of the application must not drop the task table or restore timestamp/latest-sender handling. Keep the migration and private history until a separately reviewed rollback plan exists. Deploying the new application before its migration would fail the phone activity RPC; this Draft PR is not a deployment authorization.

## N, reply need and completion

- N remains the shared Admin Attention exact administrative acknowledgement. Neither completion nor task capture writes admin_read_at/is_read/read_at.
- COMPLETED needs_reply comes from pending private tasks, independent of latest sender and administrative acknowledgement.
- COMPLETED means the original reservation operation completed. Handling follow-ups does not rewrite it.
- PENDING/IN_PROGRESS and CANCELLED list semantics remain unchanged.
- Soft/hard deletion removes pending tasks. Handled history remains. A snapshot containing a hard-deleted unhandled ID fails safely and requires refresh; soft-deleted IDs are no-ops.

## Security and propagation

Five columns only: request UUID, inquiry bigint, message bigint, handled timestamp and admin UUID. PK(request,message), UNIQUE(inquiry,message), and partial pending(request,message) index. No direct table grants to PUBLIC/anon/authenticated/service_role; RLS enabled; fixed empty search_path; service-only public wrapper execution. Admin identity and request/inquiry/customer/message relationships are validated inside the transaction as well as at the API boundary. An existing private schema is reused; no Data API exposure/configuration change.

The private table is not published. Re-completion emits **zero public chat row changes**. No new channel, polling, Cron, queue, job, fake inquiry update, image processing or AI path. Another browser can remain stale until the existing visibility/online/reconnect/manual/5-minute catch-up; repeated handling is harmless and preserves the first actor.

## Race matrix

Native PostgreSQL 17, three independent connections, bounded 5-second lock observation and 8-second statement timeouts:

| Scenario | Verification |
| --- | --- |
| Initial completion vs INSERT, customer first/admin first | New exact IDs stay pending in either order |
| Late lower/higher IDs | Omitted IDs remain pending |
| Re-complete and concurrent arrival | Snapshot only; request timestamp/status/payment unchanged |
| Two admins, double click, same-snapshot retry | Idempotent; first handler retained |
| Reply success/INSERT failure | Atomic handling, rollback on insert constraint failure |
| Wrong inquiry/customer, duplicate link, two requests for same customer | Fail closed / isolated |
| Concurrent duplicate first link | Second adoption rejected after lock |
| Soft/hard deletion, both lock directions | Pending removed; handled history retained |
| Refund wins lock | Initial completion rejects without handling |
| Migration vs INSERT/old completion | Busy migration aborts wholly; blocked INSERT captured after successful cutover |
| Legacy client without snapshot | No implicit handling |
| Old API response/missed Realtime | Browser tests: newer workspace pending state survives; visibility catch-up restores truth |

Browser tests additionally cover frozen lower/higher IDs after confirmation, failed message load + retry, disabled loading action, exact reply body, unchanged support/monitor sends, and 390px layout. Existing #155/#157/#162 suites preserve flight sharing, ACK/N and recovery behavior.

## Performance

Same starting-main and current component sources, same local browser fixture, connected SUBSCRIBED state; initial load excluded. Browser clock advances ten minutes. This isolated phone fixture lacks the layout's AdminAttentionProvider, so count/ACK calls are zero and thread burst sharing uses the existing fallback. It is a reproducible comparison, not a claim about absolute Production traffic. Separate Admin Attention regression tests exercise the shared provider.

| Workload | Before list/detail/thread GET | After list/detail/thread GET | New action API |
| --- | --- | --- | --- |
| Idle 10 minutes | 2 / 2 / 2 | 2 / 2 / 2 | 0 |
| One customer INSERT | 1 / 1 / 1 | 1 / 1 / 1 | 0 |
| Synchronous 10-INSERT burst | 1 / 1 / 2 | 1 / 1 / 2 | 0 |
| Re-complete | Unavailable | 1 / 1 / 0 | 1 POST |

The existing page performs request/profile/inquiry/link/activity reads (5 data round trips for one full batch, excluding auth). The phone activity RPC is replaced, not supplemented: **zero added network reads, no per-row network lookup**. Existing multi-batch filtering costs are unchanged.

Added database work, beyond existing auth/reopen/send work:

- Customer capture: one inquiry SELECT, one indexed linked-request aggregate, one owner EXISTS, one admin-sender predicate (users/auth/whitelist EXISTS), and one task INSERT. No added public UPDATE.
- Link adoption: one locked inquiry read, one duplicate-link count, and one batched INSERT SELECT over existing eligible customer messages. Once per initial formal link.
- Completion: one RPC; admin predicate, locked inquiry/request reads, duplicate-link count, bounded selected-message locks/relationship validation, one task UPDATE and pending EXISTS. Initial completion also changes one request status; re-completion changes zero public rows. Admin predicates/EXISTS may probe multiple relations; these are SQL operations, not claimed physical disk-read counts.
- Reply: replaces the existing direct INSERT network request with one RPC containing the same INSERT and exact task handling. Post-save work is unchanged.
- Delete: one indexed DELETE of matching pending task, at most one row.

PostgreSQL 17 EXPLAIN ANALYZE with ~10k requests justified the linked-inquiry expression index: 144 shared-hit blocks/full scan versus 3/index lookup in the recorded run. At 500k handled task rows, pending existence and absence use the partial index (2 and 1 shared-hit blocks). No query-plan timing is a Production latency guarantee.

## Validation and delivery

Local gates: new API contracts; native PG17 races and EXPLAIN; Chromium + WebKit phone UI/unit tests; Phase 1/chat-platform regression; Admin Attention Phase 2; auth regression; TypeScript; ESLint; Cloudflare production-build contract (no deployment). ESLint has seven existing warnings in unrelated files and no errors.

Chat regression CI adds an isolated phone job with local PG17 and browser fixtures. Cloudflare Foundation configuration is unchanged; its existing Chromium phone gate remains compatible. Use `PHONE_WEBKIT=1 npm run test:phone-followup` for both browsers and `PHONE_NATIVE_MODULES=/path/to/external/node_modules npm run test:phone-followup:native` for the native suite. The latter requires embedded-postgres 17 and accepts no remote connection URL.

Final commit, Draft PR and observed CI conclusions are reported in the delivery message; no merge or Production operation is authorized by this implementation.
