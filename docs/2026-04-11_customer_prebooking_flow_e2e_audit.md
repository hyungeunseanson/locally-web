# 고객 프리북킹 플로우 엔드투엔드 구조 점검

## Decision Update
- `2026-04-11` 기준, 홈 데스크탑 검색 UX는 별도 결정으로 `현행 유지`로 잠갔다.
- 제품 해석은 다음처럼 고정한다.
  - 데스크탑 홈 검색: 홈 피드 내부 필터
  - `/search`: 전체 검색 결과 workspace
  - 모바일 홈 검색: `/search` 진입 launcher
- 따라서 이 문서의 “디바이스별 검색 의미 차이”는 당장 구조 변경 대상이 아니라, 의도된 제품 차이를 가진 상태로 회귀만 막는 항목으로 취급한다.
- guardrail 기준도 같이 고정한다.
  - 데스크탑 홈 검색 후에는 홈에 머물러야 한다.
  - 홈 필터 결과는 계속 `popular/latest` 섹션 구조로 렌더링되어야 한다.
  - 추천 장소 클릭과 검색 버튼도 `/search`가 아니라 홈 내부 필터를 유지해야 한다.

## Summary
- 감사 범위: `가입/로그인 진입 → 홈 탐색 → 검색 → 체험 상세 → 찜/공유/문의 → 위시리스트/인박스/계정 도착지`
- 제외 범위: `/experiences/[id]/payment` 진입 이후의 예약 생성, 결제, 결제 완료, 예약 후 운영 surface
- 실행 방식: 정적 코드 감사 + 핵심 E2E 재실행 + 주변 continuity/guardrail 재실행
- 재실행 결과
  - 초기 감사 묶음: `47 passed / 1 failed`
  - 후속 continuity/guardrail 묶음: `19 passed / 0 failed`
  - share hardening/guardrail 묶음: `11 passed / 0 failed`
- 최종 판정
  - 인증 진입, 검색 계약, 공개 체험 상세 SSR/SEO/리뷰/호스트 공개 projection은 현재 기준 `정상`
  - 홈 공개 탐색은 데스크탑/모바일 의미 차이를 의도된 제품 차이로 잠근 상태에서, analytics 적재와 guardrail까지 현재 기준 `정상`
  - 체험 상세의 문의 continuity, private guest surface auth return, wishlist auth/localization은 후속 보정으로 닫혔다
  - 체험 상세 share와 wishlist share도 `Web Share → clipboard fallback → localized fail-closed` 기준으로 보정 및 검증됐다
  - 이 문서 범위의 프리북킹 surface에서는 현재 high-priority open gap이 남아 있지 않다
  - private surface noindex, guest inbox 기본 도착지, account/wishlist 직접 진입 복귀는 `정상`

## Test Execution
- 주 감사 재실행
  - `tests/e2e/108-login-flow-guidance.spec.ts`
  - `tests/e2e/128-auth-success-transition.spec.ts`
  - `tests/e2e/107-home-landing-ingress.spec.ts`
  - `tests/e2e/142-home-mobile-city-shortcuts.spec.ts`
  - `tests/e2e/144-home-experience-sections.spec.ts`
  - `tests/e2e/145-home-load-error-state.spec.ts`
  - `tests/e2e/146-home-popularity-snapshot-fail-open.spec.ts`
  - `tests/e2e/137-home-search-location-localization.spec.ts`
  - `tests/e2e/147-home-search-card-meta-parity.spec.ts`
  - `tests/e2e/43-guest-search-detail-ingress.spec.ts`
  - `tests/e2e/58-search-server-filters.spec.ts`
  - `tests/e2e/111-search-map-panel.spec.ts`
  - `tests/e2e/114-search-mobile-city-filter.spec.ts`
  - `tests/e2e/143-search-mobile-header-city-picker.spec.ts`
  - `tests/e2e/24-experience-card-verification.spec.ts`
  - `tests/e2e/27-dynamic-detail-seo.spec.ts`
  - `tests/e2e/71-public-host-profile.spec.ts`
  - `tests/e2e/148-experience-detail-review-rendering.spec.ts`
- 주변 surface 보강 재실행
  - `tests/e2e/60-inquiry-thread-contract.spec.ts`
  - `tests/e2e/95-guest-inbox-empty-state.spec.ts`
  - `tests/e2e/26-private-noindex.spec.ts`
