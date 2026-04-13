# 로컬리 콘텐츠 SEO / 검색 노출 감사

## Summary
- 감사 범위: `COMMUNITY_OPEN=false` 기준의 `Locally 콘텐츠 공개 허브 /community`, 콘텐츠 상세 `/community/[id]`, 발행 경계 `/community/write`, `sitemap.xml`, `robots.txt`
- 제외 범위: 오픈 포럼 재개 여부, 댓글/좋아요 UX 개편, Search Console / Naver Search Advisor 실제 콘솔 설정 변경
- 실행 방식: 정적 코드 감사 + 핵심 non-live E2E 재실행 + 최신 Google/Naver 공식 가이드 대조
- latest verification
  - SEO close-out bundle: `31 passed (30.1s)`
    - `tests/e2e/25-public-metadata.spec.ts`
    - `tests/e2e/26-private-noindex.spec.ts`
    - `tests/e2e/29-sitemap.spec.ts`
    - `tests/e2e/46-community-detail-state.spec.ts`
    - `tests/e2e/47-community-post-route.spec.ts`
    - `tests/e2e/59-community-feed-contract.spec.ts`
    - `tests/e2e/62-community-author-modal.spec.ts`
    - `tests/e2e/63-community-content-layout.spec.ts`
  - runtime follow-up bundle: `4 passed (8.7s)`
    - `tests/e2e/61-community-view-count.spec.ts`
    - `tests/e2e/67-analytics-ingest-routes.spec.ts`
  - stability smoke: `6 passed (18.2s)`
    - `tests/e2e/46-community-detail-state.spec.ts`
    - `tests/e2e/61-community-view-count.spec.ts`
    - `tests/e2e/67-analytics-ingest-routes.spec.ts`
- close-out 결론
  - 현재 운영 의미는 `오픈 커뮤니티`가 아니라 `Locally 콘텐츠 공개 발행면`이다
  - 코드 기준 indexability는 이제 `locally_content` 중심으로 잠겼다
  - legacy `qna / companion / info` 상세는 접근은 유지하지만 검색 노출 대상에서는 빠진다
  - 남는 항목은 코드 결함이 아니라 Search Console / Naver Search Advisor 운영 체크포인트와 실제 콘텐츠 품질 관리다

## Latest Official Guidance
- Google은 title link를 `<title>`만으로 고정하지 않고, H1과 prominent text도 함께 참고한다
  - Source: <https://developers.google.com/search/docs/appearance/title-link>
- meta description은 길이보다 페이지별 고유성과 정확성이 중요하다
  - Source: <https://developers.google.com/search/docs/appearance/snippet>
- canonical은 `rel=canonical`, redirect, sitemap이 함께 signal을 만든다
  - Source: <https://developers.google.com/search/docs/crawling-indexing/canonicalization>
- Article 구조화 데이터는 `headline`, `image`, `datePublished`, `dateModified`, `author`를 가능한 한 충실히 채우는 편이 좋다
  - Source: <https://developers.google.com/search/docs/appearance/structured-data/article>
  - Source: <https://developers.google.com/search/docs/appearance/publication-dates>
- Breadcrumb는 실제 사용자 경로를 반영해야 하고, 운영 루프에는 Rich Results Test와 sitemap 제출이 포함된다
  - Source: <https://developers.google.com/search/docs/appearance/structured-data/breadcrumb>
  - Source: <https://support.google.com/webmasters/answer/7445569?hl=en>
  - Source: <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>
- Google 이미지 SEO는 crawlable URL, 충분한 해상도, 페이지 본문과 실제로 관련 있는 대표 이미지를 권장한다
  - Source: <https://developers.google.com/search/docs/advanced/guidelines/google-images?hl=en&rd=1&visit_id=637707031108476076-2422721029>
- 검색 노출은 메타데이터만으로 보장되지 않고 Search Essentials / helpful content 기준도 함께 본다
  - Source: <https://developers.google.com/search/docs/essentials>
  - Source: <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- Naver는 sitemap/RSS 제출, 루트 `robots.txt`, 페이지 유형에 맞는 구조화 데이터를 기본 운영 축으로 둔다
  - Source: <https://searchadvisor.naver.com/guide/request-feed>
  - Source: <https://searchadvisor.naver.com/guide/seo-basic-robots>

