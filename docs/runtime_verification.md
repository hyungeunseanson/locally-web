# Production Runtime Verification

## Goal

- `production` 배포 직후 반복 가능한 런타임 검증 절차를 고정한다.
- 기본 자동 게이트는 package script / bundle 이름 기준 `gate`만 사용한다.
- 이전 문서의 `gate-safe`, `shared-surface`는 각각 현재 `gate`, `shared` bundle을 뜻한다.
- 운영 노이즈가 생길 수 있는 검증은 명시 승인 후에만 실행한다.

## Bundles

### `gate`

- 목적: 배포 게이트용 release-safe bundle
- 명령:
```bash
npm run test:e2e:live:gate
```
- 대상:
  - `tests/e2e/43-guest-search-detail-ingress.spec.ts`
  - `tests/e2e/56-notification-read-route.spec.ts`
  - `tests/e2e/67-analytics-ingest-routes.spec.ts`
  - `tests/e2e/09-admin-analytics.spec.ts`
  - `tests/e2e/69-admin-role-access.spec.ts`
  - `tests/e2e/71-public-host-profile.spec.ts`
- 규칙:
  - cleanup이 끝난 뒤 `codex.*` 잔여 데이터가 없어야 한다.
  - shared bundle row를 남기면 실패로 본다.

### `shared`

- 목적: 운영 공유 surface 확인
- 명령:
```bash
npm run test:e2e:live:shared -- --ack-shared-surface
```
- 대상:
  - `tests/e2e/17-admin-sidebar.spec.ts`
  - `tests/e2e/13-admin-alerts.spec.ts`
  - `tests/e2e/15-admin-team.spec.ts`
  - `tests/e2e/16-admin-team-chat.spec.ts`
  - `tests/e2e/18-admin-team-badge.spec.ts`
  - `tests/e2e/54-mobile-notification-badges.spec.ts`
  - `tests/e2e/70-admin-audit-logs.spec.ts`
  - `tests/e2e/72-review-host-notification.spec.ts`
- 규칙:
  - 기본 자동 게이트에서 제외한다.
  - cleanup 후 seeded row 0건이어야 한다.

### `noisy`

- 목적: 실제 운영 노이즈 허용 상황에서만 확인
- 명령:
```bash
npm run test:e2e:live:noisy -- --ack-noisy
```
- 대상:
  - `tests/e2e/68-booking-rpc-public-guard.spec.ts`
  - `tests/e2e/31-live-guest-trip-cancel.spec.ts`
  - `tests/e2e/23-live-guest-post-booking.spec.ts`
  - `tests/e2e/05-live-guest-booking-messaging-support.spec.ts`
  - `tests/e2e/03-live-host-signup-registration.spec.ts`
  - `tests/e2e/04-live-host-experience-create.spec.ts`
- 규칙:
  - 운영 노이즈가 남을 수 있으므로 명시 승인 없이는 실행하지 않는다.
  - 남은 예약/알림/이메일 영향은 실행 보고에 반드시 적는다.

## Execution Order

1. 배포가 `Ready`인지 확인한다.
2. `gate` 실행.
3. 실패 시 즉시 중단하고 drift/regression/data issue로 분류한다.
4. 성공 시 아래 cleanup dry-run과 Supabase 쿼리로 최근 적재와 cleanup 상태를 본다.
5. 필요할 때만 `shared` 실행.
6. 운영 노이즈가 허용된 상황에서만 `noisy` 실행.

## Official Entry Points

- local contract gate
  - `npm run test:e2e:contracts`
- live domain response gate
  - `npm run test:e2e:live:domain-gate`
- live release gate
  - `npm run test:e2e:live:gate`
- live shared-surface check
  - `npm run test:e2e:live:shared -- --ack-shared-surface`
- live noisy check
  - `npm run test:e2e:live:noisy -- --ack-noisy`
- release-day 기준 밖
  - bare `npx playwright test`
  - `scripts/diagnostics/*`
  - ad-hoc `curl` or individual spec execution without the package-script wrappers

## Cleanup

### 운영 기본 원칙

- 평시에는 `safe cleanup`만 사용한다.
- 배포 직전에는 `full cleanup`까지 포함한 전체 정리를 실행한다.
- `full cleanup` 후에는 반드시 dry-run을 다시 돌려 잔여 row를 확인한다.

### Codex test data dry-run

```bash
npm run cleanup:codex:dry
```

- 목적:
  - `codex.*@example.com` 계정과 연결된 테스트 잔여 row 수를 한 번에 본다.
  - 실제 삭제 없이 현재 삭제 대상만 요약한다.
