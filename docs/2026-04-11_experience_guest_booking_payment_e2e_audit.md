# 체험 게스트 예약·결제 엔드투엔드 구조 점검

## Summary
- 감사 범위: `홈/검색/상세 → /experiences/[id]/payment → /api/bookings → card/bank/PayPal → payment complete → guest/trips·notifications·account`
- 제외 범위: `서비스 의뢰`, `전화예약(proxy)`, 환불/취소 세부 운영, 실제 NicePay 실계정 cutover
- 실행 방식: 정적 코드 감사 + 로컬/계약 E2E 재실행 + 기존 live mutation 스펙 존재 여부 확인
- 실행 결과
  - 로컬/계약 감사 묶음 1차: `35 passed / 2 failed / 3 did not run`
  - 실패 subset 재실행: `4 passed / 1 failed`
  - 최종 해석: persistent failure는 `tests/e2e/42-experience-paypal-payment.spec.ts` 1건뿐이며, `tests/e2e/43-guest-search-detail-ingress.spec.ts`의 초기 실패는 재현되지 않았다
- live mutation 경계
  - `tests/e2e/23-live-guest-post-booking.spec.ts`
  - `tests/e2e/31-live-guest-trip-cancel.spec.ts`
  - 위 2개는 `https://locally-web.vercel.app`에 실제 회원가입/예약을 만드는 스펙이라 이번 감사에서는 재실행하지 않고 기존 coverage reference + 수동 probe 후보로만 취급했다
- 최종 판정
  - `카드` 체인은 현재 운영 path 기준 `정상`
  - `무통장 pending → admin confirm → guest surface 반영` 체인은 현재 기준 `정상`
  - `payment complete → guest/trips → membership/notification` 후속 surface는 현재 기준 `정상`
  - `PayPal` 체인은 코드상 contract는 연결돼 있으나, 자동 스모크가 fixture drift로 깨져 있어 이번 감사 기준 `부분 보장`
  - `account`는 booking read model이 아니라 entry surface로만 동작하며, 이번 범위 기준 `정상`

## Test Execution
- ingress / handoff
  - `tests/e2e/43-guest-search-detail-ingress.spec.ts`
  - `tests/e2e/24-experience-card-verification.spec.ts`
- card
  - `tests/e2e/44-experience-card-payment-ui.spec.ts`
  - `tests/e2e/76-card-callback-contract.spec.ts`
  - `tests/e2e/74-card-payment-precutover-contract.spec.ts`
- PayPal
  - `tests/e2e/42-experience-paypal-payment.spec.ts`
- bank guest pending / complete
  - `tests/e2e/125-experience-bank-payment-success.spec.ts`
  - `tests/e2e/124-experience-payment-feedback.spec.ts`
- bank admin confirm / operations
  - `tests/e2e/150-experience-bank-confirm-guard.spec.ts`
  - `tests/e2e/135-experience-bank-confirm-snapshot-parity.spec.ts`
  - `tests/e2e/115-admin-master-ledger-confirm-modal.spec.ts`
  - `tests/e2e/06-admin-master-ledger.spec.ts`
  - `tests/e2e/117-notification-localization-runtime.spec.ts`
- post-booking guest surfaces
  - `tests/e2e/57-guest-trips-sync-completed.spec.ts`
  - `tests/e2e/52-guest-trip-metadata.spec.ts`
  - `tests/e2e/56-notification-read-route.spec.ts`
  - `tests/e2e/113-membership-care.spec.ts`
- 재실행 결과 메모
  - `42-experience-paypal-payment`는 재실행에서도 동일하게 실패했다
  - `43-guest-search-detail-ingress`는 묶음 실행에서는 첫 test가 `/` 진입 `networkidle` timeout으로 실패했고, 단독 재실행에서는 4개 test가 모두 통과했다

