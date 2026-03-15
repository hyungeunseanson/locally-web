# Locally-Web CHANGELOG

> 과거 완료된 버그 수정, UI/UX 조정, 패치 내역을 보관하는 이력 문서.
> 새로운 기능/아키텍처 결정은 `gemini.md`에 기록한다.

---

## v3.38.96 — [Host Flow] 수정/일정 관리 UI 보호막 추가

| 항목 | 내용 |
| --- | --- |
| 🟡 호스트 수정 UI 보호막 추가 | `tests/e2e/34-host-edit-and-dates-ui.spec.ts` 추가 — 승인 호스트가 `/host/dashboard?tab=experiences`에서 실제 `수정` 링크를 열고 제목을 바꾼 뒤, `PATCH /api/host/experiences/:id`와 DB 반영까지 이어지는지 검증 |
| 🟡 호스트 일정 관리 UI 보호막 추가 | 같은 스모크가 대시보드 `일정 관리` 링크를 열고 날짜 선택 → 시간 추가 → 저장 확인 모달 → `POST /api/host/experiences/:id/availability` → DB `experience_availability` 반영까지 직접 확인 |

## v3.38.97 — [Host Flow] 상세 페이지 삭제도 서버 DELETE route로 정렬

| 항목 | 내용 |
| --- | --- |
| 🟠 호스트 상세 삭제 direct write 제거 | `app/host/experiences/[id]/page.tsx`가 더 이상 브라우저 `supabase.from('experiences').delete()`를 직접 호출하지 않고, 기존 `DELETE /api/host/experiences/:id` 서버 route를 사용하도록 정리 |
| 🟡 상세 삭제 UI 보호막 추가 | `tests/e2e/35-host-experience-detail-delete-ui.spec.ts` 추가 — 호스트 상세 페이지에서 삭제 버튼, confirm/alert, route 호출, 대시보드 복귀, DB row 제거까지 실제 UI 흐름으로 검증 |

## v3.38.95 — [Guest Flow] 예약 후 계좌 정보 / 취소 UX 정리 1차

| 항목 | 내용 |
| --- | --- |
| 🟠 공개 계좌 정보 source 통일 | `app/utils/publicBankInfo.ts` 추가 — 체험 결제 페이지와 결제 완료 페이지가 같은 `NEXT_PUBLIC_BANK_ACCOUNT`, `NEXT_PUBLIC_BANK_NAME`, `NEXT_PUBLIC_BANK_ACCOUNT_HOLDER` 기준을 사용하고, fallback/accountDigits 계산도 한 곳에서 처리 |
| 🟠 취소 성공 카피 정리 | `app/guest/trips/hooks/useGuestTrips.ts` 의 취소 성공 토스트를 `취소 요청 접수`가 아니라 실제 처리 의미에 맞는 `예약 취소가 완료되었습니다.` 로 조정 |
| 🟡 live post-booking 보강 | `tests/e2e/23-live-guest-post-booking.spec.ts` 가 무통장 예약 시 결제 페이지에서 본 계좌번호/은행명이 결제 완료 페이지에서도 그대로 보이는지 직접 검증하도록 확장 |
| 🟡 live cancel 보호막 추가 | `tests/e2e/31-live-guest-trip-cancel.spec.ts` 추가 — fresh guest의 pending 무통장 예약을 Trips에서 취소하고, 성공 토스트와 DB `bookings.status='cancelled'` 반영까지 확인 |

## v3.38.94 — [Guest Trips] 취소 규정 문구를 실제 환불 규칙과 정렬

| 항목 | 내용 |
| --- | --- |
| 🟠 취소 정책 카피 정렬 | `app/guest/trips/components/CancellationModal.tsx` 의 환불 규정 요약 문구를 실제 프론트/서버 환불 계산 규칙(`24시간 철회`, `20일 전 100%`, `8~19일 전 80%`, `2~7일 전 70%`, `1일 전 40%`, `당일/경과 불가`)과 일치하도록 수정 |
| 🟡 live 보호막 보강 | `tests/e2e/23-live-guest-post-booking.spec.ts` 가 fresh guest의 Trips 카드에서 취소 모달을 직접 열고, 최신 환불 규정 문구가 화면에 그대로 노출되는지 확인하도록 확장 |

## v3.38.93 — [SEO] locale canonical / sitemap 일관성 정렬

| 항목 | 내용 |
| --- | --- |
| 🟠 locale canonical 정렬 | locale prefix rewrite 구조에 맞춰 공개 페이지와 동적 상세의 canonical을 기본 no-prefix 경로(ko primary route)로 정렬하고, locale prefix URL은 `alternates.languages`로만 유지하도록 기준을 명시화 |
| 🟠 locale cookie 동기화 | `app/middleware.ts`가 `/en`, `/ja`, `/zh` 같은 locale prefix URL로 들어올 때 `app_lang` cookie도 같은 값으로 동기화해, 내부 RSC/메타 요청이 이전 cookie locale로 흔들리지 않게 정렬 |
| 🟠 sitemap 공개 기준 정렬 | `app/sitemap.ts`의 동적 체험 URL 포함 기준을 `status='active'` 뿐 아니라 실제 indexable 규칙과 같은 `is_active !== false`까지 맞춰 `sitemap`과 `page-level noindex`가 어긋나지 않게 조정 |
| 🟡 locale 보호막 보강 | `tests/e2e/25-public-metadata.spec.ts`, `tests/e2e/28-json-ld.spec.ts`가 locale-prefixed URL에서도 canonical이 primary no-prefix route로 유지되고, 커뮤니티 JSON-LD URL도 그 기준을 따르는지 직접 검증하도록 확장 |

## v3.38.92 — [SEO] 동적 상세 title/canonical 일관성 정리

| 항목 | 내용 |
| --- | --- |
| 🟠 체험 상세 title 중복 제거 | `app/experiences/[id]/page.tsx`의 page-level title에서 수동 `- Locally` suffix를 제거해 root layout template와의 중복 브랜드 표기를 없앴고, OG URL도 함께 추가 |
| 🟠 커뮤니티 상세 canonical 보강 | `app/community/[id]/page.tsx`에 locale 기준 canonical / `alternates.languages` / Twitter 메타를 추가하고, page title에서 중복 `| Locally` suffix를 제거 |
| 🟡 보호막 보강 | `tests/e2e/28-json-ld.spec.ts`가 활성 체험/커뮤니티 상세의 실제 `<title>`과 canonical이 기대값과 일치하는지까지 직접 검증하도록 확장 |

## v3.38.91 — [SEO] 크롤링 정책 정렬

| 항목 | 내용 |
| --- | --- |
| 🟠 private UI noindex 범위 확장 | `app/host/layout.tsx` 추가, `app/admin/layout.tsx`와 `app/login/layout.tsx`에 `PRIVATE_NOINDEX_METADATA`를 연결해 host/admin/login UI도 page-level `noindex, nofollow` 기준으로 정렬 |
| 🟠 robots 정책 단순화 | `app/robots.ts`는 private UI 경로 차단을 제거하고 `/api/`만 `Disallow`하도록 변경 — private 페이지는 robots.txt 차단 대신 page-level noindex를 single source로 사용 |
| 🟡 private noindex 보호막 확대 | `tests/e2e/26-private-noindex.spec.ts`가 `/login`, `/host/register`까지 `robots noindex,nofollow`를 직접 검증하도록 확장 |
| 🟡 robots 보호막 추가 | `tests/e2e/30-robots-policy.spec.ts` 추가 — `/robots.txt`가 `/api/`만 차단하고 `/admin/`, `/host/dashboard/`, `/guest/inbox/`를 더 이상 disallow하지 않는지 확인 |

## v3.38.90 — [SEO] JSON-LD 구조화 데이터 1차 마감

| 항목 | 내용 |
| --- | --- |
| 🟠 홈 `sameAs` 보강 | `app/utils/structuredData.ts`의 `Organization` JSON-LD에 실제 사이트 푸터/계정 화면과 동일한 Instagram 4개 계정과 Naver Blog를 `sameAs`로 추가 |
| 🟠 체험 상세 여행형 힌트 확장 | 공개 체험 상세 `Product` JSON-LD에 `additionalType: TouristTrip`, `location`, `audience`를 추가해 로컬 체험/여행 상품 맥락을 더 분명히 전달 |
| 🟠 커뮤니티 상세 BreadcrumbList 추가 | `app/community/[id]/page.tsx`에 `Home → Community → 게시글` 구조의 `BreadcrumbList` JSON-LD를 추가해 글 상세 문맥을 검색엔진에 명시 |
| 🟡 보호막 보강 | `tests/e2e/28-json-ld.spec.ts`가 홈 `sameAs`, 체험 상세 `TouristTrip` 힌트, 커뮤니티 상세 `BreadcrumbList`까지 직접 검증하도록 확장 |

## v3.38.89 — [SEO] Sitemap lastModified 현실화

| 항목 | 내용 |
| --- | --- |
| 🟠 정적 sitemap `lastModified` 교정 | `app/sitemap.ts`가 정적 공개 URL의 `lastModified`를 매 요청 시각이 아니라 각 라우트 파일의 실제 수정 시각(`fs.stat().mtime`) 기준으로 계산하도록 변경 |
| 🟡 route 기준 중앙화 | 정적 공개 URL 목록을 `STATIC_ROUTE_CONFIGS`로 모아 `pathname`, `changeFrequency`, `priority`, `sourcePaths`를 한군데서 관리하도록 정리 |
| 🟡 fallback 유지 | 라우트 소스 파일 stat이 실패하는 경우에는 `app/sitemap.ts`의 mtime으로 안전하게 fallback 하도록 처리 |
| 🟡 보호막 추가 | `tests/e2e/29-sitemap.spec.ts` 추가 — `/search`, `/community`, `/services/intro`, `/site-map` 존재, dead path `/company/community` 부재, `<lastmod>` 태그 존재를 직접 검증 |

## v3.38.88 — [SEO] JSON-LD 1차 추가

| 항목 | 내용 |
| --- | --- |
| 🟠 홈 구조화 데이터 추가 | `app/page.tsx`에 `Organization`, `WebSite` JSON-LD를 추가해 브랜드/사이트 검색 엔트리 의미를 검색엔진에 명시 |
| 🟠 체험 상세 구조화 데이터 추가 | `app/experiences/[id]/page.tsx`의 공개(active) 체험에만 `Product` JSON-LD를 추가하고, 제목/설명/대표 이미지/가격/카테고리/호스트명을 실제 데이터 기준으로 노출 |
| 🟠 커뮤니티 상세 구조화 데이터 추가 | `app/community/[id]/page.tsx`에 `Article` JSON-LD를 추가해 게시글 제목/요약/대표 이미지/작성자/게시일을 구조화 데이터로 제공 |
| 🟡 공용 helper 추가 | `app/components/seo/JsonLd.tsx`, `app/utils/structuredData.ts` 추가 — 구조화 데이터 직렬화와 `Organization`/`WebSite`/`Product`/`Article` 생성 기준을 중앙화 |
| 🟡 보호막 추가 | `tests/e2e/28-json-ld.spec.ts` 추가 — 홈, 활성 체험 상세, 커뮤니티 상세에서 `Organization`, `WebSite`, `Product`, `Article` JSON-LD가 실제 HTML에 포함되는지 확인 |

## v3.38.87 — [SEO] 동적 상세 공개 기준 1차 정리

| 항목 | 내용 |
| --- | --- |
| 🟠 체험 상세 공개 기준 반영 | `app/experiences/[id]/page.tsx`의 `generateMetadata()`가 `status='active'` 이고 `is_active !== false`인 체험만 indexable 메타를 반환하고, 비활성/비공개 체험과 미존재 체험은 `robots: noindex, nofollow`를 함께 내려주도록 정리 |
| 🟠 서비스 의뢰 상세 noindex 고정 | `app/services/[requestId]/page.tsx`의 동적 메타에 `PRIVATE_NOINDEX_METADATA.robots`를 연결해, open 상태 여부와 무관하게 서비스 의뢰 상세는 검색엔진 인덱싱 대상에서 제외 |
| 🟡 보호막 추가 | `tests/e2e/27-dynamic-detail-seo.spec.ts` 추가 — 활성 체험은 canonical만 있고 noindex가 없음을, 비활성 체험과 open 서비스 의뢰 상세는 `robots noindex`가 직접 노출됨을 검증 |

## v3.38.86 — [SEO] 공개 정보 페이지 메타/사이트맵 1차 정리

| 항목 | 내용 |
| --- | --- |
| 🟠 공개 정보 페이지 메타 확대 | `app/help/layout.tsx`, `app/site-map/layout.tsx`, `app/company/news/layout.tsx`, `app/company/notices/layout.tsx`, `app/company/careers/layout.tsx`, `app/company/investors/layout.tsx`, `app/company/partnership/layout.tsx` 추가 — 주요 정보성 공개 페이지에 locale별 title/description/canonical/alternates를 직접 부여 |
| 🟡 `/community` canonical 안전화 | `app/community/page.tsx`의 카테고리 query 메타는 유지하되 canonical과 `alternates.languages`는 기본 목록 경로 `/community`로 고정해 필터형 query 조합의 중복 신호를 줄임 |
| 🟡 `services/intro` 메타 보강 | `app/services/intro/page.tsx`에 canonical, `alternates.languages`, OG URL 기준을 추가해 공개 서비스 소개 랜딩의 메타 신호를 보강 |
| 🟡 사이트맵 정리 | `app/sitemap.ts`에서 dead path였던 `/company/community`를 제거하고 `/search`, `/community`, `/services/intro`, `/site-map`을 추가 |
| 🟡 사이트맵 페이지 링크 정리 | `app/site-map/page.tsx`의 커뮤니티 링크를 `/community`로 교체하고 `Explore` 섹션에 `/search`, `/services/intro`, `/community`를 추가 |
| 🟡 공개 메타 보호막 확대 | `tests/e2e/25-public-metadata.spec.ts`가 `/help`, `/community`, `/company/news`, `/services/intro`, `/site-map`까지 title/description/canonical을 직접 검증하도록 확장 |

## v3.38.85 — [SEO] Private 페이지 noindex 정리

| 항목 | 내용 |
| --- | --- |
| 🟠 private noindex 기준 추가 | `app/utils/seo.ts`에 `PRIVATE_NOINDEX_METADATA` 추가 — private 페이지의 `robots: noindex, nofollow` 단일 source로 사용 |
| 🟡 layout 단위 noindex 적용 | `app/account/layout.tsx`, `app/guest/layout.tsx`, `app/notifications/layout.tsx`, `app/services/my/layout.tsx` 추가 — 해당 private 페이지군의 검색 노출 차단 |
| 🟡 `/services` 루트 wrapper 정리 | 기존 client page를 `app/services/ServiceJobBoardClient.tsx`로 분리하고, `app/services/page.tsx`는 server wrapper로 교체해 job board 루트에도 noindex metadata 부여 |
| 🟡 보호막 추가 | `tests/e2e/26-private-noindex.spec.ts` 추가 — `/account`, `/guest/*`, `/notifications`, `/services`, `/services/my` 응답 HTML에 `robots noindex,nofollow` 메타가 직접 포함되는지 검증 |
| 🟡 검증 | `npx eslint`, `npx tsc --noEmit`, `git diff --check`, `npx playwright test tests/e2e/26-private-noindex.spec.ts --project=chromium`, `npx playwright test tests/e2e/25-public-metadata.spec.ts --project=chromium` 기준으로 확인 |

## v3.38.84 — [SEO] 공개 랜딩 페이지 메타데이터 보강

| 항목 | 내용 |
| --- | --- |
| 🟠 공개 랜딩 메타 추가 | `app/about/layout.tsx`, `app/search/layout.tsx`, `app/become-a-host/page.tsx`에 page-level metadata 추가 — locale별 title/description, canonical, `alternates.languages`, OG 기준을 각 랜딩에 직접 부여 |
| 🟡 호스트 랜딩 이미지 대체텍스트 보강 | `app/become-a-host2/BecomeHostLandingContent.tsx`의 section 이미지 `alt`를 generic 문구에서 의미 있는 설명으로 교체 |
| 🟡 공개/비공개 경계 유지 | `/services`는 로그인 리다이렉트가 있는 잡보드라 이번 공개 SEO 보강 대상에서 제외하고, 이후 private `noindex` 단계에서 다루도록 유지 |
| 🟡 보호막 추가 | `tests/e2e/25-public-metadata.spec.ts` 추가 — `/about`, `/search`, `/become-a-host`의 page title/description 메타가 직접 노출되는지 확인 |
| 🟡 검증 | `npx eslint`, `npx tsc --noEmit`, `git diff --check`, `npx playwright test tests/e2e/25-public-metadata.spec.ts --project=chromium` 기준으로 확인 |

## v3.38.83 — [SEO] 사이트 URL 단일 source로 정리

| 항목 | 내용 |
| --- | --- |
| 🟠 사이트 URL helper 추가 | `app/utils/siteUrl.ts` 추가 — `NEXT_PUBLIC_SITE_URL`를 메타/OG/canonical/robots/sitemap/이메일 기본 링크의 단일 source로 사용하도록 정리 |
| 🟡 하드코딩 도메인 제거 | `app/layout.tsx`, `app/page.tsx`, `app/experiences/[id]/page.tsx`, `app/community/[id]/page.tsx`, `app/robots.ts`, `app/sitemap.ts`, 이메일 템플릿 기본 대시보드 링크에서 `locally.vercel.app` / `locally-web.vercel.app` / `locally.com` 하드코딩 제거 |
| 🟡 locale 차선책 구조 유지 | `next.config.ts` rewrite + `app/middleware.ts` + `app/utils/locale.ts` 기반 locale prefix 전략은 그대로 유지하고, 도메인 기준만 env 중심으로 통일 |
| 🟡 검증 | `npx eslint`, `npx tsc --noEmit`, `git diff --check`, `npx playwright test tests/e2e/09-admin-analytics.spec.ts --project=chromium`, `npx playwright test tests/e2e/24-experience-card-verification.spec.ts --project=chromium` 기준으로 확인 |

## v3.38.82 — [Experience Payment] 체험 카드결제 서버 재검증 강화

| 항목 | 내용 |
| --- | --- |
| 🔴 PortOne 서버 재검증 전환 | `/api/payment/nicepay-callback`이 더 이상 브라우저의 성공 payload(`resCode`, `signData`, `ediDate`, `amount`)를 신뢰하지 않고, `imp_uid` 기준 PortOne REST API 재조회로 실제 결제 상태/주문번호/금액을 확인한 뒤에만 `bookings.status='PAID'`, `payment_method='card'`로 확정하도록 변경 |
| 🟠 카드 readiness 추가 | 신규 `/api/payment/card-ready` 추가. `NEXT_PUBLIC_PORTONE_IMP_CODE`, `PORTONE_API_KEY`, `PORTONE_API_SECRET`가 모두 있어야 `ready=true`이며, 체험 결제 페이지는 readiness가 false일 때 카드 버튼을 비활성화하고 무통장/PayPal로 fallback |
| 🟠 체험 카드 exploit 보호막 | 신규 `tests/e2e/24-experience-card-verification.spec.ts` 추가 — 비로그인 카드 callback 시도는 401, 로그인 상태에서도 `imp_uid` 없는 fabricated success payload만으로는 `PENDING` 예약이 `PAID` 되지 않는지 직접 검증 |
| 🟡 회귀 검증 | `tests/e2e/24-experience-card-verification.spec.ts`, `tests/e2e/23-live-guest-post-booking.spec.ts`, `npx tsc --noEmit`, `git diff --check` 기준으로 확인 |

## v3.38.81 — [Guest Booking] 예약 후 Trips / Receipt / Inbox 라이브 보호막 추가

| 항목 | 내용 |
| --- | --- |
| 🟠 라이브 후속 플로우 스모크 추가 | 신규 `tests/e2e/23-live-guest-post-booking.spec.ts`를 추가해 새 게스트 계정 생성 → 무통장 체험 예약 → 결제 완료 페이지에서 `내 여행` 진입 → `영수증` 모달 확인 → `메시지` 버튼으로 호스트 채팅 시작까지 실제 브라우저로 검증 |
| 🟡 직접 보호 범위 | 기존 `05-live-guest-booking-messaging-support.spec.ts`가 놓치던 예약 후 `Guest Trips / Receipt / Inbox ingress` 구간을 별도 live smoke로 고정 |
| 🟡 검증 | `tests/e2e/23-live-guest-post-booking.spec.ts`, `npx tsc --noEmit`, `git diff --check` 기준으로 확인 |

## v3.38.80 — [Analytics] 공용 타입 정리로 섹션/훅 경계 고정

| 항목 | 내용 |
| --- | --- |
| 🟠 공용 props/type 중앙화 | `analytics/types.ts`에 `AnalyticsTabProps`, `AnalyticsSummaryDataArgs/Result`, 섹션/모달 props, `AnalyticsSummarySources`, `AnalyticsMainTab` 추가 |
| 🟡 훅/섹션 타입 연결 | `useAnalyticsSummaryData`, `AnalyticsBusinessSection`, `AnalyticsHostSection`, `AnalyticsSearchDemandSection`, `AnalyticsMetricModal`이 모두 공용 타입 기준으로 연결 |
| 🟡 검증 | `09-admin-analytics.spec.ts`, `06-admin-master-ledger.spec.ts`, `npx tsc --noEmit`, `git diff --check` 통과 |

## v3.38.79 — [Analytics] 상세 모달 분리로 본체 책임 축소

| 항목 | 내용 |
| --- | --- |
| 🟠 `AnalyticsMetricModal` 분리 | `AnalyticsTab.tsx`에 길게 남아 있던 KPI drill-down 모달 분기를 `app/admin/dashboard/components/analytics/AnalyticsMetricModal.tsx` 로 추출 |
| 🟡 metric key 공용 타입화 | `analytics/types.ts`에 `AnalyticsMetricKey` 추가 — Business / Host / SearchDemand 섹션의 metric key를 공용 타입으로 통일 |
| 🟡 회귀 검증 | `09-admin-analytics.spec.ts`, `06-admin-master-ledger.spec.ts`, `npx tsc --noEmit`, `git diff --check` 통과 |

## v3.38.78 — [SEO] Sitemap 동적 체험 URL 추가 + Middleware 언어 자동감지 수정

| 항목 | 내용 |
| --- | --- |
| 🟠 Fix A: Sitemap 동적 라우트 | `app/sitemap.ts`: 정적 11개 URL에 Supabase `experiences` 테이블 `status='active'` 체험 전체를 동적으로 추가. `revalidate=3600` (1시간 캐시). Supabase 조회 실패 시 정적 URL만 반환하는 graceful fallback 내장 |
| 🟡 Fix B: Middleware Accept-Language 복원 | `app/middleware.ts`: URL prefix 없을 때 `x-locally-locale='ko'`를 무조건 주입하던 버그 수정 → URL prefix 있을 때만 헤더 주입. prefix 없으면 `locale.ts`가 cookie → Accept-Language 순으로 정상 처리. 일본어/중국어/영어 브라우저 첫 방문 SSR 언어 정확도 향상 + 기존 언어 선택 유저의 서버사이드 깜빡임 제거 |
| 🟡 빌드 검증 | `npx tsc --noEmit` 에러 0건 (Exit 0) |

## v3.38.77 — [Community] 봇 cron 안정화 + RightSidebar 실 DB 연동

| 항목 | 내용 |
| --- | --- |
| 🔴 Fix 1: auto-post BOT fallback 수정 | `app/api/bot/auto-post/route.ts`: `BOT_UUIDS` 비어있을 때 `profiles.role='admin'` 조회(컬럼 미존재)하던 fallback 제거 → `{ skipped: true }` 조기 반환으로 교체. cron 에러 방지 |
| 🟠 Fix 2: auto-comment fallback 비활성화 | `app/api/bot/auto-comment/route.ts`: `BOT_UUIDS` 비어있을 때 게시글 작성자 본인이 자신에게 댓글 다는 fallback 제거 → `{ skipped: true }` 조기 반환으로 교체 |
| 🟠 Fix 3: RightSidebar 실 DB 연동 | `app/community/components/RightSidebar.tsx`: `MOCK_EXPERIENCES` (Unsplash 하드코딩 3건) 제거 → `experiences` 테이블에서 `status='active'` 최신순 3건 실시간 조회로 교체 |
| 🟡 빌드 검증 | `npx tsc --noEmit` 에러 0건 (Exit 0) |

## v3.38.76 — [Analytics] booking_confirmed 사용자 추적 강화 + 복합 인덱스 추가

| 항목 | 내용 |
| --- | --- |
| 🟠 Fix B: booking_confirmed user_id 수정 | `payment/complete/page.tsx`의 `analytics_events` insert에서 `user_id: null` 하드코딩 → `booking.user_id ?? null` 으로 교체. 결제 완료 이벤트에 실제 사용자 ID 포함 |
| 🟡 Fix C: analytics 복합 인덱스 추가 | `supabase_analytics_indexes.sql`에 `(session_id, created_at DESC)` 복합 인덱스 2개 추가 — `analytics-search-intent` API의 세션별 시간순 조회 최적화 |
| 🟡 빌드 검증 | `npx tsc --noEmit` 에러 0건 (Exit 0) |

## v3.38.75 — [Analytics] Phase 2 리팩터링 + [Billing] GMV 집계 교정

| 항목 | 내용 |
| --- | --- |
| 🟠 Analytics Phase 2 리팩터링 | `AnalyticsTab.tsx` 1,820줄 → 1,284줄 (-536줄). `AnalyticsBusinessSection.tsx`, `AnalyticsHostSection.tsx` 각각 신규 분리 |
| 🟠 helpers.tsx 신규 | `SimpleKpi`, `FunnelBar`, `SimpleBar` 컴포넌트를 `analytics/helpers.tsx`로 추출 |
| 🔴 TDZ 버그 수정 | `searchTrendItems` 변수가 `stats` useState 선언 이전에 위치 → `ReferenceError` 발생. stats 선언 이후로 이동 |
| 🟡 `customerCompositionCacheRef` 초기값 복원 | 편집 중 `= {}` 누락 → `undefined ref` 타입 오류 발생. `= {}` 복원 |
| 🟠 GMV 집계 기준 통일 | `sales-summary` API: `service_bookings` 필터에서 `'PAID'` 제거 → `['confirmed', 'completed']`만 포함. 체험 예약 기준과 통일 |
| 🟡 sales-summary limit 추가 | 날짜 범위 미지정(ALL) 시 `bookings`, `service_bookings` 각 1,000건 limit 적용. 데이터 누적에 따른 무제한 쿼리 방지 |
| 🟡 빌드 검증 | `npx tsc --noEmit` 에러 0건 (Exit 0) |

## v3.38.74 — [Billing & Revenue] settleHostPayout 보안 강화

| 항목 | 내용 |
| --- | --- |
| 🔴 #1 관리자 인증 확인 | `getAdminClient()`가 `resolveAdminAccess`로 비관리자를 throw 차단함을 코드 주석으로 명시 |
| 🔴 #3 이중 정산 방지 | `payout_status='paid'` 기존 정산 건 사전 검증 추가. `service-payouts/mark-paid`와 동일한 방어 로직 적용 |
| 🔴 #3 누락 예약 검증 | 요청한 `bookingIds` 중 DB에서 찾을 수 없는 건 포함 시 조기 오류 반환 |
| 🟡 감사로그 보강 | `details`에 `count` 필드 추가 |
| 🟡 빌드 검증 | `npx tsc --noEmit` 에러 0건 (Exit 0) |

## v3.38.73 — [Master Ledger] Realtime 과부하 방지 (Phase A)


| 항목 | 내용 |
| --- | --- |
| 🟠 Realtime 디바운스 | 4개 Realtime 콜백(bookings/service_bookings INSERT/UPDATE)에 300ms 디바운스 적용. 연속 이벤트를 1회 `fetchLedger`로 병합 |
| 🟠 누수 방지 | 컴포넌트 언마운트 시 타이머 `clearTimeout` 추가 |
| 🟡 전체 조회 limit | 날짜 필터 미적용 시 `bookings` 최대 500건 제한 — 예약 증가에 따른 무제한 로딩 방지 |
| 🟡 빌드 검증 | `npx tsc --noEmit` 에러 0건 (Exit 0) |

## v3.38.72 — [Master Ledger] 강제 취소 중복 환불 방지 (Phase A)


| 항목 | 내용 |
| --- | --- |
| 🔴 중복 환불 방지 마커 | PG 환불 API 호출 **직전** DB `cancel_reason`에 `[환불처리중]` 마커 기록. PG 성공 + DB 업데이트 실패 후 관리자 재시도 시 마커 감지 → 409 차단 → 중복 환불 방지 |
| 🔴 `cancel_reason` select 추가 | force-cancel select 쿼리에 `cancel_reason` 누락 수정 → 마커 감지 가능 |
| 🟡 최종 정상 완료 시 | 마커 자동 제거 + `(관리자 강제 취소)` 사유로 교체 |
| 🟡 빌드 검증 | `npx tsc --noEmit` 에러 0건 (Exit 0) |

## v3.38.71 — [Master Ledger] 보안·데이터 정합성 교정 4건


| 항목 | 내용 |
| --- | --- |
| 🟠 #2 `select *` 제거 | `bookings`, `service_bookings` 모두 `select('*')` → 필요 컬럼 명시 선택. `tid`(PG 결제 토큰) 등 민감 필드 응답 최소화 |
| 🟠 #3 KST 날짜 변환 | `service_booking` 날짜 폴백 시 `created_at.slice(0,10)` (UTC 기준) → `toKSTDateStr()` (UTC+9 변환)으로 교정. 오전 9시 이전 예약의 하루 차이 버그 해결 |
| 🟡 #5 검색 문자열 보완 | `contact_phone`, `profiles.email` 검색 대상 추가. null 안전 `filter(Boolean).join(' ')` 방식으로 교체 |
| 🟡 #6 `isBankPaymentMethod` 통일 | `.includes('bank')` → `=== 'bank'`로 서버 API 기준과 완전 통일 |
| 🟡 빌드 검증 | `npx tsc --noEmit` 에러 0건 (Exit 0) |

## v3.38.70 — [Team Workspace] 보안 및 데이터 정합성 교정 4건


| 항목 | 내용 |
| --- | --- |
| 🔴 #1 `profiles select *` 삭제 | `getCurrentUser`에서 `select('*')` → `select('full_name')`으로 핀셋 수정. 불필요한 개인정보 컨럼 노옶 차단 |
| 🟠 #2 `team-counts` 채팅 동산 제외 | `admin_task_comments` 카운트에서 팀 채팅방 메시지(`task_id = 000...0`) 제외. Team Workspace 다은 뱃지 숫자 부풀림 버그 해결 |
| 🟠 #3 할 일 삭제 서버 권한 검증 | `DELETE /api/admin/team/tasks/[id]`에 `author_id === user.id` 서버 측 소유권 검증 추가. API 직접 호출으로 타인 할 일 삭제 가능한 보안 이슈 차단 |
| 🟡 #4 이미지 MIME 유효성 검증 | `GlobalTeamChat` 파일 업로드 시 `file.type` MIME 검증 (JPEG/PNG/WEBP/GIF만 허용). 콴라이언트+업로드 함수 두 곳 모두 적용해 확장자 위장 방어 |
| 🟡 빌드 검증 | `npx tsc --noEmit` 에러 0건 (Exit 0) |

## v3.38.69 — [Message Monitoring] 관리자 전용 데이터 레이어 분리 (Phase 3)

| 항목 | 내용 |
| --- | --- |
| 🔴 `useChat` 의존 폐제 | `ChatMonitor.tsx`가 비대한 공용 `useChat` 훅을 옆에서야 하던 관계를 완전히 끄어냄. 관리자용 전용 `useAdminChatQuery` 훅으로 완전 교체 |
| 🟠 BE 데이터 레이어 신규 2개 | `/api/admin/inquiries` (목록) 및 `/api/admin/inquiries/[id]/messages` (메시지) 서버 API를 신규 창제. 프론트 에서 Supabase를 직접 다룰 N+1 쿼리가 서버로 새 |
| 🟡 핀셋 Realtime 구독 | 기존에는 모든 `inquiry_messages` 이벤트를 수신하던 무차별 소켓을, 지금 열려있는 문의방 번호로만 필터링하여 나머지 이벤트를 무시 - 웹소켓 커넥션 관리 효율화 |
| 🟡 빌드 검증 | `npx tsc --noEmit` 및 `npm run build` 모두 에러 0첨 (종료 코드 0) |

## v3.38.68 — [Message Monitoring] 동시성 방어 및 감사로그 정합성 보정 (Phase 2)

| 항목 | 내용 |
| --- | --- |
| 🔴 상태 변경 Optimistic Lock 도입 | `/api/admin/inquiries/[id]/status` 호출 시 `updated_at`을 검증해, 다수의 관리자가 동시에 처리할 때 발생하는 '마지막 작성자 덮어쓰기'를 원천 방어 (409 Conflict) |
| 🟠 1:1 문의 랜덤 배정 폐기 | `thread/shared.ts`에서 CS 시작 시 `Math.random`으로 관리자 1명을 무작위 할당하던 로직을 폐기하고 `host_id`를 null로 두어, 팀 전체가 오픈 풀 형태로응대하도록 구조화 |
| 🟡 관리자 답변 감사 로그 | 관리자가 1:1 지원 문의에 답변할 때마다 `admin_audit_logs`에 발송자, 문의 대상, 메시지 미리보기(`ADMIN_CS_MESSAGE_SEND`)를 남겨 내부 운영 투명성 확보 |
| 🟡 URL 파라미터 찌꺼기 픽스 | `ChatMonitor.tsx`에서 다른 문의로 넘어갔다가 돌아올 때 기존 `?inquiryId=`가 남아 강제 선택되는 버그를 `router.replace` 파라미터 소거로 해결 |

## v3.38.67 — [Message Monitoring] 성능 최적화 및 정합성 보정 (Phase 1)

| 항목 | 내용 |
| --- | --- |
| 🔴 데이터 과적재 방어 | `useChat` 훅이 채팅 참여자의 모든 `profiles`, `host_applications` 정보를 무분별하게 불러오던 것을 필수 컬럼만 가져오도록 핀셋 최적화해 메모리 폭발 및 민감정보 유출 방지 |
| 🟠 미읽음 뱃지 정합성 보정 | `api/admin/sidebar-counts`에서 CS 문의 미읽음 배지를 계산할 때, 본인이 발송한 메시지는 제외(`.neq('sender_id', user.id)`)하도록 픽스해 배지가 부풀려지는 버그 해결 |
| 🟡 관리자 실명 복구 | Admin 1:1 문의 탭에서 관리자가 답변 시 무조건 `로컬리`로 덮어쓰던 부분을 `로컬리 (실명)` 형태로 표출하도록 수정해 팀 내 답변 추적성 복구 |

## v3.38.66 — [User Management] 타입 안정성 및 성능 최적화

| 항목 | 내용 |
| --- | --- |
| 🔴 UsersTab 렌더링 최적화 | `TimeAgo` 컴포넌트를 분리하여 1분마다 전체 740줄의 UsersTab이 리렌더링되는 성능 이슈 해결 |
| 🟠 검색 필터 시 선택 초기화 | 역할/검색 필터 변경 시 숨겨진 유저가 계속 선택된 상태로 남는 치명적 버그 수정 (`selectedUserIds` 초기화 `useEffect` 추가) |
| 🟡 완벽한 타입 안전성 보장 | `AdminUserDashboardRow`, `OnlineUser` 인터페이스를 추가하고 `any` 타입을 완전히 걷어내 타입 에러와 런타임 버그 회귀 차단 |

## v3.38.65 — [Admin Alerts] 아키텍처 오염 방어 및 서버 과부하 개선

| 항목 | 내용 |
| --- | --- |
| 🔴 Sidebar 리얼타임 구독 필터링 | `Sidebar.tsx`에서 모든 채널을 구독하던 것을 `.on('postgres_changes', { filter: 'user_id=eq.${currentUser.id}' })` 형태로 본인 것만 받도록 방어막 설치해 무의미한 서버 폭격을 차단 |
| 🟠 폴링 주기 최적화 | 네트워크 방어용 중복 폴링 간격을 45초에서 5분으로 늘려 무의미한 서버 호출을 1/8 수준으로 줄임 |
| 🟡 발송 타입 오염 방어 | `actions/admin.ts` 호스트 승인 알림 타입을 `application_status_changed`로 변경하고, `api/notifications/email`의 폴백 타입을 `general`로 보정해 일반 회원 알림 수신함 오염을 방지 |


## v3.38.64 — [Analytics] AnalyticsTab Phase 2 리팩터링 + Analytics 데이터 품질 수정

| 항목 | 내용 |
| --- | --- |
| 🔴 AnalyticsTab 책임 분리 완료 | 1,820줄짜리 `AnalyticsTab.tsx`에서 Business 탭(~260줄)과 Host 탭(~260줄) JSX 블록을 각각 `AnalyticsBusinessSection`, `AnalyticsHostSection`으로 추출. `SimpleKpi`, `FunnelBar`, `SimpleBar` 공용 컴포넌트는 `analytics/helpers.tsx`로 분리. 최종 본파일 1,284줄 |
| 🔴 windowClamped 응답 명시 | 날짜 범위 1~2일 선택 시 내부에서 비교 윈도우가 3~14일로 강제 클램핑되는 경우 `windowClamped: true`를 응답 JSON에 포함. 검색 수요 분석 UI에서 "비교 기간 자동 조정" 뱃지로 표시 |
| 🔴 booking_confirmed 이벤트 추가 | 결제 완료 페이지(`payment/complete/page.tsx`)에서 예약 데이터 로드 성공 시 `analytics_events`에 `event_type: 'booking_confirmed'` fire-and-forget insert 추가. `getAnalyticsTrackingMetadata()` 세션/UTM 포함 |
| 🟠 analytics 테이블 인덱스 SQL | `supabase_analytics_indexes.sql` 신규 생성 — `analytics_events(session_id, event_type, created_at DESC, user_id)` + `search_logs(session_id, created_at DESC, user_id)` 7개 인덱스 정의 |
| 🟡 연령 계산 방어 코드 강화 | `getAgeBucket`에 `Number.isInteger` 체크 + `age < 0 \|\| age > 120` 범위 초과 방어 추가. 비정상 생년 데이터로 인한 버킷 오분류 차단 |

