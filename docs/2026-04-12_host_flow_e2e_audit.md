# 호스트 플로우 엔드투엔드 구조 점검

## Summary
- 감사 범위: `호스트 진입/모드 전환 → 호스트 신청/승인 → 체험 생성·수정·일정 관리 → 예약·문의·리뷰 응대 → 수익·서비스 매칭 → public/admin 경계`
- 1차 범위 고정: `/host` UI, `app/api/host/*`, `Auth/ViewMode` 연속성 중심
- boundary-only 포함: public host profile `/users/[id]`, guest-facing host projection, admin host approval/payout/analytics reflection
- 제외 범위: live mutation 재실행
  - `tests/e2e/03-live-host-signup-registration.spec.ts`
  - `tests/e2e/04-live-host-experience-create.spec.ts`
- 실행 방식: 정적 코드 감사 + non-live E2E 재실행 + 실패 subset 재실행
- 최신 재실행 결과
  - host non-live 묶음: `55 passed / 5 failed / 4 did not run`
  - 실패 subset 재실행: `5 failed / 0 healed`
- 최종 판정
  - `호스트 신청/승인 route`, `체험 write/delete route`, `리뷰 write/reply`, `수익/정산/서비스 매칭`은 현재 기준 `정상`
  - `호스트 진입/모드 전환`, `대시보드 approval refresh`, `체험 dates/detail 일부 UI smoke`는 `부분 보장`
  - persistent findings 5건 중 1건은 실제 host-flow 리스크, 4건은 locale/copy 또는 brittle UI expectation drift 성격이 강하다

## Test Execution
- ingress / status / mode
  - `tests/e2e/109-host-landing-guidance.spec.ts`
  - `tests/e2e/55-host-view-mode-persistence.spec.ts`
  - `tests/e2e/97-host-register-visibility.spec.ts`
  - `tests/e2e/98-host-approved-welcome-overlay.spec.ts`
  - `tests/e2e/140-host-status-refresh-after-approval.spec.ts`
  - `tests/e2e/141-host-landing-cta-refresh-after-approval.spec.ts`
- register / profile / create / manage
  - `tests/e2e/36-host-register-submit.spec.ts`
  - `tests/e2e/38-host-profile-save.spec.ts`
  - `tests/e2e/129-host-profile-language-dedup.spec.ts`
  - `tests/e2e/93-host-create-copy-layout.spec.ts`
  - `tests/e2e/32-host-schedule-save.spec.ts`
  - `tests/e2e/34-host-edit-and-dates-ui.spec.ts`
  - `tests/e2e/33-host-experience-delete.spec.ts`
  - `tests/e2e/35-host-experience-detail-delete-ui.spec.ts`
  - `tests/e2e/51-host-mobile-photo-actions.spec.ts`
  - `tests/e2e/126-host-public-visibility.spec.ts`
  - `tests/e2e/71-public-host-profile.spec.ts`
- operations / reviews
  - `tests/e2e/40-host-reservations-inquiries-ui.spec.ts`
  - `tests/e2e/39-host-review-routes.spec.ts`
  - `tests/e2e/72-review-host-notification.spec.ts`
  - `tests/e2e/92-host-unavailable-review-notifications.spec.ts`
  - `tests/e2e/122-review-reply-notification-localization.spec.ts`
- earnings / service / admin reflection
  - `tests/e2e/37-host-earnings-policy.spec.ts`
  - `tests/e2e/133-host-payout-summary-reflection.spec.ts`
  - `tests/e2e/153-host-unified-earnings-summary.spec.ts`
  - `tests/e2e/154-host-earnings-mobile-layout.spec.ts`
  - `tests/e2e/152-host-service-earnings-separation.spec.ts`
  - `tests/e2e/106-service-host-flow-guidance.spec.ts`
  - `tests/e2e/22-service-host-notification-scope.spec.ts`
  - `tests/e2e/50-service-select-host-atomicity.spec.ts`
  - `tests/e2e/130-admin-settle-host-payout-guard.spec.ts`
  - `tests/e2e/134-admin-payout-queue-unified-host-rollup.spec.ts`