## Summary Matrix
| 체인 | source of truth | 현재 보장 테스트 | 판정 | 핵심 메모 |
| --- | --- | --- | --- | --- |
| 상세 → payment handoff | `app/experiences/[id]/ExperienceClient.tsx`, `app/experiences/[id]/payment/page.tsx` | `43`, `24` | 정상 | `date/time/guests/type/solo` query handoff가 명확하다 |
| 예약 생성 | `POST /api/bookings`, `create_booking_atomic` | `124`, `125`, `44`, `42`, `24` | 정상 | `paymentMethod=card|bank|paypal` 허용, `new_order_id/final_amount` 반환 확인 |
| 카드 결제 | payment page client, `/api/payment/card-ready`, `/api/payment/nicepay-callback`, `finalizeExperienceCardPayment()` | `44`, `76`, `74`, `24` | 정상 | owner guard, idempotency, `order_id` 중심 확인, `status='PAID'` 의미 일치 |
| PayPal 결제 | payment page PayPal prep, `/api/payment/paypal/create-order`, `/api/payment/paypal/capture-order` | `42` | 부분 보장 | route contract는 정합적이나 smoke test가 stale fixture로 깨져 active pass를 못 주었다 |
| 무통장 pending → admin confirm | payment page bank branch, `/api/admin/bookings/confirm-payment`, `confirmExperienceBankPayment()`, `MasterLedgerTab` | `125`, `150`, `135`, `115`, `06`, `117` | 정상 | `PENDING + payment_method='bank'` 가드, snapshot/payout_status, side effects 정합적 |
| 완료 후 guest surface | `payment/complete`, `/api/guest/trips`, `/api/guest/trips/sync-completed`, `TripCard`, `ReceiptModal` | `57`, `52`, `56`, `113` | 정상 | localized title, pending receipt copy, CTA/bootstrap, membership 반영 일관적 |
| account entry continuity | `app/account/page.tsx` | 기존 prebooking continuity 감사, `108` reference | 정상 | account는 booking truth surface가 아니라 `/guest/trips` 진입 surface로 동작 |

## Chain-by-Chain Audit

### 1. 프리북킹 handoff → 결제 진입
- source of truth
  - `app/experiences/[id]/ExperienceClient.tsx`
  - `app/experiences/[id]/payment/page.tsx`
- 기대 상태 전이
  - 상세 예약 CTA가 `date`, `time`, `guests`를 필수 query로 넘긴다
  - `isPrivate`면 `type=private`, `isSoloGuaranteed`면 `solo=1`을 추가한다
  - payment page는 query를 authoritative input으로 소비한다
- 이를 읽는 UI/API surface
  - 상세 예약 카드
  - payment summary / availability gate
- 현재 보장 테스트
  - `tests/e2e/43-guest-search-detail-ingress.spec.ts`
  - `tests/e2e/24-experience-card-verification.spec.ts`
- 실제 결과
  - 판정: `정상`
  - 메모
    - `handleReserve()`가 query를 명확하게 구성해 `/experiences/[id]/payment?...`로 push한다
    - `43`의 초기 실패는 홈 route `networkidle` timeout이었고, 단독 재실행에서는 통과해 active chain 결함으로 보지 않았다

### 2. 예약 생성 구간
- source of truth
  - `app/api/bookings/route.ts`
  - DB RPC `create_booking_atomic`
- 기대 상태 전이
  - authenticated guest만 예약 생성 가능
  - `paymentMethod='card'|'bank'|'paypal'` 허용
  - 생성 성공 시 `newOrderId`, `finalAmount`를 반환
  - `bank`는 pending booking 생성 후 guest를 complete page로 보낸다
  - `card/paypal`은 동일 pending booking을 만든 뒤 후속 PG 확인 route에서 확정한다
- 이를 읽는 UI/API surface
  - payment submit
  - card/paypal follow-up routes
  - admin alert / host new booking notification
- 현재 보장 테스트
  - `tests/e2e/124-experience-payment-feedback.spec.ts`
  - `tests/e2e/125-experience-bank-payment-success.spec.ts`
  - `tests/e2e/44-experience-card-payment-ui.spec.ts`
  - `tests/e2e/24-experience-card-verification.spec.ts`
  - `tests/e2e/42-experience-paypal-payment.spec.ts` reference
- 실제 결과
  - 판정: `정상`
  - 메모
    - code상 `booking.order_id`, `status`, `payment_method`, `amount`의 의미가 세 결제 수단 후속 route와 충돌하지 않았다
    - `bank` 생성 시 host/admin에는 `pending` 의미의 알림이, card는 `processing` 의미의 알림이 적재되도록 분기돼 있다

### 3. 카드 결제 구간
- source of truth
  - `app/utils/payments/card/client.ts`
  - `app/api/payment/card-ready/route.ts`
  - `app/api/payment/nicepay-callback/route.ts`
  - `app/api/payment/experienceCardConfirmation.ts`
- 기대 상태 전이
  - payment page는 `/api/payment/card-ready`를 single source로 읽는다
  - callback은 `order_id` 기준 booking row를 찾고 owner guard를 건다
  - 승인 검증 후 `status='PAID'`, `payment_method='card'`, `tid`를 저장한다
  - complete page와 guest/trips는 같은 booking truth를 읽는다
