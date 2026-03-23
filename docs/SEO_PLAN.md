# Locally-web SEO / Metadata / Indexability 감사 및 1차 개선 계획

## Summary
현재 코드 기준으로 보면 Locally-web은 **기본 metadata 뼈대는 이미 있음**에도, Google 관점에서 바로 손봐야 할 문제가 몇 군데 확실합니다.

좋은 점:
- 루트 `app/layout.tsx` 에 기본 metadata가 있음
- `robots.ts`, `sitemap.ts` 가 이미 있음
- 체험 상세와 커뮤니티 글에는 최소한의 structured data가 이미 들어가 있음
- `admin`, `guest`, `host`, `account`, `login` 등 주요 내부 영역은 noindex 방향이 이미 잡혀 있음

확실한 문제:
- **locale canonical / hreflang 구현이 일관되지 않음**
- **일부 공개/거래성 페이지가 metadata 없이 기본 indexable 상태**
- **sitemap이 정적 페이지 + 체험 상세만 포함하고, 공개 콘텐츠를 많이 놓침**
- **공개 호스트 프로필 `/users/[id]` 가 metadata 없이 방치**
- **공용 헤더 로고가 `<h1>` 이라 페이지별 `<h1>` 과 충돌 가능**
- **홈 title과 루트 title template 조합이 브랜드 중복을 만들 가능성 있음**

이번 계획은 **SEO 대개편이 아니라, Google이 읽기 어렵거나 잘못 이해할 수 있는 지점을 회귀 없이 바로잡는 1차 정리**입니다.

선택 고정:
- **locale canonical 정책: self-canonical**
- **`/proxy-bookings/new` 는 indexable public landing으로 유지**

---

## 1. 현재 구조 기준 핵심 판단

### Metadata 구조
- 루트 metadata:
  - [app/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/layout.tsx)
- 공용 noindex helper:
  - [app/utils/seo.ts](/Users/sonhyungeun/Documents/locally-web/app/utils/seo.ts)
- 공용 public metadata helper:
  - [app/utils/publicMetadata.ts](/Users/sonhyungeun/Documents/locally-web/app/utils/publicMetadata.ts)

현재 패턴은 3종입니다.
1. 루트 기본 metadata 상속
2. layout 단위 metadata 적용
3. page 단위 `generateMetadata`

이 구조 자체는 괜찮습니다. 문제는 **helper와 개별 page 구현이 서로 다른 canonical 정책을 쓰고 있다**는 점입니다.

### 인덱싱 경계
- robots:
  - [app/robots.ts](/Users/sonhyungeun/Documents/locally-web/app/robots.ts)
- sitemap:
  - [app/sitemap.ts](/Users/sonhyungeun/Documents/locally-web/app/sitemap.ts)

현재 robots는 `/api/` 만 막고, 내부 UI는 page-level noindex에 맡깁니다. 이 방향은 맞습니다.  
즉 **robots.txt 자체가 큰 문제는 아니고, page metadata 쪽 noindex 누락이 문제**입니다.

### 현재 SEO가 비교적 잘 된 곳
- 홈:
  - [app/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/page.tsx)
  - Organization / Website JSON-LD 있음
- 체험 상세:
  - [app/experiences/[id]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/experiences/%5Bid%5D/page.tsx)
  - Product/TouristTrip JSON-LD 있음
- 커뮤니티 글:
  - [app/community/[id]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/community/%5Bid%5D/page.tsx)
  - Article + Breadcrumb JSON-LD 있음

### 현재 구조상 가장 위험한 곳
- locale canonical helper 불일치
- 거래성 페이지 noindex 누락
- sitemap 범위 부족
- public profile metadata 부재

---

## 2. SEO / metadata 문제 목록

### A. locale canonical / hreflang 문제
#### 1. `buildPublicMetadata()` 가 locale과 무관하게 ko canonical을 생성
- 파일:
  - [app/utils/publicMetadata.ts](/Users/sonhyungeun/Documents/locally-web/app/utils/publicMetadata.ts)
