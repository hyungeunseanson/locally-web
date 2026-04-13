# public analytics + 사용자 알림 Surface E2E 감사

## Summary
- 감사 범위: `/notifications`, `/host/notifications`, `NotificationContext`, `/api/notifications/read`, `/api/notifications/[id]`, `/api/analytics/events`, `/api/analytics/search`
- 제외 범위: admin analytics 집계 화면, 개별 도메인에서 파생되는 알림 생성 write path, live mutation 재실행
- 실행 방식: 정적 코드 감사 + 핵심 non-live E2E 재실행
- latest run
  - `5 passed (21.4s)`
  - rerun bundle
    - `tests/e2e/56-notification-read-route.spec.ts`
    - `tests/e2e/67-analytics-ingest-routes.spec.ts`
    - `tests/e2e/110-guest-notifications-guidance.spec.ts`
- 이번 패스 핵심 결론
  - 사용자 알림 센터는 현재 `NotificationContext`를 단일 read model로 쓰고, 읽음/전체 읽음/삭제는 서버 route owner와 의미가 맞다
  - public analytics ingest/search route는 malformed payload, same-origin guard, rate-limit skip, schema compatibility fallback까지 포함해 현재 기준 `정상`이다
  - active bug는 보이지 않았고, 남는 것은 `host notifications alias UI`와 `page-level analytics caller parity`에 대한 얇은 coverage gap뿐이다

## Result Snapshot
| Chain | Source of truth | Current tests | Verdict | Notes |
| --- | --- | --- | --- | --- |
| 사용자 알림 센터 read model | `app/context/NotificationContext.tsx`, `app/notifications/page.tsx`, `app/host/notifications/page.tsx` | `110`, 간접 `56` | 정상 | 알림 페이지는 DB 직접 조회가 아니라 context truth를 읽고, guest empty/guidance CTA와 host alias 분기를 같은 surface에서 처리한다 |
| 읽음 / 전체 읽음 / 삭제 contract | `/api/notifications/read`, `/api/notifications/[id]`, `NotificationContext.markAsRead()`, `markAllAsRead()` | `56` | 정상 | current-user scope, optimistic update rollback, markAll semantics가 모두 닫혀 있다 |
| public analytics ingest route | `/api/analytics/events/route.ts`, `/api/analytics/search/route.ts`, `app/utils/analytics/server.ts` | `67` | 정상 | malformed JSON은 `400`, origin/rate-limit guard는 fail-safe, insert helper는 missing-column fallback을 유지한다 |
| analytics client caller parity | `app/utils/analytics/client.ts`, home/search 호출부 | reference-only | 부분 보장 | client helper 자체는 일관되지만, 실제 각 surface caller smoke는 다른 감사 묶음에 흩어져 있다 |

## Confirmed Findings
### 1. `/notifications`는 현재 context-backed read model로 안정적이다
- source of truth
  - [app/notifications/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/notifications/page.tsx:1)
  - [app/context/NotificationContext.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/context/NotificationContext.tsx:1)
  - [app/host/notifications/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/notifications/page.tsx:1)
- 현재 계약
  - 페이지는 notifications table을 직접 읽지 않고 `NotificationContext`만 source of truth로 사용한다
  - unread count는 context local state에서 파생되고, filter는 `all/unread` 두 축만 가진다
  - 링크가 현재 페이지가 아니면 이동하고, self-link면 accordion detail만 연다
  - 모바일 direct entry back fallback은 guest는 `/account`, host alias는 `/host/menu`로 분기된다
  - guest notifications는 guidance strip과 empty-state CTA로 `메시지함 보기`, `도움말 보기`를 함께 노출한다
- 근거 테스트
  - [tests/e2e/110-guest-notifications-guidance.spec.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/110-guest-notifications-guidance.spec.ts:1)
- 판정
  - `정상`

### 2. 읽음 처리와 삭제는 current-user scoped server route로 잘 잠겨 있다
- source of truth
  - [app/api/notifications/read/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/notifications/read/route.ts:1)
  - [app/api/notifications/[id]/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/notifications/%5Bid%5D/route.ts:1)
  - `NotificationContext.markAsRead()`
  - `NotificationContext.markAllAsRead()`
- 현재 계약
  - `/api/notifications/read`는 auth-required이며 `notificationId` 또는 `markAll: true`만 허용한다
  - update scope는 항상 현재 로그인 사용자 `user_id`로 제한된다
  - `/api/notifications/[id]`의 `DELETE`도 현재 사용자 소유 row만 제거한다
  - client는 optimistic update를 먼저 반영하지만, 실패하면 rollback snapshot으로 되돌린다
