# 전화 예약(proxy) 운영 체인 엔드투엔드 구조 점검

## Summary
- 감사 범위: `공개 진입 / 요청 생성 → 결제 분기(NAVER / LOCALLY card / LOCALLY bank) → TEAM > 전화 예약 운영 → linked inquiry 기반 고객 소통 → 고객 self-service 반영`
- 제외 범위: `서비스 의뢰 상태 머신`, `커뮤니티`, `live mutation`, 일반 체험 예약/결제 도메인
- 실행 방식: 정적 코드 감사 + 핵심 non-live E2E 재실행
- latest run
  - `6 passed (26.0s)`
  - close-out rerun bundle
    - `tests/e2e/86-proxy-booking-team-workspace.spec.ts`
    - `tests/e2e/105-proxy-booking-self-service.spec.ts`
    - `tests/e2e/119-proxy-notification-localization.spec.ts`
    - `tests/e2e/87-proxy-booking-fee-util.spec.ts`
    - `tests/e2e/88-proxy-booking-mobile-layout.spec.ts`
  - runtime evidence probe
    - `2026-04-12` read-only Supabase check → missing row `1` 발견
    - same-day inspection 결과 internal test artifact로 판정 후 cleanup
    - post-cleanup current `proxy_requests`: `2`
    - post-cleanup `linked_inquiry_id` missing rows: `0`
  - fixture modernization rerun
    - `tests/e2e/119-proxy-notification-localization.spec.ts`
    - linked inquiry 기반 fixture로 전환 후 `1 passed (17.1s)`
  - payment notification boundary rerun
    - `tests/e2e/74-card-payment-precutover-contract.spec.ts`
    - `tests/e2e/165-card-payment-provider-cutover.spec.ts`
    - `tests/e2e/86-proxy-booking-team-workspace.spec.ts`
    - `tests/e2e/105-proxy-booking-self-service.spec.ts`
    - `8 passed (28.6s)` under `playwright.contracts.config.ts`
- 이번 패스 핵심 결론
  - 전화 예약 도메인의 write/read source of truth는 현재 `proxy_requests`로 잘 고정되어 있다
  - 결제 상태 변경 owner도 `generic PATCH /api/proxy-bookings/[id]`가 아니라 전용 admin route / card callback 경계로 정리돼 있다
  - 현재 tracked 생성 경로는 새 요청마다 `linked_inquiry_id`를 함께 심고, route read/write도 linked inquiry 전제로만 동작한다
  - repo-wide static audit 기준 추가 tracked creator는 보이지 않았고, `PhoneReservationTab`의 `proxy_comments` realtime 구독도 이번 패스에서 제거됐다
  - 최신 close-out rerun 기준 핵심 non-live bundle은 모두 green이다
  - `86-proxy-booking-team-workspace`도 현재는 page-wide text가 아니라 guest inbox thread persistence를 기준으로 검증되며 green 복구됐다
  - 따라서 현재 최종 판정은 `proxy core chain은 정상`, `남는 것은 boundary-only gap`이다

## Test Execution
- 핵심 재실행 스펙
  - `tests/e2e/86-proxy-booking-team-workspace.spec.ts`
  - `tests/e2e/105-proxy-booking-self-service.spec.ts`
  - `tests/e2e/119-proxy-notification-localization.spec.ts`
  - `tests/e2e/87-proxy-booking-fee-util.spec.ts`
  - `tests/e2e/88-proxy-booking-mobile-layout.spec.ts`
- latest close-out rerun 결과
  - `86-proxy-booking-team-workspace`: `passed`
  - `105-proxy-booking-self-service`: `passed`
  - `119-proxy-notification-localization`: `passed`
  - `87-proxy-booking-fee-util`: `passed`
  - `88-proxy-booking-mobile-layout`: `passed`
- 해석
  - 이전 `86` red는 제품 체인 breakage보다는 selector / assertion scope가 실제 UX 의미보다 넓었던 상태에 가까웠다
  - 현재 스펙은 guest inbox thread persisted visibility 기준으로 정리돼 있어 proxy 운영 체인의 제품 의미와 더 잘 맞는다