- 현재:
  - `const pageUrl = buildLocalizedAbsoluteUrl('ko', pathname);`
- 영향:
  - 아래 페이지들이 영어/일본어/중국어 URL이어도 canonical/openGraph.url 이 한국어 URL로 나감
  - [app/help/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/help/layout.tsx)
  - [app/company/news/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/company/news/layout.tsx)
  - [app/company/notices/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/company/notices/layout.tsx)
  - [app/company/careers/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/company/careers/layout.tsx)
  - [app/company/investors/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/company/investors/layout.tsx)
  - [app/company/partnership/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/company/partnership/layout.tsx)
  - [app/site-map/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/site-map/layout.tsx)

#### 2. 일부 public pages는 locale self-canonical이 아니라 ko canonical 고정
- 파일:
  - [app/experiences/[id]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/experiences/%5Bid%5D/page.tsx)
  - [app/community/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/community/page.tsx)
  - [app/community/[id]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/community/%5Bid%5D/page.tsx)
  - [app/services/intro/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/intro/page.tsx)
- 영향:
  - locale별 페이지가 자기 URL을 canonical로 갖지 않음
  - hreflang 전략이 흐려짐
  - 번역 URL의 검색 노출 가능성을 약하게 만듦

#### 3. 루트 layout `hreflang ko` 가 `/ko` 로 고정
- 파일:
  - [app/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/layout.tsx)
- 현재:
  - `ko: buildAbsoluteUrl('/ko')`
- 문제:
  - 다른 helper들은 ko를 prefix 없는 기본 경로로 취급
  - locale URL 정책이 코드 전체에서 일관되지 않음

### B. title 품질 문제
#### 4. 홈 title이 root template와 합쳐져 브랜드 중복 가능
- 파일:
  - [app/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/layout.tsx)
  - [app/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/page.tsx)
- 현재:
  - 루트 title template: `%s | Locally`
  - 홈 page title 자체도 `Locally - ...`
- 결과:
  - `Locally - ... | Locally` 형태 가능

#### 5. 일부 noindex 페이지 title에 브랜드를 이미 포함
- 파일:
  - [app/community/write/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/community/write/page.tsx)
  - [app/services/[requestId]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/%5BrequestId%5D/page.tsx)
- 중요도는 낮지만 title 규칙 일관성은 떨어짐

### C. public page metadata 누락
#### 6. 공개 호스트 프로필 `/users/[id]` metadata 없음
- 파일:
  - [app/users/[id]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/users/%5Bid%5D/page.tsx)
- 영향:
  - title/description/canonical/og/twiiter 부재
  - public profile인데 검색엔진 이해도가 낮음

#### 7. 전화 예약 공개 진입 `/proxy-bookings/new` metadata 없음
- 파일:
  - [app/proxy-bookings/new/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/proxy-bookings/new/page.tsx)
- 현재 선택:
  - 이 페이지는 **indexable public landing** 으로 유지
- 따라서 explicit metadata 필요

---

## 3. indexability / crawlability 문제 목록

### A. noindex 되어야 할 거래성/내부성 페이지 누락
아래는 현재 root metadata만 상속받아 **의도치 않게 indexable일 가능성이 높은 경계**입니다.

#### 1. 체험 결제 플로우
- [app/experiences/[id]/payment/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/experiences/%5Bid%5D/payment/page.tsx)
- [app/experiences/[id]/payment/complete/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/experiences/%5Bid%5D/payment/complete/page.tsx)

#### 2. 서비스 의뢰 작성/결제 플로우
- [app/services/request/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/request/page.tsx)
- [app/services/[requestId]/apply/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/%5BrequestId%5D/apply/page.tsx)
- [app/services/[requestId]/payment/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/%5BrequestId%5D/payment/page.tsx)
- [app/services/[requestId]/payment/complete/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/%5BrequestId%5D/payment/complete/page.tsx)