## v3.38.62 — [Admin] ChatMonitor 1:1 문의 상태 변경 경로 서버화

| 항목 | 내용 |
| --- | --- |
| 🔴 관리자 문의 상태 API 추가 | `/api/admin/inquiries/[id]/status`를 추가해 `admin`/`admin_support` 문의만 관리자 권한 확인 후 `open / in_progress / resolved` 상태 변경이 가능하도록 서버 경로로 통일 |
| 🟠 ChatMonitor direct update 제거 | `ChatMonitor`에서 브라우저 `inquiries.update({ status })`를 제거하고, 기존 자동 `open → in_progress` 전환까지 새 admin API를 통해서만 처리하도록 정리 |
| 🟡 CHATS 탭 직접 스모크 추가 | `tests/e2e/14-admin-chats.spec.ts`를 추가해 관리자 1:1 문의 선택 후 상태를 `처리중`으로 바꾸면 DB가 실제 `in_progress`로 바뀌는지 직접 검증 |

## v3.38.61 — [Admin] Alerts 탭 읽기/쓰기 경로 서버화

| 항목 | 내용 |
| --- | --- |
| 🔴 Admin Alerts 전용 API 추가 | `/api/admin/alerts`, `/api/admin/alerts/[id]`, `/api/admin/alerts/read-all`를 추가해 Alerts 탭의 목록 조회, 개별 읽음 처리, 전체 읽음 처리, 삭제를 모두 서버 관리자 경로로 통일 |
| 🟠 Alerts 탭 direct write 제거 | `AdminAlertsTab`에서 브라우저 `notifications` direct read/write/delete를 제거하고, realtime 구독만 유지한 채 API 기반으로 전환 |
| 🟡 Alerts 탭 스모크 추가 | `tests/e2e/13-admin-alerts.spec.ts`를 추가해 관리자 알림 목록 로딩과 전체 읽음 처리 흐름을 직접 검증 |

## v3.38.60 — [Analytics] Review Quality 삭제 경로 admin API 통일

| 항목 | 내용 |
| --- | --- |
| 🔴 리뷰 삭제 admin API 추가 | `/api/admin/reviews/[id]`를 추가해 관리자 권한 확인 후에만 리뷰 삭제가 이루어지도록 경로를 서버로 통일 |
| 🟠 감사 로그 보강 | Review Quality에서 삭제한 리뷰는 `DELETE_REVIEW` 액션으로 `admin_audit_logs`에 기록되고, 평점/체험/게스트/내용 미리보기까지 함께 남김 |
| 🟡 UI 동작 유지 | `ReviewsTab`의 검색/필터/목록 UX는 유지하고, 브라우저 direct delete만 서버 DELETE 호출로 교체해 회귀 면적을 최소화 |

## v3.38.59 — [Analytics] 검색 수요 분석 전환 힌트 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 세션 기준 검색 전환 추가 | `/api/admin/analytics-search-intent`가 `search_logs`와 `analytics_events(click/payment_init)`를 같은 세션 기준으로 연결해 `검색→클릭`, `검색→결제 시작` 참고 지표를 함께 계산하도록 확장 |
| 🟠 Analytics 검색 카드 보강 | `고객 검색 수요 분석` 섹션에 `클릭 전환 키워드`, `결제 시작 전환 키워드` 카드를 추가하고, `동일 세션 기준 참고용` 범위를 화면에서 명확히 안내 |
| 🟡 잘못된 공급 기준 문구 정리 | 공급 부족 키워드 설명에서 실제 집계에 쓰지 않는 `태그` 문구를 제거해, 현재 활성 체험 `제목/도시/설명/카테고리` 기준 참고용이라는 의미만 남김 |

## v3.38.58 — [Analytics] 고객 유입 source별 주요 고객 구성 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 source별 주요 고객 힌트 추가 | `고객 구성 분석`의 `주요 유입 source` 카드가 source별 결제 고객 기준 `주요 국적`, `주요 언어`를 함께 보여주도록 확장 |
| 🟠 기존 source 카드 보강 유지 | 기존 `가입→결제 전환`, `결제액`, `반복 고객 비율`은 그대로 두고, 운영자가 “어떤 고객군이 이 source에서 강한지”를 바로 읽을 수 있게 한 줄 보조 정보만 추가 |
| 🟡 참고용 범위 유지 | 국적/언어 역시 추적 데이터가 남아 있는 결제 고객 기준 참고용으로만 표시하고, 데이터 부족 시 기존 collecting/unavailable 분기를 유지 |

## v3.38.54 — [Analytics] 고객 유입 source 추적 기반 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 source attribution 필드 추가 | `supabase_analytics_source_tracking_v3.38.54.sql`를 추가해 `search_logs`, `analytics_events`에 `referrer`, `referrer_host`, `utm_source`, `utm_medium`, `utm_campaign`, `landing_path` 필드를 확장 |
| 🟠 검색/상세/결제 초기 이벤트 연결 | 메인 검색, 체험 상세 view/click, 결제 시작 이벤트가 같은 세션 기준의 source attribution 메타데이터를 함께 저장하도록 정리 |
| 🟡 고도화 선행 작업 | 이번 단계는 고객 유입 분석을 위한 데이터 수집 기반만 추가하고, 실제 source 분석 지표는 데이터가 충분히 쌓인 뒤 별도 단계에서 노출하도록 유지 |

## v3.38.55 — [Analytics] 고객 유입 source 분석 1차 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 고객 구성 API 확장 | `/api/admin/analytics-customer-composition`가 `analytics_events` 기준으로 추적된 결제 고객의 첫 유입 source를 집계해 `주요 유입 source`를 함께 내려주도록 확장 |
| 🟠 Analytics 고객 source 블록 추가 | `Data Analytics`의 `고객 구성 분석` 섹션에 `주요 유입 source` 카드를 추가하고, `ready / collecting / unavailable` 상태별 안내 문구를 분리해 운영자가 참고 수준을 바로 읽을 수 있게 정리 |
| 🟡 안전한 스키마 의존 축소 | 실DB에서 없는 `experiences.tags` 의존을 제거해 새 검색/고객 분석 API가 500 없이 동작하도록 보정하고, source 데이터가 부족하면 다른 고객 구성 지표를 유지한 채 참고용 카드만 보이게 처리 |

## v3.38.56 — [Analytics] 고객 유입 source별 가입→결제 전환 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 source별 가입 cohort 집계 추가 | `/api/admin/analytics-customer-composition`가 선택 기간 내 가입한 `profiles`와 추적된 `analytics_events`를 연결해 source별 가입 수를 별도로 집계하도록 확장 |
| 🟠 유입 source 카드 고도화 | `고객 구성 분석`의 `주요 유입 source` 카드가 단순 mix뿐 아니라 `가입 n명 · 결제 n명 · 전환율 %`를 바로 보여주도록 보강 |
| 🟡 참고용 범위 명시 | 가입→결제 전환은 추적 데이터가 남아 있는 가입자 기준 참고용으로만 표시하고, source 데이터가 부족한 경우 기존 mix/collecting 안내로 안전하게 내려가도록 유지 |

## v3.38.57 — [Analytics] 고객 유입 source별 결제액·반복 고객 보강

| 항목 | 내용 |
| --- | --- |
| 🔴 source별 결제액 추가 | `고객 구성 분석`의 `주요 유입 source` 카드가 source별 결제 고객 총 결제액까지 함께 보여주도록 확장 |
| 🟠 반복 고객 비율 추가 | source별 결제 고객 중 반복 구매 고객 수와 비율을 함께 표시해 “어디서 들어온 고객이 다시 결제하는지”를 바로 볼 수 있게 보강 |
| 🟡 참고용 범위 유지 | 결제액/반복 고객도 기존과 동일하게 추적 데이터가 남아 있는 가입자 기준 참고용으로만 표시하고, source 데이터 부족 시 collecting/unavailable 분기를 유지 |

## v3.38.53 — [Analytics] 고객 구성 분석 1차 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 고객 구성 API 추가 | `/api/admin/analytics-customer-composition`를 추가해 체험 예약 + 서비스 결제 고객 기준 `국적`, `주요 언어권`, `신규/반복`, `체험/서비스 선호`를 서버에서 조립하도록 분리 |
| 🟠 Analytics 고객 구성 블록 추가 | `Data Analytics`에 `고객 구성 분석` 섹션을 추가해 결제 고객 기준의 구성 분포를 상단 플랫폼 전체 영역에서 바로 읽을 수 있도록 보강 |
| 🟡 과한 source 추정 보류 | 고객 유입 source는 아직 정합성이 충분히 확인되지 않아 1차에서는 지표를 억지로 추가하지 않고 `추가 예정` 안내만 남겨 잘못된 해석을 막음 |

## v3.38.52 — [Analytics] 검색 수요 분석 1차 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 전용 검색 수요 API 추가 | `/api/admin/analytics-search-intent`를 추가해 검색 로그 기준 `많이 찾는 키워드`, `최근 급상승 키워드`, `공급 부족 키워드`를 서버에서 조립하도록 분리 |
| 🟠 Analytics 보강 블록 추가 | `Data Analytics`에 `고객 검색 수요 분석` 섹션을 추가해 기존 `체험 검색 인기 트렌드` 아래에서 수요/공급 부족 신호를 함께 읽을 수 있게 정리 |
| 🟡 과한 추정 지표 보류 | 검색 후 클릭/결제 전환 분석은 검색 로그와 이벤트 로그를 안전하게 연결할 수 있을 때까지 넣지 않고, 화면에 보류 안내만 남겨 잘못된 해석을 막음 |

## v3.38.51 — [Payments] PayPal 서비스 결제 UI 스모크 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 서비스 PayPal 분기 보호막 | `tests/e2e/12-service-paypal-payment.spec.ts`를 추가해 서비스 결제 페이지의 `PayPal` 선택지, mocked SDK 승인 흐름, `/api/services/payment/paypal/create-order`·`capture-order` 호출, 완료 페이지 이동까지 직접 검증 |
| 🟠 안전한 mock 전략 | 실제 PayPal 네트워크나 secret 의존 없이 SDK 스크립트와 create/capture API 응답만 mock하고, 런타임에 PayPal 옵션이 꺼져 있으면 명시적으로 skip하도록 구성해 기존 NicePay/무통장 회귀를 차단 |

## v3.38.50 — [Payments] PayPal 서비스 의뢰 취소·환불 분기 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 고객 취소 PayPal 분기 | `/api/services/cancel`에서 `payment_method='paypal'`인 서비스 예약만 PayPal capture refund endpoint를 호출하고, 기존 NicePay/무통장 취소 의미는 유지 |
| 🟠 관리자 강제취소 PayPal 분기 | `/api/admin/service-cancel`에서 `payment_method='paypal'`인 서비스 예약만 PayPal refund를 호출하고, 실패 시 DB 상태를 바꾸지 않도록 기존 NicePay error-safe 흐름을 유지 |

## v3.38.49 — [Payments] PayPal 서비스 의뢰 결제 UI 연결

| 항목 | 내용 |
| --- | --- |
| 🔴 PayPal 옵션 추가 | `app/services/[requestId]/payment/page.tsx`에 `PayPal` 결제수단을 추가하고, 공개 SDK(`NEXT_PUBLIC_PAYPAL_CLIENT_ID`)가 있을 때만 별도 버튼을 렌더하도록 연결 |
| 🟠 create/capture 분기 연결 | PayPal 버튼 클릭 시 기존 pending `service_bookings`를 재사용해 `/api/services/payment/paypal/create-order` → `/api/services/payment/paypal/capture-order` 경로로만 결제를 확정하도록 분기 |
| 🟡 기존 결제 보존 | 서비스 NicePay 카드 결제 CTA, 무통장 입금 CTA, 완료 페이지 UX는 그대로 유지해 회귀 면적을 최소화 |

## v3.38.48 — [Payments] PayPal 서비스 의뢰 결제 서버 route 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 create-order 추가 | `/api/services/payment/paypal/create-order`를 추가해 로그인 사용자 본인 서비스 예약인지, `PENDING` 상태인지, 금액이 유효한지 검증한 뒤 PayPal order를 생성하도록 분리 |
| 🟠 capture-order 추가 | `/api/services/payment/paypal/capture-order`를 추가해 PayPal order 참조/custom_id와 금액을 다시 검증하고, capture 성공 시 `service_bookings=PAID`, `payment_method='paypal'`, `tid=<captureId>`, `service_requests=open`까지 기존 서비스 NicePay callback과 같은 결과를 저장 |
| 🟡 기존 경로 보존 | 이번 단계는 서비스 NicePay 카드 결제 UI, 무통장 입금, 취소/환불 경로를 전혀 변경하지 않아 회귀 면적을 최소화 |

## v3.38.46 — [Payments] PayPal 체험 결제 UI 연결

| 항목 | 내용 |
| --- | --- |
| 🔴 PayPal 옵션 추가 | `app/experiences/[id]/payment/page.tsx`에 `PayPal` 결제수단을 추가하고, 공개 SDK(`NEXT_PUBLIC_PAYPAL_CLIENT_ID`)가 있을 때만 별도 버튼을 렌더하도록 연결 |
| 🟠 create/capture 분기 연결 | PayPal 버튼 클릭 시 기존 `/api/bookings`로 `PENDING` 예약을 만든 뒤, `/api/payment/paypal/create-order` → `/api/payment/paypal/capture-order` 경로로만 결제를 확정하도록 분기 |
| 🟡 기존 결제 보존 | NicePay 카드 결제, 무통장 입금 CTA, 기존 callback/취소 환불 경로는 변경하지 않아 회귀 면적을 최소화 |

## v3.38.47 — [Payments] PayPal 체험 예약 취소/환불 분기 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 일반 취소 분기 추가 | `/api/payment/cancel`에서 `payment_method='paypal'`인 체험 예약만 PayPal capture refund endpoint를 호출하고, 기존 NicePay 카드/무통장 취소 흐름은 유지 |
| 🟠 관리자 강제취소 분기 추가 | `/api/admin/bookings/force-cancel`도 같은 조건에서만 PayPal refund를 사용하도록 분기해 관리자 취소와 일반 취소의 정산 결과를 맞춤 |
| 🟡 공통 helper 확장 | `app/utils/paypal/server.ts`에 capture refund 유틸을 추가해 이후 서비스 결제 PayPal 환불 분기에서도 재사용 가능하게 준비 |

## v3.38.44 — [Payments] PayPal 고객 결제 1단계 공통 기반 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 공통 서버 유틸 | `app/utils/paypal/server.ts`를 추가해 PayPal access token 발급, order 생성/조회/capture를 공통 서버 유틸로 정리 |
| 🟠 타입 중앙화 | `app/types/paypal.ts`를 추가해 order/token/capture 타입을 중앙화하고 이후 체험/서비스 결제 route에서 재사용 가능하게 준비 |
| 🟡 NicePay 무변경 원칙 | 이번 단계는 UI, 결제 route, 취소/환불 흐름을 건드리지 않고 공통 기반만 추가해 기존 NicePay 결제 회귀를 차단 |

## v3.38.45 — [Payments] PayPal 체험 결제 서버 route 추가

| 항목 | 내용 |
| --- | --- |
| 🔴 create-order 추가 | `/api/payment/paypal/create-order`를 추가해 로그인 사용자 본인 예약인지, `PENDING` 상태인지, 금액이 유효한지 검증한 뒤 PayPal order를 생성하도록 분리 |
| 🟠 capture-order 추가 | `/api/payment/paypal/capture-order`를 추가해 PayPal order 참조/custom_id와 금액을 다시 검증하고, capture 성공 시 기존 NicePay와 같은 예약 확정/정산 데이터(`payment_method='paypal'`, `tid=<captureId>`)를 저장 |
| 🟡 NicePay 경로 보존 | 이번 단계도 기존 체험 결제 UI, NicePay callback, 취소/환불 route는 전혀 변경하지 않아 회귀 면적을 최소화 |

## v3.38.43 — [Admin Dashboard] Users/Approvals 탭 공통 로딩 게이트 분리

| 항목 | 내용 |
| --- | --- |
| 🔴 Users 독립 렌더 | `User Management`를 `useAdminData()` 공통 로딩 게이트 밖으로 분리하고, `/api/admin/users-summary` + presence 구독만 쓰는 `useAdminUsersData` 경량 훅으로 직접 렌더링하도록 정리 |
| 🟠 Approvals 독립 렌더 | `Approvals`를 `useAdminData()` 공통 로딩 게이트 밖으로 분리하고, `/api/admin/host-applications` 요약 API + `experiences` 조회만 쓰는 `useAdminApprovalsData` 경량 훅으로 직접 렌더링하도록 정리 |
| 🟡 공통 훅 불변 유지 | `useAdminData.ts`는 변경하지 않고 남겨, 기존 shared fetch 레거시와 다른 탭 동작에 회귀가 없도록 유지 |

## v3.38.38 — [User Management] 상세 패널 스크롤 및 역할 UX 정리

| 항목 | 내용 |
| --- | --- |
| 🔴 상세 패널 상단 복귀 | `UsersTab`에서 다른 회원을 선택할 때 우측 상세 패널 스크롤을 항상 맨 위로 초기화해, 하단 행을 눌러도 바로 프로필 상단 정보가 보이도록 수정 |
| 🟠 역할 용어/배지 정리 | 기본 역할을 `Guest`로 통일하고 `Guest / Host / Admin` 배지를 각각 다른 색상으로 구분해 목록과 상세 헤더에서 더 쉽게 식별되도록 정리 |
| 🟡 리스트 정보 우선순위 보정 | 목록에서는 `최근 활동`만 남기고 `최근 접속` 컬럼은 제거해 중복 정보를 줄이고, 접속 상태는 상세 헤더의 `지금 활동 중 / 마지막 접속`으로만 유지 |

## v3.38.42 — [Admin Dashboard] Analytics 탭 공통 로딩 게이트 분리

| 항목 | 내용 |
| --- | --- |
| 🔴 Analytics 독립 렌더 | `Data Analytics` 탭을 `page.tsx`에서 `useAdminData()` 공통 로딩 게이트 밖으로 분리해, shared admin fetch가 느리거나 실패해도 `AnalyticsTab`이 전용 admin API 기준으로 바로 렌더되도록 정리 |
| 🟠 fallback 안전망 유지 | `AnalyticsTab`의 shared props를 optional로 낮추고, 서버 집계 실패 시에만 마지막 안전망으로 로컬 계산값을 쓰는 구조를 유지해 회귀 없이 독립성을 높임 |

## v3.38.40 — [Admin Dashboard] Billing 탭 공통 로딩 게이트 분리

| 항목 | 내용 |
| --- | --- |
| 🔴 Sales 독립 렌더 | `Billing & Revenue` 탭을 `page.tsx`에서 `useAdminData()` 공통 로딩 게이트 밖으로 분리해, shared admin fetch가 느리거나 실패해도 `SalesTab`이 자체 `/api/admin/sales-summary`로 바로 렌더되도록 정리 |
| 🟠 구조 회귀 방지 | `useAdminData.ts`는 건드리지 않고 `SALES` 분기만 최상위에서 직접 렌더링해 `Users / Ledger / Analytics / Approvals` 기존 흐름에는 영향이 없도록 유지 |

## v3.38.41 — [Admin Dashboard] Master Ledger 탭 공통 로딩 게이트 분리

| 항목 | 내용 |
| --- | --- |
| 🔴 Ledger 독립 렌더 | `Master Ledger` 탭을 `page.tsx`에서 `useAdminData()` 공통 로딩 게이트 밖으로 분리해, shared admin fetch가 느리거나 실패해도 `MasterLedgerTab`이 자체 `/api/admin/master-ledger`로 바로 렌더되도록 정리 |
| 🟠 최신성 자립 | 부모 `refreshSignal` 없이도 새 일반 예약이 바로 반영되도록 `MasterLedgerTab`의 자체 realtime 구독에 `bookings INSERT`를 추가하고, 액션 후 부모 refresh 호출은 optional 처리로 회귀 없이 유지 |

## v3.38.39 — [User Management] 정렬/필터 및 패널 가시성 보강

| 항목 | 내용 |
| --- | --- |
| 🔴 상세 패널 화면 상단 노출 | 회원 선택 시 우측 상세 패널 컨테이너 자체를 화면 상단으로 스크롤해, 목록 하단 회원을 눌러도 패널 헤더가 바로 보이도록 보강 |
| 🟠 운영 필터 추가 | `최근 활동순`, `최근 접속순`, `최근 가입순`, `결제액순` 정렬과 `Guest / Host / Admin`, `온라인만` 필터를 추가해 운영자가 목록을 더 빠르게 좁힐 수 있게 정리 |
| 🟡 선택 UX 정렬 | 전체 선택도 현재 보이는 필터 결과 기준으로만 동작하도록 맞춰 필터와 선택 상태가 어긋나지 않게 조정 |

## v3.38.37 — [Analytics] 이벤트/문의 집계 조회 추가 압축

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 business 이벤트 집계 경량화 | `analytics-summary`에서 `analytics_events` raw row 전체를 읽지 않고, `view/click/payment_init`를 count query로 바로 집계해 서버 조회량을 축소 |
| 🟠 host 문의 집계 경량화 | `analytics-host-summary`에서 `inquiry_messages` 전역 정렬을 제거하고, 문의별 메시지만 묶은 뒤 JS에서 정렬하도록 바꿔 DB 정렬 비용을 낮춤 |
| 🟡 fallback 범위 추가 축소 | `AnalyticsTab`이 실제 fallback 분기 안에서만 로컬 임시 집계를 실행하도록 좁혀, 서버 집계가 정상일 때 불필요한 로컬 계산을 더 줄임 |

## v3.38.36 — [Analytics] 서버 집계 API 불필요 정렬/전송 축소

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 summary 조회 경량화 | `analytics-summary`에서 전체 `profiles` 행을 통째로 읽지 않고, 총 사용자 수는 count query, 최근 가입 미리보기는 별도 preview query로 분리해 데이터 전송량을 축소 |
| 🟠 host 집계 정렬 축소 | `analytics-summary`, `analytics-host-summary`에서 순서가 필요 없는 집계성 조회의 `order(created_at)`를 제거해 불필요한 DB 정렬 비용을 줄임 |

## v3.38.35 — [Analytics] 서버 집계 성공 시 로컬 계산 지연

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 화면 계산 비용 축소 | `AnalyticsTab`이 서버 집계 또는 같은 기간의 캐시된 서버 집계가 있으면 무거운 로컬 `buildLocalStats()` 계산을 건너뛰고, fallback이 정말 필요할 때만 실행하도록 보강 |
| 🟠 회귀 없이 성능 개선 | 숫자 의미와 API 계약은 유지한 채 계산 시점만 늦춰, `Data Analytics` 날짜 전환/초기 로드 부담을 줄임 |

## v3.38.34 — [Analytics] 마지막 정상 서버 집계 우선 재사용

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 fallback 의존 축소 | `AnalyticsTab`이 서버 집계 실패 시 바로 화면 로컬 계산으로 내려가지 않고, 같은 기간의 마지막 정상 서버 집계값이 있으면 먼저 재사용하도록 보강 |
| 🟠 운영자 신뢰도 개선 | `임시` 상태를 `최근 정상 서버 집계 유지`와 `화면 임시 집계`로 구분해, 운영자가 현재 숫자의 신뢰 수준을 더 정확히 판단할 수 있게 정리 |

## v3.38.28 — [User Management] 전용 스모크 테스트 추가

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 Users 보호막 추가 | 신규 `11-admin-users.spec.ts`를 추가해 `User Management` 탭의 회원 검색, 요약 컬럼 렌더, 상세 패널, 회원 타임라인 노출을 직접 검증 |
| 🟠 운영 fixture 최소화 | 전용 테스트 회원 1명에 예약, 리뷰, 문의 답변, 서비스 의뢰/결제를 안전하게 시드해서 목록 summary와 타임라인이 실제 데이터로 채워지는지 확인 |
| 🟡 회귀 교차 검증 | Users 전용 스모크 추가 후 기존 `Master Ledger`, `Approvals`, `Billing`, `Analytics`, `Service Requests` 관리자 스모크와 함께 다시 확인하도록 보호 범위를 확장 |

## v3.38.29 — [Analytics] 임시 집계 배지 추가

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 임시 집계 가시화 | `AnalyticsTab`에 `Business & Guest`, `Host Ecosystem` 서버 집계 실패 시 `임시` 배지와 안내 박스를 표시해 운영자가 현재 숫자가 화면 계산값인지 바로 알 수 있게 보강 |
| 🟠 최소 범위 UI 수정 | 숫자 계산식과 API 계약은 건드리지 않고, 섹션 헤더/탭 라벨에만 작게 표시해 회귀 위험 없이 신뢰도만 보강 |

## v3.38.27 — [Service Requests] 전용 스모크 테스트 추가

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 실무 보호막 추가 | 신규 `10-admin-service-requests.spec.ts`를 추가해 `SERVICE_REQUESTS` 탭의 핵심 운영 흐름인 무통장 입금 확인, 서비스 정산 대기, 정산 완료 처리, 취소·환불 목록 표시를 직접 검증 |
| 🟠 운영 fixture 재사용 | 기존 Billing service fixture 패턴을 재사용해 실제 관리자/고객/호스트 계정과 서비스 의뢰/예약 데이터를 안전하게 시드하고 정리하는 구조로 스모크를 구성 |
| 🟡 회귀 교차 검증 | `SERVICE_REQUESTS` 전용 스모크 추가 후 기존 `Master Ledger`, `Approvals`, `Billing`, `Analytics` 관리자 스모크와 함께 다시 확인하도록 보호 범위를 확장 |

## v3.38.26 — [Analytics] Review/Audit 섹션 역할 문구 정리

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 섹션 라벨 정리 | `Analytics` 내부 탭 라벨을 `Review Quality`, `운영 감사 로그`로 조정해 순수 분석과 운영 품질/감사 성격이 섞여 보이던 인상을 줄임 |
| 🔴 Analytics API 안전화 | 검증 중 드러난 `profiles.name` 의존을 `analytics-summary`, `analytics-host-summary`에서 제거해 fallback 뒤에 숨어 있던 500 에러를 함께 차단 |
| 🟠 리뷰 품질 설명 보강 | `ReviewsTab` 헤더에 플랫폼 후기 품질과 미응답 후기 확인용이라는 운영 문구를 추가해 탭 목적을 더 명확히 표시 |
| 🟡 감사 로그 설명 보강 | `AuditLogTab` 헤더와 안내 문구를 `운영 감사 로그` 기준으로 정리해 활동 기록이 아닌 운영 변경 이력 관점으로 읽히게 조정 |

## v3.38.25 — [Analytics] Host Ecosystem 서버 집계 분리

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 Host source 분리 | 신규 `/api/admin/analytics-host-summary`를 추가해 `Host Ecosystem` 섹션이 더 이상 브라우저 shared data 계산에만 기대지 않고 서버 집계 기준으로 `호스트 퍼널`, `슈퍼 호스트 유망주`, `집중 관리 호스트`, `응답시간/응답률`, `유입/국적/언어 통계`를 읽도록 정리 |
| 🟠 회귀 안전 fallback | `AnalyticsTab`은 새 host summary fetch 실패 시 기존 로컬 계산값을 그대로 유지해 `Business & Guest` 및 기존 Host 화면이 깨지지 않도록 보강 |
| 🟡 Host smoke 보강 | `09-admin-analytics.spec.ts`가 `analytics-host-summary` 호출과 Host Ecosystem 탭 기본 렌더를 함께 검증하도록 확장 |

## v3.38.24 — [Analytics] 전용 스모크 테스트 추가

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 Analytics 회귀 보호막 | 신규 `09-admin-analytics.spec.ts`를 추가해 `Business & Guest`의 플랫폼 전체 KPI 문구와 체험 전용 섹션 문구가 다시 섞이지 않도록 스모크 검증 |
| 🟠 범위 경계 검증 | `총 거래액(GMV)` 모달의 플랫폼 전체 설명, `취소율` 모달의 체험 예약 전용 설명, `반복 결제 고객 비율`의 플랫폼 전체 설명을 각각 UI 기준으로 확인 |

## v3.38.23 — [Analytics] 체험 전용 섹션 기준 명시

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 취소율 범위 명시 | Analytics `취소율` 카드와 상세 모달이 플랫폼 전체가 아닌 `체험 예약 기준`임을 문구로 명확히 표기 |
| 🟠 체험 전용 섹션 분리 | `실시간 인기 트렌드`, `Top 5 인기 체험`, 검색/체험 랭킹 상세 모달에 `체험 검색 로그`, `체험 예약 결제 완료 건수 기준` 문구를 추가해 플랫폼 전체 KPI와 역할이 겹치지 않도록 정리 |

## v3.38.22 — [Analytics] 결제 고객 지표 플랫폼 전체화 2차

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 반복 결제 고객 기준 확장 | `/api/admin/analytics-summary`가 `service_bookings` 고객까지 포함해 `반복 결제 고객 비율`과 `1회/2회/3회+` 분포를 체험 + 서비스 전체 결제 기준으로 계산 |
| 🟠 결제 고객 인구통계 확장 | 국적/연령/성별 분포도 이제 체험 예약과 서비스 결제를 합친 전체 결제 고객 기준으로 집계되도록 보강 |
| 🟡 운영 문구 정렬 | Analytics 카드/섹션/상세 모달에 `체험 + 서비스 결제 고객 기준`, `플랫폼 전체 결제 고객 기준` 문구를 추가해 범위를 명확히 표기 |

## v3.38.21 — [Analytics] 상단 비즈니스 KPI 플랫폼 전체화 1차

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 Business KPI 확장 | `/api/admin/analytics-summary`가 이제 체험 예약뿐 아니라 `service_bookings`의 `PAID/confirmed/completed` 결제까지 포함해 상단 `GMV`, `플랫폼 순수익`, `객단가`와 연결 모달 숫자를 플랫폼 전체 기준으로 계산 |
| 🟠 범위 제한 유지 | `Top 체험`, `검색 트렌드`, `결제 고객 인구통계`, `Host Ecosystem`, `Review Management`, `Audit Logs`는 기존 체험 중심 구조를 유지해 1차 변경 범위를 상단 비즈니스 KPI로만 제한 |
| 🟡 운영 문구 정리 | 상단 카드와 `GMV/순수익/AOV` 상세 모달에 `체험 + 서비스 결제`, `플랫폼 전체 기준`, `전체 결제 건 기준` 보조 문구를 추가해 플랫폼 전체 분석으로 읽히도록 보강 |

## v3.38.20 — [Analytics] 지표 문구 의미 정렬

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 KPI 문구 정리 | Data Analytics의 `구매 전환율`, `재구매율`, `게스트 인구통계`를 현재 계산식과 실제 모수에 맞춰 `가입 대비 결제건 비율`, `반복 결제 고객 비율`, `결제 고객 인구통계`로 정리 |
| 🟠 오해 방지 보조 문구 | KPI 카드와 상세 모달에 `신규 가입자 대비`, `결제 고객 기준`, `기간 내 결제 완료 고객 기준` 안내를 추가해 운영자가 숫자 의미를 바로 이해하도록 개선 |

## v3.38.19 — [Analytics] Business 지표 서버 집계 분리

**작업일:** 2026-03-13

| 항목 | 내용 |
|------|------|
| 🔴 Business source 분리 | 신규 `/api/admin/analytics-summary`를 추가해 Data Analytics `Business & Guest` 지표가 더 이상 `useAdminData`의 최근 20건 예약 캐시에 기대지 않고 서버 전체 집계 기준으로 계산되도록 정리 |
| 🟠 Business UI 회귀 방지 | `AnalyticsTab`은 Host/Reviews/Logs 탭 구조를 그대로 유지하면서 Business 지표만 새 API 응답으로 덮어쓰고, API 실패 시 기존 로컬 계산으로 fallback 하도록 구성 |
| 🟡 게스트 통계 복구 | 기간 내 확정 예약 고객 기준으로 국적/연령/성별 분포를 서버에서 다시 계산해 기존 비어 있던 게스트 인구통계 섹션의 정확도를 높임 |

## v3.38.18 — [Billing] 정산 카드 드릴다운 최소화

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 카드 역할 분리 | Sales 탭에서 `체험 정산 가능액` 카드만 정산 대기 섹션으로 드릴다운되도록 연결하고, 나머지 KPI 카드는 정보 카드로 유지해 Master Ledger/Analytics와 역할이 겹치지 않도록 정리 |

## v3.38.17 — [Billing] 체험 정산 가능/보류 기준 표시 반영

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 정산 가능 기준 반영 | Sales 탭이 이제 체험 정산 대기 호스트를 `정산 가능(10만원 이상)`과 `정산 보류(10만원 미만)`로 구분해 실제 송금 대상만 명확히 보이도록 조정 |
| 🟠 장기 보류 가시화 | 누적 정산액이 10만원 미만인 상태로 90일 이상 지난 호스트는 `장기 보류` badge로 별도 표시해 운영자가 오래 묶인 정산을 한눈에 파악할 수 있게 함 |
| 🟡 수동 송금 흐름 정렬 | 상단 카드와 정산 상세 버튼이 이제 `실제 수동 송금 후 정산 완료 처리` 운영 방식에 맞춰 `체험 정산 가능액` 중심으로 읽히도록 정리 |

## v3.38.16 — [Service Requests] 운영 정확도 1차 보정

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 정산 계좌정보 보강 | `/api/admin/service-bookings`가 이제 선택된 호스트의 최신 `host_applications` 계좌정보를 함께 조립해 Service Requests 정산 탭이 실제 계좌 기준으로 동작하도록 보정 |
| 🟠 환불 이력 날짜 문구 정정 | 취소·환불 내역의 `취소일` 라벨을 실제 사용 값에 맞춰 `주문일`로 바꿔 운영자가 생성시각을 취소시각으로 오해하지 않도록 정리 |
| 🟠 관리자 수정 통제 + 감사 로그 | `/api/admin/service-requests`가 이제 `pending_payment/open` 상태에서만 수정 가능하고, 제목/내용 변경 시 `admin_audit_logs`에 `ADMIN_SERVICE_REQUEST_UPDATE`를 기록 |

## v3.38.15 — [User Management] 활동 summary 지연 로딩 분리

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 users-summary 경량화 | `/api/admin/users-summary`에서 무거운 회원 활동 집계를 제거하고 `profiles + users.role` 병합만 담당하도록 되돌려 Admin 공통 초기 로딩 부담을 줄임 |
| 🟠 UsersTab 전용 summary 분리 | 신규 `/api/admin/users-activity-summary`를 추가해 `총 결제액`, `예약/의뢰 수`, `최근 활동` 칼럼은 `UsersTab`에서만 지연 로딩하도록 분리 |
| ✅ 회귀 범위 제한 | User Management 상세 패널, 타임라인, Approval/Billing/Ledger 흐름은 그대로 두고 회원 목록 summary 로딩 경로만 핀셋 수정 |

## v3.38.14 — [User Management] 회원 타임라인 2차 확장

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 문의 흐름 확장 | 회원 타임라인이 이제 문의 시작뿐 아니라 `답변 도착`, `문의 해결 완료` 이벤트까지 보여줘 운영자가 문의 진행 상황을 한눈에 볼 수 있도록 개선 |
| 🟠 맞춤 의뢰 상태 이벤트 추가 | 맞춤 의뢰 생성/결제 외에도 `의뢰 상태 변경`, `결제 상태 변경`을 `updated_at` 기반으로 안전하게 타임라인에 추가 |
| ✅ 보수적 이벤트 복원 원칙 유지 | 상태 변경 시각이 없는 체험 예약은 억지로 가짜 이벤트를 만들지 않고, 실제 시각이 확인되는 문의/서비스 이벤트만 추가 |

## v3.38.13 — [User Management] 회원 목록 운영 요약 추가

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 회원 목록 판단력 보강 | User Management 리스트에 `총 결제액`, `예약/의뢰 수`, `최근 활동` 칼럼을 추가해 운영자가 목록만 보고도 우선순위를 파악할 수 있도록 개선 |
| 🟠 users-summary 확장 | `/api/admin/users-summary`가 이제 `users.role` 병합뿐 아니라 회원별 `총 결제액`, `체험 예약 수`, `맞춤 의뢰 수`, `최근 활동 시각` 요약까지 함께 반환 |
| ✅ Analytics와 역할 분리 유지 | 집계 KPI는 계속 Analytics에 두고, UsersTab은 개별 회원 운영 판단용 summary만 노출하도록 정리 |

## v3.38.12 — [User Management] 회원 타임라인 1차 추가

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 회원 타임라인 추가 | 상세 패널이 이제 체험 예약, 리뷰 작성, 맞춤 의뢰 생성/결제, 문의 시작을 시간순으로 묶어 보여주는 `회원 타임라인`을 지원 |
| 🟠 조회 경로 안정화 | `UsersTab`이 더 이상 브라우저에서 `bookings/reviews`를 직접 읽지 않고, 신규 `/api/admin/users/[userId]/timeline` admin API를 통해 활동 이력을 안전하게 조립해서 사용 |
| ✅ Analytics와 역할 분리 | 집계형 지표는 `Data Analytics`에 그대로 두고, `User Management`는 개별 회원 운영용 활동 이력에 집중하도록 정리 |

