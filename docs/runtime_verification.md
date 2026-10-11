# Production Runtime Verification

## Goal

- 운영 Worker의 공개 경로와 익명 권한을 **읽기 전용**으로 확인한다.
- Auth 사용자·역할·화이트리스트, 알림, 분석 이벤트, 예약을 만드는 기존 E2E는 동일한 **격리 Supabase Auth/DB 및 로컬 앱**에서 계속 실행한다.
- 릴리스 검증은 운영 `gate`와 격리 `baseline`이 모두 PASS일 때만 완료된다. 어느 한쪽이 미실행이면 `VERIFICATION_INCOMPLETE`로 기록한다.
- 기존 `69-admin-role-access.spec.ts`와 다른 쓰기 테스트는 삭제하거나 성공으로 대체하지 않는다.

## Bundles and side effects

| Bundle | 실행 위치 | 검사와 실제 부작용 |
| --- | --- | --- |
| `gate` | Production HTTPS | `271-production-readonly-smoke`: GET으로 홈·검색·체험 상세·로그인·SEO와 익명 관리자 API 차단을 확인. 브라우저 JS 및 DB 클라이언트를 실행하지 않아 합성 사용자·분석 이벤트·알림을 만들지 않는다. |
| `baseline` | 격리 로컬 앱 + 격리 Supabase | 기존 `43`은 검색 로그·상세 조회 이벤트, `56`은 Auth 사용자·알림 및 읽음/삭제, `67`은 Auth 사용자·검색/분석 행, `09`는 Auth 관리자·화이트리스트, `69`는 Auth 관리자·역할·화이트리스트, `71`은 Auth 사용자·호스트/체험/예약/리뷰를 생성하거나 변경한다. 기존 검증 내용을 그대로 유지한다. |
| `shared` | 격리 환경만 | 기존 관리자/알림/팀 테스트 8개는 Auth 사용자와 공유 알림·작업·감사 행을 만들거나 변경한다. |
| `noisy` | 격리 환경만 | 기존 예약·취소·메시지·호스트 등록 테스트 6개는 예약, 알림, 이메일 시도 등 운영 노이즈를 낼 수 있다. |

`shared`와 `noisy`의 과거 `test:e2e:live:*` 명령은 호환용 별칭이다. 실행기는 공개 사이트와 운영 Supabase를 거부하고 격리 대상에서만 실행한다. 격리 실행 후에는 테스트가 생성한 사용자와 행의 정리 결과를 확인한다. 정리 실패도 PASS가 아니다.

## Official entry points

```bash
PLAYWRIGHT_LIVE_BASE_URL=https://www.locally-travel.com npm run test:e2e:live:gate
npm run test:e2e:isolated:baseline
npm run test:e2e:isolated:shared
npm run test:e2e:isolated:noisy
```

격리 실행에는 해당 작업 트리의 `.env.local`에 **로컬 Supabase URL·anon key·service role key와 `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100`**이 필요하다. 실행기는 브라우저와 앱을 `127.0.0.1:3100`에 고정하고 자체 서버를 시작하며 기존 서버를 재사용하지 않는다. Supabase URL은 loopback이어야 한다. 프로덕션 URL·키, 원격 앱/로컬 DB 혼합, 로컬 앱/운영 DB 혼합은 거부한다. 격리 Auth·스키마·RLS·필요한 체험 fixture가 실제 준비되지 않았다면 `NOT_RUN_ENVIRONMENT_BLOCKED`로 기록한다.

운영 관리자 UI는 기존에 승인된 계정과 세션을 안전하게 사용할 수 있을 때 **읽기 전용**으로 별도 확인한다. 합성 사용자 생성, 역할·화이트리스트 변경, 체험 저장·승인은 운영 smoke에 포함하지 않는다. 관리자 UI를 확인하지 못했다면 그 범위를 보고하고 PASS로 기록하지 않는다.

## Execution and cleanup boundary

1. 운영 `gate`를 실행하고 대상 origin과 GET 결과를 기록한다.
2. 격리 Auth·DB·앱에서 `baseline`을 실행해 권한 상승, 화이트리스트 해제·권한 회수, 알림·분석·호스트 경로를 검증한다.
3. 격리 데이터 정리를 확인하고, 필요한 경우 `shared`·`noisy`를 별도로 실행한다.
4. 운영 계정의 읽기 전용 관리자 UI 확인 가능 여부를 기록한다.
5. `gate`와 `baseline`이 모두 PASS가 아니면 릴리스 검증은 `VERIFICATION_INCOMPLETE`다.

과거 `cleanup:codex:*:execute` 명령은 운영 데이터 삭제 가능성이 있으므로 이 검증 절차에서 실행하지 않는다. 격리 테스트의 자체 정리와 격리 DB 확인만 사용한다. 운영 DB에 대한 SQL은 읽기 전용 확인에 한정한다.

## Diagnostics Boundary

- `scripts/diagnostics/*`는 임시 확인용 도구이며 release gate 일부가 아니다.
- 공식 점검은 위의 운영 읽기 전용 smoke와 격리 E2E를 구분해 기록한다.
- diagnostics 중 일부는 데이터/스키마를 직접 바꿀 수 있으므로, release-day에는 별도 owner 판단 없이 실행하지 않는다.

## Monitoring Boundary

- Sentry는 sanitized exception capture만 담당한다.
- breadcrumbs, tracing, replay, request URL/query/header/cookie는 현재 운영 기준에서 수집하지 않는다.
- 따라서 pass/fail 판정은 monitoring 단독이 아니라 운영 smoke, 격리 E2E 및 격리 데이터 정리 상태를 함께 본다.

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

### 읽기 전용 운영 확인

1. 운영 `gate`의 공개 경로와 익명 관리자 API 차단 결과를 확인한다.
2. 기존 승인된 관리자 세션이 있으면 헤더·`/account`·관리자 화면을 조회만 한다. 화면의 저장·읽음·삭제·권한 변경 버튼은 누르지 않는다.
3. 알림 읽음·삭제, 예약 생성, direct RPC 우회, 역할 변경은 격리 E2E에서 검증한다.

## Triage

- `selector drift`
  - response/API는 정상이고 UI locator만 깨진 경우
- `product regression`
  - route status, 화면 상태, DB row 중 하나라도 계약과 다르게 바뀐 경우
- `data/setup issue`
  - 격리 Auth·스키마·fixture 부족, 권한 누락, 잔여 테스트 데이터 충돌

실패 보고는 항상 아래 형식으로 남긴다.

- `baseURL`
- `bundle`
- `command`
- `pass/fail`
- `created side effects`
- `isolated cleanup status` (격리 E2E 실행 시)
- `drift vs regression`
