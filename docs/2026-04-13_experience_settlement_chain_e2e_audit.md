# 체험 예약 정산 체인 엔드투엔드 구조 점검

## Summary
- 감사 범위: `게스트 예약 생성 → 호스트 예약 반영 → 어드민 장부 반영 → 날짜 경과 후 completed sync → 어드민 정산 실행 → 호스트 수익 반영`
- 제외 범위: `서비스 의뢰`, `전화예약(proxy)`, 예약 취소/환불 세부 운영, 정산 DB schema 재설계
- 실행 방식: 정적 코드 감사 + 최소 회귀 E2E 재실행
- 이번 패스 핵심 결론
  - 예약 생성부터 무통장 확정, 어드민 정산 완료, 호스트 수익 반영까지의 핵심 write/read 체인은 현재 기준으로 이어져 있다
  - 체험 정산의 source of truth는 `bookings.status` 와 `bookings.payout_status` 두 축으로 분리되어 있다
  - `ReservationManager`는 일정 기준의 `지난 일정`, `host earnings`와 `payout queue`는 DB 완료 동기화 기준의 `정산 대기/완료`를 본다
  - 이 의미 차이는 2026-04-13 copy 보강으로 화면상 설명 가능해졌고, active product risk보다는 의도된 해석 차이로 분류한다
  - 따라서 현재 핵심 리스크는 코드 파손보다는 `completed sync 운영 의존성` 쪽에 집중된다
- 최신 재실행 결과
  - `tests/e2e/150-experience-bank-confirm-guard.spec.ts`
  - `tests/e2e/06-admin-master-ledger.spec.ts`
  - `tests/e2e/57-guest-trips-sync-completed.spec.ts`
  - `tests/e2e/130-admin-settle-host-payout-guard.spec.ts`
  - `tests/e2e/133-host-payout-summary-reflection.spec.ts`
  - `tests/e2e/155-admin-settlement-sync-status.spec.ts`
  - 결과: `17 passed (3.6m)`
- 최종 판정
  - `예약 생성 → 호스트/어드민 초기 반영`: `정상`
  - `무통장 확정 snapshot`: `정상`
  - `completed sync → 정산 대기 진입`: `부분 보장`
  - `어드민 정산 실행 → 호스트 수익 반영`: `정상`
  - 전체 체인: `부분 보장`
    - 이유는 정산 로직 자체가 아니라 `completed sync` 의 운영 의존성과 `예약 화면 vs 정산 화면` 의미 차이가 남아 있기 때문이다

## Test Execution
- 최소 회귀 재실행 묶음
  - `tests/e2e/150-experience-bank-confirm-guard.spec.ts`
  - `tests/e2e/06-admin-master-ledger.spec.ts`
  - `tests/e2e/57-guest-trips-sync-completed.spec.ts`
  - `tests/e2e/130-admin-settle-host-payout-guard.spec.ts`
  - `tests/e2e/133-host-payout-summary-reflection.spec.ts`
  - `tests/e2e/155-admin-settlement-sync-status.spec.ts`
- 결과
  - `17 passed (3.6m)`
- 이번 묶음에서 닫힌 확인 포인트
  - 무통장 확정은 `status='confirmed'`, settlement snapshot, `payout_status='pending'`를 정확히 남긴다
  - guest trips의 completed sync와 admin settlement sync health panel이 현재 계약과 맞게 동작한다
  - payout mark-paid 이후 host earnings는 `paid` bucket으로 즉시 반영된다
  - settlement sync health panel은 `delayed`, `running_stale`, `503 fail-closed` 의미를 현재 코드와 일치하게 설명할 수 있다
  - 호스트 예약 탭의 `지난 일정`과 호스트 수익의 `정산 대기` 의미 차이는 copy로 명시돼 더 이상 숨은 해석 차이로 남지 않는다
- 후속 얇은 회귀 재확인
  - `tests/e2e/40-host-reservations-inquiries-ui.spec.ts`
  - `tests/e2e/133-host-payout-summary-reflection.spec.ts`
  - 결과: `5 passed (45.7s)`

