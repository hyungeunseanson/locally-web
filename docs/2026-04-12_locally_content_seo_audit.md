# 로컬리 콘텐츠 SEO / 검색 노출 감사

## Summary
- 감사 범위: `COMMUNITY_OPEN=false` 기준의 `Locally 콘텐츠 공개 허브 /community`, 콘텐츠 상세 `/community/[id]`, 발행 경계 `/community/write`, sitemap/robots, 게시글 발행 API
- 제외 범위: 오픈 포럼 재개 여부, 댓글/좋아요 UX 개편, Search Console / Naver Search Advisor 실제 콘솔 설정 변경, 구현 수정
- 실행 방식: 정적 코드 감사 + 핵심 non-live E2E 재실행 + 최신 Google/Naver 공식 가이드 대조
- latest run
  - core bundle: `27 passed / 1 failed (33.0s)`
    - `tests/e2e/25-public-metadata.spec.ts`
    - `tests/e2e/26-private-noindex.spec.ts`
    - `tests/e2e/29-sitemap.spec.ts`
    - `tests/e2e/47-community-post-route.spec.ts`
    - `tests/e2e/59-community-feed-contract.spec.ts`
    - `tests/e2e/61-community-view-count.spec.ts`
    - `tests/e2e/63-community-content-layout.spec.ts`
  - support bundle: `2 passed (15.7s)`
    - `tests/e2e/46-community-detail-state.spec.ts`
    - `tests/e2e/62-community-author-modal.spec.ts`
  - total close-out snapshot: `29 passed / 1 failed`
- 이번 감사 핵심 결론
  - `/community`와 `locally_content` 상세는 현재도 Google 기본 SEO 신호를 꽤 잘 갖추고 있다
  - 다만 현재 제품 해석이 “오픈 커뮤니티 중단 + 로컬리 콘텐츠만 운영”이라면, `app/sitemap.ts`가 `community_posts` 전체를 그대로 싣는 구조는 여전히 레거시 community 글 노출 가능성을 남긴다
  - 콘텐츠 상세의 `Article` / `Breadcrumb` 구조화 데이터는 존재하지만, `author.url`, 대표 이미지 품질, visible modified date 정합성은 더 좋아질 여지가 있다
  - active failure 1건은 `조회수` 클라이언트 반영이며, 검색 indexability 핵심 blocker는 아니지만 콘텐츠 상세의 social proof/runtime 품질 리스크로 분리 기록하는 것이 맞다

## Latest Official Guidance
- Google `title`은 단순히 `<title>`만 보는 것이 아니라 H1, `og:title`, prominent text까지 함께 해석할 수 있으므로, 페이지 고유 제목과 visible headline의 일관성이 중요하다
  - Source: <https://developers.google.com/search/docs/appearance/title-link>
- `meta description`은 길이 고정보다 “페이지별로 고유하고 정확한 설명”이 더 중요하다
  - Source: <https://developers.google.com/search/docs/appearance/snippet>
- canonical은 `rel=canonical`, redirect, sitemap이 함께 signal을 만들기 때문에 중복/필터 URL이 있을수록 일관성이 중요하다
  - Source: <https://developers.google.com/search/docs/crawling-indexing/canonicalization>
- `Article` 구조화 데이터는 `headline`, `image`, `datePublished`, `dateModified`, `author`를 가능한 한 충실히 채우는 편이 좋고, 날짜는 사용자에게 보이는 날짜 의미와 어긋나지 않는 편이 유리하다
  - Source: <https://developers.google.com/search/docs/appearance/structured-data/article>
  - Source: <https://developers.google.com/search/docs/appearance/publication-dates>
- `BreadcrumbList`는 실제 사용자 이동 경로를 반영해야 하며, 운영 루프에는 Rich Results Test와 sitemap 제출이 함께 포함된다
  - Source: <https://developers.google.com/search/docs/appearance/structured-data/breadcrumb>
  - Source: <https://support.google.com/webmasters/answer/7445569?hl=en>
  - Source: <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>
- 이미지 SEO는 크롤 가능한 URL, 충분한 해상도, 페이지 본문과 실제로 관련 있는 대표 이미지가 핵심이다
  - Source: <https://developers.google.com/search/docs/advanced/guidelines/google-images?hl=en&rd=1&visit_id=637707031108476076-2422721029>
