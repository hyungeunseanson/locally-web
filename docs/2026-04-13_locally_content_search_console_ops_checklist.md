# 로컬리 콘텐츠 검색 노출 운영 체크리스트

## 목적
- 이 문서는 `코드가 이미 indexable 상태인지`와 별개로, 실제 Google/Naver 검색엔진에 로컬리 콘텐츠가 잘 잡히게 하는 운영 체크리스트다
- 현재 제품 해석은 `COMMUNITY_OPEN=false` 기준 `locally_content` 공개 발행면 운영이다
- 따라서 운영 체크 대상도 `/community`와 `locally_content` 상세 중심으로 고정한다

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
