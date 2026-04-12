# 어드민 대시보드 전체 탭 엔드투엔드 구조 점검

## Summary
- 감사 범위: `좌측 사이드바/카운트 계약 → Management → Operation → Finance → 비노출·레거시 surface`
- 실제 운영 탭 기준
  - `APPROVALS`
  - `USERS`
  - `ALERTS`
  - `CHATS`
  - `TEAM`
  - `LEDGER`
  - `SERVICE_REQUESTS`
  - `SALES`
  - `ANALYTICS`
- 실행 방식: 정적 코드 감사 + 대표 non-live E2E 재실행
- 이번 패스 핵심 결론
  - 탭 본체 기준으로는 `Approvals`, `Users`, `Alerts`, `Chats`, `Team`, `Ledger`, `Service Requests`, `Sales`, `Analytics`가 현재 source of truth와 크게 어긋나지 않는다
  - `좌측 사이드바 숫자/배지`는 현재 제품에서 의도적으로 제거된 상태다
    - `/api/admin/sidebar-counts`, `/api/admin/team-counts`는 살아 있지만
    - 현재 `Sidebar.tsx`에는 해당 숫자를 소비하거나 렌더링하는 코드가 없다
    - `adminBadgeState.ts`는 사이드바 렌더링에는 더 이상 연결되지 않지만, `TeamTab`과 `MasterLedgerTab`의 로컬 viewed-state helper로는 일부 사용 중이다
    - 이는 성능 최적화와 Vercel 영향 축소를 위한 의도된 제거로 해석해야 한다
    - 따라서 남아 있는 것은 제품 버그라기보다 `stale contract / stale E2E / dormant route` 정리 문제다
  - 따라서 현재 최종 판정은 다음과 같다
    - `대시보드 탭 본체`: 대체로 `정상`
    - `좌측 카운트 계약`: `의도된 제거`
    - `비노출 surface`: `부분 보장`
      - `APPS / EXPS / SETTLEMENT`는 current sidebar에는 없지만 direct query/localStorage alias로는 아직 reachable하다
      - `RealtimeTab / RealtimeBookings`는 current shell 기준 import-orphan에 가깝다

## Test Execution
- 대표 재실행 스펙
  - `tests/e2e/07-admin-approvals.spec.ts`
  - `tests/e2e/11-admin-users.spec.ts`
  - `tests/e2e/13-admin-alerts.spec.ts`
  - `tests/e2e/14-admin-chats.spec.ts`
  - `tests/e2e/17-admin-sidebar.spec.ts`
  - `tests/e2e/18-admin-team-badge.spec.ts`
  - `tests/e2e/06-admin-master-ledger.spec.ts`
  - `tests/e2e/10-admin-service-requests.spec.ts`
  - `tests/e2e/08-admin-billing.spec.ts`
  - `tests/e2e/09-admin-analytics.spec.ts`
- fresh webserver 전 cold batch 결과
  - `localhost:3000` 미기동 상태에서 첫 배치가 `ERR_CONNECTION_REFUSED`로 실패
  - 이 결과는 제품 판정에서 제외
- fresh webserver 후 warmed rerun 결과
  - `07-admin-approvals`: `passed`
  - `11-admin-users`: `passed`
  - `13-admin-alerts`: `passed`
  - `14-admin-chats`: `passed`
  - `06-admin-master-ledger`: `passed`
  - `10-admin-service-requests`: `passed`
  - `08-admin-billing`: `passed`
  - `09-admin-analytics`: `passed`
  - `17-admin-sidebar`: cold 기대값 기준 `failed` 후, 현재 의도에 맞게 조정한 rerun `passed`
    - 현재 기대: unread alert가 있어도 좌측 `Admin Alerts` 버튼은 plain label만 유지
  - `18-admin-team-badge`: cold 기대값 기준 `failed` 후, 현재 의도에 맞게 조정한 rerun `passed`
    - 현재 기대: new workspace activity가 있어도 좌측 `Team Workspace` 버튼은 plain label만 유지
  - admin shell/count close-out subset
    - `tests/e2e/17-admin-sidebar.spec.ts`
    - `tests/e2e/18-admin-team-badge.spec.ts`
    - `tests/e2e/69-admin-role-access.spec.ts`
    - `tests/e2e/161-admin-support-unread-alerts.spec.ts`
    - `6 passed (38.3s)` under `playwright.contracts.config.ts`
