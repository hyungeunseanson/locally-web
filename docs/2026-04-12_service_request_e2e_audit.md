# 서비스 의뢰 엔드투엔드 구조 점검

## Summary
- 감사 범위: `고객 의뢰 생성 → 결제/open 공개 → 호스트 지원/선택 → 완료 sync → 정산 가능/정산 완료 → 호스트/어드민 반영`
- 이번 1차 패스 목표
  - 서비스 의뢰 도메인의 source of truth를 다시 묶는다
  - 이미 존재하는 계약/E2E를 체인별로 재매핑한다
  - 아직 문서화되지 않은 핵심 체인을 새 감사 문서로 잠근다
- 현재까지 확인된 기준 사실
  - 서비스 의뢰 도메인은 `service_requests`, `service_bookings`, `service_applications` 3개 write 축과 admin/host/guest read surface가 분리돼 있다
  - 결제 수단은 `card / bank / paypal` 모두 별도 route를 가지되, 최종 의미는 `service_bookings.status`와 `service_requests.status`의 조합으로 수렴한다
  - 완료/정산은 `settlementSync` shared infra와 `serviceCompletion` worker를 같이 쓴다
  - host/admin 표면은 이미 각자 전용 API를 통해 읽고 있지만, 전체 체인을 한 문서로 다시 잠근 최신 close-out은 아직 없다

## Source Inventory

### 1. 고객 생성 / 결제 진입
- page / client
  - [app/services/request/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/services/request/page.tsx:1)
  - [app/services/[requestId]/payment/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/services/%5BrequestId%5D/payment/page.tsx:1)
  - [app/services/[requestId]/payment/complete/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/services/%5BrequestId%5D/payment/complete/page.tsx:1)
- write / payment routes
  - [app/api/services/requests/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/requests/route.ts:1)
  - [app/api/services/payment/mark-bank/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/mark-bank/route.ts:1)
  - [app/api/services/payment/mark-card/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/mark-card/route.ts:1)
  - [app/api/services/payment/release-card/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/release-card/route.ts:1)
  - [app/api/services/payment/card-ready/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/card-ready/route.ts:1)
  - [app/api/services/payment/nicepay-callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/nicepay-callback/route.ts:1)
  - [app/api/services/payment/card-notification/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/card-notification/route.ts:1)
  - [app/api/services/payment/paypal/create-order/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/paypal/create-order/route.ts:1)
  - [app/api/services/payment/paypal/capture-order/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/paypal/capture-order/route.ts:1)

### 2. 공개 / 지원 / 선택
- guest / host read surface
  - [app/services/[requestId]/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/services/%5BrequestId%5D/page.tsx:1)
  - [app/services/[requestId]/ServiceRequestClient.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/services/%5BrequestId%5D/ServiceRequestClient.tsx:1)
  - [app/services/[requestId]/apply/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/services/%5BrequestId%5D/apply/page.tsx:1)
  - [app/services/my/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/services/my/page.tsx:1)
  - [app/services/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/services/page.tsx:1)
  - [app/services/ServiceJobBoardClient.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/services/ServiceJobBoardClient.tsx:1)
- write / visibility routes
  - [app/api/services/applications/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/applications/route.ts:1)
  - [app/api/services/select-host/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/select-host/route.ts:1)
  - [app/api/services/start-chat/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/start-chat/route.ts:1)
  - [app/utils/serviceNotificationFlows.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/serviceNotificationFlows.ts:1)
  - [app/utils/serviceHostNotifications.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/serviceHostNotifications.ts:1)
  - [app/utils/serviceRequestLocation.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/serviceRequestLocation.ts:1)

### 3. 완료 / 정산 / 어드민 반영
- completion / settlement
  - [app/utils/settlementSync/serviceCompletion.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/settlementSync/serviceCompletion.ts:1)
  - [app/api/cron/complete-services/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/cron/complete-services/route.ts:1)
  - [app/api/admin/service-payouts/mark-paid/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/service-payouts/mark-paid/route.ts:1)
- admin / host read surface
  - [app/api/admin/service-bookings/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/service-bookings/route.ts:1)
  - [app/api/admin/service-confirm-payment/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/service-confirm-payment/route.ts:1)
  - [app/api/admin/service-cancel/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/service-cancel/route.ts:1)
  - [app/api/admin/service-requests/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/service-requests/route.ts:1)
  - [app/api/admin/service-bookings-csv/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/service-bookings-csv/route.ts:1)
  - [app/api/host/earnings/services/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/earnings/services/route.ts:1)
  - [app/api/host/earnings/summary/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/earnings/summary/route.ts:1)
  - [app/utils/services/confirmServiceBankPayment.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/services/confirmServiceBankPayment.ts:1)