- 후속 continuity/guardrail 재실행
  - `tests/e2e/24-experience-card-verification.spec.ts`
  - `tests/e2e/60-inquiry-thread-contract.spec.ts`
  - `tests/e2e/67-analytics-ingest-routes.spec.ts`
  - `tests/e2e/108-login-flow-guidance.spec.ts`
  - `tests/e2e/137-home-search-location-localization.spec.ts`
  - `tests/e2e/147-home-search-card-meta-parity.spec.ts`
  - `tests/e2e/165-guest-wishlist-account-continuity.spec.ts`
- 후속 결과
  - 위 7개 스펙, 총 `19 passed / 0 failed`
  - `tests/e2e/24-experience-card-verification.spec.ts`는 이제 [tests/e2e/helpers/experienceBooking.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/helpers/experienceBooking.ts:480)의 shared helper를 사용하므로, 초기 감사 당시의 fixture drift는 현재 active blocker가 아니다
- share hardening/guardrail 재실행
  - `tests/e2e/43-guest-search-detail-ingress.spec.ts`
  - `tests/e2e/165-guest-wishlist-account-continuity.spec.ts`
  - `tests/e2e/166-prebooking-share-guardrails.spec.ts`
- share 결과
  - 위 3개 스펙, 총 `11 passed / 0 failed`
  - `POST /api/inquiries/thread` redirect, wishlist/account continuity, detail/wishlist share fallback이 함께 유지되는지 같은 pass에서 교차 확인했다

## Summary Matrix
| 구간 | 로그아웃/로그인 | 모바일/데스크탑 | 판정 | 핵심 메모 |
| --- | --- | --- | --- | --- |
| 인증 진입 | 둘 다 확인 | 공통 | 정상 | `/login` + modal signup, `returnUrl`/`next` 정규화 정상 |
| 홈 탐색 | 공개 진입 중심 | 둘 다 확인 | 정상 | 데스크탑 인페이지 필터 / 모바일 `/search` launcher 차이를 의도된 제품 차이로 잠그고, analytics도 둘 다 적재 |
| 검색 결과 | 공개 진입 중심 | 둘 다 확인 | 정상 | server route 계약, city/type/time/date 필터 보장 |
| 체험 상세 | 로그아웃/로그인 혼재 | 둘 다 확인 | 정상 | 문의 redirect, 찜 auth/localization, share fallback/fail-closed 모두 확인 |
| 위시리스트/인박스/계정 도착지 | 로그인 필요 | 주로 모바일 + private path | 정상 | inbox/noindex, auth return, account 진입, wishlist load/remove/share guardrail 확인 |

## Chain-by-Chain Audit

### 1. 인증 진입과 세션 연속성
- source of truth
  - [app/login/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/login/page.tsx:1)
  - [app/components/LoginModal.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/LoginModal.tsx:1)
  - [app/auth/callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/auth/callback/route.ts:1)
- 실제 구조
  - 독립 `/signup` page는 현재 보이지 않았고, signup은 `LoginModal`의 `SIGNUP` 모드가 대표 경로다
  - `/login`은 `returnUrl` 또는 `next`를 상대경로만 허용하도록 정규화한다
  - OAuth도 `/auth/callback?next=...`를 통해 같은 상대경로 정책을 유지한다
  - 이미 로그인된 사용자는 `/login` 진입 시 즉시 내부 `returnUrl`로 되돌아간다
- 현재 보장 테스트
  - `tests/e2e/108-login-flow-guidance.spec.ts`
  - `tests/e2e/128-auth-success-transition.spec.ts`
- 실제 결과
  - 판정: `정상`
  - 메모: 회원가입 성공 후 검증 메일 모드로 되돌아가는 흐름도 현재 계약과 일치한다

### 2. 홈 진입과 공개 탐색 구조
- source of truth
  - [app/components/HomePageClient.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/HomePageClient.tsx:1)
  - [app/components/HomeHero.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/HomeHero.tsx:1)
  - [app/hooks/useExperienceFilter.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/hooks/useExperienceFilter.ts:1)
  - [app/utils/api/experiences.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/api/experiences.ts:1)
  - [app/utils/homeExperienceSections.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/homeExperienceSections.ts:1)