- 관찰 메모
  - warmup 이전에는 `/login` 이후 첫 화면 load 대기 때문에 admin 스모크가 흔들렸지만, warmed rerun에서는 탭 본체 스펙 대부분이 정상 복구됐다
  - `17`, `18`의 초기 failure는 제품 회귀가 아니라 “예전 badge 계약을 그대로 기대한 stale test”로 분류하는 것이 맞다
  - latest close-out subset 기준 `69`, `161`도 green이다
    - admin role/whitelist access gate
    - plain sidebar intent
    - team viewed-state/count API
    - admin support unread side effect
    가 현재 shell 해석과 충돌하지 않음이 다시 확인됐다
  - 따라서 최종 판정은 warmed rerun과 현재 제품 의도를 기준으로 잡는다

## Summary Matrix
| 구간 | source of truth | 현재 보장 테스트 | 판정 | 핵심 메모 |
| --- | --- | --- | --- | --- |
| 공통 셸 / 접근 제어 | `app/admin/layout.tsx`, `app/admin/dashboard/page.tsx`, `/api/admin/access`, `resolveAdminAccess` | `69`, 이번 대표 rerun 전반 | 정상 | admin whitelist/access gate와 탭 라우팅은 유지된다 |
| 좌측 사이드바 숫자 계약 | `Sidebar.tsx`, `/api/admin/sidebar-counts`, `/api/admin/team-counts`, `adminBadgeState.ts` | `17`, `18`, `161` | 의도된 제거 | count route는 남아 있지만 현재 제품은 좌측 숫자를 노출하지 않고, `adminBadgeState.ts`는 탭 내부 로컬 상태용으로만 일부 남아 있다 |
| Approvals | `useAdminApprovalsData`, `/api/admin/host-applications`, `/api/admin/experiences`, `updateAdminStatus()`, `ManagementTab` | `07`, `164`, 이번 rerun `07` | 정상 | `APPS/EXPS` 서브탭과 승인/보완/거절 write는 현재 정합적 |
| Users | `useAdminUsersData`, `/api/admin/users-summary`, `/api/admin/users-activity-summary`, `/api/admin/users/[userId]/timeline`, `UsersTab` | `11`, 이번 rerun `11` | 정상 | 목록과 상세 패널, `guestReviews` additive timeline이 현재 일치 |
| Alerts | `/api/admin/alerts*`, realtime `notifications`, `AdminAlertsTab` | `13`, `17`, 이번 rerun `13`, `17` | 정상 | 탭 본체는 정상이고, 좌측 count 미노출도 현재 의도와 일치한다 |
| Chats | `useAdminChatQuery`, `/api/admin/inquiries*`, `/api/inquiries/message`, `ChatMonitor` | `14`, `83`, `161`, 이번 rerun `14` | 정상 | 본체는 정상이며 좌측 count 미노출은 stale contract 영역이다 |
| Team | `useTeamWorkspaceAdminSession`, `/api/admin/team/*`, `/api/admin/team-counts`, `TeamTab` | `15`, `16`, `18`, `79`, `86`, `89`, `136`, 이번 rerun `18` | 정상 | `todo/memo/proxy` 본체는 정상이고, 좌측 workspace badge는 의도적으로 제거된 상태다 |
| Ledger | `/api/admin/master-ledger`, `/api/admin/bookings/*`, `MasterLedgerTab`, `markAdminBookingViewed` | `06`, `115`, `150`, `135`, 이번 rerun `06` | 정상 | 탭 본체는 정상이고, `markAdminBookingViewed`는 현재 사이드바가 아니라 탭 내부 viewed-state 기록용으로만 남아 있다 |
| Service Requests | `useServiceAdminData`, `/api/admin/service-bookings`, `/api/admin/service-confirm-payment`, `/api/admin/service-cancel`, `/api/admin/service-payouts/mark-paid`, `ServiceAdminTab` | `10`, `132`, 이번 rerun `10` | 정상 | `ALL/SETTLEMENT/REFUND` 본체는 정상이고, sidebar pending count는 현재 제품에서 쓰지 않는다 |
| Sales | `/api/admin/sales-summary`, `/api/admin/payout-queue`, `settleHostPayout`, `/api/admin/settlement-sync`, `SalesTab` | `08`, `130`, `134`, `155`, `156`, `157`, `158`, `160`, 이번 rerun `08` | 정상 | pending/completed 정산 view와 sync panel은 현재 유지 |
| Analytics | `/api/admin/analytics-*`, `/api/admin/reviews`, `/api/admin/audit-logs`, `AnalyticsTab` | `09`, `70`, 이번 rerun `09` | 정상 | `business/host/reviews/logs` 탭 분기와 route 호출 의미는 유지 |
| 비노출 / 레거시 surface | `ManagementTab`의 `SETTLEMENT`, `RealtimeTab`, `RealtimeBookings` | 별도 direct E2E 없음 | 부분 보장 | `APPS / EXPS / SETTLEMENT`는 direct query alias로는 reachable하고, `Realtime*`는 current shell 기준 import-orphan에 가깝다 |

