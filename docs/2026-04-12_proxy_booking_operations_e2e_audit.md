# 전화 예약(proxy) 운영 체인 엔드투엔드 구조 점검

## Summary
- 감사 범위: `공개 진입 / 요청 생성 → 결제 분기(NAVER / LOCALLY card / LOCALLY bank) → TEAM > 전화 예약 운영 → linked inquiry 또는 legacy proxy_comments → 고객 self-service 반영`
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
- 이번 패스 핵심 결론
  - 전화 예약 도메인의 write/read source of truth는 현재 `proxy_requests`로 잘 고정되어 있다
  - 결제 상태 변경 owner도 `generic PATCH /api/proxy-bookings/[id]`가 아니라 전용 admin route / card callback 경계로 정리돼 있다
  - 현재 tracked 생성 경로는 새 요청마다 `linked_inquiry_id`를 함께 심고, linked inquiry가 없는 경우에만 `proxy_comments` fallback을 유지한다
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
| 결제 확정 / 취소 / 환불 | `/api/proxy-bookings/payment/nicepay-callback`, `/api/proxy-bookings/payment/card-notification`, `/api/admin/proxy-bookings/*`, `proxyCardConfirmation.ts` | `119`, static audit | 부분 보장 | NAVER/무통장 수동 확인, card 완료/환불 경계는 정리돼 있으나 external notification route는 이번 패스에서 직접 재실행하지 않았다 |
| TEAM > 전화 예약 운영 | `PhoneReservationTab`, `/api/proxy-bookings/[id]`, `/api/proxy-bookings/[id]/comments` | `86`, reference `15`, `89`, `136` | 정상 | TEAM 탭의 결제 확인, 진행 상태 변경, 운영 답글 저장, 고객 inbox persisted visibility가 latest rerun 기준 green이다 |
| 고객 self-service / 상세 | `app/proxy-bookings/page.tsx`, `app/proxy-bookings/[id]/page.tsx`, `/api/proxy-bookings/[id]` | `105`, `88` | 정상 | 목록 next-step copy, 상세 계좌 안내, message CTA, 결제/진행 상태 반영이 현재 truth와 맞는다 |
| 알림 / localization | `proxyBookingNotifications.ts`, `/api/proxy-bookings/[id]/comments`, `buildLocalizedNotificationInsert` | `119` | 정상 | payment confirm / admin reply notification이 recipient locale 기준으로 저장된다 |
| linked inquiry / legacy fallback | `/api/proxy-bookings/[id]/comments`, `/api/proxy-bookings/[id]`, `getProxyLinkedInquiryId()` | `86`, `119`, static audit | 부분 보장 | tracked 생성 경로는 `linked_inquiry_id`를 항상 심는다. 현재 `proxy_comments` fallback은 legacy row 또는 수동 seeded fixture 보호 경계로 남아 있다 |

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
- `proxy_requests` realtime과 `proxy_comments`, `inquiry_messages` INSERT를 함께 구독해서 선택된 요청 상세를 refresh한다
- 결제 완료 전에는 `IN_PROGRESS` / `COMPLETED`로 못 넘어가도록 UI와 server guard가 둘 다 잠겨 있다

### 4. 고객 self-service는 “상세 유지 + 메시지함 병행” 의미로 정리돼 있다
- `POST /api/proxy-bookings` 성공 후
  - `LOCALLY + bank` 또는 `NAVER`는 `redirectUrl` 기준으로 바로 guest inbox로 보낸다
  - card path도 승인 완료 후 guest inbox로 보낸다
- 하지만 고객용 `/proxy-bookings` 목록과 `/proxy-bookings/[id]` 상세는 계속 유지된다
  - 상세는 계좌 안내, 결제/진행 상태, next-step copy, 메시지함 CTA를 같이 보여준다
- 즉 현재 제품 의미는 “요청 보드는 남기되, 실제 대화 엔진은 inbox를 우선 사용” 쪽이다