- 실제 구조
  - 홈의 공개 체험 목록은 client에서 `public_host_applications → visible host ids → active experiences → availability/popularity snapshot`을 직접 읽어 조합한다
  - 홈 섹션 정렬은 `wishlist_count > review_count > created_at`의 popular, `created_at`의 latest로 분리된다
  - ingress hint, mobile city shortcuts, localized about/host 링크, load error, popularity snapshot fail-open은 현재 테스트로 닫혀 있다
  - 홈 검색 의미는 디바이스별로 다르지만, `2026-04-11` 결정으로 의도된 제품 차이로 잠겼다
  - 데스크탑 hero search는 `useExperienceFilter.applyFilters()`로 홈 카드 목록을 인페이지 필터링한다
  - 모바일 search modal은 직접 `/search?...`로 이동하고, submit 시 `sendSearchLog()`도 함께 호출한다
- 현재 보장 테스트
  - `tests/e2e/107-home-landing-ingress.spec.ts`
  - `tests/e2e/142-home-mobile-city-shortcuts.spec.ts`
  - `tests/e2e/144-home-experience-sections.spec.ts`
  - `tests/e2e/145-home-load-error-state.spec.ts`
  - `tests/e2e/146-home-popularity-snapshot-fail-open.spec.ts`
  - `tests/e2e/137-home-search-location-localization.spec.ts`
  - `tests/e2e/147-home-search-card-meta-parity.spec.ts`
- 실제 결과
  - 판정: `정상`
  - 메모
    - 데스크탑 홈 필터와 모바일 `/search` launcher는 서로 다른 surface이지만, 현재는 의도된 제품 차이로 결정 잠금과 guardrail 테스트가 함께 있다
    - mobile search analytics 적재도 `tests/e2e/137-home-search-location-localization.spec.ts`로 후속 확인됐다

### 3. 검색 결과 플로우
- source of truth
  - [app/search/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/search/page.tsx:1)
  - [app/search/searchContract.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/search/searchContract.ts:1)
  - [app/api/search/experiences/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/search/experiences/route.ts:1)
- 실제 구조
  - authoritative search result는 `/api/search/experiences`다
  - visible host 기준은 `public_host_applications`의 최신 공개 상태이며, 홈과 같은 `hostVisibility` helper를 쓴다
  - 체험 공개 기준은 `status='active'`
  - query contract는 `location`, `language`, `startDate`, `endDate`, `city`, `times`, `types`
  - 데스크탑은 selected card + map panel + CTA 이동
  - 모바일은 header title/subtitle, city sheet, result card, show results 흐름으로 분리된다
- 현재 보장 테스트
  - `tests/e2e/43-guest-search-detail-ingress.spec.ts`
  - `tests/e2e/58-search-server-filters.spec.ts`
  - `tests/e2e/111-search-map-panel.spec.ts`
  - `tests/e2e/114-search-mobile-city-filter.spec.ts`
  - `tests/e2e/143-search-mobile-header-city-picker.spec.ts`
- 실제 결과
  - 판정: `정상`
  - 메모
    - 홈과 검색이 서로 다른 route를 쓰더라도 공개 host visibility와 active experience 기준 자체는 현재 일치한다

### 4. 체험 상세 프리북킹 플로우
- source of truth
  - [app/experiences/[id]/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/experiences/%5Bid%5D/page.tsx:1)
  - [app/experiences/[id]/ExperienceClient.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/experiences/%5Bid%5D/ExperienceClient.tsx:1)
  - [app/api/experiences/[id]/availability-summary/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/experiences/%5Bid%5D/availability-summary/route.ts:1)
  - [app/experiences/[id]/components/ExpMainContent.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/experiences/%5Bid%5D/components/ExpMainContent.tsx:1)
  - [app/experiences/[id]/components/HostProfileSection.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/experiences/%5Bid%5D/components/HostProfileSection.tsx:1)