## Summary Matrix
| 체인 | source of truth | 현재 보장 테스트 | 판정 | 핵심 메모 |
| --- | --- | --- | --- | --- |
| 예약 생성 | `POST /api/bookings`, `create_booking_atomic` | 기존 예약/결제 감사, 이번 static audit | 정상 | `bookings` row 생성과 host/admin 초기 반영의 출발점 |
| 호스트/어드민 초기 반영 | `ReservationManager`, `/api/admin/master-ledger`, `/api/admin/bookings/confirm-payment`, `confirmExperienceBankPayment()` | `150`, `06` | 정상 | 호스트 예약 화면과 어드민 장부는 모두 `bookings` 중심으로 읽고, 무통장 확정은 snapshot까지 함께 쓴다 |
| 완료 동기화 | `/api/cron/complete-trips`, `/api/admin/settlement-sync`, `experienceCompletion`, `/api/guest/trips/sync-completed` | `57`, `155` | 부분 보장 | due 판단과 `completed` write owner는 명확하지만 운영 job/수동 sync 의존성이 남아 있다 |
| 정산 큐/매출/정산 실행 | `/api/admin/payout-queue`, `/api/admin/sales-summary`, `settleHostPayout()` | `130`, `06` | 정상 | `payout_status='pending' -> 'paid'`가 queue/sales/action 모두에서 일관된다 |
| 호스트 수익 반영 | `/api/host/earnings/summary`, `hostEarningsSummary` | `133` | 정상 | `completed + payout_status` 기준으로 pending/paid bucket이 정확히 나뉜다 |
| 남은 실제 리스크 | settlement sync health / 운영 실행 | 이번 static audit, `57`, `155` | 리스크 | completed write owner가 cron/manual sync에 묶여 있어 운영 health가 핵심이다 |

## Chain-by-Chain Audit

### 1. 예약 생성
- source of truth
  - [app/api/bookings/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/bookings/route.ts:1)
  - DB RPC `create_booking_atomic`
- 기대 상태 전이
  - guest가 예약을 생성하면 `bookings`가 단일 write source가 된다
  - `payment_method`, `amount`, `order_id`, `status`가 이후 확정/정산 체인의 기준 truth가 된다
  - 예약 생성 시 host/admin 후속 반영은 이 booking row를 기준으로 시작한다
- 이를 읽는 UI/API surface
  - 결제 직전 submit
  - 호스트 예약 목록
  - 어드민 장부
  - payment complete / guest trips
- 실제 결과
  - 판정: `정상`
  - 메모
    - 예약 생성 시점부터 별도 shadow table 없이 `bookings`가 중심 truth다
    - 무통장/카드 모두 이 row를 이어서 사용하므로 초기 truth drift는 작다

### 2. 호스트 예약 반영 + 어드민 장부 반영
- source of truth
  - [app/host/dashboard/components/ReservationManager.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/dashboard/components/ReservationManager.tsx:145)
  - [app/api/admin/master-ledger/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/master-ledger/route.ts:1)
  - [app/api/admin/bookings/confirm-payment/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/bookings/confirm-payment/route.ts:1)
  - [app/utils/bookings/confirmExperienceBankPayment.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/bookings/confirmExperienceBankPayment.ts:1)
  - [app/utils/bookingFinance.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/bookingFinance.ts:1)
- 기대 상태 전이
  - 호스트 예약 화면은 host-owned `experiences.host_id` 기준 booking rows를 읽는다
  - 어드민 장부는 booking/service booking을 ledger row로 정규화해서 보여준다
  - 무통장 입금 확인 시 `status='confirmed'`, `price_at_booking`, `total_experience_price`, `host_payout_amount`, `platform_revenue`, `payout_status='pending'`가 함께 써져야 한다
- 이를 읽는 UI/API surface
  - 호스트 `reservations` 탭
  - 어드민 `LEDGER`
  - guest `booking_confirmed` 알림/메일
  - host `booking_confirmed` 알림/메일
- 실제 결과
  - 판정: `정상`
  - 메모
    - `confirmExperienceBankPayment()`는 무통장 확정 시 settlement snapshot을 같은 write에서 남긴다
    - `runExperienceBankConfirmSideEffects()`는 host/guest notification, 이메일, membership milestone, admin alert까지 이어진다
    - `150`이 non-admin 차단, non-bank 차단, concurrent idempotency를 검증하고 `06`이 admin ledger UI flow를 잠근다