## Result Snapshot
| Chain | Source of truth | Current tests | Verdict | Notes |
| --- | --- | --- | --- | --- |
| 공개 콘텐츠 허브 `/community` | `app/community/page.tsx`, `app/community/categoryMeta.ts`, `app/api/community/route.ts` | `25`, `29`, `59`, `63` | 정상 | `COMMUNITY_OPEN=false`일 때 title/description/canonical이 `로컬리 콘텐츠` 허브 의미로 수렴한다 |
| 콘텐츠 상세 `/community/[id]` metadata / JSON-LD | `app/community/[id]/page.tsx`, `app/utils/structuredData.ts` | `25`, `46`, `62`, `63` | 정상 | indexable 대상은 `locally_content`로 좁혀졌고 `Article`, `Breadcrumb`, `author.url`, visible modified date가 정렬됐다 |
| indexability / sitemap / robots / write noindex | `app/sitemap.ts`, `app/robots.ts`, `app/community/write/page.tsx` | `26`, `29`, `47` | 정상 | sitemap은 `COMMUNITY_OPEN=false`에서 `locally_content`만 싣고, legacy 상세는 noindex, `/community/write`는 noindex 유지 |
| 발행 경계 / admin-only locally content | `/api/community/posts`, `resolveAdminAccess()`, `revalidatePath('/community')` | `47`, `59`, `63` | 정상 | admin-only 발행, insert 실패 cleanup, 목록 revalidate가 유지된다 |
| 상세 runtime social proof | `/api/community/views`, `CommunityCommentsPanel`, `publicWriteGuard` | `61`, `67` | 정상 | loopback origin guard와 detail catch-up이 정렬되어 조회수 반영이 다시 green으로 돌아왔다 |

## Confirmed Findings
### 1. 현재 공개 surface의 제품 의미는 “오픈 포럼”이 아니라 “로컬리 콘텐츠 허브”다
- source of truth
  - [app/community/categoryMeta.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/categoryMeta.ts:1)
  - [app/community/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/page.tsx:1)
- 현재 코드 기준으로 `COMMUNITY_OPEN=false`이며, `/community`는 질문/동행 오픈 포럼이 아니라 `로컬리 콘텐츠` 허브로 해석하는 것이 맞다
- 따라서 검색 노출 대상도 `community_posts` 전체가 아니라 `locally_content` 중심으로 좁히는 것이 현재 제품 의미와 일치한다

### 2. `/community` 허브는 기본 검색 유입 랜딩으로 충분한 메타 신호를 갖춘 상태다
- source of truth
  - [app/community/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/page.tsx:56)
- 현재 확인된 사실
  - `title`, `description`, canonical, localized alternates가 `COMMUNITY_OPEN=false` 기준 콘텐츠 허브 의미로 정렬돼 있다
  - query가 붙어도 대표 URL은 `/community`로 수렴한다
  - `openGraph`, `twitter`도 같은 허브 의미를 공유한다
- 판정
  - 현재 제품 해석 기준 `정상`

### 3. 콘텐츠 상세는 검색 유입용 Article 랜딩 기준을 충족한다
- source of truth
  - [app/community/[id]/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/%5Bid%5D/page.tsx:24)
  - [app/utils/structuredData.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/structuredData.ts:19)
- 현재 확인된 사실
  - `<title>`과 H1이 같은 제목 의미를 공유한다
  - `description`, `openGraph`, `twitter`, canonical, alternates가 같은 페이지 사실을 가리킨다
  - `Article`과 `BreadcrumbList` JSON-LD가 내려간다
  - 공개 가능한 작성자인 경우 `Article.author.url`이 함께 내려간다
  - `updated_at > created_at`일 때만 visible `수정됨` 날짜가 노출된다
- 판정
  - 코드 기준 `정상`

### 4. 검색 노출 범위는 이제 `locally_content`로 잠겼다
- source of truth
  - [app/sitemap.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/sitemap.ts:119)
  - [app/community/[id]/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/%5Bid%5D/page.tsx:24)