- 실제 구조
  - 상세 SSR은 experience row, 공개 host profile, availability summary, SEO metadata를 함께 만든다
  - 공개 호스트/후기 projection은 public host path를 통해 렌더되고, 관련 공개 테스트는 현재 통과했다
  - detail client는 `view/click` analytics, gallery, host modal, review section, wishlist, inquiry modal, availability refresh를 처리한다
  - date/time/guest selection은 reservation card에서 수행되지만, 실제 결제 route push는 `handleReserve()` 경계 뒤로 끊어진다
  - `handleInquiry()`는 `useChat().createInquiry()`의 `redirectUrl`을 실제로 소비해 success 후 바로 guest inbox thread로 이동한다
  - `handleShare()`는 `navigator.share` 우선, 없으면 clipboard fallback, 둘 다 실패하면 localized error toast로 fail-closed 한다
  - wishlist auth gate는 [app/hooks/useWishlist.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/hooks/useWishlist.ts:1)에서 localized `login_required` toast를 쓴다
- 현재 보장 테스트
  - `tests/e2e/27-dynamic-detail-seo.spec.ts`
  - `tests/e2e/71-public-host-profile.spec.ts`
  - `tests/e2e/148-experience-detail-review-rendering.spec.ts`
  - `tests/e2e/43-guest-search-detail-ingress.spec.ts`
  - `tests/e2e/60-inquiry-thread-contract.spec.ts`
  - `tests/e2e/147-home-search-card-meta-parity.spec.ts`
- 실제 결과
  - 판정: `정상`
  - 메모
    - 문의 success 후 inbox continuity, 찜하기 auth/localization, share fallback/fail-closed가 모두 후속 보정으로 닫혔다
    - `tests/e2e/166-prebooking-share-guardrails.spec.ts`로 detail share의 clipboard fallback, AbortError 무시, localized fail toast까지 잠겼다

### 5. 주변 연속성 surface
- source of truth
  - inquiry thread contract: [app/api/inquiries/thread/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/inquiries/thread/route.ts:1), [app/api/inquiries/thread/shared.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/inquiries/thread/shared.ts:1)
  - inbox: [app/guest/inbox/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/guest/inbox/page.tsx:1), [app/hooks/useChat.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/hooks/useChat.ts:1)
  - wishlists: [app/guest/wishlists/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/guest/wishlists/page.tsx:1)
  - account: [app/account/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/account/page.tsx:1)
  - nav entry: [app/components/SiteHeader.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/SiteHeader.tsx:278), [app/components/mobile/BottomTabNavigation.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/mobile/BottomTabNavigation.tsx:1)
- 실제 구조
  - inquiry thread API는 first-message fast path와 `redirectUrl`을 같이 반환한다
  - help page, service request page, experience detail 모두 이 `redirectUrl`을 실제 navigation에 사용한다
  - guest inbox는 query param bootstrap과 empty state CTA가 있고, 관련 계약 테스트는 통과했다
  - private path는 noindex가 보장된다
  - `/guest/wishlists`와 `/account`는 비로그인 직접 진입 시 각각 canonical `returnUrl`을 붙인 `/login?returnUrl=...`로 보낸다
  - 위시리스트 페이지는 load/remove/share 구현이 있고, account 모바일 메뉴에서 inbox/wishlist로 이어지는 smoke와 wishlist load/remove/share guardrail이 추가됐다
- 현재 보장 테스트
  - `tests/e2e/60-inquiry-thread-contract.spec.ts`
  - `tests/e2e/95-guest-inbox-empty-state.spec.ts`
  - `tests/e2e/26-private-noindex.spec.ts`
  - `tests/e2e/108-login-flow-guidance.spec.ts`
  - `tests/e2e/165-guest-wishlist-account-continuity.spec.ts`
- 실제 결과
  - 판정: `정상`
  - 메모
    - inbox, private surface SEO, auth returnUrl continuity는 닫혀 있다
    - wishlist/account는 load/remove, 모바일 진입, Web Share success, clipboard fallback, AbortError 무시까지 전용 검증이 있다

## Confirmed Risks
현재 이 문서 범위의 프리북킹 surface에서 별도 제품 리스크로 남겨둘 high-priority open item은 없다.

## Coverage Gaps
현재 문서 범위에서는 추가 coverage gap을 남기지 않는다.
다음 gap은 명시적으로 범위 밖인 `/experiences/[id]/payment` 이후 체인에서 다시 열린다.

## Boundary Handoff
- 다음 단계 감사 범위
  - 예약 생성 시점
  - `/experiences/[id]/payment` 진입 이후 상태 전달
  - 카드/PayPal/무통장 결제 전이
  - 결제 완료 후 `guest/trips`, notifications, account 반영
- 이번 문서는 위 항목을 판정하지 않는다