## Initial Test Mapping

### 생성 / 공개 / 가시성
- `49-service-request-contract.spec.ts`
- `48-service-visibility.spec.ts`
- `22-service-host-notification-scope.spec.ts`

### 결제
- `19-service-card-verification.spec.ts`
- `12-service-paypal-payment.spec.ts`
- `21-service-payment-method-lock.spec.ts`
- `74-card-payment-precutover-contract.spec.ts`

### 지원 / 선택 / 호스트 흐름
- `50-service-select-host-atomicity.spec.ts`
- `106-service-host-flow-guidance.spec.ts`
- `118-service-notification-localization.spec.ts`

### 완료 / 정산 / 반영
- `131-service-completion-cron.spec.ts`
- `132-service-payout-eligibility-after-completion.spec.ts`
- `151-service-bank-confirm-guard.spec.ts`
- `152-host-service-earnings-separation.spec.ts`
- `08-admin-billing.spec.ts`
- `10-admin-service-requests.spec.ts`
- `155-admin-settlement-sync-status.spec.ts`
- `156-admin-settlement-sync-manual-trigger.spec.ts`
- `157-settlement-sync-race-guard.spec.ts`
- `158-settlement-sync-fail-closed.spec.ts`
- `160-settlement-sync-job-name-recording.spec.ts`

## Current Working Verdict
- `문서 기준 미완료`
  - source of truth inventory는 충분히 모였지만
  - 체인별 `정상 / 부분 보장 / 리스크` 판정은 아직 테스트 재매핑과 실제 rerun을 더 붙여야 한다
- 다음 실행 우선순위
  - 1단계: 생성 / 공개 / 가시성 core subset rerun
  - 2단계: 결제 subset
  - 3단계: 완료 / 정산 / host/admin reflection subset

## Test Execution
- 생성 / 공개 / 가시성 core subset
  - `tests/e2e/49-service-request-contract.spec.ts`
  - `tests/e2e/48-service-visibility.spec.ts`
  - 결과: `4 passed (37.5s)` under `playwright.contracts.config.ts`
- 결제 core subset
  - `tests/e2e/19-service-card-verification.spec.ts`
  - `tests/e2e/12-service-paypal-payment.spec.ts`
  - `tests/e2e/21-service-payment-method-lock.spec.ts`
  - 결과: `7 passed (28.4s)` under `playwright.contracts.config.ts`
- 완료 / 정산 core subset
  - `tests/e2e/131-service-completion-cron.spec.ts`
  - `tests/e2e/132-service-payout-eligibility-after-completion.spec.ts`
  - `tests/e2e/151-service-bank-confirm-guard.spec.ts`
  - `tests/e2e/152-host-service-earnings-separation.spec.ts`
  - 결과: `6 passed (26.1s)` under `playwright.contracts.config.ts`
- admin finance reflection subset
  - `tests/e2e/08-admin-billing.spec.ts`
  - `tests/e2e/10-admin-service-requests.spec.ts`
  - `tests/e2e/155-admin-settlement-sync-status.spec.ts`
  - `tests/e2e/156-admin-settlement-sync-manual-trigger.spec.ts`
  - `tests/e2e/157-settlement-sync-race-guard.spec.ts`
  - `tests/e2e/158-settlement-sync-fail-closed.spec.ts`
  - `tests/e2e/160-settlement-sync-job-name-recording.spec.ts`
  - `155`는 shared history를 타는 마지막 실패 문구를 exact copy로 잠그던 오래된 기대를 걷어내고, 상태/heartbeat/failure-presence 계약 기준으로 정리했다
  - 결과: `8 passed (1.4m)` under `playwright.contracts.config.ts` with `--workers=1`