## v3.38.11 — [User Management] 리뷰 라벨 및 삭제 UX 정리

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 리뷰 섹션 정합성 보정 | 사용자 상세 패널의 리뷰 섹션을 실제 데이터 기준에 맞춰 `받은 리뷰`가 아닌 `작성한 리뷰`로 정리 |
| 🟠 가짜 메모 UI 제거 | 저장되지 않던 `관리자 메모` textarea를 제거해 운영자가 입력 후 저장된 것으로 오해할 여지를 없앰 |
| 🟠 영구 삭제 위치 제한 | 전체 회원 리스트 우측의 영구 삭제 진입점을 제거하고, 상세 패널 하단에서만 `계정 영구 삭제`가 가능하도록 정리 |

## v3.38.10 — [User Management] 회원 검색 기준 정렬

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 이름 검색 보정 | `UsersTab` 검색이 렌더 기준인 `full_name`을 우선 보고, 레거시 `name`도 보조로 함께 검색하도록 정리 |
| 🟠 운영 검색 혼선 완화 | 운영자가 회원 목록에서 실제 보이는 이름으로 검색했는데 결과가 안 잡히던 문제를 줄임 |
| ✅ 회귀 범위 제한 | 검색 필터 로직만 핀셋 수정하고, 회원 목록 UI/상세 패널/정렬 로직은 그대로 유지 |

## v3.38.09 — [User Management] 회원 role 표시 source 정렬

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 role source 보정 | `User Management` 탭이 더 이상 `profiles`만 보고 역할을 추정하지 않고, 신규 `/api/admin/users-summary`에서 `profiles + users.role`을 병합한 회원 목록을 읽도록 변경 |
| 🟠 운영 혼선 완화 | 호스트 승인 후에도 `USER`처럼 보이거나, 관리자 계정이 일반 회원처럼 보일 수 있던 역할 표시 불일치를 줄임 |
| ✅ 회귀 범위 제한 | `UsersTab` UI 구조와 상세 패널 로직은 유지하고, 사용자 목록 read path만 admin API 경유로 안전하게 교체 |

## v3.38.08 — [Admin Alerts] whitelist 수신자 매핑 누락 보강

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 수신자 매핑 보강 | `adminAlertCenter`가 이제 `admin_whitelist` 이메일을 기준으로 수신자를 유지하고, 인앱 `user_id`는 `users.email` 우선·`profiles.email` 보조로 해석하도록 보강 |
| 🟠 이메일 누락 방지 | `sendAdminAlertEmails()`가 더 이상 `profiles` 매핑 실패 때문에 whitelist 관리자 메일까지 함께 누락시키지 않도록 정리 |
| 🟡 관측성 추가 | whitelist에 있지만 인앱 `user_id`를 찾지 못한 이메일은 warn 로그로 남겨 운영자가 조용한 누락을 추적할 수 있게 보강 |

## v3.37.99 — [Master Ledger] E2E 행 선택 안정화

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 스모크 실패 원인 정리 | `Master Ledger` 스모크 실패가 제품 로직이 아니라 행 선택 셀렉터 드리프트임을 확인 |
| 🟡 테스트 클릭 경로 보강 | `tests/e2e/06-admin-master-ledger.spec.ts`에서 첫 번째 셀 클릭 대신 행 자체 클릭으로 바꾸고, 상세 패널 미오픈 시 1회 재시도하도록 안정화 |
| ✅ 회귀 재검증 완료 | `06-admin-master-ledger.spec.ts`, `07-admin-approvals.spec.ts`, `tsc`, `git diff --check`를 모두 다시 통과 |

## v3.38.00 — [Billing] SalesTab 전용 데이터 소스 분리 1차

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 체험 매출 source 분리 | `SalesTab`이 더 이상 `useAdminData`의 최근 20건 `bookings`에 기대지 않고, 신규 `/api/admin/sales-summary` 전용 API에서 전체 정산 대상 체험 예약을 읽도록 분리 |
| 🔴 호스트 정산 정보 보강 | 전용 API가 `host_applications`의 최신 계좌/예금주/국적을 함께 조립해 정산 리스트가 summary `apps` 누락 컬럼에 의존하지 않도록 정리 |
| 🟠 AP 의미 정리 | 상단 `정산 예정금` 카드를 `체험 정산 예정금`으로 명확히 바꾸고, 서비스 정산은 별도 탭 관리라는 문구로 혼선을 줄임 |
| 🟠 기간 기준 정렬 | 하단 체험 정산 리스트도 상단 KPI와 같은 `created_at` 날짜 필터 기준을 쓰도록 맞춤 |
| 🟡 운영 혼선 제거 | 실제 동작이 없던 헤더 `지급 실행` 버튼을 `일괄 지급 준비중` 비활성 상태로 낮춰 오동작 기대를 제거 |

## v3.38.01 — [Billing] 서비스 정산 KPI 상태 기준 보정

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 서비스 지급 상태 반영 | `SalesTab`의 서비스 KPI 조회에 `payout_status`를 포함해 서비스 미지급 정산액만 별도 판단할 수 있도록 보정 |
| 🟠 카드 보조 문구 정리 | `체험 정산 예정금` 카드 하단 문구가 이제 서비스 전체 지급액이 아니라 `서비스 미지급 정산` 금액 또는 `정산 대기 없음`을 말하도록 조정 |
| 🟡 KPI 로딩 오류 가시화 | 브라우저에서 `service_bookings` KPI 조회가 실패할 때 조용히 0처럼 보이지 않도록 토스트 오류를 추가 |

## v3.38.02 — [Billing] 서비스 CSV 기준 정렬

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 기간 기준 서버 정렬 | `맞춤 의뢰 명세서` 다운로드가 현재 선택된 `startDate/endDate`를 서버 route로 넘겨 화면과 같은 기간 기준으로 CSV를 생성하도록 정리 |
| 🟠 정산상태 컬럼 추가 | 서비스 CSV에 `정산상태` 컬럼을 추가해 운영자가 `정산대기/정산완료/미선택`을 파일만 보고도 바로 구분할 수 있도록 보강 |
| 🟡 route 응답 보강 | `/api/admin/service-bookings-csv`가 `payout_status`를 함께 반환해 Billing 화면과 내보내기 파일이 같은 지급 상태 기준을 쓰도록 맞춤 |

## v3.38.03 — [Billing] 전용 E2E 스모크 추가

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 Billing 전용 보호막 추가 | `tests/e2e/08-admin-billing.spec.ts`를 추가해 `Billing & Revenue` 탭만 검증하는 독립 Playwright 스모크를 마련 |
| 🟠 서비스 CSV 기간 기준 검증 | 테스트가 최근/과거 `service_booking` 2건을 직접 준비한 뒤 `30D`와 `ALL`에서 서비스 CSV route 응답이 현재 활성 기간과 일치하는지 검증 |
| 🟡 운영 핵심 UI 확인 | KPI 카드 렌더, `맞춤 의뢰 명세서` 버튼, `일괄 지급 준비중` 비활성 상태까지 함께 확인해 Billing 탭 회귀를 조기에 감지 |
| 🟡 CSV route 안정화 | `/api/admin/service-bookings-csv`가 복합 join 대신 raw `service_bookings` 조회 후 `service_requests`, `profiles`, `host_applications`를 따로 조립하도록 바꿔 기간 필터 + 응답 안정성을 높임 |

## v3.38.04 — [Billing] 서비스 KPI 관리자 API 정렬

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 브라우저 직접 조회 제거 | `SalesTab`의 서비스 KPI가 더 이상 브라우저 Supabase client로 `service_bookings`를 직접 읽지 않고 `/api/admin/service-bookings`를 재사용하도록 변경 |
| 🟠 RLS 영향 축소 | 관리자 KPI가 브라우저 RLS 상태에 따라 0처럼 보이거나 토스트만 띄우고 비는 위험을 줄이고, 이미 검증된 admin API 권한 경로로 정렬 |
| ✅ UI 의미 유지 | KPI 계산식과 `서비스 미지급 정산` 문구는 유지하고, 데이터 source만 안전한 관리자 read 경로로 교체 |

## v3.38.05 — [Billing] 상단 카드 데이터 소스 단일화

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 단일 응답 정렬 | `/api/admin/sales-summary`가 이제 체험 정산 행과 함께 서비스 KPI 요약행도 같이 내려주도록 확장 |
| 🟠 SalesTab 단순화 | `SalesTab`이 상단 카드 계산을 위해 별도 `/api/admin/service-bookings` fetch를 하지 않고 `sales-summary` 한 응답만 사용하도록 정리 |
| ✅ 회귀 범위 제한 | 정산 리스트/서비스 CSV/지급 액션은 그대로 두고, 상단 Billing KPI source만 한 군데로 맞춤 |

## v3.38.06 — [Service Admin] 정산 완료 처리 admin API화

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 클라이언트 직접 update 제거 | `ServiceAdminTab`이 더 이상 브라우저 Supabase client로 `service_bookings.payout_status`를 직접 수정하지 않고 admin API를 호출하도록 변경 |
| 🟠 권한·감사 로그 일관화 | `/api/admin/service-payouts/mark-paid`를 추가해 관리자 권한 확인, 대상 상태 검증, `admin_audit_logs` 기록을 서버에서 처리 |
| ✅ 회귀 범위 제한 | 서비스 정산 대기 탭의 목록/CSV/UI는 유지하고, `이체 완료 처리` 버튼의 실행 경로만 안전한 서버 경로로 교체 |

## v3.38.07 — [Billing] sales-summary 서버 날짜 필터 선적용

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 서버 선필터 적용 | `/api/admin/sales-summary`가 `startAt`/`endAt` query를 받아 `bookings.created_at`, `service_bookings.created_at` 범위를 서버에서 먼저 줄이도록 변경 |
| 🟠 SalesTab 요청 정렬 | `SalesTab`이 현재 선택한 기간을 `sales-summary` 요청에 그대로 넘겨 전체 집계 후 클라이언트 재필터링하던 구조를 완화 |
| ✅ 회귀 범위 제한 | KPI 의미·정산 리스트·서비스 CSV는 유지하고, Billing 집계 read 경로의 성능 부담만 낮춤 |

## v3.37.98 — [Admin Auth] helper 미적용 예외 경로 정리

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 예외 경로 helper 정렬 | `service-bookings-csv`, `/api/notifications/email` 다중발송, 레거시 `/api/bookings/confirm-payment`, `/api/payment/cancel`, `/api/admin/notify-team`, `GlobalTeamChat`의 관리자 체크를 `resolveAdminAccess()`로 통일 |
| 🟡 RLS 의존 축소 | 일반 서버 클라이언트로 `users/admin_whitelist`를 직접 읽던 경로를 service-role helper 기반으로 정리해 권한 판정 드리프트 가능성을 축소 |
| 🟡 CSV route 타입 정리 | `service-bookings-csv`의 `any` 기반 행 타입을 최소 타입으로 치환해 lint 검증 안정성을 보강 |
| ✅ 기존 동작 유지 | 판매 CSV 다운로드, 관리자 다중 알림, 레거시 무통장 확정 로직의 실제 기능은 유지하고 권한 판정 방식만 정리 |

## v3.37.97 — [Admin Auth] profiles.role 의존 제거 핫픽스

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 관리자 권한 source 긴급 복귀 | live DB에 없는 `profiles.role` 의존을 제거하고, 관리자 판정을 다시 `users.role + admin_whitelist` 기준으로 복귀 |
| 🔴 잘못된 role 쓰기 제거 | 호스트 승인과 whitelist 자동 admin 승급 시 `profiles.role`을 함께 쓰던 로직을 제거하고 `users.role`만 갱신하도록 정리 |
| 🟡 admin/ledger/approval 경로 일괄 정렬 | 승인 액션, 관리자 레이아웃, Master Ledger, 서비스 예약 admin API, 문의/호스트 편집 admin 체크까지 같은 helper를 사용하도록 통일 |
| 🟡 문서 기준 바로잡기 | `gemini.md`의 관리자 권한 기준을 `profiles.role`에서 `users.role + admin_whitelist`로 수정해 재발을 방지 |
| ✅ notify-team 원칙 유지 | `/api/admin/notify-team`의 수신자 수집은 기존대로 `admin_whitelist` 단일 소스를 유지하고, 이번 수정은 권한 판정 source만 바로잡음 |

## v3.37.96 — [Admin Approvals] 전용 E2E 스모크 추가

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 승인 관리 전용 spec 추가 | `tests/e2e/07-admin-approvals.spec.ts`를 추가해 승인 관리만 검증하는 독립 Playwright 스모크를 마련 |
| 🟡 검증 범위 최소화 | 테스트가 fresh admin/지원자 계정과 pending 호스트 지원서/체험을 직접 준비한 뒤, 관리자 화면에서 `보완 요청`과 체험 `승인`을 실제 UI로 검증 |
| 🟡 상세 패널 close 회귀 보호 | 액션 성공 후 상세 패널이 닫히는 최근 보정 흐름을 함께 확인해 승인 관리 stale 회귀를 막음 |
| ✅ 운영 영향 최소화 | 기존 큰 통합 시나리오를 재사용하지 않고, 짧은 승인 관리 전용 흐름만 별도 실행하도록 분리 |

## v3.37.95 — [Master Ledger] 서비스 예약 신규 생성 실시간 반영

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 service booking INSERT 구독 추가 | `MasterLedgerTab`이 `service_bookings`의 신규 생성 이벤트도 realtime으로 구독해 Ledger를 열어둔 상태에서 새 서비스 예약이 들어오면 자동 재조회되도록 보강 |
| ✅ 기존 Ledger 흐름 유지 | 일반 예약 INSERT/UPDATE, 서비스 예약 UPDATE, 장부 API, KPI/CSV 계산 로직은 건드리지 않고 realtime 트리거만 최소 추가 |

## v3.37.94 — [Admin Approvals] 상세 패널 stale 보정

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 승인 관리 stale 보정 | 호스트 지원서/체험 상세에서 승인, 거절, 보완요청, 삭제 성공 후 상세 패널을 닫아 이전 상태가 패널에 남아 보이는 문제를 제거 |
| 🟡 성공 여부 기반 닫기 | `useAdminData.updateStatus`, `deleteItem`이 성공 여부를 반환하도록 보강하고, 취소/실패 시에는 상세 패널을 유지해 오작동처럼 보이지 않도록 정리 |
| ✅ 기존 승인 플로우 유지 | 승인 관리 UI 구조와 상태 변경 로직은 유지하고, 액션 성공 직후의 선택 상태 처리만 핀셋 보정 |

## v3.37.93 — [Admin Auth] 관리자 권한 source 통일

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 승인 액션 권한 기준 정렬 | `app/actions/admin.ts`의 관리자 판정을 `users.role`이 아니라 `profiles.role + admin_whitelist` 기준으로 맞춰 최근 관리자 API들과 같은 source를 보도록 통일 |
| 🟡 관리자 레이아웃 권한 체크 정렬 | `/admin` 레이아웃도 같은 기준으로 확인하도록 조정해 대시보드 접근과 승인 액션 간 권한 판정 불일치 가능성을 축소 |
| 🟡 whitelist 자동 승급 동기화 | whitelist 기반 자동 admin 승급 시 `users.role`과 `profiles.role`을 함께 `admin`으로 맞춰 레거시 경로 호환성을 유지 |
| ✅ 삭제 API 기준 일치 | `/api/admin/delete`도 같은 관리자 판정 source를 사용하도록 정리해 admin 계정별 접근 불일치 가능성을 줄임 |

## v3.37.92 — [Admin Approvals] 역할 동기화 및 지원서 조회 범위 축소

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 호스트 승인 role 동기화 | 호스트 지원서 승인 시 `users.role`뿐 아니라 `profiles.role`도 함께 `host`로 맞춰 관리자 화면과 역할 표기가 엇갈리지 않도록 보강 |
| 🟡 승인 필터 라벨 정리 | 승인 관리에서 같은 `APPROVED` 버튼이 탭마다 다른 뜻으로 보이던 문제를 줄이기 위해 호스트 지원서는 `처리완료`, 체험 등록은 `승인완료` 라벨로 구분 |
| 🟡 지원서 목록/상세 분리 | `/api/admin/host-applications` 기본 조회는 요약 컬럼만 반환하고, 상세 패널 진입 시에만 민감 컬럼과 신분증 signed URL을 별도 조회하도록 분리 |
| ✅ UI 구조 유지 | 승인/거절/보완요청 플로우와 승인 관리 화면 구조는 유지하고, 데이터 정합성과 민감정보 노출 범위만 핀셋 조정 |

## v3.37.91 — [Master Ledger] 전용 E2E 스모크 추가

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 전용 Ledger 시나리오 추가 | `tests/e2e/06-admin-master-ledger.spec.ts`를 추가해 Master Ledger 전용 스모크를 독립 spec으로 분리 |
| 🟡 실제 운영 흐름 기준 검증 | 테스트가 fresh 게스트/관리자 계정과 미래 슬롯을 준비한 뒤 무통장 예약 생성 → Ledger 검색 → 날짜 필터 → 입금 확인 → 강제 취소까지 순차 검증 |
| 🟡 회귀성 높은 포인트 보호 | 날짜 필터, 관리자 액션 API 응답, 상태 변경, Base Price 안전값(`0 <= price <= sales`)을 한 spec 안에서 확인해 최근 Ledger 보강 사항 회귀를 방지 |
| ✅ 기존 대시보드 구조 유지 | `useAdminData`, Ledger UI, 관리자 액션 구현은 건드리지 않고 테스트 보호막만 추가 |

## v3.37.90 — [Master Ledger] 레거시 Base Price fallback 보정

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 Base Price 과장 표시 방지 | `bookingFinance.getBookingBasePrice()`가 더 이상 `amount`를 직접 base price로 간주하지 않고, `price_at_booking`, `total_experience_price`, `total_price`가 있을 때만 base price를 계산하도록 보정 |
| 🟡 레거시 화면 안전값 유지 | 과거 데이터에서 base price 근거가 없으면 Ledger 표/CSV는 기존 null 처리 규칙에 따라 `-` 또는 빈값으로 보여 과장된 숫자 노출을 방지 |
| ✅ 신규 저장 흐름 유지 | 카드 콜백/무통장 확정 시 정산 스냅샷 저장 로직은 유지하고, read-time fallback 규칙만 핀셋 조정 |

## v3.37.89 — [Master Ledger] 기간 필터 서버 선적용

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 날짜 범위 querystring 연동 | `MasterLedgerTab`이 선택된 시작일/종료일을 `/api/admin/master-ledger`로 전달해 서버가 기간 범위를 먼저 인지하도록 조정 |
| 🟡 일반 예약 서버 필터 추가 | `bookings.date` 기준 `startDate/endDate` 조건을 서버 쿼리에 반영해 기간 선택 시 불필요한 일반 예약 전체 조회를 줄임 |
| 🟡 서비스 의뢰 서버 필터 추가 | `service_requests.service_date`를 먼저 필터링한 뒤 해당 `request_id`에 연결된 `service_bookings`만 읽도록 보강 |
| ✅ UI/CSV/KPI 구조 유지 | 목록, 필터 UI, 상세 패널, KPI, CSV 구조는 유지하고 서버 읽기 범위만 핀셋 최적화 |

## v3.37.88 — [Admin Cancel] 게스트 취소 알림/메일 보강

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 게스트 인앱 알림 추가 | 관리자 강제 취소 시 호스트뿐 아니라 게스트에게도 `/guest/trips` 링크가 포함된 취소 인앱 알림을 적재하도록 보강 |
| 🟡 게스트 즉시 메일 추가 | 관리자 강제 취소 완료 시 게스트에게도 즉시 취소 안내 메일을 발송하도록 추가 |
| ✅ 기존 취소 흐름 유지 | PG 취소, DB 상태 변경, 호스트 통지, 관리자 알림센터 흐름은 유지하고 force-cancel route 안에서만 핀셋 수정 |

## v3.37.87 — [Master Ledger] UPDATE 실시간 반영 보강

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 UPDATE realtime 재조회 추가 | `MasterLedgerTab`이 `bookings`, `service_bookings`의 `UPDATE` realtime 이벤트를 직접 구독하고 `/api/admin/master-ledger`를 재조회하도록 보강 |
| 🟡 admin 구조 원칙 유지 | `gemini.md` 기준에 맞춰 `useAdminData.ts`는 건드리지 않고, Ledger 컴포넌트 내부에만 핀셋 적용 |
| ✅ 기존 INSERT 흐름 보존 | 기존 `refreshSignal` 기반 일반 예약 신규 유입 반영 로직은 그대로 유지하고, 상태 변경 stale 문제만 추가 보완 |

## v3.37.86 — [Master Ledger] 실시간 반영 회귀 보정

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 LEDGER 재조회 트리거 추가 | 관리자 대시보드 부모의 일반 예약 realtime 흐름은 유지한 채, `MasterLedgerTab`에 `refreshSignal`을 전달해 새 일반 예약 유입 시 장부 목록도 자동 재조회되도록 보정 |
| 🟡 탭 구조 보존 | `useAdminData`와 대시보드 탭 분기, 새 예약 토스트/구독 구조는 그대로 유지하고 `LEDGER` 목록 stale 현상만 핀셋 수정 |
| ✅ 회귀 범위 최소화 | `/api/admin/master-ledger`와 관리자 액션 API는 건드리지 않고 `page.tsx`와 `MasterLedgerTab.tsx` 두 파일만 수정 |

## v3.37.85 — [Master Ledger] 데이터 원천 및 관리자 액션 정합성 보강

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 Ledger 전용 통합 API 추가 | `GET /api/admin/master-ledger`를 추가해 일반 예약 전체와 서비스 의뢰 전체를 서버에서 통합 조립하도록 전환 |
| 🔴 관리자 전용 일반 예약 액션 분리 | 일반 예약 `입금 확인`과 `강제 취소`를 각각 `/api/admin/bookings/confirm-payment`, `/api/admin/bookings/force-cancel`로 분리해 기존 게스트/호스트 취소 경로와 분리 |
| 🟡 무통장 입금 확인 노출 정리 | `MasterLedgerTab`에서 일반 예약 `PENDING` 전체가 아니라 `payment_method='bank'`인 예약에만 `입금 확인` 버튼을 노출하도록 보정 |
| 🟡 장부 계산/CSV 정렬 | `bookingFinance`에 base price / settlement snapshot helper를 추가하고, `MasterLedger` 표·상세·CSV가 같은 계산값을 쓰도록 통일 |
| 🟡 solo guarantee 금액 스냅샷 정렬 | 일반 카드 결제 콜백이 `price_at_booking`을 더 이상 현재 체험가 재계산이 아니라 저장된 `total_price`와 `solo_guarantee_price` 기준으로 확정하도록 보정 |
| ✅ 회귀 방지 경계 유지 | `useAdminData`와 관리자 대시보드 탭 구조, 일반 예약 realtime/토스트 흐름은 유지하고 `MasterLedger` 내부 데이터/액션만 핀셋 수정 |

## v3.37.84 — [Admin Sidebar] 상단 홈 버튼 스타일 정리

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 브랜드 홈 버튼 링크화 | 관리자 좌측 최상단 `Locally / Admin console` 홈 버튼을 일반 `button` 스타일에서 홈 헤더 좌측 로고와 유사한 자연스러운 링크형 버튼으로 정리 |
| 🟡 포커스/배경 강조 제거 | 상단 버튼의 붉은 포커스 외곽선과 배경 하이라이트를 제거하고, 로고 확대만 남겨 기존 홈 로고 클릭감과 비슷하게 맞춤 |

## v3.37.83 — [Admin Sidebar] 상단 브랜드 홈 동작 정정

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 상단 홈 목적지 정정 | 관리자 좌측 최상단 `Locally / Admin console` 버튼이 `APPROVALS` 탭이 아니라 기존 `Home` 버튼과 동일하게 로컬리 메인 `/`으로 이동하도록 수정 |
| ✅ 탭 정렬 유지 | `Service Requests`의 `Finance` 섹션 이동과 기존 `Home` 탭 제거는 그대로 유지 |

## v3.37.82 — [Admin Sidebar] Finance 정렬 및 홈 버튼 구조 변경

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 Service Requests 재배치 | 관리자 좌측 사이드바에서 `Service Requests`를 `Management` 섹션에서 제거하고 `Finance` 섹션의 `Master Ledger` 바로 아래로 이동 |
| 🟡 Home 버튼 제거 | `Finance` 섹션 하단의 별도 `Home` 탭 버튼을 제거해 중복 진입 경로를 정리 |
| 🟡 상단 브랜드 홈화 | 최상단 `Locally / Admin console` 브랜드 블록 전체를 `APPROVALS`로 이동하는 홈 버튼으로 변경해 사이드바 상단을 홈 진입점으로 통일 |

## v3.37.81 — [Desktop Host Transition] 전환 멘트 및 지연시간 복구

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 데스크탑 전환 지연시간 정렬 | 데스크탑 모드 전환 라우팅 타이머를 `900ms`로 조정해 모바일 전환과 동일한 체감 지연으로 복구 |
| 🟡 서브 멘트 복구 | 데스크탑 전환 오버레이에 모드별 보조 문구를 다시 추가해 전환 중 안내 감각을 복원 |
| ✅ 기존 시각 보정 유지 | 직전 적용한 데스크탑 일러스트 확대, 배경 톤 정렬, 진입 애니메이션 보강은 유지 |

## v3.37.80 — [Desktop Host Transition] 전환 오버레이 크기 및 배경 정렬

**작업일:** 2026-03-12

| 항목 | 내용 |
|------|------|
| 🔴 데스크탑 전환 존재감 보강 | 데스크탑 `호스트 모드로 전환` 오버레이의 일러스트 크기를 `clamp()` 기반으로 확대하고, 진입 애니메이션을 추가해 모바일 대비 작고 밋밋하던 인상을 보정 |
| 🟡 배경-카드 분리감 완화 | 데스크탑 오버레이의 반투명 블러 배경을 제거하고 모드별 단색 배경으로 맞춰, 호스트 전환 시 이미지 매트와 화면 배경이 따로 놀던 현상을 완화 |
| ✅ 모바일 경로 유지 | 모바일 `HostModeTransition`과 라우팅 흐름은 변경하지 않고, 데스크탑 전환 컴포넌트만 핀셋 수정 |

## v3.37.79 — [Payment UX] 수수료 안내 팝오버 및 결제 문구 정리

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 수수료 안내 보강 | 체험 결제 페이지 `서비스 수수료 (10%)` 옆 `i` 아이콘에 팝오버를 추가하고, `서비스 수수료는 결제 처리, 고객 지원, 플랫폼 운영에 사용됩니다.` 문구를 노출 |
| 🟡 공유 예약 안내 문구 제거 | 결제 페이지와 예약 카드에 남아 있던 `일반 예약은 이후 다른 게스트가 함께 예약할 수 있어요.` 문구를 제거해 결제 단계 노이즈를 축소 |
| 🟡 안전 동의 문구 정리 | 결제 하단 정책 문구를 `호스트와의 직접 연락 및 플랫폼 외부 결제는 금지되며, 적발 시 계정 영구 정지 처분에 동의합니다.` 로 정리 |

## v3.37.78 — [Host Schedule] 일정 저장 브라우저 confirm 제거

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 커스텀 확인 모달 적용 | 호스트 체험 일정 수정 페이지에서 `일정을 저장하시겠습니까?` 브라우저 기본 confirm을 제거하고 Locally 스타일 모달로 교체 |
| ✅ 저장 동작 유지 | 실제 일정 저장 API/로직은 유지하고, 저장 전 확인 UX만 앱 스타일에 맞게 통일 |

## v3.37.77 — [Host UX] 상태 동기화, 프로필 분리, 메뉴 정렬

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 호스트 지원 상태 즉시 반영 | 호스트 지원서 제출 직후 `AuthContext`와 랜딩 CTA가 최신 신청 상태를 다시 읽어, 새로고침 없이 `신청현황`/`호스트 모드 전환` 상태가 반영되도록 보강 |
| 🟡 호스트 자기소개 분리 | 호스트 등록/대시보드 편집에서 `self_intro`는 `host_applications`에 유지하고, 게스트 계정 `bio`와 분리되도록 조정. `languages`는 계속 공유 |
| 🟡 호스트 메뉴 정렬 | 호스트 모드 데스크탑/모바일 메뉴를 호스트 중심으로 정렬하고, `커뮤니티`는 공통 접근 항목으로 유지 |

## v3.37.76 — [Host Reservations] 데스크탑 후기 버튼 상시 노출

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 데스크탑 후기 CTA 유지 | 호스트 예약 현황 데스크탑 카드에서 `게스트 후기` 버튼이 날짜 전에는 사라지던 조건을 제거하고, 취소 예약을 제외하면 항상 보이도록 조정 |
| 🟡 투어 전 클릭 가드 | 아직 투어 진행 전 예약에서 데스크탑 `게스트 후기` 버튼을 누르면 모달 대신 `아직 투어 진행 전입니다.` 토스트만 띄우도록 가드 추가 |
| ✅ 모바일 유지 | 모바일 카드의 후기 버튼 노출 조건과 배치는 기존 동작을 유지 |

## v3.37.75 — [Admin Ledger Mobile] 모바일 밀도 조정, 확인 모달 교체, 상세 패널 보정

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 모바일 액션 모달 교체 | `MasterLedgerTab`의 모바일 `입금 확인`/`강제 취소`를 브라우저 기본 `confirm()` 대신 앱 스타일의 확인 모달로 교체 |
| 🔴 모바일 상세 패널 보정 | 모바일 상세 패널에서 `selectedBooking.id.slice(...)`로 인한 빈 화면 가능성을 제거하고, 모바일 전용 시트 형태로 가독성을 보강 |
| 🟡 모바일 표 밀도 조정 | 데스크탑 테이블 구조는 유지하고, 모바일에서만 글자/패딩/간격/최소 폭을 줄이고 `예약 타입` 컬럼을 숨겨 한 화면 가독성을 개선 |
| 🟡 모바일 라벨 축약 | 모바일에서 `입금대기 → 입금`, `확정됨 → 확정`, `취소됨 → 취소`로 축약하고, 액션 버튼 문구도 더 짧게 정리 |

## v3.37.74 — [Admin Alerts / Translation Meta] 재제출 복구 및 manual locale 상태 보정

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 체험 재제출 복구 | `revision`/`rejected` 상태의 체험을 호스트가 다시 저장하면 자동으로 `pending`으로 복귀하고, 관리자 알림센터에 재제출 알림이 쌓이도록 보강 |
| 🟡 호스트 신청 alert 누락 완화 | 호스트 신청 제출 후 관리자 alert 요청을 fire-and-forget으로 날리던 경로를 제거하고, 응답을 기다린 뒤 이동하도록 조정해 누락 가능성을 축소 |
| 🟡 manual locale 상태값 보정 | manual locale이라도 본문 번역이 queue에 들어간 경우 `translation_meta`를 즉시 `ready`가 아니라 `queued/failed`로 정확히 반영하도록 수정 |

## v3.37.73 — [Admin Alerts] 일반 예약/신청 이벤트 적재 확대

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 일반 예약 운영 알림 추가 | 일반 체험 예약 생성, 카드결제 완료, 무통장 입금 확인 완료, 예약 취소/환불이 관리자 알림센터에도 적재되도록 확장 |
| 🟡 신청 이벤트 확대 | 호스트 신청 제출, 체험 신규 제출, 맞춤 의뢰 생성이 관리자 알림센터 스택에 누적되도록 연결 |
| 🟡 구현 경계 유지 | 기존 메일/인앱 사용자 알림 로직은 건드리지 않고, 각 owner route에서 `insertAdminAlerts`만 추가하는 핀셋 방식으로 적용 |

## v3.37.72 — [Bookings] 취소 정산 공식 및 관리자 금액 표기 정렬

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 취소 정산 공식 정렬 | 체험 예약 취소 시 `결제금액 전체 80:20`이 아니라 `잔여 투어금액 기준 호스트 80% + 잔여 게스트 수수료 포함 플랫폼 수익` 공식으로 정렬 |
| 🟡 정산 fallback 보정 | 관리자/호스트 화면의 fallback 계산을 `amount * 0.8` 단순식에서 `total_experience_price/total_price` 우선 공식으로 정정 |
| 🟡 금액 라벨 보정 | 관리자 상세/실시간/유저 구매내역에서 실제 결제액은 `amount` 기준으로 표기하도록 수정 |

## v3.37.71 — [Bookings] 1인 출발 확정 옵션 금액 결제 연동

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 solo 옵션 금액 연동 | 체험 상세 예약 카드에서 선택한 `1인 출발 확정` 옵션이 결제 페이지 query, `/api/bookings`, `create_booking_atomic`까지 연결되어 실제 결제 금액과 저장 금액에 반영되도록 수정 |
| 🟡 결제 확정 금액 기준 정리 | 카드 결제 콜백과 무통장 입금 확인이 더 이상 `experience.price * guests`로 재계산하지 않고, 예약 시 저장된 `bookings.total_price`를 기준으로 정산 데이터를 확정하도록 보강 |
| 🟡 예약 안내 문구 보강 | 기존 자동 환불 문구는 유지하되, 일반 예약에 다른 게스트가 함께 예약될 수 있다는 안내 문구를 1인 옵션 노출 구간에 추가 |
| ✅ 검증 | `npx tsc --noEmit`, 대상 파일 `eslint`, `git diff --check` 예정 |

## v3.37.70 — [Notification Security] 단일 수신자 알림 권한 검증 추가

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 단일 발송 보안 강화 | `/api/notifications/email`의 단일 `recipient_id` 경로가 더 이상 로그인 사용자 누구에게나 열려 있지 않도록, `new_booking`/`booking_cancel_request` self 알림, `review_reply`, `cancellation_approved`만 타입별 소유권 검증 후 허용 |
| 🟡 호출 컨텍스트 전달 | 후기 답글/취소 승인 알림이 서버 검증에 필요한 `review_id`, `booking_id`를 함께 전달하도록 `sendNotification()` 호출부를 보강 |
| ✅ 검증 | `npx tsc --noEmit`, 대상 파일 `eslint`, `git diff --check` 통과 |

## v3.37.69 — [Admin Alerts] 전용 상단 카드 롤백 및 문의 중복 적재 제거

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 사이드바 진입점 롤백 | 관리자 알림센터를 좌측 상단 전용 카드형 진입점에서 제거하고, 기존처럼 사이드바 `Operation` 섹션의 일반 탭 버튼으로 복귀 |
| 🟡 문의 스택 제거 | 게스트↔호스트 문의 메시지는 `Message Monitoring` 탭에서 이미 확인 가능하므로, 관리자 알림센터(`admin_alert`) 중복 적재를 제거 |
| ✅ 검증 | `npx tsc --noEmit`, 대상 파일 `eslint`, `git diff --check` 예정 |

## v3.37.68 — [Admin Alerts] 서비스 결제/문의 모니터링 확대

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 서비스 결제 운영 알림 추가 | 카드 결제 콜백과 관리자 무통장 입금 확인 완료 시 `SERVICE_REQUESTS`로 연결되는 관리자 알림센터 스택을 함께 적재 |
| 🟡 선택/미선택 처리 요약 | 서비스 호스트 선택 알림이 선택 완료뿐 아니라 함께 처리된 미선택 건수까지 관리자 알림 메시지에 포함하도록 보강 |
| 🟡 문의 관리자 스택 적재 | 게스트/호스트가 보낸 새 문의 메시지를 기존 즉시 메일과 별도로 관리자 알림센터에도 누적되도록 연결하되, 관리자 본인 발신 메시지는 중복 적재하지 않도록 제한 |
| ✅ 검증 | `npx tsc --noEmit`, 대상 파일 `eslint`, `git diff --check` 예정 |

## v3.37.67 — [Admin Alerts] 관리자 운영 알림센터 추가

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 관리자 인앱 스택 추가 | 기존 `notifications` 테이블을 재사용해 Admin Dashboard에 `ALERTS` 탭을 추가하고, 운영 알림을 메일과 별도로 누적 확인할 수 있게 정리 |
| 🟡 팀 알림 인앱 적재 | `/api/admin/notify-team`이 `admin_whitelist` 기반 수신자에게 팀 이벤트를 `type='admin_alert'` 인앱 알림으로도 함께 저장하도록 확장 |
| 🟡 사이드바 unread 배지 | 관리자 사이드바 `Admin Alerts` 메뉴에 unread 배지를 추가하고, `notifications` realtime 변경을 받아 카운트를 갱신하도록 연결 |
| 🟡 상단 전용 진입점 | 관리자 사이드바 로고 아래 최상단에 `Admin Alerts` 전용 카드형 진입점을 추가해 일반 메뉴와 분리 |
| 🟡 운영 이벤트 적재 확대 | 새 후기 등록, 서비스 새 지원자, 서비스 호스트 선택, 서비스 취소 요청/취소 완료가 관리자 알림센터에도 누적되도록 연결 |
| 🟡 즉시 메일 보강 | 새 후기 등록, 서비스 새 지원자, 서비스 호스트 선택, 서비스 취소 요청/취소 완료에 대한 즉시 메일을 해당 수신자/관리자에게 추가 |
| ✅ 검증 | `npx tsc --noEmit`, 대상 파일 `eslint`, `git diff --check` 예정 |