## Chain-by-Chain Audit

### 1. 공통 셸과 좌측 사이드바 숫자 계약
- source of truth
  - `app/admin/layout.tsx`
  - `app/admin/dashboard/page.tsx`
  - `app/admin/dashboard/components/Sidebar.tsx`
  - `app/api/admin/access/route.ts`
  - `app/api/admin/sidebar-counts/route.ts`
  - `app/api/admin/team-counts/route.ts`
  - `app/utils/adminBadgeState.ts`
- 기대 동작
  - layout에서 admin session과 whitelist를 확인한 뒤 `/admin/dashboard` shell을 연다
  - `page.tsx`는 `?tab=` 또는 `localStorage.admin_active_tab`을 기준으로 현재 탭을 결정한다
  - 과거 계약상 좌측 버튼은 unread/pending/new count를 노출할 수 있었다
    - `Approvals`: `appsCount + expsCount` 계열
    - `Alerts`: `adminAlertsUnread`
    - `Chats`: `csUnreadCount`
    - `Team`: `newWorkspaceCount`
    - `Ledger`: `pendingBookingIds -> unviewed pending booking count`
    - `Service Requests`: `svcBankPendingCount`
  - 현재 제품 의미는 “좌측 숫자 제거, plain label 유지”로 보는 것이 맞다