- 이를 읽는 UI/API surface
  - payment page card branch
  - payment complete
  - guest trips
  - notifications
- 현재 보장 테스트
  - `tests/e2e/44-experience-card-payment-ui.spec.ts`
  - `tests/e2e/76-card-callback-contract.spec.ts`
  - `tests/e2e/74-card-payment-precutover-contract.spec.ts`
  - `tests/e2e/24-experience-card-verification.spec.ts`
- 실제 결과
  - 판정: `정상`
  - 메모
    - `44`는 현재 provider-aware card-ready contract에 맞춰 이미 복구돼 있고 pass
    - `76`이 owner mismatch / already processed idempotency를 직접 잠그고 있다
    - 이번 감사에서는 `PortOne current path`와 `NicePay dormant contract`를 섞지 않고 기록했다

### 4. PayPal 결제 구간
- source of truth
  - `app/experiences/[id]/payment/page.tsx`
  - `app/api/payment/paypal/create-order/route.ts`
  - `app/api/payment/paypal/capture-order/route.ts`
- 기대 상태 전이
  - `/api/bookings`가 먼저 pending booking을 만든다
  - `create-order`는 `booking.id`로 pending row를 읽고 `booking.order_id`를 PayPal order reference에 바인딩한다
  - `capture-order`는 `custom_id/reference_id == booking.order_id`, 금액, owner, capacity를 다시 검증한 뒤 `status='PAID'`, `payment_method='paypal'`, `tid=captureId`를 저장한다
- 이를 읽는 UI/API surface
  - payment page PayPal panel
  - payment complete
  - guest trips
- 현재 보장 테스트
  - `tests/e2e/42-experience-paypal-payment.spec.ts`
- 실제 결과
  - 판정: `부분 보장`
  - 메모
    - route contract 자체는 booking/order/amount 검증과 `PAID + paypal + tid` 저장 의미가 명확하다
    - 하지만 automated smoke `42`는 재실행에서도 `No host experience found for the approved test host.`로 실패했다
    - 원인은 결제 체인 로직보다 spec fixture drift에 가깝다
      `42`가 여전히 고정 `HOST_USER_ID` 기반 bookable experience 탐색을 사용한다
    - 따라서 PayPal은 “코드상 source는 정합적이나, 현재 active smoke가 깨져 있어 운영 보장 test가 비어 있다”로 기록한다

### 5. 무통장 pending → 관리자 수동 확인 → guest 반영
- source of truth
  - `app/experiences/[id]/payment/page.tsx`
  - `app/api/admin/bookings/confirm-payment/route.ts`
  - `app/utils/bookings/confirmExperienceBankPayment.ts`
  - `app/admin/dashboard/components/MasterLedgerTab.tsx`
- 기대 상태 전이
  - guest는 `paymentMethod='bank'`로 pending booking을 만든다
  - complete page는 bank 안내와 order id를 보여준다
  - admin은 `PENDING + payment_method='bank'` 예약만 입금 확인한다
  - confirm 후 `status='confirmed'`, settlement snapshot, `payout_status='pending'`가 저장된다
  - host/guest notification, email, membership milestone, admin audit log는 confirm 사실에서 파생된다
- 이를 읽는 UI/API surface
  - payment complete
  - admin master ledger
  - guest trips / receipt modal
  - notifications / membership surfaces
- 현재 보장 테스트
  - `tests/e2e/125-experience-bank-payment-success.spec.ts`
  - `tests/e2e/150-experience-bank-confirm-guard.spec.ts`
  - `tests/e2e/135-experience-bank-confirm-snapshot-parity.spec.ts`
  - `tests/e2e/115-admin-master-ledger-confirm-modal.spec.ts`
  - `tests/e2e/06-admin-master-ledger.spec.ts`
  - `tests/e2e/117-notification-localization-runtime.spec.ts`
- 실제 결과
  - 판정: `정상`
  - 메모
    - `150`이 non-admin 차단, non-bank 차단, concurrent idempotency를 직접 검증한다
    - `135`가 admin route와 legacy route의 settlement snapshot parity를 잠근다
    - `115`, `06`이 UI confirm modal과 master ledger 운영 flow를 실제로 통과시킨다
    - `117`이 confirm 후 guest/host localized notification 적재를 검증한다

### 6. 결제 완료 후 guest surface 반영
- source of truth
  - `app/experiences/[id]/payment/complete/page.tsx`
  - `app/api/guest/trips/route.ts`
  - `app/api/guest/trips/sync-completed/route.ts`
  - `app/guest/trips/components/TripCard.tsx`
  - `app/guest/trips/components/ReceiptModal.tsx`