## v3.37.66 — [Team Email] 메모 전용 즉시 메일 + 팀채팅 첫 unread 배치 1회

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 팀 메일 범위 축소 | `/api/admin/notify-team`이 더 이상 팀스페이스 전체 이벤트에 메일을 보내지 않고, `team_memo`, `team_memo_comment`, `team_chat`만 메일 대상으로 제한 |
| 🟡 팀채팅 1회 메일 | `team_chat`은 `admin_task_comments.read_by`를 기준으로 수신자별 unread 수를 계산해, 읽지 않은 배치가 새로 시작될 때 첫 메일 1회만 발송하도록 조정 |
| 🟡 TODO 메일 제거 | `team_todo`, `team_task_comment`는 인앱/실시간만 유지하고 이메일은 더 이상 보내지 않도록 정리 |
| ✅ 검증 | `npx tsc --noEmit`, 대상 파일 `eslint`, `git diff --check` 예정 |

## v3.37.65 — [Email Notifications] queue cron 롤백 및 즉시 메일 복귀

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 email queue 롤백 | `email_notification_jobs` 기반 queue 처리와 `/api/cron/email-notifications`, `.github/workflows/email-notification-queue.yml`를 제거해 GitHub Actions 10분 스케줄 의존을 해제 |
| 🟡 팀 알림 즉시 메일 복귀 | `/api/admin/notify-team`을 digest 큐 적재 방식에서 즉시 메일 발송 방식으로 복귀하되, 수신자 수집은 기존 원칙대로 `admin_whitelist` 단일 소스를 유지 |
| 🟡 문의 메일 즉시 발송 복귀 | 게스트↔호스트 문의 메시지 알림을 `미읽음 10분 후 1회` 큐 방식에서 메시지당 즉시 메일 방식으로 복귀 |
| 🟢 즉시 메일 보강 유지 | 호스트 신청 승인/보완/거절, 일반 예약 무통장 입금 확인 완료 시 추가한 즉시 메일 발송 로직은 유지 |
| ✅ 검증 | `npx tsc --noEmit`, 대상 파일 `eslint`, `git diff --check` 예정 |

## v3.37.64 — [Email Notifications] 팀 digest / 문의 지연 메일 / 즉시 메일 보강

**작업일:** 2026-03-11

| 항목 | 내용 |
|------|------|
| 🔴 팀 알림 digest 전환 | `/api/admin/notify-team`이 더 이상 즉시 메일을 보내지 않고 `email_notification_jobs` 큐에 적재하도록 변경. 팀 댓글/메모/채팅은 10분 단위 digest 메일 대상으로 전환 |
| 🔴 문의 메일 지연 발송 | 게스트↔호스트 문의 메시지는 새 메시지마다 즉시 메일을 보내지 않고, `미읽음 10분 후 1회` 기준의 `inquiry_unread` 큐 잡으로 전환 |
| 🟡 즉시 메일 보강 | 호스트 신청 승인/보완/거절, 일반 예약 무통장 입금 확인 완료 시 generic 즉시 메일이 함께 발송되도록 보강 |
| 🟡 스케줄러 추가 | `/api/cron/email-notifications` 크론 라우트와 `.github/workflows/email-notification-queue.yml` 워크플로우를 추가해 10분마다 queued 메일 잡을 처리하도록 연결 |
| 🟡 migration 추가 | `supabase_email_notification_jobs_migration.sql`로 `email_notification_jobs` 지연 메일 큐 테이블을 추가 |
| ✅ 검증 | `npx tsc --noEmit`, `git diff --check` 예정 |

## v3.37.63 — [Experience Translation] Gemini Flash-Lite fallback 보강

**작업일:** 2026-03-10

| 항목 | 내용 |
|------|------|
| 🔴 Gemini 과부하 완화 | `gemini-2.5-flash`가 `503 Service Unavailable`, `high demand`, rate-limit류 일시 오류를 반환할 때 provider 내부에서 `gemini-2.5-flash-lite`를 한 번 더 시도하도록 보강 |
| 🟡 queue 회귀 방지 | `XAI_API_KEY`가 없는 환경에서는 Gemini retryable 오류를 무조건 Grok으로 넘기지 않고, 기존 provider로 backoff 후 `retryable` 유지하도록 조정 |
| 🟡 운영 문서 갱신 | `docs/gemini.md`에 Flash → Flash-Lite → Grok fallback 순서를 반영 |
| ✅ 검증 | `npx tsc --noEmit`, `git diff --check` 통과 |

## v3.37.62 — [Experience Translation] guest-facing 본문 필드 자동번역 확장

**작업일:** 2026-03-10

| 항목 | 내용 |
|------|------|
| 🔴 번역 범위 확장 | 기존 title/description만 번역하던 worker를 확장해 `meeting_point`, `supplies`, `inclusions`, `exclusions`, `itinerary`, `rules`까지 locale별 JSON으로 함께 생성하도록 정리 |
| 🟡 additive migration 추가 | `supabase_experience_translation_content_migration.sql`을 추가해 `meeting_point_i18n`, `supplies_i18n`, `inclusions_i18n`, `exclusions_i18n`, `itinerary_i18n`, `rules_i18n` 컬럼과 기존 데이터 source-locale backfill을 준비 |
| 🟡 dirty-check 범위 보강 | PATCH 저장 시 제목/소개글뿐 아니라 일정/포함사항/준비물/규칙 등 본문 필드가 바뀌어도 재번역이 정확히 enqueue 되도록 범위를 확장 |
| 🟡 상세 노출 연결 | 체험 상세의 만나는 장소, itinerary, 포함/불포함 사항, 준비물, 규칙이 locale별 i18n JSON을 우선 읽도록 연결 |
| ✅ 검증 | `npx tsc --noEmit`, 대상 파일 `eslint`, `git diff --check` 통과 |

## v3.37.61 — [Experience Translation] 회귀 방지 보강

**작업일:** 2026-03-10

| 항목 | 내용 |
|------|------|
| 🔴 manual locale 보존 | edit 화면과 PATCH 저장이 기존 DB `manual_locales`를 `language_levels`와 병합해 인식하도록 수정해, 과거 수동 번역 컬럼이 첫 수정 저장에서 사라지던 회귀를 방지 |
| 🟡 dirty-check 추가 | title/description/source_locale/manual_locales 중 실제 변경이 있을 때만 `translation_version` 증가 및 queue enqueue가 일어나도록 수정해, 가격/사진/규칙만 바꿀 때 불필요한 재번역과 번역 컬럼 clear를 차단 |
| 🟡 TPM rate-limit 보완 | worker RPC와 cron route에 reserved token 기반 TPM 체크/정산을 추가해 RPM뿐 아니라 token window도 provider state에서 함께 제어하도록 정리 |
| ✅ 검증 | `npx tsc --noEmit`, `git diff --check` 통과. 대상 파일 `eslint`는 기존 `<img>` 경고만 잔존 |

## v3.37.60 — [Experience Translation] host write path/API 전환 및 worker 초안

**작업일:** 2026-03-10

| 항목 | 내용 |
|------|------|
| 🔴 host 저장 경로 이관 | 체험 생성/수정이 더 이상 클라이언트 direct `experiences` write를 사용하지 않고 `POST /api/host/experiences`, `PATCH /api/host/experiences/:id` 서버 API를 통해 canonical locale / manual locale / queue payload를 일관 계산하도록 변경 |
| 🟡 생성/수정 폼 전환 | host create/edit 화면을 `source_locale + manual_content` 구조로 재구성해, 호스트가 선택한 구사 언어에 대해서만 제목/소개글을 직접 입력하고 자동 번역 대상 언어는 UI에서 숨김 |
| 🟡 read fallback 보정 | `getContent()`가 `ko`에서도 `field_ko`를 우선 읽도록 변경해 새 canonical/locale 컬럼 구조와 노출 로직을 맞춤 |
| 🟡 worker / provider layer 추가 | `app/api/cron/experience-translations/route.ts`와 Gemini/Grok provider adapter를 추가해 queued task 처리, Gemini 실패 시 Grok fallback, task/job 상태 갱신 흐름을 구현 |
| 🟡 RPC migration 추가 | `supabase_experience_translation_worker_functions.sql`에 `lease_experience_translation_task`, `record_translation_provider_outcome` RPC를 추가해 provider-aware lease 및 cooldown/token bookkeeping을 DB 중심으로 처리할 수 있게 정리 |
| ✅ 검증 | 대상 파일 `eslint`는 `<img>` 기존 경고만 남기고 통과, `npx tsc --noEmit` 통과, `git diff --check` 통과 |

## v3.37.59 — [Experience Translation] DB scaffold 및 backfill baseline

**작업일:** 2026-03-10

| 항목 | 내용 |
|------|------|
| 🟡 additive migration 추가 | `supabase_experience_translation_queue_migration.sql`을 추가해 `experiences`에 `title_ko`, `description_ko`, `source_locale`, `manual_locales`, `translation_version`, `translation_meta`를 안전하게 확장 |
| 🟡 queue / provider state 도입 | `experience_translation_jobs`, `experience_translation_tasks`, `translation_provider_state` 테이블과 dispatch index, Gemini/Grok 기본 seed를 추가해 후속 worker가 DB 중심 rate-limit 제어를 사용할 수 있게 준비 |
| 🟡 기존 데이터 backfill | 기존 `title/description`을 `*_ko`로 복제하고, 비어 있는 `manual_locales` / `translation_meta`만 채우는 보수적 backfill을 적용하도록 설계해 재실행 시 운영값을 최대한 덮어쓰지 않도록 정리 |
| 🟡 기준 문서 갱신 | `docs/gemini.md`에 Experience translation canonical/queue/rate-limit 원칙을 추가 |
| ✅ 검증 | `git diff --check` 통과. 이 환경에는 `psql`/`supabase` CLI와 DB admin 연결 정보가 없어 원격 Supabase 실제 적용은 미실행 |

## v3.37.58 — [Wishlist] 하트 즉시 반응 및 다중 카드 pending 동기화

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🔴 클릭 지연 제거 | `useWishlist`가 더 이상 클릭 시점마다 `auth.getUser()`를 기다리지 않고 `AuthContext`의 현재 사용자 상태를 재사용하도록 변경해, 로그인 사용자는 첫 탭 순간 바로 하트 fill 변화가 보이도록 조정 |
| 🟡 race condition 완화 | 초기 저장 상태 조회 응답이 방금 누른 낙관적 상태를 덮어쓰지 않도록 request guard를 추가하고, 동일 체험 카드 여러 장이 떠 있을 때 `pending`도 커스텀 이벤트로 함께 동기화해 중복 탭을 차단 |
| 🟡 공용 카드 연결 정리 | 기존 공용 `ExperienceCard`도 위시리스트 버튼 이벤트를 훅 경로로 통일하고 pending 동안 disabled 되도록 정리 |
| ✅ 검증 | `npx eslint app/hooks/useWishlist.ts app/components/ExperienceCard.tsx app/components/HomeExperienceCard.tsx 'app/experiences/[id]/ExperienceClient.tsx'` 통과 |

## v3.37.57 — [Home/Login Modal] 위시리스트 중복 충돌 완화 및 모바일 spacing 보정

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🔴 duplicate key 회귀 차단 | 홈에서 같은 체험이 여러 섹션에 동시에 노출될 때 발생하던 `wishlists_user_id_experience_id_key` 충돌을 `upsert(ignoreDuplicates)` + 카드 간 저장 상태 sync로 완화 |
| 🟡 로그인 모달 모바일 정리 | 로그인/회원가입 모달의 모바일 폭, 패딩, 내부 밀도를 다듬고, 후속으로 헤더/본문 좌우 여백을 한 단계 더 늘려 텍스트·인풋·버튼이 모달 끝에 붙어 보이던 느낌을 축소 |
| 🟡 홈 하트 미세 보정 | 모바일 홈 카드 하트 아이콘을 약 10% 키워 카드 오버레이에서 존재감이 묻히지 않도록 조정 |
| ✅ 검증 | 변경 파일 대상 `eslint` 통과. 홈 관련 검수 결과 신규 에러 없이 `HomeHero.tsx`의 기존 `<img>` 경고만 잔존 |

## v3.37.56 — [Home] 체험 카드 Airbnb Originals 문법으로 통일

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🟡 홈 전용 카드 분리 | 검색/유저 페이지 공용 카드에 회귀를 주지 않도록 홈에서만 쓰는 `HomeExperienceCard` / `HomeExperienceCardSkeleton`을 신설 |
| 🟡 모바일·데스크톱 동시 리디자인 | 홈의 모든 체험 카드를 `1:1` 이미지, 카테고리 배지, `제목 → 도시·국가 → 1인당 금액부터 · 평점` 위계로 재설계하고 모바일 가로 섹션과 데스크톱 그리드에 같은 문법을 적용 |
| 🟡 오버레이 후속 정렬 | 하트 원형 배경 제거, 배지 앞 카테고리 아이콘 추가, 모바일/데스크톱 오버레이 정렬 분리, 배지와 하트 기준선 정렬 등 후속 polish를 반영 |
| ✅ 검증 | 홈 카드 및 skeleton 관련 변경 파일 대상 `eslint` 통과 |

## v3.37.55 — [Experience Detail] 모바일 상세 모달 및 호스트 카드 톤 보정

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🟡 모바일 모달 소형화 | 체험 상세의 로그인 모달과 `호스트에게 메시지 보내기` 모달을 모바일 기준으로 더 낮고 좁은 시트 형태로 정리해, 양옆 여백과 내부 밀도를 모바일에 맞게 축소 |
| 🟡 공유 피드백 정리 | `링크가 복사되었습니다.` 토스트를 한 줄 기준으로 재조정해 모바일에서 두 줄로 깨지지 않도록 보정 |
| 🟡 호스트 카드 시각 톤 재조정 | 자기소개 아래 호스트 카드를 배경보다 밝은 화이트 톤 카드로 올리고, 짧고 강한 그림자로 떠 보이게 조정했으며, 메시지 버튼은 회색 톤으로 낮추고 외곽선을 제거 |
| ✅ 검증 | 체험 상세 관련 변경 파일 대상 `eslint` 통과 |

## v3.37.54 — [Host Landing] 모바일 FAQ 스케일 및 여백 재정렬

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🟡 모바일 좌우 여백 확장 | `/become-a-host` 모바일 랜딩의 양쪽 여백을 `10px → 7px` 수준으로 좁혀 이미지 기반 섹션의 텍스트 가독성을 보강 |
| 🟡 FAQ 과대 스케일 보정 | 하단 FAQ 섹션의 카드 폭, 텍스트 크기, 아코디언 간격을 상단 이미지 섹션 감도에 맞게 줄여 갑자기 크게 튀던 밀도를 완화 |
| ✅ 검증 | `app/become-a-host2/BecomeHostLandingContent.tsx`, `app/become-a-host2/HostLandingActionBar.tsx` 대상 `eslint` 통과 |

## v3.37.53 — [Host Dashboard] 모바일 예약/체험 카드 위계 복구 및 가이드라인 정리

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🟡 가이드라인 푸터 카드 재정렬 | `좋은 호스팅은 신뢰에서 시작됩니다` 엔딩 카드를 호스트 대시보드 톤에 맞는 무채색 카드로 재구성하고, 최종적으로 체크 아이콘을 제거해 과한 장식감을 덜어냄 |
| 🟡 예약 관리 모바일 복구 | 모바일 예약 카드를 데스크톱 축약형 기준으로 재구성하고, 예약번호 메타를 상단 우측에 더 작고 덜 강조된 형태로 고정했으며, `입금 확인 중` 상태에서도 `일정 추가` 버튼을 상시 노출 |
| 🟡 내 체험 관리 모바일 재배치 | 체험 카드의 제목, 배지, 가격, 액션 구성을 여러 차례 조정해 내부 작은 카드 구조를 제거하고 큰 카드 안에서 항목 간 간격과 정보 위계가 맞도록 재구성 |
| ✅ 검증 | 예약/체험 카드 및 가이드라인 관련 변경 파일 대상 `eslint` 통과 |

## v3.37.52 — [App Shell] 모바일 탭 피드백, 계정 메뉴 전환, 스피너 일원화

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🟡 모바일 탭 피드백 추가 | 하단 탭바, 모바일 호스트 메뉴, 로그인/회원가입 버튼에 눌림 상태와 pending 로더를 추가해 연타를 줄이고 앱형 반응감을 강화 |
| 🟡 계정 메뉴 전환 polish | 모바일 `프로필/나의 여행/호스트 되기/Admin` 메뉴 진입에 눌림 상태와 전환 피드백을 넣고, 모바일 프로필 뷰 진입 애니메이션을 다듬어 갑작스러운 전환감을 완화 |
| 🟡 전역 전환/스피너 정리 | 전역 페이지 전환과 모드 전환 오버레이 중복을 줄이고, 로딩 인디케이터를 검정/슬레이트 계열 공용 `Spinner`로 통일해 붉은색/검정색 스피너 혼재를 정리 |
| ✅ 검증 | 관련 변경 파일 대상 `eslint` 통과. 기존 `<img>` 경고만 잔존 |

## v3.37.51 — [Docs] 런칭 전 Master QA Plan 추가

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🟡 QA 로드맵 문서화 | 게스트/호스트/관리자 3단계 전체 플로우를 `보안/에러`, `비효율`, `UI/UX`, `카피`, `사용자 경험` 5관점으로 점검하기 위한 마스터 QA 계획을 `docs/2026-03-09_master_qa_plan.md`로 추가 |
| 🟡 배포 전 기준 정리 | 단계별 점검 페이지, 핵심 플로우, 산출물 형식, 공통 테스트 시나리오, 우선순위 기준을 배포 전 운영 문서로 고정 |
| ✅ 검증 | 문서 생성 후 `main` 브랜치 반영 완료 |

## v3.37.48 — [Host Register] Step 8 서약 섹션 원복

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🟡 Step 8 원복 | 사용자 요청에 따라 `/host/register`의 `안전하고 올바른 호스팅을 위한 서약` 섹션 디자인을 커스텀 카드형 재구성 이전의 기존 버전으로 되돌림 |
| ✅ 검증 | `npx tsc --noEmit` 통과. `git diff --check` 통과 |

## v3.37.47 — [Host Register] Step 8 서약 섹션 톤 재정렬 2차

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🟡 등록 플로우 톤 복귀 | `안전하고 올바른 호스팅을 위한 서약` 섹션이 대시보드 가이드라인 복제처럼 보이던 구성을 걷어내고, 호스트 등록 단계들과 같은 밝은 카드형 신청 플로우 톤으로 재구성 |
| 🟡 레이아웃 재배치 | 다크 히어로 대신 중앙 인트로, 규칙 카드 그리드, 마지막 동의 카드 구조로 재정렬해 Step 1~7과 시각 결을 맞춤 |
| ✅ 검증 | `npx tsc --noEmit` 통과. `git diff --check` 통과 |

## v3.37.46 — [Host Register] Step 8 서약 섹션 가이드라인 톤 정렬

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🟡 시각 톤 정렬 | `/host/register`의 `안전하고 올바른 호스팅을 위한 서약` 섹션을 호스트 대시보드 `호스트 파트너 가이드라인`과 유사한 다크 히어로 배너, 좌측 컬러 바 정책 카드, 확인 박스 구조로 재정렬 |
| 🟡 기능 비변경 | 체크박스 로직, 필수 동의 조건, 번역 문자열, 제출 동선은 유지하고 시각 레이아웃만 조정 |
| ✅ 검증 | `npx tsc --noEmit` 통과. `git diff --check` 통과 |

## v3.37.45 — [Host Approval] 심사 결과 알림 누락 보정

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🔴 승인/보완/거절 알림 추가 | 관리자 `host_applications` 상태 변경 서버 액션이 이제 `approved`, `revision`, `rejected` 전환 시 해당 호스트에게 인앱 알림을 생성하도록 보정 |
| 🟡 승인 플로우 회귀 방지 | `approved` 시 기존 `users.role='host'` 승격 로직은 유지하고, 알림 insert 실패는 로그만 남기는 best-effort 처리로 상태 변경 자체가 깨지지 않도록 구성 |
| ✅ 검증 | `npx tsc --noEmit` 통과. `git diff --check` 통과 |

## v3.37.44 — [Public User Profile] 자기소개 fallback 보정

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🟡 공개 프로필 소개 누락 완화 | `/users/[id]` 공개 유저 프로필이 `introduction`만 보던 경로에 `bio` fallback을 추가해, `bio`만 저장된 사용자도 소개가 비어 보이지 않도록 보정 |
| ✅ 검증 | `npx tsc --noEmit` 통과. `git diff --check` 통과 |

## v3.37.43 — [Host Dashboard] 생년월일 읽기 경로 보정

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🔴 birth_date/dob 표시 불일치 축소 | 호스트 대시보드와 프로필 설정이 생년월일을 읽을 때 `profiles.birth_date`도 함께 보도록 보정해, 게스트 계정 프로필에 저장된 생년월일이 호스트 화면에서 비어 보이던 문제를 완화 |
| 🟡 저장 경로 비변경 | 이번 단계에서는 컬럼 정규화나 저장 로직 변경 없이 읽기 시 `birth_date → dob → host_applications.dob` 순으로만 안전하게 fallback |
| ✅ 검증 | `npx tsc --noEmit` 통과. `git diff --check` 통과 |

## v3.37.42 — [Account Profile] 이메일 표시/저장 혼선 차단

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🔴 로그인 이메일 기준 고정 | `/account`는 더 이상 `profiles.email`을 우선 표시하지 않고, 실제 Auth 로그인 이메일을 우선 노출하도록 정리 |
| 🔴 잘못된 이메일 저장 경로 제거 | 웹 계정 설정과 모바일 프로필 편집에서 `profiles.email`을 저장하던 경로를 제거해, 사용자가 이메일을 바꿨다고 느끼지만 실제 로그인 ID는 안 바뀌는 불일치를 차단 |
| 🟡 안내 문구 정정 | 다국어 `help_email` 문구를 현재 동작에 맞게 “여기서 변경할 수 없음”으로 수정 |
| ✅ 검증 | `npx tsc --noEmit` 통과. `git diff --check` 통과 |

## v3.37.41 — [Host Register] 공용 프로필 덮어쓰기 축소

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🔴 재지원 시 공개 프로필 회귀 방지 | `/host/register` 제출 후 `profiles`를 무조건 덮어쓰던 로직을 제거하고, `full_name`, `avatar_url`, `bio`, `languages`가 비어 있는 경우에만 최초 seed 성격으로 채우도록 축소 |
| 🟡 핀셋 범위 유지 | `host_applications` 저장 구조와 호스트 지원서 자체는 그대로 두고, 이미 게스트/호스트 프로필에서 수정해 둔 공개 정보가 재지원·보완 제출로 되돌아가지 않도록 저장 후처리만 좁게 보정 |
| ✅ 검증 | `npx tsc --noEmit` 통과. `git diff --check` 통과 |

## v3.37.40 — [Host Profile] 공개 표시 경로 1차 정렬

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🔴 공용 selector 추가 | `app/utils/profile.ts`에 `getHostPublicProfile()`를 추가해 호스트 공개 표시용 이름·사진·소개·언어·직업·국가 우선순위를 `profiles 우선, host_applications fallback` 기준으로 단일화 |
| 🟡 주요 노출면 읽기 경로 정리 | 체험 상세, 서비스 의뢰 지원자 카드/호스트 모달, 게스트·호스트 문의 채팅, 호스트 메뉴, 호스트 대시보드, 유저 프로필 모달이 더 이상 제각각 다른 우선순위로 호스트 정보를 읽지 않고 공용 selector를 재사용하도록 정리 |
| 🟡 저장 로직 보류 | 회귀 위험을 줄이기 위해 이번 단계에서는 `host/register`나 `account`의 저장 경로는 건드리지 않고, 공개 표시 불일치만 1차로 축소 |
| ✅ 검증 | `npx tsc --noEmit` 통과. `git diff --check` 통과 |

## v3.37.39 — [Admin TEAM] 모바일 수정/삭제 액션 가시성 보정

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🔴 메모 액션 모바일 노출 | `TEAM` 탭 메모 카드의 작성자 전용 `수정/삭제` 버튼이 hover 전용이라 모바일에서 보이지 않던 문제를 수정하고, 모바일에서는 기본 노출·데스크톱에서는 기존 hover 노출을 유지하도록 분리 |
| 🟡 TODO 삭제 모바일 노출 | `TEAM` 탭 할 일 카드 삭제 버튼도 동일 규칙으로 정리해 모바일 터치 환경에서 바로 접근 가능하도록 보정 |
| ✅ 검증 | `npx tsc --noEmit` 통과 |

## v3.37.38 — [Support Inbox] 관리자 1:1 문의 아바타 교체 정정

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🔴 관리자 문의 아바타 교체 | 게스트 인박스의 `admin_support` 문의 목록, 채팅 헤더, 상대 메시지 버블에서 보이던 방패 아이콘을 `public/images/logos/Frame 1545423142.png` 이미지로 교체 |
| 🟡 잘못 적용된 모달 로고 롤백 | `/help` 문의 모달 상단에 추가했던 로고는 사용자 의도와 달라 제거하고, 실제 1:1 문의방 내부 아바타만 변경되도록 정리 |
| ✅ 검증 | `npx tsc --noEmit` 통과 |

## v3.37.37 — [Host Landing/Help] CTA 크기 정렬 및 고객문의 로고 교체

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🟡 CTA 시각 일관성 보정 | `/become-a-host` 랜딩의 하단 CTA가 상단 CTA와 동일한 폭과 비율로 보이도록 `HostLandingActionBar` 버튼 레이아웃을 단일 크기 기준으로 정리 |
| 🟡 고객문의 브랜딩 교체 | `/help`의 1:1 문의 모달 상단 로고를 `public/images/logos/Frame 1545423142.png`로 교체해 문의 진입 시 새 브랜드 이미지가 먼저 보이도록 반영 |
| ✅ 검증 | `npx tsc --noEmit` 통과 |

## v3.37.36 — [Host Landing] 지원 상태 기반 CTA 단일화

**작업일:** 2026-03-09

| 항목 | 내용 |
|------|------|
| 🔴 상태 기반 1차 CTA 정리 | `/become-a-host` 랜딩의 상단/하단 CTA를 동일 로직으로 통일하고, 비로그인 사용자는 로그인 후 이어서 진입하도록 유지한 채 버튼 문구와 목적지를 `호스트 지원하기` / `신청현황` / `호스트 모드로 전환` 3상태로 단순화 |
| 🟡 대기중 지원자 우회 방지 | 이미 호스트 신청 이력이 있는 사용자가 더 이상 랜딩에서 `첫 호스트 지원하기`로 `/host/register`에 다시 진입하지 않고, 버튼 클릭 시 바로 `/host/dashboard`의 신청 현황으로 이동하도록 보정 |
| 🟡 중복 보조 버튼 제거 | 하단 액션바의 별도 `신청현황` 보조 버튼을 제거해, 상단/하단 모두 하나의 주 CTA만 노출되도록 정리 |
| ✅ 검증 | `npx tsc --noEmit` 통과. `git diff --check` 통과 |

## v3.37.35 — [Messaging] 서비스 매칭 채팅 request 단위 식별자 도입 준비

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 서비스 채팅 식별 보강 | `service_request` 컨텍스트의 기존 `(user_id, host_id, experience_id IS NULL)` 재사용 규칙을 정리하고, `service_request_id` 컬럼이 있으면 `(user_id, host_id, service_request_id)` 기준으로만 기존 스레드를 재사용하도록 서버 helper를 확장 |
| 🟡 무중단 fallback 추가 | 운영 DB에 `inquiries.service_request_id`가 아직 없어도 회귀가 나지 않도록, 서버가 컬럼 존재 여부를 확인해 없을 때는 레거시 규칙으로 안전하게 fallback 하도록 구성 |
| 🟡 중복 생성 race 완화 | 마이그레이션 후 `service_request_id` 기반 unique index가 있을 때 동시 생성으로 인한 `23505`가 나면 기존 스레드를 다시 조회해 이어붙이도록 보강 |
| 🟡 DB 마이그레이션 파일 추가 | `docs/migrations/v3_37_35_service_request_inquiry_key.sql` 추가. `inquiries.service_request_id` 컬럼, FK, 인덱스, partial unique index 포함 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과. `npx playwright test tests/e2e/05-live-guest-booking-messaging-support.spec.ts --project=chromium --reporter=list` 라이브 통과 |

## v3.37.34 — [Messaging] 답장 전송 서버 단일 API 통합 2차

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 공용 서버 API 추가 | `/api/inquiries/message`를 신설해 기존 문의방에 대한 답장 전송을 서버 단일 경로로 통합 |
| 🔴 클라이언트 direct insert 제거 | `useChat.sendMessage()`가 더 이상 `inquiry_messages` / `inquiries`를 브라우저에서 직접 갱신하지 않고, 이미지 업로드 후 서버 API에 메시지 저장을 위임하도록 정리 |
| 🟡 관리자 1:1 문의 상태 전환 보강 | `ChatMonitor`에서 답장 전송을 `await`한 뒤에만 `open → in_progress` 상태를 바꾸도록 수정해, 답장 저장 실패 시 상태만 먼저 변하는 불일치를 방지 |
| 🟡 알림 서버화 일관화 | 채팅 알림은 `/api/inquiries/thread`, `/api/inquiries/message`가 `notifications`를 기록하고, 클라이언트는 실시간 수신만 담당하도록 정리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과. `npx playwright test tests/e2e/05-live-guest-booking-messaging-support.spec.ts --project=chromium --reporter=list` 라이브 통과 |

## v3.37.31 — [E2E] 승인된 호스트 라이브 체험 등록 플로우 검증 스펙 추가

## v3.37.32 — [E2E] 라이브 게스트 무통장 예약·메시지·관리자 문의 플로우 검증 스펙 추가

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 라이브 게스트 플로우 스펙 추가 | `tests/e2e/05-live-guest-booking-messaging-support.spec.ts`를 추가해 새 게스트 계정 생성, 승인된 테스트 호스트 체험에 대한 무통장 예약 결제, 예약 완료 후 호스트 메시지 전송, 호스트 계정 재로그인 후 답장, `/help` 1:1 관리자 문의 생성까지 실제 브라우저로 검증 가능하게 구성 |
| 🟡 빈 슬롯 자동 준비 | 테스트 시작 시 service-role 조회로 최신 테스트 체험을 `approved` 상태로 맞추고, 기존 `PENDING` 예약과 충돌하지 않도록 비어 있는 미래 슬롯을 찾아 `experience_availability`를 준비한 뒤 결제 흐름을 시작하도록 구성 |
| 🟡 메시지 검증 강화 | 호스트 답장은 UI 표시만 보지 않고 `inquiry_messages` 삽입을 직접 poll해 실제 저장 여부까지 확인하고, 게스트 인박스 재진입 후 답장 수신이 보이는지까지 검증 |
| ✅ 라이브 검증 | Playwright로 라이브 사이트 E2E 1회 통과. 생성된 최신 게스트는 `codex.guest.1772985492212@example.com`, 무통장 예약 주문번호는 `ORD-20260308155829520-644`, 일반 문의 스레드는 `id=71`, 관리자 1:1 문의 스레드는 `id=72` |

## v3.37.31 — [E2E] 승인된 호스트 라이브 체험 등록 플로우 검증 스펙 추가

## v3.37.33 — [Messaging] 문의방/첫 메시지 생성 서버 단일 API 통합 1차

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 공용 서버 API 추가 | `/api/inquiries/thread`를 신설해 체험 일반 문의, 호스트 체험 채팅방 열기, 유저의 관리자 1:1 문의, 관리자의 CS 선개시, 서비스 매칭 채팅방 열기/첫 메시지 생성을 단일 서버 경로로 통합 |
| 🔴 분산 생성 로직 교체 | `useChat.createInquiry`, `/help`, 관리자 `DetailsPanel`, `ServiceRequestClient`, `/api/host/start-chat`, `/api/services/start-chat`이 더 이상 각자 `inquiries` / `inquiry_messages`를 직접 조합하지 않고 공용 API를 재사용하도록 정리 |
| 🟡 첫 문의 알림 fail-safe 서버화 | 공용 API 내부에서 첫 메시지 저장 후 `notifications` insert와 이메일 발송을 best-effort로 처리하되, 알림/메일 실패가 메시지 생성 자체를 롤백시키지 않도록 fail-safe 처리 |
| 🟡 딥링크 일관화 | 서비스 매칭과 관리자 1:1 문의 생성 후 이동 경로도 `hostId/guestId` 추정 대신 `redirectUrl` 또는 `inquiryId` 기반으로 정리 |
| ✅ 검증 | `npx tsc --noEmit` 통과. `npx playwright test tests/e2e/05-live-guest-booking-messaging-support.spec.ts --project=chromium --reporter=list` 라이브 통과 |

## v3.37.31 — [E2E] 승인된 호스트 라이브 체험 등록 플로우 검증 스펙 추가

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 라이브 호스트 체험 등록 스펙 추가 | `tests/e2e/04-live-host-experience-create.spec.ts`를 추가해 승인된 테스트 호스트 계정으로 로그인, `/host/create` 진입, 다단계 입력, 대표 사진 다중 업로드, 동선 사진 업로드, 제출, `/host/dashboard?tab=experiences` 반영까지 실제 브라우저로 검증 |
| 🟡 다국어/실UI 셀렉터 보강 | 라이브 기본 로케일이 영어일 수 있는 점을 반영해 Step 4 동선 placeholder, Step 5 준비물 필드 등 실제 표시 문구 기준으로 로케일 대응 |
| ✅ 라이브 검증 | Playwright로 라이브 사이트 E2E 1회 통과. 생성된 최신 체험은 `id=31`, 제목은 `[Playwright] Live Host Experience 1772982721135`, 상태는 `pending` |

## v3.37.30 — [E2E] 라이브 호스트 가입·지원 제출 플로우 검증 스펙 추가

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 라이브 E2E 스펙 추가 | `tests/e2e/03-live-host-signup-registration.spec.ts`를 추가해 `https://locally-web.vercel.app/become-a-host`에서 회원가입, 호스트 지원 8단계 입력, 파일 업로드, 제출, `/host/dashboard` 진입까지 실제 브라우저로 검증 가능하게 구성 |
| 🟡 다국어/실UI 대응 | 라이브 기본 로케일이 영어일 수 있는 점을 반영해 회원가입 약관, 계좌 입력, Step 7/8 동의 문구를 보이는 라벨 기준으로 다국어 대응 |
| ✅ 라이브 검증 | Playwright로 라이브 사이트 E2E 1회 통과. 생성된 최신 호스트 신청은 `codex.host.1772980212472@example.com`, 상태는 `pending` |

## v3.37.29 — [Host Landing] 다국어 확장용 자산 구조 정리

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 canonical 자산 트리 생성 | 호스트 랜딩 이미지를 `public/images/become-a-host/{desktop|mobile}/{ko|en|ja|zh}` 구조로 정리하고, 현재 운영 자산은 `ko` 기준으로 이관 |
| 🟡 모바일 실자산 연결 | 모바일에서는 더 이상 데스크톱 PNG를 확대하지 않고, 새로 제공된 `mobile/ko/1~7.png`를 직접 사용하도록 변경 |
| 🟡 다국어 확장 준비 | `en/ja/zh` 폴더는 `.gitkeep`으로 미리 생성해 두고, 추후 언어별 이미지 추가 시 코드 구조를 다시 흔들지 않도록 정리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.28 — [Host Landing] 모바일 이미지 가독성 보정

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 모바일 랜딩 확대 보정 | `become-a-host` 랜딩의 시안 PNG는 데스크톱 기준 텍스트가 포함된 이미지라 모바일에서 작게 보이므로, 모바일 구간에서만 각 섹션 이미지를 약하게 확대해 가독성을 보정 |
| 🟡 데스크톱 회귀 방지 | 확대는 `md` 미만에서만 적용하고, 태블릿/데스크톱은 기존 `w-full` 렌더를 그대로 유지 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.27 — [Host Landing] `/become-a-host2`를 canonical URL로 정리

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 구주소 redirect 적용 | `/become-a-host2`는 더 이상 본문을 직접 렌더하지 않고 `/become-a-host`로 즉시 redirect되도록 변경 |
| 🟡 메인 URL 성능 유지 | canonical URL인 `/become-a-host`는 기존처럼 공용 랜딩을 직접 렌더하고, 추가 hop은 구주소(`/become-a-host2`) 진입 시에만 발생하도록 유지 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.26 — [Host Landing] `/become-a-host`를 새 랜딩으로 안전 교체

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 공용 랜딩 컴포넌트 분리 | `become-a-host2`의 새 랜딩 본문을 공용 컴포넌트로 분리해, 중복 복사 없이 두 라우트가 같은 UI를 렌더하도록 정리 |
| 🟡 기존 URL 유지 교체 | 기존 `/become-a-host` 페이지가 레거시 클라이언트 랜딩 대신 새 랜딩 공용 컴포넌트를 직접 렌더하도록 교체 |
| 🟡 QA 경로 유지 | `/become-a-host2`도 같은 공용 컴포넌트를 계속 렌더하도록 유지해, 기존 QA/공유 링크가 즉시 깨지지 않도록 보수적으로 처리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.25 — [Host Landing] 첫 compact CTA 폭 절반 수준 재조정

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 첫 CTA 폭 재조정 | `become-a-host2`의 1번/2번 이미지 사이 compact `호스트 지원하기` 버튼에서 기본 `w-full` 충돌을 제거하고, 버튼 폭을 명시적으로 더 짧게 고정해 이전 대비 절반 수준에 가깝게 보이도록 재조정 |
| 🟡 첫 이미지 간격 추가 축소 | 첫 번째 이미지와 compact CTA 사이의 상단 spacing을 한 번 더 줄여, CTA가 이미지 바로 아래에 조금 더 붙어 보이도록 보정 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.24 — [Host Landing] 첫 compact CTA 패딩·간격 축소

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 첫 CTA 가로 폭 추가 축소 | `become-a-host2`의 1번/2번 이미지 사이 compact `호스트 지원하기` 버튼의 좌우 패딩과 최소 폭을 더 줄여, 가로 길이가 덜 길게 보이도록 조정 |
| 🟡 상단 간격 미세 조정 | 첫 번째 이미지와 compact CTA 사이의 상단 spacing만 소폭 줄여 이미지 흐름이 더 타이트하게 이어지도록 보정 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.23 — [Services] 의뢰 상세 조회 경로 안정화

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 상세 조회 경로 수정 | `/services/[requestId]`가 브라우저 Supabase 직조회 대신 `/api/services/requests?requestId=...`를 통해 서버에서 의뢰 상세를 확인하도록 변경. 목록은 보이는데 상세에서만 `의뢰를 찾을 수 없습니다.`가 뜨던 권한 불일치 가능성을 제거 |
| 🟡 번역 누락 보완 | 서비스 상세 빈 상태의 `btn_go_to_list` 키를 `ko/en/ja/zh`에 추가해 raw key가 노출되지 않도록 수정 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.22 — [Host Landing] 첫 compact CTA 중앙 복원

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 첫 CTA 중앙 정렬 복원 | `become-a-host2`의 1번/2번 이미지 사이 compact CTA를 다시 중앙 정렬로 복원 |
| 🟡 첫 CTA 가로 폭 추가 축소 | 상단 `호스트 지원하기` 버튼의 최소 폭과 패딩을 더 줄여, 초기의 더 작고 가벼운 비율에 가깝게 보정 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 신규 타입 오류 없이 통과 |