- 실제 확인 결과
  - `app/admin/layout.tsx`의 admin gate는 정상이다
    - 로그인 없으면 `/login`
    - whitelist 불일치면 `/`
  - `page.tsx`는 현재 운영 탭 9개를 분기한다
    - `TEAM`, `ALERTS`, `CHATS`, `SERVICE_REQUESTS`, `SALES`, `LEDGER`, `ANALYTICS`, `USERS`, `APPROVALS`
  - confirmed interpretation
    - 현재 `Sidebar.tsx`의 `NavButton`은 `icon + label`만 렌더하고, count/badge prop이 없다
    - 저장소 검색 기준 `sidebar-counts` API 값을 `Sidebar.tsx`에서 읽는 consumer가 보이지 않는다
    - `team-counts`도 마찬가지로 실제 sidebar button에 연결된 코드가 보이지 않는다
    - `adminBadgeState.ts` 전체가 dormant는 아니다
      - `TeamTab`은 `ensureAdminTeamLastViewed()`, `markAdminTeamViewed()`를 여전히 사용한다
      - `MasterLedgerTab`은 `markAdminBookingViewed()`를 여전히 사용한다
      - 현재 미사용으로 보이는 것은 `getAdminUnviewedPendingBookingCount()`처럼 “사이드바 숫자”에 직접 연결되던 부분이다
    - 현재 제품 의도 기준으로 바꾼 `17-admin-sidebar`, `18-admin-team-badge` rerun은 둘 다 green이다
    - latest close-out subset에서 `69-admin-role-access`, `161-admin-support-unread-alerts`도 green이다
      - `69`는 role-only / whitelist-only admin access가 current layout + `/api/admin/access` gate와 계속 맞는다는 근거다
      - `161`는 admin support unread batch lifecycle이 현재 unread source와 side effect 의미를 유지한다는 근거다
      - 즉 `/api/admin/sidebar-counts`의 `csUnreadCount`가 current sidebar에 렌더되진 않더라도 unread source 자체가 깨진 상태는 아니다
  - drift
    - `page.tsx` default fallback은 `APPROVALS`
    - `Sidebar.tsx` fallback은 `APPS`
    - 현재는 대부분 URL/localStorage가 덮어써서 치명적 증거는 없지만, alias drift로 남는다
  - 판정: `의도된 제거`

### 2. Management: Approvals / Users

#### 2-1. Approvals
- source of truth
  - `app/admin/dashboard/hooks/useAdminApprovalsData.ts`
  - `app/api/admin/host-applications/route.ts`
  - `app/api/admin/experiences/route.ts`
  - `app/actions/admin.ts`의 `updateAdminStatus()`
  - `app/admin/dashboard/components/ManagementTab.tsx`
- 기대 상태 전이
  - `APPROVALS`는 내부 `APPS / EXPS` 서브탭으로 움직인다
  - read는 `host_applications`, `experiences`
  - write는 `updateAdminStatus()`와 `/api/admin/delete`
- 실제 결과
  - `useAdminApprovalsData`는 summary fetch와 refresh/write를 한 군데서 관리한다
  - `ManagementTab`은 `APPROVALS`일 때만 내부 `subTab`을 쓰고, pending/revision 의미도 분리한다
  - rerun `07-admin-approvals` green
  - 판정: `정상`

#### 2-2. Users
- source of truth
  - `app/admin/dashboard/hooks/useAdminUsersData.ts`
  - `app/api/admin/users-summary/route.ts`
  - `app/api/admin/users-activity-summary/route.ts`
  - `app/api/admin/users/[userId]/timeline/route.ts`
  - `app/admin/dashboard/components/UsersTab.tsx`
- 기대 상태 전이
  - 목록 summary는 `profiles + users.role`
  - 상세 패널은 `bookings`, `reviews`, `guest_reviews`, `inquiries`, `service_requests`, `service_bookings`를 timeline으로 합친다
  - `guestReviews`는 timeline과 별도 read-only section으로 additive 제공한다
- 실제 결과
  - `users-summary`는 `profiles`와 `users.role`을 병합해 목록 truth를 만든다
  - timeline route는 `guest_reviews`를 `kind='review'` timeline item + `guestReviews` 상세 배열 둘 다로 노출한다
  - `UsersTab`은 이 additive contract를 그대로 소비한다
  - rerun `11-admin-users` green
  - 판정: `정상`

### 3. Operation: Alerts / Chats / Team

#### 3-1. Alerts
- source of truth
  - `app/api/admin/alerts/route.ts`
  - `app/api/admin/alerts/[id]/route.ts`
  - `app/api/admin/alerts/read-all/route.ts`
  - `app/admin/dashboard/components/AdminAlertsTab.tsx`