#### 3. 레거시 결제 성공 페이지
- [app/payment/success/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/payment/success/page.tsx)

#### 4. 전화 예약 list/detail
- [app/proxy-bookings/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/proxy-bookings/page.tsx)
- [app/proxy-bookings/[id]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/proxy-bookings/%5Bid%5D/page.tsx)

판단:
- `/proxy-bookings/new` 는 index 유지
- 나머지 proxy list/detail 은 noindex가 맞음

### B. sitemap 범위 부족
- 파일:
  - [app/sitemap.ts](/Users/sonhyungeun/Documents/locally-web/app/sitemap.ts)

현재 포함:
- 정적 공개 페이지
- 동적 체험 상세만

빠진 공개 콘텐츠:
- 커뮤니티 글 상세 `/community/[id]`
- public host profile `/users/[id]`
- 앞으로 indexable로 둘 public landing 중 일부

즉 현재 sitemap은 **공개 콘텐츠를 충분히 못 싣고 있음**.

### C. canonical/query 중복 위험
- 커뮤니티와 검색은 query parameter를 canonical base URL로 접는 방향인데, 이 자체는 괜찮습니다.
- 문제는 query보다 **locale canonical이 먼저 틀어져 있는 것**입니다.

### D. robots 상태
- [app/robots.ts](/Users/sonhyungeun/Documents/locally-web/app/robots.ts)
- 현재 판단:
  - 유지해도 됨
  - `/api/` disallow만 두고, private UI는 noindex metadata로 제어하는 현재 전략이 맞음
- 따라서 robots는 **1차 수정 대상이 아니라 점검 결과 유지**가 맞습니다.

---

## 4. 가장 안전한 1차 수정안

## 1차 목표
**Google이 잘못 canonicalize 하거나, 인덱싱되면 안 되는 페이지를 먹는 문제를 먼저 막는다.**

### 1차 수정 범위
#### A. locale canonical / hreflang 정리
수정 파일:
- [app/utils/publicMetadata.ts](/Users/sonhyungeun/Documents/locally-web/app/utils/publicMetadata.ts)
- [app/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/layout.tsx)
- [app/community/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/community/page.tsx)
- [app/community/[id]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/community/%5Bid%5D/page.tsx)
- [app/experiences/[id]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/experiences/%5Bid%5D/page.tsx)
- [app/services/intro/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/intro/page.tsx)

구현 규칙:
- 모든 public locale 페이지는 **self-canonical**
- `alternates.languages` 는 각 locale별 실제 URL 유지
- `ko` 는 prefix 없는 기본 경로를 canonical 정책의 기준으로 통일
- root layout `ko: /ko` 는 제거하고 `ko: /` 계열로 맞춤

#### B. 거래성 페이지 noindex 명시
수정 파일:
- [app/experiences/[id]/payment/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/experiences/%5Bid%5D/payment/page.tsx)
- [app/experiences/[id]/payment/complete/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/experiences/%5Bid%5D/payment/complete/page.tsx)
- [app/services/request/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/request/page.tsx)
- [app/services/[requestId]/apply/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/%5BrequestId%5D/apply/page.tsx)
- [app/services/[requestId]/payment/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/%5BrequestId%5D/payment/page.tsx)
- [app/services/[requestId]/payment/complete/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/%5BrequestId%5D/payment/complete/page.tsx)
- [app/payment/success/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/payment/success/page.tsx)
- [app/proxy-bookings/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/proxy-bookings/page.tsx)
- [app/proxy-bookings/[id]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/proxy-bookings/%5Bid%5D/page.tsx)

구현 규칙:
- 전부 `PRIVATE_NOINDEX_METADATA` 또는 명시적 `robots: { index: false, follow: false }`
- UI/기능/라우팅 변경 없음
- 검색엔진 노출만 막음