- 현재 확인된 사실
  - `COMMUNITY_OPEN=false`일 때 sitemap은 `community_posts` 전체가 아니라 `category='locally_content'`만 추가한다
  - 상세 metadata는 `COMMUNITY_OPEN=false`이면서 `locally_content`가 아닌 legacy category일 경우 `noindex,nofollow`를 내린다
  - 즉 legacy 상세는 링크 호환은 유지하지만 검색엔진 대상에서는 빠진다
- 판정
  - 이번 close-out의 핵심 gap이 닫혔으므로 `정상`

### 5. 발행 경계는 SEO용 콘텐츠 채널 보호막으로 계속 안전하다
- source of truth
  - [app/community/write/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/write/page.tsx:1)
  - [app/api/community/posts/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/community/posts/route.ts:1)
- 현재 확인된 사실
  - `/community/write`는 page-level noindex다
  - `locally_content` write는 admin-only다
  - insert 실패 시 업로드 이미지 cleanup이 있고, 성공 시 `revalidatePath('/community')`가 유지된다
- 판정
  - `정상`

### 6. 조회수 반영 리스크는 SEO 인접 runtime 항목으로 닫혔다
- source of truth
  - [app/api/community/views/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/community/views/route.ts:1)
  - [app/community/components/CommunityCommentsPanel.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/components/CommunityCommentsPanel.tsx:1)
  - [app/utils/security/publicWriteGuard.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/security/publicWriteGuard.ts:1)
- 현재 확인된 사실
  - loopback alias `localhost / 127.0.0.1 / ::1`가 동일 origin 후보로 처리된다
  - 상세 first-open 시 `currentViewCount` catch-up이 들어가 UI와 DB truth가 다시 맞춰졌다
  - `tests/e2e/61-community-view-count.spec.ts`가 다시 green으로 닫혔다
- 판정
  - `정상`

## Coverage Gaps
- Search Console URL Inspection 결과, sitemap 실제 제출 상태, Naver Search Advisor 등록 상태는 repo 바깥 운영 사실이라 이 문서만으로는 판정할 수 없다
- 대표 이미지가 없는 콘텐츠는 여전히 로고 fallback을 쓰므로, 검색 썸네일 품질은 코드보다 실제 발행 콘텐츠 품질에 더 좌우된다
- RSS/Atom feed는 현재 repo tracked 운영 surface로는 보이지 않는다. 다만 지금 제품 목표가 `locally_content` 검색 노출 1차 안정화라면 필수 blocker는 아니다

## Follow-up Need
- 1순위
  - Google Search Console / Naver Search Advisor 운영 제출과 inspection 루프를 별도 체크리스트로 운영해야 한다
  - 현재 체크리스트 문서: [docs/2026-04-13_locally_content_search_console_ops_checklist.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_locally_content_search_console_ops_checklist.md:1)
- 2순위
  - `locally_content` 발행 시 대표 이미지 품질 기준을 운영 규칙으로 잠그는 것이 좋다
- 3순위
  - 나중에 `/community`를 도시별 혹은 포맷별 indexable landing으로 넓힐 계획이 생기면 canonical 전략을 다시 열어야 한다
  - 실도메인 `www.locally-travel.com` cutover 시에는 코드 수정이 아니라 `NEXT_PUBLIC_SITE_URL` 전환과 재배포 기준으로 처리한다

## Final Verdict
- 현재 코드 기준 `로컬리 콘텐츠 SEO core`는 `정상`이다
- 이유는 다음과 같다
  - `/community` 허브 메타데이터가 현재 제품 의미와 맞다
  - 검색엔진 노출 범위가 `locally_content` 중심으로 정리됐다
  - legacy 상세는 접근은 유지하면서 noindex로 밀어냈다
  - `Article`, `Breadcrumb`, `author.url`, visible modified date가 일관된 의미로 맞춰졌다
  - 조회수 runtime 반영까지 green으로 회복됐다
- 다만 실제 검색 유입 성과는 코드만으로 끝나지 않는다
  - Search Console / Naver Search Advisor 제출
  - URL inspection / rich result 확인
  - 대표 이미지와 본문 품질
- 따라서 이번 close-out의 정확한 결론은 아래다
  - `코드 기준 최종 판정`: `정상`
  - `운영 제출/콘텐츠 품질`: 별도 체크리스트로 계속 관리 필요
