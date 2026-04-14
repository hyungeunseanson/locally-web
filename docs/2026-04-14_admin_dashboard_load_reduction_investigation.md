# 어드민 대시보드 부하 절감 조사

## Summary
- 이번 패스는 `app/admin/dashboard/*`, `app/api/admin/*`, 기존 admin 감사 문서, 그리고 최근 Supabase 사용 로그를 함께 교차검증해 어드민 대시보드의 부담 지점을 `keep / slow / manual / remove`로 분류한 조사 결과입니다.
- 결론부터 적으면, 현재 부담은 “어드민 대시보드 전체가 항상 무겁다”기보다 `특정 탭이 열렸을 때 broad refetch / realtime + polling 중복 / 과한 prefetch`가 집중되는 구조입니다.
- 현재 우선순위는 아래 순서가 맞습니다.
  1. `Team Workspace`
  2. `Users`
  3. `Audit Log`
  4. `Analytics`
  5. `Ledger`
  6. `Phone Reservation`
  7. `Admin Chat`
- 반대로 `Sidebar` 자체와 대시보드 shell은 현재 생각보다 덜 무겁습니다.
  - `Sidebar.tsx`는 지금 badge/count route를 읽지 않고 `auth.getUser()`만 1회 호출합니다.
  - `page.tsx`는 active tab만 mount하므로 모든 heavy tab이 동시에 뜨지는 않습니다.
- `Teamchat`은 이번 우선순위에서 제외하는 것이 맞습니다.
  - `GlobalTeamChat`, `MiniChatBar`, `/api/admin/team/chat` 계열은 현재 `TeamTab`에 mount되지 않는 orphan/legacy seam으로 확인됐습니다.
  - 따라서 이번 보고서의 `Team Workspace` 부담 평가는 `todo / memo / proxy / whitelist / bootstrap`에만 한정해서 봐야 합니다.

## Cross-Verification Basis
- 현재 코드 owner
  - `app/admin/dashboard/page.tsx`
  - `app/admin/layout.tsx`
  - `app/admin/dashboard/components/*`
  - `app/admin/dashboard/hooks/*`
  - `app/api/admin/*`
- 기존 감사 문서
  - `docs/2026-04-12_admin_dashboard_tabs_e2e_audit.md`
  - `docs/2026-04-14_admin_route_owner_audit.md`
  - `docs/performance/optimization-baseline.md`
- 제외 범위
  - `GlobalTeamChat`, `MiniChatBar`, `/api/admin/team/chat`은 current product surface가 아니라서 “별도 정리 이슈”로만 취급하고, 이번 절감 우선순위에서는 뺍니다.
- 최근 관찰과 맞물리는 외부 신호
  - user-provided Supabase 24h 로그에서 `admin_whitelist GET 3013`, `notifications GET 981`, `host_applications GET 3609`이 잡혔고, 이는 현재 admin access / alerts / approvals/team 계열 코드와 방향이 맞습니다.