- 기대 상태 전이
  - `notifications(type='admin_alert')`를 read model로 사용
  - unread/all 필터, mark read, mark all, delete가 가능해야 한다
  - sidebar unread도 같은 `admin_alert unread` 사실을 봐야 한다
- 실제 결과
  - 탭 본체는 current admin + `type='admin_alert'`를 기준으로 read/write가 일관된다
  - realtime subscription도 `notifications` 기반이다
  - rerun `13-admin-alerts`, `17-admin-sidebar` green
  - sidebar unread badge는 현재 intentionally not rendered다
  - 판정: `정상`

#### 3-2. Chats
- source of truth
  - `app/admin/dashboard/hooks/useAdminChatQuery.ts`
  - `app/api/admin/inquiries/route.ts`
  - `/api/admin/inquiries/[id]/messages`
  - `/api/admin/inquiries/[id]/status`
  - `/api/inquiries/message`
  - `app/admin/dashboard/components/ChatMonitor.tsx`
- 기대 상태 전이
  - 문의 목록은 `inquiries + guest/host/experience + unread_count` 조합이어야 한다
  - 답변, status 변경, soft delete, policy signal이 같은 inquiry truth를 공유해야 한다
  - sidebar `csUnreadCount`도 admin support/admin type unread와 정합적이어야 한다
- 실제 결과
  - `/api/admin/inquiries`는 `inquiries`를 기준으로 guest/host profile, unread counts, policy signal을 합친다
  - `ChatMonitor` 내부 뷰는 `monitor / admin`이고, `useAdminChatQuery`가 목록/선택/메시지/실시간 refresh를 한 곳에서 묶는다
  - rerun `14-admin-chats` green
  - sidebar `csUnreadCount`는 current UI에서 소비하지 않지만, 이는 현재 제거 의도와 맞는다
  - 판정: `정상`

#### 3-3. Team
- source of truth
  - `app/admin/dashboard/hooks/useTeamWorkspaceAdminSession.ts`
  - `app/api/admin/team/bootstrap/route.ts`
  - `app/api/admin/team/tasks/route.ts`
  - `app/api/admin/team/comments/route.ts`
  - `app/api/admin/team/chat/route.ts`
  - `app/api/admin/team/whitelist/route.ts`
  - `app/api/admin/team-counts/route.ts`
  - `app/admin/dashboard/components/TeamTab.tsx`
  - `app/admin/dashboard/components/PhoneReservationTab.tsx`
- 기대 상태 전이
  - `Team Workspace`는 `todo / memo / proxy` 서브탭을 가진다
  - `proxy`는 팀 탭 내부의 current 운영 surface다
  - `team-counts`와 `last_viewed_team`이 좌측 badge clear semantics를 만든다
- 실제 결과
  - `TeamTab`은 현재 `todo / memo / proxy`로 분기하고, `proxy`는 `PhoneReservationTab`을 직접 포함한다
  - `useTeamWorkspaceAdminSession`은 auth/session retry와 admin access를 별도 관리한다
  - `team-counts`는 `admin_tasks`와 `admin_task_comments`에서 workspace count를 만든다
  - `adminBadgeState.ts`는 user-scoped `last_viewed_team` key를 지원하고, `TeamTab` 내부 viewed timestamp 기록에는 아직 live다
  - `18-admin-team-badge` rerun 기준, backend `newWorkspaceCount`가 생겨도 sidebar label은 plain text로 유지된다
  - 현재는 이 상태를 성능 최적화를 위한 intentional behavior로 본다
  - 판정: `정상`

### 4. Finance: Ledger / Service Requests / Sales / Analytics

#### 4-1. Ledger
- source of truth
  - `app/api/admin/master-ledger/route.ts`
  - `app/api/admin/bookings/confirm-payment/route.ts`
  - `app/api/admin/bookings/force-cancel/route.ts`
  - `app/api/admin/bookings/reject-host-unavailable/route.ts`
  - `app/admin/dashboard/components/MasterLedgerTab.tsx`
  - `app/utils/adminBadgeState.ts`
