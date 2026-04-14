# 어드민 route-owner 전수 감사

## Summary
- 이번 패스의 공식 owner 범위는 `app/api/admin/*` 전체 49개 route입니다.
- 결론부터 적으면, 현재 admin route-owner는 `탭 본체` 기준으로는 대부분 닫혀 있지만 `route-level fallback / hidden compatibility / orphan-like seam`은 여전히 admin 쪽이 저장소 내 최대 밀집 구간입니다.
- 이번 전수 결과를 분류 기준으로 잠그면 아래와 같습니다.
  - `active owner`: 41 routes
  - `shared internal utility route`: 3 routes
  - `dormant but intentional compatibility`: 2 routes
  - `removal candidate`: 3 routes
- 이번 패스에서 새로 가장 또렷하게 드러난 seam은 아래 3개입니다.
  - `/api/admin/bookings` GET은 현재 app/tests consumer가 사실상 사라진 former eager-load route입니다.
  - `/api/admin/team/chat`과 `/api/admin/team/comments/[id]`는 현재 Team Workspace surface에 마운트되지 않는 `GlobalTeamChat` 계열 orphan seam으로 좁혀집니다.
  - `team/comments` 자체는 current owner가 맞지만, 내부 `TEAM_CHAT_ROOM_ID` branch는 FK 제약 때문에 현재 생성 경로가 깨져 있습니다. 다만 이 branch는 current TeamTab surface에서 호출되지 않습니다.
- 따라서 다음 admin 판단은 “대형 구현”이 아니라 아래 순서가 안전합니다.
  - active owner는 유지
  - dormant compatibility는 문서로 의미를 잠그고 무리하게 삭제하지 않음
  - orphan/removal candidate는 current consumer를 먼저 0으로 확인한 뒤 별도 이슈로 걷어냄

## Scope And Method
- route inventory
  - `find app/api/admin -name route.ts | sort`
- consumer trace
  - `rg` 기준으로 `app/admin/dashboard/*`, 관련 hooks/utils, `tests/e2e/*`, 기존 최신 audit 문서를 역추적
- 직접 확인 owner
  - `page.tsx`, `Sidebar.tsx`, `ManagementTab.tsx`, `TeamTab.tsx`, `ChatMonitor.tsx`, `SalesTab.tsx`, `MasterLedgerTab.tsx`
  - `adminBadgeState.ts`, `useAnalyticsSummaryData.ts`, `useAdminUsersData.ts`, `useServiceAdminData.ts`, `useAdminApprovalsData.ts`
  - 주요 route: `sales-summary`, `payout-queue`, `settlement-sync`, `service-bookings`, `service-confirm-payment`, `service-payouts/mark-paid`, `sidebar-counts`, `team-counts`, `access`
- 분류 기준
  - `active owner`: current product surface가 직접 소비하는 source of truth
  - `shared internal utility route`: visible tab owner는 아니지만 현재 내부 동작/내보내기/write에 계속 쓰는 route
  - `dormant but intentional compatibility`: current UI는 안 쓰지만 현재 계약상 의도적으로 남겨둔 route
  - `removal candidate`: current consumer가 사실상 사라졌거나 orphan seam으로 좁혀진 route

## Bucket Summary
| 분류 | 개수 | route |
| --- | --- | --- |
| active owner | 41 | 대부분의 admin read/write route |
| shared internal utility route | 3 | `/api/admin/service-bookings-csv`, `/api/admin/notify-team`, `/api/admin/delete` |
| dormant but intentional compatibility | 2 | `/api/admin/sidebar-counts`, `/api/admin/team-counts` |
| removal candidate | 3 | `/api/admin/bookings`, `/api/admin/team/chat`, `/api/admin/team/comments/[id]` |

## Route Inventory