## Surface Matrix
| 영역 | 현재 부담 근거 | 분류 | 권고 | 잃는 것 |
| --- | --- | --- | --- | --- |
| `Team Workspace` | `/api/admin/team/bootstrap`이 `admin_tasks 100건 + 해당 comments + admin_whitelist`를 한 번에 로드하고, realtime `admin_tasks`, `admin_task_comments`, `admin_whitelist` 이벤트마다 전체 bootstrap 재호출 | `manual` | 초기 hydrate를 `todo/memo`와 `whitelist`로 분리하고, realtime은 broad refetch 대신 현재 열린 섹션만 갱신 | 팀 작업/메모 반영이 즉시가 아니라 약간 늦어질 수 있음 |
| `Users` | `useAdminUsersData`의 `online_users` presence, `UsersTab`의 `BASE_PREFETCH_LIMIT=50`, `SUMMARY_SORT_PREFETCH_LIMIT=200`, 상세 선택 시 timeline fetch | `remove + slow` | online presence 제거, activity summary는 선택한 유저와 현재 화면 상위 일부만 수동/지연 로드 | 실시간 접속자 표시가 사라지고, 정렬 직후 금액 요약이 바로 안 뜰 수 있음 |
| `Audit Log` | `realtime_audit_logs` realtime을 붙인 상태에서 5초 polling fallback도 같이 동작 | `remove` | polling fallback 제거 또는 60~300초 수동 refresh로 전환 | 실시간 publication이 깨진 환경에서 자동 복구가 느려짐 |
| `Analytics` | `business` 탭에서 `/api/admin/analytics-summary`, `/api/admin/analytics-search-intent`, `/api/admin/analytics-customer-composition` 3개 병렬 호출, `host` 탭도 별도 summary 호출 | `manual` | 최초 자동 로드 대신 “조회하기” 버튼 또는 날짜 변경 후 명시적 refresh로 전환 | 탭 진입 즉시 숫자가 보이지 않음 |
| `Ledger` | `bookings`, `service_bookings` realtime 이벤트마다 `/api/admin/master-ledger` 전체 재호출 | `manual` | realtime 제거, 수동 새로고침 또는 긴 주기 refresh로 전환 | 무통장 확인/취소 직후 목록 반영이 늦어질 수 있음 |
| `Phone Reservation` | `proxy_requests`와 연동 `inquiry_messages` 이벤트마다 목록 + 상세를 다시 로드 | `manual` | 리스트 refresh와 detail refresh를 분리하고, detail은 현재 선택 항목만 새로고침 | 전화예약 상세 진행상황이 실시간이 아니라 클릭 시 최신화됨 |
| `Admin Chat` | `useAdminChatQuery`가 실시간 이벤트 후 목록 refresh를 자주 재실행하고, 메시지 load 뒤에도 다시 list refresh | `slow` | 선택된 inquiry는 즉시 갱신하되 목록은 debounce 강화 또는 30~60초 refresh | 모니터링 목록 snippet 반영이 약간 늦어짐 |
| `Admin Alerts` | `/api/admin/alerts` 1회 로드 후 `notifications` realtime 반영. 구조는 비교적 절제돼 있음 | `keep` | 현재 유지, 필요 시 unread/filter만 local 처리 강화 | 실익 대비 절감폭이 작음 |
| `Approvals` | 승인 목록 fetch는 탭 진입 시 로드, broad polling 없음 | `keep` | 현재 유지 | 없음 |
| `Service Requests / Sales` | 운영 핵심 write 경계, 부하보다 정확성이 우선 | `keep` | 현재 유지 | 없음 |
| `Header admin access` | `SiteHeader`는 `menu open`일 때만 `/api/admin/access` 호출, 다만 route는 `users + admin_whitelist + profiles`를 읽음 | `slow` | 현재도 lazy라 급한 제거 대상은 아님. 다만 admin button이 꼭 필요 없다면 더 늦출 수 있음 | 메뉴 열 때 admin 노출이 약간 늦어질 수 있음 |
| `sidebar-counts`, `team-counts` | current `Sidebar.tsx` consumer 없음. docs/tests만 남은 dormant compatibility route | `remove candidate` | 실제 product consumer 0 유지가 확정되면 후속 배치에서 제거 검토 | 구형 테스트/호환 계약을 함께 정리해야 함 |

## Tab-by-Tab Findings

### 1. Team Workspace
- 근거 파일
  - `app/admin/dashboard/components/TeamTab.tsx`
  - `app/admin/dashboard/hooks/useTeamWorkspaceAdminSession.ts`
  - `app/api/admin/team/bootstrap/route.ts`
- 현재 구조
  - 진입 시 `/api/admin/team/bootstrap` 호출
  - bootstrap이 `admin_tasks` 최근 100건, 그 task ids의 `admin_task_comments`, 전체 `admin_whitelist`를 함께 반환
  - session hook은 `auth.getUser()` 후 `fetchAdminAccess()`를 재시도 딜레이 `[0, 500, 1500]`으로 부름
  - realtime 이벤트가 `admin_tasks`, `admin_task_comments`, `admin_whitelist`에 걸려 있고, 일부는 전체 bootstrap 재호출로 이어짐
- 판단
  - 현재 admin 쪽 최우선 부담 후보입니다.
  - 특히 `admin_whitelist` GET 다발과 구조적으로 가장 잘 연결됩니다.

### 2. Users
- 근거 파일
  - `app/admin/dashboard/hooks/useAdminUsersData.ts`
  - `app/admin/dashboard/components/UsersTab.tsx`
  - `app/api/admin/users-summary/route.ts`
  - `app/api/admin/users-activity-summary/route.ts`
- 현재 구조
  - 목록 route는 `profiles` 최대 5000건과 `users.role` batch merge를 수행
  - 탭은 `online_users` presence channel을 별도로 유지
  - 기본적으로 상위 50명, `total_spent` 정렬이면 200명까지 `/api/admin/users-activity-summary`를 선조회
  - summary route는 요청 ids에 대해 `bookings`, `service_requests`, `service_bookings`, `reviews`, `inquiries`를 한 번에 훑음
- 판단
  - 현재 가장 뚜렷한 “없애도 운영 핵심 안 깨지는 비용”은 `online presence`와 `200명 선조회`입니다.

### 3. Audit Log
- 근거 파일
  - `app/admin/dashboard/components/AuditLogTab.tsx`
  - `app/api/admin/audit-logs/route.ts`
