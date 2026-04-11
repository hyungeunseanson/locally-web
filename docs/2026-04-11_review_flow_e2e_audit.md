# 리뷰 플로우 엔드투엔드 구조 완전성 점검

## Summary
- 감사 범위: `체험 완료 → review_request → 게스트 리뷰 작성/수정 → 호스트 답글 → 호스트의 게스트 리뷰 → 게스트/공개/어드민 반영`
- 현재 문서는 초기 감사본이 아니라, 1차~3차 안정화 반영 후의 재판정 보고서다.
- 실행 방식: 코드 경로 감사 + 핵심 계약 E2E 재실행 기준으로 판정했다.
- 최신 재실행 결과: `22 passed / 0 failed / 0 skipped`
- 최종 판정
  - 공개 리뷰 체인(`review_request`, 게스트 리뷰 생성/수정, 공개 반영, 호스트 답글, admin delete aggregate)은 현재 기준 `정상`
  - `guest_reviews` 체인도 게스트/호스트/read-only admin visibility까지 `정상`
  - 남은 범위 차이는 1개뿐이다: `guest_reviews`는 의도적으로 `/api/admin/reviews`와 `Review Quality`에 섞이지 않고, `Users` 상세 패널 read-only surface로만 운영된다

## Test Execution
- 재실행 범위
  - `tests/e2e/57-guest-trips-sync-completed.spec.ts`
  - `tests/e2e/164-review-route-contract.spec.ts`
  - `tests/e2e/122-review-reply-notification-localization.spec.ts`
  - `tests/e2e/39-host-review-routes.spec.ts`
  - `tests/e2e/11-admin-users.spec.ts`
  - `tests/e2e/09-admin-analytics.spec.ts`
- 결과
  - `22 passed / 0 failed / 0 skipped`
- 의미
  - `review_request` 적재와 guest trips 반영
  - `POST /api/reviews` 생성 무결성, `PATCH /api/reviews/[id]` 수정 가드
  - `reviews → experiences/profiles` aggregate sync
  - 호스트 답글 저장 + guest `review_reply` localized notification/email
  - 호스트의 게스트 리뷰 write/read contract
  - admin users/analytics surface의 scope 분리가 현재 의도대로 유지되는지까지 다시 확인했다

## Resolved Findings
1. 게스트 리뷰 생성 무결성 문제는 해결되었다
   - source of truth: [app/api/reviews/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/reviews/route.ts:8)
   - 현재 동작
     - `bookingId` 소유권과 `completed` 상태를 검사한다
     - `booking.experience_id`를 authoritative value로 사용한다
     - request body의 `experienceId`가 booking truth와 다르면 `400`으로 거부한다
     - `rating 1..5`, `content.trim().length >= 10`을 앱 레이어에서 거부한다
   - 현재 보장 테스트
     - `tests/e2e/164-review-route-contract.spec.ts`
   - 판정: `해결됨`

2. 리뷰 집계 정합성 문제는 해결되었다
   - source of truth
     - aggregate helper: [app/utils/reviews/reviewAggregates.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/reviews/reviewAggregates.ts:1)
     - create: [app/api/reviews/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/reviews/route.ts:91)
     - patch: [app/api/reviews/[id]/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/reviews/%5Bid%5D/route.ts:68)
     - admin delete: [app/api/admin/reviews/[id]/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/reviews/%5Bid%5D/route.ts:83)
   - 현재 동작
     - `reviews`만 source of truth로 사용해 `experiences.rating/review_count`와 `profiles.average_rating/total_review_count`를 재계산한다
     - create, patch, delete가 같은 helper를 공유한다
   - 현재 보장 테스트
     - `tests/e2e/164-review-route-contract.spec.ts`
   - 판정: `해결됨`

