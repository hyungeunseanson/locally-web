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
  - 초기 host non-live 묶음: `55 passed / 5 failed / 4 did not run`
  - approval refresh 핀셋 수정 후 관련 subset: `6 passed`
  - locale/test drift 보정 후 관련 subset: `9 passed`
  - host approval happy path 보강 subset: `3 passed`
  - revision resubmit UI 보강 subset: `8 passed`
  - host dates classification subset
    - `34-host-edit-and-dates-ui.spec.ts`: `1 failed / 1 did not run / 1 passed`
    - `32-host-schedule-save.spec.ts`: `3 passed`
    - `34` failing-case immediate rerun: `1 passed`
    - `34` probe-hardened full file rerun: `3 passed`
    - `34` probe-hardened failing-case `--repeat-each=3`: `2 failed / 1 passed`
  - 최종 host non-live 묶음 재실행: `62 passed / 1 failed / 1 did not run`
- 최종 판정
  - `호스트 진입/모드 전환`, `체험 edit/delete route`, `리뷰 write/reply`, `수익/정산/서비스 매칭`은 현재 기준 `정상`
  - `호스트 신청/승인 경계`는 tracked 제품 경로 기준으로는 안정적이고, 남은 이슈도 현재는 `live product bug`보다 `legacy compatibility cleanup` 성격이 더 강하다
  - 초기 persistent findings 5건 중 `140`, `55`, `35`, `40`은 이번 패스에서 해소되었다
  - 현재 남은 것은 `legacy admin-alert external-client cleanup gap`과 `34 host dates UI 분류 미완료`이며, 둘 다 `confirmed product regression`보다는 감사/계약 정밀화 성격이 더 강하다

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
  - `tests/e2e/164-admin-host-approval-happy-path.spec.ts`
  - `tests/e2e/167-host-register-revision-resubmit-ui.spec.ts`
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
| 호스트 진입 / 랜딩 / 승인 상태 | `/become-a-host`, `AuthContext`, `ViewModeContext`, `/host/menu`, `/host/dashboard` | `109`, `97`, `98`, `140`, `141`, `55` | 정상 | approval refresh와 view mode persistence는 최신 기준 green |
| 호스트 신청 / 재제출 / 승인 경계 | `/host/register`, `/api/host/register/submit`, `/api/admin/host-applications`, `updateAdminStatus()`, `AuthContext` | `36`, `97`, `07`, `98`, `140`, `141`, `164`, `167` | 부분 보장 | tracked client는 submit route만 호출하고 git history도 legacy 분리를 확인해 주지만, external stale client용 admin-alert compatibility endpoint는 아직 남아 있다 |
| 체험 작성 / 수정 / 삭제 / 일정 관리 | `/host/create`, `/api/host/experiences*`, `/host/experiences/[id]*` | `93`, `32`, `33`, `34`, `35`, `51`, `126` | 부분 보장 | delete/detail smoke는 회복됐고, `34`의 schedule add interaction만 간헐 실패가 남는다 |
| 예약 / 문의 / 리뷰 응대 | `ReservationManager`, `InquiryChat`, `HostReviews`, `/api/host/start-chat`, `/api/host/guest-reviews`, `/api/host/reviews/reply` | `39`, `40`, `72`, `92`, `122` | 정상 | warning strip copy expectation까지 최신 기준 green |
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
  - `109`, `97`, `98`, `140`, `141`, `55`
- 실제 결과
  - 판정: `정상`
  - 메모
    - `AuthContext`의 pending/revision/rejected fallback refresh를 `30_000ms → 5_000ms`로 줄인 뒤 `140`, `141`, `98`, `55`가 최신 기준 모두 green
    - 현재 감사 기준에서는 revision/pending 화면이 승인 후 stale하게 오래 남는 핵심 host ingress 리스크는 더 이상 재현되지 않는다

### 2. 호스트 신청 / 재제출 / 승인 경계
- source of truth
  - [app/host/register/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/register/page.tsx:1)
  - [app/host/register/components/HostRegisterForm.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/register/components/HostRegisterForm.tsx:1)
  - [app/api/host/register/submit/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/register/submit/route.ts:1)
  - [app/api/host/register/admin-alert/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/register/admin-alert/route.ts:1)
  - [app/api/admin/host-applications/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/host-applications/route.ts:1)
  - [app/actions/admin.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/actions/admin.ts:81)
  - [app/admin/dashboard/hooks/useAdminApprovalsData.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/admin/dashboard/hooks/useAdminApprovalsData.ts:1)