- 현재 구조
  - 최초 load 후 realtime `admin_audit_logs` 구독
  - 동시에 5초마다 `/api/admin/audit-logs` 재호출
  - route는 최근 100건을 매번 새로 읽음
- 판단
  - 비용 대비 가치가 가장 낮은 중복입니다.
  - 어드민 화면 중 가장 쉽게 `수동 새로고침`으로 바꿀 수 있는 영역입니다.

### 4. Analytics
- 근거 파일
  - `app/admin/dashboard/hooks/useAnalyticsSummaryData.ts`
  - `app/api/admin/analytics-summary/route.ts`
  - `app/api/admin/analytics-host-summary/route.ts`
- 현재 구조
  - `business` 탭은 최대 3개 summary endpoint 병렬 호출
  - `host` 탭은 별도 summary endpoint 호출
  - 각 route 자체도 `bookings`, `profiles`, `search_logs`, `analytics_events`, `service_bookings`, `host_applications`, `reviews`, `inquiries`, `inquiry_messages` 등 폭넓은 read를 가짐
- 판단
  - 운영 action 직결 화면이 아니라서 자동 로드가 꼭 필요하지 않습니다.
  - “열자마자 숫자 뜸”을 포기하면 비용을 꽤 줄일 수 있습니다.

### 5. Ledger
- 근거 파일
  - `app/admin/dashboard/components/MasterLedgerTab.tsx`
  - `app/api/admin/master-ledger/route.ts`
- 현재 구조
  - `bookings` / `service_bookings` realtime insert/update마다 ledger 전체를 다시 읽음
  - route는 bookings, experiences, profiles, host_applications, service_requests, service_applications까지 조합해 normalize
- 판단
  - 정산/입금 확인용으로 중요하지만, “실시간 리스트 반영”은 필수는 아닙니다.
  - write 이후만 직접 refresh하면 충분합니다.

### 6. Phone Reservation
- 근거 파일
  - `app/admin/dashboard/components/PhoneReservationTab.tsx`
  - `app/api/proxy-bookings/route.ts`
- 현재 구조
  - 목록 load 후 selected detail 추가 fetch
  - realtime `proxy_requests`, `inquiry_messages` 이벤트가 들어오면 목록과 상세를 다시 맞춤
  - 목록 route도 proxy_requests + profiles merge를 수행
- 판단
  - 실시간이 편하긴 하지만, 비용 우선이면 list/detail을 분리해 manual로 돌리는 편이 낫습니다.

### 7. Admin Chat
- 근거 파일
  - `app/admin/dashboard/hooks/useAdminChatQuery.ts`
  - `app/api/admin/inquiries/route.ts`
- 현재 구조
  - 목록 route는 `inquiries` 최근 100건 + host profiles + host_applications + guest profiles + unread aggregation
  - realtime 이벤트 후 list refresh가 자주 돌고, `loadMessages()` 후에도 다시 `fetchInquiries(false)`를 수행
- 판단
  - 완전 제거 대상은 아니지만, refresh 빈도를 늦추면 부담을 줄일 수 있습니다.

## Keep / Slow / Manual / Remove

### Keep
- `Approvals`
- `Service Requests`
- `Sales / Settlement`
- `Admin Alerts` 기본 구조

### Slow
- `Admin Chat` 목록 refresh
- `Header admin access`
- `Alerts`가 문제되기 시작하면 realtime 대신 긴 주기 refresh

### Manual
- `Team Workspace`
- `Analytics`
- `Ledger`
- `Phone Reservation`

### Remove
- `Users` online presence
- `Users` 50/200명 activity summary 선조회
- `Audit Log` 5초 polling fallback

### Remove Candidate
- `/api/admin/sidebar-counts`
- `/api/admin/team-counts`
  - 단, current UI consumer 0 + 테스트 계약 정리까지 같이 확인된 뒤 후속 배치로 분리

## Recommended Reduction Order
1. `Audit Log` 5초 polling 제거
2. `Users` presence 제거 + summary prefetch 강축소
3. `Team Workspace` bootstrap 분리 + realtime broad refetch 축소
4. `Analytics` 수동 조회화
5. `Ledger` realtime 제거
6. `Phone Reservation` list/detail refresh 분리
7. dormant count route 제거 여부 확정

## One-Line Conclusion
어드민 대시보드에서 가장 현실적으로 부담을 줄일 수 있는 부분은 `운영 핵심 write는 유지`하고, `Users/Team/Audit/Analytics/Ledger/Phone Reservation`의 실시간성·선조회·넓은 refetch를 줄이는 것입니다. 지금 기준 최우선은 `Team Workspace`, `Users`, `Audit Log` 세 군데입니다.
