# Search Engine Cutover Submission Runbook

## Summary
- 이 문서는 `www.locally-travel.com` cutover가 끝난 직후 Google Search Console과 Naver Search Advisor에서 바로 실행할 운영 순서를 적은 runbook이다.
- 목적은 “색인 준비는 되어 있는데 제출/확인 루프를 놓쳐서 노출이 늦어지는 상황”을 줄이는 것이다.
- 범위는 현재 제품 의미에 맞게 `로컬리 콘텐츠` 공개 surface로 고정한다.
  - `/community`
  - `/community/[id]` 중 `locally_content`

## Precondition
- 아래가 먼저 끝나 있어야 한다.
  - `www.locally-travel.com`이 현재 Vercel production으로 정상 연결됨
  - apex `locally-travel.com`은 `www`로 redirect 됨
  - `NEXT_PUBLIC_SITE_URL=https://www.locally-travel.com`
  - production redeploy 완료
- smoke 기준
  - `https://www.locally-travel.com/robots.txt`
  - `https://www.locally-travel.com/sitemap.xml`
  - `https://www.locally-travel.com/community`
  - representative `locally_content` detail 2건

## Google Search Console
### 1. Property 확인
- `www.locally-travel.com`을 보는 property가 맞는지 먼저 확인한다.
- 가능하면 Domain property를 기준으로 보고, 최소한 `https://www.locally-travel.com/` URL-prefix property도 접근 가능해야 한다.
- 이전 `vercel.app` property를 보고 작업하지 않도록 주의한다.
- 이번 cutover에서는 `Change of Address`를 쓰지 않는다.
  - 이유: 최종 사용자 URL을 새 도메인으로 바꾸는 작업이 아니라, 같은 `www.locally-travel.com` URL을 새 호스팅으로 넘기는 작업이기 때문이다.
  - Google 공식 기준으로도 `moving between www and non-www in the same domain` 또는 `site URL remains the same but you are changing hosting providers` 상황에는 Change of Address tool을 쓰지 않는다.

### 2. sitemap 제출
- 제출 URL
  - `https://www.locally-travel.com/sitemap.xml`
- 제출 후 바로 확인할 것
  - status가 fetch 가능 상태인지
  - sitemap 내부 URL이 `www.locally-travel.com` 기준인지
  - legacy community 상세가 섞이지 않는지

### 3. URL Inspection
- 최소 3개 URL을 바로 inspection 한다.
  - `/community`
  - 최근 locally content 상세 2건
- 확인 항목
  - Google-selected canonical이 self URL인지
  - crawling allowed인지
  - page fetch successful인지
  - index 요청 버튼이 보이면 request indexing 실행
  - 단, request indexing은 우선순위를 높이는 신호일 뿐 즉시 색인을 보장하지 않는다

### 4. Rich Results Test
- 상세 URL 1~2건을 Rich Results Test로 확인한다.
- 확인 항목
  - `Article`
  - `Breadcrumb`
- warning은 기록하되, invalid/error가 아니면 즉시 blocker로 보지 않는다.

### 5. 24시간 후 재확인
- Search Console에서 아래를 다시 본다.
  - submitted sitemap status
  - inspected URL canonical 상태
  - coverage / indexing 이상 메시지 유무

## Naver Search Advisor
### 1. 사이트 등록 상태 확인
- `www.locally-travel.com` 사이트가 등록되어 있어야 한다.
- robots.txt와 sitemap 접근 상태를 먼저 확인한다.

### 2. sitemap 제출
- 제출 URL
  - `https://www.locally-travel.com/sitemap.xml`
- Naver 공식 가이드 기준으로 같은 도메인 URL만 포함해야 한다.
- 제출 후 아래를 확인한다.
  - 등록 성공 여부
  - 사이트맵을 찾을 수 없습니다 같은 에러가 없는지

### 3. robots.txt 점검
- `https://www.locally-travel.com/robots.txt`가 200이어야 한다.
- `text/plain` 응답인지 확인한다.
- 공개 콘텐츠 경로가 robots 차단되지 않는지 확인한다.

### 4. 수집 요청
- 대표 locally content 상세 1~2건에 대해 수집 요청을 건다.
- 네이버 공식 가이드 기준 즉시 반영 보장은 없으므로, 요청 후 최소 1일 이상 관찰을 전제로 둔다.

### 5. 선택적 갱신 요청
- 콘텐츠를 자주 갱신할 계획이면 Naver IndexNow 기반 갱신 요청 도입 여부를 후속으로 검토한다.
- 이번 runbook 단계에서는 “즉시 구현”이 아니라 운영 옵션으로만 기록한다.

## Execution Order
1. cutover smoke 완료
2. Google Search Console sitemap 제출
3. Google URL Inspection 3건 + request indexing
4. Google Rich Results Test 1~2건
5. Naver Search Advisor sitemap 제출
6. Naver robots 확인
7. Naver 수집 요청 1~2건
8. 24시간 후 Google/Naver 상태 재확인

## What Good Looks Like
- Google
  - sitemap fetch 성공
  - inspected URL이 self canonical
  - request indexing 요청 가능
- Naver
  - sitemap registered 또는 robots에서 sitemap 확인
  - robots 정상
  - 대표 URL 수집 요청 가능
- 공통
  - `www.locally-travel.com` 기준 URL만 노출됨
  - `vercel.app` canonical/OG/sitemap 흔적 없음

## If Something Looks Wrong
- canonical mismatch가 뜨면 먼저 `NEXT_PUBLIC_SITE_URL`과 latest deployment를 확인한다.
- sitemap fetch 실패면 `robots.txt`, `sitemap.xml`, domain verification을 먼저 본다.
- Naver에서 사이트맵 미등록/접속 실패가 뜨면 200 응답, 같은 도메인 URL 포함 여부, 응답 속도를 먼저 본다.
- 실제 색인이 느려도 바로 코드 문제로 보지 않는다.
  - Google 공식 가이드 기준 recrawl/indexing은 며칠~몇 주가 걸릴 수 있다
  - Naver 공식 가이드도 수집 요청 후 최소 1일~수 주가 걸릴 수 있다

## References
- Google: Ask Google to recrawl your URLs
  - <https://developers.google.com/search/docs/advanced/crawling/ask-google-to-recrawl>
- Google: Change of Address tool
  - <https://support.google.com/webmasters/answer/9370220?hl=en>
- Google: Site move with URL changes
  - <https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes>
- Google: Rich Results Test
  - <https://support.google.com/webmasters/answer/7445569?hl=en>
- Naver: RSS 및 사이트맵 제출
  - <https://searchadvisor.naver.com/guide/request-feed>
- Naver: robots.txt 설정하기
  - <https://searchadvisor.naver.com/guide/seo-basic-robots>
- Naver: 수집요청 및 검색제외
  - <https://searchadvisor.naver.com/guide/request-crawl>
- Naver: 페이지 갱신 요청하기
  - <https://searchadvisor.naver.com/guide/indexnow-request>