## v3.37.21 — [Host Landing] 첫 CTA 정렬·폭 미세 조정

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 첫 CTA 정렬 조정 | `become-a-host2`의 1번/2번 이미지 사이 compact CTA를 데스크탑에서 우측 텍스트 컬럼 시작선 쪽으로 이동하도록 정렬 보정 |
| 🟡 첫 CTA 폭 축소 | 상단 `호스트 지원하기` 버튼의 가로 폭을 다시 줄여, 이전보다 더 가볍고 단정한 비율로 정리 |
| 🟡 구분선 제거 | 상·하 CTA 영역의 위아래 얇은 선을 제거해 이미지 흐름과 FAQ 사이가 더 자연스럽게 이어지도록 조정 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 신규 타입 오류 없이 통과 |

## v3.37.20 — [Host Landing] `become-a-host2` CTA 이중 배치 재구성

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 CTA 위치 재구성 | `become-a-host2`의 CTA를 하나의 바에서 두 구간으로 재구성. 1번/2번 이미지 사이에는 단일 CTA를, FAQ 바로 위에는 이중 CTA를 배치해 랜딩 중간과 끝에서 각각 자연스럽게 전환될 수 있도록 조정 |
| 🟡 CTA 톤 단순화 | `HostLandingActionBar`의 설명 텍스트와 상태 배지를 제거하고, 버튼만 중앙 정렬되는 구조로 단순화. 상단은 compact 단일 버튼, 하단은 `호스트 지원/대시보드`와 `신청현황` 이중 버튼으로 변형 분리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 신규 타입 오류 없이 통과 |

## v3.37.19 — [Host Landing] `become-a-host2` CTA 위치·배경 미세 조정

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 CTA 위치 이동 | `become-a-host2`의 CTA 바를 페이지 상단에서 FAQ 섹션 바로 위로 내려, 랜딩 내용을 읽은 뒤 자연스럽게 지원/신청현황으로 이어지도록 흐름을 조정 |
| 🟡 CTA 배경 톤 정렬 | 기존 누런 계열 배경을 제거하고 페이지 기본 톤과 맞는 흰색 바 + 얇은 구분선 구조로 정리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 신규 타입 오류 없이 통과 |

## v3.37.18 — [Host Landing] `become-a-host2` CTA 바 안전 추가

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 `become-a-host2` 전용 CTA 바 추가 | 새 호스트 랜딩 [`/become-a-host2`]에 얇은 상단 CTA 바를 추가해 `호스트 지원하기`와 신청 상태 기반 `신청현황` 진입 버튼을 페이지 톤에 맞춰 연결. 기존 이미지 중심 랜딩 구조는 유지하고, 페이지 전체를 클라이언트로 전환하지 않도록 CTA만 feature-local client component로 분리 |
| 🟡 기존 인증/모달 흐름 재사용 | 새 CTA는 `AuthContext`와 기존 `LoginModal`을 그대로 사용해 비로그인 사용자는 로그인 모달, 신청자/승인 호스트는 대시보드, 신규 사용자는 지원서로 분기되도록 정리 |
| 🟡 `become-a-host2` 타입 베이스라인 오류 정리 | `page.tsx`의 `JSX.Element` 반환 타입을 제거해 기존 `app/become-a-host2/page.tsx`의 `Cannot find namespace 'JSX'` 베이스라인 오류를 함께 해소 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 이번 시점 기준 신규 타입 오류 없이 통과 |

## v3.37.17 — [Upload] HEIC 명시 차단 및 JPG 변환 안내 팝업

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 HEIC/HEIF 정책 명확화 | `app/utils/image.ts`에서 `HEIC/HEIF`를 MIME 타입과 파일 확장자 기준으로 명시 감지하고, 현재 지원 형식을 `JPG/PNG/WEBP`로 고정. 이미지 검증은 `unsupported_heic` 코드와 안내 메시지를 반환하고, 압축 유틸도 HEIC 원본 fallback 업로드를 막도록 방어 |
| 🔴 전역 JPG 변환 안내 팝업 추가 | `app/context/ToastContext.tsx`에 액션형 토스트를 확장하고, `showHeicUnsupportedToast()`를 추가. HEIC 업로드 시 `JPG 변환 방법` 버튼이 붙은 에러 토스트를 띄우고, 클릭 시 `ko/en/ja/zh` 안내 모달에서 iPhone 설정 경로와 Mac/Windows 변환 방법을 바로 확인할 수 있도록 구성 |
| 🟡 주요 업로드 흐름 공통 연결 | 체험 등록/수정, 호스트 지원서, 게스트 계정 사진, 모바일 프로필 사진, 호스트 프로필 편집, 리뷰 사진, 커뮤니티 글쓰기, 메시지 이미지 전송 경로가 HEIC 업로드 시 동일한 차단/안내 UX를 사용하도록 정리 |
| 🟡 업로드 input 재선택 UX 보정 | HEIC 차단이나 사진 개수 제한으로 업로드가 중단된 뒤에도 동일 파일을 바로 다시 선택할 수 있도록 주요 파일 input 초기화 타이밍을 정리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 기존 베이스라인 오류 `app/become-a-host2/page.tsx(99,45): Cannot find namespace 'JSX'`만 동일하게 확인되었고, 이번 패치로 인한 신규 타입 오류는 확인되지 않음 |

## v3.37.16 — [i18n/QA] 로케일 실QA 정합성 보정

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 로그인 모달 회귀성 렌더 루프 수정 | 실QA 중 홈 로그인 모달을 열 때 `Maximum update depth exceeded`가 반복되던 문제를 수정. `NotificationProvider`, `UserPresenceTracker`의 Supabase client 인스턴스를 `useMemo`로 고정해 effect 재구독 루프를 차단 |
| 🔴 비로그인 세션 에러 소음 제거 | `AuthContext`가 로그아웃 상태의 `AuthSessionMissingError`를 예외로 간주해 콘솔 에러를 남기던 동작을 정리. 비로그인 상태를 정상 경로로 처리하도록 보정 |
| 🔴 로케일 경로 메타 기준 정렬 | `app/utils/locale.ts`가 쿠키보다 middleware의 `x-locally-locale` 헤더를 우선 보도록 수정. 직접 `/en`, `/ja`, `/zh` 경로로 진입할 때 서버 메타데이터와 클라이언트 표시 언어 기준이 어긋나지 않도록 정리 |
| 🟡 4개 언어 실QA 수행 | `/en|ja|zh/help`, `/en|ja|zh/host/register`, `/en|ja|zh/host/create`, 홈 로그인 모달/푸터를 실제 렌더 기준으로 확인. 본문 로케일 전환은 정상 확인되었고, 법률 본문은 기존 정책대로 제목 현지화 + 한국어 원문 fallback 유지 |
| 🟡 감사 문서 범위 정리 | 사용자 요청에 따라 [docs/2026-03-08_issue_audit_and_implementation_plan.md](/Users/sonhyungeun/Documents/locally-web/docs/2026-03-08_issue_audit_and_implementation_plan.md)에서 일본 계좌 송금 폼 확장 항목을 현재 추진 범위에서 제거 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 기존 베이스라인 오류 `app/become-a-host2/page.tsx(99,45): Cannot find namespace 'JSX'`만 동일하게 확인되었고, 이번 패치로 인한 신규 타입 오류는 확인되지 않음 |

## v3.37.15 — [i18n] 법률 문서 레지스트리 분리 및 로그인 모달 다국어 정리

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 법률 문서 레지스트리 분리 | `app/constants/legalDocuments.ts`를 신설해 `terms/privacy/travel/refund` 문서를 `ko/en/ja/zh` 제목 레지스트리 + 한국어 원문 body fallback 구조로 분리. 기존 `legalText.ts`의 한국어 원문은 유지 |
| 🔴 푸터 약관 모달 로케일 연동 | `SiteFooter`가 더 이상 한국어 상수 제목을 직접 쓰지 않고 현재 `lang` 기준으로 문서 제목을 읽도록 변경. 비한국어 로케일에서는 한국어 원문이 적용된다는 fallback 안내문을 함께 표시 |
| 🔴 로그인 모달 약관/회원가입 문구 정리 | `LoginModal`의 약관 뷰어를 동일한 법률 문서 헬퍼로 연결하고, 회원가입 단계의 제목/검증 토스트/국적 옵션/성별 선택/필수 약관 UI를 `ko/en/ja/zh` 기준으로 로컬라이즈. auth payload의 `gender`, `nationality` 값은 기존과 동일하게 유지 |
| 🟡 기능 전용 로컬라이제이션 분리 | `app/components/loginModalLocalization.ts`를 추가해 로그인 모달 전용 문구와 국적 옵션을 전역 `LanguageContext` 밖으로 분리. 장문/기능 전용 문자열이 전역 사전을 비대화시키지 않도록 정리 |
| 🟡 안전한 법률 fallback 명시 | 영문/일문/중문 법률 본문은 검수 전 번역을 억지로 넣지 않고, 제목만 현지화한 뒤 한국어 원문 적용 안내를 표기하는 안전한 단계적 전환으로 정리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 기존 베이스라인 오류 `app/become-a-host2/page.tsx(99,45): Cannot find namespace 'JSX'`만 동일하게 확인되었고, 이번 패치로 인한 신규 타입 오류는 확인되지 않음 |

## v3.37.14 — [i18n] 일본어 누락 구조 보정 1차

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 체험 등록/수정 옵션 구조 정규화 | `app/host/create/localization.ts`를 신설해 도시/카테고리/진행 언어/활동 강도/환불 정책의 표시 라벨을 로케일별 메타데이터로 분리. 저장값은 기존 한국어 값을 유지해 DB 호환성과 선택 상태 비교 로직 회귀를 방지 |
| 🔴 체험 등록 폼 일본어 대응 | `CreateExperiencePage`와 `ExperienceFormSteps`의 단계 제목, 검증 토스트, 버튼, 사진/동선/환불 정책 문구를 로케일별 카피로 전환. 일본어 선택 시 생성 플로우가 더 이상 한국어 하드코딩에 묶이지 않도록 조정 |
| 🔴 체험 수정 화면 공용화 | `/host/experiences/[id]/edit`가 생성 화면과 동일한 옵션 메타데이터를 재사용하도록 변경. 진행 언어/카테고리/활동 강도/단독 투어/동선 사진/환불 정책의 하드코딩 한국어를 제거 |
| 🔴 호스트 지원서 현지화 | `app/host/register/localization.ts`를 신설해 언어 옵션, 단계별 라벨/placeholder, 검증 토스트, 안전 가이드라인 장문을 로케일별 콘텐츠로 분리. 호스트 지원서는 저장 payload를 바꾸지 않고 표시 텍스트만 분리 |
| 🟡 고객센터 문의 모달 개선 | `/help` 문의 모달의 제목/설명/placeholder/에러 문구를 로케일별로 전환하고, 문의 생성 후 `/guest/inbox?inquiryId=...`로 바로 해당 상담 스레드를 열도록 개선 |
| 🟡 조사 문서 반영 | 일본어 누락 구조 감사 및 구현 계획 보고서를 `docs/2026-03-08_japanese_localization_structure_audit_plan.md`로 추가 |
| ✅ 검증 | `npx tsc --noEmit` 실행. 기존 베이스라인 오류 `app/become-a-host2/page.tsx(99,45): Cannot find namespace 'JSX'`만 동일하게 확인되었고, 이번 패치로 인한 신규 타입 오류는 확인되지 않음 |

## v3.37.13 — [메시지] 예약 완료·알림 딥링크 직결

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 예약 완료 메시지 직결 | `/experiences/[id]/payment/complete` 하단 CTA가 더 이상 빈 `/guest/inbox`로 가지 않도록 수정. 예약된 `experiences.host_id`, `experiences.id`, `experiences.title`을 사용해 `/guest/inbox?hostId=...&expId=...&expTitle=...` 딥링크로 바로 연결 |
| 🔴 메시지 알림 스레드 직결 | `useChat.ts`의 `new_message` 알림 링크를 역할별 실제 채팅 화면으로 구체화. 게스트 수신자는 `/guest/inbox?inquiryId=...`, 호스트 수신자는 `/host/dashboard?tab=inquiries&inquiryId=...`, 관리자 CS 수신자는 `/admin/dashboard?tab=CHATS&inquiryId=...`로 이동 |
| 🟡 Inbox 파라미터 확장 | `guest/inbox`와 `host/dashboard/InquiryChat`이 `inquiryId` URL 파라미터를 받아 해당 문의방을 자동 선택하도록 확장. 기존 `hostId`/`expId` 기반 자동 연결은 유지 |
| ✅ 검증 | `npx tsc --noEmit` 실행. 현재 베이스라인의 기존 오류 `app/become-a-host2/page.tsx(99,45): Cannot find namespace 'JSX'`로 실패하며, 이번 패치와 직접 관련된 신규 타입 오류는 확인되지 않음 |

## v3.37.12 — [Host Landing] `/become-a-host2` FAQ 핀셋 폭/톤 조정

**작업일:** 2026-03-07

| 항목 | 내용 |
|------|------|
| 🔴 FAQ 폭 축소 | `/become-a-host2` 하단 FAQ 컨테이너를 `max-w-[790px]`로 축소하여 바로 위 마지막 시안 카드 외곽선과 더 가깝게 정렬 |
| 🔴 배경 톤 보정 | FAQ 섹션 배경을 `#F7F7F7`로 변경하고, 텍스트/보더 대비를 한 단계 낮춰 전체 톤을 부드럽게 조정 |
| 🟡 타이포 핀셋 조정 | 제목/섹션 라벨/본문 크기와 간격을 축소해 기존보다 덜 무겁고 시안 하단과 자연스럽게 이어지도록 보정 |
| ✅ 검증 | `/become-a-host2` 로컬 렌더 재확인 |

## v3.37.11 — [Host Landing] `/become-a-host2` 순수 마크업 재구축

**작업일:** 2026-03-07

| 항목 | 내용 |
|------|------|
| 🔴 스크린샷 의존 제거 | 이전 벤치마크 이미지 렌더링 방식 폐기. `/become-a-host2`를 실제 HTML 구조와 Tailwind 유틸리티만으로 다시 작성 |
| 🔴 정적 섹션 하드코딩 | 상단 미니 헤더, 히어로, 3장 스토리 카드, 카테고리 블록, 브랜드 수치, 단일 폰/2폰/4폰 섹션, FAQ 밴드까지 전부 컴포넌트 형태로 재구성 |
| 🔴 폰 목업 직접 구축 | `next/image`나 잘라낸 스크린샷 없이, 검은 프레임/다이내믹 아일랜드/내부 카드 UI를 중첩 div와 Tailwind만으로 구현 |
| 🟡 전역 레이아웃 예외 처리 | `/become-a-host2`에서는 기본 `SiteFooter`와 모바일 `BottomTabNavigation`이 붙지 않도록 경로 기준으로 숨김 처리 |
| ✅ 검증 | `npx tsc --noEmit` 통과 기준으로 재검증 |

## v3.37.10 — [Host Landing] `/become-a-host2` 데스크톱 벤치마크 픽셀 복제 재구성

**작업일:** 2026-03-07

| 항목 | 내용 |
|------|------|
| 🔴 벤치마크 기반 정적 복제 | 첨부된 참조 스크린샷 기준으로 `/become-a-host2` 본문을 데스크톱 전용 픽셀 복제 형태로 재구성 |
| 🔴 동적 로직 제거 | 기존 `createClient`, `useRouter`, `LoginModal`, 신청 상태 분기 등 호스트 등록 플로우 로직을 전부 제거하고 순수 프론트엔드 랜딩으로 전환 |
| 🔴 로컬 자산화 | 벤치마크 스크린샷에서 본문/FAQ 구간을 잘라 `public/images/become-host2/main-desktop.webp`, `faq-desktop.webp`로 저장하고 페이지에서 `next/image`로 렌더링 |
| 🟡 글로벌 푸터 유지 | 본문 복제는 FAQ 섹션 종료 지점까지 맞추고, 그 아래는 기존 `SiteFooter`가 이어지도록 유지 |
| ✅ 검증 | `npx tsc --noEmit` 통과 예정 기준으로 페이지를 정적 구성. 실제 렌더 확인은 `/become-a-host2` 데스크톱 비교 기준 |

## v3.37.9 — [Host Landing] `/become-a-host2` 에어비앤비 레퍼런스형 신규 페이지

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 신규 호스트 랜딩 추가 | `/become-a-host2` 신규 라우트 추가. 기존 `/become-a-host`는 유지하고, 별도의 실험/비교용 랜딩으로 분리 |
| 🔴 레퍼런스형 구조 반영 | 에어비앤비 `host/experiences` 페이지 구조를 참고해 히어로, 호스트 스토리 카드, 체험 카테고리, 통계, 리스팅 프리뷰, 노출 포인트, 운영 기능, FAQ까지 긴 단일 랜딩으로 재구성 |
| 🔴 로컬리 카피/브랜딩 전환 | 모든 문구를 로컬리 호스트 모집 문맥으로 재작성하고, 현재 `host/register` / `host/dashboard` 이동 로직과 로그인 모달 동선을 그대로 연결 |
| 🟡 미니멀 헤더 분리 | 기본 사이트 헤더 대신 레퍼런스 톤에 맞는 간결한 상단 바와 CTA를 페이지 내부에 별도로 구성 |
| ✅ 검증 | `npx tsc --noEmit` 통과 |

## v3.37.8 — [About] 취향 섹션 에디토리얼 리디자인

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 소개 페이지 톤 재정렬 | `/about`의 `당신의 취향을 발견하세요` 구간을 상품 리스트형 그리드에서 에디토리얼 큐레이션 섹션으로 교체. 소개 페이지 흐름 안에서 브랜드/취향 탐색이 읽히도록 재구성 |
| 🔴 상품 메타 제거 | 가격, 별점, 리뷰수, 좋아요, BEST 배지 중심의 카드 메타를 제거하고 `대표 비주얼 1개 + 카테고리 설명 블록 6개` 구조로 전환 |
| 🔴 에어비앤비 레퍼런스 톤 반영 | `host/experiences` 페이지 감도에 맞춰 절제된 라인 아이콘, 넉넉한 여백, 낮은 정보 밀도, 큐레이션 중심 카피로 톤앤매너 보정 |
| 🟡 CTA 구조 정리 | `모든 체험 보기` CTA를 밑줄 링크에서 방향성 있는 인라인 액션으로 변경하고, 섹션 상단에 `Curated on Locally` 라벨 추가 |
| ✅ 검증 | `npx tsc --noEmit` 통과 |

## v3.37.7 — [커뮤니티] 기본 썸네일 고정 + 작성자명 fallback 정리

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 리스트 썸네일 레이아웃 고정 | `PostListCard.tsx`에서 이미지 유무와 관계없이 동일한 68x68 썸네일 박스를 항상 렌더링하도록 변경. 이미지가 없으면 중성 배경 위에 `/images/logo-black-transparent.png`를 중앙 `object-contain`으로 표시해 제목 시작선이 밀리지 않게 정리 |
| 🔴 로컬리 콘텐츠 fallback 통일 | `PostGridCard.tsx`의 무이미지 fallback을 제목 텍스트 카드에서 로컬 로고 표시 방식으로 교체해 커뮤니티 전역 기본 이미지 규칙을 통일 |
| 🔴 작성자명 fallback 보정 | 커뮤니티 목록/상세/댓글/UI 전반에서 `profiles.full_name -> profiles.name -> 로컬리 유저` 우선순위를 공통 헬퍼로 통일. 기존 `익명`, `유저` fallback 제거 |
| 🟡 프로필 조회 필드 확장 | `community page`, `/api/community`, `/api/community/comments`, 상세 페이지의 profiles 조회에 `full_name` 포함. `Profile` 타입에도 `full_name?: string` 추가 |
| ✅ 검증 | `npx tsc --noEmit` 통과 |

## v3.37.6 — [커뮤니티] 전체보기 기본화 + 글쓰기 모던 UI + 동행 날짜 모달

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 검색 기본 카테고리 `전체보기` | 커뮤니티 메인 기본 카테고리를 `all`로 변경하고, 검색바/탭 첫 항목에 `전체보기` 추가. `all`은 category filter 없이 전체 피드를 조회 |
| 🔴 글쓰기 카테고리 정리 | `궁금해요`, `일정이 맞아요` 같은 보조 문구 제거. 작성 카테고리를 `Q&A / 동행 구하기 / 꿀팁 / 로컬리 콘텐츠` plain label로 통일 |
| 🔴 로컬리 콘텐츠 작성 오픈 | `PostEditor`와 `/api/community/posts` 허용 카테고리에 `locally_content` 추가하여 일반 작성도 가능하게 변경 |
| 🔴 글쓰기 화면 리디자인 | `PostEditor.tsx`를 모바일 full-screen 스타일에서 중앙 카드형 작성 화면으로 교체. 카테고리 pill 선택, 정리된 제목/본문/이미지 업로드 UI 적용 |
| 🔴 동행 날짜 모달 달력 | 동행 글의 `type=date` 입력 제거. 기존 `DatePicker` 비주얼을 재사용한 단일 날짜 선택 모달로 교체하고 `single` 모드 추가 |

## v3.37.5 — [커뮤니티] 검색바 모던 캡슐형 리디자인

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 검색바 전면 리디자인 | `CommunitySearchControls.tsx`의 `select + input + select + button` 폼 구조를 제거하고, 데스크탑은 단일 캡슐형 검색 오브젝트로 재구성 |
| 🔴 데스크탑 팝오버 필터 | 카테고리/정렬을 native select 대신 rounded pill trigger + lightweight popover로 교체. `ESC` 및 외부 클릭 닫기 지원 |
| 🔴 모바일 직접 선택 칩 | 모바일은 1행 검색 입력 + 2행 카테고리 칩 + 정렬 segmented pill 구조로 분리하여 터치성과 가독성 개선 |
| 🟡 탭 위계 보정 | `CommunityCategoryTabs.tsx` active/non-active 대비를 완화해 검색바가 메인 컨트롤로 읽히도록 조정 |
| 🟡 기능 계약 유지 | `category/q/sort` URL query, 검색 submit, 카테고리/정렬 즉시 반영 로직은 그대로 유지 |

## v3.37.4 — [커뮤니티] 검색바 도입 + 카테고리 문맥 유지 + Q&A 잔존 UI 제거

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 피드 상단 CTA 검색바 전환 | 커뮤니티 메인 상단 작성 유도 박스를 검색 UI로 교체. 카테고리 선택, 제목/내용 통합 검색, 최신순/인기순 정렬을 URL query 기반으로 지원 |
| 🔴 카테고리 문맥 유지 | 탭 전환, 글쓰기 진입, 목록→상세 이동, 상세 뒤로가기에서 `category/q/sort` 문맥을 유지하도록 링크와 BackButton 동작 정리 |
| 🔴 Q&A 반쪽 UI 제거 | 댓글의 `채택된 답변` 배지와 카드의 `답변대기` 뱃지 제거. 실제 구현되지 않은 채택 기능 흔적 비노출 처리 |
| 🟡 실데이터 인기글 전환 | 우측 사이드바와 모바일 위젯의 목업 인기글을 최근 7일 기준 실제 인기글 데이터로 교체 |
| 🟡 서버 검증 보강 | `/api/community`에 검색·정렬 파라미터 지원 추가, `/api/community/posts`에 작성 가능 카테고리 검증 추가 |

## v3.37.3 — [어드민 TEAM] 메모 본문 높이 고정 + 댓글 독립 스크롤

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 메모 본문 가독성 회귀 방지 | `TeamTab.tsx` 메모 카드 본문 뷰어를 `flex-1` 가변에서 `min-h/h/max-h` 고정형으로 전환하여 댓글이 길어져도 본문 크기가 줄어들지 않게 수정 |
| 🔴 댓글 영역 독립 스크롤 | 댓글 구역을 `flex flex-col h-*`로 고정하고, 댓글 목록만 `flex-1 min-h-0 overflow-y-auto`로 분리. 입력창은 `shrink-0`로 고정해 본문/댓글 비율 안정화 |
| 🟡 핀셋 범위 유지 | 메모 탭 UI 레이아웃 클래스만 조정, 댓글 등록/실시간/DB/API 로직은 미변경 |

## v3.37.2 — [어드민 맞춤의뢰] Service Requests 라벨 줄바꿈 방지 핀셋 수정

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 상태/배지 텍스트 줄바꿈 방지 | `ServiceAdminTab.tsx` All Requests 행의 결제수단/의뢰상태/결제상태/정산 배지에 `text-[9px] md:text-[10px]` + `whitespace-nowrap` 적용 |
| 🔴 액션 버튼 라벨 정리 | 행 액션의 `강제 취소` 버튼 라벨을 `취소`로 변경하고 버튼 텍스트도 `text-[9px] md:text-[10px]` + `whitespace-nowrap`로 통일 |
| 🟡 회귀 안전 범위 고정 | UI 클래스/라벨만 수정, 결제/환불/API/상태 전이 로직은 미변경 |

## v3.37.1 — [팀 워크스페이스] Shift+Enter 버그 수정 + 메모 줄바꿈 + 댓글 표시 영역 확장

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 Shift+Enter 버그 수정 | 팀 할 일/메모 댓글 textarea onKeyDown에서 `e.shiftKey` → `native.shiftKey` 로 변경. `if (e.key === 'Enter') { if (native.shiftKey) return; ... }` 패턴으로 재구성하여 Shift+Enter 줄바꿈 정상 동작 |
| 🔴 팀 메모장 내용 줄바꿈 | ReactMarkdown+remarkGfm은 단일 `\n`을 무시 → 렌더링 전 `memo.content.replace(/\n/g, '  \n')` 처리(Markdown 소프트 브레이크) |
| 🔴 팀 메모장 댓글 표시 영역 확장 | 댓글 목록 컨테이너 `max-h-32` → `max-h-64` (128px → 256px, 2배) |

## v3.37.0 — [팀 워크스페이스] 줄바꿈 지원 + 메모 댓글 입력 확장

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 팀 할 일 줄바꿈 | `todo.content` 표시에 `whitespace-pre-wrap break-words` 추가 |
| 🔴 팀 할 일 댓글 줄바꿈 | 댓글 표시 `<p>`에 `whitespace-pre-wrap break-words` 추가 |
| 🔴 팀 할 일 댓글 입력 | `<input type="text">` → `<textarea rows={2}>` 전환. Shift+Enter=줄바꿈, Enter=제출 |
| 🔴 팀 메모장 댓글 줄바꿈 | 댓글 표시 `<p>`에 `whitespace-pre-wrap break-words` 추가 |
| 🔴 팀 메모장 댓글 입력 확장 | `<input type="text">` → `<textarea rows={4}>` 전환(약 2배 높이). Shift+Enter=줄바꿈, Enter=제출 |

---

## v3.36.0 — [맞춤의뢰] 호스트 프로필 모달 연락하기 기능 + 고객센터 커스텀 모달

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 ServiceRequestClient 호스트 프로필 모달 연락하기 | HostProfileModal의 "호스트에게 연락하기" 버튼에 `onContactHost` 콜백 연결. 클릭 시 ExpMainContent와 동일한 textarea 메시지 모달(z-[210], 모바일 bottom sheet h-[88dvh] / 데스크탑 max-w-[560px]) 표시. inquiry(experience_id=null) find-or-create 후 inquiry_messages insert → `/guest/inbox?hostId=X` 이동. |
| 🔴 고객센터 1:1 문의 커스텀 모달 | `help/page.tsx`의 `prompt()` + `confirm()` 브라우저 네이티브 팝업 제거. 동일한 디자인 커스텀 textarea 모달로 교체. 제출 성공 시 toast + `/guest/inbox` 이동. |

---

## v3.35.0 — [맞춤의뢰] 매칭 후 1:1 메시지·언어레벨·고객센터 링크 개선

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 매칭 완료 후 1:1 메시지 | `/api/services/start-chat` 신규 API — 매칭된 고객↔호스트 간 inquiry 생성(experience_id 없는 general 타입). 고객 뷰: "호스트에게 메시지" 버튼. 호스트 뷰: "고객에게 메시지" 버튼. |
| 🔴 언어 중복 표기 수정 | `profiles.languages` + `host_applications.languages` 혼용 중복 → `normalizeLanguageLevels`로 통합. 언어 배지에 레벨(`Lv.X 단계`) 병기. |
| 🟡 고객센터 링크 수정 | `/guest/inbox` → `/help`(admin_support 채팅 생성 페이지). |
| 🟡 i18n 2키 추가 | `msg_send_to_host`, `msg_send_to_customer` ko/en/ja/zh. |
| 🟡 `/guest/inbox` hostId 단독 파라미터 지원 | expId 없이 hostId만으로 기존 채팅 자동 선택. |
| 🟡 language_levels API 반환 | `/api/services/applications` — host_applications.language_levels select 추가. |

---

## v3.34.0 — [맞춤의뢰] 서비스 매칭 3차 개선 — i18n·리뷰·커스텀 모달·탭 UX·알림 도시 필터

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 i18n 9키 × 4언어 | `sr_appeal_message`, `sr_selected`, `sr_confirm_select_host`, `sr_selected_host_banner_title/desc`, `sr_selected_host`, `sr_not_selected_host`, `sr_select_host_fail/success` — ko/en/ja/zh 전부 추가. 키 원문 노출 완전 해결. |
| 🔴 호스트 후기수/평점 표시 | `/api/services/applications` GET — `reviews` 테이블 조회 추가. `review_count`/`review_avg` enriched 후 반환. 지원자 카드 + 호스트 프로필 모달에 별점·후기수 정상 표시. |
| 🔴 커스텀 confirm 모달 | `ServiceRequestClient.tsx` — `window.confirm()` 제거. `confirmTarget` state + `handleConfirmSelect` 분리. 호스트 이름 표시하는 커스텀 오버레이 모달로 교체 (z-[200]). |
| 🔴 호스트 선택 후 페이지 갱신 | `router.refresh()` → `router.push(\`/services/\${requestId}\`)` 교체. 클라이언트 useEffect 재실행되어 상태 즉시 반영. |
| 🟡 호스트 대시보드 탭 개선 | `ServiceJobsTab.tsx` — 기본 탭 `my-applications`으로 변경. 탭 순서 내 지원 → 열린 의뢰 → 진행중. 카드 디자인: selected=파란 그라디언트, pending=amber 테두리. 금액 하드코딩 제거 → `total_host_payout` 사용. |
| 🟡 알림 도시 필터 | `nicepay-callback/route.ts` — 결제 완료 시 experiences 테이블 기준으로 해당 도시 보유 호스트만 필터링 후 알림 발송. `reqCity` 미존재 시 기존 전체 발송 동작 유지. |

---

## v3.33.0 — [맞춤의뢰] 서비스 매칭 2차 개선 — 호스트 모달·어드민 수정·재무지표·Master Ledger 통합

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 i18n 키 5개 추가 | `btn_apply`, `sr_application_pending`, `sr_customer_reviewing`, `sr_no_reviews`, `btn_select_host` — ko/en/ja/zh 4개 언어 모두 추가. 키 문자열 그대로 노출되던 문제 해결. |
| 🔴 호스트 프로필 모달 연결 | `ServiceRequestClient.tsx` — 지원자 카드 클릭 시 `HostProfileModal` 오픈. `ServiceApplicationWithProfile` 타입에 `created_at`, `profession`, `dream_destination`, `favorite_song` 추가. `/api/services/applications` GET select 쿼리에 해당 필드 추가. |
| 🟡 어드민 서비스의뢰 수정 기능 | `app/api/admin/service-requests/route.ts` 신규 (PATCH). `ServiceAdminTab.tsx`에 편집 모달(제목+설명) 및 ✏️ 버튼 추가. |
| 🟡 어드민 재무 지표 추가 | `ServiceAdminTab.tsx` — AllRequestsTab 테이블에 `호스트 지급액` · `순수익` 컬럼 추가. KPI 카드 6개로 확장(호스트 지급액 총계, 순수익 추가). |
| 🟠 Master Ledger service_bookings 통합 | `MasterLedgerTab.tsx` — 컴포넌트 마운트 시 `/api/admin/service-bookings` 병렬 fetch, 정규화 후 일반예약과 통합 정렬. Type 컬럼(일반예약/서비스의뢰 배지) 추가. KPI, CSV 다운로드 모두 통합 계산. 서비스의뢰 상세 클릭 시 관리 액션 버튼 미노출(서비스 의뢰 탭 안내 표시). |

---

## v3.32.0 — [어드민 TEAM] 중복 댓글 방지·읽음처리 RPC·카운트 경량화

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 중복 댓글 방지 1차 | `TeamTab.tsx`에 task별 전송 in-flight 락 추가, 전송 중 입력/버튼 비활성화, IME 조합 입력 Enter 무시 처리. |
| 🔴 Realtime 과부하 완화 | `TeamTab.tsx`의 `admin_task_comments` 구독을 `INSERT/DELETE`로 축소하고, 현재 task 집합 외 이벤트 무시 + 200ms 디바운스 재조회 적용. |
| 🔴 읽음처리 UPDATE 루프 제거 | `GlobalTeamChat.tsx`에서 메시지별 UPDATE 반복을 제거하고 `mark_room_messages_read` RPC 1회 호출 방식으로 전환. |
| 🟡 사이드바 경량화 | `/api/admin/team-counts` 신규 추가, Sidebar TEAM 실시간 뱃지는 경량 API만 호출하도록 분리. `/api/admin/sidebar-counts`는 운영 카운트 중심으로 단순화. |
| 🟡 TEAM 탭 선로딩 제거 | `admin/dashboard/page.tsx`에서 `TEAM/CHATS/SERVICE_REQUESTS` 탭은 `useAdminData()` 미호출 구조로 분리하여 초기 부하 완화. |
| 🟡 DB 마이그레이션 | `docs/migrations/v3_29_0_team_workspace_stability.sql` 추가: `admin_task_comments.client_nonce`, partial unique index, `mark_room_messages_read` RPC. |
| ✅ 검증 | `npx tsc --noEmit` 통과, `npx next build --webpack` 통과, 원격 DB에서 `client_nonce` 컬럼 조회 및 `mark_room_messages_read` RPC 응답(0건 업데이트) 확인. |

---

## v3.31.9 — [맞춤의뢰] 서비스 매칭 시스템 검수 수정

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 버그: 캘린더 요일 헤더 "day_sun/day_mon..." 그대로 노출 | `IntroClient.tsx:372` — `t('day_sun')` 등 존재하지 않는 키 사용으로 키 문자열 자체가 렌더링됨. `[0,1,2,3,4,5,6].map(i => t('day_'+i))` 패턴으로 교체. |
| 🔴 정책 위반: 호스트 잡보드에서 고객 결제금액 노출 | `ServiceJobsTab.tsx` — 잡보드 목록에 `total_customer_price`(₩35,000×hours) 표시로 수수료율 역산 가능. `total_host_payout`으로 교체 및 색상도 emerald로 통일. |
| 🟡 어드민 서비스 정산: 고객/호스트 이름 미표시 | `api/admin/service-bookings/route.ts:47` — `profiles.name` 컬럼 미존재 오류. `full_name`으로 수정. |

---

## v3.31.8 — [메시지] 채팅 버그 3종 수정 및 실시간 구독 안정화

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 버그: 읽음 시간 두 번 표시 | `InquiryChat.tsx` / `guest/inbox/page.tsx` 모두 "읽음 {read_at}" 표시 시 `created_at` 시간이 항상 추가 렌더링되는 구조적 오류. 조건 분기를 `is_read=false → 1+created_at`, `is_read=true+read_at → 읽음 read_at만`, `is_read=true+read_at없음 → created_at만`으로 정리. |
| 🔴 버그: 프로필 사진 없는 게스트 자리에 사이트 로고 표시 | `InquiryChat.tsx`의 `secureUrl` fallback이 `/images/logo.png`로 설정돼 있어 아바타 3곳(목록/헤더/메시지)에 로고 노출. `avatar_url` 존재 여부에 따라 `<Image>` vs `<User>` 아이콘 조건부 렌더링으로 교체. |
| 🔴 버그: 실시간 메시지 미수신 (새로고침 필요) | `useChat.ts`의 Realtime useEffect 의존성에 `selectedInquiry`(state)와 `fetchInquiries`의 `inquiries.length` 의존이 있어, 채팅방 전환 및 문의 목록 변경 시마다 채널이 재구독되며 메시지 누락 발생. `inquiriesRef` / `selectedInquiryRef`를 도입해 핸들러 내 최신 값 참조를 ref로 분리 → realtime effect에서 `selectedInquiry` 제거, `fetchInquiries` 의존성에서 `inquiries.length` 제거, `loadMessages` 의존성에서 `inquiries` 제거. 채널이 사용자 변경 시에만 재구독되도록 안정화. |

