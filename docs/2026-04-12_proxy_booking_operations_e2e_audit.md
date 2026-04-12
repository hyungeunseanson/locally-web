# 전화 예약(proxy) 운영 체인 엔드투엔드 구조 점검

## Summary
- 감사 범위: `공개 진입 / 요청 생성 → 결제 분기(NAVER / LOCALLY card / LOCALLY bank) → TEAM > 전화 예약 운영 → linked inquiry 또는 legacy proxy_comments → 고객 self-service 반영`
- 제외 범위: `서비스 의뢰 상태 머신`, `커뮤니티`, `live mutation`, 일반 체험 예약/결제 도메인
- 실행 방식: 정적 코드 감사 + 핵심 non-live E2E 재실행
- 이번 패스 핵심 결론
  - 전화 예약 도메인의 write/read source of truth는 현재 `proxy_requests`로 잘 고정되어 있다
  - 결제 상태 변경 owner도 `generic PATCH /api/proxy-bookings/[id]`가 아니라 전용 admin route / card callback 경계로 정리돼 있다
  - linked inquiry가 있는 요청은 고객 소통을 기존 `inquiries / inquiry_messages` 엔진으로 재사용하고, linked inquiry가 없는 요청만 `proxy_comments` fallback을 유지한다
  - warmed rerun 기준 핵심 흐름은 대체로 정상이다
  - 다만 `tests/e2e/86-proxy-booking-team-workspace.spec.ts`는 실제 고객 화면에 같은 운영 답글이 여러 surface(대화 목록 preview, thread bubble, toast)로 동시에 보이면서 strict locator가 모호해져 실패했다
    - 현재 관찰로는 기능 자체 failure보다는 stale selector / test noise 가능성이 높다
  - 따라서 현재 최종 판정은 `proxy core chain은 정상`, `일부 boundary와 스펙 hygiene는 부분 보장`이다

## Test Execution
- 핵심 재실행 스펙
  - `tests/e2e/86-proxy-booking-team-workspace.spec.ts`
  - `tests/e2e/105-proxy-booking-self-service.spec.ts`
  - `tests/e2e/119-proxy-notification-localization.spec.ts`
  - `tests/e2e/87-proxy-booking-fee-util.spec.ts`
  - `tests/e2e/88-proxy-booking-mobile-layout.spec.ts`
- cold run 결과
  - `87`만 즉시 green
  - `105`, `119`, `86`은 로그인 후 URL 이탈 대기 timeout
  - `88`은 `/proxy-bookings/new` 첫 `goto`에서 abort
  - server log 기준 `/api/admin/access`, `/` 렌더가 cold compile 때문에 `20~30s`까지 튀어 제품 판정에서 제외하는 것이 맞다
- warmed rerun 결과
  - `87-proxy-booking-fee-util`: `passed`
  - `88-proxy-booking-mobile-layout`: `passed`
  - `105-proxy-booking-self-service`: `passed`
  - `119-proxy-notification-localization`: `passed`
  - `86-proxy-booking-team-workspace`: `failed`
    - 실제 실패 내용: `customerPage.getByText(replyText)`가 3개 element로 resolve되는 strict locator ambiguity
    - error snapshot 기준 고객 화면에서 같은 reply text가
      - 대화 목록 preview
      - thread bubble
      - toast
      에 동시에 나타났다
    - 따라서 현재 해석은 기능 회귀라기보다 “답글이 더 많이/잘 보이게 된 결과로 기존 selector가 너무 넓어진 상태”에 가깝다