- 기대 상태 전이
  - experience booking ledger를 기준으로 bank confirm/cancel/refund와 viewed/unviewed pending tracking을 함께 본다
  - sidebar count는 `pendingBookingIds -> getAdminUnviewedPendingBookingCount()` 의미여야 한다
- 실제 결과
  - `master-ledger` route는 experience bookings + service_bookings를 date 기준으로 normalize해서 ledger truth를 만든다
  - `MasterLedgerTab`은 realtime subscription과 `markAdminBookingViewed`를 쓴다
  - rerun `06-admin-master-ledger` green
  - `getAdminUnviewedPendingBookingCount()`를 소비하는 sidebar pending badge consumer는 현재 보이지 않지만, 현재 제품에서는 plain sidebar가 의도다
  - 따라서 `adminBadgeState.ts`는 “전체 제거 후보”라기보다 “탭 내부 helper와 예전 sidebar count 로직이 섞여 있는 파일”로 분리해서 보는 편이 안전하다
  - 판정: `정상`

#### 4-2. Service Requests
- source of truth
  - `app/admin/dashboard/hooks/useServiceAdminData.ts`
  - `app/api/admin/service-bookings/route.ts`
  - `app/api/admin/service-confirm-payment/route.ts`
  - `app/api/admin/service-cancel/route.ts`
  - `app/api/admin/service-payouts/mark-paid/route.ts`
  - `app/api/admin/service-requests/route.ts`
  - `app/api/admin/service-bookings-csv/route.ts`
  - `app/admin/dashboard/components/ServiceAdminTab.tsx`
- 기대 상태 전이
  - `ALL / SETTLEMENT / REFUND` 서브탭
  - booking/request/application/customer/host/application/host_application을 합쳐 admin read model을 만든다
  - sidebar count는 bank pending service bookings를 반영해야 한다
- 실제 결과
  - `service-bookings` route는 service bookings를 request/customer/host/application/host_application까지 enrich한다
  - `ServiceAdminTab`은 `ALL / SETTLEMENT / REFUND`를 현재 운영 서브탭으로 쓴다
  - rerun `10-admin-service-requests` green
  - server log에서도 `POST /api/admin/service-confirm-payment 200`이 실제로 남았다
  - `svcBankPendingCount`는 현재 sidebar 미노출 상태지만, 제품 의도와 충돌하지 않는다
  - 판정: `정상`

#### 4-3. Sales
- source of truth
  - `app/api/admin/sales-summary/route.ts`
  - `app/api/admin/payout-queue/route.ts`
  - `app/api/admin/settlement-sync/route.ts`
  - `app/actions/admin.ts`의 `settleHostPayout()`
  - `app/admin/dashboard/components/SalesTab.tsx`
  - `app/admin/dashboard/components/SettlementSyncPanel.tsx`
- 기대 상태 전이
  - experience + service domain을 묶은 sales summary와 payout queue를 본다
  - 내부 settlement view는 `PENDING / COMPLETED`
  - manual sync와 payout action이 같은 queue truth를 봐야 한다
- 실제 결과
  - `sales-summary` route는 experience bookings와 service bookings를 created_at 기준으로 함께 요약한다
  - `payout-queue` route는 experience/service domain group을 host별로 결합한다
  - `SalesTab`은 `PENDING / COMPLETED` settlement 뷰와 sync panel을 노출한다
  - rerun `08-admin-billing` green
  - 판정: `정상`

#### 4-4. Analytics
- source of truth
  - `app/api/admin/analytics-summary/route.ts`
  - `app/api/admin/analytics-search-intent/route.ts`
  - `app/api/admin/analytics-customer-composition/route.ts`
  - `app/api/admin/analytics-host-summary/route.ts`
  - `app/api/admin/reviews/route.ts`
  - `app/api/admin/audit-logs/route.ts`
  - `app/admin/dashboard/components/AnalyticsTab.tsx`
  - `app/admin/dashboard/components/ReviewsTab.tsx`
  - `app/admin/dashboard/components/AuditLogTab.tsx`