- 기대 상태 전이
  - `/host/register`는 최신 `host_applications` row를 hydrate하고, 프로필 사진은 `images`, 신분증은 `verification-docs` 버킷에 올린 뒤 submit payload를 만든다
  - 신규 신청은 `pending` row를 만들고, `rejected/revision` 재제출은 같은 row를 `pending`으로 되돌린다
  - `approved` 상태 재제출은 `success + status='approved' + notifyAdmin=false`로 fail-closed 하며 승인 row를 덮어쓰지 않는다
  - `profiles.full_name/avatar_url/languages` seed update는 비어 있는 경우에만 채워진다
  - admin read는 `/api/admin/host-applications`의 summary/detail split로, write는 `updateAdminStatus('host_applications', ...)` server action으로 분리된다
  - admin approve는 `host_applications.status='approved'`, `users.role='host'`, localized notification/email, audit log를 한 체인으로 만든다
- 현재 보장 테스트
  - `36`
    - 신규 submit, `rejected -> pending` same-row 재제출, `approved` fail-closed, dob/account holder validation, profile seed
  - `97`
    - `/host/register` ingress, step visibility, localized helper copy
  - `07`
    - admin approvals UI의 host application `revision` write와 `admin_comment` 저장
  - `164`
    - admin approvals UI의 host application `approved` happy path, `users.role='host'`, approval notification, host welcome overlay, dismiss read 처리
  - `167`
    - revision 상태 dashboard에서 `/host/register` 재진입, 기존 신청서 hydrate, same-row `pending` 재제출, pending 상태 복귀
  - `98`, `140`, `141`
    - 승인 후 overlay, dashboard refresh, landing CTA refresh
- 실제 결과
  - 판정: `부분 보장`
  - 메모
    - `submit` route는 현재 기준 안전하다
      - validation, normalized dob, account holder guard, `approved` fail-closed, profile seed update는 static code와 `36` 기준으로 일관된다
      - client step validation보다 server validation이 더 엄격하지만, write source of truth가 route에 있어 fail-closed 방향으로 동작한다
    - 현재 tracked 제품 경로는 단일 submit source를 쓴다
      - `/host/register` client submit은 `fetch('/api/host/register/submit')`만 호출한다
      - repo tracked app/tests 기준 `'/api/host/register/admin-alert'` 호출자는 route 파일 자신 외에는 확인되지 않았다
      - 따라서 현재 저장소 기준 live product path 안에서는 submit 후 admin alert가 이중 호출되는 구조가 아니다
    - git history도 같은 결론을 지지한다
      - `dcd466a2` (`Serverize host register submit writes`)에서 `app/host/register/page.tsx`의 직접 `host_applications` write + `/api/host/register/admin-alert` 후속 호출이 제거되고, submit route 단일 호출로 교체됐다
      - 직후 `9f7e70e0` (`Clarify host register admin alert legacy route`)에서 이 endpoint를 stale client 호환용 compatibility route로 명시했다
      - 즉 현재 repo 기준에서는 “실수로 orphaned된 ambiguous path”보다 “의도적으로 legacy shim으로 남겨둔 path” 해석이 더 강하다
    - `/host/register` UI 자체는 `approved` 사용자를 사전 차단하지 않는다
      - 최신 application row를 그대로 hydrate하기 때문에 이미 승인된 호스트도 등록 폼을 다시 볼 수 있다
      - 실제 보호는 submit route에서만 걸리므로 데이터 overwrite는 막히지만, UI 의미는 다소 모호하다
    - `/api/admin/host-applications`는 read-only summary/detail surface다
      - detail 조회에서만 민감 컬럼과 signed URL을 열고, client가 넘긴 `select`는 서버에서 무시한다
      - 실제 승인/보완/거절 write는 admin dashboard의 `useAdminApprovalsData -> updateAdminStatus()` 체인에 있다
    - admin status write의 static contract는 일관된다
      - `approved`는 `users.role='host'`를 부여하고 `host_application_approved` 알림/이메일/audit log를 남긴다
      - `revision/rejected`는 `admin_comment`를 저장하고 localized notification/email을 남긴다
    - `164` 보강 후 admin approve happy path는 현재 기준 green이다
      - admin approvals UI 버튼으로 승인하면 `host_applications.status='approved'`, `users.role='host'`, unread approval notification, host dashboard overlay까지 한 체인으로 이어진다
    - `167` 보강 후 revision host resubmit UI도 현재 기준 green이다
      - revision 상태 대시보드에서 수정하기로 들어가면 기존 신청값이 hydrate되고, 같은 application row가 `pending`으로 되돌아간다
    - 다만 한 가지 audit gap이 남는다
      - legacy [app/api/host/register/admin-alert/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/register/admin-alert/route.ts:1)는 여전히 `pending` 신청서에 대해 unconditional admin alert insert를 시도한다
      - tracked caller는 확인되지 않았지만, stale client나 수동 호출이 submit 직후 이 route를 다시 치면 admin alert 중복 적재 가능성은 남아 있다
      - 다만 현재까지의 static + history evidence만 보면 이 위험은 current product path가 아니라 external stale client surface에 한정된다

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
  - `93`, `32`, `33`, `34`, `35`, `51`, `126`, `71`, `129`