---

## v3.31.7 — [메시지] 게스트↔호스트 메시지 자동 연결 수정

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 버그: 게스트 나의 예약 메시지 버튼 → 호스트 연결 안됨 | `TripCard.tsx`가 `/guest/inbox?hostId=...`만 전달하고 `expId` 누락 → inbox가 `hostId+expId` 둘 다 있어야 자동 연결하므로 빈 목록만 표시. `expId`, `expTitle` URL 파라미터 추가. |
| 🔴 버그: 호스트 예약관리 메시지 버튼 → 게스트 연결 안됨 | `InquiryChat.tsx`가 `guestId`로 기존 문의를 찾지 못하면 아무 것도 열지 않음(호스트 선제 채팅 불가). `/api/host/start-chat` 신규 API 생성(체험 소유 검증 + service_role로 inquiry 생성 또는 기존 반환). `ReservationManager.tsx`에 `expId` 추가, `InquiryChat.tsx`에 자동 생성 후 연결 로직 추가. |

---

## v3.31.6 — [어드민 핫픽스] Master Ledger 예약 목록 미노출 수정

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 버그: Master Ledger 예약 목록 완전 비어있음 | **근본 원인:** `useAdminData.ts`에서 `bookings` 테이블을 일반 브라우저 JWT 클라이언트로 직접 SELECT 조회하여 RLS가 본인 예약만 허용 → 어드민이 자신이 예약한 것 없으면 0행 반환. |
| 🔧 신규 API 생성 | `app/api/admin/bookings/route.ts` — `createAdminClient()`(service_role, RLS 우회)로 bookings 전체 조회. 페이지네이션(`from`, `to`) 지원. |
| 🔧 useAdminData.ts 교체 | 초기 로딩(`fetchInitialData`)과 더보기(`loadMoreBookings`) 모두 `/api/admin/bookings` API 경유로 전환. |
| 🔧 host-applications API 인증 버그도 수정 | `host-applications/route.ts`에서 `supabaseServer`(일반 JWT)로 `admin_whitelist` 조회 → RLS 차단 버그. `createAdminClient` + `profiles.role`로 교체. |
| ✅ 빌드 검증 | `tsc --noEmit` exit 0 확인. |

---

## v3.31.5 — [어드민 핫픽스] 맞춤 의뢰 관리 탭 403 인증 버그 전수 수정

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 버그: 맞춤 의뢰 탭 전체 비어있음 | **근본 원인:** `service-bookings`, `sidebar-counts`, `service-confirm-payment`, `service-cancel` 4개 admin API가 `supabaseServer`(일반 JWT 클라이언트)로 `admin_whitelist` 테이블을 조회할 때 RLS 정책이 데이터를 차단 → `isAdmin = false` → 403 Forbidden 반환. |
| 🔧 수정: admin 인증 로직 전수 교체 | 4개 API의 `admin_whitelist`·`role` 조회를 `supabaseServer` → `createAdminClient()` (Service Role, RLS 우회)로 교체. `users` 테이블 → `profiles` 테이블로도 수정 (gemini.md §3.1 기준). |
| ✅ 빌드 검증 | `tsc --noEmit` exit 0 확인 완료. |

---

## v3.31.4 — [결제/어드민] 무통장 입금 UI 버그 픽스 및 RLS 권한 우회 서버 API 도입

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔧 버그: 관리자 '입금 확인' 버튼 미노출 | **원인:** `service_bookings` 테이블의 RLS 정책(`/sb_select/`)이 게스트와 호스트 본인만 조회 가능하도록 제한되어, 관리자 대시보드 로그인 시 데이터 빈 배열 반환. |
| 🔧 수정 1: RLS 우회 API 신설 | `useServiceAdminData.ts` 프론트엔드 직접 조회를 전면 제거하고, `createAdminClient`를 사용해 서버단에서 검증 후 데이터를 내려주는 `/api/admin/service-bookings` GET 라우트 생성 (Manual Join 로직 백엔드 이관). |
| 🔧 수정 2: 사이드바 카운트 우회 API | `Sidebar.tsx` 내부 알림 뱃지 쿼리들(`pending_bookings`, `service_bookings` 등)이 RLS에 막혀 0건으로 나오는 현상 해결을 위해 `/api/admin/sidebar-counts` GET 라우트 분리. |
| 📦 DB 스키마: `bookings` 결제수단 추가 | 기존 `bookings` 에 존재하지 않던 `payment_method` 컬럼 추가 (디폴트값 'card'). |
| 🔧 수정 3: 일반 예약 백엔드 파라미터 연동 | `app/api/bookings/route.ts` 에서 `create_booking_atomic` RPC 호출 시 새롭게 추가된 `payment_method` 파라미터 전달하도록 수정 (`supabase_add_payment_method_bookings_v3.9.3.sql` 작성). |

---

## v3.31.3 — [어드민 버그픽스] 팀 할 일 댓글 미표시 근본 원인 수정

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔧 버그: 팀 할 일 댓글 안 보임 | **근본 원인:** `MiniChatBar`(팀 미니채팅)가 동일한 `admin_task_comments` 테이블에 `task_id='00000000-...'` 고정 UUID로 채팅 메시지를 쌓아, `fetchComments()`의 `limit(100)`을 먼저 채워버려 실제 TODO 댓글이 fetch 결과에서 밀려나던 문제. |
| 🔧 수정 1: `fetchComments` 필터 추가 | `TeamTab.tsx` — 미니채팅 전용 UUID를 `.neq()` 로 제외하고 limit를 300으로 증가. |
| 🔧 수정 2: insert 후 즉시 갱신 | `addComment`, `addMemoComment` 함수에 insert 성공 후 `fetchComments()` 직접 호출 추가 — Realtime 구독 지연/환경 차이 대응. |

---

## v3.31.2 — [보안 및 규정 준비] Supabase Linter 1차 해결 (Search Path & 비밀번호 정책)

**작업일:** 2026-03-04

| 항목 | 내용 |
|------|------|
| 🔒 보안 패치 | Supabase 보안 경고 `Function Search Path Mutable` (12건) 해결을 위한 `search_path=public` 강제 세팅 SQL 마이그레이션 파일 작성 및 적용 |

---

## v3.31.1 — [런칭 준비] 푸터 사업자 정보 노출 & Web Analytics 연동

**작업일:** 2026-03-04

| 항목 | 내용 |
|------|------|
| ✨ 신규 기능 | `app/layout.tsx` 에 `@vercel/analytics` 컴포넌트를 추가하여 서버 재부팅 없이 실시간 방문자 및 트래픽 분석(Analytics) 연동 완료 |
| 🛠️ 법적 요건 | `SiteFooter.tsx` 하단에 정식 런칭 및 PG사 심사에 필수인 사업자 정보(상호, 대표, 사업자번호, 통신판매업, 주소, 이메일, 개인정보책임자) 하드코딩 추가 |

---

## v3.31.0 — [커뮤니티] 100% 무료 자동화 봇 아키텍처 구축 (게시물/댓글)

**작업일:** 2026-03-04

| 항목 | 내용 |
|------|------|
| ✨ 신규: AI 코어 모듈 | `@google/generative-ai` 설치 및 `generateFriendlyComment`, `generateAutoPost` 유틸 생성 (Gemini 1.5 Flash 무료 API 기반) |
| ✨ 신규: 자동 접속 API | `GET /api/bot/auto-post` (여행 꿀팁/날씨 자동 포스팅 API), `GET /api/bot/auto-comment` (댓글 0개인 글에 매직 댓글 생성 API) 신설 |
| ✨ 신규: 봇 스케줄러 | `.github/workflows/community-bot.yml` — 매일 1회 글 작성, 매일 2회 댓글 스캔 Github Actions 설정 |
| 🛠️ 도구: DB 봇 계정 | `supabase_bot_setup.sql` 봇 마이그레이션 도구 작성 (도쿄 날씨봇, 맛집 헌터) |

---

## v3.30.0 — [커뮤니티] 상세 페이지 전면 개선 (버그 5종 수정 + UX 리뉴얼)

**작업일:** 2026-03-04

| 항목 | 내용 |
|------|------|
| 🔧 버그: 공유 버튼 먹통 | `ShareButton.tsx` 신설 — Web Share API 우선, fallback 클립보드 복사 + "복사됨" 2초 토스트 |
| 🔧 버그: 뒤로가기 로딩 없음 | `BackButton.tsx` 신설 — `useTransition` 로딩 스피너로 전환 피드백 |
| 🔧 버그: 유저 정보 null fallback | 아바타에 이니셜(첫 글자) 표시 추가, 닉네임 fallback '로컬리 유저' 유지 |
| 🔧 버그: 데스크탑 상세 페이지 좁음 | `max-w-[768px]` 단일 컬럼 → `max-w-7xl 2컬럼(8:4)` 재설계. 우측 광고 영역 플레이스홀더 |
| 🔧 버그: 피드 데스크탑 넛지박스 숨겨짐 | `hidden lg:block` 데스크탑 넛지박스 피드 상단에 복구 |
| ✨ UX: 제목 최상단 배치 | 제목 → 유저정보 순서로 변경 (데스크탑/모바일 공통) |
| ✨ UX: 답변대기 뱃지 제거 | Q&A `isQna` 뱃지 완전 제거 |
| ✨ UX: 이전글/다음글 네비게이션 | 같은 카테고리 인접 게시글 조회 → 댓글 하단 배치 |
| ✨ UX: 모바일 UI 소형화 | 유저 아바타 `w-9 h-9`, 닉네임 `text-[13px]`, 넛지박스 패딩 `p-3`, FAB `w-12 h-12` |
| ✨ UX: 광고 영역 | 데스크탑 우측 사이드바 + 모바일 댓글 하단 플레이스홀더 |

---

## v3.29.2 — [커뮤니티] 상세 페이지 댓글 500 오류 + sticky 헤더 위치 버그 수정


**작업일:** 2026-03-04

| 버그 | 원인 | 수정 파일 |
|------|------|---------|
| 댓글 작성/조회 500 오류 (`profiles_1.name does not exist`) | `profiles:user_id(name, avatar_url)` Supabase FK join alias가 내부적으로 `profiles_1` 로 생성되어 컬럼 미존재 | `api/community/comments/route.ts` — GET/POST 모두 join 제거, profiles 별도 조회로 변경 |
| 상단 헤더가 80px 아래에 기괴하게 고정 | `sticky top-[80px]` — SiteHeader 없는 상세 페이지에서 의미없는 오프셋 | `community/[id]/page.tsx` — `top-0`으로 수정 |

---

## v3.29.1 — [커뮤니티] 리스트 피드 원 블록 화이트 보드 스타일 적용


**작업일:** 2026-03-04

- `CommunityFeed.tsx`: 일반 탭 리스트 래퍼에 `bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden` 적용 → 전체 피드가 하나의 하얀 카드 안에 담기는 구조
- `PostListCard.tsx`: 개별 아이템 스타일 정리
  - 바깥 테두리/그림자 제거
  - `border-b border-gray-100 last:border-0` 로만 행 구분
  - `hover:bg-gray-50 transition-colors` hover 강조
  - `px-5` 내부 패딩 통일
- 데이터 패칭·무한스크롤 로직 완전 무손실

---

## v3.29.0 — [커뮤니티] 하이브리드 UI (리스트형 + 그리드형) 전면 개편


**작업일:** 2026-03-04

### 변경 내용

| 파일 | 변경 |
|------|------|
| `CommunityCategoryTabs.tsx` | 4번째 탭 **✨ 로컬리 콘텐츠** 추가, 활성 탭 scale 애니메이션 |
| `PostListCard.tsx` (신설) | Q&A·동행·꿀팁 전용 F-Pattern 수평 리스트형 카드 (좌측 썸네일 + 우측 정보) |
| `PostGridCard.tsx` (신설) | 로컬리 콘텐츠 전용 인스타그램형 그리드 카드 (aspect-square + hover 오버레이) |
| `CommunityFeed.tsx` | `category === 'locally_content'` → 그리드 3/4칸, 나머지 → 리스트 조건부 렌더 |
| `page.tsx` | `locally_content` 카테고리 허용 범위에 추가, 넛지 박스 콘텐츠 탭에서 숨김 |
| `RightSidebar.tsx` | 앱 CTA 배너 삭제 → **⚡ 실시간 업데이트** 위젯으로 교체 (Supabase Realtime INSERT 구독, 그린 Live Indicator) |

### 설계 원칙
- 무한스크롤 / 데이터 패칭 로직 **완전 무손실**
- 모바일 FAB 기존 코드 유지

---

## v3.28.0 — [팀챗] Chrome 모바일 성능 + 리액션 + 읽음처리 전면 개선


**작업일:** 2026-03-04

### Phase 1 — Chrome 모바일 버그 수정 (DB 변경 없음)

| 버그 | 원인 | 수정 |
|------|------|------|
| 채팅창 열 때마다 느려짐 | `isOpen`이 useEffect deps → 토글마다 Supabase 채널 재구독 | `isOpenRef` 도입, deps에서 `isOpen` 제거 |
| 최초 오픈 시 스크롤 안 됨 | 모바일 메시지가 `{isOpen && ...}` 조건부 렌더 → `mobileScrollRef = null` | 항상 렌더 + CSS `overflow: hidden` 제어로 변경 |
| 간헐적 중복 메시지 | content 기반 temp_ 중복 제거 → 동일 내용 메시지 오작동 | `author_id + created_at 5초 이내` 기반으로 교체 |

### Phase 2 — 메시지 리액션 ❤️ ✅ 🙏

- hover/tap 시 🙂 버튼 → 리액션 피커 팝업
- 리액션 집계 버블 (내 리액션 강조 표시)
- Realtime UPDATE 구독 추가 → 다른 팀원 리액션 실시간 반영
- **DB 마이그레이션 필요:** `reactions JSONB` 컬럼 (`docs/migrations/v3_28_0_team_chat_reactions.sql`)

### Phase 3 — 읽음처리 DB 기반

- 기존 localStorage 방식 → `read_by TEXT[]` DB 컬럼으로 업그레이드
- 채팅 오픈 시 자신의 ID를 `read_by`에 추가
- 내가 보낸 마지막 메시지 아래 "읽음 N명" 표시
- **DB 마이그레이션 필요:** `read_by TEXT[]` 컬럼 (동일 SQL 파일)

> [!IMPORTANT]
> **Supabase 콘솔에서 마이그레이션 실행 필요**
> `docs/migrations/v3_28_0_team_chat_reactions.sql` 파일을 Supabase SQL Editor에서 실행하면 Phase 2~3 기능이 활성화됩니다.
> Phase 1 버그 수정은 DB 변경 없이 이미 적용됩니다.

### 회귀 위험 분석 결과

| 파일 | 영향 | 판정 |
|------|------|------|
| `TeamTab.tsx` | `select('*')` 후 JS 렌더 → 새 컬럼 단순 무시 | ✅ 없음 |
| `MiniChatBar.tsx` | 동일 패턴 | ✅ 없음 |
| `Sidebar.tsx` | COUNT만 조회 | ✅ 없음 |

---

## v3.27.6 — [커뮤니티 UI] 하단 탭 복원 + 프로필 메뉴 위치 + 이미지 비율 수정


**작업일:** 2026-03-04

| 항목 | 변경 |
|------|------|
| 모바일 하단 탭 | 커뮤니티 탭 제거 → 5탭 복원 (검색/위시리스트/**여행**/메시지/프로필) |
| 프로필 메뉴 커뮤니티 위치 | 그룹3(Locally 섹션) → **그룹1(위시리스트 바로 아래)** 으로 이동 |
| 데스크탑 이미지 비율 버그 | `aspect-square + w-full + max-h` 3중 충돌 → `max-w-xs md:mx-auto + aspect` 로 해결 |

**원인 설명 (이미지 비율 버그):**
데스크탑 피드 카드 너비 ~ 560px 에서 `w-full` + `aspect-square` 가 560×560px 거대 컨테이너를 만들고,  
`max-h-72(288px)` 가 높이를 강제로 잘라내어 비율이 왜곡됨.  
→ `md:max-w-xs(320px)` 로 너비를 먼저 제한 후 `aspect` 로 높이를 결정하여 충돌 제거.

---

## v3.27.5 — [커뮤니티 UI] 모바일 내비게이션 개선 + 이미지 비율 최적화


**작업일:** 2026-03-04

### 변경 내용

| 항목 | 이전 | 이후 |
|------|------|------|
| 모바일 하단 탭 커뮤니티 아이콘 | `Globe` | `Users2` (데스크탑과 동일) |
| 프로필 메뉴 커뮤니티 링크 | 모달 → `/company/community` | `/community` 직접 이동 |
| `/app/company/community/` | 존재 | **삭제** (폐기) |
| 이미지 비율 (피드 카드) | `aspect-video` (16:9) | 1장: 4:5/1:1 자동 감지, 2~3장: 1:1 그리드 |
| 이미지 비율 (상세 페이지) | 비율 없이 `w-full` | 동일 4:5/1:1 자동 감지 |

### 신규 파일
- `app/community/components/PostImages.tsx` — `onLoad` 기반 이미지 비율 자동 감지 클라이언트 컴포넌트

### 이미지 압축 유틸 현황 (변경 없음, 정상 동작 확인)
- `maxSizeMB: 1` / `maxWidthOrHeight: 1280` / JPEG 변환
- 4:5 원본 이미지도 비율 유지한 채 리사이즈됨 ✅

---

## v3.27.4 — [피드 갱신] 글 등록 후 커뮤니티 피드에 새 글이 안 보이는 버그 수정


**작업일:** 2026-03-04

### 원인 3가지 (동시 발생)

| # | 원인 | 수정 |
|---|------|------|
| 1 | `posts/route.ts`에 `revalidatePath('/community')` 미호출 — 글 등록 후 Next.js 라우터 캐시가 구 피드 서빙 | `revalidatePath('/community')` 추가 |
| 2 | `community/page.tsx`에 `dynamic='force-dynamic'` 없음 — Vercel 엣지 캐시가 구 SSR 결과물 서빙 | `export const dynamic = 'force-dynamic'` 추가 |
| 3 | `page.tsx` + `api/community/route.ts`가 단일 join 쿼리 사용 — join 에러 시 `data=null`→ 빈 피드 | 각각 join 분리 패턴(① post → ② profiles → ③ experiences 별도 조회)으로 전환 |

### 수정 파일
- `app/api/community/posts/route.ts` — `revalidatePath('/community')` 추가
- `app/community/page.tsx` — `force-dynamic` + SSR 쿼리 join 분리
- `app/api/community/route.ts` — 무한스크롤 API join 분리

---

## v3.27.3 — [핵심버그] 커뮤니티 게시글 상세 404 근본 원인 수정


**작업일:** 2026-03-04

### 진짜 원인 (RSC 페이로드 분석으로 특정)

```
generateMetadata (join 없는 단순 쿼리)   → ✅ 포스트 데이터 정상 반환
page 컴포넌트  (profiles + experiences join) → ❌ 쿼리 에러 → data=null → notFound()
```

**단일 쿼리에서 join 에러가 발생해도 `data=null`로 조용히 실패하고, `!post` 체크만 하기 때문에 `notFound()`가 무조건 호출됨.** `error` 필드를 무시한 것이 근본 원인.

### 수정 내용

`community/[id]/page.tsx` 쿼리를 **3단계로 분리**:

1. **① post 단독 조회** (`select('*')`, join 없음) — 실패 시에만 `notFound()`
2. **② profiles 별도 조회** — 실패해도 렌더에 영향 없음 (폴백: '로컬리 유저')  
3. **③ experiences 조건부 조회** — `linked_exp_id`가 있을 때만 실행

→ post 자체가 DB에 있는 한 **절대 404가 나지 않음**.

---

## v3.27.2 — [보안] 어드민 팀 협업 이메일 무단 발송 버그 수정


**작업일:** 2026-03-04

### 버그 원인 (전수조사)

`/api/admin/notify-team` API에서 **이중 소스(Dual-Source)** 로 이메일을 수집하는 로직이 루트 원인:

```
① supabaseAdmin.from('users').eq('role', 'admin')  → profiles 경유로 이메일 추출
② supabaseAdmin.from('admin_whitelist').select('email')
→ 두 소스를 Array.from(new Set([...① , ...②])) 합산
```

`admin_whitelist`에서 삭제해도 **`users.role='admin'`이 남아있는 한 ① 소스에서 계속 이메일이 수집**되어 삭제된 관리자에게 무한히 알림 메일이 발송되었음.

### 수정 내용

- **`app/api/admin/notify-team/route.ts`**: `users.role` 소스 완전 제거. `admin_whitelist` 단일 소스로 교체.
- **이후 팀원 관리 원칙**: 추가/삭제는 반드시 `admin_whitelist` 테이블에서만 수행.

### 트리거 지점 (이메일 발송 유발 액션)

팀 협업에서 아래 액션 시 notify-team API 호출됨:
- TeamTab: 할 일 추가, 할 일 댓글, 메모 신규 작성, 메모 댓글
- GlobalTeamChat: 채팅 메시지 전송

---

## v3.27.1 — 커뮤니티 버그 핫픽스 (SiteHeader 사라짐 / 게시글 상세 404 / 메뉴 텍스트)


**작업일:** 2026-03-04

### 원인 분석

| 버그 | 근본 원인 | 수정 |
|------|-----------|------|
| SiteHeader 사라짐 | 이 프로젝트는 `layout.tsx`에 `SiteHeader`가 없고 **각 페이지마다 직접 import·렌더링**하는 패턴. v3.27.0 작업 중 `community/page.tsx`에서 중복 제거 목적으로 SiteHeader까지 삭제함. | `community/page.tsx`에 `SiteHeader` import 및 렌더링 복원 |
| 게시글 상세 Vercel 404 | `community/[id]/page.tsx`의 Supabase 쿼리에서 `profiles:user_id(name, avatar_url, role)` — `profiles` 테이블에 `role` 컬럼이 존재하지 않아 쿼리 전체가 에러 반환 → `post`가 `null` → `notFound()` 호출 → Vercel 404 페이지 출력 | `profiles:user_id` select에서 `role` 제거. 미사용 `ShieldCheck` import 정리 |
| 우측 드롭다운 'community' 텍스트 | `LanguageContext.t()` 함수가 번역 키가 없을 때 키 이름(`'community'`)을 문자열로 반환하는 패턴이어서 `\|\| '커뮤니티'` fallback이 작동하지 않음 | SiteHeader 메뉴 텍스트를 `'커뮤니티'`로 하드코딩 |

---

## v3.27.0 — 커뮤니티 UI 프리미엄 리뉴얼 (에어비앤비/트리플 스타일 7:3 반응형 레이아웃)


**작업일:** 2026-03-04

기존 API 로직과 헤더/푸터를 완벽히 보존한 채, 커뮤니티 UI를 에어비앤비/트리플 스타일의 프리미엄 반응형 7:3 레이아웃으로 전면 리팩토링했습니다.

### [Layout] 7:3 반응형 2단 그리드 신설
- `page.tsx` 전면 재작성: `bg-[#F7F7F9]` 배경 + `grid-cols-12` (피드 8칸 / 사이드바 4칸) 적용.
- `SiteHeader` / `SiteFooter` 100% 보존. 기존 모바일 단일 컬럼 레이아웃은 `hidden lg:flex`로 분기.

### [Component] RightSidebar.tsx 신설
- `sticky top-28` 고정 사이드바에 4개 위젯 구성: 글쓰기 CTA(로즈 그라디언트 버튼), 주간 인기 체험 리스트, 지금 뜨는 라운지 글, 앱 다운로드 CTA.

### [Component] CommunityCategoryTabs.tsx 알약 탭 전환
- 밑줄 탭 → `rounded-full` 알약(Pill) 형태로 전환. 활성: `bg-black text-white`, 비활성: `bg-white text-gray-500 border border-gray-200`.

### [Component] PostCard.tsx 프리미엄 카드 리뉴얼
- `bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 active:scale-[0.99] transition-all` 카드 적용.
- 카드 헤더: `w-10 h-10` 원형 아바타(첫 글자 폴백) + 카테고리 뱃지. 푸터: 아이콘 인게이지먼트 + `border-t` 구분선.

### [Component] LinkedExperienceChip.tsx 세련된 미니 카드 업그레이드
- `bg-[#F7F7F9] hover:bg-gray-100 border border-gray-200 rounded-xl` + 가격 로즈 컬러 강조 + 썸네일 스케일 호버 효과.

### [UX] Empty State & Loading Skeleton 고도화
- **Empty State:** `MessageSquareDashed` 아이콘 + "첫 글의 주인공이 되어보세요!" + CTA 버튼 (`border-dashed rounded-2xl` 카드).
- **Shimmer Skeleton:** 새 카드 레이아웃(`rounded-2xl`)과 일치하는 `animate-pulse` 스켈레톤 3카드.

### [UX] 글쓰기 유도 넛지 + 모바일 FAB 추가
- 피드 상단에 글쓰기 유도 입력창 카드 (`/community/write` 라우팅).
- 모바일 전용 `fixed bottom-20 right-4 w-14 h-14 bg-[#FF385C]` 플로팅 버튼(FAB) 신설.

### Constraints 준수
- `limit(15)` + `IntersectionObserver` 무한 스크롤 로직 100% 무손실 보존.

---

## v3.26.3 — 커뮤니티 내비게이션 재배치



**작업일:** 2026-03-04

- **`SiteHeader.tsx`:** 상단 네비게이션에서 커뮤니티 링크 제거. 대신 우측 햄버거 드롭다운 메뉴 최상단 위치에 Users2 아이콘과 함께 삽입.
- **`SiteFooter.tsx`:** 하단 펋터 "커뮤니티" 링크를 `/company/community`(Mock 페이지)에서 실제 포럼 `/community`로 수정.

---

## v3.26.2 — 커뮤니티 Phase 4: 댓글 & 좋아요 시스템

**작업일:** 2026-03-04

- **댓글 API (`GET/POST /api/community/comments`):** 게시글별 댓글 조회와 포스팅 API. `.limit(100)` 에러 안전 펯지, 인증 후 INSERT.
- **좋아요 토글 API (`POST /api/community/likes`):** UNIQUE 제약 + DB 트리거로 `like_count` 자동 증감 요청.
- **`CommentSection.tsx`:** 내부 데이터 패치 + `Sticky` 하단 입력츸 UI. Q&A 선택 도구(is_selected) 지원.
- **`LikeButton.tsx`:** 정관적 UI 업데이트 + 실패시 롤백(Rollback) 보언.

---

## v3.26.1 — 커뮤니티 Phase 3: 글쓰기 & 상세보기 SEO

**작업일:** 2026-03-04

- **글쓰기 페이지 (`/community/write`):** 카테고리 선택(Q&A/동행/꿀팁), 사진(최대 3장) 첨부 기능. 업로드 전 `compressImage` 유틸 강제 적용으로 OOM 원천 차단.
- **글 상세 페이지 (`/community/[id]`):** SSR + `generateMetadata`로 개별 게시글 URL이 구글 검색 결과에 직접 노출.
- **글 작성 API (`/api/community/posts`):** `auth.uid` 서버 검증 후 `community_posts` INSERT. RLS 이중 방어 적용.

---

## v3.26.0 — 자체 커뮤니티 엔진 (Community Forum) Phase 1 & Phase 2 연동 성공

**작업일:** 2026-03-04

### 개요
Locally 플랫폼의 자생적 체류 시간 증대 및 검색엔진(SEO) 확장을 위한 **"100% 자체 제작 커뮤니티 엔진"**이 OOM(서버 다운) 방어 체계를 갖추고 성공적으로 연동되었습니다.

### [DB & Server] Phase 1 구조 셋업
- **OOM(서버 다운) 완벽 차단 구조:** 모든 API 및 Feed 렌더링에 `.limit(15)` + `Intersection Observer` 무한 스크롤 강제 적용. 수만 건의 데이터가 쏟아져도 관리자 대시보드처럼 메모리가 폭주하지 않습니다.
- **`community_posts`, `community_comments`, `community_likes` 테이블 신설 & 마이그레이션 적용 완료.**
- **안전한 권한 통제 (RLS):** 구글 크롤러와 모든 게스트는 읽을 수 있지만, 쓰기와 수정/삭제는 자신에게만 권한이 열려있도록 `Row Level Security` 다중 정책 셋업 완료.

### [Frontend UI] Phase 2 코어 연동
- **주요 페이지 라우팅 (`/community`):** 메인 피드 렌더링(`CommunityFeed.tsx`) 셋업. Q&A / 동행 / 꿀팁 카테고리 필터(`CommunityCategoryTabs.tsx`).
- **인게이지먼트 최적화 카드 (`PostCard.tsx`):** 현지 체험 상품 유도를 위한 `LinkedExperienceChip.tsx` (Rich Embeds) 개발 완료. 글을 읽다가 칩을 누르면 즉시 예약 상세 화면으로 빨려 들어갑니다.
- **Dynamic SSR SEO 완성:** `app/community/page.tsx`에 `generateMetadata`를 적용하여 탭 클릭 시마다 구글 봇에게 즉시 최적화된 URL을 제공합니다.
- **내비게이션 통합:** 데스크탑 `SiteHeader` 주요 네비게이션과 모바일 `BottomTabNavigation`의 정중앙에 100% 무손실로 메뉴 삽입. (화면 깜빡임이나 React Hydration 에러 없음)

---

## v3.25.6 — 다국어 동적 메타데이터(SEO) 적용 (feat/seo: implement middleware-based dynamic metadata for i18n)

**작업일:** 2026-03-04

### 개요
기존 구조를 완벽하게 유지한 채로, 구글 로봇과 해외 검색 엔진 유입을 극대화하기 위한 "무손실 다국어 개별 메타데이터(SEO)" 구조를 도입 성공했습니다.

### [Feature] 미들웨어 기반 헤더 인젝션 다국어 최적화
- **안전한 구조 보존:** `app/[locale]` 폴더 전환이라는 파괴적인 프레임워크 변경 없이, 기존 정적 라우팅 구조를 100% 보존하며 구현했습니다.
- **Middleware 언어 탐지:** `app/middleware.ts`에서 접속 URL의 언어 코드(`/ko`, `/ja`, `/zh`, `/en`)를 가로채어 비밀 헤더(`x-locally-locale`)로 서버단에 넘겨주는 로직을 주입.
- **Dynamic SEO Metadata:** `app/layout.tsx`에서 고정 타이틀/설명을 제거하고 `generateMetadata()` 엔진을 투입. 이 엔진이 미들웨어가 찔러준 헤더 언어를 읽고 즉시 현지화(Localization)된 타이틀(`Locally - 日本の現地ガイド`, `로컬리 Locally` 등)과 `hreflang` 태그를 동적으로 생성하여 구글 크롤러에게 제공하게 됩니다.

---

## v3.25.5 — 지난 여행 카드(PastTripCard) 썸네일 누락 핫픽스 (Hotfix)

**작업일:** 2026-03-04

### 개요
`/guest/trips` 페이지의 "나의 여행" 중 과거 여행 목록(`PastTripCard.tsx`)에서 썸네일 사진이 빈 회색 상자로 노출되는 UI 버그(Image Disappearance)를 해결.

### [Bugfix] 구형 사진 렌더링 스크립트 최신화
- **원인:** 진행 중인 예약 카드(`TripCard.tsx`)는 최신 다중 사진 스펙(`trip.photos`)을 바라보도록 앞서 업데이트되었으나, 과거 여행 카드(`PastTripCard.tsx`)는 예전 코드베이스로 방치되어 오직 텅 빈 `trip.image` 스트링만 조회하며 사진이 없다고 판정해버림.
- **수정:** 
  - `PastTripCard.tsx`의 이미지 렌더링 로직을 `trip.photos && trip.photos[0]` 우선 조회 방식으로 3줄 교체.
  - 만약 예전 방식의 사진 구조라면 `trip.image`를 띄우도록 Fallback을, 사진이 아예 없는 비정상 케이스라면 로컬리 표준 빈 이미지 아이콘인 `<Mountain />`이 뜨도록 UI 일관성 보완.

---

## v3.25.4 — 회원가입 500 에러 긴급 복구 및 프로필 동기화 트리거 안정성(Exception) 강화 (Hotfix)

**작업일:** 2026-03-04

### 개요
v3.25.3에서 적용한 DB 트리거(`handle_new_user`) 스크립트가, 프론트엔드에서 넘어오는 빈 문자열(`""`) 이나 비표준 날짜 텍스트를 Postgres `DATE` 타입으로 강제 형변환(Casting)하려다 파싱 에러(invalid input syntax for type date)를 일으켜, **회원가입 트랜잭션 전체가 500 에러와 함께 롤백되는 치명적인 장애**를 발생시킨 현상을 긴급 복구했습니다.

### [Bugfix] DB 트리거 500 롤백 방어 
- **원인:** 회원가입 시 생년월일(`birth_date`)이나 기타 선택 정보가 비어있거나(`""`) 유효하지 않은 형태로 전달될 경우, Postgres가 엄격한 타입 체크에 막혀 `INSERT INTO profiles` 자체를 튕겨내고 Supabase Auth까지 연쇄 실패하게 만들었음.
- **수정 (`supabase_profile_sync_v3_migration.sql` 배포):** 
  - `NULLIF(val, '')` 함수를 씌워 빈 문자열이 들어오면 전부 안전한 `NULL`로 치환하여 `DATE` 컬럼 삽입 에러를 우회하도록 방어벽 추가.
  - 트리거 내부 `BEGIN ... EXCEPTION WHEN others THEN ... END` 예외 처리 블록을 구축. 최악의 경우(날짜 포맷 에러 등)에도 트랜잭션 롤백 없이 **가입을 100% 무조건 성공**시키고 최소 필수 정보(이름, 이메일, 프로필사진)만이라도 먼저 Insert시키는 Fallback(플랜 B) 로직을 적용 완수.

---

## v3.25.3 — 회원가입 프로필 동기화 DB 트리거 누락 핫픽스 (Hotfix)

**작업일:** 2026-03-04

### 개요
v3.21.0에서 단행된 프로필 동기화 아키텍처(Postgres Trigger) 전환 시 누락되었던 필수 게스트 정보(휴대폰 번호, 생년월일, 성별) 컬럼 매핑을 추가하여 회원가입 시 데이터가 100% 정상적으로 `profiles` 테이블에 복사되도록 SQL 마이그레이션을 재작성했습니다.

### [Bugfix] DB 트리거(`handle_new_user`) 매핑 누락 및 오탈자 복구
- **원인:** 기존 `on_auth_user_created` 트리거가 `email`, `name`, `avatar_url`만 복사하고 프론트엔드에서 고생해서 받아온 `phone`, `birth_date`, `gender`를 무시(Drop)하여 가입 데이터가 공중분해되는 현상 및 `full_name` 컬럼 매핑 불일치 발견.
- **수정:** 
  - `supabase_profile_sync_v2_migration.sql` 스크립트를 작성하여 `handle_new_user` 트리거 함수 선언부 전면 교체(REPLACE).
  - 결과적으로 프론트(LoginModal)에서 `auth.signUp` 시 `user_metadata`에 실어 보낸 연락처, 생년월일, 성별, 이름이 계정 관리 페이지(`/account`)에 1:1로 렌더링되도록 백엔드 싱크 로직 정상화 완료.

---

## v3.25.2 — 게스트 썸네일 이미지 매핑 버그 및 Fallback 로직 핫픽스

**작업일:** 2026-03-03

### 개요
게스트의 예약 상세 내역 및 호스트 리뷰에서 이미지/프로필 사진이 제대로 표기되지 않고 "로고 사진이 화면을 가득 채우는" 치명적인 버그를 해결했습니다.

### [Bugfix] 게스트 예약 내역 데이터 API 누락 해결
- **원인 분석:** 게스트 예약 내역을 불러오는 API(`/api/guest/trips/route.ts`) 내부 쿼리에서 `experiences` 테이블을 조인할 때, 현대적인 포맷인 `photos` 배열 컬럼을 선택(`select`)하지 않고 구형 `image_url`만 가져옴으로써 사진 데이터가 프론트엔드로 전달되지 않고 있었습니다. 홈 화면에서 사진이 나오는데 예약 내역에서 안 나오던 근본적인 원인입니다.
- **수정:** API 쿼리에 `photos` 컬럼을 명시적으로 추가하고 `trip.photos`로 올바르게 데이터 매핑을 연결하여, 이제 호스트가 등록한 체험 사진들이 예약 탭에서도 문제없이 렌더링됩니다.

### [Fix] 원형 깨짐을 방지하는 모던 Fallback UI 복원
- **원인 분석:** 실제 프로필 사진이 없는 유저나 체험 데이터일 경우, 회사의 직사각형 로고(logo-black-transparent.png)를 원형 프레임이나 썸네일에 강제로 구겨 넣어 사진이 기괴하게 나오거나 텍스트가 잘리는 현상이 발생했습니다.
- **수정:** 
  1. `TripCard.tsx`: 체험 사진이 전부 지워졌거나 완전히 비어있는 최악의 경우, 로고 대신 깔끔한 회색 배경의 `Mountain` (풍경) 아이콘 구조로 대체했습니다.
  2. `HostReviews.tsx`: 게스트가 아바타 사진을 올리지 않은 경우, 투박한 로고 대신 Lucide의 `User` (사람 시루엣) 아이콘을 사용하여 일관되고 세련된 UI를 유지하도록 복원했습니다.