- 기대 상태 전이
  - 내부 탭은 `business / host / reviews / logs`
  - `business`와 `host`는 server summary route를 기본 truth로 삼고 fallback source를 표시해야 한다
  - `reviews`는 public `reviews`
  - `logs`는 운영 감사 로그
- 실제 결과
  - `AnalyticsTab`은 탭에 따라 route 호출이 다르고, `reviews`는 `ReviewsTab`, `logs`는 `AuditLogTab`으로 분리한다
  - `analytics-summary` route는 experience + service booking을 함께 집계하고, review/search/event data를 섞는다
  - rerun `09-admin-analytics` green
  - 판정: `정상`

### 5. 비노출·레거시·도달성 정리
- 확인 대상
  - `app/admin/dashboard/components/ManagementTab.tsx`의 `SETTLEMENT` branch
  - `app/admin/dashboard/components/RealtimeTab.tsx`
  - `app/admin/dashboard/components/RealtimeBookings.tsx`
- 실제 결과
  - `ManagementTab` 내부에는 `activeTab === 'SETTLEMENT'` 분기가 남아 있다
  - `page.tsx`는 현재 운영 탭 9개 외의 값에 대해 `DataDrivenAdminTab`으로 fallback 한다
    - 따라서 `/admin/dashboard?tab=SETTLEMENT`는 `ManagementTab -> SettlementTab`으로 여전히 direct reachability가 있다
    - 같은 구조로 legacy alias인 `/admin/dashboard?tab=APPS`, `/admin/dashboard?tab=EXPS`도 여전히 direct reachability가 있다
  - `Sidebar.tsx`는 `APPROVALS` 버튼 active 판정에 `APPS`, `EXPS`를 여전히 포함한다
    - 즉 UI 노출은 `APPROVALS` 하나로 줄었지만, shell contract 차원에서는 alias drift가 아직 살아 있다
  - 반면 `RealtimeTab`, `RealtimeBookings`는 저장소 검색 기준 current page/sidebar/컴포넌트 import graph에서 소비 흔적이 없다
    - export는 남아 있지만 current shell 기준 import-orphan로 보는 편이 맞다
  - 반면 `PhoneReservationTab`은 비노출 레거시가 아니라 `TEAM.proxy`의 active 운영 surface다
- 판정
  - `ManagementTab.SETTLEMENT`: `부분 보장`
    - 사유: current sidebar에는 없지만 direct query alias로는 reachable하다
  - `APPS`, `EXPS`: `부분 보장`
    - 사유: 공식 운영 탭은 아니지만 direct query/localStorage alias는 남아 있다
  - `RealtimeTab`, `RealtimeBookings`: `범위밖에 가까운 레거시 잔존`
    - 사유: current shell 기준 consumer/import가 보이지 않는다

## Confirmed Findings
### 1. 좌측 사이드바 숫자 계약은 현재 의도적으로 제거된 상태다
- confirmed
- 근거
  - `Sidebar.tsx`에 badge/count prop 또는 count fetch/useEffect가 없다
  - 사용자 의도 설명상 이것은 성능 최적화와 Vercel 영향 축소를 위해 일부러 제거한 것이다
  - `17-admin-sidebar`, `18-admin-team-badge`를 현재 기대값으로 바꾼 rerun이 둘 다 green이다
- 영향 범위
  - `/api/admin/sidebar-counts`, `/api/admin/team-counts`는 current product path 기준 dormant route로 볼 수 있다
  - 반면 `adminBadgeState.ts`는 일부 helper가 아직 `TeamTab`, `MasterLedgerTab` 내부에 연결돼 있다
  - 따라서 지금 남은 문제는 “숫자 계약” 기준 stale contract 정리이지, 해당 helper 파일 전체 삭제가 아니다