- 실제 결과
  - 판정: `부분 보장`
  - 메모
    - server route 계약은 현재 기준 정상이다
      - `32` availability route green
      - `33` delete route green
      - `126`, `71`, `129` public reflection green
    - `35` host detail delete UI는 confirm modal 2단계와 locale-aware selector 보정 후 최신 기준 green
    - 다만 `34` host dashboard dates UI는 최신 full bundle에서 아직 1건 남는다
      - 단독 실행은 통과했지만 latest full bundle과 `--repeat-each=3`에서는 간헐 실패가 재현됐다
      - 이번 후속 분리 실행에서도 `34` 전체 파일 단독 재실행은 다시 `1 failed / 1 did not run / 1 passed`였고, 같은 failing case 즉시 재실행은 `1 passed`였다
      - 이후 `34` 스펙에 클릭 후 active-state / request payload probe를 추가한 뒤 full file 재실행은 `3 passed`였지만, 같은 failing case `--repeat-each=3`에서는 다시 `2 failed / 1 passed`가 나왔다
      - 따라서 현재 관측은 deterministic backend regression보다 interaction race 또는 test contract drift와 더 잘 맞는다
      - 현재 failure shape는 `POST /availability` 200 + success toast 이후에도 `07:00` row가 DB에서 조회되지 않는 형태다
      - 같은 날 `32-host-schedule-save` route subset은 `3 passed`로 유지되어 availability diff/upsert/delete 경계는 계속 정상이다
      - probe-hardened rerun에서는 실패가 더 앞단에서 갈렸다
        - 한 반복에서는 `POST /availability` request body 자체가 `["10:00", "11:00"]`만 포함하고 `07:00`을 싣지 못했다
        - 다른 반복에서는 `07:00` 버튼이 끝내 active class(`bg-black`)로 전환되지 못했다
      - failure snapshot에서는 저장 직전 선택 패널에 `10:00 / 11:00`만 남아 있어, backend write path보다 slot add interaction 또는 UI automation contract의 간헐 실패를 더 강하게 시사한다

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
  - `39`, `40`, `72`, `92`, `122`