### 3. 날짜 경과 후 completed sync
- source of truth
  - [app/utils/settlementSync/experienceCompletion.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/settlementSync/experienceCompletion.ts:1)
  - [app/api/cron/complete-trips/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/cron/complete-trips/route.ts:1)
  - [app/api/admin/settlement-sync/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/settlement-sync/route.ts:1)
  - [app/admin/dashboard/components/SettlementSyncPanel.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/admin/dashboard/components/SettlementSyncPanel.tsx:1)
  - [app/api/guest/trips/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/guest/trips/route.ts:1)
  - [app/api/guest/trips/sync-completed/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/guest/trips/sync-completed/route.ts:1)
  - [app/constants/bookingStatus.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/constants/bookingStatus.ts:1)
- 기대 상태 전이
  - `BOOKING_ACTIVE_STATUS_FOR_CAPACITY = ['PAID', 'confirmed']` 인 과거 일정만 due candidate가 된다
  - cron/manual worker가 실제 DB `status='completed'`를 쓴다
  - guest trips는 GET에서 read-only completed 계산을 하고, 필요할 때만 별도 POST sync를 호출한다
  - sync infra가 없으면 `503 fail-closed`여야 한다
- 이를 읽는 UI/API surface
  - guest trips
  - 어드민 `Sales` 탭의 settlement sync panel
  - payout queue
  - host earnings
- 실제 결과
  - 판정: `부분 보장`
  - 메모
    - due candidate를 실제로 `completed`로 바꾸는 owner는 settlement sync worker다
    - guest trips는 read-time completed 계산을 일부 하므로, 게스트 화면은 DB가 아직 `confirmed/PAID`여도 완료처럼 보일 수 있다
    - `155`는 admin health panel이 `delayed`, `running_stale`, `503 fail-closed`를 제대로 설명하는지 잠그고 있다
    - `57`은 guest trips의 GET read-only 계산과 POST sync 분리를 잠근다

### 4. 어드민 정산 큐 / 매출 / 정산 실행
- source of truth
  - [app/api/admin/payout-queue/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/payout-queue/route.ts:1)
  - [app/api/admin/sales-summary/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/sales-summary/route.ts:1)
  - [app/actions/admin.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/actions/admin.ts:230)
  - [app/utils/adminPayouts.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/adminPayouts.ts:1)
  - [app/utils/payoutQueue.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/payoutQueue.ts:1)
  - [app/admin/dashboard/components/SalesTab.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/admin/dashboard/components/SalesTab.tsx:231)
- 기대 상태 전이
  - payout queue는 `completed` booking 중 `payout_status!='paid'` 대상을 pending settlement로 보여야 한다
  - 어드민이 정산 실행하면 `payout_status='pending' -> 'paid'`, `payout_paid_at=now` 가 write owner다
  - sales summary는 cancelled/completed 포함 범위에서 host payout / platform revenue를 같은 truth로 집계해야 한다
- 이를 읽는 UI/API surface
  - 어드민 `SALES`
  - 정산 큐
  - 지급 완료 히스토리
  - host payout CSV download
- 실제 결과
  - 판정: `정상`
  - 메모
    - `settleExperienceBookingPayouts()`는 missing/already paid/invalid status를 먼저 막고, concurrent race 시 compare-and-set로 방어한다
    - `130`이 동시 정산 시 한 쪽만 성공하고 최종 DB는 `paid` 한 번만 남는지 검증한다
    - payout queue는 experience/service를 host별 rollup으로 합치지만, experience domain 자체는 `completed + payout_status` 의미가 일관된다

### 5. 호스트 수익 반영
- source of truth
  - [app/api/host/earnings/summary/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/earnings/summary/route.ts:1)
  - [app/utils/hostEarningsSummary.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/hostEarningsSummary.ts:1)
  - [app/host/dashboard/Earnings.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/dashboard/Earnings.tsx:1)
- 기대 상태 전이
  - host earnings는 booking status와 payout status를 합쳐 `in_progress / pending / paid` bucket을 계산한다
  - `status='completed' && payout_status!='paid'` 는 pending payout
  - `payout_status='paid'` 는 latest paid history로 이동한다
- 이를 읽는 UI/API surface
  - 호스트 `earnings` 탭
  - unified earnings hero / breakdown
  - experience earnings panel
- 실제 결과
  - 판정: `정상`
  - 메모
    - `getExperienceSettlementStage()`는 `completed -> pending`, `paid -> paid`, `confirmed/PAID -> in_progress` 의미를 명확히 갖고 있다
    - `133`이 pending/paid bucket과 latest paid 반영을 직접 검증한다

## Active Risk