- 검색 노출은 메타데이터만으로 결정되지 않고, Search Essentials / helpful content 기준도 함께 본다
  - Source: <https://developers.google.com/search/docs/essentials>
  - Source: <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- Naver는 sitemap/RSS 제출, 루트 `robots.txt`, 페이지 유형에 맞는 구조화 데이터 사용을 기본 운영 축으로 권장한다
  - Source: <https://searchadvisor.naver.com/guide/request-feed>
  - Source: <https://searchadvisor.naver.com/guide/seo-basic-robots>

## Result Snapshot
| Chain | Source of truth | Current tests | Verdict | Notes |
| --- | --- | --- | --- | --- |
| 공개 콘텐츠 허브 `/community` | `app/community/page.tsx`, `app/community/categoryMeta.ts`, `app/api/community/route.ts` | `25`, `29`, `59`, `63` | 정상 | `COMMUNITY_OPEN=false`일 때 title/description/canonical/alternates가 `로컬리 콘텐츠` 중심으로 수렴한다 |
| 콘텐츠 상세 `/community/[id]` metadata / JSON-LD | `app/community/[id]/page.tsx`, `app/utils/structuredData.ts` | `25`, `46`, `62`, `63` | 부분 보장 | unique title/description, `Article`, `Breadcrumb`는 정상이나 `author.url` 미포함, visible modified date 부재, logo fallback 이미지 의존은 개선 여지가 있다 |
| indexability / sitemap / robots / write noindex | `app/sitemap.ts`, `app/robots.ts`, `app/community/write/page.tsx` | `26`, `29`, `47` | 부분 보장 | `/community/write` noindex는 정상이나 sitemap이 `community_posts` 전체를 노출해 레거시 Q&A/동행/꿀팁 row까지 색인 후보로 남길 수 있다 |
| 발행 경계 / admin-only locally content | `/api/community/posts`, `resolveAdminAccess()`, `revalidatePath('/community')` | `47`, `59`, `63` | 정상 | `locally_content`는 admin-only로 막혀 있고 insert 실패 시 업로드 이미지 cleanup과 feed revalidate가 같이 동작한다 |
| 상세 runtime social proof | `/api/community/views`, `CommunityCommentsPanel` | `61` | 리스크 | 현재 테스트 기준 `조회 1`로 올라가야 할 UI가 `조회 0`에 머문다 |

## Confirmed Findings
### 1. 현재 공개 surface의 제품 의미는 “오픈 포럼”이 아니라 “로컬리 콘텐츠 허브”다
- source of truth
  - [app/community/categoryMeta.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/categoryMeta.ts:1)
  - [app/community/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/page.tsx:1)
- 현재 코드 기준으로 `COMMUNITY_OPEN=false`이며, `/community`는 질문/동행 오픈 포럼이 아니라 `로컬리 콘텐츠` 허브 쪽으로 의미가 고정되어 있다
- 따라서 이번 SEO 감사의 핵심 대상은 “커뮤니티 전체”가 아니라 `locally_content / locally_pick` 공개 노출 체인으로 보는 것이 맞다

### 2. `/community`는 목록 허브 기준 기본 SEO signal을 잘 갖추고 있다
- source of truth
  - [app/community/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/page.tsx:56)
- 현재 확인된 사실
  - `title`, `description`이 `COMMUNITY_OPEN=false`일 때 콘텐츠 허브 의미로 바뀐다
  - canonical은 query와 무관하게 `/community` 기본 경로로 수렴한다
  - `alternates.languages`도 `ko/en/ja/zh` 기준으로 함께 붙는다
  - `openGraph`, `twitter`도 같은 제목/설명 의미를 공유한다
- Google canonical 가이드 기준 해석
  - 지금처럼 하나의 허브를 대표 URL로 두고 filter/query를 대표 URL 아래로 접는 방식 자체는 일관성 측면에서 무리가 없다
  - 다만 나중에 도시별 허브나 포맷별 랜딩을 별도 indexable landing으로 키우고 싶다면, 이 canonical 정책은 너무 강하게 접는 쪽이다