## Result Snapshot
| Chain | Source of truth | Current tests | Verdict | Notes |
| --- | --- | --- | --- | --- |
| 공개 진입 / 요청 생성 | `app/proxy-bookings/new/page.tsx`, `/api/proxy-bookings` | `86`, `88`, `87` | 정상 | category별 form_data, `service_fee_krw`, `linked_inquiry_id`, admin alert deep link가 현재 생성 시점에 함께 정리된다 |
| 결제 확정 / 취소 / 환불 | `/api/proxy-bookings/payment/nicepay-callback`, `/api/proxy-bookings/payment/card-notification`, `/api/admin/proxy-bookings/*`, `proxyCardConfirmation.ts` | `119`, static audit | 부분 보장 | NAVER/무통장 수동 확인, card 완료/환불 경계는 정리돼 있으나 external notification route는 이번 패스에서 직접 재실행하지 않았다 |
| TEAM > 전화 예약 운영 | `PhoneReservationTab`, `/api/proxy-bookings/[id]`, `/api/proxy-bookings/[id]/comments` | `86`, reference `15`, `89`, `136` | 부분 보장 | 운영 동선은 기능상 정상으로 보이나 `86`의 customer-side locator가 현재 UI 중복 surface를 정확히 좁히지 못한다 |
| 고객 self-service / 상세 | `app/proxy-bookings/page.tsx`, `app/proxy-bookings/[id]/page.tsx`, `/api/proxy-bookings/[id]` | `105`, `88` | 정상 | 목록 next-step copy, 상세 계좌 안내, message CTA, 결제/진행 상태 반영이 현재 truth와 맞는다 |
| 알림 / localization | `proxyBookingNotifications.ts`, `/api/proxy-bookings/[id]/comments`, `buildLocalizedNotificationInsert` | `119` | 정상 | payment confirm / admin reply notification이 recipient locale 기준으로 저장된다 |
| linked inquiry / legacy fallback | `/api/proxy-bookings/[id]/comments`, `/api/proxy-bookings/[id]`, `getProxyLinkedInquiryId()` | `86`, `119`, static audit | 부분 보장 | linked inquiry가 있으면 inquiry 엔진 재사용, 없으면 `proxy_comments` fallback 유지. 둘 다 current path로 남아 있다 |

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
- `POST /api/proxy-bookings/[id]/comments`
  - `linked_inquiry_id`가 있으면 `createInquiryMessage()`를 사용해 기존 문의 엔진에 답글을 쓴다
  - 없으면 `proxy_comments`에 직접 저장한다
- `GET /api/proxy-bookings/[id]`
  - linked inquiry가 있으면 `inquiry_messages`를 comment rows처럼 projection 한다
  - 없으면 `proxy_comments`를 그대로 읽는다
- 따라서 proxy 도메인은 현재 “완전 통일”이 아니라 “linked inquiry 우선 + legacy fallback 유지” 상태다

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
- `86-proxy-booking-team-workspace`는 strict locator ambiguity 때문에 스펙 자체는 red지만, 현재 evidence로는 기능 회귀보다 selector 노이즈에 가깝다
- `card-notification` external callback path는 static audit로만 확인했고, 이번 패스에서는 직접 재실행하지 않았다
- linked inquiry 미존재 legacy branch(`proxy_comments`)가 실제 운영에서 여전히 필요한지까지는 이번 문서에서 단정하지 않는다

## Follow-up Need
- 1순위
  - `86-proxy-booking-team-workspace`의 customer-side reply assertion을 현재 UI truth에 맞게 좁히는 얇은 테스트 유지보수가 필요하다
  - 예: guest inbox thread bubble 또는 specific container 기준으로 selector를 한정
- 2순위
  - linked inquiry 미존재 legacy `proxy_comments` branch를 계속 유지할지, 완전 통일할지 운영 결정을 내려야 한다
- 3순위
  - `card-notification` route를 provider cutover 이후에도 실제 운영 path로 쓸 계획이면 별도 contract rerun을 묶는 편이 안전하다

## Final Verdict
- 전화 예약(proxy) 운영 체인은 현재 `proxy_requests` 단일 source, 전용 결제 route, TEAM 운영 탭, 고객 self-service surface가 비교적 잘 정리돼 있다
- warmed rerun 기준 핵심 흐름은 대체로 정상이다
- 현재 남은 핵심 red는 제품 체인 breakage라기보다 `86`의 strict locator ambiguity 1건이다
- 따라서 이번 감사 기준 최종 판정은 `proxy core chain은 정상, boundary / test hygiene는 부분 보장`이다