## Result Snapshot
| Chain | Source of truth | Current tests | Verdict | Notes |
| --- | --- | --- | --- | --- |
| 공개 진입 / 요청 생성 | `app/proxy-bookings/new/page.tsx`, `/api/proxy-bookings` | `86`, `88`, `87` | 정상 | category별 form_data, `service_fee_krw`, `linked_inquiry_id`, admin alert deep link가 현재 생성 시점에 함께 정리된다 |
| 결제 확정 / 취소 / 환불 | `/api/proxy-bookings/payment/nicepay-callback`, `/api/proxy-bookings/payment/card-notification`, `/api/admin/proxy-bookings/*`, `proxyCardConfirmation.ts` | `74`, `165`, `119`, static audit | 부분 보장 | PortOne 운영 경계에서 notification route의 `202 ignored` contract는 rerun으로 다시 확인됐다. NicePay approval/notification helper와 proxy callback/notification의 shared finalize semantics도 static audit로 맞는다. 다만 proxy notification route 자체를 `CARD_PAYMENT_PROVIDER=nicepay` 상태에서 route-level로 직접 재실행한 건은 아직 없다 |
| TEAM > 전화 예약 운영 | `PhoneReservationTab`, `/api/proxy-bookings/[id]`, `/api/proxy-bookings/[id]/comments` | `86`, reference `15`, `89`, `136` | 정상 | TEAM 탭의 결제 확인, 진행 상태 변경, 운영 답글 저장, 고객 inbox persisted visibility가 latest rerun 기준 green이다 |
| 고객 self-service / 상세 | `app/proxy-bookings/page.tsx`, `app/proxy-bookings/[id]/page.tsx`, `/api/proxy-bookings/[id]` | `105`, `88` | 정상 | 목록 next-step copy, 상세 계좌 안내, message CTA, 결제/진행 상태 반영이 현재 truth와 맞는다 |
| 알림 / localization | `proxyBookingNotifications.ts`, `/api/proxy-bookings/[id]/comments`, `buildLocalizedNotificationInsert` | `119` | 정상 | payment confirm / admin reply notification이 recipient locale 기준으로 저장된다 |
| linked inquiry contract | `/api/proxy-bookings/[id]/comments`, `/api/proxy-bookings/[id]`, `getProxyLinkedInquiryId()` | `86`, `105`, `119`, static audit + runtime probe | 정상 | tracked 생성 경로는 `linked_inquiry_id`를 항상 심고, route read/write도 linked inquiry 전제로만 동작한다. post-cleanup runtime probe 기준 현재 운영 누락 row는 `0`건이다 |

## Confirmed Findings
### 1. 전화 예약 요청 생성은 `proxy_requests` 단일 source로 잘 고정돼 있다
- `POST /api/proxy-bookings`는 Zod validation 이후
  - category별 `form_data`
  - `service_fee_krw`
  - `payment_channel`
  - `payment_method`
  - `linked_inquiry_id`
  를 한 번에 정리해서 `proxy_requests`에 저장한다
- 새 요청 생성 직후 `upsertInquiryThread(contextType='admin_support')`를 호출해 linked inquiry를 먼저 만들고, 그 id를 `form_data.linked_inquiry_id`로 붙인다
- insert 실패 시에는 방금 만든 inquiry/message를 cleanup하는 guarded fallback도 있다
- 생성 직후 관리자 인앱 alert + 관리자 메일은 best-effort side effect로 분리돼 있다

### 2. 결제 상태 변경 owner는 현재 전용 route들로 분리돼 있다
- `LOCALLY + card`
  - 고객 브라우저는 `/api/proxy-bookings/payment/nicepay-callback`으로 승인 검증을 완료한다
  - PG 통보용 `/api/proxy-bookings/payment/card-notification`도 별도 유지한다
  - 둘 다 결국 `finalizeProxyCardPayment()` → `updateProxyPaymentState()`를 공유한다
- `NAVER`, `LOCALLY + bank`
  - `/api/admin/proxy-bookings/confirm-payment`에서만 `WAITING -> COMPLETED`
- 취소 / 환불
  - `/api/admin/proxy-bookings/cancel-payment`: `WAITING -> FAILED`, `status='CANCELLED'`
  - `/api/admin/proxy-bookings/refund-payment`: `COMPLETED -> REFUNDED`
  - card refund는 `tid`가 있어야 PG cancel까지 진행된다
- `PATCH /api/proxy-bookings/[id]`는 결제 상태 변경이 아니라 운영 status 변경 전용으로 유지된다

### 3. TEAM 전화 예약 탭은 현재 active 운영 surface다
- `PhoneReservationTab`은
  - 목록 read: `GET /api/proxy-bookings`
  - 상세 read: `GET /api/proxy-bookings/[id]`
  - 운영 status: `PATCH /api/proxy-bookings/[id]`
  - 결제 액션: `/api/admin/proxy-bookings/confirm-payment|cancel-payment|refund-payment`
  - 답글: `POST /api/proxy-bookings/[id]/comments`
  를 직접 사용한다