---

## v3.25.1 — 외부 이미지 도메인 허용 (Image Host 보안 정책 완화)

**작업일:** 2026-03-03

### 개요
외부 서비스에서 불러온 썸네일 등의 이미지가 렌더링될 때 발생하는 `unconfigured host` (400 Bad Request) 보안 에러 핫픽스입니다.

### [Fix] 외부 더미 이미지 서비스 종속성 제거 (안정성 강화)
- **문제 현상:** `next/image` 컴포넌트 사용 시 `via.placeholder.com` 등 외부 더미 이미지 서비스를 사용할 경우, Vercel Edge 서버에서의 DNS Resolve 실패(502 Bad Gateway) 문제와 더불어 실제 화면에 '400x400' 같은 글자가 노출되어 UX를 저해하는 현상 발생.
- **수정:** 
  1. 기존 `next.config.ts`의 `images.remotePatterns` 배열에 임시로 추가했던 외부 더미 이미지 도메인(`via.placeholder.com`, `placehold.co`)을 롤백(제거 대상 여부 검토)하려 했으나, 보험용으로 화이트리스트엔 유지.
  2. 실제 코드베이스(`TripCard.tsx`, `HostReviews.tsx`) 내부의 `[trip.image || 'https://placehold.co/...']` 구문을 Vercel 배포망 내부에 안전하게 캐싱되어 있는 정적 로컬 어셋인 `/images/logo-black-transparent.png`로 전면 교체하여 네트워크 에러 및 UI 품질 저하 문제를 완벽히 해결했습니다.

---

## v3.25.0 — System Performance & Image Compression Optimization

**작업일:** 2026-03-03

### 개요
플랫폼 내 이미지 압축 누락 구간과 어드민 대시보드 및 채팅에서 발생하던 치명적인 메모리 누수(OOM) 취약점을 보완하여 서버 과부하를 원천 차단했습니다.

### [PERF-1] 프리미엄 이미지 최적화 및 스토리지 과부하 방어
- **기존 문제:** `ReviewModal`, `ProfileEditor`, `HostRegisterPage`에서 고해상도 이미지를 원본 그대로 스토리지에 업로드하여 네트워크 업스트림 지연 및 브라우저 성능이 하락하는 취약점이 발견되었습니다.
- **수정:** 모든 누락된 업로드 폼에 `compressImage()` 파이프라인을 강제 적용하여 Storage 트래픽을 대폭 절감했습니다.

### [PERF-2] 무제한 쿼리(Limitless Query) 방어벽 구축 (OOM 차단)
- **기존 문제:** `useAdminData.ts` 및 `useChat.ts` 내부에서 `.limit()` 제어 없이 전체 테이블을 스캔하여 브라우저 크래시(Crash) 및 Vercel Timeout 위험이 높았습니다.
- **수정:** 어드민 페이지네이션 시스템을 갈아엎는 위험한 도박 대신, 무결성을 보장하는 "엔진 안전 제한(Engine Safety Limit)"을 도입했습니다.
  - `Admin Dashboard`: `reviews`, `profiles`는 5000개, `experiences`, `apps`는 3000개 제한 도입.
  - `Chat Inbox`: 전체 문의 내역 대신 최신 100개(`limit(100)`)만 스캔하도록 최적화.

---

## v3.24.4 — E2E 예약 파이프라인 정합성 패치 (Runtime Sync & UI 가이드)

**작업일:** 2026-03-03

### 개요
- **[UI/UX] 결제 대기 예약 뱃지 추가 (Host Dashboard):** 결제 이탈/무통장 입금 대기 등으로 아직 `PAID` 상태가 되지 못한 `PENDING` 예약에 대해, 숨김 처리 대신 호스트가 명확하게 인지할 수 있도록 예약 카드 최상단에 직관적인 "결제 대기중(PENDING)" 뱃지를 시각적으로 구분하여 추가했습니다.
- **[UI/UX] 호스트 취소 비즈니스 룰 안내 추가:** 호스트가 임의로 예약을 1-Click 취소할 수 없는 기획 의도를 시스템 스펙으로 굳히고, `PAID` 상태의 예약 카드 하단에 "예약 취소가 필요한 경우 게스트에게 메시지로 상황을 설명하고 취소를 요청해 주세요"라는 어드바이스 텍스트 영역을 추가하여 UX 데드엔드를 해소했습니다.
- **[Data Sync] Fake `completed` 상태 런타임 물리적 보정:** 게스트 마이페이지(`My Trips`)에서 과거 날짜의 호스트 예약 건에 대해 화면에만 `completed`로 가짜(Mocking) 응답하는 구조를 보완하여, 페이지 조회하는 순간 실제 DB를 Lazy Update 방식으로 즉시 `PATCH` 동기화시킴으로써 향후 리뷰 등 후속 프로세스의 에러 바운더리를 원천 제거했습니다.

---

## v3.24.3 — System Audit: 권한 검증 크래시 방어 및 결제 UX 개선

**작업일:** 2026-03-03

### 개요
- **[CRITICAL]** 일본 전화 대행 의뢰 백엔드 API 라우트(`.ts`) 내부에서 관리자 여부를 판별할 때, 유효하지 않은 `profiles.role` 컬럼을 조회하여 발생하는 치명적인 DB 500 에러(크래시)를 원천 차단했습니다. 로직을 `auth.users` 이메일과 `admin_whitelist`를 대조하는 안전한 방식으로 전면 교체했습니다.
- **[WARNING]** 이메일 렌더러 실패 시 DB에 에러 로그를 남길 때, 대상자 ID(hostId)가 없어 Null Constraint를 위반하던 알림 누락 현상을 타겟 이메일(Target Email) 기반 ID 조회 Fallback 구조를 추가하여 무결하게 수정했습니다.
- **[WARNING]** 사용자가 전화 대행 폼에서 '로컬리 웹 자체 결제' 트랙을 선택했을 때, 아무런 결제 플로우 없이 대기 상태로 끝나버리는 UX 데드엔드를 해결했습니다. 상세 페이지 내부에 결제 수수료와 전용 무통장 입금 계좌 정보를 안내하는 모듈을 삽입했습니다.
- **[OPTIMIZATION]** 플랫폼 성장 시 예상되는 메모리 및 DB 읽기 지연을 방지하기 위해 Proxy Requests 목록 Fetch API 인스턴스에 `limit(50)` 쿼리 옵티마이저를 추가했습니다.

---

## v3.24.2 — 서비스 예약 리스트 UI (Client Routing) 핫픽스

**작업일:** 2026-03-03

### 개요
- '/proxy-bookings' 페이지에서 고객/관리자가 예약 내용을 표시하는 카드 UI를 클릭했을 때, Next.js `<Link>` 인터페이스에서 하위 블록의 클릭 이벤트 크기를 확장하지 못해 라우팅이 원활하게 동작하지 않던 현상을 수정했습니다.
- `ProxyBookingsBoard` 컴포넌트 내부 리스트 렌더러에 `className="block"` 속성을 주입하여 모바일 및 웹앱 환경에서 전체 카드를 터치/클릭하여 상세 내역으로 정상 이동할 수 있도록 조치했습니다.

---

## v3.24.1 — RLS 보안 정책 최적화 및 통합 마이그레이션 스크립트 갱신

**작업일:** 2026-03-03

### 개요
- DB 마이그레이션 적용 중 발생한 Permission Denied 에러를 원천 차단하기 위해 `auth.users` 서브쿼리를 조회하는 불안정한 방식을 폐기하고, Supabase 권장 안전 방식인 `auth.jwt() ->> 'email'` 클레임 추출 방식으로 모든 RLS(Row Level Security) 정책 8개를 전면 재작성했습니다. (안정성 극대화 및 레이턴시 단축)
- 분산될 수 있는 테이블 생성(`proxy_requests`, `proxy_comments`) 및 인덱스/트리거 로직을 하나의 통합본인 `supabase_proxy_service_migration.sql` 파일에 모두 병합하여, 빈 DB에서도 한 번의 실행으로 완벽한 인프라가 구축되도록 무결성을 보장했습니다.

---

## v3.24.0 — 일본 현지 전화 대행 예약 서비스 (Proxy Service) 내재화

**작업일:** 2026-03-03

### 개요
스마트스토어에서 수동으로 운영 중이던 '일본 전화 대행 예약 서비스'를 Locally 플랫폼으로 내재화하여 고객-관리자 간의 1:1 티켓 기반 양방향 커뮤니케이션 파이프라인으로 구축 완료.

### [Proxy-1] 통일된 1:1 티켓 보드 아키텍처 (어드민 대시보드 무의존)
- 무거운 별도의 어드민 페이지 없이, 고객과 관리자가 권한(Role)에 따라 다르게 접근하는 단일 라우트 `/proxy-bookings`를 구현.
- 고객은 자신의 예약건만 확인 가능하고, 관리자는 모든 요청을 모니터링 및 상태 변경 가능하도록 Supabase RLS 및 서버사이드 접근 제어(ACL) 적용.

### [Proxy-2] 유연한 폼 데이터(JSONB)와 2-Track 결제
- 카테고리별(식당 예약, 교통 문의 등 5가지)로 완전히 다른 입력 양식을 하나의 테이블에 수용할 수 있도록 `proxy_requests.form_data`(JSONB) 스키마 도입.
- 기존 스마트스토어 결제 고객(주문번호 대신 직관적 구매자명 수집)과 Locally 자체 웹 결제 고객의 데이터 폼 트랙을 분리하여 Zod 기반 다이나믹 유니온 스키마 검증 구축.

### [Proxy-3] 양방향 댓글 시스템 + 실시간 이메일 알림
- 고객과 관리자가 1:1로 소통할 수 있는 `proxy_comments` 테이블 및 양방향 채팅 UI 구현.
- 답글 작성 시 즉각적으로 상대방에게 로컬리 이메일 알림을 비동기 발송하도록 `/api/notifications/send-email` (`type: proxy_comment_notify`) 백그라운드 확장.

---

## v3.23.0 — Platform Stability & Email Infrastructure Overhaul Backend Patch

**작업일:** 2026-03-03

### 개요
플랫폼의 치명적인 결함(Postgres 참조 무결성 500 에러 및 이메일 결합도로 인한 PG사 결제 타임아웃)을 전면 척결하고, 데이터 정합성과 알림 시스템의 독립성을 보장하는 대규모 백엔드 구조조정 완료.

### [Core-1] Postgres DB Auth Trigger를 통한 프로필 동기화 아키텍처 (100% 보장)
- 클라이언트단(`syncProfile.ts` 등 6곳)에 의존하던 수동 프로필 동기화 런타임을 폭파하고, DB 레벨의 Postgres Trigger(`on_auth_user_created`)로 마이그레이션.
- 예약 및 1:1 문의 등 필수 파이프라인에서 발생하던 `profiles` FK Constraint Violation(`500 Error`) 영구 해결.

### [Core-2] 결제 웹훅과 이메일 시스템의 완벽 분리 (Decoupling)
- 메인 결제 라우트(`nicepay-callback`, `cancel`) 내부에 공생하며 타임아웃을 유발하던 무거운 React Email 렌더링 + Nodemailer 발송 로직 전단 도려냄.
- 이메일 전용 백그라운드 API `/api/notifications/send-email`을 신설하고, PG망에는 `200 OK`를 우선 반환한 후 비동기 Fetch(fire-and-forget) 방식으로 알림을 넘기는 독립 아키텍처 구현.

### [Core-3] React Email 렌더링 크래시 방어 및 안정성 패치
- 결제 콜백 웹훅으로부터 누락되었던 필수 `totalAmount` 페이로드를 조인하여 전송.
- `BookingConfirmationEmail`/`BookingCancellationEmail` 내부에서 조인되지 않은 `null`, `undefined`, 빈 문자열 등이 주입되어도 Vercel 엔진이 뻗지 않도록 모든 Props에 옵셔널 체이닝(`?.`) 및 런타임 Fallback(`|| 0`) 방어벽 100% 구축.

### [Core-4] 백그라운드 에러 로깅 복구 및 무결성 확보 (Silent Error 추적)
- `send-email` 내부의 렌더 에러 예외 처리 블록(`catch`)에서 `request.clone().json()`을 이중으로 호출하다가 "stream already read"로 죽어버려 에러를 은폐하던 치명적 버그 디버깅 완료.
- 렌더에 실패하더라도 메인 결제 모델엔 지장 없이, `notifications` 테이블에 대상자의 `hostId`와 함께 `type: 'system_error'` 로그를 즉각 박아넣는 무결성 달성.

---

## v3.22.1 — React Email 렌더링 및 백그라운드 로깅 핫픽스 (Hotfix)

**작업일:** 2026-03-03

### 개요
v3.22.0 분리 이후 발생한 `BookingConfirmationEmail` 렌더링 크래시 및 에러 로깅 누락(Silent Error) 해결.

### [Hotfix-1] 이메일 페이로드 및 렌더링 타입 안정화
- 결제 콜백 웹훅으로부터 누락되었던 필수 `totalAmount` 데이터를 페이로드에 추가.
- React Email 컴포넌트 내부에서 `null` 값 참조 시 크래시가 발생하던 취약점을 방어하기 위해 Optional Chaining(`?.`) 및 컴포넌트 내부 런타임 Fallback 값 보강.

### [Hotfix-2] 백그라운드 로깅 예외(Exception) 버그 수정
- `app/api/notifications/send-email/route.ts` 내에서 이미 소모된 `request.json()` 스트림을 `catch` 블럭 안에서 `request.clone().json()`으로 중복 호출하여 "Type Error: stream already read" 에러가 이중으로 발생하던 설계상의 버그를 발견하여 즉각 수정.
- 본문 변수(`body`)의 스코프를 `try..catch` 바깥으로 승격시켜 이제 시스템 에러 발생 시 정상적으로 `notifications` 테이블에 대상자와 원인 에러 로그가 강제 저장됨.

---

## v3.22.0 — 결제 웹훅과 이메일 전송의 완전한 분리 (Decoupling)

**작업일:** 2026-03-03

### 개요
결제망의 타임아웃을 유발하던 무거운 React Email 렌더링 부하를 메인 결제 스레드에서 완전히 분리하는 아키텍처 재설계 진행.

### [Fix-1] 이메일 전용 백그라운드 API 신설
- 무거운 HTML 렌더링(React Email)과 Nodemailer 발송 로직만을 전문적으로 담당하는 `app/api/notifications/send-email/route.ts` 신설.
- 이메일 발송 실패 시(Catch), 아무도 모르게 무시(Swallow)하던 버그를 해결하기 위해 `notifications` 테이블에 `type: 'system_error'`로 장애 로그를 강제 기록하도록 구현.

### [Fix-2] 결제 콜백 API에서 이메일 렌더링 로직 철거
- `app/api/payment/nicepay-callback/route.ts` (예약 확정) 및 `app/api/payment/cancel/route.ts` (예약 취소) 내부에 있던 동기식 이메일 처리 로직을 완벽하게 도려냄.
- DB 처리가 끝난 즉시 신설된 전용 API(`send-email`)를 비동기 Fetch(fire-and-forget) 방식으로 호출하고, PG망에는 1순위로 `200 OK`를 빠르게 반환하여 Timeout 및 Silent Failure 사태 원천 차단.

---

## v3.21.0 — 프로필 동기화 아키텍처 개선 및 FK 결함 척결

**작업일:** 2026-03-03

### 개요
예약 및 1:1 문의 등 주요 파이프라인에서 발생하던 `profiles` 테이블 참조 무결성(FK Constraint) 500 에러를 영구적으로 해결하기 위한 DB 레벨 아키텍처 개선.

### [Arch-1] Postgres DB Trigger 기반 자동 프로필 생성 (Backfill 포함)
- 클라이언트의 네트워크 상태나 비정상 종료에 의존하던 불안정한 수동 생성(Upsert) 방식을 폐기.
- Supabase Auth 회원가입(`auth.users` Insert) 시 즉각적으로 연동되는 Postgres Trigger `on_auth_user_created` 구현.
- 기존 DB 내 누락된 '유령 유저'들을 복구하는 Backfill 마이그레이션 스크립트 작성 반영 (`supabase_profile_sync_migration.sql`).

### [Arch-2] 프론트엔드 불안정 코드 척결 및 Graceful Error Handling
- 클라이언트 레벨에서 프로필 시드를 강제로 쑤셔넣던 위험 코드 전역 삭제 (`syncProfile.ts`, `auth/callback/route.ts`, `LoginModal.tsx`, `account/page.tsx`, `MobileProfileView.tsx`, `ProfileEditor.tsx`).
- 핵심 API 라우트 (`api/bookings`, `useChat.ts` 등)에서 DB 지연에 따른 500 에러 발생 시, 유저 친화적인 400 Bad Request 에러 메시지로 반환하도록 런타임 안정성 보강.

---

## v3.20.0 — 이메일 UX 글로벌 프리미엄 모던 리뉴얼 적용

**작업일:** 2026-03-03

### 개요
글로벌 스탠다드에 맞추어 `react-email`을 도입하고, 핵심 비즈니스 이메일(예약 확정 / 예약 취소)의 디자인을 에어비앤비 수준의 모던하고 친근한 영수증 스타일로 전면 개편.

### [Email-1] 공통 이메일 레이아웃 및 컴포넌트 에셋 구축
- **파일:** `app/emails/components/EmailLayout.tsx`, `CTAButton.tsx`
- 연한 회색 바탕과 중앙 정렬된 16px 곡률의 흰색 컨테이너를 기본 레이아웃으로 제정.
- 명확도 높은 검은색 큰 CTA 버튼 적용.

### [Email-2] 핵심 비즈니스 이메일 템플릿(React Email) 교체
- 기존의 하드코딩 Raw HTML을 버리고, React 기반의 선언적 템플릿 렌더링 도입.
- **예약 확정 메일:** 직관적인 영수증 형태의 정보 배치 (인원수, 일자 명확히 분리 표기).
- **예약 취소 알림:** 위약금 환불액과 취소 사유를 명시하는 정중한 톤앤매너 템플릿 적용.
- **파일:**
  - `app/emails/templates/BookingConfirmationEmail.tsx`
  - `app/emails/templates/BookingCancellationEmail.tsx`
  - `app/api/payment/nicepay-callback/route.ts` (템플릿 render() 연결)
  - `app/api/payment/cancel/route.ts` (템플릿 render() 연결)

---

## v3.19.0 — 관리자 대시보드 유저 상세 모달 더미 데이터 척결

**작업일:** 2026-03-03

### 개요
어드민 대시보드(`UsersTab`)의 유저 상세 보기 모달에 방치되어 있던 하드코딩 구매/리뷰 데이터를 실제 DB 연동으로 전면 개편.

### [Data-1] 실제 결제/예약 및 리뷰 내역 연동
- 선택된 유저 ID를 기반으로 Supabase `bookings` 및 `reviews` 테이블 통합 Fetch 로직 추가.
- 가져온 실제 데이터를 바탕으로 '총 구매액', '구매 횟수', '마지막 구매일' 동적 산출 및 렌더링.
- 렌더링 목적의 가짜 구매 활동 배열(`을지로 노포 투어...`) 및 가짜 리뷰 배열 영구 삭제.
- **파일:** `app/admin/dashboard/components/UsersTab.tsx`

### [Data-2] Loading 및 Empty State 처리 추가
- 데이터 Fetching 중 상태를 표시하기 위한 로딩 스피너 UI 추가.
- 해당 유저의 결제 내역이나 받은 리뷰가 없을 경우 "구매 내역이 없습니다", "아직 받은 리뷰가 없습니다" 문구를 표시하는 Empty State 방어 코드 적용.

---

## v3.18.0 — 체험 등록 파이프라인 데이터 렌더링 누수 복구

**작업일:** 2026-03-03

### 개요
호스트가 체험 등록 시 입력한 데이터 중 어드민 및 게스트 화면에서 정상적으로 렌더링되지 않던 항목(누수 및 고립 데이터)을 복구하여 UI에 온전히 표시되도록 수정.

### [UI-1] 어드민 체험 관리(EXPS) 상세 화면 데이터 매핑 복구
- DB에는 저장되지만 화면에 누락되었던 필수 정보들을 추가 렌더링.
- 복구 항목: 진행 언어 및 레벨, 카테고리, 상세 주소(`location`), 준비물, 단독 투어 옵션, 참가 제한 규정(연령, 활동 강도).
- **파일:** `app/admin/dashboard/components/DetailsPanel.tsx`

### [UI-2] 상세 지역(subCity) 고립 현상 해결
- DB/폼에 보유 중이던 `subCity` 데이터를 `city`와 결합하여 렌더링하도록 UI 수정 (예: "오사카, 난바").
- 어드민 상세 화면 및 게스트 체험 카드, 상세 화면 Location Header에 모두 적용 완료.
- **파일:** 
  - `app/experiences/[id]/ExperienceClient.tsx`
  - `app/components/ExperienceCard.tsx`
  - `app/admin/dashboard/components/DetailsPanel.tsx`

---

## v3.17.0 — 글로벌 다국어(i18n) 통합 및 UX 라이팅 고도화

**작업일:** 2026-03-02

### 개요
글로벌 런칭 스펙 확정에 따라, 플랫폼 전체(어드민 제외)의 다국어(i18n) 통합 및 에어비앤비 스타일의 프리미엄 UX 라이팅 고도화 작업을 실시결함.

### [i18n-1] LanguageContext 딕셔너리 확장
- 한국어(`ko`), 영어(`en`), 일본어(`ja`), 중국어(`zh`) 4개 국어 사전을 지원하도록 `LanguageContext.tsx` 전면 동기화.
- 리뷰 모달, 메인 알림센터, 서비스 의뢰(목록, 상세, 도입, 신청, 결제, 완료 등), 호스트 대시보드의 서비스 탭 등 주요 컴포넌트에 필요한 다국어 Key-Value 쌍 추가.
- **파일:** `app/context/LanguageContext.tsx`

### [i18n-2] 컴포넌트 내 하드코딩 텍스트 전면 치환 (UX 라이팅 고도화 적용)
- 사용자 경험 향상을 위해 간결하고 행동 지향적이며, 구어체 기반의 친근한 UX 라이팅 적용.
- `t()` 훅을 전역적으로 주입하여 기존 하드코딩되어 있던 한글 텍스트 완벽 교체 완료.
- **파일:**
  - `app/services/page.tsx`
  - `app/services/request/page.tsx`
  - `app/services/[requestId]/ServiceRequestClient.tsx`
  - `app/services/[requestId]/apply/page.tsx`
  - `app/services/[requestId]/payment/page.tsx`
  - `app/services/[requestId]/payment/complete/page.tsx`
  - `app/services/intro/IntroClient.tsx`
  - `app/services/my/page.tsx`
  - `app/host/experiences/[id]/page.tsx`
  - `app/host/dashboard/page.tsx`
  - `app/host/dashboard/components/ServiceJobsTab.tsx`
  - `app/components/ReviewModal.tsx`

### [i18n-3] 호스트 대시보드 누락 번역 및 Key 매핑 오류 전면 수정
- 프로필 세팅, 문의함, 매칭현황, 정산, 후기, 가이드라인 등 대시보드 내 하단 탭 전체의 하드코딩된 텍스트와 누락 번역 보완.
- `LanguageContext.tsx` 내 `hp_`, `hr_`, `hd_`, `hg_` 등의 프리픽스가 섞여 매핑되지 않던 오류를 전부 식별하고 올바른 Key 값으로 치환.
- **파일:**
  - `app/context/LanguageContext.tsx`
  - `app/host/dashboard/components/ProfileEditor.tsx`
  - `app/host/dashboard/InquiryChat.tsx`
  - `app/host/dashboard/components/ServiceJobsTab.tsx`
  - `app/host/dashboard/Earnings.tsx`
  - `app/host/dashboard/HostReviews.tsx`
  - `app/host/dashboard/components/GuidelinesTab.tsx`
  - `app/host/dashboard/components/ReservationCard.tsx`

---

## v3.16.0 — Admin 대시보드 UI/UX 라우팅 재설계 (Domain Grouping)

**작업일:** 2026-03-02

### 개요
C레벨 파트너의 의사결정에 따라 데이터/API 로직 변경 없이 순수 프론트엔드 UI/UX 배치만 조정.
MANAGEMENT 그룹 재배치 및 REVIEWS, LOGS 탭을 ANALYTICS 하위 중첩 탭으로 흡수.

### [UI-1] Sidebar 네비게이션 재배치
- `MANAGEMENT` 그룹에 'Approvals (승인 관리)', 'User Management (유저 관리)', 'Service Requests' 3종 집중 배치.
- 서비스 의뢰 네비게이션 영문 텍스트 통일.
- 메인 사이드바에서 `Review Management`와 `Audit Logs` 탭 제거.
- **파일:** `app/admin/dashboard/components/Sidebar.tsx`

### [UI-2] AnalyticsTab 내부 중첩 서브 탭 연동
- 메인 Analytics 페이지 상단에 4개의 서브 탭 네비게이터 배치: `Business & Guest`, `Host Ecosystem`, `Review Management`, `Audit Logs`.
- 기존 `ReviewsTab`, `AuditLogTab` 컴포넌트 렌더링 위치를 사이드바 라우팅이 아닌 `AnalyticsTab` 내부 상태 제어로 이관.
- **파일:** `app/admin/dashboard/components/AnalyticsTab.tsx`, `app/admin/dashboard/page.tsx`

### [UI-3] 1:1 문의 채널 상태 관리 및 프로필 고도화
- 관리자가 대기(open) 상태인 1:1 문의에 첫 메시지를 전송 시 자동으로 '처리중(in_progress)' 상태로 전환되도록 자동화 적용. (완료 상태는 수동 관리 유지)
- 관리자가 발송한 메시지의 렌더링 이름을 관리자 개인 계정 이름에서 공식 명칭인 '로컬리'로 고정 노출되도록 개선.
- 기존 '해결' 텍스트를 '완료'로 용어 변경.
- **파일:** `app/admin/dashboard/components/ChatMonitor.tsx`

### [PERF-1] 유저 활동 상태 DB 업데이트 스로틀링 도입 (DB 쓰기 병목 해소)
- 클라이언트의 페이지 전환(라우팅) 시마다 발생하는 무분별한 `last_active_at` 업데이트를 방지하기 위해 5분(300초)의 쿨타임을 적용했습니다.
- 외부 캐시 서버(Redis 등) 도입 없이 브라우저의 `localStorage`와 리액트 의존성(`usePathname`)을 순수하게 활용한 애플리케이션 레벨의 방어 로직을 구축했습니다.
- 실시간 접속 표시를 위한 웹소켓(`Supabase Channel`) 마운트 로직과 영구 저장용 DB 업데이트 로직을 2개의 단독 `useEffect` 훅으로 분리했습니다.
- **파일:** `app/components/UserPresenceTracker.tsx`

### [UX-1] 네이티브 수준의 시각적 고급화 (Premium UX & Micro-interactions)
- **부드러운 페이지 전환 (Page Transitions):** `framer-motion`을 도입하여 페이지 라우팅 시 글로벌 페이드&슬라이드 업 효과 스펙 적용. (어드민 대시보드 예외 처리)
- **쫀득한 조작감 (Bouncy Micro-interactions):** `Button`, `ExperienceCard`, `TripCard`, `ServiceCard`, `HostProfileCard` 등 상호작용 가능한 요소들에 `active:scale-95` 또는 `active:scale-[0.98]` 기반의 물리적 수축 효과 부여. 리플로우(Reflow)를 발생시키지 않는 GPU 가속 애니메이션만을 사용하여 성능을 방어합니다.
- **고급 로딩 경험 (Skeleton UI):** 밋밋한 Pulse 로딩을 걷어내고, 인스타그램/에어비앤비 모델 기반의 Shimmer 스켈레톤 애니메이션 컴포넌트로 전면 교체하여 체감 대기시간 극복.
- **파일:** `app/components/ui/PageTransition.tsx`, `app/components/ui/Skeleton.tsx`, `app/components/ClientMainWrapper.tsx`, `app/components/ui/Button.tsx`, `app/globals.css` 및 카드 컴포넌트 전체.

### [UX-2] 로딩 스피너 디자인 표준화 및 하드코딩 박멸
- **디자인 표준화:** `app/components/ui/Spinner.tsx` 컴포넌트를 신설하여 기존 무분별하게 혼용되던 로딩 방식(텍스트/아이콘)을 통일했습니다. 
- **브랜드 컬러 적용:** `Lucide-react`의 `Loader2`를 기반으로 `Locally` 브랜드 컬러(`text-[#FF385C]`)와 `animate-spin`을 적용, 모듈 십자 레이아웃 호환성을 위해 중앙 정렬(`flex justify-center`) 옵션 내장.
- **하드코딩 텍스트 일괄 제거:** 글로벌 코드베이스를 스캔하여 임시로 작성되었던 `<div>Loading...</div>` 및 `로딩 중...` 텍스트 블록들을 모두 박멸하고 신규 스피너 컴포넌트로 마이그레이션 적용. (ex. `Guest Inbox`, `Account`, `Payment` 파이프라인 등)

## v3.15.0 — 리뷰 시스템 고도화 (알림 파이프라인 + Admin 관리 + 후기 수정 + 평점 집계)

**작업일:** 2026-03-02

### 개요
리뷰 시스템 AS-IS 진단 후 확인된 운영 공백 R1~R7 구현 (R8 영구 폐기).
DB 스키마 변경 2건(마이그레이션 스크립트 `docs/migrations/v3_15_0_review_enhancements.sql` 참조).
R7(게스트 본인 받은 리뷰 열람)은 기존 코드에 이미 구현되어 있음 — 추가 변경 없음.

### [R1] 리뷰 등록 → 호스트 알림

- **기존 문제:** 게스트가 후기 작성 시 호스트에게 아무런 알림 없음. 호스트가 대시보드를 직접 방문해야만 인지 가능.
- **수정:** `POST /api/reviews` 성공 후 `notifications` 테이블에 직접 INSERT (서버사이드 — sendNotification() 불가).
  - type: `'new_review'`, 링크: `/host/dashboard?tab=reviews`
- **파일:** `app/api/reviews/route.ts`

### [R2] 예약 완료 → 게스트 후기 작성 요청 알림

- **기존 문제:** 크론 잡이 예약을 `completed`로 처리하지만, 게스트에게 후기 작성 유도 없음.
- **수정:** `GET /api/cron/complete-trips` — 완료 처리 후 각 게스트에게 `notifications` INSERT.
  - type: `'review_request'`, 링크: `/guest/trips`
  - 초기 select에 `user_id, experiences(title)` 추가.
- **파일:** `app/api/cron/complete-trips/route.ts`

### [R3] 호스트 답글 → 게스트 알림

- **기존 문제:** 호스트가 후기에 답글 작성 시 게스트에게 알림 없음.
- **수정:** `HostReviews.tsx` `handleSubmitReply()` 성공 후 `sendNotification()` 호출 (클라이언트사이드 가능).
  - type: `'review_reply'`, 링크: `/guest/trips`
- **파일:** `app/host/dashboard/HostReviews.tsx`

### [R4] Admin 리뷰 관리 탭 신설

- **기존 문제:** Admin 대시보드에 리뷰 조회/관리 탭 없음. 부적절 리뷰 대응 불가.
- **수정:**
  - `ReviewsTab.tsx` 신규 컴포넌트 생성: 전체 리뷰 목록 + 검색 + 별점 필터 + 강제 삭제.
  - Admin Sidebar `Finance` 그룹에 "Review Management" NavButton 추가 (탭 키: `REVIEWS`).
  - `page.tsx` 라우팅에 `activeTab === 'REVIEWS'` 케이스 추가.
- **파일:** `app/admin/dashboard/components/ReviewsTab.tsx` (신규), `Sidebar.tsx`, `page.tsx`

### [R5] 게스트 후기 수정 기능 (작성 후 7일 이내)

- **기존 문제:** 후기 작성 후 수정 불가. 오탈자/오해 수정 방법 없음.
- **수정:**
  - `PATCH /api/reviews/[id]/route.ts` 신규 엔드포인트: 본인 후기 + 7일 이내 검증 + 평점 재집계.
  - `GET /api/guest/trips`: `reviews (id)` → `reviews (id, rating, content, photos, created_at)` 변경. 응답에 `review` 객체 포함.
  - `ReviewModal.tsx`: `trip.review?.id` 존재 시 수정 모드로 자동 진입. 기존 사진 유지 + 새 사진 추가 지원. 제목 "후기 작성" → "후기 수정" 전환.
  - `PastTripCard.tsx`: 후기 작성 완료 시 "수정" 버튼 노출 (클릭 → `onOpenReview(trip)` 호출 → 수정 모드 ReviewModal 오픈).
- **파일:** `app/api/reviews/[id]/route.ts` (신규), `app/api/guest/trips/route.ts`, `app/components/ReviewModal.tsx`, `app/guest/trips/components/PastTripCard.tsx`

### [R6] 호스트 프로필 전체 평점 집계 (DB 저장 방식)

- **기존 문제:** 호스트 전체 평점이 체험 상세 SSR에서 런타임 계산됨 (체험별 DB 저장값과 불일치).
- **수정:**
  - `profiles.average_rating NUMERIC(3,2)`, `profiles.total_review_count INTEGER` 컬럼 추가 (마이그레이션).
  - `POST /api/reviews` + `PATCH /api/reviews/[id]`: 체험 집계 후 해당 호스트의 전체 리뷰 재집계 → `profiles` 업데이트.
  - 집계 실패 시 후기 저장/수정에 영향 없도록 try-catch 처리.
- **마이그레이션:** `docs/migrations/v3_15_0_review_enhancements.sql`

### [R7] 게스트 본인 받은 리뷰 열람

- **상태:** 기존 코드 확인 결과 이미 구현 완료 (`account/page.tsx` 데스크탑 + `MobileProfileView.tsx` 모바일 양쪽).
- **추가 작업 없음**

### notification.ts — 신규 타입 추가

- `'new_review'`, `'review_reply'`, `'review_request'` 3개 타입 추가.
- **파일:** `app/utils/notification.ts`

---

## v3.14.0 — 메시징 시스템 Phase C (M3 읽음 시각 + M5 CS 상태 큐)

**작업일:** 2026-03-02

### 개요
[M3] C2C 신뢰도 강화: 읽음 시각 정밀화 / [M5] Admin 운영 효율: CS 문의 칸반형 상태 관리.
DB 스키마 변경 2건(마이그레이션 스크립트 `docs/migrations/v3_14_0_chat_enhancements.sql` 참조).

### [M3] inquiry_messages — read_at 컬럼 추가 + "읽음 HH:MM" UI

- **기존 문제:** 발신자 메시지에 '1'만 표시, 상대방이 정확히 언제 읽었는지 알 수 없음.
- **DB 변경:** `inquiry_messages.read_at TIMESTAMPTZ` 컬럼 추가.
- **useChat.ts:** `markAsRead()`에서 `is_read=true`와 함께 `read_at=NOW()` 기록. 이미 `read_at` 있는 메시지는 덮어쓰지 않음(`.is('read_at', null)` 조건).
- **UI 변경 (C2C 발신자 메시지 좌측 메타 영역):**
  - 미읽음: "1" (파란색 bold)
  - 읽음 + read_at 있음: "읽음 오후 2:05" (회색 소문자)
  - 읽음 + read_at 없음(레거시): 표시 없음 (마이그레이션 전 기존 메시지 보호)
- **파일:** `app/hooks/useChat.ts`, `app/guest/inbox/page.tsx`, `app/host/dashboard/InquiryChat.tsx`

### [M5] inquiries — status 컬럼 + ChatMonitor 칸반형 상태 관리

- **기존 문제:** 1:1 CS 문의 상태 관리 불가, 대기/처리중/해결 구분 없음.
- **DB 변경:** `inquiries.status TEXT DEFAULT NULL` 컬럼 추가 (NULL=C2C 무관, 'open'|'in_progress'|'resolved' CS 전용).
- **useChat.ts:** `InquiryRow`에 `status?: string | null` 타입 추가 (select `*`로 자동 포함).
- **ChatMonitor UI:**
  - "1:1 문의" 탭 헤더에 상태 필터 필: 전체 / 대기 / 처리중 / 해결 (null 상태 문의는 '대기'에 포함)
  - 문의 목록 각 아이템에 상태 뱃지 표시 (amber=대기, blue=처리중, green=해결)
  - 채팅 헤더 우상단에 3개 상태 전환 버튼 (클릭 시 supabase.update + refresh() 재조회)
- **C2C 채팅 영향 없음** (monitor 탭은 기존 로직 그대로)
- **파일:** `app/hooks/useChat.ts`, `app/admin/dashboard/components/ChatMonitor.tsx`

---

## v3.13.0 — 메시징 시스템 Phase A & B 고도화 (CS 뱃지 + Admin CS 개시)

**작업일:** 2026-03-02

### 개요
메시징 시스템 현황 진단 후 확인된 운영 긴급 공백(M1, M2) 구현.
DB 스키마 변경 없이 기존 `inquiries.type` 구분 구조 그대로 활용.

### [M2] Sidebar — CS 미답변 건수 뱃지 추가 (Phase A)

- **기존 문제:** Admin 사이드바 "Message Monitoring" 버튼에 CS 1:1 문의 미답변 건수 미노출.
- **수정:**
  - `fetchCounts()`에 2-step 쿼리 추가: admin_support inquiry ID 수집 → `inquiry_messages.is_read=false` 건수 카운트.
  - `counts.csUnreadCount` 상태값 추가, 탭 비활성 시 "Message Monitoring" NavButton 뱃지 노출.