### 1. Finance / Sales / Settlement
| Route | Current source of truth | Still consumed | Classification | Note |
| --- | --- | --- | --- | --- |
| `/api/admin/master-ledger` | `MasterLedgerTab` | 예 | active owner | admin booking ledger read source |
| `/api/admin/bookings/confirm-payment` | `MasterLedgerTab` + booking confirm flow | 예 | active owner | 체험 무통장 확인 write owner |
| `/api/admin/bookings/force-cancel` | `MasterLedgerTab` | 예 | active owner | 체험 취소 write owner |
| `/api/admin/bookings/reject-host-unavailable` | `MasterLedgerTab` | 예 | active owner | host unavailable reject write owner |
| `/api/admin/bookings` | former `useAdminData` pagination route | 현재 product 기준 아니오 | removal candidate | docs에만 former eager-load 흔적이 남고 current app/tests literal consumer가 없다 |
| `/api/admin/service-bookings` | `useServiceAdminData`, `ServiceAdminTab` | 예 | active owner | service admin read owner, admin client/RLS 우회 의미가 아직 live |
| `/api/admin/service-bookings-csv` | `SalesTab` export | 예 | shared internal utility route | visible tab source라기보다 export utility |
| `/api/admin/service-requests` | `ServiceAdminTab` | 예 | active owner | service request backlog owner |
| `/api/admin/service-confirm-payment` | `ServiceAdminTab` | 예 | active owner | 서비스 무통장 확인 write + side effect/audit |
| `/api/admin/service-cancel` | `ServiceAdminTab` | 예 | active owner | 서비스 취소/refund write |
| `/api/admin/service-payouts/mark-paid` | `SalesTab` | 예 | active owner | 서비스 정산 완료 write, `payout_paid_at` fallback 보유 |
| `/api/admin/sales-summary` | `SalesTab`, `SettlementSyncPanel` | 예 | active owner | 경험/서비스 KPI 및 summary source |
| `/api/admin/payout-queue` | `SalesTab`, settlement runbook/test | 예 | active owner | unified host rollup source |
| `/api/admin/settlement-sync` | `SettlementSyncPanel` | 예 | active owner | health + manual trigger source, `admin_job_runs`/localhost test-hook seam 포함 |

### 2. Team / Workspace / Counts
| Route | Current source of truth | Still consumed | Classification | Note |
| --- | --- | --- | --- | --- |
| `/api/admin/team/bootstrap` | `TeamTab` | 예 | active owner | Team Workspace 초기 hydrate owner |
| `/api/admin/team/tasks` | `TeamTab` | 예 | active owner | daily log/todo create/read owner |
| `/api/admin/team/tasks/[id]` | `TeamTab` | 예 | active owner | todo/log update/delete owner |
| `/api/admin/team/comments` | `TeamTab` memo/todo comments | 예 | active owner | current Team Workspace 댓글 source of truth |
| `/api/admin/team/comments/[id]` | orphan `GlobalTeamChat` reaction path | current surface 기준 아니오 | removal candidate | current TeamTab에서는 호출되지 않고, literal consumer는 orphan `GlobalTeamChat` 계열뿐 |
| `/api/admin/team/whitelist` | `TeamTab` | 예 | active owner | whitelist add/read owner |
| `/api/admin/team/whitelist/[id]` | `TeamTab` | 예 | active owner | whitelist delete owner |
| `/api/admin/team/chat` | orphan `GlobalTeamChat` read path | current surface 기준 아니오 | removal candidate | current Team Workspace에 mount되지 않는다 |
| `/api/admin/notify-team` | `TeamTab`, proxy/team side effect | 예 | shared internal utility route | team email/alert utility route |
| `/api/admin/team-counts` | legacy sidebar workspace badge contract | tests/docs만 | dormant but intentional compatibility | current `Sidebar.tsx`는 숫자를 렌더링하지 않지만 lastViewed/count 계약은 남아 있음 |
| `/api/admin/sidebar-counts` | legacy sidebar count contract | tests/docs만 | dormant but intentional compatibility | current `Sidebar.tsx` no-consumer, 그러나 unread/pending source 의미는 여전히 존재 |

### 3. Analytics / Reviews / Audit
| Route | Current source of truth | Still consumed | Classification | Note |
| --- | --- | --- | --- | --- |
| `/api/admin/analytics-summary` | `useAnalyticsSummaryData` | 예 | active owner | business KPI owner |
| `/api/admin/analytics-host-summary` | `useAnalyticsSummaryData` | 예 | active owner | host summary owner |
| `/api/admin/analytics-search-intent` | `useAnalyticsSummaryData` | 예 | active owner | session/source migration fallback이 핵심 seam |
| `/api/admin/analytics-customer-composition` | `useAnalyticsSummaryData` | 예 | active owner | analytics composition owner |
| `/api/admin/reviews` | `ReviewsTab` | 예 | active owner | review moderation read owner |
| `/api/admin/reviews/[id]` | `ReviewsTab` | 예 | active owner | review delete/write owner |
| `/api/admin/audit-logs` | `AuditLogTab` | 예 | active owner | admin audit log read owner |

