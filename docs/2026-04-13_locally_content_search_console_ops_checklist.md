# 로컬리 콘텐츠 검색 노출 운영 체크리스트

## 목적
- 이 문서는 `코드가 이미 indexable 상태인지`와 별개로, 실제 Google/Naver 검색엔진에 로컬리 콘텐츠가 잘 잡히게 하는 운영 체크리스트다
- 현재 제품 해석은 `COMMUNITY_OPEN=false` 기준 `locally_content` 공개 발행면 운영이다
- 따라서 운영 체크 대상도 `/community`와 `locally_content` 상세 중심으로 고정한다
- cutover 직후 실제 실행 순서는 [docs/2026-04-13_search_engine_cutover_submission_runbook.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_search_engine_cutover_submission_runbook.md:1) 기준으로 본다

## 현재 운영 기준 URL
- 현재 코드의 site URL single source는 `NEXT_PUBLIC_SITE_URL`이다
- source of truth
  - [app/utils/siteUrl.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/siteUrl.ts:1)
  - [docs/gemini.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/gemini.md:458)
- 아직 기존 웹사이트가 `www.locally-travel.com`을 쓰고 있는 동안에는, 이 저장소의 canonical / sitemap / robots / OG 기준 URL도 현재 배포 도메인으로 유지해야 한다
- 즉 전환 전 원칙은 단순하다
  - 현재 운영 배포 도메인 유지
  - `www.locally-travel.com` cutover 시점까지 SEO 코드 수정은 하지 않음
  - 최종 전환 시에는 `NEXT_PUBLIC_SITE_URL`만 새 도메인으로 교체하고 재배포
- 절대 하면 안 되는 것
  - 실제 연결 전 `NEXT_PUBLIC_SITE_URL`만 먼저 `www.locally-travel.com`으로 바꾸는 것
  - 이렇게 하면 canonical/sitemap은 새 도메인을 가리키는데 실제 응답은 옛 도메인에 남아 source mismatch가 생긴다

## 운영 범위
- indexable 대상
  - `/community`
  - `/community/[id]` 중 `locally_content`
- noindex 대상
  - `/community/write`
  - legacy `qna / companion / info` 상세
  - 기타 private/auth surface

## Google Search Console 체크리스트
### 1. 도메인 속성 확인
- Search Console에 실제 운영 도메인이 등록되어 있어야 한다
- 가능하면 URL-prefix보다 Domain property를 우선으로 둔다
- `https`, `www`, locale path가 실제 운영 도메인과 어긋나지 않는지 확인한다
- 도메인 전환 전에는 현재 운영 배포 도메인 기준 property를 보고, 전환 후에는 `www.locally-travel.com` 기준 property를 주 속성으로 삼는다

### 2. sitemap 제출
- `sitemap.xml` 제출 URL
  - `https://<운영도메인>/sitemap.xml`
- 제출 후 확인 항목
  - `/community`
  - 최근 `locally_content` 상세 URL 2~3개
- 기준
  - 색인 대상이 아닌 legacy 상세가 sitemap에 보이면 안 된다

### 3. URL Inspection
- 새 콘텐츠 글을 발행하면 최소 1건은 URL Inspection으로 확인한다
- 체크 항목
  - canonical이 자기 자신인지
  - 크롤링 가능 상태인지
  - `noindex`가 아닌지
  - 마지막 크롤 날짜가 지나치게 오래되지 않았는지
- 색인 지연이 있으면 `색인 생성 요청`까지 진행한다

### 4. Rich Results Test
- 대표 `locally_content` 상세 URL 1~2개를 Rich Results Test로 확인한다
- 체크 항목
  - `Article`
  - `BreadcrumbList`
- 경고가 있더라도 치명적 오류가 아니면 우선 기록하고, 실제 미노출 원인과 분리해서 본다

### 5. 대표 이미지 품질
- 검색 노출용 대표 이미지는 아래를 만족하는 편이 좋다
  - 본문과 실제로 관련 있음
  - 크롤 가능한 공개 URL
  - 지나치게 작은 썸네일이 아님
- 로고 fallback만 반복되는 글은 검색 썸네일 품질이 약해질 수 있으므로 운영상 지양한다

### 6. 발행 후 확인 루프
- 새 글 발행 후 운영 확인 순서
  1. 실제 상세 URL 열기
  2. 페이지 소스에서 title/description/JSON-LD 확인
  3. sitemap 반영 확인
  4. Search Console URL Inspection
- 최소 주 1회는 `/community` 허브와 최근 글 3건 정도를 샘플링한다

## 실도메인 cutover 체크리스트
### 1. cutover 직전
- `www.locally-travel.com`이 아직 이전 사이트에 연결돼 있으면, 이 저장소의 `NEXT_PUBLIC_SITE_URL`은 그대로 현재 배포 도메인에 둔다
- cutover 직전에 아래를 같이 준비한다
  - Vercel 프로젝트에 `www.locally-travel.com` 연결 가능 상태
  - `NEXT_PUBLIC_SITE_URL=https://www.locally-travel.com`
  - live smoke를 쓴다면 `PLAYWRIGHT_LIVE_BASE_URL=https://www.locally-travel.com`

### 2. cutover 실행
- 순서는 반드시 아래처럼 고정한다
  1. Vercel에서 `www.locally-travel.com`을 현재 프로젝트에 연결
  2. `NEXT_PUBLIC_SITE_URL`을 `https://www.locally-travel.com`으로 변경
  3. 필요하면 `PLAYWRIGHT_LIVE_BASE_URL`도 같은 값으로 변경
  4. production 재배포