### 2. 탭 본체는 warmed rerun 기준 대부분 정상이다
- confirmed
- 근거
  - `07`, `11`, `13`, `14`, `06`, `10`, `08`, `09` 모두 fresh server + warmed rerun 기준 green
- 해석
  - 현재 admin 도메인의 주 잔여 과제는 탭 본체 기능보다 stale sidebar contract 정리에 더 가깝다

### 3. `APPROVALS` vs `APPS` fallback alias drift가 남아 있다
- confirmed but low severity
- 근거
  - `page.tsx` 기본 fallback은 `APPROVALS`
  - `Sidebar.tsx` 내부 fallback은 `APPS`
- 영향
  - 현재는 URL/localStorage가 대부분 덮어써서 즉시 재현 bug는 아니지만, shell contract를 흐리는 drift다

### 4. 비노출 레거시 surface는 성격이 둘로 갈린다
- confirmed
- 근거
  - `ManagementTab.SETTLEMENT`는 `page.tsx`의 fallback 구조 때문에 `/admin/dashboard?tab=SETTLEMENT`로 direct reachability가 있다
  - `APPS`, `EXPS`도 같은 방식으로 legacy alias reachability가 남아 있다
  - `RealtimeTab`, `RealtimeBookings`는 current shell 기준 import consumer가 보이지 않는다
- 영향
  - 후속 정리는 한 묶음으로 삭제하면 안 된다
  - `SETTLEMENT/APPS/EXPS`는 먼저 “숨은 진입면을 닫을지 유지할지” 결정이 필요하고,
  - `Realtime*`는 그 다음 “완전 제거 후보”로 보는 편이 더 안전하다

## Coverage Gaps
- `15-admin-team`, `16-admin-team-chat`, `79`, `86`, `89`, `136`은 이번 패스에서 full rerun하지 않았다
  - `TeamTab` static audit과 `18` rerun으로 current plain-label intent는 이미 확인됐다
- `SETTLEMENT/APPS/EXPS`는 static route reachability는 닫았지만, 실제 운영에서 의도적으로 허용한 deep link인지까지는 문서 근거가 약하다
- `RealtimeTab`, `RealtimeBookings`는 import graph 기준 orphan로 보이지만, 과거 외부 bookmark/manual entry까지는 이번 패스에서 검증하지 않았다

## Follow-up Need
- 1순위 후속 정리
  - 감사 문서와 테스트 기준을 현재 제품 의도와 계속 맞춰 유지해야 한다
  - `17`, `18`, 관련 내부 문서에서 “badge가 보여야 한다”는 옛 계약이 다시 살아나지 않게 잠그는 것이 우선이다
- 2순위 후속 코드 정리
  - `/api/admin/sidebar-counts`, `/api/admin/team-counts`를 앞으로도 유지할지 결정해야 한다
  - 다시 쓸 계획이 없으면 dormant route 정리로 Vercel/runtime surface를 더 줄일 수 있다
  - `adminBadgeState.ts`는 지금 당장 제거 대상이 아니라, sidebar count 전용 부분과 탭 내부 viewed-state helper를 분리할지 검토하는 편이 안전하다
  - 다시 쓸 계획이 있으면 최소한 deprecated/dormant contract로 문서화하는 편이 안전하다
- 3순위 후속 정리
  - `APPROVALS` / `APPS` fallback alias를 한쪽으로 통일
  - `SETTLEMENT`, `APPS`, `EXPS` direct query/localStorage alias를 유지할지 차단할지 결정
  - `RealtimeTab`, `RealtimeBookings`는 current shell 기준 consumer가 없으므로 제거 후보로 별도 분리 검토
- 현재 기준 즉시 제품 blocker는 아니다
  - 본문 탭 기능은 warmed rerun에서 green
  - 좌측 숫자 미노출도 현재 제품 의도와 일치한다