### settlement sync 운영 의존성
- 관련 source
  - [app/utils/settlementSync/experienceCompletion.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/settlementSync/experienceCompletion.ts:291)
  - [app/api/cron/complete-trips/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/cron/complete-trips/route.ts:1)
  - [app/api/admin/settlement-sync/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/settlement-sync/route.ts:1)
  - [app/admin/dashboard/components/SettlementSyncPanel.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/admin/dashboard/components/SettlementSyncPanel.tsx:1)
- 현재 상태
  - `completed` write는 background/수동 sync owner에 의존한다
  - 이 경계가 늦거나 막히면 payout queue와 host earnings pending 전환도 늦어진다
  - 현재 구조는 fail-open이 아니라 fail-closed/health panel 노출 쪽으로 정리돼 있어 방향은 맞다
- 운영 영향
  - sync infra 이상 시 정산 체인은 멈추지만, guest/host 일부 화면은 read-time 계산 때문에 더 빨리 completed처럼 보일 수 있다
- 현재 판정
  - `리스크`
  - 코드 수정보다 먼저 `운영 runbook + health pass/fail 체크리스트`로 닫는 것이 적합하다

## Closed Interpretation Gap

### `지난 일정`과 `정산 대기`는 서로 다른 질문을 답한다
- 관련 source
  - [app/host/dashboard/components/ReservationManager.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/dashboard/components/ReservationManager.tsx:398)
  - [app/utils/hostEarningsSummary.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/hostEarningsSummary.ts:26)
  - [app/api/admin/payout-queue/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/payout-queue/route.ts:260)
  - [app/context/LanguageContext.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/context/LanguageContext.tsx:210)
- 현재 해석
  - 예약 화면은 일정 관점이라 일정이 지나면 `지난 일정`으로 분류될 수 있다
  - 수익/정산 화면은 DB 완료 동기화 관점이라 실제 `status='completed'` 이후에만 `정산 대기`로 잡힌다
- close-out 근거
  - 2026-04-13 기준 host reservation label과 earnings scope copy를 보강해, 숨은 의미 차이가 아니라 명시된 제품 해석으로 정리했다
  - `tests/e2e/40-host-reservations-inquiries-ui.spec.ts`, `tests/e2e/133-host-payout-summary-reflection.spec.ts` 재확인 결과 `5 passed (45.7s)`
- 현재 판정
  - `정상`
  - 추가 로직 변경 없이 현행 의미 분리를 유지하는 것이 가장 안전하다

## 영향 파일 인벤토리
- 예약 생성 / 초기 truth
  - `app/api/bookings/route.ts`
  - `app/constants/bookingStatus.ts`
- 무통장 확정 / settlement snapshot
  - `app/api/admin/bookings/confirm-payment/route.ts`
  - `app/utils/bookings/confirmExperienceBankPayment.ts`
  - `app/utils/bookingFinance.ts`
- guest completed / sync
  - `app/api/guest/trips/route.ts`
  - `app/api/guest/trips/sync-completed/route.ts`
  - `app/api/cron/complete-trips/route.ts`
  - `app/utils/settlementSync/experienceCompletion.ts`
- host/admin read surfaces
  - `app/host/dashboard/components/ReservationManager.tsx`
  - `app/host/dashboard/Earnings.tsx`
  - `app/utils/hostEarningsSummary.ts`
  - `app/api/host/earnings/summary/route.ts`
  - `app/api/admin/master-ledger/route.ts`
  - `app/admin/dashboard/components/MasterLedgerTab.tsx`
  - `app/api/admin/payout-queue/route.ts`
  - `app/api/admin/sales-summary/route.ts`
  - `app/admin/dashboard/components/SalesTab.tsx`
  - `app/admin/dashboard/components/SettlementSyncPanel.tsx`
- 정산 실행
  - `app/actions/admin.ts`
  - `app/utils/adminPayouts.ts`
  - `app/utils/payoutQueue.ts`

## Close-out
- 이번 감사 기준으로 `게스트 예약 생성 → 호스트/어드민 초기 반영 → 무통장 확정 snapshot → 어드민 정산 실행 → 호스트 수익 반영` 체인은 현재 정상으로 본다
- 남은 핵심 리스크는 이제 `settlement sync 운영 의존성` 하나로 좁혀진다
- 따라서 다음 후속의 기본 선택은 구현보다 아래를 먼저 닫는 것이다
  - [experience settlement sync 운영 runbook](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_experience_settlement_sync_runbook.md:1)
  - `정산 실행 day-of 운영 체크리스트`와 health pass/fail 기준