## Summary Matrix
| 체인 | source of truth | 현재 보장 테스트 | 판정 | 핵심 메모 |
| --- | --- | --- | --- | --- |
| 호스트 진입 / 랜딩 / 승인 상태 | `/become-a-host`, `AuthContext`, `ViewModeContext`, `/host/menu`, `/host/dashboard` | `109`, `97`, `98`, `141` | 부분 보장 | landing CTA refresh는 green이지만 dashboard revision→approved 무새로고침 전환은 깨진다 |
| 호스트 신청 / 재제출 / 승인 경계 | `/host/register`, `/api/host/register/submit`, `host_applications`, profile seed | `36`, `97`, `98`, `141` | 정상 | approved re-submit fail-closed, validation, admin alert 경로는 유지된다 |
| 체험 작성 / 수정 / 삭제 / 일정 관리 | `/host/create`, `/api/host/experiences*`, `/host/experiences/[id]*` | `93`, `32`, `33`, `51`, `126` | 부분 보장 | route 계약은 정상이나 dates/detail UI smoke 2건이 persistent failure다 |
| 예약 / 문의 / 리뷰 응대 | `ReservationManager`, `InquiryChat`, `HostReviews`, `/api/host/start-chat`, `/api/host/guest-reviews`, `/api/host/reviews/reply` | `39`, `72`, `92`, `122` | 정상 | core route/notification 경로는 green, `40`의 일본어 경고문만 stale copy failure |
| 수익 / 정산 / 서비스 매칭 | `Earnings`, `/api/host/earnings/*`, `ServiceJobsTab`, service board/applications flow | `37`, `133`, `153`, `154`, `152`, `106`, `22`, `50`, `130`, `134` | 정상 | host earnings와 admin payout reflection은 현재 기준 정합적 |
| public/admin boundary reflection | public host profile, guest detail host projection, admin host payout/analytics | `71`, `126`, `130`, `134` | 정상 | approved visibility, public profile read path, admin payout rollup 연결은 유지된다 |

## Chain-by-Chain Audit

### 1. 호스트 진입 / 모드 전환 / 승인 상태 연속성
- source of truth
  - [app/become-a-host/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/become-a-host/page.tsx:1)
  - [app/become-a-host2/HostLandingActionBar.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/become-a-host2/HostLandingActionBar.tsx:1)
  - [app/context/AuthContext.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/context/AuthContext.tsx:1)
  - [app/context/ViewModeContext.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/context/ViewModeContext.tsx:1)
  - [app/components/mobile/MobileHostMenu.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/mobile/MobileHostMenu.tsx:1)
  - [app/host/dashboard/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/dashboard/page.tsx:1)
- 기대 상태 전이
  - 비호스트는 `/become-a-host` 또는 `/host/register`로 유도된다
  - pending/revision/rejected는 host dashboard full access가 막히고 상태 화면으로 고정된다
  - approved/active는 host view 전환과 dashboard 진입이 가능해야 한다
  - approval notification은 welcome overlay와 연결된다
- 현재 보장 테스트
  - `109`, `97`, `98`, `141`
- 실제 결과
  - 판정: `부분 보장`
  - 메모
    - `141`은 host landing CTA가 revision→approved 이후 무새로고침으로 `Switch to Host`로 바뀌는 것을 보장한다
    - 그러나 `140`은 같은 승인 이벤트 뒤 `/host/dashboard`가 15초 안에 revision screen에서 approval welcome overlay로 전환되지 못한다
    - code상 dashboard는 `applicationStatus` refresh가 늦으면 revision early return에 그대로 머물 수 있다
    - `AuthContext`의 pending/revision/rejected fallback poll이 `30_000ms`라서, 현 테스트 기대(15초) 기준으로는 stale window가 남아 있다

### 2. 호스트 신청 / 재제출 / 승인 경계
- source of truth
  - [app/host/register/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/register/page.tsx:1)
  - [app/api/host/register/submit/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/register/submit/route.ts:1)
  - [app/api/host/register/admin-alert/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/register/admin-alert/route.ts:1)
- 기대 상태 전이
  - 신규 신청은 pending application을 만든다
  - rejected/revision 재제출은 같은 흐름으로 pending으로 되돌린다
  - approved 상태 재제출은 승인 row를 덮어쓰지 않는다
  - missing profile fields는 seed update로 메운다
- 현재 보장 테스트
  - `36`, `97`
  - approval reflection: `98`, `141`
- 실제 결과
  - 판정: `정상`
  - 메모
    - validation, profile photo/id card URL contract, normalized dob, account holder guard, approved fail-closed가 모두 현재 기준 green

### 3. 체험 작성 / 수정 / 삭제 / 일정 관리 / 공개 반영
- source of truth
  - [app/host/create/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/create/page.tsx:1)
  - [app/api/host/experiences/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/experiences/route.ts:1)
  - [app/api/host/experiences/shared.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/experiences/shared.ts:1)
  - [app/host/experiences/[id]/edit/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/experiences/%5Bid%5D/edit/page.tsx:1)
  - [app/host/experiences/[id]/dates/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/experiences/%5Bid%5D/dates/page.tsx:1)
  - [app/api/host/experiences/[id]/availability/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/experiences/%5Bid%5D/availability/route.ts:94)