- `proxy_requests` realtime과 linked inquiry의 `inquiry_messages` INSERT를 구독해서 선택된 요청 상세를 refresh한다
- 결제 완료 전에는 `IN_PROGRESS` / `COMPLETED`로 못 넘어가도록 UI와 server guard가 둘 다 잠겨 있다

### 4. 고객 self-service는 “상세 유지 + 메시지함 병행” 의미로 정리돼 있다
- `POST /api/proxy-bookings` 성공 후
  - `LOCALLY + bank` 또는 `NAVER`는 `redirectUrl` 기준으로 바로 guest inbox로 보낸다
  - card path도 승인 완료 후 guest inbox로 보낸다
- 하지만 고객용 `/proxy-bookings` 목록과 `/proxy-bookings/[id]` 상세는 계속 유지된다
  - 상세는 계좌 안내, 결제/진행 상태, next-step copy, 메시지함 CTA를 같이 보여준다
- 즉 현재 제품 의미는 “요청 보드는 남기되, 실제 대화 엔진은 inbox를 우선 사용” 쪽이다

### 5. linked inquiry 경계는 이제 route 레벨에서도 고정됐다
- `POST /api/proxy-bookings`
  - 새 요청 생성 시 `upsertInquiryThread(contextType='admin_support')`를 먼저 호출하고, 그 결과 `inquiryId`를 `form_data.linked_inquiry_id`로 같이 저장한다
  - 코드 기준으로는 현재 tracked create path에서 linked inquiry 없이 생성되는 분기가 보이지 않는다
- `POST /api/proxy-bookings/[id]/comments`
  - `linked_inquiry_id`가 없으면 `409`로 fail-closed 한다
  - 연결된 요청만 `createInquiryMessage()`를 사용해 기존 문의 엔진에 답글을 쓴다
- `GET /api/proxy-bookings/[id]`
  - `linked_inquiry_id`가 없으면 `409`로 fail-closed 한다
  - 연결된 요청만 `inquiry_messages`를 comment rows처럼 projection 한다
- `2026-04-12` runtime probe 결과
  - 초기 read-only check에서는 `linked_inquiry_id` 누락 row `1`건이 보였고, inspection 결과 `Locally` 계정 + 테스트성 comment가 붙은 internal artifact로 판정됐다
  - same-day cleanup 후 post-check 기준 현재 `proxy_requests`는 총 `2`건이고, `linked_inquiry_id` 누락 row는 `0`건이다
- 따라서 현재 해석은 “신규 운영 경로는 linked inquiry 우선으로 이미 통일됐고, 현재 운영 runtime에도 확인된 legacy row가 없다. route 레벨 fallback도 제거돼 inquiry 엔진 고정 재사용으로 정리됐다”가 가장 정확하다

### 6. 제거 준비도(removal readiness) 감사는 route close-out까지 진행됐다
- repo-wide static audit 기준 `proxy_requests` 생성자는 현재 두 종류뿐이다
  - production create path: `POST /api/proxy-bookings`
  - test fixture seed: `tests/e2e/105-proxy-booking-self-service.spec.ts`, `tests/e2e/119-proxy-notification-localization.spec.ts`
- latest follow-up 기준 `119-proxy-notification-localization`도 linked inquiry 기반 fixture로 전환됐다
  - `105`는 처음부터 항상 `linked_inquiry_id`를 넣는다
  - `86`은 실제 UI 생성 경로를 타므로 linked inquiry가 같이 생긴다
  - 즉 현재 close-out rerun 묶음에는 `linked_inquiry_id` 없는 legacy fixture를 의도적으로 만드는 스펙이 남아 있지 않다
- 따라서 현재 결론은
  - “운영 데이터 정리”는 이미 끝났고
  - “테스트 fixture 현대화”도 끝났고
  - route fallback 제거까지 별도 patch로 마감됐다

### 7. proxy card callback과 notification은 같은 finalize truth로 수렴한다
- `POST /api/proxy-bookings/payment/nicepay-callback`
  - 인증된 사용자만 호출할 수 있고, `locally_order_id`로 원본 요청을 찾는다
  - owner guard, `payment_channel='LOCALLY'` guard, `payment_status='COMPLETED'` idempotency를 먼저 확인한다
  - 승인 검증은 `verifyApprovedCardPayment()`로 처리한 뒤 `finalizeProxyCardPayment()`로 수렴한다
- `POST /api/proxy-bookings/payment/card-notification`
  - 외부 PG 통보 경계라 owner guard는 없고, `orderId` 우선 / `providerTransactionId` fallback으로 요청을 찾는다
  - 같은 `payment_channel='LOCALLY'` guard와 같은 `COMPLETED` idempotency를 가진다
  - 통보 검증은 `verifyCardPaymentNotification()`로 처리한 뒤 역시 `finalizeProxyCardPayment()`로 수렴한다