### 5. linked inquiry 경계는 상당히 정리됐지만 legacy fallback이 아직 남아 있다
- `POST /api/proxy-bookings`
  - 새 요청 생성 시 `upsertInquiryThread(contextType='admin_support')`를 먼저 호출하고, 그 결과 `inquiryId`를 `form_data.linked_inquiry_id`로 같이 저장한다
  - 코드 기준으로는 현재 tracked create path에서 linked inquiry 없이 생성되는 분기가 보이지 않는다
- `POST /api/proxy-bookings/[id]/comments`
  - `linked_inquiry_id`가 있으면 `createInquiryMessage()`를 사용해 기존 문의 엔진에 답글을 쓴다
  - 없으면 `proxy_comments`에 직접 저장한다
- `GET /api/proxy-bookings/[id]`
  - linked inquiry가 있으면 `inquiry_messages`를 comment rows처럼 projection 한다
  - 없으면 `proxy_comments`를 그대로 읽는다
- 따라서 현재 해석은 “신규 운영 경로는 linked inquiry 우선으로 이미 통일됐고, `proxy_comments`는 legacy row / 수동 fixture 보호용 fallback으로 남아 있다”가 가장 가깝다

## Static Risk Notes
- `POST /api/proxy-bookings`는 linked inquiry를 먼저 만들고, 그 다음 `proxy_requests`를 insert한다
  - insert 실패 cleanup은 있지만, 반대 방향의 orphan risk를 더 줄일지 여부는 이번 감사 범위 밖이다
- `/api/proxy-bookings/payment/card-notification`은 provider가 `nicepay`가 아닐 때 `ignored: true`로 202 응답한다
  - 현재 운영 provider cutover 정책과는 맞지만, external notification path는 이번 패스에서 E2E로 직접 닫히지 않았다
- `PhoneReservationTab`과 고객 상세는 linked inquiry가 있는 요청을 사실상 inbox 엔진으로 읽는데도, UI 라벨은 여전히 “전화 예약 (담당자 소통 스레드)”로 남아 있다
  - 제품 의미상 의도일 수 있으나, 운영/테스트 셀렉터 관점에서는 중복 텍스트 surface를 만들 가능성이 있다

## Coverage Gaps
- 직접 rerun하지 않은 reference
  - `tests/e2e/15-admin-team.spec.ts`
  - `tests/e2e/16-admin-team-chat.spec.ts`
  - `tests/e2e/89-admin-team-mobile.spec.ts`
  - `tests/e2e/136-team-workspace-retention.spec.ts`
- `card-notification` external callback path는 static audit로만 확인했고, 이번 패스에서는 직접 재실행하지 않았다
- tracked 생성 경로 밖에서 만들어진 legacy row가 실제 운영 데이터에 여전히 남아 있는지까지는 이번 문서에서 단정하지 않는다
- `tests/e2e/105-proxy-booking-self-service.spec.ts`, `tests/e2e/119-proxy-notification-localization.spec.ts`는 여전히 linked inquiry 유무를 수동 fixture로 seed할 수 있어 fallback branch 자체는 테스트 surface에 남아 있다

## Follow-up Need
- 1순위
  - production에 `linked_inquiry_id` 없는 legacy proxy row가 실제로 남아 있는지 runtime evidence를 먼저 확인해야 한다
  - 그 결과가 `없음`이면 `proxy_comments` fallback 제거 계획으로, `있음`이면 유지 범위를 legacy read/write 보호로만 더 명확히 잠그는 쪽이 안전하다
- 2순위
  - `card-notification` route를 provider cutover 이후에도 실제 운영 path로 쓸 계획이면 별도 contract rerun을 묶는 편이 안전하다

## Final Verdict
- 전화 예약(proxy) 운영 체인은 현재 `proxy_requests` 단일 source, 전용 결제 route, TEAM 운영 탭, 고객 self-service surface가 비교적 잘 정리돼 있다
- latest close-out rerun 기준 핵심 non-live bundle은 모두 green이다
- 따라서 현재 남은 것은 제품 breakage가 아니라 `external card-notification verification`, `linked inquiry 미존재 legacy fallback` 같은 boundary-only gap이다
- 이번 감사 기준 최종 판정은 `proxy core chain은 정상, boundary-only gap은 부분 보장`이다