- 기대 상태 전이
  - complete page는 `orderId` + current user owner guard로 booking을 읽는다
  - localized title과 status별 copy를 보여준다
  - guest trips는 booking truth를 읽고, past active booking은 read-time completed 계산 후 POST sync로 확정한다
  - pending bank booking은 receipt follow-up / support CTA를 유지한다
  - inbox/message CTA는 booking/host context를 bootstrap한다
- 이를 읽는 UI/API surface
  - payment complete
  - guest trips list
  - receipt modal
  - notifications
  - membership badge/CTA
- 현재 보장 테스트
  - `tests/e2e/57-guest-trips-sync-completed.spec.ts`
  - `tests/e2e/52-guest-trip-metadata.spec.ts`
  - `tests/e2e/56-notification-read-route.spec.ts`
  - `tests/e2e/113-membership-care.spec.ts`
- 실제 결과
  - 판정: `정상`
  - 메모
    - `57`이 localized title, pending receipt guidance, host notice, payment complete locale copy까지 폭넓게 닫고 있다
    - `52`가 guest trips에서 meeting point / inbox host summary bootstrap을 확인한다
    - `56`은 booking_confirmed를 전용으로 검증하진 않지만, guest notification consumption contract를 보강한다
    - `113`이 payment complete와 guest pages에서 membership surface 연결을 잠근다

### 7. account surface
- source of truth
  - `app/account/page.tsx`
- 기대 상태 전이
  - account는 booking read model을 직접 보여주는 페이지가 아니라 guest menu/entry surface다
  - booking 관련 행동은 `/guest/trips`로 넘긴다
- 이를 읽는 UI/API surface
  - account mobile menu
- 현재 보장 테스트
  - 기존 continuity reference
    - `tests/e2e/108-login-flow-guidance.spec.ts`
    - `docs/2026-04-11_customer_prebooking_flow_e2e_audit.md`
- 실제 결과
  - 판정: `정상`
  - 메모
    - 이번 감사 범위에서 account는 booking truth surface가 아니라 navigation continuity surface로만 취급하는 것이 현재 구조와 맞다

## Confirmed Risks
- `tests/e2e/42-experience-paypal-payment.spec.ts`
  - persistent failure
  - 분류: `test maintenance risk`
  - 이유: 고정 `HOST_USER_ID` 기반 fixture 탐색이 현재 shared helper 흐름과 어긋나 PayPal chain 자체를 검증하기 전에 멈춘다
- `tests/e2e/43-guest-search-detail-ingress.spec.ts`
  - 1차 묶음에서 `/` 진입 `networkidle` timeout 발생
  - 단독 재실행에서는 4개 test 모두 통과
  - 분류: `runner/environment risk`, 현재 active product regression으로는 보지 않음

## Coverage Gaps
- live mutation coverage는 이번 감사에서 재실행하지 않았다
  - `tests/e2e/23-live-guest-post-booking.spec.ts`
  - `tests/e2e/31-live-guest-trip-cancel.spec.ts`
  - 이유: `https://locally-web.vercel.app`에 실제 회원가입/예약을 만드는 운영 영향 스펙이기 때문
- PayPal은 route contract는 읽혔지만, active smoke pass가 없어 이번 문서에서 `정상` 판정을 주지 않는다
- account는 entry surface만 검증했고, booking state surface로는 다루지 않았다

## Follow-up Need
- 즉시 제품 버그 수정이 필요한 결함은 이번 감사에서 확인되지 않았다
- 가장 가까운 후속 작업은 1건이다
  - `42-experience-paypal-payment.spec.ts`를 `44`와 같은 shared `prepareBookableExperience()` helper 기준으로 정리해 PayPal smoke 신뢰도를 복구할 것
- 그 다음 순서는 선택 사항이다
  - live mutation 스펙 `23`, `31`을 안전한 staging용으로 분리할지
  - 아니면 현재처럼 reference-only 운영 smoke로 유지할지

## Final Verdict
- `홈/검색/상세 → payment → booking create → card/bank confirm → payment complete → guest/trips·notifications·account entry` 체인은 현재 코드 기준으로 대체로 끊김 없이 설명된다
- card와 bank manual confirm 운영 플로우는 현재 기준 `정상`
- PayPal은 코드 contract는 일관되지만 active smoke가 stale fixture로 깨져 있어 `부분 보장`
- 따라서 이번 감사의 최종 판정은 `전반 정상, 단 PayPal 자동 검증 신뢰도는 후속 정리 필요`다