#### C. 전화 예약 공개 진입 metadata 추가
수정 파일:
- [app/proxy-bookings/new/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/proxy-bookings/new/page.tsx)

구현 규칙:
- indexable 유지
- explicit `generateMetadata` 추가
- title/description/canonical/openGraph/twitter 설정
- locale self-canonical 적용
- 현재 서비스 성격에 맞는 landing copy 기반 메타 구성

#### D. 홈 title 중복 정리
수정 파일:
- [app/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/page.tsx)
- 필요 시 [app/layout.tsx](/Users/sonhyungeun/Documents/locally-web/app/layout.tsx)

구현 규칙:
- root template는 유지
- home page title은 브랜드 중복이 나지 않게 문구 정리
- 다른 페이지 title 규칙은 일단 건드리지 않음

### 1차에서 robots/sitemap은?
- robots: 유지
- sitemap: 1차 감사 결과만 기록하고 구현은 2차로 미룸
- 이유:
  - 1차는 canonical/noindex 쪽이 더 급하고 회귀 위험이 낮음
  - sitemap 확대는 동적 row 선별 정책이 추가로 필요

---

## 5. 빠른 개선 효과가 큰 항목 TOP 5

1. **`buildPublicMetadata()` locale canonical 버그 수정**
- 영향 페이지가 많고 수정 범위는 작음
- 효과가 즉시 큼

2. **ko hreflang / canonical 정책 일관화**
- 루트 layout과 개별 page 간 충돌 제거
- 다국어 SEO 신호 정리

3. **거래성 페이지 noindex 정리**
- 잘못된 인덱싱 방지
- 가장 회귀 위험이 낮고 효과는 확실함

4. **`/proxy-bookings/new` explicit metadata 추가**
- 현재 index 유지 전략에 맞는 최소 landing SEO 보강

5. **홈 title 중복 제거**
- 사이트 대표 페이지의 title 품질 즉시 개선

---

## 6. 바로 구현 가능한 범위

## 바로 구현 권장 범위 = PR 1
### 포함
- locale self-canonical 정리
- `buildPublicMetadata()` 버그 수정
- root layout `ko` alternates 정리
- community / experience / services intro canonical 정리
- noindex 빠진 거래성 페이지 메타 정리
- `/proxy-bookings/new` metadata 추가
- 홈 title 중복 제거

### 제외
- sitemap 동적 확장
- public host profile metadata
- structured data 추가
- h1 구조 정리
- alt 개선 대규모 정리

이 PR은 **SEO 신호 오류 수정 + indexability 정리**만 포함하므로 회귀 위험이 가장 낮습니다.

---

## 7. 다음 턴으로 넘길 범위

## PR 2: sitemap / 공개 콘텐츠 coverage 확대
수정 파일:
- [app/sitemap.ts](/Users/sonhyungeun/Documents/locally-web/app/sitemap.ts)
- 필요 시 public host/profile query source

포함:
- community post detail `/community/[id]`
- public host profile `/users/[id]` (indexable로 둘 경우)
- 필요 시 `lastModified` 정책 정리

기본 선택:
- community posts는 sitemap 포함
- public host profile도 포함
- proxy request pages는 제외

## PR 3: public host profile metadata 보강
수정 파일:
- [app/users/[id]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/users/%5Bid%5D/page.tsx)

포함:
- explicit `generateMetadata`
- title/description/canonical/og/twitter
- approved host only indexable, otherwise noindex 여부를 코드 기준으로 결정
- 최소 Person/ProfilePage schema 제안 가능

## PR 4: structured data 최소 보강
우선순위:
1. experience detail에 BreadcrumbList 추가
2. help page에 FAQPage 검토
3. public host profile에 Person/ProfilePage 검토

현재 구조에서 가장 안전한 최소 범위:
- [app/experiences/[id]/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/experiences/%5Bid%5D/page.tsx) 에 Breadcrumb JSON-LD 추가