- 이 묶음은 코드 수정이 아니라 env + 배포 작업이다

### 3. cutover 직후 검증
- 브라우저에서 아래를 바로 확인한다
  - `https://www.locally-travel.com/robots.txt`
  - `https://www.locally-travel.com/sitemap.xml`
  - `https://www.locally-travel.com/community`
  - 최근 `locally_content` 상세 2건
- 확인 항목
  - canonical이 `www.locally-travel.com`으로 바뀌었는지
  - sitemap URL들도 새 도메인 기준인지
  - robots의 sitemap 링크가 새 도메인인지
  - `/community`와 상세의 OG URL이 새 도메인인지

### 4. cutover 후 Search Console / Naver 후속
- Google
  - `https://www.locally-travel.com/sitemap.xml` 다시 제출
  - `/community`와 최근 콘텐츠 2~3건 URL Inspection 실행
  - 필요 시 `색인 생성 요청`
- Naver
  - 새 도메인 기준 sitemap 재제출
  - robots.txt 재확인
  - 대표 상세 URL 1~2개 수집 요청 여부 확인

### 5. rollback 기준
- 아래 중 하나라도 깨지면 우선 env와 연결 상태부터 확인한다
  - canonical은 새 도메인인데 실제 페이지는 이전 도메인으로 리다이렉트됨
  - robots/sitemap은 이전 도메인을 계속 가리킴
  - Search Console inspection에서 alternate canonical mismatch가 뜸
- 즉 cutover 이슈의 1순위 의심 지점은 코드가 아니라 `도메인 연결 + NEXT_PUBLIC_SITE_URL + 재배포 반영 여부`다

## Naver Search Advisor 체크리스트
### 1. 사이트 등록
- 운영 도메인이 Search Advisor에 등록되어 있어야 한다
- robots.txt와 sitemap 제출이 가능한 상태인지 먼저 확인한다

### 2. sitemap 제출
- 제출 URL
  - `https://<운영도메인>/sitemap.xml`
- 제출 후 확인 항목
  - `/community`
  - 최근 `locally_content` 상세 URL 2~3개

### 3. robots.txt 확인
- 루트 `robots.txt`가 정상 응답하는지 확인한다
- 기준
  - `/api/`는 막혀 있어도 괜찮다
  - 공개 콘텐츠 URL은 robots 차단으로 막히면 안 된다

### 4. 구조화 데이터/메타 확인
- Naver도 페이지 유형에 맞는 구조화 데이터를 권장하므로, 대표 상세 URL 1~2개를 샘플링해서 아래를 본다
  - title
  - description
  - canonical
  - `Article`
  - `BreadcrumbList`

## 운영 주기
- 새 콘텐츠 발행일
  - 새 글 1건 이상 URL Inspection 확인
- 주간
  - 최근 글 3건 샘플 점검
  - `/community` 허브 인덱싱 상태 확인
- 월간
  - Search Console 성능 보고서에서 impressions / clicks / query 확인
  - Naver 유입 유무 확인
  - 로고 fallback 글 비율 점검

## 실패 시 먼저 볼 것
- `/community/[id]`가 `locally_content`인지
- sitemap에 실제 포함됐는지
- canonical/self URL이 맞는지
- `noindex`가 잘못 붙지 않았는지
- 대표 이미지가 빈약하지 않은지
- Search Console inspection에서 크롤링/색인 차단 메시지가 없는지

## 운영 메모
- 현재 코드는 legacy community 상세를 접근 가능하게 남겨두되 noindex로 미는 정책이다
- 즉 “열린다”와 “검색에 적극 노출한다”는 같은 뜻이 아니다
- 검색 유입 성과는 코드보다 실제 콘텐츠 품질, 이미지, 제목, 발행 빈도에 더 크게 좌우될 수 있다
- 실도메인 cutover는 SEO 로직 변경 작업이 아니라 `site URL env 전환 작업`이다
- 따라서 cutover 시점에는 코드를 다시 바꾸기보다, env와 배포 반영이 올바른지부터 보는 게 맞다

## 참고 공식 문서
- Google Title links
  - <https://developers.google.com/search/docs/appearance/title-link>
- Google Snippets / meta description
  - <https://developers.google.com/search/docs/appearance/snippet>
- Google Canonicalization
  - <https://developers.google.com/search/docs/crawling-indexing/canonicalization>
- Google Article structured data
  - <https://developers.google.com/search/docs/appearance/structured-data/article>
- Google Publication dates
  - <https://developers.google.com/search/docs/appearance/publication-dates>
- Google Breadcrumb structured data
  - <https://developers.google.com/search/docs/appearance/structured-data/breadcrumb>
- Google Rich Results Test
  - <https://support.google.com/webmasters/answer/7445569?hl=en>
- Google Build and submit a sitemap
  - <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>
- Google Image SEO best practices
  - <https://developers.google.com/search/docs/advanced/guidelines/google-images?hl=en&rd=1&visit_id=637707031108476076-2422721029>
- Google Search Essentials
  - <https://developers.google.com/search/docs/essentials>
- Google Helpful content
  - <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- Naver RSS 및 사이트맵 제출
  - <https://searchadvisor.naver.com/guide/request-feed>
- Naver robots.txt 설정하기
  - <https://searchadvisor.naver.com/guide/seo-basic-robots>