- **파일:** `app/admin/dashboard/components/Sidebar.tsx`

### [M1] DetailsPanel — Admin CS 먼저 개시 기능 (Phase B)

- **기존 문제:** Admin이 유저 목록에서 특정 유저에게 먼저 CS 메시지를 보낼 수 없었음.
- **수정:**
  - USERS 탭 상세 패널 하단에 "1:1 CS 메시지 보내기" 버튼 추가.
  - 클릭 시: 기존 admin_support 문의 있으면 해당 채팅으로 이동, 없으면 신규 `inquiries` 레코드 생성 후 이동.
  - `router.push('/admin/dashboard?tab=CHATS&inquiryId=X')` 패턴으로 ChatMonitor 자동 선택 연동.
- **파일:** `app/admin/dashboard/components/DetailsPanel.tsx`

### [M1] ChatMonitor — URL inquiryId 파라미터 자동 선택 (Phase B)

- **기존 문제:** ChatMonitor에 특정 문의 자동 선택 진입점 없음.
- **수정:**
  - `useSearchParams()`로 `?inquiryId=X` 파라미터 감지.
  - inquiries 로드 시 매칭 문의를 자동 선택 (`setActiveTab('admin')` + `loadMessages()`).
- **파일:** `app/admin/dashboard/components/ChatMonitor.tsx`

---

## v3.12.0 — Admin 대시보드 운영 공백(GAP) 고도화

**작업일:** 2026-03-02

### 개요
맞춤 의뢰(Service) 에스크로 선결제 도입 이후 진단된 6개 운영 공백 중 우선순위 4개(G1~G4)를 해결.
기존 useAdminData.ts 무거운 훅 미수정, 테이블 강제 병합 없이 KPI 통합 + 운영 분리 원칙 유지.

### [G4] Sidebar — 서비스 무통장 입금 대기 뱃지 추가

- **기존 문제:** 사이드바의 "맞춤 의뢰 관리" 버튼에 알림 뱃지 없음. 무통장 입금 대기 건수 파악 불가.
- **수정:** `service_bookings` 테이블에서 `status=PENDING & payment_method=bank` 건수를 `fetchCounts()`에 추가. "맞춤 의뢰 관리" NavButton에 `count={counts.servicePendingBank}` 뱃지 노출.
- **파일:** `app/admin/dashboard/components/Sidebar.tsx`

### [G2] ServiceAdminTab — 취소 요청 검토 KPI 카드 + 필터 필

- **기존 문제:** `cancellation_requested` 상태 건이 전체 목록에 섞여 운영자가 식별하기 어려움.
- **수정:**
  - KPI 그리드를 `grid-cols-3` → `grid-cols-2 md:grid-cols-4`로 변경하고 4번째 "취소 요청 검토" 카드 추가(건수 > 0일 때 오렌지 강조).
  - AllRequestsTab 상단에 필터 필 2종(전체 / 취소 요청) 추가. 취소 요청 탭 선택 시 해당 행 오렌지 배경 강조 및 빈 상태 메시지 별도 표시.
- **파일:** `app/admin/dashboard/components/ServiceAdminTab.tsx`

### [G3] ServiceAdminTab — 정산 명세서 CSV 다운로드 추가

- **기존 문제:** SettlementTab에 "이체 완료 처리" 버튼만 있고 정산 명세서 내보내기 기능 없음.
- **수정:** 각 호스트 그룹 아코디언 하단에 "명세서 CSV" 버튼 추가. 클릭 시 해당 호스트의 서비스 정산 항목(의뢰명, 날짜, 결제액, 지급액)을 UTF-8 BOM CSV로 다운로드.
- **파일:** `app/admin/dashboard/components/ServiceAdminTab.tsx`

### [G1] SalesTab — 맞춤 의뢰 정산 명세서 CSV 추가 (세무 대응)

- **기존 문제:** SalesTab의 "명세서 다운로드"는 체험 bookings 전용 → 서비스 결제가 세무 명세서에서 완전 누락.
- **수정:** 정산 섹션 헤더에 "맞춤 의뢰 명세서 ↓" 버튼 추가. 클릭 시 현재 날짜 필터 기준으로 `service_bookings` + `service_requests` + `host_applications` + `profiles` on-demand JOIN 조회 후 국세청 소명용 CSV(결제일시/주문번호/의뢰명/고객/호스트/결제수단/금액 등) 생성.
- **파일:** `app/admin/dashboard/components/SalesTab.tsx`

---

## v3.11.0 — 알림 시스템 Phase 1 긴급 수정

**작업일:** 2026-03-02

### 개요
알림 시스템 현황 진단(3가지 치명적 리스크)에 따른 즉시 수정 릴리스.
인앱 알림 + 이메일 2채널 구조를 완벽하게 보장하도록 방어 로직 추가.

### [P1 - CRITICAL] 이메일 SMTP 실패 시 인앱 알림 유실 방지

- **기존 문제:** `POST /api/notifications/email`에서 Gmail SMTP `sendMail()`이 예외를 던지면 외부 try/catch가 HTTP 500을 반환. DB insert는 이미 성공했음에도 불구하고 클라이언트에 에러가 반환되어 혼란 유발 가능.
- **수정:** 단건 `sendMail()` 호출을 독립적인 try/catch 블록으로 격리. 이메일 실패는 `console.warn`으로 로깅만 하고 `{ success: true }` 정상 응답 반환. DB 인앱 알림은 이미 저장됐으므로 사용자 알림은 무조건 보장됨.
- **파일:** `app/api/notifications/email/route.ts`

### [P2 - BUG] 알림 타입 누락으로 인한 TypeScript 타입 불일치 수정

- **기존 문제:** `NotificationType` 유니온에 실제 사용되는 타입 2종 미포함:
  - `'cancellation'` — `app/api/payment/cancel/route.ts`에서 직접 DB INSERT 시 사용
  - `'message'` — `NotificationContext` 내부 가상 알림 생성 시 사용
- **수정:**
  - `app/utils/notification.ts`: `'cancellation'`, `'message'` 두 타입을 유니온에 명시적 추가
  - `app/notifications/page.tsx`: `getIcon()` 함수 개선 — `service_*` 타입에 초록색 Calendar 아이콘 명시 매핑 추가. `cancellation`/`message`가 기존 `includes` 로직으로 이미 올바른 아이콘으로 분기됨을 확인.

### [P3 - CRITICAL] 채팅 알림 새로고침 시 증발 현상 수정

- **기존 문제:** `NotificationContext`가 `inquiry_messages` 테이블 INSERT를 감지해 **메모리에만 존재하는 가상 알림**(id: Date.now())을 생성. 앱 재진입 시 사라지고 알림 페이지 이력에도 남지 않음. 또한 `useChat.sendMessage()`가 `sendNotification()`을 통해 이미 DB에 알림을 저장하므로 토스트가 **2번** 발생하는 중복 문제도 동반.
- **수정:**
  - `app/context/NotificationContext.tsx`: `inquiry_messages` INSERT 구독(Channel B) 완전 제거.
  - `notifications` 테이블 INSERT 구독(Channel A)만 유지. `useChat.sendMessage()` → `sendNotification()` → DB INSERT → Channel A 감지 → 영구 알림 + 토스트의 단일 경로로 통합.
  - `markAsRead()` 가상 ID 분기 가드(`id < 1000000000000`) 제거 — 이제 모든 알림이 실 DB 레코드이므로 항상 DB update 실행.
  - 토스트 아이콘 타입: `newNoti.type.includes('message')` 조건으로 메시지 알림 자동 감지.

### 파일 요약
| 파일 | 변경 내용 |
|------|-----------|
| `app/utils/notification.ts` | MODIFY — `'cancellation'`, `'message'` 타입 추가 |
| `app/api/notifications/email/route.ts` | MODIFY — 단건 sendMail try/catch 격리, 이메일 실패 시 성공 응답 보장 |
| `app/context/NotificationContext.tsx` | MODIFY — Channel B(inquiry_messages) 제거, markAsRead 가드 제거, 토스트 타입 자동 감지 |
| `app/notifications/page.tsx` | MODIFY — getIcon() service_* 타입 명시 매핑 추가 |

---

## v3.10.0 — SEO/OG 메타데이터 최적화

**작업일:** 2026-03-02

### 개요
서비스 매칭(`services/*`) 페이지 전체를 구글 검색 및 소셜 공유(카카오톡 썸네일)에 최적화.

### 변경 내용

#### `app/layout.tsx`
- `metadataBase` 추가 (`NEXT_PUBLIC_SITE_URL` 환경변수 기반, fallback: `https://locally.vercel.app`)
  → 하위 페이지의 상대 경로 OG 이미지 URL이 absolute로 올바르게 해석됨
- `keywords` 에 서비스 관련 키워드 추가: `일본 동행`, `일본 현지 가이드`, `맞춤 의뢰`

#### `app/services/intro/` — Server Wrapper 패턴 적용
- **기존 `page.tsx`** → `IntroClient.tsx`로 이름 변경 (내용 무변경)
- **신규 `page.tsx`** (Server Component): 정적 `metadata` export 추가
  - Title: `일본 현지인 동행 가이드 맞춤 의뢰 | Locally`
  - Description: `도쿄·오사카·후쿠오카에서 검증된 현지인 호스트와 단둘이 떠나는 맞춤 여행. 시간당 ₩35,000, 최소 4시간부터 의뢰 가능.`
  - OG/Twitter 카드 포함, keywords 7개
  - OG 이미지: `NEXT_PUBLIC_SERVICE_OG_IMAGE` 환경변수 우선, 없으면 일본 Unsplash 이미지 fallback

#### `app/services/[requestId]/` — Server Wrapper 패턴 적용
- **기존 `page.tsx`** → `ServiceRequestClient.tsx`로 이름 변경 (내용 무변경)
- **신규 `page.tsx`** (Server Component): `generateMetadata` 동적 생성 추가
  - `service_requests` 테이블에서 `title, city, service_date, duration_hours, guest_count` 조회
  - Title: `[의뢰 제목] — 현지 호스트 모집 중 | Locally`
  - Description: `📍 [city] · 📅 [service_date] · ⏱ [n]시간 · 👥 [n]명. 현지인 호스트의 지원을 기다리고 있어요.`
  - OG 이미지: `NEXT_PUBLIC_SERVICE_OG_IMAGE` 환경변수 우선, 없으면 사이트 대표 이미지 fallback (에러 없음 보장)

### 파일 요약
| 파일 | 액션 |
|------|------|
| `app/layout.tsx` | MODIFY — metadataBase 추가 + keywords 보강 |
| `app/services/intro/IntroClient.tsx` | NEW — 기존 page.tsx 내용 이동 (로직 무변경) |
| `app/services/intro/page.tsx` | MODIFY — 서버 래퍼로 교체, 정적 metadata export |
| `app/services/[requestId]/ServiceRequestClient.tsx` | NEW — 기존 page.tsx 내용 이동 (로직 무변경) |
| `app/services/[requestId]/page.tsx` | MODIFY — 서버 래퍼로 교체, generateMetadata 추가 |

---

## v3.3.1 — 버그 수정 이력

**수정일:** 2026-03-01

### [Bug 1 - CRITICAL] 수수료 마진 유출 수정
- **현상:** 호스트 계정으로 잡보드, 의뢰 상세 접속 시 고객 결제 금액(`total_customer_price`)이 노출.
- **수정:**
  - `app/services/page.tsx`: 잡보드 카드 금액 표시를 `total_host_payout`(예상 수입)으로 교체, 라벨/색상 구분
  - `app/services/[requestId]/page.tsx`: 의뢰 상세 금액 블록을 `isOwner` 분기로 엄격 분리 — 고객에게만 총 금액, 호스트에게는 예상 수입만 노출
  - `app/types/service.ts`: `ServiceRequestCard`에 `total_host_payout`, `user_id` 필드 추가
  - `app/api/services/requests/route.ts`: API select 쿼리에 두 필드 추가

### [Bug 2 - DATA] 고객 화면 지원자 리스트 0명 표기 수정
- **현상:** 호스트가 지원 완료 후에도 고객의 의뢰 상세에 "지원한 호스트 (0명)" 표기.
- **근본 원인:** 클라이언트 SDK의 `service_applications` nested join 쿼리가 Supabase RLS 정책에 의해 차단되어 빈 배열 반환.
- **수정:**
  - `app/api/services/applications/route.ts`: `GET` 핸들러 신규 추가 — `service_role` 클라이언트로 RLS 우회, 의뢰 소유자에게는 전체 지원자 + `profiles`/`host_applications` 2단계 조인 반환
  - `app/services/[requestId]/page.tsx`: 클라이언트 직접 조회에서 서버 API 호출로 전환

### [Bug 3 - UX] 호스트 '지원 완료' 상태 렌더링 누락 수정
- **현상:** 호스트가 지원 후 같은 의뢰 상세에 재접속해도 "지원하기" 버튼이 계속 표시됨.
- **근본 원인:** `myApplication` 도출이 `applications` 배열에서만 이루어졌는데, Bug 2로 인해 `applications`가 비어있어 `myApplication`이 항상 `undefined`.
- **수정:**
  - `app/services/[requestId]/page.tsx`: `myApplication`을 독립 state로 분리, `/api/services/applications?requestId=...` GET 호출 시 `myApplication` 직접 반환

### [Bug 4 - UX] 고객(게스트) 진입점 누락 수정
- **현상:** 고객이 의뢰 등록 후 "내 맞춤 의뢰" 목록으로 이동하는 메뉴가 어디에도 없음.
- **수정:**
  - `app/account/page.tsx` 모바일/데스크탑: "내 맞춤 의뢰" → `/services/my` 항목 추가
  - **v3.4.0에서 진입점이 '나의 여행' 페이지로 이동됨 (하단 참고)**

---

## v3.4.0 — UX 개선 이력

**수정일:** 2026-03-01

### [메뉴 재배치] '내 맞춤 의뢰' 진입점 이동
- **이전:** `app/account/page.tsx`(계정/프로필 관리) 내에 위치
- **현재:** `app/guest/trips/page.tsx`(나의 여행 페이지) 하단 "나의 맞춤 의뢰" 섹션으로 통합
  - 최대 5건 미리보기 + "전체 보기" 링크 → `/services/my`
- **account 페이지 정리:** 잘못 추가되었던 모바일 메뉴 아이템, 데스크탑 링크 카드 모두 제거

### [랜딩 페이지 신설] 서비스 소개 페이지 `/services/intro`
- **신규 파일:** `app/services/intro/page.tsx`
- **라우팅 변경:** 홈 화면 5번째 서비스 카드 클릭 시 `/services/request` → `/services/intro`로 변경

### [알림 강화] 서비스 N 배지 시스템 구현
- **호스트 데스크탑:** `app/host/dashboard/page.tsx` — "서비스 매칭" 사이드바 버튼 우측 빨간 점 표시
- **호스트 모바일:** `app/components/mobile/MobileHostMenu.tsx` — "서비스 매칭" 항목 빨간 점 표시
- **고객:** `app/guest/trips/page.tsx` — "나의 맞춤 의뢰" 섹션 제목 옆 빨간 점 표시

### 파일 변경 요약
| 변경 | 파일 |
|---|---|
| [NEW] 서비스 소개 페이지 | `app/services/intro/page.tsx` |
| [MODIFY] 홈 카드 라우팅 변경 | `app/components/HomePageClient.tsx` |
| [MODIFY] 맞춤 의뢰 섹션 + N 배지 추가 | `app/guest/trips/page.tsx` |
| [MODIFY] 서비스 탭 N 배지 (데스크탑) | `app/host/dashboard/page.tsx` |
| [MODIFY] 서비스 탭 N 배지 (모바일) | `app/components/mobile/MobileHostMenu.tsx` |
| [MODIFY] 잘못 추가된 계정 페이지 진입점 제거 | `app/account/page.tsx` |

---

## v3.5.0 — UI/UX 프리미엄 전면 개편

**수정일:** 2026-03-01

### [나의 여행 페이지] 섹션 순서 변경
- 모바일/데스크탑 모두 "나의 맞춤 의뢰" 섹션 → 최상단 배치, 일반 예약 하단

### [서비스 상세 페이지] 에어비앤비 스타일 전면 재설계
- **변경 파일:** `app/services/[requestId]/page.tsx` (전면 재작성)
- 매칭 프로세스 스텝 바, 2×2 아이콘 그리드, LinkedIn 스타일 지원자 카드, 그라디언트 CTA 버튼 추가

### [의뢰 목록 & 잡보드] 카드 UI 개선
- 2섹션 카드 구조, 상태 칩 강화, 금액 강화, 언어 메타, 회색 배경, hover 애니메이션
- **변경 파일:** `app/services/page.tsx`, `app/services/my/page.tsx`

### 파일 변경 요약
| 변경 | 파일 |
|---|---|
| [MODIFY] 맞춤 의뢰 섹션 최상단 배치 | `app/guest/trips/page.tsx` |
| [MODIFY] 상세 페이지 전면 재설계 | `app/services/[requestId]/page.tsx` |
| [MODIFY] 잡보드 카드 UI 개선 | `app/services/page.tsx` |
| [MODIFY] 내 의뢰 목록 카드 UI 개선 | `app/services/my/page.tsx` |

---

## v3.6.0 — 서비스 소개 페이지 에어비앤비 스타일 재설계

**수정일:** 2026-03-01

- **변경 파일:** `app/services/intro/page.tsx` 전면 재작성
- 다크 그라디언트 히어로, 아이콘 그리드, 후기 카드, 데스크탑 sticky 가격 카드, 모바일 하단 고정 바
- **비용:** 시간당 ₩35,000 / 최소 4시간 기준 ₩140,000~
- **대상 지역:** 도쿄, 오사카, 후쿠오카

---

## v3.7.0 — 서비스 소개 페이지 체험 상세 UI 복제

**수정일:** 2026-03-01

### [서비스 소개] 체험 상세 UI 이식
- **변경 파일:** `app/services/intro/page.tsx`
- `app/experiences/[id]/page.tsx`의 레이아웃 구조(사진 갤러리, 헤더/호스트 바, 아이콘 그리드) 복제

### [폼 연동] 예약 바 → 의뢰 정보 수집 연동
- 데스크탑 사이드바: 날짜/시작 시간/이용 시간/인원수 선택 폼
- Query String 라우팅: `/services/request?date=...&startTime=...`으로 전달

### [폼 연동] 의뢰 등록 폼 데이터 Hydration
- **변경 파일:** `app/services/request/page.tsx`
- `useSearchParams`로 intro에서 전달된 파라미터를 초기값으로 자동 매핑

### v3.7.1 Hotfix — 폼 UI 모던화 및 30분 단위 선택
- 날짜 선택: 네이티브 `input type="date"` → 커스텀 달력 UI로 교체
- 시간 선택: 오전 8시~오후 8시 30분 간격 `<select>`로 교체

---

## 누적 상태 정합성 패치 이력 (v3.x P0/P1 시리즈)

> 아래는 booking 상태 상수 통일, Admin 집계 정합성, UI 회귀 수정 등 다수의 핀셋 패치 이력이다.

- 예약 상태 단일화(P1-2): `bookingStatus` 공통 상수에 대소문자 무관 판정 유틸 추가
- Admin 장부/분석 정합성(P1-2): `MasterLedgerTab`, `AnalyticsTab` 하드코딩 상태 배열을 공통 상수 기반으로 전환
- Guest Trips 분류 안정화(P1-2): `useGuestTrips`, `TripCard` 취소/완료 분기를 공통 취소 상태 집합 기준으로 통일
- 예약 상태 유틸 확장(P1-3): `pending/cancellation_requested/completed/cancelled` 전용 판정 유틸 추가
- Admin 매출 탭 정합성(P1-3): `SalesTab` 유효 매출/정산 대상/CSV/상태 뱃지 분기를 공통 상태 유틸로 정렬
- Host 예약 관리 정합성(P1-3): `ReservationManager`, `ReservationCard` 취소요청/취소완료/입금대기 분기를 공통 상태 유틸로 통일
- Admin 정산 실행 정합성(P1-4): `SettlementTab` 상세 유형 분기를 공통 취소 상태 유틸로 통일
- Host 수익 계산 정합성(P1-4): `Earnings` 취소 예약 제외/포함 판단을 공통 유틸 기반으로 정렬
- 결제 취소 API 가드 보강(P1-4): `/api/payment/cancel` "이미 취소됨" 판정을 공통 상태 유틸로 전환
- Admin 정산 조회 필터 보강(P1-5): `SettlementTab` Supabase `.or(...)` 조건을 공통 상태 유틸 기반 필터로 전환
- Admin 장부 Pending 분기 통일(P1-5): `MasterLedgerTab` `PENDING` 직접 비교를 `isPendingBookingStatus`로 치환
- 결제 완료/성공 상태 분기 통일(P1-6): `payment/complete`, `payment/success` 상태 분기를 공통 상태 유틸로 전환
- 결제 좌석 점검 상태 집합 통일(P1-7): `BOOKING_PENDING_STATUSES`, `BOOKING_BLOCKING_STATUSES_FOR_CAPACITY` 상수 추가
- 전역 폰트 로컬 전환(P1-8): `next/font/local` 기반으로 전환, Google Font 의존 제거 (Inter + IBM Plex Sans KR)
- 데스크탑 호스트 전환 회귀 수정(P1-9): `SiteHeader` 드롭다운 호스트 전환 목적지를 `/host/dashboard?tab=reservations`로 복원
- 모바일 언어 전환 진입점 확장(P1-10): 홈 상단, 게스트 계정 헤더, 호스트 메뉴 헤더에 언어 스위처 추가
- 안정성: `.single()` → `.maybeSingle()` 전환, BottomTabNavigation z-index 정리
- 프로필 스키마 정합성(P0): 실DB에 없는 `role/name/is_admin/school` 직접 쿼리 제거
- 호스트 예약 조회 핫픽스(P0): `profiles.school` select 제거 (42703 에러 방지)
- 인증 세션 고정(P0): Supabase 클라이언트 싱글턴, `getUser()` 기반 전환
- OAuth 프로필 동기화 보강(P0): `/auth/callback` 코드 교환 직후 프로필 동기화
- Admin 맞춤 의뢰 관리 통합(v3.9.0): SERVICE_REQUESTS 탭 신설, useServiceAdminData, ServiceAdminTab, /api/admin/service-cancel
- 맞춤 의뢰 무통장 입금 UI 추가(v3.9.1): 결제 수단 선택 UI, complete 페이지 method=bank 분기
- 맞춤 의뢰 무통장 백엔드 연동(v3.9.2): mark-bank API, service-confirm-payment API, ServiceAdminTab 입금 확인 버튼
  - `app/account/page.tsx`
  - `app/components/mobile/MobileProfileView.tsx`
  - `app/host/dashboard/components/ProfileEditor.tsx`
  - `app/host/dashboard/InquiryChat.tsx`
  - `app/host/dashboard/components/ServiceJobsTab.tsx`
  - `app/host/dashboard/Earnings.tsx`
  - `app/host/dashboard/HostReviews.tsx`
- v3.38.30 - [Analytics] 플랫폼 전체/체험 전용 범위 안내 고정
  - Data Analytics의 Business & Guest 상단에 `플랫폼 전체 기준` 안내를 추가해 체험 예약과 서비스 결제를 합친 집계임을 명확히 표시했다.
  - 취소율/체험 검색 트렌드/매출 견인 Top 체험/예약 퍼널 앞에 `체험 예약 전용 분석` 안내를 추가해 플랫폼 전체 KPI와 체험 전용 섹션의 경계를 더 분명하게 정리했다.
  - Analytics 전용 스모크가 새 안내 문구를 직접 검증하도록 보강했다.
- v3.38.31 - [Analytics] 핵심 KPI 해석 가이드 추가
  - `가입 대비 결제건 비율`, `반복 결제 고객 비율`, `객단가 (AOV)` 카드 아래에 운영자용 해석 가이드를 추가했다.
  - Analytics 스모크가 세 KPI 설명 문구를 직접 검증하도록 보강했다.
- v3.38.32 - [Analytics] Host Ecosystem 기준 설명 추가
  - Host Ecosystem 상단에 `호스트 퍼널 / 유망주 / 집중 관리`, `응답시간 / 응답률` 해석 가이드를 추가했다.
  - Analytics 스모크가 호스트 기준 설명 문구를 직접 검증하도록 보강했다.
- v3.38.33 - [Analytics] 운영 탭 역할 안내 보강
  - Review Quality와 운영 감사 로그 진입 시 각각 `리뷰 품질 운영 구간`, `관리자 감사 이력 구간`임을 알려주는 안내 문구를 추가했다.
  - Reviews/Audit header 설명도 역할 중심으로 보강했고, Analytics 스모크가 새 역할 문구를 직접 검증하도록 확장했다.
- v3.38.34 - [Analytics] Review/Audit 초기 조회를 admin API로 분리
  - `Review Quality`가 더 이상 브라우저에서 `reviews`를 직접 select하지 않고 `/api/admin/reviews`를 통해 서버 권한 검증 후 읽도록 변경.
  - `운영 감사 로그` 초기 로드도 `/api/admin/audit-logs`로 이동해 admin read path를 정리.
  - 감사 로그 실시간 INSERT 구독은 기존처럼 클라이언트에서 유지해 UX 회귀를 방지.
- v3.38.58 - [Analytics] 유입 source별 검색 수요 힌트 추가
  - `고객 검색 수요 분석`에 `유입별 주요 검색 수요` 카드를 추가해, source 메타데이터가 남은 세션 기준으로 어떤 유입이 어떤 검색을 많이 하는지 함께 볼 수 있게 했다.
  - source별 카드에는 총 검색 수, 대표 검색어, 공급 부족 신호를 함께 보여주되 `source + 세션 기준 참고용`으로만 표시해 기존 KPI 의미를 흔들지 않게 유지했다.
  - Analytics 스모크가 새 안내 문구와 카드 제목을 직접 검증하도록 보강했다.
- v3.38.59 - [Analytics] source tracking 미적용 환경 graceful fallback
  - `analytics-search-intent`가 `search_logs.session_id`, `analytics_events.utm_*` 컬럼이 아직 없는 환경에서도 500 없이 검색량/급상승/공급 부족 지표를 유지하도록 fallback을 추가했다.
  - `analytics-customer-composition`도 source tracking 컬럼이 없을 때 noisy schema warning 대신 `unavailable` 상태로만 내려가게 정리했다.
- v3.38.60 - [Admin Team] TeamTab 쓰기 경계 서버화
  - `TeamTab`의 `Daily Log / TODO / MEMO / TODO·MEMO 댓글 / Admin Whitelist` create/update/delete를 `/api/admin/team/*` 전용 서버 경로로 옮겨 브라우저 direct write를 제거했다.
  - 읽기와 realtime은 기존 client Supabase를 유지하고, `GlobalTeamChat`/`MiniChatBar`는 별도 단계로 남겨 1차 수정 범위를 `TeamTab`으로 한정했다.
  - 새 스모크 `15-admin-team.spec.ts`가 `Daily Log` 생성 → 상태 변경 → 삭제 흐름이 실제 admin route를 타는지 직접 검증한다.
- v3.38.61 - [Admin Team] GlobalTeamChat / MiniChatBar 쓰기 경계 서버화
  - `GlobalTeamChat`, `MiniChatBar`의 팀 채팅 메시지 전송을 `/api/admin/team/comments`로 옮겨 `admin_task_comments` 브라우저 direct insert를 제거했다.
  - `GlobalTeamChat`의 reaction 저장도 `/api/admin/team/comments/[id]`로 옮겨 direct update를 제거했다.
  - 새 스모크 `16-admin-team-chat.spec.ts`가 Team Chat 메시지 전송이 실제 admin route를 타는지 직접 검증한다.
- v3.38.62 - [Admin Sidebar] Admin Alerts unread count 서버화
  - `Sidebar`가 더 이상 브라우저에서 `notifications`를 직접 count 하지 않고 `/api/admin/sidebar-counts`의 `adminAlertsUnread`를 사용하도록 통일했다.
  - `notifications` realtime change가 오면 별도 count query 대신 `fetchCounts()` 하나만 다시 호출하도록 단순화했다.
  - 새 스모크 `17-admin-sidebar.spec.ts`가 `Admin Alerts` 배지가 실제 sidebar server count를 타는지 직접 검증한다.
- v3.38.63 - [Admin Sidebar] Team Workspace badge 갱신 타이밍 정리
  - `/api/admin/team-counts`가 `newTasksCount`, `newCommentsCount`와 함께 합산 `newWorkspaceCount`를 반환하도록 정리하고, 잘못된 `lastViewed` 값은 epoch로 안전하게 fallback 하도록 보강했다.
  - `TeamTab` 진입 시 `team-viewed` 이벤트를 발생시켜, 사이드바 `Team Workspace` badge가 같은 탭 세션에서도 즉시 최신 열람 상태를 반영하도록 수정했다.
  - 새 스모크 `18-admin-team-badge.spec.ts`가 `Team Workspace` badge가 TEAM 탭 방문 후 바로 사라지는지 직접 검증한다.
- v3.38.64 - [Admin Sidebar] Master Ledger 예약 대기 badge local state 정리
  - `viewed_booking_ids` 처리를 `adminViewedBookings` 공용 helper로 모아, `Sidebar`와 `MasterLedgerTab`이 같은 규칙으로 열람 상태를 읽고 갱신하도록 통일했다.
  - 사이드바는 서버에서 받은 `pendingBookingIds` 기준으로 stale viewed id를 자동 정리한 뒤 badge를 계산하도록 바꿔, 오래된 localStorage 값으로 badge가 어긋나는 경우를 줄였다.
  - `06-admin-master-ledger.spec.ts`가 현재 예약만 unread로 보이도록 localStorage를 고정한 뒤, 예약을 열면 `Master Ledger` badge가 `1 → 0`으로 내려가는지 직접 검증한다.
- v3.38.65 - [Admin Dashboard] useAdminData 마지막 렌더 경로 제거
  - `page.tsx`의 레거시 `DataDrivenAdminTab`이 더 이상 `useAdminData()`를 쓰지 않고, `APPS/EXPS` 전용으로 이미 분리된 `useAdminApprovalsData()`만 사용하도록 정리했다.
  - 이로써 `Sales / Ledger / Analytics / Users / Approvals`뿐 아니라 레거시 `APPS/EXPS` URL 분기도 공통 eager load를 타지 않게 되어, `useAdminData()`는 실제 관리자 렌더 경로에서 빠졌다.
- v3.38.66 - [Admin Dashboard] 미사용 useAdminData dead code 제거
  - 실제 관리자 렌더 경로에서 더 이상 쓰지 않는 `hooks/useAdminData.ts`를 삭제해, 남은 탭 데이터 흐름 기준을 `useAdminApprovalsData`, `useAdminUsersData`, 각 탭 전용 `/api/admin/*`로 단순화했다.
  - `AdminDashboardState` 타입도 함께 제거해, 더 이상 쓰지 않는 공통 eager load 상태 구조를 코드베이스에서 걷어냈다.
- v3.38.67 - [Analytics] Search Demand / Customer Composition 렌더 분리
  - `AnalyticsTab.tsx`에서 가장 독립적인 두 블록인 `고객 구성 분석`, `고객 검색 수요 분석(검색 트렌드 포함)`을 별도 섹션 컴포넌트로 분리했다.
  - 집계 API, 계산식, 안내 문구, 모달 동작은 유지하고 렌더 책임만 나눠 다음 Analytics 수정 시 회귀 면적을 줄였다.
- v3.38.68 - [Service Payments] 카드결제 서버 검증 강화
  - `/api/services/payment/nicepay-callback`이 더 이상 브라우저의 성공 payload(`resCode`, `signData`, `amount`)를 신뢰하지 않고, `imp_uid` 기준 PortOne REST API 재조회로 실제 결제 상태/주문번호/금액을 확인한 뒤에만 `service_bookings.status='PAID'`, `payment_method='card'`, `service_requests.status='open'`으로 확정하도록 변경했다.
  - `/api/services/payment/card-ready`를 추가해 `NEXT_PUBLIC_PORTONE_IMP_CODE`, `PORTONE_API_KEY`, `PORTONE_API_SECRET` 준비 여부를 서버 기준으로 반환하고, 서비스 결제 페이지는 카드결제 준비가 안 된 환경에서 카드 버튼을 비활성화하도록 정리했다.
  - 새 스모크 `19-service-card-verification.spec.ts`가 조작된 성공 payload만으로 서비스 예약이 확정되지 않는지 직접 검증한다.
- v3.38.69 - [Service Payments] 고객 취소 환불 error-safe 정렬
  - `/api/services/cancel`의 `PAID + open` 고객 취소가 더 이상 PG 환불 실패 후 DB를 `cancelled`로 바꾸지 않고, PayPal/NicePay 환불이 실제로 성공한 경우에만 `service_bookings.status='cancelled'`, `service_requests.status='cancelled'`를 반영하도록 관리자 강제취소와 같은 기준으로 정렬했다.
  - PayPal capture id 또는 NicePay TID/환경변수가 누락된 `PAID` 서비스 예약은 자동 취소를 거부하고, 상태를 그대로 유지한 채 오류를 반환하도록 바꿨다.
  - 새 스모크 `20-service-cancel-error-safe.spec.ts`가 `환불 불가 → 상태 유지`, `PENDING 즉시 취소 유지` 두 경로를 직접 검증한다.
- v3.38.70 - [Service Payments] 결제수단 재진입 락 정렬
  - 서비스 결제 페이지가 pending `service_bookings.payment_method`를 함께 읽도록 바꾸고, 이미 `payment_method='bank'`로 표시된 `PENDING` 예약은 UI에서 무통장으로 고정해 카드/PayPal 재진입을 막았다.
  - `/api/services/payment/mark-bank`는 이미 bank인 예약에는 idempotent success를 반환하고, 다른 결제수단이 지정된 `PENDING` 예약에는 409를 반환하도록 조정했다.
  - `/api/services/payment/nicepay-callback`, `/api/services/payment/paypal/capture-order`는 `payment_method='bank'`인 `PENDING` 서비스 예약에 대한 카드/PayPal 확정을 거부하도록 보강했고, 새 스모크 `21-service-payment-method-lock.spec.ts`가 UI 안내와 서버 거부 동작을 직접 검증한다.
- v3.38.71 - [Service Notifications] 결제수단별 호스트 알림 범위 정렬
  - 서비스 결제 완료 후 호스트 모집 알림(`service_request_new`) 대상을 `getEligibleServiceHostIds()` helper로 통일해, 카드/NicePay, PayPal, 무통장 입금 확인 모두 같은 규칙을 쓰도록 정리했다.
  - 기준은 `approved host_applications` 중 고객 본인을 제외하고, `service_requests.city`가 있을 때 그 도시의 활성 체험(`experiences.is_active=true`)이 있는 호스트만 대상으로 하는 기존 카드/PayPal 규칙이다.
  - 새 스모크 `22-service-host-notification-scope.spec.ts`가 무통장 입금 확인 경로에서도 서울 의뢰가 서울 체험 호스트에게만 알림되는지 직접 검증한다.
- v3.38.72 - [Payments] 레거시 결제 경로 명시화
  - `app/api/bookings/confirm-payment/route.ts`, `app/api/services/bookings/route.ts`, `app/payment/success/page.tsx` 상단에 `LEGACY / compatibility only` 주석을 추가해, 현재 정식 결제 경로와 구분되도록 표시했다.
  - 동작은 변경하지 않고, 바로 제거하지 말아야 하는 레거시 후보라는 사실만 명시했다.
- v3.38.73 - [Analytics] 데이터 로딩/캐시/fallback 훅 분리
  - `AnalyticsTab.tsx`의 날짜 범위 기준 4개 admin API fetch, cache, source 상태, 로컬 fallback 집계를 `useAnalyticsSummaryData` 훅으로 분리해, 본체는 필터/탭/모달 렌더 책임만 남기도록 정리했다.
  - `AnalyticsBusinessSection`, `AnalyticsHostSection`, `analytics/helpers.tsx`에 공용 타입을 연결해 `stats`/섹션 props의 `any` 의존을 줄였고, 기존 화면 문구·모달·집계 의미는 변경하지 않았다.
- v3.38.96 - [Host Schedule] 일정 관리 저장 경계 서버화
  - `/host/experiences/[id]/dates`가 더 이상 브라우저에서 `experience_availability` insert/delete를 직접 수행하지 않고, `POST /api/host/experiences/:id/availability` 서버 route로 전체 availability 상태를 보내도록 변경했다.
  - 새 route는 로그인/소유권을 서버에서 확인하고, 현재 슬롯과 확정 예약(`PAID/confirmed/completed`)을 다시 조회해 삽입/삭제 diff를 계산한다. 예약이 붙은 슬롯 삭제는 route 수준에서 한 번 더 차단한다.
  - 새 스모크 `32-host-schedule-save.spec.ts`가 비로그인 401, 비소유자 403, 예약이 있는 슬롯 보존 + 허용된 변경만 반영되는지 직접 검증한다.
- v3.38.97 - [Host Experiences] 내 체험 삭제 경계 서버화
  - `MyExperiences`가 더 이상 브라우저에서 `supabase.from('experiences').delete()`를 직접 호출하지 않고, `DELETE /api/host/experiences/:id` 서버 route로 삭제를 요청하도록 변경했다.
  - 새 route는 로그인/소유권을 서버에서 확인한 뒤 삭제를 수행하고, 비로그인 `401`, 비소유자 `403`, 미존재 체험 `404`를 명확히 반환한다.
  - 새 스모크 `33-host-experience-delete.spec.ts`가 비로그인/비소유자 거부와 소유자 삭제 성공을 직접 검증한다.
