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
- 실행 방식: 정적 코드 감사 + 핵심 E2E 재실행 + 주변 private/inbox surface 보강 재실행
- 재실행 결과
  - 주 감사 묶음: `35 passed / 1 failed`
  - 주변 surface 묶음: `12 passed / 0 failed`
  - 총계: `47 passed / 1 failed`
- 최종 판정
  - 인증 진입, 검색 계약, 공개 체험 상세 SSR/SEO/리뷰/호스트 공개 projection은 현재 기준 `정상`
  - 홈 공개 탐색과 상세 주변 액션은 기능상 동작하지만, `디바이스별 검색 의미 차이`, `문의 후 인박스 연속성`, `위시리스트 auth/localization/test coverage`에 `리스크`가 남아 있다
  - private surface noindex와 guest inbox 기본 도착지는 `정상`

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
- 유일한 실패
  - `tests/e2e/24-experience-card-verification.spec.ts`의 두 번째 케이스가 `HOST_USER_ID` 고정 픽스처에 최신 체험이 없어서 실패했다
  - 실패 지점은 `tests/e2e/24-experience-card-verification.spec.ts` 내부의 로컬 `prepareBookableExperience()`이며, 같은 저장소의 [tests/e2e/helpers/experienceBooking.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/helpers/experienceBooking.ts:480)에는 public host fallback까지 가진 더 안전한 helper가 이미 있다
  - 따라서 이 실패는 현재 고객 프리북킹 회귀 증거라기보다 `테스트 픽스처 drift`로 분류하는 편이 맞다

## Summary Matrix
| 구간 | 로그아웃/로그인 | 모바일/데스크탑 | 판정 | 핵심 메모 |
| --- | --- | --- | --- | --- |
| 인증 진입 | 둘 다 확인 | 공통 | 정상 | `/login` + modal signup, `returnUrl`/`next` 정규화 정상 |
| 홈 탐색 | 공개 진입 중심 | 둘 다 확인 | 리스크 | 데스크탑은 인페이지 필터, 모바일은 `/search` 이동 |
| 검색 결과 | 공개 진입 중심 | 둘 다 확인 | 정상 | server route 계약, city/type/time/date 필터 보장 |
| 체험 상세 | 로그아웃/로그인 혼재 | 둘 다 확인 | 리스크 | 공개 gating 정상, 문의/찜/공유 주변 continuity 차이 존재 |
| 위시리스트/인박스/계정 도착지 | 로그인 필요 | 주로 모바일 + private path | 부분 보장 | inbox/noindex는 테스트 있음, wishlist/account 전용 E2E는 비어 있음 |

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
  - 단, 홈 검색 의미는 디바이스별로 다르다
  - 데스크탑 hero search는 `useExperienceFilter.applyFilters()`로 홈 카드 목록을 인페이지 필터링한다
  - 모바일 search modal은 직접 `/search?...`로 이동한다
  - 검색 analytics도 데스크탑 홈의 `applyFilters()`에서만 `sendSearchLog()`를 호출하고, 모바일 modal 경로는 호출하지 않는다
- 현재 보장 테스트
  - `tests/e2e/107-home-landing-ingress.spec.ts`
  - `tests/e2e/142-home-mobile-city-shortcuts.spec.ts`
  - `tests/e2e/144-home-experience-sections.spec.ts`
  - `tests/e2e/145-home-load-error-state.spec.ts`
  - `tests/e2e/146-home-popularity-snapshot-fail-open.spec.ts`
  - `tests/e2e/137-home-search-location-localization.spec.ts`
  - `tests/e2e/147-home-search-card-meta-parity.spec.ts`
- 실제 결과
  - 판정: `리스크`
  - 리스크 포인트
    - 같은 “홈 검색” entry가 데스크탑에서는 인페이지 필터, 모바일에서는 검색 페이지 이동으로 갈린다
    - 검색 로그 적재도 데스크탑 홈 경로와 모바일 경로가 일치하지 않는다
  - 해석
    - 기능 고장은 아니지만, 고객 경험 의미와 analytics truth가 디바이스별로 분기된 상태다

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
  - `handleInquiry()`는 `useChat().createInquiry()`로 스레드를 만들고 success toast 후 modal만 닫는다
  - 같은 API는 `redirectUrl=/guest/inbox?...`를 반환하지만, 상세 페이지는 그 값을 소비하지 않는다
  - `handleShare()`는 `navigator.clipboard.writeText()`만 호출하고 예외 처리나 Web Share fallback이 없다
  - wishlist auth gate는 [app/hooks/useWishlist.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/hooks/useWishlist.ts:1)에서 처리되는데, 비로그인 시 하드코딩된 한국어 toast만 띄우고 끝난다