3. 호스트 답글의 client split 문제는 해결되었다
   - source of truth
     - route: [app/api/host/reviews/reply/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/reviews/reply/route.ts:1)
     - shared helper: [app/utils/reviews/reviewReplyNotification.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/reviews/reviewReplyNotification.ts:1)
   - 현재 동작
     - route가 `reviews.reply`, `reply_at` 저장 후 guest `review_reply` notification과 localized email까지 서버에서 처리한다
     - 알림/이메일 실패는 warning log만 남기고 reply 저장은 유지한다
     - client는 별도 `sendNotification()` 연쇄 호출을 하지 않는다
   - 현재 보장 테스트
     - `tests/e2e/39-host-review-routes.spec.ts`
     - `tests/e2e/122-review-reply-notification-localization.spec.ts`
   - 판정: `해결됨`

4. `guest_reviews` 어드민 blind spot은 현재 범위에서 해결되었다
   - source of truth
     - admin timeline API: [app/api/admin/users/[userId]/timeline/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/users/%5BuserId%5D/timeline/route.ts:296)
     - admin Users detail UI: [app/admin/dashboard/components/UsersTab.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/admin/dashboard/components/UsersTab.tsx:721)
   - 현재 동작
     - `guest_reviews`는 Users timeline row로도 남고
     - 같은 fetch 응답의 `guestReviews` 배열을 통해 Users 상세 패널 read-only 섹션에서 본문까지 확인할 수 있다
     - `Review Quality`와 `/api/admin/reviews`는 계속 public `reviews` 전용으로 유지된다
   - 현재 보장 테스트
     - `tests/e2e/11-admin-users.spec.ts`
     - `tests/e2e/39-host-review-routes.spec.ts`
     - `tests/e2e/09-admin-analytics.spec.ts`
   - 판정: `해결됨`

## Chain-by-Chain Audit

### 1. 체험 완료 → `review_request`
- source of truth
  - [app/utils/settlementSync/experienceCompletion.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/settlementSync/experienceCompletion.ts:239)
- 기대 상태 전이 및 write set
  - 완료 sync 후 `notifications(type='review_request', link='/guest/trips')` 1건 생성
- 읽는 surface
  - [app/api/guest/trips/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/guest/trips/route.ts:29)
- 현재 보장 테스트
  - `tests/e2e/57-guest-trips-sync-completed.spec.ts`
  - `tests/e2e/157-settlement-sync-race-guard.spec.ts`
- 실제 결과
  - 판정: `정상`

### 2. 게스트 리뷰 생성/수정 → 호스트/공개/어드민 반영
- source of truth
  - create: [app/api/reviews/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/reviews/route.ts:8)
  - patch: [app/api/reviews/[id]/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/reviews/%5Bid%5D/route.ts:1)
  - aggregate sync: [app/utils/reviews/reviewAggregates.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/reviews/reviewAggregates.ts:1)
- 기대 상태 전이 및 write set
  - `reviews` insert/update
  - `experiences.rating/review_count` 재집계
  - `profiles.average_rating/total_review_count` 재집계
  - 호스트 `new_review` 알림/메일, admin alert 생성
- 읽는 surface
  - 게스트 trips
  - public host reviews
  - public experience reviews
  - admin public review list
- 현재 보장 테스트
  - 재실행: `tests/e2e/164-review-route-contract.spec.ts`
  - 기존 회귀 감시: `tests/e2e/72-review-host-notification.spec.ts`, `tests/e2e/71-public-host-profile.spec.ts`, `tests/e2e/148-experience-detail-review-rendering.spec.ts`, `tests/e2e/149-review-photo-deprecation.spec.ts`
- 실제 결과
  - 판정: `정상`

### 3. 호스트 답글 → 게스트 반영
- source of truth
  - route: [app/api/host/reviews/reply/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/reviews/reply/route.ts:1)
  - notification/email helper: [app/utils/reviews/reviewReplyNotification.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/reviews/reviewReplyNotification.ts:1)
- 기대 상태 전이 및 write set
  - `reviews.reply`, `reviews.reply_at` 저장
  - guest `review_reply` notification 저장
  - guest localized email 발송 시도
- 읽는 surface
  - 호스트 dashboard reviews
  - 게스트 notifications / trips
  - public review projection