- 실제 결과
  - 판정: `정상`
  - 메모
    - review reply, guest review write, host notification flow는 모두 green
    - `40`의 일본어 warning strip copy expectation도 최신 문구로 갱신 후 green
    - 같은 파일의 service unread mark-as-read, guest profile modal, inquiry chat reply 케이스도 계속 통과한다

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
1. host dates dashboard UI는 route 보장에 비해 schedule add interaction의 안정성이 약하다
   - source of truth
     - [app/host/experiences/[id]/dates/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/host/experiences/%5Bid%5D/dates/page.tsx:298)
   - 증상
     - `tests/e2e/34-host-edit-and-dates-ui.spec.ts`의 schedule add/save 케이스가 latest full bundle과 `--repeat-each=3`에서 간헐 실패했고, 이번 후속 분리 실행에서도 전체 파일 재실행은 다시 `1 failed / 1 did not run / 1 passed`였다
     - 같은 failing case를 바로 다시 단독 실행하면 `1 passed`로 돌아와 deterministic regression보다는 interaction instability 패턴을 보였다
     - probe-hardened rerun에서는 실패가 DB 확인 단계보다 더 앞에서 드러났다
       - 한 번은 save request body가 `07:00`을 포함하지 않았고
       - 다른 한 번은 `07:00` 버튼이 active-state로 바뀌지 못했다
     - failure shape는 `POST /availability` 200 + success toast 이후에도 `07:00` row가 DB에서 조회되지 않는 형태다
     - failure snapshot에서는 저장 직전 우측 패널에 `10:00 / 11:00`만 남아 있어 `07:00` 추가 click이 반영되지 않은 상태가 관측됐다
   - 분류: `flaky ui contract gap`
   - severity: `low`
   - 이유
     - 같은 날 `32-host-schedule-save.spec.ts`가 `3 passed`로 재확인돼 server write integrity는 계속 보장된다
     - probe-hardened failure가 request generation 이전 단계에서 이미 갈라져, 현재 evidence는 backend write regression보다 slot add UI interaction 또는 test click/selector contract의 간헐 실패를 더 강하게 가리킨다

## Coverage Gaps
- live mutation coverage는 이번 감사에서 재실행하지 않았다
  - `tests/e2e/03-live-host-signup-registration.spec.ts`
  - `tests/e2e/04-live-host-experience-create.spec.ts`
- 호스트 신청/승인 경계의 non-live gap
  - legacy `/api/host/register/admin-alert`는 tracked app/tests에서 호출 흔적이 없고 git history상도 intentional legacy route지만, external stale client 대비 dedupe contract는 없다
- 이전 `55`, `35`, `40`, `140`은 이번 패스에서 해소됐다
- `34`는 route integrity는 보장되지만, 실제 slot add UX가 간헐적으로 미반영되는지 아니면 UI automation contract drift인지 추가 probe 없이는 단정하기 어렵다

## Follow-up Need
- 즉시 후속 구현이 꼭 필요한 confirmed product risk는 현재 없다
- 남은 후속 2건
  - host 신청/승인 경계
    - 가장 안전한 다음 단계는 저장소 밖 운영 로그/라우트 access evidence로 `legacy admin-alert` 실제 호출 유무를 확인한 뒤, 미사용이면 제거하고 사용 중이면 dedupe guard를 넣는 것이다
    - 현재 코드와 git history 기준으로는 tracked client caller가 없으므로 우선순위는 “즉시 제품 버그 수정”보다 “external stale client cleanup”에 가깝다
  - `34-host-edit-and-dates-ui`
    - 이번 probe 보강으로 “server write bug인가?”는 많이 줄었고, 이제 남은 질문은 “실제 UI interaction gap인가, automation click drift인가” 쪽이다
    - 가장 안전한 다음 단계는 제품 코드 수정이 아니라, `07:00` 클릭 직후 selected list row를 더 정밀하게 좁히는 locator와 click retry/visibility stabilization probe를 추가해 원인을 더 분해하는 것이다

## Final Verdict
- 호스트 진입/모드 전환, 체험 create/edit/delete, 리뷰 응대, 수익/정산/서비스 매칭은 최신 기준 `정상`
- 호스트 신청/승인 경계는 tracked submit/admin/reflection 체인만 보면 안정적이며, git history상도 legacy alert route가 메인 경로에서 분리된 것이 확인된다
- 이전 감사의 핵심 product risk였던 `dashboard revision → approved refresh/overlay chain`은 이번 패스에서 해소됐다
- 현재 남은 것은 `legacy admin-alert external-client cleanup gap`과 `34 host dates UI 분류 미완료`다
- 둘 다 성격상 `confirmed product bug`보다는 contract/coverage 정밀화 과제에 가깝다
- 따라서 이번 감사의 최신 판정은 `호스트 도메인 전반은 대체로 정상이고, 남은 것은 external stale client cleanup과 host dates schedule interaction 분류 정밀화`다