### 4. Users / Access / Alerts / Chats / Approvals / Shared
| Route | Current source of truth | Still consumed | Classification | Note |
| --- | --- | --- | --- | --- |
| `/api/admin/access` | `admin layout`, `adminAccessClient` | 예 | active owner | current admin access truth |
| `/api/admin/users-summary` | `useAdminUsersData` | 예 | active owner | user list owner |
| `/api/admin/users-activity-summary` | `UsersTab` | 예 | active owner | user activity summary owner |
| `/api/admin/users/[userId]/timeline` | `UsersTab` | 예 | active owner | user detail timeline owner |
| `/api/admin/alerts` | `AdminAlertsTab` | 예 | active owner | alerts read owner |
| `/api/admin/alerts/[id]` | `AdminAlertsTab` | 예 | active owner | alert mark-read/delete dynamic write owner |
| `/api/admin/alerts/read-all` | `AdminAlertsTab` | 예 | active owner | mark-all-read owner |
| `/api/admin/inquiries` | `useAdminChatQuery`, `ChatMonitor` | 예 | active owner | admin inquiry list owner |
| `/api/admin/inquiries/[id]/messages` | `useAdminChatQuery` | 예 | active owner | inquiry message read owner |
| `/api/admin/inquiries/[id]/status` | `ChatMonitor` | 예 | active owner | admin inquiry status write owner |
| `/api/admin/inquiries/messages/[messageId]` | `ChatMonitor` | 예 | active owner | soft-delete write owner |
| `/api/admin/host-applications` | `useAdminApprovalsData` | 예 | active owner | APPS source of truth |
| `/api/admin/experiences` | `useAdminApprovalsData` | 예 | active owner | EXPS source of truth |
| `/api/admin/delete` | approvals/users shared destructive action | 예 | shared internal utility route | visible tab owner가 아니라 shared delete utility, broad delete surface라서 주의 필요 |
| `/api/admin/proxy-bookings/confirm-payment` | `PhoneReservationTab`, `/proxy-bookings/[id]` | 예 | active owner | proxy payment confirm owner |
| `/api/admin/proxy-bookings/cancel-payment` | `PhoneReservationTab`, `/proxy-bookings/[id]` | 예 | active owner | proxy cancel owner |
| `/api/admin/proxy-bookings/refund-payment` | `PhoneReservationTab`, `/proxy-bookings/[id]` | 예 | active owner | proxy refund owner |

## Hidden Compatibility And Orphan Seams

### 1. `APPS / EXPS`는 아직 intentional hidden compatibility surface다
- current sidebar에는 `APPROVALS`만 보이지만, direct query/localStorage alias인 `APPS`, `EXPS`는 아직 열립니다.
- 이건 단순 stale string이 아니라 아래 consumer가 여전히 살아 있기 때문입니다.
  - `app/admin/dashboard/page.tsx`
  - `app/admin/dashboard/components/Sidebar.tsx`
  - `app/admin/dashboard/components/ManagementTab.tsx`
  - `app/admin/dashboard/components/ListPanel.tsx`
  - `app/admin/dashboard/components/DetailsPanel.tsx`
- 따라서 `APPS / EXPS`는 지금 당장 제거 후보가 아니라 hidden compatibility surface로 유지하는 판단이 맞습니다.

### 2. `SETTLEMENT`는 hidden screen이 아니라 closed legacy query다
- `normalizeAdminDashboardTab()`가 legacy `SETTLEMENT`를 공식 `SALES`로 정규화합니다.
- 즉 `SETTLEMENT`는 더 이상 별도 admin screen이 아니고, `APPS / EXPS`와 성격이 다릅니다.

### 3. `GlobalTeamChat` 계열은 현재 가장 분명한 orphan seam이다
- 이번 감사에서 `GlobalTeamChat.tsx`는 current `TeamTab`에 mount되지 않는 zero-consumer component로 좁혀졌습니다.
- 이 orphan seam과 연결된 route는 아래입니다.
  - `/api/admin/team/chat`
  - `/api/admin/team/comments/[id]`
- 추가로 `/api/admin/team/comments` 안의 `TEAM_CHAT_ROOM_ID` branch는 현재 FK 제약 때문에 insert 시도 시 `admin_tasks` parent 부재로 깨집니다.
- 현재 release 판단에서는 blocker로 보지 않습니다.
  - 이유: current Team Workspace surface는 이 path를 호출하지 않기 때문입니다.