- 근거 테스트
  - [tests/e2e/56-notification-read-route.spec.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/56-notification-read-route.spec.ts:1)
    - 개별 읽음 처리
    - markAll current-user scope
    - delete current-user scope
- 판정
  - `정상`

### 3. notification realtime/read model 의미는 현재 products truth와 맞는다
- source of truth
  - [app/context/NotificationContext.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/context/NotificationContext.tsx:1)
- 현재 계약
  - 초기 sync는 `notifications` table 최신 20건을 기준으로 잡는다
  - realtime `INSERT`는 중복 id를 막고 toast를 띄우며, 필요 시 host status refresh와 guestTrips invalidate를 함께 수행한다
  - `visibilitychange` 복귀 시 과도한 refetch를 막기 위해 최소 간격 guard를 둔다
  - 즉 현재 unread truth는 “context local state + same-user realtime sync” 조합으로 고정돼 있다
- 테스트 보장
  - route scope는 `56`에서 닫혀 있고, guest 안내 surface는 `110`에서 닫혀 있다
- 판정
  - `정상`

### 4. public analytics ingest route는 현재 기준 충분히 hardening 돼 있다
- source of truth
  - [app/api/analytics/events/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/analytics/events/route.ts:1)
  - [app/api/analytics/search/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/analytics/search/route.ts:1)
  - [app/utils/analytics/server.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/analytics/server.ts:1)
- 현재 계약
  - `events`는 허용된 `event_type`만 받는다
  - `search`는 malformed JSON body에 `400 Invalid JSON body`, 빈 keyword에 `400 Invalid keyword`로 fail-closed 한다
  - 두 route 모두 public write guard를 통해 same-origin과 세션 기준 rate limit을 적용한다
  - rate-limited request는 noisy failure가 아니라 `202 { success: true, skipped: 'rate_limited' }`로 fail-safe 처리한다
  - insert helper는 tracking column이 아직 없는 schema에서도 minimal legacy insert로 fallback 한다
- 근거 테스트
  - [tests/e2e/67-analytics-ingest-routes.spec.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/67-analytics-ingest-routes.spec.ts:1)
    - search log 적재
    - analytics event 적재
    - malformed search payload 400
- 판정
  - `정상`

## Confirmed Close-out
### 1. public analytics + notification core에는 현재 active implementation risk가 보이지 않는다
- 재실행 결과는 `5 passed (21.4s)`로 깨끗하다
- 알림 센터는
  - context-backed read model
  - current-user scoped read/delete route
  - guest guidance empty state
  를 현재 기준으로 공유한다
- analytics ingest는
  - payload normalization
  - same-origin guard
  - rate-limit skip semantics
  - schema compatibility fallback
  까지 현재 코드와 테스트가 맞물린다
- 따라서 이번 close-out 기준으로 core verdict는 `정상`이다

## Coverage Gap
- `app/host/notifications/page.tsx`는 guest notifications page alias이지만, host alias 전용 UI smoke는 이번 번들에서 별도 재실행하지 않았다
- `app/utils/analytics/client.ts`의 실제 caller parity는 여러 도메인으로 흩어져 있다
  - 홈 검색
  - 상세/카드 click logging
  - 기타 ingress tracking
  이 감사 묶음에서는 server ingest contract만 다시 잠갔다

## Follow-up Need
- 1순위
  - 별도 구현 follow-up은 현재 없다
  - 다음 감사 도메인으로 넘어가는 편이 더 가치가 크다
- 2순위
  - 필요 시 나중에 `host notifications alias`와 `page-level analytics caller parity`만 얇은 smoke로 보강할 수 있다

## Final Verdict
- `/notifications`와 `/host/notifications`를 포함한 사용자 알림 surface는 현재 `NotificationContext + server read/delete route` 기준으로 정상이다
- `/api/analytics/events`와 `/api/analytics/search`는 malformed payload, origin/rate-limit guard, schema compatibility fallback까지 포함해 현재 기준 정상이다
- 남는 것은 active bug가 아니라 thin coverage boundary 두 곳뿐이며, 현재 제품 의미를 흔들 정도의 risk는 아니다
- 따라서 이번 감사 기준 최종 판정은 `public analytics + 사용자 알림 core는 정상`이다