## PR 5: 구조적 HTML / heading cleanup
포함:
- [app/components/SiteHeader.tsx](/Users/sonhyungeun/Documents/locally-web/app/components/SiteHeader.tsx)
  - 로고 `<h1>` 제거
  - `<span>` 또는 `<div>` 로 교체
- page별 실제 `<h1>` 만 남기기

이건 SEO도 맞지만 공용 헤더 영향이 있어 1차보다 뒤로 미룹니다.

---

## 보류할 범위

### 구조가 커서 보류
- URL 구조 전면 개편
- locale routing 정책 재설계
- search/category/region landing 신설
- DB schema 변경
- host/category/city SEO landing 대규모 확장
- image alt 전체 일괄 정리
- 모든 public page에 개별 og:image 자산 제작

---

## 머지 가능한 최소 단위

### PR 1
**metadata / canonical / noindex correction**
- 회귀 위험 낮음
- 효과 큼
- 추천 첫 머지

### PR 2
**sitemap dynamic coverage**
- 효과 좋음
- DB query surface 증가
- PR 1 다음

### PR 3
**public host profile metadata**
- 공개 페이지 확장
- 영향 범위 작음

### PR 4
**structured data minimal additions**
- Breadcrumb first

### PR 5
**heading / HTML semantics cleanup**
- SEO보다 마크업 위생 성격
- 가장 뒤

---

## Important Changes Or Additions To Public APIs / Interfaces / Types
- API 변경 없음
- DB schema 변경 없음
- URL 구조 변경 없음

내부 변경만 있음:
- page/layout metadata outputs
- canonical / alternates / robots values
- sitemap output entries
- JSON-LD script additions
- optional internal helper correction:
  - [app/utils/publicMetadata.ts](/Users/sonhyungeun/Documents/locally-web/app/utils/publicMetadata.ts)

---

## Test Cases And Scenarios

### Metadata / canonical
- `/help`, `/company/news`, `/company/notices`, `/site-map` 의 `canonical` 이 현재 locale URL을 가리켜야 함
- `/en/help` 는 `/help` 로 canonicalize 되지 않아야 함
- `hreflang` 의 `ko/en/ja/zh` 가 모두 실제 URL 정책과 일치해야 함

### noindex
- `/experiences/[id]/payment`
- `/experiences/[id]/payment/complete`
- `/services/request`
- `/services/[requestId]/apply`
- `/services/[requestId]/payment`
- `/services/[requestId]/payment/complete`
- `/payment/success`
- `/proxy-bookings`
- `/proxy-bookings/[id]`
위 경로들에 `noindex,nofollow` 가 들어가야 함

### indexable public landing
- `/proxy-bookings/new` 는 indexable
- explicit title/description/canonical/og/twitter 존재

### title quality
- 홈 title이 `Locally ... | Locally` 형태로 중복되지 않아야 함

### sitemap
- PR 2에서 `/sitemap.xml` 에:
  - static public pages
  - experiences
  - community posts
  - public host profiles
  가 기대 범위대로 포함되어야 함

### structured data
- 홈:
  - Organization / Website 유지
- 체험 상세:
  - Product 유지
  - Breadcrumb 추가 시 JSON-LD 유효
- 커뮤니티 글:
  - Article + Breadcrumb 유지

---

## Explicit Assumptions And Defaults
- locale canonical 정책은 **self-canonical** 로 고정
- `/proxy-bookings/new` 는 **indexable public landing** 으로 유지
- `/proxy-bookings` list/detail 은 **noindex**
- `robots.ts` 는 현재 정책 유지가 맞음
- `sitemap.ts` 는 1차에서 수정하지 않고, 2차에서 동적 콘텐츠 범위를 넓힘
- public host profile `/users/[id]` 는 다음 턴에서 metadata를 붙여 indexable 공개 페이지로 정리하는 것을 기본값으로 둠
- structured data는 1차 욕심내지 않고, experience breadcrumb부터 최소 범위로 추가