- 현재 보장 테스트
  - 재실행: `tests/e2e/122-review-reply-notification-localization.spec.ts`, `tests/e2e/39-host-review-routes.spec.ts`
  - 기존 회귀 감시: `tests/e2e/71-public-host-profile.spec.ts`
- 실제 결과
  - 판정: `정상`
  - 운영 메모
    - 알림/이메일은 fail-safe side effect다
    - 저장 성공을 delivery failure가 rollback하지는 않는다

### 4. 호스트의 게스트 리뷰 → 게스트 반영 → 어드민 반영
- source of truth
  - write: [app/api/host/guest-reviews/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/guest-reviews/route.ts:1)
  - host read: [app/api/host/guests/[guestId]/reviews/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/guests/%5BguestId%5D/reviews/route.ts:1)
  - guest read: [app/account/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/account/page.tsx:230)
  - admin read: [app/api/admin/users/[userId]/timeline/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/users/%5BuserId%5D/timeline/route.ts:296), [app/admin/dashboard/components/UsersTab.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/admin/dashboard/components/UsersTab.tsx:721)
- 기대 상태 전이 및 write set
  - `guest_reviews` insert
  - host guest profile / guest account / admin users detail에서 동일 사실 read
- 현재 보장 테스트
  - 재실행: `tests/e2e/39-host-review-routes.spec.ts`, `tests/e2e/11-admin-users.spec.ts`
  - 기존 회귀 감시: `tests/e2e/40-host-reservations-inquiries-ui.spec.ts`
- 실제 결과
  - 판정: `정상`
  - scope note
    - admin 반영은 현재 `Users` 상세 패널 read-only visibility까지가 범위다

### 5. 어드민 반영/운영 구간
- source of truth
  - public reviews moderation list: [app/api/admin/reviews/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/reviews/route.ts:55)
  - public review delete: [app/api/admin/reviews/[id]/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/reviews/%5Bid%5D/route.ts:1)
  - guest review visibility: [app/api/admin/users/[userId]/timeline/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/users/%5BuserId%5D/timeline/route.ts:296)
- 기대 상태 전이 및 write set
  - `reviews`는 admin list/delete 대상
  - delete 후 aggregate 재계산
  - `guest_reviews`는 Users detail read-only 운영 확인 대상
- 현재 보장 테스트
  - 재실행: `tests/e2e/09-admin-analytics.spec.ts`, `tests/e2e/11-admin-users.spec.ts`, `tests/e2e/164-review-route-contract.spec.ts`
- 실제 결과
  - 판정: `정상`
  - scope note
    - `Review Quality`는 계속 public `reviews` 전용이다
    - `guest_reviews`를 여기 섞지 않는 것은 현재 의도된 분리 정책이다

## Remaining Scoped Gaps
- `guest_reviews`는 admin에서 read-only만 제공된다
  - 현재는 `Users` 상세 패널과 timeline visibility만 있고, 별도 delete/hide/moderation action은 없다
  - 이건 남은 버그라기보다 의도된 scope boundary다
- `guest_reviews`용 글로벌 운영 피드가 없다
  - 여러 유저를 가로질러 host-written guest evaluation만 모아 보는 admin 전용 feed는 아직 없다
  - 필요해지면 `/api/admin/reviews`에 섞지 말고 별도 surface로 추가하는 편이 안전하다

## Final Verdict
- `review_request`: 정상
- 게스트 리뷰 생성/수정: 정상
- 호스트 답글 체인: 정상
- 호스트의 게스트 리뷰: 정상
- 어드민 반영: 정상, 단 `guest_reviews`는 read-only 분리 운영

## Historical Note
- 초기 감사본에서 적었던 아래 4개는 더 이상 현재 결함이 아니다
  - `POST /api/reviews`의 `bookingId ↔ experienceId` mismatch 허용
  - 빈/짧은 content 및 invalid rating 허용
  - create 후 aggregate 미동기화
  - host reply의 client-side notification split
- 이후 follow-up 판단은 이 문서의 현재 판정을 기준으로 해야 한다