- 하지만 admin route-owner 기준으로는 가장 우선적인 `removal candidate / separate issue`입니다.

## Route-Level Fallback Notes
- `analytics-search-intent`
  - `search_logs.session_id`, `analytics_events.utm_* / referrer_host / landing_path`가 없는 환경에서도 fail-open/fallback으로 지표 일부를 유지합니다.
  - current owner는 맞지만 schema migration parity가 아직 fully uniform하지 않은 seam입니다.
- `service-bookings`, `service-confirm-payment`, `service-payouts/mark-paid`
  - current owner는 맞습니다.
  - 다만 admin client/RLS 우회, `payout_paid_at` missing-column fallback, confirm side effects까지 얽혀 있어 route-level fallback 의미를 계속 문서화해 두는 편이 안전합니다.
- `settlement-sync`
  - current owner는 맞습니다.
  - `admin_job_runs` infra, health snapshot, localhost test-hook, manual trigger race/fail-closed가 함께 묶여 있어 admin 영역 중 가장 민감한 route-level seam입니다.
- `sidebar-counts`, `team-counts`
  - current UI no-consumer이지만 route 자체는 아직 compatibility truth를 보유합니다.

## Test Execution
- build
  - `npm run build`: 통과
- full admin rerun bundle
  - `06-admin-master-ledger`
  - `08-admin-billing`
  - `09-admin-analytics`
  - `10-admin-service-requests`
  - `11-admin-users`
  - `13-admin-alerts`
  - `14-admin-chats`
  - `15-admin-team`
  - `16-admin-team-chat`
  - `17-admin-sidebar`
  - `18-admin-team-badge`
  - `69-admin-role-access`
  - `70-admin-audit-logs`
  - `79-team-notify-guard`
  - `86-proxy-booking-team-workspace`
  - `89-admin-team-mobile`
  - `115-admin-master-ledger-confirm-modal`
  - `161-admin-support-unread-alerts`
  - `130-admin-settle-host-payout-guard`
  - `134-admin-payout-queue-unified-host-rollup`
  - `155-admin-settlement-sync-status`
  - `156-admin-settlement-sync-manual-trigger`
  - `160-settlement-sync-job-name-recording`
- 결과
  - `23 specs / 32 tests`
  - `30 passed / 2 skipped`
- skipped reason
  - `16-admin-team-chat`
    - current Team Workspace surface에 `GlobalTeamChat`가 mount되지 않아 current product smoke로는 더 이상 유효하지 않음
  - `161-admin-support-unread-alerts` 성공 경로 일부
    - `.env.local`에 `CRON_SECRET`가 없어 `next start` production-like contract에서 success branch를 검증할 수 없음
    - guard contract 자체는 그대로 통과
- rerun 메모
  - `08-admin-billing`은 current settlement panel copy에 맞춰 stale expectation을 정리했습니다.
  - `settlement-sync` localhost test-hook는 route gate와 helper 의미를 다시 맞춰 `160`을 current build 기준으로 green 회복했습니다.

## What We Still Have Not Fully Closed
- `admin route-level fallback semantics`
  - 특히 `analytics-search-intent`, `service-bookings`, `service-confirm-payment`, `service-payouts/mark-paid`, `settlement-sync`
- `admin hidden compatibility surface`
  - `APPS / EXPS`는 왜 남아 있는지 설명은 닫혔지만, 언제 explicit URL contract로 승격하거나 제거할지는 아직 separate decision입니다.
- `admin orphan seam`
  - `GlobalTeamChat.tsx`, `/api/admin/team/chat`, `/api/admin/team/comments/[id]`, 그리고 `team/comments` 내부 `TEAM_CHAT_ROOM_ID` 분기
  - 이번 감사 기준 가장 또렷한 removal-candidate 군입니다.
- `repo 밖 evidence`
  - external console parity는 여전히 admin code audit track이 아니라 ops evidence track입니다.

## Recommended Next Domain Order
1. `messaging boundary semantics`
2. `host legacy compatibility evidence`
3. `external console / cutover parity`

## One-Line Conclusion
admin은 여전히 repo 안에서 가장 큰 owner이지만, 이번 패스로 `current owner / dormant compatibility / removal candidate` 경계가 꽤 선명해졌고, 지금 가장 중요한 새 발견은 `bookings` legacy list route와 `GlobalTeamChat` 계열 orphan seam을 별도 이슈로 분리해 다루는 것이 맞다는 점입니다.