- 이번 rerun 근거
  - `74-card-payment-precutover-contract`: 현재 운영 provider가 `portone`일 때 proxy notification route가 `202 ignored`로 inert하게 남는 것을 확인했다
  - `165-card-payment-provider-cutover`: NicePay approval/notification helper가 같은 provider env contract와 같은 금액 검증 의미를 공유하는 것을 확인했다
- 따라서 현재 가장 정확한 해석은 “callback과 notification은 서로 다른 entrypoint이지만, proxy 쪽 write truth는 같은 finalize helper에 묶여 있다. 다만 NicePay provider 상태에서 proxy notification route 자체를 직접 때린 route-level rerun만 아직 남아 있다”이다

## Static Risk Notes
- `POST /api/proxy-bookings`는 linked inquiry를 먼저 만들고, 그 다음 `proxy_requests`를 insert한다
  - insert 실패 cleanup은 있지만, 반대 방향의 orphan risk를 더 줄일지 여부는 이번 감사 범위 밖이다
- `/api/proxy-bookings/payment/card-notification`은 provider가 `nicepay`가 아닐 때 `ignored: true`로 202 응답한다
  - `74-card-payment-precutover-contract`로 현재 운영 provider 기준 inert contract는 확인됐다
  - 다만 `CARD_PAYMENT_PROVIDER=nicepay` 상태에서 proxy route 자체를 직접 호출하는 route-level rerun은 아직 없다
- `PhoneReservationTab`과 고객 상세는 linked inquiry가 있는 요청을 사실상 inbox 엔진으로 읽는데도, UI 라벨은 여전히 “전화 예약 (담당자 소통 스레드)”로 남아 있다
  - 제품 의미상 의도일 수 있으나, 운영/테스트 셀렉터 관점에서는 중복 텍스트 surface를 만들 가능성이 있다

## Coverage Gaps
- 직접 rerun하지 않은 reference
  - `tests/e2e/15-admin-team.spec.ts`
  - `tests/e2e/16-admin-team-chat.spec.ts`
  - `tests/e2e/89-admin-team-mobile.spec.ts`
  - `tests/e2e/136-team-workspace-retention.spec.ts`
- `card-notification` external callback path는 현재 운영 provider(`portone`) 기준으로는 rerun으로 닫혔지만, `nicepay` provider 상태의 proxy route-level dispatch는 아직 직접 재실행하지 않았다
- cleanup된 missing row가 정확히 어떤 historical create path에서 생겼는지까지는 이번 문서에서 단정하지 않는다
- `tests/e2e/105-proxy-booking-self-service.spec.ts`, `tests/e2e/119-proxy-notification-localization.spec.ts`는 모두 linked inquiry 기반 fixture를 사용한다
- 즉 current close-out rerun 묶음과 운영 데이터 모두 `proxy_comments` legacy branch를 더 이상 active truth로 사용하지 않는다

## Follow-up Need
- 1순위
  - 운영 기준 urgent follow-up은 더 이상 route fallback 쪽이 아니다
  - NicePay cutover rehearsal 일정이 잡히면 그때 `CARD_PAYMENT_PROVIDER=nicepay` 상태의 proxy notification route-level contract만 별도 한 번 닫으면 된다
- 2순위
  - 필요하면 `proxy_comments` 테이블/cleanup code 자체를 남길지, schema/fixture 레벨까지 걷어낼지 별도 운영 결정을 내릴 수 있다
- 3순위
  - `card-notification` route를 provider cutover 이후에도 실제 운영 path로 쓸 계획이면 proxy-specific fixture를 둔 route-level rerun을 묶는 편이 안전하다

## Final Verdict
- 전화 예약(proxy) 운영 체인은 현재 `proxy_requests` 단일 source, 전용 결제 route, TEAM 운영 탭, 고객 self-service surface가 비교적 잘 정리돼 있다
- latest close-out rerun과 payment notification boundary rerun 기준 핵심 non-live bundle은 모두 green이다
- 따라서 현재 남은 것은 제품 breakage가 아니라 future NicePay cutover rehearsal에서만 의미가 커지는 route-level boundary gap이다
- 이번 감사 기준 최종 판정은 `proxy core chain은 정상`, `proxy card notification 경계는 현재 운영 기준 정상에 가깝지만 future NicePay direct route rerun 전까지는 부분 보장으로 유지`가 가장 정확하다