- 현재 보장 테스트
  - `tests/e2e/27-dynamic-detail-seo.spec.ts`
  - `tests/e2e/71-public-host-profile.spec.ts`
  - `tests/e2e/148-experience-detail-review-rendering.spec.ts`
  - `tests/e2e/43-guest-search-detail-ingress.spec.ts`
- 실제 결과
  - 판정: `리스크`
  - 리스크 포인트
    - 문의 성공 후 사용자는 인박스로 이동하지 않고 상세에 머문다
    - 공유 버튼은 실패 경로가 없다
    - 찜하기의 비로그인 안내는 localized auth UX와 일치하지 않는다

### 5. 주변 연속성 surface
- source of truth
  - inquiry thread contract: [app/api/inquiries/thread/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/inquiries/thread/route.ts:1), [app/api/inquiries/thread/shared.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/inquiries/thread/shared.ts:1)
  - inbox: [app/guest/inbox/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/guest/inbox/page.tsx:1), [app/hooks/useChat.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/hooks/useChat.ts:1)
  - wishlists: [app/guest/wishlists/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/guest/wishlists/page.tsx:1)
  - account: [app/account/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/account/page.tsx:1)
  - nav entry: [app/components/SiteHeader.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/SiteHeader.tsx:278), [app/components/mobile/BottomTabNavigation.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/mobile/BottomTabNavigation.tsx:1)
- 실제 구조
  - inquiry thread API는 first-message fast path와 `redirectUrl`을 같이 반환한다
  - help page와 service request page는 이 `redirectUrl`을 실제 navigation에 사용하지만, experience detail은 사용하지 않는다
  - guest inbox는 query param bootstrap과 empty state CTA가 있고, 관련 계약 테스트는 통과했다
  - private path는 noindex가 보장된다
  - 반면 `/guest/wishlists`와 `/account`는 비로그인 직접 진입 시 `router.push('/')`로 보내며, `/login?returnUrl=...`를 쓰지 않는다
  - 위시리스트 페이지는 load/remove/share 구현이 있지만, 해당 page 전용 E2E는 현재 보이지 않았다
- 현재 보장 테스트
  - `tests/e2e/60-inquiry-thread-contract.spec.ts`
  - `tests/e2e/95-guest-inbox-empty-state.spec.ts`
  - `tests/e2e/26-private-noindex.spec.ts`
- 실제 결과
  - 판정: `부분 보장`
  - 메모
    - inbox와 private surface SEO는 닫혀 있다
    - wishlist/account 연속성은 코드상 존재하지만 테스트 공백이 크다

## Confirmed Risks
1. 홈 검색 semantics와 analytics가 디바이스별로 갈린다
   - 데스크탑 홈은 로컬 필터 + `sendSearchLog`
   - 모바일 홈은 `/search` 이동 + 별도 search log 호출 없음
   - 같은 “검색” 행동이 다른 truth를 남긴다

2. 체험 상세 문의 성공 후 인박스 continuity가 직접 연결되지 않는다
   - API는 `redirectUrl`을 주지만 상세 페이지는 사용하지 않는다
   - 사용자는 “문의가 성공했는지”는 알 수 있어도 “어디서 이어서 보나”는 즉시 연결되지 않는다

3. 찜하기 auth UX가 다른 보호 액션과 일치하지 않는다
   - `useWishlist`의 비로그인 에러 문구는 하드코딩 한국어다
   - localized `login_required`를 쓰는 inquiry/reserve와 일관되지 않다
   - direct private page 진입 시에도 returnUrl 복귀보다 `/`로 보내는 경향이 있다

4. 위시리스트 surface는 테스트 커버리지가 비어 있다
   - add/remove/share/page load/auth continuity에 대한 전용 E2E를 찾지 못했다
   - 현재는 static code read와 nav entry 확인 수준이다

5. 검색 analytics route 잡음이 관측되었다
   - 재실행 중 `/api/analytics/search`에서 `Unexpected end of JSON input` log가 1회 출력됐다
   - 테스트 실패로 이어지지는 않았지만, malformed/empty body 처리 noise는 별도 probe가 필요하다

## Coverage Gaps
- wishlist page
  - 비로그인 접근
  - 저장 후 page 노출
  - page 내 삭제/공유
- experience detail share failure path
  - clipboard 권한 거부
  - non-secure context fallback
- experience detail inquiry success 후 사용자가 실제로 inbox thread를 찾는 UX
- account page의 프리북킹 도착지 역할
  - wishlist/inbox entry는 있으나 전용 계약 테스트는 없다

## Boundary Handoff
- 다음 단계 감사 범위
  - 예약 생성 시점
  - `/experiences/[id]/payment` 진입 이후 상태 전달
  - 카드/PayPal/무통장 결제 전이
  - 결제 완료 후 `guest/trips`, notifications, account 반영
- 이번 문서는 위 항목을 판정하지 않는다