- 이번 패스에서 직접 닫은 항목
  - 서울 request 생성 시 country가 `대한민국`으로 정규화되는 생성 계약
  - booking pre-create 실패 시 `pending_payment` request cleanup 계약
  - apply page가 persisted `total_host_payout`을 읽는 계약
  - board/detail이 eligible approved host에게만 열리고 customer/other host에는 닫히는 visibility 계약
  - card callback이 fabricated success payload나 unauthenticated confirm 시도로 booking을 확정하지 않는 계약
  - PayPal approve UI가 localized body copy가 아니라 capture/complete contract 자체로 잠겨 있다는 점
  - pending booking의 bank/card 전환 잠금 규칙이 시작/해제/legacy placeholder 상태별로 유지된다는 점
  - completion cron이 paid service booking만 완료 처리하고 payout eligibility를 여는 계약
  - admin service bank confirm이 `PENDING + bank` 경계와 idempotent confirm semantics를 유지한다는 점
  - host earnings summary와 service drilldown이 completed service truth를 다른 source로 읽지 않는다는 점
  - admin billing KPI와 service CSV가 active date range 기준을 유지한다는 점
  - admin service requests tab이 bank confirm, settlement account, refund list를 같은 booking truth로 읽는다는 점
  - settlement sync manual trigger, race guard, fail-closed, job-name recording이 현재 service completion 체인과 충돌하지 않는다는 점
  - settlement sync status card가 delayed / running_stale / heartbeat / failure-presence 계약을 유지한다는 점

## Initial Findings

### 1. 생성 / 공개 / 가시성 앞단은 현재 green 기준이 있다
- confirmed
- 근거
  - `POST /api/services/requests`는 request + pre-created booking 계약을 별도 스펙으로 이미 잠가 두고 있다
  - visibility는 `/api/services/requests?mode=board`와 detail read가 같은 eligible-host 경계를 본다는 점이 `48`로 다시 확인됐다
- 판정
  - `생성 / 공개 / 가시성`: `정상`

### 2. 결제 구간도 현재 계약 기준으로는 green이다
- confirmed
- 근거
  - `19`에서 card callback verify가 owner/auth guard와 fabricated payload 차단을 다시 잠갔다
  - `12`에서 PayPal approve 흐름은 UI copy가 아니라 mocked approval → capture → complete 경계로 확인됐다
  - `21`에서 bank/card/paypal 전환 잠금 의미가 untouched placeholder, card-started, bank-marked 상태별로 유지됨이 다시 확인됐다
- 판정
  - `결제`: `정상`

### 3. 현재 남은 재감사 핵심은 완료 / 정산 / host-admin reflection이다
- confirmed
- 근거
  - `131`에서 completion cron이 과거 `PAID` service booking을 `completed`로 승격시키고 payout queue 진입 전제를 다시 잠갔다
  - `132`에서 payout queue는 completion 이전에는 닫히고, completion 이후에만 열리는 계약이 유지됐다
  - `151`에서 admin confirm은 non-admin, non-bank, concurrent confirm 모두 fail-closed 또는 idempotent semantics를 유지했다
  - `152`에서 host service earnings는 unified summary와 service-only drilldown이 같은 host-scoped settlement truth를 읽는 것이 다시 확인됐다
- 판정
  - `완료 / 정산 / 호스트 반영`: `정상`

### 4. admin finance reflection까지 현재 계약 기준으로 green이다
- confirmed
- 근거
  - `08`, `10`, `155`, `156`, `157`, `158`, `160`을 serial rerun 기준으로 다시 잠갔고 모두 green이었다
  - `155`는 shared admin_job_runs history 때문에 가장 최근 failure copy를 exact fixture 문자열로 강제하던 오래된 기대를 정리한 뒤, 상태/heartbeat/failure presence 계약으로 안정화됐다
- 판정
  - `admin finance reflection`: `정상`

### 5. 서비스 의뢰 도메인은 현재 감사 범위 기준으로 close-out 가능하다
- confirmed
- 근거
  - 생성/공개/결제/완료/정산/host 반영/admin finance까지 직접 rerun 근거가 모두 생겼다
  - 남아 있는 이슈는 서비스 의뢰 고유 상태 전이가 아니라, 다른 도메인에서도 공통으로 사용할 수 있는 admin auth/test-execution 운영 전략 쪽이다
- 판정
  - `도메인 close-out 상태`: `정상`

## Next Slice
- 다음 실행 묶음
  - 없음
- 이 묶음에서 먼저 확인할 것
  - 서비스 의뢰 도메인 관점의 후속 감사는 닫힘
  - 다음 자연스러운 대상은 별도 도메인 감사 또는 admin auth/test execution 운영 정리다