- 기대 상태 전이
  - create/edit가 같은 write semantics를 공유한다
  - delete route는 owner only + active booking guard를 가진다
  - availability save는 booked slot 보호 규칙을 유지한다
  - approved visibility는 public host/profile surfaces와 같은 기준을 본다
- 현재 보장 테스트
  - `93`, `32`, `33`, `51`, `126`, `71`, `129`
- 실제 결과
  - 판정: `부분 보장`
  - 메모
    - server route 계약은 현재 기준 정상이다
      - `32` availability route green
      - `33` delete route green
      - `126`, `71`, `129` public reflection green
    - persistent failures 2건이 남았다
      - `34` host dashboard dates UI
        - selected date가 기대 `2026-04-14` 대신 `2026-04-15`로 잡힌 snapshot이 재현됐다
        - route 저장 자체가 아니라 calendar day selection contract 또는 test locator brittle issue에 가깝다
      - `35` host detail delete UI
        - detail page에 delete button은 실제 존재하지만 snapshot상 accessible name이 `Delete`로 렌더링되어 Korean-only expectation이 깨진다
        - delete route failure가 아니라 detail UI locale expectation drift 성격이 강하다

### 4. 예약 / 문의 / 게스트 컨텍스트 / 리뷰 응대
- source of truth
  - [app/host/dashboard/components/ReservationManager.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/dashboard/components/ReservationManager.tsx:1)
  - [app/host/dashboard/InquiryChat.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/dashboard/InquiryChat.tsx:1)
  - [app/host/dashboard/HostReviews.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/dashboard/HostReviews.tsx:1)
  - [app/api/host/start-chat/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/start-chat/route.ts:1)
  - [app/api/host/guest-reviews/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/guest-reviews/route.ts:1)
  - [app/api/host/reviews/reply/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/reviews/reply/route.ts:1)
- 기대 상태 전이
  - reservation tabs는 booking truth와 일치해야 한다
  - inquiry deep link는 `guestId/expId/inquiryId` 기반 bootstrap이 가능해야 한다
  - host review reply와 guest review write는 owner guard와 notification/email side effects를 가진다
- 현재 보장 테스트
  - `39`, `72`, `92`, `122`
  - `40` 일부 UI smoke
- 실제 결과
  - 판정: `정상`
  - 메모
    - review reply, guest review write, host notification flow는 모두 green
    - `40`의 일본어 warning strip copy만 persistent failure인데, 현재 source string은 `LanguageContext`에서 더 짧은 새 문구로 바뀌어 있어 stale expectation으로 분류한다
    - 같은 파일의 service unread mark-as-read, guest profile modal, inquiry chat reply 케이스는 통과했다

### 5. 호스트 수익 / 정산 반영 / 서비스 매칭
- source of truth
  - [app/host/dashboard/Earnings.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/dashboard/Earnings.tsx:1)
  - [app/api/host/earnings/summary/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/earnings/summary/route.ts:1)
  - [app/api/host/earnings/services/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/earnings/services/route.ts:1)
  - [app/host/dashboard/components/ServiceJobsTab.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/dashboard/components/ServiceJobsTab.tsx:1)
- 기대 상태 전이
  - experience/service earnings는 분리 계산되되 unified summary로 합쳐진다
  - admin payout queue/sales summary는 같은 host payout truth를 읽는다
  - host service jobs는 `열린 의뢰 / 내 지원 현황` 구조와 unread badge semantics를 유지한다
- 현재 보장 테스트
  - `37`, `133`, `153`, `154`, `152`, `106`, `22`, `50`, `130`, `134`
- 실제 결과
  - 판정: `정상`
  - 메모
    - pending / in-progress / paid bucket, unified rollup, service separation, admin settle guard가 모두 현재 기준 green

## Confirmed Findings
1. `host dashboard`의 revision → approved 무새로고침 전환은 현재 끊긴다
   - source of truth
     - [app/host/dashboard/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/dashboard/page.tsx:173)
     - [app/context/AuthContext.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/context/AuthContext.tsx:31)
   - 증상
     - `tests/e2e/140-host-status-refresh-after-approval.spec.ts`가 독립 재실행에서도 실패
     - approval notification insert 후에도 revision screen이 15초 안에 overlay로 전환되지 않는다
   - 분류: `product risk`
   - severity: `medium`
   - 이유
     - landing CTA refresh(`141`)는 green이지만 dashboard status refresh + welcome overlay chain은 현재 동기 보장이 부족하다