- 현재 제품 의미 기준 판정
  - 지금은 `정상`

### 3. 콘텐츠 상세는 검색 유입 랜딩으로서 기본 형태를 갖췄다
- source of truth
  - [app/community/[id]/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/%5Bid%5D/page.tsx:23)
  - [app/utils/structuredData.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/structuredData.ts:114)
- 현재 확인된 사실
  - `<title>`과 H1이 같은 제목을 공유한다
  - `description`은 본문 앞부분 snippet 기반으로 개별 생성된다
  - `openGraph` / `twitter` / canonical / locale alternates가 같이 붙는다
  - JSON-LD로 `Article`과 `BreadcrumbList`가 함께 내려간다
  - 작성자와 작성일은 본문 상단에 visible UI로 노출된다
- Google 최신 가이드 관점에서 좋은 점
  - title/H1 일관성이 있어 title link 교체 리스크가 상대적으로 낮다
  - `datePublished`와 visible created date는 같은 사실을 가리킨다
  - `BreadcrumbList`는 실제 사용자 경로 `Home → 커뮤니티 → 글`을 따른다
- low-risk 개선 여지
  - `Article.author`는 `name`만 있고 `author.url`은 없다
  - `dateModified`는 JSON-LD에 들어가지만, 수정 시점을 visible UI에 같이 노출하지는 않는다
  - 대표 이미지가 없을 때 `logo.png` fallback을 쓰는데, 이는 technical fallback으로는 괜찮지만 “본문과 실제로 관련 있는 대표 이미지”라는 Google 이미지 가이드 관점에서는 약하다
- 현재 판정
  - 핵심 signal은 정상
  - 세부 품질은 `부분 보장`

### 4. 가장 큰 SEO 구조 리스크는 “레거시 community 글도 sitemap에 계속 실리는 점”이다
- source of truth
  - [app/sitemap.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/sitemap.ts:119)
  - [app/community/[id]/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/%5Bid%5D/page.tsx:23)
- 현재 확인된 사실
  - sitemap은 `community_posts`를 category 구분 없이 모두 `/community/{id}`로 추가한다
  - 상세 페이지 자체도 category별 차단이나 `noindex` 분기가 없다
  - 즉 과거 `qna / companion / info` row가 DB에 남아 있으면, 현재 `/community` 목록이 콘텐츠 허브로 바뀌었더라도 상세 URL은 여전히 크롤/색인 후보가 된다
- 이것이 중요한 이유
  - 지금 제품 해석은 “커뮤니티 개발 중단, 로컬리 콘텐츠만 활성화”인데, 검색엔진에는 예전 community 글이 계속 살아 있을 수 있다
  - 이는 검색 유입 품질, 사이트 주제 일관성, crawl budget, Naver/Google 제출 품질 측면에서 모두 불리하다
- 현재 판정
  - `부분 보장`
  - 이 항목이 이번 감사의 가장 큰 active SEO gap이다

### 5. 발행 경계는 `SEO용 콘텐츠 채널 보호막` 관점에서 잘 잠겨 있다
- source of truth
  - [app/community/write/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/write/page.tsx:1)
  - [app/api/community/posts/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/community/posts/route.ts:1)
- 현재 확인된 사실
  - `/community/write`는 page-level `robots: { index: false, follow: false }`
  - `locally_content` write는 admin-only다
  - insert 실패 시 업로드한 이미지 storage path cleanup이 있다
  - 성공 시 `revalidatePath('/community')`로 목록 반영을 밀어준다
- SEO 관점 해석
  - 공개 발행면과 비공개 발행면이 분리되어 있고, 운영팀만 콘텐츠 글을 올리는 current policy와도 맞는다
  - orphan image cleanup까지 있어 게시 실패 후 깨진 이미지 asset이 검색 surface에 쌓일 위험도 낮춘다
- 현재 판정
  - `정상`

### 6. robots/sitemap 기본 축은 있으나 Naver 운영 완성도는 `sitemap only`에 가깝다
- source of truth
  - [app/robots.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/robots.ts:1)
  - [app/sitemap.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/sitemap.ts:1)
- 현재 확인된 사실
  - 루트 `robots`는 존재하고 sitemap URL도 노출한다
  - private UI는 robots 차단이 아니라 page-level noindex 전략을 택한다
  - repo tracked 기준 별도 RSS/Atom surface는 찾지 못했다