- 포함 대상:
  - `auth.users`
  - `profiles`
  - `users`
  - `admin_whitelist`
  - `admin_audit_logs`
  - `host_applications`
  - `notifications_execute`
  - `notifications_review`
  - `admin_tasks`
  - `admin_task_comments`
  - `bookings`

### Codex test data execute

```bash
npm run cleanup:codex:execute:safe
```

또는

```bash
npm run cleanup:codex:execute
```

- 규칙:
  - 평시 기본 정리용이다.
  - 운영 기준 기본 명령은 `cleanup:codex:execute:safe`다.
  - `cleanup:codex:execute`는 기존 계약을 깨지 않기 위한 backward-compatible alias다.
  - dry-run 결과를 확인한 뒤에만 실행한다.
  - `codex` 계정에 직접 연결된 데이터만 삭제한다.
  - `notifications`는 `codex user_id`에 직접 연결된 row만 지우고, 내용에만 `codex/코덱스`가 들어간 알림은 기본값에서 제외한다.
  - 운영 데이터와 섞일 여지가 있으면 실행하지 않는다.
  - 실행 결과는 배포 보고에 남긴다.

### Codex test data full execute

```bash
npm run cleanup:codex:execute:full
```

- 규칙:
  - 배포 직전 전체 정리용이다.
  - `notifications_review`까지 같이 삭제한다.
  - 실제 호스트/어드민 계정으로 간 테스트 알림 이력까지 지울 수 있으므로, 기본값으로는 쓰지 않는다.

### 배포 직전 권장 순서

1. `npm run cleanup:codex:dry`
2. `npm run cleanup:codex:execute:full`
3. `npm run cleanup:codex:dry`
4. `npm run test:e2e:live:gate`
5. 필요 시 `shared`

## Diagnostics Boundary

- `scripts/diagnostics/*`는 임시 확인용 도구이며 release gate 일부가 아니다.
- 배포 직전 공식 점검은 이 문서의 package script와 쿼리만 기준으로 삼는다.
- diagnostics 중 일부는 데이터/스키마를 직접 바꿀 수 있으므로, release-day에는 별도 owner 판단 없이 실행하지 않는다.

## Monitoring Boundary

- Sentry는 sanitized exception capture만 담당한다.
- breadcrumbs, tracing, replay, request URL/query/header/cookie는 현재 운영 기준에서 수집하지 않는다.
- 따라서 release-day pass/fail 판정은 monitoring 단독이 아니라 smoke 결과, route status, DB cleanup 상태를 함께 본다.

## Supabase Queries

```sql
select id, user_id, type, is_read, created_at
from public.notifications
order by created_at desc
limit 20;
```

```sql
select id, keyword, route, user_id, session_id, created_at
from public.search_logs
order by created_at desc
limit 20;
```

```sql
select id, event_type, target_id, user_id, session_id, created_at
from public.analytics_events
order by created_at desc
limit 20;
```

```sql
select id, email, created_at
from public.admin_whitelist
where email ilike 'codex.%@example.com'
order by created_at desc;
```

```sql
select 'admin_tasks' as table_name, count(*) as row_count
from public.admin_tasks
where content ilike '코덱스%'
union all
select 'admin_task_comments', count(*)
from public.admin_task_comments
where content ilike '코덱스%'
union all
select 'admin_audit_logs', count(*)
from public.admin_audit_logs
where admin_email ilike 'codex.%@example.com'
union all
select 'host_applications', count(*)
from public.host_applications
where email ilike 'codex.%@example.com'
union all
select 'bookings', count(*)
from public.bookings
where order_id like 'HOST-REV-BOOKING-%'
   or order_id like 'REV-HOST-NOTI-%'
   or order_id like 'USR-BOOK-%'
   or order_id like 'TEST-BOOKING-%';
```

## Manual QA

### 5-minute pass

1. `/notifications`에서 읽음 처리와 삭제를 확인한다.
2. 홈/검색/상세에서 검색과 상세 진입이 끊기지 않는지 본다.
3. 관리자 계정으로 헤더와 `/account`의 `Admin` 진입을 본다.
4. `/admin/dashboard?tab=TEAM`과 `운영 감사 로그` 탭이 에러 없이 열리는지 본다.
5. 예약 생성은 `/api/bookings`만 정상이고 direct RPC 우회는 불가한지 확인한다.

## Triage

- `selector drift`
  - response/API는 정상이고 UI locator만 깨진 경우
- `product regression`
  - route status, 화면 상태, DB row 중 하나라도 계약과 다르게 바뀐 경우
- `data/setup issue`
  - live fixture 부족, 권한 누락, 잔여 테스트 데이터 충돌

실패 보고는 항상 아래 형식으로 남긴다.

- `baseURL`
- `bundle`
- `command`
- `pass/fail`
- `created side effects`
- `cleanup status`
- `drift vs regression`