2. host dates dashboard UI는 route 보장에 비해 UI continuity가 약하다
   - source of truth
     - [app/host/experiences/[id]/dates/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/experiences/%5Bid%5D/dates/page.tsx:298)
   - 증상
     - `tests/e2e/34-host-edit-and-dates-ui.spec.ts`가 독립 재실행에서도 실패
     - selected date snapshot이 target day와 1일 어긋난 상태로 재현됐다
   - 분류: `ui contract gap`
   - severity: `low-medium`
   - 이유
     - `32` route contract는 green이라 server write integrity는 보장된다
     - 현재 깨지는 지점은 calendar day selection or selector contract 쪽이다

3. host detail delete UI smoke는 locale expectation drift가 남아 있다
   - source of truth
     - [app/host/experiences/[id]/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/experiences/%5Bid%5D/page.tsx:105)
   - 증상
     - `tests/e2e/35-host-experience-detail-delete-ui.spec.ts`가 독립 재실행에서도 실패
     - snapshot상 delete button은 존재하지만 accessible name이 `Delete`
   - 분류: `test drift`
   - severity: `low`
   - 이유
     - `33` delete route는 green이고, 실제 UI surface도 존재한다
     - failure는 locale-fixed selector expectation에 가깝다

4. host view mode persistence smoke는 locale-fixed CTA expectation이 stale하다
   - source of truth
     - [app/account/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/account/page.tsx:636)
   - 증상
     - `tests/e2e/55-host-view-mode-persistence.spec.ts`가 독립 재실행에서도 실패
     - snapshot상 CTA는 존재하지만 label이 `Switch to Host`
   - 분류: `test drift`
   - severity: `low`
   - 이유
     - 버튼 노출 자체는 살아 있고, failure는 Korean-only accessible name expectation이다

5. reservations warning strip 일본어 문구 expectation이 stale하다
   - source of truth
     - [app/host/dashboard/components/ReservationManager.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/dashboard/components/ReservationManager.tsx:519)
     - [app/context/LanguageContext.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/context/LanguageContext.tsx:3191)
   - 증상
     - `tests/e2e/40-host-reservations-inquiries-ui.spec.ts`가 독립 재실행에서도 실패
     - 현재 ja copy는 더 짧은 새 문구인데 test는 이전 장문 copy를 기대한다
   - 분류: `copy drift`
   - severity: `low`

## Coverage Gaps
- live mutation coverage는 이번 감사에서 재실행하지 않았다
  - `tests/e2e/03-live-host-signup-registration.spec.ts`
  - `tests/e2e/04-live-host-experience-create.spec.ts`
- `55`, `35`, `40`은 host core logic gap보다 locale/copy expectation drift 성격이 강하다
- `34`는 route integrity는 보장되지만, 실제 calendar selection UX가 test helper drift인지 제품 문제인지 추가 probe 없이는 단정하기 어렵다

## Follow-up Need
- 즉시 후속 구현/수정이 필요한 우선순위 1건
  - host dashboard approval refresh
    - revision/pending screen에 머물던 세션이 승인 후 더 빠르게 `applicationStatus`와 overlay state를 반영하도록 점검 필요
- 테스트 신뢰도 복구 후속 3건
  - `55-host-view-mode-persistence`를 locale-agnostic selector로 보강
  - `35-host-experience-detail-delete-ui`를 locale-agnostic selector 또는 confirm-modal flow 기준으로 보강
  - `40-host-reservations-inquiries-ui`의 일본어 warning strip copy expectation 갱신
- 분류 확인용 수동 probe 1건
  - host dates UI에서 target day click이 실제로 하루 밀리는지, 아니면 `dayCell()` selector drift인지 확인

## Final Verdict
- 호스트 신청/승인 route, 체험 create/edit/delete route, 리뷰 write/reply, 수익/정산/서비스 매칭은 현재 기준 `정상`
- 현재 감사 기준의 핵심 persistent host-flow 리스크는 `dashboard revision → approved refresh/overlay chain` 1건이다
- 나머지 persistent failures는 대부분 locale/copy 또는 brittle UI smoke drift라서, 호스트 도메인 본체 전체가 불안정하다고 보기는 어렵다
- 따라서 이번 감사의 최종 판정은 `전반 정상, 단 host dashboard approval refresh와 일부 UI smoke 신뢰도는 후속 정리 필요`다