- Naver 운영 가이드 관점 해석
  - sitemap 제출은 가능한 상태다
  - robots도 기본 형태는 맞다
  - 다만 RSS freshness loop까지 갖춘 상태는 아니므로, Naver 운영 완성도는 `부분 보장`으로 보는 편이 정확하다

### 7. active failure 1건은 `검색 메타`가 아니라 `상세 조회수 반영`이다
- failing test
  - [tests/e2e/61-community-view-count.spec.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/61-community-view-count.spec.ts:1)
- source of truth
  - [app/api/community/views/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/community/views/route.ts:1)
  - [app/community/components/CommunityCommentsPanel.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/components/CommunityCommentsPanel.tsx:1)
- 현재 확인된 사실
  - API route는 `view_count`를 올리고 cookie로 6시간 중복 집계를 막는 구조다
  - 클라이언트는 mount 시 `/api/community/views`를 호출해 `currentViewCount`를 갱신해야 한다
  - 하지만 현재 E2E 기준으로 상세 첫 진입 후 `조회 1`이 아니라 `조회 0`에 머문다
- SEO 관점 해석
  - indexability의 직접 blocker는 아니다
  - 다만 검색 유입 랜딩 상세에서 social proof/runtime 신뢰도를 깎는 adjacent gap으로 기록하는 것이 맞다

## Coverage Gaps
- 현재 close-out bundle은 metadata/sitemap/noindex/feed/content layout 쪽은 잘 잠그지만, “`COMMUNITY_OPEN=false`일 때 legacy `qna/companion/info` 글이 실제 운영 DB에 얼마나 남아 있는지”를 별도 runtime inventory로 닫지는 않는다
- Search Console URL Inspection, Rich Results Test, Naver Search Advisor 제출 여부는 repo 밖 운영 상태라 이번 문서에서 코드만으로 판정할 수 없다
- RSS/Atom feed는 repo tracked route 기준 찾지 못했지만, 외부 CMS/자동 발행 파이프라인이 따로 있는지는 이번 감사 범위 밖이다

## Follow-up Need
- 1순위
  - `로컬리 콘텐츠만 indexable로 가져갈지` 제품 결정을 먼저 잠가야 한다
  - 그 결정이 “yes”라면 다음 핀셋 수정 1순위는 sitemap과 상세 indexability에서 `locally_content`만 남기고 레거시 community 카테고리를 걷어내는 것이다
- 2순위
  - 콘텐츠 상세의 대표 이미지 fallback 정책을 점검해야 한다
  - 로고 fallback은 유지하더라도, SEO용 대표 이미지가 없는 콘텐츠 비율이 높으면 썸네일 품질이 약해진다
- 3순위
  - `author.url` / visible modified date / Naver RSS 보조축은 이후 SEO 품질 향상용으로 묶을 수 있다
- 4순위
  - `61-community-view-count`는 검색 메타와 별도로 runtime/social proof 안정화 패스로 분리해 다루는 것이 가장 안전하다

## Final Verdict
- 현재 `/community`와 `locally_content` 상세는 Google 최신 기본 가이드 기준으로 `title / description / canonical / alternates / Article / Breadcrumb`의 기본 골격을 잘 갖추고 있다
- `/community/write` noindex, admin-only 발행 경계, 발행 후 revalidate도 현재 운영 의미와 잘 맞는다
- 다만 전체 판정은 `정상`까지는 아니다
  - 가장 큰 이유는 sitemap이 `community_posts` 전체를 계속 내보내고 있어, 현재 제품 해석과 다르게 레거시 community 글까지 검색엔진에 열려 있을 가능성이 남기 때문이다
  - 여기에 대표 이미지 fallback 품질, visible modified date 부재, `61-community-view-count` active failure까지 합치면 최종 판정은 `부분 보장`이 가장 정확하다
- 따라서 이번 close-out 기준 결론은 아래처럼 정리하는 것이 맞다
  - `Locally 콘텐츠 SEO core signal`: 정상
  - `indexability boundary와 detail 품질`: 부분 보장
  - `전체 최종 판정`: `부분 보장`
